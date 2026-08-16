import json
import sys
from collections import deque
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict

app = FastAPI(title="3S Observability Collector")

ELASTICSEARCH_URL = "https://threes-elasticsearch.onrender.com"
KIBANA_URL = "https://threes-kibana-6ul4.onrender.com"

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
    print(
        json.dumps(payload, ensure_ascii=False),
        file=sys.stdout,
        flush=True,
    )


def timestamp_value(item: dict[str, Any]) -> float:
    raw = item.get("@timestamp") or item.get("timestamp")

    if not raw:
        return 0.0

    try:
        return datetime.fromisoformat(
            str(raw).replace("Z", "+00:00")
        ).timestamp()
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


@app.get("/")
def root():
    return {
        "service": "3s-observability",
        "status": "online",
        "elasticsearch": ELASTICSEARCH_URL,
        "kibana": KIBANA_URL,
    }


@app.get("/health")
def health():
    return {
        "status": "online"
    }


@app.get("/stack-health")
async def stack_health():
    result = {
        "collector": "online",
        "elasticsearch": "offline",
        "kibana": KIBANA_URL,
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{ELASTICSEARCH_URL}/_cluster/health",
                timeout=15.0,
            )

            if response.is_success:
                result["elasticsearch"] = (
                    response.json().get("status") or "online"
                )
            else:
                result["elasticsearch"] = f"http-{response.status_code}"

    except Exception:
        result["elasticsearch"] = "offline"

    return result


@app.post("/events")
async def ingest(item: Event):
    payload = normalize(item.model_dump())

    EVENTS.appendleft(payload)
    stdout_event(payload)

    date_suffix = datetime.now(
        timezone.utc
    ).strftime("%Y.%m.%d")

    index_name = f"three-s-events-{date_suffix}"

    indexed = False

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{ELASTICSEARCH_URL}/{index_name}/_doc",
                json=payload,
                timeout=20.0,
            )

            indexed = response.is_success

    except Exception:
        indexed = False

    return {
        "accepted": True,
        "indexed": indexed,
        "timestamp": payload["@timestamp"],
        "pipeline": "observability -> elasticsearch -> kibana",
    }


async def elastic_events(limit: int) -> list[dict[str, Any]]:
    query = {
        "size": min(max(limit * 2, limit), 400),
        "sort": [
            {
                "@timestamp": {
                    "order": "desc",
                    "unmapped_type": "date",
                }
            }
        ],
        "query": {
            "match_all": {}
        },
    }

    url = (
        f"{ELASTICSEARCH_URL}"
        "/three-s-events-*/_search"
        "?ignore_unavailable=true"
        "&allow_no_indices=true"
    )

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=query,
                timeout=20.0,
            )

            if not response.is_success:
                return []

            hits = (
                response
                .json()
                .get("hits", {})
                .get("hits", [])
            )

            return [
                normalize_elastic_source(
                    hit.get("_source", {})
                )
                for hit in hits
            ]

    except Exception:
        return []


@app.get("/events")
async def events(limit: int = 50):
    safe_limit = min(max(limit, 1), 200)

    indexed = await elastic_events(safe_limit)

    merged = list(EVENTS) + indexed

    unique = {}

    for item in merged:
        normalized = normalize_elastic_source(item)
        key = event_key(normalized)

        if key not in unique:
            unique[key] = normalized

    ordered = sorted(
        unique.values(),
        key=timestamp_value,
        reverse=True,
    )

    return {
        "source": "collector-memory+elasticsearch",
        "events": ordered[:safe_limit],
        "memory_count": len(EVENTS),
        "indexed_count": len(indexed),
        "kibana": KIBANA_URL,
    }


@app.get("/services")
def services():
    names = {
        event.get("service")
        for event in EVENTS
    }

    return {
        name: "online"
        for name in names
        if name
    }


@app.get("/kibana")
def kibana():
    return {
        "url": KIBANA_URL
    }