// Headless-browser capture for the autogame harness.
// Loads the running game, optionally asks a local agent for a ticket-specific
// capture recipe, executes only allowlisted browser actions, and writes
// screenshots + metrics into <outDir>.
//
//   node harness/screenshot.mjs <url> <outDir>
//
// Exit 0 if capture succeeded, 1 if the game failed to load, 2 on bad usage.

import { createRequire } from 'module';
import { chromium } from 'playwright';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const require = createRequire(import.meta.url);
const { MAGIC_STONES_REGEN_PER_TICK } = require('../game/server/config.js');
const VITALS_MS_REGEN_TICKS = 10;
const VITALS_MS_TOLERANCE = MAGIC_STONES_REGEN_PER_TICK * VITALS_MS_REGEN_TICKS;

const baseUrl = process.argv[2] || 'http://localhost:5173';
const outDir = process.argv[3];
if (!outDir) {
  console.error('usage: node harness/screenshot.mjs <url> <outDir>');
  process.exit(2);
}

const harnessDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(harnessDir, '..');
const outDirAbs = resolve(outDir);
mkdirSync(outDirAbs, { recursive: true });

const logs = [];
const pageerrors = [];
const screenshots = [];
const probes = [];
const scenarios = new Set();
// Track hand state before pressCard so the final probe can document before/after
const cardPressBefore = new Map(); // player -> { slot, cardIdBefore, cardType, handBefore }
// Track the pre-suspend enemy baseline and suspended objective across Telepipe steps
// so the post-resume assertRunPreserved step can verify checkpoint preservation.
const telepipeRunBaseline = new Map(); // player -> { preSuspendEnemies: [{id,hp,type,spawnedBy}], objective }

// Benign headless-Chromium rendering noise - not game bugs. Filtered out so the
// QA agent only sees real signal.
const NOISE = /GL Driver Message|GPU stall|ReadPixels|fallback to software WebGL|Automatic fallback|CONTEXT_LOST_WEBGL|Context (Lost|Restored)|THREE\.WebGLRenderer|THREE\.Clock|deprecat/i;
const PLAYER_RE = /^[A-Z]$/;
const SCENARIO_RE = /^[a-z0-9_-]{1,64}$/i;
const baseScenario = new URL(baseUrl).searchParams.get('debugScenario');
if (baseScenario && SCENARIO_RE.test(baseScenario)) scenarios.add(baseScenario);
const ACTIONS = new Set([
  'connectPlayer',
  'registerUser',
  'loginUser',
  'createLobby',
  'joinLobby',
  'readyAll',
  'waitForGame',
  'emitScenario',
  'move',
  'pressKey',
  'pressCard',
  'clickSlot',
  'useKeyItem',
  'wait',
  'screenshot',
  'probe',
  'assertRunPreserved',
  'assertVitalsPreserved',
  'waitForHubLobby',
  'assertWalkableHubPresentation',
]);

function wire(page, tag) {
  page.on('console', (m) => {
    const t = m.text();
    if (!NOISE.test(t)) logs.push(`[${tag}:${m.type()}] ${t}`);
  });
  page.on('pageerror', (e) => {
    logs.push(`[${tag}:pageerror] ${e.message}`);
    let sourceURL = undefined;
    let line = undefined;
    let column = undefined;
    if (e.stack) {
      // Try "(file:line:col)" format first (Chrome/Playwright)
      let m = e.stack.match(/\((.+):(\d+):(\d+)\)/);
      if (m) {
        sourceURL = m[1];
        line = parseInt(m[2], 10);
        column = parseInt(m[3], 10);
      } else {
        // Try "at file:line:col" format
        m = e.stack.match(/at\s+([^@]+):(\d+):(\d+)/);
        if (m) {
          sourceURL = m[1].trim();
          line = parseInt(m[2], 10);
          column = parseInt(m[3], 10);
        }
      }
    }
    pageerrors.push({
      message: e.message,
      sourceURL,
      line,
      column,
      stack: e.stack || '',
    });
  });
}

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function safeName(value, fallback) {
  const s = String(value || fallback).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return s || fallback;
}

function makeUrl(step = {}) {
  const u = new URL(baseUrl);
  if (typeof step.urlPath === 'string' && step.urlPath.startsWith('/') && !step.urlPath.startsWith('//')) {
    const local = new URL(step.urlPath, baseUrl);
    u.pathname = local.pathname;
    u.search = local.search;
    u.hash = '';
  }
  if (typeof step.scenario === 'string' && SCENARIO_RE.test(step.scenario)) {
    u.searchParams.set('debugScenario', step.scenario);
    scenarios.add(step.scenario);
  }
  return u.toString();
}

function inferTicketFile() {
  let dir = outDirAbs;
  while (dir.startsWith(repoRoot)) {
    const candidate = join(dir, 'ticket.md');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function readText(path, maxChars = 12000) {
  try {
    return readFileSync(path, 'utf8').slice(0, maxChars);
  } catch {
    return '';
  }
}

function emitProgressEvent(type, payload = {}) {
  if (process.env.PROGRESS_EVENTS === '0') return;
  try {
    // Factory workers run in worktrees with HARNESS_PROGRESS_DIR pinned to the
    // MAIN checkout's progress dir — without honoring it, capture events land
    // in the worktree's own events.ndjson and the live view never sees them.
    const dir = process.env.HARNESS_PROGRESS_DIR || join(harnessDir, 'progress');
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'events.ndjson'), JSON.stringify({
      ts: new Date().toISOString(),
      type,
      payload,
    }) + '\n');
  } catch {
    // Progress streaming is observational; capture must never fail because of it.
  }
}

function stripJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return raw.trim();
  return raw.slice(start, end + 1);
}

function validateRecipe(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.steps)) {
    throw new Error('recipe must be an object with steps[]');
  }
  if (input.steps.length < 1 || input.steps.length > 20) {
    throw new Error('recipe must contain 1-20 steps');
  }

  const steps = input.steps.map((step, i) => {
    if (!step || typeof step !== 'object') throw new Error(`step ${i + 1} must be an object`);
    if (!ACTIONS.has(step.action)) throw new Error(`step ${i + 1} has unsupported action: ${step.action}`);
    if (step.action === 'emitScenario' && !(typeof step.scenario === 'string' && SCENARIO_RE.test(step.scenario))) {
      throw new Error(`step ${i + 1} action emitScenario requires a valid scenario field`);
    }
    const clean = { action: step.action };
    if (typeof step.player === 'string' && PLAYER_RE.test(step.player)) clean.player = step.player;
    if (typeof step.description === 'string') clean.description = step.description.slice(0, 200);
    if (typeof step.name === 'string') clean.name = safeName(step.name, `shot-${i + 1}`).slice(0, 80);
    if (typeof step.scenario === 'string' && SCENARIO_RE.test(step.scenario)) clean.scenario = step.scenario;
    if (typeof step.urlPath === 'string' && step.urlPath.startsWith('/') && !step.urlPath.startsWith('//')) {
      clean.urlPath = step.urlPath.slice(0, 200);
    }
    if (step.durationMs != null) clean.durationMs = clampInt(step.durationMs, 500, 50, 3000);
    if (step.timeoutMs != null) clean.timeoutMs = clampInt(step.timeoutMs, 10000, 500, 20000);
    if (step.ms != null) clean.ms = clampInt(step.ms, 500, 50, 5000);
    if (step.action === 'move' && typeof step.key === 'string' && /^[wasdWASD]$/.test(step.key)) {
      clean.key = step.key.toLowerCase();
    }
    if (step.action === 'useKeyItem' && typeof step.key === 'string' && /^[a-z]$/i.test(step.key)) {
      clean.key = step.key.toLowerCase();
    }
    if (Number.isInteger(step.slot) && step.slot >= 0 && step.slot <= 3) clean.slot = step.slot;
    if (typeof step.cardType === 'string' && /^[a-z]+$/.test(step.cardType)) clean.cardType = step.cardType;
    if (typeof step.username === 'string' && step.username.length >= 1 && step.username.length <= 64) clean.username = step.username;
    if (typeof step.password === 'string' && step.password.length >= 1 && step.password.length <= 64) clean.password = step.password;
    // createLobby uses step.name as the lobby name (distinct from screenshot naming)
    if (step.action === 'createLobby' && typeof step.name === 'string' && step.name.length >= 1 && step.name.length <= 40 && /^[a-zA-Z0-9 ]+$/.test(step.name)) clean.lobbyName = step.name;
    return clean;
  });

  const recipe = {
    summary: typeof input.summary === 'string' ? input.summary.slice(0, 500) : '',
    steps,
  };

  return ensureAuthLobbyPrefix(recipe);
}

