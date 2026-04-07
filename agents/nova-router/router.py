#!/usr/bin/env python3
"""
nova-router — Intent classification and routing engine
Nova AI Operating System
"""

import json
import sys
import re
from datetime import datetime, timezone

def utcnow():
    return datetime.now(timezone.utc).isoformat()
from pathlib import Path

LOG_PATH = Path("/Users/jarvis/.openclaw/logs/router.log")
LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

# --- Intent definitions ---
INTENTS = {
    "system": {
        "keywords": ["health", "monitor", "disk", "memory", "cpu", "gateway", "service",
                     "uptime", "snapshot", "backup", "audit", "security", "firewall",
                     "status", "running", "restart", "log"],
        "agent": "nova-system"
    },
    "ops": {
        "keywords": ["workflow", "schedule", "cron", "automate", "automation", "task",
                     "trigger", "job", "pipeline", "run", "execute", "deploy"],
        "agent": "nova-ops"
    },
    "research": {
        "keywords": ["search", "find", "lookup", "what is", "who is", "how does",
                     "research", "web", "news", "price", "compare", "analyze"],
        "agent": "nova-research"
    },
    "memory": {
        "keywords": ["remember", "recall", "history", "context", "what did", "last time",
                     "notes", "memory", "previous", "earlier", "yesterday"],
        "agent": "nova-memory"
    },
    "comms": {
        "keywords": ["email", "message", "send", "notify", "whatsapp", "text", "contact",
                     "reply", "follow up", "reach out", "call"],
        "agent": "nova-comms"
    },
    "files": {
        "keywords": ["file", "folder", "directory", "read", "write", "save", "delete",
                     "organize", "move", "copy", "document", "open"],
        "agent": "nova-files"
    },
    "code": {
        "keywords": ["script", "code", "build", "function", "program", "debug", "fix",
                     "python", "bash", "javascript", "install", "package"],
        "agent": "nova-code"
    },
}

FALLBACK_AGENT = "nova"


def log(entry: dict):
    with open(LOG_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")


def classify(message: str) -> tuple[str, float, str]:
    """Returns (intent, confidence, agent)"""
    msg = message.lower()
    scores = {}

    for intent, config in INTENTS.items():
        hits = sum(1 for kw in config["keywords"] if kw in msg)
        if hits > 0:
            scores[intent] = hits / len(config["keywords"])

    if not scores:
        return "general", 0.0, FALLBACK_AGENT

    best_intent = max(scores, key=scores.get)
    confidence = min(scores[best_intent] * 10, 1.0)  # normalize
    agent = INTENTS[best_intent]["agent"]

    if confidence < 0.6:
        return best_intent, confidence, FALLBACK_AGENT

    return best_intent, confidence, agent


def route(input_data: dict) -> dict:
    message = input_data.get("message", "")
    intent, confidence, target = classify(message)

    result = {
        "intent": intent,
        "confidence": round(confidence, 2),
        "target_agent": target,
        "payload": {
            "user": input_data.get("user", "Brian"),
            "message": message,
            "timestamp": input_data.get("timestamp", utcnow()),
            "context": input_data.get("context", ""),
        },
        "fallback": target == FALLBACK_AGENT and intent == "general",
        "routed_at": utcnow()
    }

    log(result)
    return result


if __name__ == "__main__":
    raw = sys.stdin.read().strip() if not sys.stdin.isatty() else None

    if raw:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            # Plain text input
            data = {
                "user": "Brian",
                "message": raw,
                "timestamp": utcnow()
            }
    elif len(sys.argv) > 1:
        data = {
            "user": "Brian",
            "message": " ".join(sys.argv[1:]),
            "timestamp": utcnow()
        }
    else:
        print(json.dumps({"error": "No input provided"}))
        sys.exit(1)

    result = route(data)
    print(json.dumps(result, indent=2))
