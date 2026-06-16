import eventsCatalog from '../../shared/events.json' with { type: 'json' };

const { serverToClient: SERVER_TO_CLIENT } = eventsCatalog;

/** Session bootstrap Socket.IO listener extracted from bindSocketHandlers. */

export function bindInitHandlers(s, ctx) {
	s.on(SERVER_TO_CLIENT.INIT, (data) => {
		ctx.myId = data.id;
		ctx.rendererSetMyId(data.id);
		if (data.playerId) {
			try { localStorage.setItem(ctx.STORAGE_KEY_PLAYER_ID, data.playerId); } catch (_) {}
		}

		ctx.mySelectedDeck = data.selectedDeck || [];
		ctx.myInventory = Array.isArray(data.inventory) ? data.inventory : null;
		ctx.myOwnedCards = data.ownedCards || {};
		ctx.keyItemDefs = data.keyItemDefs || {};
		ctx.enemyDisplayCatalog = data.enemyDisplayCatalog || null;
		ctx.renderDeckEditor();

		if (data.accountId) {
			const username = data.username || data.accountId;
			ctx.setLoggedInStatus(username);
			ctx.showAppToolbar();
		}

		// Reconnect path: lobbyJoined already restored lobby/run UI.
		if (data.inLobby) return;

		ctx.showLobbyBrowser();
		ctx.renderLobbyList(data.lobbies || []);
		ctx.showLobbyBrowserError('');
		if (ctx.lobbyBrowserStatusEl) {
			ctx.lobbyBrowserStatusEl.textContent = 'Choose a lobby or create your own.';
		}
		ctx.handleLobbyDeepLinkAfterInit(data.lobbies);
	});
}
