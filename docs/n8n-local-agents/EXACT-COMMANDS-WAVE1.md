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

---

## 4) Set global Error workflow (UI)

**`[BROWSER]`**

1. Open n8n: `http://192.168.0.164:5678` (or your tunnel URL).
2. **Settings** (gear) → **Error workflow**.
3. Select **Block70 — Error Logger** (or the imported workflow name).
4. Save.

---

## 5) Smoke-test error-logger (optional but recommended)

**`[BROWSER]`**

1. Open the **Block70 — Error Logger** workflow.
2. Click **Execute workflow** once.
3. Confirm file exists on server (step 6).

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
