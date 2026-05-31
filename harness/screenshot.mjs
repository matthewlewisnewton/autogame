// Headless-browser capture for the autogame harness.
// Loads the running game, optionally asks a local agent for a ticket-specific
// capture recipe, executes only allowlisted browser actions, and writes
// screenshots + metrics into <outDir>.
//
//   node harness/screenshot.mjs <url> <outDir>
//
// Exit 0 if capture succeeded, 1 if the game failed to load, 2 on bad usage.

import { chromium } from 'playwright';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

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
const screenshots = [];
const probes = [];
const scenarios = new Set();
// Track hand state before pressCard so the final probe can document before/after
const cardPressBefore = new Map(); // player -> { slot, cardIdBefore, cardType, handBefore }

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
  'pressCard',
  'clickSlot',
  'wait',
  'screenshot',
  'probe',
]);

function wire(page, tag) {
  page.on('console', (m) => {
    const t = m.text();
    if (!NOISE.test(t)) logs.push(`[${tag}:${m.type()}] ${t}`);
  });
  page.on('pageerror', (e) => logs.push(`[${tag}:pageerror] ${e.message}`));
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
    const dir = join(harnessDir, 'progress');
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
    if (typeof step.key === 'string' && /^[wasdWASD]$/.test(step.key)) clean.key = step.key.toLowerCase();
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
  ];

  // Option C: detect slope/ramp tickets and append a sloped-dungeon capture.
  // This runs AFTER the base fallback steps execute — the existing pages are
  // still alive and in gameplay, so we can emitScenario on player A.
  const ticket = inferTicketFile() ? readText(inferTicketFile(), 8000) : '';
  const isSlopeTicket = /slope|ramp|sloped[-_]dungeon/i.test(ticket) ||
                        /sloped|142/.test(outDirAbs);

  const steps = isSlopeTicket
    ? [
        ...baseSteps,
        { action: 'emitScenario', player: 'A', scenario: 'sloped-dungeon' },
        { action: 'wait', player: 'A', ms: 1500 },
        { action: 'screenshot', player: 'A', name: '04-sloped-ramp', description: 'Sloped dungeon room with ramp geometry visible after emitScenario sloped-dungeon.' },
      ]
    : baseSteps;

  return {
    summary: isSlopeTicket
      ? 'Deterministic full-flow smoke capture with sloped-dungeon fallback: auth, lobby, ready, movement, ramp screenshot.'
      : 'Deterministic full-flow smoke capture: auth, lobby create/join, ready transition, movement.',
    steps,
  };
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
    return {
      harnessState,
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

      // Ensure lobby browser is visible
      const lobbyBrowser = page.locator('#lobby-browser');
      if (!(await lobbyBrowser.isVisible().catch(() => false))) {
        console.warn(`[createLobby] #lobby-browser not visible for player ${player}`);
      }

      // Fill lobby name and click create
      await page.locator('#create-lobby-name').fill(lobbyName);
      await page.locator('#create-lobby-btn').click();
      await page.waitForTimeout(500);

      // Wait for squad UI (#lobby) to become visible
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
      for (const page of pages.values()) {
        const btn = page.locator('#ready-btn').first();
        if (await btn.isVisible().catch(() => false)) {
          await btn.click().catch(() => {});
        }
      }
      await pageForFallback(pages).waitForTimeout(500);
      continue;
    }

    const page = getPage(player);

    if (step.action === 'waitForGame') {
      await waitForGameplay(page, step.timeoutMs || 12000);
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
      probes.push({
        player,
        description: step.description || '',
        data: await collectProbe(page),
      });
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
  writeFileSync(join(outDirAbs, 'console.log'), logs.join('\n') + '\n');
  writeFileSync(join(outDirAbs, 'metrics.json'), JSON.stringify(metrics, null, 2));
  emitProgressEvent('capture_metrics', {
    artifacts: relative(repoRoot, outDirAbs),
    ok: metrics.ok,
    source: metrics.capturePlanSource,
    scenarios: metrics.scenarios,
    screenshots: metrics.screenshots,
  });
  await browser.close().catch(() => {});
}

console.log(JSON.stringify(metrics, null, 2));
process.exit(metrics.ok ? 0 : 1);
