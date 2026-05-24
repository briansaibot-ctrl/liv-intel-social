#!/bin/bash
# LIV Talent Refresh — Updates trending artists database
# Runs via cron or manual trigger
# Pulls artist data from Chartmetric, Spotify, and social platforms

set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_FILE="$DIR/data/trending-artists.json"
HISTORY_DIR="$DIR/data/history"

mkdir -p "$HISTORY_DIR"

# Run the Python talent analyzer
python3 "$DIR/scripts/talent-analyzer.py"

# If success, copy to history with timestamp
if [ -f "$OUTPUT_FILE" ]; then
  TIMESTAMP=$(date +%Y-%m-%d)
  cp "$OUTPUT_FILE" "$HISTORY_DIR/trending-artists-$TIMESTAMP.json"
  echo "✓ Talent refresh complete: $OUTPUT_FILE"
  
  # Git push if in a repo
  if [ -d "$DIR/.git" ]; then
    cd "$DIR"
    git add data/trending-artists.json "$HISTORY_DIR/trending-artists-$TIMESTAMP.json" 2>/dev/null || true
    git commit -m "talent: refresh trending artists $(date '+%Y-%m-%d %H:%M')" --quiet 2>/dev/null || true
    git push origin main --quiet 2>/dev/null || true
  fi
else
  echo "✗ Talent refresh failed: no output file generated"
  exit 1
fi
