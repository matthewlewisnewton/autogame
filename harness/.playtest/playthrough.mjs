// Manual playtest: lobby → dungeon → basic combat probes
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const baseUrl = process.argv[2] || 'http://localhost:5273';
const outDir = join(import.meta.dirname, 'out');
mkdirSync(outDir, { recursive: true });

const log = [];
function note(msg) {
  log.push(`${new Date().toISOString()} ${msg}`);
  console.log(msg);
}

async function probe(page, label) {
  const data = await page.evaluate(() => {
    const hs = typeof window.__AUTOGAME_HARNESS_STATE__ === 'function'
      ? window.__AUTOGAME_HARNESS_STATE__()
      : null;
    const lobby = document.querySelector('#lobby');
    const status = document.querySelector('#status');
    const readyBtn = document.querySelector('#ready-btn');
    const runSummary = document.querySelector('#run-summary');
    const deckEditor = document.querySelector('#deck-editor');
    return {
      harnessState: hs,
      status: status?.innerText ?? null,
      title: document.title,
      lobbyVisible: !!lobby && !lobby.classList.contains('hidden'),
      readyBtnVisible: !!readyBtn && readyBtn.offsetParent !== null,
      readyBtnText: readyBtn?.innerText ?? null,
      runSummaryVisible: !!runSummary && !runSummary.classList.contains('hidden'),
      deckEditorVisible: !!deckEditor && !deckEditor.classList.contains('hidden'),
      bodySnippet: document.body.innerText.slice(0, 1200),
    };
  });
  note(`[${label}] ${JSON.stringify(data, null, 0).slice(0, 500)}`);
  return data;
}

async function waitPhase(page, phase, timeoutMs = 15000) {
  await page.waitForFunction(
    (p) => {
      const hs = typeof window.__AUTOGAME_HARNESS_STATE__ === 'function'
        ? window.__AUTOGAME_HARNESS_STATE__()
        : null;
      return hs && hs.phase === p;
    },
    phase,
    { timeout: timeoutMs }
  );
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

page.on('console', (m) => {
  const t = m.text();
  if (!/GL Driver|GPU stall|THREE\.WebGLRenderer/i.test(t)) log.push(`[console:${m.type()}] ${t}`);
});
page.on('pageerror', (e) => log.push(`[pageerror] ${e.message}`));

const report = { baseUrl, steps: [], stuck: null, functional: false };

try {
  note('Loading game...');
  await page.goto(baseUrl, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(outDir, '01-load.png') });
  const loadProbe = await probe(page, 'after-load');
  report.steps.push({ step: 'load', ok: !!loadProbe.harnessState?.hasCanvas, probe: loadProbe });

  if (!loadProbe.harnessState) {
    report.stuck = 'Harness state missing — client may not have connected';
    throw new Error(report.stuck);
  }

  if (loadProbe.lobbyVisible) {
    note('In lobby — clicking Ready');
    const ready = page.locator('#ready-btn').first();
    if (await ready.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ready.click();
      await page.waitForTimeout(800);
    } else {
      report.stuck = 'Lobby visible but #ready-btn not found';
      throw new Error(report.stuck);
    }
    await page.screenshot({ path: join(outDir, '02-lobby-ready.png') });
    await probe(page, 'after-ready-click');
  }

  note('Waiting for playing phase...');
  await waitPhase(page, 'playing', 20000);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(outDir, '03-playing.png') });
  const playProbe = await probe(page, 'playing');
  report.steps.push({ step: 'playing', ok: true, probe: playProbe });

  note('Moving (WASD) and using card slot 1...');
  await page.keyboard.down('w');
  await page.waitForTimeout(800);
  await page.keyboard.up('w');
  await page.keyboard.down('d');
  await page.waitForTimeout(600);
  await page.keyboard.up('d');
  await page.keyboard.press('1');
  await page.waitForTimeout(1200);
  await page.keyboard.press('2');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(outDir, '04-combat.png') });

  const combatProbe = await page.evaluate(() => {
    const hs = window.__AUTOGAME_HARNESS_STATE__?.() ?? null;
    return {
      phase: hs?.phase,
      playerHp: hs?.playerHp,
      enemyCount: hs?.enemyCount,
      hand: hs?.hand,
      runObjectives: hs?.runObjectives,
    };
  });
  note(`Combat state: ${JSON.stringify(combatProbe)}`);
  report.steps.push({ step: 'combat', ok: combatProbe.phase === 'playing', combatProbe });

  // Try to progress ~30s more (kill enemies / explore)
  for (let i = 0; i < 6; i++) {
    await page.keyboard.down('w');
    await page.waitForTimeout(400);
    await page.keyboard.up('w');
    await page.keyboard.press(String((i % 4) + 1));
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(outDir, '05-progress.png') });

  const lateProbe = await page.evaluate(() => {
    const hs = window.__AUTOGAME_HARNESS_STATE__?.() ?? null;
    const runSummary = document.querySelector('#run-summary');
    return {
      phase: hs?.phase,
      playerHp: hs?.playerHp,
      enemyCount: hs?.enemyCount,
      runSummaryVisible: !!runSummary && !runSummary.classList.contains('hidden'),
      objectives: hs?.runObjectives,
    };
  });
  note(`Late state: ${JSON.stringify(lateProbe)}`);
  report.steps.push({ step: 'progress', probe: lateProbe });

  report.functional = true;
  note('Playthrough completed without hard blockers.');
} catch (e) {
  report.stuck = report.stuck || e.message;
  note(`STUCK: ${e.message}`);
  await page.screenshot({ path: join(outDir, 'error.png') }).catch(() => {});
  await probe(page, 'error').catch(() => {});
} finally {
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(outDir, 'log.txt'), log.join('\n'));
  await browser.close();
}

process.exit(report.functional ? 0 : 1);
