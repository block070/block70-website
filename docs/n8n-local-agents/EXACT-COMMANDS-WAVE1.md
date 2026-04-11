# Wave 1 — exact commands and where to run them

**User:** `jmiller` on Ubuntu. **Workspace:** `/home/jmiller/n8n_workspace`. **n8n:** Docker container (default name **`n8n`**).

**Legend — run location (required):**

| Tag | Meaning |
|-----|--------|
| **`[HOST]`** | SSH session on the Ubuntu server, as `jmiller`, normal shell (`bash`). |
| **`[PC]`** | Your Windows machine, **PowerShell** (for `scp` only). |
| **`[BROWSER]`** | Web UI only — no terminal. |

**Operator LAN (this repo):** n8n host **`192.168.0.164`**. Change commands below only if your server IP differs. Replace `n8n` with your container name **only** if `docker ps` shows a different name.

**Agents / Cursor:** This file is the operator source of truth for Wave 1 commands. Do not paraphrase; point here.

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

## 2) Put `block70-error-logger.json` on the server

The import in step 3 reads this **exact** path:

`/home/jmiller/n8n_workspace/workflows/block70-error-logger.json`

### 2A — Block70 repo already on the server

**`[HOST]`** — adjust `BLOCK70` if your clone lives elsewhere.

```bash
export BLOCK70=/home/jmiller/block70
cp "${BLOCK70}/docs/n8n-local-agents/workflows/block70-error-logger.json" \
  /home/jmiller/n8n_workspace/workflows/block70-error-logger.json
```

If the path is wrong, find the file:

```bash
find /home/jmiller -name 'block70-error-logger.json' 2>/dev/null
```

Then `cp` from that directory to `/home/jmiller/n8n_workspace/workflows/block70-error-logger.json`.

### 2B — Repo only on your PC (no clone on server)

**`[PC]`** — from the folder that contains `docs` (or use full path to the file).

```powershell
scp C:\block70\docs\n8n-local-agents\workflows\block70-error-logger.json jmiller@192.168.0.164:/home/jmiller/n8n_workspace/workflows/block70-error-logger.json
```

**`[HOST]`** — verify:

```bash
test -f /home/jmiller/n8n_workspace/workflows/block70-error-logger.json && echo OK || echo MISSING
```

---

## 3) Import error-logger workflow into n8n

The `n8n` CLI runs **inside** the container. This is **`[HOST]`** with `docker exec` (not a login shell inside the container).

**`[HOST]`**

```bash
docker exec -u node n8n n8n import:workflow \
  --input=/home/jmiller/n8n_workspace/workflows/block70-error-logger.json
```

After import, copy the **latest** JSON from this repo to the server again if you edited it locally, then re-run the command above (or use **Import from File** in the UI).

### 3b) Missing the third node (no **Read/Write Files** on canvas)

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

If **Block70 — Error Logger** opens to a **blank canvas**, it is **not** a valid error handler. Re-import [workflows/block70-error-logger.json](./workflows/block70-error-logger.json) (`docker exec … import:workflow` from §3). Delete duplicate empty workflows if the import created a second entry. You must see **Error Trigger** → **Convert error to JSON file** → **Read/Write Files — dead-letter JSON** (or §3b) on the canvas before continuing.

### 4c) If **Block70 — Error Logger** is grayed out / not selectable

n8n 2.x can **disable** workflows in that list unless they are allowed to be **invoked by other workflows** (same idea as sub-workflow “who may call this”).

**`[BROWSER]`**

1. Open the **Block70 — Error Logger** workflow (canvas).
2. **⋯** (top right) → **Settings** (workflow settings modal — **not** the gear for the whole instance).
3. Find **This workflow can be called by** (wording may vary slightly by version).
4. Set it to **Any workflow** / **All workflows** / the most permissive option (not “none” or a single named workflow).
5. **Save** the modal.
6. Go back to **Settings** (instance gear) → **Error workflow** and select **Block70 — Error Logger** again.

