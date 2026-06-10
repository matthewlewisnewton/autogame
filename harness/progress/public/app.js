const eventsEl = document.querySelector('#events');
const statusEl = document.querySelector('#status');
const currentEl = document.querySelector('#current');
const stageBody = document.querySelector('#stage-body');
const stageMeta = document.querySelector('#stage-meta');
const artifactLink = document.querySelector('#artifact-link');
const clearBtn = document.querySelector('#clear');
const gpuEl = document.querySelector('#gpu');
const gpuHoursEl = document.querySelector('#gpu-hours');
const tokensEl = document.querySelector('#tokens');
const tokenLabelEl = document.querySelector('#tokens .token-label');
const tokenLocalCountEl = document.querySelector('#token-local-count');
const tokenRemoteReviewsCountEl = document.querySelector('#token-remote-reviews-count');
const tokenQwenRateEl = document.querySelector('#token-qwen-rate');
const tokenQwenTpsEl = document.querySelector('#token-qwen-tps');
const factoryEl = document.querySelector('#factory');
const factoryAgentsEl = document.querySelector('#factory-agents');
const factoryLocksEl = document.querySelector('#factory-locks');

let latestStage = null;
let latestDiffEvent = null;
const GPU_HISTORY_LIMIT = 72;
const gpuHistories = new Map();
let latestTokenTotals = { local: 0, remote: 0 };
let lastLineBlock = null;

clearBtn.addEventListener('click', () => {
  eventsEl.innerHTML = '';
});

function artifactUrl(path) {
  return `/artifacts/${encodeURIComponent(path).replaceAll('%2F', '/')}`;
}

function liveGameUrl() {
  const host = window.location.hostname || 'localhost';
  return `${window.location.protocol}//${host}:5173/`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function difficultyBadge(event) {
  const difficulty = event?.payload?.difficulty;
  if (!difficulty) return '';
  const label = escapeHtml(String(difficulty));
  return `<span class="difficulty difficulty-${label}" title="Ticket difficulty">${label}</span>`;
}

function actorClass(actor) {
  const label = String(actor || 'harness');
  if (label.startsWith('agent/')) return 'agent';
  if (label.startsWith('composer/')) return 'composer';
  if (label === 'claude' || label === 'qwen' || label === 'qa' || label === 'git' || label === 'gpu') {
    return label;
  }
  if (label === 'review') return 'review';
  return 'harness';
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return '';
  }
}

function formatCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString();
}

function renderDiff(diff) {
  if (!diff) return '';
  const lines = diff.split('\n').slice(0, 260).map((line) => {
    let klass = 'diff-line';
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff --git') || line.startsWith('index ')) {
      klass += ' meta';
    } else if (line.startsWith('@@')) {
      klass += ' hunk';
    } else if (line.startsWith('+')) {
      klass += ' add';
    } else if (line.startsWith('-')) {
      klass += ' del';
    }
    return `<span class="${klass}">${escapeHtml(line || ' ')}</span>`;
  }).join('');
  return `<pre class="diff code-block">${lines}</pre>`;
}

function renderEvent(event) {
  if (event.kind === 'line' && event.source && lastLineBlock && lastLineBlock.source === event.source) {
    appendLineEvent(lastLineBlock, event);
    return;
  }

  const el = document.createElement('article');
  el.className = `event kind-${event.kind || 'line'}`;

  const actorLabel = event.actor || 'harness';
  const actor = actorClass(actorLabel);
  const actorText = escapeHtml(actorLabel);
  const title = escapeHtml(event.title || event.kind || 'event');
  const text = escapeHtml(event.text || '');
  const source = event.source ? `<div class="source">${escapeHtml(event.source)}</div>` : '';
  const diff = event.payload && event.payload.diff ? renderDiff(event.payload.diff) : '';

  if (event.kind === 'line' && event.source) {
    el.innerHTML = `
      <div class="event-head">
        <span class="actor ${actor}">${actorText}</span>
        ${difficultyBadge(event)}
        <span class="event-title">${title}</span>
        <span class="time">${formatTime(event.ts)}</span>
      </div>
      <div class="event-body">
        <pre class="log-block code-block"></pre>
        ${source}
      </div>
    `;
    eventsEl.appendChild(el);
    lastLineBlock = {
      source: event.source,
      el,
      pre: el.querySelector('.log-block'),
      count: 0,
    };
    appendLineEvent(lastLineBlock, event);
    return;
  } else {
    lastLineBlock = null;
    el.innerHTML = `
      <div class="event-head">
        <span class="actor ${actor}">${actorText}</span>
        ${difficultyBadge(event)}
        <span class="event-title">${title}</span>
        <span class="time">${formatTime(event.ts)}</span>
      </div>
      <div class="event-body">${text}${diff}${source}</div>
    `;
  }

  eventsEl.appendChild(el);
  eventsEl.scrollTop = eventsEl.scrollHeight;
}

