#!/usr/bin/env node
import { createServer } from 'http';
import { spawnSync } from 'child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
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
const host = process.env.PROGRESS_SERVER_HOST || '127.0.0.1';

mkdirSync(progressDir, { recursive: true });

const clients = new Set();
const events = [];
const seen = new Set();
const fileOffsets = new Map();
const fileDigests = new Map();
const agentUsageByKey = new Map();
const agentUsageDigests = new Map();
const tokenTotals = emptyTokenTotals();
const reviewDirActors = new Map();
let nextId = 1;
let lastGitHead = '';
let lastGpuDigest = '';
const gpuUptimePath = join(progressDir, 'gpu-uptime.json');
const tokenTotalsPath = join(progressDir, 'token-totals.json');
const GPU_ACTIVE_UTIL_MIN = Number(process.env.GPU_ACTIVE_UTIL_MIN || 3);
const GPU_ACTIVE_VRAM_MIN = Number(process.env.GPU_ACTIVE_VRAM_MIN || 10);
const GPU_ACTIVE_POWER_MIN = Number(process.env.GPU_ACTIVE_POWER_MIN || 80);
const GPU_UPTIME_MAX_DELTA_MS = Number(process.env.GPU_UPTIME_MAX_DELTA_MS || 60000);

let gpuUptime = loadGpuUptime();

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

const WATCH_FILE_RE = /(^|\/)(log\.txt|qwen\.txt|qa\.txt|commit\.txt|claude\.txt|composer\.txt|agent\.txt|review\.md|gaps\.md|nits\.md|changes\.diff|ticket\.diff|metrics\.json|screenshot\.log|events\.ndjson|LOOPLOG\.txt|LOGBOOK\.md|TASKS\.md)$/;
const REVIEW_DIR_RE = /\/(?:review-round-\d+|rescue-review)$/;
const MAX_LINE = 1200;
const MAX_EVENTS = 1000;

function argValue(name) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

function nowIso() {
  return new Date().toISOString();
}

function isProxiedRequest(req) {
  // ngrok and other reverse proxies terminate TLS and forward to localhost,
  // so remoteAddress alone is not enough to distinguish harness vs the internet.
  return Boolean(
    req.headers['x-forwarded-for'] ||
    req.headers['x-forwarded-proto'] ||
    req.headers['x-forwarded-host'],
  );
}

function isHarnessLocalPost(req) {
  if (isProxiedRequest(req)) return false;
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
    lastQwenTokPerSec: null,
  };
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function isQwenAgent(agent) {
  const label = String(agent || '').toLowerCase();
  return label === 'qwen' || label === 'qwen-vision' || label.startsWith('qwen-');
}

function computeTokensPerSecond(usage) {
  const tokens = numberOrZero(usage?.totalTokens);
  const durationMs = Number(usage?.durationMs);
  if (!tokens || !Number.isFinite(durationMs) || durationMs <= 0) return null;
  const rate = tokens / (durationMs / 1000);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function formatTokensPerSec(rate) {
  if (!Number.isFinite(rate) || rate <= 0) return '';
  if (rate < 10) return `~${rate.toFixed(1)}`;
  if (rate < 10000) return `~${Math.round(rate)}`;
  return `~${(rate / 1000).toFixed(1)}k`;
}

const FINAL_REVIEW_OUTFILE_RE = /\/(?:review-round-\d+|rescue-review)\/(?:composer|agent)\.txt$/;

function isFinalReviewUsage(usage) {
  if (!usage || usage.bucket !== 'remote') return false;
  if (usage.usageKind === 'final_review') return true;
  const outfile = String(usage.outfile || '').replaceAll('\\', '/');
  return FINAL_REVIEW_OUTFILE_RE.test(outfile);
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
    usageKind: payload.usageKind || null,
    outfile,
    attempt,
    rc: Number(payload.rc) || 0,
    status: payload.status || '',
    reason: payload.reason || null,
    durationMs: payload.durationMs === null || payload.durationMs === undefined ? null : numberOrZero(payload.durationMs),
    endedAtMs: payload.endedAtMs === null || payload.endedAtMs === undefined ? null : numberOrZero(payload.endedAtMs),
    inputTokens: payload.inputTokens === null || payload.inputTokens === undefined ? null : numberOrZero(payload.inputTokens),
    outputTokens: payload.outputTokens === null || payload.outputTokens === undefined ? null : numberOrZero(payload.outputTokens),
    totalTokens,
    estimated: Boolean(payload.estimated),
    source: payload.source || (payload.estimated ? 'per_call_estimate' : 'cli_usage'),
  };
}

