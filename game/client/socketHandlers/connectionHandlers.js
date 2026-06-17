/** Connection-lifecycle Socket.IO listeners extracted from bindSocketHandlers. */

export function bindConnectionHandlers(s, ctx) {
	s.on('connect', () => {
		ctx.clearConnectWatchdog();
		ctx.showLobbyBrowserError('');
		ctx.updateStatus('Connected', 'connected');
		ctx.startHeartbeat();
		ctx.emitPendingLobbyJoin(s);
	});

	s.on('disconnect', () => {
		ctx.stopHeartbeat();
		ctx.updateStatus('Disconnected', 'disconnected');
		ctx.disposeAllLootMeshes();
		// A drop after a good connection re-arms the watchdog: reconnection is
		// configured as infinite, so without this an unrecoverable drop would sit
		// in transient status forever. Cleared again on `connect`/`reconnect`.
		ctx.startConnectWatchdog();
	});

	s.io.on('reconnect_attempt', () => {
		ctx.updateStatus('Reconnecting...', 'reconnecting');
		// Idempotent: the first signal in an episode arms an absolute deadline;
		// rapid repeated reconnect attempts do NOT postpone it, so a stalled
		// reconnect loop still escalates to the persistent failure surface.
		ctx.startConnectWatchdog();
	});

	s.io.on('reconnect', () => {
		ctx.clearConnectWatchdog();
		ctx.showLobbyBrowserError('');
		ctx.updateStatus('Connected', 'connected');
		ctx.startHeartbeat();
		ctx.emitPendingLobbyJoin(s);
	});

	s.on('connect_error', (err) => {
		const msg = err?.message || String(err || '');
		const isAuthError = /jwt|token|session|unauthorized|authentication/i.test(msg);
		ctx.stopHeartbeat();
		if (isAuthError) {
			// Auth recovery wins outright: cancel the connect watchdog so it can
			// never overwrite the "session expired" surface with a generic
			// connect-timeout error.
			ctx.clearConnectWatchdog();
			try { localStorage.removeItem(ctx.TOKEN_KEY); } catch (_) {}
			ctx.setAuthToken(null);
			s.io.disconnect();
			if (ctx.uiEl) ctx.uiEl.style.display = 'none';
			if (ctx.cardHandEl) ctx.hideCardHand();
			ctx.hideVariantCodex();
			ctx.setDeckStackVisible(false);
			if (ctx.lobbyEl) ctx.lobbyEl.classList.add('hidden');
			ctx.setLobbyHudVisible(false);
			if (ctx.lobbyBrowserEl) ctx.lobbyBrowserEl.classList.add('hidden');
			if (ctx.runSummaryOverlay) ctx.runSummaryOverlay.style.display = 'none';
			ctx.showAuthOverlay();
			ctx.showLoginForm();
			ctx.updateStatus('Session expired — please log in again', 'disconnected');
		} else {
			ctx.updateStatus('Connection failed — retrying...', 'reconnecting');
			// Ensure the watchdog is running so a persistent non-auth connect
			// failure escalates instead of retrying transiently forever. The
			// call is idempotent: rapid repeated connect_error events do NOT
			// reset the absolute deadline armed by the first failure.
			ctx.startConnectWatchdog();
		}
	});
}
