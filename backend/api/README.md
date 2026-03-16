# Block70 Backend API

This directory is the home for the Block70 backend APIs.

The current FastAPI implementation lives under `apps/api/app`, and both
frontend applications (`apps/website` and `apps/app`) are expected to talk
to the same backend service (for example at `http://localhost:8000`).

As the project evolves, you can move or extend the backend implementation
into this `backend/api` directory while keeping the API surface stable.

