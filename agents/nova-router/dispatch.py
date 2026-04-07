#!/usr/bin/env python3
"""
nova-router dispatch layer
Routes classified intent to the correct downstream agent.
"""

import json
import sys
import subprocess
from pathlib import Path
from datetime import datetime, timezone

AGENTS_DIR = Path("/Users/jarvis/.openclaw/workspace/agents")
LOG_PATH = Path("/Users/jarvis/.openclaw/logs/router-dispatch.log")
LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

AGENT_SCRIPTS = {
    "nova-system":   AGENTS_DIR / "nova-system/nova-system.py",
    "nova-ops":      AGENTS_DIR / "nova-ops/nova-ops.py",
    "nova-research": None,
    "nova-memory":   None,
    "nova-comms":    None,
    "nova-files":    None,
    "nova-code":     None,
    "nova":          None,  # main Nova — handled by OpenClaw directly
}

def utcnow():
    return datetime.now(timezone.utc).isoformat()

def log(entry: dict):
    with open(LOG_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")

def dispatch(route: dict) -> dict:
    target = route.get("target_agent", "nova")
    script = AGENT_SCRIPTS.get(target)

    if script and script.exists():
        try:
            result = subprocess.run(
                ["python3", str(script)],
                input=json.dumps(route),
                capture_output=True, text=True, timeout=60
            )
            output = json.loads(result.stdout) if result.stdout else {"error": result.stderr}
        except Exception as e:
            output = {"error": str(e)}
    else:
        output = {
            "agent": target,
            "status": "unavailable",
            "message": f"Agent '{target}' not yet built — route to nova (main)",
            "original_request": route.get("payload", {}).get("message", "")
        }

    entry = {
        "routed_to": target,
        "intent": route.get("intent"),
        "confidence": route.get("confidence"),
        "result_status": output.get("status", "unknown"),
        "timestamp": utcnow()
    }
    log(entry)
    return output

if __name__ == "__main__":
    raw = sys.stdin.read().strip() if not sys.stdin.isatty() else None
    if raw:
        try:
            route = json.loads(raw)
        except json.JSONDecodeError:
            print(json.dumps({"error": "Invalid JSON input"}))
            sys.exit(1)
    elif len(sys.argv) > 1:
        # Accept plain message and run full router → dispatch pipeline
        from router import route as classify
        route = classify({"user": "Brian", "message": " ".join(sys.argv[1:])})
    else:
        print(json.dumps({"error": "No input provided"}))
        sys.exit(1)

    result = dispatch(route)
    print(json.dumps(result, indent=2))
