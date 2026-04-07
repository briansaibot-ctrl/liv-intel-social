#!/bin/bash
# daily-ops-report.sh
# Workflow: daily-operations-report
# Trigger: 9:00 AM PT daily
# Output: structured report for Brian

LOG_DIR="/Users/jarvis/.openclaw/logs"
SNAPSHOT_DIR="/Users/jarvis/.openclaw/snapshots"
MONITOR_LOG="$LOG_DIR/system-monitor.log"
HEALTH_LOG="$LOG_DIR/healthcheck.log"
SNAP_LOG="$LOG_DIR/healthcheck.log"
SINCE=$(date -v-24H '+%Y-%m-%d %H:%M:%S')
NOW=$(date '+%Y-%m-%d %H:%M:%S')

# --- System metrics ---
DISK_PCT=$(df / | awk 'NR==2 {gsub(/%/,""); print $5}')
PAGE_SIZE=16384
TOTAL_MEM=$(sysctl -n hw.memsize)
MEM_INFO=$(vm_stat)
PAGES_ACTIVE=$(echo "$MEM_INFO" | awk '/Pages active/ {gsub(/\./,"",$3); print $3}')
PAGES_WIRED=$(echo "$MEM_INFO" | awk '/Pages wired/ {gsub(/\./,"",$4); print $4}')
PAGES_COMPRESSED=$(echo "$MEM_INFO" | awk '/Pages occupied by compressor/ {gsub(/\./,"",$5); print $5}')
USED_MEM=$(( (PAGES_ACTIVE + PAGES_WIRED + PAGES_COMPRESSED) * PAGE_SIZE ))
MEM_PCT=$(( USED_MEM * 100 / TOTAL_MEM ))
CPU_LOAD=$(sysctl -n vm.loadavg | awk '{print $2}')
CPU_CORES=$(sysctl -n hw.logicalcpu)
UPTIME=$(uptime | sed 's/.*up //' | sed 's/, [0-9]* user.*//')

# --- Gateway ---
GW_STATUS="✅ Running"
openclaw gateway status 2>&1 | grep -q "loaded" || GW_STATUS="🔴 Not running"

# --- Snapshot ---
LATEST_SNAP=$(ls -td "$SNAPSHOT_DIR"/snapshot-* 2>/dev/null | head -1 | xargs basename 2>/dev/null)
SNAP_COUNT=$(ls -d "$SNAPSHOT_DIR"/snapshot-* 2>/dev/null | wc -l | tr -d ' ')
if [ -n "$LATEST_SNAP" ]; then
  SNAP_AGE=$(( $(date +%s) - $(stat -f %m "$SNAPSHOT_DIR/$LATEST_SNAP") ))
  SNAP_HOURS=$(( SNAP_AGE / 3600 ))
  if [ "$SNAP_HOURS" -lt 25 ]; then
    SNAP_STATUS="✅ $LATEST_SNAP (${SNAP_HOURS}h ago)"
  else
    SNAP_STATUS="⚠️  $LATEST_SNAP (${SNAP_HOURS}h ago — stale)"
  fi
else
  SNAP_STATUS="🔴 No snapshots found"
fi

# --- Alerts in last 24h ---
ALERT_COUNT=0
ALERT_SUMMARY="None"
if [ -f "$MONITOR_LOG" ]; then
  ALERTS_RAW=$(grep "ALERT\|FAIL\|RECOVERY" "$MONITOR_LOG" 2>/dev/null | tail -50)
  ALERT_COUNT=$(echo "$ALERTS_RAW" | grep -c "^" 2>/dev/null || echo 0)
  if [ "$ALERT_COUNT" -gt 0 ]; then
    ALERT_SUMMARY=$(echo "$ALERTS_RAW" | tail -5 | sed 's/^/    /')
  else
    ALERT_SUMMARY="None"
    ALERT_COUNT=0
  fi
fi

# --- Resource trend (last 10 OK entries from monitor log) ---
TREND=""
if [ -f "$MONITOR_LOG" ]; then
  TREND=$(grep "^.*OK disk=" "$MONITOR_LOG" | tail -5 | awk '{print "    " $0}')
fi

# --- Recommended actions ---
ACTIONS=""
[ "$DISK_PCT" -ge 75 ]  && ACTIONS="${ACTIONS}\n  - Disk at ${DISK_PCT}% — monitor closely"
[ "$MEM_PCT"  -ge 75 ]  && ACTIONS="${ACTIONS}\n  - Memory at ${MEM_PCT}% — review processes"
[ "$ALERT_COUNT" -gt 5 ] && ACTIONS="${ACTIONS}\n  - ${ALERT_COUNT} alert events in 24h — review monitor log"
FIREWALL_STATE=$(/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null)
echo "$FIREWALL_STATE" | grep -q "enabled" || ACTIONS="${ACTIONS}\n  - macOS firewall still disabled — run: sudo socketfilterfw --setglobalstate on"
[ -z "$ACTIONS" ] && ACTIONS="\n  None"

# --- Report ---
cat <<EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 DAILY OPERATIONS REPORT
$NOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SYSTEM HEALTH
  Gateway:  $GW_STATUS
  Uptime:   $UPTIME
  Disk:     ${DISK_PCT}% used
  Memory:   ${MEM_PCT}% used
  CPU load: ${CPU_LOAD} (${CPU_CORES} cores)

SNAPSHOT STATUS
  Latest:   $SNAP_STATUS
  On disk:  $SNAP_COUNT snapshot(s)

ALERTS (last 24h)
  Count:    $ALERT_COUNT event(s)
$([ "$ALERT_COUNT" -gt 0 ] && echo "$ALERT_SUMMARY" || echo "  None")

RESOURCE TRENDS (last 5 checks)
$([ -n "$TREND" ] && echo "$TREND" || echo "  No data yet")

RECOMMENDED ACTIONS
$(printf "$ACTIONS")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
