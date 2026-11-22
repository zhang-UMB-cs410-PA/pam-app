# PAM

The PAM memory companion. Tell PAM things to remember, ask it to help you recall them, and get reminders, by text or voice in the browser.

- `pam.js`: the agent and its tools
- `server.js`: HTTP API for the Expo app
- `memory.js`: Supabase memory store
- `speech.js`: speech-to-text and text-to-speech for voice mode

## Setup

Requires Node 22+ (`nvm use`).

1. In the Supabase SQL editor, run `backend/stuff/Create_Memory_Tables.sql` (new project only).
2. Copy `.env.example` to `.env` and fill it in.
3. `npm install`

## Run

```
npm start      # API server on http://localhost:8787
```

## API

Text and voice share one conversation per user.

| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/chat` | JSON `{ text, speak? }` | `{ reply, audio }` |
| POST | `/voice` | Multipart: `audio` file, `speak` (`"false"` for no audio) | `{ transcript, reply, audio }` |
| GET | `/reminders/due` | | `{ reminders: [message] }`, each returned once |
| GET | `/health` | | `{ ok: true }` |

`audio` is `{ format: "mp3", data: <base64> }`, or `null` when not requested or text-to-speech failed.

Memories and reminders are stored in Supabase (`public.memories`, `public.reminders`) for the user in `PAM_TEST_USER_ID`.
