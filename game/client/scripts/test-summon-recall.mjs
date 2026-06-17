#!/usr/bin/env node
/**
 * Browser smoke test: Recall Whistle (summon_recall) key item.
 *
 * Equips the Recall Whistle, spawns two minions far from the player via the
 * `summon-recall` debug scenario, triggers recall in-browser, and verifies the
 * minions land near the player after `stateUpdate`. Screenshots the before/after
 * so the recall ring is visible (round-1 capture only managed lobby/movement
 * smoke and never exercised recall — see ticket 150).
 *
 * Requires client on :5173, server on :3000, playwright chromium.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loginInBrowser } from './session-auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'walkthroughs', 'summon-recall');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Keyboard key bound to useKeyItem by default (see client/input.js).
const USE_KEY_ITEM_KEY = 'e';

async function startSoloRun(page) {
	await page.evaluate(() => {
		document.getElementById('create-lobby-name').value = 'Recall Whistle QA';
		document.getElementById('create-lobby-btn')?.click();
	});
	await page.waitForFunction(() => {
		const lobby = document.getElementById('lobby');
		return lobby && !lobby.classList.contains('hidden');
	}, { timeout: 10000 });
	await page.evaluate(() => document.getElementById('ready-btn')?.click());
	await page.waitForFunction(() => {
		const ui = document.getElementById('ui');
		return ui && ui.style.display === 'block';
	}, { timeout: 15000 });

	const debugResult = await page.evaluate(async () => {
		if (typeof window.__requestDebugScenarioForTest !== 'function') {
			return { ok: false, reason: '__requestDebugScenarioForTest missing' };
		}
		return window.__requestDebugScenarioForTest('summon-recall');
	});
	if (!debugResult?.ok) {
		throw new Error(`summon-recall debug scenario failed: ${debugResult?.reason || 'unknown'}`);
	}

	await page.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__();
		const me = h?.player;
		return h?.phase === 'playing'
			&& me
			&& me.x != null
			&& h.minions.filter((m) => m.ownerId === h.myId).length >= 2;
	}, { timeout: 15000 });
}

async function readHarness(page) {
	return page.evaluate(() => window.__AUTOGAME_HARNESS_STATE__());
}

function minionDistances(state) {
	const me = state.player;
	return state.minions
		.filter((m) => m.ownerId === state.myId)
		.map((m) => Math.hypot(m.x - me.x, m.z - me.z));
}

async function screenshot(page, name) {
	fs.mkdirSync(OUT_DIR, { recursive: true });
	const file = path.join(OUT_DIR, `${name}.png`);
	await page.waitForTimeout(300);
	await page.screenshot({ path: file, fullPage: false });
	console.log(`screenshot: ${file}`);
	return file;
}

async function main() {
	const suffix = Date.now();

	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

	try {
		await loginInBrowser(page, CLIENT_URL, `summon-recall-${suffix}`);
		await startSoloRun(page);

		const before = await readHarness(page);
		const myMinionsBefore = before.minions.filter((m) => m.ownerId === before.myId);
		if (myMinionsBefore.length < 2) {
			throw new Error(`Expected >=2 owned minions from summon-recall scenario, got ${myMinionsBefore.length}`);
		}
		const distBefore = minionDistances(before);
		console.log('player:', before.player.x.toFixed(2), before.player.z.toFixed(2));
		console.log('minion distances before recall:', distBefore.map((d) => d.toFixed(2)));
		for (const d of distBefore) {
			if (d <= 5) {
				throw new Error(`Expected minions to start far (>5m) from the player; got ${d.toFixed(2)}m`);
			}
		}
		await screenshot(page, '01-before-recall');

		// Trigger the Recall Whistle in-browser via the bound key.
		await page.keyboard.press(USE_KEY_ITEM_KEY);

		// Wait for the recall stateUpdate to land every owned minion within the
		// ring + fallback range (<=5m, matching the server distance assertions).
		await page.waitForFunction(() => {
			const h = window.__AUTOGAME_HARNESS_STATE__();
			const me = h?.player;
			if (!me) return false;
			const mine = h.minions.filter((m) => m.ownerId === h.myId);
			if (mine.length < 2) return false;
			return mine.every((m) => Math.hypot(m.x - me.x, m.z - me.z) <= 5);
		}, { timeout: 10000 });

		const after = await readHarness(page);
		const distAfter = minionDistances(after);
		console.log('minion distances after recall:', distAfter.map((d) => d.toFixed(2)));
		await screenshot(page, '02-after-recall');

		for (const d of distAfter) {
			if (d < 1 || d > 5) {
				throw new Error(`Recalled minion out of expected band [1, 5]: ${d.toFixed(2)}m`);
			}
		}
		// Distinct radii expected from per-minion ring spread.
		const spread = Math.max(...distAfter) - Math.min(...distAfter);
		console.log('ring radius spread:', spread.toFixed(2));

		if (!after.sceneInitialized || !after.hasCanvas) {
			throw new Error('Expected Three.js scene/canvas to be active during recall');
		}

		console.log('PASS: Recall Whistle pulled both minions into the ring near the player');
	} finally {
		await browser.close();
	}
}

main().catch((err) => {
	console.error('FAIL:', err.message);
	process.exit(1);
});
