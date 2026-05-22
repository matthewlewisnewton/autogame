// v8 ignore start
// All code below is UI/Three.js/Socket-dependent and cannot be unit tested.
// Testable logic is extracted to cards.js, collision.js, and hand.js.

import {
	formatObjectiveSummary,
	formatRewardSummary,
	renderQuestBoard,
} from './questBoard.js';
import { io } from 'socket.io-client';
import { CARD_DEFS, CARD_TYPE_STYLE, CARD_ACCENT_STYLE, EVOLUTION_GRIND_REQUIRED, EVOLUTION_TRANSFORMS, getCardSellValue, getGrindCost, weaponCardIds, summonCardIds, monsterCardIds } from './cards.js';
import {
	MAX_CARD_LEVEL,
	getUpgradeCost,
	canAffordUpgrade,
	getForgeStatPreview,
} from './cardUpgrades.js';
import { drawCard, initHand as initHandFromModule, hand, deck, slotCooldowns, canUseSlot, setDrawPile } from './hand.js';
import {
	buildDeckMiniEntries,
	computeRunDeckTotal,
	deckIdsForDisplay,
	formatDeckCountLabel,
	getDeckStackLayerCount,
} from './deck-viewer.js';
import {
	playSound,
	isSoundEnabled,
	setSoundEnabled,
	resumeAudioContext,
	getAudioContext,
	setAudioContext,
	loadSoundEnabled,
	saveSoundEnabled,
	_soundLogEnabled,
	_playSoundCallLog,
} from './audio.js';
import {
	DECK_MIN_SIZE,
	DECK_MAX_SIZE,
	MAX_HP,
	MAX_MS,
} from './config.js';
import {
	computeDeckHudStats,
	formatCharacterId,
	formatPlayerLevel,
	getHpBarTier,
} from './vanguard-hud.js';

// ── Renderer module imports ──
import {
	initScene as rendererInitScene,
	setGameStateRef,
	setMyId as rendererSetMyId,
	setSocketRef,
	setGamePhase,
	getScene,
	getCamera,
	getRenderer,
	getMeshMaps,
	isSceneInitialized,
	getSpawnPosition,
	getPlayerPosition,
	setPlayerPosition,
	getPlayerRotation,
	setPlayerRotation,
	getWasDead,
	setWasDead,
	flashMesh as rendererFlashMesh,
	spawnDamageNumber as rendererSpawnDamageNumber,
	spawnHitSpark as rendererSpawnHitSpark,
	createEnemyMesh as rendererCreateEnemyMesh,
	enemyMeshHalfHeight as rendererEnemyMeshHalfHeight,
	healthBarColor as rendererHealthBarColor,
	createHealthBarMesh as rendererCreateHealthBarMesh,
	updateHealthBarMesh as rendererUpdateHealthBarMesh,
	applyWindupFlash as rendererApplyWindupFlash,
	spawnAttackEffect as rendererSpawnAttackEffect,
	spawnSummonEffect as rendererSpawnSummonEffect,
	markLootCollected as rendererMarkLootCollected,
	disposeMeshMap as rendererDisposeMeshMap,
	disposeStaleMeshes as rendererDisposeStaleMeshes,
	disposeOne as rendererDisposeOne,
	disposeAllLootMeshes as rendererDisposeAllLootMeshes,
	getActiveEffects,
	getPickedUpLootIds,
	getWindupFlashing,
} from './renderer.js';
// ── DOM element references ──
const statusEl = document.getElementById('status');
const lobbyPlayerList = document.getElementById('lobby-player-list');
const questBoardEl = document.getElementById('quest-board');
const questErrorEl = document.getElementById('quest-error');
const readyBtn = document.getElementById('ready-btn');
const lobbyEl = document.getElementById('lobby');
const uiEl = document.getElementById('ui');
const logoutBtn = document.getElementById('logout-btn');
const cardHandEl = document.getElementById('card-hand');
const deckStackEl = document.getElementById('deck-stack');
const deckViewerOverlayEl = document.getElementById('deck-viewer-overlay');
const deckViewerGridEl = document.getElementById('deck-viewer-grid');
const deckViewerCountEl = document.getElementById('deck-viewer-count');

// ── Auth overlay elements ──
const authOverlayEl = document.getElementById('auth-overlay');
const registerFormEl = document.getElementById('register-form');
const loginFormEl = document.getElementById('login-form');
const registerBtnEl = document.getElementById('register-btn');
const loginBtnEl = document.getElementById('login-btn');
const registerErrorEl = document.getElementById('register-error');
const loginErrorEl = document.getElementById('login-error');
const showLoginLinkEl = document.getElementById('show-login-link');
const showRegisterLinkEl = document.getElementById('show-register-link');

const TOKEN_KEY = 'autogame_token';

/** Show the auth overlay and hide the lobby. */
function showAuthOverlay() {
	if (authOverlayEl) authOverlayEl.classList.remove('hidden');
	if (lobbyEl) lobbyEl.classList.add('hidden');
}

/** Hide the auth overlay and show the lobby. */
function hideAuthOverlay() {
	if (authOverlayEl) authOverlayEl.classList.add('hidden');
	if (lobbyEl) lobbyEl.classList.remove('hidden');
}

/** Show the registration form and hide the login form. */
function showRegisterForm() {
	if (registerFormEl) registerFormEl.classList.remove('hidden');
	if (loginFormEl) loginFormEl.classList.add('hidden');
	if (registerErrorEl) registerErrorEl.textContent = '';
}

/** Show the login form and hide the registration form. */
function showLoginForm() {
	if (loginFormEl) loginFormEl.classList.remove('hidden');
	if (registerFormEl) registerFormEl.classList.add('hidden');
	if (loginErrorEl) loginErrorEl.textContent = '';
}

/** Clear form inputs and error messages. */
function clearAuthForms() {
	const inputs = authOverlayEl ? authOverlayEl.querySelectorAll('input') : [];
	inputs.forEach((i) => (i.value = ''));
	if (registerErrorEl) registerErrorEl.textContent = '';
	if (loginErrorEl) loginErrorEl.textContent = '';
}

const hpBarFill = document.getElementById('hp-bar-fill');
const hpText = document.getElementById('hp-text');
const hpLabel = document.getElementById('hp-label');
const msBarFill = document.getElementById('ms-bar-fill');
const msText = document.getElementById('ms-text');
const msLabel = document.getElementById('ms-label');
const characterIdEl = document.getElementById('character-id');
const playerLevelEl = document.getElementById('player-level');
const deckCountEl = document.getElementById('deck-count');
const deckWeaponCountEl = document.getElementById('deck-weapon-count');
const deckSummonCountEl = document.getElementById('deck-summon-count');
const deckMonsterCountEl = document.getElementById('deck-monster-count');
const objectiveHudEl = document.getElementById('objective-hud');
const runSummaryOverlay = document.getElementById('run-summary-overlay');
const summaryStatusEl = document.getElementById('summary-status');
const summaryQuestEl = document.getElementById('summary-quest');
const summaryDurationEl = document.getElementById('summary-duration');
const summaryEnemiesEl = document.getElementById('summary-enemies');
const summaryCurrencyEl = document.getElementById('summary-currency');
const summaryRewardsCurrencyEl = document.getElementById('summary-rewards-currency');
const summaryRewardsCardsEl = document.getElementById('summary-rewards-cards');
const summaryCardChoicesEl = document.getElementById('summary-card-choices');
const summaryCardChoicesListEl = document.getElementById('summary-card-choices-list');
const summaryCardChoicesEmptyEl = document.getElementById('summary-card-choices-empty');
const returnToLobbyBtn = document.getElementById('return-to-lobby-btn');
const cardSlots = document.querySelectorAll('.card-slot');

const debugScenario = new URLSearchParams(window.location.search).get('debugScenario');
const debugScenarioAllowed = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
let debugScenarioRequested = false;
let debugScenarioResult = null;
let lastUsedSlot = -1; // tracks the most recently clicked/pressed slot index for cardError targeting

// ── Socket setup ──
const STORAGE_KEY_PLAYER_ID = 'autogame_playerId';
const storedPlayerId = (() => {
	try { return localStorage.getItem(STORAGE_KEY_PLAYER_ID); } catch (_) { return null; }
})();
const storedToken = (() => {
	try { return localStorage.getItem(TOKEN_KEY); } catch (_) { return null; }
})();

let socket = null;

/** Create (or recreate) the Socket.IO connection with a JWT auth token. */
function createSocket(token) {
	if (socket) socket.disconnect();
	socket = io({ auth: { token } });
	setSocketRef(socket);
	bindSocketHandlers(socket);
}

