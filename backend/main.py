import os
import psycopg

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime
from dotenv import load_dotenv
from psycopg.rows import dict_row

load_dotenv()

app = FastAPI()

DATABASE_URL = os.getenv("DATABASE_URL")
USER_ID = os.getenv("PAM_TEST_USER_ID")

class MemoryCreate(BaseModel):
    memory_type: str = "general"
    content: str
    person_name: str | None = None
    location: str | None = None
    event_at: datetime | None = None


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
            
@app.post("/memories", status_code=201)
def create_memory(memory: MemoryCreate):
    if not DATABASE_URL or not USER_ID:
        raise HTTPException(
            status_code=500,
            detail="Missing database configuration"
        )

    with psycopg.connect(
        DATABASE_URL,
        sslmode="require",
        row_factory=dict_row
    ) as conn:

        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO public.memories (
                    user_id,
                    memory_type,
                    content,
                    person_name,
                    location,
                    event_at
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id, memory_type, content,
                          person_name, location, event_at,
                          created_at
            """, (
                USER_ID,
                memory.memory_type,
                memory.content,
                memory.person_name,
                memory.location,
                memory.event_at
            ))

            result = cursor.fetchone()
            conn.commit()

            return result