function recomputeTokenTotals() {
  const next = emptyTokenTotals();
  let latestQwenEndedAt = 0;
  for (const usage of agentUsageByKey.values()) {
    const countsTowardTotals = usage.bucket === 'local' || isFinalReviewUsage(usage);
    if (!countsTowardTotals) continue;

    next[usage.bucket] += usage.totalTokens;
    if (usage.estimated) {
      next.estimated[usage.bucket] += usage.totalTokens;
      next.estimatedCalls += 1;
    } else {
      next.exact[usage.bucket] += usage.totalTokens;
    }
    next.calls += 1;

    if (isQwenAgent(usage.agent)) {
      const rate = computeTokensPerSecond(usage);
      const endedAt = Number(usage.endedAtMs) || 0;
      if (rate != null && endedAt >= latestQwenEndedAt) {
        latestQwenEndedAt = endedAt;
        next.lastQwenTokPerSec = rate;
      }
    }
  }
  Object.assign(tokenTotals, next);
}

function loadTokenState() {
  if (!existsSync(tokenTotalsPath)) return;
  try {
    const saved = JSON.parse(readFileSync(tokenTotalsPath, 'utf8'));
    const usages = Array.isArray(saved.usages) ? saved.usages : [];
    for (const usage of usages) {
      const normalized = normalizeUsagePayload(usage);
      if (!normalized) continue;
      agentUsageDigests.set(normalized.key, JSON.stringify(normalized));
      agentUsageByKey.set(normalized.key, normalized);
    }
    if (usages.length) recomputeTokenTotals();
  } catch {
    // ignore corrupt token snapshot
  }
}

function saveTokenState() {
  try {
    const payload = {
      savedAt: nowIso(),
      totals: { ...tokenTotals },
      usages: [...agentUsageByKey.values()],
    };
    writeFileSync(tokenTotalsPath, `${JSON.stringify(payload, null, 2)}\n`);
  } catch {
    // best-effort persistence
  }
}

function ingestAgentUsage(payload) {
  const usage = normalizeUsagePayload(payload || {});
  if (!usage) return false;
  const digest = JSON.stringify(usage);
  if (agentUsageDigests.get(usage.key) === digest) return false;
  agentUsageDigests.set(usage.key, digest);
  agentUsageByKey.set(usage.key, usage);
  return true;
}

function recordAgentUsage(payload, source) {
  const usage = normalizeUsagePayload(payload || {});
  if (!usage) return null;
  if (!ingestAgentUsage(payload)) return { usage, changed: false };

  recomputeTokenTotals();
  saveTokenState();

  emitTransient({
    kind: 'token_usage',
    actor: 'harness',
    title: 'Token usage updated',
    text: `local ${tokenTotals.local.toLocaleString()} / remote reviews ${tokenTotals.remote.toLocaleString()}`,
    source,
    payload: {
      estimated: tokenTotals.estimatedCalls > 0,
      usage,
      totals: { ...tokenTotals },
    },
  });

  return { usage, changed: true };
}

function reviewDirFromPath(path) {
  const normalized = String(path || '').replaceAll('\\', '/');
  const dir = normalized.includes('/')
    ? normalized.slice(0, normalized.lastIndexOf('/'))
    : '';
  return REVIEW_DIR_RE.test(dir) ? dir : null;
}

function rememberReviewAgent(outfile, agent) {
  const dir = reviewDirFromPath(outfile);
  const label = String(agent || '').trim();
  if (dir && label) reviewDirActors.set(dir, label);
}

function reviewAgentFromUsage(dirRel) {
  const usagePath = join(repoRoot, dirRel, 'agent-usage.ndjson');
  if (!existsSync(usagePath)) return null;
  try {
    const lines = readFileSync(usagePath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const row = JSON.parse(lines[i]);
      if (row.agent) return String(row.agent);
    }
  } catch {
    return null;
  }
  return null;
}

