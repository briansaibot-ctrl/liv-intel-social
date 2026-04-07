#!/usr/bin/env python3
"""
nova-files — File operations agent
Nova AI Operating System
Handles: read, write, list, organize, search files
"""

import json
import sys
import os
import shutil
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from shared.utils import utcnow

LOG_PATH = Path("/Users/jarvis/.openclaw/logs/nova-files.log")
WORKSPACE = Path("/Users/jarvis/.openclaw/workspace")
LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

def log(entry: dict):
    with open(LOG_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")

def action_list(message: str) -> dict:
    """List workspace files."""
    target = WORKSPACE
    # Check if a subdirectory is mentioned
    for part in message.split():
        candidate = WORKSPACE / part
        if candidate.is_dir():
            target = candidate
            break
    files = []
    for p in sorted(target.rglob("*"))[:50]:
        if p.is_file() and ".git" not in str(p) and "__pycache__" not in str(p):
            files.append(str(p.relative_to(WORKSPACE)))
    return {"action": "list_files", "result": "\n".join(files) or "No files found.", "status": "ok"}

def action_read(message: str) -> dict:
    """Read a file from workspace."""
    words = message.split()
    for word in words:
        candidate = WORKSPACE / word
        if candidate.is_file():
            content = candidate.read_text()[:3000]
            return {"action": "read_file", "result": content, "status": "ok"}
    return {"action": "read_file", "result": "File not found. Specify a path relative to workspace.", "status": "warn"}

def action_search(message: str) -> dict:
    """Search for a term in workspace files."""
    query = message.lower()
    for prefix in ["search for", "search", "find", "grep"]:
        if query.startswith(prefix):
            query = query[len(prefix):].strip()
            break
    matches = []
    for p in WORKSPACE.rglob("*"):
        if p.is_file() and ".git" not in str(p) and "__pycache__" not in str(p):
            try:
                if query in p.read_text().lower():
                    matches.append(str(p.relative_to(WORKSPACE)))
            except Exception:
                pass
    result = "\n".join(matches[:20]) if matches else f"No files containing '{query}'."
    return {"action": "search_files", "result": result, "status": "ok"}

def action_organize(message: str) -> dict:
    """Report workspace structure."""
    dirs = sorted(set(str(p.parent.relative_to(WORKSPACE)) for p in WORKSPACE.rglob("*") if p.is_file() and ".git" not in str(p)))
    return {"action": "organize", "result": "Workspace directories:\n" + "\n".join(dirs[:30]), "status": "ok"}

ACTION_MAP = [
    (["list", "show files", "what files"],              action_list),
    (["read", "open", "view", "cat"],                   action_read),
    (["search", "find", "grep", "contains"],            action_search),
    (["organize", "structure", "tree", "directory"],    action_organize),
]

def dispatch(message: str) -> dict:
    msg = message.lower()
    for keywords, handler in ACTION_MAP:
        if any(kw in msg for kw in keywords):
            return handler(message)
    return action_list(message)

def handle(input_data: dict) -> dict:
    message = input_data.get("payload", {}).get("message", "") or input_data.get("message", "")
    result = dispatch(message)
    output = {"agent": "nova-files", "action": result["action"], "result": result["result"], "status": result["status"], "timestamp": utcnow()}
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
