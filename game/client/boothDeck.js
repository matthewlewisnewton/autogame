// ── Hub Deck Booth — open the loadout editor via booth:action ──
// Keeps deck-editor open logic unit-testable without importing all of main.js.

import { BOOTH_ACTION_EVENT } from './boothPrompt.js';

const DEBUG_BOOTH_ALLOWED_HOSTS = ['localhost', '127.0.0.1', '::1'];

let listenerRegistered = false;

/**
 * Whether `?booth=deck` should auto-open the deck terminal on lobby join.
 * @param {string | null} param - `booth` query param value
 * @param {string} hostname
 */
export function shouldOpenDebugBooth(param, hostname) {
	return param === 'deck' && DEBUG_BOOTH_ALLOWED_HOSTS.includes(hostname);
}

/**
 * One-shot opener for the `?booth=deck` debug hook (localhost only).
 * @param {{ param: string | null, hostname: string, openDeckBooth: typeof openDeckBooth, deps: Parameters<typeof openDeckBooth>[0] }} options
 */
export function createRequestDebugBoothOpener({ param, hostname, openDeckBooth: openFn, deps }) {
	let requested = false;
	return function requestDebugBoothOpen() {
		if (!shouldOpenDebugBooth(param, hostname) || requested) return;
		requested = true;
		openFn(deps);
	};
}

/**
 * Show the lobby loadout bay tab and refresh deck editor contents.
 * @param {{ showGameLobby: () => void, setLobbyTab: (tab: string) => void, renderDeckEditor: () => void }} deps
 */
export function openDeckBooth({ showGameLobby, setLobbyTab, renderDeckEditor }) {
	showGameLobby();
	setLobbyTab('deck');
	renderDeckEditor();
}

function isDeckBoothAction(detail) {
	if (!detail) return false;
	return detail.action === 'deck' || detail.boothId === 'deck';
}

/**
 * Subscribe once to `booth:action` and open the deck editor for deck booth payloads.
 * @param {{ showGameLobby: () => void, setLobbyTab: (tab: string) => void, renderDeckEditor: () => void }} deps
 */
export function registerDeckBoothListener(deps) {
	if (listenerRegistered || typeof window === 'undefined') return;
	listenerRegistered = true;
	window.addEventListener(BOOTH_ACTION_EVENT, (event) => {
		if (isDeckBoothAction(event.detail)) {
			openDeckBooth(deps);
		}
	});
}