/**
 * Build the standard auth/lobby prefix steps for both players.
 * Player A: connect → register → login → createLobby
 * Player B: connect → register → login → joinLobby
 * Used to auto-inject missing setup when a recipe uses emitScenario/waitForGame.
 */
function buildStandardAuthLobbyPrefix() {
  return [
    { action: 'connectPlayer', player: 'A' },
    { action: 'wait', player: 'A', ms: 1000 },
    { action: 'registerUser', player: 'A', username: 'playerA', password: 'test123' },
    { action: 'loginUser', player: 'A', username: 'playerA', password: 'test123' },
    { action: 'wait', player: 'A', ms: 1000 },
    { action: 'createLobby', player: 'A', name: 'Test' },
    { action: 'wait', player: 'A', ms: 1000 },
    { action: 'connectPlayer', player: 'B' },
    { action: 'wait', player: 'B', ms: 1000 },
    { action: 'registerUser', player: 'B', username: 'playerB', password: 'test123' },
    { action: 'loginUser', player: 'B', username: 'playerB', password: 'test123' },
    { action: 'wait', player: 'B', ms: 1000 },
    { action: 'joinLobby', player: 'B' },
  ];
}

/**
 * Check that all steps before `index` for a given `player` include the required
 * auth/lobby sequence: registerUser → loginUser → createLobby (A) or joinLobby (B).
 * Returns true if the full sequence is present in correct order.
 */
function hasAuthLobbyBefore(steps, index, player) {
  // State machine: 0=need registerUser, 1=need loginUser, 2=need createLobby/joinLobby
  let state = 0;
  for (let i = 0; i < index; i++) {
    const s = steps[i];
    // Steps without explicit player default to 'A' at execution time
    if ((s.player || 'A') !== player) continue;
    if (state === 0 && s.action === 'registerUser') state = 1;
    else if (state === 1 && s.action === 'loginUser') state = 2;
    else if (state === 2 && (s.action === 'createLobby' || s.action === 'joinLobby')) return true;
  }
  return false;
}

/**
 * Detect recipes that use emitScenario or waitForGame without a preceding
 * auth/lobby setup, and auto-inject the standard prefix.
 * Logs when injection occurs so the capture output documents the fix.
 */
const HUB_VALIDATE_281_SUBTICKETS_RE = /281-playthrough-validate-ship-hub\/subtickets/i;
const HUB_VALIDATE_281_ROUND_RE = /281-playthrough-validate-ship-hub\/round-[^/]+/i;
const HUB_VALIDATION_HUB_DIR_RE = /(?:^|\/)game\/validation\/hub(?:\/|$)/i;
const HUB_TELEPIPE_ABANDON_VALIDATE_RE = /telepipe-reset|telepipe-abandon|abandon-fresh|abandonSuspendedRun|telepipe[- ]?up|playthrough-validate-ship-hub/i;
const PERSIST_VITALS_TELEPIPE_RE = /287-persist|persist-player-health|persist.*vitals|harness-telepipe-vitals-capture|no-telepipe-reset/i;
// ICE persist-vitals path (ticket 392): route the live persist-vitals telepipe
// capture onto the frost_crossing / ice-cavern layout via the frost-telepipe-ready
// scenario, with a suspended-lobby re-emit so the redeploy is a fresh sortie.
const ICE_PERSIST_VITALS_RE = /frost[_-]?crossing|ice[- ]?cavern|ice[- ]?telepipe|frost[- ]?telepipe/i;
const WALKABLE_HUB_RECAPTURE_RE = /305-recapture-walkable-hub|recapture-walkable-hub|walkable[- ]hub|game\/validation\/hub/i;

function inferSubticketFolder(outDirAbs) {
  const match = outDirAbs.match(/281-playthrough-validate-ship-hub\/subtickets\/([^/]+)/i);
  return match ? match[1] : '';
}

function isHubValidate281OutputDir(outDirAbs) {
  return HUB_VALIDATE_281_SUBTICKETS_RE.test(outDirAbs)
    || HUB_VALIDATE_281_ROUND_RE.test(outDirAbs)
    || HUB_VALIDATION_HUB_DIR_RE.test(outDirAbs);
}

/**
 * Ticket 281 hub telepipe-reset / abandon-fresh validation must NOT use the
 * suspend→resume capture (readyAll after suspend poisons server.log with
 * `[run] checkpoint restored`). Matches sub-ticket folders, round-* iter dirs,
 * and game/validation/hub playthrough output. Round folders infer the parent
 * ticket.md (telepipe-up / hub validation prose) via inferTicketFile().
 */
function isHubTelepipeAbandonValidateTicket(ticket, outDirAbs) {
  if (!isHubValidate281OutputDir(outDirAbs)) return false;
  if (HUB_VALIDATION_HUB_DIR_RE.test(outDirAbs)) return true;
  if (HUB_VALIDATE_281_ROUND_RE.test(outDirAbs)) {
    return HUB_TELEPIPE_ABANDON_VALIDATE_RE.test(ticket);
  }
  const folderName = inferSubticketFolder(outDirAbs);
  return HUB_TELEPIPE_ABANDON_VALIDATE_RE.test(`${folderName}\n${ticket}`);
}

/**
 * Ticket 287 / persist-vitals telepipe capture: hub return + fresh redeploy must
 * preserve player HP and magic stones (not checkpoint suspend/resume).
 */
function isPersistVitalsTelepipeTicket(ticket, outDirAbs) {
  return PERSIST_VITALS_TELEPIPE_RE.test(ticket)
    || PERSIST_VITALS_TELEPIPE_RE.test(outDirAbs);
}

/**
 * Ticket 392 ICE persist-vitals telepipe capture: same fresh-redeploy
 * vitals-preservation flow, but on the frost_crossing / ice-cavern layout via
 * the `frost-telepipe-ready` scenario (sub-ticket 03), with a suspended-lobby
 * re-emit that abandons the checkpoint so the redeploy is a fresh sortie.
 */
function isIcePersistVitalsTelepipeTicket(ticket, outDirAbs) {
  return ICE_PERSIST_VITALS_RE.test(ticket)
    || ICE_PERSIST_VITALS_RE.test(outDirAbs);
}

/**
 * Ticket 305 walkable-hub recapture: route review capture to the ship hub
 * (menu dismissed, canvas active, remote squadmate) instead of telepipe suspend/resume.
 */
function isWalkableHubRecaptureTicket(ticket, outDirAbs) {
  return WALKABLE_HUB_RECAPTURE_RE.test(ticket)
    || WALKABLE_HUB_RECAPTURE_RE.test(outDirAbs);
}

/** Post-304 hub-ready contract — mirrors harness/validate/lib/multiPlayer.mjs hubLobbyReadyCheck. */
async function waitForHubLobbyPage(page, timeoutMs = 20000) {
  await page.waitForFunction(() => {
    const h = window.__AUTOGAME_HARNESS_STATE__?.();
    const lobby = document.getElementById('lobby');
    return h
      && h.phase === 'lobby'
      && h.hasCanvas === true
      && h.lobbyMenuDismissed === true
      && h.layout?.profile === 'hub'
      && h.layout?.roomCount === 3
      && lobby
      && lobby.classList.contains('hidden');
  }, null, { timeout: timeoutMs }).catch(async () => {
    const state = await page.evaluate(() => {
      const h = window.__AUTOGAME_HARNESS_STATE__?.();
      const lobbyHidden = document.getElementById('lobby')?.classList.contains('hidden');
      return { harness: h, lobbyHidden };
    });
    throw new Error(`Ship hub lobby not ready: ${JSON.stringify(state)}`);
  });
}

/** Mirrors harness/validate/playthrough.mjs probeWalkableHubPresentation. */
async function probeWalkableHubPresentation(page) {
  return page.evaluate(() => {
    const harness = window.__AUTOGAME_HARNESS_STATE__?.();
    const lobby = document.getElementById('lobby');
    const canvas = document.querySelector('canvas');
    const squadmates = Array.isArray(harness?.squadmates) ? harness.squadmates : [];
    const remoteSquadmateCount = squadmates.filter(
      (m) => m && Number.isFinite(m.x) && Number.isFinite(m.z),
    ).length;
    return {
      lobbyHidden: lobby ? lobby.classList.contains('hidden') : false,
      lobbyMenuDismissed: harness?.lobbyMenuDismissed === true,
      hubCanvasActive: harness?.hasCanvas === true
        && !!canvas
        && canvas.width > 0
        && canvas.height > 0,
      playersOnHost: harness?.players ?? null,
      remoteSquadmateCount,
      layoutProfile: harness?.layout?.profile ?? null,
    };
  });
}

