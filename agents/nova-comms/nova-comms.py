#!/usr/bin/env python3
"""
nova-comms — Communications agent
Nova AI Operating System
Handles: messaging, notifications, follow-ups
"""

import json
import sys
import subprocess
import shlex
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from shared.utils import utcnow

LOG_PATH = Path("/Users/jarvis/.openclaw/logs/nova-comms.log")
LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

def log(entry: dict):
    with open(LOG_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")

def run_cmd(cmd: str, timeout: int = 30) -> dict:
    try:
        result = subprocess.run(shlex.split(cmd), capture_output=True, text=True, timeout=timeout)
        return {"stdout": result.stdout.strip(), "stderr": result.stderr.strip(), "returncode": result.returncode}
    except Exception as e:
        return {"stdout": "", "stderr": str(e), "returncode": -1}

def action_notify(message: str) -> dict:
    """Send a notification via OpenClaw."""
    r = run_cmd(f"openclaw agent --agent main -m 'Notification from nova-comms: {message}'", timeout=30)
    return {"action": "notify", "result": r["stdout"] or "Notification queued.", "status": "ok" if r["returncode"] == 0 else "warn"}

def action_draft(message: str) -> dict:
    """Draft a message — log it for review before sending."""
    draft_path = Path("/Users/jarvis/.openclaw/workspace/drafts")
    draft_path.mkdir(parents=True, exist_ok=True)
    filename = draft_path / f"draft-{utcnow()[:10]}.txt"
    with open(filename, "a") as f:
        f.write(f"[{utcnow()}]\n{message}\n\n")
    return {"action": "draft", "result": f"Draft saved to {filename.name} — review before sending.", "status": "ok"}

def action_status(message: str) -> dict:
    draft_path = Path("/Users/jarvis/.openclaw/workspace/drafts")
    drafts = list(draft_path.glob("*.txt")) if draft_path.exists() else []
    result = f"{len(drafts)} draft(s) pending review." if drafts else "No pending drafts."
    return {"action": "comms_status", "result": result, "status": "ok"}

ACTION_MAP = [
    (["send", "message", "notify", "alert", "text"],    action_notify),
    (["draft", "compose", "write", "prepare"],          action_draft),
    (["status", "pending", "drafts"],                   action_status),
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
    output = {"agent": "nova-comms", "action": result["action"], "result": result["result"], "status": result["status"], "timestamp": utcnow()}
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
