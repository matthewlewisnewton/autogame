import eventsCatalog from '../../shared/events.json' with { type: 'json' };

const { serverToClient: SERVER_TO_CLIENT } = eventsCatalog;

/** Squad-lobby and hub-feature Socket.IO listeners extracted from bindSocketHandlers. */

export function bindLobbyHandlers(s, ctx) {
	s.on(SERVER_TO_CLIENT.HUB_PRESENCE_UPDATE, (data) => {
		if (!data || !ctx.gameState || ctx.gameState.gamePhase !== 'lobby') return;
		if (!data.presence) return;
		ctx.applyHubPresence(data.presence, { removedPlayerIds: data.removedPlayerIds });
	});

	s.on(SERVER_TO_CLIENT.BOOTH_ACTION, (data) => {
		// Single dispatch hook: later booth tickets subscribe to the
		// `booth:action` window event instead of re-touching this primitive.
		if (!data || !data.boothId) return;
		ctx.dispatchBoothAction(data);
	});

	s.on(SERVER_TO_CLIENT.BOOTH_ERROR, (data) => {
		// Booth interactions are best-effort: log and ignore so a rejected
		// interaction never disrupts the prompt or crashes the client.
		console.log(`[boothError] ${data && data.reason ? data.reason : 'unknown'}`);
	});

	s.on(SERVER_TO_CLIENT.DECK_UPDATE, (data) => {
		if (!data) return;
		if (data.selectedDeck) ctx.mySelectedDeck = data.selectedDeck;
		if (Array.isArray(data.inventory)) ctx.myInventory = data.inventory;
		if (data.ownedCards) ctx.myOwnedCards = data.ownedCards;
		if (Number.isFinite(data.currency)) {
			ctx.myCurrency = data.currency;
			ctx.updateCurrencyHud(ctx.myCurrency);
		}

		const inRun = ctx.gameState?.gamePhase === 'playing';
		if (inRun) {
			ctx.applyInRunDeckPayload(data);
			if (Array.isArray(data.hand)
				|| Array.isArray(data.deck)
				|| Array.isArray(data.desperationDeck)
				|| data.inDesperation != null) {
				ctx.renderHand();
				ctx.updateRunDeckTotal();
				ctx.updateDeckStats(ctx.deck, ctx.hand, ctx.myInventory);
				ctx.updateDeckVisuals();
			}
			if (data.returnRewardsPreview != null && ctx.isLevelSettingsOpen()) {
				ctx.syncLevelSettingsRewards();
			}
		} else {
			ctx.updateDeckStats(ctx.mySelectedDeck, [], ctx.myInventory);
		}

		ctx.renderDeckEditor();
		if (ctx.activeLobbyTab === 'forge') ctx.renderPhotonForge();
		if (ctx.activeLobbyTab === 'shop') ctx.renderCardShop();
	});

	s.on(SERVER_TO_CLIENT.DECK_ERROR, (data) => {
		if (!data || !data.reason) return;
		ctx.isReady = false;
		ctx.launchReadyPending = false;
		if (ctx.activeLobbyTab === 'shop') ctx.showShopError(data.reason);
		else ctx.showDeckError(data.reason);
	});

	s.on(SERVER_TO_CLIENT.MEDIC_HEALED, (data) => {
		if (ctx.gameState && ctx.myId && ctx.gameState.players[ctx.myId] && data) {
			ctx.gameState.players[ctx.myId].hp = data.hp;
			ctx.gameState.players[ctx.myId].currency = data.currency;
			ctx.gameState.players[ctx.myId].dead = false;
		}
		if (Number.isFinite(data?.currency)) {
			ctx.myCurrency = data.currency;
			ctx._lastCurrency = data.currency;
		}
		ctx.renderGuildMedic();
		const me = ctx.gameState && ctx.myId ? ctx.gameState.players[ctx.myId] : null;
		ctx.syncVanguardHud(me, 'lobby');
	});

	s.on(SERVER_TO_CLIENT.MEDIC_ERROR, (data) => {
		const reason = data && data.reason ? data.reason : 'unknown';
		const messages = {
			insufficient_gold: `Not enough money (need ${ctx.MEDIC_HEAL_COST})`,
			already_full: 'Already at full health',
			not_in_lobby: 'Medic is only available at the lobby connection',
			invalid_player: 'Could not find your hunter',
		};
		ctx.showMedicError(messages[reason] || `Heal failed: ${reason}`);
	});

	s.on(SERVER_TO_CLIENT.KEY_ITEM_EQUIPPED, (data) => {
		if (data && data.keyItemId) {
			const me = ctx.myId && ctx.gameState?.players ? ctx.gameState.players[ctx.myId] : null;
			if (me) me.equippedKeyItemId = data.keyItemId;
		}
		ctx.renderKeyItemList();
		const me = ctx.myId && ctx.gameState?.players ? ctx.gameState.players[ctx.myId] : null;
		ctx.renderKeyItemHud(me, ctx.gameState?.gamePhase);
	});

	s.on(SERVER_TO_CLIENT.KEY_ITEM_ERROR, (data) => {
		const reason = data && data.reason ? data.reason : 'unknown';
		const messages = {
			not_in_lobby: 'Key items can only be equipped in the lobby',
			missing_key_item_id: 'No key item specified',
			unknown_item: 'Unknown key item',
		};
		ctx.showKeyItemError(messages[reason] || `Equip failed: ${reason}`);
	});

	s.on(SERVER_TO_CLIENT.KEY_ITEM_HEAL_PULSE, (data) => {
		if (!data || !ctx.getScene()) return;
		const { x, z, healRadius } = data;
		if (!Number.isFinite(x) || !Number.isFinite(z)) return;
		const radius = Number.isFinite(healRadius)
			? healRadius
			: (ctx.keyItemDefs.field_medic_kit?.healRadius ?? 5);
		ctx.triggerHealPulseVFX({ x, y: 0, z }, radius);
	});

	s.on(SERVER_TO_CLIENT.MEDIC_ALLY_HEAL, (data) => {
		if (!data || !ctx.getScene()) return;
		const { x, z, healRadius } = data;
		if (!Number.isFinite(x) || !Number.isFinite(z)) return;
		ctx.triggerMedicAllyHealVFX({ x, y: 0, z }, healRadius);
	});

	s.on(SERVER_TO_CLIENT.MEDIC_BEAD, (data) => {
		if (!data || !ctx.getScene()) return;
		ctx.triggerMedicEnergyBeadVFX(data);
	});

	s.on(SERVER_TO_CLIENT.KEY_ITEM_USED, (data) => {
		if (!data) return;
		const me = ctx.myId && ctx.gameState?.players ? ctx.gameState.players[ctx.myId] : null;
		if (data.ok) {
			if (me && Number.isFinite(data.cooldownUntil)) {
				ctx.keyItemCooldownUntilClient = data.cooldownUntil;
				const remaining = Math.max(0, data.cooldownUntil - Date.now());
				me.keyItemCooldownRemaining = remaining;
				ctx.updateKeyItemCooldownHud(remaining);
			}
			ctx.flashKeyItemIndicator('success');
			if (data.keyItemId === 'guard_block') {
				ctx.triggerShieldVFX(ctx.myId);
			}
			if (data.keyItemId === 'smoke_bomb' && me) {
				ctx.triggerSmokeVFX({ x: me.x, y: 0, z: me.z }, ctx.myId);
			}
			if (data.keyItemId === 'loot_magnet' && (data.pulled ?? 0) > 0) {
				const magnetMe = ctx.myId && ctx.gameState?.players ? ctx.gameState.players[ctx.myId] : null;
				if (magnetMe) {
					const attractRadius = ctx.keyItemDefs.loot_magnet?.attractRadius ?? 8;
					ctx.triggerLootMagnetVFX({ x: magnetMe.x, y: 0, z: magnetMe.z }, attractRadius);
				}
			}
		} else if (data.reason === 'on_cooldown') {
			if (me && Number.isFinite(data.remainingMs)) {
				me.keyItemCooldownRemaining = data.remainingMs;
				ctx.updateKeyItemCooldownHud(data.remainingMs);
			}
			ctx.flashKeyItemIndicator('cooldown');
		} else if (data.reason === 'no_minions') {
			// Soft-fail: recall blown with zero minions. Server did not start a
			// cooldown; give a brief amber cue distinct from the cooldown flash.
			ctx.flashKeyItemIndicator('soft-fail');
			console.warn('[keyItemUsed] failed:', data.reason);
		} else {
			console.warn('[keyItemUsed] failed:', data.reason);
		}
	});

	s.on(SERVER_TO_CLIENT.CARD_EVOLUTION_RESULT, (data) => {
		if (!data) return;
		ctx.lastEvolutionResult = data;
		if (data.selectedDeck) ctx.mySelectedDeck = data.selectedDeck;
		if (Array.isArray(data.inventory)) ctx.myInventory = data.inventory;
		if (data.ownedCards) ctx.myOwnedCards = data.ownedCards;
		ctx.renderDeckEditor();
	});

	s.on(SERVER_TO_CLIENT.CARD_EVOLUTION_ERROR, (data) => {
		if (!data || !data.reason) return;
		ctx.showDeckError(data.reason);
	});

	s.on(SERVER_TO_CLIENT.QUEST_ERROR, (data) => {
		if (!data || !data.reason) return;
		const reason = data.reason === 'suspended_checkpoint'
			? ctx.THEME.run.questSuspendedLocked
			: data.reason;
		ctx.showQuestError(reason);
	});

	s.on(SERVER_TO_CLIENT.CARD_INVENTORY_UPDATE, (data) => {
		if (!data) return;
		if (data.selectedDeck) ctx.mySelectedDeck = data.selectedDeck;
		if (Array.isArray(data.inventory)) ctx.myInventory = data.inventory;
		if (data.ownedCards) ctx.myOwnedCards = data.ownedCards;
		if (Number.isFinite(data.currency)) {
			ctx.myCurrency = data.currency;
			ctx.updateCurrencyHud(ctx.myCurrency);
		}
		ctx.renderDeckEditor();
		if (ctx.activeLobbyTab === 'forge') ctx.renderPhotonForge();
		if (ctx.activeLobbyTab === 'shop') ctx.renderCardShop();
	});

	s.on(SERVER_TO_CLIENT.CARD_GRIND_RESULT, (data) => {
		if (!data) return;
		if (data.selectedDeck) ctx.mySelectedDeck = data.selectedDeck;
		if (Array.isArray(data.inventory)) ctx.myInventory = data.inventory;
		if (data.ownedCards) ctx.myOwnedCards = data.ownedCards;
		if (Number.isFinite(data.currency)) {
			ctx.myCurrency = data.currency;
			ctx.updateCurrencyHud(ctx.myCurrency);
		}
		ctx.renderDeckEditor();
		if (ctx.activeLobbyTab === 'forge') {
			ctx.renderPhotonForge();
			ctx.playForgeAttuneAnimation(data.instance && data.instance.instanceId);
		}
	});

	s.on(SERVER_TO_CLIENT.CARD_GRIND_ERROR, (data) => {
		if (!data || !data.reason) return;
		if (ctx.activeLobbyTab === 'forge') ctx.showForgeError(data.reason);
		else ctx.showDeckError(data.reason);
	});

	s.on(SERVER_TO_CLIENT.HAT_UNLOCKED, (data) => {
		if (!data) return;
		// Record the unlock and refreshed currency from the server (never
		// optimistically before this event), then re-render the hat list so the
		// newly unlocked hat becomes an equippable (owned) entry.
		ctx.setUnlockedHats(data.unlockedHats);
		if (Number.isFinite(data.currency)) {
			ctx.myCurrency = data.currency;
			ctx.updateCurrencyHud(ctx.myCurrency);
		}
		ctx.rebuildBoothHatList();
	});

	s.on(SERVER_TO_CLIENT.HAT_ERROR, (data) => {
		const message = data && data.reason ? data.reason : 'Unlock failed';
		ctx.showBoothCosmeticError(message);
	});

	s.on(SERVER_TO_CLIENT.APPEARANCE_CHANGED, (data) => {
		if (!data) return;
		if (data.cosmetic) {
			ctx.setAccountCosmetic(data.cosmetic);
		}
		if (Number.isFinite(data.currency)) {
			ctx.myCurrency = data.currency;
			ctx.updateCurrencyHud(ctx.myCurrency);
			if (ctx.myId && ctx.gameState?.players?.[ctx.myId]) {
				ctx.gameState.players[ctx.myId].currency = data.currency;
			}
		}
		if (data.cosmetic && ctx.myId && ctx.gameState?.players?.[ctx.myId]) {
			ctx.gameState.players[ctx.myId].cosmetic = ctx.getAccountCosmetic();
			ctx.setGameStateRef(ctx.gameState);
		}
		ctx.handleAppearanceChanged();
	});

	s.on(SERVER_TO_CLIENT.APPEARANCE_ERROR, (data) => {
		const reason = data && data.reason ? data.reason : 'Appearance save failed';
		let message = reason;
		if (reason === 'insufficient_gold' || /not enough/i.test(reason)) {
			message = /need \d+/i.test(reason)
				? reason
				: `Not enough money (need ${ctx.formatCurrencyPrice(ctx.APPEARANCE_CHANGE_COST)})`;
		}
		if (ctx.isCharacterBoothOpen()) {
			ctx.showBoothCosmeticError(message);
			ctx.handleAppearanceError();
		}
	});

	s.on(SERVER_TO_CLIENT.TRADE_OFFER, (data) => {
		if (!data || !data.tradeId) return;
		ctx.pendingTradeOffer = data;
		ctx.renderTradeOffer();
	});

	s.on(SERVER_TO_CLIENT.TRADE_UPDATE, (data) => {
		if (!data) return;
		if (data.status === 'accepted' || data.status === 'rejected') {
			if (ctx.pendingTradeOffer && ctx.pendingTradeOffer.tradeId === data.tradeId) {
				ctx.pendingTradeOffer = null;
			}
			ctx.renderTradeOffer();
		}
	});

	s.on(SERVER_TO_CLIENT.PLAYER_RECONNECTED, (reconnectedId) => {
		if (reconnectedId === ctx.myId) {
			console.log('[network] player reconnected');
		}
	});

	s.on(SERVER_TO_CLIENT.LOBBY_UPDATE, (data) => {
		ctx.renderPlayerList(data.players);
		ctx.renderTradeForm(data.players);
		if (data.players && ctx.myId) {
			const me = data.players.find((p) => p.id === ctx.myId);
			if (me) {
				const wasReady = ctx.isReady;
				const hadPending = ctx.launchReadyPending;
				ctx.isReady = me.ready;
				if (hadPending) {
					ctx.launchReadyPending = false;
					if (me.ready && !wasReady) {
						ctx.confirmLaunchReadyUp();
					}
				}
			}
		}
		if (data.quests || data.questVariants || data.selectedQuestId || data.unlockedQuestTiers || data.levelUnlockGraph) {
			ctx.applyQuestBoardFromPayload(data);
		}
		if ('shopOffer' in data && ctx.gameState) {
			ctx.gameState.shopOffer = data.shopOffer;
			if (ctx.activeLobbyTab === 'shop') ctx.renderCardShop();
		}
	});

	s.on(SERVER_TO_CLIENT.QUEST_UPDATE, (data) => {
		if (!data) return;
		if (data.quests || data.questVariants || data.selectedQuestId || data.unlockedQuestTiers || data.levelUnlockGraph) {
			ctx.applyQuestBoardFromPayload(data);
		}
		ctx.applyQuestLayoutFromServer(data);
	});

	s.on(SERVER_TO_CLIENT.QUEST_DIALOGUE, (data) => {
		if (!data || typeof data.line !== 'string') return;
		ctx.showQuestDialogueToast(data.line, data.speaker);
	});
}
