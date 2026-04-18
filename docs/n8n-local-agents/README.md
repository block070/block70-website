# Block70 n8n local agent registry

Operational registry for **50** local n8n agents on host paths under `/home/jmiller/n8n_workspace/`. This is **not** the product “agents” in [docs/agents.md](../agents.md) (Alpha Hunter, etc.).

## Files

| File | Purpose |
|------|---------|
| [block70-n8n-agents-registry.json](./block70-n8n-agents-registry.json) | Full registry: agents, paths, n8n placeholders, schedules, logging, errors, metrics |
| [n8n-local-agents-schema.json](./n8n-local-agents-schema.json) | JSON Schema (Draft 2020-12 semantics; see `$comment` in file) |
| [VALIDATION-REPORT.md](./VALIDATION-REPORT.md) | Validation results and operator checklist |
| [n8n-pilot-workflow-coin-gecko.md](./n8n-pilot-workflow-coin-gecko.md) | **Start here:** end-to-end commands (Docker → import → run); appendix covers manual build & errors |
| [AGENT-ROLLOUT.md](./AGENT-ROLLOUT.md) | **After pilot:** waves for all 50 agents, per-agent routine, n8n 2.15 reminders |
| [EXACT-COMMANDS-WAVE1.md](./EXACT-COMMANDS-WAVE1.md) | **Copy-paste:** Wave 1 commands tagged `[HOST]` / `[PC]` / `[BROWSER]` — no guessing where to run them |
| [workflows/block70-pilot-coin-gecko.json](./workflows/block70-pilot-coin-gecko.json) | **Import:** pilot — CoinGecko → Convert to JSON → Write market JSON |
| [workflows/block70-error-logger.json](./workflows/block70-error-logger.json) | **Import:** Error Trigger → dead-letter JSON (set as global **Error workflow**) |
| **`crypto-data-collector.json`** | **Not in git by default.** Create on the server by **exporting** your n8n workflow (evolved from the pilot) to `/home/jmiller/n8n_workspace/workflows/crypto-data-collector.json`. See [AGENT-ROLLOUT.md](./AGENT-ROLLOUT.md) (“Git repo vs server”). |
| [validation-summary.json](./validation-summary.json) | Machine-readable summary |
| [scripts/build-registry.mjs](./scripts/build-registry.mjs) | Regenerates `block70-n8n-agents-registry.json` after edits to roster/constants |
| [RUN-WAVE1-SYNC.ps1](./RUN-WAVE1-SYNC.ps1) | **PC — run this:** one command to upload both Wave 1 JSON files + import on host ([EXACT-COMMANDS-WAVE1.md](./EXACT-COMMANDS-WAVE1.md) §2) |
| [scripts/wave1-sync-from-pc.ps1](./scripts/wave1-sync-from-pc.ps1) | Called by `RUN-WAVE1-SYNC.ps1`; same behavior if run directly |
| [scripts/wave1-import-on-host.sh](./scripts/wave1-import-on-host.sh) | **Host:** import both repo workflows via `docker exec` (no PC) |
| [scripts/n8n-export-workflow-from-pc.ps1](./scripts/n8n-export-workflow-from-pc.ps1) | **PC:** SSH + export workflow UUID → canonical `…/workflows/<agent-id>.json` (§6) |

## Working directory

Run validation commands from **`docs/n8n-local-agents`** (this folder).

## Validation (required before merge)

```bash
cd docs/n8n-local-agents
node -e "JSON.parse(require('fs').readFileSync('block70-n8n-agents-registry.json','utf8')); JSON.parse(require('fs').readFileSync('n8n-local-agents-schema.json','utf8')); console.log('parse ok');"
npx ajv-cli validate -s n8n-local-agents-schema.json -d block70-n8n-agents-registry.json
npx prettier --check "*.json"
```

Expect: `block70-n8n-agents-registry.json valid` and Prettier clean.

## Versioning

- **`schemaVersion`** — Breaking changes to `n8n-local-agents-schema.json`.
- **`registryVersion`** — Content changes to the registry (paths, agents, defaults).
- **`metadata.version`** (per agent) — Changes to that agent’s spec.

Record all three in release notes and in **VALIDATION-REPORT.md** when you change files.

