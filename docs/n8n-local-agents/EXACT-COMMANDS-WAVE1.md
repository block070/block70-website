# Wave 1 — exact commands and where to run them

**User:** `jmiller` on Ubuntu. **Workspace:** `/home/jmiller/n8n_workspace`. **n8n:** Docker container (default name **`n8n`**).

**Legend — run location (required):**

| Tag | Meaning |
|-----|--------|
| **`[HOST]`** | SSH session on the Ubuntu server, as `jmiller`, normal shell (`bash`). |
| **`[PC]`** | Your Windows machine, **PowerShell** (run **`RUN-WAVE1-SYNC.ps1`** / **`wave1-sync-from-pc.ps1`** / **`n8n-export-workflow-from-pc.ps1`**). |
| **`[BROWSER]`** | Web UI only — no terminal. |

**Operator LAN (this repo):** n8n host **`192.168.0.164`**. Change commands below only if your server IP differs. Replace `n8n` with your container name **only** if `docker ps` shows a different name.

**Agents / Cursor:** This file is the operator source of truth for Wave 1 commands. Do not paraphrase; point here.

**Wave 1 and “only two workflows”:** The repo only contains **two** importable JSON files (**error-logger** + **pilot**). That is expected. **`crypto-data-collector`** and **`api-scheduler`** are **not** in git — you build them in the UI and export with [`scripts/n8n-export-workflow-from-pc.ps1`](./scripts/n8n-export-workflow-from-pc.ps1) (§6).

**Operator rule (human + Cursor):** Do **not** treat manual `scp` / copy-paste `docker exec` as the primary path for Wave 1 deploy. **Run the scripts** below. Appendix at the end of this file is for debugging only.

---

## 0) Confirm container name (optional but exact)

**`[HOST]`**

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'NAMES|n8n'
```

If the n8n container is not named `n8n`, set a variable for the rest of the session (example name `n8n` — change if needed):

```bash
export N8N_CONTAINER=n8n
```

All `docker exec` lines below use `n8n`. If you set `N8N_CONTAINER`, replace `n8n` with `"$N8N_CONTAINER"`.

---

## 1) Dead-letter directory (error-logger)

**`[HOST]`**

```bash
mkdir -p /home/jmiller/n8n_workspace/data/logs/dead-letter-shared
sudo chown -R 1000:1000 /home/jmiller/n8n_workspace/data/logs/dead-letter-shared
```

---

## 2) Upload + import **both** repo workflows (error-logger + pilot)

Scripts perform upload (`scp`), place files under `/home/jmiller/n8n_workspace/workflows/`, and run `docker exec … n8n import:workflow` for **`block70-error-logger.json`** and **`block70-pilot-coin-gecko.json`**.

### **`[PC]`** (default — Windows PowerShell)

One command (change `C:\block70` if your clone lives elsewhere):

```powershell
powershell -ExecutionPolicy Bypass -File C:\block70\docs\n8n-local-agents\RUN-WAVE1-SYNC.ps1
```

Same thing, explicit:

```powershell
Set-Location C:\block70\docs\n8n-local-agents\scripts
.\wave1-sync-from-pc.ps1
```

Optional: `-Server 192.168.0.164 -User jmiller -Container n8n`

Requires **OpenSSH Client** (`ssh`, `scp` in PATH). Re-running may **duplicate** workflows in n8n — remove duplicates in the UI if needed.

### **`[HOST]`** (Block70 repo cloned on the server; no PC)

```bash
cd /path/to/block70/docs/n8n-local-agents/scripts
chmod +x wave1-import-on-host.sh
N8N_CONTAINER=n8n ./wave1-import-on-host.sh
```

---

### 2b) Missing the third node (no **Read/Write Files** on canvas)

There is **no** palette entry called “Write dead letter …”. The third step is the core node **Read/Write Files from Disk** (n8n’s default label on the canvas is often **Read/Write Files from Disk**; our workflow renames it to **Read/Write Files — dead-letter JSON**).

**`[BROWSER]`** — add it by hand if import dropped it:

1. Open **Block70 — Error Logger**.
2. Click **+** → search **`Read/Write Files from Disk`** (or **Read Write File**) → add the node.
3. Set **Operation** → **Write File to Disk** (or **Write**).
4. **File Path and Name** (or **File Path**):  
   `/home/jmiller/n8n_workspace/data/logs/dead-letter-shared/error-logger-latest.json`
5. **Input Binary Field**: `data` (must match the binary output of **Convert error to JSON file**).
6. Connect **Convert error to JSON file** → this node (main output to main input).
7. **Save** the workflow.

Requires **`N8N_RESTRICT_FILE_ACCESS_TO`** to include `/home/jmiller/n8n_workspace` (see pilot runbook).

---

## 4) Set global Error workflow (UI)

**`[BROWSER]`**

1. Open n8n: `http://192.168.0.164:5678` (or your tunnel URL).
2. **Settings** (gear) → **Error workflow** (instance / default error workflow).
3. Select **Block70 — Error Logger** (or the imported workflow name).
4. Save.

### 4b) Canvas is **empty** (no nodes) but the workflow name exists

