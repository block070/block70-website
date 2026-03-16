# System Architecture

Monorepo layout:

block70
├ apps
│  ├ web
│  └ api
├ docs
└ packages

Frontend:
Next.js
TypeScript
Tailwind
shadcn/ui

Backend:
Python
FastAPI
SQLAlchemy
Pydantic

Database:
PostgreSQL

Cache / jobs:
Redis

Auth:
Clerk

Payments:
Stripe

Key backend modules:

agents/
services/
models/
schemas/
jobs/
api/

Agents are responsible for discovering or calculating opportunity data.

Services provide reusable logic for external APIs and internal processing.

Models represent database tables.

Jobs run scheduled background tasks.

API provides REST endpoints for the frontend.
