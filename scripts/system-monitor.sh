#!/bin/bash
# system-monitor.sh
# Workflow: system-monitor
# Trigger: every 5 minutes
# Checks: gateway, disk, memory, CPU, snapshot, internet
# On failure: retry once, log, alert
# On healthy: log silently

LOG="/Users/jarvis/.openclaw/logs/system-monitor.log"
SNAPSHOT_DIR="/Users/jarvis/.openclaw/snapshots"
ALERT=0
ALERTS=""

mkdir -p /Users/jarvis/.openclaw/logs

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"; }

# --- Gateway ---
check_gateway() {
  openclaw gateway status 2>&1 | grep -q "loaded"
}
if ! check_gateway; then
  sleep 5
  if ! check_gateway; then
    ALERTS="${ALERTS}\n  🔴 GATEWAY: Not running — run: openclaw gateway start"
    ALERT=1
    log "FAIL gateway"
  fi
fi

# --- Disk ---
DISK_PCT=$(df / | awk 'NR==2 {gsub(/%/,""); print $5}')
if [ "$DISK_PCT" -ge 85 ]; then
  ALERTS="${ALERTS}\n  ⚠️  DISK: ${DISK_PCT}% used (threshold 85%)"
  ALERT=1
  log "FAIL disk=${DISK_PCT}%"
fi

# --- Memory ---
MEM_INFO=$(vm_stat)
PAGE_SIZE=16384
TOTAL_MEM=$(sysctl -n hw.memsize)
PAGES_ACTIVE=$(echo "$MEM_INFO" | awk '/Pages active/ {gsub(/\./,"",$3); print $3}')
PAGES_WIRED=$(echo "$MEM_INFO" | awk '/Pages wired/ {gsub(/\./,"",$4); print $4}')
PAGES_COMPRESSED=$(echo "$MEM_INFO" | awk '/Pages occupied by compressor/ {gsub(/\./,"",$5); print $5}')
USED_MEM=$(( (PAGES_ACTIVE + PAGES_WIRED + PAGES_COMPRESSED) * PAGE_SIZE ))
MEM_PCT=$(( USED_MEM * 100 / TOTAL_MEM ))
if [ "$MEM_PCT" -ge 85 ]; then
  ALERTS="${ALERTS}\n  ⚠️  MEMORY: ${MEM_PCT}% used (threshold 85%)"
  ALERT=1
  log "FAIL memory=${MEM_PCT}%"
fi

# --- CPU ---
CPU_LOAD=$(sysctl -n vm.loadavg | awk '{print $2}')
CPU_CORES=$(sysctl -n hw.logicalcpu)
CPU_LOAD_INT=$(echo "$CPU_LOAD" | cut -d. -f1)
if [ "$CPU_LOAD_INT" -ge "$CPU_CORES" ]; then
  ALERTS="${ALERTS}\n  ⚠️  CPU: load avg ${CPU_LOAD} >= ${CPU_CORES} cores"
  ALERT=1
  log "FAIL cpu_load=${CPU_LOAD}"
fi

# --- Snapshot (within last 25 hours) ---
LATEST_SNAP=$(ls -td "$SNAPSHOT_DIR"/snapshot-* 2>/dev/null | head -1)
if [ -z "$LATEST_SNAP" ]; then
  ALERTS="${ALERTS}\n  ⚠️  SNAPSHOT: No snapshots found"
  ALERT=1
  log "FAIL snapshot=missing"
else
  SNAP_AGE=$(( $(date +%s) - $(stat -f %m "$LATEST_SNAP") ))
  if [ "$SNAP_AGE" -gt 90000 ]; then
    ALERTS="${ALERTS}\n  ⚠️  SNAPSHOT: Last snapshot is >25h old"
    ALERT=1
    log "FAIL snapshot=stale"
  fi
fi

# --- Internet Connectivity ---
check_internet() {
  curl -sf --max-time 5 https://1.1.1.1 > /dev/null 2>&1 || \
  curl -sf --max-time 5 https://8.8.8.8 > /dev/null 2>&1
}
if ! check_internet; then
  sleep 10
  if ! check_internet; then
    ALERTS="${ALERTS}\n  🔴 INTERNET: No connectivity detected"
    ALERT=1
    log "FAIL internet=unreachable"
  fi
fi

# --- Output ---
if [ "$ALERT" -eq 0 ]; then
  log "OK disk=${DISK_PCT}% mem=${MEM_PCT}% cpu=${CPU_LOAD} snap=ok gateway=ok internet=ok"
  echo "MONITOR_OK"
else
  log "ALERT:${ALERTS}"
  printf "[SYSTEM ALERT - $(date)]\n${ALERTS}\n"
fi
