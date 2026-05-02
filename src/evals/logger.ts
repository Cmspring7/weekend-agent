import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { pushToBraintrust } from "./braintrust.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOGS_DIR = join(__dirname, "../../data/logs");

export interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
  output: string;
  timestamp: string;
}

export interface AgentRun {
  id: string;
  timestamp: string;
  userInput: string;
  toolCalls: ToolCall[];
  finalResponse: string;
  immediateRating?: {
    score: number; // 1-5
    note?: string;
  };
}

export function createRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function saveRun(run: AgentRun): void {
  const filename = `${run.id}.json`;
  const filepath = join(LOGS_DIR, filename);
  writeFileSync(filepath, JSON.stringify(run, null, 2));
  console.log(`\n📋 Run logged: ${filepath}`);
  // Fire and forget — don't block the CLI on network
  pushToBraintrust(run).catch(() => {});
}
