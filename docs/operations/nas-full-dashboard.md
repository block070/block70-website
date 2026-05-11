# NAS full dashboard (Block70): steps 1–6

Runbook for hosting **ingestion + Timescale warehouse + full Block70 stack** (Next.js + FastAPI + app Postgres) on one Ubuntu NAS, with clear separation between **app data** and **market OHLC data**.

Paths below use placeholders; replace with yours (e.g. `~/block70-repo`, `/srv/market-data`, Timescale on `:5433`).

---

## One path only: dashboard on the NAS (do steps in order)

Use this section **first**. Skip alternatives until something fails—then use **§ Troubleshooting** at the end of this section. The rest of this doc is reference material.

**Assumptions:** Repo path **`~/block70-repo`**, **Node 20+**, **Python 3.12** venv at **`apps/api/.venv`**, Timescale reachable at **`192.168.0.180:5433`** (your IP may differ), app Postgres on **`127.0.0.1:5432`**.

| Step | What you do | Pass criterion |
|------|-------------|----------------|
| **1** | Install Postgres if needed: `sudo apt install -y postgresql` | `sudo -u postgres psql -c 'SELECT 1'` works |
| **2** | Create app DB once (pick one password; avoid `!` in shell—see troubleshooting): `sudo -u postgres psql <<'SQL'` … `CREATE USER block70 WITH PASSWORD '...';` … `CREATE DATABASE block70 OWNER block70;` … `SQL` then `GRANT ALL ON SCHEMA public TO block70` in DB `block70` | `PGPASSWORD='…' psql -h 127.0.0.1 -p 5432 -U block70 -d block70 -c 'SELECT 1'` returns one row |
| **3** | Edit **`~/block70-repo/apps/api/.env`**. Set **`DATABASE_URL`** (SQLAlchemy): `postgresql+psycopg2://block70:PASSWORD@127.0.0.1:5432/block70`. Set **`MARKET_DATA_DATABASE_URL`** to Timescale: `postgresql+psycopg2://market:PASSWORD@192.168.0.180:5433/market` (host/port match **your** Docker bind). Set **`FRONTEND_ORIGIN`**, **`BLOCK70_PUBLIC_URL`**, **`INTERNAL_WEB_BASE_URL`** to the URL you will type in the browser for Next—example LAN: `http://192.168.0.180:3000`. | File saved on disk |
| **4** | Start API (no stale exports): `cd ~/block70-repo/apps/api && unset DATABASE_URL MARKET_DATA_DATABASE_URL && source .venv/bin/activate && python -m uvicorn app.main:app --host 0.0.0.0 --port 8010` | Another terminal: `curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8010/openapi.json` prints **200** |
| **5** | Warehouse smoke: `curl -sS http://127.0.0.1:8010/api/v1/market-warehouse/health` | JSON contains **`"ok": true`** |
| **6** | Web DB URLs for Prisma + Next: create **`~/block70-repo/apps/web/.env`** with **both** lines (same DB twice—plain Postgres): **`DATABASE_URL=`** and **`DIRECT_URL=`** using `postgresql://block70:PASSWORD@127.0.0.1:5432/block70`. Encode **`@`** in password as **`%40`**, **`!`** as **`%21`**. Copy the same two lines into **`.env.local`** if you use it for Next-only vars. | `grep -E '^DATABASE_URL=|^DIRECT_URL=' .env` shows two nonempty lines |
| **7** | Prisma: `cd ~/block70-repo/apps/web && unset DATABASE_URL DIRECT_URL && npx prisma migrate deploy` | Ends with **successfully applied** / already applied |
| **8** | Web env for browser API: in **`.env.local`** set **`NEXT_PUBLIC_SITE_URL=http://192.168.0.180:3000`**, **`NEXT_PUBLIC_API_BASE_URL=http://192.168.0.180:8010`**, **`API_SERVER_URL=http://127.0.0.1:8010`** (replace IP with your NAS LAN IP). Match **`FRONTEND_ORIGIN`** on API to **`NEXT_PUBLIC_SITE_URL`** origin. | Saved |
| **9** | Build + start: `npm ci` then `npm run build` then `npm run start`. If port busy: `PORT=3001 npm run start` and change Step 8 URLs to **3001**. | Browser loads **`http://NAS:3000`** (or **3001**) |

### Troubleshooting (only if stuck)

