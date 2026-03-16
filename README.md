# Block70 Alpha Network Monorepo

Block70 is a crypto opportunity intelligence platform that helps users discover profitable opportunities across arbitrage, mining ROI, node ROI, airdrops/testnets, smart wallet activity, and more.

This monorepo contains:

- `apps/web` – Next.js + TypeScript + Tailwind (shadcn/ui compatible) frontend
- `apps/api` – FastAPI + SQLAlchemy + Pydantic backend
- `docs` – Product and architecture documentation
- `packages` – Shared libraries (future)

## Getting Started

### 1. Environment

Copy the example environment file and adjust values as needed:

```bash
cp .env.example .env
```

### 2. Run with Docker

From the repository root:

```bash
docker-compose up --build
```

This will start:

- PostgreSQL
- Redis
- FastAPI backend on port `8000`
- Next.js frontend on port `3000`

### 3. Project Structure

Backend (`apps/api`):

- `models/` – SQLAlchemy models (database tables)
- `schemas/` – Pydantic models (API request/response)
- `services/` – Reusable business logic and external API wrappers
- `agents/` – Background agents that generate opportunity data
- `jobs/` – Scheduled background tasks
- `api/` – FastAPI routers and API wiring

Frontend (`apps/web`):

- Next.js App Router (`app/`)
- Tailwind-based UI
- Dashboard page that lists mock opportunities using the normalized Opportunity model shape

### 4. Development Notes

- Start with mock data before connecting to live crypto/market APIs.
- Keep the Opportunity model consistent across backend and frontend.
- Add agents gradually (Alpha Hunter, Arbitrage Scanner, Miner ROI Agent, Wallet Tracker, Scoring Agent).

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