function assertWalkableHubPresentationFields(probe) {
  const failures = [];
  if (probe.lobbyHidden !== true) failures.push('lobbyHidden !== true');
  if (probe.lobbyMenuDismissed !== true) failures.push('lobbyMenuDismissed !== true');
  if (probe.hubCanvasActive !== true) failures.push('hubCanvasActive !== true');
  if (!Number.isFinite(probe.playersOnHost) || probe.playersOnHost < 2) {
    failures.push(`playersOnHost expected >= 2, got ${probe.playersOnHost}`);
  }
  if (!Number.isFinite(probe.remoteSquadmateCount) || probe.remoteSquadmateCount < 1) {
    failures.push(`remoteSquadmateCount expected >= 1, got ${probe.remoteSquadmateCount}`);
  }
  if (failures.length) {
    throw new Error(`Walkable hub presentation assertion failed: ${failures.join('; ')} (${JSON.stringify(probe)})`);
  }
}

/** Two-player ship hub review capture for ticket 305 (no readyAll / dungeon deploy). */
function buildWalkableHubReviewCaptureSteps() {
  return [
    { action: 'connectPlayer', player: 'A' },
    { action: 'wait', player: 'A', ms: 1000 },
    { action: 'registerUser', player: 'A', username: 'playerA', password: 'test123' },
    { action: 'loginUser', player: 'A', username: 'playerA', password: 'test123' },
    { action: 'wait', player: 'A', ms: 1000 },
    { action: 'createLobby', player: 'A', name: 'Hub Walk QA' },
    { action: 'wait', player: 'A', ms: 1000 },
    { action: 'connectPlayer', player: 'B' },
    { action: 'wait', player: 'B', ms: 1000 },
    { action: 'registerUser', player: 'B', username: 'playerB', password: 'test123' },
    { action: 'loginUser', player: 'B', username: 'playerB', password: 'test123' },
    { action: 'wait', player: 'B', ms: 1000 },
    { action: 'joinLobby', player: 'B' },
    { action: 'waitForHubLobby', player: 'A' },
    { action: 'waitForHubLobby', player: 'B' },
    { action: 'move', player: 'B', key: 'd', durationMs: 450 },
    { action: 'move', player: 'B', key: 'd', durationMs: 450 },
    { action: 'move', player: 'B', key: 'd', durationMs: 450 },
    { action: 'move', player: 'B', key: 'd', durationMs: 450 },
    { action: 'wait', player: 'A', ms: 500 },
    {
      action: 'screenshot',
      player: 'A',
      name: '01-hub-overview',
      description: 'Walkable ship hub with menu dismissed and remote squadmate visible.',
    },
    {
      action: 'probe',
      player: 'A',
      description: 'Hub overview probe: lobby hidden, menu dismissed, canvas active, two players, remote squadmate.',
    },
    {
      action: 'assertWalkableHubPresentation',
      player: 'A',
      description: 'VERIFY walkable hub presentation: lobbyHidden, lobbyMenuDismissed, hubCanvasActive, playersOnHost >= 2, remoteSquadmateCount >= 1.',
    },
  ];
}

function probesMatchVitalsPreserved(pre, post) {
  const hpMatch = Number.isFinite(pre?.hp) && Number.isFinite(post?.hp) && pre.hp === post.hp;
  const ms = pre?.magicStones;
  const postMs = post?.magicStones;
  const msMatch = Number.isFinite(ms) && Number.isFinite(postMs)
    && postMs >= ms
    && postMs <= ms + VITALS_MS_TOLERANCE;
  return hpMatch && msMatch;
}

/** Solo deploy → telepipe placement → suspend through the 02-suspended-lobby probe. */
function buildSoloTelepipeSuspendThroughProbeSteps(telepipeScenario = 'telepipe-ready') {
  return [
    { action: 'connectPlayer', player: 'A' },
    { action: 'wait', player: 'A', ms: 1000 },
    { action: 'registerUser', player: 'A', username: 'playerA', password: 'test123' },
    { action: 'loginUser', player: 'A', username: 'playerA', password: 'test123' },
    { action: 'wait', player: 'A', ms: 1000 },
    { action: 'createLobby', player: 'A', name: 'Telepipe Suspend QA' },
    { action: 'wait', player: 'A', ms: 1000 },
    // Request telepipe-ready WHILE STILL IN THE LOBBY (sets player.debugScenario);
    // the telepipe card is only injected into hand slot 0 at DEPLOY time
    // (applyTelepipeReadyHand), so this must precede readyAll — emitting it after
    // deploy would leave the hand without a telepipe and nothing to place. This
    // mirrors the passing sub-ticket 01 smoke (request scenario, then click ready).
    { action: 'emitScenario', player: 'A', scenario: telepipeScenario },
    { action: 'wait', player: 'A', ms: 500 },
    // Ready the single connected player → solo deploy with a telepipe in hand.
    { action: 'readyAll' },
    { action: 'waitForGame', player: 'A', timeoutMs: 12000 },
    { action: 'wait', player: 'A', ms: 1000 },
    {
      action: 'screenshot',
      player: 'A',
      name: '01-in-dungeon',
      description: 'Solo player in the dungeon with a telepipe in hand slot 0, before suspending.',
    },
    {
      action: 'probe',
      player: 'A',
      stashBaseline: true,
      description: 'PRE-SUSPEND state: record player x/z, enemyHp count, and layout (profile + seed) before placing the telepipe. Stashes the live enemy set (id -> hp/type/spawnedBy) as the checkpoint baseline, since the suspended lobby clears live enemies.',
    },
    // Place the portal (hand slot key `1`) at the player's feet, then nudge so
    // the server-side proximity check auto-extracts the solo player. A solo
    // extraction leaves zero active players → maybeSuspendRun → suspendRunToLobby.
    // checkTelepipeProximity runs every tick once PORTAL_PLACEMENT_GRACE_MS
    // (~2s) elapses, extracting any player still within PORTAL_RADIUS (2.5).
    // The portal lands at the player's exact position, so nudge OUT and back
    // (w then s) — MOVE_SPEED is 12 u/s, so a one-way hold would walk the player
    // clear of the radius and never extract.
    { action: 'pressKey', player: 'A', key: '1', ms: 400 },
    { action: 'wait', player: 'A', ms: 500 },
    { action: 'move', player: 'A', key: 'w', durationMs: 150 },
    { action: 'move', player: 'A', key: 's', durationMs: 150 },
    // Wait past PORTAL_PLACEMENT_GRACE_MS (~2s) so the proximity tick fires
    // checkTelepipeProximity → tryEnterTelepipe → suspendRunToLobby.
    { action: 'wait', player: 'A', ms: 3000 },
    {
      action: 'screenshot',
      player: 'A',
      name: '02-suspended-lobby',
      description: 'Lobby after the solo telepipe extraction suspended the run.',
    },
    {
      action: 'probe',
      player: 'A',
      stashObjective: true,
      description: 'SUSPENDED state: record runStatus/suspendedRunSummary (questId, questName, objective totalEnemies/defeatedEnemies) after suspendRunToLobby. Expect runStatus === "suspended" or suspendedRunSummary present; abandonRunBtnUsable when sub-ticket 09 lands.',
    },
  ];
}

