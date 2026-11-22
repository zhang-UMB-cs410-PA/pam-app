// Memory store: the PAM Memory API (backend/), shared by Remember for Me, Help Me Remember, and Remind Me.

const API_URL = process.env.PAM_API_URL ?? "http://127.0.0.1:8000";

export class InvalidInput extends Error {}

async function call(method, path, body) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));

  if (response.status === 404) return undefined;
  if (response.status >= 400 && response.status < 500) throw new InvalidInput(data.error);
  if (!response.ok) throw new Error(`Memory API ${response.status}: ${data?.error}`);
  return data;
}

// ---------- Time ----------

function toLocalIso(value) {
  if (!value) return null;
  const date = new Date(value);
  const offsetMinutes = -date.getTimezoneOffset();
  const local = new Date(date.getTime() + offsetMinutes * 60_000).toISOString().slice(0, 19);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const hours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, "0");
  const minutes = String(Math.abs(offsetMinutes) % 60).padStart(2, "0");
  return `${local}${sign}${hours}:${minutes}`;
}

function toMemory(memory) {
  return {
    id: memory.id,
    memory_type: memory.memory_type,
    content: memory.content,
    person_name: memory.person_name,
    location: memory.location,
    event_at: toLocalIso(memory.event_at),
    remind_at: toLocalIso(memory.remind_at),
    ...(memory.warning && { warning: memory.warning }),
  };
}

// ---------- Memories ----------

export async function getMemories() {
  return (await call("GET", "/memories")).map(toMemory);
}

export async function addMemory(fields) {
  return toMemory(await call("POST", "/memories", fields));
}

export async function updateMemory(id, fields) {
  const memory = await call("PATCH", `/memories/${id}`, fields);
  return memory ? toMemory(memory) : null;
}

export async function deleteMemory(id) {
  return (await call("DELETE", `/memories/${id}`)) !== undefined;
}

// ---------- Reminders ----------

export async function takeDueReminders() {
  const { reminders } = await call("POST", "/reminders/take-due");
  return reminders.map((r) => ({ id: r.id, message: r.content }));
}

export async function ackReminder(id) {
  return (await call("POST", `/reminders/${id}/ack`)) !== undefined;
}
