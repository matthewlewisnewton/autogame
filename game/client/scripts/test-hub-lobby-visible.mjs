#!/usr/bin/env node
/**
 * Smoke test: the rendered hub canvas stays visible behind the lobby UI during
 * the lobby phase, and the Deploy button stays interactive.
 *
 * Drives register -> create lobby -> reach lobby phase, then asserts:
 *   - a real <canvas> is rendered (non-zero size, in the DOM)
 *   - the #lobby overlay does NOT paint an opaque, viewport-filling background
 *     over it (its computed background-color is transparent)
 *   - the Deploy button (#ready-btn) is visible, enabled, has pointer-events
 *     active, and is the topmost element at its own location (nothing covering)
 *   - no console/page errors occurred during the lobby phase
 *
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

async function main() {
  const suffix = Date.now();
  const token = await register(`hub-lobby-${suffix}`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));

  await page.goto(CLIENT_URL);
  await page.evaluate((t) => localStorage.setItem('autogame_token', t), token);
  await page.reload();

  await page.waitForFunction(() => {
    const browserEl = document.getElementById('lobby-browser');
    const auth = document.getElementById('auth-overlay');
    return browserEl && !browserEl.classList.contains('hidden')
      && auth && auth.classList.contains('hidden');
  }, { timeout: 15000 });
  console.log('✓ Logged in and lobby browser visible');

  await page.evaluate(() => {
    const name = document.getElementById('create-lobby-name');
    if (name) name.value = 'Hub Visible Test Lobby';
    document.getElementById('create-lobby-btn')?.click();
  });
  await page.waitForFunction(() => {
    const lobby = document.getElementById('lobby');
    return lobby && !lobby.classList.contains('hidden');
  }, { timeout: 10000 });
  console.log('✓ Reached lobby phase');

  // Give the renderer a moment to mount the hub canvas / spawn the avatar.
  await page.waitForFunction(() => {
    const c = document.querySelector('canvas');
    return c && c.width > 0 && c.height > 0;
  }, { timeout: 10000 });

  const result = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const lobby = document.getElementById('lobby');
    const deploy = document.getElementById('ready-btn');

    const lobbyBg = getComputedStyle(lobby).backgroundColor;
    // Transparent => rgba(0, 0, 0, 0) (or the legacy keyword "transparent").
    const lobbyBgTransparent = lobbyBg === 'rgba(0, 0, 0, 0)' || lobbyBg === 'transparent';

    // The lobby scrolls; make sure Deploy is in view before probing it.
    deploy.scrollIntoView({ block: 'center' });
    const deployRect = deploy.getBoundingClientRect();
    const deployStyle = getComputedStyle(deploy);
    const cx = deployRect.left + deployRect.width / 2;
    const cy = deployRect.top + deployRect.height / 2;
    const topAtDeploy = document.elementFromPoint(cx, cy);

    return {
      hasCanvas: !!canvas,
      canvasW: canvas ? canvas.width : 0,
      canvasH: canvas ? canvas.height : 0,
      lobbyBg,
      lobbyBgTransparent,
      deployVisible: deployRect.width > 0 && deployRect.height > 0,
      deployDisabled: deploy.disabled,
      deployPointerEvents: deployStyle.pointerEvents,
      deployIsTopmost: deploy.contains(topAtDeploy) || topAtDeploy === deploy,
    };
  });

  console.log('  lobby state:', JSON.stringify(result));

  if (!result.hasCanvas || result.canvasW <= 0 || result.canvasH <= 0) {
    throw new Error('Hub canvas is not rendered during the lobby phase');
  }
  if (!result.lobbyBgTransparent) {
    throw new Error(`#lobby background is not transparent (got "${result.lobbyBg}") — it occludes the hub canvas`);
  }
  if (!result.deployVisible || result.deployDisabled) {
    throw new Error('Deploy button is not visible/enabled in the lobby');
  }
  if (result.deployPointerEvents === 'none' || !result.deployIsTopmost) {
    throw new Error('Deploy button is not interactive (covered or pointer-events disabled)');
  }
  console.log('✓ Hub canvas visible, #lobby background transparent, Deploy interactive');

  // Confirm the Deploy button actually responds to a click (transitions to run).
  await page.click('#ready-btn');
  await page.waitForFunction(() => {
    const ui = document.getElementById('ui');
    return ui && ui.style.display === 'block';
  }, { timeout: 15000 });
  console.log('✓ Deploy click started the run');

  if (errors.length) {
    throw new Error(`Console/page errors during lobby phase:\n${errors.join('\n')}`);
  }
  console.log('✓ No console/page errors');

  await browser.close();
  console.log('✓ Hub-lobby-visible smoke test passed');
}

main().catch((err) => {
  console.error('✗', err.message);
  process.exit(1);
});
