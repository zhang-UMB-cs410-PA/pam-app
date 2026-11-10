// Memory store: a JSON file shared by Remember for Me, Help Me Remember, and Remind Me.
//
import fs from "node:fs";
import crypto from "node:crypto";

const FILE = "memories.json";

export function getMemories() {
  if (!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function saveMemories(memories) {
  fs.writeFileSync(FILE, JSON.stringify(memories, null, 2));
}

export function addMemory(fields) {
  const memory = {
    id: crypto.randomUUID(),
    ...fields,
    reminded: false,
    created: new Date().toISOString(),
  };
  saveMemories([...getMemories(), memory]);
  return memory;
}

export function updateMemory(id, fields) {
  const memories = getMemories();
  const memory = memories.find((m) => m.id === id);
  if (!memory) return null;

  Object.assign(memory, fields, { reminded: false });
  saveMemories(memories);
  return memory;
}

export function deleteMemory(id) {
  const memories = getMemories();
  const remaining = memories.filter((m) => m.id !== id);
  saveMemories(remaining);
  return remaining.length < memories.length;
}

// Returns memories whose reminder time has passed, and marks them as reminded.
export function takeDueReminders() {
  const memories = getMemories();
  const now = new Date();
  const due = memories.filter((m) => m.remind_at && !m.reminded && new Date(m.remind_at) <= now);

  for (const memory of due) {
    memory.reminded = true;
  }
  if (due.length > 0) saveMemories(memories);
  return due;
}
