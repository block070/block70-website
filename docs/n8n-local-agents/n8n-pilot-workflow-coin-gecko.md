# n8n pilot workflow: CoinGecko → file on disk (n8n 2.x)

**End goal:** On your Ubuntu server, n8n runs in Docker, can write under `/home/jmiller/n8n_workspace`, and the imported pilot workflow produces:

- `/home/jmiller/n8n_workspace/data/market/crypto-data-collector-latest.json`

(Optional host log file under `data/logs/` is **not** in the default workflow: n8n **2.15** task runners **disallow `require('fs')`** in the Code node. See **“Optional: append a log line”** below if you need that.)

Do the steps **in order**. User is **`jmiller`**; change paths if your user differs.

---

## End-to-end runbook (commands in order)

### 1. SSH into the server

```bash
ssh jmiller@192.168.0.164
```

### 2. Create folders Block70 and n8n need

```bash
mkdir -p /home/jmiller/n8n_workspace/data/market
mkdir -p /home/jmiller/n8n_workspace/data/logs
mkdir -p /home/jmiller/n8n_workspace/workflows
mkdir -p /home/jmiller/n8n_docker_data
```

### 3. Let the n8n Linux user (UID **1000** in the official image) write those data dirs

```bash
sudo chown -R 1000:1000 /home/jmiller/n8n_workspace/data/market
sudo chown -R 1000:1000 /home/jmiller/n8n_workspace/data/logs
sudo chown -R 1000:1000 /home/jmiller/n8n_docker_data
```

### 4. Stop and remove any old container named `n8n` (ignore errors if none)

```bash
docker stop n8n 2>/dev/null
docker rm n8n 2>/dev/null
```

### 5. Start n8n with **both** required settings