function classifyLogLine(line) {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'add';
  if (line.startsWith('-') && !line.startsWith('---')) return 'del';
  if (line.startsWith('@@')) return 'hunk';
  if (/^(```|diff --git|index |--- |\+\+\+ )/.test(line)) return 'meta';
  return '';
}

function appendLineEvent(block, event) {
  if (!block || !block.pre) return;
  const line = String(event.text || '');
  const span = document.createElement('span');
  span.className = `log-line ${classifyLogLine(line)}`.trim();
  span.textContent = line || ' ';
  block.pre.appendChild(span);
  block.count += 1;
  if (block.count > 260 && block.pre.firstChild) {
    block.pre.removeChild(block.pre.firstChild);
    block.count -= 1;
  }
  eventsEl.scrollTop = eventsEl.scrollHeight;
}

function rememberDiffEvent(event) {
  if (event.kind === 'patch' && event.payload && event.payload.diff) {
    latestDiffEvent = event;
  }
}

function formatTokPerSec(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 10) return `~${n.toFixed(1)}`;
  if (n < 10000) return `~${Math.round(n)}`;
  return `~${(n / 1000).toFixed(1)}k`;
}

function updateQwenTokensPerSec(usage, totals) {
  if (!tokenQwenRateEl || !tokenQwenTpsEl) return;
  const rate = Number(usage?.tokensPerSecond ?? totals?.lastQwenTokPerSec);
  if (!Number.isFinite(rate) || rate <= 0) return;
  tokenQwenTpsEl.textContent = formatTokPerSec(rate);
  tokenQwenRateEl.hidden = false;
  const durationSec = usage?.durationMs ? (usage.durationMs / 1000).toFixed(1) : null;
  const parts = [
    'Latest Qwen call throughput (total tokens ÷ wall time).',
    usage?.estimated ? 'Token count is estimated from prompt/output size.' : null,
    usage?.totalTokens && durationSec
      ? `${usage.totalTokens.toLocaleString()} tokens in ${durationSec}s.`
      : null,
  ].filter(Boolean);
  tokenQwenRateEl.title = parts.join(' ');
}

function updateTokens(payload) {
  if (!tokensEl || !payload) return;
  const totals = payload.totals || payload;
  const hasEstimates = Boolean(payload.estimated || totals.estimatedCalls);
  latestTokenTotals = {
    local: Number(totals.local) || 0,
    remote: Number(totals.remote) || 0,
  };
  if (tokenLabelEl) {
    tokenLabelEl.textContent = `tokens${hasEstimates ? ' est.' : ''}`;
  }
  if (tokenLocalCountEl) {
    tokenLocalCountEl.textContent = formatCount(latestTokenTotals.local);
  }
  if (tokenRemoteReviewsCountEl) {
    tokenRemoteReviewsCountEl.textContent = formatCount(latestTokenTotals.remote);
  }
  updateQwenTokensPerSec(payload.usage, totals);
  tokensEl.title = hasEstimates
    ? `Local agents (qwen, etc.) and top-level ticket reviews only; ${totals.estimatedCalls || 0} call(s) use estimates. Sub-task QA and other remote agents are excluded.`
    : 'Local agents and top-level ticket reviews (review-round-*, rescue-review) only.';
  tokensEl.classList.add('active');
}

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function formatMetric(value, suffix = '') {
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  return `${Math.round(n)}${suffix}`;
}

function formatGpuHours(hours) {
  const n = Number(hours);
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 10) return n.toFixed(2);
  if (n < 100) return n.toFixed(1);
  return Math.round(n).toString();
}

function updateGpuHours(uptime) {
  if (!gpuHoursEl || !uptime) return;
  const total = formatGpuHours(uptime.totalHours);
  const active = Number(uptime.activeGpus) || 0;
  const perGpu = Object.entries(uptime.byIndex || {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([index, row]) => `GPU${index}: ${formatGpuHours(row.hours)}h`)
    .join(', ');
  const started = uptime.startedAt
    ? new Date(uptime.startedAt).toLocaleString()
    : 'unknown';
  gpuHoursEl.innerHTML = `
    <span class="gpu-hours-label">GPU·hr</span>
    <strong>${total}</strong>
    ${active > 0 ? `<span class="gpu-hours-active">${active} active</span>` : ''}
  `;
  const offsetLine = Number(uptime.offsetHours) > 0
    ? `Includes ${formatGpuHours(uptime.offsetHours)}h prior estimate (before live tracking).`
    : null;
  gpuHoursEl.title = [
    'Cumulative active GPU time (sum across cards; util, VRAM, or power above idle).',
    offsetLine,
    `Live tracking since ${started}.`,
    perGpu || 'No per-GPU time yet.',
    Number(uptime.trackedHours) > 0
      ? `Measured since tracker start: ${formatGpuHours(uptime.trackedHours)}h.`
      : null,
    `Session wall time: ${formatGpuHours(uptime.sessionHours)}h.`,
  ].filter(Boolean).join(' ');
  gpuHoursEl.classList.add('active');
}

function vramUsedPercent(gpu) {
  if (Number.isFinite(gpu.memUsedPercent)) return clampPercent(gpu.memUsedPercent);
  const used = Number(gpu.memUsedMb);
  const total = Number(gpu.memTotalMb);
  if (total > 0) return clampPercent((used / total) * 100);
  // Legacy fallback: utilization.memory is bandwidth, not VRAM fill.
  return clampPercent(gpu.memBandwidthUtil ?? gpu.memUtil);
}

function addGpuSample(gpu) {
  const index = Number(gpu.index);
  if (!Number.isFinite(index)) return [];
  const history = gpuHistories.get(index) || [];
  history.push({
    gpuUtil: clampPercent(gpu.gpuUtil),
    vramUsed: vramUsedPercent(gpu),
  });
  while (history.length > GPU_HISTORY_LIMIT) history.shift();
  gpuHistories.set(index, history);
  return history;
}

function renderSparkBars(history, key) {
  const width = 144;
  const height = 34;
  const count = GPU_HISTORY_LIMIT;
  const gap = 1;
  const barWidth = Math.max(1, (width - ((count - 1) * gap)) / count);
  const padded = Array.from({ length: Math.max(0, count - history.length) }, () => ({ [key]: 0 })).concat(history);

  const bars = padded.map((sample, i) => {
    const raw = key === 'vramUsed'
      ? (sample.vramUsed ?? sample.memUsedPercent ?? sample.memUtil)
      : sample[key];
    const value = clampPercent(raw);
    const barHeight = Math.max(1, (value / 100) * height);
    const x = i * (barWidth + gap);
    const y = height - barHeight;
    return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}"></rect>`;
  }).join('');

  return `<svg class="gpu-spark gpu-spark-${key}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`;
}

