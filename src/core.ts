import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import { getSystemPrompt } from "./prompts/system.js";
import { toolDefinitions, executeTool } from "./tools/index.js";
import { createRunId, type AgentRun, type ToolCall } from "./evals/logger.js";

config();

const client = new Anthropic();
const MODEL = "claude-sonnet-4-20250514";

export interface AgentResult {
  response: string;
  run: AgentRun | null;
  /** Full updated message history, including the new user turn and agent response. */
  messages: Anthropic.MessageParam[];
}

/**
 * Core agent loop. Takes existing conversation history (without the new user message)
 * and returns the agent's response plus the full updated history.
 *
 * Optional callbacks let callers (e.g. the CLI) observe tool calls in real time.
 */
export async function runAgentCore(
  userInput: string,
  conversationHistory: Anthropic.MessageParam[],
  onToolCall?: (toolName: string, toolInput: Record<string, unknown>) => void,
  onToolResult?: (toolName: string, result: string) => void
): Promise<AgentResult> {
  const runId = createRunId();
  const toolCalls: ToolCall[] = [];

  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory,
    { role: "user", content: userInput },
  ];

  let iterations = 0;
  const MAX_ITERATIONS = 15;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: getSystemPrompt(new Date()),
      tools: toolDefinitions,
      messages,
    });

    const assistantContent = response.content;

    const toolUseBlocks = assistantContent.filter(
      (block): block is Anthropic.ContentBlockParam & {
        type: "tool_use";
        id: string;
        name: string;
        input: Record<string, unknown>;
      } => block.type === "tool_use"
    );

    const textBlocks = assistantContent.filter(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    if (toolUseBlocks.length > 0) {
      messages.push({ role: "assistant", content: assistantContent });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolBlock of toolUseBlocks) {
        const toolName = toolBlock.name;
        const toolInput = toolBlock.input;

        onToolCall?.(toolName, toolInput);

        const result = await executeTool(toolName, toolInput);

        onToolResult?.(toolName, result);

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

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    if (textBlocks.length > 0) {
      const finalResponse = textBlocks.map((b) => b.text).join("\n");

      messages.push({ role: "assistant", content: assistantContent });

      const run: AgentRun = {
        id: runId,
        timestamp: new Date().toISOString(),
        userInput,
        toolCalls,
        finalResponse,
      };

      return { response: finalResponse, run, messages };
    }

    break;
  }

  return {
    response: "Agent hit maximum iterations. Something went wrong.",
    run: null,
    messages,
  };
}
