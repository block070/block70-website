# Block70 Web Frontend

This is the main web frontend for Block70, built with:

- Next.js (App Router)
- TypeScript
- Tailwind CSS

It provides a dark-theme foundation for:

- Landing page
- Dashboard page
- Opportunities list page
- Opportunity detail page

## Structure

```text
apps/web/
  app/
    layout.tsx          # Global shell and dark theme
    page.tsx            # Landing page
    dashboard/
      page.tsx          # Dashboard overview (live API-backed)
    opportunities/
      page.tsx          # Opportunities list (live API-backed)
      [id]/
        page.tsx        # Opportunity detail (live API-backed)
  components/
    dashboard/          # Dashboard-specific components
    opportunities/      # Opportunities-specific components
    shared/             # Shared UI components (e.g. navbar)
  lib/
    api.ts              # Backend API helper (uses NEXT_PUBLIC_API_BASE_URL)
    utils.ts            # Small formatting utilities
```

## Running the frontend

From the repository root:

```bash
cd apps/web
npm install
npm run dev
```

By default, the app runs at `http://localhost:3000`.

To point it at a local backend, create a `.env` file:

```bash
cp .env.example .env
```

and adjust `NEXT_PUBLIC_API_BASE_URL` if your backend is not on `http://localhost:8000`.

### Backend health banner (local or prod)

If FastAPI is unreachable, an **amber banner** appears under the top nav with:

- **Retry now** — probe again immediately
- **Show how to fix** — copy-paste commands for Docker and local uvicorn
- Link to **`/status`** for scheduler job detail

The banner calls `GET /api/health/services`, which checks your configured API base (`API_SERVER_URL` / `NEXT_PUBLIC_API_BASE_URL`) using the same TLS-aware fetch as other server routes.

**Run FastAPI locally** (from repo root):

```bash
cd apps/api
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Run with Docker** (repo root): `docker compose up -d api` (see root `docker-compose.yml`).

More context: `docs/REAL_DATA_LOCALLY.md`.

## Backend integration

The `lib/api.ts` helper assumes a backend base URL:

- `NEXT_PUBLIC_API_BASE_URL` (environment variable), or
- `http://localhost:8000` by default.

The dashboard and opportunities pages already call the live backend using
`getOpportunities` and `getOpportunityById` from `lib/api.ts`, while still
handling loading, empty, and error states gracefully.