function renderGpuCard(gpu, history) {
  const vramPct = vramUsedPercent(gpu);
  const memUsedMiB = Number.isFinite(gpu.memUsedMb) ? Math.round(gpu.memUsedMb) : null;
  const memTotalMiB = Number.isFinite(gpu.memTotalMb) ? Math.round(gpu.memTotalMb) : null;
  const memLabel = memUsedMiB !== null && memTotalMiB !== null
    ? `${memUsedMiB}/${memTotalMiB} MiB (${vramPct}%)`
    : '--';
  const power = Number.isFinite(gpu.powerDrawW) && Number.isFinite(gpu.powerLimitW)
    ? `${Math.round(gpu.powerDrawW)}/${Math.round(gpu.powerLimitW)}W`
    : `${formatMetric(gpu.powerDrawW, 'W')}`;

  return `
    <section class="gpu-card" title="${escapeHtml(gpu.name || `GPU${gpu.index}`)}">
      <div class="gpu-card-head">
        <strong>GPU${escapeHtml(gpu.index)}</strong>
        <span>${escapeHtml((gpu.name || '').replace(/^NVIDIA\s+/i, ''))}</span>
      </div>
      <div class="gpu-readouts">
        <span class="gpu-util">${formatMetric(gpu.gpuUtil, '%')}</span>
        <span class="gpu-vram" title="VRAM used / total (matches nvtop memory bar)">${memLabel}</span>
        <span>${formatMetric(gpu.tempC, 'C')}</span>
        <span>${power}</span>
      </div>
      <div class="gpu-sparks">
        <div>
          <span>GPU</span>
          ${renderSparkBars(history, 'gpuUtil')}
        </div>
        <div>
          <span title="VRAM fill % (used/total), not memory bandwidth">VRAM</span>
          ${renderSparkBars(history, 'vramUsed')}
        </div>
      </div>
    </section>
  `;
}

