# PAM

The PAM memory companion. Tell PAM things to remember, ask it to help you recall them, and get reminders, by text or voice in the browser.

- `pam.js`: the agent and its tools
- `server.js`: HTTP API for the Expo app
- `memory.js`: client for the Memory API in `backend/`
- `speech.js`: speech-to-text and text-to-speech for voice mode

## Setup

Requires Node 22+ (`nvm use`).

1. Start the Memory API (see `backend/README.md`).
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
| POST | `/reminders/due` | | `{ reminders: [{ id, message }] }` |
| POST | `/reminders/:id/ack` | | `204` once the app has shown the reminder |
| GET | `/health` | | `{ ok: true }` |

`audio` is `{ format: "mp3", data: <base64> }`, or `null` when not requested or text-to-speech failed.

A due reminder is returned again if it isn't acknowledged within 5 minutes.
