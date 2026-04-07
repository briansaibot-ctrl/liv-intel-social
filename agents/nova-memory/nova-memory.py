#!/usr/bin/env python3
"""
nova-memory — Context, history, and memory recall agent
Nova AI Operating System
"""

import json
import sys
import re
from pathlib import Path
from datetime import datetime, timezone, timedelta
sys.path.insert(0, str(Path(__file__).parent.parent))
from shared.utils import utcnow

LOG_PATH = Path("/Users/jarvis/.openclaw/logs/nova-memory.log")
WORKSPACE = Path("/Users/jarvis/.openclaw/workspace")
MEMORY_FILE = WORKSPACE / "MEMORY.md"
MEMORY_DIR = WORKSPACE / "memory"
LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

def log(entry: dict):
    with open(LOG_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")

def read_file(path: Path) -> str:
    try:
        return path.read_text() if path.exists() else ""
    except Exception:
        return ""

def action_recall(message: str) -> dict:
    """Search recent memory files for relevant content."""
    today = datetime.now(timezone.utc)
    results = []
    for i in range(7):
        date = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        path = MEMORY_DIR / f"{date}.md"
        content = read_file(path)
        if content:
            results.append(f"[{date}]\n{content}")
    combined = "\n\n".join(results) if results else "No recent memory entries found."
    return {"action": "recall", "result": combined, "status": "ok"}

def action_long_term(message: str) -> dict:
    """Read long-term MEMORY.md."""
    content = read_file(MEMORY_FILE)
    return {"action": "long_term_memory", "result": content or "MEMORY.md is empty.", "status": "ok"}

def action_write(message: str) -> dict:
    """Append a note to today's memory file."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    path = MEMORY_DIR / f"{today}.md"
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    # Extract note content — strip "remember" prefix
    note = message
    for prefix in ["remember", "note", "save", "log", "write"]:
        if note.lower().startswith(prefix):
            note = note[len(prefix):].strip(": ").strip()
            break
    timestamp = datetime.now(timezone.utc).strftime("%H:%M UTC")
    entry = f"\n## {timestamp}\n{note}\n"
    with open(path, "a") as f:
        f.write(entry)
    return {"action": "write_memory", "result": f"Saved to {path.name}: {note[:80]}", "status": "ok"}

def action_router_log(message: str) -> dict:
    """Show recent routing decisions."""
    log_path = Path("/Users/jarvis/.openclaw/logs/router.log")
    if not log_path.exists():
        return {"action": "router_log", "result": "No routing log found.", "status": "warn"}
    lines = log_path.read_text().strip().splitlines()[-20:]
    entries = [json.loads(l) for l in lines if l.strip()]
    summary = "\n".join(f"{e.get('routed_at','')[:19]} | {e.get('intent')} → {e.get('target_agent')} ({e.get('confidence')})" for e in entries)
    return {"action": "router_log", "result": summary, "status": "ok"}

ACTION_MAP = [
    (["remember", "save", "note", "log this", "write this"], action_write),
    (["long term", "memory.md", "permanent"],                action_long_term),
    (["routing", "router log", "routes"],                    action_router_log),
    (["recall", "history", "what did", "last time",
      "yesterday", "previous", "earlier", "context"],        action_recall),
]

def dispatch(message: str) -> dict:
    msg = message.lower()
    for keywords, handler in ACTION_MAP:
        if any(kw in msg for kw in keywords):
            return handler(message)
    return action_recall(message)

def handle(input_data: dict) -> dict:
    message = input_data.get("payload", {}).get("message", "") or input_data.get("message", "")
    result = dispatch(message)
    output = {"agent": "nova-memory", "action": result["action"], "result": result["result"], "status": result["status"], "timestamp": utcnow()}
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