/** Solo telepipe-up → hub → redeploy with vitals-preservation assertion (ticket 287). */
function buildSoloTelepipeVitalsPreservationSteps(telepipeScenario = 'telepipe-ready', { reEmitScenario = false } = {}) {
  const suspendSteps = buildSoloTelepipeSuspendThroughProbeSteps(telepipeScenario);
  const steps = suspendSteps.map((step) => {
    if (step.action === 'probe' && step.stashBaseline) {
      const { stashBaseline, ...rest } = step;
      return {
        ...rest,
        stashVitals: true,
        description: 'PRE-TELEPIPE state: stash player HP, magic stones, and runId before placing the telepipe.',
      };
    }
    if (step.action === 'probe' && step.stashObjective) {
      const { stashObjective, ...rest } = step;
      const transformed = {
        ...rest,
        description: 'HUB state after telepipe UP: record phase, runId, and player vitals in lobby before redeploy.',
      };
      // ICE / fresh-sortie path: the carry-forward baseline is the SUSPENDED-LOBBY
      // HP/MS (the value locked in at extraction), not the live pre-telepipe sample.
      // The frost_crossing start room spawns the player on two grunts, so HP keeps
      // dropping between the pre-telepipe probe and the suspend — meaning the
      // pre-telepipe HP is NOT what carries forward; the lobby HP is. Re-stash HP/MS
      // here (the runId stays the live one captured pre-telepipe) so the assertion
      // verifies the real carry-forward: lobby HP → fresh-sortie redeploy HP.
      if (reEmitScenario) transformed.stashLobbyVitals = true;
      return transformed;
    }
    return step;
  });
  // ICE / fresh-sortie path: re-emit the frost scenario WHILE still in the
  // suspended lobby — after the 02-suspended-lobby probe and before the redeploy
  // readyAll — so the server abandons the suspended checkpoint (abandonSuspendedRun)
  // and the redeploy is a fresh sortie (new runId) with lobby HP/MS carried
  // forward. The generic telepipe-ready path keeps its single-emit behavior.
  if (reEmitScenario) {
    steps.push(
      { action: 'emitScenario', player: 'A', scenario: telepipeScenario },
      { action: 'wait', player: 'A', ms: 800 },
    );
  }
  steps.push(
    { action: 'readyAll' },
    { action: 'waitForGame', player: 'A', timeoutMs: 12000 },
  );
  const redeployScreenshot = {
    action: 'screenshot',
    player: 'A',
    name: '03-redeployed-dungeon',
    description: 'Fresh dungeon after hub return and redeploy — player vitals should match pre-telepipe.',
  };
  const assertVitals = {
    action: 'assertVitalsPreserved',
    player: 'A',
    description: 'VERIFY vitals preservation: HP exact match; MS within passive-regen tolerance; runId must differ (fresh run, no checkpoint restore).',
  };
  if (reEmitScenario) {
    // ICE / fresh-sortie path: the frost_crossing start room ("stone dock") spawns
    // the redeployed player on top of two grunts, so vitals must be read at the
    // SPAWN FRAME — before any grunt's ~800ms attack windup resolves — or the
    // carried-forward HP would be chipped away before the assertion samples it.
    // Read vitals first, then take the evidence screenshot. The generic
    // telepipe-ready path (below) keeps its original screenshot-then-assert order.
    steps.push(assertVitals, redeployScreenshot);
  } else {
    steps.push(redeployScreenshot, assertVitals);
  }
  return steps;
}

function ensureAuthLobbyPrefix(recipe) {
  const { steps } = recipe;

  // Find the first emitScenario or waitForGame
  let gameActionIndex = -1;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].action === 'emitScenario' || steps[i].action === 'waitForGame') {
      gameActionIndex = i;
      break;
    }
  }

  // No game-action requiring setup — nothing to fix
  if (gameActionIndex === -1) return recipe;

  // Collect all players referenced in the recipe (default to 'A' if unspecified)
  const players = new Set();
  for (const s of steps) {
    players.add(s.player || 'A');
  }

  // Check each player has auth/lobby before the game action
  let needsPrefix = false;
  for (const player of players) {
    if (!hasAuthLobbyBefore(steps, gameActionIndex, player)) {
      needsPrefix = true;
      break;
    }
  }

  if (!needsPrefix) return recipe;

  // Auto-inject the standard auth/lobby prefix
  const prefix = buildStandardAuthLobbyPrefix();
  console.log(`[validateRecipe] auto-injected auth/lobby prefix for emitScenario (first game action at step ${gameActionIndex + 1})`);

  return {
    summary: recipe.summary,
    steps: [...prefix, ...steps],
  };
}

