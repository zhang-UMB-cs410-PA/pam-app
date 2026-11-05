import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import readline from "node:readline";
import { getMemories, addMemory, updateMemory, deleteMemory, takeDueReminders } from "./memory.js";

const MODEL = "gpt-5.6";
const REMINDER_CHECK_MS = 15_000;

// ---------- Tools ----------

const memoryFields = {
  type: z.enum(["event", "person", "place", "task", "fact"]),
  description: z.string().describe("Short plain-language summary"),
  people: z.array(z.string()).describe('For example ["Amy (daughter)"]'),
  datetime: z.string().nullable().describe("ISO 8601 local time, if any"),
  location: z.string().nullable(),
  remind_at: z.string().nullable().describe("ISO 8601 local time to send a reminder, if any"),
  reminder_text: z.string().nullable(),
};

const saveMemoryTool = tool({
  name: "save_memory",
  description: "Store a new memory.",
  parameters: z.object(memoryFields),
  execute: async (fields) => addMemory(fields),
});

const listMemoriesTool = tool({
  name: "list_memories",
  description: "Get all stored memories.",
  parameters: z.object({}),
  execute: async () => getMemories(),
});

const updateMemoryTool = tool({
  name: "update_memory",
  description: "Correct a stored memory. Send the full corrected memory.",
  parameters: z.object({ id: z.string(), ...memoryFields }),
  execute: async ({ id, ...fields }) => updateMemory(id, fields) ?? "No memory with that id.",
});

const deleteMemoryTool = tool({
  name: "delete_memory",
  description: "Delete a stored memory.",
  parameters: z.object({ id: z.string() }),
  execute: async ({ id }) => (deleteMemory(id) ? "Deleted." : "No memory with that id."),
});

// ---------- Agent ----------

const agent = new Agent({
  name: "PAM",
  model: MODEL,
  modelSettings: { reasoning: { effort: "low" } },
  // A function, so the current time is fresh on every turn.
  instructions: () => `You are PAM, a warm, patient memory companion for an older adult.
Keep replies short and simple. The current local time is ${new Date().toString()}.

REMEMBER FOR ME
- When the user tells you something worth remembering, save it with save_memory.
- Turn relative dates ("Friday", "tomorrow") into exact ISO times.
- For events and tasks, set remind_at (default: 1 hour before) and a friendly reminder_text.
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

// ---------- Remind Me ----------

function checkReminders(rl) {
  for (const memory of takeDueReminders()) {
    console.log(`\nReminder: ${memory.reminder_text ?? memory.description}`);
    rl.prompt();
  }
}

// ---------- Chat loop ----------

function showMemories() {
  const rows = getMemories().map((m) => ({
    type: m.type,
    description: m.description,
    when: m.datetime,
    remind_at: m.remind_at,
  }));
  console.table(rows);
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.log("Missing OPENAI_API_KEY. Run: export OPENAI_API_KEY=your-key");
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "You: " });
  const reminderTimer = setInterval(() => checkReminders(rl), REMINDER_CHECK_MS);
  let history = [];

  console.log('PAM is ready. Type "/memories" to see what is saved, or "/quit" to exit.\n');
  rl.prompt();

  for await (const line of rl) {
    const input = line.trim();

    if (input === "/quit") break;
    if (input === "/memories") {
      showMemories();
    } else if (input) {
      try {
        const result = await run(agent, [...history, { role: "user", content: input }]);
        history = result.history;
        console.log(`PAM: ${result.finalOutput}\n`);
      } catch (error) {
        console.log(`Error: ${error.message}\n`);
      }
    }
    rl.prompt();
  }

  clearInterval(reminderTimer);
  rl.close();
}

main();
