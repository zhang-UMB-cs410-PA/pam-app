// Memory store: a JSON file shared by Remember for Me, Help Me Remember, and Remind Me.
//
import crypto from "node:crypto";
import fs from "node:fs";

const FILE = "memories.json";

const API_URL = "http://127.0.0.1:8000";

export async function getDatabaseMemories() {
  const response = await fetch(`${API_URL}/memories`);

  if (!response.ok) {
    throw new Error(`Backend error: ${response.status}`);
  }

  const memories = await response.json();

  return memories.map((m) => ({
    id: String(m.id),
    type: m.memory_type,
    description: m.content,
    people: m.person_name ? [m.person_name] : [],
    datetime: m.event_at,
    location: m.location,
    created: m.created_at,
  }));
}

export async function addDatabaseMemory(fields) {
  const response = await fetch(`${API_URL}/memories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      memory_type: fields.type,
      content: fields.description,
      person_name: fields.people[0] ?? null,
      location: fields.location,
      event_at: fields.datetime,
    }),
  });

  if (!response.ok) {
    throw new Error(`Backend error: ${response.status}`);
  }

  return await response.json();
}

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
