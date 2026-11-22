import logging
import os

from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from psycopg import sql
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from pydantic import AwareDatetime, BaseModel, Field, field_serializer

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
USER_ID = os.getenv("PAM_TEST_USER_ID")

ACK_TIMEOUT = timedelta(minutes=5)
STALE_EVENT_AGE = timedelta(hours=1)

log = logging.getLogger("pam")

MemoryType = Literal["event", "person", "place", "task", "fact"]


class MemoryCreate(BaseModel):
    memory_type: MemoryType
    content: str = Field(min_length=1)
    person_name: str | None = None
    location: str | None = None
    event_at: AwareDatetime | None = None
    remind_at: AwareDatetime | None = None


class MemoryUpdate(BaseModel):
    memory_type: MemoryType = None
    content: str = Field(default=None, min_length=1)
    person_name: str | None = None
    location: str | None = None
    event_at: AwareDatetime | None = None
    remind_at: AwareDatetime | None = None


class Memory(BaseModel):
    id: int
    memory_type: str
    content: str
    person_name: str | None
    location: str | None
    event_at: datetime | None
    remind_at: datetime | None
    created_at: datetime

    @field_serializer("event_at", "remind_at", "created_at")
    def to_utc(self, value):
        return value and value.astimezone(timezone.utc)


class DueReminder(BaseModel):
    id: int
    memory_id: int
    content: str
    event_at: datetime | None
    remind_at: datetime

    @field_serializer("event_at", "remind_at")
    def to_utc(self, value):
        return value and value.astimezone(timezone.utc)


pool: ConnectionPool | None = None


@asynccontextmanager
async def lifespan(app):
    global pool
    if not DATABASE_URL or not USER_ID:
        raise RuntimeError("Missing DATABASE_URL or PAM_TEST_USER_ID. Copy .env.example to .env and fill it in.")

    pool = ConnectionPool(
        DATABASE_URL,
        min_size=1,
        max_size=5,
        kwargs={"row_factory": dict_row, "prepare_threshold": None},
        open=True,
    )
    yield
    pool.close()


app = FastAPI(title="PAM Memory API", lifespan=lifespan)


# ---------- Errors ----------

@app.exception_handler(HTTPException)
def http_error(request: Request, error: HTTPException):
    return JSONResponse({"error": error.detail}, status_code=error.status_code)


@app.exception_handler(RequestValidationError)
def validation_error(request: Request, error: RequestValidationError):
    first = error.errors()[0]
    field = ".".join(str(part) for part in first["loc"] if part != "body")
    message = f"{field}: {first['msg']}" if field else first["msg"]
    return JSONResponse({"error": message}, status_code=422)


@app.exception_handler(Exception)
def server_error(request: Request, error: Exception):
    log.exception("%s %s failed", request.method, request.url.path)
    return JSONResponse({"error": "The memory store ran into a problem."}, status_code=500)


# ---------- Queries ----------

MEMORY_SELECT = """
    SELECT m.id, m.memory_type, m.content,
           m.person_name, m.location, m.event_at,
           r.remind_at, m.created_at
    FROM public.memories m
    LEFT JOIN public.reminders r
      ON r.memory_id = m.id AND NOT r.completed
    WHERE m.user_id = %s
"""


def find_memory(cursor, memory_id):
    cursor.execute(MEMORY_SELECT + " AND m.id = %s", (USER_ID, memory_id))
    return cursor.fetchone()


def sync_reminder(cursor, memory_id, remind_at):
    cursor.execute("""
        SELECT id, remind_at, delivered_at
        FROM public.reminders
        WHERE memory_id = %s AND NOT completed
    """, (memory_id,))
    current = cursor.fetchone()

    if current and remind_at and current["remind_at"] == remind_at:
        return None

    if current:
        if current["delivered_at"] is None:
            cursor.execute("DELETE FROM public.reminders WHERE id = %s", (current["id"],))
        else:
            cursor.execute("UPDATE public.reminders SET completed = true WHERE id = %s", (current["id"],))

    if remind_at is None:
        return None

    if remind_at <= datetime.now(timezone.utc):
        return "remind_at is in the past, so no reminder was set."

    cursor.execute("""
        INSERT INTO public.reminders (user_id, memory_id, remind_at)
        VALUES (%s, %s, %s)
    """, (USER_ID, memory_id, remind_at))
    return None


