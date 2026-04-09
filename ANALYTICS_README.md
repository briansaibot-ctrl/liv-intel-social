# LIV Intel Analytics Monitor — Module C

**Purpose:** Weekly competitive intelligence snapshot for 6 Las Vegas nightclub venues.

**Schedule:** Every Sunday at 9:00 AM PT

**Output:** 
- `output/analytics/latest-analytics.json` (latest snapshot)
- `output/analytics/history/YYYY-MM-DD-analytics.json` (archived snapshots)

---

## Data Collection Strategy

### Venues Tracked
1. XS Nightclub
2. Hakkasan
3. Marquee
4. Wynn Nightclub
5. Tao Nightclub
6. Omnia

### Search Targets (2-3 per venue)

**SEARCH 1 — Account Stats**
- Current follower counts (Instagram, TikTok, X)
- 30-day follower deltas and trends
- Posting frequency (posts per week)
- Days since last post
- Estimated engagement rates

**SEARCH 2 — Top Performing Posts**
- Top 3 posts by engagement rate
- Platform, post type, content summary
- View/like/comment/share counts
- Engagement rate calculation
- Why it performed (1-sentence analysis)

**SEARCH 3 — Posting Patterns**
- Peak posting days and times
- Whether venue went dark (3+ days no posts)
- Content mix percentages (Reels vs Static vs Carousel)

### Model Routing

- **Claude Haiku:** All individual venue searches (12-18 total searches)
- **Claude Sonnet:** ONLY final synthesis block (`weekly_ai_insight`)

### Rate Limiting

- 10 seconds between searches
- Max 5 searches per batch
- 2-minute break after each batch

---

## Output Format

### Latest Analytics JSON

```json
{
  "week_of": "2026-04-13",
  "generated_at": "2026-04-13T09:00:00-07:00",
  "venues": [
    {
      "name": "Venue Name",
      "confidence": "high|medium|low",
      "accounts": {
        "instagram": { ... },
        "tiktok": { ... },
        "x": { ... }
      },
      "top_posts": [ ... ],
      "posting_patterns": { ... }
    }
  ],
  "cross_venue_rankings": {
    "top_3_posts_overall": [ ... ],
    "fastest_growing_account": { ... },
    "most_active_venue": { ... },
    "went_dark": [ ... ]
  },
  "weekly_ai_insight": {
    "competitive_takeaway": "...",
    "biggest_opportunity_for_liv": "...",
    "who_to_watch": { ... },
    "content_format_winner": { ... }
  }
}
```

### Confidence Scoring

- **High** — Found verified numbers from multiple sources
- **Medium** — Found partial data, some estimated
- **Low** — Limited public data, figures are estimates

---

## Git Integration

After writing JSON files, the script:
1. Stages `output/analytics/` directory
2. Commits with message: `analytics: YYYY-MM-DD snapshot`
3. Pushes to GitHub

---

## Manual Execution

```bash
python3 /Users/jarvis/.openclaw/workspace/skills/liv-intel-social/scripts/analytics-monitor.py
```

---

## PWA Integration

The analytics data is consumed by the LIV Intel PWA dashboard. **No WhatsApp notifications are sent** — users view the data in the app.

---

## See Also

- **Module A:** Social Competitor Monitor (daily 12pm & 8pm PT)
- **Module B:** Weekly Trend Digest (Monday 8am PT)
- **Cron Job:** `LIV Intel Analytics Monitor (Sunday 9am PT)`
