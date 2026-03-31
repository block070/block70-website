# TLS / SSL for `api.block70.com`

The Block70 FastAPI app serves **plain HTTP** on port `8000` inside Docker (`docker-compose.yml`). Browsers and Node must see **`https://api.block70.com`** with a certificate that matches that hostname (SAN includes `api.block70.com`). You add TLS by putting a **reverse proxy** (or cloud load balancer) in front of the API.

## 1. DNS

Create a **DNS A record** (and AAAA if you use IPv6):

| Name | Type | Value |
|------|------|--------|
| `api` | A | Your VPS / load balancer public IP |

Wait for propagation before ordering a certificate.

## 2. Recommended: Caddy (automatic Let’s Encrypt)

Caddy obtains and renews certificates automatically when it terminates HTTPS and proxies to your API.

### Option A — Caddy on the host (simplest)

1. Install [Caddy](https://caddyserver.com/docs/install) on the same machine that runs Docker.
2. Ensure **port 443** is free on the host (stop anything else bound to 443, or bind Caddy only to `api.block70.com` via DNS first).
3. Put a site block in `/etc/caddy/Caddyfile` (paths may vary by OS):

```caddyfile
api.block70.com {
    reverse_proxy 127.0.0.1:8000
}
```

If the API is only reachable as the `api` container, publish `8000:8000` in compose (already the default) and keep `127.0.0.1:8000` above.

4. `sudo systemctl reload caddy` (or `caddy run` for a quick test).

5. Set env for production:

- `NEXT_PUBLIC_API_BASE_URL=https://api.block70.com`
- `API_SERVER_URL=https://api.block70.com` (for Next/server routes that call FastAPI; must be reachable from the Next host with **valid** TLS)

### Option B — Caddy in Docker

This repo includes `infra/caddy-api/Caddyfile` and `infra/caddy-api/docker-compose.yml`. Merge them with the main stack so Caddy shares the **default** Compose network and can reach `http://api:8000`.

From the **repository root**:

```bash
docker compose -f docker-compose.yml -f infra/caddy-api/docker-compose.yml up -d
```

**Ports:** Caddy binds host `80` and `443`. Ensure nothing else on the host uses those ports. For production you can stop publishing `8000` on the host in the root `docker-compose.yml` and rely only on HTTPS (optional; keep `8000` for LAN debugging if you firewall it).

## 3. Nginx + Certbot (classic)

1. Install nginx and certbot (e.g. `certbot --nginx`).
2. Server block: `server_name api.block70.com;` → `proxy_pass http://127.0.0.1:8000;` with usual WebSocket/headers if needed.
3. Run `certbot --nginx -d api.block70.com` for Let’s Encrypt.
4. Set up renewal (certbot usually installs a timer).

## 4. Cloudflare (optional)

If the orange-cloud proxy is on for `api`:

- Use **Full (strict)** and a valid certificate on the origin (Let’s Encrypt/Caddy as above), **or** Cloudflare Origin CA (then clients must trust only through Cloudflare).

Do not use “Flexible” SSL (encrypts browser↔Cloudflare only) if you care about origin security.

## 5. After TLS works

1. Hit `https://api.block70.com/health` — expect JSON `{"status":"ok"}`.
2. From your Next.js host (e.g. Vercel), confirm server-side fetch to that URL succeeds (no `fetch failed`, no certificate hostname errors).
3. If you previously set `NARRATIVES_HTTP_FALLBACK_BASE` only to work around bad HTTPS, you can remove it once the cert is correct.

## 6. Troubleshooting

| Symptom | Likely cause |
|--------|----------------|
| Certificate valid for `block70.com` but not `api.block70.com` | Re-issue cert with **SAN** for `api.block70.com` or use a separate cert for the API vhost. |
| Let’s Encrypt **HTTP-01** fails | Port **80** must reach Caddy/nginx from the internet for the challenge (or use DNS-01). |
| Node `Hostname/IP does not match certificate` | Wrong cert on the host serving `api.block70.com`. |
| Connection refused | Proxy not running or wrong `proxy_pass` / Docker network. |

## 7. Chrome: “unusual and incorrect credentials” + HSTS

If Chrome says the site **normally** uses encryption but **this time** the credentials are wrong, and **you cannot visit because the website uses HSTS**, the browser is doing the right thing: the server on `api.block70.com:443` presented a certificate that **does not belong to that hostname** (wrong site’s cert, expired cert, self-signed, or a captive portal).

**HSTS** means Chrome will not let you click through; the **fix is on the server / DNS**, not in the browser.

### What to fix

1. **Confirm what cert is actually served** (from your laptop or the API host):

   **Linux / macOS (bash):**

   ```bash
   openssl s_client -connect api.block70.com:443 -servername api.block70.com </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
   ```

   **Windows PowerShell** (`</dev/null` is invalid there—pipe a quit instead):

   ```powershell
   "Q" | openssl s_client -connect api.block70.com:443 -servername api.block70.com 2>$null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
   ```

   If `openssl` is not on `PATH`, use the full path (e.g. `C:\Program Files\Git\usr\bin\openssl.exe` from Git for Windows).

   Check that **Subject Alternative Name** includes **`DNS:api.block70.com`** (or a matching wildcard). If you only see `block70.com` or `www.block70.com`, that cert is **wrong for the API subdomain** — issue a separate cert or a SAN cert that lists `api.block70.com`.

2. **DNS** — `api.block70.com` must point to the **same machine** that terminates TLS for the API (your Caddy/nginx/load balancer), not an old IP or the wrong pool.

3. **Default SSL vhost** — Many panels fall back to the “first” certificate. Ensure the vhost for **`api.block70.com`** uses the **correct** certificate, not the main site’s cert.

4. **Cloudflare** — If the hostname is proxied (orange cloud), **Full (strict)** requires a **valid cert on the origin** matching `api.block70.com`. “Flexible” can cause odd client behavior; prefer **Full (strict)** with Let’s Encrypt on origin or Cloudflare Origin CA.

5. **After the cert is fixed** — HSTS does not need to be “cleared” on users’ machines once HTTPS is valid again; the page should load after propagation (often immediately after you reload Caddy/nginx and the new cert is active).

### Optional: reduce pain while fixing (only if you control headers)

Avoid sending **`Strict-Transport-Security`** for the API hostname until the certificate is correct and stable. (HSTS for `block70.com` with **`includeSubDomains`** also applies to `api.block70.com` — if the parent domain preloads HSTS with `includeSubDomains`, every subdomain must have valid HTTPS.)

For general deploy env vars, see [DEPLOY.md](./DEPLOY.md).
