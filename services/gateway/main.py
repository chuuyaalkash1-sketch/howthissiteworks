import os

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from common import event


app = FastAPI(title="3S API Gateway")


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://threes-frontend.onrender.com",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


ROUTES = {
    "auth": os.getenv(
        "AUTH_URL",
        "https://threes-auth.onrender.com",
    ).rstrip("/"),
    "commerce": os.getenv(
        "COMMERCE_URL",
        "https://threes-commerce.onrender.com",
    ).rstrip("/"),
    "content": os.getenv(
        "CONTENT_URL",
        "https://threes-content.onrender.com",
    ).rstrip("/"),
    "observability": os.getenv(
        "OBSERVABILITY_URL",
        "https://threes-observability.onrender.com",
    ).rstrip("/"),
    "files": os.getenv(
        "FILES_URL",
        "https://threes-files.onrender.com",
    ).rstrip("/"),
}


@app.get("/")
def root():
    return {
        "service": "3s-gateway",
        "status": "online",
        "routes": ROUTES,
    }


@app.get("/health")
def health():
    return {
        "status": "online",
        "service": "gateway",
    }


async def forward(service: str, path: str, request: Request):
    base = ROUTES.get(service)

    if not base:
        return Response(
            content='{"detail":"Unknown service"}',
            status_code=404,
            media_type="application/json",
        )

    clean_path = path.lstrip("/")
    url = f"{base}/{clean_path}"

    body = await request.body()

    headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower()
        not in {
            "host",
            "content-length",
            "connection",
            "transfer-encoding",
        }
    }

    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            upstream = await client.request(
                method=request.method,
                url=url,
                content=body,
                headers=headers,
                params=request.query_params,
                timeout=30.0,
            )

    except httpx.RequestError as exc:
        event(
            "gateway",
            "upstream_unavailable",
            level="ERROR",
            target_service=service,
            path=clean_path,
            error=str(exc),
        )

        return Response(
            content='{"detail":"Backend service is unavailable"}',
            status_code=503,
            media_type="application/json",
        )

    event(
        "gateway",
        "request_forwarded",
        target_service=service,
        path=clean_path,
        method=request.method,
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


@app.api_route(
    "/api/auth/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def auth_api(path: str, request: Request):
    return await forward("auth", path, request)


@app.api_route(
    "/api/ratings",
    methods=["GET", "POST", "OPTIONS"],
)
async def ratings_api(request: Request):
    return await forward("content", "ratings", request)


@app.api_route(
    "/api/uploads",
    methods=["POST", "OPTIONS"],
)
async def uploads_api(request: Request):
    return await forward("files", "uploads", request)


@app.api_route(
    "/api/my-files",
    methods=["GET", "OPTIONS"],
)
async def my_files_api(request: Request):
    return await forward("files", "my-files", request)


@app.api_route(
    "/api/my-files/{file_id}",
    methods=["DELETE", "OPTIONS"],
)
async def delete_file_api(file_id: int, request: Request):
    return await forward(
        "files",
        f"my-files/{file_id}",
        request,
    )


@app.api_route(
    "/api/my-files/{file_id}/download",
    methods=["GET", "OPTIONS"],
)
async def download_file_api(file_id: int, request: Request):
    return await forward(
        "files",
        f"my-files/{file_id}/download",
        request,
    )


@app.api_route(
    "/api/observability/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def observability_api(path: str, request: Request):
    return await forward(
        "observability",
        path,
        request,
    )


@app.api_route(
    "/api/commerce/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def commerce_api(path: str, request: Request):
    return await forward(
        "commerce",
        path,
        request,
    )


@app.api_route(
    "/api/{service}/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def generic_proxy(service: str, path: str, request: Request):
    return await forward(
        service,
        path,
        request,
    )