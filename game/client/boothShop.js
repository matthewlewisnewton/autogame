// ── Hub Shop Booth — open the card shop via booth:action ──
// Keeps shop open logic unit-testable without importing all of main.js.

import { BOOTH_ACTION_EVENT } from './boothPrompt.js';

const DEBUG_BOOTH_ALLOWED_HOSTS = ['localhost', '127.0.0.1', '::1'];

let listenerRegistered = false;

/**
 * Whether `?booth=shop` should auto-open the card shop on lobby join.
 * @param {string | null} param - `booth` query param value
 * @param {string} hostname
 */
export function shouldOpenDebugShopBooth(param, hostname) {
	return param === 'shop' && DEBUG_BOOTH_ALLOWED_HOSTS.includes(hostname);
}

/**
 * One-shot opener for the `?booth=shop` debug hook (localhost only).
 * @param {{ param: string | null, hostname: string, openShopBooth: typeof openShopBooth, deps: Parameters<typeof openShopBooth>[0] }} options
 */
export function createRequestDebugShopBoothOpener({ param, hostname, openShopBooth: openFn, deps }) {
	let requested = false;
	return function requestDebugShopBoothOpen() {
		if (!shouldOpenDebugShopBooth(param, hostname) || requested) return;
		requested = true;
		openFn(deps);
	};
}

/**
 * Show the lobby card shop tab and refresh shop contents.
 * @param {{ showGameLobby: () => void, setLobbyTab: (tab: string) => void, renderCardShop: () => void }} deps
 */
export function openShopBooth({ showGameLobby, setLobbyTab, renderCardShop }) {
	showGameLobby();
	setLobbyTab('shop');
	renderCardShop();
}

function isShopBoothAction(detail) {
	if (!detail) return false;
	return detail.action === 'shop' || detail.boothId === 'shop';
}

/**
 * Subscribe once to `booth:action` and open the card shop for shop booth payloads.
 * @param {{ showGameLobby: () => void, setLobbyTab: (tab: string) => void, renderCardShop: () => void }} deps
 */
export function registerShopBoothListener(deps) {
	if (listenerRegistered || typeof window === 'undefined') return;
	listenerRegistered = true;
	window.addEventListener(BOOTH_ACTION_EVENT, (event) => {
		if (isShopBoothAction(event.detail)) {
			openShopBooth(deps);
		}
	});
}
