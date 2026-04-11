# Rolling out the 50 local agents (after pilot smoke test)

**Exact Wave 1 commands (where to run each line):** [EXACT-COMMANDS-WAVE1.md](./EXACT-COMMANDS-WAVE1.md)

You already proved: Docker mounts, **`N8N_RESTRICT_FILE_ACCESS_TO`**, HTTP → file on disk. Building **agents** means one **n8n workflow per registry row**, aligned with **`paths.*`**, **`logging.logFile`**, and **`n8n.workflowFile`**.

**Registry:** [block70-n8n-agents-registry.json](./block70-n8n-agents-registry.json) (source of truth for paths and agent `id`).

**Do not** build all 50 before any run. Use **waves** below; export each workflow when stable using the **canonical path rule** below.

---

## Canonical workflow file on the server (use for every agent)

**Rule:** On the n8n host, every deployed workflow export must be saved as:

```text
/home/jmiller/n8n_workspace/workflows/<agent-id>.json
```

- **`<agent-id>`** = the registry **`id`** (kebab-case), e.g. `crypto-data-collector`, `error-logger`, `stock-data-collector`.
- **Always include the `.json` extension.**  
- This must match **`n8n.workflowFile`** in [block70-n8n-agents-registry.json](./block70-n8n-agents-registry.json) for that agent.

### Git repo `workflows/` vs server `workflows/`

