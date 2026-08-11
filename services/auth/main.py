import os, sqlite3
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from pwdlib import PasswordHash
import jwt
from common import event

app = FastAPI(title="3S Auth Service")
DB = os.getenv("AUTH_DB", "/data/auth.db")
SECRET = os.getenv("JWT_SECRET", "development-only-change-me")
password_hash = PasswordHash.recommended()
os.makedirs(os.path.dirname(DB), exist_ok=True)
with sqlite3.connect(DB) as c: c.execute("CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT)")

class Credentials(BaseModel): username: str; password: str

def token(username): return jwt.encode({"sub": username, "exp": datetime.now(timezone.utc)+timedelta(hours=12)}, SECRET, algorithm="HS256")
def current(auth: str|None):
    if not auth or not auth.startswith("Bearer "): raise HTTPException(401, "Authentication required")
    try: return jwt.decode(auth[7:], SECRET, algorithms=["HS256"])["sub"]
    except Exception: raise HTTPException(401, "Invalid token")

@app.get("/health")
def health(): return {"status":"online"}
@app.post("/register")
def register(body: Credentials):
    try:
        with sqlite3.connect(DB) as c: c.execute("INSERT INTO users(username,password_hash) VALUES(?,?)", (body.username,password_hash.hash(body.password)))
    except sqlite3.IntegrityError: raise HTTPException(409,"Username already exists")
    event("auth","user_registered",username=body.username)
    return {"access_token":token(body.username),"user":{"username":body.username}}
@app.post("/login")
def login(body: Credentials):
    with sqlite3.connect(DB) as c: row=c.execute("SELECT password_hash FROM users WHERE username=?",(body.username,)).fetchone()
    if not row or not password_hash.verify(body.password,row[0]):
        event("auth","login_failed",level="WARNING",username=body.username); raise HTTPException(401,"Invalid credentials")
    event("auth","login_succeeded",username=body.username)
    return {"access_token":token(body.username),"user":{"username":body.username}}
@app.get("/me")
def me(authorization: str|None=Header(default=None)): return {"username":current(authorization)}
@app.get("/verify")
def verify(authorization: str|None=Header(default=None)): return {"username":current(authorization),"valid":True}
