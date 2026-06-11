import eventsCatalog from '../../shared/events.json' with { type: 'json' };

const { serverToClient: SERVER_TO_CLIENT } = eventsCatalog;

/** Heartbeat latency, debug harness replies, and remote-player disconnect cleanup. */

export function bindDebugHandlers(s, ctx) {
	s.on(SERVER_TO_CLIENT.HEARTBEAT_ACK, (data) => {
		if (ctx.connectionState === 'connected') {
			ctx.latency = data.latency;
			if (ctx.statusEl) ctx.statusEl.innerText = `Latency: ${ctx.latency}ms`;
		}
	});

	s.on(SERVER_TO_CLIENT.DEBUG_SCENARIO_RESULT, (data) => {
		ctx.debugScenarioResult = data || null;
		if (data && data.ok) {
			console.log(`[debugScenario] applied ${data.scenario}`);
			const cardProbeScenarios = new Set([
				'ice-ball-ready',
				'fireball-hand-ready',
				'fireball-ready',
				'status-mutual-exclusion-ready',
				'purifying-pulse-ready',
				'magma-windup-ready',
			]);
			// Card exercises cast on the next harness tick; sync facing/cooldowns now
			// so keyboard useCard is not blocked or mis-aimed before deferred snap.
			if (cardProbeScenarios.has(data.scenario)
				&& ctx.gameState?.gamePhase === 'playing'
				&& ctx.myId
				&& ctx.gameState.players[ctx.myId]) {
				const me = ctx.gameState.players[ctx.myId];
				for (let i = 0; i < ctx.slotCooldowns.length; i += 1) {
					ctx.slotCooldowns[i] = false;
				}
				if (Array.isArray(me.hand)) {
					ctx.applyInRunDeckPayload({ hand: me.hand });
					ctx.renderHand();
				}
				if (Number.isFinite(me.rotation)) {
					ctx.alignAttackFacing(me.rotation);
				}
			}
			// Repositioning scenarios emit stateUpdate before this result; defer one
			// tick so the client sim snaps after that payload is applied.
			setTimeout(() => {
				if (ctx.gameState?.gamePhase === 'playing' && ctx.myId && ctx.gameState.players[ctx.myId]) {
					const me = ctx.gameState.players[ctx.myId];
					ctx.setPlayerPosition(me.x, me.z);
					ctx.clearAllLockOnState();
					if (cardProbeScenarios.has(data.scenario) && Number.isFinite(me.rotation)) {
						ctx.alignAttackFacing(me.rotation);
					}
				}
			}, 0);
			// Debug-only: the `hats-unlocked` scenario persists hat unlocks on the
			// account and reports the new owned set so the (already-loaded) client
			// cache reflects them without a full reload. No normal scenario sends
			// this field, so normal gameplay is unaffected.
			if (Array.isArray(data.unlockedHats)) {
				ctx.setUnlockedHats(data.unlockedHats);
				// Mirror the `hatUnlocked` handler: when the character booth is open
				// (e.g. via the `?booth=hatswap` debug hook), rebuild its hat list so
				// the newly-unlocked hats appear as selectable (owned) entries.
				if (ctx.isCharacterBoothOpen()) {
					ctx.rebuildBoothHatList();
				}
			}
			if (Number.isFinite(data.currency)) {
				ctx.myCurrency = data.currency;
				ctx.updateCurrencyHud(ctx.myCurrency);
				if (ctx.myId && ctx.gameState?.players?.[ctx.myId]) {
					ctx.gameState.players[ctx.myId].currency = data.currency;
				}
			}
		} else if (data && data.reason) {
			console.warn(`[debugScenario] ${data.reason}`);
		}
	});

	s.on(SERVER_TO_CLIENT.DEBUG_GODMODE_RESULT, (data) => {
		ctx.debugGodmodeResult = data || null;
		if (data && data.ok) {
			// Mirror server toggle locally so harness probes see debugGodmode without
			// waiting for a full stateUpdate (snapshots omit this debug-only flag).
			if (ctx.myId && ctx.gameState?.players?.[ctx.myId]) {
				ctx.gameState.players[ctx.myId].debugGodmode = !!data.enabled;
			}
			console.log(`[debugGodmode] ${data.enabled ? 'enabled' : 'disabled'}`);
		} else if (data && data.reason) {
			console.warn(`[debugGodmode] ${data.reason}`);
		}
	});

	s.on(SERVER_TO_CLIENT.DEBUG_TIME_SCALE_RESULT, (data) => {
		ctx.debugTimeScaleResult = data || null;
		if (data && data.ok) {
			ctx.applyDebugTimeScale(data.scale);
			console.log(`[debugTimeScale] ${data.scale === 0 ? 'paused' : `×${data.scale}`}`);
		} else if (data && data.reason) {
			// Leave the displayed scale unchanged on rejection.
			console.warn(`[debugTimeScale] ${data.reason}`);
		}
	});

	s.on(SERVER_TO_CLIENT.PLAYER_DISCONNECTED, (id) => {
		ctx.removeRemotePlayerVisuals(id);
	});
}
