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
let nextId = 1;
let lastGitHead = '';
let lastGpuDigest = '';

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

function scanExplicitEvents(rel, text) {
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    try {
      const event = JSON.parse(raw);
      emit({
        kind: event.type || event.kind || 'explicit',
        actor: event.actor || 'harness',
        title: event.title || event.type || 'Harness event',
        text: event.message || '',
        payload: event.payload || event,
        source: rel,
      });
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
    res.writeHead(200, { 'content-type': contentType(path) });
    res.end(readFileSync(path));
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/events' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      try {
        const event = JSON.parse(body);
        emit({
          kind: event.type || event.kind || 'explicit',
          actor: event.actor || 'harness',
          title: event.title || event.type || 'Harness event',
          text: event.message || '',
          payload: event.payload || event,
          source: 'POST /events',
        });
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
    res.end(JSON.stringify({ events, repoRoot }, null, 2));
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
