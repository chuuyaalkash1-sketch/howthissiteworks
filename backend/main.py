from __future__ import annotations

import shutil
import sqlite3
import os
from pathlib import Path
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
from fastapi import (
    Depends,
    FastAPI, 
    File, 
    HTTPException, 
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from pwdlib import PasswordHash

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

JWT_SECRET = os.environ.get("JWT_SECRET")

JWT_SECRET = os.environ.get(
    "JWT_SECRET",
    "local-development-secret-change-this-key",
)

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

password_hash = PasswordHash.recommended()
bearer_scheme = HTTPBearer(auto_error=False)

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
                user_id INTEGER NOT NULL,
                original_name TEXT NOT NULL,
                stored_name TEXT NOT NULL,
                content_type TEXT,
                size INTEGER NOT NULL,
                uploaded_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
            """
        )

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
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

class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str
    

def normalize_username(username: str) -> str:
    normalized = username.strip().lower()

    if not normalized:
        raise HTTPException(
            status_code=400,
            detail="Имя пользователя не может быть пустым.",
        )

    return normalized


def get_user_by_username(username: str):
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.row_factory = sqlite3.Row

        return connection.execute(
            """
            SELECT id, username, password_hash, created_at
            FROM users
            WHERE username = ?
            """,
            (username,),
        ).fetchone()


def get_user_by_id(user_id: int):
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.row_factory = sqlite3.Row

        return connection.execute(
            """
            SELECT id, username, created_at
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        ).fetchone()


def create_access_token(user_id: int) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(
        hours=ACCESS_TOKEN_EXPIRE_HOURS
    )

    payload = {
        "sub": str(user_id),
        "exp": expiration,
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
):
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Необходимо войти в аккаунт.",
        )

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )

        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный или просроченный токен.",
        )

    user = get_user_by_id(user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден.",
        )

    return user

@app.get("/api/health")
def health_check() -> dict:
    return {
        "status": "ok",
        "message": "Python server is working",
    }
    
@app.post("/api/auth/register")
def register(payload: RegisterRequest):
    username = normalize_username(payload.username)

    if get_user_by_username(username) is not None:
        raise HTTPException(
            status_code=409,
            detail="Пользователь с таким именем уже существует.",
        )

    hashed_password = password_hash.hash(payload.password)
    created_at = datetime.now(timezone.utc).isoformat()

    try:
        with sqlite3.connect(DATABASE_PATH) as connection:
            cursor = connection.execute(
                """
                INSERT INTO users (
                    username,
                    password_hash,
                    created_at
                )
                VALUES (?, ?, ?)
                """,
                (
                    username,
                    hashed_password,
                    created_at,
                ),
            )

            user_id = cursor.lastrowid
            connection.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="Пользователь с таким именем уже существует.",
        )

    token = create_access_token(user_id)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "username": username,
        },
    }
    
@app.post("/api/auth/login")
def login(payload: LoginRequest):
    username = normalize_username(payload.username)
    user = get_user_by_username(username)

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Неверное имя пользователя или пароль.",
        )

    password_is_valid = password_hash.verify(
        payload.password,
        user["password_hash"],
    )

    if not password_is_valid:
        raise HTTPException(
            status_code=401,
            detail="Неверное имя пользователя или пароль.",
        )

    token = create_access_token(user["id"])

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
        },
    }
    
@app.get("/api/auth/me")
def read_current_user(current_user=Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "created_at": current_user["created_at"],
    }

# 7. получение рейтинга

@app.get("/api/ratings")
def read_ratings() -> dict:
    return get_rating_statistics()

# 8. добавление оценки

class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str
    
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


@app.post("/api/uploads")
async def upload_file(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    """
    Получает файл из браузера и сохраняет его в папку uploads
    
    """

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="У файла отсутствует имя",
        )

    original_name = sanitize_filename(file.filename)
    uploaded_at = datetime.now(timezone.utc).isoformat()

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
    
    unique_id = uuid4().hex

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
            user_id,
            original_name,
            stored_name,
            content_type,
            size,
            uploaded_at
        )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                current_user["id"],
                file.filename,
                stored_name,
                file.content_type,
                file_size,
                uploaded_at,
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

@app.get("/api/my-files")
def list_my_files(current_user=Depends(get_current_user)):
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.row_factory = sqlite3.Row

        rows = connection.execute(
            """
            SELECT
                id,
                original_name,
                content_type,
                size,
                uploaded_at
            FROM uploaded_files
            WHERE user_id = ?
            ORDER BY id DESC
            """,
            (current_user["id"],),
        ).fetchall()

    return {
        "files": [dict(row) for row in rows]
    }
    
@app.get("/api/my-files/{file_id}/download")
def download_my_file(
    file_id: int,
    current_user=Depends(get_current_user),
):
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.row_factory = sqlite3.Row

        file_record = connection.execute(
            """
            SELECT
                id,
                user_id,
                original_name,
                stored_name,
                content_type
            FROM uploaded_files
            WHERE id = ? AND user_id = ?
            """,
            (
                file_id,
                current_user["id"],
            ),
        ).fetchone()

    if file_record is None:
        raise HTTPException(
            status_code=404,
            detail="Файл не найден.",
        )

    file_path = UPLOAD_DIR / file_record["stored_name"]

    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Файл отсутствует на диске.",
        )

    return FileResponse(
        path=file_path,
        filename=file_record["original_name"],
        media_type=(
            file_record["content_type"]
            or "application/octet-stream"
        ),
    )
    
@app.delete("/api/my-files/{file_id}")
def delete_my_file(
    file_id: int,
    current_user=Depends(get_current_user),
):
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.row_factory = sqlite3.Row

        file_record = connection.execute(
            """
            SELECT id, stored_name
            FROM uploaded_files
            WHERE id = ? AND user_id = ?
            """,
            (
                file_id,
                current_user["id"],
            ),
        ).fetchone()

        if file_record is None:
            raise HTTPException(
                status_code=404,
                detail="Файл не найден.",
            )

        connection.execute(
            """
            DELETE FROM uploaded_files
            WHERE id = ? AND user_id = ?
            """,
            (
                file_id,
                current_user["id"],
            ),
        )

        connection.commit()

    file_path = UPLOAD_DIR / file_record["stored_name"]

    if file_path.is_file():
        file_path.unlink()

    return {
        "message": "Файл удалён."
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
                size,
                uploaded_at
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