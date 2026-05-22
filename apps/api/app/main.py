import time
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    DomainError,
    ForbiddenError,
    NotFoundError,
)
from app.routes import dashboard, health, notifications, requests, telegram, users

settings = get_settings()

app = FastAPI(title=settings.app_name)

logger = logging.getLogger("app.request_timing")


@app.middleware("http")
async def log_request_timing(request: Request, call_next):
    started_at = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - started_at) * 1000
    if get_settings().log_request_timing:
        logger.info(
            "%s %s %s %.1fms",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
    return response

origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(NotFoundError)
async def not_found_handler(_request: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(ConflictError)
async def conflict_handler(_request: Request, exc: ConflictError):
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(ForbiddenError)
async def forbidden_handler(_request: Request, exc: ForbiddenError):
    return JSONResponse(status_code=403, content={"detail": str(exc)})


@app.exception_handler(BadRequestError)
async def bad_request_handler(_request: Request, exc: BadRequestError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(requests.router, prefix="/requests", tags=["requests"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(telegram.router, prefix="/notifications/telegram", tags=["telegram"])
