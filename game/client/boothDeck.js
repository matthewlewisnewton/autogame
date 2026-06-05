// ── Hub Deck Booth — open the loadout editor via booth:action ──
// Keeps deck-editor open logic unit-testable without importing all of main.js.

import { BOOTH_ACTION_EVENT } from './boothPrompt.js';

let listenerRegistered = false;

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
