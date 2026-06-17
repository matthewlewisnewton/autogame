/**
 * Two-player lobby helpers for hub validation playthroughs.
 */
import { loginInBrowser, isSocketConnected } from './auth.mjs';
import { readHarness } from './harnessState.mjs';

export { loginInBrowser, isSocketConnected };

/** Hub zone room centres — must match generateHub() with HUB_CELL_SPACING = 20. */
export const HUB_ZONE_CENTERS = {
	operations: { x: -20, z: 0 },
	commerce: { x: 0, z: 0 },
	salon: { x: 20, z: 0 },
};

export async function waitForLobbyBrowser(page) {
	await page.waitForFunction(() => {
		const el = document.querySelector('#lobby-browser');
		return el && !el.classList.contains('hidden')
			&& window.getComputedStyle(el).display !== 'none';
	}, { timeout: 15000 }).catch(async () => {
		const state = await page.evaluate(() => ({
			lobbyBrowserHidden: document.querySelector('#lobby-browser')?.classList.contains('hidden'),
			authHidden: document.querySelector('#auth-overlay')?.classList.contains('hidden'),
			statusText: document.querySelector('#status')?.innerText,
		}));
		throw new Error(`#lobby-browser not visible: ${JSON.stringify(state)}`);
	});
}

/** Post-304 hub-ready contract — matches game/client/scripts/test-hub-lobby-visible.mjs. */
function hubLobbyReadyCheck() {
	const h = window.__AUTOGAME_HARNESS_STATE__?.();
	const lobby = document.getElementById('lobby');
	return h
		&& h.phase === 'lobby'
		&& h.hasCanvas === true
		&& h.lobbyMenuDismissed === true
		&& h.layout?.profile === 'hub'
		&& h.layout?.roomCount === 3
		&& lobby
		&& lobby.classList.contains('hidden');
}

export async function waitForHubLobby(page) {
	await page.waitForFunction(hubLobbyReadyCheck, { timeout: 20000 }).catch(async () => {
		const harness = await readHarness(page);
		const lobbyHidden = await page.evaluate(() => document.getElementById('lobby')?.classList.contains('hidden'));
		throw new Error(`Ship hub lobby not ready: ${JSON.stringify({ ...harness, lobbyHidden })}`);
	});
}

export async function createLobby(page, lobbyName) {
	await page.evaluate((name) => {
		const nameEl = document.getElementById('create-lobby-name');
		if (nameEl) nameEl.value = name;
		document.getElementById('create-lobby-btn')?.click();
	}, lobbyName);

	await page.waitForFunction(hubLobbyReadyCheck, { timeout: 15000 }).catch(async () => {
		const harness = await readHarness(page);
		const lobbyHidden = await page.evaluate(() => document.getElementById('lobby')?.classList.contains('hidden'));
		throw new Error(`Hub not ready after create channel: ${JSON.stringify({ ...harness, lobbyHidden })}`);
	});
}

export async function joinLobby(page, lobbyName) {
	await page.evaluate(() => document.getElementById('refresh-lobbies-btn')?.click());
	await page.waitForFunction((name) => {
		const items = [...document.querySelectorAll('.lobby-list-item')];
		return items.some((li) =>
			li.textContent.includes(name)
			&& li.querySelector('.join-lobby-btn[data-join-mode="join"]'));
	}, lobbyName, { timeout: 15000 });
	await page.evaluate((name) => {
		const items = [...document.querySelectorAll('.lobby-list-item')];
		const item = items.find((li) => li.textContent.includes(name));
		item?.querySelector('.join-lobby-btn[data-join-mode="join"]')?.click();
	}, lobbyName);

	await page.waitForFunction(hubLobbyReadyCheck, { timeout: 15000 }).catch(async () => {
		const harness = await readHarness(page);
		const lobbyHidden = await page.evaluate(() => document.getElementById('lobby')?.classList.contains('hidden'));
		throw new Error(`Hub not ready after join: ${JSON.stringify({ ...harness, lobbyHidden })}`);
	});
}

export async function dismissLobbyOverlay(page) {
	await page.addStyleTag({
		content: '#lobby { display: none !important; }',
	});
	await page.waitForFunction(() => {
		const el = document.getElementById('lobby');
		return el && window.getComputedStyle(el).display === 'none';
	}, { timeout: 5000 }).catch(async () => {
		const state = await page.evaluate(() => {
			const el = document.getElementById('lobby');
			return {
				exists: !!el,
				display: el ? window.getComputedStyle(el).display : null,
			};
		});
		throw new Error(`#lobby overlay did not hide within 5 s: ${JSON.stringify(state)}`);
	});
}
