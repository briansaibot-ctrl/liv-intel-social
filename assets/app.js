(function () {
  'use strict';

  // ===== Constants =====
  const VENUE_ORDER = [
    'LIV Nightclub', 'LIV Beach',
    'XS Nightclub', 'Encore Beach Club', 'OMNIA Nightclub',
    'Omnia Beach Club', 'Zouk Nightclub', 'Hakkasan Nightclub',
    'Palm Tree', 'Tao Beach'
  ];
  const LIV_VENUES = ['liv nightclub', 'liv beach'];
  const BEACH_VENUES = ['liv beach', 'encore beach club', 'omnia beach club', 'palm tree', 'tao beach'];
  const SEASONAL_OFF_MONTHS = [11, 12, 1, 2, 3];
  const REFRESH_INTERVAL = 30 * 60 * 1000;
  const ENGAGEMENT_RANK = { High: 3, Normal: 2, Low: 1 };
  const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  // SVG icons for platforms (16x16 viewBox, white fill)
  const IG_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="white" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="none" stroke="white" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.5" fill="white"/></svg>';
  const TT_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.75a8.18 8.18 0 004.76 1.52V6.84a4.84 4.84 0 01-1-.15z" fill="white"/></svg>';
  const X_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="white"/></svg>';
  const PLATFORM_MAP = {
    'IG': { icon: IG_ICON, cls: 'ig' }, 'Instagram': { icon: IG_ICON, cls: 'ig' },
    'TT': { icon: TT_ICON, cls: 'tt' }, 'TikTok': { icon: TT_ICON, cls: 'tt' },
    'X': { icon: X_ICON, cls: 'x' }, 'Twitter': { icon: X_ICON, cls: 'x' },
    'Ticket': { icon: null, label: 'TKT', cls: 'ticket' }, 'Eventbrite': { icon: null, label: 'TKT', cls: 'ticket' },
    'PR': { icon: null, label: 'PR', cls: 'pr' }, 'News': { icon: null, label: 'NEWS', cls: 'pr' }
  };
  // Social profile URLs for venues (used by leaderboard links)
  const VENUE_SOCIALS = {
    'liv nightclub': { ig: 'livnightclub', tt: 'livnightclub', x: 'LIVNightclub' },
    'liv beach': { ig: 'livbeachlasvegas', tt: 'livbeachlasvegas', x: 'LIVBeachLV' },
    'xs nightclub': { ig: 'xslasvegas', tt: 'xslasvegas' },
    'encore beach club': { ig: 'encorebeachclub', tt: 'encorebeachclub' },
    'omnia nightclub': { ig: 'omnianightclub', tt: 'omnianightclub' },
    'omnia beach club': { ig: 'omnianightclub' },
    'zouk nightclub': { ig: 'zoukgrouplv', tt: 'zouklasvegas' },
    'hakkasan nightclub': { ig: 'hakkasannightclub', tt: 'hakkasanlv' },
    'palm tree': { ig: 'palmtreebeachclub', tt: 'palmtreebeachclub' },
    'tao beach': { ig: 'taobeach', tt: 'taobeach' }
  };

  function profileUrl(platform, handle) {
    if (!handle) return '';
    const h = handle.replace(/^@/, '');
    const p = (platform || '').toLowerCase();
    if (p.includes('tiktok') || p === 'tt') return `https://www.tiktok.com/@${h}`;
    if (p.includes('instagram') || p === 'ig') return `https://www.instagram.com/${h}/`;
    if (p === 'x' || p.includes('twitter')) return `https://x.com/${h}`;
    // Default to IG
    return `https://www.instagram.com/${h}/`;
  }

  function venueProfileUrl(venueName, platform) {
    const socials = VENUE_SOCIALS[(venueName || '').toLowerCase()];
    if (!socials) return '';
    const p = (platform || '').toLowerCase();
    if ((p.includes('tiktok') || p === 'tt') && socials.tt) return `https://www.tiktok.com/@${socials.tt}`;
    if ((p === 'x' || p.includes('twitter')) && socials.x) return `https://x.com/${socials.x}`;
    if (socials.ig) return `https://www.instagram.com/${socials.ig}/`;
    return '';
  }

  function linkWrap(url, innerHtml) {
    if (!url) return innerHtml;
    return `<a href="${url}" target="_blank" rel="noopener" class="card-link">${innerHtml}</a>`;
  }

  const SETTINGS_DEFAULTS = {
    slackWebhookUrl: '', whatsappNumber: '',
    alertsEnabled: true, weekendReadinessEnabled: true,
    mondayDigestEnabled: true, sundayAnalyticsEnabled: true,
    showBeachClubs: true
  };

  // ===== State =====
  let feedData = null;
  let trendsData = null;
  let analyticsData = null;
  let historyData = null;
  let analyticsRendered = false;
  let settingsRendered = false;

  // ===== DOM Refs =====
  const $ = (sel) => document.querySelector(sel);
  const feedContent = $('#feedContent');
  const trendsContent = $('#trendsContent');
  const analyticsContent = $('#analyticsContent');
  const settingsContent = $('#settingsContent');
  const headerTimestamp = $('#headerTimestamp');
  const freshnessDot = $('#freshnessDot');
  const offlineBanner = $('#offlineBanner');

  // ===== Utilities =====

  function parsePlatform(raw) {
    if (!raw) return [{ icon: null, label: raw || '?', cls: 'pr' }];
    const first = raw.split('/')[0].trim();
    const mapped = PLATFORM_MAP[first];
    return [mapped || { icon: null, label: first.substring(0, 4).toUpperCase(), cls: 'pr' }];
  }

  function platformBadgeHTML(raw) {
    return parsePlatform(raw).map(p => {
      const content = p.icon || escapeHTML(p.label || '');
      return `<span class="platform-badge ${p.cls}">${content}</span>`;
    }).join('');
  }

  function engagementBadgeHTML(note) {
    const cls = (note || 'Normal').toLowerCase();
    return `<span class="engagement-badge ${cls}">${note || 'Normal'}</span>`;
  }

  function flagPillsHTML(flags) {
    if (!flags || !flags.length) return '';
    const labels = { talent_announcement: 'Talent', promo_offer: 'Promo', urgent: 'Urgent' };
    return flags.map(f => `<span class="flag-pill ${f}">${labels[f] || f}</span>`).join('');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d) ? dateStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatShortDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d) ? dateStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatTimestamp(isoStr) {
    if (!isoStr) return 'Unknown';
    const d = new Date(isoStr);
    return isNaN(d) ? isoStr : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function getHoursAgo(isoStr) {
    if (!isoStr) return Infinity;
    const d = new Date(isoStr);
    return isNaN(d) ? Infinity : (Date.now() - d.getTime()) / (1000 * 60 * 60);
  }

  function timeAgo(isoStr) {
    const h = getHoursAgo(isoStr);
    if (h < 1) return Math.round(h * 60) + 'm ago';
    if (h < 24) return Math.round(h) + 'h ago';
    return Math.round(h / 24) + 'd ago';
  }

  function freshnessClass(hoursAgo) {
    if (hoursAgo < 13) return 'fresh';
    if (hoursAgo <= 25) return 'stale';
    return 'old';
  }

  function isSeasonalOff(venueName) {
    if (!venueName.toLowerCase().includes('omnia beach club')) return false;
    return SEASONAL_OFF_MONTHS.includes(new Date().getMonth() + 1);
  }

  function venueIndex(name) {
    const lower = name.toLowerCase();
    const idx = VENUE_ORDER.findIndex(v => v.toLowerCase() === lower);
    return idx === -1 ? 999 : idx;
  }

  function escapeHTML(str) {
    if (!str) return '';
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  function formatNum(n) {
    if (n == null) return '—';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K';
    return n.toString();
  }

  function ratingClass(r) {
    if (r == null) return 'ok';
    return r >= 4.0 ? 'good' : r >= 3.5 ? 'ok' : 'bad';
  }

  function isWeekend() {
    const d = new Date().getDay();
    return d === 0 || d === 5 || d === 6;
  }

  function isLivVenue(name) {
    return LIV_VENUES.includes((name || '').toLowerCase());
  }

  function isBeachVenue(name) {
    return BEACH_VENUES.includes((name || '').toLowerCase());
  }

  function shouldShowVenue(name) {
    if (!isBeachVenue(name)) return true;
    return getSettings().showBeachClubs;
  }

  function isStalePost(postedAt) {
    if (!postedAt) return false;
    return getHoursAgo(postedAt) > 7 * 24;
  }

  function stalePostBadge(postedAt) {
    return isStalePost(postedAt) ? ' <span class="stale-post-badge">older post</span>' : '';
  }

  // Countdown timer — calculates next run time (every 4 hours: 12am, 4am, 8am, 12pm, 4pm, 8pm PT)
  let countdownInterval = null;
  function getNextRunTime() {
    const now = new Date();
    
    // Create PT timezone date (using Intl API for accurate DST handling)
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const ptTimeStr = formatter.format(now);
    const [ptH, ptM] = ptTimeStr.split(':').map(Number);
    
    // Next run times in PT: 0 (12am), 4, 8, 12 (noon), 16 (4pm), 20 (8pm)
    const runs = [0, 4, 8, 12, 16, 20];
    let nextPtH = null;
    let addDays = 0;
    
    // Find next run time after current PT time
    for (const rh of runs) {
      if (ptH < rh || (ptH === rh && ptM < 1)) {
        nextPtH = rh;
        break;
      }
    }
    
    if (nextPtH === null) {
      // No more runs today, next one is tomorrow at midnight
      nextPtH = 0;
      addDays = 1;
    }

    // Create next run time in PT timezone
    const next = new Date(now);
    next.setHours(next.getHours() + (addDays ? 24 : 0));
    
    // Adjust to exact PT hour (this is approximate but close enough for display)
    const currentPtOffset = now.getTimezoneOffset() / 60; // Gets local offset
    const hoursToAdd = nextPtH - ptH;
    const minutesToAdd = -ptM;
    
    next.setHours(next.getHours() + hoursToAdd);
    next.setMinutes(next.getMinutes() + minutesToAdd);
    next.setSeconds(0);
    
    return next;
  }

  function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    function update() {
      const next = getNextRunTime();
      const diff = next - Date.now();
      if (diff <= 0) { headerTimestamp.textContent = 'Updating soon'; return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 0) headerTimestamp.textContent = `Next update ${h}h ${m}m`;
      else headerTimestamp.textContent = `Next update ${m}:${s.toString().padStart(2, '0')}`;
    }
    update();
    countdownInterval = setInterval(update, 1000);
  }

  // ===== Settings Manager =====

  function getSettings() {
    try {
      const s = localStorage.getItem('liv-intel-settings');
      return s ? { ...SETTINGS_DEFAULTS, ...JSON.parse(s) } : { ...SETTINGS_DEFAULTS };
    } catch { return { ...SETTINGS_DEFAULTS }; }
  }

  function saveSetting(key, value) {
    const s = getSettings();
    s[key] = value;
    localStorage.setItem('liv-intel-settings', JSON.stringify(s));
  }

  // ===== Data Loading =====

  async function fetchJSON(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }

  async function loadData() {
    let loaded = 0;
    try { feedData = await fetchJSON('./data/latest.json'); loaded++; } catch {}
    try { trendsData = await fetchJSON('./data/latest-trends.json'); loaded++; } catch {}
    try { analyticsData = await fetchJSON('./data/latest-analytics.json'); loaded++; } catch {}
    try { historyData = await fetchJSON('./data/analytics-history.json'); } catch {}
    offlineBanner.hidden = loaded > 0;
    try { renderFeed(); } catch(e) { console.error('renderFeed failed', e); feedContent.innerHTML = '<div class="empty-state">Feed failed to load. Check console.</div>'; }
    try { renderTrends(); } catch(e) { console.error('renderTrends failed', e); trendsContent.innerHTML = '<div class="empty-state">Trends failed to load. Check console.</div>'; }
    if (analyticsRendered) { try { renderAnalytics(); } catch(e) { console.error('renderAnalytics failed', e); analyticsContent.innerHTML = '<div class="empty-state">Analytics failed to load. Check console.</div>'; } }
  }

  // ===== Sparkline Renderer =====
  function sparklineSVG(values, color, w, h) {
    if (!values || !values.length) return `<svg width="${w}" height="${h}"></svg>`;
    const filtered = values.filter(v => v != null);
    if (!filtered.length) return `<svg width="${w}" height="${h}"></svg>`;
    if (filtered.length === 1) {
      return `<svg width="${w}" height="${h}"><circle cx="${w/2}" cy="${h/2}" r="3" fill="${color}"/></svg>`;
    }
    const min = Math.min(...filtered);
    const max = Math.max(...filtered);
    const range = max - min || 1;
    const pad = 3;
    const points = filtered.map((v, i) => {
      const x = pad + (i / (filtered.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    }).join(' ');
    const last = filtered[filtered.length - 1];
    const prev = filtered[filtered.length - 2];
    const dotColor = last >= prev ? 'var(--green)' : 'var(--red)';
    const lastX = pad + ((filtered.length - 1) / (filtered.length - 1)) * (w - pad * 2);
    const lastY = pad + (1 - (last - min) / range) * (h - pad * 2);
    return `<svg width="${w}" height="${h}"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${lastX}" cy="${lastY}" r="2.5" fill="${dotColor}"/></svg>`;
  }

  function getVenueHistory(venueName) {
    if (!historyData || !historyData.weeks) return null;
    const weeks = historyData.weeks;
    const ig = [], tt = [], eng = [];
    weeks.forEach(w => {
      // Check both venues and liv sections
      const d = (w.venues && w.venues[venueName]) || null;
      const livKey = venueName === 'LIV Nightclub' ? 'liv_nightclub' : venueName === 'LIV Beach' ? 'liv_beach' : null;
      const ld = livKey && w.liv ? w.liv[livKey] : null;
      const src = d || ld;
      if (src) {
        ig.push(src.ig_followers);
        tt.push(src.tt_followers);
        eng.push(src.ig_engage);
      }
    });
    return ig.length ? { ig, tt, eng } : null;
  }

  function sparklineRow(venueName) {
    const h = getVenueHistory(venueName);
    if (!h) return '';
    return `<div class="sparkline-row"><div class="sparkline-item"><span class="sparkline-label">IG</span>${sparklineSVG(h.ig, 'var(--ig)', 60, 24)}</div><div class="sparkline-item"><span class="sparkline-label">TT</span>${sparklineSVG(h.tt, '#fff', 60, 24)}</div><div class="sparkline-item"><span class="sparkline-label">Eng%</span>${sparklineSVG(h.eng, 'var(--gold)', 60, 24)}</div></div>`;
  }

  // ===== Analytics Tracking =====
  function track(event, params) {
    if (typeof gtag === 'function') gtag('event', event, params);
  }

  // ===== Tab Routing =====

  const TAB_ORDER = ['tabFeed', 'tabTrends', 'tabAnalytics', 'tabSettings'];
  const TAB_LABELS = { tabFeed: 'Feed', tabTrends: 'Trends', tabAnalytics: 'Analytics', tabSettings: 'Settings' };

  function switchToTab(tabId) {
    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (!btn) return;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('#' + tabId).classList.add('active');
    window.scrollTo(0, 0);
    track('tab_view', { tab_name: TAB_LABELS[tabId] || tabId });
    if (tabId === 'tabAnalytics' && !analyticsRendered) { renderAnalytics(); analyticsRendered = true; }
    if (tabId === 'tabSettings' && !settingsRendered) { renderSettings(); settingsRendered = true; }
  }

  function getActiveTabIndex() {
    const active = document.querySelector('.tab-btn.active');
    return active ? TAB_ORDER.indexOf(active.dataset.tab) : 0;
  }

  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // If tapping the already-active tab, scroll to top
        if (btn.classList.contains('active')) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        switchToTab(btn.dataset.tab);
      });
    });

    // Swipe navigation between tabs
    let touchStartX = 0;
    let touchStartY = 0;
    let swiping = false;
    const minSwipe = 60;
    const maxVertical = 80;

    document.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      swiping = true;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      if (!swiping) return;
      swiping = false;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) < minSwipe || Math.abs(dy) > maxVertical) return;
      const idx = getActiveTabIndex();
      if (dx < 0 && idx < TAB_ORDER.length - 1) switchToTab(TAB_ORDER[idx + 1]);
      if (dx > 0 && idx > 0) switchToTab(TAB_ORDER[idx - 1]);
    }, { passive: true });
  }

  // ===== AI Daily Brief =====

  function renderDailyBrief() {
    const bullets = [];

    // 1. Urgent alerts
    if (feedData.urgent_alert_count > 0) {
      const urgentVenues = (feedData.venues || []).filter(v => v.urgent).map(v => v.venue);
      bullets.push({ icon: '&#x1F6A8;', text: `${feedData.urgent_alert_count} urgent signal${feedData.urgent_alert_count > 1 ? 's' : ''}: ${urgentVenues.join(', ')}` });
    }

    // 2. Dark events (from analytics)
    if (analyticsData && analyticsData.social_dark_events && analyticsData.social_dark_events.length) {
      const de = analyticsData.social_dark_events[0];
      bullets.push({ icon: '&#x1F440;', text: `${de.venue} has ${de.talent} (${formatShortDate(de.event_date)}) — not posted yet` });
    }

    // 3. Top content gap
    if (feedData.content_gaps && feedData.content_gaps.length) {
      const top = feedData.content_gaps.sort((a, b) => (a.urgency === 'high' ? 0 : 1) - (b.urgency === 'high' ? 0 : 1))[0];
      bullets.push({ icon: '&#x26A1;', text: top.suggested_action || top.description });
    }

    // 4. Trending creator
    if (feedData.influencer_activity && feedData.influencer_activity.length) {
      const top = [...feedData.influencer_activity].sort((a, b) => (ENGAGEMENT_RANK[b.engagement_level] || 0) - (ENGAGEMENT_RANK[a.engagement_level] || 0))[0];
      const name = top.handle || (top.mention && top.mention.match(/@[\w.]+/) || [''])[0] || 'Creator';
      bullets.push({ icon: '&#x1F31F;', text: `${name} driving ${top.posts_found || ''} post${(top.posts_found || 0) !== 1 ? 's' : ''} — ${top.engagement_level} engagement` });
    }

    // 5. AI insight fallback
    if (analyticsData && analyticsData.weekly_ai_insight && bullets.length < 3) {
      const ins = analyticsData.weekly_ai_insight;
      if (ins.who_to_watch) bullets.push({ icon: '&#x1F50D;', text: `Watch ${ins.who_to_watch.venue}: ${ins.who_to_watch.reason}`.substring(0, 80) });
    }

    // Take top 3
    const top3 = bullets.slice(0, 3);
    if (!top3.length) return '';

    let html = '<div class="card daily-brief"><div class="brief-header">Today\'s Intel</div><div class="brief-bullets">';
    top3.forEach(b => {
      html += `<div class="brief-bullet"><span class="brief-icon">${b.icon}</span> ${escapeHTML(b.text)}</div>`;
    });
    html += '</div></div>';
    return html;
  }

  // ===== Social Feed Rendering =====

  function renderFeed() {
    if (!feedData || !feedData.venues) {
      feedContent.innerHTML = '<div class="empty-state">Waiting for first data refresh.<br>Runs daily at 12pm and 8pm PT.</div>';
      headerTimestamp.textContent = 'No data';
      freshnessDot.className = 'freshness-dot old';
      return;
    }

    const hoursAgo = getHoursAgo(feedData.run_at);
    freshnessDot.className = `freshness-dot ${freshnessClass(hoursAgo)}`;
    startCountdown();

    let html = '';

    // AI Daily Brief
    html += renderDailyBrief();

    // Market Pulse
    html += `<div class="card market-pulse"><div class="label">Market Pulse</div><div class="pulse-text">${escapeHTML(feedData.market_pulse)}</div></div>`;

    // Weekend Readiness (Feature 2) — Fri/Sat/Sun only
    if (isWeekend() && feedData.weekend_readiness) {
      html += renderWeekendReadiness(feedData.weekend_readiness);
    }

    // Content Gaps (Feature 3)
    if (feedData.content_gaps && feedData.content_gaps.length) {
      html += renderContentGaps(feedData.content_gaps);
    }

    // Dark Events — events on ticketing but NOT on social (from analytics data)
    if (analyticsData && analyticsData.social_dark_events && analyticsData.social_dark_events.length) {
      html += renderFeedDarkEvents(analyticsData.social_dark_events);
    }

    // Trending Influencers — top 3 from influencer_activity sorted by engagement
    if (feedData.influencer_activity && feedData.influencer_activity.length) {
      html += renderTrendingInfluencers(feedData.influencer_activity);
    }

    // Top 3 Posts
    html += renderTop3();

    // Creator Activity (Feature 5)
    if ((feedData.influencer_activity && feedData.influencer_activity.length) || (feedData.liv_outreach_targets && feedData.liv_outreach_targets.length)) {
      html += renderCreatorActivity(feedData.influencer_activity || [], feedData.liv_outreach_targets || []);
    }

    // Stories (Feature 9)
    if (feedData.story_activity && feedData.story_activity.length) {
      const fresh = feedData.story_activity.filter(s => getHoursAgo(s.detected_at) < 8);
      if (fresh.length) html += renderStories(fresh);
    }

    // Venue Cards
    html += '<div class="section-header">&#x1F4CA; Top Posts by Venue</div>';
    const sorted = [...feedData.venues].filter(v => shouldShowVenue(v.venue)).sort((a, b) => venueIndex(a.venue) - venueIndex(b.venue));
    sorted.forEach(v => { html += renderVenueCard(v); });

    feedContent.innerHTML = html;
    feedContent.querySelectorAll('.venue-header').forEach(hdr => {
      hdr.addEventListener('click', () => {
        const card = hdr.closest('.venue-card');
        card.classList.toggle('expanded');
        const name = hdr.querySelector('.venue-name');
        track('venue_expand', { venue: name ? name.textContent : 'unknown' });
      });
    });
    // Track outbound link clicks
    feedContent.querySelectorAll('a.card-link, a.audio-item-link').forEach(link => {
      link.addEventListener('click', () => {
        track('link_click', { link_url: link.href, link_text: link.textContent.trim().substring(0, 50) });
      });
    });
  }

  function renderWeekendReadiness(wr) {
    const label = (wr.label || 'MODERATE').toLowerCase();
    const score = wr.score || 0;
    const pct = (score / 10) * 100;
    return `
      <div class="card weekend-card ${label}">
        <div class="weekend-header">
          <span class="weekend-label">&#x1F3AF; Weekend Readiness</span>
          <span class="weekend-score ${label}">${score}<span class="weekend-score-max">/10</span></span>
        </div>
        <div class="score-bar"><div class="score-fill ${label}" style="width:${pct}%"></div></div>
        <span class="weekend-label-badge ${label}">${escapeHTML(wr.label)}</span>
        <ul class="weekend-factors">${(wr.factors || []).map(f => `<li>${escapeHTML(f)}</li>`).join('')}</ul>
        ${wr.liv_recommendation ? `<div class="weekend-action"><span class="weekend-action-prefix">LIV Action: </span>${escapeHTML(wr.liv_recommendation)}</div>` : ''}
      </div>`;
  }

  function renderContentGaps(gaps) {
    const sorted = [...gaps].sort((a, b) => {
      const o = { high: 0, medium: 1, low: 2 };
      return (o[a.urgency] ?? 9) - (o[b.urgency] ?? 9);
    });
    let html = '<div class="section-header" style="color:var(--orange)">&#x26A1; Content Gaps — Act Now</div>';
    sorted.forEach(g => {
      const u = (g.urgency || 'medium').toLowerCase();
      const typeLabel = (g.gap_type || '').replace(/_/g, ' ');
      html += `
        <div class="card gap-card ${u}">
          <div class="gap-header">
            <span class="gap-type">${escapeHTML(typeLabel)}</span>
            <span class="urgency-badge ${u}">${u.toUpperCase()}</span>
          </div>
          <div class="gap-desc">${escapeHTML(g.description)}</div>
          ${g.competitors_doing_it && g.competitors_doing_it.length ? `<div class="gap-competitors">${g.competitors_doing_it.length} competitor${g.competitors_doing_it.length !== 1 ? 's' : ''} doing this</div>` : ''}
          ${g.suggested_action ? `<div class="gap-suggestion">${escapeHTML(g.suggested_action)}</div>` : ''}
        </div>`;
    });
    return html;
  }

  function renderTop3() {
    const allPosts = [];
    (feedData.venues || []).filter(v => shouldShowVenue(v.venue)).forEach(v => {
      (v.raw_posts || []).forEach(p => { allPosts.push({ ...p, venue: v.venue, venueUrgent: v.urgent }); });
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
    let html = '<div class="section-header">&#x1F3C6; Top Posts This Cycle</div>';
    top.forEach((post, i) => {
      html += `
        <div class="card ranked-card">
          <div class="rank-number rank-${i + 1}">${i + 1}</div>
          <div class="ranked-body">
            <div class="ranked-venue">${escapeHTML(post.venue)}</div>
            <div class="ranked-summary">${escapeHTML(post.content_summary)}</div>
            <div class="ranked-meta">${platformBadgeHTML(post.platform)} ${engagementBadgeHTML(post.engagement_note)} <span>${formatDate(post.posted_at)}${stalePostBadge(post.posted_at)}</span></div>
          </div>
        </div>`;
    });
    return html;
  }

  function renderFeedDarkEvents(darkEvents) {
    // Show top 3 dark events sorted by soonest date
    const upcoming = [...darkEvents].sort((a, b) => new Date(a.event_date) - new Date(b.event_date)).slice(0, 3);
    if (!upcoming.length) return '';
    let html = '<div class="section-header" style="color:var(--orange)">&#x1F440; Not Yet On Social</div>';
    html += '<div class="card dark-feed-card">';
    html += '<div class="dark-feed-note">Listed on ticketing sites but competitors haven\'t posted yet</div>';
    upcoming.forEach(de => {
      const vUrl = venueProfileUrl(de.venue, 'ig');
      html += `<div class="dark-feed-item"><div class="dark-feed-venue">${linkWrap(vUrl, escapeHTML(de.venue))}</div><div class="dark-feed-talent">${escapeHTML(de.talent)}</div><div class="dark-feed-date">${formatShortDate(de.event_date)} · ${de.days_until_event != null ? de.days_until_event + 'd away' : ''}</div></div>`;
    });
    html += '</div>';
    return html;
  }

  function renderTrendingInfluencers(influencers) {
    // Pick top 3 by engagement (High > Normal > Low), then by posts_found
    const ranked = [...influencers].sort((a, b) => {
      const engA = ENGAGEMENT_RANK[(a.engagement_level || 'Normal')] || 2;
      const engB = ENGAGEMENT_RANK[(b.engagement_level || 'Normal')] || 2;
      if (engB !== engA) return engB - engA;
      return (b.posts_found || 0) - (a.posts_found || 0);
    }).slice(0, 3);

    if (!ranked.length) return '';
    let html = '<div class="section-header">&#x1F31F; Trending Creators</div><div class="card">';
    ranked.forEach((inf, i) => {
      const mention = inf.mention || inf.posted_about || '';
      let name = inf.handle || '';
      if (!name && mention) {
        const atMatch = mention.match(/@[\w.]+/);
        if (atMatch) name = atMatch[0];
      }
      const platformHtml = platformBadgeHTML(inf.platform);
      const url = name ? profileUrl(inf.platform, name) : '';
      const nameHtml = name ? linkWrap(url, escapeHTML(name)) + ' ' : '';
      html += `<div class="trending-influencer"><span class="trending-influencer-rank">${i + 1}</span><div class="trending-influencer-info"><div class="trending-influencer-name">${nameHtml}${platformHtml} ${engagementBadgeHTML(inf.engagement_level || 'Normal')}</div><div class="trending-influencer-why">${escapeHTML(mention)}</div></div></div>`;
    });
    html += '</div>';
    return html;
  }

  function renderCreatorActivity(influencers, targets) {
    let html = '<div class="section-header">&#x1F3A4; Creator Activity</div>';
    if (targets.length) {
      html += '<div class="section-header" style="font-size:13px;margin-top:8px;color:var(--gold)">&#x1F3AF; Outreach Opportunities</div><div class="card">';
      targets.forEach(t => {
        html += `
          <div class="outreach-item">
            <div class="outreach-handle">${escapeHTML(t.handle)} ${platformBadgeHTML(t.platform)}</div>
            <div class="creator-followers">${formatNum(t.follower_estimate)} followers</div>
            <div class="outreach-reason">${escapeHTML(t.reason)}</div>
            <div class="outreach-never">Never posted about LIV</div>
          </div>`;
      });
      html += '</div>';
    }
    if (influencers.length) {
      html += '<div class="section-header" style="font-size:13px;margin-top:8px">&#x1F4F1; Active This Cycle</div>';
      html += '<div class="creator-scroll">';
      influencers.forEach(inf => {
        // Support both {handle, posted_about, follower_estimate} and {mention, posts_found} schemas
        // Extract @handle from mention text if no explicit handle field
        let displayName = inf.handle || '';
        const mentionText = inf.posted_about || inf.mention || '';
        if (!displayName && mentionText) {
          const atMatch = mentionText.match(/@[\w.]+/);
          if (atMatch) displayName = atMatch[0];
        }
        const engLevel = (inf.engagement_level || 'Normal');
        const engNorm = engLevel.charAt(0).toUpperCase() + engLevel.slice(1).toLowerCase();
        const followersLine = inf.follower_estimate ? `<div class="creator-followers">${formatNum(inf.follower_estimate)} followers</div>` : '';
        const postsLine = inf.posts_found ? `<div class="creator-followers">${inf.posts_found} post${inf.posts_found !== 1 ? 's' : ''} found</div>` : '';
        const chipUrl = displayName ? profileUrl(inf.platform, displayName) : '';
        const chipNameHtml = displayName ? linkWrap(chipUrl, escapeHTML(displayName)) + ' ' : '';
        html += `
          <div class="creator-chip">
            <div class="creator-handle">${chipNameHtml}${platformBadgeHTML(inf.platform)}</div>
            ${followersLine || postsLine}
            <div class="creator-mention">${escapeHTML(mentionText)}</div>
            ${engagementBadgeHTML(engNorm === 'High' ? 'High' : engNorm === 'Low' ? 'Low' : 'Normal')}
          </div>`;
      });
      html += '</div>';
    }
    return html;
  }

  function renderStories(stories) {
    let html = '<div class="section-header">&#x1F4F8; Stories Detected</div>';
    stories.forEach(s => {
      const urgCls = s.urgency ? ' urgent' : '';
      const typeCls = s.content_type || '';
      html += `
        <div class="card story-card${urgCls}">
          <div class="story-venue">${escapeHTML(s.venue)} <span class="story-type ${typeCls}">${escapeHTML((s.content_type || '').replace(/_/g, ' '))}</span></div>
          <div class="story-summary">${escapeHTML(s.summary)}</div>
          <div class="story-time">${timeAgo(s.detected_at)}</div>
        </div>`;
    });
    return html;
  }

  function renderVenueCard(venue) {
    const showSeasonal = isSeasonalOff(venue.venue) && venue.posts_found === 0 && !venue.urgent;
    const urgentDot = venue.urgent ? '<span class="urgent-dot"></span>' : '';
    const isLiv = isLivVenue(venue.venue);
    const livCls = isLiv ? ' liv' : '';
    const livBadge = isLiv ? '<span class="liv-badge">LIV</span>' : '';
    let postsHTML = '';
    if (venue.raw_posts && venue.raw_posts.length > 0) {
      venue.raw_posts.forEach(p => {
        postsHTML += `<div class="venue-post"><div class="venue-post-meta">${platformBadgeHTML(p.platform)} ${engagementBadgeHTML(p.engagement_note)} <span>${formatDate(p.posted_at)}${stalePostBadge(p.posted_at)}</span></div><div class="venue-post-summary">${escapeHTML(p.content_summary)}</div></div>`;
      });
    } else {
      postsHTML = '<div class="no-posts">No posts detected this cycle</div>';
    }
    return `
      <div class="card venue-card${livCls}">
        <div class="venue-header">${urgentDot}${livBadge}<span class="venue-name">${escapeHTML(venue.venue)}</span><span class="venue-count">${venue.posts_found} post${venue.posts_found !== 1 ? 's' : ''}</span><span class="venue-chevron">&#x25BE;</span></div>
        ${venue.flags && venue.flags.length ? `<div class="venue-flags">${flagPillsHTML(venue.flags)}</div>` : ''}
        <div class="venue-summary">${escapeHTML(venue.summary)}</div>
        ${showSeasonal ? '<div class="seasonal-banner">Seasonal — Off</div>' : ''}
        <div class="venue-posts">${postsHTML}</div>
      </div>`;
  }

  // ===== Trends Rendering =====

  function renderTrends() {
    if (!trendsData) {
      trendsContent.innerHTML = '<div class="empty-state">First trend digest arrives Monday at 8am PT.<br>Check back then.</div>';
      return;
    }

    const weekOf = trendsData.week_of;
    const now = new Date();
    const trendWeek = new Date(weekOf);
    const daysSince = (now - trendWeek) / (1000 * 60 * 60 * 24);
    const isStale = daysSince > 7;

    let html = `<div class="trends-header"><span class="trends-title">Weekly Trend Digest</span><span class="trends-week">Week of ${formatDate(weekOf)}</span></div>`;
    if (isStale) html += '<div class="trends-stale-banner">Next digest Monday at 8am PT</div>';

    // Platform Updates
    html += '<div class="section-header">&#x26A1; Platform Updates</div>';
    (trendsData.platform_updates || []).forEach(pu => {
      const actionCls = pu.action_required ? ' action-required' : '';
      html += `<div class="card platform-update-card${actionCls}"><div class="platform-update-name">${escapeHTML(pu.platform)}${pu.action_required ? ' <span class="action-badge">ACTION REQUIRED</span>' : ''}</div><div class="ranked-summary">${escapeHTML(pu.update)}</div><div class="platform-update-detail">${escapeHTML(pu.detail)}</div></div>`;
    });

    // Search Trends (Feature 8)
    if (trendsData.search_trends) {
      html += renderSearchTrends(trendsData.search_trends);
    }

    // Content Formats
    html += '<div class="section-header">&#x1F3AC; Content Formats Trending Now</div><div class="card">';
    (trendsData.top_content_formats || []).forEach(fmt => {
      html += `<div class="format-item"><div class="format-name">${escapeHTML(fmt.format)}</div><div class="format-why">${escapeHTML(fmt.why_it_works)}</div><div class="format-liv"><span class="format-liv-prefix">For LIV: </span>${escapeHTML(fmt.liv_application)}</div></div>`;
    });
    html += '</div>';

    // Trending Audio
    html += '<div class="section-header">&#x1F3B5; Trending Audio</div>';
    if (trendsData.trending_audio && trendsData.trending_audio.length) {
      html += '<div class="card">';
      trendsData.trending_audio.forEach(a => {
        const q = encodeURIComponent((a.sound || '') + ' ' + (a.artist || '') + ' tiktok sound');
        const audioUrl = `https://www.google.com/search?q=${q}`;
        html += `<a href="${audioUrl}" target="_blank" rel="noopener" class="audio-item-link"><div class="audio-item"><div class="audio-info"><div class="audio-name">${escapeHTML(a.sound)}</div><div class="audio-artist">${escapeHTML(a.artist)}</div><div class="audio-relevance">${escapeHTML(a.relevance)}</div></div>${platformBadgeHTML(a.platform)}</div></a>`;
      });
      html += '</div>';
    } else { html += '<div class="card"><div class="no-posts">No standout audio trends this cycle</div></div>'; }

    // Viral Nightlife
    if (trendsData.viral_nightlife_content) {
      const vnc = trendsData.viral_nightlife_content;
      html += '<div class="section-header">&#x1F525; What\'s Working in Nightlife</div>';
      html += `<div class="card"><div class="viral-summary">${escapeHTML(vnc.summary)}</div>${vnc.standout_example ? `<div class="viral-standout">${escapeHTML(vnc.standout_example)}</div>` : ''}${vnc.theme ? `<span class="theme-pill">${escapeHTML(vnc.theme)}</span>` : ''}</div>`;
    }

    // Audience Signals
    if (trendsData.audience_signals) {
      const as = trendsData.audience_signals;
      html += '<div class="section-header">&#x1F465; Audience Signals</div>';
      html += `<div class="card"><div class="audience-behavior">${escapeHTML(as.behavior_shift)}</div>${as.upcoming_moments && as.upcoming_moments.length ? `<div class="moments-scroll">${as.upcoming_moments.map(m => `<span class="moment-pill">${escapeHTML(m)}</span>`).join('')}</div>` : ''}</div>`;
    }

    // Recommendations
    if (trendsData.this_week_recommendations && trendsData.this_week_recommendations.length) {
      html += '<div class="section-header">&#x1F3AF; This Week — Act On This</div>';
      [...trendsData.this_week_recommendations].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)).forEach(rec => {
        const pri = (rec.priority || 'MEDIUM').toLowerCase();
        html += `<div class="card rec-card ${pri}"><div class="rec-header"><span class="priority-badge ${pri}">${rec.priority}</span>${platformBadgeHTML(rec.platform)}</div><div class="rec-action">${escapeHTML(rec.action)}</div><div class="rec-rationale">${escapeHTML(rec.rationale)}</div></div>`;
      });
    }

    trendsContent.innerHTML = html;
    trendsContent.querySelectorAll('a.card-link, a.audio-item-link').forEach(link => {
      link.addEventListener('click', () => {
        track('link_click', { link_url: link.href, link_text: link.textContent.trim().substring(0, 50) });
      });
    });
  }

  function renderSearchTrends(st) {
    let html = '<div class="section-header">&#x1F50D; Search Trends</div><div class="card">';
    if (st.rising_venues && st.rising_venues.length) {
      st.rising_venues.forEach(v => {
        html += `<div class="trend-item"><span class="trend-arrow up">&#x2191;</span><div><div class="trend-venue">${escapeHTML(v.venue)}</div><div class="trend-driver">${escapeHTML(v.driver)}</div></div></div>`;
      });
    }
    if (st.declining_venues && st.declining_venues.length) {
      st.declining_venues.forEach(v => {
        html += `<div class="trend-item"><span class="trend-arrow down">&#x2193;</span><div><div class="trend-venue">${escapeHTML(v.venue)}</div><div class="trend-driver">${escapeHTML(v.driver)}</div></div></div>`;
      });
    }
    if (st.rising_artists && st.rising_artists.length) {
      html += '<div class="trend-artist-pills">';
      st.rising_artists.forEach(a => { html += `<span class="trend-artist-pill">${escapeHTML(a)} &#x2191;</span>`; });
      html += '</div>';
    }
    const livTrend = st.liv_search_trend === 'up' ? '&#x2191;' : st.liv_search_trend === 'down' ? '&#x2193;' : '&#x2192;';
    const mktTrend = st.market_search_trend === 'up' ? '&#x2191;' : st.market_search_trend === 'down' ? '&#x2193;' : '&#x2192;';
    html += `<div class="trend-market">Market: ${mktTrend} ${escapeHTML(st.market_search_trend || 'stable')} &nbsp;|&nbsp; LIV: ${livTrend} ${escapeHTML(st.liv_search_trend || 'stable')}</div>`;
    html += '</div>';
    return html;
  }

  // ===== Analytics Rendering =====

  function renderAnalytics() {
    if (!analyticsData) {
      analyticsContent.innerHTML = '<div class="empty-state">Analytics data arrives Sunday at 9am PT.<br>Check back then.</div>';
      return;
    }

    let html = '';
    // Wrap each section in try/catch so one bad render doesn’t crash the whole tab
    const safe = (fn, label) => { try { return fn(); } catch(e) { console.error('renderAnalytics section failed:', label, e); return ''; } };
    html += `<div class="trends-header"><span class="trends-title">Weekly Analytics</span><span class="trends-week">Week of ${formatDate(analyticsData.week_of)}</span></div>`;

    // LIV vs Market — support both liv_accounts and liv_vs_market key names
    const livAccounts = analyticsData.liv_accounts || analyticsData.liv_vs_market;
    if (livAccounts) html += safe(() => renderLivVsMarket(livAccounts), 'LivVsMarket');

    // Leaderboard — support both cross_venue_rankings and account_stats
    const rankings = analyticsData.cross_venue_rankings || analyticsData.account_stats;
    if (rankings) html += safe(() => renderLeaderboard(rankings), 'Leaderboard');

    // Event Radar — event_discovery may be a dict with .sample_events and .social_dark_events inside
    const evtDisc = analyticsData.event_discovery;
    const darkEvts = analyticsData.social_dark_events ||
      (evtDisc && !Array.isArray(evtDisc) ? evtDisc.social_dark_events : null) || [];
    const evtList = Array.isArray(evtDisc) ? evtDisc :
      (evtDisc && evtDisc.sample_events ? evtDisc.sample_events : []);
    if (evtList.length || darkEvts.length) {
      html += safe(() => renderEventRadar(evtList, darkEvts), 'EventRadar');
    }

    // AI Insight
    if (analyticsData.weekly_ai_insight) html += safe(() => renderAIInsight(analyticsData.weekly_ai_insight), 'AIInsight');

    // Hashtag Intelligence
    if (analyticsData.hashtag_tracker) html += safe(() => renderHashtagIntel(analyticsData.hashtag_tracker), 'HashtagIntel');

    // Time Intelligence
    if (analyticsData.time_intelligence) html += safe(() => renderTimeIntelligence(analyticsData.time_intelligence), 'TimeIntel');

    // Patterns — historical_patterns may be a dict with .detected_patterns inside
    const hpRaw = analyticsData.historical_patterns;
    const hpList = Array.isArray(hpRaw) ? hpRaw : (hpRaw && hpRaw.detected_patterns ? hpRaw.detected_patterns : []);
    const upcomingPat = (hpRaw && hpRaw.upcoming_pattern_events) || analyticsData.upcoming_pattern_events || [];
    if (hpList.length) html += safe(() => renderPatterns(hpList, upcomingPat), 'Patterns');

    // Venue Deep Dive
    const analyticsVenues = analyticsData.venues;
    if (analyticsVenues && analyticsVenues.length) html += safe(() => renderAnalyticsVenues(analyticsVenues), 'VenueDive');

    analyticsContent.innerHTML = html;
    analyticsContent.querySelectorAll('.analytics-venue-card .venue-header').forEach(hdr => {
      hdr.addEventListener('click', () => {
        const card = hdr.closest('.analytics-venue-card');
        card.classList.toggle('expanded');
        const name = hdr.querySelector('.venue-name');
        track('venue_expand', { venue: name ? name.textContent : 'unknown', tab: 'Analytics' });
      });
    });
    analyticsContent.querySelectorAll('a.card-link').forEach(link => {
      link.addEventListener('click', () => {
        track('link_click', { link_url: link.href, link_text: link.textContent.trim().substring(0, 50) });
      });
    });
  }

  function renderLivVsMarket(liv) {
    let html = '<div class="section-header">&#x1F4CD; LIV vs Market</div><div class="liv-compare-row">';

    // Support two schemas:
    // Old: { liv_nightclub: { instagram: {followers, engagement_rate_pct}, tiktok: {}, vs_market: {} } }
    // New: { liv_nightclub_positioning: { follower_count, engagement_rate, follower_rank, engagement_rank, competitive_summary } }
    const keyMap = [
      { old: 'liv_nightclub', new: 'liv_nightclub_positioning', label: 'LIV Nightclub' },
      { old: 'liv_beach',     new: 'liv_beach_positioning',     label: 'LIV Beach' },
    ];

    keyMap.forEach(({ old: oldKey, new: newKey, label }) => {
      const acct = liv[oldKey] || liv[newKey];
      if (!acct) return;

      // Detect which schema
      const isNew = !!(liv[newKey] && !liv[oldKey]);
      html += `<div class="liv-card"><div class="liv-card-title">${label}</div>`;

      if (isNew || acct.follower_count != null) {
        // New schema — flat positioning object
        const rankBadge = (r) => { if (!r) return ''; const cls = r <= 2 ? 'top' : r <= 4 ? 'mid' : 'low'; return `<span class="rank-badge ${cls}">#${r}</span>`; };
        html += `<div class="liv-stat"><span class="liv-stat-label">Followers</span><span class="liv-stat-value">${formatNum(acct.follower_count)}${rankBadge(acct.follower_rank)}</span></div>`;
        html += `<div class="liv-stat"><span class="liv-stat-label">Engagement</span><span class="liv-stat-value">${acct.engagement_rate || '—'}${rankBadge(acct.engagement_rank)}</span></div>`;
        if (acct.posts_per_week) html += `<div class="liv-stat"><span class="liv-stat-label">Posts/week</span><span class="liv-stat-value">${acct.posts_per_week}</span></div>`;
        if (acct.competitive_summary) html += `<div class="time-insight" style="margin-top:6px">${escapeHTML(acct.competitive_summary)}</div>`;
      } else {
        // Old schema — nested instagram/tiktok/vs_market
        const ig = acct.instagram || {};
        const tt = acct.tiktok || {};
        const vm = acct.vs_market || {};
        html += `<div class="liv-stat"><span class="liv-stat-label">IG Followers</span><span class="liv-stat-value">${formatNum(ig.followers)}</span></div>`;
        html += `<div class="liv-stat"><span class="liv-stat-label">IG Engage</span><span class="liv-stat-value">${ig.engagement_rate_pct || '—'}%</span></div>`;
        html += `<div class="liv-stat"><span class="liv-stat-label">TT Followers</span><span class="liv-stat-value">${formatNum(tt.followers)}</span></div>`;
        html += `<div class="liv-stat"><span class="liv-stat-label">TT Engage</span><span class="liv-stat-value">${tt.engagement_rate_pct || '—'}%</span></div>`;
        const delta = ig.follower_30d_delta || 0;
        const deltaClass = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
        html += `<div class="liv-stat"><span class="liv-stat-label">30d Delta</span><span class="liv-delta ${deltaClass}">${delta > 0 ? '+' : ''}${formatNum(delta)}</span></div>`;
        const rankBadge = (r) => { const cls = r <= 2 ? 'top' : r <= 4 ? 'mid' : 'low'; return `<span class="rank-badge ${cls}">#${r} of 8</span>`; };
        html += `<div class="liv-stat"><span class="liv-stat-label">Followers Rank</span>${rankBadge(vm.follower_rank || 0)}</div>`;
        html += `<div class="liv-stat"><span class="liv-stat-label">Engage Rank</span>${rankBadge(vm.engagement_rank || 0)}</div>`;
      }
      html += sparklineRow(label);
      html += '</div>';
    });

    html += '</div>';
    return html;
  }

  function renderLeaderboard(rankings) {
    let html = '<div class="section-header">&#x1F3C6; Leaderboard</div>';
    if (rankings.top_3_posts_overall) {
      rankings.top_3_posts_overall.forEach((p, i) => {
        const vUrl = venueProfileUrl(p.venue, p.platform);
        html += `<div class="card ranked-card"><div class="rank-number rank-${i + 1}">${i + 1}</div><div class="ranked-body"><div class="ranked-venue">${linkWrap(vUrl, escapeHTML(p.venue))}</div><div class="ranked-summary">${escapeHTML(p.summary)}</div><div class="ranked-meta">${platformBadgeHTML(p.platform)} <span>${p.engagement_rate}% eng</span> <span>${escapeHTML(p.reach)} reach</span></div></div></div>`;
      });
    }
    let statsHTML = '<div class="card">';
    if (rankings.fastest_growing_account) {
      const fg = rankings.fastest_growing_account;
      statsHTML += `<div style="padding:6px 0;border-bottom:1px solid var(--border)"><span style="font-size:12px;color:var(--text-secondary)">Fastest Growing</span><br><strong>${escapeHTML(fg.venue)}</strong> · ${escapeHTML(fg.platform)} · <span style="color:var(--green)">${escapeHTML(fg.growth_rate)}</span></div>`;
    }
    if (rankings.most_active_venue) {
      const ma = rankings.most_active_venue;
      statsHTML += `<div style="padding:6px 0;border-bottom:1px solid var(--border)"><span style="font-size:12px;color:var(--text-secondary)">Most Active</span><br><strong>${escapeHTML(ma.venue)}</strong> · ${ma.total_posts} posts this week</div>`;
    }
    if (rankings.went_dark && rankings.went_dark.length) {
      rankings.went_dark.forEach(wd => {
        statsHTML += `<div style="padding:6px 0"><span style="font-size:12px;color:var(--orange)">&#x26A0; Went Dark</span><br><strong>${escapeHTML(wd.venue)}</strong> · ${wd.days_silent} days silent</div>`;
      });
    }
    statsHTML += '</div>';
    html += statsHTML;
    return html;
  }

  function renderEventRadar(events, darkEvents) {
    let html = '<div class="section-header">&#x1F3AB; Event Radar — Next 30 Days</div>';

    if (darkEvents.length) {
      html += '<div class="section-header" style="font-size:13px;color:var(--orange)">&#x1F440; Not Yet On Social</div>';
      html += '<div class="card dark-event-card"><div class="dark-event-note">Listed on ticketing sites but not yet announced on social media</div>';
      darkEvents.forEach(de => {
        html += `<div class="event-item"><span class="event-venue">${escapeHTML(de.venue)}</span><span class="event-talent">${escapeHTML(de.talent)}</span><span style="font-size:11px;color:var(--text-secondary)">${formatShortDate(de.event_date)}</span></div>`;
      });
      html += '</div>';
    }

    if (events.length) {
      html += '<div class="section-header" style="font-size:13px">&#x1F4C5; Full Calendar</div><div class="card">';
      const grouped = {};
      events.forEach(e => { const d = e.event_date; if (!grouped[d]) grouped[d] = []; grouped[d].push(e); });
      Object.keys(grouped).sort().forEach(date => {
        html += `<div class="event-date-group"><div class="event-date-label">${formatShortDate(date)}</div>`;
        grouped[date].forEach(e => {
          const srcCls = e.source === 'social' ? 'social' : e.source === 'ticketing' ? 'ticketing' : e.source === 'discotech' ? 'discotech' : '';
          html += `<div class="event-item"><span class="event-venue">${escapeHTML(e.venue)}</span><span class="event-talent">${escapeHTML(e.talent)}</span><span class="source-badge ${srcCls}">${escapeHTML(e.source)}</span></div>`;
        });
        html += '</div>';
      });
      html += '</div>';
    }
    return html;
  }

  function renderAIInsight(insight) {
    let html = '<div class="section-header">&#x1F9E0; AI Insight</div>';
    html += `<div class="card insight-card"><div class="insight-label">Competitive Takeaway</div><div class="insight-text">${escapeHTML(insight.competitive_takeaway)}</div>`;
    html += `<div class="insight-highlight"><div class="insight-highlight-label">Biggest LIV Opportunity</div><div class="insight-highlight-text">${escapeHTML(insight.biggest_opportunity_for_liv)}</div></div>`;
    // who_to_watch may be a single object or an array — handle both
    if (insight.who_to_watch) {
      const wtw = Array.isArray(insight.who_to_watch) ? insight.who_to_watch[0] : insight.who_to_watch;
      if (wtw && wtw.venue) {
        html += `<div style="font-size:12px;margin-bottom:6px"><span style="color:var(--gold);font-weight:700">Who to Watch:</span> ${escapeHTML(wtw.venue)} — ${escapeHTML(wtw.reason)}</div>`;
      }
    }
    // content_format_winner may be a {format, why} object or a plain string
    if (insight.content_format_winner) {
      const cfw = insight.content_format_winner;
      if (typeof cfw === 'object' && cfw.format) {
        html += `<div style="font-size:12px"><span style="color:var(--gold);font-weight:700">Winning Format:</span> ${escapeHTML(cfw.format)} — ${escapeHTML(cfw.why)}</div>`;
      } else if (typeof cfw === 'string') {
        // Plain string — show first sentence as the format summary
        const short = cfw.split('.')[0];
        html += `<div style="font-size:12px"><span style="color:var(--gold);font-weight:700">Winning Format:</span> ${escapeHTML(short)}</div>`;
      }
    }
    html += '</div>';
    return html;
  }

  function renderHashtagIntel(tracker) {
    let html = '<div class="section-header">&#x0023;&#xFE0F;&#x20E3; Hashtag Intelligence</div>';

    const renderPillRow = (label, items, cls) => {
      if (!items) return '';
      // items may be: array of strings, array of {tag,trend} objects, or a plain object (dict keyed by tag)
      let entries = [];
      if (Array.isArray(items)) {
        entries = items.map(h => ({
          tag: (typeof h === 'string') ? h : (h.tag || h),
          trend: (typeof h === 'object' && h.trend) ? h.trend : ''
        }));
      } else if (typeof items === 'object') {
        // dict like { '#livnightclub': { trend: '...', ... }, ... }
        entries = Object.entries(items).map(([tag, meta]) => ({
          tag,
          trend: (meta && meta.trend) ? meta.trend : ''
        }));
      }
      if (!entries.length) return '';
      let r = `<div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin:8px 0 6px">${label}</div><div class="hashtag-scroll">`;
      entries.forEach(({ tag, trend }) => {
        const arrow = /growing|up|increase/i.test(trend) ? ' ↑' : /declin|down|drop/i.test(trend) ? ' ↓' : '';
        r += `<span class="hashtag-pill ${cls}">${escapeHTML(tag)}${arrow}</span>`;
      });
      r += '</div>';
      return r;
    };

    // Support both old key names (liv_hashtags) and new (liv_tags)
    html += '<div class="card">';
    html += renderPillRow('Competitor Tags', tracker.competitor_hashtags || tracker.competitor_tags, 'stable');
    html += renderPillRow('Market Tags', tracker.market_hashtags || tracker.market_tags, 'stable');
    html += renderPillRow('LIV Tags', tracker.liv_hashtags || tracker.liv_tags, 'up');

    if (tracker.untapped_opportunities && tracker.untapped_opportunities.length) {
      html += '<div style="font-size:12px;font-weight:600;color:var(--gold);margin:12px 0 6px">&#x1F4A1; Untapped Opportunities</div>';
      tracker.untapped_opportunities.forEach(u => {
        // u may be an object {tag, suggestion} or a plain string like "#tag (volume; note)"
        if (typeof u === 'object' && u.tag) {
          html += `<div style="margin-bottom:8px"><span class="hashtag-pill opportunity">${escapeHTML(u.tag)}</span><div class="hashtag-suggestion">${escapeHTML(u.suggestion || '')}</div></div>`;
        } else if (typeof u === 'string') {
          // Parse "#tag (volume; description)" format
          const match = u.match(/^(#\S+)\s*(.*)$/);
          const tag = match ? match[1] : u;
          const note = match ? match[2].replace(/^\(|\)$/g, '') : '';
          html += `<div style="margin-bottom:8px"><span class="hashtag-pill opportunity">${escapeHTML(tag)}</span>${note ? `<div class="hashtag-suggestion">${escapeHTML(note)}</div>` : ''}</div>`;
        }
      });
    }
    html += '</div>';
    return html;
  }

  function renderTimeIntelligence(ti) {
    let html = '<div class="section-header">&#x23F0; Best Times to Post</div>';
    // Support both old schema (peak_windows_by_platform.instagram) and
    // new schema (instagram_analysis, tiktok_analysis, twitter_x_analysis)
    const platMap = [
      { key: 'instagram', newKey: 'instagram_analysis', label: 'IG', cls: 'ig' },
      { key: 'tiktok',    newKey: 'tiktok_analysis',    label: 'TT', cls: 'tt' },
      { key: 'x',         newKey: 'twitter_x_analysis', label: 'X',  cls: 'x'  },
    ];
    const oldPlatforms = ti.peak_windows_by_platform || {};
    const oldRecs = ti.liv_recommendation || {};

    platMap.forEach(({ key, newKey, label, cls }) => {
      const data = oldPlatforms[key] || ti[newKey];
      if (!data) return;
      const best = new Set(data.best_hours || []);
      const worst = new Set(data.worst_hours || []);
      const rec = oldRecs[key] || data.liv_recommendation || data.liv_current_status || '';
      // opportunity_window may be missing (e.g. Twitter) — fall back to best_use or highest_engagement_time
      const opportunity = data.opportunity_window || data.best_use || data.highest_engagement_time || '';
      const hasBars = best.size > 0 || worst.size > 0;

      html += `<div class="card time-card"><div class="time-card-header"><span class="platform-badge ${cls}">${label}</span><span style="font-size:12px;color:var(--text-secondary)">${escapeHTML(opportunity)}</span></div>`;
      if (hasBars) {
        html += '<div class="time-bar">';
        for (let h = 0; h < 24; h++) {
          const c = best.has(h) ? 'best' : worst.has(h) ? 'worst' : '';
          html += `<div class="time-hour ${c}" title="${h}:00"></div>`;
        }
        html += '</div>';
        html += '<div class="time-labels"><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span></div>';
      }
      if (rec) html += `<div class="time-insight">${escapeHTML(rec)}</div>`;
      html += '</div>';
    });
    return html;
  }

  function renderPatterns(patterns, upcoming) {
    let html = '<div class="section-header">&#x1F4DA; Patterns</div>';
    patterns.forEach(p => {
      const pConf = String(p.confidence ?? '');
      html += `<div class="card pattern-card"><div class="pattern-name">${escapeHTML(p.venue)} <span class="pattern-confidence ${pConf.toLowerCase()}">${escapeHTML(pConf)}</span></div><div class="pattern-desc">${escapeHTML(p.pattern)}</div>`;
      if (p.based_on_weeks) html += `<div class="pattern-meta">Based on ${p.based_on_weeks} weeks of data</div>`;
      if (p.next_expected) html += `<div class="pattern-next">Next expected: ${formatShortDate(p.next_expected)}</div>`;
      if (p.liv_action) html += `<div class="pattern-action">${escapeHTML(p.liv_action)}</div>`;
      html += '</div>';
    });

    if (upcoming.length) {
      html += '<div class="section-header" style="font-size:13px">&#x1F52E; Predicted This Week</div><div class="card">';
      upcoming.forEach(u => {
        const uConf = String(u.confidence ?? '');
        html += `<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:13px"><span style="color:var(--gold);font-weight:600">${formatShortDate(u.date)}</span> · <strong>${escapeHTML(u.venue || u.event || '')}</strong><br><span style="color:var(--text-secondary)">${escapeHTML(u.expected_action || u.liv_opportunity || '')}</span> <span class="pattern-confidence ${uConf.toLowerCase()}">${uConf}</span></div>`;
      });
      html += '</div>';
    }
    return html;
  }

  function renderAnalyticsVenues(venues) {
    let html = '<div class="section-header">&#x1F3E2; Venue Deep Dive</div>';
    const sorted = [...venues].filter(v => shouldShowVenue(v.name)).sort((a, b) => venueIndex(a.name) - venueIndex(b.name));

    sorted.forEach(v => {
      const ig = v.accounts?.instagram || {};
      const tt = v.accounts?.tiktok || {};

      const vConf = String(v.confidence ?? '');
      html += `<div class="card analytics-venue-card"><div class="venue-header"><span class="venue-name">${escapeHTML(v.name)}</span><span class="confidence-badge ${vConf.toLowerCase()}">${escapeHTML(vConf)}</span><span class="venue-chevron">&#x25BE;</span></div>`;

      // Collapsed stats
      html += `<div class="analytics-stats-row"><span class="analytics-stat-chip"><strong>${formatNum(ig.followers)}</strong> IG</span><span class="analytics-stat-chip"><strong>${formatNum(tt.followers)}</strong> TT</span><span class="analytics-stat-chip"><strong>${ig.engagement_rate_pct || '—'}%</strong> eng</span></div>`;
      html += sparklineRow(v.name);

      // Expanded
      html += '<div class="venue-posts">';

      // Top posts
      if (v.top_posts && v.top_posts.length) {
        html += '<div class="sub-section-title">Top Posts</div>';
        v.top_posts.forEach(tp => {
          html += `<div class="venue-post"><div class="venue-post-meta">${platformBadgeHTML(tp.platform)} <span>${tp.engagement_rate}% eng</span> <span>${escapeHTML(tp.estimated_reach)} reach</span></div><div class="venue-post-summary">${escapeHTML(tp.content_summary)}</div>`;
          // Sentiment (Feature 6)
          if (tp.comment_sentiment) {
            const cs = tp.comment_sentiment;
            const scoreColor = cs.score >= 7 ? 'var(--green)' : cs.score >= 4 ? '#EAB308' : 'var(--red)';
            html += `<div style="margin-top:6px"><span style="font-size:11px;color:var(--text-secondary)">Sentiment:</span> <span style="font-size:13px;font-weight:700;color:${scoreColor}">${cs.score}/10</span> <span style="font-size:11px;color:var(--text-secondary)">${escapeHTML(cs.overall)}</span></div>`;
            if (cs.themes && cs.themes.length) {
              html += '<div class="sentiment-themes">';
              cs.themes.forEach(t => { html += `<span class="sentiment-theme">${escapeHTML(t)}</span>`; });
              html += '</div>';
            }
            if (cs.opportunity) html += '<div class="opportunity-flag">&#x26A0;&#xFE0F; Negative sentiment — potential LIV opportunity</div>';
          }
          html += '</div>';
        });
      }

      // Reviews (Feature 7)
      if (v.reviews) {
        const rv = v.reviews;
        html += '<div class="sub-section"><div class="sub-section-title">&#x2B50; Review Pulse</div>';
        html += '<div class="review-ratings">';
        if (rv.google_rating != null) html += `<span class="review-rating ${ratingClass(rv.google_rating)}">${rv.google_rating} <span class="review-rating-label">Google</span></span>`;
        if (rv.yelp_rating != null) html += `<span class="review-rating ${ratingClass(rv.yelp_rating)}">${rv.yelp_rating} <span class="review-rating-label">Yelp</span></span>`;
        if (rv.tripadvisor_rating != null) html += `<span class="review-rating ${ratingClass(rv.tripadvisor_rating)}">${rv.tripadvisor_rating} <span class="review-rating-label">TripAdv</span></span>`;
        html += '</div>';
        if (rv.velocity) html += `<span class="velocity-badge ${rv.velocity}">${escapeHTML(rv.velocity)}</span> <span style="font-size:11px;color:var(--text-secondary)">${escapeHTML(rv.new_reviews_estimate)}</span>`;
        if (rv.positive_themes && rv.positive_themes.length) {
          html += '<div class="review-themes">';
          rv.positive_themes.forEach(t => { html += `<span class="review-theme positive">${escapeHTML(t)}</span>`; });
          if (rv.negative_themes) rv.negative_themes.forEach(t => { html += `<span class="review-theme negative">${escapeHTML(t)}</span>`; });
          html += '</div>';
        }
        if (rv.incident_flag) html += `<div class="incident-banner">&#x26A0;&#xFE0F; ${escapeHTML(rv.incident_detail || 'Incident flagged in recent reviews')}</div>`;
        html += '</div>';
      }

      // Platform Strategy (Feature 12)
      if (v.consistency_score) {
        const cs = v.consistency_score;
        const scoreColor = cs.score >= 7 ? 'good' : cs.score >= 4 ? 'ok' : 'bad';
        html += `<div class="sub-section"><div class="sub-section-title">Platform Strategy</div>`;
        html += `<div style="display:flex;align-items:center;gap:8px"><span class="strategy-score ${scoreColor}">${cs.score}</span><span style="font-size:13px;font-weight:600">/10 — ${escapeHTML(cs.label)}</span></div>`;
        if (cs.tailoring_signals && cs.tailoring_signals.length) {
          cs.tailoring_signals.forEach(s => { html += `<div class="strategy-text">• ${escapeHTML(s)}</div>`; });
        }
        if (cs.opportunity) html += `<div class="strategy-text" style="color:var(--gold);font-style:italic;margin-top:6px">${escapeHTML(cs.opportunity)}</div>`;
        html += '</div>';
      }

      html += '</div></div>'; // close venue-posts + analytics-venue-card
    });
    return html;
  }

  // ===== Settings Rendering =====

  function renderSettings() {
    const s = getSettings();
    let html = '<div class="section-header">&#x2699;&#xFE0F; Settings</div>';

    // Integrations
    html += '<div class="card settings-group"><div class="settings-group-title">Integrations</div>';
    html += `<div><div class="settings-label">Slack Webhook URL<div class="settings-label-sub">Paste your Slack incoming webhook URL</div></div><input class="settings-input" type="url" id="settSlack" placeholder="https://hooks.slack.com/..." value="${escapeHTML(s.slackWebhookUrl)}"></div>`;
    html += `<div style="margin-top:12px"><div class="settings-label">WhatsApp Number<div class="settings-label-sub">For urgent alerts (with country code)</div></div><input class="settings-input" type="tel" id="settWhatsapp" placeholder="+1..." value="${escapeHTML(s.whatsappNumber)}"></div>`;
    html += '</div>';

    // Notifications
    html += '<div class="card settings-group"><div class="settings-group-title">Notifications</div>';
    const toggles = [
      ['alertsEnabled', 'Send urgent alerts to Slack', 'When competitors make urgent moves'],
      ['weekendReadinessEnabled', 'Send weekend readiness to Slack', 'Every Friday at 12pm PT'],
      ['mondayDigestEnabled', 'Send Monday digest to Slack', 'Weekly trend summary'],
      ['sundayAnalyticsEnabled', 'Send Sunday analytics to Slack', 'Weekly competitive insight']
    ];
    toggles.forEach(([key, label, sub]) => {
      html += `<div class="settings-item"><div><div class="settings-label">${label}</div><div class="settings-label-sub">${sub}</div></div><label class="settings-toggle"><input type="checkbox" data-key="${key}" ${s[key] ? 'checked' : ''}><span class="toggle-track"><span class="toggle-thumb"></span></span></label></div>`;
    });
    html += '</div>';

    // Display
    html += '<div class="card settings-group"><div class="settings-group-title">Display</div>';
    html += `<div class="settings-item"><div><div class="settings-label">Show Beach Clubs</div><div class="settings-label-sub">LIV Beach, Encore Beach, Omnia Beach, Palm Tree, Tao Beach</div></div><label class="settings-toggle"><input type="checkbox" data-key="showBeachClubs" ${s.showBeachClubs ? 'checked' : ''}><span class="toggle-track"><span class="toggle-thumb"></span></span></label></div>`;
    html += '</div>';

    // Data
    html += '<div class="card settings-group"><div class="settings-group-title">Data</div>';
    html += `<div class="settings-info"><strong>Social Feed:</strong> ${feedData ? formatTimestamp(feedData.run_at) : 'Not loaded'}</div>`;
    html += `<div class="settings-info"><strong>Trends:</strong> ${trendsData ? 'Week of ' + formatDate(trendsData.week_of) : 'Not loaded'}</div>`;
    html += `<div class="settings-info"><strong>Analytics:</strong> ${analyticsData ? 'Week of ' + formatDate(analyticsData.week_of) : 'Not loaded'}</div>`;
    // Force refresh removed per user request — auto-refresh every 30 min only
    html += '</div>';

    // Cron Schedule
    html += '<div class="card settings-group"><div class="settings-group-title">Schedule</div>';
    html += '<div class="settings-info">12pm + 8pm PT daily — Social Monitor</div>';
    html += '<div class="settings-info">6pm PT daily — Story Monitor</div>';
    html += '<div class="settings-info">Monday 8am PT — Trend Digest</div>';
    html += '<div class="settings-info">Sunday 9am PT — Analytics</div>';
    html += '</div>';

    settingsContent.innerHTML = html;

    // Event bindings
    const slackInput = $('#settSlack');
    const whatsInput = $('#settWhatsapp');
    if (slackInput) slackInput.addEventListener('change', () => saveSetting('slackWebhookUrl', slackInput.value));
    if (whatsInput) whatsInput.addEventListener('change', () => saveSetting('whatsappNumber', whatsInput.value));

    settingsContent.querySelectorAll('.settings-toggle input').forEach(tog => {
      tog.addEventListener('change', () => {
        saveSetting(tog.dataset.key, tog.checked);
        // Re-render tabs when display settings change
        if (tog.dataset.key === 'showBeachClubs') { renderFeed(); renderTrends(); if (analyticsRendered) renderAnalytics(); }
      });
    });

    // Force refresh button removed — auto-refresh only
  }

  // ===== Init =====
  initTabs();
  loadData();
  setInterval(loadData, REFRESH_INTERVAL);
})();
