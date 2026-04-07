#!/bin/bash
# system-monitor-runner.sh
# Runs system-monitor.sh and only triggers an agent alert if issues detected.
# Zero token cost on healthy runs.

SCRIPT="/Users/jarvis/.openclaw/workspace/scripts/system-monitor.sh"
LOG="/Users/jarvis/.openclaw/logs/system-monitor-runner.log"

OUTPUT=$(bash "$SCRIPT" 2>&1)
EXIT_CODE=$?

if echo "$OUTPUT" | grep -q "MONITOR_OK"; then
  # Healthy — log silently, no agent call
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] MONITOR_OK" >> "$LOG"
else
  # Alert or recovery — log and notify via openclaw
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ALERT: $OUTPUT" >> "$LOG"
  /opt/homebrew/bin/openclaw agent --agent main -m "SYSTEM MONITOR ALERT: $OUTPUT" 2>/dev/null || true
fi
