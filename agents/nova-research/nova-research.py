#!/usr/bin/env python3
"""
nova-research — Web research and data lookup agent
Nova AI Operating System
"""

import json
import sys
import subprocess
import shlex
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from shared.utils import get_cached, save_cache, utcnow

LOG_PATH = Path("/Users/jarvis/.openclaw/logs/nova-research.log")
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

def action_search(message: str) -> dict:
    # Extract query — strip common prefixes
    query = message
    for prefix in ["search for", "search", "find", "look up", "lookup", "what is", "who is", "research"]:
        if query.lower().startswith(prefix):
            query = query[len(prefix):].strip()
            break

    cached = get_cached(f"search:{query}")
    if cached:
        return {"action": "web_search", "result": cached, "status": "ok", "source": "cache"}

    # Use openclaw web search via agent call
    r = run_cmd(f"openclaw agent --agent main -m 'Search the web for: {query}. Return a concise summary.'", timeout=45)
    result = r["stdout"] or r["stderr"] or "No results returned."
    save_cache(f"search:{query}", result)
    return {"action": "web_search", "result": result, "status": "ok" if r["returncode"] == 0 else "warn"}

def action_lookup(message: str) -> dict:
    return action_search(message)

ACTION_MAP = [
    (["search", "find", "look up", "lookup"], action_search),
    (["what is", "who is", "how does", "explain"], action_lookup),
    (["news", "latest", "current", "recent"], action_search),
]

def dispatch(message: str) -> dict:
    msg = message.lower()
    for keywords, handler in ACTION_MAP:
        if any(kw in msg for kw in keywords):
            return handler(message)
    return action_search(message)

def handle(input_data: dict) -> dict:
    message = input_data.get("payload", {}).get("message", "") or input_data.get("message", "")
    result = dispatch(message)
    output = {"agent": "nova-research", "action": result["action"], "result": result["result"], "status": result["status"], "timestamp": utcnow()}
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