/** Bind all Socket.IO event listeners to the given socket instance. */
function bindSocketHandlers(s) {
	if (!s) return;

	s.on('connect', () => {
		updateStatus('Connected', 'connected');
		startHeartbeat();
	});

	s.on('disconnect', () => {
		stopHeartbeat();
		updateStatus('Disconnected', 'disconnected');
		rendererDisposeAllLootMeshes();
	});

	s.io.on('reconnect_attempt', () => {
		updateStatus('Reconnecting...', 'reconnecting');
	});

	s.io.on('reconnect', () => {
		updateStatus('Connected', 'connected');
		startHeartbeat();
	});

	s.on('connect_error', () => {
		try { localStorage.removeItem(TOKEN_KEY); } catch (_) {}
		stopHeartbeat();
		s.io.disconnect();
		if (uiEl) uiEl.style.display = 'none';
		if (cardHandEl) cardHandEl.style.display = 'none';
		setDeckStackVisible(false);
		if (lobbyEl) lobbyEl.classList.add('hidden');
		if (runSummaryOverlay) runSummaryOverlay.style.display = 'none';
		showAuthOverlay();
		showLoginForm();
		updateStatus('Session expired — please log in again', 'disconnected');
	});

	s.on('init', (data) => {
		myId = data.id;
		rendererSetMyId(data.id);
		setGameStateRef(gameState);
		if (data.playerId) {
			try { localStorage.setItem(STORAGE_KEY_PLAYER_ID, data.playerId); } catch (_) {}
		}
		gameState = data.state;
		currentLayout = data.layout || (data.state && data.state.layout) || currentLayout;
		if (gameState && currentLayout) gameState.layout = currentLayout;

		// Initialize deck editor state from server
		mySelectedDeck = data.selectedDeck || [];
		myInventory = Array.isArray(data.inventory) ? data.inventory : null;
		myOwnedCards = data.ownedCards || {};
		if (data.state && data.state.players && data.state.players[myId]) {
			myCurrency = data.state.players[myId].currency || 0;
		}
		renderDeckEditor();
		applyQuestBoardState(data.quests, data.selectedQuestId || (data.state && data.state.selectedQuestId));
		if (activeLobbyTab === 'forge') renderPhotonForge();

		// Auth: display username and show logout button if logged in
		if (data.accountId) {
			const username = data.username || data.accountId;
			if (statusEl) statusEl.textContent = `Logged in as ${username}`;
			if (logoutBtn) logoutBtn.classList.remove('hidden');
			if (lobbyEl) lobbyEl.classList.remove('hidden');
		}

		// Layout consistency check
		const receivedSeed = data.layoutSeed;

		if (isSceneInitialized() && receivedSeed !== undefined) {
			if (receivedSeed !== currentLayoutSeed) {
				console.warn(`[layout] Seed changed from ${currentLayoutSeed} to ${receivedSeed}; keeping existing geometry`);
				currentLayoutSeed = receivedSeed;
			}
			// Same seed — dungeon geometry already exists, skip redundant rebuild.
			// Reset local player position to spawn
			const spawnPos = getSpawnPosition();
			setPlayerPosition(spawnPos.x, spawnPos.z);
			requestDebugScenario();
			return;
		}

		// Fresh connect path
		currentLayoutSeed = receivedSeed;
		requestDebugScenario();

		// If the server is already in 'playing' phase, skip the lobby entirely
		if (data.state && data.state.gamePhase === 'playing') {
			if (isSceneInitialized()) return;
			lobbyEl.classList.add('hidden');
			uiEl.style.display = 'block';
			cardHandEl.style.display = 'flex';
			setDeckStackVisible(true);
			initHand();
			rendererInitScene(currentLayout, getSpawnPosition());
			updateObjectiveHud();
			setGamePhase('playing');
			return;
		}

		updateObjectiveHud();
	});

	s.on('stateUpdate', (state) => {
		// Verify layout seed consistency on every state update
		if (currentLayoutSeed !== null && state.layoutSeed !== undefined && state.layoutSeed !== currentLayoutSeed) {
			console.warn(`[layout] Seed mismatch: local=${currentLayoutSeed} server=${state.layoutSeed}`);
			currentLayoutSeed = state.layoutSeed;
		}
		gameState = state;
		setGameStateRef(state);
		if (gameState && currentLayout) gameState.layout = currentLayout;

		// Return to lobby: switch UI back to lobby view
		if (state.gamePhase === 'lobby') {
			if (runSummaryOverlay) runSummaryOverlay.style.display = 'none';
			if (uiEl) uiEl.style.display = 'none';
			if (cardHandEl) cardHandEl.style.display = 'none';
			setDeckStackVisible(false);
			if (lobbyEl) lobbyEl.classList.remove('hidden');
			renderDeckEditor();
			applyQuestBoardState(null, state.selectedQuestId);
			setGamePhase('lobby');
		}

		// Entering gameplay: ensure HUD is visible
		if (state.gamePhase === 'playing') {
			if (uiEl) uiEl.style.display = 'block';
			if (cardHandEl) cardHandEl.style.display = 'flex';
			setDeckStackVisible(true);
			if (lobbyEl) lobbyEl.classList.add('hidden');
			setGamePhase('playing');
		}

		// Update Vanguard HUD (HP, MS, deck stats, portrait)
		if (myId && gameState.players[myId] && state.gamePhase === 'playing') {
			const me = gameState.players[myId];
			updateHpBar(me.hp);
			updateMsBar(me.magicStones);
			updateDeckStats(me.deck, me.hand);
			updateVanguardPortrait();
		}

		// Update currency HUD
		if (myId && gameState.players[myId]) {
			const currencyEl = document.getElementById('currency-display');
			if (currencyEl) {
				const newCurrency = gameState.players[myId].currency;
				const oldCurrency = _lastCurrency;
				_lastCurrency = newCurrency;
				currencyEl.textContent = `GOLD ${newCurrency}`;

				// Flash the currency display when it increases
				if (oldCurrency !== undefined && newCurrency > oldCurrency) {
					currencyEl.style.transition = 'none';
					currencyEl.style.color = '#ffd700';
					currencyEl.style.transform = 'scale(1.2)';
					requestAnimationFrame(() => {
						currencyEl.style.transition = 'color 0.4s, transform 0.4s';
						currencyEl.style.color = '';
						currencyEl.style.transform = 'scale(1)';
					});
					playSound('loot');
				}
			}

			// Sync inventory/ownedCards from server state if present
			if (Array.isArray(gameState.players[myId].inventory)) {
				myInventory = gameState.players[myId].inventory;
			}
			if (gameState.players[myId].ownedCards) {
				myOwnedCards = gameState.players[myId].ownedCards;
			}
			if (Array.isArray(gameState.players[myId].inventory)) {
				myInventory = gameState.players[myId].inventory;
			}
			if (activeLobbyTab === 'forge') renderPhotonForge();
		}

		// Update objective HUD
		updateObjectiveHud();

		// Reconcile hand with server authority + re-render for .no-ms / .empty classes
		if (state.gamePhase === 'playing' && myId && state.players[myId] && state.players[myId].hand) {
			const serverHand = state.players[myId].hand;
			let changed = false;
			for (let i = 0; i < 4; i++) {
				const serverCard = serverHand[i];
				const localCard = hand[i];
				if (!serverCard && !localCard) continue;
				if (!serverCard || !localCard || localCard.id !== serverCard.id ||
					localCard.remainingCharges !== serverCard.remainingCharges ||
					localCard.charges !== serverCard.charges) {
					hand[i] = serverCard ? { ...serverCard } : null;
					changed = true;
				}
			}
			if (changed) renderHand();
		} else if (state.gamePhase === 'playing') {
			renderHand();
		}

		if (state.gamePhase === 'playing' && myId && state.players[myId]) {
			syncDrawPileFromServer();
		}

		// Prune pickedUpLootIds: remove any IDs no longer present in gameState.loot
		if (state.loot && Array.isArray(state.loot)) {
			const currentLootIds = new Set(state.loot.map((l) => l.id));
			const pickedUpSet = getPickedUpLootIds();
			for (const id of pickedUpSet) {
				if (!currentLootIds.has(id)) {
					pickedUpSet.delete(id);
				}
			}
		}

		// Client prediction reconciliation
		if (state.gamePhase === 'playing' && myId && gameState.players[myId]) {
			const serverPlayer = gameState.players[myId];
			if (!serverPlayer.dead) {
				const pos = getPlayerPosition();
				const dx = serverPlayer.x - pos.x;
				const dz = serverPlayer.z - pos.z;
				const drift = Math.hypot(dx, dz);
				if (drift > 0.5) {
					setPlayerPosition(serverPlayer.x, serverPlayer.z);
				}
			}
		}
	});

	s.on('heartbeat_ack', (data) => {
		if (connectionState === 'connected') {
			latency = data.latency;
			statusEl.innerText = `Latency: ${latency}ms`;
		}
	});

	s.on('debugScenarioResult', (data) => {
		debugScenarioResult = data || null;
		if (data && data.ok) {
			console.log(`[debugScenario] applied ${data.scenario}`);
		} else if (data && data.reason) {
			console.warn(`[debugScenario] ${data.reason}`);
		}
	});

	s.on('playerDisconnected', (id) => {
		const maps = getMeshMaps();
		if (maps.playersMeshes[id]) {
			const sc = getScene();
			if (sc) sc.remove(maps.playersMeshes[id]);
			delete maps.playersMeshes[id];
		}
	});

	s.on('cardUsed', (data) => {
		if (!data || !getScene()) return;
		playSound('card');
		if (weaponCardIds.has(data.cardId)) {
			const origin = data.origin || { x: 0, z: 0 };
			const direction = data.direction || { x: 1, z: 0 };
			rendererSpawnAttackEffect(origin, direction);
		}
		if (summonCardIds.has(data.cardId) && data.radius !== undefined) {
			const origin = data.origin || { x: 0, z: 0 };
			const accent = CARD_ACCENT_STYLE[data.cardId];
			const colorHex = accent?.color ? parseInt(accent.color.slice(1), 16) : undefined;
			rendererSpawnSummonEffect(origin, data.radius, colorHex);
		}
		if (data.hpHealed > 0 && data.playerId === myId) {
			playSound('loot');
		}
		if (data.hits && data.hits.length > 0) {
			playSound('enemyHit');
			const maps = getMeshMaps();
			for (const hit of data.hits) {
				const mesh = maps.enemiesMeshes[hit.enemyId];
				if (mesh) {
					rendererFlashMesh(mesh, 0xffffff, 200);
				}
			}
		}
	});

	s.on('cardError', (data) => {
		if (!data || !data.reason) return;
		showCardErrorToast(data.reason);
		if (data.reason === 'Not enough Magic Stones' && lastUsedSlot >= 0) {
			const slot = cardSlots[lastUsedSlot];
			if (slot) slot.classList.add('no-ms');
		}
		lastUsedSlot = -1;
	});

	s.on('deckUpdate', (data) => {
		if (!data) return;
		if (data.selectedDeck) mySelectedDeck = data.selectedDeck;
		if (Array.isArray(data.inventory)) myInventory = data.inventory;
		if (data.ownedCards) myOwnedCards = data.ownedCards;
		if (Number.isFinite(data.currency)) {
			myCurrency = data.currency;
			const currencyEl = document.getElementById('currency-display');
			if (currencyEl) currencyEl.textContent = `GOLD ${myCurrency}`;
		}
		renderDeckEditor();
		if (activeLobbyTab === 'forge') renderPhotonForge();
	});

	s.on('deckError', (data) => {
		if (!data || !data.reason) return;
		showDeckError(data.reason);
	});

	s.on('cardEvolutionResult', (data) => {
		if (!data) return;
		if (data.selectedDeck) mySelectedDeck = data.selectedDeck;
		if (Array.isArray(data.inventory)) myInventory = data.inventory;
		if (data.ownedCards) myOwnedCards = data.ownedCards;
		renderDeckEditor();
	});

	s.on('cardUpgradeResult', (data) => {
		if (!data) return;
		if (data.selectedDeck) mySelectedDeck = data.selectedDeck;
		if (Array.isArray(data.inventory)) myInventory = data.inventory;
		if (data.ownedCards) myOwnedCards = data.ownedCards;
		if (gameState && myId && gameState.players[myId] && Number.isFinite(data.currency)) {
			gameState.players[myId].currency = data.currency;
			const currencyEl = document.getElementById('currency-display');
			if (currencyEl) currencyEl.textContent = `GOLD ${data.currency}`;
			_lastCurrency = data.currency;
		}
		renderDeckEditor();
		if (activeLobbyTab === 'forge') {
			renderPhotonForge();
			playForgeUpgradeAnimation(data.instance && data.instance.instanceId);
		}
	});

	s.on('cardUpgradeError', (data) => {
		if (!data || !data.reason) return;
		showForgeError(data.reason);
	});

	s.on('cardEvolutionError', (data) => {
		if (!data || !data.reason) return;
		showDeckError(data.reason);
	});

	s.on('questError', (data) => {
		if (!data || !data.reason) return;
		showQuestError(data.reason);
	});

	s.on('cardInventoryUpdate', (data) => {
		if (!data) return;
		if (data.selectedDeck) mySelectedDeck = data.selectedDeck;
		if (Array.isArray(data.inventory)) myInventory = data.inventory;
		if (data.ownedCards) myOwnedCards = data.ownedCards;
		if (Number.isFinite(data.currency)) myCurrency = data.currency;
		renderDeckEditor();
		if (activeLobbyTab === 'forge') renderPhotonForge();
	});

	s.on('cardGrindResult', (data) => {
		if (!data) return;
		if (data.selectedDeck) mySelectedDeck = data.selectedDeck;
		if (Array.isArray(data.inventory)) myInventory = data.inventory;
		if (data.ownedCards) myOwnedCards = data.ownedCards;
		if (Number.isFinite(data.currency)) {
			myCurrency = data.currency;
			const currencyEl = document.getElementById('currency-display');
			if (currencyEl) currencyEl.textContent = `GOLD ${myCurrency}`;
		}
		renderDeckEditor();
		if (activeLobbyTab === 'forge') renderPhotonForge();
	});

	s.on('cardGrindError', (data) => {
		if (!data || !data.reason) return;
		showDeckError(data.reason);
	});

	s.on('tradeOffer', (data) => {
		if (!data || !data.tradeId) return;
		pendingTradeOffer = data;
		renderTradeOffer();
	});

	s.on('tradeUpdate', (data) => {
		if (!data) return;
		if (data.status === 'accepted' || data.status === 'rejected') {
			if (pendingTradeOffer && pendingTradeOffer.tradeId === data.tradeId) {
				pendingTradeOffer = null;
			}
			renderTradeOffer();
		}
	});

	s.on('lobbyUpdate', (data) => {
		renderPlayerList(data.players);
		renderTradeForm(data.players);
		if (data.players && myId) {
			const me = data.players.find((p) => p.id === myId);
			if (me) {
				isReady = me.ready;
				readyBtn.textContent = isReady ? 'Ready!' : 'Ready';
			}
		}
		if (data.quests || data.selectedQuestId) {
			applyQuestBoardState(data.quests, data.selectedQuestId);
		}
	});

	s.on('questUpdate', (data) => {
		if (data && (data.quests || data.selectedQuestId)) {
			applyQuestBoardState(data.quests, data.selectedQuestId);
		}
	});

	s.on('questError', (data) => {
		if (!data || !data.reason) return;
		showQuestError(data.reason);
	});

	s.on('startGame', () => {
		claimedCardRewardId = null;
		currentCardChoices = [];
		lobbyEl.classList.add('hidden');
		uiEl.style.display = 'block';
		cardHandEl.style.display = 'flex';
		setDeckStackVisible(true);
		updateObjectiveHud();
		if (!isSceneInitialized()) {
			initHand();
			rendererInitScene(currentLayout, getSpawnPosition());
			setGamePhase('playing');
			return;
		}
		initHand();
		const spawnPos = getSpawnPosition();
		setPlayerPosition(spawnPos.x, spawnPos.z);
		setPlayerRotation(0);
		setWasDead(false);

		const sc = getScene();
		const maps = getMeshMaps();
		rendererDisposeMeshMap(maps.enemiesMeshes, sc);
		rendererDisposeMeshMap(maps.enemyHealthBars, sc);
		rendererDisposeMeshMap(maps.telegraphMeshes, sc);
		rendererDisposeMeshMap(maps.minionsMeshes, sc);
		rendererDisposeAllLootMeshes();
	});

	s.on('runComplete', showRunSummary);
	s.on('runFailed', showRunSummary);

	s.on('cardRewardClaimed', (data) => {
		if (!data || !data.cardId) return;
		claimedCardRewardId = data.cardId;
		if (data.ownedCards) myOwnedCards = data.ownedCards;
		if (data.inventory) myInventory = data.inventory;
		renderCardChoices(currentCardChoices);
	});
}

