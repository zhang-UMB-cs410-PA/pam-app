import os
import psycopg

from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer
from pgvector import Vector
from pgvector.psycopg import register_vector

load_dotenv(Path(__file__).with_name(".env"))

DATABASE_URL = os.environ["DATABASE_URL"]
USER_ID = os.environ["PAM_TEST_USER_ID"]

#Initialize API
app = FastAPI(title="PAM Memory API")

#Load embedding
model = SentenceTransformer("all-MiniLM-L6-v2")


#Definerequest data
class MemoryInput(BaseModel):
    content: str = Field(min_length=1)


class SearchInput(BaseModel):
    question: str = Field(min_length=1)


def create_embedding(text):
    numbers = model.encode(
        text,
        normalize_embeddings=True
    )
    return Vector(numbers)


def connect_db():
    conn = psycopg.connect(
        DATABASE_URL,
        sslmode="require"
    )
    register_vector(conn)
    return conn


#Testendpoint
@app.get("/")
def home():
    return {"message": "PAM Backend is running!"}


#Save Memory
@app.post("/memories")
def save_memory(memory: MemoryInput):

    embedding = create_embedding(memory.content)

    with connect_db() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO public.memories
                (user_id, content, embedding)
                VALUES (%s, %s, %s)
                RETURNING id
            """, (
                USER_ID,
                memory.content,
                embedding
            ))

            memory_id = cursor.fetchone()[0]

    return {
        "message": "Memory saved successfully!",
        "id": memory_id
    }


#Search Memories
@app.post("/memories/search")
def search_memories(request: SearchInput):

    embedding = create_embedding(request.question)

    with connect_db() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id, content
                FROM public.memories
                WHERE user_id = %s
                  AND embedding IS NOT NULL
                ORDER BY embedding <=> %s
                LIMIT 3
            """, (USER_ID, embedding))

            results = cursor.fetchall()

    return {
        "matches": [
            {
                "id": row[0],
                "content": row[1]
            }
            for row in results
        ]
    }
