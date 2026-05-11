#!/usr/bin/env bash
# Daily crypto + equity bars ingest. Install via systemd timer (see scripts/market/systemd/).
set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/block70/market-ingest.env}"
REPO_ROOT="${REPO_ROOT:-/home/jmiller/block70-repo}"
LOCK_FILE="${LOCK_FILE:-/tmp/block70-daily-market-bars.lock}"
LOG_DIR="${LOG_DIR:-/var/log/block70}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

REPO_ROOT="${REPO_ROOT:-$HOME/block70-repo}"
mkdir -p "$LOG_DIR"
log="$LOG_DIR/market-bars-daily.log"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "$(date -Is) daily market bars ingest already running; exit" >>"$log"
  exit 0
fi

{
  echo "===== $(date -Is) daily market bars ingest ====="
  cd "$REPO_ROOT"
  python3 scripts/market/daily_market_bars_ingest.py
} >>"$log" 2>&1
