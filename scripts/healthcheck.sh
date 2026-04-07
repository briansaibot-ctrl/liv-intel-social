#!/bin/bash
# Daily system health check
# Checks: disk, memory, CPU, snapshot, services, uptime
# Logs to: /Users/jarvis/.openclaw/logs/healthcheck.log

LOG="/Users/jarvis/.openclaw/logs/healthcheck.log"
SNAPSHOT_DIR="/Users/jarvis/.openclaw/snapshots"
ALERT=0
ALERTS=""

mkdir -p /Users/jarvis/.openclaw/logs

echo "[$(date)] === Health Check Start ===" >> "$LOG"

# --- Disk Usage ---
DISK_PCT=$(df / | awk 'NR==2 {gsub(/%/,""); print $5}')
echo "  Disk usage: ${DISK_PCT}%" >> "$LOG"
if [ "$DISK_PCT" -ge 85 ]; then
  ALERTS="${ALERTS}\n  ⚠️  DISK: ${DISK_PCT}% used (threshold: 85%) — free up space"
  ALERT=1
fi

# --- Memory Usage ---
MEM_INFO=$(vm_stat)
PAGES_FREE=$(echo "$MEM_INFO" | awk '/Pages free/ {gsub(/\./,"",$3); print $3}')
PAGES_ACTIVE=$(echo "$MEM_INFO" | awk '/Pages active/ {gsub(/\./,"",$3); print $3}')
PAGES_WIRED=$(echo "$MEM_INFO" | awk '/Pages wired/ {gsub(/\./,"",$4); print $4}')
PAGES_COMPRESSED=$(echo "$MEM_INFO" | awk '/Pages occupied by compressor/ {gsub(/\./,"",$5); print $5}')
PAGE_SIZE=16384
TOTAL_MEM=$(sysctl -n hw.memsize)
USED_MEM=$(( (PAGES_ACTIVE + PAGES_WIRED + PAGES_COMPRESSED) * PAGE_SIZE ))
MEM_PCT=$(( USED_MEM * 100 / TOTAL_MEM ))
echo "  Memory usage: ${MEM_PCT}%" >> "$LOG"
if [ "$MEM_PCT" -ge 85 ]; then
  ALERTS="${ALERTS}\n  ⚠️  MEMORY: ${MEM_PCT}% used (threshold: 85%) — check for runaway processes"
  ALERT=1
fi

# --- CPU Load ---
CPU_LOAD=$(sysctl -n vm.loadavg | awk '{print $2}')
CPU_CORES=$(sysctl -n hw.logicalcpu)
CPU_LOAD_INT=$(echo "$CPU_LOAD" | cut -d. -f1)
echo "  CPU load avg (1m): ${CPU_LOAD} (${CPU_CORES} cores)" >> "$LOG"
if [ "$CPU_LOAD_INT" -ge "$CPU_CORES" ]; then
  ALERTS="${ALERTS}\n  ⚠️  CPU: load avg ${CPU_LOAD} exceeds core count ${CPU_CORES} — investigate high-load processes"
  ALERT=1
fi

# --- Snapshot Success ---
TODAY=$(date +"%Y-%m-%d")
YESTERDAY=$(date -v-1d +"%Y-%m-%d")
if [ -d "$SNAPSHOT_DIR/snapshot-$TODAY" ] || [ -d "$SNAPSHOT_DIR/snapshot-$YESTERDAY" ]; then
  LATEST=$(ls -td "$SNAPSHOT_DIR"/snapshot-* 2>/dev/null | head -1 | xargs basename)
  echo "  Snapshot: OK ($LATEST)" >> "$LOG"
else
  ALERTS="${ALERTS}\n  ⚠️  SNAPSHOT: No recent snapshot found — check nova:daily-snapshot cron job"
  ALERT=1
  echo "  Snapshot: MISSING" >> "$LOG"
fi

# --- Service Status: OpenClaw Gateway ---
GW_STATUS=$(openclaw gateway status 2>&1 | head -1)
if echo "$GW_STATUS" | grep -q "loaded"; then
  echo "  OpenClaw gateway: running (LaunchAgent loaded)" >> "$LOG"
else
  ALERTS="${ALERTS}\n  🔴  SERVICE: OpenClaw gateway not running — restart with: openclaw gateway start"
  ALERT=1
  echo "  OpenClaw gateway: NOT RUNNING" >> "$LOG"
fi

# --- System Uptime ---
UPTIME=$(uptime | sed 's/.*up //' | sed 's/,.*//')
echo "  Uptime: $UPTIME" >> "$LOG"

# --- Summary ---
if [ "$ALERT" -eq 0 ]; then
  echo "[$(date)] ✅ All checks passed." >> "$LOG"
  echo "HEALTH_OK"
else
  echo "[$(date)] ⚠️  Issues detected:${ALERTS}" >> "$LOG"
  printf "\n[HEALTH ALERT - $(date)]\n${ALERTS}\n\nUptime: ${UPTIME}\nLog: ${LOG}\n"
fi

echo "[$(date)] === Health Check End ===" >> "$LOG"