// On page load: only connect if we have a stored token; otherwise show auth overlay.
if (storedToken) {
	createSocket(storedToken);
	hideAuthOverlay();
} else {
	showAuthOverlay();
	showRegisterForm();
}

let myId = null;
let isReady = false;
let gameState = null;
let connectionState = 'connecting';
let heartbeatTimer = null;
let latency = null;
let currentLayoutSeed = null; // tracks the layout seed we last built from
let currentLayout = null; // persisted layout from init; stateUpdate omits it

// Deck editor state
let mySelectedDeck = [];
let myInventory = null;
let myOwnedCards = {};
let availableQuests = [];
let selectedQuestId = 'training_caverns';
let currentCardChoices = [];
let claimedCardRewardId = null;
let myCurrency = 0;
let pendingTradeOffer = null;
let runDeckTotal = 0;
let deckViewerOpen = false;
let _lastCurrency = undefined; // tracks previous currency value for flash-on-increase

function applyQuestBoardState(quests, questId) {
	if (Array.isArray(quests)) availableQuests = quests;
	if (typeof questId === 'string') selectedQuestId = questId;
	renderQuestBoardState();
}

function renderQuestBoardState() {
	renderQuestBoard(questBoardEl, availableQuests, selectedQuestId, (questId) => {
		if (!socket) return;
		socket.emit('selectQuest', { questId });
	});
	if (questErrorEl) {
		questErrorEl.style.display = 'none';
		questErrorEl.textContent = '';
	}
}

function showQuestError(message) {
	if (!questErrorEl) return;
	questErrorEl.textContent = message;
	questErrorEl.style.display = 'block';
}

function requestDebugScenario() {
	if (!debugScenario || !debugScenarioAllowed || debugScenarioRequested) return;
	debugScenarioRequested = true;
	socket.emit('debugScenario', { name: debugScenario });
}

