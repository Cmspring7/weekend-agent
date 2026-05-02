import type { AgentRun } from "./logger.js";

export async function pushToBraintrust(run: AgentRun): Promise<void> {
  const apiKey = process.env.BRAINTRUST_API_KEY;
  if (!apiKey || apiKey === "your-key-here") {
    console.log("Braintrust not configured — skipping push. Add BRAINTRUST_API_KEY to .env to enable.");
    return;
  }

  try {
    const { initLogger } = await import("braintrust");

    const logger = initLogger({
      projectName: "weekend-agent",
      apiKey,
      asyncFlush: false,
    });

    const scores: Record<string, number> = {};
    if (run.postAdventureRating) {
      const r = run.postAdventureRating;
      if (r.overallRating != null) scores.overall = r.overallRating / 5;
      if (r.conditionsAccuracy != null) scores.conditions_accuracy = r.conditionsAccuracy / 5;
      if (r.novelty != null) scores.novelty = r.novelty / 5;
      if (r.timeEstimateAccuracy != null) scores.time_estimate_accuracy = r.timeEstimateAccuracy / 5;
    }

    logger.log({
      input: run.userInput,
      output: run.finalResponse,
      metadata: {
        runId: run.id,
        toolCalls: run.toolCalls.map((t) => ({ tool: t.tool, input: t.input })),
        postAdventureRating: run.postAdventureRating,
      },
      ...(Object.keys(scores).length > 0 ? { scores } : {}),
    });

    await logger.flush();
    console.log("Pushed to Braintrust.");
  } catch (err) {
    console.error("Braintrust push failed:", err);
  }
}
