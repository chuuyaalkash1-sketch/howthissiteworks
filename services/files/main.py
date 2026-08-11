import os
import sqlite3
import uuid
from pathlib import Path

import httpx
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from common import event

app = FastAPI(title="3S Files Service")
AUTH_URL = os.getenv("AUTH_URL", "http://auth:8001")
DATA_DIR = Path(os.getenv("FILES_DATA_DIR", "/data"))
UPLOAD_DIR = DATA_DIR / "uploads"
DB = DATA_DIR / "files.db"
MAX_SIZE = 10 * 1024 * 1024

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
with sqlite3.connect(DB) as connection:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS files(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            original_name TEXT NOT NULL,
            stored_name TEXT NOT NULL UNIQUE,
            size INTEGER NOT NULL
        )
        """
    )


def verify_user(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        response = httpx.get(
            f"{AUTH_URL}/verify",
            headers={"Authorization": authorization},
            timeout=3,
        )
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Auth service is unavailable")
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Authentication required")
    return response.json()["username"]


@app.get("/health")
def health():
    return {"status": "online"}


@app.post("/uploads")
async def upload_file(file: UploadFile = File(...), authorization: str | None = Header(default=None)):
    username = verify_user(authorization)
    payload = await file.read(MAX_SIZE + 1)
    if len(payload) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File is larger than 10 MB")

    original_name = Path(file.filename or "file").name
    suffix = Path(original_name).suffix[:20]
    stored_name = f"{uuid.uuid4().hex}{suffix}"
    destination = UPLOAD_DIR / stored_name
    destination.write_bytes(payload)

    with sqlite3.connect(DB) as connection:
        cursor = connection.execute(
            "INSERT INTO files(username, original_name, stored_name, size) VALUES(?,?,?,?)",
            (username, original_name, stored_name, len(payload)),
        )
        file_id = cursor.lastrowid

    event("files", "file_uploaded", username=username, file_id=file_id, size=len(payload))
    return {
        "file": {
            "id": file_id,
            "original_name": original_name,
            "size": len(payload),
        }
    }


@app.get("/my-files")
def list_files(authorization: str | None = Header(default=None)):
    username = verify_user(authorization)
    with sqlite3.connect(DB) as connection:
        rows = connection.execute(
            "SELECT id, original_name, size FROM files WHERE username=? ORDER BY id DESC",
            (username,),
        ).fetchall()
    return {
        "files": [
            {"id": row[0], "original_name": row[1], "size": row[2]}
            for row in rows
        ]
    }


def owned_file(file_id: int, username: str):
    with sqlite3.connect(DB) as connection:
        row = connection.execute(
            "SELECT id, original_name, stored_name, size FROM files WHERE id=? AND username=?",
            (file_id, username),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="File not found")
    return row


@app.get("/my-files/{file_id}/download")
def download_file(file_id: int, authorization: str | None = Header(default=None)):
    username = verify_user(authorization)
    row = owned_file(file_id, username)
    path = UPLOAD_DIR / row[2]
    if not path.exists():
        raise HTTPException(status_code=404, detail="Stored file is missing")
    event("files", "file_downloaded", username=username, file_id=file_id)
    return FileResponse(path, filename=row[1], media_type="application/octet-stream")


@app.delete("/my-files/{file_id}")
def delete_file(file_id: int, authorization: str | None = Header(default=None)):
    username = verify_user(authorization)
    row = owned_file(file_id, username)
    path = UPLOAD_DIR / row[2]
    if path.exists():
        path.unlink()
    with sqlite3.connect(DB) as connection:
        connection.execute("DELETE FROM files WHERE id=? AND username=?", (file_id, username))
    event("files", "file_deleted", username=username, file_id=file_id)
    return {"deleted": True}
