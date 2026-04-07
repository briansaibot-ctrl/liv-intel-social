#!/bin/bash
# system-monitor.sh
# Workflow: system-monitor
# Trigger: every 5 minutes
# Checks: gateway, disk, memory, CPU, snapshot, internet
# Alert logic: 2 consecutive failures before alerting; recovery notification on clear
# State: /Users/jarvis/.openclaw/logs/monitor-state.json

LOG="/Users/jarvis/.openclaw/logs/system-monitor.log"
STATE="/Users/jarvis/.openclaw/logs/monitor-state.json"
SNAPSHOT_DIR="/Users/jarvis/.openclaw/snapshots"

mkdir -p /Users/jarvis/.openclaw/logs

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"; }

# --- State helpers ---
# State JSON structure:
# { "failures": { "gateway": 0, ... }, "alerting": { "gateway": false, ... } }

get_failures() {
  local key="$1"
  python3 -c "import json,sys; d=json.load(open('$STATE')); print(d.get('failures',{}).get('$key',0))" 2>/dev/null || echo 0
}

get_alerting() {
  local key="$1"
  python3 -c "import json,sys; d=json.load(open('$STATE')); print(d.get('alerting',{}).get('$key','false'))" 2>/dev/null || echo "false"
}

update_state() {
  local failures_json="$1"
  local alerting_json="$2"
  python3 -c "
import json
try:
    d = json.load(open('$STATE'))
except:
    d = {'failures': {}, 'alerting': {}}
d['failures'].update($failures_json)
d['alerting'].update($alerting_json)
json.dump(d, open('$STATE','w'))
" 2>/dev/null
}

# Initialize state file if missing
[ -f "$STATE" ] || echo '{"failures":{},"alerting":{}}' > "$STATE"

ALERTS=""
RECOVERIES=""

# --- Check function ---
# Usage: run_check <key> <0=ok|1=fail> <alert_msg> <recovery_msg>
run_check() {
  local key="$1"
  local failed="$2"
  local alert_msg="$3"
  local recovery_msg="$4"

  local prev_failures=$(get_failures "$key")
  local was_alerting=$(get_alerting "$key")

  if [ "$failed" -eq 1 ]; then
    local new_failures=$(( prev_failures + 1 ))
    update_state "{\"$key\": $new_failures}" "{}"
    log "FAIL[$new_failures] $key"

    if [ "$new_failures" -ge 2 ] && [ "$was_alerting" = "false" ]; then
      ALERTS="${ALERTS}\n  ${alert_msg}"
      update_state "{}" "{\"$key\": true}"
      log "ALERT $key"
    fi
  else
    if [ "$was_alerting" = "true" ]; then
      RECOVERIES="${RECOVERIES}\n  ${recovery_msg}"
      log "RECOVERY $key"
    fi
    update_state "{\"$key\": 0}" "{\"$key\": false}"
  fi
}

# --- Gateway ---
GW_OK=0
openclaw gateway status 2>&1 | grep -q "loaded" && GW_OK=1
run_check "gateway" $(( 1 - GW_OK )) \
  "🔴 GATEWAY: Not running — run: openclaw gateway start" \
  "✅ GATEWAY: Recovered — service running"

# --- Disk ---
DISK_PCT=$(df / | awk 'NR==2 {gsub(/%/,""); print $5}')
DISK_FAIL=0; [ "$DISK_PCT" -ge 85 ] && DISK_FAIL=1
run_check "disk" "$DISK_FAIL" \
  "⚠️  DISK: ${DISK_PCT}% used (threshold 85%)" \
  "✅ DISK: Recovered — ${DISK_PCT}% used"

# --- Memory ---
PAGE_SIZE=16384
TOTAL_MEM=$(sysctl -n hw.memsize)
MEM_INFO=$(vm_stat)
PAGES_ACTIVE=$(echo "$MEM_INFO" | awk '/Pages active/ {gsub(/\./,"",$3); print $3}')
PAGES_WIRED=$(echo "$MEM_INFO" | awk '/Pages wired/ {gsub(/\./,"",$4); print $4}')
PAGES_COMPRESSED=$(echo "$MEM_INFO" | awk '/Pages occupied by compressor/ {gsub(/\./,"",$5); print $5}')
USED_MEM=$(( (PAGES_ACTIVE + PAGES_WIRED + PAGES_COMPRESSED) * PAGE_SIZE ))
MEM_PCT=$(( USED_MEM * 100 / TOTAL_MEM ))
MEM_FAIL=0; [ "$MEM_PCT" -ge 85 ] && MEM_FAIL=1
run_check "memory" "$MEM_FAIL" \
  "⚠️  MEMORY: ${MEM_PCT}% used (threshold 85%)" \
  "✅ MEMORY: Recovered — ${MEM_PCT}% used"

# --- CPU ---
CPU_LOAD=$(sysctl -n vm.loadavg | awk '{print $2}')
CPU_CORES=$(sysctl -n hw.logicalcpu)
CPU_LOAD_INT=$(echo "$CPU_LOAD" | cut -d. -f1)
CPU_FAIL=0; [ "$CPU_LOAD_INT" -ge "$CPU_CORES" ] && CPU_FAIL=1
run_check "cpu" "$CPU_FAIL" \
  "⚠️  CPU: load avg ${CPU_LOAD} >= ${CPU_CORES} cores" \
  "✅ CPU: Recovered — load avg ${CPU_LOAD}"

# --- Snapshot ---
SNAP_FAIL=0
LATEST_SNAP=$(ls -td "$SNAPSHOT_DIR"/snapshot-* 2>/dev/null | head -1)
if [ -z "$LATEST_SNAP" ]; then
  SNAP_FAIL=1
else
  SNAP_AGE=$(( $(date +%s) - $(stat -f %m "$LATEST_SNAP") ))
  [ "$SNAP_AGE" -gt 90000 ] && SNAP_FAIL=1
fi
run_check "snapshot" "$SNAP_FAIL" \
  "⚠️  SNAPSHOT: No recent snapshot (>25h old)" \
  "✅ SNAPSHOT: Recovered — recent snapshot present"

# --- Internet ---
NET_OK=0
curl -sf --max-time 5 https://1.1.1.1 > /dev/null 2>&1 && NET_OK=1
run_check "internet" $(( 1 - NET_OK )) \
  "🔴 INTERNET: No connectivity detected" \
  "✅ INTERNET: Recovered — connectivity restored"

# --- Output ---
if [ -z "$ALERTS" ] && [ -z "$RECOVERIES" ]; then
  log "OK disk=${DISK_PCT}% mem=${MEM_PCT}% cpu=${CPU_LOAD} gateway=ok snap=ok internet=ok"
  echo "MONITOR_OK"
else
  [ -n "$ALERTS" ]     && printf "[SYSTEM ALERT - $(date)]\n${ALERTS}\n"
  [ -n "$RECOVERIES" ] && printf "[SYSTEM RECOVERY - $(date)]\n${RECOVERIES}\n"
fi