function startHeartbeat() {
	if (heartbeatTimer) return;
	heartbeatTimer = setInterval(() => {
		socket.emit('heartbeat', { type: 'heartbeat', timestamp: Date.now() });
	}, 2000);
}

function stopHeartbeat() {
	clearInterval(heartbeatTimer);
	heartbeatTimer = null;
}

function updateStatus(text, state) {
	connectionState = state;
	statusEl.innerText = text;
	statusEl.className = state;
}

function updateHpBar(hp) {
	const clamped = Math.max(0, Math.min(MAX_HP, hp));
	const pct = (clamped / MAX_HP) * 100;
	if (hpBarFill) {
		hpBarFill.style.width = `${pct}%`;
		hpBarFill.classList.remove('hp-high', 'hp-mid', 'hp-low');
		hpBarFill.classList.add(getHpBarTier(pct));
	}
	if (hpText) hpText.textContent = `${clamped}/${MAX_HP}`;
	if (hpLabel) hpLabel.textContent = 'HP';
}

function updateMsBar(ms) {
	const clamped = Math.max(0, Math.min(MAX_MS, ms));
	const pct = (clamped / MAX_MS) * 100;
	if (msBarFill) msBarFill.style.width = `${pct}%`;
	if (msText) msText.textContent = `${Math.floor(clamped)}/${MAX_MS}`;
	if (msLabel) msLabel.textContent = 'MS';
}

function updateDeckStats(deck, handCards) {
	const stats = computeDeckHudStats(deck, handCards);
	if (deckCountEl) deckCountEl.textContent = stats.label;
	if (deckWeaponCountEl) deckWeaponCountEl.textContent = String(stats.types.weapon);
	if (deckSummonCountEl) deckSummonCountEl.textContent = String(stats.types.summon);
	if (deckMonsterCountEl) deckMonsterCountEl.textContent = String(stats.types.monster);
}

function updateVanguardPortrait() {
	if (characterIdEl) characterIdEl.textContent = formatCharacterId(myId);
	if (playerLevelEl) playerLevelEl.textContent = String(formatPlayerLevel());
}

function updateObjectiveHud() {
	if (!objectiveHudEl) return;

	const run = (gameState && gameState.run) || null;

	if (gameState && gameState.gamePhase === 'playing' && run && run.objective) {
		const obj = run.objective;
		objectiveHudEl.textContent = `${obj.label}\nDefeated ${obj.defeatedEnemies} / ${obj.totalEnemies}`;
		objectiveHudEl.style.display = 'block';
	} else {
		objectiveHudEl.style.display = 'none';
	}
}

function clearAdjacentCardHighlights() {
	for (const slot of cardSlots) {
		slot.classList.remove('synergy-adjacent');
	}
}

function updateAdjacentCardHighlights(sourceIndex) {
	clearAdjacentCardHighlights();
	const card = hand[sourceIndex];
	const def = card ? CARD_DEFS[card.id] : null;
	if (!def || !def.adjacentChargeRestore) return;

	for (const adjacentIndex of [sourceIndex - 1, sourceIndex + 1]) {
		if (adjacentIndex < 0 || adjacentIndex > 3) continue;
		if (!hand[adjacentIndex]) continue;
		const slot = cardSlots[adjacentIndex];
		if (slot) slot.classList.add('synergy-adjacent');
	}
}

function renderHand() {
	const playerMs = (gameState && myId && gameState.players[myId])
		? gameState.players[myId].magicStones
		: 0;

	clearAdjacentCardHighlights();
	for (let i = 0; i < 4; i++) {
		const slot = cardSlots[i];
		const card = hand[i];

		if (card) {
			const style = CARD_ACCENT_STYLE[card.id] || CARD_TYPE_STYLE[card.type] || CARD_TYPE_STYLE.weapon;
			slot.style.setProperty('--slot-color', style.color);
			const evolvedBadge = card.isEvolved ? '<span class="evolved-badge">Evolved</span>' : '';
			const grindBadge = (card.grind || 0) > 0 ? `<span class="grind-badge">+${card.grind}</span>` : '';
			const effectText = card.specialEffect ? `<span class="card-effect">${card.specialEffect.replace(/_/g, ' ')}</span>` : '';
			slot.innerHTML = `
				<span class="card-icon">${style.icon}</span>
				<span class="card-name">${card.name}</span>
				${evolvedBadge}
				${grindBadge}
				${effectText}
				<span class="card-charges">${card.remainingCharges}/${card.charges}</span>
			`;
			slot.classList.remove('empty');
			slot.classList.toggle('evolved-card', !!card.isEvolved);
			slot.dataset.cardType = card.type;

			const cardCost = card.magicStoneCost ?? CARD_DEFS[card.id]?.magicStoneCost;
			if (cardCost != null && cardCost > 0 && playerMs < cardCost) {
				slot.classList.add('no-ms');
			} else {
				slot.classList.remove('no-ms');
			}
		} else {
			slot.style.removeProperty('--slot-color');
			slot.innerHTML = '<span class="card-name">&mdash;</span>';
			slot.classList.add('empty');
			slot.classList.remove('evolved-card');
			slot.classList.remove('no-ms');
			delete slot.dataset.cardType;
		}
	}
}

function updateRunDeckTotal() {
	const serverPlayer = gameState && myId && gameState.players[myId];
	if (serverPlayer && Array.isArray(serverPlayer.selectedDeck) && serverPlayer.selectedDeck.length > 0) {
		runDeckTotal = serverPlayer.selectedDeck.length;
		return;
	}
	if (mySelectedDeck.length > 0) {
		runDeckTotal = mySelectedDeck.length;
		return;
	}
	runDeckTotal = computeRunDeckTotal(deck.length, hand);
}

function syncDrawPileFromServer() {
	const serverPlayer = gameState && myId && gameState.players[myId];
	if (serverPlayer && Array.isArray(serverPlayer.deck)) {
		setDrawPile(serverPlayer.deck);
	}
	updateRunDeckTotal();
	updateDeckVisuals();
}

function setDeckStackVisible(visible) {
	if (!deckStackEl) return;
	if (visible) {
		deckStackEl.classList.remove('hidden');
	} else {
		deckStackEl.classList.add('hidden');
		hideDeckViewer();
	}
}

function renderDeckStack() {
	if (!deckStackEl) return;

	const layers = getDeckStackLayerCount(deck.length);
	const total = runDeckTotal || computeRunDeckTotal(deck.length, hand);
	deckStackEl.title = formatDeckCountLabel(deck.length, total);
	deckStackEl.classList.toggle('deck-empty', deck.length === 0);
	deckStackEl.dataset.layers = String(layers);

	deckStackEl.innerHTML = '';
	for (let i = 0; i < layers; i++) {
		const layer = document.createElement('div');
		layer.className = 'deck-stack-card';
		layer.style.setProperty('--layer-index', String(i));
		deckStackEl.appendChild(layer);
	}
}

function renderDeckViewer() {
	if (!deckViewerGridEl) return;

	const total = runDeckTotal || computeRunDeckTotal(deck.length, hand);
	const entries = buildDeckMiniEntries(deckIdsForDisplay(deck));

	deckViewerGridEl.innerHTML = '';
	for (const entry of entries) {
		const mini = document.createElement('div');
		mini.className = `deck-card-mini${entry.isEvolved ? ' evolved-card' : ''}`;
		mini.style.setProperty('--mini-color', entry.color);
		mini.innerHTML = `
			<span class="deck-mini-icon">${entry.icon}</span>
			<span class="deck-mini-name">${entry.name}</span>
		`;
		deckViewerGridEl.appendChild(mini);
	}

	if (deckViewerCountEl) {
		deckViewerCountEl.textContent = formatDeckCountLabel(deck.length, total);
	}
}

function updateDeckVisuals() {
	renderDeckStack();
	if (deckViewerOpen) renderDeckViewer();
}

function toggleDeckViewer(forceOpen) {
	if (!deckViewerOverlayEl) return;
	deckViewerOpen = forceOpen !== undefined ? forceOpen : !deckViewerOpen;
	deckViewerOverlayEl.classList.toggle('hidden', !deckViewerOpen);
	if (deckViewerOpen) renderDeckViewer();
}

function hideDeckViewer() {
	deckViewerOpen = false;
	if (deckViewerOverlayEl) deckViewerOverlayEl.classList.add('hidden');
}

for (let i = 0; i < cardSlots.length; i++) {
	cardSlots[i].addEventListener('mouseenter', () => updateAdjacentCardHighlights(i));
	cardSlots[i].addEventListener('mouseleave', clearAdjacentCardHighlights);
	cardSlots[i].addEventListener('focus', () => updateAdjacentCardHighlights(i));
	cardSlots[i].addEventListener('blur', clearAdjacentCardHighlights);
}

function initHand() {
	const serverPlayer = (gameState && gameState.players && gameState.players[myId])
		? gameState.players[myId]
		: null;
	const serverHand = serverPlayer ? serverPlayer.hand : null;

	if (Array.isArray(serverHand) && serverHand.length > 0) {
		for (let i = 0; i < 4; i++) {
			hand[i] = serverHand[i] ? { ...serverHand[i] } : null;
		}
		syncDrawPileFromServer();
		renderHand();
		return;
	}

	initHandFromModule(() => {
		renderHand();
		updateRunDeckTotal();
		updateDeckVisuals();
	});
}

