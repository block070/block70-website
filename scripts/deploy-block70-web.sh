#!/usr/bin/env bash
# Run ON THE VPS from repo root. Syncs git to origin/master, proves dashboard source exists, rebuilds web.
set -euo pipefail

ROOT="${BLOCK70_ROOT:-$HOME/block70}"
cd "$ROOT"

echo "==> Repo: $ROOT"
git fetch origin
git checkout master
git reset --hard origin/master

echo "==> HEAD: $(git rev-parse --short HEAD)"
if ! grep -q CryptoHourDashboard apps/web/app/crypto-on-the-hour/page.tsx; then
  echo "FATAL: This commit has no CryptoHourDashboard — origin/master is wrong or GitHub is behind."
  echo "    Fix: push master from your laptop: git push origin master"
  exit 1
fi

echo "==> Docker build web (no cache)"
docker compose build web --no-cache

echo "==> Recreate container"
docker compose up -d web --force-recreate

PORT="${WEB_PORT:-3000}"
if grep -q '^WEB_PORT=' .env 2>/dev/null; then
  PORT="$(grep '^WEB_PORT=' .env | cut -d= -f2 | tr -d '\r')"
fi

echo "==> Smoke: http://127.0.0.1:${PORT}/crypto-on-the-hour"
if curl -fsS "http://127.0.0.1:${PORT}/crypto-on-the-hour" | grep -q 'data-coh-ui="intel-v2"'; then
  echo "OK: new intelligence shell is live on localhost."
else
  echo "WARN: marker data-coh-ui not in HTML yet."
  echo "    If you see the old 'running feed' paragraph, public traffic may hit Cloudflare cache or another origin."
  curl -fsS "http://127.0.0.1:${PORT}/crypto-on-the-hour" | head -c 600 || true
  echo
fi
