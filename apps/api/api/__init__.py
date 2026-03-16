from fastapi import FastAPI

from .v1 import opportunities, health


def register_routes(app: FastAPI) -> None:
    app.include_router(health.router, prefix="/api")
    app.include_router(opportunities.router, prefix="/api")

