#!/usr/bin/env node
/**
 * Two-browser UI smoke test: create/join lobby, start run, leave, drop back in.
 * Requires: client on :5173, server on :3000, playwright chromium.
 */
import { chromium } from 'playwright';
import { loginInBrowser } from './session-auth.mjs';

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

async function isVisible(page, id) {
  return page.evaluate((elementId) => {
    const el = document.getElementById(elementId);
    return !!(el && !el.classList.contains('hidden') && el.style.display !== 'none');
  }, id);
}

async function main() {
  const suffix = Date.now();

  const browser = await chromium.launch({ headless: true });
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();

  console.log('✓ Launching two browser contexts');

  await loginInBrowser(page1, CLIENT_URL, `browser-a-${suffix}`);
  await loginInBrowser(page2, CLIENT_URL, `browser-b-${suffix}`);
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
  const createdLobbyName = await page1.evaluate(() => {
    const el = document.querySelector('#lobby .lobby-name, #lobby h2 + p, #lobby');
    return 'Browser Test Lobby';
  });
  console.log('✓ Player 1 created lobby');

  await page2.evaluate(() => document.getElementById('refresh-lobbies-btn')?.click());
  await page2.waitForFunction((lobbyName) => {
    const items = [...document.querySelectorAll('.lobby-list-item')];
    return items.some((li) =>
      li.textContent.includes(lobbyName)
      && li.querySelector('.join-lobby-btn[data-join-mode="join"]'));
  }, createdLobbyName, { timeout: 15000 });
  await page2.evaluate((lobbyName) => {
    const items = [...document.querySelectorAll('.lobby-list-item')];
    const item = items.find((li) => li.textContent.includes(lobbyName));
    item?.querySelector('.join-lobby-btn[data-join-mode="join"]')?.click();
  }, createdLobbyName);
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
