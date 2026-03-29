#!/usr/bin/env bash
# Exit 0 always (cron-friendly). Restarts the api Compose service if /health does not return HTTP 200.
# Usage: from repo root, API_HEALTH_URL=http://127.0.0.1:8000/health ./scripts/restart-api-if-unhealthy.sh
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL="${API_HEALTH_URL:-http://127.0.0.1:8000/health}"
COMPOSE="${DOCKER_COMPOSE:-docker compose}"

if curl -sSf --max-time 15 -o /dev/null "$URL"; then
  exit 0
fi

echo "$(date '+%Y-%m-%dT%H:%M:%S%z') block70: health failed for ${URL}, restarting api..."
cd "$ROOT" && $COMPOSE restart api
echo "$(date '+%Y-%m-%dT%H:%M:%S%z') block70: docker compose restart api exited $?"
