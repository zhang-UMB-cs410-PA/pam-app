import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import { getMemories, addMemory, updateMemory, deleteMemory, InvalidInput } from "./memory.js";

const MODEL = process.env.PAM_MODEL ?? "gpt-5.6";
const REQUIRED_ENV = ["OPENAI_API_KEY"];

export const USER_ID = "local";

export function requireEnv() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.log(`Missing ${missing.join(", ")}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}

// ---------- Tools ----------

function toolError(_context, error) {
  if (error instanceof InvalidInput) return error.message;
  console.error(`\n[tool error] ${error instanceof Error ? error.message : error}`);
  return "The memory store is unavailable right now. Tell the user and ask them to try again shortly.";
}

const memoryFields = {
  memory_type: z.enum(["event", "person", "place", "task", "fact"]),
  content: z.string().describe("Short plain-language summary. Also used as the reminder text."),
  person_name: z.string().nullable().describe('People involved, e.g. "Amy (daughter)" or "Amy (daughter), Tom"'),
  location: z.string().nullable(),
  event_at: z.string().nullable().describe("ISO 8601 with UTC offset, e.g. 2026-11-13T12:00:00-05:00, if any"),
  remind_at: z.string().nullable().describe("ISO 8601 with UTC offset to send a reminder, if any"),
};

const saveMemoryTool = tool({
  name: "save_memory",
  description: "Store a new memory.",
  parameters: z.object(memoryFields),
  execute: async (fields) => addMemory(fields),
  errorFunction: toolError,
});

const listMemoriesTool = tool({
  name: "list_memories",
  description: "Get all stored memories.",
  parameters: z.object({}),
  execute: async () => getMemories(),
  errorFunction: toolError,
});

const updateMemoryTool = tool({
  name: "update_memory",
  description: "Correct a stored memory. Send the full corrected memory.",
  parameters: z.object({ id: z.number().int(), ...memoryFields }),
  execute: async ({ id, ...fields }) => (await updateMemory(id, fields)) ?? "No memory with that id.",
  errorFunction: toolError,
});

const deleteMemoryTool = tool({
  name: "delete_memory",
  description: "Delete a stored memory.",
  parameters: z.object({ id: z.number().int() }),
  execute: async ({ id }) => ((await deleteMemory(id)) ? "Deleted." : "No memory with that id."),
  errorFunction: toolError,
});

// ---------- Agent ----------

const agent = new Agent({
  name: "PAM",
  model: MODEL,
  modelSettings: { reasoning: { effort: "low" } },
  // A function, so the current time is fresh on every turn.
  instructions: () => `You are PAM, a warm, patient memory companion for an older adult.
Keep replies short and simple. The current local time is ${new Date().toString()}
(time zone ${Intl.DateTimeFormat().resolvedOptions().timeZone}).
Replies may be read aloud: use plain spoken sentences, with no markdown, lists, emoji, or ISO times.
Say times the way a person would ("Friday at noon").

REMEMBER FOR ME
- When the user tells you something worth remembering, save it with save_memory.
- Turn relative dates ("Friday", "tomorrow") into exact ISO times with the UTC offset.
- For events and tasks, set remind_at (default: 1 hour before). The reminder reads out the
  content, so write content that works as a reminder ("Lunch with Amy at noon. Bring her birthday card.").
- If an important detail is unclear, ask before saving.
- After saving, say back what you saved.

HELP ME REMEMBER
- To answer questions, call list_memories and look for the answer.
- If the user says they forgot something, do not give the answer at once. Give one hint per turn
  about the exact thing they forgot, each stronger than the last. Never repeat a detail the user
  already mentioned. Example for a forgotten person: (1) how they know the person or where they
  met, (2) a detail about the person, (3) the first letter of the name, (4) the full name.
  Ask "Would you like another hint?" each time.
- If the user guesses, check the guess against the stored memory exactly. If it is right, say so.
  If it is close but not exact (like a nickname), say it is close and give the exact answer.
  If it is wrong, say so kindly and give the next hint.
- If the user asks directly or says "just tell me", answer right away.

REVIEW
- If asked what is saved, list the memories plainly.
- Use update_memory or delete_memory to correct or remove a memory.`,
  tools: [saveMemoryTool, listMemoriesTool, updateMemoryTool, deleteMemoryTool],
});

// ---------- Conversations ----------

const conversations = new Map();

export function chat(userId, text) {
  const conversation = conversations.get(userId) ?? { history: [], queue: Promise.resolve() };
  conversations.set(userId, conversation);

  const turn = conversation.queue.then(async () => {
    const result = await run(agent, [...conversation.history, { role: "user", content: text }]);
    conversation.history = result.history;
    return result.finalOutput;
  });
  conversation.queue = turn.catch(() => {});
  return turn;
}