function reviewAgentForDir(dirRel) {
  if (!dirRel) return null;
  if (reviewDirActors.has(dirRel)) return reviewDirActors.get(dirRel);
  const fromUsage = reviewAgentFromUsage(dirRel);
  if (fromUsage) return fromUsage;

  const absDir = join(repoRoot, dirRel);
  if (existsSync(join(absDir, 'composer.txt'))) return 'composer';
  if (existsSync(join(absDir, 'agent.txt'))) return 'agent';
  if (existsSync(join(absDir, 'claude.txt'))) return 'claude';
  return null;
}

function reviewActorForPath(path) {
  const normalized = String(path || '').replaceAll('\\', '/');
  const base = normalized.split('/').pop();
  const dir = reviewDirFromPath(normalized);

  if (base === 'composer.txt') return reviewAgentForDir(dir) || 'composer';
  if (base === 'agent.txt') return reviewAgentForDir(dir) || 'agent';
  if (base === 'claude.txt') return 'claude';
  if (base === 'review.md' || base === 'gaps.md' || base === 'nits.md') {
    return reviewAgentForDir(dir) || 'review';
  }
  return null;
}

function difficultyFromLine(line) {
  const m = String(line || '').match(/\(difficulty:\s*(easy|medium|hard)\)/i);
  return m ? m[1].toLowerCase() : null;
}

function actorFromHarnessLog(line) {
  const reviewing = line.match(/\[([^\]]+)\]\s+reviewing\b/i);
  if (reviewing) return reviewing[1];
  const verified = line.match(/verified by ([^\s(]+)/i);
  if (verified) return verified[1];
  if (/\[claude\]/i.test(line)) return 'claude';
  if (/\[qwen\]/i.test(line)) return 'qwen';
  if (/\[qa\]/i.test(line)) return 'qa';
  if (/\[review\]/i.test(line)) return 'review';
  return null;
}

function actorForPath(path) {
  const reviewActor = reviewActorForPath(path);
  if (reviewActor) return reviewActor;

  const base = path.split('/').pop();
  if (base === 'qwen.txt') return 'qwen';
  if (base === 'qa.txt') return 'qa';
  if (base === 'commit.txt' || path.endsWith('changes.diff') || path.endsWith('ticket.diff')) return 'git';
  if (base === 'metrics.json' || base === 'screenshot.log') return 'qa';
  if (base === 'events.ndjson') return 'harness';
  return 'harness';
}

