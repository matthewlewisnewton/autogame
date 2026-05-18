// Headless-browser capture for the autogame harness.
// Loads the running game, connects a second player, simulates WASD movement,
// and writes screenshots + a metrics/console probe into <outDir>.
//
//   node harness/screenshot.mjs <url> <outDir>
//
// Exit 0 if capture succeeded, 1 if the game failed to load, 2 on bad usage.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const url = process.argv[2] || 'http://localhost:5173';
const outDir = process.argv[3];
if (!outDir) {
  console.error('usage: node harness/screenshot.mjs <url> <outDir>');
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

const logs = [];
// Benign headless-Chromium rendering noise — not game bugs. Filtered out so the
// QA agent only sees real signal.
const NOISE = /GL Driver Message|GPU stall|ReadPixels|fallback to software WebGL|Automatic fallback|CONTEXT_LOST_WEBGL|Context (Lost|Restored)|THREE\.WebGLRenderer|THREE\.Clock|deprecat/i;
const wire = (page, tag) => {
  page.on('console', (m) => {
    const t = m.text();
    if (!NOISE.test(t)) logs.push(`[${tag}:${m.type()}] ${t}`);
  });
  page.on('pageerror', (e) => logs.push(`[${tag}:pageerror] ${e.message}`));
};

const browser = await chromium.launch();
let metrics = { url, ok: false };

try {
  // Player A connects.
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageA = await ctxA.newPage();
  wire(pageA, 'A');
  await pageA.goto(url, { waitUntil: 'load', timeout: 30000 });
  await pageA.waitForTimeout(2500);
  await pageA.screenshot({ path: `${outDir}/01-initial.png` });

  // Player B connects — exercises multiplayer visualization from A's view.
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageB = await ctxB.newPage();
  wire(pageB, 'B');
  await pageB.goto(url, { waitUntil: 'load', timeout: 30000 });
  await pageB.waitForTimeout(2500);

  // Ready up — click through the lobby so the actual game (3D canvas) mounts.
  // Without this the capture never leaves the lobby screen and visual QA can
  // only ever see the lobby. Defensive: if there is no lobby (server already
  // in 'playing' phase, or no ready button), each step is a tolerated no-op.
  const readyUp = async (page) => {
    const btn = page.locator('#ready-btn');
    if ((await btn.count()) && (await btn.isVisible().catch(() => false))) {
      await btn.click().catch(() => {});
    }
  };
  await readyUp(pageA);
  await readyUp(pageB);
  // Wait for the game scene to start (lobby hidden / 3D canvas mounted).
  await pageA.waitForSelector('canvas', { timeout: 15000 }).catch(() => {});
  await pageA.waitForTimeout(2000);
  await pageA.screenshot({ path: `${outDir}/02-two-players.png` });

  // Movement on player A.
  await pageA.bringToFront();
  await pageA.keyboard.down('w');
  await pageA.waitForTimeout(1500);
  await pageA.keyboard.up('w');
  await pageA.waitForTimeout(500);
  await pageA.screenshot({ path: `${outDir}/03-after-w.png` });

  await pageA.keyboard.down('d');
  await pageA.waitForTimeout(1500);
  await pageA.keyboard.up('d');
  await pageA.waitForTimeout(500);
  await pageA.screenshot({ path: `${outDir}/04-after-d.png` });

  const status = await pageA
    .locator('#status')
    .first()
    .innerText()
    .catch(() => '(no #status element)');
  const dom = await pageA.evaluate(() => ({
    hasCanvas: !!document.querySelector('canvas'),
    canvasCount: document.querySelectorAll('canvas').length,
    title: document.title,
    bodyText: document.body.innerText.slice(0, 600),
  }));

  metrics = { url, ok: true, status, ...dom };
} catch (e) {
  logs.push(`[fatal] ${e.message}`);
  metrics.error = e.message;
} finally {
  writeFileSync(`${outDir}/console.log`, logs.join('\n') + '\n');
  writeFileSync(`${outDir}/metrics.json`, JSON.stringify(metrics, null, 2));
  await browser.close();
}

console.log(JSON.stringify(metrics, null, 2));
process.exit(metrics.ok ? 0 : 1);
