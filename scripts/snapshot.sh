#!/bin/bash
# Daily configuration snapshot
# Scope: OpenClaw config, workflows, system settings, logs, credentials metadata
# Retention: last 7 snapshots
# Location: /Users/jarvis/.openclaw/snapshots/

SNAPSHOT_DIR="/Users/jarvis/.openclaw/snapshots"
TIMESTAMP=$(date +"%Y-%m-%d")
TARGET="$SNAPSHOT_DIR/snapshot-$TIMESTAMP"
LOG="$SNAPSHOT_DIR/snapshot.log"

echo "[$(date)] Starting snapshot: $TARGET" >> "$LOG"

mkdir -p "$TARGET"

# OpenClaw config
cp /Users/jarvis/.openclaw/openclaw.json "$TARGET/" 2>/dev/null && echo "  [OK] openclaw.json" >> "$LOG"
cp /Users/jarvis/.openclaw/openclaw.json.bak "$TARGET/openclaw.json.bak" 2>/dev/null

# Workspace files (config, workflows, principles — no secrets)
rsync -a --exclude='*.key' --exclude='*.pem' --exclude='*.token' \
  /Users/jarvis/.openclaw/workspace/ "$TARGET/workspace/" 2>/dev/null && echo "  [OK] workspace" >> "$LOG"

# Credentials metadata (filenames/structure only, not contents)
find /Users/jarvis/.openclaw/credentials -type f 2>/dev/null \
  | sed 's|/Users/jarvis/.openclaw/credentials/||' \
  > "$TARGET/credentials-manifest.txt" && echo "  [OK] credentials manifest" >> "$LOG"

# Logs
if [ -d /Users/jarvis/.openclaw/logs ]; then
  rsync -a /Users/jarvis/.openclaw/logs/ "$TARGET/logs/" 2>/dev/null && echo "  [OK] logs" >> "$LOG"
else
  echo "  [SKIP] no logs directory" >> "$LOG"
fi

echo "[$(date)] Snapshot complete: $TARGET" >> "$LOG"

# Retention: keep last 7 snapshots
cd "$SNAPSHOT_DIR" || exit 1
SNAPSHOTS=$(ls -d snapshot-* 2>/dev/null | sort)
COUNT=$(echo "$SNAPSHOTS" | wc -l | tr -d ' ')

if [ "$COUNT" -gt 7 ]; then
  TO_DELETE=$(echo "$SNAPSHOTS" | head -n $(( COUNT - 7 )))
  for DIR in $TO_DELETE; do
    rm -rf "$SNAPSHOT_DIR/$DIR"
    echo "[$(date)] Removed old snapshot: $DIR" >> "$LOG"
  done
fi

echo "[$(date)] Retention enforced. Active snapshots: $(ls -d $SNAPSHOT_DIR/snapshot-* 2>/dev/null | wc -l | tr -d ' ')" >> "$LOG"