function updateGpu(event) {
  if (!gpuEl || event.kind !== 'gpu_sample') return;
  const payload = event.payload || {};
  if (!payload.available) {
    gpuEl.textContent = 'GPU: unavailable';
    gpuEl.classList.remove('active');
    return;
  }

  const gpus = Array.isArray(payload.gpus) ? payload.gpus : [];
  if (!gpus.length) {
    gpuEl.textContent = 'GPU: no samples';
    gpuEl.classList.remove('active');
    return;
  }

  const chartGpus = gpus
    .slice()
    .sort((a, b) => Number(a.index) - Number(b.index))
    .filter(gpu => Number(gpu.index) === 0 || Number(gpu.index) === 1);
  const visibleGpus = chartGpus.length ? chartGpus : gpus.slice(0, 2);

  gpuEl.innerHTML = visibleGpus.map((gpu) => renderGpuCard(gpu, addGpuSample(gpu))).join('');
  gpuEl.title = `Run nvtop for the interactive GPU view. ${payload.processes?.length || 0} GPU process(es) reported.`;
  gpuEl.classList.add('active');
  if (payload.uptime) updateGpuHours(payload.uptime);
}

function showStageFallback(path, shot) {
  const diff = latestDiffEvent && latestDiffEvent.payload
    ? renderDiff(latestDiffEvent.payload.diff)
    : '';
  const diffTitle = latestDiffEvent
    ? `<div class="fallback-diff-title">Latest code diff: ${escapeHtml(latestDiffEvent.source || latestDiffEvent.title || 'patch')}</div>`
    : '';

  stageBody.innerHTML = `
    <div class="stage-fallback">
      <div class="missing-artifact">
        <strong>Screenshot artifact unavailable</strong>
        <span>${escapeHtml(shot.description || shot.file || 'Latest QA screenshot')}</span>
        <code>${escapeHtml(path)}</code>
      </div>
      ${diff ? `<div class="fallback-diff">${diffTitle}${diff}</div>` : '<div class="empty">Waiting for a code diff to display here...</div>'}
    </div>
  `;
}

function maybeUpdateStage(event) {
  if (event.kind !== 'qa_scene' || !event.payload) return;
  const screenshots = Array.isArray(event.payload.screenshots) ? event.payload.screenshots : [];
  if (!screenshots.length || !event.source) return;

  const base = event.source.split('/').slice(0, -1).join('/');
  const shot = screenshots[screenshots.length - 1];
  const path = `${base}/${shot.file}`;
  latestStage = { event, shot, path };

  stageBody.innerHTML = '';
  const img = document.createElement('img');
  img.src = artifactUrl(path);
  img.alt = shot.description || shot.file || 'Latest QA screenshot';
  img.loading = 'lazy';
  img.addEventListener('error', () => showStageFallback(path, shot), { once: true });
  stageBody.appendChild(img);

  artifactLink.href = artifactUrl(path);
  artifactLink.textContent = shot.file || 'artifact';

  const scenarios = (event.payload.scenarios || []).join(', ') || 'none';
  stageMeta.innerHTML = `
    <div><strong>${escapeHtml(shot.description || 'Latest QA screenshot')}</strong></div>
    <div>Source: ${escapeHtml(event.payload.capturePlanSource || 'unknown')}</div>
    <div>Scenario: ${escapeHtml(scenarios)}</div>
    <div>Metrics: <a href="${artifactUrl(event.source)}" target="_blank" rel="noreferrer">${escapeHtml(event.source)}</a></div>
  `;
}

function updateCurrent(event) {
  const bits = [
    `<strong>${escapeHtml(event.actor || 'harness')}</strong>`,
    escapeHtml(event.title || event.kind || 'event'),
  ];
  if (event.source) bits.push(`<span>${escapeHtml(event.source)}</span>`);
  currentEl.innerHTML = bits.join(' · ');
}