function fallbackRecipe() {
  const baseSteps = [
    { action: 'connectPlayer', player: 'A' },
    { action: 'wait', player: 'A', ms: 1000 },
    { action: 'registerUser', player: 'A', username: 'playerA', password: 'test123' },
    { action: 'loginUser', player: 'A', username: 'playerA', password: 'test123' },
    { action: 'wait', player: 'A', ms: 1000 },
    { action: 'createLobby', player: 'A', name: 'Test' },
    { action: 'wait', player: 'A', ms: 1000 },
    { action: 'connectPlayer', player: 'B' },
    { action: 'wait', player: 'B', ms: 1000 },
    { action: 'registerUser', player: 'B', username: 'playerB', password: 'test123' },
    { action: 'loginUser', player: 'B', username: 'playerB', password: 'test123' },
    { action: 'wait', player: 'B', ms: 1000 },
    { action: 'joinLobby', player: 'B' },
    { action: 'wait', player: 'A', ms: 1000 },
    { action: 'screenshot', player: 'A', name: '01-initial', description: 'Both players in squad lobby.' },
    { action: 'readyAll' },
    { action: 'waitForGame', player: 'A', timeoutMs: 12000 },
    { action: 'probe', player: 'A', description: 'After readying all players and entering gameplay.' },
    { action: 'move', player: 'A', key: 'w', durationMs: 1500 },
    { action: 'screenshot', player: 'A', name: '02-after-w', description: 'Gameplay after holding W.' },
    { action: 'move', player: 'A', key: 'd', durationMs: 1500 },
    { action: 'screenshot', player: 'A', name: '03-after-d', description: 'Gameplay after holding D.' },
    { action: 'useKeyItem', player: 'A' },
    { action: 'probe', player: 'A', description: 'After dodge roll — cooldown HUD should be active.' },
    { action: 'screenshot', player: 'A', name: '04-after-dodge', description: 'Gameplay after dodge roll with cooldown HUD.' },
  ];

  // Option C: detect slope/ramp tickets and append a sloped-dungeon capture.
  // This runs AFTER the base fallback steps execute — the existing pages are
  // still alive and in gameplay, so we can emitScenario on player A.
  const ticket = inferTicketFile() ? readText(inferTicketFile(), 8000) : '';
  // Telepipe suspend/resume detection, computed first so its prose (which
  // mentions portals/suspend) cannot make the world-stage/flare/slope branches
  // fire — those are all guarded with !isTelepipeTicket below.
  const isHubTelepipeAbandonValidate = isHubTelepipeAbandonValidateTicket(ticket, outDirAbs);
  const isWalkableHubRecapture = isWalkableHubRecaptureTicket(ticket, outDirAbs);
  const isPersistVitalsTelepipe = isPersistVitalsTelepipeTicket(ticket, outDirAbs);
  const isTelepipeTicket = !isHubTelepipeAbandonValidate && !isPersistVitalsTelepipe && !isWalkableHubRecapture &&
                           (/telepipe|suspend[-_ ]?resume|175-qa-telepipe/i.test(ticket) ||
                            /telepipe|suspend[-_]?resume|175-qa-telepipe/i.test(outDirAbs));
  const isWorldStageTicket = !isTelepipeTicket &&
                             (/world[-_ ]?stage|sunken[-_ ]?canyon|portal[-_ ]?transition|178-qa-world-stage/i.test(ticket) ||
                              /world[-_]?stage|sunken[-_]?canyon|portal[-_]?transition|178-qa-world-stage/i.test(outDirAbs));
  // Guard flare/slope detection with !isWorldStageTicket and !isTelepipeTicket:
  // this sub-ticket's own prose describes the flare-beacon and slope branches, so
  // their regexes match the ticket text and would otherwise shadow the
  // world-stage / telepipe branches below. For an actual flare/slope ticket both
  // guards are false, so they are a no-op and their behavior is unchanged.
  const isSlopeTicket = !isWorldStageTicket && !isTelepipeTicket &&
                        (/slope|ramp|sloped[-_]dungeon/i.test(ticket) ||
                         /sloped|142/.test(outDirAbs));
  const isFlareBeaconTicket = !isWorldStageTicket && !isTelepipeTicket &&
                              (/flare[-_]?beacon|revealedUntil|152-cleanup-key-item-flare-beacon/i.test(ticket) ||
                               /flare|152-cleanup-key-item-flare-beacon/i.test(outDirAbs));

  let steps = baseSteps;
  let summary = 'Deterministic full-flow smoke capture: auth, lobby create/join, ready transition, movement.';

  if (isFlareBeaconTicket) {
    steps = [
      ...baseSteps,
      { action: 'emitScenario', player: 'A', scenario: 'flare-beacon-ready' },
      { action: 'pressKey', player: 'A', key: 'e', ms: 400 },
      { action: 'wait', player: 'A', ms: 800 },
      {
        action: 'screenshot',
        player: 'A',
        name: '04-flare-beacon-reveal',
        description: 'Gameplay with amber reveal highlight on nearby enemies after flare_beacon useKeyItem.',
      },
      {
        action: 'probe',
        player: 'A',
        description: 'Verify revealedUntil in the future on nearby enemies in harnessState.enemyHp after flare_beacon reveal.',
      },
    ];
    summary = 'Deterministic full-flow smoke capture with flare-beacon fallback: auth, lobby, ready, movement, flare_beacon useKeyItem reveal screenshot and probe.';
  } else if (isSlopeTicket) {
    steps = [
      ...baseSteps,
      { action: 'emitScenario', player: 'A', scenario: 'sloped-dungeon' },
      { action: 'wait', player: 'A', ms: 1500 },
      { action: 'screenshot', player: 'A', name: '04-sloped-ramp', description: 'Sloped dungeon room with ramp geometry visible after emitScenario sloped-dungeon.' },
    ];
    summary = 'Deterministic full-flow smoke capture with sloped-dungeon fallback: auth, lobby, ready, movement, ramp screenshot.';
  } else if (isWorldStageTicket) {
    steps = [
      ...baseSteps,
      {
        action: 'screenshot',
        player: 'A',
        name: '05-before-world-stage',
        description: 'Default stage in gameplay BEFORE the world-stage transition.',
      },
      {
        action: 'probe',
        player: 'A',
        description: 'Before world-stage transition: record starting harnessState.layout (profile is the default/crowded profile, roomCount, startRoom) and player x/z.',
      },
      { action: 'emitScenario', player: 'A', scenario: 'sunken-canyon-stage' },
      { action: 'wait', player: 'A', ms: 2000 },
      {
        action: 'screenshot',
        player: 'A',
        name: '06-after-sunken-canyon',
        description: 'New sunken-canyon stage AFTER the questUpdate layout swap from sunken-canyon-stage.',
      },
      {
        action: 'probe',
        player: 'A',
        description: 'After world-stage transition: assert harnessState.layout.profile === "sunken-canyon" (changed from the before value) and that player x/z matches the new layout startRoom.',
      },
    ];
    summary = 'Deterministic full-flow smoke capture with world-stage fallback: auth, lobby, ready, movement, then before/after screenshots and probes around the sunken-canyon-stage portal transition (default -> sunken-canyon layout swap).';
  } else if (isWalkableHubRecapture) {
    steps = buildWalkableHubReviewCaptureSteps();
    summary = 'Deterministic walkable-hub review capture: two-player auth, create/join lobby, post-304 hub-ready wait (lobby hidden, menu dismissed, hub canvas), joiner WASD nudge, 01-hub-overview screenshot and assertWalkableHubPresentation.';
  } else if (isPersistVitalsTelepipe) {
    if (isIcePersistVitalsTelepipeTicket(ticket, outDirAbs)) {
      // ICE path (ticket 392): deploy on frost_crossing / ice-cavern via
      // frost-telepipe-ready, then re-emit it in the suspended lobby so the
      // redeploy abandons the checkpoint → fresh sortie with vitals carried forward.
      steps = buildSoloTelepipeVitalsPreservationSteps('frost-telepipe-ready', { reEmitScenario: true });
      summary = 'Deterministic solo ICE Telepipe vitals-preservation capture: auth, solo lobby + deploy on frost-telepipe-ready (frost_crossing / ice-cavern), place telepipe, suspended lobby, re-emit frost-telepipe-ready to abandon the checkpoint, fresh redeploy, assertVitalsPreserved (HP/MS persist, fresh runId, no checkpoint restore).';
    } else {
      steps = buildSoloTelepipeVitalsPreservationSteps();
      summary = 'Deterministic solo Telepipe vitals-preservation capture: auth, solo lobby + deploy, telepipe-ready scenario, place telepipe, hub return, redeploy, assertVitalsPreserved (HP/MS persist, fresh runId, no checkpoint restore).';
    }
  } else if (isHubTelepipeAbandonValidate) {
    // Hub telepipe-reset / abandon-fresh validation: suspend-only — never re-ready
    // after suspend (no restoreRunCheckpoint, no 03-resumed-dungeon.png).
    steps = buildSoloTelepipeSuspendThroughProbeSteps();
    summary = 'Deterministic solo Telepipe suspend-only capture for hub abandon/reset validation: auth, solo lobby + deploy, telepipe-ready scenario, place telepipe, solo extract until suspended lobby — stops after 02-suspended-lobby probe with no post-suspend readyAll.';
  } else if (isTelepipeTicket) {
    // SOLO suspend → resume capture. A solo extraction leaves zero active
    // players, so the run suspends to the lobby; re-readying restores it. This
    // branch builds its OWN solo steps (player A only) — it must NOT reuse the
    // two-player baseSteps, which connect player B and would keep the run active.
    steps = [
      ...buildSoloTelepipeSuspendThroughProbeSteps(),
      // Re-deploy → restoreRunCheckpoint resumes the suspended run.
      { action: 'readyAll' },
      { action: 'waitForGame', player: 'A', timeoutMs: 12000 },
      {
        action: 'screenshot',
        player: 'A',
        name: '03-resumed-dungeon',
        description: 'Resumed dungeon after re-deploying from the suspended lobby.',
      },
      {
        action: 'probe',
        player: 'A',
        description: 'RESUMED state: assert the run is preserved — same layout seed/profile and enemy set as the pre-suspend probe, and no lingering runStatus === "suspended".',
      },
      {
        action: 'assertRunPreserved',
        player: 'A',
        description: 'VERIFY preservation: compare the resumed enemy set against the pre-suspend baseline and the stashed suspended objective. Records a `preservation` block (preserved/missing/hpChanged ids, added spawner-add enemies, objective echo) and FAILS the capture on any genuine restore mismatch.',
      },
    ];
    summary = 'Deterministic solo Telepipe suspend/resume capture: auth, solo lobby + deploy, telepipe-ready scenario, then in-dungeon / suspended-lobby / resumed-dungeon screenshots with before/after probes around the suspendRunToLobby → restoreRunCheckpoint transition.';
  } else {
    summary = 'Deterministic full-flow smoke capture: auth, lobby create/join, ready transition, movement, dodge/key-item with post-dodge cooldown probe.';
  }

  return { summary, steps };
}

function buildPlannerPrompt(ticketFile) {
  const templatePath = join(harnessDir, 'prompts', 'capture-plan.md');
  const template = readText(templatePath, 20000) || [
    'Return strict JSON for an allowlisted browser capture recipe.',
    'Ticket:',
    '__TICKET__',
  ].join('\n');
  const ticket = ticketFile ? readText(ticketFile, 12000) : '(no ticket.md found)';
  return template
    .replaceAll('__TICKET_FILE__', ticketFile || '(none)')
    .replaceAll('__TICKET__', ticket)
    .replaceAll('__BASE_URL__', baseUrl);
}

function runPlannerCommand(source, prompt) {
  const timeout = clampInt(process.env.CAPTURE_PLAN_TIMEOUT, 90000, 1000, 180000);
  let cmd;
  let args;

  if (source === 'gemini') {
    cmd = 'gemini';
    args = ['-y', '--skip-trust'];
    if (process.env.GEMINI_MODEL) args.push('-m', process.env.GEMINI_MODEL);
    args.push('-p', prompt);
  } else {
    cmd = 'agent';
    args = ['-p', '--force', '--trust', '--mode', 'ask'];
    if (process.env.AGENT_MODEL) args.push('--model', process.env.AGENT_MODEL);
    args.push(prompt);
  }

  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout,
    maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    source,
    ok: result.status === 0 && !!result.stdout?.trim(),
    status: result.status,
    error: result.error ? result.error.message : result.stderr?.slice(0, 4000),
    output: result.stdout || '',
  };
}

function planCapture(ticketFile) {
  const mode = (process.env.CAPTURE_PLAN_AGENT || 'auto').toLowerCase();
  if (mode === 'off' || mode === 'fallback') {
    return { source: 'fallback', valid: true, attempts: [], recipe: fallbackRecipe() };
  }

  // Try to reuse an existing capture plan from the output directory
  const existingPlan = join(outDirAbs, 'capture-plan-gemini.txt');
  if (existsSync(existingPlan)) {
    try {
      const raw = readFileSync(existingPlan, 'utf8');
      const parsed = JSON.parse(stripJson(raw));
      return {
        source: 'file',
        valid: true,
        attempts: [],
        recipe: validateRecipe(parsed),
      };
    } catch (e) {
      // Invalid JSON or recipe — fall through to LLM generation
    }
  }

  const prompt = buildPlannerPrompt(ticketFile);
  const order = mode === 'gemini' ? ['gemini'] : mode === 'agent' ? ['agent'] : ['gemini', 'agent'];
  const attempts = [];

  for (const source of order) {
    const attempt = runPlannerCommand(source, prompt);
    attempts.push({
      source,
      ok: attempt.ok,
      status: attempt.status,
      error: attempt.error,
    });
    writeFileSync(join(outDirAbs, `capture-plan-${source}.txt`), attempt.output + (attempt.error ? `\n\nSTDERR/ERROR:\n${attempt.error}\n` : ''));
    if (!attempt.ok) continue;

    try {
      const parsed = JSON.parse(stripJson(attempt.output));
      return {
        source,
        valid: true,
        attempts,
        recipe: validateRecipe(parsed),
      };
    } catch (e) {
      attempts[attempts.length - 1].error = `invalid recipe: ${e.message}`;
    }
  }

  return { source: 'fallback', valid: false, attempts, recipe: fallbackRecipe() };
}

