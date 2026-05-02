# Weekend Agent 🏔️

A Tier 2 multi-step planning agent that answers one question: **"What should I do this weekend?"**

Built to learn about agent patterns and evals. Tailored for Salt Lake City.

## What it does

Give it your constraints (time window, energy level, who's coming, etc.) and it returns two ideas:
- **The chill option** - lower effort, lower commitment
- **The adventure option** - something active and specific

The agent uses a scratchpad for internal reasoning, searches for current conditions, checks weather, and tracks your history to avoid repeating spots.

## Setup

```bash
npm install
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
```

## Run

```bash
npm start
```

Then just talk to it:

```
You: Saturday morning, got Rip, want something new. Back by noon.
```

## Project structure

```
src/
  agent.ts          - The core agent loop
  tools/index.ts    - Tool definitions and execution
  prompts/system.ts - System prompt (the agent's personality)
  evals/logger.ts   - Logs every run for eval analysis
data/
  memory.json       - Places visited, ratings, preferences
  logs/             - JSON logs of every agent run
```

## Adding tools

1. Add the tool definition to `toolDefinitions` in `src/tools/index.ts`
2. Add the handler in the `executeTool` switch statement
3. The agent will automatically discover and use the new tool

## Evals

Every run is logged to `data/logs/` with:
- The user input
- Every tool call (input + output)
- Scratchpad reasoning
- The final response

After an adventure, you can add a post-adventure rating to the log file with scores for conditions accuracy, novelty, time estimate accuracy, and overall satisfaction.

Future: wire up Braintrust for structured eval runs and comparisons.

## Next steps

- [ ] Enable web search (uncomment in tools/index.ts)
- [ ] Add OpenWeather API key for live weather
- [ ] Add Google Places API for restaurant/coffee lookups
- [ ] Wire up Reddit API for local trail reports
- [ ] Add post-adventure rating CLI command
- [ ] Integrate Braintrust for eval tracking
- [ ] Build a simple web UI (when ready)
