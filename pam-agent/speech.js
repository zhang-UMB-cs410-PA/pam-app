// Speech-to-text and text-to-speech for voice mode.
import OpenAI from "openai";

const TRANSCRIBE_MODEL = process.env.PAM_TRANSCRIBE_MODEL ?? "gpt-transcribe";
const VOICE_MODEL = process.env.PAM_VOICE_MODEL ?? "gpt-4o-mini-tts";
const VOICE = process.env.PAM_VOICE ?? "marin";
const VOICE_INSTRUCTIONS =
  "You are speaking to an older adult. Speak warmly and calmly, a little slower than normal, " +
  "with clear pronunciation and short pauses between sentences.";

let client;
function openai() {
  client ??= new OpenAI();
  return client;
}

export async function transcribe(file) {
  const result = await openai().audio.transcriptions.create({ file, model: TRANSCRIBE_MODEL });
  return result.text.trim();
}

export async function speak(text) {
  const response = await openai().audio.speech.create({
    model: VOICE_MODEL,
    voice: VOICE,
    input: text,
    instructions: VOICE_INSTRUCTIONS,
    response_format: "mp3",
  });
  return Buffer.from(await response.arrayBuffer()).toString("base64");
}
