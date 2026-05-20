#!/usr/bin/env node
import { createServer } from 'http';
import { spawnSync } from 'child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, extname, join, relative, resolve, sep } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const progressDir = resolve(__dirname);
const publicDir = join(progressDir, 'public');
const eventLogPath = join(progressDir, 'events.ndjson');
const port = Number(process.env.PORT || argValue('--port') || 8787);

mkdirSync(progressDir, { recursive: true });

const clients = new Set();
const events = [];
const seen = new Set();
const fileOffsets = new Map();
const fileDigests = new Map();
const agentUsageByKey = new Map();
const agentUsageDigests = new Map();
const tokenTotals = emptyTokenTotals();
let nextId = 1;
let lastGitHead = '';
let lastGpuDigest = '';

const LOCAL_POST_ADDRESSES = new Set([
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
]);

const WATCH_ROOTS = [
  'LOOPLOG.txt',
  'LOGBOOK.md',
  'TASKS.md',
  'tickets',
  'harness/progress/events.ndjson',
];

const WATCH_FILE_RE = /(^|\/)(log\.txt|qwen\.txt|qa\.txt|commit\.txt|claude\.txt|review\.md|gaps\.md|nits\.md|changes\.diff|ticket\.diff|metrics\.json|screenshot\.log|events\.ndjson|LOOPLOG\.txt|LOGBOOK\.md|TASKS\.md)$/;
const MAX_LINE = 1200;
const MAX_EVENTS = 1000;

function argValue(name) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

function nowIso() {
  return new Date().toISOString();
}

function isLocalRequest(req) {
  const address = req.socket.remoteAddress || '';
  return LOCAL_POST_ADDRESSES.has(address);
}