async function collectProbe(page) {
  return page.evaluate(() => {
    const harnessState = typeof window.__AUTOGAME_HARNESS_STATE__ === 'function'
      ? window.__AUTOGAME_HARNESS_STATE__()
      : null;
    const lobby = document.querySelector('#lobby');
    const cardHand = document.querySelector('#card-hand');
    const status = document.querySelector('#status');
    const keyItemIndicator = document.querySelector('#key-item-indicator');
    const keyItemIndicatorOnCooldown = !!keyItemIndicator && keyItemIndicator.classList.contains('cooldown');
    const keyItemIndicatorText = keyItemIndicator ? keyItemIndicator.textContent : '';
    const keyItemCooldownRemaining = harnessState?.player?.keyItemCooldownRemaining ?? null;
    return {
      harnessState,
      keyItemIndicatorOnCooldown,
      keyItemIndicatorText,
      keyItemCooldownRemaining,
      status: status ? status.innerText : '(no #status element)',
      hasCanvas: !!document.querySelector('canvas'),
      canvasCount: document.querySelectorAll('canvas').length,
      lobbyVisible: !!lobby && !lobby.classList.contains('hidden'),
      cardHandVisible: !!cardHand && getComputedStyle(cardHand).display !== 'none',
      title: document.title,
      bodyText: document.body.innerText.slice(0, 800),
    };
  }).catch((e) => ({ error: e.message }));
}

async function waitForGameplay(page, timeoutMs) {
  await page.waitForFunction(() => {
    const state = typeof window.__AUTOGAME_HARNESS_STATE__ === 'function'
      ? window.__AUTOGAME_HARNESS_STATE__()
      : null;
    if (state) return state.phase === 'playing' && state.sceneInitialized && state.hasCanvas;
    const lobby = document.querySelector('#lobby');
    return !!document.querySelector('canvas') && (!lobby || lobby.classList.contains('hidden'));
  }, null, { timeout: timeoutMs });
  await page.waitForTimeout(250);
}

function pageForFallback(pages) {
  const page = pages.get('A') || pages.values().next().value;
  if (!page) throw new Error('no connected pages');
  return page;
}

