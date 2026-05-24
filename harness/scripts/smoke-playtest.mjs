#!/usr/bin/env node
/**
 * Live smoke test for movement direction and wall blocking.
 * Usage: node scripts/smoke-playtest.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const BASE_URL = process.argv[2] || 'http://localhost:5173/?debugScenario=summon-ready';
const USER = `smoke_${Date.now()}`;
const PASS = 'test123';
const RAM_HOLD_MS = 2200;
const RAM_SAMPLE_MS = 50;

function dist(a, b) {
	return Math.hypot(b.x - a.x, b.z - a.z);
}

function dot(a, b) {
	return a.x * b.x + a.z * b.z;
}

async function harnessState(page) {
	return page.evaluate(() => {
		if (typeof window.__AUTOGAME_HARNESS_STATE__ !== 'function') return null;
		return window.__AUTOGAME_HARNESS_STATE__();
	});
}

async function registerAndLogin(page) {
	await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30000 });
	await page.waitForTimeout(800);

	const authHidden = await page.locator('#auth-overlay.hidden').isVisible().catch(() => false);
	if (authHidden) return;

	await page.locator('#register-username').waitFor({ state: 'visible', timeout: 10000 });
	await page.locator('#register-username').fill(USER);
	await page.locator('#register-password').fill(PASS);
	await page.locator('#register-btn').click();
	await page.waitForTimeout(500);

	await page.locator('#login-username').waitFor({ state: 'visible', timeout: 5000 });
	await page.locator('#login-username').fill(USER);
	await page.locator('#login-password').fill(PASS);
	await page.locator('#login-btn').click();

	await page.waitForFunction(() => {
		const authOverlay = document.querySelector('#auth-overlay');
		if (authOverlay && authOverlay.classList.contains('hidden')) return true;
		const status = document.querySelector('#status');
		return status && /Connected|Logged in|Latency/i.test(status.innerText);
	}, null, { timeout: 20000 });
}

async function waitForPlaying(page) {
	await page.waitForFunction(() => {
		const state = typeof window.__AUTOGAME_HARNESS_STATE__ === 'function'
			? window.__AUTOGAME_HARNESS_STATE__()
			: null;
		return state
			&& state.phase === 'playing'
			&& state.sceneInitialized
			&& state.hasCanvas
			&& state.player;
	}, null, { timeout: 20000 });
	await page.waitForTimeout(300);
}

async function focusGame(page) {
	await page.locator('canvas').first().click({ timeout: 5000 }).catch(() => {});
	await page.waitForTimeout(80);
}

async function ramInBrowser(page, key, holdMs, intervalMs) {
	return page.evaluate(async ({ key: ramKey, holdMs: hold, intervalMs: interval }) => {
		const code = `Key${ramKey.toUpperCase()}`;
		window.dispatchEvent(new KeyboardEvent('keydown', { key: ramKey, code, bubbles: true }));
		const samples = [];
		const t0 = performance.now();
		while (performance.now() - t0 < hold) {
			await new Promise((resolve) => setTimeout(resolve, interval));
			const st = window.__AUTOGAME_HARNESS_STATE__?.();
			if (st?.player) samples.push({ x: st.player.x, z: st.player.z, hp: st.player.hp });
		}
		window.dispatchEvent(new KeyboardEvent('keyup', { key: ramKey, code, bubbles: true }));
		return samples;
	}, { key, holdMs, intervalMs });
}

async function holdKeyInBrowser(page, key, ms) {
	await page.evaluate(async ({ key: holdKey, ms: holdMs }) => {
		const code = `Key${holdKey.toUpperCase()}`;
		window.dispatchEvent(new KeyboardEvent('keydown', { key: holdKey, code, bubbles: true }));
		await new Promise((resolve) => setTimeout(resolve, holdMs));
		window.dispatchEvent(new KeyboardEvent('keyup', { key: holdKey, code, bubbles: true }));
	}, { key, ms });
}

function analyzeWallRam(samples) {
	if (samples.length < 8) return { ok: false, detail: `too few samples (${samples.length})` };
	const half = Math.floor(samples.length / 2);
	const firstHalfMove = dist(samples[0], samples[half]);
	const secondHalfMove = dist(samples[half], samples.at(-1));
	const total = dist(samples[0], samples.at(-1));
	const slowed = secondHalfMove < firstHalfMove * 0.2;
	const ok = total > 0.4 && firstHalfMove > 0.2 && slowed;
	return {
		ok,
		detail: `first ${firstHalfMove.toFixed(2)} second ${secondHalfMove.toFixed(2)} total ${total.toFixed(2)} n=${samples.length}`,
	};
}

function isIgnorableError(message) {
	return /favicon|404|THREE\.Clock.*deprecated/i.test(message);
}

async function main() {
	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
	const errors = [];
	page.on('pageerror', (err) => errors.push(String(err)));
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push(msg.text());
	});

	const results = [];

	try {
		await registerAndLogin(page);
		await waitForPlaying(page);
		await focusGame(page);

		const start = (await harnessState(page)).player;
		results.push({
			check: 'entered gameplay alive',
			ok: start && start.hp > 0,
			detail: `spawn (${start.x.toFixed(2)}, ${start.z.toFixed(2)}) hp ${start.hp}`,
		});

		// Fast wall rams in all directions — run immediately before enemies engage
		const ramResults = [];
		for (const key of ['w', 'd', 's', 'a']) {
			const samples = await ramInBrowser(page, key, RAM_HOLD_MS, RAM_SAMPLE_MS);
			const analysis = analyzeWallRam(samples);
			ramResults.push({ key, ...analysis });
		}
		const blockedCount = ramResults.filter((r) => r.ok).length;
		results.push({
			check: 'wall collision blocks movement',
			ok: blockedCount >= 2,
			detail: ramResults.map((r) => `${r.key}:${r.ok ? 'blocked' : 'open'} (${r.detail})`).join('; '),
		});

		const afterRam = (await harnessState(page)).player;
		results.push({
			check: 'still alive after wall rams',
			ok: afterRam && afterRam.hp > 0 && !afterRam.dead,
			detail: afterRam ? `hp ${afterRam.hp} at (${afterRam.x.toFixed(2)}, ${afterRam.z.toFixed(2)})` : 'no player',
		});

		// W/S direction — short bursts from current position
		const beforeW = afterRam;
		await holdKeyInBrowser(page, 'w', 600);
		const afterW = (await harnessState(page)).player;
		const deltaW = { x: afterW.x - beforeW.x, z: afterW.z - beforeW.z };
		const movedW = dist(beforeW, afterW);
		results.push({ check: 'W moves player', ok: movedW > 0.2, detail: `delta (${deltaW.x.toFixed(2)}, ${deltaW.z.toFixed(2)}), dist ${movedW.toFixed(2)}` });

		await holdKeyInBrowser(page, 's', 600);
		const afterS = (await harnessState(page)).player;
		const deltaS = { x: afterS.x - afterW.x, z: afterS.z - afterW.z };
		const movedS = dist(afterW, afterS);
		const opposite = dot(deltaW, deltaS) < -0.05;
		results.push({ check: 'S reverses W direction', ok: movedS > 0.2 && opposite, detail: `W·S=${dot(deltaW, deltaS).toFixed(2)}, dist ${movedS.toFixed(2)}` });

		const noErrors = errors.filter((e) => !isIgnorableError(e)).length === 0;
		results.push({ check: 'no page errors', ok: noErrors, detail: errors.filter((e) => !isIgnorableError(e)).slice(0, 3).join(' | ') || 'clean' });

		const failed = results.filter((r) => !r.ok);
		console.log('\n=== Game smoke test ===');
		console.log(`URL: ${BASE_URL}`);
		for (const r of results) {
			console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.check} — ${r.detail}`);
		}
		console.log(failed.length ? `\n${failed.length} check(s) failed` : '\nAll checks passed');
		process.exitCode = failed.length ? 1 : 0;
	} catch (err) {
		console.error('Smoke test crashed:', err);
		process.exitCode = 1;
	} finally {
		await browser.close();
	}
}

main();