function actorForSource(rel, line = '') {
  if (rel.endsWith('LOOPLOG.txt') || rel.endsWith('log.txt')) {
    const fromLine = actorFromHarnessLog(line);
    if (fromLine) return fromLine;
  }
  return actorForPath(rel);
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
  if (/\breviewing\b/i.test(line)) return 'Review started';
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

function writeSseEvent(res, event, id = event.id) {
  res.write(`id: ${id}\n`);
  res.write('event: progress\n');
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function replay(res) {
  writeSseEvent(res, {
    id: 'token-totals',
    ts: nowIso(),
    kind: 'token_usage',
    actor: 'harness',
    title: 'Token usage snapshot',
    text: `local ${tokenTotals.local.toLocaleString()} / remote reviews ${tokenTotals.remote.toLocaleString()}`,
    source: 'persisted',
    payload: {
      estimated: tokenTotals.estimatedCalls > 0,
      totals: { ...tokenTotals },
    },
  }, 'token-totals');

  const uptime = gpuUptimeSnapshot();
  writeSseEvent(res, {
    id: 'gpu-uptime',
    ts: nowIso(),
    kind: 'gpu_uptime',
    actor: 'gpu',
    title: 'GPU hours snapshot',
    text: `${uptime.totalHours.toFixed(2)} GPU·hr`,
    source: 'persisted',
    payload: { uptime },
  }, 'gpu-uptime');

  for (const event of events) {
    writeSseEvent(res, event);
  }
}

function safeRel(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.replace(/^\/artifacts\//, ''));
  } catch {
    return { error: 'bad_request' };
  }
  const abs = resolve(repoRoot, decoded);
  if (abs !== repoRoot && !abs.startsWith(repoRoot + sep)) return null;
  const rel = relative(repoRoot, abs).replaceAll(sep, '/');
  const parts = rel.split('/');
  // Per-round QA captures land at tickets/<name>/round-N/*.png (and review-round
  // / rescue-review dirs) — NO "artifacts" path segment — so the allowlist below
  // would 403 every screenshot (the live view stopped showing them after the
  // networking-exposure lockdown). Re-permit capture images anywhere under
  // tickets/, but ONLY media extensions: this can't serve ticket source, .md, or
  // .diff over the (possibly proxied) live view — just the rendered captures.
  const isCaptureImage = rel.startsWith('tickets/')
    && ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(extname(rel).toLowerCase());
  const allowed = parts.includes('artifacts')
    || rel.startsWith('harness/.smoketest/')
    || isCaptureImage;
  if (!allowed) return null;
  return { abs, rel };
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

function readTailSync(file, size, maxBytes) {
  // Last maxBytes of the file, trimmed to whole lines (drop the partial first).
  const fd = openSync(file, 'r');
  try {
    const start = Math.max(0, size - maxBytes);
    const buf = Buffer.alloc(size - start);
    readSync(fd, buf, 0, buf.length, start);
    const text = buf.toString('utf8');
    if (start === 0) return text;
    const nl = text.indexOf('\n');
    return nl >= 0 ? text.slice(nl + 1) : '';
  } finally {
    closeSync(fd);
  }
}

function scanFile(file) {
  let text;
  let st;
  try {
    st = statSync(file);
    if (st.size > 5 * 1024 * 1024) {
      // A long-lived events.ndjson grows past the cap and the view went BLIND
      // to all dispatcher events (observed at 9.5MB). Ingest the tail instead
      // of skipping — scanExplicitEvents dedupes, so re-reads are idempotent.
      if (!file.endsWith('events.ndjson')) return;
      text = readTailSync(file, st.size, 1024 * 1024);
    } else {
      text = readFileSync(file, 'utf8');
    }
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
    const difficulty = difficultyFromLine(line);
    emit({
      kind: kindForPath(rel),
      actor: actorForSource(rel, line),
      title: titleForLine(line, rel),
      text: line.slice(0, MAX_LINE),
      source: rel,
      payload: difficulty ? { difficulty } : undefined,
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
    rememberReviewAgent(payload.outfile, payload.agent);
    normalized.actor = payload.agent || 'agent';
    normalized.title = `${payload.agent || 'agent'} started`;
    normalized.text = payload.outfile || '';
  } else if (kind === 'agent_finish') {
    rememberReviewAgent(payload.outfile, payload.agent);
    normalized.actor = payload.agent || 'agent';
    normalized.title = `${payload.agent || 'agent'} finished`;
    normalized.text = [payload.status, payload.reason].filter(Boolean).join(' ');
  } else if (kind === 'ticket_start') {
    normalized.title = payload.difficulty
      ? `Ticket started (${payload.difficulty})`
      : 'Ticket started';
    normalized.text = [payload.ticket, payload.baseline].filter(Boolean).join(' ');
  } else if (kind === 'review_start') {
    const dir = payload.review ? reviewDirFromPath(payload.review) : null;
    if (dir && payload.agent) rememberReviewAgent(`${dir}/review.md`, payload.agent);
    normalized.actor = payload.agent || 'review';
    normalized.title = payload.difficulty
      ? `Review started (${payload.difficulty})`
      : 'Review started';
    normalized.text = [payload.ticket, payload.round != null ? `round ${payload.round}` : ''].filter(Boolean).join(' ');
  } else if (kind === 'review_verdict') {
    const dir = payload.review ? reviewDirFromPath(payload.review) : null;
    normalized.actor = payload.agent || (dir ? reviewAgentForDir(dir) : null) || 'review';
    normalized.title = payload.difficulty
      ? `Review ${payload.verdict || 'verdict'} (${payload.difficulty})`
      : `Review ${payload.verdict || 'verdict'}`;
    normalized.text = [payload.ticket, payload.round != null ? `round ${payload.round}` : '', payload.review]
      .filter(Boolean)
      .join(' ');
  } else if (kind === 'agent_usage') {
    const usage = usageResult?.usage || normalizeUsagePayload(payload) || payload;
    const tokPerSec = isQwenAgent(usage.agent) ? computeTokensPerSecond(usage) : null;
    const rateText = tokPerSec != null ? ` · ${formatTokensPerSec(tokPerSec)} tok/s` : '';
    const durationSec = usage.durationMs ? (usage.durationMs / 1000).toFixed(1) : null;
    normalized.actor = usage.agent || 'agent';
    normalized.title = `${usage.agent || 'agent'} token usage`;
    normalized.text = `${usage.totalTokens || 0} token(s)${usage.estimated ? ' estimated' : ''}${rateText}`;
    normalized.payload = {
      ...payload,
      usage: {
        ...usage,
        tokensPerSecond: tokPerSec,
      },
      estimated: tokenTotals.estimatedCalls > 0,
      totals: { ...tokenTotals },
    };
    if (durationSec) {
      normalized.text += ` (${durationSec}s)`;
    }
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

function loadGpuUptime() {
  const empty = {
    startedAt: null,
    lastSampleAt: null,
    totalMs: 0,
    offsetMs: 0,
    byIndex: {},
  };
  if (!existsSync(gpuUptimePath)) return empty;
  try {
    const saved = JSON.parse(readFileSync(gpuUptimePath, 'utf8'));
    return {
      startedAt: saved.startedAt || null,
      lastSampleAt: saved.lastSampleAt || null,
      totalMs: Number(saved.totalMs) || 0,
      offsetMs: Number(saved.offsetMs) || 0,
      byIndex: saved.byIndex && typeof saved.byIndex === 'object' ? saved.byIndex : {},
    };
  } catch {
    return empty;
  }
}

function saveGpuUptime() {
  try {
    writeFileSync(gpuUptimePath, `${JSON.stringify(gpuUptime, null, 2)}\n`);
  } catch {
    // best-effort persistence
  }
}

function isGpuActive(gpu) {
  const util = Number(gpu.gpuUtil) || 0;
  const vram = Number(gpu.memUsedPercent) || 0;
  const power = Number(gpu.powerDrawW) || 0;
  return util >= GPU_ACTIVE_UTIL_MIN
    || vram >= GPU_ACTIVE_VRAM_MIN
    || power >= GPU_ACTIVE_POWER_MIN;
}

function gpuUptimeSnapshot(activeCount = 0) {
  const now = Date.now();
  const sessionMs = gpuUptime.startedAt ? Math.max(0, now - gpuUptime.startedAt) : 0;
  const offsetMs = Number(gpuUptime.offsetMs) || 0;
  const trackedMs = Number(gpuUptime.totalMs) || 0;
  const totalMs = trackedMs + offsetMs;
  const indexKeys = Object.keys(gpuUptime.byIndex);
  const offsetShare = indexKeys.length > 0 ? offsetMs / indexKeys.length : 0;
  const byIndex = Object.fromEntries(
    Object.entries(gpuUptime.byIndex).map(([index, row]) => {
      const ms = (Number(row.ms) || 0) + offsetShare;
      return [index, { ms, trackedMs: Number(row.ms) || 0, hours: ms / 3600000 }];
    }),
  );
  return {
    startedAt: gpuUptime.startedAt,
    lastSampleAt: gpuUptime.lastSampleAt,
    sessionMs,
    sessionHours: sessionMs / 3600000,
    trackedMs,
    trackedHours: trackedMs / 3600000,
    offsetMs,
    offsetHours: offsetMs / 3600000,
    totalMs,
    totalHours: totalMs / 3600000,
    activeGpus: activeCount,
    byIndex,
  };
}

function accumulateGpuUptime(gpus) {
  const now = Date.now();
  if (!gpus.length) return gpuUptimeSnapshot(0);

  if (!gpuUptime.startedAt) gpuUptime.startedAt = now;

  if (gpuUptime.lastSampleAt) {
    const delta = Math.min(
      Math.max(0, now - gpuUptime.lastSampleAt),
      GPU_UPTIME_MAX_DELTA_MS,
    );
    if (delta > 0) {
      for (const gpu of gpus) {
        if (!isGpuActive(gpu)) continue;
        const key = String(gpu.index);
        if (!gpuUptime.byIndex[key]) gpuUptime.byIndex[key] = { ms: 0 };
        gpuUptime.byIndex[key].ms += delta;
        gpuUptime.totalMs += delta;
      }
    }
  }

  let activeCount = 0;
  for (const gpu of gpus) {
    if (isGpuActive(gpu)) activeCount += 1;
  }

  gpuUptime.lastSampleAt = now;
  saveGpuUptime();
  return gpuUptimeSnapshot(activeCount);
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
    const [index, name, gpuUtil, memBandwidthUtil, memUsed, memTotal, temp, powerDraw, powerLimit] = parseCsvLine(line);
    const memUsedMb = Number(memUsed);
    const memTotalMb = Number(memTotal);
    const memUsedPercent = memTotalMb > 0
      ? Math.round((memUsedMb / memTotalMb) * 100)
      : 0;
    return {
      index: Number(index),
      name,
      gpuUtil: Number(gpuUtil),
      // nvidia-smi utilization.memory = memory-controller bandwidth, not VRAM fill.
      memBandwidthUtil: Number(memBandwidthUtil),
      memUsedPercent,
      memUsedMb,
      memTotalMb,
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

  const uptime = accumulateGpuUptime(gpus);
  const digest = JSON.stringify({ gpus, processes });
  if (digest === lastGpuDigest) {
    emitTransient({
      kind: 'gpu_uptime',
      actor: 'gpu',
      title: 'GPU hours updated',
      text: `${uptime.totalHours.toFixed(2)} GPU·hr (${uptime.activeGpus} active)`,
      source: 'nvidia-smi',
      payload: { uptime },
    });
    return;
  }
  lastGpuDigest = digest;

  const summary = gpus.map(gpu =>
    `GPU${gpu.index} ${gpu.gpuUtil}% · VRAM ${gpu.memUsedPercent}% (${gpu.memUsedMb}/${gpu.memTotalMb} MiB) · ${gpu.tempC}C`
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
      uptime,
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

// --- Beads issue browser (read-only; shells out to `bd --json`) ---
// No direct Dolt connection and no new npm deps: `bd` already computes the
// ready/blocked semantics correctly, so we just spawn it like git/nvidia-smi
// elsewhere in this file and cache the JSON for a few seconds.
const BD_BIN = process.env.BD_BIN || 'bd';
const BD_CACHE_TTL_MS = Number(process.env.BD_CACHE_TTL_MS || 5000);
const BD_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const bdCache = new Map();

function runBd(args) {
  // `--readonly` is a hard guard: even though list/stats/show only read, it
  // blocks any accidental write path regardless of the args passed.
  const result = spawnSync(BD_BIN, ['--readonly', ...args, '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`bd ${args.join(' ')} exited ${result.status}: ${(result.stderr || '').trim().slice(0, 500)}`);
  }
  return JSON.parse(result.stdout || 'null');
}

function bdCached(key, producer) {
  const now = Date.now();
  const hit = bdCache.get(key);
  if (hit && now - hit.at < BD_CACHE_TTL_MS) return hit.data;
  const data = producer();
  bdCache.set(key, { at: now, data });
  return data;
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (isProxiedRequest(req) && !['GET', 'HEAD'].includes(req.method || 'GET')) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Write methods are not allowed through a reverse proxy');
    return;
  }

  if (url.pathname === '/events' && req.method === 'POST') {
    if (!isHarnessLocalPost(req)) {
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
    res.end(JSON.stringify({
      events,
      repoRoot,
      tokenTotals,
      gpuUptime: gpuUptimeSnapshot(),
    }, null, 2));
    return;
  }

  if (url.pathname === '/tokens') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ estimated: tokenTotals.estimatedCalls > 0, totals: tokenTotals }, null, 2));
    return;
  }

  if (url.pathname === '/beads') {
    try {
      const data = bdCached('overview', () => ({
        stats: runBd(['stats']),
        issues: runBd(['list', '--all', '-n', '0', '--sort', 'id']),
      }));
      sendJson(res, 200, data);
    } catch (err) {
      sendJson(res, 502, { error: String(err?.message || err) });
    }
    return;
  }

  if (url.pathname.startsWith('/beads/')) {
    const id = decodeURIComponent(url.pathname.slice('/beads/'.length));
    if (!BD_ID_RE.test(id)) {
      sendJson(res, 400, { error: 'bad issue id' });
      return;
    }
    try {
      const issue = bdCached(`issue:${id}`, () => {
        const rows = runBd(['show', id, '--include-dependents']);
        return Array.isArray(rows) ? rows[0] || null : rows;
      });
      if (!issue) {
        sendJson(res, 404, { error: 'not found' });
        return;
      }
      sendJson(res, 200, issue);
    } catch (err) {
      const msg = String(err?.message || err);
      sendJson(res, /no issue/i.test(msg) ? 404 : 502, { error: msg });
    }
    return;
  }

  if (url.pathname === '/summary') {
    // One-call stall diagnosis: why are there zero merges / is the dispatcher
    // alive? Aggregates the last hour of dispatcher events (already ingested
    // into `events` from events.ndjson) plus the tick heartbeat file.
    const hourAgo = Date.now() - 3600_000;
    const recent = events.filter((e) => {
      const t = Date.parse(e.ts);
      return Number.isFinite(t) && t >= hourAgo;
    });
    const tally = (kind, keyFn) => {
      const out = {};
      for (const e of recent) {
        if (e.kind !== kind) continue;
        const key = String(keyFn ? keyFn(e.payload || {}) : 'count').slice(0, 160);
        out[key] = (out[key] || 0) + 1;
      }
      return out;
    };
    let heartbeat = null;
    try {
      heartbeat = JSON.parse(readFileSync(join(progressDir, 'heartbeat.json'), 'utf8'));
    } catch {
      // no heartbeat file yet (factory not running, or pre-heartbeat version)
    }
    const latestStatus = [...events].reverse().find((e) => e.kind === 'factory_status');
    sendJson(res, 200, {
      now: nowIso(),
      heartbeat: heartbeat
        ? { ...heartbeat, age_s: Math.round((Date.now() - heartbeat.ts) / 1000) }
        : null,
      factory_status: latestStatus
        ? { ts: latestStatus.ts, ...latestStatus.payload }
        : null,
      last_hour: {
        spawns: tally('dispatch_spawn', (p) => p.agent || 'unknown'),
        passes: Object.values(tally('dispatch_pass')).reduce((a, b) => a + b, 0),
        merges_done: Object.values(tally('merge_done')).reduce((a, b) => a + b, 0),
        requeues_by_rc: tally('dispatch_requeue', (p) => `rc=${p.rc}`),
        merge_rejects_by_reason: tally('merge_rejected', (p) => p.reason || 'unknown'),
        tickets_escalated: tally('ticket_escalated', (p) => p.ticket || 'unknown'),
        tickets_abandoned: tally('ticket_abandoned', (p) => p.ticket || 'unknown'),
        agents_disabled: tally('agent_disabled', (p) => p.agent || 'unknown'),
        agents_reenabled: tally('agent_reenabled', (p) => p.agent || 'unknown'),
        worker_timeouts: tally('worker_timeout', (p) => p.ticket || 'unknown'),
        slots_quarantined: tally('slot_quarantined', (p) => p.ticket || 'unknown'),
      },
    });
    return;
  }

  if (url.pathname === '/gpu/uptime') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(gpuUptimeSnapshot(), null, 2));
    return;
  }

  if (url.pathname === '/gpu') {
    const latest = [...events].reverse().find(event => event.kind === 'gpu_sample') || null;
    const payload = latest?.payload || { available: false };
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ...payload, uptime: gpuUptimeSnapshot() }, null, 2));
    return;
  }

  if (url.pathname.startsWith('/artifacts/')) {
    const safe = safeRel(url.pathname);
    if (safe?.error === 'bad_request') {
      res.writeHead(400);
      res.end('bad request');
      return;
    }
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
function seedFromEventsLog() {
  const eventsPath = join(progressDir, 'events.ndjson');
  if (!existsSync(eventsPath)) return;
  let changed = false;
  try {
    const text = readFileSync(eventsPath, 'utf8');
    for (const raw of splitJsonRecords(text)) {
      if (!raw.trim()) continue;
      try {
        const event = JSON.parse(raw);
        const payload = event.payload || {};
        if (event.type === 'agent_start' || event.type === 'agent_finish') {
          rememberReviewAgent(payload.outfile, payload.agent);
        } else if (event.type === 'review_start' && payload.agent) {
          rememberReviewAgent(payload.review, payload.agent);
        } else if (event.type === 'agent_usage') {
          if (ingestAgentUsage(payload)) changed = true;
        }
      } catch {
        // ignore malformed rows while seeding
      }
    }
  } catch {
    // ignore unreadable events log
  }
  if (changed) {
    recomputeTokenTotals();
    saveTokenState();
  }
}

loadTokenState();
seedFromEventsLog();
scanFiles();
scanGit();
if (gpuPollInterval > 0) scanGpu();

server.listen(port, host, () => {
  writeFileSync(eventLogPath, existsSync(eventLogPath) ? readFileSync(eventLogPath) : '');
  console.log(`Autogame Live progress stream: http://${host}:${port}/live`);
});
