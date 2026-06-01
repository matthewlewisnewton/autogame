// v8 ignore start
// All code below is UI/Three.js/Socket-dependent and cannot be unit tested.
// Testable logic is extracted to cards.js, collision.js, and hand.js.

import {
	formatObjectiveSummary,
	formatRewardSummary,
	renderQuestBoard,
} from './questBoard.js';
import {
	THEME,
	formatCurrencyHud,
	formatCurrencyLabel,
	formatCurrencyPrice,
	formatMoneyEarned,
	formatAttuneCost,
	getCardTypeLabel,
} from './theme.js';
import { io } from 'socket.io-client';
import { CARD_DEFS, CARD_TYPE_STYLE, CARD_ACCENT_STYLE, EVOLUTION_GRIND_REQUIRED, EVOLUTION_TRANSFORMS, getCardSellValue, getGrindCost, getCardDef, getForgeAttunePreview, spellCardIds, creatureCardIds, enchantmentCardIds } from './cards.js';
import { buildLoadoutDeckDisplay } from './deck-loadout.js';
import { drawCard, initHand as initHandFromModule, hand, deck, desperationDeck, slotCooldowns, canUseSlot, setDrawPile, setDesperationDrawPile, inDesperation, setInDesperation, canDrawIntoHandLocal, MAX_HAND_SLOTS } from './hand.js';
import { renderCardUsed } from './cardRenderers.js';
import {
	buildDeckMiniEntries,
	computeRunDeckTotal,
	deckIdsForDisplay,
	formatDeckCountLabel,
	formatDesperationDeckCountLabel,
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
	initInput,
	ACTIONS,
	getHandSlotInputHints,
	is8BitDo64HandHintsActive,
	getUseKeyItemBinding,
} from './input.js';
import {
	DECK_MIN_SIZE,
	DECK_MAX_SIZE,
	MAX_HP,
	MAX_MS,
	MEDIC_HEAL_COST,
} from './config.js';
import {
	patchSettings,
	getLockOnRepeatAction,
	onSettingsChange,
	loadAccountSettings,
	setAuthToken,
	patchProfile,
	getAccountProfile,
} from './settings.js';
import {
	initControllerCalibration,
	startControllerCalibration,
	stopControllerCalibration,
	syncControllerCalibrationForm,
	onGamepadConnectChange,
} from './controller-calibration.js';
import {
	computeDeckHudStats,
	computeDesperationHudStats,
	formatCharacterId,
	formatPlayerLevel,
	getHpBarTier,
	getMsBarTier,
	getCardMagicStoneCost,
} from './vanguard-hud.js';

// ── Renderer module imports ──
import {
	initScene as rendererInitScene,
	rebuildDungeonLayout,
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
	isPlayerMoving,
	getPlayerRotation,
	setPlayerRotation,
	getPlayerFacingDirection,
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
	spawnDivineGraceEffect as rendererSpawnDivineGraceEffect,
	spawnChainLightningEffect as rendererSpawnChainLightningEffect,
	spawnInfernoPillarEffect as rendererSpawnInfernoPillarEffect,
	spawnFireTrailEffect as rendererSpawnFireTrailEffect,
	markLootCollected as rendererMarkLootCollected,
	markCardHitEnemies as rendererMarkCardHitEnemies,
	disposeMeshMap as rendererDisposeMeshMap,
	disposeStaleMeshes as rendererDisposeStaleMeshes,
	disposeOne as rendererDisposeOne,
	disposeAllLootMeshes as rendererDisposeAllLootMeshes,
	getActiveEffects,
	getPickedUpLootIds,
	pruneLootPickupAttempts,
	getWindupFlashing,
	setGamepadInputHandler,
} from './renderer.js';
// ── DOM element references ──
const statusEl = document.getElementById('status');
const lobbyPlayerList = document.getElementById('lobby-player-list');
const questBoardEl = document.getElementById('quest-board');
const questErrorEl = document.getElementById('quest-error');
const readyBtn = document.getElementById('ready-btn');
const abandonRunBtn = document.getElementById('abandon-run-btn');
const suspendedRunBannerEl = document.getElementById('suspended-run-banner');
const lobbyEl = document.getElementById('lobby');
const lobbyBrowserEl = document.getElementById('lobby-browser');
const lobbyListEl = document.getElementById('lobby-list');
const lobbyBrowserStatusEl = document.getElementById('lobby-browser-status');
const lobbyBrowserErrorEl = document.getElementById('lobby-browser-error');
const createLobbyNameEl = document.getElementById('create-lobby-name');
const createLobbyBtnEl = document.getElementById('create-lobby-btn');
const refreshLobbiesBtnEl = document.getElementById('refresh-lobbies-btn');
const leaveLobbyBtnEl = document.getElementById('leave-lobby-btn');
const uiEl = document.getElementById('ui');
const appToolbarEl = document.getElementById('app-toolbar');
const accountBtnEl = document.getElementById('account-btn');
const levelSettingsBtnEl = document.getElementById('level-settings-btn');
const levelSettingsOverlayEl = document.getElementById('level-settings-overlay');
const levelSettingsCloseBtnEl = document.getElementById('level-settings-close-btn');
const levelSettingsErrorEl = document.getElementById('level-settings-error');
const levelLootEarnedEl = document.getElementById('level-loot-earned');
const levelReturnCurrencyEl = document.getElementById('level-return-currency');
const levelReturnCardsEl = document.getElementById('level-return-cards');
const levelGiveUpCostEl = document.getElementById('level-give-up-cost');
const giveUpBtnEl = document.getElementById('give-up-btn');
const accountOverlayEl = document.getElementById('account-overlay');
const accountCloseBtnEl = document.getElementById('account-close-btn');
const accountUsernameInputEl = document.getElementById('account-username-input');
const accountSaveBtnEl = document.getElementById('account-save-btn');
const accountLogoutBtnEl = document.getElementById('account-logout-btn');
const accountErrorEl = document.getElementById('account-error');
const cardHandEl = document.getElementById('card-hand');
const deckStackEl = document.getElementById('deck-stack');
/** @type {'n64' | 'default' | null} */
let handLayoutMode = null;

function resolveHandLayoutMode() {
	if (handLayoutMode) return handLayoutMode;
	return is8BitDo64HandHintsActive() ? 'n64' : 'default';
}

function resetHandLayoutLock() {
	handLayoutMode = null;
}

function applyCardHandLayout() {
	if (!cardHandEl) return null;
	const n64Layout = resolveHandLayoutMode() === 'n64';
	const displayMode = n64Layout ? 'grid' : 'flex';
	cardHandEl.classList.toggle('layout-8bitdo-64', n64Layout);
	if (cardHandEl.style.display !== 'none') {
		cardHandEl.style.display = displayMode;
	}
	return displayMode;
}

function showCardHand() {
	if (!cardHandEl) return;
	if (!handLayoutMode) {
		handLayoutMode = is8BitDo64HandHintsActive() ? 'n64' : 'default';
	}
	cardHandEl.style.display = applyCardHandLayout();
	renderHand();
}

function hideCardHand() {
	if (cardHandEl) cardHandEl.style.display = 'none';
	resetHandLayoutLock();
}
const deckViewerOverlayEl = document.getElementById('deck-viewer-overlay');
const deckViewerGridEl = document.getElementById('deck-viewer-grid');
const deckViewerCountEl = document.getElementById('deck-viewer-count');
const settingsOverlayEl = document.getElementById('settings-overlay');
const settingsBtnEl = document.getElementById('settings-btn');
const settingsCloseBtnEl = document.getElementById('settings-close-btn');
const lockOnRepeatSelectEl = document.getElementById('lock-on-repeat-select');
const useKeyItemKeyInputEl = document.getElementById('use-key-item-key-input');
const useKeyItemGamepadLabelEl = document.getElementById('use-key-item-gamepad-label');
const gamepadStatusEl = document.getElementById('gamepad-status');
const gamepadDeviceIdEl = document.getElementById('gamepad-device-id');
const gamepadActivationHintEl = document.getElementById('gamepad-activation-hint');
const gamepadProfileSelectEl = document.getElementById('gamepad-profile-select');
const gamepadProfileHintEl = document.getElementById('gamepad-profile-hint');
const gamepadDeadzoneSliderEl = document.getElementById('gamepad-deadzone-slider');
const gamepadDeadzoneValueEl = document.getElementById('gamepad-deadzone-value');
const gamepadMoveStickSelectEl = document.getElementById('gamepad-move-stick-select');
const calibrationLeftDotEl = document.getElementById('calibration-left-dot');
const calibrationLeftValuesEl = document.getElementById('calibration-left-values');
const calibrationSecondaryStickLabelEl = document.getElementById('calibration-secondary-stick-label');
const calibrationSecondaryStickPanelEl = document.getElementById('calibration-secondary-stick-panel');
const calibrationTriggerAxesEl = document.getElementById('calibration-trigger-axes');
const calibrationRightDotEl = document.getElementById('calibration-right-dot');
const calibrationRightValuesEl = document.getElementById('calibration-right-values');
const calibrationButtonGridEl = document.getElementById('calibration-button-grid');
const calibrationDebugLogEl = document.getElementById('calibration-debug-log');
const calibrationDebugCopyBtnEl = document.getElementById('calibration-debug-copy-btn');
const calibrationDebugClearBtnEl = document.getElementById('calibration-debug-clear-btn');

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
let currentLobbyName = '';

function setLoggedInStatus(username, lobbyName) {
	if (!statusEl || !username) return;
	currentLobbyName = lobbyName || currentLobbyName || '';
	const suffix = currentLobbyName ? ` · ${currentLobbyName}` : '';
	statusEl.textContent = `Logged in as ${username}${suffix}`;
}

/** Show the auth overlay and hide lobby screens. */
function showAuthOverlay() {
	if (authOverlayEl) authOverlayEl.classList.remove('hidden');
	if (lobbyBrowserEl) lobbyBrowserEl.classList.add('hidden');
	if (lobbyEl) lobbyEl.classList.add('hidden');
	hideAppToolbar();
}

/** Hide the auth overlay and show the lobby browser. */
function hideAuthOverlay() {
	if (authOverlayEl) authOverlayEl.classList.add('hidden');
	showAppToolbar();
	showLobbyBrowser();
}

function showAppToolbar() {
	if (appToolbarEl) appToolbarEl.classList.remove('hidden');
}

function hideAppToolbar() {
	if (appToolbarEl) appToolbarEl.classList.add('hidden');
}

function updateLevelSettingsBtnVisibility() {
	if (!levelSettingsBtnEl) return;
	const me = myId && gameState?.players ? gameState.players[myId] : null;
	// Stay visible for the whole in-dungeon phase (including after objective complete, before extract).
	const inDungeon = gameState?.gamePhase === 'playing'
		&& !!gameState?.run
		&& gameState.run.status !== 'suspended'
		&& !(me && me.extracted);
	levelSettingsBtnEl.classList.toggle('hidden', !inDungeon);
}

function applyLobbyThemeLabels() {
	const registryTitleEl = document.getElementById('lobby-registry-title');
	const lobbyTitleEl = document.getElementById('lobby-title');
	const medicTitleEl = document.getElementById('medic-title');
	if (registryTitleEl) registryTitleEl.textContent = THEME.lobby.registryTitle;
	if (lobbyTitleEl) lobbyTitleEl.textContent = THEME.lobby.lobbyTitle;
	if (medicTitleEl) medicTitleEl.textContent = THEME.lobby.medicTitle;
	const returnBtn = document.getElementById('return-to-lobby-btn');
	if (returnBtn) returnBtn.textContent = THEME.run.returnToGuild;
}

applyLobbyThemeLabels();

function showLobbyBrowser() {
	if (lobbyBrowserEl) lobbyBrowserEl.classList.remove('hidden');
	if (lobbyEl) lobbyEl.classList.add('hidden');
	if (uiEl) uiEl.style.display = 'none';
	if (cardHandEl) hideCardHand();
	setDeckStackVisible(false);
	applyLobbyThemeLabels();
}

