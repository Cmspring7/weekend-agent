import { config } from "dotenv";
import { runAgentCore } from "../src/core.js";
import { saveRun } from "../src/evals/logger.js";
import type Anthropic from "@anthropic-ai/sdk";

config();

// Tell Vercel Pro this function can run up to 5 minutes
export const maxDuration = 300;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, messages = [], sessionId } = req.body ?? {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    const result = await runAgentCore(
      message,
      messages as Anthropic.MessageParam[]
    );

    let runId: string | null = null;
    if (result.run) {
      try {
        saveRun(result.run);
        runId = result.run.id;
      } catch (e) {
        // Log save failure is non-fatal
        console.error("saveRun failed:", e);
      }
    }

    return res.status(200).json({
      response: result.response,
      runId,
      messages: result.messages,
    });
  } catch (err) {
    console.error("Agent error:", err);
    return res.status(500).json({ error: "Agent failed" });
  }
}
