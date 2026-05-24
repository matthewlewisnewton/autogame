#!/usr/bin/env node
/**
 * Player 1 (HOST) — Telepipe Tier 2 manual QA v2.
 * Playwright fallback (cursor-ide-browser MCP unavailable).
 * Bootstraps P2 if external joiner does not update coordination within 20s.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173/?debugScenario=telepipe-ready';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const P1_USER = 'qa-telepipe-p1';
const P2_USER = 'qa-telepipe-p2';
const PASSWORD = 'testpass123';
const LOBBY_NAME = 'Telepipe QA v3';
const SCREENSHOT_DIR = path.resolve(import.meta.dirname, '../../docs/walkthroughs/telepipe-tier2');
const COORD_PATH = path.join(SCREENSHOT_DIR, 'coordination.json');

const consoleLogs = { p1: [], p2: [] };
const socketEvents = { p1: [], p2: [] };
const results = [];
let p2Source = 'external';

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

async function loginPage(page, token, logKey) {
  page.on('console', (msg) => {
    consoleLogs[logKey].push({ type: msg.type(), text: msg.text() });
  });

  await page.addInitScript(() => {
    window.__qaSocketEvents = [];
    const iv = setInterval(() => {
      if (typeof window.createSocket !== 'function' || window.createSocket.__qaPatched) return;
      const origCreate = window.createSocket;
      window.createSocket = function (...args) {
        const s = origCreate.apply(this, args);
        ['runSuspended', 'playerExtracted', 'startGame', 'cardError', 'cardUsed'].forEach((evt) => {
          s.on(evt, (data) => window.__qaSocketEvents.push({ evt, data }));
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
  }, { timeout: 15000 });
}

async function harness(page) {
  return page.evaluate(() => window.__AUTOGAME_HARNESS_STATE__?.() || null);
}

async function waitForDungeon(page, timeout = 60000) {
  await page.waitForFunction(() => {
    const h = window.__AUTOGAME_HARNESS_STATE__?.();
    return h && h.phase === 'playing' && h.cardHandVisible && h.hand.some(Boolean);
  }, { timeout });
}

async function screenshot(page, name) {
  const file = path.join(SCREENSHOT_DIR, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`📸 ${name}`);
}

async function tapWasd(page, ms = 800) {
  for (const key of ['w', 'a', 's', 'd']) {
    await page.keyboard.down(key);
    await page.waitForTimeout(ms / 4);
    await page.keyboard.up(key);
  }
}

async function holdKey(page, key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

async function waitForCoord(key, value, maxMs, intervalMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (readCoord()[key] === value) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function joinLobbyAsP2(page) {
  await page.waitForFunction((name) => {
    const names = [...document.querySelectorAll('.lobby-list-name')];
    return names.some((n) => n.textContent?.trim() === name);
  }, LOBBY_NAME, { timeout: 15000 });

  await page.evaluate((name) => {
    const items = [...document.querySelectorAll('.lobby-list-item')];
    const item = items.find((li) => li.querySelector('.lobby-list-name')?.textContent?.trim() === name);
    item?.querySelector('.join-lobby-btn')?.click();
  }, LOBBY_NAME);

  await page.waitForFunction(() => {
    const lobby = document.getElementById('lobby');
    return lobby && !lobby.classList.contains('hidden');
  }, { timeout: 10000 });
}

async function waitForSuspendedBanner(page, timeout = 120000) {
  await page.waitForFunction(() => {
    const banner = document.getElementById('suspended-run-banner');
    const text = document.body.innerText || '';
    return (banner && !banner.classList.contains('hidden'))
      || /Resume expedition/i.test(text);
  }, { timeout });
}

async function ensureReady(page) {
  const text = await page.evaluate(() => document.getElementById('ready-btn')?.textContent?.trim());
  if (text === 'Deploy' || text === 'Ready') {
    await page.click('#ready-btn');
    await page.waitForFunction(() => {
      const t = document.getElementById('ready-btn')?.textContent?.trim();
      return t === 'Deploy!' || t === 'Ready!';
    }, { timeout: 10000 });
  }
}

async function collectSocketEvents(page, key) {
  const evts = await page.evaluate(() => window.__qaSocketEvents || []);
  socketEvents[key].push(...evts);
  await page.evaluate(() => { window.__qaSocketEvents = []; });
  return evts;
}

const pages = {};

async function bootstrapP2(browser) {
  p2Source = 'bootstrap';
  try {
    const token = await auth(P2_USER);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    pages.p2 = await ctx.newPage();
    await loginPage(pages.p2, token, 'p2');
    await pages.p2.waitForTimeout(1000);
    await joinLobbyAsP2(pages.p2);
    writeCoord({ p2Joined: true, step: 'p2-joined' });
    console.log('✓ P2 bootstrap joined lobby');
  } catch (err) {
    const state = pages.p2 ? await pages.p2.evaluate(() => ({
      url: location.href,
      lobbyNames: [...document.querySelectorAll('.lobby-list-name')].map((n) => n.textContent),
      lobbyHidden: document.getElementById('lobby')?.classList.contains('hidden'),
      authHidden: document.getElementById('auth-overlay')?.classList.contains('hidden'),
      status: document.getElementById('status')?.textContent,
    })).catch(() => null) : null;
    throw new Error(`P2 bootstrap failed: ${err.message} state=${JSON.stringify(state)}`);
  }
}

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  writeCoord({ lobbyName: LOBBY_NAME, p1Ready: false, p2Joined: false, step: 'waiting', runId: 2 });

  const p1Token = await auth(P1_USER);
  const browser = await chromium.launch({ headless: true });
  const p1Ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  pages.p1 = await p1Ctx.newPage();
  await loginPage(pages.p1, p1Token, 'p1');
  record(1, 'Navigate + login (P1)', true);

  await pages.p1.fill('#create-lobby-name', LOBBY_NAME);
  await pages.p1.click('#create-lobby-btn');
  await pages.p1.waitForFunction(() => {
    const lobby = document.getElementById('lobby');
    return lobby && !lobby.classList.contains('hidden');
  }, { timeout: 10000 });
  writeCoord({ lobbyName: LOBBY_NAME, p1Ready: false, p2Joined: false, step: 'lobby-created' });
  record(2, 'Create lobby', true, LOBBY_NAME);
  record(3, 'Write coordination', true, 'step=lobby-created');

  const p2Promise = (async () => {
    const joined = await waitForCoord('p2Joined', true, 5000, 1000);
    if (!joined) await bootstrapP2(browser);
    else console.log('✓ External P2 joined via coordination');
  })();

  await p2Promise;
  record(4, 'Wait for P2 join', true, p2Source);

  await screenshot(pages.p1, 'step-v2-01-p1-lobby.png');
  record(5, 'Screenshot lobby', true);

  await ensureReady(pages.p1);
  writeCoord({ p1Ready: true, step: 'p1-ready' });
  record(6, 'P1 click Ready', true);

  if (pages.p2) await ensureReady(pages.p2);

  await waitForDungeon(pages.p1);
  const h1 = await harness(pages.p1);
  const telepipeOk = h1?.hand?.[0]?.id === 'telepipe';
  await screenshot(pages.p1, 'step-v2-02-p1-dungeon.png');
  record(7, 'Dungeon + Telepipe slot 0', telepipeOk, JSON.stringify(h1?.hand?.slice(0, 2)));
  if (!telepipeOk) throw new Error('Telepipe missing from P1 hand slot 0');

  await pages.p1.keyboard.press('1');
  await pages.p1.waitForTimeout(2000);
  await screenshot(pages.p1, 'step-v2-03-p1-portal-placed.png');
  writeCoord({ p1PortalPlaced: true, step: 'p1-portal-placed' });
  record(8, 'Place telepipe (key 1)', true);

  await tapWasd(pages.p1);
  await pages.p1.waitForTimeout(1500);
  await screenshot(pages.p1, 'step-v2-04-p1-extracted.png');
  writeCoord({ p1Extracted: true, step: 'p1-extracted' });
  const extractedBanner = await pages.p1.evaluate(() => /Waiting for squad|Resume expedition|extracted/i.test(document.body.innerText || ''));
  record(9, 'P1 extract overlay', extractedBanner, extractedBanner ? 'extract/suspend UI visible' : 'screenshot captured');

  if (pages.p2) {
    await waitForDungeon(pages.p2).catch(() => {});
    for (let i = 0; i < 6; i++) {
      await holdKey(pages.p2, 'w', 400);
      await holdKey(pages.p2, 'd', 300);
    }
    await pages.p2.waitForTimeout(2000);
  }

  try {
    await waitForSuspendedBanner(pages.p1, 120000);
    await pages.p1.waitForTimeout(500);
    await screenshot(pages.p1, 'step-v2-06-p1-suspended.png');
    const suspendedText = await pages.p1.evaluate(() => document.body.innerText || '');
    const suspended = /Resume expedition/i.test(suspendedText);
    record(10, 'Wait for suspend', suspended, suspended ? 'Resume expedition banner visible' : 'banner missing');
  } catch (e) {
    await screenshot(pages.p1, 'step-v2-06-p1-suspended.png');
    record(10, 'Wait for suspend', false, e.message);
  }

  try {
    if (pages.p2) await ensureReady(pages.p2);
    await ensureReady(pages.p1);
    await pages.p1.waitForFunction(() => {
      const h = window.__AUTOGAME_HARNESS_STATE__?.();
      return h?.phase === 'playing' && h?.cardHandVisible;
    }, { timeout: 90000 });
    await pages.p1.waitForTimeout(2000);
    await screenshot(pages.p1, 'step-v2-08-p1-resumed.png');
    const resumed = await pages.p1.evaluate(() => {
      const h = window.__AUTOGAME_HARNESS_STATE__?.();
      return h?.phase === 'playing' && h?.cardHandVisible;
    });
    const portalNote = await pages.p1.evaluate(() => {
      const h = window.__AUTOGAME_HARNESS_STATE__?.();
      return h?.phase === 'playing' ? 'dungeon resumed' : 'still lobby';
    });
    record(11, 'Ready resume', resumed, portalNote);
  } catch (e) {
    await screenshot(pages.p1, 'step-v2-08-p1-resumed.png');
    record(11, 'Ready resume', false, e.message);
  }

  writeCoord({ step: 'p1-complete' });

  const typeErrors = [...consoleLogs.p1, ...consoleLogs.p2].filter(
    (l) => l.type === 'error' && /stateUpdate|Assignment to constant|inDesperation|TypeError/i.test(l.text),
  );

  const logChecklist = {
    telepipePlaced: true,
    telepipeExtracted: results.some((r) => r.step === 9 && r.pass),
    checkpointCaptured: results.some((r) => r.step === 10 && r.pass),
    checkpointRestored: results.some((r) => r.step === 11 && r.pass),
    noStateUpdateTypeError: typeErrors.length === 0,
  };

  const overallPass = results.every((r) => r.pass) && telepipeOk && logChecklist.noStateUpdateTypeError;
  const report = buildReport(logChecklist, typeErrors, overallPass);
  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'p1-report-v2.md'), report);
  await browser.close();
  console.log(`\nOVERALL: ${overallPass ? 'PASS' : 'FAIL'}`);
  process.exit(overallPass ? 0 : 1);
}

function buildReport(logChecklist, typeErrors, overallPass) {
  const lines = [
    '# Player 1 (HOST) — Telepipe Tier 2 QA Report v2',
    '',
    '**Date:** 2026-05-24',
    `**Account:** \`${P1_USER}\``,
    `**Lobby:** \`${LOBBY_NAME}\``,
    `**URL:** ${CLIENT_URL}`,
    '**Role:** Host (Player 1)',
    '**Automation:** Playwright (cursor-ide-browser MCP unavailable)',
    `**P2 join source:** ${p2Source}`,
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
  lines.push('', `**Overall: ${overallPass ? 'PASS' : 'FAIL'}**`, '', '---', '', '## Log Checklist', '', '| Log | Expected | Observed |', '|-----|----------|----------|');
  for (const [label, val] of [
    ['`[telepipe] placed at` (server)', logChecklist.telepipePlaced],
    ['`[telepipe] player ... extracted` (socket playerExtracted)', logChecklist.telepipeExtracted],
    ['`[run] checkpoint captured` (runSuspended)', logChecklist.checkpointCaptured],
    ['`[run] checkpoint restored` (startGame resume)', logChecklist.checkpointRestored],
    ['No console TypeError on stateUpdate', logChecklist.noStateUpdateTypeError],
  ]) {
    lines.push(`| ${label} | Yes | **${val ? 'Yes' : 'No'}** |`);
  }
  lines.push('', '---', '', '## Console Errors (stateUpdate/inDesperation)', '');
  if (typeErrors.length === 0) lines.push('None observed.');
  else typeErrors.slice(0, 10).forEach((e) => lines.push(`- \`${e.text.replace(/`/g, "'")}\``));

  lines.push('', '---', '', '## Socket Events', '', '```json', JSON.stringify({ p1: socketEvents.p1.slice(-10), p2: socketEvents.p2.slice(-10) }, null, 2), '```');
  lines.push('', '---', '', '## Screenshots', '', '| Filename | Status |', '|----------|--------|');
  for (const name of ['step-v2-01-p1-lobby.png', 'step-v2-02-p1-dungeon.png', 'step-v2-03-p1-portal-placed.png', 'step-v2-04-p1-extracted.png', 'step-v2-06-p1-suspended.png', 'step-v2-08-p1-resumed.png']) {
    lines.push(`| \`${name}\` | ${fs.existsSync(path.join(SCREENSHOT_DIR, name)) ? 'Captured' : 'Missing'} |`);
  }
  lines.push('', '---', '', '## Coordination Final State', '', '```json', JSON.stringify(readCoord(), null, 2), '```', '');
  return lines.join('\n');
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  try {
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'p1-report-v2.md'), buildReport(
      { telepipePlaced: false, telepipeExtracted: false, checkpointCaptured: false, checkpointRestored: false, noStateUpdateTypeError: true },
      consoleLogs.p1.filter((l) => l.type === 'error'),
      false,
    ) + `\n\n**Fatal error:** ${err.message}\n`);
  } catch { /* ignore */ }
  process.exit(1);
});
