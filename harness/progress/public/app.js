const eventsEl = document.querySelector('#events');
const statusEl = document.querySelector('#status');
const currentEl = document.querySelector('#current');
const stageBody = document.querySelector('#stage-body');
const stageMeta = document.querySelector('#stage-meta');
const artifactLink = document.querySelector('#artifact-link');
const clearBtn = document.querySelector('#clear');
const gpuEl = document.querySelector('#gpu');

let latestStage = null;

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

function updateGpu(event) {
  if (!gpuEl || event.kind !== 'gpu_sample') return;
  const payload = event.payload || {};
  if (!payload.available) {
    gpuEl.textContent = 'GPU: unavailable';
    gpuEl.classList.remove('active');
    return;
  }

  const gpus = Array.isArray(payload.gpus) ? payload.gpus : [];
  const first = gpus[0];
  if (!first) {
    gpuEl.textContent = 'GPU: no samples';
    gpuEl.classList.remove('active');
    return;
  }

  const mem = `${first.memUsedMb}/${first.memTotalMb} MiB`;
  const power = Number.isFinite(first.powerDrawW) ? ` · ${first.powerDrawW}W` : '';
  const extra = gpus.length > 1 ? ` · +${gpus.length - 1} GPU` : '';
  gpuEl.textContent = `GPU${first.index}: ${first.gpuUtil}% · ${mem} · ${first.tempC}C${power}${extra}`;
  gpuEl.title = `Run nvtop for the interactive GPU view. ${payload.processes?.length || 0} GPU process(es) reported.`;
  gpuEl.classList.add('active');
}

function maybeUpdateStage(event) {
  if (event.kind !== 'qa_scene' || !event.payload) return;
  const screenshots = Array.isArray(event.payload.screenshots) ? event.payload.screenshots : [];
  if (!screenshots.length || !event.source) return;

  const base = event.source.split('/').slice(0, -1).join('/');
  const shot = screenshots[screenshots.length - 1];
  const path = `${base}/${shot.file}`;
  latestStage = { event, shot, path };

  stageBody.innerHTML = `<img src="${artifactUrl(path)}" alt="${escapeHtml(shot.description || shot.file)}">`;
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
