#!/usr/bin/env python3
"""
nova-code — Code generation and script execution agent
Nova AI Operating System
Handles: scripts, debugging, builds, automation code
"""

import json
import sys
import subprocess
import shlex
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from shared.utils import get_cached, save_cache, utcnow

LOG_PATH = Path("/Users/jarvis/.openclaw/logs/nova-code.log")
WORKSPACE = Path("/Users/jarvis/.openclaw/workspace")
SCRIPTS_DIR = WORKSPACE / "scripts"
LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

def log(entry: dict):
    with open(LOG_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")

def run_cmd(cmd: str, timeout: int = 60) -> dict:
    try:
        result = subprocess.run(shlex.split(cmd), capture_output=True, text=True, timeout=timeout)
        return {"stdout": result.stdout.strip(), "stderr": result.stderr.strip(), "returncode": result.returncode}
    except subprocess.TimeoutExpired:
        return {"stdout": "", "stderr": "timeout", "returncode": -1}
    except Exception as e:
        return {"stdout": "", "stderr": str(e), "returncode": -1}

def action_list_scripts(message: str) -> dict:
    scripts = sorted(SCRIPTS_DIR.glob("*.sh")) + sorted(SCRIPTS_DIR.glob("*.py"))
    result = "\n".join(s.name for s in scripts) if scripts else "No scripts found."
    return {"action": "list_scripts", "result": result, "status": "ok"}

def action_run_script(message: str) -> dict:
    """Run a named script from the scripts directory."""
    msg = message.lower()
    for script in SCRIPTS_DIR.glob("*"):
        if script.stem.replace("-", " ") in msg or script.name in msg:
            if script.suffix == ".py":
                r = run_cmd(f"python3 {script}", timeout=60)
            else:
                r = run_cmd(f"bash {script}", timeout=60)
            status = "ok" if r["returncode"] == 0 else "error"
            return {"action": "run_script", "result": r["stdout"] or r["stderr"], "status": status}
    return {"action": "run_script", "result": "Script not found. Use 'list scripts' to see available scripts.", "status": "warn"}

def action_debug(message: str) -> dict:
    """Check recent error logs."""
    log_dir = Path("/Users/jarvis/.openclaw/logs")
    errors = []
    for log_file in log_dir.glob("*.log"):
        try:
            lines = log_file.read_text().splitlines()
            for line in lines[-100:]:
                if any(kw in line.lower() for kw in ["error", "fail", "exception", "traceback"]):
                    errors.append(f"{log_file.name}: {line}")
        except Exception:
            pass
    result = "\n".join(errors[-20:]) if errors else "No errors found in recent logs."
    return {"action": "debug", "result": result, "status": "ok"}

def action_status(message: str) -> dict:
    scripts = list(SCRIPTS_DIR.glob("*.sh")) + list(SCRIPTS_DIR.glob("*.py"))
    return {"action": "code_status", "result": f"{len(scripts)} scripts available in {SCRIPTS_DIR}", "status": "ok"}

ACTION_MAP = [
    (["list scripts", "show scripts", "what scripts"],      action_list_scripts),
    (["run", "execute", "launch"],                          action_run_script),
    (["debug", "error", "errors", "logs", "traceback"],     action_debug),
    (["status", "scripts"],                                 action_status),
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
    output = {"agent": "nova-code", "action": result["action"], "result": result["result"], "status": result["status"], "timestamp": utcnow()}
    log(output)
    return output

if __name__ == "__main__":
    raw = sys.stdin.read().strip() if not sys.stdin.isatty() else None
    if raw:
        try: data = json.loads(raw)
        except: data = {"message": raw}
    elif len(sys.argv) > 1:
        data = {"message": " ".join(sys.argv[1:])}
    else:
        print(json.dumps({"error": "No input provided"})); sys.exit(1)
    print(json.dumps(handle(data), indent=2))
