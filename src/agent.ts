import Anthropic from "@anthropic-ai/sdk";
import { createInterface } from "readline";
import { config } from "dotenv";
import { getSystemPrompt } from "./prompts/system.js";
import { toolDefinitions, executeTool } from "./tools/index.js";
import { createRunId, saveRun, type AgentRun, type ToolCall } from "./evals/logger.js";

config();

const client = new Anthropic();
const MODEL = "claude-sonnet-4-20250514";

// ============================================================
// The Agent Loop
// ============================================================

// Persists across turns for the duration of the CLI session
const messages: Anthropic.MessageParam[] = [];

async function runAgent(userInput: string): Promise<{ response: string; run: AgentRun | null }> {
  const runId = createRunId();
  const toolCalls: ToolCall[] = [];

  messages.push({ role: "user", content: userInput });

  console.log("\n🤔 Thinking...\n");

  let iterations = 0;
  const MAX_ITERATIONS = 15; // Safety valve

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // Call Claude
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: getSystemPrompt(new Date()),
      tools: toolDefinitions,
      messages,
    });

    // Process response content blocks
    const assistantContent = response.content;

    // Check for tool use
    const toolUseBlocks = assistantContent.filter(
      (block): block is Anthropic.ContentBlockParam & { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
        block.type === "tool_use"
    );

    // Check for text
    const textBlocks = assistantContent.filter(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    // If there are tool calls, execute them
    if (toolUseBlocks.length > 0) {
      // Add assistant message with all content blocks
      messages.push({ role: "assistant", content: assistantContent });

      // Execute each tool and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolBlock of toolUseBlocks) {
        const toolName = toolBlock.name;
        const toolInput = toolBlock.input;

        // Log to console
        if (toolName === "scratchpad") {
          console.log(`  📝 Scratchpad: ${(toolInput as any).thought}\n`);
        } else {
          console.log(`  🔧 ${toolName}(${JSON.stringify(toolInput)})`);
        }

        // Execute
        const result = await executeTool(toolName, toolInput);

        if (toolName !== "scratchpad") {
          // Truncate long results for console
          const preview = result.length > 200 ? result.slice(0, 200) + "..." : result;
          console.log(`     → ${preview}\n`);
        }

        // Log for evals
        toolCalls.push({
          tool: toolName,
          input: toolInput,
          output: result,
          timestamp: new Date().toISOString(),
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolBlock.id,
          content: result,
        });
      }

      // Add tool results as user message
      messages.push({ role: "user", content: toolResults });

      // Continue the loop - Claude will process tool results
      continue;
    }

    // No tool calls - we have the final response
    if (textBlocks.length > 0) {
      const finalResponse = textBlocks.map((b) => b.text).join("\n");

      // Keep assistant turn in history for multi-turn conversation
      messages.push({ role: "assistant", content: assistantContent });

      const run: AgentRun = {
        id: runId,
        timestamp: new Date().toISOString(),
        userInput,
        toolCalls,
        finalResponse,
      };

      return { response: finalResponse, run };
    }

    // Edge case: no text and no tool use (shouldn't happen)
    break;
  }

  return { response: "Agent hit maximum iterations. Something went wrong.", run: null };
}

// ============================================================
// CLI Interface
// ============================================================

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🏔️  Weekend Agent");
  console.log("  Your SLC adventure planner. Tell me what you're working with.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log('  Example: "Saturday morning, got Rip, want something new. Back by noon."');
  console.log('  Type "quit" to exit.\n');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question("You: ", async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      if (trimmed.toLowerCase() === "quit" || trimmed.toLowerCase() === "exit") {
        console.log("\n✌️  Later.\n");
        rl.close();
        process.exit(0);
      }

      try {
        const { response, run } = await runAgent(trimmed);
        console.log(`\n${"─".repeat(60)}`);
        console.log(response);
        console.log(`${"─".repeat(60)}\n`);

        if (run) {
          const ratingStr = await new Promise<string>((resolve) =>
            rl.question("Rate this response (1-5, or skip): ", resolve)
          );
          const score = parseInt(ratingStr);
          if (!isNaN(score) && score >= 1 && score <= 5) {
            run.immediateRating = { score };
            const note = await new Promise<string>((resolve) =>
              rl.question("Quick note (enter to skip): ", resolve)
            );
            if (note.trim()) run.immediateRating.note = note.trim();
          }
          saveRun(run);
          console.log("");
        }
      } catch (err) {
        console.error("\n❌ Agent error:", err);
      }

      prompt();
    });
  };

  prompt();
}

main();