async function executeRecipe(browser, recipe) {
  const contexts = new Map();
  const pages = new Map();

  const getPage = (player = 'A') => {
    const page = pages.get(player);
    if (!page) throw new Error(`player ${player} is not connected`);
    return page;
  };

  for (const step of recipe.steps) {
    const player = step.player || 'A';

    if (step.action === 'connectPlayer') {
      if (pages.has(player)) continue;
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      contexts.set(player, ctx);
      pages.set(player, page);
      wire(page, player);
      await page.goto(makeUrl(step), { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(750);
      continue;
    }

    if (step.action === 'registerUser') {
      const page = getPage(player);
      const username = step.username || `${player.toLowerCase()}${Date.now()}`;
      const password = step.password || 'test123';

      // Ensure the register form is visible
      const registerForm = page.locator('#register-form');
      if (!(await registerForm.isVisible().catch(() => false))) {
        // Try showing the register form: click the show-register-link if visible
        const showRegisterLink = page.locator('#show-register-link');
        if (await showRegisterLink.isVisible().catch(() => false)) {
          await showRegisterLink.click().catch(() => {});
        }
        // Also try the show-login-link path: sometimes the login form is shown first
        const showLoginLink = page.locator('#show-login-link');
        if (await showLoginLink.isVisible().catch(() => false)) {
          // login form is visible, need to find register toggle
          await showRegisterLink.click().catch(() => {});
        }
      }

      // Fill the registration form using data-testid selectors
      await page.locator('[data-testid="register-username"]').fill(username);
      await page.locator('[data-testid="register-password"]').fill(password);
      await page.locator('[data-testid="register-btn"]').click();
      await page.waitForTimeout(500);
      continue;
    }

    if (step.action === 'loginUser') {
      const page = getPage(player);
      const username = step.username || `${player.toLowerCase()}${Date.now()}`;
      const password = step.password || 'test123';

      // Ensure the login form is visible
      const loginForm = page.locator('#login-form');
      if (!(await loginForm.isVisible().catch(() => false))) {
        // Click the show-login-link to switch from register to login form
        const showLoginLink = page.locator('[data-testid="show-login-link"]');
        if (await showLoginLink.isVisible().catch(() => false)) {
          await showLoginLink.click().catch(() => {});
        }
      }

      // Fill the login form using data-testid selectors
      await page.locator('[data-testid="login-username"]').fill(username);
      await page.locator('[data-testid="login-password"]').fill(password);
      await page.locator('[data-testid="login-btn"]').click();

      // Wait for socket connection: check #status text or #auth-overlay to hide
      await page.waitForFunction(() => {
        const status = document.querySelector('#status');
        if (status && status.innerText.includes('Connected')) return true;
        const authOverlay = document.querySelector('#auth-overlay');
        if (authOverlay && authOverlay.classList.contains('hidden')) return true;
        return false;
      }, null, { timeout: step.timeoutMs || 10000 }).catch(() => {});
      await page.waitForTimeout(500);
      continue;
    }

    if (step.action === 'createLobby') {
      const page = getPage(player);
      const lobbyName = step.lobbyName || 'Test';

      // 1. Check if already in a squad lobby (#lobby visible) — skip if so
      const alreadyInSquad = await page.evaluate(() => {
        const lobby = document.querySelector('#lobby');
        return lobby && !lobby.classList.contains('hidden');
      }).catch(() => false);
      if (alreadyInSquad) {
        console.log(`[createLobby] #lobby already visible for player ${player} — skipping`);
        continue;
      }

      // 2. If #lobby-browser is not visible, wait for it (post-login delay)
      const lobbyBrowser = page.locator('#lobby-browser');
      if (!(await lobbyBrowser.isVisible().catch(() => false))) {
        console.warn(`[createLobby] #lobby-browser not visible for player ${player}, waiting...`);
        await page.waitForFunction(() => {
          const el = document.querySelector('#lobby-browser');
          return el && !el.classList.contains('hidden') && window.getComputedStyle(el).display !== 'none';
        }, null, { timeout: step.timeoutMs || 5000 }).catch((e) => {
          console.warn(`[createLobby] timeout waiting for #lobby-browser to appear: ${e.message}`);
        });
      }

      // 3. Fill lobby name and click create (attempt even if #lobby-browser still hidden)
      try {
        await page.locator('#create-lobby-name').fill(lobbyName);
        await page.locator('#create-lobby-btn').click();
      } catch (e) {
        console.warn(`[createLobby] failed to fill/create lobby form: ${e.message}`);
        continue;
      }
      await page.waitForTimeout(500);

      // 4. Wait for squad UI (#lobby) to become visible
      await page.waitForFunction(() => {
        const lobby = document.querySelector('#lobby');
        return lobby && !lobby.classList.contains('hidden');
      }, null, { timeout: step.timeoutMs || 10000 }).catch((e) => {
        console.warn(`[createLobby] timeout waiting for #lobby visibility: ${e.message}`);
      });
      continue;
    }

    if (step.action === 'joinLobby') {
      const page = getPage(player);

      // Ensure lobby browser is visible and find a join button
      const joinBtn = page.locator('#lobby-list .join-lobby-btn').first();
      if (!(await joinBtn.isVisible().catch(() => false))) {
        console.warn(`[joinLobby] no .join-lobby-btn found for player ${player} — continuing`);
        await page.waitForTimeout(step.ms || 500);
        continue;
      }

      await joinBtn.click();
      await page.waitForTimeout(500);

      // Wait for squad UI (#lobby) to become visible
      await page.waitForFunction(() => {
        const lobby = document.querySelector('#lobby');
        return lobby && !lobby.classList.contains('hidden');
      }, null, { timeout: step.timeoutMs || 10000 }).catch((e) => {
        console.warn(`[joinLobby] timeout waiting for #lobby visibility: ${e.message}`);
      });
      continue;
    }

    if (step.action === 'readyAll') {
      // Ready up via the launch-booth path. The 2D #ready-btn was retired
      // (sub-ticket 03), so route through the test-only booth hook that calls
      // the same launchBoothReadyUp() → playerReady(true) used by the Launch Bay
      // booth and the ?booth=launch hook. No new socket event is introduced.
      for (const page of pages.values()) {
        await page.evaluate(() => {
          if (typeof window.__launchReadyUpForTest === 'function') {
            window.__launchReadyUpForTest();
          }
        }).catch(() => {});
      }
      await pageForFallback(pages).waitForTimeout(500);
      continue;
    }

    const page = getPage(player);

    if (step.action === 'waitForGame') {
      await waitForGameplay(page, step.timeoutMs || 12000);
    } else if (step.action === 'waitForHubLobby') {
      await waitForHubLobbyPage(page, step.timeoutMs || 20000);
      await page.waitForTimeout(250);
    } else if (step.action === 'emitScenario') {
      const scenarioName = step.scenario;
      const result = await page.evaluate(({ name, timeoutMs }) => {
        return window.__requestDebugScenarioForTest(name, timeoutMs)
          .then((r) => ({ ok: r.ok === true, ...(r || {}) }))
          .catch((e) => ({ ok: false, error: e.message }));
      }, { name: scenarioName, timeoutMs: step.timeoutMs || 10000 });
      scenarios.add(scenarioName);
      if (!result.ok) console.warn(`[emitScenario] ${scenarioName} failed: ${result.error || result.reason || 'unknown'}`);
      await page.waitForTimeout(500); // brief settle after layout rebuild
    } else if (step.action === 'move') {
      const key = step.key || 'w';
      await page.bringToFront();
      await page.keyboard.down(key);
      await page.waitForTimeout(step.durationMs || 500);
      await page.keyboard.up(key);
      await page.waitForTimeout(250);
    } else if (step.action === 'pressKey') {
      const key = step.key || 'e';
      await page.bringToFront();
      await page.keyboard.down(key);
      await page.waitForTimeout(step.ms || 400);
      await page.keyboard.up(key);
      await page.waitForTimeout(250);
    } else if (step.action === 'pressCard') {
      let slot;
      if (step.cardType) {
        // Resolve slot by querying DOM for matching data-card-type
        const resolved = await page.evaluate((ct) => {
          const el = document.querySelector(`.card-slot[data-card-type="${ct}"]`);
          return el ? el.dataset.slotIndex : null;
        }, step.cardType);
        if (resolved !== null) {
          slot = parseInt(resolved, 10);
        } else {
          console.warn(`[pressCard] no .card-slot found with data-card-type="${step.cardType}" — skipping press`);
          await page.waitForTimeout(step.ms || 500);
          continue;
        }
      } else {
        slot = step.slot ?? 0;
      }
      // Capture hand state before pressing the card (for before/after documentation)
      const handBefore = await page.evaluate(() => {
        const state = typeof window.__AUTOGAME_HARNESS_STATE__ === 'function'
          ? window.__AUTOGAME_HARNESS_STATE__()
          : null;
        return state && state.hand ? state.hand.map(c => c ? c.id : null) : null;
      });
      const cardIdBefore = handBefore ? handBefore[slot] : null;
      cardPressBefore.set(player, { slot, cardIdBefore, cardType: step.cardType || null, handBefore });
      console.log(`[pressCard] player ${player}: slot ${slot}, cardIdBefore=${cardIdBefore}, cardType=${step.cardType || 'none'}`);
      await page.keyboard.press(String(slot + 1));
      await page.waitForTimeout(step.ms || 500);
    } else if (step.action === 'clickSlot') {
      const slot = step.slot ?? 0;
      await page.locator(`.card-slot[data-slot-index="${slot}"]`).click({ timeout: 3000 });
      await page.waitForTimeout(step.ms || 500);
    } else if (step.action === 'useKeyItem') {
      const key = step.key || 'e';
      await page.bringToFront();
      await page.keyboard.press(key);
      await page.waitForTimeout(step.ms ?? 400);
    } else if (step.action === 'wait') {
      await page.waitForTimeout(step.ms || 500);
    } else if (step.action === 'screenshot') {
      const name = safeName(step.name, `shot-${screenshots.length + 1}`);
      const file = name.endsWith('.png') ? name : `${name}.png`;
      await page.screenshot({ path: join(outDirAbs, file) });
      screenshots.push({
        file,
        player,
        description: step.description || '',
      });
    } else if (step.action === 'probe') {
      const data = await collectProbe(page);
      probes.push({
        player,
        description: step.description || '',
        data,
      });
      // Telepipe cross-step stashing (mirrors the cardPressBefore pattern): the
      // suspended lobby clears live enemies, so the pre-suspend enemy set and the
      // suspended objective must be captured here for assertRunPreserved to check.
      if (step.stashBaseline) {
        const enemyHp = (data?.harnessState?.enemyHp) || [];
        const entry = telepipeRunBaseline.get(player) || {};
        entry.preSuspendEnemies = enemyHp.map((e) => ({
          id: e.id,
          hp: e.hp,
          type: e.type ?? null,
          spawnedBy: e.spawnedBy ?? null,
        }));
        telepipeRunBaseline.set(player, entry);
      }
      if (step.stashObjective) {
        const objective = data?.harnessState?.suspendedRunSummary?.objective || null;
        const entry = telepipeRunBaseline.get(player) || {};
        entry.objective = objective
          ? {
            type: objective.type,
            totalEnemies: objective.totalEnemies,
            activeEnemyCount: objective.activeEnemyCount,
            defeatedEnemies: objective.defeatedEnemies,
          }
          : null;
        telepipeRunBaseline.set(player, entry);
      }
      if (step.stashVitals) {
        const playerState = data?.harnessState?.player;
        const entry = telepipeRunBaseline.get(player) || {};
        entry.preTelepipeVitals = {
          hp: playerState?.hp ?? null,
          magicStones: playerState?.magicStones ?? null,
          runId: data?.harnessState?.runId ?? null,
        };
        telepipeRunBaseline.set(player, entry);
      }
      // ICE / fresh-sortie path: overwrite the carry-forward HP/MS baseline with the
      // SUSPENDED-LOBBY values (the vitals that actually carry into the fresh sortie),
      // while preserving the live runId stashed at the pre-telepipe probe so the
      // freshRunId check still compares original sortie → redeploy.
      if (step.stashLobbyVitals) {
        const playerState = data?.harnessState?.player;
        const entry = telepipeRunBaseline.get(player) || {};
        const prev = entry.preTelepipeVitals || {};
        entry.preTelepipeVitals = {
          ...prev,
          hp: playerState?.hp ?? prev.hp ?? null,
          magicStones: playerState?.magicStones ?? prev.magicStones ?? null,
        };
        telepipeRunBaseline.set(player, entry);
      }
    } else if (step.action === 'assertVitalsPreserved') {
      const data = await collectProbe(page);
      const postPlayer = data?.harnessState?.player;
      const postRunId = data?.harnessState?.runId ?? null;
      const entry = telepipeRunBaseline.get(player) || {};
      const pre = entry.preTelepipeVitals || {};

      const hpPreserved = Number.isFinite(pre.hp) && pre.hp === postPlayer?.hp;
      const msPreserved = probesMatchVitalsPreserved(
        { hp: pre.hp, magicStones: pre.magicStones },
        { hp: postPlayer?.hp, magicStones: postPlayer?.magicStones },
      );
      const freshRunId = pre.runId != null && postRunId != null && pre.runId !== postRunId;
      const vitalsPreservation = {
        preHp: pre.hp,
        postHp: postPlayer?.hp ?? null,
        preMagicStones: pre.magicStones,
        postMagicStones: postPlayer?.magicStones ?? null,
        preRunId: pre.runId,
        postRunId,
        hpPreserved,
        msPreserved,
        freshRunId,
        preserved: hpPreserved && msPreserved && freshRunId,
      };

      probes.push({
        player,
        description: step.description || 'Telepipe vitals-preservation verification.',
        data: { vitalsPreservation, harnessState: data?.harnessState ?? null },
      });

      const failures = [];
      if (!Number.isFinite(pre.hp)) {
        failures.push('pre-telepipe HP was not stashed before assertVitalsPreserved');
      }
      if (!hpPreserved) {
        failures.push(`HP mismatch across telepipe redeploy: ${pre.hp} → ${postPlayer?.hp}`);
      }
      if (!msPreserved) {
        failures.push(`magic stones mismatch across telepipe redeploy: ${pre.magicStones} → ${postPlayer?.magicStones}`);
      }
      if (!freshRunId) {
        failures.push(`runId must differ after fresh redeploy: pre=${pre.runId} post=${postRunId}`);
      }
      if (failures.length) {
        throw new Error(`Telepipe vitals-preservation assertion failed: ${failures.join('; ')}`);
      }
    } else if (step.action === 'assertRunPreserved') {
      // Verify the suspend → resume checkpoint preserved the original enemy set and
      // objective. Records a `preservation` block into the probes/metrics evidence,
      // then throws on any genuine restore mismatch (propagating out of executeRecipe
      // so metrics.ok stays false and process.exit(1) fires).
      const data = await collectProbe(page);
      const resumedEnemies = (data?.harnessState?.enemyHp) || [];
      const entry = telepipeRunBaseline.get(player) || {};
      const preSuspendEnemies = entry.preSuspendEnemies || [];
      const objective = entry.objective || null;

      const preMap = new Map(preSuspendEnemies.map((e) => [e.id, e]));
      const resumedMap = new Map(resumedEnemies.map((e) => [e.id, {
        id: e.id,
        hp: e.hp,
        type: e.type ?? null,
        spawnedBy: e.spawnedBy ?? null,
      }]));

      const preservedIds = [];
      const missingIds = [];
      const hpChangedIds = [];
      for (const [id, pre] of preMap) {
        const res = resumedMap.get(id);
        if (!res) { missingIds.push(id); continue; }
        preservedIds.push(id);
        if (res.hp !== pre.hp) hpChangedIds.push(id);
      }
      const addedEnemies = [];
      for (const [id, res] of resumedMap) {
        if (!preMap.has(id)) addedEnemies.push(res);
      }
      const addedAllSpawnerAdds = addedEnemies.every((e) => !!e.spawnedBy);
      // Original/quest enemies are those WITHOUT a spawnedBy tag; spawner adds are
      // tagged. The objective totalEnemies should match the original (non-add) count.
      const originalPreSuspendEnemies = preSuspendEnemies.filter((e) => !e.spawnedBy);

      const preservation = {
        preSuspendEnemyCount: preSuspendEnemies.length,
        resumedEnemyCount: resumedEnemies.length,
        originalPreSuspendEnemyCount: originalPreSuspendEnemies.length,
        preservedIds: preservedIds.length,
        missingIds,
        hpChangedIds,
        addedEnemies,
        addedAllSpawnerAdds,
        objective: objective
          ? {
            type: objective.type,
            totalEnemies: objective.totalEnemies,
            activeEnemyCount: objective.activeEnemyCount,
            defeatedEnemies: objective.defeatedEnemies,
          }
          : null,
      };

      probes.push({
        player,
        description: step.description || 'Telepipe suspend/resume preservation verification.',
        data: { preservation, harnessState: data?.harnessState ?? null },
      });

      const failures = [];
      if (missingIds.length) {
        failures.push(`pre-suspend enemy id(s) missing after resume: ${missingIds.join(', ')}`);
      }
      if (hpChangedIds.length) {
        failures.push(`preserved enemy hp changed across resume: ${hpChangedIds.join(', ')}`);
      }
      if (!addedAllSpawnerAdds) {
        const conjured = addedEnemies.filter((e) => !e.spawnedBy).map((e) => e.id);
        failures.push(`restore conjured non-spawner enemy id(s): ${conjured.join(', ')}`);
      }
      if (!objective) {
        failures.push('suspended objective was not captured before assertRunPreserved');
      } else {
        if (objective.type !== 'defeat_enemies') {
          failures.push(`objective.type expected 'defeat_enemies', got '${objective.type}'`);
        }
        if (objective.defeatedEnemies !== 0) {
          failures.push(`objective.defeatedEnemies expected 0, got ${objective.defeatedEnemies}`);
        }
        const liveEnemyCount = Number.isFinite(objective.activeEnemyCount)
          ? objective.activeEnemyCount
          : objective.totalEnemies;
        const liveEnemyCountField = Number.isFinite(objective.activeEnemyCount)
          ? 'activeEnemyCount'
          : 'totalEnemies';
        if (liveEnemyCount !== originalPreSuspendEnemies.length) {
          failures.push(`objective.${liveEnemyCountField} (${liveEnemyCount}) !== original pre-suspend enemy count (${originalPreSuspendEnemies.length})`);
        }
      }
      if (failures.length) {
        throw new Error(`Telepipe run-preservation assertion failed: ${failures.join('; ')}`);
      }
    } else if (step.action === 'assertWalkableHubPresentation') {
      const presentation = await probeWalkableHubPresentation(page);
      probes.push({
        player,
        description: step.description || 'Walkable hub presentation verification.',
        data: { walkableHubPresentation: presentation },
      });
      assertWalkableHubPresentationFields(presentation);
    }
  }

  if (pages.size === 0) throw new Error('recipe did not connect any players');
  const primary = pages.get('A') || pages.values().next().value;
  const finalData = await collectProbe(primary);

  // Attach before/after card-id evidence to the final probe
  const beforeInfo = cardPressBefore.get('A');
  if (beforeInfo && finalData && finalData.harnessState && finalData.harnessState.hand) {
    const handAfter = finalData.harnessState.hand.map(c => c ? c.id : null);
    const cardIdAfter = handAfter[beforeInfo.slot];
    finalData.cardPress = {
      slot: beforeInfo.slot,
      cardType: beforeInfo.cardType,
      cardIdBefore: beforeInfo.cardIdBefore,
      cardIdAfter,
      handBefore: beforeInfo.handBefore,
      handAfter,
      replacementViaStateUpdate: beforeInfo.cardIdBefore !== cardIdAfter && cardIdAfter !== null,
    };
  }

  probes.push({ player: 'A', description: 'Final capture probe.', data: finalData });

  for (const ctx of contexts.values()) {
    await ctx.close().catch(() => {});
  }
}

const ticketFile = inferTicketFile();
const planned = planCapture(ticketFile);
let browser = await chromium.launch();
const metrics = {
  url: baseUrl,
  ok: false,
  ticketFile,
  capturePlanSource: planned.source,
  capturePlanValid: planned.valid,
  capturePlanAttempts: planned.attempts,
  capturePlanSummary: planned.recipe.summary,
  scenarios: [],
  screenshots,
  probes,
};

try {
  await executeRecipe(browser, planned.recipe);
  metrics.ok = screenshots.length > 0;
} catch (e) {
  logs.push(`[capture:error] ${e.message}`);
  await browser.close().catch(() => {});

  if (planned.source !== 'fallback') {
    screenshots.length = 0;
    probes.length = 0;
    const fallback = fallbackRecipe();
    metrics.capturePlanSource = 'fallback-after-error';
    metrics.capturePlanSummary = fallback.summary;
    browser = await chromium.launch();
    try {
      await executeRecipe(browser, fallback);
      metrics.ok = screenshots.length > 0;
    } catch (fallbackError) {
      logs.push(`[capture:fallback-error] ${fallbackError.message}`);
      metrics.error = fallbackError.message;
    }
  } else {
    metrics.error = e.message;
  }
} finally {
  metrics.scenarios = Array.from(scenarios);
  metrics.screenshots = screenshots;
  metrics.probes = probes;
  metrics.pageerrors = pageerrors.slice(0, 10);
  writeFileSync(join(outDirAbs, 'console.log'), logs.join('\n') + '\n');
  writeFileSync(join(outDirAbs, 'pageerrors.json'), JSON.stringify(pageerrors, null, 2) + '\n');
  writeFileSync(join(outDirAbs, 'metrics.json'), JSON.stringify(metrics, null, 2));
  emitProgressEvent('capture_metrics', {
    // Absolute path: in factory mode this repo IS a worktree, so a
    // repo-relative path would resolve under the MAIN checkout (where these
    // files don't exist — artifacts are gitignored) and the live view's stage
    // panel 404s on every screenshot.
    artifacts: outDirAbs,
    ok: metrics.ok,
    source: metrics.capturePlanSource,
    scenarios: metrics.scenarios,
    screenshots: metrics.screenshots,
  });
  await browser.close().catch(() => {});
}

console.log(JSON.stringify(metrics, null, 2));
process.exit(metrics.ok ? 0 : 1);