function refillSlot(index) {
	if (index < 0 || index > 3) return null;
	if (hand[index] != null) return hand[index];

	const card = drawCard();
	if (card) {
		hand[index] = card;
		renderHand();
		updateDeckVisuals();
	}
	return card;
}

// ── Deck Editor ──

const ownedCardsListEl = document.getElementById('owned-cards-list');
const selectedDeckListEl = document.getElementById('selected-deck-list');
const deckSizeDisplayEl = document.getElementById('deck-size-display');
const deckErrorEl = document.getElementById('deck-error');
const lobbyCurrencyDisplayEl = document.getElementById('lobby-currency-display');
const pendingTradeOfferEl = document.getElementById('pending-trade-offer');
const pendingTradeTextEl = document.getElementById('pending-trade-text');
const acceptTradeBtn = document.getElementById('accept-trade-btn');
const rejectTradeBtn = document.getElementById('reject-trade-btn');
const tradeTargetSelectEl = document.getElementById('trade-target-select');
const tradeOfferSelectEl = document.getElementById('trade-offer-select');
const tradeRequestSelectEl = document.getElementById('trade-request-select');
const offerTradeBtn = document.getElementById('offer-trade-btn');
const deckEditorEl = document.getElementById('deck-editor');
const lobbyTabDeckBtn = document.getElementById('lobby-tab-deck');
const lobbyTabForgeBtn = document.getElementById('lobby-tab-forge');
const photonForgeEl = document.getElementById('photon-forge');
const forgeInventoryGridEl = document.getElementById('forge-inventory-grid');
const forgeSelectedNameEl = document.getElementById('forge-selected-name');
const forgeSelectedMetaEl = document.getElementById('forge-selected-meta');
const forgeStatRowsEl = document.getElementById('forge-stat-rows');
const forgeUpgradeCostEl = document.getElementById('forge-upgrade-cost');
const forgeUpgradeBtn = document.getElementById('forge-upgrade-btn');
const forgeErrorEl = document.getElementById('forge-error');

let activeLobbyTab = 'deck';
let selectedForgeInstanceId = null;

function getDeckInventory() {
	return Array.isArray(myInventory) ? myInventory : [];
}

function getDeckOwnedCounts() {
	const inventory = getDeckInventory();
	if (Array.isArray(myInventory)) {
		return inventory.reduce((counts, instance) => {
			if (instance && CARD_DEFS[instance.cardId]) {
				counts[instance.cardId] = (counts[instance.cardId] || 0) + 1;
			}
			return counts;
		}, {});
	}
	return myOwnedCards || {};
}

function cardIdForDeckEntry(entryId) {
	const instance = getDeckInventory().find((card) => card.instanceId === entryId);
	if (instance) return instance.cardId;
	return CARD_DEFS[entryId] ? entryId : null;
}

function findAvailableInventoryInstance(cardId) {
	const selected = new Set(mySelectedDeck);
	return getDeckInventory().find((instance) =>
		instance.cardId === cardId && !selected.has(instance.instanceId)
	) || null;
}

function findEvolvableInstance(cardId) {
	return getDeckInventory().find((instance) =>
		instance &&
		instance.cardId === cardId &&
		(instance.grind || 0) >= EVOLUTION_GRIND_REQUIRED &&
		EVOLUTION_TRANSFORMS[instance.cardId]
	) || null;
}

function findGrindableInstance(cardId) {
	return getDeckInventory().find((instance) =>
		instance &&
		instance.cardId === cardId &&
		(instance.grind || 0) < EVOLUTION_GRIND_REQUIRED
	) || null;
}

function grindBadgeForInstance(instance) {
	if (!instance || !(instance.grind > 0)) return '';
	return `<span class="grind-badge">+${instance.grind}</span>`;
}

function renderDeckEditor() {
	ownedCardsListEl.innerHTML = '';
	const ownedCounts = getDeckOwnedCounts();
	for (const [cardId, count] of Object.entries(ownedCounts)) {
		const def = CARD_DEFS[cardId];
		if (!def) continue;
		const style = CARD_ACCENT_STYLE[cardId] || CARD_TYPE_STYLE[def.type] || CARD_TYPE_STYLE.weapon;
		const inDeckCount = mySelectedDeck.filter((id) => cardIdForDeckEntry(id) === cardId).length;
		const availableInstance = findAvailableInventoryInstance(cardId);
		const canAdd = Array.isArray(myInventory)
			? !!availableInstance && mySelectedDeck.length < DECK_MAX_SIZE
			: inDeckCount < count && mySelectedDeck.length < DECK_MAX_SIZE;
		const evolvableInstance = findEvolvableInstance(cardId);
		const grindableInstance = findGrindableInstance(cardId);
		const grindCost = grindableInstance ? getGrindCost(grindableInstance.grind || 0) : 0;
		const canGrind = !!grindableInstance && myCurrency >= grindCost;
		const maxGrind = getDeckInventory()
			.filter((instance) => instance.cardId === cardId)
			.reduce((max, instance) => Math.max(max, instance.grind || 0), 0);
		const grindBadge = maxGrind > 0 ? `<span class="grind-badge">+${maxGrind}</span>` : '';
		const evolvedBadge = def.isEvolved ? '<span class="evolved-badge">Evolved</span>' : '';

		const sellableInstance = findAvailableInventoryInstance(cardId);
		const sellValue = getCardSellValue(cardId);
		const canSell = !!sellableInstance;

		const entry = document.createElement('div');
		entry.className = `owned-card-entry${def.isEvolved ? ' evolved-card' : ''}`;
		entry.innerHTML = `
      <span class="card-icon">${style.icon}</span>
      <span class="card-label">${def.name}</span>
      ${evolvedBadge}
      ${grindBadge}
      <span class="card-count">${count}</span>
      <span class="card-sell-value">${sellValue}g</span>
      <button class="sell-card-btn" ${canSell ? '' : 'disabled'}>Sell</button>
      <button class="grind-card-btn" ${canGrind ? '' : 'disabled'}>${canGrind ? `Grind (${grindCost}g)` : 'Grind'}</button>
      <button class="evolve-card-btn" ${evolvableInstance ? '' : 'disabled'}>Evolve</button>
      <button class="deck-add-btn" ${canAdd ? '' : 'disabled'}>+${inDeckCount > 0 ? ` (${inDeckCount})` : ''}</button>
    `;
		const sellBtn = entry.querySelector('.sell-card-btn');
		sellBtn.addEventListener('click', () => {
			const instance = findAvailableInventoryInstance(cardId);
			if (instance) {
				socket.emit('sellCard', { instanceId: instance.instanceId, cardId });
			}
		});
		const grindBtn = entry.querySelector('.grind-card-btn');
		grindBtn.addEventListener('click', () => {
			const instance = findGrindableInstance(cardId);
			if (instance) socket.emit('grindCard', { instanceId: instance.instanceId });
		});
		const evolveBtn = entry.querySelector('.evolve-card-btn');
		evolveBtn.addEventListener('click', () => {
			const instance = findEvolvableInstance(cardId);
			if (instance) socket.emit('evolveCard', { instanceId: instance.instanceId });
		});
		const addBtn = entry.querySelector('.deck-add-btn');
		addBtn.addEventListener('click', () => {
			const instance = findAvailableInventoryInstance(cardId);
			socket.emit('deckAddCard', instance ? { instanceId: instance.instanceId, cardId } : { cardId });
		});
		ownedCardsListEl.appendChild(entry);
	}

	selectedDeckListEl.innerHTML = '';
	for (let i = 0; i < mySelectedDeck.length; i++) {
		const entryId = mySelectedDeck[i];
		const cardId = cardIdForDeckEntry(entryId);
		const def = CARD_DEFS[cardId];
		if (!def) continue;
		const style = CARD_ACCENT_STYLE[cardId] || CARD_TYPE_STYLE[def.type] || CARD_TYPE_STYLE.weapon;
		const deckInstance = getDeckInventory().find((card) => card.instanceId === entryId);
		const evolvedBadge = def.isEvolved ? '<span class="evolved-badge">Evolved</span>' : '';
		const grindBadge = grindBadgeForInstance(deckInstance);

		const entry = document.createElement('div');
		entry.className = `deck-entry${def.isEvolved ? ' evolved-card' : ''}`;
		entry.innerHTML = `
      <span class="card-icon">${style.icon}</span>
      <span class="card-label">${def.name}</span>
      ${evolvedBadge}
      ${grindBadge}
      <button class="deck-remove-btn">✕</button>
    `;
		const removeBtn = entry.querySelector('.deck-remove-btn');
		removeBtn.addEventListener('click', () => {
			const instance = getDeckInventory().find((card) => card.instanceId === entryId);
			socket.emit('deckRemoveCard', instance ? { instanceId: entryId, cardId } : { cardId });
		});
		selectedDeckListEl.appendChild(entry);
	}

	deckSizeDisplayEl.textContent = `${mySelectedDeck.length}/${DECK_MAX_SIZE}`;

	if (mySelectedDeck.length < DECK_MIN_SIZE) {
		readyBtn.classList.add('deck-invalid');
		readyBtn.disabled = true;
	} else {
		readyBtn.classList.remove('deck-invalid');
		readyBtn.disabled = false;
	}

	deckErrorEl.style.display = 'none';
	deckErrorEl.textContent = '';

	if (lobbyCurrencyDisplayEl) {
		lobbyCurrencyDisplayEl.textContent = `Gold: ${myCurrency}`;
	}
	renderTradeForm();
}

