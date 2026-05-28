#!/usr/bin/env node
/**
 * Reproduce / verify P0 bugs: deck HUD undefined counts, V-key deck viewer toggle,
 * account settings persistence after login.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'walkthroughs', 'p0-bugs');
const PHASE = process.env.PHASE || 'before'; // 'before' | 'after'

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

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

async function startSoloRun(page) {
	await page.evaluate(() => {
		document.getElementById('create-lobby-name').value = 'P0 Test';
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
	await page.waitForFunction(() => {
		const text = document.getElementById('deck-count')?.textContent || '';
		return /Deck: [1-9]/.test(text);
	}, { timeout: 10000 });
}

async function screenshot(page, name) {
	fs.mkdirSync(OUT_DIR, { recursive: true });
	const file = path.join(OUT_DIR, `${PHASE}-${name}.png`);
	await page.screenshot({ path: file, fullPage: false });
	console.log(`screenshot: ${file}`);
	return file;
}

async function main() {
	const suffix = Date.now();
	const token = await register(`p0-test-${suffix}`);

	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage();
	await loginWithToken(page, token);
	await startSoloRun(page);

	// Bug 1: deck HUD type counts
	const deckStats = await page.evaluate(() => ({
		weapon: document.getElementById('deck-weapon-count')?.textContent,
		summon: document.getElementById('deck-summon-count')?.textContent,
		monster: document.getElementById('deck-monster-count')?.textContent,
		spell: document.getElementById('deck-spell-count')?.textContent,
		creature: document.getElementById('deck-creature-count')?.textContent,
		enchantment: document.getElementById('deck-enchantment-count')?.textContent,
		deckCount: document.getElementById('deck-count')?.textContent,
	}));
	console.log('deck HUD stats:', JSON.stringify(deckStats));
	await screenshot(page, 'deck-hud');

	const hasUndefinedCounts = deckStats.summon === 'undefined' || deckStats.monster === 'undefined';
	if (PHASE === 'before') {
		if (!hasUndefinedCounts) console.warn('WARN: expected undefined summon/monster counts before fix');
	} else {
		if (hasUndefinedCounts) throw new Error('Deck HUD still shows undefined after fix');
		if (PHASE === 'after' && (deckStats.spell === 'undefined' || deckStats.creature === 'undefined')) {
			throw new Error('Deck HUD spell/creature counts still undefined after fix');
		}
	}

	// Bug 2: V key deck viewer toggle
	const overlayHiddenBefore = await page.evaluate(() =>
		document.getElementById('deck-viewer-overlay')?.classList.contains('hidden'));
	await page.keyboard.press('v');
	await page.waitForTimeout(300);
	const overlayHiddenAfterV = await page.evaluate(() =>
		document.getElementById('deck-viewer-overlay')?.classList.contains('hidden'));
	await screenshot(page, 'deck-viewer-after-v');
	console.log('deck viewer: hidden before V =', overlayHiddenBefore, ', after V =', overlayHiddenAfterV);

	if (PHASE === 'before') {
		if (overlayHiddenBefore === overlayHiddenAfterV) {
			console.log('CONFIRMED: V key does not toggle deck viewer (double-handler bug)');
		} else {
			console.warn('WARN: deck viewer toggled — bug may not reproduce');
		}
	} else {
		if (overlayHiddenBefore !== overlayHiddenAfterV) {
			console.log('FIXED: V key toggles deck viewer');
		} else {
			throw new Error('V key still does not toggle deck viewer after fix');
		}
	}

	// Bug 3: settings persistence — patch lock-on via client API then verify server
	await page.evaluate(async () => {
		const token = localStorage.getItem('autogame_token');
		await fetch('/api/me/settings', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ lockOnRepeatAction: 'cycle' }),
		});
	});
	await page.reload();
	await page.waitForFunction(() => {
		const browserEl = document.getElementById('lobby-browser');
		return browserEl && !browserEl.classList.contains('hidden');
	}, { timeout: 15000 });

	const settingsLoaded = await page.evaluate(() => {
		// settings module state is not exposed; read from settings UI if present
		const sel = document.getElementById('lock-on-repeat-select');
		return sel ? sel.value : null;
	});

	// Also verify via direct API (server truth)
	const meRes = await fetch(`${SERVER_URL}/api/me`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	const me = await meRes.json();
	console.log('server lockOnRepeatAction:', me.settings?.lockOnRepeatAction);
	console.log('client settings UI value:', settingsLoaded);

	if (PHASE === 'before') {
		// Before fix: reload won't call loadAccountSettings, UI stays at default 'unlock'
		if (settingsLoaded !== 'cycle' && me.settings?.lockOnRepeatAction === 'cycle') {
			console.log('CONFIRMED: server has cycle but client UI shows default after reload (settings not wired)');
		}
	} else {
		await page.goto(CLIENT_URL);
		await page.evaluate((t) => localStorage.setItem('autogame_token', t), token);
		await page.reload();
		await page.waitForFunction(() => {
			const browserEl = document.getElementById('lobby-browser');
			return browserEl && !browserEl.classList.contains('hidden');
		}, { timeout: 15000 });
		const uiAfterReload = await page.evaluate(() =>
			document.getElementById('lock-on-repeat-select')?.value);
		if (uiAfterReload !== 'cycle') {
			throw new Error(`Settings not loaded after reload: expected cycle, got ${uiAfterReload}`);
		}
		console.log('FIXED: account settings loaded after token restore');
	}

	await browser.close();
	console.log(`P0 verification (${PHASE}) complete`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
