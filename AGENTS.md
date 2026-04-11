# Agent guidance for the Block70 monorepo

This file is for **people and coding agents** (e.g. Cursor) working **in this repository**. It is not the same as [docs/agents.md](docs/agents.md), which describes **product** background agents (Alpha Hunter, Arbitrage Scanner, etc.).

## Scope: ops tooling vs product feature

**Confirmed default scope (operations):**

- **In-repo work** — Ship Block70 using **Cursor** (project rules, skills, Composer/Agent) plus human review, CI, and the verification commands below.
- **“Agent employees” / company roles** — Means **tooling and process** (rules, named prompts, optional external orchestration). It does **not** assume building multi-tenant agent-role management or billing **into** Block70 for customers.

**If the goal changes** to a **customer-facing** “agents as a product” layer (multi-tenant roles, agent runs, billing), that is a separate product/architecture initiative and is out of scope for this document.

## Cursor baseline: rules, skills, layout

### Project rules

- Repo rules live under [`.cursor/rules/`](.cursor/rules/). Example: `categories-page.mdc` (Categories page + CoinGequito behavior and API alignment).
- When changing an area covered by a rule file, read and follow that rule before editing.

### Skills (user-level playbooks)

- Repeatable workflows may live in Cursor **Skills** (user `SKILL.md` files). Use project rules and this file first; use skills for personal or team playbooks not committed here.

### Monorepo layout (short)

- **`apps/web`** — Next.js (App Router), dashboard and market UI.
- **`apps/api`** — FastAPI backend, opportunity APIs, connectors.
- **`docs/`** — Product and architecture docs.

### Web analytics (GA4)

- Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` in deployment env; ops notes in [`docs/google-analytics-block70.md`](docs/google-analytics-block70.md).

### Local n8n operational agents (50-agent registry)

- Registry, JSON Schema, validation, and operator notes: [`docs/n8n-local-agents/README.md`](docs/n8n-local-agents/README.md). Cursor rule: [`.cursor/rules/n8n-local-agents.mdc`](.cursor/rules/n8n-local-agents.mdc).

### Gates for agent-executable tasks (especially `apps/web`)

Run from **`apps/web`** after substantive frontend or dashboard changes, unless the change is trivial (e.g. copy-only):

| Command | Purpose |
|--------|---------|
| `npm run verify:home` | Home dashboard script (`scripts/verify-home-dashboard.ts`); ops notes in [`docs/home-dashboard-reliability.md`](docs/home-dashboard-reliability.md) |
| `npm run verify:macro` | Macro dashboard script (`scripts/verify-macro-dashboard.ts`) |
| `npm run lint` | ESLint |
| `npm run build` | Production build (`next build`) |

Prefer running **`verify:*`** when touching home/macro dashboard behavior or data shaping. Use **`build`** before considering work ready to merge.

Backend-only changes may use the API’s usual tests/lint if present; align with existing `apps/api` conventions.

## Orchestration (Paperclip-class) — evaluation, not default

**Trial checklist (optional):** [docs/operations/orchestration-eval.md](docs/operations/orchestration-eval.md).

**When it helps:** Longer non-code pipelines (research → draft → review → publish), explicit role names, reporting lines, per-role budgets, or human approvals **outside** the IDE.

**When Cursor alone is enough:** Most code changes in this repo; use rules + scoped tasks + verification scripts + merge discipline.

### If you trial Paperclip or similar

- **Repository:** [paperclipai/paperclip](https://github.com/paperclipai/paperclip) (evaluate alongside any vendor that offers role/budget orchestration).
- **Risk:** API keys, data leaving the repo, and cost caps — match to your tolerance before production use.
- **Suggested role examples (illustrative):** researcher, drafter, reviewer, publisher — hand off artifacts, not raw production deploy rights.
- **Budgets:** Set per-agent or per-workflow token/spend caps in the orchestrator where supported; Cursor spend remains on your Cursor plan.
- **Integration with code:** Route **code-changing** work to **Git** (branches/PRs) or an explicit Cursor session; avoid silent edits to production. Non-code outputs can feed tickets or specs that you implement here.

**Hybrid pattern:** Orchestrator produces specs/tickets → Cursor implements in-repo → human review → merge/deploy.