function updateFactory(payload) {
  if (!factoryEl || !payload) return;
  const agents = Array.isArray(payload.agents) ? payload.agents : [];
  const locks = Array.isArray(payload.locks) ? payload.locks : [];
  if (!agents.length && !locks.length) return;
  factoryEl.hidden = false;

  // One chip PER RUNNING TICKET (not per agent): an agent at cap 3 used to
  // pack all three ticket names into a single ellipsized chip, hiding and
  // un-clickifying everything after the first.
  factoryAgentsEl.innerHTML = agents.flatMap((a) => {
    const running = Array.isArray(a.running) ? a.running : [];
    const disabled = a.health && a.health !== 'available';
    if (disabled) {
      return [`<span class="chip chip-disabled" title="${escapeHtml(a.name)}: ${escapeHtml(a.health)}">`
        + `<strong>${escapeHtml(a.name)}</strong> ${escapeHtml(a.health)}</span>`];
    }
    if (!running.length) {
      return [`<span class="chip chip-idle" title="${escapeHtml(a.name)}: idle">`
        + `<strong>${escapeHtml(a.name)}</strong> idle (0/${a.cap})</span>`];
    }
    return running.map((t, i) => `<span class="chip chip-running" title="${escapeHtml(a.name)} slot ${i + 1}/${a.cap}: ${escapeHtml(t)}">`
      + `<strong>${escapeHtml(a.name)}</strong> `
      + `<button class="chip-ticket" type="button" data-ticket="${escapeHtml(t)}" title="Show the bead ${escapeHtml(t)} is working on">${escapeHtml(t)}</button></span>`);
  }).join('');
  factoryAgentsEl.querySelectorAll('.chip-ticket').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      openBeadForTicket(btn.dataset.ticket);
    });
  });

  if (!locks.length) {
    factoryLocksEl.innerHTML = '<span class="chip chip-idle">none</span>';
  } else {
    factoryLocksEl.innerHTML = locks.map((l) => {
      const held = Boolean(l.held);
      const who = held ? escapeHtml(l.holder || 'unknown') : 'free';
      return `<span class="chip chip-${held ? 'running' : 'idle'}" title="${escapeHtml(l.resource)}: ${who}">`
        + `<strong>${escapeHtml(l.resource)}</strong> ${who}</span>`;
    }).join('');
  }
}

function refreshPersistedTotals() {
  fetch('/tokens')
    .then(response => response.ok ? response.json() : null)
    .then(data => {
      if (data) updateTokens(data);
    })
    .catch(() => {});

  fetch('/gpu/uptime')
    .then(response => response.ok ? response.json() : null)
    .then(data => {
      if (data) updateGpuHours(data);
    })
    .catch(() => {});
}

function connect() {
  const source = new EventSource('/events');

  source.addEventListener('open', () => {
    statusEl.textContent = 'live';
    statusEl.classList.add('live');
    refreshPersistedTotals();
  });

  source.addEventListener('error', () => {
    statusEl.textContent = 'reconnecting...';
    statusEl.classList.remove('live');
  });

  source.addEventListener('progress', (message) => {
    const event = JSON.parse(message.data);
    if (event.kind === 'gpu_uptime' && event.payload?.uptime) {
      updateGpuHours(event.payload.uptime);
      return;
    }
    if (event.kind === 'gpu_sample') {
      updateGpu(event);
      return;
    }
    if (event.kind === 'token_usage') {
      updateTokens(event.payload);
      return;
    }
    if (event.kind === 'factory_status') {
      updateFactory(event.payload);
      return;
    }
    if (event.kind === 'agent_usage') {
      updateTokens(event.payload);
      renderEvent(event);
      return;
    }
    rememberDiffEvent(event);
    renderEvent(event);
    maybeUpdateStage(event);
    updateCurrent(event);
  });
}

connect();
refreshPersistedTotals();

// --- Beads issue browser ---------------------------------------------------
const tabButtons = [...document.querySelectorAll('.tab')];
const viewEls = new Map([...document.querySelectorAll('[data-view]')].map((el) => [el.dataset.view, el]));
const beadsStatsEl = document.querySelector('#beads-stats');
const beadsListEl = document.querySelector('#beads-list');
const beadsDetailEl = document.querySelector('#beads-detail');
const beadsFilterEl = document.querySelector('#beads-filter');
const beadsRefreshEl = document.querySelector('#beads-refresh');