If **Block70 — Error Logger** opens to a **blank canvas**, it is **not** a valid error handler. Re-run **§2** (`RUN-WAVE1-SYNC.ps1` or `wave1-import-on-host.sh`). Delete duplicate empty workflows if the import created a second entry. You must see **Error Trigger** → **Convert error to JSON file** → **Read/Write Files — dead-letter JSON** (or §2b) on the canvas before continuing.

### 4c) No **“This workflow can be called by”** in Settings (normal)

That control is for **sub-workflows** (workflows called via **Execute Workflow** / caller policy). **Error Trigger** error-handler workflows often **do not** show it — your UI can match the screenshot and still be correct. **You do not need that field** to use **Block70 — Error Logger** as the handler for other workflows.

**`[BROWSER]`** — If **Block70 — Error Logger** is grayed in an **Error workflow** picker:

1. Confirm the canvas has **Error Trigger** first (§2 / §4b).
2. Wire the handler from the **consumer** workflow: open **Block70 Pilot — CoinGecko to disk** (or crypto collector) → **⋯** → **Settings** → **Error workflow** → **Block70 — Error Logger** → **Save**.
3. Optionally set the **instance** default: **Settings** (sidebar gear) → **Error workflow** → **Block70 — Error Logger**.

On **Block70 — Error Logger** itself, **Error workflow** = **No workflow** (as in your screenshot) is **correct** — do not point the error logger at itself.

### 4d) Dropdown shows **exactly one** workflow and it is **grayed**

This usually means you opened **⋯ → Settings** from **inside** the **Block70 — Error Logger** workflow (workflow-level settings, not the instance gear).

For **“Error workflow” on workflow X**, n8n only offers workflows that start with **Error Trigger**. If the **only** Error-Trigger workflow in your instance is **this same** workflow, the list has **one** row — **your current workflow** — and it is **grayed** because n8n **does not allow a workflow to be its own error handler** (would recurse forever).

**What to do:**

1. On **Block70 — Error Logger**, leave **Error workflow** as **none / empty / default** (the error logger does not need a separate error handler for normal setups).
2. Open your **main** workflow (e.g. pilot / **Crypto Data Collector**) — **not** the error logger.
3. **⋯** → **Settings** → **Error workflow** → choose **Block70 — Error Logger** (should be **not** grayed when the current canvas is **not** the error logger).

For a **global** default: use the **top-level** **Settings** (gear in the **sidebar / user menu**, not the three dots on the canvas). If that list still misbehaves, confirm **Error Trigger** exists and is not disabled, set the handler from the **pilot** workflow (§4c), then consider upgrading n8n (older 2.x had error-workflow UI quirks; see [n8n #24299](https://github.com/n8n-io/n8n/issues/24299)).

---

## 5) Smoke-test error-logger (optional but recommended)

**`[BROWSER]`**

1. Open the **Block70 — Error Logger** workflow.
2. **Optional:** **Execute workflow** — on some n8n versions the **Error Trigger** does not behave like a normal manual run; a **real** test is a **failing production run** (e.g. Schedule/Webhook), not manual, per [Error Trigger docs](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.errortrigger/).
3. Confirm file exists on server (step 6) after a run that actually hit the error handler.

**`[HOST]`**

```bash
ls -la /home/jmiller/n8n_workspace/data/logs/dead-letter-shared/error-logger-latest.json
```

---

## 6) Export a built workflow to `…/workflows/<agent-id>.json` (e.g. crypto-data-collector)

Live workflow stays in n8n’s DB; exporting writes the **registry-aligned** file on the server.

### 6A — UUID from the browser

**`[BROWSER]`**

1. Open the workflow (e.g. the one that writes **`crypto-data-collector-latest.json`**).
2. Copy the UUID from the URL, e.g.  
   `http://192.168.0.164:5678/workflow/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`  
   → UUID = `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`.

### 6B — **`[PC]`** — one script (no manual `scp` of the JSON)

```powershell
Set-Location C:\block70\docs\n8n-local-agents\scripts
.\n8n-export-workflow-from-pc.ps1 `
  -WorkflowId 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' `
  -AgentId 'crypto-data-collector'
```

Use the same pattern for **`api-scheduler`** (change **`-AgentId`**). Optional: `-Server 192.168.0.164 -User jmiller -Container n8n`.

**`[HOST]`** — verify:

```bash
ls -la /home/jmiller/n8n_workspace/workflows/crypto-data-collector.json
```

---

## 7) What is *not* done by commands

- **`api-scheduler`:** Build in the n8n UI, then **§6** with `-AgentId 'api-scheduler'`.
- **Duplicates in n8n:** Delete extra copies in the UI; keep one global Error workflow.

---

## Appendix — manual `docker exec` (only if scripts fail)

**Import** one file already on the host:

```bash
docker exec -u node n8n n8n import:workflow \
  --input=/home/jmiller/n8n_workspace/workflows/SOME_FILE.json
```

**Export** by UUID on the host (replace UUID and filename):

```bash
docker exec -u node n8n n8n export:workflow \
  --id=WORKFLOW_UUID \
  --output=/home/jmiller/n8n_workspace/workflows/AGENT_ID.json
```

Replace `n8n` with your container name if different.
