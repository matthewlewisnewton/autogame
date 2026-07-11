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
		if (data.keyItemDefs) ctx.keyItemDefs = data.keyItemDefs;
		if (data.enemyDisplayCatalog) ctx.enemyDisplayCatalog = data.enemyDisplayCatalog;
		if (data.catalogHash) {
			try { localStorage.setItem('ag_catalog_hash', data.catalogHash); } catch (_) {}
		}
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
		// INIT is only sent after server handlers are registered — re-emit any
		// pending join that may have been dropped if it raced the async setup.
		// Skip when deep-link redirected to a new fly-instance socket.
		if (ctx.emitPendingLobbyJoin && (!ctx.isCurrentSocket || ctx.isCurrentSocket(s))) {
			ctx.emitPendingLobbyJoin(s, { force: true });
		}
	});
}