- **Bind mount** workspace: host → container at the **same** path.
- **`N8N_RESTRICT_FILE_ACCESS_TO`**: n8n v2 **only** allows file nodes to write inside listed dirs; without this, `/home/jmiller/n8n_workspace` is blocked even if Linux permissions are correct ([breaking change](https://docs.n8n.io/2-0-breaking-changes/)).
- **`N8N_SECURE_COOKIE=false`**: optional; use if you open the UI as `http://192.168.0.164:5678` and get secure-cookie errors (lab/LAN only).

Pick **one** of 5A or 5B.

**5A — single `docker run` (copy the whole block)**

```bash
docker run -d \
  --name n8n \
  --restart unless-stopped \
  -p 5678:5678 \
  -e TZ=Etc/UTC \
  -e N8N_RESTRICT_FILE_ACCESS_TO=/home/jmiller/n8n_workspace \
  -e N8N_SECURE_COOKIE=false \
  -v /home/jmiller/n8n_docker_data:/home/node/.n8n \
  -v /home/jmiller/n8n_workspace:/home/jmiller/n8n_workspace \
  docker.n8n.io/n8nio/n8n
```

Change `TZ=Etc/UTC` to your timezone if you want (e.g. `America/New_York`).

**5B — you already use Docker Compose**  
Edit the `n8n` service to include the same env vars and volume line as in 5A, then:

```bash
docker compose up -d
```

(Use your real compose file path and project name.)

### 6. Confirm the container is running

```bash
docker ps --filter name=n8n
docker exec n8n printenv N8N_RESTRICT_FILE_ACCESS_TO
```

You should see: `/home/jmiller/n8n_workspace`

### 7. Put the workflow JSON on the server

**Option A — you have this git repo on the server**

```bash
# If block70 is already cloned, adjust the path to your clone:
cp /path/to/block70/docs/n8n-local-agents/workflows/block70-pilot-coin-gecko.json \
  /home/jmiller/n8n_workspace/workflows/
```

**Option B — from your PC** (run on PC, not on server)

```bash
scp docs/n8n-local-agents/workflows/block70-pilot-coin-gecko.json \
  jmiller@192.168.0.164:/home/jmiller/n8n_workspace/workflows/
```

### 8. Import the workflow into n8n (CLI)

```bash
docker exec -u node n8n n8n import:workflow \
  --input=/home/jmiller/n8n_workspace/workflows/block70-pilot-coin-gecko.json
```

If the command errors, check the container name: `docker ps` (replace `n8n` in the command with your container name).

**`SQLITE_CONSTRAINT: NOT NULL constraint failed: workflow_entity.id`:** The JSON must include a top-level workflow **`id`** (UUID). The repo file includes this — **re-copy** the latest `block70-pilot-coin-gecko.json` from the repo to the server, then run the import again. If problems persist, use **Import from File** in the UI instead of the CLI.

### Optional: append a log line on the host (`fs` is blocked in Code by default)

n8n **2.15** runs the Code node in a **task runner** that disallows **`require('fs')`** (`Module 'fs' is disallowed`). The stock pilot workflow therefore ends at **Write market file** (no log Code node).

**Option A — allow built-in `fs` in Code (less strict):** add to the **same** container as n8n (and to an external task-runner container if you use one), then recreate:

```text
NODE_FUNCTION_ALLOW_BUILTIN=fs
```

See [Enable modules in Code node](https://docs.n8n.io/hosting/configuration/configuration-examples/modules-in-code-node/).

**Option B — Execute Command node:** enable the node type via **`NODES_EXCLUDE`** (see [v2 breaking changes](https://docs.n8n.io/2-0-breaking-changes/)), then add a node that runs `echo … >> …/crypto-data-collector.log`.

**Option C — rely on n8n:** use **Executions** history instead of a host log file for this pilot.

### 9. Open the n8n UI

In a browser:

- `http://192.168.0.164:5678`  
  or, if you use SSH tunnel: `ssh -L 5678:127.0.0.1:5678 jmiller@192.168.0.164` then open `http://127.0.0.1:5678`

Complete first-time owner setup if asked.

### 10. Run the workflow in the UI

1. Open **Workflows**.
2. Open **Block70 Pilot — CoinGecko to disk** (or the name shown after import).
3. Click **Execute workflow** (not “test” on a single node only).

### 11. Confirm output on the server

```bash
cat /home/jmiller/n8n_workspace/data/market/crypto-data-collector-latest.json
```

You should see CoinGecko JSON (`bitcoin` / `ethereum` / `usd`). The pilot workflow **does not** write a log file (see optional section below).

### 12. If something failed — quick checks

```bash
docker logs n8n --tail 80
ls -la /home/jmiller/n8n_workspace/data/market
docker exec n8n id
```

---

## Already had n8n running?

You **must** add **`N8N_RESTRICT_FILE_ACCESS_TO=/home/jmiller/n8n_workspace`** and the **`-v /home/jmiller/n8n_workspace:/home/jmiller/n8n_workspace`** mount, then **recreate** the container (env is fixed at create time for plain `docker run`). Edit Compose / your run script, then `docker compose up -d` or repeat steps 4–6.

---

## Import via UI instead of CLI

1. Copy `workflows/block70-pilot-coin-gecko.json` to a machine with a browser.
2. n8n → **Import from File** → select the JSON → **Save** → **Execute workflow** as in step 10.

---

## Reference (why each setting exists)

**`N8N_RESTRICT_FILE_ACCESS_TO`:** n8n v2 allowlist for **Read/Write Files**; without it, paths under `/home/jmiller/n8n_workspace` get “not writable” even with correct `chown`.  

**Bind mount:** Without `-v .../n8n_workspace:...`, the workflow path does not exist inside the container.  

**`1000:1000` on `data/market` and `data/logs`:** matches user `node` in the image so Linux allows create/write.  

**Pilot workflow** uses **Code** (not Execute Command) because Execute Command is disabled by default in v2 (`NODES_EXCLUDE`).

---

## Appendix — manual build & troubleshooting (optional)

Use this only if you are **not** using the imported JSON. Self-hosted **2.15.x** behavior: connect nodes in order with **no gaps**.

## Why “Write file” fails with “binary file `data` not found”

The node **Read/Write File** → **Write** only writes from **binary** data on the item (default property name **`data`**).  
Plain **JSON** from **HTTP Request** or a **Set** field is **not** binary. You must add **Convert to File** so the item has **Binary → `data`** before Write.

---

## Recommended chain (fewest nodes)

The **imported** workflow uses **four** nodes in this order (no Code node — **fs** is disallowed in 2.15 task runners by default):

| Step | Node | Purpose |
|------|------|---------|
| 1 | When clicking “Execute workflow” | Start |
| 2 | HTTP Request | GET CoinGecko JSON |
| 3 | Convert to File | Turn JSON into **binary `data`** |
| 4 | Read/Write File | Write binary to disk |

**Connect:** `1 → 2 → 3 → 4` with **no gaps**. Optional log append requires **NODE_FUNCTION_ALLOW_BUILTIN=fs**, **Execute Command** (if enabled), or manual steps — see **“Optional: append a log line”** above.

---

## Step 1 — Manual trigger

- Add **When clicking “Execute workflow”** (or **Manual Trigger**).
- Leave defaults. No expression fields required.

---

## Step 2 — HTTP Request

| Field | Value |
|--------|--------|
| **Name** | `GET CoinGecko prices` (any label is fine) |
| **Method** | `GET` |
| **URL** | `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd` |
| **Authentication** | None |

Do **not** put the URL in expression mode unless you know what you’re doing (expressions must resolve to a valid URL).

**Test:** Execute **only** this node if your UI allows pin/test; you should see JSON like `bitcoin`, `ethereum`, `usd`.

---

## Step 3 — Convert to File

Add **Convert to File** from the node panel (**+**).

| Field | Value |
|--------|--------|
| **Operation** | **Convert to JSON** |
| **Mode** | **Each Item to Separate File** (one HTTP item → one `.json` file) *or* **All Items to One File** if you prefer a single combined file — for one CoinGecko response, either works; **Each** is easiest to reason about. |
| **Put Output File in Field** | `data` (must match the next node) |
| **Options → Format** | `true` (pretty-printed JSON) |
| **Options → File Name** | `crypto-data-collector-latest.json` |
| **Options → Encoding** | `utf8` (default) |

**Important:** After this node, open the execution preview for **item 0** — you must see **Binary** with a property named **`data`**. If you only see JSON and no Binary, Write will always fail.

---

## Step 4 — Read/Write File (Write)

Add **Read/Write File** (node name in UI may be **Read/Write Files from Disk**).

| Field | Value |
|--------|--------|
| **Operation** | **Write** |
| **File Path and Name** | `/home/jmiller/n8n_workspace/data/market/crypto-data-collector-latest.json` |
| **Input Binary Field** | `data` (same as **Put Output File in Field** in Convert to File) |

**Do not** point this node at the HTTP node or at a Set node that only has text — only at **Convert to File**.

---

## Step 5 — (Optional) append a host log line

Not part of the default import. On **n8n 2.15**, **`require('fs')` in Code** fails unless you set **`NODE_FUNCTION_ALLOW_BUILTIN=fs`** (see optional section at top of this doc).

**Execute Command** works if the node is enabled via **`NODES_EXCLUDE`**.

| Field | Value |
|--------|--------|
| **Command** | `echo "$(date -Iseconds) ok" >> /home/jmiller/n8n_workspace/data/logs/crypto-data-collector.log` |

(Use your n8n version’s **Execute Command** UI; single command box vs `sh -c` varies.)

---

## Run the full workflow

1. **Save** the workflow.
2. Click **Execute workflow** (runs from the trigger through the **whole** chain — not “Test step” on a single node unless you’re debugging).
3. On the server:

   ```bash
   cat /home/jmiller/n8n_workspace/data/market/crypto-data-collector-latest.json
   ```

4. In **Executions**, the run should show **four** nodes succeeded (or one clear error).

If you still see **Module `fs` is disallowed**, you are on an **old** copy of the workflow that had a Code “Append log” node — **re-import** the current `block70-pilot-coin-gecko.json` from the repo, or remove that node. To use **`fs` in Code**, set **`NODE_FUNCTION_ALLOW_BUILTIN=fs`** ([docs](https://docs.n8n.io/hosting/configuration/configuration-examples/modules-in-code-node/)).

---

## Schedule (later)

1. Add **Schedule Trigger** with your cron.
2. **Disconnect** the manual trigger **or** leave it unused.
3. Connect **Schedule Trigger** → **HTTP Request** (first node of the data chain).
4. Turn the workflow **Active**.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| **“The file … is not writable”** (Read/Write File) | Set **`N8N_RESTRICT_FILE_ACCESS_TO=/home/jmiller/n8n_workspace`** on the n8n container and restart. Default n8n 2.x only allows **`~/.n8n-files`**; OS `chmod` alone does not fix it. |
| Only first node runs (~16 ms success) | **Reconnect** all nodes left-to-right; no gaps. |
| Write: no binary `data` | Ensure **Convert to File** is **between** HTTP and Write; **Put Output File in Field** = **`data`**; **Input Binary Field** on Write = **`data`**. |
| Code: Python runner unavailable | Code language must be **JavaScript**, not Python. |
| **Module `fs` is disallowed** (Code node) | On **2.15**, task runners block **`fs`** unless **`NODE_FUNCTION_ALLOW_BUILTIN=fs`**. Prefer the **four-node** imported workflow (no log Code node). |
| Files missing on host but nodes green | Check Docker **bind mount** for `n8n_workspace`; `docker exec n8n ls -la /home/jmiller/n8n_workspace/data/market`. |

---

## Optional: Set node before Convert to File

Only if you need to **reshape** JSON before saving (e.g. rename keys). Flow:

**HTTP → Edit Fields (Set) → Convert to File (Convert to JSON)** → Write → …

**Convert to JSON** reads **`item.json`** from each incoming item. Your Set node must leave the payload in **`json`**, not only in a random string field, unless you use **Convert to Text File** with the correct source field — the **HTTP → Convert to JSON** path above avoids that complexity.
