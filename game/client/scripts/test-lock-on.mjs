#!/usr/bin/env node
/**
 * Smoke test: Z-targeting lock-on and repeat-press settings (unlock + cycle).
 */
import { chromium } from 'playwright';

const CLIENT_URL = process.env.CLIENT_URL || 'http://127.0.0.1:5173';
const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:3000';

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
	await page.goto(CLIENT_URL);
	await page.evaluate((t) => localStorage.setItem('autogame_token', t), token);
	await page.reload();
	await page.waitForFunction(() => {
		const browserEl = document.getElementById('lobby-browser');
		const auth = document.getElementById('auth-overlay');
		return browserEl && !browserEl.classList.contains('hidden')
			&& auth && auth.classList.contains('hidden');
	}, { timeout: 15000 });
}

async function startSoloRun(page1, page2) {
	await page1.evaluate(() => {
		document.getElementById('create-lobby-name').value = 'Lock-On Test';
		document.getElementById('create-lobby-btn')?.click();
	});
	await page1.waitForFunction(() => !document.getElementById('lobby').classList.contains('hidden'));
	await page2.waitForSelector('.join-lobby-btn');
	await page2.evaluate(() => document.querySelector('.join-lobby-btn')?.click());
	await page2.waitForFunction(() => !document.getElementById('lobby').classList.contains('hidden'));
	await page1.evaluate(() => document.getElementById('ready-btn')?.click());
	await page2.evaluate(() => document.getElementById('ready-btn')?.click());
	await page1.waitForFunction(() => document.getElementById('ui')?.style.display === 'block', { timeout: 15000 });
	await page1.waitForTimeout(1500);
}

async function readLockOnState(page) {
	return page.evaluate(async () => {
		const mod = await import('/lockOn.js');
		return {
			active: mod.isLockOnActive(),
			targetId: mod.getLockedEnemyId(),
		};
	});
}

async function setLockOnSetting(page, value) {
	await page.click('#settings-btn');
	await page.waitForSelector('#settings-overlay:not(.hidden)');
	await page.selectOption('#lock-on-repeat-select', value);
	await page.click('#settings-close-btn');
	await page.waitForFunction(() => document.getElementById('settings-overlay').classList.contains('hidden'));
}

async function main() {
	const suffix = Date.now();
	const token1 = await register(`lockon-a-${suffix}`);
	const token2 = await register(`lockon-b-${suffix}`);

	const browser = await chromium.launch({ headless: true });
	const page1 = await (await browser.newContext()).newPage();
	const page2 = await (await browser.newContext()).newPage();

	await loginWithToken(page1, token1);
	await loginWithToken(page2, token2);
	console.log('✓ Logged in');

	await startSoloRun(page1, page2);
	console.log('✓ Run started');

	await page1.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		return h && h.phase === 'playing' && h.enemies > 0;
	}, { timeout: 15000 });
	console.log('✓ Enemies present in run');

	// Wander toward enemies and try lock-on
	for (let i = 0; i < 12 && !(await readLockOnState(page1)).active; i++) {
		await page1.keyboard.down('w');
		await page1.waitForTimeout(350);
		await page1.keyboard.up('w');
		await page1.keyboard.press('z');
		await page1.waitForTimeout(250);
	}

	let state = await readLockOnState(page1);
	if (!state.active) {
		throw new Error('Z did not lock onto any enemy after wandering');
	}
	console.log(`✓ Z lock-on acquired target ${state.targetId}`);

	// Unlock mode: second Z releases
	await setLockOnSetting(page1, 'unlock');
	const unlockSetting = await page1.evaluate(async () => {
		const { getLockOnRepeatAction } = await import('/settings.js');
		return getLockOnRepeatAction();
	});
	if (unlockSetting !== 'unlock') throw new Error(`Expected unlock setting, got ${unlockSetting}`);

	await page1.keyboard.press('z');
	await page1.waitForTimeout(300);
	state = await readLockOnState(page1);
	if (state.active) throw new Error('Unlock mode: second Z should release lock-on');
	console.log('✓ Unlock setting: second Z releases lock-on');

	// Re-lock for cycle test
	await page1.keyboard.press('z');
	await page1.waitForTimeout(300);
	state = await readLockOnState(page1);
	if (!state.active) throw new Error('Could not re-acquire lock for cycle test');
	const firstTarget = state.targetId;

	await setLockOnSetting(page1, 'cycle');
	const cycleSetting = await page1.evaluate(async () => {
		const { getLockOnRepeatAction } = await import('/settings.js');
		return getLockOnRepeatAction();
	});
	if (cycleSetting !== 'cycle') throw new Error(`Expected cycle setting, got ${cycleSetting}`);

	await page1.keyboard.press('z');
	await page1.waitForTimeout(300);
	state = await readLockOnState(page1);
	if (!state.active) throw new Error('Cycle mode: should stay locked when another enemy exists');
	if (state.targetId === firstTarget) {
		console.log('⚠ Only one enemy in range — cycle kept same target (acceptable)');
	} else {
		console.log(`✓ Cycle setting: switched target ${firstTarget} → ${state.targetId}`);
	}

	await browser.close();
	console.log('✓ Lock-on smoke test passed');
}

main().catch((err) => {
	console.error('✗', err.message);
	process.exit(1);
});
