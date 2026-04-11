# Block70 n8n registry — validation report

**Generated:** 2026-04-02 (repository validation pass)

**Versions:** `schemaVersion` 1.0.0 · `registryVersion` 1.0.0

## 1. Parse status

| Check | Result |
|-------|--------|
| JSON.parse on `block70-n8n-agents-registry.json` | Pass |
| JSON.parse on `n8n-local-agents-schema.json` | Pass |

## 2. AJV schema validation

Command (from `docs/n8n-local-agents`):

```bash
npx ajv-cli validate -s n8n-local-agents-schema.json -d block70-n8n-agents-registry.json
```

**Result:** `block70-n8n-agents-registry.json valid` — **zero AJV errors.**

## 3. JSON lint / format

```bash
npx prettier --check "*.json"
```

**Result:** Pass (after `prettier --write` on schema and registry).

## 4. Counts and uniqueness

| Check | Result |
|-------|--------|
| Agent count | **50** |
| Categories | `market_data` ×10, `content_media` ×10, `automation_workflow` ×10, `ai_research` ×10, `support_maintenance` ×10 |
| Agent `id` uniqueness | Unique (kebab-case slugs) |
| `logging.logFile` uniqueness | Unique per agent (`…/data/logs/<id>.log`) |
| `n8n.workflowFile` uniqueness | Unique per agent (`…/workflows/<id>.json`) |
| `n8n.workflowId` placeholder pattern | Unique per agent (`REPLACE_WITH_N8N_WORKFLOW_ID_<ID>`) |

## 5. Roster compliance

All **50** display names match the immutable roster in the master plan (§18): Crypto Data Collector … Documentation Generator.

## 6. tickers.json policy

- Agents with **`tickersExempt: false`** include `config/tickers.json` in `paths.reads` and ticker-related `dynamicCapabilities`.
- Agents with **`tickersExempt: true`** include **`tickersExemptReason`** (40 agents exempt from ticker consumption for primary path).

## 7. Global checklist (documentation cross-reference)

| Topic | Registry coverage |
|-------|-------------------|
| Versioning triple | `schemaVersion`, `registryVersion`, per-agent `metadata.version` |
| Error handling / DLQ | `errorHandling.deadLetterPaths`, `server.globalErrorHandling` |
| Logging / rotation | `logging.*`, `archivePath` pathEntry |
| Dry-run | `server.modes`, per-agent `modes` |
| Runtime | `server.runtime`, `runtime.systemPackages` |
| Metrics keys | `metrics` object on every agent (nullable values) |
| Concurrency | `executionConcurrency`, `maxParallelRuns` |
| Quotas / disk | `maxOutputSizeBytes`, `diskQuotaBytes`, `diskRequirements` where applicable |
| Security | `sensitiveDataFields`, `logRedactionRules` |
| Archiving | `archiving.archivePath`, `retentionDays` |
| Webhook / API | `n8n.integrations.*` (placeholders, no secrets) |
| Trigger simulation | `simulateTrigger` |

## 8. Server-only checks (placeholders — not run in repo)

The following **must** be executed on the **jmiller** n8n host before production (plan §20.2–20.7):

| § | Area | Status |
|---|------|--------|
| 20.2 | Path existence, `stat`/`chown`, `df` / disk | **Pending operator** |
| 20.3 | Live schedule/webhook dry-run | **Pending operator** |
| 20.4 | Writable logs, rotation, alerts | **Pending operator** |
| 20.5 | Media quota / `largeMediaRoot` | **Pending operator** |
| 20.6 | Runtime metrics (optional) | **Pending operator** |
| 20.7 | DAG / webhook live tests | **Pending operator** |

### 8.1 Linux host notes (Docker, storage, fstab)

These are **not** repo CI checks; they avoid common breakage on the n8n host.

| Issue | What to do |
|-------|------------|
| **fstab pasted into bash** | Edit `/etc/fstab` with an editor or `tee -a`; shell treats device paths as commands. |
| **mergerfs: mountpoint is not empty** | Ensure `/mnt/n8n-merged` (or your mountpoint) is empty before mount, **or** add `nonempty` to mergerfs options so `mount -a` and reboots succeed. Confirm bind target with `findmnt` / `df`. |
| **`docker.io` vs Docker CE** | Do not install Ubuntu `docker.io` if **Docker CE** (`containerd.io`) is already installed — pick one stack (`apt list --installed \| grep -E 'docker|containerd'`). |
| **`jmiller` and `docker`** | After `usermod -aG docker jmiller`, run `newgrp docker` or re-login before `docker ps` without `sudo`. |

After container start: `docker ps -a`, `docker logs <name>`, UI on port **5678**; fix firewall or put n8n behind a reverse proxy if not LAN-only.

### 8.2 First workflows on n8n (error-logger + pilot)

Do this on the **n8n UI** after Docker and **`n8n_workspace`** mounts work (registry: `error-logger`, then any **`crypto-data-collector`**, etc.).

1. **Directories:** Ensure `data/logs/`, `data/logs/dead-letter-shared/`, `workflows/` exist under **`n8n_workspace`** and match ownership the container can write (see §8.1).
2. **Error Logger workflow:** New workflow → **Error Trigger** as start → format payload (e.g. **Code** or **Set**) → append to **`…/data/logs/error-logger.log`**; optional JSON to **`…/data/logs/dead-letter-shared/`**. Save → mark **available as error workflow** → set **Settings → Error workflow** to this workflow.
3. **Verify:** Run a tiny workflow with a deliberate failure → **`error-logger.log`** (or dead-letter file) updates.
4. **Pilot agent:** One workflow reading **`config/tickers.json`**, writing only under registry **`paths.writes`** (e.g. **`data/market/`**, agent log). Credentials in n8n only; manual trigger first.
5. **Export:** Download workflow JSON from n8n → save as **`…/workflows/<agent-id>.json`** (e.g. `error-logger.json`) to align with **`n8n.workflowFile`** in the registry.
6. **IDs:** Track workflow UUIDs privately (replace `REPLACE_WITH_N8N_WORKFLOW_ID_*` in operator notes, not in committed secrets).

## 9. Dry-run outcomes (template)

| Date | Operator | Scope | Outcome |
|------|----------|-------|---------|
| _YYYY-MM-DD_ | _initials_ | §20.2 path checks | _Pass / Waived / Fail_ |
| _YYYY-MM-DD_ | _initials_ | §20.8 compliance gate | _Pass / Waived / Fail_ |

## 10. Inconsistencies

None observed in repository validation. Re-run AJV after any registry edit.
