#!/usr/bin/env node
/**
 * Two-browser UI smoke test: create/join lobby, start run, leave, drop back in.
 * Requires: client on :5173, server on :3000, playwright chromium.
 */
import { chromium } from 'playwright';

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const SERVER_URL = process.env.SERVER_URL || process.env.BASE_URL || 'http://localhost:3000';

async function register(username) {
  const res = await fetch(`${SERVER_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'password123' }),
  });
  const body = await res.json();
  if (body.token) return body.token;
  const login = await fetch(`${SERVER_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'password123' }),
  });
  return (await login.json()).token;
}

async function loginWithToken(page, token) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[browser]', msg.text());
  });
  await page.goto(CLIENT_URL);
  await page.evaluate((t) => {
    localStorage.setItem('autogame_token', t);
  }, token);
  await page.reload();
  await page.waitForFunction(() => {
    const browserEl = document.getElementById('lobby-browser');
    const auth = document.getElementById('auth-overlay');
    return browserEl && !browserEl.classList.contains('hidden')
      && auth && auth.classList.contains('hidden');
  }, { timeout: 15000 }).catch(async () => {
    const state = await page.evaluate(() => ({
      lobbyHidden: document.getElementById('lobby-browser')?.classList.contains('hidden'),
      authHidden: document.getElementById('auth-overlay')?.classList.contains('hidden'),
      authError: document.getElementById('login-error')?.textContent,
      status: document.getElementById('status')?.textContent,
    }));
    throw new Error(`Login UI not ready: ${JSON.stringify(state)}`);
  });
}

async function isVisible(page, id) {
  return page.evaluate((elementId) => {
    const el = document.getElementById(elementId);
    return !!(el && !el.classList.contains('hidden') && el.style.display !== 'none');
  }, id);
}

async function main() {
  const suffix = Date.now();
  const token1 = await register(`browser-a-${suffix}`);
  const token2 = await register(`browser-b-${suffix}`);

  const browser = await chromium.launch({ headless: true });
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();

  console.log('✓ Launching two browser contexts');

  await loginWithToken(page1, token1);
  await loginWithToken(page2, token2);
  console.log('✓ Both players logged in and see lobby browser');

  await page1.evaluate(() => {
    const name = document.getElementById('create-lobby-name');
    if (name) name.value = 'Browser Test Lobby';
    document.getElementById('create-lobby-btn')?.click();
  });
  await page1.waitForFunction(() => {
    const lobby = document.getElementById('lobby');
    return lobby && !lobby.classList.contains('hidden');
  }, { timeout: 10000 });
  console.log('✓ Player 1 created lobby');

  await page2.waitForFunction(() => {
    const items = document.querySelectorAll('.join-lobby-btn');
    return items.length > 0;
  }, { timeout: 10000 });
  await page2.evaluate(() => {
    document.querySelector('.join-lobby-btn')?.click();
  });
  await page2.waitForFunction(() => {
    const lobby = document.getElementById('lobby');
    return lobby && !lobby.classList.contains('hidden');
  }, { timeout: 10000 });
  console.log('✓ Player 2 joined lobby');

  await page1.evaluate(() => document.getElementById('ready-btn')?.click());
  await page2.evaluate(() => document.getElementById('ready-btn')?.click());

  await page1.waitForFunction(() => {
    const ui = document.getElementById('ui');
    return ui && ui.style.display === 'block';
  }, { timeout: 15000 });
  await page2.waitForFunction(() => {
    const ui = document.getElementById('ui');
    return ui && ui.style.display === 'block';
  }, { timeout: 15000 });
  console.log('✓ Run started in both browsers');

  await page2.evaluate(() => document.getElementById('leave-lobby-btn')?.click());
  await page2.waitForFunction(() => {
    const browserEl = document.getElementById('lobby-browser');
    return browserEl && !browserEl.classList.contains('hidden');
  }, { timeout: 10000 });
  console.log('✓ Player 2 left lobby');

  await page2.evaluate(() => {
    document.querySelector('.join-lobby-btn[data-join-mode="drop-in"]')?.click();
  });
  await page2.waitForFunction(() => {
    const ui = document.getElementById('ui');
    return ui && ui.style.display === 'block';
  }, { timeout: 15000 });
  console.log('✓ Player 2 dropped back in');

  const p1InGame = await isVisible(page1, 'ui');
  const p2InGame = await isVisible(page2, 'ui');
  if (!p1InGame || !p2InGame) {
    throw new Error('Expected both players in game UI after drop-in');
  }

  await browser.close();
  console.log('✓ Two-browser lobby drop-in/out test passed');
}

main().catch((err) => {
  console.error('✗', err.message);
  process.exit(1);
});
