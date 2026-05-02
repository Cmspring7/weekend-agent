import { createInterface } from "readline";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { AgentRun } from "./evals/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOGS_DIR = join(__dirname, "../data/logs");

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> =>
  new Promise((resolve) => rl.question(q, resolve));

async function main() {
  const files = readdirSync(LOGS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse(); // most recent first

  if (files.length === 0) {
    console.log("No runs logged yet. Go on an adventure first.");
    rl.close();
    return;
  }

  const runs = files.map((f) => ({
    file: join(LOGS_DIR, f),
    run: JSON.parse(readFileSync(join(LOGS_DIR, f), "utf-8")) as AgentRun,
  }));

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Run Logs");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  runs.forEach(({ run }, i) => {
    const rated = run.immediateRating ? `${run.immediateRating.score}/5` : "  ---";
    const date = new Date(run.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const preview = run.userInput.slice(0, 55) + (run.userInput.length > 55 ? "..." : "");
    console.log(`  ${i + 1}. [${rated}] [${date}] ${preview}`);
  });

  console.log("");
  const choice = await ask("Pick a run to view (or q to quit): ");

  if (choice.toLowerCase() === "q") {
    rl.close();
    return;
  }

  const idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx >= runs.length) {
    console.log("Invalid choice.");
    rl.close();
    return;
  }

  const { run } = runs[idx];
  console.log(`\n${"─".repeat(60)}`);
  console.log(`Input:    ${run.userInput}`);
  console.log(`Rating:   ${run.immediateRating ? `${run.immediateRating.score}/5${run.immediateRating.note ? ` — ${run.immediateRating.note}` : ""}` : "not rated"}`);
  console.log(`Tools:    ${run.toolCalls.map((t) => t.tool).join(", ") || "none"}`);
  console.log(`\n${run.finalResponse}`);
  console.log(`${"─".repeat(60)}\n`);

  rl.close();
}

main().catch(console.error);
