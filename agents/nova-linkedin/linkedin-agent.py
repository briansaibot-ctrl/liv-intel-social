#!/usr/bin/env python3
"""
nova-linkedin — LinkedIn content automation agent
Scans sources, filters articles, generates comments, posts to LinkedIn

Weekly workflow:
1. Source health check
2. Scan & collect articles from past 7 days
3. Filter by relevance/quality
4. Select top 3
5. Generate comments
6. Request approval via WhatsApp
7. Post to LinkedIn
8. Weekly summary
"""

import json
import sys
import os
import subprocess
import shlex
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).parent.parent))
from shared.utils import utcnow

WORKSPACE = Path("/Users/jarvis/.openclaw/workspace")
LOG_PATH = Path("/Users/jarvis/.openclaw/logs/nova-linkedin.log")
LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

SOURCES = {
    "eater_vegas": "https://eater.com/vegas",
    "vegas_seven": "https://vegasseven.com",
    "vegas_magazine": "https://vegasmagazine.com",
    "robb_report": "https://robbreport.com",
    "cn_traveler": "https://cntraveler.com",
    "forbes_travel": "https://forbes.com/travel",
    "haute_living": "https://hauteliving.com",
    "nightclub_bar": "https://nightclubbar.com",
    "hotel_management": "https://hotelmanagement.net",
    "edm": "https://edm.com",
    "fontainebleau": "https://fontainebleau.com/las-vegas",
    "fontainebleau_linkedin": "https://linkedin.com/company/fontainebleau-las-vegas",
    "google_news_liv": "https://news.google.com/search?q=LIV+Nightclub+Las+Vegas",
    "google_news_liv_beach": "https://news.google.com/search?q=LIV+Beach+Las+Vegas",
    "google_news_fontainebleau": "https://news.google.com/search?q=Fontainebleau+Las+Vegas",
}

