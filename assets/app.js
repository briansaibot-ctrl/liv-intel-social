(function () {
  'use strict';

  // ===== Constants =====
  const VENUE_ORDER = [
    'XS Nightclub',
    'Encore Beach Club',
    'OMNIA Nightclub',
    'Omnia Beach Club',
    'Zouk Nightclub',
    'Hakkasan Nightclub'
  ];

  const SEASONAL_OFF_MONTHS = [11, 12, 1, 2, 3]; // Nov–Mar
  const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 min

  const ENGAGEMENT_RANK = { High: 3, Normal: 2, Low: 1 };
  const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };

  const PLATFORM_MAP = {
    'IG': { label: 'IG', cls: 'ig' },
    'Instagram': { label: 'IG', cls: 'ig' },
    'TT': { label: 'TT', cls: 'tt' },
    'TikTok': { label: 'TT', cls: 'tt' },
    'X': { label: 'X', cls: 'x' },
    'Twitter': { label: 'X', cls: 'x' },
    'Ticket': { label: 'TKT', cls: 'ticket' },
    'Eventbrite': { label: 'TKT', cls: 'ticket' },
    'PR': { label: 'PR', cls: 'pr' },
    'News': { label: 'NEWS', cls: 'pr' }
  };

  // ===== State =====
  let feedData = null;
  let trendsData = null;

  // ===== DOM Refs =====
  const $ = (sel) => document.querySelector(sel);
  const feedContent = $('#feedContent');
  const trendsContent = $('#trendsContent');
  const headerTimestamp = $('#headerTimestamp');
  const freshnessDot = $('#freshnessDot');
  const offlineBanner = $('#offlineBanner');

  // ===== Utilities =====

  function parsePlatform(raw) {
    if (!raw) return [{ label: raw || '?', cls: 'pr' }];
    const first = raw.split('/')[0].trim();
    const mapped = PLATFORM_MAP[first];
    return [mapped || { label: first.substring(0, 4).toUpperCase(), cls: 'pr' }];
  }

  function platformBadgeHTML(raw) {
    return parsePlatform(raw)
      .map(p => `<span class="platform-badge ${p.cls}">${p.label}</span>`)
      .join('');
  }

  function engagementBadgeHTML(note) {
    const cls = (note || 'Normal').toLowerCase();
    return `<span class="engagement-badge ${cls}">${note || 'Normal'}</span>`;
  }

  function flagPillsHTML(flags) {
    if (!flags || !flags.length) return '';
    const labels = {
      talent_announcement: 'Talent',
      promo_offer: 'Promo',
      urgent: 'Urgent'
    };
    return flags.map(f =>
      `<span class="flag-pill ${f}">${labels[f] || f}</span>`
    ).join('');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatTimestamp(isoStr) {
    if (!isoStr) return 'Unknown';
    const d = new Date(isoStr);
    if (isNaN(d)) return isoStr;
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
      hour12: true
    });
  }

  function getHoursAgo(isoStr) {
    if (!isoStr) return Infinity;
    const d = new Date(isoStr);
    if (isNaN(d)) return Infinity;
    return (Date.now() - d.getTime()) / (1000 * 60 * 60);
  }

  function freshnessClass(hoursAgo) {
    if (hoursAgo < 13) return 'fresh';
    if (hoursAgo <= 25) return 'stale';
    return 'old';
  }

  function isSeasonalOff(venueName) {
    if (!venueName.toLowerCase().includes('omnia beach club')) return false;
    const month = new Date().getMonth() + 1;
    return SEASONAL_OFF_MONTHS.includes(month);
  }

  function venueIndex(name) {
    const lower = name.toLowerCase();
    const idx = VENUE_ORDER.findIndex(v => v.toLowerCase() === lower);
    return idx === -1 ? 999 : idx;
  }

  function escapeHTML(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  // ===== Data Loading =====

  async function fetchJSON(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }

  async function loadData() {
    let offline = false;

    try {
      feedData = await fetchJSON('./data/latest.json');
    } catch {
      offline = true;
    }

    try {
      trendsData = await fetchJSON('./data/latest-trends.json');
    } catch {
      offline = true;
    }

    offlineBanner.hidden = !offline;
    renderFeed();
    renderTrends();
  }

  // ===== Tab Routing =====

  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        $('#' + btn.dataset.tab).classList.add('active');
      });
    });
  }

  // ===== Social Feed Rendering =====

  function renderFeed() {
    if (!feedData || !feedData.venues) {
      feedContent.innerHTML = `
        <div class="empty-state">
          Waiting for first data refresh.<br>
          Runs daily at 12pm and 8pm PT.
        </div>`;
      headerTimestamp.textContent = 'No data';
      freshnessDot.className = 'freshness-dot old';
      return;
    }

    const hoursAgo = getHoursAgo(feedData.run_at);
    freshnessDot.className = `freshness-dot ${freshnessClass(hoursAgo)}`;
    headerTimestamp.textContent = formatTimestamp(feedData.run_at);

    let html = '';

    // Market Pulse
    html += `
      <div class="card market-pulse">
        <div class="label">Market Pulse</div>
        <div class="pulse-text">${escapeHTML(feedData.market_pulse)}</div>
      </div>`;

    // Top 3 Posts Overall
    html += renderTop3();

    // Venue Cards
    html += `<div class="section-header">&#x1F4CA; Top Posts by Venue</div>`;
    const sorted = [...feedData.venues].sort((a, b) => venueIndex(a.venue) - venueIndex(b.venue));
    sorted.forEach(v => { html += renderVenueCard(v); });

    feedContent.innerHTML = html;

    // Attach collapse handlers
    feedContent.querySelectorAll('.venue-header').forEach(hdr => {
      hdr.addEventListener('click', () => {
        hdr.closest('.venue-card').classList.toggle('expanded');
      });
    });
  }

  function renderTop3() {
    const allPosts = [];
    (feedData.venues || []).forEach(v => {
      (v.raw_posts || []).forEach(p => {
        allPosts.push({
          ...p,
          venue: v.venue,
          venueUrgent: v.urgent
        });
      });
    });

    allPosts.sort((a, b) => {
      const urgA = (a.flags || []).includes('urgent') || a.venueUrgent ? 1 : 0;
      const urgB = (b.flags || []).includes('urgent') || b.venueUrgent ? 1 : 0;
      if (urgB !== urgA) return urgB - urgA;

      const engA = ENGAGEMENT_RANK[a.engagement_note] || 0;
      const engB = ENGAGEMENT_RANK[b.engagement_note] || 0;
      if (engB !== engA) return engB - engA;

      return new Date(b.posted_at || 0) - new Date(a.posted_at || 0);
    });

    const top = allPosts.slice(0, 3);
    if (!top.length) return '';

    let html = `<div class="section-header">&#x1F3C6; Top Posts This Cycle</div>`;
    top.forEach((post, i) => {
      const rankCls = `rank-${i + 1}`;
      html += `
        <div class="card ranked-card">
          <div class="rank-number ${rankCls}">${i + 1}</div>
          <div class="ranked-body">
            <div class="ranked-venue">${escapeHTML(post.venue)}</div>
            <div class="ranked-summary">${escapeHTML(post.content_summary)}</div>
            <div class="ranked-meta">
              ${platformBadgeHTML(post.platform)}
              ${engagementBadgeHTML(post.engagement_note)}
              <span>${formatDate(post.posted_at)}</span>
            </div>
          </div>
        </div>`;
    });

    return html;
  }

  function renderVenueCard(venue) {
    const showSeasonal = isSeasonalOff(venue.venue) && venue.posts_found === 0 && !venue.urgent;
    const urgentDot = venue.urgent ? '<span class="urgent-dot"></span>' : '';

    let postsHTML = '';
    if (venue.raw_posts && venue.raw_posts.length > 0) {
      venue.raw_posts.forEach(p => {
        postsHTML += `
          <div class="venue-post">
            <div class="venue-post-meta">
              ${platformBadgeHTML(p.platform)}
              ${engagementBadgeHTML(p.engagement_note)}
              <span>${formatDate(p.posted_at)}</span>
            </div>
            <div class="venue-post-summary">${escapeHTML(p.content_summary)}</div>
          </div>`;
      });
    } else {
      postsHTML = '<div class="no-posts">No posts detected this cycle</div>';
    }

    return `
      <div class="card venue-card">
        <div class="venue-header">
          ${urgentDot}
          <span class="venue-name">${escapeHTML(venue.venue)}</span>
          <span class="venue-count">${venue.posts_found} post${venue.posts_found !== 1 ? 's' : ''}</span>
          <span class="venue-chevron">&#x25BE;</span>
        </div>
        ${venue.flags && venue.flags.length ? `<div class="venue-flags">${flagPillsHTML(venue.flags)}</div>` : ''}
        <div class="venue-summary">${escapeHTML(venue.summary)}</div>
        ${showSeasonal ? '<div class="seasonal-banner">Seasonal — Off</div>' : ''}
        <div class="venue-posts">${postsHTML}</div>
      </div>`;
  }

  // ===== Trends Rendering =====

  function renderTrends() {
    if (!trendsData) {
      trendsContent.innerHTML = `
        <div class="empty-state">
          First trend digest arrives Monday at 8am PT.<br>
          Check back then.
        </div>`;
      return;
    }

    const weekOf = trendsData.week_of;
    const generatedAt = trendsData.generated_at;

    // Check if trends are from a previous week
    const now = new Date();
    const trendWeek = new Date(weekOf);
    const daysSince = (now - trendWeek) / (1000 * 60 * 60 * 24);
    const isStale = daysSince > 7;

    let html = `
      <div class="trends-header">
        <span class="trends-title">Weekly Trend Digest</span>
        <span class="trends-week">Week of ${formatDate(weekOf)}</span>
      </div>`;

    if (isStale) {
      html += `<div class="trends-stale-banner">Next digest Monday at 8am PT</div>`;
    }

    // Platform Updates
    html += `<div class="section-header">&#x26A1; Platform Updates</div>`;
    (trendsData.platform_updates || []).forEach(pu => {
      const actionCls = pu.action_required ? ' action-required' : '';
      html += `
        <div class="card platform-update-card${actionCls}">
          <div class="platform-update-name">
            ${escapeHTML(pu.platform)}
            ${pu.action_required ? '<span class="action-badge">ACTION REQUIRED</span>' : ''}
          </div>
          <div class="ranked-summary">${escapeHTML(pu.update)}</div>
          <div class="platform-update-detail">${escapeHTML(pu.detail)}</div>
        </div>`;
    });

    // Content Formats
    html += `<div class="section-header">&#x1F3AC; Content Formats Trending Now</div>`;
    html += '<div class="card">';
    (trendsData.top_content_formats || []).forEach(fmt => {
      html += `
        <div class="format-item">
          <div class="format-name">${escapeHTML(fmt.format)}</div>
          <div class="format-why">${escapeHTML(fmt.why_it_works)}</div>
          <div class="format-liv">
            <span class="format-liv-prefix">For LIV: </span>${escapeHTML(fmt.liv_application)}
          </div>
        </div>`;
    });
    html += '</div>';

    // Trending Audio
    html += `<div class="section-header">&#x1F3B5; Trending Audio</div>`;
    if (trendsData.trending_audio && trendsData.trending_audio.length) {
      html += '<div class="card">';
      trendsData.trending_audio.forEach(a => {
        html += `
          <div class="audio-item">
            <div class="audio-info">
              <div class="audio-name">${escapeHTML(a.sound)}</div>
              <div class="audio-artist">${escapeHTML(a.artist)}</div>
              <div class="audio-relevance">${escapeHTML(a.relevance)}</div>
            </div>
            ${platformBadgeHTML(a.platform)}
          </div>`;
      });
      html += '</div>';
    } else {
      html += '<div class="card"><div class="no-posts">No standout audio trends this cycle</div></div>';
    }

    // Viral Nightlife Content
    if (trendsData.viral_nightlife_content) {
      const vnc = trendsData.viral_nightlife_content;
      html += `<div class="section-header">&#x1F525; What's Working in Nightlife</div>`;
      html += `
        <div class="card">
          <div class="viral-summary">${escapeHTML(vnc.summary)}</div>
          ${vnc.standout_example ? `<div class="viral-standout">${escapeHTML(vnc.standout_example)}</div>` : ''}
          ${vnc.theme ? `<span class="theme-pill">${escapeHTML(vnc.theme)}</span>` : ''}
        </div>`;
    }

    // Audience Signals
    if (trendsData.audience_signals) {
      const as = trendsData.audience_signals;
      html += `<div class="section-header">&#x1F465; Audience Signals</div>`;
      html += `
        <div class="card">
          <div class="audience-behavior">${escapeHTML(as.behavior_shift)}</div>
          ${as.upcoming_moments && as.upcoming_moments.length ? `
            <div class="moments-scroll">
              ${as.upcoming_moments.map(m => `<span class="moment-pill">${escapeHTML(m)}</span>`).join('')}
            </div>` : ''}
        </div>`;
    }

    // Recommendations
    if (trendsData.this_week_recommendations && trendsData.this_week_recommendations.length) {
      html += `<div class="section-header">&#x1F3AF; This Week — Act On This</div>`;
      const sorted = [...trendsData.this_week_recommendations].sort((a, b) => {
        return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      });
      sorted.forEach(rec => {
        const pri = (rec.priority || 'MEDIUM').toLowerCase();
        html += `
          <div class="card rec-card ${pri}">
            <div class="rec-header">
              <span class="priority-badge ${pri}">${rec.priority}</span>
              ${platformBadgeHTML(rec.platform)}
            </div>
            <div class="rec-action">${escapeHTML(rec.action)}</div>
            <div class="rec-rationale">${escapeHTML(rec.rationale)}</div>
          </div>`;
      });
    }

    trendsContent.innerHTML = html;
  }

  // ===== Init =====

  initTabs();
  loadData();
  setInterval(loadData, REFRESH_INTERVAL);
})();
