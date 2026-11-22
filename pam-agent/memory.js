// Memory store: Supabase tables shared by Remember for Me, Help Me Remember, and Remind Me.
import { createClient } from "@supabase/supabase-js";

const USER_ID = process.env.PAM_TEST_USER_ID;
const MEMORY_COLUMNS = "id, memory_type, content, person_name, location, event_at, reminders(remind_at, completed)";

let client;
function db() {
  client ??= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  return client;
}

function check(error) {
  if (error) throw new Error(`Supabase: ${error.message}`);
}

export class InvalidInput extends Error {}

// ---------- Time ----------

const UTC_OFFSET = /(Z|[+-]\d{2}:\d{2})$/;

function toTimestamp(value, field) {
  if (value == null) return null;
  if (!UTC_OFFSET.test(value) || Number.isNaN(Date.parse(value))) {
    throw new InvalidInput(`${field} must be an ISO 8601 time with a UTC offset, like 2026-11-13T12:00:00-05:00.`);
  }
  return value;
}

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

// ---------- Mapping ----------

function toRow(fields) {
  return {
    memory_type: fields.memory_type,
    content: fields.content,
    person_name: fields.person_name,
    location: fields.location,
    event_at: toTimestamp(fields.event_at, "event_at"),
  };
}

function toMemory(row) {
  const reminder = row.reminders.find((r) => !r.completed);
  return {
    id: row.id,
    memory_type: row.memory_type,
    content: row.content,
    person_name: row.person_name,
    location: row.location,
    event_at: toLocalIso(row.event_at),
    remind_at: toLocalIso(reminder?.remind_at),
  };
}

// ---------- Memories ----------

export async function getMemories() {
  const { data, error } = await db()
    .from("memories")
    .select(MEMORY_COLUMNS)
    .eq("user_id", USER_ID)
    .order("created_at");
  check(error);
  return data.map(toMemory);
}

async function getMemory(id) {
  const { data, error } = await db()
    .from("memories")
    .select(MEMORY_COLUMNS)
    .eq("id", id)
    .eq("user_id", USER_ID)
    .maybeSingle();
  check(error);
  return data && toMemory(data);
}

export async function addMemory(fields) {
  const row = toRow(fields);
  const remindAt = toTimestamp(fields.remind_at, "remind_at");
  const { data, error } = await db()
    .from("memories")
    .insert({ ...row, user_id: USER_ID })
    .select("id")
    .single();
  check(error);

  await syncReminder(data.id, remindAt);
  return getMemory(data.id);
}

export async function updateMemory(id, fields) {
  const row = toRow(fields);
  const remindAt = toTimestamp(fields.remind_at, "remind_at");
  const { data, error } = await db()
    .from("memories")
    .update(row)
    .eq("id", id)
    .eq("user_id", USER_ID)
    .select("id")
    .maybeSingle();
  check(error);
  if (!data) return null;

  await syncReminder(id, remindAt);
  return getMemory(id);
}

export async function deleteMemory(id) {
  const { data, error } = await db()
    .from("memories")
    .delete()
    .eq("id", id)
    .eq("user_id", USER_ID)
    .select("id");
  check(error);
  return data.length > 0;
}

// ---------- Reminders ----------

async function syncReminder(memoryId, remindAt) {
  const { data: pending, error } = await db()
    .from("reminders")
    .select("id, remind_at")
    .eq("memory_id", memoryId)
    .eq("completed", false);
  check(error);

  const current = pending[0];
  if (current && remindAt && Date.parse(current.remind_at) === Date.parse(remindAt)) return;

  if (pending.length > 0) {
    const { error } = await db().from("reminders").delete().eq("memory_id", memoryId).eq("completed", false);
    check(error);
  }

  if (remindAt && Date.parse(remindAt) > Date.now()) {
    const { error } = await db()
      .from("reminders")
      .insert({ user_id: USER_ID, memory_id: memoryId, remind_at: remindAt });
    check(error);
  }
}

export async function takeDueReminders() {
  const now = new Date();
  const { data, error } = await db()
    .from("reminders")
    .update({ completed: true })
    .eq("user_id", USER_ID)
    .eq("completed", false)
    .lte("remind_at", now.toISOString())
    .select("memories(content, event_at)");
  check(error);

  return data
    .filter((r) => !r.memories.event_at || new Date(r.memories.event_at) > now)
    .map((r) => r.memories.content);
}
