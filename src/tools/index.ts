import Anthropic from "@anthropic-ai/sdk";

// ============================================================
// Tool Definitions (sent to Claude)
// ============================================================

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "scratchpad",
    description:
      "Write internal reasoning notes. Use this BEFORE making recommendations to parse constraints, evaluate options, and think through tradeoffs. This is your thinking space. The user will not see this directly, but it will be logged for eval purposes.",
    input_schema: {
      type: "object" as const,
      properties: {
        thought: {
          type: "string",
          description:
            "Your internal reasoning. Parse constraints, list candidate ideas, evaluate tradeoffs, explain why you're leaning toward certain options.",
        },
      },
      required: ["thought"],
    },
  },
  {
    name: "web_search",
    description:
      "Search the web for current information. Use for trail conditions, events happening this weekend in SLC, restaurant recommendations, road closures, recent trip reports, Reddit threads, etc. Keep queries short and specific.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query. Keep it short: 2-6 words. Examples: 'SLC trail conditions May 2026', 'best new coffee shops Salt Lake City', 'Millcreek Canyon road status'",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_weather",
    description:
      "Get current weather and forecast for a location. Defaults to Salt Lake City if no coordinates given.",
    input_schema: {
      type: "object" as const,
      properties: {
        lat: {
          type: "number",
          description: "Latitude. Default: 40.7608 (SLC)",
        },
        lon: {
          type: "number",
          description: "Longitude. Default: -111.891 (SLC)",
        },
      },
      required: [],
    },
  },
  {
    name: "memory_read",
    description:
      "Read from Charlie's adventure memory. Returns past adventures, ratings, and preferences. Use this to avoid recommending places he's been recently and to understand what he likes.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "What to look up. Examples: 'recent hikes', 'highly rated restaurants', 'places visited last month', 'all entries'",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "memory_write",
    description:
      "Save a new entry to Charlie's adventure memory. Use this AFTER Charlie confirms he did an activity, to log it for future reference.",
    input_schema: {
      type: "object" as const,
      properties: {
        place: {
          type: "string",
          description: "Name of the place or activity",
        },
        category: {
          type: "string",
          enum: [
            "hike",
            "trail_run",
            "mtb",
            "gravel",
            "bikepack",
            "ski",
            "climb",
            "coffee",
            "restaurant",
            "event",
            "other",
          ],
          description: "Category of activity",
        },
        date: {
          type: "string",
          description: "Date of the activity (YYYY-MM-DD)",
        },
        rating: {
          type: "number",
          description: "Rating 1-5 (optional, added after Charlie rates it)",
        },
        notes: {
          type: "string",
          description:
            "Any notes: conditions, what made it good/bad, would do again, etc.",
        },
      },
      required: ["place", "category", "date"],
    },
  },
];

// ============================================================
// Tool Execution
// ============================================================

export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "scratchpad":
      return handleScratchpad(input);
    case "web_search":
      return await handleWebSearch(input);
    case "get_weather":
      return await handleWeather(input);
    case "memory_read":
      return handleMemoryRead(input);
    case "memory_write":
      return handleMemoryWrite(input);
    default:
      return `Unknown tool: ${name}`;
  }
}

// ---- Scratchpad ----

function handleScratchpad(input: Record<string, unknown>): string {
  // The scratchpad is just acknowledged. The thought is captured
  // in the message log for eval purposes.
  return "Noted. Continue with your research and reasoning.";
}

// ---- Web Search ----
// For the prototype, this uses Anthropic's built-in web search
// via a second API call. In production you might use SerpAPI,
// Brave Search, or similar.

async function handleWebSearch(
  input: Record<string, unknown>
): Promise<string> {
  const query = input.query as string;

  // For the prototype, we return a placeholder.
  // To make this live, uncomment the Anthropic web search block below
  // or wire up your preferred search API.

  // --- OPTION A: Use Anthropic web search ---
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [{ role: "user", content: `Search for: ${query}. Return a concise summary of the most relevant results.` }],
  });
  const textBlocks = response.content.filter((b) => b.type === "text");
  return textBlocks.map((b) => b.text).join("\n") || "No results found.";
}