## Canonical paths (summary)

| Purpose | Path |
|---------|------|
| Config | `/home/jmiller/n8n_workspace/config/` |
| Data | `/home/jmiller/n8n_workspace/data/` |
| Workflows | `/home/jmiller/n8n_workspace/workflows/` |
| Tickers | `/home/jmiller/n8n_workspace/config/tickers.json` |
| Logs | `/home/jmiller/n8n_workspace/data/logs/` |
| Log archive | `.../data/logs/archive/` |
| Dry-run logs | `.../data/logs/dry-run/` |
| Media (default large root) | `.../data/media/` |

Ownership: each path is a **pathEntry** with `requiredOwnership: "jmiller"`, `requiredPermissions: "rwx"`. Enforce on the server with `chown`/`chmod` as documented in **VALIDATION-REPORT.md**.

## tickers.json

- Agents that consume symbols include `config/tickers.json` in `paths.reads` and set `dynamicCapabilities` to include `read_tickers_json` / `poll_tickers_json`.
- **No static ticker lists** in the registry JSON.
- Agents with `tickersExempt: true` must include `tickersExemptReason`.

To add tickers: edit **`tickers.json` on the server** (or sync from CI); workflows read it at runtime.

## Placeholders (replace on the n8n host)

- `REPLACE_WITH_N8N_WORKFLOW_ID_*` — paste workflow IDs from n8n after import/create.
- `REPLACE_WITH_WEBHOOK_PATH_*` — align with Webhook node paths.
- `REPLACE_WITH_ESCALATION_WORKFLOW_ID` — optional escalation workflow.
- **Never** commit API keys or secrets; use n8n **Credentials** and env vars.

## Chain semantics

- `triggers.onComplete` / `triggers.onError` list **agent `id`** values (e.g. failures route to **`error-logger`**).
- `n8n.executeWorkflowTargets` lists downstream workflows to call via **Execute Workflow** nodes in n8n.
- Optional `dependsOnAgents` / `executionOrder` document DAG intent; validate acyclic graphs before production.

## Dry-run and production

- `server.modes` and per-agent `modes` describe dry-run behavior; writes may be restricted to `data/logs/dry-run/` until the compliance gate (see plan §20.8).
- Toggle dry-run via n8n env vars / workflow static data (project-specific).

## Cursor usage

- Reference this folder with `@block70-n8n-agents-registry.json` or `@n8n-local-agents-schema.json`.
- Follow [`.cursor/rules/n8n-local-agents.mdc`](../../.cursor/rules/n8n-local-agents.mdc): do not invent paths outside `/home/jmiller/n8n_workspace/` except documented `largeMediaRoot` mounts.

## Metrics placeholders

Per-agent `metrics.*` keys are required; values may stay **`null`** until runtime (n8n executions or external metrics).

## Concurrency and quotas

- `executionConcurrency` / `maxParallelRuns` limit overlap on a single host running 50 workflows.
- `maxOutputSizeBytes` / `diskQuotaBytes` / `diskRequirements` protect large media writes; align with **64 TB** storage policy on the server.

## Post-implementation operator checklist (summary)

After repo files exist, on the **Linux n8n host**:

1. Create directory tree and `chown` to **jmiller** (or service user) with **rwx** where needed.
2. Install `server.runtime` Node/n8n versions and per-agent `runtime.systemPackages` (e.g. ffmpeg).
3. Import or build workflows; replace **workflow ID** placeholders.
4. Configure **Credentials**, schedules, webhooks, **Error Workflow** / DLQ paths.
5. Run **dry-run** tests; complete **VALIDATION-REPORT.md** §20 checks; then enable production schedules.
6. First **n8n** workflows on the host: **Error Logger** (global error workflow) then one **pilot** agent — see **VALIDATION-REPORT.md** §8.2.

Full step-by-step text lives in the **master plan** document (§21 Manual operator checklist) — not duplicated here in full.

## Regenerating the registry

After changing [scripts/build-registry.mjs](./scripts/build-registry.mjs):

```bash
cd docs/n8n-local-agents
node scripts/build-registry.mjs
npx prettier --write "*.json"
npx ajv-cli validate -s n8n-local-agents-schema.json -d block70-n8n-agents-registry.json
```
