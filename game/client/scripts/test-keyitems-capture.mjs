#!/usr/bin/env node
/**
 * Browser smoke test: open the lobby Key Items tab and confirm an equipped row.
 *
 * Logs in via the API, creates/enters a lobby, activates the Key Items tab,
 * asserts `#key-item-loadout` is visible, `#lobby-tab-keyitems` is active, and
 * `#key-item-list` contains at least one `.key-item-entry.equipped` row (the
 * default loadout equips `dodge_roll`). Saves a PNG of the panel for QA.
 *
 * Requires client on :5173, server on :3000, playwright chromium.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'walkthroughs', 'keyitems-capture');

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

async function loginWithToken(page, token) {
	page.on('console', (msg) => {
		if (msg.type() === 'error') console.log('[browser]', msg.text());
	});
	await page.goto(CLIENT_URL);
	await page.evaluate((t) => localStorage.setItem('autogame_token', t), token);
	await page.reload();
	await page.waitForFunction(() => {
		const browserEl = document.getElementById('lobby-browser');
		const auth = document.getElementById('auth-overlay');
		return browserEl && !browserEl.classList.contains('hidden')
			&& auth && auth.classList.contains('hidden');
	}, { timeout: 15000 }).catch(async () => {
		const state = await page.evaluate(() => ({
			lobbyHidden: document.getElementById('lobby-browser')?.classList.contains('hidden'),
			authHidden: document.getElementById('auth-overlay')?.classList.contains('hidden'),
			authError: document.getElementById('login-error')?.textContent,
		}));
		throw new Error(`Login UI not ready: ${JSON.stringify(state)}`);
	});
}

async function main() {
	const suffix = Date.now();
	const token = await register(`keyitems-${suffix}`);

	const browser = await chromium.launch({ headless: true });
	const ctx = await browser.newContext();
	const page = await ctx.newPage();

	await loginWithToken(page, token);
	console.log('✓ Logged in and lobby browser visible');

	// Create + enter a lobby.
	await page.evaluate(() => {
		const name = document.getElementById('create-lobby-name');
		if (name) name.value = 'Key Items QA';
		document.getElementById('create-lobby-btn')?.click();
	});
	await page.waitForFunction(() => {
		const lobby = document.getElementById('lobby');
		return lobby && !lobby.classList.contains('hidden');
	}, { timeout: 10000 });
	console.log('✓ Lobby created and entered');

	// Activate the Key Items tab (exposed at main.js setLobbyTab).
	await page.evaluate(() => window.setLobbyTab('keyitems'));

	// Wait for the panel to be visible, the tab active, and an equipped row rendered.
	await page.waitForFunction(() => {
		const loadout = document.getElementById('key-item-loadout');
		const tabBtn = document.getElementById('lobby-tab-keyitems');
		const equipped = document.querySelector('#key-item-list .key-item-entry.equipped');
		return loadout && !loadout.classList.contains('hidden')
			&& tabBtn && tabBtn.classList.contains('active')
			&& !!equipped;
	}, { timeout: 15000 }).catch(async () => {
		const state = await page.evaluate(() => ({
			loadoutHidden: document.getElementById('key-item-loadout')?.classList.contains('hidden'),
			tabActive: document.getElementById('lobby-tab-keyitems')?.classList.contains('active'),
			entryCount: document.querySelectorAll('#key-item-list .key-item-entry').length,
			equippedCount: document.querySelectorAll('#key-item-list .key-item-entry.equipped').length,
		}));
		throw new Error(`Key Items panel not ready / no equipped row: ${JSON.stringify(state)}`);
	});
	console.log('✓ Key Items tab active, loadout visible, equipped row present');

	// Save a screenshot of the Key Items panel for QA.
	fs.mkdirSync(OUT_DIR, { recursive: true });
	const file = path.join(OUT_DIR, 'key-items-loadout.png');
	const loadoutEl = await page.$('#key-item-loadout');
	if (loadoutEl) {
		await loadoutEl.screenshot({ path: file });
	} else {
		await page.screenshot({ path: file, fullPage: false });
	}
	console.log(`screenshot: ${file}`);

	await browser.close();
	console.log('✓ Key Items capture smoke test passed');
}

main().catch((err) => {
	console.error('✗', err.message);
	process.exit(1);
});
