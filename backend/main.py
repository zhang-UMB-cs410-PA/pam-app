import os
import psycopg

from fastapi import FastAPI
from dotenv import load_dotenv
from psycopg.rows import dict_row

load_dotenv()

app = FastAPI()

DATABASE_URL = os.getenv("DATABASE_URL")
USER_ID = os.getenv("PAM_TEST_USER_ID")


@app.get("/")
def home():
    return {"message": "PAM BACKEND IS RUNNING"}


@app.get("/memories")
def get_memories():
    if not DATABASE_URL or not USER_ID:
        raise RuntimeError("Missing database configuration")

    with psycopg.connect(
        DATABASE_URL,
        sslmode="require",
        row_factory=dict_row
    ) as conn:

        conn.read_only = True

        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id, memory_type, content,
                       person_name, location, event_at,
                       created_at
                FROM public.memories
                WHERE user_id = %s
                ORDER BY id
            """, (USER_ID,))

            return cursor.fetchall()