function renderTradeOffer() {
	if (!pendingTradeOfferEl || !pendingTradeTextEl) return;
	if (!pendingTradeOffer) {
		pendingTradeOfferEl.style.display = 'none';
		pendingTradeTextEl.textContent = '';
		return;
	}

	const offeredName = CARD_DEFS[pendingTradeOffer.offeredCardId]?.name || pendingTradeOffer.offeredCardId;
	const requestedName = CARD_DEFS[pendingTradeOffer.requestedCardId]?.name || pendingTradeOffer.requestedCardId;
	const fromName = pendingTradeOffer.fromUsername || pendingTradeOffer.fromPlayerId;
	pendingTradeTextEl.textContent = `${fromName} offers ${offeredName} for your ${requestedName}`;
	pendingTradeOfferEl.style.display = 'block';
}

function renderTradeForm(players = null) {
	if (!tradeTargetSelectEl || !tradeOfferSelectEl || !tradeRequestSelectEl) return;

	const playerList = players || (gameState && gameState.players
		? Object.entries(gameState.players).map(([id, p]) => ({ id, username: p.username || id }))
		: []);
	const others = playerList.filter((p) => p.id !== myId);

	tradeTargetSelectEl.innerHTML = '';
	if (others.length === 0) {
		const option = document.createElement('option');
		option.value = '';
		option.textContent = 'No other players';
		tradeTargetSelectEl.appendChild(option);
		if (offerTradeBtn) offerTradeBtn.disabled = true;
	} else {
		for (const player of others) {
			const option = document.createElement('option');
			option.value = player.id;
			option.textContent = player.username || player.id;
			tradeTargetSelectEl.appendChild(option);
		}
		if (offerTradeBtn) offerTradeBtn.disabled = false;
	}

	const fillCardSelect = (selectEl, includeAllOwned = false) => {
		selectEl.innerHTML = '';
		const ownedCounts = getDeckOwnedCounts();
		for (const [cardId, count] of Object.entries(ownedCounts)) {
			if (!CARD_DEFS[cardId]) continue;
			if (!includeAllOwned && !findAvailableInventoryInstance(cardId)) continue;
			const option = document.createElement('option');
			option.value = cardId;
			option.textContent = `${CARD_DEFS[cardId].name} (${count})`;
			selectEl.appendChild(option);
		}
		if (selectEl.options.length === 0) {
			const option = document.createElement('option');
			option.value = '';
			option.textContent = 'No cards';
			selectEl.appendChild(option);
		}
	};

	fillCardSelect(tradeOfferSelectEl, false);
	fillCardSelect(tradeRequestSelectEl, true);
}

if (acceptTradeBtn) {
	acceptTradeBtn.addEventListener('click', () => {
		if (!pendingTradeOffer) return;
		socket.emit('respondCardTrade', { tradeId: pendingTradeOffer.tradeId, accepted: true });
		pendingTradeOffer = null;
		renderTradeOffer();
	});
}

if (rejectTradeBtn) {
	rejectTradeBtn.addEventListener('click', () => {
		if (!pendingTradeOffer) return;
		socket.emit('respondCardTrade', { tradeId: pendingTradeOffer.tradeId, accepted: false });
		pendingTradeOffer = null;
		renderTradeOffer();
	});
}

if (offerTradeBtn) {
	offerTradeBtn.addEventListener('click', () => {
		const targetPlayerId = tradeTargetSelectEl?.value;
		const offeredCardId = tradeOfferSelectEl?.value;
		const requestedCardId = tradeRequestSelectEl?.value;
		if (!targetPlayerId || !offeredCardId || !requestedCardId) return;
		socket.emit('offerCardTrade', { targetPlayerId, offeredCardId, requestedCardId });
	});
}

function showDeckError(message) {
	deckErrorEl.textContent = message;
	deckErrorEl.style.display = 'block';
}

function getMyCurrency() {
	if (gameState && myId && gameState.players[myId]) {
		return gameState.players[myId].currency || 0;
	}
	return 0;
}

function setLobbyTab(tab) {
	activeLobbyTab = tab === 'forge' ? 'forge' : 'deck';
	const deckEditor = document.getElementById('deck-editor');
	const photonForge = document.getElementById('photon-forge');
	const deckTabBtn = document.getElementById('lobby-tab-deck');
	const forgeTabBtn = document.getElementById('lobby-tab-forge');
	if (deckEditor) deckEditor.classList.toggle('hidden', activeLobbyTab !== 'deck');
	if (photonForge) photonForge.classList.toggle('hidden', activeLobbyTab !== 'forge');
	if (deckTabBtn) deckTabBtn.classList.toggle('active', activeLobbyTab === 'deck');
	if (forgeTabBtn) forgeTabBtn.classList.toggle('active', activeLobbyTab === 'forge');
	if (activeLobbyTab === 'forge') renderPhotonForge();
}

function showForgeError(message) {
	const errorEl = document.getElementById('forge-error');
	if (!errorEl) return;
	errorEl.textContent = message;
	errorEl.style.display = message ? 'block' : 'none';
}

function playForgeUpgradeAnimation(instanceId) {
	const grid = document.getElementById('forge-inventory-grid');
	if (!grid || !instanceId) return;
	const tile = grid.querySelector(`[data-instance-id="${instanceId}"]`);
	if (!tile) return;
	tile.classList.remove('upgrade-success');
	void tile.offsetWidth;
	tile.classList.add('upgrade-success');
	setTimeout(() => tile.classList.remove('upgrade-success'), 800);
}

function renderPhotonForge() {
	const grid = document.getElementById('forge-inventory-grid');
	if (!grid) return;

	const inventory = getDeckInventory();
	if (selectedForgeInstanceId && !inventory.some((card) => card.instanceId === selectedForgeInstanceId)) {
		selectedForgeInstanceId = null;
	}

	grid.innerHTML = '';
	for (const instance of inventory) {
		const def = CARD_DEFS[instance.cardId];
		if (!def) continue;
		const style = CARD_TYPE_STYLE[def.type] || CARD_TYPE_STYLE.weapon;
		const level = instance.level || 1;
		const tile = document.createElement('button');
		tile.type = 'button';
		tile.className = `forge-card-tile${instance.instanceId === selectedForgeInstanceId ? ' selected' : ''}${def.isEvolved ? ' evolved-card' : ''}`;
		tile.dataset.instanceId = instance.instanceId;
		tile.innerHTML = `
      <span class="card-icon">${style.icon}</span>
      <span class="card-label">${def.name}</span>
      <span class="forge-level-badge">Lv ${level}</span>
    `;
		tile.addEventListener('click', () => {
			selectedForgeInstanceId = instance.instanceId;
			renderPhotonForge();
		});
		grid.appendChild(tile);
	}

	const selected = selectedForgeInstanceId
		? inventory.find((card) => card.instanceId === selectedForgeInstanceId)
		: null;

	const selectedNameEl = document.getElementById('forge-selected-name');
	const selectedMetaEl = document.getElementById('forge-selected-meta');
	const statRowsEl = document.getElementById('forge-stat-rows');
	const upgradeCostEl = document.getElementById('forge-upgrade-cost');
	const upgradeBtn = document.getElementById('forge-upgrade-btn');

	if (!selected) {
		if (selectedNameEl) selectedNameEl.textContent = 'Select a card';
		if (selectedMetaEl) selectedMetaEl.textContent = 'Choose an inventory card to preview upgrades.';
		if (statRowsEl) statRowsEl.innerHTML = '';
		if (upgradeCostEl) upgradeCostEl.textContent = 'Cost: — GOLD';
		if (upgradeBtn) upgradeBtn.disabled = true;
		showForgeError('');
		return;
	}

	const def = CARD_DEFS[selected.cardId];
	const level = selected.level || 1;
	const currency = getMyCurrency();
	const atMaxLevel = level >= MAX_CARD_LEVEL;
	const cost = atMaxLevel ? 0 : getUpgradeCost(level);
	const canUpgrade = !atMaxLevel && canAffordUpgrade(currency, level);

	if (selectedNameEl) selectedNameEl.textContent = def ? def.name : selected.cardId;
	if (selectedMetaEl) {
		const grind = selected.grind || 0;
		selectedMetaEl.textContent = `Instance ${selected.instanceId.slice(0, 8)} · Grind +${grind}`;
	}

	if (statRowsEl) {
		statRowsEl.innerHTML = '';
		const rows = getForgeStatPreview(def, level);
		for (const row of rows) {
			const tr = document.createElement('tr');
			tr.innerHTML = `<td>${row.label}</td><td>${row.current}</td><td>${row.next}</td>`;
			statRowsEl.appendChild(tr);
		}
	}

	if (upgradeCostEl) {
		upgradeCostEl.textContent = atMaxLevel
			? `Max level (${MAX_CARD_LEVEL}) reached`
			: `Cost: ${cost} GOLD (you have ${currency})`;
	}
	if (upgradeBtn) {
		upgradeBtn.disabled = !canUpgrade;
		upgradeBtn.textContent = atMaxLevel ? 'Max Level' : 'Upgrade';
	}
	showForgeError('');
}

