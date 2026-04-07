#!/usr/bin/env python3
"""
nova-system — System operations agent
Nova AI Operating System
Handles: health, monitoring, security, snapshots, config
"""

import json
import sys
import subprocess
import shlex
from datetime import datetime, timezone
from pathlib import Path

LOG_PATH = Path("/Users/jarvis/.openclaw/logs/nova-system.log")
WORKSPACE = Path("/Users/jarvis/.openclaw/workspace")
LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

def utcnow():
    return datetime.now(timezone.utc).isoformat()

def log(entry: dict):
    with open(LOG_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")

def run_cmd(cmd: str, timeout: int = 30) -> dict:
    try:
        result = subprocess.run(
            shlex.split(cmd),
            capture_output=True, text=True, timeout=timeout
        )
        return {
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
            "returncode": result.returncode
        }
    except subprocess.TimeoutExpired:
        return {"stdout": "", "stderr": "timeout", "returncode": -1}
    except Exception as e:
        return {"stdout": "", "stderr": str(e), "returncode": -1}

def run_script(script: str) -> dict:
    return run_cmd(f"bash {WORKSPACE}/scripts/{script}", timeout=60)

# --- Action handlers ---

def action_health(message: str) -> dict:
    r = run_script("healthcheck.sh")
    status = "ok" if "HEALTH_OK" in r["stdout"] else "warn"
    return {"action": "health_check", "result": r["stdout"] or r["stderr"], "status": status}

def action_monitor(message: str) -> dict:
    r = run_script("system-monitor.sh")
    status = "ok" if "MONITOR_OK" in r["stdout"] else "warn"
    return {"action": "system_monitor", "result": r["stdout"] or r["stderr"], "status": status}

def action_snapshot(message: str) -> dict:
    r = run_script("snapshot.sh")
    status = "ok" if r["returncode"] == 0 else "error"
    return {"action": "snapshot", "result": r["stdout"] or r["stderr"], "status": status}

def action_security(message: str) -> dict:
    r = run_cmd("openclaw security audit --deep", timeout=30)
    status = "ok" if "0 critical" in r["stdout"] else "warn"
    return {"action": "security_audit", "result": r["stdout"] or r["stderr"], "status": status}

def action_report(message: str) -> dict:
    r = run_script("daily-ops-report.sh")
    status = "ok" if r["returncode"] == 0 else "error"
    return {"action": "ops_report", "result": r["stdout"] or r["stderr"], "status": status}

def action_status(message: str) -> dict:
    disk = run_cmd("df -h /")
    mem = run_cmd("vm_stat")
    cpu = run_cmd("sysctl vm.loadavg")
    gw = run_cmd("openclaw gateway status")
    uptime = run_cmd("uptime")
    result = (
        f"DISK:\n{disk['stdout']}\n\n"
        f"CPU: {cpu['stdout']}\n\n"
        f"UPTIME: {uptime['stdout']}\n\n"
        f"GATEWAY: {gw['stdout'].splitlines()[0] if gw['stdout'] else 'unknown'}"
    )
    return {"action": "status", "result": result, "status": "ok"}

# --- Intent → action mapping ---
ACTION_MAP = [
    (["health", "healthcheck"],                             action_health),
    (["monitor", "monitoring"],                             action_monitor),
    (["snapshot", "backup"],                                action_snapshot),
    (["security", "audit", "firewall"],                     action_security),
    (["report", "ops report", "daily report"],              action_report),
    (["status", "disk", "memory", "cpu", "uptime", "check"], action_status),
]

def dispatch(message: str) -> dict:
    msg = message.lower()
    for keywords, handler in ACTION_MAP:
        if any(kw in msg for kw in keywords):
            return handler(message)
    # Default: full status
    return action_status(message)

def handle(input_data: dict) -> dict:
    message = input_data.get("payload", {}).get("message", "") or input_data.get("message", "")
    result = dispatch(message)
    output = {
        "agent": "nova-system",
        "action": result["action"],
        "result": result["result"],
        "status": result["status"],
        "timestamp": utcnow()
    }
    log(output)
    return output

if __name__ == "__main__":
    raw = sys.stdin.read().strip() if not sys.stdin.isatty() else None

    if raw:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {"message": raw}
    elif len(sys.argv) > 1:
        data = {"message": " ".join(sys.argv[1:])}
    else:
        print(json.dumps({"error": "No input provided"}))
        sys.exit(1)

    result = handle(data)
    print(json.dumps(result, indent=2))