const BEADS_STALE_MS = 8000;
let beadsIssues = [];
let beadsFetchedAt = 0;
let beadsSelectedId = null;

function activateTab(name) {
  tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === name));
  viewEls.forEach((el, key) => el.classList.toggle('hidden', key !== name));
  if (name === 'beads' && Date.now() - beadsFetchedAt > BEADS_STALE_MS) {
    loadBeads();
  }
}

tabButtons.forEach((btn) => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));

function priorityLabel(priority) {
  const n = Number(priority);
  return Number.isFinite(n) ? `P${n}` : '—';
}

function slug(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function renderBeadsStats(stats) {
  const s = stats?.summary || {};
  // Each stat doubles as a filter button: clicking swaps the status:/is:
  // tokens in the search box for its own (and toggles itself off on
  // re-click), leaving any free-text terms in place.
  const cells = [
    ['open', s.open_issues, 'status:open'],
    ['in progress', s.in_progress_issues, 'status:in_progress'],
    ['blocked', s.blocked_issues, 'is:blocked'],
    ['ready', s.ready_issues, 'is:ready'],
    ['closed', s.closed_issues, 'status:closed'],
    ['total', s.total_issues, ''],
  ];
  beadsStatsEl.innerHTML = cells
    .map(([label, val, token]) => `<button class="beads-stat beads-stat-btn" type="button" data-token="${escapeHtml(token)}"`
      + ` title="${token ? `Filter list by ${escapeHtml(token)}` : 'Clear status filters'}">`
      + `<strong>${formatCount(val)}</strong>${escapeHtml(label)}</button>`)
    .join('');
  beadsStatsEl.querySelectorAll('.beads-stat-btn').forEach((btn) => {
    btn.addEventListener('click', () => applyBeadsStatToken(btn.dataset.token));
  });
  updateBeadsStatActive();
}

function applyBeadsStatToken(token) {
  if (!beadsFilterEl) return;
  const terms = beadsFilterEl.value.trim().split(/\s+/).filter(Boolean);
  const lower = (token || '').toLowerCase();
  const wasActive = lower && terms.some((t) => t.toLowerCase() === lower);
  const kept = terms.filter((t) => {
    const tl = t.toLowerCase();
    return !tl.startsWith('status:') && !tl.startsWith('is:');
  });
  if (lower && !wasActive) kept.push(token);
  beadsFilterEl.value = kept.join(' ');
  renderBeadsList();
}

function activeFilterTerms() {
  return (beadsFilterEl?.value || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function updateBeadsStatActive() {
  if (!beadsStatsEl) return;
  const terms = activeFilterTerms();
  beadsStatsEl.querySelectorAll('.beads-stat-btn').forEach((btn) => {
    const token = (btn.dataset.token || '').toLowerCase();
    btn.classList.toggle('active', Boolean(token) && terms.includes(token));
  });
}

function updateBeadsBadgeActive() {
  // Row + detail badges share the same data-token contract as the stat
  // buttons; reflect the live filter on all of them so the selected state
  // can't drift from what's actually in the search box.
  const terms = activeFilterTerms();
  document.querySelectorAll('.beads-badge-btn').forEach((badge) => {
    const token = (badge.dataset.token || '').toLowerCase();
    badge.classList.toggle('active', Boolean(token) && terms.includes(token));
  });
}

function refreshBeadsActiveStates() {
  updateBeadsStatActive();
  updateBeadsBadgeActive();
}

function issueLabels(issue) {
  return Array.isArray(issue.labels) ? issue.labels.map((l) => String(l).toLowerCase()) : [];
}

function issueDifficulty(issue) {
  const label = issueLabels(issue).find((l) => l.startsWith('difficulty:'));
  return label ? label.slice('difficulty:'.length) : '';
}

function issueIsBlocked(issue) {
  return (issue.status || '') === 'open' && Number(issue.dependency_count) > 0;
}

function issueMatchesFilter(issue, query) {
  if (!query) return true;
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = `${issue.id} ${issue.title} ${issue.status} ${issue.issue_type} p${issue.priority} ${issueLabels(issue).join(' ')}`.toLowerCase();
  return terms.every((term) => {
    if (term.startsWith('status:')) return (issue.status || '').toLowerCase().startsWith(term.slice(7));
    if (term.startsWith('type:')) return (issue.issue_type || '').toLowerCase().startsWith(term.slice(5));
    if (term.startsWith('difficulty:')) return issueDifficulty(issue).startsWith(term.slice(11));
    if (term === 'is:blocked') return issueIsBlocked(issue);
    if (term === 'is:ready') return (issue.status || '') === 'open' && !issueIsBlocked(issue);
    if (/^p[0-4]$/.test(term)) return Number(issue.priority) === Number(term[1]);
    return hay.includes(term);
  });
}

function beadsBadge(extraClass, label, token) {
  if (!label) return '';
  if (!token) return `<span class="beads-badge ${extraClass}">${escapeHtml(label)}</span>`;
  return `<span class="beads-badge beads-badge-btn ${extraClass}" role="button" tabindex="0" data-token="${escapeHtml(token)}">${escapeHtml(label)}</span>`;
}

function beadsBadges(issue) {
  const difficulty = issueDifficulty(issue);
  return `
    ${beadsBadge(`status-${slug(issue.status)}`, issue.status, `status:${String(issue.status || '').toLowerCase()}`)}
    ${beadsBadge(`prio-${slug(priorityLabel(issue.priority))}`, priorityLabel(issue.priority), /^[0-4]$/.test(String(issue.priority)) ? `p${issue.priority}` : '')}
    ${beadsBadge(`type-${slug(issue.issue_type)}`, issue.issue_type, `type:${String(issue.issue_type || '').toLowerCase()}`)}
    ${difficulty ? beadsBadge(`difficulty-${slug(difficulty)}`, difficulty, `difficulty:${difficulty}`) : ''}
  `;
}

function toggleBeadsFilterToken(token) {
  if (!beadsFilterEl || !token) return;
  const terms = beadsFilterEl.value.trim().split(/\s+/).filter(Boolean);
  const lower = token.toLowerCase();
  const idx = terms.findIndex((t) => t.toLowerCase() === lower);
  if (idx >= 0) terms.splice(idx, 1);
  else terms.push(token);
  beadsFilterEl.value = terms.join(' ');
  renderBeadsList();
}

function renderBeadsList() {
  if (!beadsListEl) return;
  const query = (beadsFilterEl?.value || '').trim();
  const rows = beadsIssues.filter((issue) => issueMatchesFilter(issue, query));
  if (!rows.length) {
    beadsListEl.innerHTML = '<div class="empty">No matching issues.</div>';
    return;
  }
  beadsListEl.innerHTML = rows
    .map((issue) => `
      <button class="beads-row${issue.id === beadsSelectedId ? ' selected' : ''}" type="button" data-id="${escapeHtml(issue.id)}">
        <span class="beads-row-top">
          <span class="beads-row-id">${escapeHtml(issue.id)}</span>
          ${beadsBadges(issue)}
        </span>
        <span class="beads-row-title">${escapeHtml(issue.title)}</span>
      </button>
    `)
    .join('');
  beadsListEl.querySelectorAll('.beads-row').forEach((row) => {
    row.addEventListener('click', () => selectBead(row.dataset.id));
  });
  beadsListEl.querySelectorAll('.beads-badge-btn').forEach((badge) => {
    badge.addEventListener('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      toggleBeadsFilterToken(badge.dataset.token);
    });
    badge.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.stopPropagation();
      event.preventDefault();
      toggleBeadsFilterToken(badge.dataset.token);
    });
  });
  refreshBeadsActiveStates();
}

