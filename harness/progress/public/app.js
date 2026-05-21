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

fetch('http://localhost:5173/', { mode: 'no-cors' })
  .then(() => {
    if (!latestStage) {
      stageBody.innerHTML = '<iframe src="http://localhost:5173/" title="Live game"></iframe>';
      stageMeta.innerHTML = '<strong>Live playable build</strong><div>Showing localhost:5173 while the harness game server is up.</div>';
      artifactLink.removeAttribute('href');
      artifactLink.textContent = 'live';
    }
  })
  .catch(() => {});
