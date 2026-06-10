/**
 * Shared context for client socket handler modules.
 * Mutable game/connection state is exposed via getters/setters so handlers
 * always read current values without re-binding on every state change.
 */

const STATE_ACCESSORS = ['myId', 'gameState', 'connectionState', 'latency'];

export function createSocketHandlerCtx(deps) {
	const ctx = {
		clearConnectWatchdog: deps.clearConnectWatchdog,
		startConnectWatchdog: deps.startConnectWatchdog,
		startHeartbeat: deps.startHeartbeat,
		stopHeartbeat: deps.stopHeartbeat,
		updateStatus: deps.updateStatus,
		showLobbyBrowserError: deps.showLobbyBrowserError,
		disposeAllLootMeshes: deps.disposeAllLootMeshes,
		TOKEN_KEY: deps.TOKEN_KEY,
		setAuthToken: deps.setAuthToken,
		uiEl: deps.uiEl,
		cardHandEl: deps.cardHandEl,
		hideCardHand: deps.hideCardHand,
		hideVariantCodex: deps.hideVariantCodex,
		setDeckStackVisible: deps.setDeckStackVisible,
		lobbyEl: deps.lobbyEl,
		setLobbyHudVisible: deps.setLobbyHudVisible,
		lobbyBrowserEl: deps.lobbyBrowserEl,
		runSummaryOverlay: deps.runSummaryOverlay,
		showAuthOverlay: deps.showAuthOverlay,
		showLoginForm: deps.showLoginForm,
	};

	for (const key of STATE_ACCESSORS) {
		Object.defineProperty(ctx, key, {
			get: () => deps.state[key],
			set: (v) => { deps.state[key] = v; },
			enumerable: true,
		});
	}

	return ctx;
}