function beadsField(label, value) {
  if (!value) return '';
  return `
    <div class="beads-field">
      <div class="beads-field-label">${escapeHtml(label)}</div>
      <div class="beads-field-body">${escapeHtml(value)}</div>
    </div>
  `;
}

function renderBeadsDetail(issue) {
  if (!issue) {
    beadsDetailEl.innerHTML = '<div class="empty">Not found.</div>';
    return;
  }
  const dependents = Array.isArray(issue.dependents) ? issue.dependents : [];
  const depsLine = `${issue.dependency_count || 0} blocking dep(s) · ${issue.dependent_count || 0} dependent(s)`;
  const dependentsBlock = dependents.length
    ? `<div class="beads-field"><div class="beads-field-label">Dependents</div><div class="beads-field-body">${dependents
        .map((d) => `<button class="beads-link" type="button" data-id="${escapeHtml(d.id)}">${escapeHtml(d.id)}</button> ${escapeHtml(d.title || '')}`)
        .join('<br>')}</div></div>`
    : '';
  beadsDetailEl.innerHTML = `
    <div class="beads-detail-head">
      <span class="beads-detail-id">${escapeHtml(issue.id)}</span>
      <span class="beads-detail-badges">${beadsBadges(issue)}</span>
    </div>
    <h2 class="beads-detail-title">${escapeHtml(issue.title)}</h2>
    <div class="beads-detail-meta">${escapeHtml(depsLine)}</div>
    ${beadsField('Description', issue.description)}
    ${beadsField('Acceptance criteria', issue.acceptance_criteria)}
    ${beadsField('Design', issue.design)}
    ${beadsField('Notes', issue.notes)}
    ${dependentsBlock}
  `;
  beadsDetailEl.querySelectorAll('.beads-link').forEach((link) => {
    link.addEventListener('click', () => selectBead(link.dataset.id));
  });
  refreshBeadsActiveStates();
}