def memory_response(row, warning=None):
    body = Memory(**row).model_dump(mode="json")
    if warning:
        body["warning"] = warning
    return body


# ---------- Endpoints ----------

@app.get("/")
def home():
    return {"message": "PAM BACKEND IS RUNNING"}


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/memories")
def get_memories():
    with pool.connection() as conn, conn.cursor() as cursor:
        cursor.execute(MEMORY_SELECT + " ORDER BY m.created_at, m.id", (USER_ID,))
        return [memory_response(row) for row in cursor.fetchall()]


@app.post("/memories", status_code=201)
def create_memory(memory: MemoryCreate):
    with pool.connection() as conn, conn.cursor() as cursor:
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
            RETURNING id
        """, (
            USER_ID,
            memory.memory_type,
            memory.content,
            memory.person_name,
            memory.location,
            memory.event_at
        ))
        memory_id = cursor.fetchone()["id"]

        warning = sync_reminder(cursor, memory_id, memory.remind_at)
        return memory_response(find_memory(cursor, memory_id), warning)


@app.patch("/memories/{memory_id}")
def update_memory(memory_id: int, changes: MemoryUpdate):
    fields = changes.model_dump(include=changes.model_fields_set)
    if not fields:
        raise HTTPException(status_code=400, detail="Send at least one field to change.")

    columns = {name: value for name, value in fields.items() if name != "remind_at"}

    with pool.connection() as conn, conn.cursor() as cursor:
        if not find_memory(cursor, memory_id):
            raise HTTPException(status_code=404, detail="No memory with that id.")

        if columns:
            assignments = sql.SQL(", ").join(
                sql.SQL("{} = %s").format(sql.Identifier(name)) for name in columns
            )
            cursor.execute(
                sql.SQL("UPDATE public.memories SET {} WHERE id = %s AND user_id = %s").format(assignments),
                (*columns.values(), memory_id, USER_ID),
            )

        warning = None
        if "remind_at" in fields:
            warning = sync_reminder(cursor, memory_id, fields["remind_at"])

        return memory_response(find_memory(cursor, memory_id), warning)


@app.delete("/memories/{memory_id}", status_code=204)
def delete_memory(memory_id: int):
    with pool.connection() as conn, conn.cursor() as cursor:
        cursor.execute("""
            DELETE FROM public.memories
            WHERE id = %s AND user_id = %s
            RETURNING id
        """, (memory_id, USER_ID))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="No memory with that id.")
    return Response(status_code=204)


@app.post("/reminders/take-due")
def take_due_reminders():
    with pool.connection() as conn, conn.cursor() as cursor:
        cursor.execute("""
            UPDATE public.reminders r
            SET completed = true
            FROM public.memories m
            WHERE m.id = r.memory_id
              AND r.user_id = %s
              AND NOT r.completed
              AND r.remind_at <= now()
              AND m.event_at < now() - %s
        """, (USER_ID, STALE_EVENT_AGE))

        cursor.execute("""
            UPDATE public.reminders r
            SET delivered_at = now()
            FROM public.memories m
            WHERE m.id = r.memory_id
              AND r.user_id = %s
              AND NOT r.completed
              AND r.remind_at <= now()
              AND (r.delivered_at IS NULL OR r.delivered_at < now() - %s)
            RETURNING r.id, r.memory_id, m.content, m.event_at, r.remind_at
        """, (USER_ID, ACK_TIMEOUT))
        rows = sorted(cursor.fetchall(), key=lambda row: row["remind_at"])

    return {"reminders": [DueReminder(**row).model_dump(mode="json") for row in rows]}


@app.post("/reminders/{reminder_id}/ack", status_code=204)
def ack_reminder(reminder_id: int):
    with pool.connection() as conn, conn.cursor() as cursor:
        cursor.execute("""
            UPDATE public.reminders
            SET completed = true
            WHERE id = %s AND user_id = %s
            RETURNING id
        """, (reminder_id, USER_ID))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="No reminder with that id.")
    return Response(status_code=204)
