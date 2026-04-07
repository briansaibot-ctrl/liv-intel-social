#!/usr/bin/env python3
"""
Nova AI OS — Shared Utilities
Used across all agents: rate-limit handling, task queue, prompt caching
"""

import hashlib
import os
import time
from queue import Queue
from datetime import datetime, timezone
from pathlib import Path

CACHE_DIR = Path("/Users/jarvis/.openclaw/workspace/agents/shared/cache")


# --- Rate-limit safe API request ---

def safe_request(client, max_retries: int = 5, **kwargs):
    """Exponential backoff on rate limit errors."""
    delay = 2
    for attempt in range(max_retries):
        try:
            return client.chat.completions.create(**kwargs)
        except Exception as e:
            if "rate limit" in str(e).lower():
                print(f"Rate limit hit. Retrying in {delay}s... (attempt {attempt + 1}/{max_retries})")
                time.sleep(delay)
                delay *= 2
            else:
                raise e
    raise Exception("Max retries exceeded")


# --- Task queue worker ---

def build_queue(tasks: list) -> Queue:
    """Build a task queue from a list of prompts."""
    q = Queue()
    for task in tasks:
        q.put(task)
    return q


def run_queue(client, task_queue: Queue, model: str = "gpt-4o-mini", spacing: float = 2.0) -> list:
    """
    Process all tasks in queue.
    Returns list of (task, response_text) tuples.
    Respects rate limits with spacing between requests.
    """
    results = []
    while not task_queue.empty():
        task = task_queue.get()
        cached = get_cached(task)
        if cached:
            print(f"[cache hit] {task[:60]}...")
            results.append((task, cached))
            task_queue.task_done()
            continue
        try:
            response = safe_request(
                client,
                model=model,
                messages=[{"role": "user", "content": task}]
            )
            content = response.choices[0].message.content
            save_cache(task, content)
            results.append((task, content))
        except Exception as e:
            results.append((task, f"ERROR: {e}"))
        time.sleep(spacing)
        task_queue.task_done()
    return results


# --- Prompt cache ---

def cache_key(prompt: str) -> str:
    return hashlib.md5(prompt.encode()).hexdigest()

def get_cached(prompt: str) -> str | None:
    key = cache_key(prompt)
    path = CACHE_DIR / f"{key}.txt"
    if path.exists():
        return path.read_text()
    return None

def save_cache(prompt: str, response: str):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    key = cache_key(prompt)
    (CACHE_DIR / f"{key}.txt").write_text(response)

def clear_cache():
    if CACHE_DIR.exists():
        for f in CACHE_DIR.glob("*.txt"):
            f.unlink()

def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()
