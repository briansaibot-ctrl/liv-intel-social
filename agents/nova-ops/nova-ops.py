#!/usr/bin/env python3
"""
nova-ops — Operations and automation agent
Nova AI Operating System
Handles: workflows, scheduling, cron jobs, task execution
"""

import json
import sys
import subprocess
import shlex
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from shared.utils import safe_request, build_queue, run_queue, get_cached, save_cache, utcnow

LOG_PATH = Path("/Users/jarvis/.openclaw/logs/nova-ops.log")
WORKSPACE = Path("/Users/jarvis/.openclaw/workspace")
LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

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

def safe_request(client, max_retries: int = 5, **kwargs):
    """Rate-limit safe API request with exponential backoff."""
    delay = 2
    for attempt in range(max_retries):
        try:
            return client.chat.completions.create(**kwargs)
        except Exception as e:
            if "rate limit" in str(e).lower():
                print(f"Rate limit hit. Retrying in {delay}s... (attempt {attempt + 1})")
                time.sleep(delay)
                delay *= 2
            else:
                raise e
    raise Exception("Max retries exceeded")

def run_script(script: str) -> dict:
    return run_cmd(f"bash {WORKSPACE}/scripts/{script}", timeout=60)

# --- Action handlers ---

def action_list_jobs(message: str) -> dict:
    r = run_cmd("openclaw cron list")
    return {"action": "list_jobs", "result": r["stdout"] or r["stderr"], "status": "ok" if r["returncode"] == 0 else "error"}

def action_run_job(message: str) -> dict:
    """Extract job name from message and trigger it."""
    known_jobs = {
        "snapshot": "nova:daily-snapshot",
        "healthcheck": "nova:daily-healthcheck",
        "health": "nova:daily-healthcheck",
        "report": "nova:daily-ops-report",
        "ops report": "nova:daily-ops-report",
    }
    msg = message.lower()
    job_name = next((v for k, v in known_jobs.items() if k in msg), None)
    if not job_name:
        return {"action": "run_job", "result": "No matching job found. Specify: snapshot, healthcheck, or report.", "status": "warn"}
    r = run_cmd(f"openclaw cron run {job_name}")
    return {"action": "run_job", "result": r["stdout"] or r["stderr"], "status": "ok" if r["returncode"] == 0 else "error"}

def action_status(message: str) -> dict:
    r = run_cmd("openclaw cron list")
    return {"action": "workflow_status", "result": r["stdout"] or r["stderr"], "status": "ok" if r["returncode"] == 0 else "error"}

def action_run_script(message: str) -> dict:
    scripts = {
        "snapshot": "snapshot.sh",
        "healthcheck": "healthcheck.sh",
        "health check": "healthcheck.sh",
        "monitor": "system-monitor.sh",
        "report": "daily-ops-report.sh",
    }
    msg = message.lower()
    script = next((v for k, v in scripts.items() if k in msg), None)
    if not script:
        return {"action": "run_script", "result": "No matching script. Options: snapshot, healthcheck, monitor, report.", "status": "warn"}
    r = run_script(script)
    return {"action": "run_script", "result": r["stdout"] or r["stderr"], "status": "ok" if r["returncode"] == 0 else "error"}

# --- Intent → action mapping ---
ACTION_MAP = [
    (["list", "show jobs", "show workflows", "all jobs"],   action_list_jobs),
    (["run job", "trigger", "fire"],                        action_run_job),
    (["run script", "execute script"],                      action_run_script),
    (["status", "workflow", "schedule", "cron"],            action_status),
]

def dispatch(message: str) -> dict:
    msg = message.lower()
    for keywords, handler in ACTION_MAP:
        if any(kw in msg for kw in keywords):
            return handler(message)
    return action_status(message)

def handle(input_data: dict) -> dict:
    message = input_data.get("payload", {}).get("message", "") or input_data.get("message", "")
    result = dispatch(message)
    output = {
        "agent": "nova-ops",
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
