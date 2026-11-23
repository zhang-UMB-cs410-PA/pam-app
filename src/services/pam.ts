const AGENT_URL = process.env.EXPO_PUBLIC_PAM_AGENT_URL ?? 'http://localhost:8787';

export type Reminder = { id: number; message: string };

async function post<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(`${AGENT_URL}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`PAM agent ${response.status}`);
  return response.status === 204 ? (undefined as T) : response.json();
}

export async function sendMessage(text: string): Promise<string> {
  const { reply } = await post<{ reply: string }>('/chat', { text });
  return reply;
}

export async function takeDueReminders(): Promise<Reminder[]> {
  const { reminders } = await post<{ reminders: Reminder[] }>('/reminders/due');
  return reminders;
}

export async function ackReminder(id: number): Promise<void> {
  await post(`/reminders/${id}/ack`);
}