function showGameLobby() {
	if (lobbyBrowserEl) lobbyBrowserEl.classList.add('hidden');
	if (lobbyEl) lobbyEl.classList.remove('hidden');
	applyLobbyThemeLabels();
	const me = myId && gameState?.players ? gameState.players[myId] : null;
	syncVanguardHud(me, 'lobby');
}

function showLevelSettingsError(message) {
	if (!levelSettingsErrorEl) return;
	if (message) {
		levelSettingsErrorEl.textContent = message;
		levelSettingsErrorEl.hidden = false;
	} else {
		levelSettingsErrorEl.textContent = '';
		levelSettingsErrorEl.hidden = true;
	}
}

function isLevelSettingsOpen() {
	return !!(levelSettingsOverlayEl && !levelSettingsOverlayEl.classList.contains('hidden'));
}

function formatLevelRewardCards(preview) {
	const lines = [];
	for (const card of preview.cards || []) {
		if (!card || !card.name) continue;
		const count = card.count > 1 ? ` ×${card.count}` : '';
		lines.push(`${card.name}${count}`);
	}
	for (const choice of preview.cardChoices || []) {
		if (!choice || !choice.name) continue;
		lines.push(choice.name);
	}
	return lines;
}

function syncLevelSettingsRewards() {
	if (!levelLootEarnedEl || !levelReturnCurrencyEl || !levelReturnCardsEl || !levelGiveUpCostEl) {
		return;
	}

	const me = myId && gameState?.players ? gameState.players[myId] : null;
	const preview = me?.returnRewardsPreview;

	if (!me || !gameState?.run || !preview) {
		levelLootEarnedEl.textContent = 'Money this run: —';
		levelReturnCurrencyEl.textContent = '—';
		levelReturnCardsEl.textContent = '';
		levelGiveUpCostEl.textContent = 'You keep injuries but forfeit money collected this run.';
		return;
	}

	const loot = preview.lootCurrency || 0;
	levelLootEarnedEl.textContent = loot > 0
		? `Money this run: ${formatCurrencyHud(loot)}`
		: 'Money this run: none collected yet';

	if (preview.objectiveComplete) {
		const total = preview.currency || 0;
		const bonus = Math.max(0, total - loot);
		if (preview.granted) {
			levelReturnCurrencyEl.textContent = `Total payout: ${formatCurrencyHud(total)}`
				+ (bonus > 0 ? ` (includes ${formatCurrencyHud(bonus)} contract bonus)` : '');
		} else {
			levelReturnCurrencyEl.textContent = `Total payout: ${formatCurrencyHud(total)}`
				+ (bonus > 0 ? ` (${formatCurrencyHud(loot)} collected + ${formatCurrencyHud(bonus)} contract bonus)` : '');
		}
	} else {
		const bonus = preview.questBonus || 0;
		levelReturnCurrencyEl.textContent = loot > 0
			? `${formatCurrencyHud(loot)} collected now · ${formatCurrencyHud(bonus)} contract bonus when objectives are complete`
			: `Complete the contract to earn ${formatCurrencyHud(bonus)} (+ any money you collect)`;
	}

	const cardLines = formatLevelRewardCards(preview);
	if (cardLines.length > 0) {
		const label = (preview.cardChoices && preview.cardChoices.length > 0)
			? 'Card rewards: '
			: 'Cards: ';
		levelReturnCardsEl.textContent = label + cardLines.join(', ');
	} else if (preview.objectiveComplete) {
		levelReturnCardsEl.textContent = 'No card drops this run';
	} else {
		levelReturnCardsEl.textContent = '';
	}

	if (loot > 0) {
		levelGiveUpCostEl.textContent = `Forfeit ${formatCurrencyHud(loot)} collected this run. Injuries remain.`;
	} else {
		levelGiveUpCostEl.textContent = 'You keep injuries; no money collected this run to forfeit.';
	}
}

/** Switch UI from in-dungeon play back to the guild lobby. */
function returnToGuildLobby(state, { refreshCollection = false } = {}) {
	closeLevelSettingsOverlay();
	showLevelSettingsError('');
	if (giveUpBtnEl) giveUpBtnEl.disabled = false;
	updateLevelSettingsBtnVisibility();

	if (runSummaryOverlay) runSummaryOverlay.style.display = 'none';
	if (cardHandEl) hideCardHand();
	setDeckStackVisible(false);
	showGameLobby();
	setDeployButtonVisible(true);
	setGamePhase('lobby');

	const me = myId && state?.players ? state.players[myId] : null;
	syncVanguardHud(me, 'lobby');

	if (state) {
		if (refreshCollection) {
			const me = myId && state.players ? state.players[myId] : null;
			if (syncLocalCollectionState(me)) {
				renderDeckEditor();
				if (activeLobbyTab === 'forge') renderPhotonForge();
				if (activeLobbyTab === 'shop') renderCardShop();
				if (activeLobbyTab === 'medic') renderGuildMedic();
				if (activeLobbyTab === 'keyitems') renderKeyItemList();
			}
		}
		if (state.selectedQuestId && state.selectedQuestId !== selectedQuestId) {
			applyQuestBoardState(null, state.selectedQuestId);
		}
		renderSuspendedRunBanner(state);
	}
}

function setDeployButtonVisible(visible) {
	if (!readyBtn) return;
	readyBtn.hidden = !visible;
	if (!visible) {
		readyBtn.disabled = true;
	}
}

function renderSuspendedRunBanner(state) {
	if (!suspendedRunBannerEl) return;
	const summary = state && state.suspendedRunSummary;
	if (state && state.gamePhase === 'lobby' && summary) {
		const objective = summary.objective;
		let progress = '';
		if (objective && objective.type === 'collect_items') {
			progress = THEME.objectives.collectPrismsProgress
				.replace('{collected}', String(objective.collectedItems))
				.replace('{total}', String(objective.totalItems));
		} else if (objective && objective.type === 'defeat_enemies') {
			progress = `${objective.defeatedEnemies}/${objective.totalEnemies} hostiles`;
		}
		suspendedRunBannerEl.textContent = `${THEME.run.resumeSortie}: ${summary.questName || THEME.run.unknownSector}${progress ? ` — ${progress}` : ''}`;
		suspendedRunBannerEl.classList.remove('hidden');
		if (abandonRunBtn) abandonRunBtn.classList.remove('hidden');
		return;
	}
	suspendedRunBannerEl.classList.add('hidden');
	if (abandonRunBtn) abandonRunBtn.classList.add('hidden');
}

function showExtractedLobbyOverlay() {
	if (runSummaryOverlay) runSummaryOverlay.style.display = 'none';
	if (cardHandEl) hideCardHand();
	setDeckStackVisible(false);
	showGameLobby();
	setDeployButtonVisible(false);
	if (suspendedRunBannerEl) {
		suspendedRunBannerEl.textContent = THEME.run.awaitingExtract;
		suspendedRunBannerEl.classList.remove('hidden');
	}
	if (abandonRunBtn) abandonRunBtn.classList.add('hidden');
	const me = myId && gameState?.players ? gameState.players[myId] : null;
	syncVanguardHud(me, 'lobby');
}

function showLobbyBrowserError(message) {
	if (!lobbyBrowserErrorEl) return;
	if (message) {
		lobbyBrowserErrorEl.textContent = message;
		lobbyBrowserErrorEl.style.display = 'block';
	} else {
		lobbyBrowserErrorEl.textContent = '';
		lobbyBrowserErrorEl.style.display = 'none';
	}
}

function renderLobbyList(lobbySummaries) {
	if (!lobbyListEl) return;
	lobbyListEl.innerHTML = '';

	const entries = Array.isArray(lobbySummaries) ? lobbySummaries : [];
	if (entries.length === 0) {
		const empty = document.createElement('li');
		empty.className = 'empty-hint';
		empty.textContent = 'No lobbies yet — create one to get started.';
		lobbyListEl.appendChild(empty);
		return;
	}

	for (const lobby of entries) {
		const item = document.createElement('li');
		item.className = 'lobby-list-item';

		const meta = document.createElement('div');
		meta.className = 'lobby-list-meta';

		const name = document.createElement('span');
		name.className = 'lobby-list-name';
		name.textContent = lobby.name || lobby.id;

		const details = document.createElement('span');
		details.className = 'lobby-list-details';
		const phaseLabel = lobby.gamePhase === 'playing' ? 'In run' : 'Waiting';
		const questLabel = lobby.selectedQuestId ? lobby.selectedQuestId.replace(/_/g, ' ') : THEME.run.unknownSector;
		details.textContent = `${phaseLabel} · ${lobby.playerCount || 0} player(s) · ${questLabel}`;

		meta.appendChild(name);
		meta.appendChild(details);

		const joinBtn = document.createElement('button');
		joinBtn.type = 'button';
		joinBtn.className = 'join-lobby-btn';
		joinBtn.dataset.joinMode = lobby.gamePhase === 'playing' ? 'drop-in' : 'join';
		joinBtn.textContent = lobby.gamePhase === 'playing' ? 'Drop In' : 'Join';
		joinBtn.addEventListener('click', () => {
			if (socket) socket.emit('joinLobby', { lobbyId: lobby.id });
		});

		item.appendChild(meta);
		item.appendChild(joinBtn);
		lobbyListEl.appendChild(item);
	}
}