If it is still grayed: confirm the **first** node on the canvas is **Error Trigger** (re-import `block70-error-logger.json` if the graph was broken). As a fallback, set the error workflow **per workflow**: open e.g. **Crypto Data Collector** → **⋯** → **Settings** → **Error workflow** → pick **Block70 — Error Logger** (same “can be called by” fix applies).

### 4d) Dropdown shows **exactly one** workflow and it is **grayed**

This usually means you opened **⋯ → Settings** from **inside** the **Block70 — Error Logger** workflow (workflow-level settings, not the instance gear).

For **“Error workflow” on workflow X**, n8n only offers workflows that start with **Error Trigger**. If the **only** Error-Trigger workflow in your instance is **this same** workflow, the list has **one** row — **your current workflow** — and it is **grayed** because n8n **does not allow a workflow to be its own error handler** (would recurse forever).

**What to do:**

1. On **Block70 — Error Logger**, leave **Error workflow** as **none / empty / default** (the error logger does not need a separate error handler for normal setups).
2. Open your **main** workflow (e.g. pilot / **Crypto Data Collector**) — **not** the error logger.
3. **⋯** → **Settings** → **Error workflow** → choose **Block70 — Error Logger** (should be **not** grayed when the current canvas is **not** the error logger).

For a **global** default: use the **top-level** **Settings** (gear in the **sidebar / user menu**, not the three dots on the canvas). If that list still grays the only option, do §4b ( **This workflow can be called by** → **Any workflow** on the error logger), confirm **Error Trigger** is **not disabled**, then **upgrade n8n** (older 2.x had error-workflow UI bugs; see [n8n #24299](https://github.com/n8n-io/n8n/issues/24299)).

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

## 6) Export `crypto-data-collector.json` (canonical backup filename)

Live workflow stays in n8n’s DB; this writes the **registry-aligned** export file.

### 6A — Get workflow UUID from the browser

**`[BROWSER]`**

1. Open the workflow that writes **`crypto-data-collector-latest.json`**.
2. Copy the UUID from the URL. Example:  
   `http://192.168.0.164:5678/workflow/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`  
   → UUID is `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`.

### 6B — Export file on the server (no download folder)

**`[HOST]`** — paste your real UUID instead of `PASTE_WORKFLOW_UUID_HERE`:

```bash
docker exec -u node n8n n8n export:workflow \
  --id=PASTE_WORKFLOW_UUID_HERE \
  --output=/home/jmiller/n8n_workspace/workflows/crypto-data-collector.json
```

**`[HOST]`** — verify:

```bash
ls -la /home/jmiller/n8n_workspace/workflows/crypto-data-collector.json
```

### 6C — Alternative: you downloaded JSON from n8n UI to the PC

**`[PC]`**

```powershell
scp C:\path\to\your-downloaded-workflow.json jmiller@192.168.0.164:/home/jmiller/n8n_workspace/workflows/crypto-data-collector.json
```

(Use the real path where the browser saved the file, e.g. `C:\Users\YOUR_WINDOWS_USER\Downloads\workflow.json`.)

**`[HOST]`** — verify:

```bash
ls -la /home/jmiller/n8n_workspace/workflows/crypto-data-collector.json
```

---

## 7) What is *not* done by commands

- **`api-scheduler`:** Build that workflow in the n8n UI, then export with the same pattern as step 6, output path:  
  `/home/jmiller/n8n_workspace/workflows/api-scheduler.json`
- **Duplicates in n8n:** Delete extra copies in the UI; keep one global Error workflow.

---

## Quick reference: same docker exec pattern later

**Import any file already under `/home/jmiller/n8n_workspace/workflows/`:**

```bash
docker exec -u node n8n n8n import:workflow \
  --input=/home/jmiller/n8n_workspace/workflows/SOME_FILE.json
```

**Export by UUID to canonical name:**

```bash
docker exec -u node n8n n8n export:workflow \
  --id=WORKFLOW_UUID \
  --output=/home/jmiller/n8n_workspace/workflows/AGENT_ID.json
```

**`[HOST]`** for both.