if (document.getElementById('lobby-tab-deck')) {
	document.getElementById('lobby-tab-deck').addEventListener('click', () => setLobbyTab('deck'));
}
if (document.getElementById('lobby-tab-forge')) {
	document.getElementById('lobby-tab-forge').addEventListener('click', () => setLobbyTab('forge'));
}
if (document.getElementById('forge-upgrade-btn')) {
	document.getElementById('forge-upgrade-btn').addEventListener('click', () => {
		if (!selectedForgeInstanceId) return;
		socket.emit('upgradeCard', { instanceId: selectedForgeInstanceId });
	});
}

// ── Card input handling ──

function playActivationEffect(slotIndex) {
	const slot = cardSlots[slotIndex];
	if (!slot) return;

	slot.classList.add('activating');
	setTimeout(() => {
		slot.classList.remove('activating');
		slot.classList.add('cooldown');
	}, 200);

	setTimeout(() => {
		slot.classList.remove('cooldown');
		slotCooldowns[slotIndex] = false;
	}, 1200);
}

function useCard(slotIndex) {
	if (slotIndex < 0 || slotIndex > 3) return;
	const card = hand[slotIndex];
	if (!card) return;

	if (!canUseSlot(slotIndex)) return;

	const cardDef = CARD_DEFS[card.id] || {};
	const playerMs = (gameState && myId && gameState.players[myId])
		? gameState.players[myId].magicStones
		: 0;
	const cardCost = card.magicStoneCost ?? cardDef.magicStoneCost;
	if (cardCost != null && cardCost > 0 && playerMs < cardCost) {
		lastUsedSlot = slotIndex;
		showCardErrorToast('Not enough Magic Stones');
		const slot = cardSlots[slotIndex];
		if (slot) slot.classList.add('no-ms');
		return;
	}

	lastUsedSlot = slotIndex;
	socket.emit('useCard', { slotIndex, cardId: card.id });

	if (monsterCardIds.has(card.id)) {
		slotCooldowns[slotIndex] = true;
		playActivationEffect(slotIndex);
		return;
	}

	if (summonCardIds.has(card.id)) {
		slotCooldowns[slotIndex] = true;
		playActivationEffect(slotIndex);
		return;
	}

	card.remainingCharges -= 1;

	if (card.remainingCharges <= 0) {
		hand[slotIndex] = null;
		const newCard = drawCard();
		if (newCard) {
			hand[slotIndex] = newCard;
		}
	}

	renderHand();
	updateDeckVisuals();

	slotCooldowns[slotIndex] = true;
	playActivationEffect(slotIndex);
}

// Keyboard: keys 1-4 map to hand slots 0-3; V toggles draw pile viewer
window.addEventListener('keydown', (e) => {
	const slotMap = { '1': 0, '2': 1, '3': 2, '4': 3 };
	if (e.key in slotMap) {
		if (e.repeat) return;
		useCard(slotMap[e.key]);
		return;
	}
	if ((e.key === 'v' || e.key === 'V') && gameState && gameState.gamePhase === 'playing') {
		if (e.repeat) return;
		toggleDeckViewer();
	}
});

// Click: delegate on #card-hand, read data-slot-index from .card-slot target
cardHandEl.addEventListener('click', (e) => {
	const slot = e.target.closest('.card-slot');
	if (!slot) return;
	useCard(parseInt(slot.dataset.slotIndex, 10));
});

if (deckStackEl) {
	deckStackEl.addEventListener('click', () => {
		if (gameState && gameState.gamePhase === 'playing') {
			toggleDeckViewer();
		}
	});
}

if (deckViewerOverlayEl) {
	deckViewerOverlayEl.addEventListener('click', (e) => {
		if (e.target === deckViewerOverlayEl) hideDeckViewer();
	});
}

// ── Auth form event handlers ──

if (showLoginLinkEl) {
	showLoginLinkEl.addEventListener('click', (e) => {
		e.preventDefault();
		showLoginForm();
	});
}

if (showRegisterLinkEl) {
	showRegisterLinkEl.addEventListener('click', (e) => {
		e.preventDefault();
		showRegisterForm();
	});
}

if (registerBtnEl) {
	registerBtnEl.addEventListener('click', async () => {
		const usernameInput = document.getElementById('register-username');
		const passwordInput = document.getElementById('register-password');
		if (!usernameInput || !passwordInput) return;

		const username = usernameInput.value.trim();
		const password = passwordInput.value;
		if (registerErrorEl) registerErrorEl.textContent = '';

		if (!username || !password) {
			if (registerErrorEl) registerErrorEl.textContent = 'Username and password are required';
			return;
		}

		try {
			const res = await fetch('/api/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password }),
			});
			const data = await res.json();
			if (res.ok) {
				if (registerErrorEl) {
					registerErrorEl.textContent = 'Account created — please login';
					registerErrorEl.style.color = '#4ade80';
				}
				showLoginForm();
			} else {
				if (registerErrorEl) registerErrorEl.textContent = data.error || 'Registration failed';
			}
		} catch (err) {
			if (registerErrorEl) registerErrorEl.textContent = 'Network error — check connection';
		}
	});
}

if (loginBtnEl) {
	loginBtnEl.addEventListener('click', async () => {
		const usernameInput = document.getElementById('login-username');
		const passwordInput = document.getElementById('login-password');
		if (!usernameInput || !passwordInput) return;

		const username = usernameInput.value.trim();
		const password = passwordInput.value;
		if (loginErrorEl) loginErrorEl.textContent = '';

		if (!username || !password) {
			if (loginErrorEl) loginErrorEl.textContent = 'Username and password are required';
			return;
		}

		try {
			const res = await fetch('/api/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password }),
			});
			const data = await res.json();
			if (res.ok && data.token) {
				try { localStorage.setItem(TOKEN_KEY, data.token); } catch (_) {}
				createSocket(data.token);
				hideAuthOverlay();
				clearAuthForms();
			} else {
				if (loginErrorEl) loginErrorEl.textContent = data.error || 'Login failed';
			}
		} catch (err) {
			if (loginErrorEl) loginErrorEl.textContent = 'Network error — check connection';
		}
	});
}

if (logoutBtn) {
	logoutBtn.addEventListener('click', () => {
		try { localStorage.removeItem(TOKEN_KEY); } catch (_) {}
		if (socket) socket.disconnect();

		myId = null;
		if (logoutBtn) logoutBtn.classList.add('hidden');
		if (uiEl) uiEl.style.display = 'none';
		if (cardHandEl) cardHandEl.style.display = 'none';
		setDeckStackVisible(false);
		if (lobbyEl) lobbyEl.classList.add('hidden');
		updateStatus('Disconnected', 'disconnected');
		showAuthOverlay();
		showRegisterForm();
		clearAuthForms();
	});
}

// ── Toast helper ──

