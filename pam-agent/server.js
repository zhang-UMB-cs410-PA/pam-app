// HTTP API for the Expo app.
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { chat, requireEnv, USER_ID } from "./pam.js";
import { transcribe, speak } from "./speech.js";
import { takeDueReminders, ackReminder } from "./memory.js";

const PORT = Number(process.env.PORT ?? 8787);
const APP_ORIGIN = process.env.PAM_APP_ORIGIN ?? "http://localhost:8081";
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const NOT_HEARD = "Sorry, I didn't catch that. Could you say it again?";

requireEnv();
const app = new Hono();
app.use(cors({ origin: APP_ORIGIN }));

async function reply(text, wantsAudio) {
  if (!wantsAudio) return { reply: text, audio: null };
  try {
    return { reply: text, audio: { format: "mp3", data: await speak(text) } };
  } catch (error) {
    console.error(`[speak failed] ${error.message}`);
    return { reply: text, audio: null };
  }
}

app.get("/health", (c) => c.json({ ok: true }));

app.post("/chat", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return c.json({ error: "text is required" }, 400);

  return c.json(await reply(await chat(USER_ID, text), body.speak === true));
});

app.post("/voice", bodyLimit({ maxSize: MAX_AUDIO_BYTES }), async (c) => {
  const form = await c.req.parseBody();
  if (!(form.audio instanceof File)) return c.json({ error: "audio file is required" }, 400);
  const wantsAudio = form.speak !== "false";

  const transcript = await transcribe(form.audio);
  if (!transcript) return c.json({ transcript, ...(await reply(NOT_HEARD, wantsAudio)) });

  return c.json({ transcript, ...(await reply(await chat(USER_ID, transcript), wantsAudio)) });
});

app.post("/reminders/due", async (c) => c.json({ reminders: await takeDueReminders() }));

app.post("/reminders/:id/ack", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || !(await ackReminder(id))) return c.json({ error: "No reminder with that id." }, 404);
  return c.body(null, 204);
});

app.onError((error, c) => {
  console.error(`[${c.req.method} ${c.req.path}] ${error.message}`);
  return c.json({ error: "PAM ran into a problem. Please try again." }, 500);
});

serve({ fetch: app.fetch, port: PORT, hostname: "0.0.0.0" }, ({ port }) => {
  console.log(`PAM server listening on http://localhost:${port}`);
});
