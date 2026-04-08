#!/bin/bash
# linkedin-workflow.sh
# Weekly LinkedIn content workflow for Brian Altmann
# Runs: Mondays 9:00 AM PT
# Posts: Tuesday-Saturday only, 8-11 AM or 5-7 PM PT

set -e

WORKSPACE="/Users/jarvis/.openclaw/workspace"
LOG_FILE="$WORKSPACE/nova_linkedin_log.txt"
SCRIPT_DIR="$WORKSPACE/scripts"
PYTHON_SCRIPT="$WORKSPACE/agents/nova-linkedin/linkedin-agent.py"

# Verify it's Monday 9 AM or being run manually
DAY=$(date +%A)
HOUR=$(date +%H)

if [ "$1" != "--force" ] && [ "$DAY" != "Monday" ]; then
  echo "Not Monday. Use --force to run manually."
  exit 0
fi

if [ "$1" != "--force" ] && [ "$HOUR" != "09" ]; then
  echo "Not 9 AM. Use --force to run manually."
  exit 0
fi

echo "[$(date)] Starting LinkedIn workflow..."

# Run the Python agent
python3 "$PYTHON_SCRIPT" --log "$LOG_FILE"

exit $?
