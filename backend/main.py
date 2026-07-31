from __future__ import annotations

import shutil
import sqlite3
import uuid
import os
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# начинаю с путей к папкам проекта

# file путь к текущему файлу backend/main.py
# parent папка backend
# parent.parent корень проекта

BASE_DIR = Path(__file__).resolve().parent.parent

STORAGE_DIR = Path(
    os.environ.get("STORAGE_DIR", str(BASE_DIR))
).resolve()

DATA_DIR = STORAGE_DIR / "data"
UPLOAD_DIR = STORAGE_DIR / "uploads"

FRONTEND_DIST_DIR = BASE_DIR / "frontend" / "dist"

DATABASE_PATH = DATA_DIR / "site.db"

MAX_FILE_SIZE = 10 * 1024 * 1024

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# fastAPI приложение. оно нужно для связи между react базой данных и файлами на сервере

app = FastAPI(
    title="How This Site Works API",
    description="учебный API сайта",
    version="1.0.0",
)

# модель оценки

class RatingRequest(BaseModel):
    # ge означает greater than or equal — не меньше 1.
    # le означает less than or equal — не больше 777.
    value: int = Field(ge=1, le=777)

# SQLite

def get_database_connection() -> sqlite3.Connection:
    """
    открывает соединение с SQLite

    row_factory позволяет обращаться к полям результата
    по именам колонок, а не только по индексам
    
    """
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database() -> None:
    """
    создаёт таблицы при первом запуске приложения
    
    """

    connection = get_database_connection()

    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS ratings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                value INTEGER NOT NULL CHECK(value BETWEEN 1 AND 777),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS uploaded_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_name TEXT NOT NULL,
                stored_name TEXT NOT NULL UNIQUE,
                content_type TEXT,
                size_bytes INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        connection.commit()

    finally:
        connection.close()

initialize_database()

# чето вспомогательное ээ короче для удобства 

def get_rating_statistics() -> dict:
    """
    Возвращает:
    - среднюю оценку;
    - количество оценок.
    
    """

    connection = get_database_connection()

    try:
        row = connection.execute(
            """
            SELECT
                COUNT(*) AS count,
                AVG(value) AS average
            FROM ratings
            """
        ).fetchone()

        count = row["count"]
        average = row["average"]

        return {
            "count": count,
            "average": round(average, 2) if average is not None else None,
            "minimum": 1,
            "maximum": 777,
        }

    finally:
        connection.close()


def sanitize_filename(filename: str) -> str:
    """
    Убирает путь из имени файла.

    """

    safe_name = Path(filename).name
    if not safe_name:
        safe_name = "unnamed-file"

    return safe_name


# api проверка состояния сервера

@app.get("/api/health")
def health_check() -> dict:
    return {
        "status": "ok",
        "message": "Python server is working",
    }

# 7. получение рейтинга

@app.get("/api/ratings")
def read_ratings() -> dict:
    return get_rating_statistics()

# 8. добавление оценки

@app.post("/api/ratings", status_code=201)
def create_rating(rating: RatingRequest) -> dict:
    connection = get_database_connection()

    try:
        connection.execute(
            """
            INSERT INTO ratings (value)
            VALUES (?)
            """,
            (rating.value,),
        )

        connection.commit()

    finally:
        connection.close()

    return {
        "message": "Оценка сохранена",
        "submitted_value": rating.value,
        "statistics": get_rating_statistics(),
    }

# 9. загрузка файла


@app.post("/api/uploads", status_code=201)
async def upload_file(file: UploadFile = File(...)) -> dict:
    """
    Получает файл из браузера и сохраняет его в папку uploads
    
    """

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="У файла отсутствует имя",
        )

    original_name = sanitize_filename(file.filename)

    # Читаем содержимое.
    file_content = await file.read()

    file_size = len(file_content)

    if file_size == 0:
        raise HTTPException(
            status_code=400,
            detail="Нельзя загрузить пустой файл",
        )

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Файл слишком большой. Максимальный размер — 10 МБ",
        )

    # UUID не позволяет двум одинаково названным файлам перезаписать друг друга
    
    unique_id = uuid.uuid4().hex

    suffix = Path(original_name).suffix.lower()

    stored_name = f"{unique_id}{suffix}"
    stored_path = UPLOAD_DIR / stored_name


    with stored_path.open("wb") as destination:
        destination.write(file_content)

    connection = get_database_connection()

    try:
        connection.execute(
            """
            INSERT INTO uploaded_files (
                original_name,
                stored_name,
                content_type,
                size_bytes
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                original_name,
                stored_name,
                file.content_type,
                file_size,
            ),
        )

        connection.commit()

    finally:
        connection.close()

    return {
        "message": "Файл успешно загружен",
        "file": {
            "original_name": original_name,
            "stored_name": stored_name,
            "content_type": file.content_type,
            "size_bytes": file_size,
        },
    }


# список загруженных файлов

@app.get("/api/uploads")
def read_uploaded_files() -> dict:
    connection = get_database_connection()

    try:
        rows = connection.execute(
            """
            SELECT
                id,
                original_name,
                stored_name,
                content_type,
                size_bytes,
                created_at
            FROM uploaded_files
            ORDER BY id DESC
            LIMIT 50
            """
        ).fetchall()
        files = [dict(row) for row in rows]

        return {
            "files": files,
            "count": len(files),
        }

    finally:
        connection.close()


# после выполнения npm run build появится frontend/dist/assets. там будут java, CSS и др ресурсы
ASSETS_DIR = FRONTEND_DIST_DIR / "assets"

if ASSETS_DIR.exists():
    app.mount(
        "/assets",
        StaticFiles(directory=ASSETS_DIR),
        name="assets",
    )


@app.get("/{full_path:path}")
def serve_react_application(full_path: str):
    """
    этот обработчик должен идти после /api маршрутов

    eсли браузер запрашивает существующий файл из dist,
    возвращаем этот файл

    в инос случае возвращаем index.html
    """

    requested_file = FRONTEND_DIST_DIR / full_path

    if full_path and requested_file.is_file():
        return FileResponse(requested_file)

    index_file = FRONTEND_DIST_DIR / "index.html"

    if index_file.exists():
        return FileResponse(index_file)

    return {
        "message": "React frontend ещё не собран",
        "instruction": "Перейдите в frontend и выполните npm run build",
    }