function emptyTokenTotals() {
  return {
    local: 0,
    remote: 0,
    exact: { local: 0, remote: 0 },
    estimated: { local: 0, remote: 0 },
    calls: 0,
    estimatedCalls: 0,
  };
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function normalizeUsagePayload(payload) {
  const bucket = payload.bucket === 'local' ? 'local' : payload.bucket === 'remote' ? 'remote' : null;
  const outfile = String(payload.outfile || '');
  const attempt = Number(payload.attempt) || 0;
  const totalTokens = numberOrZero(payload.totalTokens);
  if (!bucket || !outfile || !attempt || !totalTokens) return null;

  return {
    key: String(payload.key || `${outfile}#${attempt}`),
    agent: String(payload.agent || 'agent'),
    model: payload.model || null,
    bucket,
    outfile,
    attempt,
    rc: Number(payload.rc) || 0,
    status: payload.status || '',
    reason: payload.reason || null,
    durationMs: payload.durationMs === null || payload.durationMs === undefined ? null : numberOrZero(payload.durationMs),
    inputTokens: payload.inputTokens === null || payload.inputTokens === undefined ? null : numberOrZero(payload.inputTokens),
    outputTokens: payload.outputTokens === null || payload.outputTokens === undefined ? null : numberOrZero(payload.outputTokens),
    totalTokens,
    estimated: Boolean(payload.estimated),
    source: payload.source || (payload.estimated ? 'per_call_estimate' : 'cli_usage'),
  };
}

function recomputeTokenTotals() {
  const next = emptyTokenTotals();
  for (const usage of agentUsageByKey.values()) {
    next[usage.bucket] += usage.totalTokens;
    if (usage.estimated) {
      next.estimated[usage.bucket] += usage.totalTokens;
      next.estimatedCalls += 1;
    } else {
      next.exact[usage.bucket] += usage.totalTokens;
    }
    next.calls += 1;
  }
  Object.assign(tokenTotals, next);
}

function recordAgentUsage(payload, source) {
  const usage = normalizeUsagePayload(payload || {});
  if (!usage) return null;

  const digest = JSON.stringify(usage);
  if (agentUsageDigests.get(usage.key) === digest) {
    return { usage, changed: false };
  }

  agentUsageDigests.set(usage.key, digest);
  agentUsageByKey.set(usage.key, usage);
  recomputeTokenTotals();

  emitTransient({
    kind: 'token_usage',
    actor: 'harness',
    title: 'Token usage updated',
    text: `local ${tokenTotals.local.toLocaleString()} / remote ${tokenTotals.remote.toLocaleString()}`,
    source,
    payload: {
      estimated: tokenTotals.estimatedCalls > 0,
      usage,
      totals: { ...tokenTotals },
    },
  });

  return { usage, changed: true };
}

function actorForPath(path) {
  const base = path.split('/').pop();
  if (base === 'qwen.txt') return 'qwen';
  if (base === 'qa.txt') return 'qa';
  if (base === 'claude.txt' || base === 'review.md') return 'claude';
  if (base === 'commit.txt' || path.endsWith('changes.diff') || path.endsWith('ticket.diff')) return 'git';
  if (base === 'metrics.json' || base === 'screenshot.log') return 'qa';
  if (base === 'events.ndjson') return 'harness';
  return 'harness';
}

function kindForPath(path) {
  if (path.endsWith('.diff')) return 'patch';
  if (path.endsWith('metrics.json')) return 'qa_scene';
  if (path.endsWith('review.md') || path.endsWith('gaps.md') || path.endsWith('nits.md')) return 'review';
  if (path.endsWith('events.ndjson')) return 'explicit';
  return 'line';
}

function titleForLine(line, path) {
  if (/VERDICT: PASS/.test(line)) return 'Verdict: PASS';
  if (/VERDICT: FAIL/.test(line)) return 'Verdict: FAIL';
  const ticket = path.match(/tickets\/([^/]+)/)?.[1];
  const sub = path.match(/subtickets\/([^/]+)/)?.[1];
  if (line.includes('sub-ticket PASSED')) return `${sub || 'Sub-ticket'} passed`;
  if (line.includes('sub-ticket FAILED')) return `${sub || 'Sub-ticket'} failed`;
  if (line.includes('top-level ticket')) return `${ticket || 'Ticket'} started`;
  if (line.includes('[qwen]')) return 'Qwen working';
  if (line.includes('[qa]')) return 'QA update';
  if (line.includes('[review]')) return 'Review update';
  if (line.includes('[git] committed')) return 'Commit created';
  return sub || ticket || path.split('/').pop();
}

function eventKey(event) {
  return [
    event.source || '',
    event.kind || '',
    event.actor || '',
    event.title || '',
    event.text || '',
    event.hash || '',
  ].join('\u0000');
}

function emit(event) {
  const enriched = {
    id: nextId++,
    ts: nowIso(),
    ...event,
  };
  const key = eventKey(enriched);
  if (seen.has(key)) return;
  seen.add(key);
  events.push(enriched);
  if (events.length > MAX_EVENTS) events.shift();
  for (const res of clients) {
    res.write(`id: ${enriched.id}\n`);
    res.write(`event: progress\n`);
    res.write(`data: ${JSON.stringify(enriched)}\n\n`);
  }
}

function emitTransient(event) {
  const enriched = {
    id: nextId++,
    ts: nowIso(),
    ...event,
  };
  for (const res of clients) {
    res.write(`id: ${enriched.id}\n`);
    res.write(`event: progress\n`);
    res.write(`data: ${JSON.stringify(enriched)}\n\n`);
  }
}

function replay(res) {
  for (const event of events) {
    res.write(`id: ${event.id}\n`);
    res.write(`event: progress\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}

function safeRel(urlPath) {
  const decoded = decodeURIComponent(urlPath.replace(/^\/artifacts\//, ''));
  const abs = resolve(repoRoot, decoded);
  if (abs !== repoRoot && !abs.startsWith(repoRoot + sep)) return null;
  return { abs, rel: relative(repoRoot, abs) };
}

function walk(start, out = []) {
  if (!existsSync(start)) return out;
  const st = statSync(start);
  if (st.isFile()) {
    const rel = relative(repoRoot, start).replaceAll(sep, '/');
    if (WATCH_FILE_RE.test(rel)) out.push(start);
    return out;
  }
  if (!st.isDirectory()) return out;
  for (const entry of readdirSync(start, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const child = join(start, entry.name);
    if (entry.isDirectory()) {
      walk(child, out);
    } else {
      const rel = relative(repoRoot, child).replaceAll(sep, '/');
      if (WATCH_FILE_RE.test(rel)) out.push(child);
    }
  }
  return out;
}

function scanFiles() {
  const files = [];
  for (const root of WATCH_ROOTS) walk(join(repoRoot, root), files);
  for (const file of files) scanFile(file);
}

function scanFile(file) {
  let text;
  let st;
  try {
    st = statSync(file);
    if (st.size > 5 * 1024 * 1024) return;
    text = readFileSync(file, 'utf8');
  } catch {
    return;
  }

  const rel = relative(repoRoot, file).replaceAll(sep, '/');
  if (rel.endsWith('events.ndjson')) {
    scanExplicitEvents(rel, text);
    return;
  }
  if (rel.endsWith('metrics.json')) {
    scanMetrics(rel, text);
    return;
  }
  if (rel.endsWith('.diff')) {
    scanDiff(rel, text);
    return;
  }

  const prev = fileOffsets.get(file) ?? 0;
  const start = Math.min(prev, text.length);
  fileOffsets.set(file, text.length);
  if (start === text.length) return;
  const chunk = text.slice(start);
  for (const raw of chunk.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    emit({
      kind: kindForPath(rel),
      actor: actorForPath(rel),
      title: titleForLine(line, rel),
      text: line.slice(0, MAX_LINE),
      source: rel,
    });
  }
}

function splitJsonRecords(text) {
  const records = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (start < 0) {
      if (/\s/.test(ch)) continue;
      if (ch !== '{') {
        const nextLine = text.indexOf('\n', i);
        const end = nextLine < 0 ? text.length : nextLine;
        records.push(text.slice(i, end));
        i = end;
        continue;
      }
      start = i;
      depth = 1;
      inString = false;
      escaped = false;
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        records.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  if (start >= 0) records.push(text.slice(start));
  return records;
}

function scanExplicitEvents(rel, text) {
  for (const raw of splitJsonRecords(text)) {
    if (!raw.trim()) continue;
    try {
      const event = JSON.parse(raw);
      emit(normalizeExplicitEvent(event, rel, raw));
    } catch {
      emit({
        kind: 'explicit',
        actor: 'harness',
        title: 'Malformed progress event',
        text: raw.slice(0, MAX_LINE),
        source: rel,
      });
    }
  }
}

function normalizeExplicitEvent(event, source, raw = '') {
  const kind = event.type || event.kind || 'explicit';
  const payload = event.payload || event;
  const label = payload.label || payload.ticket || '';
  const usageResult = kind === 'agent_usage' ? recordAgentUsage(payload, source) : null;
  const normalized = {
    kind,
    actor: event.actor || 'harness',
    title: event.title || kind || 'Harness event',
    text: event.message || '',
    payload,
    source,
    // Keep repeated scans idempotent while allowing payload-only changes, like
    // consecutive commit events with distinct SHAs, to appear separately.
    hash: event.hash || raw || JSON.stringify(event),
  };

  if (kind === 'commit_start') {
    normalized.actor = 'git';
    normalized.title = 'Creating commit';
    normalized.text = [payload.base, payload.message].filter(Boolean).join(' ');
  } else if (kind === 'commit') {
    normalized.actor = 'git';
    normalized.title = 'Commit created';
    normalized.text = [payload.sha, payload.message].filter(Boolean).join(' ');
  } else if (kind === 'commit_skipped') {
    normalized.actor = 'git';
    normalized.title = 'Commit skipped';
    normalized.text = `${payload.message || 'No commit'} (${payload.reason || 'no changes'})`;
  } else if (kind === 'commit_failed') {
    normalized.actor = 'git';
    normalized.title = 'Commit failed';
    normalized.text = `${payload.message || 'Commit failed'} (${payload.reason || 'unknown'})`;
  } else if (kind === 'capture_metrics') {
    normalized.kind = 'qa_scene';
    normalized.actor = 'qa';
    normalized.title = payload.ok === false ? 'QA scene failed' : 'QA scene captured';
    normalized.text = payload.source
      ? `${label || 'capture'} (${payload.source})`
      : (label || `${Array.isArray(payload.screenshots) ? payload.screenshots.length : 0} screenshot(s) captured`);
    normalized.source = payload.artifacts ? `${payload.artifacts}/metrics.json` : source;
  } else if (kind === 'capture_start') {
    normalized.actor = 'qa';
    normalized.title = 'Capturing screenshots';
    normalized.text = label || payload.artifacts || 'capture started';
  } else if (kind === 'capture_complete') {
    normalized.actor = 'qa';
    normalized.title = 'Screenshot capture complete';
    normalized.text = [label, payload.status].filter(Boolean).join(' ');
  } else if (kind === 'agent_start') {
    normalized.actor = payload.agent || 'agent';
    normalized.title = `${payload.agent || 'agent'} started`;
    normalized.text = payload.outfile || '';
  } else if (kind === 'agent_finish') {
    normalized.actor = payload.agent || 'agent';
    normalized.title = `${payload.agent || 'agent'} finished`;
    normalized.text = [payload.status, payload.reason].filter(Boolean).join(' ');
  } else if (kind === 'agent_usage') {
    const usage = usageResult?.usage || normalizeUsagePayload(payload) || payload;
    normalized.actor = usage.agent || 'agent';
    normalized.title = `${usage.agent || 'agent'} token usage`;
    normalized.text = `${usage.totalTokens || 0} token(s)${usage.estimated ? ' estimated' : ''}`;
    normalized.payload = {
      ...payload,
      usage,
      estimated: tokenTotals.estimatedCalls > 0,
      totals: { ...tokenTotals },
    };
  } else if (kind === 'qa_verified' || kind === 'qa_verdict') {
    normalized.actor = 'qa';
    normalized.title = kind === 'qa_verdict' ? `QA ${payload.verdict || 'verdict'}` : 'QA verified';
    normalized.text = [label, payload.agent, payload.mode].filter(Boolean).join(' ');
  } else if (kind === 'subtask_start' || kind === 'iteration_start') {
    normalized.title = kind === 'subtask_start' ? 'Subtask started' : 'Iteration started';
    normalized.text = [label, payload.qaMode ? `QA: ${payload.qaMode}` : '', payload.artifacts].filter(Boolean).join(' ');
  } else if (kind === 'subtask_passed' || kind === 'subtask_marked_passed') {
    normalized.title = 'Subtask passed';
    normalized.text = label || [payload.ticket, payload.subtask].filter(Boolean).join('/');
  } else if (kind === 'game_start' || kind === 'game_stop') {
    normalized.title = kind === 'game_start' ? 'Game started' : 'Game stopped';
    normalized.text = payload.url || '';
  } else if (kind === 'pipeline_check_start') {
    normalized.actor = 'harness';
    normalized.title = 'Local checks started';
    normalized.text = [payload.cwd, payload.command].filter(Boolean).join(' $ ');
  } else if (kind === 'pipeline_check_finish') {
    normalized.actor = 'harness';
    normalized.title = payload.rc === 0 ? 'Local checks passed' : 'Local checks failed';
    normalized.text = [payload.reason, payload.outfile].filter(Boolean).join(' ');
  }

  normalized.text = normalized.text.slice(0, MAX_LINE);
  return normalized;
}

function scanMetrics(rel, text) {
  const digest = `${text.length}:${text.slice(0, 128)}:${text.slice(-128)}`;
  if (fileDigests.get(rel) === digest) return;
  fileDigests.set(rel, digest);
  try {
    const metrics = JSON.parse(text);
    const screenshots = Array.isArray(metrics.screenshots) ? metrics.screenshots : [];
    emit({
      kind: 'qa_scene',
      actor: 'qa',
      title: metrics.ok ? 'QA scene captured' : 'QA scene failed',
      text: metrics.capturePlanSummary || metrics.error || `${screenshots.length} screenshot(s) captured`,
      source: rel,
      payload: {
        ok: metrics.ok,
        scenarios: metrics.scenarios || [],
        capturePlanSource: metrics.capturePlanSource,
        screenshots,
      },
    });
  } catch {
    emit({
      kind: 'qa_scene',
      actor: 'qa',
      title: 'Metrics updated',
      text: text.slice(0, MAX_LINE),
      source: rel,
    });
  }
}

function scanDiff(rel, text) {
  const digest = `${text.length}:${text.slice(0, 128)}:${text.slice(-128)}`;
  if (fileDigests.get(rel) === digest) return;
  fileDigests.set(rel, digest);
  if (!text.trim()) return;
  const added = (text.match(/^\+/gm) || []).length;
  const removed = (text.match(/^-/gm) || []).length;
  emit({
    kind: 'patch',
    actor: 'git',
    title: 'Patch updated',
    text: `${added} additions, ${removed} removals`,
    source: rel,
    payload: {
      diff: text.slice(0, 12000),
      added,
      removed,
    },
  });
}

function scanGit() {
  const result = spawnSync('git', ['log', '--decorate', '--oneline', '-5'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.status !== 0) return;
  const head = result.stdout.split('\n')[0]?.trim();
  if (!head || head === lastGitHead) return;
  lastGitHead = head;
  emit({
    kind: 'commit',
    actor: 'git',
    title: 'Git HEAD moved',
    text: head,
    source: 'git log',
  });
}

function parseCsvLine(line) {
  return line.split(',').map(part => part.trim());
}

function scanGpu() {
  if (process.env.GPU_PROGRESS === '0') return;

  const gpuResult = spawnSync('nvidia-smi', [
    '--query-gpu=index,name,utilization.gpu,utilization.memory,memory.used,memory.total,temperature.gpu,power.draw,power.limit',
    '--format=csv,noheader,nounits',
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 2000,
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  if (gpuResult.status !== 0 || !gpuResult.stdout.trim()) {
    if (lastGpuDigest !== 'unavailable') {
      lastGpuDigest = 'unavailable';
      emit({
        kind: 'gpu_sample',
        actor: 'gpu',
        title: 'GPU monitor unavailable',
        text: 'nvidia-smi did not return GPU metrics. Run nvtop in a terminal for interactive monitoring.',
        source: 'nvidia-smi',
        payload: { available: false },
      });
    }
    return;
  }

  const gpus = gpuResult.stdout.trim().split(/\r?\n/).map((line) => {
    const [index, name, gpuUtil, memUtil, memUsed, memTotal, temp, powerDraw, powerLimit] = parseCsvLine(line);
    return {
      index: Number(index),
      name,
      gpuUtil: Number(gpuUtil),
      memUtil: Number(memUtil),
      memUsedMb: Number(memUsed),
      memTotalMb: Number(memTotal),
      tempC: Number(temp),
      powerDrawW: Number(powerDraw),
      powerLimitW: Number(powerLimit),
    };
  });

  const procResult = spawnSync('nvidia-smi', [
    '--query-compute-apps=pid,process_name,used_gpu_memory',
    '--format=csv,noheader,nounits',
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 2000,
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  const processes = procResult.status === 0 && procResult.stdout.trim()
    ? procResult.stdout.trim().split(/\r?\n/).map((line) => {
      const [pid, name, usedMemory] = parseCsvLine(line);
      return { pid: Number(pid), name, usedMemoryMb: Number(usedMemory) };
    })
    : [];

  const digest = JSON.stringify({ gpus, processes });
  if (digest === lastGpuDigest) return;
  lastGpuDigest = digest;

  const summary = gpus.map(gpu =>
    `GPU${gpu.index} ${gpu.gpuUtil}% · ${gpu.memUsedMb}/${gpu.memTotalMb} MiB · ${gpu.tempC}C`
  ).join(' | ');

  emit({
    kind: 'gpu_sample',
    actor: 'gpu',
    title: 'GPU usage',
    text: summary,
    source: 'nvidia-smi',
    payload: {
      available: true,
      gpus,
      processes: processes.slice(0, 8),
      interactiveCommand: 'nvtop',
    },
  });
}

function contentType(path) {
  const ext = extname(path);
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.svg') return 'image/svg+xml';
  return 'text/plain; charset=utf-8';
}

function serveFile(res, path) {
  try {
    const body = readFileSync(path);
    res.writeHead(200, { 'content-type': contentType(path) });
    res.end(body);
  } catch {
    if (!res.headersSent) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    }
    res.end('not found');
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/events' && req.method === 'POST') {
    if (!isLocalRequest(req)) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('POST /events is only accepted from localhost');
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      try {
        const event = JSON.parse(body);
        emit(normalizeExplicitEvent(event, 'POST /events', body));
        res.writeHead(204);
        res.end();
      } catch {
        res.writeHead(400);
        res.end('bad event');
      }
    });
    return;
  }

  if (url.pathname === '/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    clients.add(res);
    replay(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (url.pathname === '/state') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ events, repoRoot, tokenTotals }, null, 2));
    return;
  }

  if (url.pathname === '/tokens') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ estimated: tokenTotals.estimatedCalls > 0, totals: tokenTotals }, null, 2));
    return;
  }

  if (url.pathname === '/gpu') {
    const latest = [...events].reverse().find(event => event.kind === 'gpu_sample') || null;
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(latest ? latest.payload : { available: false }, null, 2));
    return;
  }

  if (url.pathname.startsWith('/artifacts/')) {
    const safe = safeRel(url.pathname);
    if (!safe) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    serveFile(res, safe.abs);
    return;
  }

  const file = url.pathname === '/' || url.pathname === '/live'
    ? join(publicDir, 'index.html')
    : join(publicDir, url.pathname.replace(/^\/+/, ''));
  if (!resolve(file).startsWith(publicDir + sep) && resolve(file) !== publicDir) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  serveFile(res, file);
});

setInterval(() => {
  scanFiles();
  scanGit();
}, 1500);
const gpuPollInterval = Number(process.env.GPU_POLL_INTERVAL_MS || 5000);
if (gpuPollInterval > 0) setInterval(scanGpu, gpuPollInterval);
scanFiles();
scanGit();
if (gpuPollInterval > 0) scanGpu();

server.listen(port, () => {
  writeFileSync(eventLogPath, existsSync(eventLogPath) ? readFileSync(eventLogPath) : '');
  console.log(`Autogame Live progress stream: http://localhost:${port}/live`);
});
