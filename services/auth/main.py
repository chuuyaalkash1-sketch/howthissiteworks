import os
import sqlite3
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from pwdlib import PasswordHash

from common import event


app = FastAPI(title="3S Auth Service")

DB = os.getenv("AUTH_DB", "/tmp/auth.db")
SECRET = os.getenv("JWT_SECRET", "development-only-change-me")

password_hash = PasswordHash.recommended()

db_dir = os.path.dirname(DB)
if db_dir:
    os.makedirs(db_dir, exist_ok=True)

with sqlite3.connect(DB) as connection:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS users(
            id INTEGER PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
        """
    )


class Credentials(BaseModel):
    username: str
    password: str


def create_token(username: str) -> str:
    return jwt.encode(
        {
            "sub": username,
            "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        },
        SECRET,
        algorithm="HS256",
    )


def current_user(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        payload = jwt.decode(
            authorization[7:],
            SECRET,
            algorithms=["HS256"],
        )
        username = payload.get("sub")
        if not username:
            raise ValueError("Missing subject")
        return username
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@app.get("/health")
def health():
    return {"status": "online"}


@app.post("/register")
def register(body: Credentials):
    username = body.username.strip()

    if len(username) < 3:
        raise HTTPException(
            status_code=422,
            detail="Username must contain at least 3 characters",
        )

    if len(body.password) < 8:
        raise HTTPException(
            status_code=422,
            detail="Password must contain at least 8 characters",
        )

    try:
        with sqlite3.connect(DB) as connection:
            connection.execute(
                "INSERT INTO users(username, password_hash) VALUES(?, ?)",
                (
                    username,
                    password_hash.hash(body.password),
                ),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="Username already exists",
        )

    event(
        "auth",
        "user_registered",
        username=username,
    )

    return {
        "access_token": create_token(username),
        "token_type": "bearer",
        "user": {
            "username": username,
        },
    }


@app.post("/login")
def login(body: Credentials):
    username = body.username.strip()

    with sqlite3.connect(DB) as connection:
        row = connection.execute(
            "SELECT password_hash FROM users WHERE username=?",
            (username,),
        ).fetchone()

    if not row or not password_hash.verify(body.password, row[0]):
        event(
            "auth",
            "login_failed",
            level="WARNING",
            username=username,
        )
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
        )

    event(
        "auth",
        "login_succeeded",
        username=username,
    )

    return {
        "access_token": create_token(username),
        "token_type": "bearer",
        "user": {
            "username": username,
        },
    }


@app.get("/me")
def me(authorization: str | None = Header(default=None)):
    username = current_user(authorization)

    return {
        "username": username,
        "user": {
            "username": username,
        },
    }


@app.get("/verify")
def verify(authorization: str | None = Header(default=None)):
    username = current_user(authorization)

    return {
        "username": username,
        "valid": True,
    }