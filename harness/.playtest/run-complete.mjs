// Aggressive playtest: try to finish defeat_enemies objective
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const baseUrl = process.argv[2] || 'http://localhost:5273';
const outDir = join(import.meta.dirname, 'out');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(baseUrl, { waitUntil: 'load' });
await page.waitForTimeout(1500);
const ready = page.locator('#ready-btn');
if (await ready.isVisible().catch(() => false)) {
  await ready.click();
} else {
  console.log('Skipping ready — lobby not visible (may already be in run)');
}
await page.waitForFunction(() => window.__AUTOGAME_HARNESS_STATE__?.().phase === 'playing', null, { timeout: 25000 });
await page.waitForTimeout(1500);

const timeline = [];
for (let i = 0; i < 90; i++) {
  const snap = await page.evaluate(() => {
    const hs = window.__AUTOGAME_HARNESS_STATE__?.();
    const obj = document.getElementById('objective-hud')?.innerText ?? '';
    const rs = document.querySelector('#run-summary');
    return {
      phase: hs?.phase,
      enemies: hs?.enemies,
      hp: hs?.player?.hp,
      dead: hs?.player?.dead,
      objectiveHud: obj,
      runSummaryVisible: !!rs && !rs.classList.contains('hidden'),
    };
  }).catch(() => ({}));
  timeline.push(snap);

  if (snap.runSummaryVisible || snap.phase === 'lobby') break;

  await page.keyboard.down('w');
  await page.waitForTimeout(200);
  await page.keyboard.up('w');
  for (const k of ['1', '2', '3', '4']) {
    await page.keyboard.press(k);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(400);
}

await page.screenshot({ path: join(outDir, 'run-end.png') });
writeFileSync(join(outDir, 'timeline.json'), JSON.stringify(timeline, null, 2));
console.log('Final:', JSON.stringify(timeline.at(-1), null, 2));
await browser.close();
