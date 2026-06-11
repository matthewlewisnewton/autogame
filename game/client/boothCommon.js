// ── Shared lobby-tab booth factory (deck, shop, …) ──

import { BOOTH_ACTION_EVENT } from './boothPrompt.js';

export const DEBUG_BOOTH_ALLOWED_HOSTS = ['localhost', '127.0.0.1', '::1'];

/**
 * @param {{ boothId: string, tab: string, renderDepKey: string }} config
 */
export function createBoothModule({ boothId, tab, renderDepKey }) {
	let listenerRegistered = false;

	function shouldOpenDebug(param, hostname) {
		return param === boothId && DEBUG_BOOTH_ALLOWED_HOSTS.includes(hostname);
	}

	function createRequestDebugOpener({ param, hostname, openFn, deps }) {
		let requested = false;
		return function requestDebugBoothOpen() {
			if (!shouldOpenDebug(param, hostname) || requested) return;
			requested = true;
			openFn(deps);
		};
	}

	function openBooth(deps) {
		deps.showGameLobby();
		deps.setLobbyTab(tab);
		deps[renderDepKey]();
	}

	function isBoothAction(detail) {
		if (!detail) return false;
		return detail.action === boothId || detail.boothId === boothId;
	}

	function registerBoothListener(deps) {
		if (listenerRegistered || typeof window === 'undefined') return;
		listenerRegistered = true;
		window.addEventListener(BOOTH_ACTION_EVENT, (event) => {
			if (isBoothAction(event.detail)) {
				openBooth(deps);
			}
		});
	}

	return {
		shouldOpenDebug,
		createRequestDebugOpener,
		openBooth,
		isBoothAction,
		registerBoothListener,
	};
}
