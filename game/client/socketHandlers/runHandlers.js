import eventsCatalog from '../../shared/events.json' with { type: 'json' };

const { serverToClient: SERVER_TO_CLIENT } = eventsCatalog;

/** Run deploy/completion/suspension Socket.IO listeners extracted from bindSocketHandlers. */

export function bindRunHandlers(s, ctx) {
	s.on(SERVER_TO_CLIENT.START_GAME, () => {
		if (ctx.isCharacterBoothOpen()) ctx.closeCharacterBooth();
		ctx.claimedCardRewardId = null;
		ctx.currentCardChoices = [];
		ctx.clearQuestCommsLog();
		ctx.setQuestCommsUiVisible(true);
		if (ctx.lobbyEl) ctx.lobbyEl.classList.add('hidden');
		ctx.setLobbyHudVisible(false);
		ctx.uiEl.style.display = 'block';
		ctx.showCardHand();
		ctx.setDeckStackVisible(true);
		ctx.updateObjectiveHud();
		if (!ctx.isSceneInitialized()) {
			ctx.initHand();
			ctx.rendererInitScene(ctx.currentLayout, ctx.resolveRunSpawnPosition());
			ctx.renderedSceneProfile = 'quest';
			if (ctx.gameState) ctx.gameState.layout = ctx.currentLayout;
			ctx.setGamePhase('playing');
			ctx.updateLevelSettingsBtnVisibility();
			return;
		}
		ctx.initHand();
		// Deploying from the lobby: switch the rendered geometry from the hub to
		// the quest run before placing the player at the run spawn, so players
		// never deploy into the hub geometry.
		if (ctx.currentLayout && ctx.renderedSceneProfile !== 'quest') {
			ctx.rebuildDungeonLayout(ctx.currentLayout);
		}
		ctx.renderedSceneProfile = 'quest';
		if (ctx.gameState) ctx.gameState.layout = ctx.currentLayout;
		const spawnPos = ctx.resolveRunSpawnPosition();
		ctx.setPlayerPosition(spawnPos.x, spawnPos.z);
		ctx.setPlayerRotation(0);
		ctx.setWasDead(false);
		ctx.clearSuspendedRunUi();
		ctx.setGamePhase('playing');
		ctx.updateLevelSettingsBtnVisibility();

		// Only clear entity meshes when we lack fresh server state; otherwise the animate
		// loop will reconcile from gameState on the next stateUpdate.
		const hasWorldEntities = ctx.gameState && (
			(Array.isArray(ctx.gameState.enemies) && ctx.gameState.enemies.length > 0) ||
			(Array.isArray(ctx.gameState.minions) && ctx.gameState.minions.length > 0) ||
			(Array.isArray(ctx.gameState.loot) && ctx.gameState.loot.length > 0)
		);
		if (!hasWorldEntities) {
			const sc = ctx.getScene();
			const maps = ctx.getMeshMaps();
			ctx.rendererDisposeMeshMap(maps.enemiesMeshes, sc);
			ctx.rendererDisposeMeshMap(maps.enemyHealthBars, sc);
			ctx.rendererDisposeMeshMap(maps.enemyShieldBars, sc);
			ctx.rendererDisposeMeshMap(maps.telegraphMeshes, sc);
			ctx.rendererDisposeMeshMap(maps.minionTelegraphMeshes, sc);
			ctx.rendererDisposeMeshMap(maps.minionsMeshes, sc);
			ctx.rendererDisposeMeshMap(maps.spikeTrapMeshes, sc);
			ctx.rendererDisposeMeshMap(maps.iceBallMeshes, sc);
			ctx.disposeAllLootMeshes();
		}
	});

	s.on(SERVER_TO_CLIENT.RUN_COMPLETE, ctx.showRunSummary);
	s.on(SERVER_TO_CLIENT.RUN_FAILED, ctx.showRunSummary);

	s.on(SERVER_TO_CLIENT.RUN_ERROR, (data) => {
		const reason = (data && data.reason) ? data.reason : 'Run action failed';
		console.warn(`[run] ${reason}`);
		ctx.showLevelSettingsError(reason);
		if (ctx.giveUpBtnEl) ctx.giveUpBtnEl.disabled = false;
	});

	s.on(SERVER_TO_CLIENT.RUN_SUSPENDED, (summary) => {
		ctx.suspendedRunSummary = ctx.cloneSuspendedRunSummary(summary);
		if (ctx.gameState?.gamePhase === 'lobby') {
			ctx.renderSuspendedRunBanner(ctx.suspendedRunSummary);
		}
	});

	s.on(SERVER_TO_CLIENT.RUN_ABANDONED, () => {
		ctx.suspendedRunSummary = null;
		ctx.clearSuspendedRunUi();
		if (ctx.gameState) {
			ctx.gameState.gamePhase = 'lobby';
			delete ctx.gameState.run;
		}
		if (ctx.giveUpBtnEl) ctx.giveUpBtnEl.disabled = false;
		ctx.returnToGuildLobby(ctx.gameState, { refreshCollection: true, rebuildHub: true });
	});

	if (ctx.giveUpBtnEl) {
		ctx.giveUpBtnEl.onclick = () => ctx.requestGiveUp(s);
	}

	s.on(SERVER_TO_CLIENT.PLAYER_EXTRACTED, (data) => {
		if (data && data.playerId === ctx.myId) {
			ctx.showExtractedLobbyOverlay();
		}
	});

	s.on(SERVER_TO_CLIENT.CARD_REWARD_CLAIMED, (data) => {
		if (!data || !data.cardId) return;
		ctx.claimedCardRewardId = data.cardId;
		if (data.ownedCards) ctx.myOwnedCards = data.ownedCards;
		if (data.inventory) ctx.myInventory = data.inventory;
		ctx.renderCardChoices(ctx.currentCardChoices);
	});
}
