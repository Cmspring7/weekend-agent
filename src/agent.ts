import { createInterface } from "readline";
import { config } from "dotenv";
import type Anthropic from "@anthropic-ai/sdk";
import { runAgentCore } from "./core.js";
import { saveRun, type AgentRun } from "./evals/logger.js";

config();

// Persists across turns for the duration of the CLI session
const conversationHistory: Anthropic.MessageParam[] = [];

async function runAgent(userInput: string): Promise<{ response: string; run: AgentRun | null }> {
  console.log("\n🤔 Thinking...\n");

  const result = await runAgentCore(
    userInput,
    conversationHistory,
    (toolName, toolInput) => {
      if (toolName === "scratchpad") {
        console.log(`  📝 Scratchpad: ${(toolInput as any).thought}\n`);
      } else {
        console.log(`  🔧 ${toolName}(${JSON.stringify(toolInput)})`);
      }
    },
    (toolName, result) => {
      if (toolName !== "scratchpad") {
        const preview = result.length > 200 ? result.slice(0, 200) + "..." : result;
        console.log(`     → ${preview}\n`);
      }
    }
  );

  // Sync local history with the updated messages returned by the core
  conversationHistory.length = 0;
  conversationHistory.push(...result.messages);

  return { response: result.response, run: result.run };
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