function applyLobbyJoinedData(data) {
	myId = data.id;
	rendererSetMyId(data.id);
	setGameStateRef(gameState);
	if (data.playerId) {
		try { localStorage.setItem(STORAGE_KEY_PLAYER_ID, data.playerId); } catch (_) {}
	}
	gameState = data.state;
	currentLayout = data.layout || (data.state && data.state.layout) || currentLayout;
	if (gameState && currentLayout) gameState.layout = currentLayout;

	mySelectedDeck = data.selectedDeck || [];
	myInventory = Array.isArray(data.inventory) ? data.inventory : null;
	myOwnedCards = data.ownedCards || {};
	if (data.state && data.state.players && data.state.players[myId]) {
		myCurrency = data.state.players[myId].currency || 0;
	}
	renderDeckEditor();
	applyQuestBoardState(data.quests, data.selectedQuestId || (data.state && data.state.selectedQuestId));
	if (activeLobbyTab === 'forge') renderPhotonForge();

	if (data.accountId) {
		const username = data.username || data.accountId;
		setLoggedInStatus(username, data.lobbyName);
		showAppToolbar();
	}

	showGameLobby();

	const receivedSeed = data.layoutSeed;

	if (isSceneInitialized() && receivedSeed !== undefined) {
		if (receivedSeed !== currentLayoutSeed && currentLayout) {
			currentLayoutSeed = receivedSeed;
			rebuildDungeonLayout(currentLayout);
		} else {
			currentLayoutSeed = receivedSeed;
		}
		const me = myId && gameState && gameState.players ? gameState.players[myId] : null;
		if (me && Number.isFinite(me.x) && Number.isFinite(me.z)) {
			setPlayerPosition(me.x, me.z);
		} else {
			const spawnPos = getSpawnPosition();
			setPlayerPosition(spawnPos.x, spawnPos.z);
		}
		requestDebugScenario();
		return;
	}

	currentLayoutSeed = receivedSeed;
	requestDebugScenario();

	if (data.state && data.state.gamePhase === 'playing') {
		if (isSceneInitialized()) return;
		lobbyEl.classList.add('hidden');
		uiEl.style.display = 'block';
		showCardHand();
		setDeckStackVisible(true);
		initHand();
		rendererInitScene(currentLayout, getSpawnPosition());
		updateObjectiveHud();
		setGamePhase('playing');
		return;
	}

	updateObjectiveHud();
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
const currencyDisplayEl = document.getElementById('currency-display');
const msBarFill = document.getElementById('ms-bar-fill');
const msText = document.getElementById('ms-text');
const msLabel = document.getElementById('ms-label');
const msBarContainer = document.getElementById('ms-bar-container');
const characterIdEl = document.getElementById('character-id');
const playerLevelEl = document.getElementById('player-level');
const deckCountEl = document.getElementById('deck-count');
const deckWeaponCountEl = document.getElementById('deck-weapon-count');
const deckSpellCountEl = document.getElementById('deck-spell-count');
const deckCreatureCountEl = document.getElementById('deck-creature-count');
const deckEnchantmentCountEl = document.getElementById('deck-enchantment-count');
const deckStatsPanelEl = document.getElementById('deck-stats-panel');
const deckViewerPanelEl = document.getElementById('deck-viewer-panel');
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

function getCardSlotEl(slotIndex) {
	return document.querySelector(`.card-slot[data-slot-index="${slotIndex}"]`)
		|| cardSlots[slotIndex]
		|| null;
}

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

async function restoreSession(token) {
	try {
		await loadAccountSettings(token);
	} catch (_) {
		setAuthToken(token);
	}
	syncSettingsForm();
	createSocket(token);
	hideAuthOverlay();
}

initInput({
	onUseSlot: (slot) => useCard(slot),
	onToggleDeck: () => {
		if (gameState && gameState.gamePhase === 'playing') toggleDeckViewer();
	},
	onUseKeyItem: () => {
		if (gameState && gameState.gamePhase === 'playing' && socket) socket.emit('useKeyItem');
	},
	canUseGameActions: () => gameState && gameState.gamePhase === 'playing',
});

// Context bundle handed to per-card renderers — declared once so the
// cardUsed handler does not re-allocate it on every event. `myId` is read
// via a getter so renderers always see the current local player.
const cardRenderCtx = {
	spawnAttackEffect: rendererSpawnAttackEffect,
	spawnSummonEffect: rendererSpawnSummonEffect,
	spawnDivineGraceEffect: rendererSpawnDivineGraceEffect,
	spawnInfernoPillarEffect: rendererSpawnInfernoPillarEffect,
	spawnChainLightningEffect: rendererSpawnChainLightningEffect,
	flashMesh: rendererFlashMesh,
	markCardHitEnemies: rendererMarkCardHitEnemies,
	spawnHitSpark: rendererSpawnHitSpark,
	enemyMeshes: () => getMeshMaps().enemiesMeshes,
	playSound,
	scheduleAfter: (ms, fn) => setTimeout(fn, ms),
	get myId() { return myId; },
};

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

	s.on('connect_error', (err) => {
		const msg = err?.message || String(err || '');
		const isAuthError = /jwt|token|unauthorized|authentication/i.test(msg);
		stopHeartbeat();
		if (isAuthError) {
			try { localStorage.removeItem(TOKEN_KEY); } catch (_) {}
			setAuthToken(null);
			s.io.disconnect();
			if (uiEl) uiEl.style.display = 'none';
			if (cardHandEl) hideCardHand();
			setDeckStackVisible(false);
			if (lobbyEl) lobbyEl.classList.add('hidden');
			if (lobbyBrowserEl) lobbyBrowserEl.classList.add('hidden');
			if (runSummaryOverlay) runSummaryOverlay.style.display = 'none';
			showAuthOverlay();
			showLoginForm();
			updateStatus('Session expired — please log in again', 'disconnected');
		} else {
			updateStatus('Connection failed — retrying...', 'reconnecting');
		}
	});

	s.on('init', (data) => {
		myId = data.id;
		rendererSetMyId(data.id);
		if (data.playerId) {
			try { localStorage.setItem(STORAGE_KEY_PLAYER_ID, data.playerId); } catch (_) {}
		}

		mySelectedDeck = data.selectedDeck || [];
		myInventory = Array.isArray(data.inventory) ? data.inventory : null;
		myOwnedCards = data.ownedCards || {};
		keyItemDefs = data.keyItemDefs || {};
		renderDeckEditor();

		if (data.accountId) {
			const username = data.username || data.accountId;
			setLoggedInStatus(username);
			showAppToolbar();
		}

		// Reconnect path: lobbyJoined already restored lobby/run UI.
		if (data.inLobby) return;

		showLobbyBrowser();
		renderLobbyList(data.lobbies || []);
		showLobbyBrowserError('');
		if (lobbyBrowserStatusEl) {
			lobbyBrowserStatusEl.textContent = 'Choose a lobby or create your own.';
		}
	});

	s.on('lobbyJoined', (data) => {
		showLobbyBrowserError('');
		applyLobbyJoinedData(data);
	});

	s.on('lobbyLeft', (data) => {
		gameState = null;
		setGameStateRef(null);
		showLobbyBrowser();
		renderLobbyList((data && data.lobbies) || []);
		if (lobbyBrowserStatusEl) {
			lobbyBrowserStatusEl.textContent = 'Left lobby. Pick another or create one.';
		}
	});

	s.on('lobbyListUpdate', (data) => {
		if (lobbyBrowserEl && !lobbyBrowserEl.classList.contains('hidden')) {
			renderLobbyList((data && data.lobbies) || []);
		}
	});

	s.on('lobbyError', (data) => {
		const reason = data && data.reason ? data.reason : 'Lobby action failed';
		showLobbyBrowserError(reason);
	});

	s.on('stateUpdate', (state) => {
		const previousPhase = gameState && gameState.gamePhase;
		// Verify layout seed consistency on every state update
		if (currentLayoutSeed !== null && state.layoutSeed !== undefined && state.layoutSeed !== currentLayoutSeed) {
			console.warn(`[layout] Seed mismatch: local=${currentLayoutSeed} server=${state.layoutSeed}`);
			currentLayoutSeed = state.layoutSeed;
		}
		gameState = state;
		setGameStateRef(state);
		if (gameState && currentLayout) gameState.layout = currentLayout;
		updateLevelSettingsBtnVisibility();
		if (isLevelSettingsOpen()) syncLevelSettingsRewards();

		const me = myId && gameState.players ? gameState.players[myId] : null;
		const collectionChanged = syncLocalCollectionState(me);
		const enteringLobby = previousPhase !== 'lobby' && state.gamePhase === 'lobby';
		const enteringPlaying = previousPhase !== 'playing' && state.gamePhase === 'playing';
		const isExtracted = !!(me && me.extracted);

		if (isExtracted && state.gamePhase === 'playing') {
			showExtractedLobbyOverlay();
		} else if (state.gamePhase === 'lobby') {
			returnToGuildLobby(state, { refreshCollection: enteringLobby || collectionChanged });
		} else if (me) {
			syncVanguardHud(me, state.gamePhase);
		}

		// Entering gameplay: ensure HUD is visible (unless extracted mid-run)
		if (state.gamePhase === 'playing' && !isExtracted) {
			showCardHand();
			setDeckStackVisible(true);
			if (lobbyEl) lobbyEl.classList.add('hidden');
			setDeployButtonVisible(false);
			setGamePhase('playing');
			if (enteringPlaying) {
				_lastMagicStones = undefined;
			}
		}

		// Update Vanguard HUD (HP always; MS/deck/portrait in-run only)
		if (me) {
			if (state.gamePhase === 'lobby') {
				syncVanguardHud(me, 'lobby');
			} else if (state.gamePhase === 'playing') {
				updateHpBar(me.hp);
				updateMsBar(me.magicStones);
				updateDeckStats(me.deck, me.hand, me.inventory);
				updateVanguardPortrait();
			}
		}

		// Update currency HUD (visible in lobby and during runs)
		if (me) {
			updateCurrencyHud(me.currency, { flashOnIncrease: state.gamePhase === 'playing' });
		}

		// Update objective HUD
		updateObjectiveHud();

		// Reconcile hand with server authority + re-render for .no-ms / .empty classes
		if (state.gamePhase === 'playing' && myId && state.players[myId] && state.players[myId].hand) {
			const serverPlayer = state.players[myId];
			const serverHand = serverPlayer.hand;
			hand.length = 0;
			for (let i = 0; i < serverHand.length; i++) {
				hand[i] = serverHand[i] ? { ...serverHand[i] } : null;
			}
			if (serverPlayer.inDesperation != null) {
				setInDesperation(serverPlayer.inDesperation);
			} else if (Array.isArray(serverPlayer.deck) && serverPlayer.deck.length === 0) {
				setInDesperation(hand.some((card) => card && card.isDesperation));
			}
			if (Array.isArray(serverPlayer.desperationDeck)) {
				setDesperationDrawPile(serverPlayer.desperationDeck);
			}
			renderHand();
			updateDeckVisuals();
		} else if (state.gamePhase === 'playing') {
			renderHand();
		}

		if (state.gamePhase === 'playing' && myId && state.players[myId]) {
			syncDrawPileFromServer();
		}

		// Prune pickup retry timestamps for loot that left the world
		if (state.loot && Array.isArray(state.loot)) {
			pruneLootPickupAttempts(new Set(state.loot.map((l) => l.id)));
		}

		// Client prediction reconciliation — only correct when idle or badly desynced
		if (state.gamePhase === 'playing' && myId && gameState.players[myId]) {
			const serverPlayer = gameState.players[myId];
			if (!serverPlayer.dead && !isPlayerMoving()) {
				const pos = getPlayerPosition();
				const dx = serverPlayer.x - pos.x;
				const dz = serverPlayer.z - pos.z;
				const drift = Math.hypot(dx, dz);
				if (drift > 0.15) {
					setPlayerPosition(serverPlayer.x, serverPlayer.z);
				}
			} else if (!serverPlayer.dead) {
				const pos = getPlayerPosition();
				const drift = Math.hypot(serverPlayer.x - pos.x, serverPlayer.z - pos.z);
				if (drift > 2.5) {
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
		renderCardUsed(data, cardRenderCtx);
	});

	s.on('cardError', (data) => {
		if (!data || !data.reason) return;
		console.log(`[cardError] ${data.reason}`);
		showCardErrorToast(data.reason);
		if (data.reason === THEME.resource.insufficient && lastUsedSlot >= 0) {
			const slot = getCardSlotEl(lastUsedSlot);
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
			updateCurrencyHud(myCurrency);
		}
		renderDeckEditor();
		if (activeLobbyTab === 'forge') renderPhotonForge();
		if (activeLobbyTab === 'shop') renderCardShop();
	});

	s.on('deckError', (data) => {
		if (!data || !data.reason) return;
		if (activeLobbyTab === 'shop') showShopError(data.reason);
		else showDeckError(data.reason);
	});

	s.on('medicHealed', (data) => {
		if (gameState && myId && gameState.players[myId] && data) {
			gameState.players[myId].hp = data.hp;
			gameState.players[myId].currency = data.currency;
			gameState.players[myId].dead = false;
		}
		if (Number.isFinite(data?.currency)) {
			myCurrency = data.currency;
			_lastCurrency = data.currency;
		}
		renderGuildMedic();
		const me = gameState && myId ? gameState.players[myId] : null;
		syncVanguardHud(me, 'lobby');
	});

	s.on('medicError', (data) => {
		const reason = data && data.reason ? data.reason : 'unknown';
		const messages = {
			insufficient_gold: `Not enough money (need ${MEDIC_HEAL_COST})`,
			already_full: 'Already at full health',
			not_in_lobby: 'Medic is only available at the lobby connection',
			invalid_player: 'Could not find your hunter',
		};
		showMedicError(messages[reason] || `Heal failed: ${reason}`);
	});

	s.on('keyItemEquipped', (data) => {
		if (data && data.keyItemId) {
			const me = myId && gameState?.players ? gameState.players[myId] : null;
			if (me) me.equippedKeyItemId = data.keyItemId;
		}
		renderKeyItemList();
	});

	s.on('keyItemError', (data) => {
		const reason = data && data.reason ? data.reason : 'unknown';
		const messages = {
			not_in_lobby: 'Key items can only be equipped in the lobby',
			missing_key_item_id: 'No key item specified',
			unknown_item: 'Unknown key item',
		};
		showKeyItemError(messages[reason] || `Equip failed: ${reason}`);
	});

	s.on('cardEvolutionResult', (data) => {
		if (!data) return;
		if (data.selectedDeck) mySelectedDeck = data.selectedDeck;
		if (Array.isArray(data.inventory)) myInventory = data.inventory;
		if (data.ownedCards) myOwnedCards = data.ownedCards;
		renderDeckEditor();
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
		if (Number.isFinite(data.currency)) {
			myCurrency = data.currency;
			updateCurrencyHud(myCurrency);
		}
		renderDeckEditor();
		if (activeLobbyTab === 'forge') renderPhotonForge();
		if (activeLobbyTab === 'shop') renderCardShop();
	});

	s.on('cardGrindResult', (data) => {
		if (!data) return;
		if (data.selectedDeck) mySelectedDeck = data.selectedDeck;
		if (Array.isArray(data.inventory)) myInventory = data.inventory;
		if (data.ownedCards) myOwnedCards = data.ownedCards;
		if (Number.isFinite(data.currency)) {
			myCurrency = data.currency;
			updateCurrencyHud(myCurrency);
		}
		renderDeckEditor();
		if (activeLobbyTab === 'forge') {
			renderPhotonForge();
			playForgeAttuneAnimation(data.instance && data.instance.instanceId);
		}
	});

	s.on('cardGrindError', (data) => {
		if (!data || !data.reason) return;
		if (activeLobbyTab === 'forge') showForgeError(data.reason);
		else showDeckError(data.reason);
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

	s.on('playerReconnected', (reconnectedId) => {
		if (reconnectedId === myId) {
			console.log('[network] player reconnected');
		}
	});

	s.on('lobbyUpdate', (data) => {
		renderPlayerList(data.players);
		renderTradeForm(data.players);
		if (data.players && myId) {
			const me = data.players.find((p) => p.id === myId);
			if (me) {
				isReady = me.ready;
				readyBtn.textContent = isReady ? THEME.lobby.deployReady : THEME.lobby.deploy;
				if (gameState && gameState.gamePhase === 'lobby') {
					setDeployButtonVisible(true);
					readyBtn.disabled = false;
				}
			}
		}
		if (data.quests || data.selectedQuestId) {
			applyQuestBoardState(data.quests, data.selectedQuestId);
		}
	});

	s.on('questUpdate', (data) => {
		if (!data) return;
		if (data.quests || data.selectedQuestId) {
			applyQuestBoardState(data.quests, data.selectedQuestId);
		}
		applyQuestLayoutFromServer(data);
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
		showCardHand();
		setDeckStackVisible(true);
		updateObjectiveHud();
		if (!isSceneInitialized()) {
			initHand();
			rendererInitScene(currentLayout, resolveRunSpawnPosition());
			setGamePhase('playing');
			updateLevelSettingsBtnVisibility();
			return;
		}
		initHand();
		const spawnPos = resolveRunSpawnPosition();
		setPlayerPosition(spawnPos.x, spawnPos.z);
		setPlayerRotation(0);
		setWasDead(false);
		setDeployButtonVisible(false);
		setGamePhase('playing');
		updateLevelSettingsBtnVisibility();

		// Only clear entity meshes when we lack fresh server state; otherwise the animate
		// loop will reconcile from gameState on the next stateUpdate.
		const hasWorldEntities = gameState && (
			(Array.isArray(gameState.enemies) && gameState.enemies.length > 0) ||
			(Array.isArray(gameState.minions) && gameState.minions.length > 0) ||
			(Array.isArray(gameState.loot) && gameState.loot.length > 0)
		);
		if (!hasWorldEntities) {
			const sc = getScene();
			const maps = getMeshMaps();
			rendererDisposeMeshMap(maps.enemiesMeshes, sc);
			rendererDisposeMeshMap(maps.enemyHealthBars, sc);
			rendererDisposeMeshMap(maps.telegraphMeshes, sc);
			rendererDisposeMeshMap(maps.minionTelegraphMeshes, sc);
			rendererDisposeMeshMap(maps.minionsMeshes, sc);
			rendererDisposeAllLootMeshes();
		}
	});

	s.on('runComplete', showRunSummary);
	s.on('runFailed', showRunSummary);

	s.on('runError', (data) => {
		const reason = (data && data.reason) ? data.reason : 'Run action failed';
		console.warn(`[run] ${reason}`);
		showLevelSettingsError(reason);
		if (giveUpBtnEl) giveUpBtnEl.disabled = false;
	});

	s.on('runAbandoned', () => {
		if (gameState) {
			gameState.gamePhase = 'lobby';
			delete gameState.run;
		}
		if (giveUpBtnEl) giveUpBtnEl.disabled = false;
		returnToGuildLobby(gameState, { refreshCollection: true });
	});

	if (giveUpBtnEl) {
		giveUpBtnEl.onclick = () => requestGiveUp(s);
	}

	s.on('runSuspended', (summary) => {
		if (summary && summary.questName) {
			console.log(`[run] suspended: ${summary.questName}`);
		}
		if (gameState) {
			gameState.suspendedRunSummary = summary;
			gameState.gamePhase = 'lobby';
		}
		returnToGuildLobby({ gamePhase: 'lobby', suspendedRunSummary: summary });
	});

	s.on('playerExtracted', (data) => {
		if (data && data.playerId === myId) {
			showExtractedLobbyOverlay();
		}
	});

	s.on('cardRewardClaimed', (data) => {
		if (!data || !data.cardId) return;
		claimedCardRewardId = data.cardId;
		if (data.ownedCards) myOwnedCards = data.ownedCards;
		if (data.inventory) myInventory = data.inventory;
		renderCardChoices(currentCardChoices);
	});
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
let keyItemDefs = {};
let availableQuests = [];
let selectedQuestId = 'training_caverns';
let currentCardChoices = [];
let claimedCardRewardId = null;
let myCurrency = 0;
let pendingTradeOffer = null;
let runDeckTotal = 0;
let deckViewerOpen = false;
let _lastCurrency = undefined; // tracks previous currency value for flash-on-increase
let _lastMagicStones = undefined; // tracks previous MS for spend/gain flash

function sameCollectionValue(a, b) {
	try {
		return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
	} catch (_) {
		return false;
	}
}

function syncLocalCollectionState(player) {
	if (!player) return false;
	let changed = false;

	if (Array.isArray(player.selectedDeck) && !sameCollectionValue(player.selectedDeck, mySelectedDeck)) {
		mySelectedDeck = player.selectedDeck;
		changed = true;
	}
	if (Array.isArray(player.inventory) && !sameCollectionValue(player.inventory, myInventory)) {
		myInventory = player.inventory;
		changed = true;
	}
	if (player.ownedCards && !sameCollectionValue(player.ownedCards, myOwnedCards)) {
		myOwnedCards = player.ownedCards;
		changed = true;
	}
	if (Number.isFinite(player.currency) && player.currency !== myCurrency) {
		myCurrency = player.currency;
		changed = true;
	}

	return changed;
}

function applyQuestBoardState(quests, questId) {
	if (Array.isArray(quests)) availableQuests = quests;
	if (typeof questId === 'string') selectedQuestId = questId;
	renderQuestBoardState();
}

/** Prefer authoritative server spawn coordinates when starting or resuming a run. */
function resolveRunSpawnPosition() {
	const me = myId && gameState && gameState.players ? gameState.players[myId] : null;
	if (me && Number.isFinite(me.x) && Number.isFinite(me.z)) {
		return { x: me.x, z: me.z };
	}
	return getSpawnPosition();
}

/** Apply quest layout from server and rebuild dungeon geometry when the quest changes. */
function applyQuestLayoutFromServer(data) {
	if (!data || !data.layout) return;

	currentLayout = data.layout;
	if (gameState) gameState.layout = currentLayout;
	if (data.layoutSeed !== undefined) {
		currentLayoutSeed = data.layoutSeed;
	}

	if (isSceneInitialized()) {
		rebuildDungeonLayout(currentLayout);
	}

	const me = myId && gameState && gameState.players ? gameState.players[myId] : null;
	if (me && Number.isFinite(me.x) && Number.isFinite(me.z)) {
		setPlayerPosition(me.x, me.z);
	} else {
		const spawn = getSpawnPosition();
		setPlayerPosition(spawn.x, spawn.z);
	}
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

/** Test / Playwright hook: apply a debug scenario on demand. */
window.__requestDebugScenarioForTest = (name, timeoutMs) => new Promise((resolve) => {
	if (!socket) {
		resolve({ ok: false, reason: 'no socket' });
		return;
	}
	const timeout = Math.max(1000, Math.min(timeoutMs || 10000, 30000));
	const timer = setTimeout(() => {
		socket.off('debugScenarioResult', onResult);
		resolve({ ok: false, reason: 'timeout waiting for debugScenarioResult' });
	}, timeout);
	function onResult(data) {
		clearTimeout(timer);
		socket.off('debugScenarioResult', onResult);
		debugScenarioResult = data || null;
		resolve(data || { ok: false, reason: 'empty debugScenarioResult' });
	}
	socket.once('debugScenarioResult', onResult);
	socket.emit('debugScenario', { name });
});

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

/** Keep the top-left HP readout visible in lobby and in-run. */
function syncVanguardHud(me, phase) {
	const gamePhase = phase || (gameState && gameState.gamePhase) || 'lobby';
	document.body.dataset.phase = gamePhase;
	if (gamePhase === 'lobby' || gamePhase === 'playing') {
		if (uiEl) uiEl.style.display = 'block';
	}
	if (!me) {
		if (gamePhase === 'lobby') updateHpBar(MAX_HP);
		updateCurrencyHud(myCurrency);
		return;
	}
	updateHpBar(me.hp ?? MAX_HP);
	updateCurrencyHud(me.currency ?? myCurrency);
	if (gamePhase === 'playing') {
		updateMsBar(me.magicStones ?? 0);
		updateDeckStats(me.deck, me.hand, me.inventory);
		updateVanguardPortrait();
	}
}

function updateCurrencyHud(amount, { flashOnIncrease = false } = {}) {
	if (!currencyDisplayEl) return;
	const newCurrency = Number.isFinite(amount) ? amount : 0;
	const oldCurrency = _lastCurrency;
	_lastCurrency = newCurrency;
	myCurrency = newCurrency;
	currencyDisplayEl.textContent = formatCurrencyHud(newCurrency);

	if (flashOnIncrease && oldCurrency !== undefined && newCurrency > oldCurrency) {
		currencyDisplayEl.classList.remove('currency-flash');
		void currencyDisplayEl.offsetWidth;
		currencyDisplayEl.classList.add('currency-flash');
		setTimeout(() => currencyDisplayEl.classList.remove('currency-flash'), 450);
		playSound('loot');
	}
}

function updateMsBar(ms) {
	const clamped = Math.max(0, Math.min(MAX_MS, ms));
	const pct = (clamped / MAX_MS) * 100;
	if (msBarFill) {
		msBarFill.style.width = `${pct}%`;
		msBarFill.classList.remove('ms-high', 'ms-mid', 'ms-low');
		msBarFill.classList.add(getMsBarTier(pct));
	}
	if (msText) msText.textContent = `${Math.floor(clamped)}/${MAX_MS}`;
	if (msLabel) msLabel.textContent = 'MS';

	if (_lastMagicStones !== undefined && msBarContainer) {
		const delta = clamped - _lastMagicStones;
		if (delta < -0.5) {
			msBarContainer.classList.remove('ms-gain');
			msBarContainer.classList.add('ms-spend');
			setTimeout(() => msBarContainer.classList.remove('ms-spend'), 450);
		} else if (delta > 0.5) {
			msBarContainer.classList.remove('ms-spend');
			msBarContainer.classList.add('ms-gain');
			setTimeout(() => msBarContainer.classList.remove('ms-gain'), 450);
		}
	}
	_lastMagicStones = clamped;
}

function updateDeckStats(deckPile, handCards, inventory) {
	const pile = deckPile || [];
	const deckInventory = Array.isArray(inventory) ? inventory : getDeckInventory();
	const showingDesperation = pile.length === 0 && inDesperation;
	const stats = showingDesperation
		? computeDesperationHudStats(desperationDeck, handCards)
		: computeDeckHudStats(pile, handCards, deckInventory);
	if (deckCountEl) {
		deckCountEl.textContent = stats.label;
		deckCountEl.classList.toggle('desperation-mode', showingDesperation);
	}
	if (deckStatsPanelEl) {
		deckStatsPanelEl.classList.toggle('desperation-mode', showingDesperation);
	}
	if (deckWeaponCountEl) deckWeaponCountEl.textContent = String(stats.types.weapon);
	if (deckSpellCountEl) deckSpellCountEl.textContent = String(stats.types.spell);
	if (deckCreatureCountEl) deckCreatureCountEl.textContent = String(stats.types.creature);
	if (deckEnchantmentCountEl) deckEnchantmentCountEl.textContent = String(stats.types.enchantment);
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
		objectiveHudEl.textContent = `${obj.label}\nPurged ${obj.defeatedEnemies} / ${obj.totalEnemies} hostiles`;
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
		if (adjacentIndex < 0 || adjacentIndex >= MAX_HAND_SLOTS) continue;
		if (!hand[adjacentIndex]) continue;
		const slot = getCardSlotEl(adjacentIndex);
		if (slot) slot.classList.add('synergy-adjacent');
	}
}

function formatCardChargesDisplay(card) {
	if (card.activeMinionId) {
		const minion = gameState?.minions?.find((m) => m.id === card.activeMinionId);
		const maxTtl = card.burnMaxTtl || minion?.ttl || 1;
		const remaining = minion ? Math.max(0, minion.ttl) : 0;
		return `${Math.ceil(remaining)}s/${Math.ceil(maxTtl)}s`;
	}
	return `${card.remainingCharges}/${card.charges}`;
}

/** Remaining uses as 0–100 for the charge meter background. */
export function getCardChargePercent(card) {
	if (!card) return 0;
	if (card.activeMinionId) {
		const minion = gameState?.minions?.find((m) => m.id === card.activeMinionId);
		const maxTtl = card.burnMaxTtl || minion?.ttl || 1;
		const remaining = minion ? Math.max(0, minion.ttl) : 0;
		return Math.max(0, Math.min(100, (remaining / maxTtl) * 100));
	}
	if (!card.charges || card.charges <= 0) return 100;
	return Math.max(0, Math.min(100, (card.remainingCharges / card.charges) * 100));
}

function buildCardSlotElements(slot) {
	slot.replaceChildren();
	const meter = document.createElement('span');
	meter.className = 'card-charge-meter';
	meter.setAttribute('aria-hidden', 'true');
	const hint = document.createElement('span');
	hint.className = 'card-input-hint';
	const content = document.createElement('div');
	content.className = 'card-slot-content';
	slot.append(meter, hint, content);
	return { meter, hint, content };
}

function getCardSlotParts(slot) {
	const meter = slot.querySelector(':scope > .card-charge-meter');
	const hint = slot.querySelector(':scope > .card-input-hint');
	const content = slot.querySelector(':scope > .card-slot-content');
	if (meter && hint && content && slot.children.length === 3) {
		return { meter, hint, content };
	}
	return buildCardSlotElements(slot);
}

function setCardSlotHint(hintEl, hintLabel, hintMarkup) {
	hintEl.setAttribute('aria-label', hintLabel);
	hintEl.innerHTML = hintMarkup;
}

function renderHand() {
	const playerMs = (gameState && myId && gameState.players[myId])
		? gameState.players[myId].magicStones
		: 0;

	clearAdjacentCardHighlights();
	const handHasDesperation = hand.some((card) => card && card.isDesperation);
	const inputHints = getHandSlotInputHints();
	if (cardHandEl) {
		cardHandEl.classList.toggle('has-desperation', handHasDesperation);
		cardHandEl.classList.toggle('show-input-hints', true);
		cardHandEl.classList.toggle('input-hints-gamepad', inputHints.mode === 'gamepad');
		cardHandEl.classList.toggle('input-hints-keyboard', inputHints.mode === 'keyboard');
	}
	for (let i = 0; i < MAX_HAND_SLOTS; i++) {
		const slot = getCardSlotEl(i);
		if (!slot) continue;
		const card = hand[i];
		const hintLabel = inputHints.hintLabels?.[i]
			?? (inputHints.mode === 'keyboard' ? `Key ${inputHints.hints[i]}` : `Gamepad ${inputHints.hints[i]}`);
		const { meter, hint, content } = getCardSlotParts(slot);

		if (card) {
			setCardSlotHint(hint, hintLabel, inputHints.hints[i]);
			meter.hidden = false;
			const style = CARD_ACCENT_STYLE[card.id] || CARD_TYPE_STYLE[card.type] || CARD_TYPE_STYLE.weapon;
			slot.style.setProperty('--slot-color', style.color);
			slot.style.setProperty('--charge-pct', String(getCardChargePercent(card)));
			const evolvedBadge = card.isEvolved ? `<span class="evolved-badge">${THEME.progression.ascended}</span>` : '';
			const grindBadge = (card.grind || 0) > 0 ? `<span class="grind-badge">+${card.grind}</span>` : '';
			const effectText = (!card.isDesperation && card.specialEffect)
				? `<span class="card-effect">${card.specialEffect.replace(/_/g, ' ')}</span>`
				: '';
			const cardCost = getCardMagicStoneCost(card);
			const msCostBadge = cardCost > 0
				? `<span class="card-ms-cost">${cardCost} MS</span>`
				: '';
			const desperationRibbon = card.isDesperation
				? '<span class="desperation-ribbon">Desperate</span>'
				: '';
			const echoBadge = card.isEcho ? '<span class="echo-badge">Echo</span>' : '';
			content.innerHTML = `
				${desperationRibbon}
				<span class="card-icon">${style.icon}</span>
				<span class="card-name">${card.name}</span>
				${echoBadge}
				${evolvedBadge}
				${grindBadge}
				${effectText}
				${msCostBadge}
				<span class="card-charges">${formatCardChargesDisplay(card)}</span>
			`;
			slot.classList.remove('empty');
			slot.classList.toggle('evolved-card', !!card.isEvolved);
			slot.classList.toggle('desperation-card', !!card.isDesperation);
			slot.classList.toggle('echo-card', !!card.isEcho);
			slot.classList.toggle('creature-burning', !!card.activeMinionId);
			slot.dataset.cardType = card.type;
			slot.title = card.activeMinionId
				? 'Summoned creature active — card burns down until it expires'
				: card.isDesperation
				? 'Last-resort card — drawn when your deck runs out'
				: 'Right-click to discard';

			if (cardCost > 0 && playerMs < cardCost) {
				slot.classList.add('no-ms');
			} else {
				slot.classList.remove('no-ms');
			}
		} else {
			slot.style.removeProperty('--slot-color');
			slot.style.removeProperty('--charge-pct');
			meter.hidden = true;
			const n64Layout = resolveHandLayoutMode() === 'n64';
			if (n64Layout) {
				setCardSlotHint(hint, hintLabel, inputHints.hints[i]);
			} else {
				hint.textContent = '';
				hint.removeAttribute('aria-label');
			}
			content.replaceChildren();
			slot.classList.add('empty');
			slot.classList.remove('evolved-card');
			slot.classList.remove('no-ms');
			slot.classList.remove('desperation-card');
			slot.classList.remove('echo-card');
			slot.classList.remove('creature-burning');
			delete slot.dataset.cardType;
			slot.removeAttribute('title');
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
	if (serverPlayer && Array.isArray(serverPlayer.desperationDeck)) {
		setDesperationDrawPile(serverPlayer.desperationDeck);
	}
	if (serverPlayer && serverPlayer.inDesperation != null) {
		setInDesperation(serverPlayer.inDesperation);
	}
	updateRunDeckTotal();
	updateDeckStats(deck, hand, serverPlayer?.inventory);
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

	const layers = getDeckStackLayerCount(deck.length || (inDesperation ? desperationDeck.length : 0));
	const total = runDeckTotal || computeRunDeckTotal(deck.length, hand);
	const desperationRemaining = desperationDeck.length;
	deckStackEl.title = deck.length === 0 && inDesperation
		? (desperationRemaining > 0
			? `Desperation deck — ${desperationRemaining} card${desperationRemaining === 1 ? '' : 's'} left`
			: 'Out of cards')
		: formatDeckCountLabel(deck.length, total);
	deckStackEl.classList.toggle('deck-empty', deck.length === 0 && !inDesperation && desperationRemaining === 0);
	deckStackEl.classList.toggle('deck-desperation', deck.length === 0 && inDesperation && desperationRemaining > 0);
	deckStackEl.dataset.layers = String(layers);

	deckStackEl.innerHTML = '';
	for (let i = 0; i < layers; i++) {
		const layer = document.createElement('div');
		layer.className = 'deck-stack-card';
		layer.style.setProperty('--layer-index', String(i));
		deckStackEl.appendChild(layer);
	}

	if (deck.length === 0 && inDesperation && desperationRemaining > 0) {
		const label = document.createElement('span');
		label.className = 'deck-stack-desperation-label';
		label.textContent = '⚠';
		label.setAttribute('aria-hidden', 'true');
		deckStackEl.appendChild(label);
	}
}

function renderDeckViewer() {
	if (!deckViewerGridEl) return;

	const showingDesperation = deck.length === 0 && inDesperation;
	const total = runDeckTotal || computeRunDeckTotal(deck.length, hand);
	const displayIds = showingDesperation
		? deckIdsForDisplay(desperationDeck)
		: deckIdsForDisplay(deck);
	const entries = buildDeckMiniEntries(displayIds);

	deckViewerGridEl.innerHTML = '';
	for (const entry of entries) {
		const mini = document.createElement('div');
		const classes = ['deck-card-mini'];
		if (entry.isEvolved) classes.push('evolved-card');
		if (entry.isDesperation) classes.push('desperation-card');
		mini.className = classes.join(' ');
		mini.style.setProperty('--mini-color', entry.color);
		mini.innerHTML = `
			${entry.isDesperation ? '<span class="deck-mini-desperation-tag">Desperate</span>' : ''}
			<span class="deck-mini-icon">${entry.icon}</span>
			<span class="deck-mini-name">${entry.name}</span>
		`;
		deckViewerGridEl.appendChild(mini);
	}

	if (deckViewerCountEl) {
		deckViewerCountEl.textContent = showingDesperation
			? formatDesperationDeckCountLabel(desperationDeck.length)
			: formatDeckCountLabel(deck.length, total);
	}
	if (deckViewerPanelEl) {
		deckViewerPanelEl.classList.toggle('desperation-view', showingDesperation);
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

for (let i = 0; i < MAX_HAND_SLOTS; i++) {
	const slot = getCardSlotEl(i);
	if (!slot) continue;
	slot.addEventListener('mouseenter', () => updateAdjacentCardHighlights(i));
	slot.addEventListener('mouseleave', clearAdjacentCardHighlights);
	slot.addEventListener('focus', () => updateAdjacentCardHighlights(i));
	slot.addEventListener('blur', clearAdjacentCardHighlights);
}

function initHand() {
	const serverPlayer = (gameState && gameState.players && gameState.players[myId])
		? gameState.players[myId]
		: null;
	const serverHand = serverPlayer ? serverPlayer.hand : null;

	if (Array.isArray(serverHand) && serverHand.length > 0) {
		for (let i = 0; i < MAX_HAND_SLOTS; i++) {
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
	if (index < 0 || index >= MAX_HAND_SLOTS) return null;
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

function grindBadgeForInstance(instance) {
	if (!instance || !(instance.grind > 0)) return '';
	return `<span class="grind-badge">+${instance.grind}</span>`;
}

function grindForDeckEntry(entryId) {
	const instance = getDeckInventory().find((card) => card.instanceId === entryId);
	return instance?.grind || 0;
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
		const maxGrind = getDeckInventory()
			.filter((instance) => instance.cardId === cardId)
			.reduce((max, instance) => Math.max(max, instance.grind || 0), 0);
		const grindBadge = maxGrind > 0 ? `<span class="grind-badge">+${maxGrind}</span>` : '';
		const evolvedBadge = def.isEvolved ? `<span class="evolved-badge">${THEME.progression.ascended}</span>` : '';

		const entry = document.createElement('div');
		entry.className = `owned-card-entry${def.isEvolved ? ' evolved-card' : ''}`;
		entry.innerHTML = `
      <span class="card-icon">${style.icon}</span>
      <span class="card-label">${def.name}</span>
      ${evolvedBadge}
      ${grindBadge}
      <span class="card-count">${count}</span>
      <button class="evolve-card-btn" ${evolvableInstance ? '' : 'disabled'}>Evolve</button>
      <button class="deck-add-btn" ${canAdd ? '' : 'disabled'}>+${inDeckCount > 0 ? ` (${inDeckCount})` : ''}</button>
    `;
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
	const loadoutRows = buildLoadoutDeckDisplay(mySelectedDeck, cardIdForDeckEntry, grindForDeckEntry);
	for (const row of loadoutRows) {
		const { cardId, def, entryIds, count, grind } = row;
		const style = CARD_ACCENT_STYLE[cardId] || CARD_TYPE_STYLE[def.type] || CARD_TYPE_STYLE.weapon;
		const inventory = getDeckInventory();
		const grindBadge = grind > 0 ? `<span class="grind-badge">+${grind}</span>` : '';
		const evolvedBadge = def.isEvolved ? `<span class="evolved-badge">${THEME.progression.ascended}</span>` : '';
		const countBadge = count > 1 ? `<span class="deck-entry-count">×${count}</span>` : '';

		const entry = document.createElement('div');
		entry.className = `deck-entry${def.isEvolved ? ' evolved-card' : ''}`;
		entry.innerHTML = `
      <span class="card-icon">${style.icon}</span>
      <span class="card-label">${def.name}</span>
      ${evolvedBadge}
      ${grindBadge}
      ${countBadge}
      <button class="deck-remove-btn">✕</button>
    `;
		const removeBtn = entry.querySelector('.deck-remove-btn');
		removeBtn.addEventListener('click', () => {
			const entryId = entryIds[entryIds.length - 1];
			const instance = inventory.find((card) => card.instanceId === entryId);
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

}

function renderCardEconomy() {
	updateCurrencyHud(myCurrency);
	if (lobbyCurrencyDisplayEl) {
		lobbyCurrencyDisplayEl.textContent = formatCurrencyLabel(myCurrency);
	}
	renderTradeForm();
	renderTradeOffer();
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

function showShopError(message) {
	const shopErrorEl = document.getElementById('shop-error');
	if (!shopErrorEl) return;
	shopErrorEl.textContent = message;
	shopErrorEl.style.display = 'block';
}

function getMyCurrency() {
	if (gameState && myId && gameState.players[myId]) {
		return gameState.players[myId].currency || 0;
	}
	return 0;
}

function showMedicError(message) {
	const medicErrorEl = document.getElementById('medic-error');
	if (!medicErrorEl) return;
	medicErrorEl.textContent = message;
	medicErrorEl.style.display = message ? 'block' : 'none';
}

function renderGuildMedic() {
	const hpDisplayEl = document.getElementById('medic-hp-display');
	const costDisplayEl = document.getElementById('medic-cost-display');
	const healBtnEl = document.getElementById('medic-heal-btn');
	const me = myId && gameState?.players ? gameState.players[myId] : null;

	if (!me) {
		if (hpDisplayEl) hpDisplayEl.textContent = 'Health: —';
		if (healBtnEl) healBtnEl.disabled = true;
		return;
	}

	const hp = Math.max(0, Math.min(MAX_HP, me.hp ?? MAX_HP));
	const currency = me.currency || 0;
	const atFull = hp >= MAX_HP && !me.dead;

	if (hpDisplayEl) hpDisplayEl.textContent = `Health: ${hp}/${MAX_HP}`;
	if (costDisplayEl) {
		costDisplayEl.textContent = atFull
			? 'You are already at full health.'
			: `Full restore: ${formatCurrencyPrice(MEDIC_HEAL_COST)}`;
	}
	if (healBtnEl) {
		healBtnEl.disabled = atFull || currency < MEDIC_HEAL_COST;
		healBtnEl.textContent = `Heal to full (${MEDIC_HEAL_COST} money)`;
	}
	showMedicError('');
	syncVanguardHud(me, 'lobby');
}

function showKeyItemError(message) {
	const errorEl = document.getElementById('key-item-error');
	if (!errorEl) return;
	if (message) {
		errorEl.textContent = message;
		errorEl.style.display = 'block';
	} else {
		errorEl.textContent = '';
		errorEl.style.display = 'none';
	}
}

function renderKeyItemList() {
	const listEl = document.getElementById('key-item-list');
	if (!listEl) return;

	listEl.innerHTML = '';
	showKeyItemError('');

	const me = myId && gameState?.players ? gameState.players[myId] : null;
	const equippedId = me?.equippedKeyItemId || null;

	const defs = Object.values(keyItemDefs);
	if (!defs.length) {
		const hint = document.createElement('p');
		hint.className = 'key-item-hint';
		hint.textContent = 'No key items available.';
		listEl.appendChild(hint);
		return;
	}

	for (const def of defs) {
		const entry = document.createElement('div');
		entry.className = 'key-item-entry' + (def.id === equippedId ? ' equipped' : '');
		entry.setAttribute('tabindex', '0');
		entry.setAttribute('role', 'button');
		entry.setAttribute('aria-label', `Equip ${def.name}${def.id === equippedId ? ' (equipped)' : ''}`);
		entry.setAttribute('aria-pressed', String(def.id === equippedId));

		const nameEl = document.createElement('span');
		nameEl.className = 'key-item-name';
		nameEl.textContent = def.name;

		const descEl = document.createElement('span');
		descEl.className = 'key-item-desc';
		descEl.textContent = def.description || '';

		const cooldownEl = document.createElement('span');
		cooldownEl.className = 'key-item-cooldown';
		cooldownEl.textContent = def.cooldownMs != null ? `${(def.cooldownMs / 1000).toFixed(1)}s cooldown` : '';

		entry.appendChild(nameEl);
		if (descEl.textContent) entry.appendChild(descEl);
		if (cooldownEl.textContent) entry.appendChild(cooldownEl);

		const tryEquip = () => {
			if (!socket || !socket.connected) {
				showKeyItemError('Not connected to server');
				return;
			}
			socket.emit('equipKeyItem', { keyItemId: def.id });
		};

		entry.addEventListener('click', tryEquip);
		entry.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				tryEquip();
			}
		});

		listEl.appendChild(entry);
	}
}

function setLobbyTab(tab) {
	activeLobbyTab = tab === 'forge' ? 'forge'
		: tab === 'shop' ? 'shop'
			: tab === 'economy' ? 'economy'
				: tab === 'medic' ? 'medic'
					: tab === 'keyitems' ? 'keyitems'
						: 'deck';
	const deckEditor = document.getElementById('deck-editor');
	const photonForge = document.getElementById('photon-forge');
	const cardShop = document.getElementById('card-shop');
	const cardEconomy = document.getElementById('card-economy');
	const guildMedic = document.getElementById('guild-medic');
	const keyItemLoadout = document.getElementById('key-item-loadout');
	const deckTabBtn = document.getElementById('lobby-tab-deck');
	const forgeTabBtn = document.getElementById('lobby-tab-forge');
	const shopTabBtn = document.getElementById('lobby-tab-shop');
	const economyTabBtn = document.getElementById('lobby-tab-economy');
	const medicTabBtn = document.getElementById('lobby-tab-medic');
	const keyItemsTabBtn = document.getElementById('lobby-tab-keyitems');
	if (deckEditor) deckEditor.classList.toggle('hidden', activeLobbyTab !== 'deck');
	if (photonForge) photonForge.classList.toggle('hidden', activeLobbyTab !== 'forge');
	if (cardShop) cardShop.classList.toggle('hidden', activeLobbyTab !== 'shop');
	if (cardEconomy) cardEconomy.classList.toggle('hidden', activeLobbyTab !== 'economy');
	if (guildMedic) guildMedic.classList.toggle('hidden', activeLobbyTab !== 'medic');
	if (keyItemLoadout) keyItemLoadout.classList.toggle('hidden', activeLobbyTab !== 'keyitems');
	if (deckTabBtn) deckTabBtn.classList.toggle('active', activeLobbyTab === 'deck');
	if (forgeTabBtn) forgeTabBtn.classList.toggle('active', activeLobbyTab === 'forge');
	if (shopTabBtn) shopTabBtn.classList.toggle('active', activeLobbyTab === 'shop');
	if (economyTabBtn) economyTabBtn.classList.toggle('active', activeLobbyTab === 'economy');
	if (medicTabBtn) medicTabBtn.classList.toggle('active', activeLobbyTab === 'medic');
	if (keyItemsTabBtn) keyItemsTabBtn.classList.toggle('active', activeLobbyTab === 'keyitems');
	if (activeLobbyTab === 'forge') renderPhotonForge();
	if (activeLobbyTab === 'shop') renderCardShop();
	if (activeLobbyTab === 'economy') renderCardEconomy();
	if (activeLobbyTab === 'medic') renderGuildMedic();
	if (activeLobbyTab === 'keyitems') renderKeyItemList();
}

function renderCardShopSellList() {
	const sellListEl = document.getElementById('shop-sell-list');
	if (!sellListEl) return;

	sellListEl.innerHTML = '';
	const ownedCounts = getDeckOwnedCounts();
	const entries = Object.entries(ownedCounts);
	if (entries.length === 0) {
		const hint = document.createElement('p');
		hint.className = 'shop-empty-hint';
		hint.textContent = 'No cards to sell.';
		sellListEl.appendChild(hint);
		return;
	}

	for (const [cardId, count] of entries) {
		const def = CARD_DEFS[cardId];
		if (!def) continue;
		const style = CARD_ACCENT_STYLE[cardId] || CARD_TYPE_STYLE[def.type] || CARD_TYPE_STYLE.weapon;
		const sellableInstance = findAvailableInventoryInstance(cardId);
		const sellValue = getCardSellValue(cardId);
		const canSell = !!sellableInstance;
		const evolvedBadge = def.isEvolved ? `<span class="evolved-badge">${THEME.progression.ascended}</span>` : '';

		const entry = document.createElement('div');
		entry.className = `owned-card-entry${def.isEvolved ? ' evolved-card' : ''}`;
		entry.innerHTML = `
      <span class="card-icon">${style.icon}</span>
      <span class="card-label">${def.name}</span>
      ${evolvedBadge}
      <span class="card-count">${count}</span>
      <span class="card-sell-value">${sellValue}g</span>
      <button class="sell-card-btn" ${canSell ? '' : 'disabled'}>Sell</button>
    `;
		const sellBtn = entry.querySelector('.sell-card-btn');
		sellBtn.addEventListener('click', () => {
			const instance = findAvailableInventoryInstance(cardId);
			if (instance) {
				socket.emit('sellCard', { instanceId: instance.instanceId, cardId });
			}
		});
		sellListEl.appendChild(entry);
	}
}

function renderCardShop() {
	const currencyEl = document.getElementById('shop-currency-display');
	const offerEl = document.getElementById('shop-offer-display');
	const buyBtn = document.getElementById('buy-shop-card-btn');
	const shopErrorEl = document.getElementById('shop-error');

	const currency = getMyCurrency();
	if (currencyEl) currencyEl.textContent = formatCurrencyLabel(currency);
	renderCardShopSellList();
	if (shopErrorEl) {
		shopErrorEl.style.display = 'none';
		shopErrorEl.textContent = '';
	}

	if (!offerEl) return;

	const offer = gameState && gameState.shopOffer;
	if (!offer || !offer.cardId) {
		offerEl.textContent = 'No offer available';
		offerEl.classList.add('shop-empty');
		if (buyBtn) buyBtn.disabled = true;
		return;
	}

	offerEl.classList.remove('shop-empty');
	offerEl.textContent = `${offer.name} (${getCardTypeLabel(offer.type)}) — ${formatCurrencyPrice(offer.price)}`;
	if (buyBtn) buyBtn.disabled = currency < offer.price;
}

function showForgeError(message) {
	const errorEl = document.getElementById('forge-error');
	if (!errorEl) return;
	errorEl.textContent = message;
	errorEl.style.display = message ? 'block' : 'none';
}

function playForgeAttuneAnimation(instanceId) {
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
		const grind = instance.grind || 0;
		const grindBadge = grind > 0 ? `<span class="forge-grind-badge">+${grind}</span>` : '';
		const tile = document.createElement('button');
		tile.type = 'button';
		tile.className = `forge-card-tile${instance.instanceId === selectedForgeInstanceId ? ' selected' : ''}${def.isEvolved ? ' evolved-card' : ''}`;
		tile.dataset.instanceId = instance.instanceId;
		tile.innerHTML = `
      <span class="card-icon">${style.icon}</span>
      <span class="card-label">${def.name}</span>
      ${grindBadge}
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
	const attuneCostEl = document.getElementById('forge-attune-cost');
	const attuneBtn = document.getElementById('forge-attune-btn');

	if (!selected) {
		if (selectedNameEl) selectedNameEl.textContent = 'Select a card';
		if (selectedMetaEl) selectedMetaEl.textContent = 'Choose an inventory card to preview attune bonuses.';
		if (statRowsEl) statRowsEl.innerHTML = '';
		if (attuneCostEl) attuneCostEl.textContent = 'Attune: — Money';
		if (attuneBtn) {
			attuneBtn.disabled = true;
			attuneBtn.textContent = THEME.progression.attune;
		}
		showForgeError('');
		return;
	}

	const def = CARD_DEFS[selected.cardId];
	const currency = getMyCurrency();
	const grind = selected.grind || 0;

	if (selectedNameEl) selectedNameEl.textContent = def ? def.name : selected.cardId;
	if (selectedMetaEl) {
		selectedMetaEl.textContent = `Instance ${selected.instanceId.slice(0, 8)} · Attune +${grind}`;
	}

	if (statRowsEl) {
		statRowsEl.innerHTML = '';
		const rows = getForgeAttunePreview(def, grind);
		for (const row of rows) {
			const tr = document.createElement('tr');
			tr.innerHTML = `<td>${row.label}</td><td>${row.current}</td><td>${row.next}</td>`;
			statRowsEl.appendChild(tr);
		}
	}

	const atMaxGrind = grind >= EVOLUTION_GRIND_REQUIRED;
	const attuneCost = atMaxGrind ? 0 : getGrindCost(grind);
	const canAttune = !atMaxGrind && currency >= attuneCost;
	if (attuneCostEl) {
		attuneCostEl.textContent = atMaxGrind
			? `Attune max (+${EVOLUTION_GRIND_REQUIRED}) reached`
			: `Attune: ${formatCurrencyPrice(attuneCost)}`;
	}
	if (attuneBtn) {
		attuneBtn.disabled = !canAttune;
		attuneBtn.textContent = atMaxGrind
			? THEME.progression.attune
			: (canAttune ? formatAttuneCost(attuneCost) : THEME.progression.attune);
	}
	showForgeError('');
}

if (document.getElementById('lobby-tab-deck')) {
	document.getElementById('lobby-tab-deck').addEventListener('click', () => setLobbyTab('deck'));
}
if (document.getElementById('lobby-tab-forge')) {
	document.getElementById('lobby-tab-forge').addEventListener('click', () => setLobbyTab('forge'));
}
if (document.getElementById('lobby-tab-shop')) {
	document.getElementById('lobby-tab-shop').addEventListener('click', () => setLobbyTab('shop'));
}
	if (document.getElementById('lobby-tab-economy')) {
	document.getElementById('lobby-tab-economy').addEventListener('click', () => setLobbyTab('economy'));
}
if (document.getElementById('lobby-tab-medic')) {
	document.getElementById('lobby-tab-medic').addEventListener('click', () => setLobbyTab('medic'));
}
if (document.getElementById('lobby-tab-keyitems')) {
	document.getElementById('lobby-tab-keyitems').addEventListener('click', () => setLobbyTab('keyitems'));
}
const medicHealBtnEl = document.getElementById('medic-heal-btn');
if (medicHealBtnEl) {
	medicHealBtnEl.addEventListener('click', () => {
		if (!socket || !socket.connected) {
			showMedicError('Not connected to server');
			return;
		}
		socket.emit('medicHeal');
	});
}
if (document.getElementById('forge-attune-btn')) {
	document.getElementById('forge-attune-btn').addEventListener('click', () => {
		if (!selectedForgeInstanceId) return;
		socket.emit('grindCard', { instanceId: selectedForgeInstanceId });
	});
}

// ── Card input handling ──

function playActivationEffect(slotIndex) {
	const slot = getCardSlotEl(slotIndex);
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
	if (slotIndex < 0 || slotIndex >= MAX_HAND_SLOTS) return;
	const card = hand[slotIndex];
	if (!card) return;

	if (!canUseSlot(slotIndex)) return;
	if (card.activeMinionId) return;

	const cardDef = getCardDef(card.id) || {};
	if (cardDef.effect === 'draw_card' && !canDrawIntoHandLocal()) {
		lastUsedSlot = slotIndex;
		showCardErrorToast('Hand full');
		return;
	}
	const playerMs = (gameState && myId && gameState.players[myId])
		? gameState.players[myId].magicStones
		: 0;
	const cardCost = card.magicStoneCost ?? cardDef.magicStoneCost;
	if (cardCost != null && cardCost > 0 && playerMs < cardCost) {
		lastUsedSlot = slotIndex;
		showCardErrorToast(THEME.resource.insufficient);
		const slot = getCardSlotEl(slotIndex);
		if (slot) slot.classList.add('no-ms');
		return;
	}

	lastUsedSlot = slotIndex;
	const facing = getPlayerFacingDirection();
	socket.emit('useCard', {
		slotIndex,
		cardId: card.id,
		rotation: Math.atan2(facing.z, facing.x),
	});

	if (creatureCardIds.has(card.id)) {
		slotCooldowns[slotIndex] = true;
		playActivationEffect(slotIndex);
		return;
	}

	if (spellCardIds.has(card.id)) {
		slotCooldowns[slotIndex] = true;
		playActivationEffect(slotIndex);
		return;
	}

	if (cardDef.effect === 'draw_card') {
		slotCooldowns[slotIndex] = true;
		playActivationEffect(slotIndex);
		return;
	}

	slotCooldowns[slotIndex] = true;
	playActivationEffect(slotIndex);
}

function discardCard(slotIndex) {
	if (slotIndex < 0 || slotIndex >= MAX_HAND_SLOTS) return;
	if (!gameState || gameState.gamePhase !== 'playing') return;

	const card = hand[slotIndex];
	if (!card) return;
	if (card.activeMinionId) {
		showCardErrorToast('Creature still active');
		return;
	}

	socket.emit('discardCard', { slotIndex, cardId: card.id });
}

// Keyboard input is handled by initInput() above; gamepad via setGamepadInputHandler below.

setGamepadInputHandler(({ lockOn: _lockOn }) => {
	// Card slots and deck toggle are handled by input.js pollInput().
});

// Click: delegate on #card-hand, read data-slot-index from .card-slot target
cardHandEl.addEventListener('click', (e) => {
	const slot = e.target.closest('.card-slot');
	if (!slot) return;
	useCard(parseInt(slot.dataset.slotIndex, 10));
});

cardHandEl.addEventListener('contextmenu', (e) => {
	const slot = e.target.closest('.card-slot');
	if (!slot || slot.classList.contains('empty')) return;
	e.preventDefault();
	discardCard(parseInt(slot.dataset.slotIndex, 10));
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
				await restoreSession(data.token);
				clearAuthForms();
			} else {
				if (loginErrorEl) loginErrorEl.textContent = data.error || 'Login failed';
			}
		} catch (err) {
			if (loginErrorEl) loginErrorEl.textContent = 'Network error — check connection';
		}
	});
}

function performLogout() {
	closeAccountOverlay();
	try { localStorage.removeItem(TOKEN_KEY); } catch (_) {}
	setAuthToken(null);
	currentLobbyName = '';
	if (socket) socket.disconnect();

	myId = null;
	hideAppToolbar();
	if (uiEl) uiEl.style.display = 'none';
	if (cardHandEl) hideCardHand();
	setDeckStackVisible(false);
	if (lobbyEl) lobbyEl.classList.add('hidden');
	if (lobbyBrowserEl) lobbyBrowserEl.classList.add('hidden');
	updateStatus('Disconnected', 'disconnected');
	showAuthOverlay();
	showRegisterForm();
	clearAuthForms();
}

if (accountLogoutBtnEl) {
	accountLogoutBtnEl.addEventListener('click', performLogout);
}

function showAccountError(message) {
	if (!accountErrorEl) return;
	if (message) {
		accountErrorEl.textContent = message;
		accountErrorEl.hidden = false;
	} else {
		accountErrorEl.textContent = '';
		accountErrorEl.hidden = true;
	}
}

function syncAccountForm() {
	const profile = getAccountProfile();
	if (accountUsernameInputEl) {
		accountUsernameInputEl.value = profile.username || '';
	}
	showAccountError('');
}

function openAccountOverlay() {
	syncAccountForm();
	if (accountOverlayEl) accountOverlayEl.classList.remove('hidden');
}

function closeAccountOverlay() {
	if (accountOverlayEl) accountOverlayEl.classList.add('hidden');
	showAccountError('');
}

function openLevelSettingsOverlay() {
	showLevelSettingsError('');
	syncLevelSettingsRewards();
	if (levelSettingsOverlayEl) levelSettingsOverlayEl.classList.remove('hidden');
}

function closeLevelSettingsOverlay() {
	if (levelSettingsOverlayEl) levelSettingsOverlayEl.classList.add('hidden');
}

if (levelSettingsBtnEl) {
	levelSettingsBtnEl.addEventListener('click', openLevelSettingsOverlay);
}
if (levelSettingsCloseBtnEl) {
	levelSettingsCloseBtnEl.addEventListener('click', closeLevelSettingsOverlay);
}
if (levelSettingsOverlayEl) {
	levelSettingsOverlayEl.addEventListener('click', (e) => {
		if (e.target === levelSettingsOverlayEl) closeLevelSettingsOverlay();
	});
}
function requestGiveUp(activeSocket) {
	if (!activeSocket || !activeSocket.connected) {
		showLevelSettingsError('Not connected to server');
		return;
	}
	if (!gameState || gameState.gamePhase !== 'playing' || !gameState.run || gameState.run.status === 'suspended') {
		showLevelSettingsError('No active expedition');
		return;
	}
	showLevelSettingsError('');
	if (giveUpBtnEl) giveUpBtnEl.disabled = true;
	activeSocket.emit('giveUp');
}

if (accountBtnEl) {
	accountBtnEl.addEventListener('click', openAccountOverlay);
}
if (accountCloseBtnEl) {
	accountCloseBtnEl.addEventListener('click', closeAccountOverlay);
}
if (accountOverlayEl) {
	accountOverlayEl.addEventListener('click', (e) => {
		if (e.target === accountOverlayEl) closeAccountOverlay();
	});
}
if (accountSaveBtnEl) {
	accountSaveBtnEl.addEventListener('click', async () => {
		const username = accountUsernameInputEl?.value?.trim();
		if (!username) {
			showAccountError('Enter a display name');
			return;
		}
		const current = getAccountProfile().username;
		if (username === current) {
			showAccountError('');
			closeAccountOverlay();
			return;
		}

		accountSaveBtnEl.disabled = true;
		const result = await patchProfile({ username });
		accountSaveBtnEl.disabled = false;

		if (result.error) {
			showAccountError(result.error);
			return;
		}

		showAccountError('');
		setLoggedInStatus(result.username);
		if (result.token) {
			try { localStorage.setItem(TOKEN_KEY, result.token); } catch (_) {}
			createSocket(result.token);
		}
		closeAccountOverlay();
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
		li.textContent = `${p.id} — ${p.ready ? THEME.lobby.deployReadyStatus : THEME.lobby.standby}`;
		lobbyPlayerList.appendChild(li);
	}
}

readyBtn.addEventListener('click', () => {
	isReady = !isReady;
	socket.emit('playerReady', isReady);
	readyBtn.textContent = isReady ? THEME.lobby.deployReady : THEME.lobby.deploy;
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

// ── Settings overlay ──

function syncSettingsForm() {
	if (lockOnRepeatSelectEl) {
		lockOnRepeatSelectEl.value = getLockOnRepeatAction();
	}
	syncUseKeyItemBindingUI();
	syncControllerCalibrationForm();
}

/** Display the current useKeyItem binding in the settings UI */
function syncUseKeyItemBindingUI() {
	const binding = getUseKeyItemBinding();
	if (useKeyItemKeyInputEl) {
		useKeyItemKeyInputEl.value = binding.keyboard.toUpperCase();
	}
	if (useKeyItemGamepadLabelEl) {
		useKeyItemGamepadLabelEl.textContent = binding.gamepadHint;
	}
}

/** State for keyboard key capture */
let capturingKeyItemKey = false;

/** State for gamepad button capture */
let capturingKeyItemGamepad = false;

function openSettingsOverlay() {
	syncSettingsForm();
	if (settingsOverlayEl) settingsOverlayEl.classList.remove('hidden');
	startControllerCalibration();
}

function closeSettingsOverlay() {
	stopControllerCalibration();
	capturingKeyItemKey = false;
	capturingKeyItemGamepad = false;
	if (keyItemGamepadCaptureRaf) {
		cancelAnimationFrame(keyItemGamepadCaptureRaf);
		keyItemGamepadCaptureRaf = 0;
	}
	if (settingsOverlayEl) settingsOverlayEl.classList.add('hidden');
}

if (settingsBtnEl) {
	settingsBtnEl.addEventListener('click', openSettingsOverlay);
}
if (settingsCloseBtnEl) {
	settingsCloseBtnEl.addEventListener('click', closeSettingsOverlay);
}
if (settingsOverlayEl) {
	settingsOverlayEl.addEventListener('click', (e) => {
		if (e.target === settingsOverlayEl) closeSettingsOverlay();
	});
}
if (lockOnRepeatSelectEl) {
	lockOnRepeatSelectEl.addEventListener('change', () => {
		patchSettings({ lockOnRepeatAction: lockOnRepeatSelectEl.value });
	});
}

// ── useKeyItem keyboard binding capture ──

if (useKeyItemKeyInputEl) {
	useKeyItemKeyInputEl.addEventListener('focus', () => {
		capturingKeyItemKey = true;
		useKeyItemKeyInputEl.value = '';
	});
	useKeyItemKeyInputEl.addEventListener('blur', () => {
		capturingKeyItemKey = false;
		if (!useKeyItemKeyInputEl.value) syncUseKeyItemBindingUI();
	});
	useKeyItemKeyInputEl.addEventListener('keydown', (e) => {
		if (!capturingKeyItemKey) return;
		// Ignore modifier-only keys
		if (['control', 'shift', 'alt', 'meta', 'capslock', 'tab', 'escape'].includes(e.key.toLowerCase())) return;
		e.preventDefault();
		e.stopPropagation();
		const key = e.key.toLowerCase();
		patchSettings({ keyboard: { bindings: { useKeyItem: key } } });
		capturingKeyItemKey = false;
		useKeyItemKeyInputEl.blur();
		syncUseKeyItemBindingUI();
	});
}

// ── useKeyItem gamepad binding capture ──

if (useKeyItemGamepadLabelEl) {
	useKeyItemGamepadLabelEl.style.cursor = 'pointer';
	useKeyItemGamepadLabelEl.title = 'Click to capture gamepad button';
	useKeyItemGamepadLabelEl.addEventListener('click', () => {
		capturingKeyItemGamepad = true;
		useKeyItemGamepadLabelEl.textContent = 'Press…';
		startKeyItemGamepadCapture();
	});
}

let keyItemGamepadCaptureRaf = 0;
let keyItemGamepadCapturePrev = null;

function startKeyItemGamepadCapture() {
	if (keyItemGamepadCaptureRaf) return;
	keyItemGamepadCapturePrev = null;
	keyItemGamepadCaptureRaf = requestAnimationFrame(keyItemGamepadCaptureFrame);
}

function keyItemGamepadCaptureFrame() {
	if (!capturingKeyItemGamepad) {
		keyItemGamepadCaptureRaf = 0;
		return;
	}
	const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
	for (const gp of pads) {
		const btnCount = Math.min(gp.buttons.length, 16);
		for (let i = 0; i < btnCount; i++) {
			const pressed = gp.buttons[i]?.pressed ?? false;
			const wasPressed = keyItemGamepadCapturePrev?.[i] ?? false;
			if (pressed && !wasPressed) {
				patchSettings({ gamepad: { bindings: { useKeyItem: { type: 'button', index: i } } } });
				capturingKeyItemGamepad = false;
				keyItemGamepadCaptureRaf = 0;
				syncUseKeyItemBindingUI();
				return;
			}
		}
		// Update prev state
		if (!keyItemGamepadCapturePrev) keyItemGamepadCapturePrev = {};
		for (let i = 0; i < btnCount; i++) {
			keyItemGamepadCapturePrev[i] = gp.buttons[i]?.pressed ?? false;
		}
	}
	keyItemGamepadCaptureRaf = requestAnimationFrame(keyItemGamepadCaptureFrame);
}

onSettingsChange(() => {
	syncSettingsForm();
	resetHandLayoutLock();
	if (cardHandEl && cardHandEl.style.display !== 'none') showCardHand();
	renderHand();
});
syncSettingsForm();

initControllerCalibration({
	statusEl: gamepadStatusEl,
	deviceIdEl: gamepadDeviceIdEl,
	activationHintEl: gamepadActivationHintEl,
	profileSelectEl: gamepadProfileSelectEl,
	profileHintEl: gamepadProfileHintEl,
	deadzoneSliderEl: gamepadDeadzoneSliderEl,
	deadzoneValueEl: gamepadDeadzoneValueEl,
	moveStickSelectEl: gamepadMoveStickSelectEl,
	leftDotEl: calibrationLeftDotEl,
	leftValuesEl: calibrationLeftValuesEl,
	secondaryStickPanelEl: calibrationSecondaryStickPanelEl,
	secondaryStickLabelEl: calibrationSecondaryStickLabelEl,
	triggerAxesEl: calibrationTriggerAxesEl,
	rightDotEl: calibrationRightDotEl,
	rightValuesEl: calibrationRightValuesEl,
	buttonGridEl: calibrationButtonGridEl,
	debugLogEl: calibrationDebugLogEl,
	debugCopyBtnEl: calibrationDebugCopyBtnEl,
	debugClearBtnEl: calibrationDebugClearBtnEl,
});

window.addEventListener('gamepadconnected', (event) => {
	onGamepadConnectChange(event.gamepad);
	resetHandLayoutLock();
	if (cardHandEl && cardHandEl.style.display !== 'none') showCardHand();
	renderHand();
});
window.addEventListener('gamepaddisconnected', () => {
	onGamepadConnectChange(null);
	resetHandLayoutLock();
	if (cardHandEl && cardHandEl.style.display !== 'none') showCardHand();
	renderHand();
});

// On page load: only connect if we have a stored token; otherwise show auth overlay.
if (storedToken) {
	restoreSession(storedToken);
} else {
	showAuthOverlay();
	showRegisterForm();
}

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

	const statusText = data.status === 'victory' ? THEME.run.sortieComplete : THEME.run.signalLost;
	summaryStatusEl.textContent = statusText;
	if (summaryQuestEl) {
		const questLabel = data.questName || (data.objective && data.objective.label) || '';
		summaryQuestEl.textContent = questLabel ? `Contract: ${questLabel}` : '';
	}
	summaryDurationEl.textContent = `Duration: ${formatDuration(data.durationMs || 0)}`;
	summaryEnemiesEl.textContent = `${THEME.run.hostilesPurged}: ${data.defeatedEnemies || 0}`;
	summaryCurrencyEl.textContent = `${THEME.run.currencyCollected}: ${data.currencyCollected || 0}`;

	const me = data.players && data.players.find((p) => p.id === myId);
	const rewards = me && me.rewards;
	const cardChoices = me && Array.isArray(me.cardChoices) ? me.cardChoices : [];

	if (rewards) {
		const currencyBonus = rewards.currency || 0;
		summaryRewardsCurrencyEl.textContent = formatMoneyEarned(currencyBonus);

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

if (abandonRunBtn) {
	abandonRunBtn.addEventListener('click', () => {
		socket.emit('abandonRun');
	});
}

if (createLobbyBtnEl) {
	createLobbyBtnEl.addEventListener('click', () => {
		if (!socket) return;
		const name = createLobbyNameEl ? createLobbyNameEl.value.trim() : '';
		socket.emit('createLobby', name ? { name } : {});
	});
}

if (refreshLobbiesBtnEl) {
	refreshLobbiesBtnEl.addEventListener('click', () => {
		if (socket) socket.emit('listLobbies');
	});
}

if (leaveLobbyBtnEl) {
	leaveLobbyBtnEl.addEventListener('click', () => {
		if (socket) socket.emit('leaveLobby');
	});
}

// ── Window exports for test harness ──

window.initScene = rendererInitScene;
window.refillSlot = refillSlot;
window.renderHand = renderHand;
window.showCardHand = showCardHand;
window.__resetHandLayoutLock = resetHandLayoutLock;
window.renderDeckEditor = renderDeckEditor;
window.renderCardShop = renderCardShop;
window.renderPhotonForge = renderPhotonForge;
window.renderKeyItemList = renderKeyItemList;
window.__setKeyItemDefs = (defs) => { keyItemDefs = defs || {}; };
window.__isSocketReady = () => !!(socket && socket.connected);
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
	if (Number.isFinite(currency)) {
		myCurrency = currency;
		updateCurrencyHud(myCurrency);
	}
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
window.__discardCardForTest = discardCard;
window.__resumeAudioContext = resumeAudioContext;
window.__setAudioCtx = (ctx) => { setAudioContext(ctx); };
window.__getAudioCtx = () => getAudioContext();
window.showAuthOverlay = showAuthOverlay;
window.hideAuthOverlay = hideAuthOverlay;
window.showLobbyBrowser = showLobbyBrowser;
window.openSettingsOverlay = openSettingsOverlay;
window.closeSettingsOverlay = closeSettingsOverlay;
window.openAccountOverlay = openAccountOverlay;
window.openLevelSettingsOverlay = openLevelSettingsOverlay;
window.closeLevelSettingsOverlay = closeLevelSettingsOverlay;
window.updateLevelSettingsBtnVisibility = updateLevelSettingsBtnVisibility;
window.closeAccountOverlay = closeAccountOverlay;
window.performLogout = performLogout;
window.showGameLobby = showGameLobby;
window.renderLobbyList = renderLobbyList;
window.applyLobbyJoinedData = applyLobbyJoinedData;
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
		runStatus: gameState && gameState.run ? gameState.run.status : null,
		extracted: !!(me && me.extracted),
		suspendedRunSummary: gameState ? gameState.suspendedRunSummary : null,
		telepipe: gameState ? gameState.telepipe : null,
		connectionState,
		sceneInitialized: isSceneInitialized(),
		hasCanvas: !!document.querySelector('canvas'),
		lobbyVisible,
		cardHandVisible,
		status: statusEl ? statusEl.innerText : '',
		hpText: hpText ? hpText.textContent : '',
		msText: msText ? msText.textContent : '',
		currencyText: currencyDisplayEl ? currencyDisplayEl.textContent : '',
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
		enemyHp: gameState ? gameState.enemies.map((enemy) => ({
			id: enemy.id,
			hp: enemy.hp,
			maxHp: enemy.maxHp,
		})) : [],
		minions: gameState && gameState.minions ? gameState.minions.map((m) => ({
			id: m.id,
			type: m.type,
			ownerId: m.ownerId,
			hp: m.hp,
			maxHp: m.maxHp,
			x: m.x,
			z: m.z,
		})) : [],
		hand: hand.map((card, slotIndex) => {
			if (!card) return null;
			const slotEl = getCardSlotEl(slotIndex);
			return {
				id: card.id,
				name: card.name,
				type: card.type,
				remainingCharges: card.remainingCharges,
				charges: card.charges,
				activeMinionId: card.activeMinionId || null,
				burnMaxTtl: card.burnMaxTtl ?? null,
				burnLabel: slotEl?.querySelector('.card-charges')?.textContent || null,
				creatureBurning: !!slotEl?.classList.contains('creature-burning'),
				isEvolved: !!card.isEvolved,
				specialEffect: card.specialEffect,
			};
		}),
	};
};

// v8 ignore end
