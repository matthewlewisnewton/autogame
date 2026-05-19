const eventsEl = document.querySelector('#events');
const statusEl = document.querySelector('#status');
const currentEl = document.querySelector('#current');
const stageBody = document.querySelector('#stage-body');
const stageMeta = document.querySelector('#stage-meta');
const artifactLink = document.querySelector('#artifact-link');
const clearBtn = document.querySelector('#clear');
const gpuEl = document.querySelector('#gpu');

let latestStage = null;
let latestDiffEvent = null;
const GPU_HISTORY_LIMIT = 72;
const gpuHistories = new Map();

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

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return '';
  }
}

function renderDiff(diff) {
  if (!diff) return '';
  const lines = diff.split('\n').slice(0, 260).map((line) => {
    const klass = line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : '';
    return `<div class="${klass}">${escapeHtml(line)}</div>`;
  }).join('');
  return `<div class="diff">${lines}</div>`;
}

function renderEvent(event) {
  const el = document.createElement('article');
  el.className = `event kind-${event.kind || 'line'}`;

  const actor = escapeHtml(event.actor || 'harness');
  const title = escapeHtml(event.title || event.kind || 'event');
  const text = escapeHtml(event.text || '');
  const source = event.source ? `<div class="source">${escapeHtml(event.source)}</div>` : '';
  const diff = event.payload && event.payload.diff ? renderDiff(event.payload.diff) : '';

  el.innerHTML = `
    <div class="event-head">
      <span class="actor ${actor}">${actor}</span>
      <span class="event-title">${title}</span>
      <span class="time">${formatTime(event.ts)}</span>
    </div>
    <div class="event-body">${text}${diff}${source}</div>
  `;

  eventsEl.appendChild(el);
  eventsEl.scrollTop = eventsEl.scrollHeight;
}

function rememberDiffEvent(event) {
  if (event.kind === 'patch' && event.payload && event.payload.diff) {
    latestDiffEvent = event;
  }
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

function addGpuSample(gpu) {
  const index = Number(gpu.index);
  if (!Number.isFinite(index)) return [];
  const history = gpuHistories.get(index) || [];
  history.push({
    gpuUtil: clampPercent(gpu.gpuUtil),
    memUtil: clampPercent(gpu.memUtil),
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
    const value = clampPercent(sample[key]);
    const barHeight = Math.max(1, (value / 100) * height);
    const x = i * (barWidth + gap);
    const y = height - barHeight;
    return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}"></rect>`;
  }).join('');

  return `<svg class="gpu-spark gpu-spark-${key}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`;
}

function renderGpuCard(gpu, history) {
  const memUsedGb = Number.isFinite(gpu.memUsedMb) ? (gpu.memUsedMb / 1024).toFixed(1) : '--';
  const memTotalGb = Number.isFinite(gpu.memTotalMb) ? (gpu.memTotalMb / 1024).toFixed(1) : '--';
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
        <span>${memUsedGb}/${memTotalGb} GiB</span>
        <span>${formatMetric(gpu.tempC, 'C')}</span>
        <span>${power}</span>
      </div>
      <div class="gpu-sparks">
        <div>
          <span>GPU</span>
          ${renderSparkBars(history, 'gpuUtil')}
        </div>
        <div>
          <span>MEM</span>
          ${renderSparkBars(history, 'memUtil')}
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

function connect() {
  const source = new EventSource('/events');

  source.addEventListener('open', () => {
    statusEl.textContent = 'live';
    statusEl.classList.add('live');
  });

  source.addEventListener('error', () => {
    statusEl.textContent = 'reconnecting...';
    statusEl.classList.remove('live');
  });

  source.addEventListener('progress', (message) => {
    const event = JSON.parse(message.data);
    if (event.kind === 'gpu_sample') {
      updateGpu(event);
      return;
    }
    rememberDiffEvent(event);
    renderEvent(event);
    maybeUpdateStage(event);
    updateCurrent(event);
  });
}

connect();

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