- **`password authentication failed`** — Password in **`.env`** does not match Postgres. Fix DB or URL; **`unset`** exported vars before starting uvicorn.  
- **`DIRECT_URL` empty** — Prisma reads **`apps/web/.env`**, not only **`.env.local`**. Both **`DATABASE_URL`** and **`DIRECT_URL`** must be in **`.env`**.  
- **`Event not found` / bash `!`** — Do not double-quote passwords containing **`!`**. Use **`set +H`** or single quotes: **`export DATABASE_URL='postgresql://…'`** or encode **`!`** as **`%21`** in the URL.  
- **`EADDRINUSE :3000`** — Run `ss -tlnp` and find **LISTEN** on **3000**, **`kill`** that PID, or use **`PORT=3001`**.  
- **`npm ci` lockfile mismatch** — On dev PC run **`npm install`** in **`apps/web`**, commit **`package-lock.json`**, **`git push`**, NAS **`git pull`**.  
- **Logs: `451` / Binance.com from ingest or market snapshots** — Chart OHLCV no longer calls **`api.binance.com`** (same ~1000-bar cap as other venues; geo **451**). **`coin_market_snapshot`** may still try Binance.com for **24h ticker** metadata; NAS **ingest scripts** outside this repo must point at **Coinbase** (or another venue) if you moved off Binance there.

### Figure out where you are (~1 minute)

SSH into the NAS and run this block (copy–paste as one script). It does **not** print secrets.

```bash
echo "=== API listening (expect 200) ==="
curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:8010/openapi.json 2>/dev/null || echo "API down or nothing on 8010"

echo "=== Warehouse health (expect ok true) ==="
curl -sS http://127.0.0.1:8010/api/v1/market-warehouse/health 2>/dev/null | head -c 150; echo

echo "=== Next listening ==="
ss -tlnp 2>/dev/null | grep -E ':3000|:3001' || echo "Nothing on 3000/3001"

echo "=== apps/web/.env has DATABASE + DIRECT? ==="
test -f "$HOME/block70-repo/apps/web/.env" && grep -E '^DATABASE_URL=|^DIRECT_URL=' "$HOME/block70-repo/apps/web/.env" | sed 's/=.*/=…/' || echo "Missing apps/web/.env"

echo "=== Prisma migrate status ==="
cd "$HOME/block70-repo/apps/web" 2>/dev/null && npx prisma migrate status 2>&1 | tail -8
```

**How to read it**

| You see | You are probably at |
|---------|---------------------|
| API **not** 200 | **Step 3–4** — fix **`apps/api/.env`**, **`unset`** exports, start uvicorn |
| Warehouse not **`ok`** | **Step 3–5** — **`MARKET_DATA_DATABASE_URL`** / restart API |
| **`Missing apps/web/.env`** or no **`DIRECT_URL=`** | **Step 6** |
| **`migrate status`** errors / pending | **Step 7** |
| Nothing on **3000/3001** but API OK | **Step 9** — **`npm run start`** (or **`PORT=3001`**) |
| API **200**, **`ok`**, Next **LISTEN** on 3000 | **Done through step 9** — next: **systemd**/tmux (**doc §6**), verify scripts, remote access |

---

## Remote access from another location (internet)

You usually want **SSH for administration** and optionally **HTTPS to the dashboard/API**, without exposing databases or opening risky inbound ports.

### Prefer: VPN or tunnel (no open Postgres / raw ports on the public internet)

