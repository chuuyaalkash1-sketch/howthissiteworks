import os
import httpx
from fastapi import FastAPI, Request, Response
from common import event

app = FastAPI(title="3S API Gateway")

ROUTES = {
    "auth": os.getenv("AUTH_URL", "http://auth:8001"),
    "commerce": os.getenv("COMMERCE_URL", "http://commerce:8002"),
    "content": os.getenv("CONTENT_URL", "http://content:8003"),
    "observability": os.getenv("OBSERVABILITY_URL", "http://observability:8004"),
    "files": os.getenv("FILES_URL", "http://files:8005"),
}

@app.get("/health")
def health():
    return {"status": "online"}

async def forward(service: str, path: str, request: Request):
    base = ROUTES.get(service)
    if not base:
        return Response("unknown service", status_code=404)

    url = f"{base}/{path.lstrip('/')}"
    body = await request.body()
    headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in {"host", "content-length", "connection"}
    }

    try:
        async with httpx.AsyncClient() as client:
            upstream = await client.request(
                request.method,
                url,
                content=body,
                headers=headers,
                params=request.query_params,
                timeout=20,
            )
    except httpx.RequestError as exc:
        event("gateway", "upstream_unavailable", level="ERROR", target_service=service, error=str(exc))
        return Response(
            content='{"detail":"Backend service is unavailable"}',
            status_code=503,
            media_type="application/json",
        )

    event(
        "gateway",
        "request_forwarded",
        target_service=service,
        path=path,
        status=upstream.status_code,
    )

    response_headers = {}
    content_type = upstream.headers.get("content-type")
    content_disposition = upstream.headers.get("content-disposition")
    if content_type:
        response_headers["content-type"] = content_type
    if content_disposition:
        response_headers["content-disposition"] = content_disposition

    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
    )

# Explicit compatibility routes MUST be declared before the generic route.
# Otherwise /api/ratings would be interpreted as service="ratings".
@app.api_route("/api/auth/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def auth_api(path: str, request: Request):
    return await forward("auth", path, request)

@app.api_route("/api/ratings", methods=["GET", "POST"])
async def ratings_api(request: Request):
    return await forward("content", "ratings", request)

@app.api_route("/api/uploads", methods=["POST"])
async def uploads_api(request: Request):
    return await forward("files", "uploads", request)

@app.api_route("/api/my-files", methods=["GET"])
async def my_files_api(request: Request):
    return await forward("files", "my-files", request)

@app.api_route("/api/my-files/{file_id}", methods=["DELETE"])
async def delete_file_api(file_id: int, request: Request):
    return await forward("files", f"my-files/{file_id}", request)

@app.api_route("/api/my-files/{file_id}/download", methods=["GET"])
async def download_file_api(file_id: int, request: Request):
    return await forward("files", f"my-files/{file_id}/download", request)

@app.get("/api/observability/health")
async def platform_health():
    result = {"gateway": "online"}
    async with httpx.AsyncClient() as client:
        for name, url in ROUTES.items():
            try:
                response = await client.get(f"{url}/health", timeout=1.2)
                result[name] = "online" if response.status_code == 200 else "degraded"
            except Exception:
                result[name] = "offline"
    return result

@app.api_route("/api/{service}/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def generic_proxy(service: str, path: str, request: Request):
    return await forward(service, path, request)
