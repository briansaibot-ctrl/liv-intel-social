#!/usr/bin/env python3
"""
build-rolling.py
Reads all history/*.json files from the last 24 hours and writes data/rolling-24h.json
Run after accumulate-history.sh has saved a snapshot.
"""

import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
HISTORY_DIR = REPO_ROOT / "data" / "history"
OUTPUT_FILE = REPO_ROOT / "data" / "rolling-24h.json"
WINDOW_HOURS = 24


def load_history_snapshots():
    """Load all history JSON files from the last 24 hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=WINDOW_HOURS)
    snapshots = []

    if not HISTORY_DIR.exists():
        print(f"[build-rolling] No history dir at {HISTORY_DIR}", file=sys.stderr)
        return snapshots

    for f in sorted(HISTORY_DIR.glob("*.json")):
        mtime = datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc)
        if mtime >= cutoff:
            try:
                data = json.loads(f.read_text())
                data["_source_file"] = f.name
                data["_mtime"] = mtime.isoformat()
                snapshots.append(data)
                print(f"[build-rolling] Loaded: {f.name}")
            except Exception as e:
                print(f"[build-rolling] Skipped {f.name}: {e}", file=sys.stderr)

    return snapshots


def pick_latest(snapshots, *keys):
    """Return value from the most recent snapshot that has all given keys."""
    for snap in reversed(snapshots):
        val = snap
        try:
            for k in keys:
                val = val[k]
            return val
        except (KeyError, TypeError):
            continue
    return None


def aggregate_liv_venue(snapshots, venue_key):
    """Aggregate posts_count and top_posts for a LIV venue across snapshots."""
    all_posts = []
    total_posts = 0
    engagement_counts = {"High": 0, "Normal": 0, "Low": 0}

    for snap in snapshots:
        venues = snap.get("venues", [])
        for v in venues:
            if venue_key.lower() in v.get("venue", "").lower():
                total_posts += v.get("posts_found", 0)
                for p in v.get("raw_posts", []):
                    eng = p.get("engagement_note", "Normal")
                    engagement_counts[eng] = engagement_counts.get(eng, 0) + 1
                    all_posts.append(p)

    # Avg engagement label
    if engagement_counts["High"] >= engagement_counts["Normal"]:
        avg_eng = "High"
    elif engagement_counts["Normal"] >= engagement_counts["Low"]:
        avg_eng = "Normal"
    else:
        avg_eng = "Low"

    # Top 3 posts by engagement then recency
    eng_rank = {"High": 3, "Normal": 2, "Low": 1}
    sorted_posts = sorted(
        all_posts,
        key=lambda p: (eng_rank.get(p.get("engagement_note", "Normal"), 2), p.get("posted_at", "")),
        reverse=True
    )
    top_posts = sorted_posts[:3]

    return {
        "posts_count": total_posts or (1 if all_posts else 0),
        "avg_engagement": avg_eng,
        "top_posts": top_posts
    }


def aggregate_competitors(snapshots):
    """Build competitor summary from all snapshots."""
    competitor_map = {}
    for snap in snapshots:
        for v in snap.get("venues", []):
            name = v.get("venue", "")
            if any(x in name.lower() for x in ["liv nightclub", "liv beach"]):
                continue
            if name not in competitor_map:
                competitor_map[name] = {"venue": name, "posts_count": 0, "urgency_flags": 0}
            competitor_map[name]["posts_count"] += v.get("posts_found", 0)
            if v.get("urgent", False):
                competitor_map[name]["urgency_flags"] += 1

    # Sort by posts_count desc
    return sorted(competitor_map.values(), key=lambda x: x["posts_count"], reverse=True)


def aggregate_top_creators(snapshots):
    """Collect top creators across snapshots."""
    creator_map = {}
    for snap in snapshots:
        for inf in snap.get("influencer_activity", []):
            handle = inf.get("handle", "")
            if not handle:
                continue
            if handle not in creator_map:
                creator_map[handle] = dict(inf)
                creator_map[handle]["posts_found"] = 0
            creator_map[handle]["posts_found"] += inf.get("posts_found", 1)

    eng_rank = {"High": 3, "Normal": 2, "Low": 1}
    return sorted(
        creator_map.values(),
        key=lambda x: (eng_rank.get(x.get("engagement_level", "Normal"), 2), x.get("posts_found", 0)),
        reverse=True
    )[:5]


def aggregate_content_gaps(snapshots):
    """Deduplicate content gaps, keeping highest urgency per gap_type."""
    gap_map = {}
    urg_order = {"high": 0, "medium": 1, "low": 2}
    for snap in snapshots:
        for g in snap.get("content_gaps", []):
            gt = g.get("gap_type", "")
            if gt not in gap_map or urg_order.get(g.get("urgency", "low"), 2) < urg_order.get(gap_map[gt].get("urgency", "low"), 2):
                gap_map[gt] = g
    return sorted(gap_map.values(), key=lambda x: urg_order.get(x.get("urgency", "low"), 2))


def aggregate_stories(snapshots):
    """Collect all unique story_activity entries from the window."""
    seen = set()
    stories = []
    for snap in snapshots:
        for s in snap.get("story_activity", []):
            key = (s.get("venue", ""), s.get("content_type", ""), s.get("summary", "")[:40])
            if key not in seen:
                seen.add(key)
                stories.append(s)
    return stories


def main():
    snapshots = load_history_snapshots()

    # Fall back to latest.json if no history within 24h
    if not snapshots:
        print("[build-rolling] No history snapshots in last 24h — falling back to latest.json")
        latest_file = REPO_ROOT / "data" / "latest.json"
        if latest_file.exists():
            try:
                data = json.loads(latest_file.read_text())
                data["_source_file"] = "latest.json"
                data["_mtime"] = datetime.now(timezone.utc).isoformat()
                snapshots = [data]
            except Exception as e:
                print(f"[build-rolling] Failed to load latest.json: {e}", file=sys.stderr)
                sys.exit(1)
        else:
            print("[build-rolling] No data available — exiting", file=sys.stderr)
            sys.exit(1)

    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    rolling = {
        "generated_at": now_iso,
        "window": "24h",
        "source_snapshots": len(snapshots),
        "liv_nightclub": aggregate_liv_venue(snapshots, "liv nightclub"),
        "liv_beach": aggregate_liv_venue(snapshots, "liv beach"),
        "competitor_summary": aggregate_competitors(snapshots),
        "story_activity": aggregate_stories(snapshots),
        "top_creators": aggregate_top_creators(snapshots),
        "content_gaps": aggregate_content_gaps(snapshots),
        "urgent_count": sum(
            1 for snap in snapshots for v in snap.get("venues", []) if v.get("urgent", False)
        )
    }

    OUTPUT_FILE.write_text(json.dumps(rolling, indent=2, ensure_ascii=False))
    print(f"[build-rolling] Wrote: {OUTPUT_FILE}")
    print(f"[build-rolling] Snapshots used: {len(snapshots)}")


if __name__ == "__main__":
    main()
