# PAM (Personal Agent Memory)

A memory companion for older adults. Tell PAM things to remember, ask it to help you recall them, and get reminders.

## Requirements

- Node 22 or newer (`nvm use 22`)
- Python 3.13
- An OpenAI API key
- Supabase database

## Setup (once)

```bash
npm ci

cd pam-agent
npm ci
cp .env.example .env        # add your OPENAI_API_KEY
cd ..

cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env        # add DATABASE_URL and PAM_TEST_USER_ID
cd ..
```

`PAM_TEST_USER_ID` can be any UUID, for example from `python3 -c "import uuid; print(uuid.uuid4())"`. Your memories are saved under it.

## Run

```bash
npm run dev
```

To use a phone with Expo Go, put `EXPO_PUBLIC_PAM_AGENT_URL=http://<your computer's IP>:8787` in `.env.local`.

## Notes

- Use `npm ci`, not `npm install`, unless you are adding a package.
