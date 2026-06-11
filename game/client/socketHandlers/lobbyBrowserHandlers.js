import eventsCatalog from '../../shared/events.json' with { type: 'json' };

const { serverToClient: SERVER_TO_CLIENT } = eventsCatalog;

/** Lobby browser Socket.IO listeners extracted from bindSocketHandlers. */

export function bindLobbyBrowserHandlers(s, ctx) {
	s.on(SERVER_TO_CLIENT.LOBBY_JOINED, (data) => {
		ctx.showLobbyBrowserError('');
		ctx.applyLobbyJoinedData(data);
		// Debug hook: ?booth=launch readies up automatically on a lobby join so a
		// run can be launched without walking to the Launch Bay booth. Guarded to
		// the lobby phase so it never fires when dropping into an in-progress run.
		const inLobbyPhase = data && data.state && data.state.gamePhase === 'lobby';
		if (inLobbyPhase && ctx.getBoothDebugHook(window.location.search) === ctx.LAUNCH_BOOTH_ID) {
			ctx.launchBoothReadyUp();
		}
	});

	s.on(SERVER_TO_CLIENT.LOBBY_LEFT, (data) => {
		ctx.gameState = null;
		ctx.setGameStateRef(null);
		ctx.showLobbyBrowser();
		ctx.renderLobbyList((data && data.lobbies) || []);
		if (ctx.lobbyBrowserStatusEl) {
			ctx.lobbyBrowserStatusEl.textContent = 'Left lobby. Pick another or create one.';
		}
	});

	s.on(SERVER_TO_CLIENT.LOBBY_LIST_UPDATE, (data) => {
		if (ctx.lobbyBrowserEl && !ctx.lobbyBrowserEl.classList.contains('hidden')) {
			ctx.renderLobbyList((data && data.lobbies) || []);
		}
	});

	s.on(SERVER_TO_CLIENT.LOBBY_ERROR, (data) => {
		const reason = data && data.reason ? data.reason : 'Lobby action failed';
		ctx.showLobbyBrowserError(reason);
	});
}