function showCardErrorToast(message) {
	const toast = document.createElement('div');
	toast.textContent = message;
	toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #dc2626;
    color: #fff;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-family: sans-serif;
    z-index: 9999;
    pointer-events: none;
    opacity: 1;
    transition: opacity 0.3s;
  `;
	document.body.appendChild(toast);
	setTimeout(() => {
		toast.style.opacity = '0';
		setTimeout(() => toast.remove(), 300);
	}, 2000);
}

// ── Lobby event wiring ──

function renderPlayerList(players) {
	lobbyPlayerList.innerHTML = '';
	if (!players || players.length === 0) {
		lobbyPlayerList.innerHTML = '<li class="empty-hint">No players yet</li>';
		return;
	}
	for (const p of players) {
		const li = document.createElement('li');
		li.textContent = `${p.id} — ${p.ready ? 'Ready' : 'Not Ready'}`;
		lobbyPlayerList.appendChild(li);
	}
}

readyBtn.addEventListener('click', () => {
	isReady = !isReady;
	socket.emit('playerReady', isReady);
	readyBtn.textContent = isReady ? 'Ready!' : 'Ready';
});

// ── Mute toggle ──

function updateMuteButton() {
	const btn = document.getElementById('mute-btn');
	if (btn) btn.textContent = isSoundEnabled() ? '🔊' : '🔇';
}

document.addEventListener('click', (e) => {
	if (e.target && e.target.id === 'mute-btn') {
		setSoundEnabled(!isSoundEnabled());
		updateMuteButton();
	}
});

updateMuteButton();

// ── Run Summary Overlay ──

function formatDuration(ms) {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes > 0) return `${minutes}m ${seconds}s`;
	return `${seconds}s`;
}

function renderCardChoices(choices) {
	if (!summaryCardChoicesListEl || !summaryCardChoicesEmptyEl) return;

	currentCardChoices = Array.isArray(choices) ? choices : [];
	summaryCardChoicesListEl.innerHTML = '';

	if (currentCardChoices.length === 0) {
		summaryCardChoicesEmptyEl.textContent = 'No card choices were found this run.';
		summaryCardChoicesEmptyEl.style.display = 'block';
		return;
	}

	summaryCardChoicesEmptyEl.style.display = 'none';

	for (const choice of currentCardChoices) {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'card-choice-btn';
		btn.dataset.cardId = choice.id;
		btn.innerHTML = `
			<span class="card-choice-name">${choice.name}</span>
			<span class="card-choice-type">${choice.type}</span>
			<span class="card-choice-description">${choice.description || ''}</span>
		`;

		if (claimedCardRewardId === choice.id) {
			btn.classList.add('claimed');
			btn.disabled = true;
		} else if (claimedCardRewardId) {
			btn.disabled = true;
		} else {
			btn.addEventListener('click', () => {
				if (claimedCardRewardId) return;
				socket.emit('claimCardReward', { cardId: choice.id });
			});
		}

		summaryCardChoicesListEl.appendChild(btn);
	}
}

function showRunSummary(data) {
	if (!data) return;

	if (data.status === 'victory') {
		playSound('victory');
	} else {
		playSound('failure');
	}

	const statusText = data.status === 'victory' ? 'Victory!' : 'Run Failed';
	summaryStatusEl.textContent = statusText;
	if (summaryQuestEl) {
		const questLabel = data.questName || (data.objective && data.objective.label) || '';
		summaryQuestEl.textContent = questLabel ? `Quest: ${questLabel}` : '';
	}
	summaryDurationEl.textContent = `Duration: ${formatDuration(data.durationMs || 0)}`;
	summaryEnemiesEl.textContent = `Enemies defeated: ${data.defeatedEnemies || 0}`;
	summaryCurrencyEl.textContent = `Currency collected: ${data.currencyCollected || 0}`;

	const me = data.players && data.players.find((p) => p.id === myId);
	const rewards = me && me.rewards;
	const cardChoices = me && Array.isArray(me.cardChoices) ? me.cardChoices : [];

	if (rewards) {
		const currencyBonus = rewards.currency || 0;
		summaryRewardsCurrencyEl.textContent = `+${currencyBonus} gold earned`;

		if (rewards.cards && rewards.cards.length > 0) {
			const cardLines = rewards.cards.map((c) => {
				const count = c.count > 1 ? ` ×${c.count}` : '';
				return `${c.name}${count}`;
			});
			summaryRewardsCardsEl.textContent = cardLines.join('\n');
		} else if (cardChoices.length > 0) {
			summaryRewardsCardsEl.textContent = 'Choose one card reward below';
		} else {
			summaryRewardsCardsEl.textContent = 'No card rewards';
		}
	} else {
		summaryRewardsCurrencyEl.textContent = '';
		summaryRewardsCardsEl.textContent = '';
	}

	if (summaryCardChoicesEl) {
		if (data.status === 'victory' && cardChoices.length > 0) {
			summaryCardChoicesEl.style.display = 'block';
			renderCardChoices(cardChoices);
		} else if (data.status === 'victory') {
			summaryCardChoicesEl.style.display = 'block';
			renderCardChoices([]);
		} else {
			summaryCardChoicesEl.style.display = 'none';
			renderCardChoices([]);
		}
	}

	runSummaryOverlay.style.display = 'flex';
}

returnToLobbyBtn.addEventListener('click', () => {
	socket.emit('returnToLobby');
});

// ── Window exports for test harness ──

window.initScene = rendererInitScene;
window.refillSlot = refillSlot;
window.renderHand = renderHand;
window.renderDeckEditor = renderDeckEditor;
window.renderPhotonForge = renderPhotonForge;
window.setLobbyTab = setLobbyTab;
window.__setLobbyTabState = (tab, instanceId) => {
	if (tab) activeLobbyTab = tab;
	if (instanceId !== undefined) selectedForgeInstanceId = instanceId;
};
window.__getLobbyTabState = () => ({ activeLobbyTab, selectedForgeInstanceId });
window.renderDeckViewer = renderDeckViewer;
window.renderDeckStack = renderDeckStack;
window.toggleDeckViewer = toggleDeckViewer;
window.__isDeckViewerOpen = () => deckViewerOpen;
window.__setRunDeckTotal = (total) => { runDeckTotal = total; };
window.flashMesh = rendererFlashMesh;
window.spawnDamageNumber = rendererSpawnDamageNumber;
window.spawnHitSpark = rendererSpawnHitSpark;
window.markLootCollected = rendererMarkLootCollected;
window.playSound = playSound;
window.__soundEnabled = () => isSoundEnabled();
window.__updateMuteButton = updateMuteButton;
window.__setSoundEnabled = (v) => { setSoundEnabled(v); updateMuteButton(); };
window.__getPersistedMute = () => { try { return localStorage.getItem('autogame:soundEnabled'); } catch (_) { return null; } };
window.__loadSoundEnabled = loadSoundEnabled;
window.activeEffects = () => getActiveEffects();
window.__setScene = (s) => { window.___test_scene = s; };
window.___test_scene = undefined;
window.__playSoundCallLog = () => _playSoundCallLog;
window.__clearPlaySoundLog = () => { _playSoundCallLog.length = 0; };
window.__setGameState = (gs, id) => { gameState = gs; myId = id; setGameStateRef(gs); rendererSetMyId(id); };

// Expose renderer mesh maps on window for test compatibility
window.enemyHealthBars = (() => {
	const maps = getMeshMaps();
	return maps.enemyHealthBars;
})();
window.createEnemyMesh = rendererCreateEnemyMesh;
window.enemyMeshHalfHeight = rendererEnemyMeshHalfHeight;
window.healthBarColor = rendererHealthBarColor;
window.__mySelectedDeck = () => mySelectedDeck;
window.__setDeckState = (deck, owned, inventory, currency) => {
	mySelectedDeck = deck || mySelectedDeck;
	myOwnedCards = owned || myOwnedCards;
	if (inventory !== undefined) myInventory = inventory;
	if (Number.isFinite(currency)) myCurrency = currency;
};
window.renderQuestBoardState = renderQuestBoardState;
window.__setQuestBoardState = (quests, questId) => applyQuestBoardState(quests, questId);
window.__getSelectedQuestId = () => selectedQuestId;
window.formatObjectiveSummary = formatObjectiveSummary;
window.formatRewardSummary = formatRewardSummary;
window.renderQuestBoard = renderQuestBoard;
window.__windupFlashing = () => getWindupFlashing();
window.__pickedUpLootIds = () => getPickedUpLootIds();
window.__enemiesMeshes = () => getMeshMaps().enemiesMeshes;
window.applyWindupFlash = rendererApplyWindupFlash;
window.__useCardForTest = useCard;
window.__resumeAudioContext = resumeAudioContext;
window.__setAudioCtx = (ctx) => { setAudioContext(ctx); };
window.__getAudioCtx = () => getAudioContext();
window.showAuthOverlay = showAuthOverlay;
window.hideAuthOverlay = hideAuthOverlay;
window.showRegisterForm = showRegisterForm;
window.showLoginForm = showLoginForm;
window.clearAuthForms = clearAuthForms;
window.bindSocketHandlers = bindSocketHandlers;
window.createSocket = createSocket;
window.showRunSummary = showRunSummary;
window.renderCardChoices = renderCardChoices;
window.__claimedCardRewardId = () => claimedCardRewardId;
window.__currentCardChoices = () => currentCardChoices;
window.__connectionState = () => connectionState;
window.__AUTOGAME_HARNESS_STATE__ = () => {
	const me = gameState && myId ? gameState.players[myId] : null;
	const lobbyVisible = !!lobbyEl && !lobbyEl.classList.contains('hidden');
	const cardHandVisible = !!cardHandEl && getComputedStyle(cardHandEl).display !== 'none';

	return {
		debugScenario,
		debugScenarioAllowed,
		debugScenarioResult,
		myId,
		phase: gameState ? gameState.gamePhase : 'unknown',
		connectionState,
		sceneInitialized: isSceneInitialized(),
		hasCanvas: !!document.querySelector('canvas'),
		lobbyVisible,
		cardHandVisible,
		status: statusEl ? statusEl.innerText : '',
		hpText: hpText ? hpText.textContent : '',
		msText: msText ? msText.textContent : '',
		currencyText: document.getElementById('currency-display') ? document.getElementById('currency-display').textContent : '',
		player: me ? {
			hp: me.hp,
			magicStones: me.magicStones,
			debugScenario: me.debugScenario,
			dead: me.dead,
			x: me.x,
			z: me.z,
		} : null,
		players: gameState ? Object.keys(gameState.players).length : 0,
		enemies: gameState ? gameState.enemies.length : 0,
		minions: gameState && gameState.minions ? gameState.minions.map((m) => ({
			id: m.id,
			type: m.type,
			ownerId: m.ownerId,
			hp: m.hp,
			maxHp: m.maxHp,
			x: m.x,
			z: m.z,
		})) : [],
		hand: hand.map((card) =>
			card
				? {
					id: card.id,
					name: card.name,
					type: card.type,
					remainingCharges: card.remainingCharges,
					charges: card.charges,
					isEvolved: !!card.isEvolved,
					specialEffect: card.specialEffect,
				}
				: null,
		),
	};
};

// v8 ignore end
