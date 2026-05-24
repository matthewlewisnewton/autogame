#!/usr/bin/env node
/**
 * Player 2 (JOINER) — Telepipe Tier 2 manual QA v2.
 * Playwright fallback (cursor-ide-browser MCP unavailable).
 */
import { chromium } from '../../../../harness/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_URL = 'http://localhost:5173/?debugScenario=telepipe-ready';
const SERVER_URL = 'http://localhost:3000';
const P2_USER = 'qa-telepipe-p2';
const PASSWORD = 'testpass123';
const LOBBY_NAME = 'Telepipe QA v3';
const SCREENSHOT_DIR = __dirname;
const COORD_PATH = path.join(SCREENSHOT_DIR, 'coordination.json');

const consoleLogs = [];
const socketEvents = [];
const results = [];

function readCoord() {
  return JSON.parse(fs.readFileSync(COORD_PATH, 'utf8'));
}

function writeCoord(patch) {
  const cur = readCoord();
  fs.writeFileSync(COORD_PATH, JSON.stringify({ ...cur, ...patch }, null, 2) + '\n');
}

function record(step, desc, pass, notes = '') {
  results.push({ step, desc, pass, notes });
  console.log(`${pass ? '✓' : '✗'} Step ${step}: ${desc}${notes ? ` — ${notes}` : ''}`);
}

async function auth(username) {
  let res = await fetch(`${SERVER_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PASSWORD }),
  });
  let body = await res.json();
  if (body.token) return body.token;
  res = await fetch(`${SERVER_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PASSWORD }),
  });
  body = await res.json();
  if (!body.token) throw new Error(`Auth failed for ${username}: ${JSON.stringify(body)}`);
  return body.token;
}

async function loginPage(page, token) {
  page.on('console', (msg) => {
    const entry = { type: msg.type(), text: msg.text() };
    consoleLogs.push(entry);
    if (/cardError|playerExtracted|runSuspended|telepipe|\[run\]/i.test(entry.text)) {
      socketEvents.push({ source: 'console', ...entry });
    }
    const cardErrorMatch = entry.text.match(/^\[cardError\]\s*(.+)$/);
    if (cardErrorMatch) {
      socketEvents.push({
        source: 'console',
        evt: 'cardError',
        data: { reason: cardErrorMatch[1] },
        ts: Date.now(),
      });
    }
  });

  await page.addInitScript(() => {
    window.__qaSocketEvents = [];
    const iv = setInterval(() => {
      if (typeof window.createSocket !== 'function' || window.createSocket.__qaPatched) return;
      const origCreate = window.createSocket;
      window.createSocket = function (...args) {
        const s = origCreate.apply(this, args);
        ['runSuspended', 'playerExtracted', 'startGame', 'cardError', 'cardUsed', 'stateUpdate'].forEach((evt) => {
          s.on(evt, (data) => window.__qaSocketEvents.push({ evt, data, ts: Date.now() }));
        });
        return s;
      };
      window.createSocket.__qaPatched = true;
      clearInterval(iv);
    }, 10);
  });

  await page.goto(CLIENT_URL);
  await page.evaluate((t) => localStorage.setItem('autogame_token', t), token);
  await page.reload();
  await page.waitForFunction(() => {
    const browserEl = document.getElementById('lobby-browser');
    const auth = document.getElementById('auth-overlay');
    return browserEl && !browserEl.classList.contains('hidden') && auth?.classList.contains('hidden');
  }, null, { timeout: 20000 });
}

async function harness(page) {
  return page.evaluate(() => window.__AUTOGAME_HARNESS_STATE__?.() || null);
}

async function collectSocketEvents(page) {
  const evts = await page.evaluate(() => window.__qaSocketEvents || []);
  socketEvents.push(...evts);
  await page.evaluate(() => { window.__qaSocketEvents = []; });
  return evts;
}

async function waitForDungeon(page, timeout = 90000) {
  await page.waitForFunction(() => {
    const h = window.__AUTOGAME_HARNESS_STATE__?.();
    return h && h.phase === 'playing' && h.cardHandVisible && h.hand.some(Boolean);
  }, null, { timeout });
}

async function screenshot(page, name) {
  const file = path.join(SCREENSHOT_DIR, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`📸 ${name}`);
}

