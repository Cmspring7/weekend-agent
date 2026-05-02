import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const LOGS_DIR = process.env.VERCEL ? "/tmp/logs" : join(process.cwd(), "data/logs");

export default function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { runId, score, note } = req.body ?? {};

  if (!runId || typeof score !== "number") {
    return res.status(400).json({ error: "runId and numeric score required" });
  }

  const filepath = join(LOGS_DIR, `${runId}.json`);

  if (!existsSync(filepath)) {
    // Different serverless container — run file not available, rating can't be persisted
    return res.status(200).json({ ok: true, note: "run not found in this container" });
  }

  try {
    const run = JSON.parse(readFileSync(filepath, "utf-8"));
    run.immediateRating = { score, ...(note ? { note } : {}) };
    mkdirSync(LOGS_DIR, { recursive: true });
    writeFileSync(filepath, JSON.stringify(run, null, 2));
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Rate update failed:", err);
    return res.status(500).json({ error: "Failed to update rating" });
  }
}
