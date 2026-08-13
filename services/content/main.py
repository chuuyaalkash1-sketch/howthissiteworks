import os
import sqlite3
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from common import event

app = FastAPI(title="3S Content Service")
DATA_DIR = Path(os.getenv("CONTENT_DATA_DIR", "/data"))
DB = DATA_DIR / "content.db"
DATA_DIR.mkdir(parents=True, exist_ok=True)

with sqlite3.connect(DB) as connection:
    connection.execute(
        "CREATE TABLE IF NOT EXISTS ratings(id INTEGER PRIMARY KEY AUTOINCREMENT, value INTEGER NOT NULL)"
    )


class Rating(BaseModel):
    value: int


def statistics():
    with sqlite3.connect(DB) as connection:
        count, average = connection.execute(
            "SELECT COUNT(*), AVG(value) FROM ratings"
        ).fetchone()
    return {
        "count": count,
        "average": round(average, 2) if average is not None else None,
        "minimum": 1,
        "maximum": 777,
    }


@app.get("/health")
def health():
    return {"status": "online"}


@app.get("/ratings")
def ratings():
    return statistics()


@app.post("/ratings")
def rate(body: Rating):
    if not 1 <= body.value <= 777:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 777")
    with sqlite3.connect(DB) as connection:
        connection.execute("INSERT INTO ratings(value) VALUES(?)", (body.value,))
    event("content", "rating_submitted", value=body.value)
    return {"statistics": statistics()}
