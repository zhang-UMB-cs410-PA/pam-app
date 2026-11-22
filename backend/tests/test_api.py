import os
import uuid

from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg
import pytest

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
if not TEST_DATABASE_URL:
    pytest.skip("Set TEST_DATABASE_URL to a throwaway Postgres to run these tests.", allow_module_level=True)

USER = str(uuid.uuid4())
OTHER_USER = str(uuid.uuid4())
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["PAM_TEST_USER_ID"] = USER

from fastapi.testclient import TestClient

import main

SCHEMA = Path(__file__).parent.parent / "stuff"


def iso(delta):
    return (datetime.now(timezone.utc) + delta).isoformat()


def sql(query, params=()):
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        cursor = conn.execute(query, params)
        return cursor.fetchall() if cursor.description else None


@pytest.fixture(scope="session", autouse=True)
def schema():
    sql("DROP TABLE IF EXISTS public.reminders, public.memories CASCADE")
    sql((SCHEMA / "Create_Memory_Tables.sql").read_text())
    sql((SCHEMA / "002_reminder_delivery_and_memory_types.sql").read_text())


@pytest.fixture
def client():
    sql("TRUNCATE public.reminders, public.memories")
    with TestClient(main.app) as client:
        yield client


def save(client, **fields):
    body = {"memory_type": "event", "content": "Lunch with Amy.", **fields}
    response = client.post("/memories", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def reminders(memory_id):
    return sql(
        "SELECT id, remind_at, completed, delivered_at FROM public.reminders WHERE memory_id = %s ORDER BY id",
        (memory_id,),
    )


# ---------- Memories ----------

def test_create_stores_utc_and_reminder(client):
    memory = save(
        client,
        person_name="Amy (daughter)",
        event_at="2030-11-29T12:00:00-05:00",
        remind_at="2030-11-29T11:00:00-05:00",
    )
    assert memory["event_at"] == "2030-11-29T17:00:00Z"
    assert memory["remind_at"] == "2030-11-29T16:00:00Z"
    assert memory["person_name"] == "Amy (daughter)"
    assert "warning" not in memory
    assert len(reminders(memory["id"])) == 1


def test_time_without_offset_is_rejected(client):
    response = client.post("/memories", json={"memory_type": "event", "content": "x", "event_at": "2030-11-29T12:00:00"})
    assert response.status_code == 422
    assert response.json()["error"].startswith("event_at:")


@pytest.mark.parametrize("body", [
    {"memory_type": "general", "content": "x"},
    {"memory_type": "event", "content": ""},
])
def test_invalid_memory_is_rejected(client, body):
    response = client.post("/memories", json=body)
    assert response.status_code == 422
    assert "error" in response.json()


def test_past_reminder_saves_memory_with_warning(client):
    memory = save(client, remind_at=iso(timedelta(minutes=-5)))
    assert memory["remind_at"] is None
    assert "past" in memory["warning"]
    assert reminders(memory["id"]) == []


def test_list_only_shows_own_memories(client):
    save(client, content="Mine")
    sql("INSERT INTO public.memories (user_id, memory_type, content) VALUES (%s, 'fact', 'Theirs')", (OTHER_USER,))
    assert [m["content"] for m in client.get("/memories").json()] == ["Mine"]


def test_other_users_memory_is_not_found(client):
    [(other_id,)] = sql(
        "INSERT INTO public.memories (user_id, memory_type, content) VALUES (%s, 'fact', 'Theirs') RETURNING id",
        (OTHER_USER,),
    )
    assert client.patch(f"/memories/{other_id}", json={"content": "Mine now"}).status_code == 404
    assert client.delete(f"/memories/{other_id}").status_code == 404


# ---------- Updates and reminders ----------

def test_patch_changes_only_sent_fields(client):
    memory = save(client, location="Cafe", remind_at=iso(timedelta(days=1)))
    updated = client.patch(f"/memories/{memory['id']}", json={"content": "Lunch with Amy at 1pm."}).json()
    assert updated["content"] == "Lunch with Amy at 1pm."
    assert updated["location"] == "Cafe"
    assert updated["remind_at"] == memory["remind_at"]


def test_patch_null_clears_field_and_reminder(client):
    memory = save(client, location="Cafe", remind_at=iso(timedelta(days=1)))
    updated = client.patch(f"/memories/{memory['id']}", json={"location": None, "remind_at": None}).json()
    assert updated["location"] is None
    assert updated["remind_at"] is None
    assert reminders(memory["id"]) == []


def test_patch_rejects_empty_body_and_null_required_fields(client):
    memory = save(client)
    assert client.patch(f"/memories/{memory['id']}", json={}).status_code == 400
    assert client.patch(f"/memories/{memory['id']}", json={"content": None}).status_code == 422
    assert client.patch(f"/memories/{memory['id']}", json={"memory_type": None}).status_code == 422


def test_moving_reminder_replaces_it(client):
    memory = save(client, remind_at=iso(timedelta(days=1)))
    new_time = (datetime.now(timezone.utc) + timedelta(days=2)).replace(microsecond=0)
    updated = client.patch(f"/memories/{memory['id']}", json={"remind_at": new_time.isoformat()}).json()
    assert updated["remind_at"] == new_time.isoformat().replace("+00:00", "Z")
    rows = reminders(memory["id"])
    assert len(rows) == 1 and rows[0][1] == new_time


def test_resending_same_reminder_time_keeps_unacked_reminder(client):
    memory = save(client, remind_at=iso(timedelta(days=1)))
    sql("UPDATE public.reminders SET remind_at = now() - interval '1 minute', delivered_at = now() WHERE memory_id = %s",
        (memory["id"],))
    [(_, remind_at, *_)] = reminders(memory["id"])

    client.patch(f"/memories/{memory['id']}", json={"content": "Lunch moved inside.", "remind_at": remind_at.isoformat()})
    [(_, _, completed, _)] = reminders(memory["id"])
    assert completed is False


def test_delivered_reminder_is_not_rearmed(client):
    memory = save(client, remind_at=iso(timedelta(days=1)))
    sql("UPDATE public.reminders SET remind_at = now() - interval '1 minute', delivered_at = now() WHERE memory_id = %s",
        (memory["id"],))

    client.patch(f"/memories/{memory['id']}", json={"remind_at": iso(timedelta(days=3))})
    rows = reminders(memory["id"])
    assert [r[2] for r in rows] == [True, False]
    assert rows[1][3] is None


def test_delete_removes_reminders(client):
    memory = save(client, remind_at=iso(timedelta(days=1)))
    assert client.delete(f"/memories/{memory['id']}").status_code == 204
    assert reminders(memory["id"]) == []
    assert client.delete(f"/memories/{memory['id']}").status_code == 404


# ---------- Due reminders ----------

def make_due(memory_id, remind_ago, event_ago=None):
    sql("UPDATE public.reminders SET remind_at = now() - %s WHERE memory_id = %s", (remind_ago, memory_id))
    if event_ago is not None:
        sql("UPDATE public.memories SET event_at = now() - %s WHERE id = %s", (event_ago, memory_id))


def take(client):
    return client.post("/reminders/take-due").json()["reminders"]


def test_due_reminder_is_handed_out_once(client):
    memory = save(client, content="Take pills.", remind_at=iso(timedelta(days=1)))
    make_due(memory["id"], timedelta(minutes=1))

    [due] = take(client)
    assert due["content"] == "Take pills." and due["memory_id"] == memory["id"]
    assert take(client) == []


def test_future_reminder_is_not_due(client):
    save(client, remind_at=iso(timedelta(hours=1)))
    assert take(client) == []


def test_reminder_at_event_time_is_still_due(client):
    memory = save(client, remind_at=iso(timedelta(days=1)))
    make_due(memory["id"], timedelta(seconds=30), event_ago=timedelta(seconds=30))
    assert len(take(client)) == 1


def test_reminder_for_long_past_event_is_dropped(client):
    memory = save(client, remind_at=iso(timedelta(days=1)))
    make_due(memory["id"], timedelta(hours=3), event_ago=timedelta(hours=2))
    assert take(client) == []
    assert reminders(memory["id"])[0][2] is True


def test_unacked_reminder_is_handed_out_again(client):
    memory = save(client, remind_at=iso(timedelta(days=1)))
    make_due(memory["id"], timedelta(minutes=10))
    [due] = take(client)

    sql("UPDATE public.reminders SET delivered_at = now() - interval '6 minutes' WHERE id = %s", (due["id"],))
    assert [r["id"] for r in take(client)] == [due["id"]]


def test_acked_reminder_is_not_handed_out_again(client):
    memory = save(client, remind_at=iso(timedelta(days=1)))
    make_due(memory["id"], timedelta(minutes=10))
    [due] = take(client)

    assert client.post(f"/reminders/{due['id']}/ack").status_code == 204
    sql("UPDATE public.reminders SET delivered_at = now() - interval '6 minutes' WHERE id = %s", (due["id"],))
    assert take(client) == []
    assert client.post("/reminders/999999/ack").status_code == 404


def test_overlapping_take_due_calls_share_nothing(client):
    from concurrent.futures import ThreadPoolExecutor

    with ThreadPoolExecutor(max_workers=8) as executor:
        for _ in range(20):
            sql("TRUNCATE public.reminders, public.memories")
            for i in range(5):
                memory = save(client, content=f"Reminder {i}", remind_at=iso(timedelta(days=1)))
                make_due(memory["id"], timedelta(minutes=1))

            batches = list(executor.map(lambda _: take(client), range(8)))
            ids = [r["id"] for batch in batches for r in batch]
            assert len(ids) == 5 and len(set(ids)) == 5
