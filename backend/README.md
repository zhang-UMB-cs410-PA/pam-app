# PAM Memory API

Stores memories and reminders in Supabase for the PAM agent.

## Setup

```
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
```

Run the SQL files in `stuff/` in the Supabase SQL editor, in order.

## Run

```
.venv/bin/uvicorn main:app --reload
```

Endpoints are listed at http://127.0.0.1:8000/docs.

## Test

```
docker run -d --name pam-test-db -e POSTGRES_PASSWORD=postgres -p 127.0.0.1:54329:5432 public.ecr.aws/supabase/postgres:17.12.0.000
.venv/bin/pip install -r requirements-dev.txt
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/postgres .venv/bin/pytest
```