| Approach | What it gives you | Notes |
|----------|-------------------|--------|
| **[Tailscale](https://tailscale.com/)** (or ZeroTier, Netbird, etc.) | Encrypted mesh VPN; your NAS gets a stable tail IP; SSH and LAN-only services feel local | Strong default choice: install Tailscale on NAS + laptop, SSH to Tailscale IP, use browser to `http://NAS_TAILSCALE_IP:3000` if services bind LAN |
| **WireGuard** | Same idea; you run a WG server on NAS or router | More DIY; very efficient |
| **[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)** (`cloudflared`) | Public HTTPS hostname → services on localhost **without** inbound firewall holes | Good for **dashboard/API URLs** from anywhere; pair with Cloudflare Access if you want SSO/login in front |
| **SSH only** | Port-forward over SSH (e.g. `ssh -L 3000:127.0.0.1:3000 user@nas`) then open `http://localhost:3000` | Minimal exposure if SSH is hardened (keys, no password login) |

**Do not** publish **PostgreSQL** (5432/5433), Redis, or administrative UIs directly on `:443`/`:80` without a reverse proxy and auth. Keep warehouse/app DB on **`127.0.0.1`** or VPN-only unless you have a hard requirement and network ACLs.

### If you must expose SSH or HTTPS on your home/public IP

- **SSH:** key-based auth only (`PasswordAuthentication no`), non-default port optional, allowlist or fail2ban, latest OpenSSH.
- **HTTPS:** terminate TLS at **Caddy/nginx** or Cloudflare; forward to Next/API on localhost.
- **Router:** port-forward **only** what you need (e.g. 443 → reverse proxy, or **nothing** if you use Tailscale + Tunnel only).

### Env URLs when using a public hostname

Set **`NEXT_PUBLIC_SITE_URL`**, **`NEXT_PUBLIC_API_BASE_URL`**, **`FRONTEND_ORIGIN`**, and **`BLOCK70_PUBLIC_URL`** to your **real HTTPS origins** (no trailing slash issues—match what browsers use). Mixed HTTP/HTTPS can break cookies/CORS.

---

## 1. Timescale + ingest: fixed layout and warehouse URL only

**Goal:** OHLC and ingest metadata live only in the warehouse; nothing “accidentally” shares the app DB.

| Concern | Recommendation |
|--------|----------------|
| Timescale data directory | Dedicated NVMe path (e.g. `/srv/market-data/pg`) — avoid mergerfs for Postgres data |
| Port | Fixed port for warehouse Postgres (e.g. **5433**) so it never fights app Postgres (**5432**) |
| Bind address | **`127.0.0.1`** if only local processes connect; otherwise LAN IP + firewall allowlist |
| API env | **`MARKET_DATA_DATABASE_URL`** → warehouse **only** (see [`apps/api/.env.example`](../../apps/api/.env.example)) |

Example (driver must match API venv: `psycopg2-binary` → `postgresql+psycopg2://`):

```env
MARKET_DATA_DATABASE_URL=postgresql+psycopg2://market:SECRET@127.0.0.1:5433/market
```

**Ingest scripts:** keep credentials in a **separate** env file (e.g. `/srv/market-data/ingest/.env`) used only by cron/systemd timers—do not merge into `apps/api/.env` unless you accept duplicate secrets.

---

## 2. App Postgres + `DATABASE_URL` (non-OHLC)

**Goal:** Users, billing, Upland, app tables — separate DB and URL from Timescale.

| Item | Recommendation |
|------|------------------|
| Connection | **`DATABASE_URL`** for FastAPI ([`app/db/session.py`](../../apps/api/app/db/session.py)); compose from `POSTGRES_*` or set explicitly |
| User | Distinct from warehouse user (`market`) — least privilege per DB |
| Migrations | From dev/CI: apply API migrations ([`apps/api/app/db/migrations`](../../apps/api/app/db/migrations)) as documented in repo |
| Web (Prisma) | From `apps/web`: `npx prisma migrate deploy` against the **same** app DB when you deploy the dashboard |

Ensure **`apps/api/.env`** and **`apps/web/.env.local`** (or production env) refer to the **same** app database when running full stack on one NAS.

---

## 3. FastAPI stable + git as source of truth

**Goal:** API starts cleanly; NAS tracks **`origin`**—no hand-editing production clones.

Smoke checks (from `apps/api` with venv active):

```bash
curl -sS -o /dev/null -w "openapi %{http_code}\n" "http://127.0.0.1:8010/openapi.json"
curl -sS "http://127.0.0.1:8010/api/v1/market-warehouse/health"
```

- First line should be **200**.
- Without **`MARKET_DATA_DATABASE_URL`**, warehouse health returns **503** (expected); with a valid URL and DB, expect **`ok`** and **`now_utc`**.

Workflow:

1. Fix and commit on your dev machine, **`git push`** to the branch the NAS tracks (`master` / `main`).
2. On NAS: **`git fetch && git merge origin/<branch>`** (or pull).

Warehouse routes live in [`apps/api/app/api/v1/market_warehouse.py`](../../apps/api/app/api/v1/market_warehouse.py); CoinGecko **`market`** routes and **`SLUG_TO_SYMBOL`** stay in [`apps/api/app/api/v1/market.py`](../../apps/api/app/api/v1/market.py)—do not replace `market.py` with warehouse-only code.

---

## 4. Next.js build/run + API base URL

**Goal:** Browser and server-side fetches hit your FastAPI origin.

The web app resolves the API via **`NEXT_PUBLIC_API_BASE_URL`** and **`API_SERVER_URL`** (see [`apps/web/lib/api.ts`](../../apps/web/lib/api.ts)).

On the NAS, set (example LAN hosting):

```env
NEXT_PUBLIC_SITE_URL=http://192.168.0.180:3000
NEXT_PUBLIC_API_BASE_URL=http://192.168.0.180:8010
API_SERVER_URL=http://127.0.0.1:8010
```

**CORS:** FastAPI **`FRONTEND_ORIGIN`** must include the web origin (comma-separated). Example:

```env
FRONTEND_ORIGIN=http://192.168.0.180:3000
BLOCK70_PUBLIC_URL=http://192.168.0.180:3000
INTERNAL_WEB_BASE_URL=http://192.168.0.180:3000
```

Build and run (from `apps/web`):

```bash
npm ci
npm run build
npm run start
```

Use **`npm run start`** (not only `dev`) for a long-lived dashboard process behind systemd or a reverse proxy.

---

## 5. Reverse proxy (optional) + firewall

**Goal:** One hostname/port for humans; optional TLS on LAN.

- **Caddy** or **nginx** as reverse proxy: route `/` → Next (3000), `/api` or subdomain → FastAPI (8010), or terminate TLS.
- **ufw** (or similar): allow **22**, **80/443** if using proxy; allow **3000/8010** only on LAN if no proxy; **do not** expose Timescale **5433** to the internet.

Bind services to **`127.0.0.1`** when only the proxy should talk to them; bind LAN IP when devices must connect directly.

---

## 6. systemd (or similar): API, web, ingest timers

**Goal:** Survive reboot; separate failure domains; **`flock`** on ingest so jobs don’t overlap.

### Environment files

- **`/etc/block70/api.env`** — owned root **`0640`**: `DATABASE_URL`, `MARKET_DATA_DATABASE_URL`, `FRONTEND_ORIGIN`, secrets.
- **`/etc/block70/web.env`** — `NEXT_PUBLIC_*`, `API_SERVER_URL`, Prisma URL if needed.

Reference them with **`EnvironmentFile=`** in units.

### Example: API unit

`/etc/systemd/system/block70-api.service`:

```ini
[Unit]
Description=Block70 FastAPI
After=network.target

[Service]
Type=simple
User=jmiller
WorkingDirectory=/home/jmiller/block70-repo/apps/api
EnvironmentFile=-/etc/block70/api.env
ExecStart=/home/jmiller/block70-repo/apps/api/.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8010
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Adjust **`User`**, **`WorkingDirectory`**, and **`ExecStart`** paths.

### Example: Next.js unit

`/etc/systemd/system/block70-web.service`:

```ini
[Unit]
Description=Block70 Next.js
After=network.target block70-api.service

[Service]
Type=simple
User=jmiller
WorkingDirectory=/home/jmiller/block70-repo/apps/web
EnvironmentFile=-/etc/block70/web.env
ExecStart=/usr/bin/npm run start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Ensure **`Node`**/`npm` path matches (`which npm`). Alternatively run **`node`** on `.next/standalone/server.js`** if you use standalone output.

### Ingest timers

**Daily crypto + equity (`bars_1m`):** repo scripts under [`scripts/market/`](../../scripts/market/) — `daily_market_bars_ingest.py` runs Coinbase (symbols already in warehouse) then Alpaca (S&P CSV). Example env: [`scripts/market/market-ingest.env.example`](../../scripts/market/market-ingest.env.example). Systemd units: [`scripts/market/systemd/`](../../scripts/market/systemd/). Equity backfill / universe: [`docs/market-data/sp500-universe.md`](../market-data/sp500-universe.md).

```bash
sudo cp scripts/market/market-ingest.env.example /etc/block70/market-ingest.env
sudo chmod 600 /etc/block70/market-ingest.env
# edit REPO_ROOT, MARKET_DATA_DATABASE_URL, APCA_* keys

sudo cp scripts/market/systemd/block70-market-bars-daily.{service,timer} /etc/systemd/system/
# fix WorkingDirectory= in the .service if REPO_ROOT differs
sudo systemctl daemon-reload
sudo systemctl enable --now block70-market-bars-daily.timer
sudo systemctl start block70-market-bars-daily.service   # manual test
tail -f /var/log/block70/market-bars-daily.log
```

Manual run (no systemd): `bash scripts/market/run_daily_bars_ingest.sh` with `ENV_FILE` / `REPO_ROOT` set.

Use **`flock`** (included in `run_daily_bars_ingest.sh`) so overlapping timer runs do not stack.

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now block70-api.service block70-web.service
```

---

## Order of execution (first boot)

1. Start **app Postgres** and **Timescale**; create DBs/users; set **`pg_hba.conf`** for local/LAN as needed.  
2. Apply **API** + **Prisma** migrations to app DB.  
3. Configure **`/etc/block70/api.env`** and start **`block70-api.service`**; run openapi + warehouse health curls.  
4. Configure **`/etc/block70/web.env`** and start **`block70-web.service`**; open dashboard in browser.  
5. Add **reverse proxy** + **firewall** if desired.  
6. Enable **ingest timers** last so OHLC continues filling while the dashboard is already usable.

---

## Phase 2+: After `/api/v1/market-warehouse/health` returns `ok`

You already have **Timescale + `MARKET_DATA_DATABASE_URL`** working when **`curl`** shows **`"ok": true`**. Next is the **application Postgres** (`DATABASE_URL`), then the **Next.js** dashboard.

### A. App PostgreSQL (if not done yet)

On Ubuntu (native package):

```bash
sudo apt update && sudo apt install -y postgresql
sudo systemctl enable --now postgresql
sudo -u postgres psql -c "SELECT version();"
```

Create app DB + role (pick a strong password; replace names if your repo differs):

```bash
sudo -u postgres psql -c "CREATE USER block70 WITH PASSWORD 'APP_DB_SECRET';"
sudo -u postgres psql -c "CREATE DATABASE block70 OWNER block70;"
sudo -u postgres psql -d block70 -c 'GRANT ALL ON SCHEMA public TO block70;'
PGPASSWORD='APP_DB_SECRET' psql -h 127.0.0.1 -p 5432 -U block70 -d block70 -c 'SELECT 1;'
```

### B. FastAPI `DATABASE_URL` + migrations

In **`apps/api/.env`** (same file as warehouse URL), set **`DATABASE_URL`** to the **app** database (driver matches **`psycopg2-binary`**):

```env
DATABASE_URL=postgresql+psycopg2://block70:APP_DB_SECRET@127.0.0.1:5432/block70
```

The API applies incremental SQL on startup via [`app/db/migrations.py`](../../apps/api/app/db/migrations.py) (`run_migrations()`). Restart uvicorn after editing:

```bash
cd ~/block70-repo/apps/api && source .venv/bin/activate
unset DATABASE_URL   # avoid stale export overriding .env
python -m uvicorn app.main:app --host 0.0.0.0 --port 8010
```

Smoke (should not be connection errors):

```bash
curl -sS -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8010/openapi.json"
```

If startup logs show migration errors, fix DB permissions or disk; **`create_all`** also expects models to match—watch the first boot logs.

### C. Prisma (`apps/web`) — same logical DB

[`apps/web/prisma/schema.prisma`](../../apps/web/prisma/schema.prisma) uses **`DATABASE_URL`** and **`DIRECT_URL`**. On a simple single Postgres (no pooler), both can point at the **same** connection string.

In **`apps/web/.env.local`** (or production env):

```env
DATABASE_URL="postgresql://block70:APP_DB_SECRET@127.0.0.1:5432/block70"
DIRECT_URL="postgresql://block70:APP_DB_SECRET@127.0.0.1:5432/block70"
```

Then:

```bash
cd ~/block70-repo/apps/web
# Node 20+ recommended for Next.js in this monorepo
npx prisma migrate deploy
npm ci
npm run build
npm run start
```

Set **`NEXT_PUBLIC_API_BASE_URL`**, **`NEXT_PUBLIC_SITE_URL`**, **`API_SERVER_URL`**, and **`FRONTEND_ORIGIN`** on the API side to match how you reach the web + API (LAN IP or hostname)—see **§4** above.

### D. Persistence + ops hygiene

- Run API/web under **systemd** (§6) or **tmux** so SSH disconnect does not kill processes.
- Avoid **`export DATABASE_URL=...`** / **`export MARKET_*`** in **`~/.bashrc`** unless intentional—**`.env` + `load_dotenv`** should be the source of truth; stale exports override `.env`.
- **Rotate** any DB password that was pasted in chat or logs.

### E. Warehouse bars endpoint (optional sanity)

With rows in **`bars_1m`** (or CAGGs), try (adjust query params to match your data):

```bash
curl -sS "http://127.0.0.1:8010/api/v1/market-warehouse/bars?asset_class=crypto&exchange=coinbase&symbol=BTC/USD&timeframe=1m&limit=5" | python3 -m json.tool
```

---

## Related

- API env sample: [`apps/api/.env.example`](../../apps/api/.env.example)  
- Monorepo agent notes: [`AGENTS.md`](../../AGENTS.md)
