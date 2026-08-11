import json
import os
import sys
from collections import deque
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict

app = FastAPI(title="3S Observability Collector")

ELASTICSEARCH_URL = os.getenv("ELASTICSEARCH_URL", "http://elasticsearch:9200").rstrip("/")
LOGSTASH_URL = os.getenv("LOGSTASH_URL", "http://logstash:9600").rstrip("/")
EVENTS = deque(maxlen=2500)


class Event(BaseModel):
    model_config = ConfigDict(extra="allow")
    service: str
    event: str
    level: str = "INFO"


def normalize(payload: dict[str, Any]) -> dict[str, Any]:
    item = dict(payload)
    item.setdefault("@timestamp", datetime.now(timezone.utc).isoformat())
    item.setdefault("service", "unknown")
    item.setdefault("event", "event")
    item.setdefault("level", "INFO")
    return item


def normalize_elastic_source(payload: dict[str, Any]) -> dict[str, Any]:
    """Convert ECS/Filebeat-shaped fields back to simple values for the UI."""
    item = dict(payload or {})

    event_value = item.get("event")
    if isinstance(event_value, dict):
        item["event"] = (
            event_value.get("original")
            or event_value.get("action")
            or event_value.get("kind")
            or "event"
        )

    service_value = item.get("service")
    if isinstance(service_value, dict):
        item["service"] = (
            service_value.get("name")
            or service_value.get("type")
            or "unknown"
        )

    log_value = item.get("log")
    if isinstance(log_value, dict) and not item.get("message"):
        item["message"] = log_value.get("original")

    item.setdefault("service", "unknown")
    item.setdefault("event", item.get("message") or "event")
    item.setdefault("level", "INFO")
    return item


def stdout_event(payload: dict[str, Any]) -> None:
    # Filebeat reads this JSON line from the container stdout.
    print(json.dumps(payload, ensure_ascii=False), file=sys.stdout, flush=True)


def timestamp_value(item: dict[str, Any]) -> float:
    raw = item.get("@timestamp") or item.get("timestamp")
    if not raw:
        return 0.0
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0.0


def event_key(item: dict[str, Any]) -> tuple:
    return (
        str(item.get("@timestamp") or item.get("timestamp") or ""),
        str(item.get("service") or ""),
        str(item.get("event") or item.get("message") or ""),
        str(item.get("path") or ""),
        str(item.get("status") or ""),
    )


@app.get("/health")
def health():
    return {"status": "online"}


@app.get("/stack-health")
async def stack_health():
    result = {"collector": "online", "elasticsearch": "offline", "logstash": "offline"}
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{ELASTICSEARCH_URL}/_cluster/health", timeout=1.2)
            if response.is_success:
                result["elasticsearch"] = response.json().get("status", "online")
        except Exception:
            pass

        try:
            response = await client.get(f"{LOGSTASH_URL}/_node/pipelines", timeout=1.2)
            if response.is_success:
                result["logstash"] = "online"
        except Exception:
            pass
    return result


@app.post("/events")
def ingest(item: Event):
    payload = normalize(item.model_dump())
    EVENTS.appendleft(payload)
    stdout_event(payload)
    return {
        "accepted": True,
        "timestamp": payload["@timestamp"],
        "pipeline": "stdout -> filebeat -> logstash -> elasticsearch",
    }


async def elastic_events(limit: int) -> list[dict[str, Any]]:
    query = {
        "size": min(max(limit * 2, limit), 400),
        "sort": [{"@timestamp": {"order": "desc", "unmapped_type": "date"}}],
        "query": {"match_all": {}},
    }
    url = f"{ELASTICSEARCH_URL}/three-s-events-*/_search?ignore_unavailable=true&allow_no_indices=true"
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=query, timeout=1.8)
        if not response.is_success:
            return []
        hits = response.json().get("hits", {}).get("hits", [])
        return [normalize_elastic_source(hit.get("_source", {})) for hit in hits]


@app.get("/events")
async def events(limit: int = 50):
    safe_limit = min(max(limit, 1), 200)

    try:
        indexed = await elastic_events(safe_limit)
    except Exception:
        indexed = []

    # Important: do NOT choose between Elasticsearch and memory.
    # Fresh browser/backend events appear in memory immediately, while Filebeat/Logstash
    # can take a moment to index them. Merge both sources so yesterday's indexed records
    # never hide today's fresh events.
    merged = list(EVENTS) + indexed

    unique = {}
    for item in merged:
        normalized = normalize_elastic_source(item)
        key = event_key(normalized)
        if key not in unique:
            unique[key] = normalized

    ordered = sorted(unique.values(), key=timestamp_value, reverse=True)

    return {
        "source": "collector-memory+elasticsearch",
        "events": ordered[:safe_limit],
        "memory_count": len(EVENTS),
        "indexed_count": len(indexed),
    }


@app.get("/services")
def services():
    names = {event.get("service") for event in EVENTS}
    return {name: "online" for name in names if name}
