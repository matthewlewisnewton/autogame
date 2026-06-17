#!/usr/bin/env node
/**
 * Smoke test: the walkable hub canvas stays visible during the lobby phase while
 * the dismissible #lobby menu starts hidden, and the booth prompt stays usable.
 *
 * Drives register -> create lobby -> reach lobby phase, then asserts:
 *   - #lobby starts hidden (lobbyMenuDismissed) so the hub canvas is unobstructed
 *   - a real <canvas> is rendered (non-zero size, in the DOM)
 *   - the #booth-prompt overlay can be shown and remains interactive (not covered)
 *   - no console/page errors occurred during the lobby phase
 *
 * Requires: client on :5173, server on :3000, playwright chromium.
 */
import { chromium } from 'playwright';
import { loginInBrowser } from './session-auth.mjs';

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

async function main() {
  const suffix = Date.now();

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));

  await loginInBrowser(page, CLIENT_URL, `hub-lobby-${suffix}`);
  console.log('✓ Logged in and lobby browser visible');

  await page.evaluate(() => {
    const name = document.getElementById('create-lobby-name');
    if (name) name.value = 'Hub Visible Test Lobby';
    document.getElementById('create-lobby-btn')?.click();
  });
  await page.waitForFunction(() => {
    const harness = window.__AUTOGAME_HARNESS_STATE__?.();
    const lobby = document.getElementById('lobby');
    const canvas = document.querySelector('canvas');
    return harness
      && harness.phase === 'lobby'
      && harness.lobbyMenuDismissed === true
      && lobby && lobby.classList.contains('hidden')
      && canvas && canvas.width > 0 && canvas.height > 0;
  }, { timeout: 10000 });
  console.log('✓ Reached lobby phase with menu dismissed');

  const result = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const lobby = document.getElementById('lobby');
    const prompt = document.getElementById('booth-prompt');
    const harness = window.__AUTOGAME_HARNESS_STATE__();

    // Simulate an in-range booth prompt (proximity is renderer-driven; verify the
    // overlay itself is usable while the lobby menu stays dismissed).
    if (prompt) {
      prompt.textContent = 'Press F — Launch Bay';
      prompt.dataset.boothId = 'launch';
      prompt.classList.remove('hidden');
    }
    const promptRect = prompt?.getBoundingClientRect?.() ?? { width: 0, height: 0 };
    const promptStyle = prompt ? getComputedStyle(prompt) : null;
    const cx = promptRect.left + promptRect.width / 2;
    const cy = promptRect.top + promptRect.height / 2;
    const topAtPrompt = promptRect.width > 0 ? document.elementFromPoint(cx, cy) : null;

    return {
      hasCanvas: !!canvas,
      canvasW: canvas ? canvas.width : 0,
      canvasH: canvas ? canvas.height : 0,
      lobbyHidden: lobby ? lobby.classList.contains('hidden') : false,
      lobbyMenuDismissed: harness?.lobbyMenuDismissed === true,
      hasBoothPrompt: !!prompt,
      boothPromptVisible: promptRect.width > 0 && promptRect.height > 0,
      boothPromptPointerEvents: promptStyle ? promptStyle.pointerEvents : null,
      boothPromptIsTopmost: prompt && (prompt.contains(topAtPrompt) || topAtPrompt === prompt),
    };
  });

  console.log('  lobby state:', JSON.stringify(result));

  if (!result.hasCanvas || result.canvasW <= 0 || result.canvasH <= 0) {
    throw new Error('Hub canvas is not rendered during the lobby phase');
  }
  if (!result.lobbyHidden || !result.lobbyMenuDismissed) {
    throw new Error('#lobby menu is visible on hub join — it should start dismissed');
  }
  if (!result.hasBoothPrompt || !result.boothPromptVisible) {
    throw new Error('#booth-prompt is not visible when in range');
  }
  if (result.boothPromptPointerEvents === 'none' || !result.boothPromptIsTopmost) {
    throw new Error('#booth-prompt is not interactive (covered or pointer-events disabled)');
  }
  console.log('✓ Hub canvas visible, #lobby dismissed, booth prompt interactive');

  // Confirm deploy still works via the launch-booth ready-up test hook.
  await page.evaluate(() => window.__launchReadyUpForTest?.());
  await page.waitForFunction(() => {
    const ui = document.getElementById('ui');
    return ui && ui.style.display === 'block';
  }, { timeout: 15000 });
  console.log('✓ Launch-booth ready-up started the run');

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
