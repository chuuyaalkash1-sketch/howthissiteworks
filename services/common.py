import json, os, sys
from datetime import datetime, timezone
import httpx

OBSERVABILITY_URL = os.getenv("OBSERVABILITY_URL", "http://observability:8004")

def event(service: str, name: str, level: str = "INFO", **fields):
    payload = {"@timestamp": datetime.now(timezone.utc).isoformat(), "service": service, "event": name, "level": level, **fields}
    print(json.dumps(payload, ensure_ascii=False), file=sys.stdout, flush=True)
    try:
        httpx.post(f"{OBSERVABILITY_URL}/events", json=payload, timeout=0.35)
    except Exception:
        pass
