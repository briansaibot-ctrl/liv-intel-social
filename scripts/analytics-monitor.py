#!/usr/bin/env python3
"""
LIV Intel Analytics Monitor
Runs weekly (Sunday 9am PT) to pull public account health and post performance 
data for all 6 competitor venues.

Output: output/analytics/latest-analytics.json + history/YYYY-MM-DD-analytics.json
"""

import json
import os
import sys
import time
from datetime import datetime
import subprocess
from pathlib import Path

# 6 competitor venues
VENUES = [
    "XS Nightclub",
    "Hakkasan",
    "Marquee",
    "Wynn Nightclub",
    "Tao Nightclub",
    "Omnia"
]

# Configuration
HAIKU_MODEL = "anthropic/claude-haiku-4-5-20251001"
SONNET_MODEL = "anthropic/claude-sonnet-4-6"
SEARCH_DELAY = 10  # seconds between searches
BATCH_SIZE = 5
BATCH_BREAK = 120  # 2 minutes

OUTPUT_DIR = Path(__file__).parent.parent / "output" / "analytics"
HISTORY_DIR = OUTPUT_DIR / "history"

def ensure_output_dirs():
    """Create output directories if they don't exist."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)

def run_claude_search(query: str, model: str, search_num: int) -> str:
    """
    Run a web search via Claude with the given model.
    Returns the Claude response text.
    """
    prompt = f"""You are analyzing social media intelligence for nightclubs in Las Vegas.
Search the web for this query and extract specific metrics:

QUERY: {query}

Extract and return ONLY the data you find - no explanation. Be precise with numbers.
If you cannot find specific numbers, indicate that clearly (e.g., "not found" or "N/A").
"""
    
    # Use claude via CLI or API - this is a simplified version
    # In production, you'd use the Claude API directly
    try:
        result = subprocess.run(
            ["claude", "ask", prompt, f"--model={model}"],
            capture_output=True,
            text=True,
            timeout=30
        )
        return result.stdout.strip() if result.returncode == 0 else ""
    except Exception as e:
        print(f"Error running search {search_num}: {e}", file=sys.stderr)
        return ""

def search_venue_stats(venue: str) -> dict:
    """
    Run searches 1-3 for a single venue.
    Returns extracted data for account stats, top posts, and posting patterns.
    """
    venue_data = {
        "name": venue,
        "confidence": "medium",
        "accounts": {},
        "top_posts": [],
        "posting_patterns": {}
    }
    
    current_month_year = datetime.now().strftime("%B %Y")
    
    # SEARCH 1: Account Stats
    print(f"  [{venue}] Searching account stats...", file=sys.stderr)
    search1_ig = f"{venue} Las Vegas Instagram followers {current_month_year}"
    search1_tiktok = f"{venue} Las Vegas TikTok followers engagement {current_month_year}"
    
    time.sleep(SEARCH_DELAY)
    ig_response = run_claude_search(search1_ig, HAIKU_MODEL, 1)
    
    time.sleep(SEARCH_DELAY)
    tiktok_response = run_claude_search(search1_tiktok, HAIKU_MODEL, 2)
    
    # Parse account data from responses (simplified)
    venue_data["accounts"] = parse_account_stats(ig_response, tiktok_response, venue)
    
    # SEARCH 2: Top Performing Posts
    print(f"  [{venue}] Searching top posts...", file=sys.stderr)
    search2_general = f"{venue} Las Vegas best performing posts this week site:instagram.com OR site:tiktok.com"
    search2_viral = f"{venue} Las Vegas viral post {current_month_year}"
    
    time.sleep(SEARCH_DELAY)
    posts_response = run_claude_search(search2_general, HAIKU_MODEL, 3)
    
    time.sleep(SEARCH_DELAY)
    viral_response = run_claude_search(search2_viral, HAIKU_MODEL, 4)
    
    venue_data["top_posts"] = parse_top_posts(posts_response, viral_response)
    
    # SEARCH 3: Posting Patterns
    print(f"  [{venue}] Searching posting patterns...", file=sys.stderr)
    search3 = f"{venue} Las Vegas social media posts last 14 days"
    
    time.sleep(SEARCH_DELAY)
    patterns_response = run_claude_search(search3, HAIKU_MODEL, 5)
    
    venue_data["posting_patterns"] = parse_posting_patterns(patterns_response)
    
    return venue_data

def parse_account_stats(ig_response: str, tiktok_response: str, venue: str) -> dict:
    """Parse Instagram and TikTok account stats from search responses."""
    accounts = {
        "instagram": {
            "followers": None,
            "follower_30d_delta": "0",
            "follower_trend": "flat",
            "posts_per_week": None,
            "days_since_last_post": None,
            "engagement_rate_pct": None
        },
        "tiktok": {
            "followers": None,
            "follower_30d_delta": "0",
            "follower_trend": "flat",
            "posts_per_week": None,
            "days_since_last_post": None,
            "engagement_rate_pct": None
        },
        "x": {
            "followers": None,
            "follower_30d_delta": "0",
            "follower_trend": "flat",
            "posts_per_week": None,
            "days_since_last_post": None,
            "engagement_rate_pct": None
        }
    }
    
    # In production, parse the responses to extract actual numbers
    # This is a stub - real implementation would use regex/NLP to extract metrics
    
    return accounts

def parse_top_posts(posts_response: str, viral_response: str) -> list:
    """Parse top 3 performing posts from search responses."""
    top_posts = []
    # In production, parse and rank posts by engagement
    return top_posts

def parse_posting_patterns(patterns_response: str) -> dict:
    """Parse posting patterns from search responses."""
    patterns = {
        "peak_days": [],
        "peak_time_estimate": None,
        "went_dark": False,
        "dark_period": None,
        "content_mix": {
            "reels_pct": None,
            "static_pct": None,
            "carousel_pct": None
        }
    }
    # In production, parse the response to extract pattern data
    return patterns

def generate_weekly_insights(all_venues: list) -> dict:
    """
    Generate cross-venue rankings and insights using Sonnet.
    This is the ONLY place Sonnet is used.
    """
    print("Generating weekly insights (Sonnet)...", file=sys.stderr)
    
    # Prepare data summary for Sonnet
    venues_summary = json.dumps(all_venues, indent=2)
    
    prompt = f"""Analyze this Las Vegas nightclub social media competitive intelligence:

