import eventsCatalog from '../../shared/events.json' with { type: 'json' };
import { MOVE_SPEED, TICK_RATE } from '../config.js';
import { hand, deck } from '../hand.js';

const { serverToClient: SERVER_TO_CLIENT } = eventsCatalog;

/** STATE_UPDATE Socket.IO listener extracted from bindSocketHandlers. */

export function bindStateHandlers(s, ctx) {
	s.on(SERVER_TO_CLIENT.STATE_UPDATE, (state) => {
		const previousPhase = ctx.gameState && ctx.gameState.gamePhase;
		const previousMe = ctx.myId && ctx.gameState?.players?.[ctx.myId];
		const incomingMe = ctx.myId && state?.players?.[ctx.myId];
		const hasAuthoritativeHand = Array.isArray(incomingMe?.hand);
		const magicStonesChanged = Number.isFinite(incomingMe?.magicStones)
			&& incomingMe.magicStones !== previousMe?.magicStones;

		// Hot ticks omit cold player fields and slow world catalogs. Merge so
		// the client retains hand/deck/inventory/shopOffer/layoutSeed/etc.
		if (ctx.gameState && state && typeof state === 'object') {
			const prev = ctx.gameState;
			const SLOW_WORLD_KEYS = [
				'shopOffer', 'dungeonBounds', 'runSpawnSeed',
				'currency', 'suspendedRunSummary', 'debugTimeScaleAllowed', 'layout',
			];
			for (const key of SLOW_WORLD_KEYS) {
				if (state[key] === undefined && prev[key] !== undefined) {
					state[key] = prev[key];
				}
			}
			if (state.run && prev.run && typeof state.run === 'object' && typeof prev.run === 'object') {
				state.run = { ...prev.run, ...state.run };
			} else if (state.run === undefined
				&& state.gamePhase === 'playing'
				&& prev.run !== undefined) {
				state.run = prev.run;
			}
			if (prev.players && state.players) {
				for (const [id, incoming] of Object.entries(state.players)) {
					const prior = prev.players[id];
					if (!prior || !incoming) continue;
					// Never retain another player's private fields. For this
					// client, preserve cold collection fields across slim ticks;
					// authoritative nulls from phase transitions still win.
					state.players[id] = id === ctx.myId
						? { ...prior, ...incoming }
						: incoming;
				}
			}
		}

		if (ctx.myId && state?.players?.[ctx.myId] && ctx.gameState?.players?.[ctx.myId]) {
			const prevHand = ctx.gameState.players[ctx.myId].hand;
			if (Array.isArray(prevHand) && !Array.isArray(state.players[ctx.myId].hand)) {
				state.players[ctx.myId].hand = prevHand;
			}
		}
		// Verify layout seed consistency on every state update
		if (ctx.currentLayoutSeed !== null && state.layoutSeed !== undefined && state.layoutSeed !== ctx.currentLayoutSeed) {
			console.warn(`[layout] Seed mismatch: local=${ctx.currentLayoutSeed} server=${state.layoutSeed}`);
			ctx.currentLayoutSeed = state.layoutSeed;
		}
		ctx.gameState = state;
		ctx.suspendedRunSummary = ctx.cloneSuspendedRunSummary(state.suspendedRunSummary ?? null);
		ctx.setGameStateRef(state);
		if (state.gamePhase === 'playing' && ctx.currentLayout) {
			ctx.syncPassageLockColliders(state.run?.passageLocks);
			ctx.syncPassageLockGates(state.run?.passageLocks);
		}
		// Server snapshots omit debugGodmode; re-apply the last toggle so harness
		// probes and local handlers stay consistent across stateUpdate.
		if (ctx.myId && ctx.debugGodmodeResult?.ok && ctx.gameState.players?.[ctx.myId]) {
			ctx.gameState.players[ctx.myId].debugGodmode = !!ctx.debugGodmodeResult.enabled;
		}
		// Keep the time-scale badge authoritative: the snapshot's debugTimeScale
		// (added in sub-ticket 01) is the source of truth when present.
		if (Number.isFinite(state.debugTimeScale)) {
			ctx.applyDebugTimeScale(state.debugTimeScale);
		}
		// Track the server's authority for the time-scale feature so the keybind
		// and test hook gate on it (see emitSetDebugTimeScale).
		if (typeof state.debugTimeScaleAllowed === 'boolean') {
			ctx.debugTimeScaleAllowed = state.debugTimeScaleAllowed;
		}
		const me = ctx.myId && ctx.gameState.players ? ctx.gameState.players[ctx.myId] : null;
		const cardProbeScenarios = new Set([
			'fireball-ready',
			'status-mutual-exclusion-ready',
			'purifying-pulse-ready',
			'magma-windup-ready',
		]);
		if (state.gamePhase === 'playing'
			&& me?.debugScenario
			&& cardProbeScenarios.has(me.debugScenario)
			&& Array.isArray(me.hand)) {
			ctx.applyInRunDeckPayload({ hand: me.hand });
			ctx.renderHand();
		}
		const isExtracted = !!(me && me.extracted);
		// The renderer shows the hub during the lobby, and also while the local
		// player is extracted into the hub mid-run (server still 'playing'), so
		// floor sampling for the local avatar must use the hub layout in both
		// cases; an active in-dungeon run uses the quest layout.
		const inHubScene = state.gamePhase === 'lobby' || isExtracted;
		const activeLayout = (inHubScene && ctx.hubLayout) ? ctx.hubLayout : ctx.currentLayout;
		if (ctx.gameState && activeLayout) ctx.gameState.layout = activeLayout;
		ctx.updateLevelSettingsBtnVisibility();
		if (ctx.isLevelSettingsOpen()) ctx.syncLevelSettingsRewards();

		const collectionChanged = ctx.syncLocalCollectionState(me);
		const enteringLobby = previousPhase !== 'lobby' && state.gamePhase === 'lobby';
		const enteringPlaying = previousPhase !== 'playing' && state.gamePhase === 'playing';

		if (enteringLobby) {
			ctx._lastReturnRewardsPreview = null;
			ctx.extractedLobbyOverlayActive = false;
			ctx.syncQuestCommsPhase('lobby');
		} else if (enteringPlaying) {
			ctx.clearQuestCommsLog();
			ctx.setQuestCommsUiVisible(true);
			ctx.flushPendingQuestDialogue();
			if (me?.returnRewardsPreview != null) {
				ctx._lastReturnRewardsPreview = me.returnRewardsPreview;
			}
		} else if (me && state.gamePhase === 'playing') {
			if (me.returnRewardsPreview != null) {
				ctx._lastReturnRewardsPreview = me.returnRewardsPreview;
			} else if (ctx._lastReturnRewardsPreview != null) {
				ctx.gameState.players[ctx.myId].returnRewardsPreview = ctx._lastReturnRewardsPreview;
			}
		}

		if (isExtracted && state.gamePhase === 'playing') {
			ctx.showExtractedLobbyOverlay();
		} else if (state.gamePhase === 'lobby') {
			const terminalSummaryActive = ctx.isTerminalRunSummaryActive(state);
			const runClearedOnServer = !state.run;
			if (!terminalSummaryActive || runClearedOnServer) {
				ctx.returnToGuildLobby(state, {
					refreshCollection: enteringLobby || collectionChanged,
					rebuildHub: enteringLobby,
					dismissRunSummary: terminalSummaryActive && runClearedOnServer,
				});
			}
		} else if (me) {
			ctx.syncVanguardHud(me, state.gamePhase);
		}

		if (ctx.needsTerminalRunSummaryFromState(state)) {
			const summary = ctx.buildRunSummaryFromState(state);
			if (summary) ctx.showRunSummary(summary);
		}

		// Entering gameplay: ensure HUD is visible (unless extracted mid-run)
		if (state.gamePhase === 'playing' && !isExtracted) {
			ctx.showCardHand();
			ctx.setDeckStackVisible(true);
			if (ctx.lobbyEl) ctx.lobbyEl.classList.add('hidden');
			ctx.setLobbyHudVisible(false);
			ctx.setDeployButtonVisible(false);
			ctx.clearSuspendedRunUi();
			ctx.setGamePhase('playing');
			if (enteringPlaying) {
				ctx._lastMagicStones = undefined;
			}
		}

		// Update Vanguard HUD (HP always; MS/deck/portrait in-run only)
		if (me) {
			if (state.gamePhase === 'lobby') {
				ctx.syncVanguardHud(me, 'lobby');
			} else if (state.gamePhase === 'playing') {
				ctx.updateHpBar(me.hp);
				ctx.updateMsBar(me.magicStones);
				if (Array.isArray(me.deck) || Array.isArray(me.hand)) {
					ctx.updateDeckStats(
						Array.isArray(me.deck) ? me.deck : deck,
						Array.isArray(me.hand) ? me.hand : hand,
						Array.isArray(me.inventory) ? me.inventory : ctx.myInventory,
					);
				}
				ctx.updateVanguardPortrait(me);
			}
		}

		// Update currency HUD (visible in lobby and during runs)
		if (me) {
			ctx.updateCurrencyHud(me.currency, { flashOnIncrease: state.gamePhase === 'playing' });
		}

		// Update objective HUD
		ctx.updateObjectiveHud();
		ctx.updateObjectiveNavIndicator();

		// Update stage-boss encounter HUD (boss bar shown while the encounter is
		// active/locked and the boss enemy is alive; hidden otherwise)
		ctx.updateBossEncounterHud();

		// Reconcile hand with server authority + re-render for .no-ms / .empty classes
		if (state.gamePhase === 'playing'
			&& ctx.myId
			&& state.players[ctx.myId]
			&& state.players[ctx.myId].hand
			&& (hasAuthoritativeHand || magicStonesChanged)) {
			const serverPlayer = state.players[ctx.myId];
			const serverHand = serverPlayer.hand;
			hand.length = 0;
			for (let i = 0; i < serverHand.length; i++) {
				hand[i] = serverHand[i] ? { ...serverHand[i] } : null;
			}
			if (serverPlayer.inDesperation != null) {
				ctx.setInDesperation(serverPlayer.inDesperation);
			} else if (Array.isArray(serverPlayer.deck) && serverPlayer.deck.length === 0) {
				ctx.setInDesperation(hand.some((card) => card && card.isDesperation));
			}
			if (Array.isArray(serverPlayer.desperationDeck)) {
				ctx.setDesperationDrawPile(serverPlayer.desperationDeck);
			}
			ctx.renderHand();
			ctx.updateDeckVisuals();
		} else if (state.gamePhase === 'playing' && enteringPlaying) {
			ctx.renderHand();
		}

		if (state.gamePhase === 'playing' && ctx.myId && state.players[ctx.myId]) {
			const serverPlayer = state.players[ctx.myId];
			if (Array.isArray(serverPlayer.deck)
				|| Array.isArray(serverPlayer.desperationDeck)
				|| serverPlayer.inDesperation != null) {
				ctx.syncDrawPileFromServer();
			}
		}

		// Prune pickup retry timestamps for loot that left the world
		if (state.loot && Array.isArray(state.loot)) {
			ctx.pruneLootPickupAttempts(new Set(state.loot.map((l) => l.id)));
		}

		// Client prediction reconciliation — only correct when idle or badly desynced
		if (state.gamePhase === 'playing' && ctx.myId && ctx.gameState.players[ctx.myId]) {
			const serverPlayer = ctx.gameState.players[ctx.myId];
			if (!serverPlayer.dead && !ctx.isPlayerMoving()) {
				const pos = ctx.getPlayerPosition();
				const dx = serverPlayer.x - pos.x;
				const dz = serverPlayer.z - pos.z;
				const drift = Math.hypot(dx, dz);
				if (drift > 0.15) {
					ctx.setPlayerPosition(serverPlayer.x, serverPlayer.z);
				}
			} else if (!serverPlayer.dead) {
				const pos = ctx.getPlayerPosition();
				const drift = Math.hypot(serverPlayer.x - pos.x, serverPlayer.z - pos.z);
				if (drift > 2.5) {
					ctx.setPlayerPosition(serverPlayer.x, serverPlayer.z);
				}
			}
		}

		// Dash VFX detection: large position jump in a single tick
		if (state.gamePhase === 'playing' && ctx.myId && ctx.gameState.players[ctx.myId]) {
			const dashMe = ctx.gameState.players[ctx.myId];
			if (ctx._prevDashX != null) {
				const jumpDist = Math.hypot(dashMe.x - ctx._prevDashX, dashMe.z - ctx._prevDashZ);
				if (jumpDist > (MOVE_SPEED / TICK_RATE) * 2) {
					ctx.triggerDashVFX(ctx.myId);
				}
			}
			ctx._prevDashX = dashMe.x;
			ctx._prevDashZ = dashMe.z;
		} else if (state.gamePhase !== 'playing') {
			ctx._prevDashX = null;
			ctx._prevDashZ = null;
		}

		// Key item HUD (slot content + cooldown overlay)
		if (state.gamePhase === 'playing' && ctx.myId && ctx.gameState.players[ctx.myId]) {
			const meForCooldown = ctx.gameState.players[ctx.myId];
			const remaining = ctx.getKeyItemCooldownRemainingMs(meForCooldown);
			meForCooldown.keyItemCooldownRemaining = remaining;
			ctx.renderKeyItemHud(meForCooldown, state.gamePhase);
			ctx.updateKeyItemCooldownHud(remaining);
			if (remaining <= 0) ctx.keyItemCooldownUntilClient = 0;
		} else if (state.gamePhase !== 'playing') {
			ctx.keyItemCooldownUntilClient = 0;
			ctx.clearKeyItemCooldownHud();
		}
	});
}