async function holdKey(page, key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

async function waitForCoord(predicate, maxMs, intervalMs = 1000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const coord = readCoord();
    if (predicate(coord)) return coord;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

async function joinLobby(page) {
  for (let attempt = 0; attempt < 60; attempt++) {
    await page.click('#refresh-lobbies-btn').catch(() => {});
    await page.waitForTimeout(400);
    const joined = await page.evaluate((name) => {
      const items = [...document.querySelectorAll('.lobby-list-item')];
      const item = items.find((li) => li.querySelector('.lobby-list-name')?.textContent?.trim() === name);
      const btn = item?.querySelector('.join-lobby-btn');
      if (btn && btn.textContent?.trim() === 'Join') {
        btn.click();
        return true;
      }
      return false;
    }, LOBBY_NAME);
    if (joined) {
      await page.waitForFunction(() => {
        const lobby = document.getElementById('lobby');
        return lobby && !lobby.classList.contains('hidden');
      }, null, { timeout: 10000 });
      return true;
    }
    await page.waitForTimeout(1000);
  }
  return false;
}

async function isInDungeon(page) {
  return page.evaluate(() => {
    const h = window.__AUTOGAME_HARNESS_STATE__?.();
    return h?.phase === 'playing' && h?.cardHandVisible && !h?.extracted;
  });
}

async function waitForSuspendedBanner(page, timeout = 120000) {
  await page.waitForFunction(() => {
    const banner = document.getElementById('suspended-run-banner');
    const text = document.body.innerText || '';
    return (banner && !banner.classList.contains('hidden'))
      || /Resume expedition|Waiting for squad/i.test(text);
  }, null, { timeout });
}

function buildReport(overallPass) {
  const cardErrors = socketEvents.filter((e) => e.evt === 'cardError' || /Telepipe already active/i.test(JSON.stringify(e)));
  const extracted = socketEvents.filter((e) => e.evt === 'playerExtracted');
  const suspended = socketEvents.filter((e) => e.evt === 'runSuspended');
  const telepipeState = socketEvents.filter((e) => e.evt === 'stateUpdate' && JSON.stringify(e.data || {}).includes('telepipe'));

  const lines = [
    '# Player 2 (JOINER) — Telepipe Tier 2 QA Report v2',
    '',
    '**Date:** 2026-05-24',
    `**Account:** \`${P2_USER}\``,
    `**Lobby:** \`${LOBBY_NAME}\``,
    `**URL:** ${CLIENT_URL}`,
    '**Role:** Joiner (Player 2)',
    '**Automation:** Playwright (cursor-ide-browser MCP unavailable)',
    '',
    '---',
    '',
    '## Step Results',
    '',
    '| Step | Description | Result | Notes |',
    '|------|-------------|--------|-------|',
  ];
  for (const r of results) {
    lines.push(`| ${r.step} | ${r.desc} | **${r.pass ? 'PASS' : 'FAIL'}** | ${r.notes || '—'} |`);
  }
  lines.push('', `**Overall: ${overallPass ? 'PASS' : 'FAIL'}**`, '', '---', '', '## WebSocket Events', '', '| Event | Expected | Observed |', '|-------|----------|----------|');
  lines.push(`| \`cardError\` ("Telepipe already active") | Yes | **${cardErrors.some((e) => JSON.stringify(e).includes('Telepipe already active')) ? 'Yes' : 'No'}** |`);
  lines.push(`| \`playerExtracted\` (P1 first) | Yes | **${extracted.length > 0 ? 'Yes' : 'No'}** |`);
  lines.push(`| \`runSuspended\` | Yes | **${suspended.length > 0 ? 'Yes' : 'No'}** |`);
  lines.push(`| \`stateUpdate\` with telepipe | Yes | **${telepipeState.length > 0 ? 'Yes' : 'No'}** |`);

  lines.push('', '---', '', '## Socket Event Log (last 15)', '', '```json', JSON.stringify(socketEvents.slice(-15), null, 2), '```');

  lines.push('', '---', '', '## Console Errors', '');
  const typeErrors = consoleLogs.filter((l) => l.type === 'error' && /TypeError|inDesperation|stateUpdate/i.test(l.text));
  if (typeErrors.length === 0) lines.push('None observed.');
  else typeErrors.slice(0, 8).forEach((e) => lines.push(`- \`${e.text.replace(/`/g, "'")}\``));

  lines.push('', '---', '', '## Screenshots', '', '| Filename | Status |', '|----------|--------|');
  for (const name of [
    'step-v2-01-p2-joined.png',
    'step-v2-02-p2-dungeon.png',
    'step-v2-03-p2-rejected.png',
    'step-v2-05-p2-still-playing.png',
    'step-v2-06-p2-suspended.png',
    'step-v2-08-p2-resumed.png',
  ]) {
    lines.push(`| \`${name}\` | ${fs.existsSync(path.join(SCREENSHOT_DIR, name)) ? 'Captured' : 'Missing'} |`);
  }

  lines.push('', '---', '', '## Coordination Final State', '', '```json', JSON.stringify(readCoord(), null, 2), '```', '');
  return lines.join('\n');
}

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const token = await auth(P2_USER);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  try {
    await loginPage(page, token);
    record(1, 'Navigate + login', true);

    const lobbyCoord = await waitForCoord((c) => c.lobbyName === LOBBY_NAME, 120000);
    record(2, 'Poll coordination for lobby', !!lobbyCoord, lobbyCoord?.step || 'timeout');

    const joined = await joinLobby(page);
    if (!joined) throw new Error(`Could not join ${LOBBY_NAME}`);
    writeCoord({ p2Joined: true, step: 'p2-joined' });
    record(3, 'Join lobby + set p2Joined', true, LOBBY_NAME);

    await screenshot(page, 'step-v2-01-p2-joined.png');
    record(4, 'Screenshot joined', true);

    // Wait for P1 ready before clicking Ready
    await waitForCoord((c) => c.p1Ready === true || c.step === 'p1-ready', 120000);
    await page.click('#ready-btn');
    writeCoord({ p2Ready: true, step: 'p2-ready' });
    record(5, 'Click Ready', true);

    await waitForDungeon(page);
    const hDungeon = await harness(page);
    const telepipeOk = hDungeon?.hand?.some((c) => c?.id === 'telepipe');
    await screenshot(page, 'step-v2-02-p2-dungeon.png');
    record(6, 'Dungeon with Telepipe in hand', telepipeOk, JSON.stringify(hDungeon?.hand?.map((c) => c?.id)));

    // Wait for P1 portal placement (coord signal or 15s fallback)
    const portalSignal = await waitForCoord(
      (c) => c.step === 'p1-portal-placed' || c.p1PortalPlaced === true,
      15000,
      1000,
    );
    if (!portalSignal) {
      console.log('⏳ No portal signal in coordination; waiting 15s for P1 portal');
      await page.waitForTimeout(15000);
    }

    await page.keyboard.press('1');
    await page.waitForTimeout(2000);
    const evtsAfterPress = await collectSocketEvents(page);
    const cardErrorEvt = evtsAfterPress.find((e) => e.evt === 'cardError' && e.data?.reason === 'Telepipe already active');
    const toastText = await page.evaluate(() => {
      const text = document.body.innerText || '';
      return /Telepipe already active/i.test(text) ? 'Telepipe already active' : null;
    });
    await screenshot(page, 'step-v2-03-p2-rejected.png');
    record(7, 'Second telepipe rejected (cardError toast)', !!(cardErrorEvt || toastText), cardErrorEvt ? 'socket cardError' : (toastText || 'no toast'));

    // Wait for P1 extraction while P2 stays in dungeon
    await waitForCoord((c) => c.step === 'p1-extracted' || c.p1Extracted === true, 60000).catch(() => null);
    await page.waitForTimeout(3000);
    const stillPlaying = await isInDungeon(page);
    await screenshot(page, 'step-v2-05-p2-still-playing.png');
    record(8, 'Remain in dungeon while P1 extracts', stillPlaying, stillPlaying ? 'phase=playing' : 'left dungeon early');

    // Move toward portal and enter
    for (let i = 0; i < 8; i++) {
      await holdKey(page, 'w', 500);
      await holdKey(page, 'd', 400);
    }
    await page.waitForTimeout(3000);
    await collectSocketEvents(page);

    let suspended = false;
    try {
      await waitForSuspendedBanner(page, 60000);
      suspended = true;
    } catch {
      suspended = await page.evaluate(() => /Resume expedition|Waiting for squad/i.test(document.body.innerText || ''));
    }
    await screenshot(page, 'step-v2-06-p2-suspended.png');
    record(9, 'Enter portal / suspended', suspended);

    await page.click('#ready-btn');
    writeCoord({ p2ResumeReady: true, step: 'p2-resume-ready' });
    await page.waitForTimeout(3000);

    let resumed = false;
    try {
      await waitForDungeon(page, 90000);
      resumed = await isInDungeon(page);
    } catch {
      resumed = await isInDungeon(page);
    }
    await screenshot(page, 'step-v2-08-p2-resumed.png');
    record(10, 'Ready resume with P1', resumed);

    writeCoord({ step: 'p2-complete' });
    await collectSocketEvents(page);
  } catch (err) {
    record('!', 'Fatal error', false, err.message);
    await screenshot(page, 'step-v2-error.png').catch(() => {});
  } finally {
    await ctx.close();
    await browser.close();
  }

  const overallPass = results.every((r) => r.pass);
  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'p2-report-v2.md'), buildReport(overallPass));
  console.log(`\nOVERALL: ${overallPass ? 'PASS' : 'FAIL'}`);
  process.exit(overallPass ? 0 : 1);
}

main();
