#!/usr/bin/env bash
# accumulate-history.sh
# Copies data/latest.json → data/history/YYYY-MM-DD-HHMM.json
# Prunes history files older than 14 days
# Run after every social monitor save

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$REPO_ROOT/data"
HISTORY_DIR="$DATA_DIR/history"
SOURCE_FILE="$DATA_DIR/latest.json"

# Ensure history directory exists
mkdir -p "$HISTORY_DIR"

# Require source file
if [ ! -f "$SOURCE_FILE" ]; then
  echo "[accumulate-history] ERROR: $SOURCE_FILE not found — skipping" >&2
  exit 1
fi

# Timestamp: YYYY-MM-DD-HHMM in local time
TIMESTAMP="$(date '+%Y-%m-%d-%H%M')"
DEST_FILE="$HISTORY_DIR/${TIMESTAMP}.json"

cp "$SOURCE_FILE" "$DEST_FILE"
echo "[accumulate-history] Saved: $DEST_FILE"

# Prune files older than 14 days
find "$HISTORY_DIR" -name "*.json" -type f -mtime +14 -print -delete | while read -r f; do
  echo "[accumulate-history] Pruned: $f"
done

echo "[accumulate-history] Done. History files: $(ls "$HISTORY_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')"