// ---- Weather ----

async function handleWeather(
  input: Record<string, unknown>
): Promise<string> {
  const lat = (input.lat as number) || 40.7608;
  const lon = (input.lon as number) || -111.891;

  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey || apiKey === "your-key-here") {
    return `[Weather API not configured]\n\nTo enable live weather:\n1. Get a free API key at https://openweathermap.org/api\n2. Add it to your .env file\n\nFor now, assume typical May conditions in SLC: highs 65-75F in the valley, 45-55F at elevation, chance of afternoon thunderstorms.`;
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.list) {
      return `Weather API error: ${JSON.stringify(data)}`;
    }

    // Summarize next 24 hours
    const next24h = data.list.slice(0, 8);
    const summary = next24h
      .map((entry: any) => {
        const time = new Date(entry.dt * 1000).toLocaleTimeString("en-US", {
          hour: "numeric",
          hour12: true,
        });
        return `${time}: ${Math.round(entry.main.temp)}°F, ${entry.weather[0].description}, wind ${Math.round(entry.wind.speed)}mph`;
      })
      .join("\n");

    return `Weather forecast for (${lat}, ${lon}):\n\n${summary}`;
  } catch (err) {
    return `Weather API error: ${err}`;
  }
}

// ---- Memory ----
// Using a simple JSON file for the prototype.
// Upgrade to SQLite when you want more sophisticated queries.

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// On Vercel the filesystem is read-only except /tmp; use /tmp for writes.
const DATA_DIR = process.env.VERCEL ? "/tmp" : join(__dirname, "../../data");
const MEMORY_FILE = join(DATA_DIR, "memory.json");

interface MemoryEntry {
  place: string;
  category: string;
  date: string;
  rating?: number;
  notes?: string;
}

function loadMemory(): MemoryEntry[] {
  if (!existsSync(MEMORY_FILE)) {
    writeFileSync(MEMORY_FILE, "[]");
    return [];
  }
  return JSON.parse(readFileSync(MEMORY_FILE, "utf-8"));
}

function saveMemory(entries: MemoryEntry[]): void {
  writeFileSync(MEMORY_FILE, JSON.stringify(entries, null, 2));
}

function handleMemoryRead(input: Record<string, unknown>): string {
  const entries = loadMemory();

  if (entries.length === 0) {
    return "No adventures logged yet. This is a fresh start.";
  }

  const query = (input.query as string).toLowerCase();

  // Simple filtering
  let filtered = entries;

  if (query.includes("recent")) {
    filtered = entries.slice(-10);
  } else if (query.includes("highly rated") || query.includes("top")) {
    filtered = entries.filter((e) => e.rating && e.rating >= 4);
  } else if (query.includes("last month")) {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    filtered = entries.filter((e) => new Date(e.date) >= oneMonthAgo);
  } else {
    // Search by category or keyword
    const categories = [
      "hike", "trail_run", "mtb", "gravel", "bikepack",
      "ski", "climb", "coffee", "restaurant", "event",
    ];
    const matchedCategory = categories.find((c) => query.includes(c));
    if (matchedCategory) {
      filtered = entries.filter((e) => e.category === matchedCategory);
    }
  }

  if (filtered.length === 0) {
    return `No entries found matching "${input.query}".`;
  }

  return filtered
    .map(
      (e) =>
        `- ${e.date} | ${e.category} | ${e.place}${e.rating ? ` | ${e.rating}/5` : ""}${e.notes ? ` | ${e.notes}` : ""}`
    )
    .join("\n");
}

function handleMemoryWrite(input: Record<string, unknown>): string {
  const entries = loadMemory();
  const newEntry: MemoryEntry = {
    place: input.place as string,
    category: input.category as string,
    date: input.date as string,
    rating: input.rating as number | undefined,
    notes: input.notes as string | undefined,
  };
  entries.push(newEntry);
  saveMemory(entries);
  return `Saved: ${newEntry.place} (${newEntry.category}) on ${newEntry.date}`;
}