{venues_summary}

Provide:
1. Top 3 posts overall by engagement (rank them with venue, platform, metrics)
2. Fastest growing account (venue + platform + growth rate)
3. Most active venue (total posts this week)
4. Any venues that went dark (3+ days no posts)
5. Competitive takeaway paragraph (what does this mean?)
6. Biggest opportunity for LIV (specific gap)
7. Who to watch this week and why
8. Which content format dominated (Reels vs TikTok vs Carousel)

Return as JSON only, no other text."""
    
    try:
        result = subprocess.run(
            ["claude", "ask", prompt, f"--model={SONNET_MODEL}"],
            capture_output=True,
            text=True,
            timeout=45
        )
        
        if result.returncode == 0:
            # Try to parse the JSON response
            response_text = result.stdout.strip()
            # Extract JSON if it's wrapped in markdown
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]
            
            return json.loads(response_text)
    except Exception as e:
        print(f"Error generating insights: {e}", file=sys.stderr)
    
    return {
        "competitive_takeaway": "Analysis pending",
        "biggest_opportunity_for_liv": "To be determined",
        "who_to_watch": {"venue": None, "reason": "Data pending"},
        "content_format_winner": {"format": None, "why": "Data pending"}
    }

def compile_analytics_json(all_venues: list, insights: dict) -> dict:
    """Compile the final analytics JSON output."""
    today = datetime.now()
    week_of = (today - pd.Timedelta(days=today.weekday())).strftime("%Y-%m-%d")  # Start of this week
    
    return {
        "week_of": week_of,
        "generated_at": datetime.now().isoformat() + "-07:00",  # PT timezone
        "venues": all_venues,
        "cross_venue_rankings": {
            "top_3_posts_overall": insights.get("top_3_posts_overall", []),
            "fastest_growing_account": insights.get("fastest_growing_account", {}),
            "most_active_venue": insights.get("most_active_venue", {}),
            "went_dark": insights.get("went_dark", [])
        },
        "weekly_ai_insight": {
            "competitive_takeaway": insights.get("competitive_takeaway", ""),
            "biggest_opportunity_for_liv": insights.get("biggest_opportunity_for_liv", ""),
            "who_to_watch": insights.get("who_to_watch", {}),
            "content_format_winner": insights.get("content_format_winner", {})
        }
    }

def main():
    """Main entry point."""
    ensure_output_dirs()
    
    print("🔍 LIV Intel Analytics Monitor", file=sys.stderr)
    print(f"Running at: {datetime.now().isoformat()}", file=sys.stderr)
    print(f"Analyzing {len(VENUES)} venues...", file=sys.stderr)
    print("", file=sys.stderr)
    
    start_time = time.time()
    all_venues = []
    search_count = 0
    
    # Search each venue (2-3 searches per venue = 12-18 total)
    for idx, venue in enumerate(VENUES, 1):
        print(f"[{idx}/{len(VENUES)}] {venue}", file=sys.stderr)
        
        venue_data = search_venue_stats(venue)
        all_venues.append(venue_data)
        search_count += 3  # 3 searches per venue
        
        # Add break after batch of 5
        if idx % BATCH_SIZE == 0 and idx < len(VENUES):
            print(f"  🔄 Batch break (2 minutes)...", file=sys.stderr)
            time.sleep(BATCH_BREAK)
    
    print("", file=sys.stderr)
    print(f"Total searches: {search_count}", file=sys.stderr)
    
    # Generate weekly insights using Sonnet
    print("", file=sys.stderr)
    insights = generate_weekly_insights(all_venues)
    
    # Compile final JSON
    analytics_json = compile_analytics_json(all_venues, insights)
    
    # Write to latest-analytics.json
    latest_file = OUTPUT_DIR / "latest-analytics.json"
    with open(latest_file, "w") as f:
        json.dump(analytics_json, f, indent=2)
    print(f"✅ Wrote: {latest_file}", file=sys.stderr)
    
    # Write to history/YYYY-MM-DD-analytics.json
    today = datetime.now().strftime("%Y-%m-%d")
    history_file = HISTORY_DIR / f"{today}-analytics.json"
    with open(history_file, "w") as f:
        json.dump(analytics_json, f, indent=2)
    print(f"✅ Wrote: {history_file}", file=sys.stderr)
    
    # Calculate average confidence
    confidences = [v.get("confidence", "medium") for v in all_venues]
    confidence_scores = {"high": 3, "medium": 2, "low": 1}
    avg_confidence = sum(confidence_scores.get(c, 2) for c in confidences) / len(confidences)
    confidence_label = "high" if avg_confidence > 2.5 else "medium" if avg_confidence > 1.5 else "low"
    
    elapsed = int(time.time() - start_time)
    
    # Print confirmation
    confirmation = f"LIV Intel Analytics run complete — {datetime.now().isoformat()} — {len(VENUES)} venues analyzed — confidence: {confidence_label}"
    print("", file=sys.stderr)
    print(confirmation, file=sys.stderr)
    print(f"Elapsed: {elapsed}s", file=sys.stderr)
    
    # Git push (same pattern as other modules)
    try:
        repo_root = Path(__file__).parent.parent
        os.chdir(repo_root)
        subprocess.run(["git", "add", "output/analytics/"], check=True)
        subprocess.run(["git", "commit", "-m", f"analytics: {today} snapshot"], check=True)
        subprocess.run(["git", "push"], check=True)
        print("✅ Pushed to GitHub", file=sys.stderr)
    except subprocess.CalledProcessError as e:
        print(f"⚠️  Git push failed: {e}", file=sys.stderr)
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