function selectBead(id) {
  if (!id) return;
  beadsSelectedId = id;
  renderBeadsList();
  beadsDetailEl.innerHTML = '<div class="empty">Loading…</div>';
  fetch(`/beads/${encodeURIComponent(id)}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((issue) => renderBeadsDetail(issue))
    .catch((err) => {
      beadsDetailEl.innerHTML = `<div class="empty">Failed to load ${escapeHtml(id)}: ${escapeHtml(err.message)}</div>`;
    });
}

let beadsLoadPromise = null;

function loadBeads() {
  if (!beadsListEl) return Promise.resolve();
  if (beadsLoadPromise) return beadsLoadPromise;
  beadsListEl.innerHTML = '<div class="empty">Loading issues…</div>';
  beadsLoadPromise = fetch('/beads')
    .then((r) => (r.ok ? r.json() : r.json().then((body) => Promise.reject(new Error(body.error || `HTTP ${r.status}`)))))
    .then((data) => {
      beadsIssues = Array.isArray(data.issues) ? data.issues : [];
      beadsFetchedAt = Date.now();
      renderBeadsStats(data.stats);
      renderBeadsList();
    })
    .catch((err) => {
      beadsListEl.innerHTML = `<div class="empty">Failed to load beads: ${escapeHtml(err.message)}</div>`;
    })
    .finally(() => {
      beadsLoadPromise = null;
    });
  return beadsLoadPromise;
}

function beadForTicketName(name) {
  const lower = String(name || '').toLowerCase();
  if (!lower) return null;
  // Legacy slug tickets use the bead title verbatim; sanitized prose titles
  // end with the bead id's short suffix (ticket_dir_name in the dispatcher).
  return beadsIssues.find((i) => String(i.title || '').toLowerCase() === lower)
    || beadsIssues.find((i) => String(i.id || '').toLowerCase() === lower)
    || beadsIssues.find((i) => {
      const suffix = String(i.id || '').split('-').pop().toLowerCase();
      return suffix && lower.endsWith(`-${suffix}`);
    })
    || null;
}

function openBeadForTicket(name) {
  activateTab('beads');
  const fresh = beadsIssues.length && Date.now() - beadsFetchedAt <= BEADS_STALE_MS;
  (fresh ? Promise.resolve() : loadBeads()).then(() => {
    const issue = beadForTicketName(name);
    if (issue) {
      selectBead(issue.id);
    } else if (beadsFilterEl) {
      beadsFilterEl.value = String(name || '');
      renderBeadsList();
    }
  });
}

if (beadsFilterEl) {
  beadsFilterEl.addEventListener('input', renderBeadsList);
}
if (beadsRefreshEl) beadsRefreshEl.addEventListener('click', loadBeads);

const previewUrl = liveGameUrl();
fetch(previewUrl, { mode: 'no-cors' })
  .then(() => {
    if (!latestStage) {
      stageBody.innerHTML = `<iframe src="${escapeHtml(previewUrl)}" title="Live game"></iframe>`;
      stageMeta.innerHTML = `<strong>Live playable build</strong><div>Showing ${escapeHtml(previewUrl)} while the harness game server is up.</div>`;
      artifactLink.removeAttribute('href');
      artifactLink.textContent = 'live';
    }
  })
  .catch(() => {});
