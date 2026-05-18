// Headless-browser verification capture for the autogame loop.
// Loads the running game, simulates a second player and WASD movement, and
// writes screenshots + a metrics/console probe into the given output dir.
//
//   node scripts/screenshot.mjs <outDir>
//
// Exit 0 if capture succeeded, 1 if the game failed to load, 2 on bad usage.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const outDir = process.argv[2];
if (!outDir) {
  console.error('usage: node scripts/screenshot.mjs <outDir>');
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

const URL = process.env.GAME_URL || 'http://localhost:5173';
const logs = [];
const wire = (page, tag) => {
  page.on('console', (m) => logs.push(`[${tag}:${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[${tag}:pageerror] ${e.message}`));
};

const browser = await chromium.launch();
let metrics = { url: URL, ok: false };

try {
  // Player A connects.
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageA = await ctxA.newPage();
  wire(pageA, 'A');
  await pageA.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await pageA.waitForTimeout(2500);
  await pageA.screenshot({ path: `${outDir}/01-initial.png` });

  // Player B connects — tests multiplayer visualization from A's view.
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageB = await ctxB.newPage();
  wire(pageB, 'B');
  await pageB.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await pageB.waitForTimeout(2500);
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
    bodyText: document.body.innerText.slice(0, 500),
  }));

  metrics = { url: URL, ok: true, status, ...dom };
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