def log(entry: dict):
    with open(LOG_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")

def read_duplicate_log(log_file: str) -> set:
    """Load all URLs from the duplicate log."""
    if not Path(log_file).exists():
        return set()
    urls = set()
    for line in Path(log_file).read_text().splitlines():
        if line.startswith("#") or not line.strip():
            continue
        parts = line.split("|")
        if len(parts) >= 2:
            urls.add(parts[1].strip())
    return urls

def add_to_log(log_file: str, url: str, status: str):
    """Add URL to duplicate log."""
    timestamp = utcnow()
    entry = f"{timestamp} | {url} | {status}\n"
    with open(log_file, "a") as f:
        f.write(entry)

def run_cmd(cmd: str, timeout: int = 30) -> dict:
    try:
        result = subprocess.run(shlex.split(cmd), capture_output=True, text=True, timeout=timeout)
        return {"stdout": result.stdout.strip(), "stderr": result.stderr.strip(), "returncode": result.returncode}
    except Exception as e:
        return {"stdout": "", "stderr": str(e), "returncode": -1}

def check_source_health() -> dict:
    """Verify all source URLs load correctly."""
    results = {"ok": [], "failed": []}
    for name, url in SOURCES.items():
        # Simplified check — in production use headless Chrome
        r = run_cmd(f"curl -sf --max-time 10 {url}", timeout=15)
        if r["returncode"] == 0:
            results["ok"].append(name)
        else:
            results["failed"].append(name)
    return results

def scan_sources() -> list:
    """
    Scan all sources for articles published in the last 7 days.
    Returns list of dicts: {url, title, source, published_date}
    
    In production, this would use:
    - Headless Chrome for dynamic content
    - RSS feeds where available
    - Web scraping for structured content
    - Google News API
    """
    articles = []
    log({"action": "scan_sources", "timestamp": utcnow()})
    # Placeholder: return empty list
    # Real implementation would scrape each source
    return articles

def filter_articles(articles: list) -> list:
    """Apply filtering rules."""
    filtered = []
    for article in articles:
        # Check exclusions
        title = article.get("title", "").lower()
        if any(kw in title for kw in ["miami", "competitor", "negative", "complaint", "criticism"]):
            continue
        if "las vegas" not in title.lower():
            continue
        filtered.append(article)
    return filtered

def select_top_3(articles: list) -> list:
    """Select top 3 articles by priority."""
    # Prioritize: LIV Nightclub > Fontainebleau > Broader Vegas
    liv_direct = [a for a in articles if "liv nightclub" in a.get("title", "").lower() and "liv beach" not in a.get("title", "").lower()]
    liv_beach = [a for a in articles if "liv beach" in a.get("title", "").lower()]
    fontainebleau = [a for a in articles if "fontainebleau" in a.get("title", "").lower()]
    broader = [a for a in articles if a not in liv_direct + liv_beach + fontainebleau]
    
    selected = (liv_direct + liv_beach + fontainebleau + broader)[:3]
    return selected

def generate_comment(article: dict) -> str:
    """Generate a 2-3 sentence comment in Brian's voice."""
    # Placeholder — in production, use an LLM
    title = article.get("title", "No title")
    return f"Great to see more coverage of what's happening in Las Vegas hospitality. This is the kind of positive momentum the industry needs."

def request_approval(article: dict, index: int, total: int, whatsapp_jid: str = "17023402622@s.whatsapp.net") -> str:
    """Send WhatsApp message requesting approval. Returns: YES | SKIP | TIMEOUT"""
    url = article.get("url", "")
    comment = article.get("comment", "")
    
    msg = f"POST [{index}] OF [{total}]\n🔗 {url}\n💬 Suggested comment: \"{comment}\"\n\nReply YES to post or SKIP to pass."
    
    # Send via OpenClaw agent
    r = run_cmd(f"openclaw agent --agent main --to +17023402622 -m '{msg}'", timeout=30)
    
    if r["returncode"] != 0:
        return "TIMEOUT"
    
    # Wait for response (simplified — in production, use message polling)
    log({"action": "approval_requested", "article": url, "timestamp": utcnow()})
    return "PENDING"

def post_to_linkedin(article: dict) -> bool:
    """Post article to LinkedIn. Requires session to be active."""
    url = article.get("url", "")
    comment = article.get("comment", "")
    
    # Placeholder — in production, use Selenium or Playwright to automate posting
    log({"action": "post_attempted", "url": url, "timestamp": utcnow()})
    
    # After posting, send screenshot request
    msg = f"📸 Please take a screenshot of the live LinkedIn post and send it to confirm formatting."
    run_cmd(f"openclaw agent --agent main --to +17023402622 -m '{msg}'", timeout=30)
    
    return True

def send_weekly_summary(scanned: int, filtered: int, approved: int, posted: int, issues: list):
    """Send WhatsApp summary."""
    issues_text = "\n".join(issues) if issues else "None"
    msg = f"""Weekly LinkedIn Report
🔍 Articles scanned: {scanned}
✅ Passed filter: {filtered}
📬 Sent for approval: {approved}
📤 Posted: {posted}
⚠️ Issues: {issues_text}"""
    
    r = run_cmd(f"openclaw agent --agent main --to +17023402622 -m '{msg}'", timeout=30)
    return r["returncode"] == 0

def main(args):
    dup_log = args.get("log", str(WORKSPACE / "nova_linkedin_log.txt"))
    duplicates = read_duplicate_log(dup_log)
    
    # Step 1: Source health check
    print("[1/8] Checking source health...")
    health = check_source_health()
    if health["failed"]:
        log({"action": "source_health_check", "failed_sources": health["failed"], "timestamp": utcnow()})
    
    # Step 2: Scan sources
    print("[2/8] Scanning sources for articles...")
    articles = scan_sources()
    articles = [a for a in articles if a.get("url") not in duplicates]
    
    # Step 3: Filter
    print("[3/8] Filtering articles...")
    filtered = filter_articles(articles)
    
    # Step 4: Select top 3
    print("[4/8] Selecting top 3...")
    selected = select_top_3(filtered)
    
    if not selected:
        msg = "No qualifying posts found this week. Skipping this cycle."
        run_cmd(f"openclaw agent --agent main --to +17023402622 -m '{msg}'")
        log({"action": "cycle_complete", "result": "no_posts", "timestamp": utcnow()})
        return 0
    
    # Step 5: Generate comments
    print("[5/8] Generating comments...")
    for article in selected:
        article["comment"] = generate_comment(article)
    
    # Step 6: Request approval
    print("[6/8] Requesting approval...")
    approved = []
    for i, article in enumerate(selected, 1):
        result = request_approval(article, i, len(selected))
        if result == "YES":
            approved.append(article)
            add_to_log(dup_log, article.get("url"), "approved")
        else:
            add_to_log(dup_log, article.get("url"), "skipped")
    
    # Step 7: Post to LinkedIn
    print("[7/8] Posting to LinkedIn...")
    posted = 0
    for article in approved:
        if post_to_linkedin(article):
            posted += 1
            add_to_log(dup_log, article.get("url"), "posted")
            time.sleep(172800)  # Space posts 2 days apart
    
    # Step 8: Weekly summary
    print("[8/8] Sending weekly summary...")
    issues = health["failed"] if health["failed"] else []
    send_weekly_summary(len(articles), len(filtered), len(selected), posted, issues)
    
    log({"action": "cycle_complete", "result": "success", "scanned": len(articles), "filtered": len(filtered), "approved": len(selected), "posted": posted, "timestamp": utcnow()})
    return 0

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--log", default=str(WORKSPACE / "nova_linkedin_log.txt"))
    parser.add_argument("--force", action="store_true")
    args = vars(parser.parse_args())
    
    exit(main(args))
