#!/usr/bin/env bash
# Run on the n8n Ubuntu host (SSH as jmiller). Imports the two Wave 1 JSON files
# from git: error-logger + pilot. Does NOT create crypto-data-collector or api-scheduler
# (those are built in the UI then exported).
#
# Usage:
#   chmod +x wave1-import-on-host.sh
#   ./wave1-import-on-host.sh
#   N8N_CONTAINER=my-n8n ./wave1-import-on-host.sh
#
# WARNING: Running import multiple times may create duplicate workflows in n8n.
# Delete duplicates in the UI or keep one copy per logical workflow.

set -euo pipefail

N8N_CONTAINER="${N8N_CONTAINER:-n8n}"
W="/home/jmiller/n8n_workspace/workflows"
FILES=(
  "block70-error-logger.json"
  "block70-pilot-coin-gecko.json"
)

if ! docker ps --format '{{.Names}}' | grep -qx "${N8N_CONTAINER}"; then
  echo "ERROR: Docker container '${N8N_CONTAINER}' is not running."
  echo "Start n8n or set N8N_CONTAINER to the name from: docker ps"
  exit 1
fi

mkdir -p "${W}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_WF="${SCRIPT_DIR}/../workflows"

for f in "${FILES[@]}"; do
  if [[ ! -f "${W}/${f}" && -f "${REPO_WF}/${f}" ]]; then
    echo "Copying ${f} from ${REPO_WF} -> ${W}/"
    cp "${REPO_WF}/${f}" "${W}/"
  fi
done

for f in "${FILES[@]}"; do
  if [[ ! -f "${W}/${f}" ]]; then
    echo "ERROR: Missing ${W}/${f}"
    echo "Copy from the Block70 repo (docs/n8n-local-agents/workflows/) or run wave1-sync-from-pc.ps1 on your PC."
    exit 1
  fi
done

for f in "${FILES[@]}"; do
  echo "=== Importing ${f} ==="
  docker exec -u node "${N8N_CONTAINER}" n8n import:workflow --input="${W}/${f}"
done

echo ""
echo "OK: Imported ${#FILES[@]} workflows from ${W}"
echo "Next: In n8n you should see 'Block70 — Error Logger' and 'Block70 Pilot — CoinGecko to disk' (names may match)."
echo "Wave 1 agents not in git: export crypto-data-collector.json and api-scheduler.json after you build them."
exit 0