| Location | What’s there |
|----------|----------------|
| **`C:\block70\docs\n8n-local-agents\workflows\` (git)** | Only **templates we ship:** `block70-pilot-coin-gecko.json`, `block70-error-logger.json`. There is **no** `crypto-data-collector.json` in git unless someone commits an export later. |
| **`/home/jmiller/n8n_workspace/workflows/` (Ubuntu server)** | **Every** agent’s canonical export, including **`crypto-data-collector.json`**, is **created by you** — export from n8n (UI download or `docker exec … export:workflow --output=…`). The live workflow is stored in **n8n’s database**; the JSON on disk is your backup / naming convention for the registry. |

The **pilot** import was the starting point for the same behavior as **`crypto-data-collector`** (CoinGecko → market file). Once it works in n8n, that workflow **is** your crypto collector — you only **rename the export file** to `crypto-data-collector.json` (you do not pull that filename from git).

**Fix `crypto-data-collector` now (you already have the working workflow in n8n):**

1. In n8n, open the workflow that writes **`crypto-data-collector-latest.json`**.
2. **⋯** menu → **Download** (export workflow JSON).
3. On the server, replace any ad-hoc name with the canonical filename:

   ```bash
   # If you saved the download in ~/Downloads or home:
   mv ~/Downloads/workflow.json /home/jmiller/n8n_workspace/workflows/crypto-data-collector.json
   # adjust the source path to wherever the file landed; or use scp from your PC:
   # scp .\crypto-data-collector.json jmiller@SERVER:/home/jmiller/n8n_workspace/workflows/crypto-data-collector.json
   ```

4. Confirm:

   ```bash
   ls -la /home/jmiller/n8n_workspace/workflows/crypto-data-collector.json
   ```

5. Optional: delete or ignore older exports such as **`block70-pilot-coin-gecko.json`** on the server if you no longer need them (keep a copy in git under `docs/n8n-local-agents/workflows/` if you still use it as a template).

**If `mv ~/workflow.json` fails:** that path was only an example. Use the **real** download path (often `ls ~/Downloads/*.json`) or export from the container (no browser file needed):

```bash
docker exec -u node n8n n8n export:workflow \
  --id=WORKFLOW_ID_FROM_N8N_URL \
  --output=/home/jmiller/n8n_workspace/workflows/crypto-data-collector.json
```

The workflow id is the UUID in the n8n URL when the workflow is open. Replace `n8n` with your container name if needed.

**For the next agents:** duplicate/adjust the workflow in n8n → export → always save as **`…/workflows/<agent-id>.json`** using the registry **`id`**.

---

## Prerequisites (once)

| Check | Notes |
|--------|--------|
| **`config/tickers.json`** exists | Required for agents with **`tickersExempt: false`** (10 agents); others may ignore it. |
| **`N8N_RESTRICT_FILE_ACCESS_TO`** includes `/home/jmiller/n8n_workspace` | Required for Read/Write File nodes. |
| **`data/media`** on large disk | Before heavy **content_media** agents; verify `df -h` on that path. |
| Global **Error workflow** | Set in n8n **Settings** after **error-logger** workflow exists (Wave 1). |

---

## Per-agent routine (repeat)

1. In n8n: **New workflow**, name matches registry **`name`** / **`id`**.
2. Implement only **`paths.reads`** / **`paths.writes`** / **`logging.logFile`** for that agent (grep the agent block in the registry JSON).
3. **Credentials** in n8n only; no secrets in exported JSON committed to git if policy forbids it.
4. **Manual execute** → then schedule when green.
5. **Export** → save as **`…/workflows/<id>.json`** (matches **`n8n.workflowFile`**).
6. Track **workflow UUID** privately (replace placeholders in operator notes, not necessarily in committed registry).

**Duplication:** After the first agent in a category works, **duplicate** the workflow in n8n, rename, swap paths/log file, export — faster than greenfield each time.

---

## Wave 1 — Foundations (do first)

| Order | Agent `id` | Purpose |
|-------|----------------|----------|
| 1 | **`error-logger`** | Import [workflows/block70-error-logger.json](./workflows/block70-error-logger.json) — **Error Trigger** → **Convert to File** → **Read/Write Files from Disk** (write) → **`…/data/logs/dead-letter-shared/error-logger-latest.json`**. Palette name is **Read/Write Files from Disk**, not “dead letter”; see [EXACT-COMMANDS-WAVE1.md](./EXACT-COMMANDS-WAVE1.md) §3b if the third node is missing. Then **Settings → Error workflow** → this workflow. Optional: **`error-logger.log`** via **`NODE_FUNCTION_ALLOW_BUILTIN=fs`** or Execute Command. |
| 2 | **`crypto-data-collector`** | Extend / rename the **pilot** workflow; export as **`…/workflows/crypto-data-collector.json`**; align **`logging.logFile`** with the registry. |
| 3 | **`api-scheduler`** | Cron + HTTP to internal/health endpoints; proves scheduling + credentials. |

**Server dirs once (error-logger dead letter):**

```bash
mkdir -p /home/jmiller/n8n_workspace/data/logs/dead-letter-shared
sudo chown -R 1000:1000 /home/jmiller/n8n_workspace/data/logs/dead-letter-shared
```

**Import error-logger (same pattern as pilot):**

Run this **on the host** — the `n8n` CLI exists **inside the Docker container**, not in your normal SSH shell (`command not found` means you ran `n8n` without `docker exec`):

```bash
docker exec -u node n8n n8n import:workflow \
  --input=/home/jmiller/n8n_workspace/workflows/block70-error-logger.json
```

Replace `n8n` with your container name from `docker ps` if needed. Alternatively use the UI: **Import from File**.

In the n8n UI: **Settings** (instance) → **Error workflow** → select **Block70 — Error Logger**.

If that entry is **grayed out**, open the error-logger workflow → **⋯** → **Workflow settings** → set **This workflow can be called by** to **Any workflow** (or equivalent), save, then retry the instance **Error workflow** picker. Details: [EXACT-COMMANDS-WAVE1.md](./EXACT-COMMANDS-WAVE1.md) §4b.

Confirm the handler with a **failing production execution** (not only manual test — Error Trigger is built for real failures). See **EXACT-COMMANDS-WAVE1.md** §5.

Until **error-logger** is set globally (or per-workflow), failures from other workflows are harder to diagnose.

---

## Wave 2 — Market data (`market_data`, 10 agents)

`crypto-data-collector`, `stock-data-collector`, `market-trend-analyzer`, `historical-data-processor`, `signal-generator`, `statistical-modeler`, `alert-generator`, `exchange-monitor`, `portfolio-tracker`, `api-scheduler`

**Note:** **`stock-data-collector`** references **`config/stocks.json`** in the registry — create it if that agent reads it.

---

## Wave 3 — Content / media (`content_media`, 10 agents)

`social-media-writer`, `linkedin-post-generator`, `tweet-composer`, `youtube-script-writer`, `video-editor`, `image-generator`, `thumbnail-creator`, `voiceover-generator`, `content-planner`, `engagement-analyzer`

Confirm **`data/media`** capacity before large outputs.

---

## Wave 4 — Automation (`automation_workflow`, 10 agents)

`workflow-orchestrator`, `task-scheduler`, `error-logger` (done W1), `dependency-resolver`, `job-dispatcher`, `monitor-agent-health`, `file-manager`, `backup-manager`, `cloud-sync-manager`, `resource-optimizer`

Import **called** workflows before **Execute Workflow** callers.

---

## Wave 5 — AI research (`ai_research`, 10 agents)

`model-trainer`, `prompt-tester`, `text-analyzer`, `sentiment-analyzer`, `trend-predictor`, `recommendation-generator`, `hypothesis-tester`, `metric-dashboard-builder`, `kpi-tracker`, `research-aggregator`

Rate-limit / budget external LLM APIs.

---

## Wave 6 — Support (`support_maintenance`, 10 agents)

`configuration-manager`, `user-activity-logger`, `notification-dispatcher`, `performance-monitor`, `data-validator`, `security-auditor`, `access-controller`, `cleanup-agent`, `version-manager`, `documentation-generator`

---

## Operator tracking (private)

| agent `id` | n8n workflow UUID | Active? | Notes |
|------------|-------------------|---------|--------|
| error-logger | | | |
| … | | | |

---

## n8n 2.15 reminders

- **Code node:** `require('fs')` needs **`NODE_FUNCTION_ALLOW_BUILTIN=fs`** if you log from Code.
- **Execute Command:** off by default — adjust **`NODES_EXCLUDE`** if you use it.
- **Read/Write File:** paths must stay inside **`N8N_RESTRICT_FILE_ACCESS_TO`**.

When you finish a wave, add a row to **VALIDATION-REPORT.md** §9 if your process requires it.
