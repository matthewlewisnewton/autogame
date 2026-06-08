// v8 ignore start
// All code below is UI/Three.js/Socket-dependent and cannot be unit tested.
// Testable logic is extracted to cards.js, collision.js, and hand.js.

import {
	formatObjectiveSummary,
	formatRewardSummary,
	formatQuestTierLabel,
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
import { CARD_DEFS, CARD_TYPE_STYLE, CARD_ACCENT_STYLE, EVOLUTION_GRIND_REQUIRED, EVOLUTION_TRANSFORMS, getCardSellValue, getGrindCost, getCardDef, getForgeAttunePreview, weaponCardIds, spellCardIds, creatureCardIds, enchantmentCardIds } from './cards.js';
import { buildLoadoutDeckDisplay } from './deck-loadout.js';
import { drawCard, initHand as initHandFromModule, hand, deck, desperationDeck, slotCooldowns, canUseSlot, setDrawPile, setDesperationDrawPile, inDesperation, setInDesperation, canDrawIntoHandLocal, MAX_HAND_SLOTS, setHandInputLockChecker } from './hand.js';
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
	getReservedKeys,
} from './input.js';
import {
	DECK_MAX_SIZE,
	MAX_HP,
	MAX_MS,
	MEDIC_HEAL_COST,
	APPEARANCE_CHANGE_COST,
	MOVE_SPEED,
	TICK_RATE,
	VARIANT_CODEX_DATA,
} from './config.js';
import {
	patchSettings,
	getLockOnRepeatAction,
	onSettingsChange,
	loadAccountSettings,
	setAuthToken,
	patchProfile,
	getAccountProfile,
	getAccountCosmetic,
	setAccountCosmetic,
	setUnlockedHats,
} from './settings.js';
import { createCosmeticSelection } from './cosmeticForm.js';
import {
	initCharacterBooth,
	openCharacterBooth,
	closeCharacterBooth,
	rebuildBoothHatList,
	showBoothCosmeticError,
	handleAppearanceChanged,
	handleAppearanceError,
	isCharacterBoothOpen,
	patchBoothSelection,
	requestBoothSave,
	confirmBoothPaidSave,
} from './characterBooth.js';
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
import { syncLockOnInfoPanel } from './lock-on-info-panel.js';
import { buildBossEncounterModel, syncBossEncounterHud } from './boss-encounter-hud.js';
import { clearAllLockOnState } from './lockOn.js';

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
	getEnemyRenderScaleForTest as rendererGetEnemyRenderScaleForTest,
	healthBarColor as rendererHealthBarColor,
	createHealthBarMesh as rendererCreateHealthBarMesh,
	updateHealthBarMesh as rendererUpdateHealthBarMesh,
	applyWindupFlash as rendererApplyWindupFlash,
	applyRevealHighlight as rendererApplyRevealHighlight,
	spawnAttackEffect as rendererSpawnAttackEffect,
	spawnSummonEffect as rendererSpawnSummonEffect,
	spawnDivineGraceEffect as rendererSpawnDivineGraceEffect,
	spawnPurifyingPulseEffect as rendererSpawnPurifyingPulseEffect,
	spawnPurifyingPulseHealRing as rendererSpawnPurifyingPulseHealRing,
	spawnCleanseBurstEffect as rendererSpawnCleanseBurstEffect,
	spawnChainLightningEffect as rendererSpawnChainLightningEffect,
	spawnLightningArc as rendererSpawnLightningArc,
	spawnInfernoPillarEffect as rendererSpawnInfernoPillarEffect,
	spawnVolatileExplosionEffect as rendererSpawnVolatileExplosionEffect,
	spawnFireTrailEffect as rendererSpawnFireTrailEffect,
	spawnParticleBurst as rendererSpawnParticleBurst,
	spawnProjectileTrail as rendererSpawnProjectileTrail,
	spawnImpactDecal as rendererSpawnImpactDecal,
	spawnTelegraphRing as rendererSpawnTelegraphRing,
	spawnMirrorWardShellEffect as rendererSpawnMirrorWardShellEffect,
	dismissMirrorWardShellEffect as rendererDismissMirrorWardShellEffect,
	spawnMirrorWardReflectBurst as rendererSpawnMirrorWardReflectBurst,
	spawnMinionSummonInEffect as rendererSpawnMinionSummonInEffect,
	markLootCollected as rendererMarkLootCollected,
	markCardHitEnemies as rendererMarkCardHitEnemies,
	disposeMeshMap as rendererDisposeMeshMap,
	disposeStaleMeshes as rendererDisposeStaleMeshes,
	disposeOne as rendererDisposeOne,
	disposeAllLootMeshes as rendererDisposeAllLootMeshes,
	disposeAvatar as rendererDisposeAvatar,
	disposeNameplate as rendererDisposeNameplate,
	getActiveEffects,
	getPickedUpLootIds,
	pruneLootPickupAttempts,
	getWindupFlashing,
	triggerDashVFX,
	triggerHealPulseVFX,
	triggerMedicAllyHealVFX,
	triggerMedicEnergyBeadVFX,
	triggerShieldVFX,
	triggerSmokeVFX,
	triggerLootMagnetVFX,
	getPhaseStepTargetId,
	applyLockOnPress,
	emitBoothInteract,
	setBoothInRangeListener,
	setEnemyDisplayCatalogGetter,
} from './renderer.js';
import { updateBoothPrompt, dispatchBoothAction, BOOTH_ACTION_EVENT } from './boothPrompt.js';
import { openDeckBooth, registerDeckBoothListener, createRequestDebugBoothOpener } from './boothDeck.js';
import { openShopBooth, registerShopBoothListener, createRequestDebugShopBoothOpener } from './boothShop.js';
import { isLaunchBoothAction, getBoothDebugHook, LAUNCH_BOOTH_ID, shouldLaunchReadyUp, LAUNCH_READY_EVENT } from './launchBooth.js';
import { QUEST_BOOTH_ID, isQuestBoothAction } from './questBooth.js';
import eventsCatalog from '../shared/events.json' with { type: 'json' };

const { serverToClient: SERVER_TO_CLIENT, clientToServer: CLIENT_TO_SERVER } = eventsCatalog;

// ── DOM element references ──
const statusEl = document.getElementById('status');
const boothPromptEl = document.getElementById('booth-prompt');
const lobbyPlayerList = document.getElementById('lobby-player-list');
const questBoardEl = document.getElementById('quest-board');
const questBoardWrapperEl = document.getElementById('quest-board-wrapper');
const questErrorEl = document.getElementById('quest-error');
const suspendedRunBannerEl = document.getElementById('suspended-run-banner');
const resumeRunBtnEl = document.getElementById('resume-run-btn');
const abandonRunBtnEl = document.getElementById('abandon-run-btn');
const lobbyHudEl = document.getElementById('lobby-hud');
const lobbyCloseBtnEl = document.getElementById('lobby-close-btn');
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
const attackReticleEl = document.getElementById('attack-reticle');
const attackHintEl = document.getElementById('attack-hint');

/** Show/hide the center reticle + attack hint (in-run affordance only). */
function setAttackAffordanceVisible(visible) {
	if (attackReticleEl) attackReticleEl.classList.toggle('hidden', !visible);
	if (attackHintEl) attackHintEl.classList.toggle('hidden', !visible);
}
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
	setAttackAffordanceVisible(true);
	renderHand();
}

function hideCardHand() {
	if (cardHandEl) cardHandEl.style.display = 'none';
	setAttackAffordanceVisible(false);
	resetHandLayoutLock();
}
const deckViewerOverlayEl = document.getElementById('deck-viewer-overlay');
const deckViewerGridEl = document.getElementById('deck-viewer-grid');
const deckViewerCountEl = document.getElementById('deck-viewer-count');
const variantCodexOverlayEl = document.getElementById('variant-codex-overlay');
const variantCodexListEl = document.getElementById('variant-codex-list');
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
/** When true, the dismissible #lobby menu stays hidden until showGameLobby(). */
let lobbyMenuDismissed = false;
/** True after the first extracted-waiting overlay setup; avoids re-showing #lobby each tick. */
let extractedLobbyOverlayActive = false;

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
	setLobbyHudVisible(false);
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

function setLobbyHudVisible(visible) {
	if (lobbyHudEl) lobbyHudEl.classList.toggle('hidden', !visible);
}

function setSuspendedRunControlsVisible(visible) {
	if (resumeRunBtnEl) resumeRunBtnEl.classList.toggle('hidden', !visible);
	if (abandonRunBtnEl) abandonRunBtnEl.classList.toggle('hidden', !visible);
}

function clearSuspendedRunUi() {
	if (suspendedRunBannerEl) {
		suspendedRunBannerEl.textContent = '';
		suspendedRunBannerEl.classList.add('hidden');
	}
	setSuspendedRunControlsVisible(false);
	if (questErrorEl && questErrorEl.textContent === THEME.run.questSuspendedLocked) {
		questErrorEl.style.display = 'none';
		questErrorEl.textContent = '';
	}
}

function renderSuspendedRunBanner(summary) {
	if (!summary) {
		clearSuspendedRunUi();
		return;
	}
	const questName = summary.questName
		|| (summary.questId ? summary.questId.replace(/_/g, ' ') : '')
		|| THEME.run.unknownSector;
	if (suspendedRunBannerEl) {
		suspendedRunBannerEl.textContent = THEME.run.suspendedSortieBanner.replace('{questName}', questName);
		suspendedRunBannerEl.classList.remove('hidden');
	}
	if (resumeRunBtnEl) resumeRunBtnEl.textContent = THEME.run.resumeSortie;
	if (abandonRunBtnEl) abandonRunBtnEl.textContent = THEME.run.abandonSortie;
	setSuspendedRunControlsVisible(true);
	renderQuestBoardState();
}

function setDeployButtonVisible(visible) {
	// During a suspended sortie the hub resume button replaces the retired 2D Deploy
	// control; fresh sorties still ready-up via the Launch Bay booth.
	setSuspendedRunControlsVisible(visible);
}

function isGameLobbyMenuVisible() {
	return !!lobbyEl && !lobbyEl.classList.contains('hidden');
}

function isLobbyMenuDismissKeyBlocked(e) {
	const target = e.target;
	if (target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement ||
		target?.isContentEditable) {
		return true;
	}
	return !!(variantCodexOpen || deckViewerOpen || isLevelSettingsOpen() || isCharacterBoothOpen()
		|| (settingsOverlayEl && !settingsOverlayEl.classList.contains('hidden'))
		|| (authOverlayEl && !authOverlayEl.classList.contains('hidden'))
		|| (accountOverlayEl && !accountOverlayEl.classList.contains('hidden'))
		|| (levelSettingsOverlayEl && !levelSettingsOverlayEl.classList.contains('hidden'))
		|| (runSummaryOverlay && getComputedStyle(runSummaryOverlay).display !== 'none'));
}

function dismissGameLobby() {
	if (!lobbyEl) return;
	lobbyMenuDismissed = true;
	lobbyEl.classList.add('hidden');
	if (questBoardWrapperEl) questBoardWrapperEl.classList.add('hidden');
}

function showLobbyBrowser() {
	lobbyMenuDismissed = false;
	extractedLobbyOverlayActive = false;
	if (lobbyBrowserEl) lobbyBrowserEl.classList.remove('hidden');
	if (lobbyEl) lobbyEl.classList.add('hidden');
	setLobbyHudVisible(false);
	if (uiEl) uiEl.style.display = 'none';
	if (cardHandEl) hideCardHand();
	hideVariantCodex();
	setDeckStackVisible(false);
	applyLobbyThemeLabels();
}

function showGameLobby() {
	if (lobbyBrowserEl) lobbyBrowserEl.classList.add('hidden');
	lobbyMenuDismissed = false;
	if (lobbyEl) lobbyEl.classList.remove('hidden');
	setLobbyHudVisible(true);
	// Quest board only appears via the quest booth, so keep it hidden each time
	// the lobby is (re)shown.
	if (questBoardWrapperEl) questBoardWrapperEl.classList.add('hidden');
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
	const preview = me?.returnRewardsPreview ?? _lastReturnRewardsPreview;

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
function returnToGuildLobby(state, { refreshCollection = false, rebuildHub = false } = {}) {
	closeLevelSettingsOverlay();
	showLevelSettingsError('');
	if (giveUpBtnEl) giveUpBtnEl.disabled = false;
	updateLevelSettingsBtnVisibility();

	if (runSummaryOverlay) runSummaryOverlay.style.display = 'none';
	if (cardHandEl) hideCardHand();
	hideVariantCodex();
	setDeckStackVisible(false);
	clearKeyItemCooldownHud();
	extractedLobbyOverlayActive = false;
	if (lobbyMenuDismissed) {
		if (lobbyBrowserEl) lobbyBrowserEl.classList.add('hidden');
		setLobbyHudVisible(true);
		if (lobbyEl) lobbyEl.classList.add('hidden');
		if (questBoardWrapperEl) questBoardWrapperEl.classList.add('hidden');
		applyLobbyThemeLabels();
	} else {
		showGameLobby();
	}
	if (suspendedRunSummary) {
		renderSuspendedRunBanner(suspendedRunSummary);
	} else {
		clearSuspendedRunUi();
	}
	// On the play→lobby transition, switch the rendered geometry back to the hub
	// and re-seat the avatar at the hub spawn. `renderHubScene()` also sets the
	// lobby game phase. Guarded by `rebuildHub` so this runs once per return, not
	// on every lobby-phase stateUpdate.
	if (rebuildHub && isSceneInitialized() && hubLayout) {
		renderHubScene();
	} else {
		setGamePhase('lobby');
	}

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
		if (state.selectedQuestId && (
			state.selectedQuestId !== selectedQuestId
			|| (state.selectedQuestTier ?? 1) !== (selectedQuestTier ?? 1)
		)) {
			applyQuestBoardState({
				selectedQuestId: state.selectedQuestId,
				selectedQuestTier: state.selectedQuestTier,
			});
		}
	}
}

/** True when exactly one player is in the squad (solo deploy). */
function isSoloSquad(state = gameState) {
	return !!(state && state.players && Object.keys(state.players).length === 1);
}

function showExtractedLobbyOverlay() {
	if (runSummaryOverlay) runSummaryOverlay.style.display = 'none';
	if (cardHandEl) hideCardHand();
	hideVariantCodex();
	setDeckStackVisible(false);
	clearKeyItemCooldownHud();
	// Switch the rendered scene from the dungeon to the walkable hub so the
	// extracted player stands in the hub ship-interior rather than on the old
	// dungeon geometry. Only rebuild when not already showing the hub: during a
	// partial extract the server stays in `playing` and keeps emitting
	// stateUpdates, so re-rendering every tick would rebuild geometry and snap
	// the avatar back to the hub spawn. Degrades gracefully to the prior flat
	// overlay when no hub layout is available or the scene isn't initialized.
	if (renderedSceneProfile !== 'hub' && hubLayout && isSceneInitialized()) {
		renderHubScene();
	}
	if (!extractedLobbyOverlayActive) {
		showGameLobby();
		extractedLobbyOverlayActive = true;
	} else if (!lobbyMenuDismissed && !isGameLobbyMenuVisible()) {
		showGameLobby();
	}
	setDeployButtonVisible(false);
	setSuspendedRunControlsVisible(false);
	if (suspendedRunBannerEl) {
		suspendedRunBannerEl.textContent = THEME.run.awaitingExtract;
		suspendedRunBannerEl.classList.remove('hidden');
	}
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
			if (socket) socket.emit(CLIENT_TO_SERVER.JOIN_LOBBY, { lobbyId: lobby.id });
		});

		item.appendChild(meta);
		item.appendChild(joinBtn);
		lobbyListEl.appendChild(item);
	}
}

/** Remove a remote player's avatar mesh and username nameplate from the scene. */
function removeRemotePlayerVisuals(playerId) {
	const maps = getMeshMaps();
	const sc = getScene();
	if (maps.playersMeshes[playerId]) {
		if (sc) sc.remove(maps.playersMeshes[playerId]);
		rendererDisposeAvatar(maps.playersMeshes[playerId]);
		delete maps.playersMeshes[playerId];
	}
	rendererDisposeNameplate(playerId);
}

/**
 * Merge hub-presence entries into `gameState.players` during the lobby phase.
 * Remote players are server-authoritative for position/rotation/cosmetic;
 * the local player keeps client-predicted movement fields.
 */
function applyHubPresence(presence, opts = {}) {
	if (!presence || !gameState || gameState.gamePhase !== 'lobby') return;

	const removedPlayerIds = Array.isArray(opts.removedPlayerIds) ? opts.removedPlayerIds : [];
	for (const id of removedPlayerIds) {
		if (!id || id === myId) continue;
		if (gameState.players[id]) delete gameState.players[id];
		removeRemotePlayerVisuals(id);
	}

	const rawEntries = presence.entries;
	const entries = (rawEntries && typeof rawEntries === 'object' && !Array.isArray(rawEntries))
		? rawEntries
		: {};
	for (const [id, entry] of Object.entries(entries)) {
		if (!id || !entry || typeof entry !== 'object') continue;
		if (id === myId) {
			const local = gameState.players[id];
			if (!local) continue;
			if (entry.cosmetic) local.cosmetic = entry.cosmetic;
			if (entry.username) local.username = entry.username;
			continue;
		}

		if (!gameState.players[id]) {
			gameState.players[id] = { id, hp: 100, dead: false };
		}
		const player = gameState.players[id];
		if (Number.isFinite(entry.x)) player.x = entry.x;
		if (Number.isFinite(entry.y)) player.y = entry.y;
		else if (player.y == null) player.y = 0.5;
		if (Number.isFinite(entry.z)) player.z = entry.z;
		if (Number.isFinite(entry.rotation)) player.rotation = entry.rotation;
		if (entry.cosmetic) player.cosmetic = entry.cosmetic;
		if (entry.username) player.username = entry.username;
		player.connected = entry.connected !== false;
	}

	setGameStateRef(gameState);
}

/**
 * Render the hub geometry for the lobby phase and spawn the local avatar at the
 * hub's `role: 'start'` spawn. Initializes the scene on first entry, otherwise
 * rebuilds the existing scene to the hub layout. No-op without a hub layout.
 * Marks `gameState.layout` as the hub so floor sampling for the local avatar
 * uses the rendered hub geometry, and refreshes the renderer's game-state ref so
 * the animate loop builds the avatar from `gameState.players[myId]`.
 */
function renderHubScene() {
	if (!hubLayout) return false;
	if (!isSceneInitialized()) {
		rendererInitScene(hubLayout, getSpawnPosition());
	} else if (renderedSceneProfile !== 'hub') {
		rebuildDungeonLayout(hubLayout);
	}
	renderedSceneProfile = 'hub';
	if (gameState) {
		gameState.layout = hubLayout;
		setGameStateRef(gameState);
	}
	const spawn = getSpawnPosition();
	setPlayerPosition(spawn.x, spawn.z);
	setGamePhase('lobby');
	requestBoothDebugOpen();
	return true;
}

function applyLobbyJoinedData(data) {
	myId = data.id;
	rendererSetMyId(data.id);
	if (data.playerId) {
		try { localStorage.setItem(STORAGE_KEY_PLAYER_ID, data.playerId); } catch (_) {}
	}
	gameState = data.state;
	suspendedRunSummary = cloneSuspendedRunSummary(data.state?.suspendedRunSummary ?? null);
	currentLayout = data.layout || (data.state && data.state.layout) || currentLayout;
	hubLayout = data.hubLayout || hubLayout;
	if (gameState && currentLayout) gameState.layout = currentLayout;
	setGameStateRef(gameState);

	mySelectedDeck = data.selectedDeck || [];
	myInventory = Array.isArray(data.inventory) ? data.inventory : null;
	myOwnedCards = data.ownedCards || {};
	if (data.state && data.state.players && data.state.players[myId]) {
		myCurrency = data.state.players[myId].currency || 0;
	}
	renderDeckEditor();
	applyQuestBoardFromPayload({
		...data,
		selectedQuestId: data.selectedQuestId || (data.state && data.state.selectedQuestId),
		selectedQuestTier: data.selectedQuestTier ?? (data.state && data.state.selectedQuestTier),
	});
	if (activeLobbyTab === 'forge') renderPhotonForge();

	if (data.accountId) {
		const username = data.username || data.accountId;
		setLoggedInStatus(username, data.lobbyName);
		showAppToolbar();
	}

	if (data.hubPresence) applyHubPresence(data.hubPresence);

	const receivedSeed = data.layoutSeed;
	const joinPhase = data.state && data.state.gamePhase;

	// Deploying/joining into an in-progress run renders the quest layout; a plain
	// lobby join renders the hub. Handle the two phases separately so a lobby join
	// never reuses (or rebuilds into) the quest geometry, and a run join never
	// deploys the player into the hub geometry.
	if (joinPhase === 'playing') {
		if (lobbyBrowserEl) lobbyBrowserEl.classList.add('hidden');
		const seedChanged = receivedSeed !== undefined && receivedSeed !== currentLayoutSeed;
		if (receivedSeed !== undefined) currentLayoutSeed = receivedSeed;
		requestDebugScenario();

		if (!isSceneInitialized()) {
			if (lobbyEl) lobbyEl.classList.add('hidden');
			setLobbyHudVisible(false);
			uiEl.style.display = 'block';
			showCardHand();
			setDeckStackVisible(true);
			initHand();
			rendererInitScene(currentLayout, getSpawnPosition());
			renderedSceneProfile = 'quest';
			if (gameState) gameState.layout = currentLayout;
			updateObjectiveHud();
			setGamePhase('playing');
			return;
		}

		// Scene already exists — switch geometry to the quest run when it is
		// currently showing the hub (or the quest seed changed), then reposition.
		if (currentLayout && (renderedSceneProfile !== 'quest' || seedChanged)) {
			rebuildDungeonLayout(currentLayout);
		}
		renderedSceneProfile = 'quest';
		if (gameState) gameState.layout = currentLayout;
		if (lobbyEl) lobbyEl.classList.add('hidden');
		setLobbyHudVisible(false);
		const me = myId && gameState && gameState.players ? gameState.players[myId] : null;
		if (me && Number.isFinite(me.x) && Number.isFinite(me.z)) {
			setPlayerPosition(me.x, me.z);
		} else {
			const spawnPos = getSpawnPosition();
			setPlayerPosition(spawnPos.x, spawnPos.z);
		}
		return;
	}

	// Lobby phase — render the hub layout and spawn the local avatar inside it.
	if (receivedSeed !== undefined) currentLayoutSeed = receivedSeed;
	requestDebugScenario();
	renderHubScene();
	requestDebugBoothOpen();
	requestDebugShopBoothOpen();
	updateObjectiveHud();
	if (lobbyBrowserEl) lobbyBrowserEl.classList.add('hidden');
	setLobbyHudVisible(true);
	applyLobbyThemeLabels();
	const lobbyMe = myId && gameState?.players ? gameState.players[myId] : null;
	syncVanguardHud(lobbyMe, 'lobby');
	dismissGameLobby();
	if (suspendedRunSummary) {
		renderSuspendedRunBanner(suspendedRunSummary);
	} else {
		clearSuspendedRunUi();
	}
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
const boothDebugParam = new URLSearchParams(window.location.search).get('booth');
let debugScenarioRequested = false;
let boothDebugRequested = false;
let debugScenarioResult = null;
let debugGodmodeResult = null;
const debugBooth = new URLSearchParams(window.location.search).get('booth');
const debugBoothAllowed = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
let lastRunSummary = null; // most recent runComplete payload, for harness-state inspection
/** @type {null | { questId: string, questName: string, objective: object | null }} */
let suspendedRunSummary = null;
let lastUsedSlot = -1; // tracks the most recently clicked/pressed slot index for cardError targeting

function cloneSuspendedRunSummary(summary) {
	if (!summary) return null;
	return {
		questId: summary.questId,
		questName: summary.questName,
		objective: summary.objective ? { ...summary.objective } : null,
	};
}

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
	// Explicit reconnection/timeout config rather than relying on undocumented
	// defaults, so a stalled initial connect deterministically surfaces a
	// `connect_error` the client can act on instead of hanging silently.
	socket = io({
		auth: { token },
		timeout: CONNECT_WATCHDOG_MS,
		reconnection: true,
		reconnectionAttempts: Infinity,
		reconnectionDelay: 1000,
		reconnectionDelayMax: 5000,
	});
	setSocketRef(socket);
	bindSocketHandlers(socket);
	// Surface a persistent error if this (re)created socket never reaches
	// `connect`. Cleared in the `connect`/`reconnect` handlers below.
	startConnectWatchdog();
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

function canUseGameActions() {
	return gameState && gameState.gamePhase === 'playing';
}

initInput({
	onUseSlot: (slot) => useCard(slot),
	onToggleDeck: () => toggleDeckViewer(),
	onUseKeyItem: () => {
		if (!socket) return;
		if (isLocalPlayerCardCommitted()) return;
		const me = gameState?.players?.[myId];
		if (me && me.equippedKeyItemId) {
			// phase_step targets the highlighted ally; the renderer recomputes
			// the nearest in-range ally each frame. Other items keep their shape.
			if (me.equippedKeyItemId === 'phase_step') {
				const targetPlayerId = getPhaseStepTargetId();
				socket.emit(CLIENT_TO_SERVER.USE_KEY_ITEM, { keyItemId: 'phase_step', targetPlayerId });
			} else {
				socket.emit(CLIENT_TO_SERVER.USE_KEY_ITEM, { keyItemId: me.equippedKeyItemId });
			}
		}
	},
	onLockOn: () => applyLockOnPress(),
	// Hub booth interaction — not gated behind canUseGameActions so it fires in
	// the lobby phase. No-op when no booth is in range.
	onInteract: () => emitBoothInteract(),
	canUseGameActions,
});

// Show/hide the booth prompt as the renderer reports the local player entering
// or leaving a hub booth zone (fires only on transitions).
setBoothInRangeListener((boothId) => updateBoothPrompt(boothPromptEl, boothId));

// Clicking the prompt is an alternative to pressing the interact key.
if (boothPromptEl) {
	boothPromptEl.addEventListener('click', () => emitBoothInteract());
}

const deckBoothDeps = { showGameLobby, setLobbyTab, renderDeckEditor };
registerDeckBoothListener(deckBoothDeps);
const requestDebugBoothOpen = createRequestDebugBoothOpener({
	param: debugBooth,
	hostname: window.location.hostname,
	openDeckBooth,
	deps: deckBoothDeps,
});
const shopBoothDeps = { showGameLobby, setLobbyTab, renderCardShop };
registerShopBoothListener(shopBoothDeps);
const requestDebugShopBoothOpen = createRequestDebugShopBoothOpener({
	param: debugBooth,
	hostname: window.location.hostname,
	openShopBooth,
	deps: shopBoothDeps,
});
window.addEventListener(BOOTH_ACTION_EVENT, (ev) => {
	const boothId = ev.detail && ev.detail.boothId;
	if (boothId !== 'character') return;
	if (!gameState || gameState.gamePhase !== 'lobby') return;
	openCharacterBooth();
});

// Quest booth: reveal/focus the existing inline quest panel (#quest-board).
// No second quest UI is introduced — openQuestPanel just scrolls the wrapper
// into view; selection still flows through renderQuestBoardState's handler.
window.addEventListener(BOOTH_ACTION_EVENT, (ev) => {
	if (!isQuestBoothAction(ev.detail)) return;
	if (!gameState || gameState.gamePhase !== 'lobby') return;
	openQuestPanel();
});

// Context bundle handed to per-card renderers — declared once so the
// cardUsed handler does not re-allocate it on every event. `myId` is read
// via a getter so renderers always see the current local player.
const cardRenderCtx = {
	spawnAttackEffect: rendererSpawnAttackEffect,
	spawnSummonEffect: rendererSpawnSummonEffect,
	spawnMinionSummonInEffect: rendererSpawnMinionSummonInEffect,
	spawnDivineGraceEffect: rendererSpawnDivineGraceEffect,
	spawnPurifyingPulseEffect: rendererSpawnPurifyingPulseEffect,
	spawnPurifyingPulseHealRing: rendererSpawnPurifyingPulseHealRing,
	spawnCleanseBurstEffect: rendererSpawnCleanseBurstEffect,
	spawnInfernoPillarEffect: rendererSpawnInfernoPillarEffect,
	spawnVolatileExplosionEffect: rendererSpawnVolatileExplosionEffect,
	spawnChainLightningEffect: rendererSpawnChainLightningEffect,
	spawnLightningArc: rendererSpawnLightningArc,
	flashMesh: rendererFlashMesh,
	markCardHitEnemies: rendererMarkCardHitEnemies,
	spawnHitSpark: rendererSpawnHitSpark,
	spawnParticleBurst: rendererSpawnParticleBurst,
	spawnProjectileTrail: rendererSpawnProjectileTrail,
	spawnImpactDecal: rendererSpawnImpactDecal,
	spawnTelegraphRing: rendererSpawnTelegraphRing,
	spawnMirrorWardShellEffect: rendererSpawnMirrorWardShellEffect,
	dismissMirrorWardShellEffect: rendererDismissMirrorWardShellEffect,
	spawnMirrorWardReflectBurst: rendererSpawnMirrorWardReflectBurst,
	enemyMeshes: () => getMeshMaps().enemiesMeshes,
	playSound,
	scheduleAfter: (ms, fn) => setTimeout(fn, ms),
	get myId() { return myId; },
};

/** Bind all Socket.IO event listeners to the given socket instance. */
function bindSocketHandlers(s) {
	if (!s) return;

	s.on('connect', () => {
		clearConnectWatchdog();
		showLobbyBrowserError('');
		updateStatus('Connected', 'connected');
		startHeartbeat();
	});

	s.on('disconnect', () => {
		stopHeartbeat();
		updateStatus('Disconnected', 'disconnected');
		rendererDisposeAllLootMeshes();
		// A drop after a good connection re-arms the watchdog: reconnection is
		// configured as infinite, so without this an unrecoverable drop would sit
		// in transient status forever. Cleared again on `connect`/`reconnect`.
		startConnectWatchdog();
	});

	s.io.on('reconnect_attempt', () => {
		updateStatus('Reconnecting...', 'reconnecting');
		// Idempotent: the first signal in an episode arms an absolute deadline;
		// rapid repeated reconnect attempts do NOT postpone it, so a stalled
		// reconnect loop still escalates to the persistent failure surface.
		startConnectWatchdog();
	});

	s.io.on('reconnect', () => {
		clearConnectWatchdog();
		showLobbyBrowserError('');
		updateStatus('Connected', 'connected');
		startHeartbeat();
	});

	s.on('connect_error', (err) => {
		const msg = err?.message || String(err || '');
		const isAuthError = /jwt|token|unauthorized|authentication/i.test(msg);
		stopHeartbeat();
		if (isAuthError) {
			// Auth recovery wins outright: cancel the connect watchdog so it can
			// never overwrite the "session expired" surface with a generic
			// connect-timeout error.
			clearConnectWatchdog();
			try { localStorage.removeItem(TOKEN_KEY); } catch (_) {}
			setAuthToken(null);
			s.io.disconnect();
			if (uiEl) uiEl.style.display = 'none';
			if (cardHandEl) hideCardHand();
			hideVariantCodex();
			setDeckStackVisible(false);
			if (lobbyEl) lobbyEl.classList.add('hidden');
			setLobbyHudVisible(false);
			if (lobbyBrowserEl) lobbyBrowserEl.classList.add('hidden');
			if (runSummaryOverlay) runSummaryOverlay.style.display = 'none';
			showAuthOverlay();
			showLoginForm();
			updateStatus('Session expired — please log in again', 'disconnected');
		} else {
			updateStatus('Connection failed — retrying...', 'reconnecting');
			// Ensure the watchdog is running so a persistent non-auth connect
			// failure escalates instead of retrying transiently forever. The
			// call is idempotent: rapid repeated connect_error events do NOT
			// reset the absolute deadline armed by the first failure.
			startConnectWatchdog();
		}
	});

	s.on(SERVER_TO_CLIENT.INIT, (data) => {
		myId = data.id;
		rendererSetMyId(data.id);
		if (data.playerId) {
			try { localStorage.setItem(STORAGE_KEY_PLAYER_ID, data.playerId); } catch (_) {}
		}

		mySelectedDeck = data.selectedDeck || [];
		myInventory = Array.isArray(data.inventory) ? data.inventory : null;
		myOwnedCards = data.ownedCards || {};
		keyItemDefs = data.keyItemDefs || {};
		enemyDisplayCatalog = data.enemyDisplayCatalog || null;
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

	s.on(SERVER_TO_CLIENT.LOBBY_JOINED, (data) => {
		showLobbyBrowserError('');
		applyLobbyJoinedData(data);
		// Debug hook: ?booth=launch readies up automatically on a lobby join so a
		// run can be launched without walking to the Launch Bay booth. Guarded to
		// the lobby phase so it never fires when dropping into an in-progress run.
		const inLobbyPhase = data && data.state && data.state.gamePhase === 'lobby';
		if (inLobbyPhase && getBoothDebugHook(window.location.search) === LAUNCH_BOOTH_ID) {
			launchBoothReadyUp();
		}
	});

	s.on(SERVER_TO_CLIENT.LOBBY_LEFT, (data) => {
		gameState = null;
		setGameStateRef(null);
		showLobbyBrowser();
		renderLobbyList((data && data.lobbies) || []);
		if (lobbyBrowserStatusEl) {
			lobbyBrowserStatusEl.textContent = 'Left lobby. Pick another or create one.';
		}
	});

	s.on(SERVER_TO_CLIENT.LOBBY_LIST_UPDATE, (data) => {
		if (lobbyBrowserEl && !lobbyBrowserEl.classList.contains('hidden')) {
			renderLobbyList((data && data.lobbies) || []);
		}
	});

	s.on(SERVER_TO_CLIENT.LOBBY_ERROR, (data) => {
		const reason = data && data.reason ? data.reason : 'Lobby action failed';
		showLobbyBrowserError(reason);
	});

	s.on(SERVER_TO_CLIENT.STATE_UPDATE, (state) => {
		const previousPhase = gameState && gameState.gamePhase;
		// Verify layout seed consistency on every state update
		if (currentLayoutSeed !== null && state.layoutSeed !== undefined && state.layoutSeed !== currentLayoutSeed) {
			console.warn(`[layout] Seed mismatch: local=${currentLayoutSeed} server=${state.layoutSeed}`);
			currentLayoutSeed = state.layoutSeed;
		}
		gameState = state;
		suspendedRunSummary = cloneSuspendedRunSummary(state.suspendedRunSummary ?? null);
		setGameStateRef(state);
		// Server snapshots omit debugGodmode; re-apply the last toggle so harness
		// probes and local handlers stay consistent across stateUpdate.
		if (myId && debugGodmodeResult?.ok && gameState.players?.[myId]) {
			gameState.players[myId].debugGodmode = !!debugGodmodeResult.enabled;
		}
		const me = myId && gameState.players ? gameState.players[myId] : null;
		const isExtracted = !!(me && me.extracted);
		// The renderer shows the hub during the lobby, and also while the local
		// player is extracted into the hub mid-run (server still 'playing'), so
		// floor sampling for the local avatar must use the hub layout in both
		// cases; an active in-dungeon run uses the quest layout.
		const inHubScene = state.gamePhase === 'lobby' || isExtracted;
		const activeLayout = (inHubScene && hubLayout) ? hubLayout : currentLayout;
		if (gameState && activeLayout) gameState.layout = activeLayout;
		updateLevelSettingsBtnVisibility();
		if (isLevelSettingsOpen()) syncLevelSettingsRewards();

		const collectionChanged = syncLocalCollectionState(me);
		const enteringLobby = previousPhase !== 'lobby' && state.gamePhase === 'lobby';
		const enteringPlaying = previousPhase !== 'playing' && state.gamePhase === 'playing';

		if (enteringLobby) {
			_lastReturnRewardsPreview = null;
			extractedLobbyOverlayActive = false;
		} else if (me && state.gamePhase === 'playing') {
			if (enteringPlaying) {
				extractedLobbyOverlayActive = false;
			}
			if (me.returnRewardsPreview != null) {
				_lastReturnRewardsPreview = me.returnRewardsPreview;
			} else if (_lastReturnRewardsPreview != null) {
				gameState.players[myId].returnRewardsPreview = _lastReturnRewardsPreview;
			}
		}

		if (isExtracted && state.gamePhase === 'playing') {
			showExtractedLobbyOverlay();
		} else if (state.gamePhase === 'lobby') {
			returnToGuildLobby(state, {
				refreshCollection: enteringLobby || collectionChanged,
				rebuildHub: enteringLobby,
			});
		} else if (me) {
			syncVanguardHud(me, state.gamePhase);
		}

		// Entering gameplay: ensure HUD is visible (unless extracted mid-run)
		if (state.gamePhase === 'playing' && !isExtracted) {
			showCardHand();
			setDeckStackVisible(true);
			if (lobbyEl) lobbyEl.classList.add('hidden');
			setLobbyHudVisible(false);
			setDeployButtonVisible(false);
			clearSuspendedRunUi();
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
				if (Array.isArray(me.deck) || Array.isArray(me.hand)) {
					updateDeckStats(
						Array.isArray(me.deck) ? me.deck : deck,
						Array.isArray(me.hand) ? me.hand : hand,
						Array.isArray(me.inventory) ? me.inventory : myInventory,
					);
				}
				updateVanguardPortrait();
			}
		}

		// Update currency HUD (visible in lobby and during runs)
		if (me) {
			updateCurrencyHud(me.currency, { flashOnIncrease: state.gamePhase === 'playing' });
		}

		// Update objective HUD
		updateObjectiveHud();

		// Update stage-boss encounter HUD (boss bar shown while the encounter is
		// active/locked and the boss enemy is alive; hidden otherwise)
		updateBossEncounterHud();

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
			const serverPlayer = state.players[myId];
			if (Array.isArray(serverPlayer.deck)
				|| Array.isArray(serverPlayer.desperationDeck)
				|| serverPlayer.inDesperation != null) {
				syncDrawPileFromServer();
			}
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

		// Dash VFX detection: large position jump in a single tick
		if (state.gamePhase === 'playing' && myId && gameState.players[myId]) {
			const me = gameState.players[myId];
			if (_prevDashX != null) {
				const jumpDist = Math.hypot(me.x - _prevDashX, me.z - _prevDashZ);
				if (jumpDist > (MOVE_SPEED / TICK_RATE) * 2) {
					triggerDashVFX(myId);
				}
			}
			_prevDashX = me.x;
			_prevDashZ = me.z;
		} else if (state.gamePhase !== 'playing') {
			_prevDashX = null;
			_prevDashZ = null;
		}

		// Cooldown HUD indicator
		if (state.gamePhase === 'playing' && myId && gameState.players[myId]) {
			const meForCooldown = gameState.players[myId];
			const remaining = getKeyItemCooldownRemainingMs(meForCooldown);
			meForCooldown.keyItemCooldownRemaining = remaining;
			updateKeyItemCooldownHud(remaining);
			if (remaining <= 0) keyItemCooldownUntilClient = 0;
		} else if (state.gamePhase !== 'playing') {
			keyItemCooldownUntilClient = 0;
		}
	});

	s.on(SERVER_TO_CLIENT.HEARTBEAT_ACK, (data) => {
		if (connectionState === 'connected') {
			latency = data.latency;
			statusEl.innerText = `Latency: ${latency}ms`;
		}
	});

	s.on(SERVER_TO_CLIENT.DEBUG_SCENARIO_RESULT, (data) => {
		debugScenarioResult = data || null;
		if (data && data.ok) {
			console.log(`[debugScenario] applied ${data.scenario}`);
			// Repositioning scenarios emit stateUpdate before this result; defer one
			// tick so the client sim snaps after that payload is applied.
			setTimeout(() => {
				if (gameState?.gamePhase === 'playing' && myId && gameState.players[myId]) {
					const me = gameState.players[myId];
					setPlayerPosition(me.x, me.z);
					clearAllLockOnState();
				}
			}, 0);
			// Debug-only: the `hats-unlocked` scenario persists hat unlocks on the
			// account and reports the new owned set so the (already-loaded) client
			// cache reflects them without a full reload. No normal scenario sends
			// this field, so normal gameplay is unaffected.
			if (Array.isArray(data.unlockedHats)) {
				setUnlockedHats(data.unlockedHats);
				// Mirror the `hatUnlocked` handler: when the character booth is open
				// (e.g. via the `?booth=hatswap` debug hook), rebuild its hat list so
				// the newly-unlocked hats appear as selectable (owned) entries.
				if (isCharacterBoothOpen()) {
					rebuildBoothHatList();
				}
			}
			if (Number.isFinite(data.currency)) {
				myCurrency = data.currency;
				updateCurrencyHud(myCurrency);
				if (myId && gameState?.players?.[myId]) {
					gameState.players[myId].currency = data.currency;
				}
			}
		} else if (data && data.reason) {
			console.warn(`[debugScenario] ${data.reason}`);
		}
	});

	s.on(SERVER_TO_CLIENT.DEBUG_GODMODE_RESULT, (data) => {
		debugGodmodeResult = data || null;
		if (data && data.ok) {
			// Mirror server toggle locally so harness probes see debugGodmode without
			// waiting for a full stateUpdate (snapshots omit this debug-only flag).
			if (myId && gameState?.players?.[myId]) {
				gameState.players[myId].debugGodmode = !!data.enabled;
			}
			console.log(`[debugGodmode] ${data.enabled ? 'enabled' : 'disabled'}`);
		} else if (data && data.reason) {
			console.warn(`[debugGodmode] ${data.reason}`);
		}
	});

	s.on(SERVER_TO_CLIENT.PLAYER_DISCONNECTED, (id) => {
		removeRemotePlayerVisuals(id);
	});

	s.on(SERVER_TO_CLIENT.HUB_PRESENCE_UPDATE, (data) => {
		if (!data || !gameState || gameState.gamePhase !== 'lobby') return;
		if (!data.presence) return;
		applyHubPresence(data.presence, { removedPlayerIds: data.removedPlayerIds });
	});

	s.on(SERVER_TO_CLIENT.CARD_USED, (data) => {
		if (!data || !getScene()) return;
		renderCardUsed(data, cardRenderCtx);
	});

	s.on(SERVER_TO_CLIENT.VOLATILE_EXPLOSION, (data) => {
		if (!data || !getScene()) return;
		const { x, z, radius } = data;
		if (!Number.isFinite(x) || !Number.isFinite(z)) return;
		playSound('volatileExplosion');
		rendererSpawnVolatileExplosionEffect(
			{ x, z },
			Number.isFinite(radius) ? radius : 5,
		);
	});

	s.on(SERVER_TO_CLIENT.LEECH_HEAL, (data) => {
		if (!data) return;
		playSound('leechHeal');
	});

	s.on(SERVER_TO_CLIENT.SHIELD_BREAK, (data) => {
		if (!data) return;
		playSound('shieldBreak');
	});

	s.on(SERVER_TO_CLIENT.CARD_ERROR, (data) => {
		if (!data || !data.reason) return;
		console.log(`[cardError] ${data.reason}`);
		showCardErrorToast(data.reason);
		if (data.reason === THEME.resource.insufficient && lastUsedSlot >= 0) {
			const slot = getCardSlotEl(lastUsedSlot);
			if (slot) slot.classList.add('no-ms');
		}
		lastUsedSlot = -1;
	});

	s.on(SERVER_TO_CLIENT.BOOTH_ACTION, (data) => {
		// Single dispatch hook: later booth tickets subscribe to the
		// `booth:action` window event instead of re-touching this primitive.
		if (!data || !data.boothId) return;
		dispatchBoothAction(data);
	});

	s.on(SERVER_TO_CLIENT.BOOTH_ERROR, (data) => {
		// Booth interactions are best-effort: log and ignore so a rejected
		// interaction never disrupts the prompt or crashes the client.
		console.log(`[boothError] ${data && data.reason ? data.reason : 'unknown'}`);
	});

	s.on(SERVER_TO_CLIENT.DECK_UPDATE, (data) => {
		if (!data) return;
		if (data.selectedDeck) mySelectedDeck = data.selectedDeck;
		if (Array.isArray(data.inventory)) myInventory = data.inventory;
		if (data.ownedCards) myOwnedCards = data.ownedCards;
		if (Number.isFinite(data.currency)) {
			myCurrency = data.currency;
			updateCurrencyHud(myCurrency);
		}

		const inRun = gameState?.gamePhase === 'playing';
		if (inRun) {
			applyInRunDeckPayload(data);
			if (Array.isArray(data.hand)
				|| Array.isArray(data.deck)
				|| Array.isArray(data.desperationDeck)
				|| data.inDesperation != null) {
				renderHand();
				updateRunDeckTotal();
				updateDeckStats(deck, hand, myInventory);
				updateDeckVisuals();
			}
			if (data.returnRewardsPreview != null && isLevelSettingsOpen()) {
				syncLevelSettingsRewards();
			}
		}

		renderDeckEditor();
		if (activeLobbyTab === 'forge') renderPhotonForge();
		if (activeLobbyTab === 'shop') renderCardShop();
	});

	s.on(SERVER_TO_CLIENT.DECK_ERROR, (data) => {
		if (!data || !data.reason) return;
		if (activeLobbyTab === 'shop') showShopError(data.reason);
		else showDeckError(data.reason);
	});

	s.on(SERVER_TO_CLIENT.MEDIC_HEALED, (data) => {
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

	s.on(SERVER_TO_CLIENT.MEDIC_ERROR, (data) => {
		const reason = data && data.reason ? data.reason : 'unknown';
		const messages = {
			insufficient_gold: `Not enough money (need ${MEDIC_HEAL_COST})`,
			already_full: 'Already at full health',
			not_in_lobby: 'Medic is only available at the lobby connection',
			invalid_player: 'Could not find your hunter',
		};
		showMedicError(messages[reason] || `Heal failed: ${reason}`);
	});

	s.on(SERVER_TO_CLIENT.KEY_ITEM_EQUIPPED, (data) => {
		if (data && data.keyItemId) {
			const me = myId && gameState?.players ? gameState.players[myId] : null;
			if (me) me.equippedKeyItemId = data.keyItemId;
		}
		renderKeyItemList();
	});

	s.on(SERVER_TO_CLIENT.KEY_ITEM_ERROR, (data) => {
		const reason = data && data.reason ? data.reason : 'unknown';
		const messages = {
			not_in_lobby: 'Key items can only be equipped in the lobby',
			missing_key_item_id: 'No key item specified',
			unknown_item: 'Unknown key item',
		};
		showKeyItemError(messages[reason] || `Equip failed: ${reason}`);
	});

	s.on(SERVER_TO_CLIENT.KEY_ITEM_HEAL_PULSE, (data) => {
		if (!data || !getScene()) return;
		const { x, z, healRadius } = data;
		if (!Number.isFinite(x) || !Number.isFinite(z)) return;
		const radius = Number.isFinite(healRadius)
			? healRadius
			: (keyItemDefs.field_medic_kit?.healRadius ?? 5);
		triggerHealPulseVFX({ x, y: 0, z }, radius);
	});

	s.on(SERVER_TO_CLIENT.MEDIC_ALLY_HEAL, (data) => {
		if (!data || !getScene()) return;
		const { x, z, healRadius } = data;
		if (!Number.isFinite(x) || !Number.isFinite(z)) return;
		triggerMedicAllyHealVFX({ x, y: 0, z }, healRadius);
	});

	s.on(SERVER_TO_CLIENT.MEDIC_BEAD, (data) => {
		if (!data || !getScene()) return;
		triggerMedicEnergyBeadVFX(data);
	});

	s.on(SERVER_TO_CLIENT.KEY_ITEM_USED, (data) => {
		if (!data) return;
		const me = myId && gameState?.players ? gameState.players[myId] : null;
		if (data.ok) {
			if (me && Number.isFinite(data.cooldownUntil)) {
				keyItemCooldownUntilClient = data.cooldownUntil;
				const remaining = Math.max(0, data.cooldownUntil - Date.now());
				me.keyItemCooldownRemaining = remaining;
				updateKeyItemCooldownHud(remaining);
			}
			flashKeyItemIndicator('success');
			if (data.keyItemId === 'guard_block') {
				triggerShieldVFX(myId);
			}
			if (data.keyItemId === 'smoke_bomb' && me) {
				triggerSmokeVFX({ x: me.x, y: 0, z: me.z }, myId);
			}
			if (data.keyItemId === 'loot_magnet' && (data.pulled ?? 0) > 0) {
				const me = myId && gameState?.players ? gameState.players[myId] : null;
				if (me) {
					const attractRadius = keyItemDefs.loot_magnet?.attractRadius ?? 8;
					triggerLootMagnetVFX({ x: me.x, y: 0, z: me.z }, attractRadius);
				}
			}
		} else if (data.reason === 'on_cooldown') {
			if (me && Number.isFinite(data.remainingMs)) {
				me.keyItemCooldownRemaining = data.remainingMs;
				updateKeyItemCooldownHud(data.remainingMs);
			}
			flashKeyItemIndicator('cooldown');
		} else if (data.reason === 'no_minions') {
			// Soft-fail: recall blown with zero minions. Server did not start a
			// cooldown; give a brief amber cue distinct from the cooldown flash.
			flashKeyItemIndicator('soft-fail');
			console.warn('[keyItemUsed] failed:', data.reason);
		} else {
			console.warn('[keyItemUsed] failed:', data.reason);
		}
	});

	s.on(SERVER_TO_CLIENT.CARD_EVOLUTION_RESULT, (data) => {
		if (!data) return;
		lastEvolutionResult = data;
		if (data.selectedDeck) mySelectedDeck = data.selectedDeck;
		if (Array.isArray(data.inventory)) myInventory = data.inventory;
		if (data.ownedCards) myOwnedCards = data.ownedCards;
		renderDeckEditor();
	});

	s.on(SERVER_TO_CLIENT.CARD_EVOLUTION_ERROR, (data) => {
		if (!data || !data.reason) return;
		showDeckError(data.reason);
	});

	s.on(SERVER_TO_CLIENT.QUEST_ERROR, (data) => {
		if (!data || !data.reason) return;
		const reason = data.reason === 'suspended_checkpoint'
			? THEME.run.questSuspendedLocked
			: data.reason;
		showQuestError(reason);
	});

	s.on(SERVER_TO_CLIENT.CARD_INVENTORY_UPDATE, (data) => {
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

	s.on(SERVER_TO_CLIENT.CARD_GRIND_RESULT, (data) => {
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

	s.on(SERVER_TO_CLIENT.CARD_GRIND_ERROR, (data) => {
		if (!data || !data.reason) return;
		if (activeLobbyTab === 'forge') showForgeError(data.reason);
		else showDeckError(data.reason);
	});

	s.on(SERVER_TO_CLIENT.HAT_UNLOCKED, (data) => {
		if (!data) return;
		// Record the unlock and refreshed currency from the server (never
		// optimistically before this event), then re-render the hat list so the
		// newly unlocked hat becomes an equippable (owned) entry.
		setUnlockedHats(data.unlockedHats);
		if (Number.isFinite(data.currency)) {
			myCurrency = data.currency;
			updateCurrencyHud(myCurrency);
		}
		rebuildBoothHatList();
	});

	s.on(SERVER_TO_CLIENT.HAT_ERROR, (data) => {
		const message = data && data.reason ? data.reason : 'Unlock failed';
		showBoothCosmeticError(message);
	});

	s.on(SERVER_TO_CLIENT.APPEARANCE_CHANGED, (data) => {
		if (!data) return;
		if (data.cosmetic) {
			setAccountCosmetic(data.cosmetic);
		}
		if (Number.isFinite(data.currency)) {
			myCurrency = data.currency;
			updateCurrencyHud(myCurrency);
			if (myId && gameState?.players?.[myId]) {
				gameState.players[myId].currency = data.currency;
			}
		}
		if (data.cosmetic && myId && gameState?.players?.[myId]) {
			gameState.players[myId].cosmetic = getAccountCosmetic();
			setGameStateRef(gameState);
		}
		handleAppearanceChanged();
	});

	s.on(SERVER_TO_CLIENT.APPEARANCE_ERROR, (data) => {
		const reason = data && data.reason ? data.reason : 'Appearance save failed';
		let message = reason;
		if (reason === 'insufficient_gold' || /not enough/i.test(reason)) {
			message = /need \d+/i.test(reason)
				? reason
				: `Not enough money (need ${formatCurrencyPrice(APPEARANCE_CHANGE_COST)})`;
		}
		if (isCharacterBoothOpen()) {
			showBoothCosmeticError(message);
			handleAppearanceError();
		}
	});

	s.on(SERVER_TO_CLIENT.TRADE_OFFER, (data) => {
		if (!data || !data.tradeId) return;
		pendingTradeOffer = data;
		renderTradeOffer();
	});

	s.on(SERVER_TO_CLIENT.TRADE_UPDATE, (data) => {
		if (!data) return;
		if (data.status === 'accepted' || data.status === 'rejected') {
			if (pendingTradeOffer && pendingTradeOffer.tradeId === data.tradeId) {
				pendingTradeOffer = null;
			}
			renderTradeOffer();
		}
	});

	s.on(SERVER_TO_CLIENT.PLAYER_RECONNECTED, (reconnectedId) => {
		if (reconnectedId === myId) {
			console.log('[network] player reconnected');
		}
	});

	s.on(SERVER_TO_CLIENT.LOBBY_UPDATE, (data) => {
		renderPlayerList(data.players);
		renderTradeForm(data.players);
		if (data.players && myId) {
			const me = data.players.find((p) => p.id === myId);
			if (me) {
				isReady = me.ready;
			}
		}
		if (data.quests || data.questVariants || data.selectedQuestId || data.unlockedQuestTiers) {
			applyQuestBoardFromPayload(data);
		}
		if ('shopOffer' in data && gameState) {
			gameState.shopOffer = data.shopOffer;
			if (activeLobbyTab === 'shop') renderCardShop();
		}
	});

	s.on(SERVER_TO_CLIENT.QUEST_UPDATE, (data) => {
		if (!data) return;
		if (data.quests || data.questVariants || data.selectedQuestId || data.unlockedQuestTiers) {
			applyQuestBoardFromPayload(data);
		}
		applyQuestLayoutFromServer(data);
	});

	s.on(SERVER_TO_CLIENT.START_GAME, () => {
		claimedCardRewardId = null;
		currentCardChoices = [];
		if (lobbyEl) lobbyEl.classList.add('hidden');
		setLobbyHudVisible(false);
		uiEl.style.display = 'block';
		showCardHand();
		setDeckStackVisible(true);
		updateObjectiveHud();
		if (!isSceneInitialized()) {
			initHand();
			rendererInitScene(currentLayout, resolveRunSpawnPosition());
			renderedSceneProfile = 'quest';
			if (gameState) gameState.layout = currentLayout;
			setGamePhase('playing');
			updateLevelSettingsBtnVisibility();
			return;
		}
		initHand();
		// Deploying from the lobby: switch the rendered geometry from the hub to
		// the quest run before placing the player at the run spawn, so players
		// never deploy into the hub geometry.
		if (currentLayout && renderedSceneProfile !== 'quest') {
			rebuildDungeonLayout(currentLayout);
		}
		renderedSceneProfile = 'quest';
		if (gameState) gameState.layout = currentLayout;
		const spawnPos = resolveRunSpawnPosition();
		setPlayerPosition(spawnPos.x, spawnPos.z);
		setPlayerRotation(0);
		setWasDead(false);
		clearSuspendedRunUi();
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
			rendererDisposeMeshMap(maps.enemyShieldBars, sc);
			rendererDisposeMeshMap(maps.telegraphMeshes, sc);
			rendererDisposeMeshMap(maps.minionTelegraphMeshes, sc);
			rendererDisposeMeshMap(maps.minionsMeshes, sc);
			rendererDisposeMeshMap(maps.iceBallMeshes, sc);
			rendererDisposeAllLootMeshes();
		}
	});

	s.on(SERVER_TO_CLIENT.RUN_COMPLETE, showRunSummary);
	s.on(SERVER_TO_CLIENT.RUN_FAILED, showRunSummary);

	s.on(SERVER_TO_CLIENT.RUN_ERROR, (data) => {
		const reason = (data && data.reason) ? data.reason : 'Run action failed';
		console.warn(`[run] ${reason}`);
		showLevelSettingsError(reason);
		if (giveUpBtnEl) giveUpBtnEl.disabled = false;
	});

	s.on(SERVER_TO_CLIENT.RUN_SUSPENDED, (summary) => {
		suspendedRunSummary = cloneSuspendedRunSummary(summary);
		if (gameState?.gamePhase === 'lobby') {
			renderSuspendedRunBanner(suspendedRunSummary);
		}
	});

	s.on(SERVER_TO_CLIENT.RUN_ABANDONED, () => {
		suspendedRunSummary = null;
		clearSuspendedRunUi();
		if (gameState) {
			gameState.gamePhase = 'lobby';
			delete gameState.run;
		}
		if (giveUpBtnEl) giveUpBtnEl.disabled = false;
		returnToGuildLobby(gameState, { refreshCollection: true, rebuildHub: true });
	});

	if (giveUpBtnEl) {
		giveUpBtnEl.onclick = () => requestGiveUp(s);
	}

	s.on(SERVER_TO_CLIENT.PLAYER_EXTRACTED, (data) => {
		if (data && data.playerId === myId) {
			showExtractedLobbyOverlay();
		}
	});

	s.on(SERVER_TO_CLIENT.CARD_REWARD_CLAIMED, (data) => {
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
/** Client anchor for key-item cooldown until the next authoritative stateUpdate. */
let keyItemCooldownUntilClient = 0;
let connectionState = 'connecting';
let heartbeatTimer = null;
let connectWatchdogTimer = null;
// How long a freshly (re)created socket may take to reach `connect` before we
// stop showing the transient "retrying..." status and surface a persistent,
// user-visible connection-failed error. Also passed as the socket's `timeout`.
const CONNECT_WATCHDOG_MS = 10000;
let latency = null;
let currentLayoutSeed = null; // tracks the layout seed we last built from
let currentLayout = null; // persisted layout from init; stateUpdate omits it
let hubLayout = null; // hub layout delivered in lobbyJoined; rendered during the lobby phase
let renderedSceneProfile = null; // 'hub' | 'quest' — which geometry the renderer currently shows

// Deck editor state
let mySelectedDeck = [];
let myInventory = null;
let myOwnedCards = {};
let lastEvolutionResult = null;
let keyItemDefs = {};
let enemyDisplayCatalog = null;
setEnemyDisplayCatalogGetter(() => enemyDisplayCatalog);
let availableQuests = [];
let questVariants = [];
let unlockedQuestTiers = {};
let selectedQuestId = 'training_caverns';
let selectedQuestTier = 1;
let currentCardChoices = [];
let claimedCardRewardId = null;
let myCurrency = 0;
let pendingTradeOffer = null;
let runDeckTotal = 0;
let deckViewerOpen = false;
let _lastCurrency = undefined; // tracks previous currency value for flash-on-increase
let _lastMagicStones = undefined; // tracks previous MS for spend/gain flash
let _prevDashX = null; // previous X for dash-VFX detection (survives stateUpdate)
let _prevDashZ = null; // previous Z for dash-VFX detection (survives stateUpdate)
let _lastReturnRewardsPreview = null; // survives slim tick stateUpdate while level settings is open

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

function applyQuestBoardFromPayload(data) {
	if (!data) return;
	if (Array.isArray(data.quests)) availableQuests = data.quests;
	if (Array.isArray(data.questVariants)) questVariants = data.questVariants;
	if (data.unlockedQuestTiers && typeof data.unlockedQuestTiers === 'object') {
		unlockedQuestTiers = data.unlockedQuestTiers;
	}
	if (typeof data.selectedQuestId === 'string') selectedQuestId = data.selectedQuestId;
	if (data.selectedQuestTier !== undefined && data.selectedQuestTier !== null) {
		selectedQuestTier = data.selectedQuestTier;
	}
	renderQuestBoardState();
}

function applyQuestBoardState(quests, questId) {
	applyQuestBoardFromPayload({ quests, selectedQuestId: questId });
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
	if (data.layoutSeed !== undefined) {
		currentLayoutSeed = data.layoutSeed;
	}

	// In the lobby the hub stays rendered — only cache the freshly selected quest
	// layout; do not rebuild geometry or move the avatar off the hub floor. The
	// quest geometry is built when the player deploys (the `startGame` handler).
	if (gameState && gameState.gamePhase === 'lobby') {
		if (hubLayout) gameState.layout = hubLayout;
		return;
	}

	if (gameState) gameState.layout = currentLayout;

	if (isSceneInitialized()) {
		rebuildDungeonLayout(currentLayout);
		renderedSceneProfile = 'quest';
	}

	const me = myId && gameState && gameState.players ? gameState.players[myId] : null;
	if (me && Number.isFinite(me.x) && Number.isFinite(me.z)) {
		setPlayerPosition(me.x, me.z);
	} else {
		const spawn = getSpawnPosition();
		setPlayerPosition(spawn.x, spawn.z);
	}
}

// Reveal/focus the existing inline quest panel when the hub quest booth fires.
// The inline #quest-board stays the selection surface (see renderQuestBoardState
// below); this only brings the wrapper into view. Guarded to the lobby phase.
function openQuestPanel() {
	if (gameState?.gamePhase !== 'lobby') return;
	// Quest board lives inside #lobby; reopen the menu when it was dismissed.
	showGameLobby();
	// The wrapper is hidden by default; the booth is what reveals it.
	questBoardWrapperEl?.classList.remove('hidden');
	// jsdom lacks scrollIntoView, so guard defensively for tests.
	questBoardWrapperEl?.scrollIntoView?.({ block: 'nearest' });
}

function renderQuestBoardState() {
	renderQuestBoard(
		questBoardEl,
		availableQuests,
		selectedQuestId,
		(questId, tier) => {
			if (!socket) return;
			if (suspendedRunSummary) {
				showQuestError(THEME.run.questSuspendedLocked);
				return;
			}
			socket.emit(CLIENT_TO_SERVER.SELECT_QUEST, { questId, tier: tier ?? 1 });
		},
		{
			selectedQuestTier,
			unlockedQuestTiers,
			questVariants,
			selectionLocked: !!suspendedRunSummary,
		},
	);
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
	socket.emit(CLIENT_TO_SERVER.DEBUG_SCENARIO, { name: debugScenario });
}

function isDebugGodmodeKeyBlocked(e) {
	const target = e.target;
	if (target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement ||
		target?.isContentEditable) {
		return true;
	}
	return !!(variantCodexOpen || deckViewerOpen || isLevelSettingsOpen() || isCharacterBoothOpen()
		|| (settingsOverlayEl && !settingsOverlayEl.classList.contains('hidden'))
		|| (authOverlayEl && !authOverlayEl.classList.contains('hidden'))
		|| (accountOverlayEl && !accountOverlayEl.classList.contains('hidden'))
		|| (runSummaryOverlay && !runSummaryOverlay.classList.contains('hidden')));
}

function emitToggleDebugGodmode() {
	if (!socket?.connected) return;
	socket.emit(CLIENT_TO_SERVER.TOGGLE_DEBUG_GODMODE);
}

window.__openDeckBoothForTest = openDeckBooth;
window.__openShopBoothForTest = openShopBooth;
window.__requestDebugBoothOpenForTest = requestDebugBoothOpen;
window.__requestDebugShopBoothOpenForTest = requestDebugShopBoothOpen;
// Capture/test hook: ready up via the launch-booth path (no new socket event).
// Routes through the shared launchBoothReadyUp() so the capture's readyAll step
// reaches the playing phase without re-introducing the retired 2D #ready-btn.
// Idempotent — launchBoothReadyUp() bails when the player is already ready.
window.__launchReadyUpForTest = () => launchBoothReadyUp();
/** Localhost-only `?booth=<id>` — open a booth once in hub lobby. */
function requestBoothDebugOpen() {
	if (!debugScenarioAllowed || boothDebugRequested) return;
	if (boothDebugParam !== 'character' && boothDebugParam !== 'quest' && boothDebugParam !== 'hatswap') return;
	if (!gameState || gameState.gamePhase !== 'lobby') return;
	boothDebugRequested = true;
	if (boothDebugParam === 'quest') {
		openQuestPanel();
	} else if (boothDebugParam === 'hatswap') {
		// Debug shortcut: unlock the catalog hats (via the existing
		// `hats-unlocked` scenario) and open the character booth so the free
		// unlocked-hat swap can be exercised directly. The booth's hat list is
		// rebuilt when the scenario result arrives (see debugScenarioResult).
		if (socket && socket.connected) {
			socket.emit(CLIENT_TO_SERVER.DEBUG_SCENARIO, { name: 'hats-unlocked' });
		}
		openCharacterBooth();
	} else {
		openCharacterBooth();
	}
}

/** Test / Playwright hook: apply a debug scenario on demand. */
window.__toggleDebugGodmodeForTest = emitToggleDebugGodmode;

window.__patchCharacterBoothForTest = (patch) => patchBoothSelection(patch);
window.__requestBoothSaveForTest = () => requestBoothSave();
window.__confirmBoothPaidSaveForTest = () => confirmBoothPaidSave();

window.__applyAppearanceChangeForTest = (cosmetic, timeoutMs) => new Promise((resolve) => {
	if (!socket?.connected) {
		resolve({ ok: false, reason: 'no socket' });
		return;
	}
	if (!cosmetic || typeof cosmetic !== 'object') {
		resolve({ ok: false, reason: 'cosmetic must be an object' });
		return;
	}
	const timeout = Math.max(1000, Math.min(timeoutMs || 10000, 30000));
	const cleanup = () => {
		clearTimeout(timer);
		socket.off(SERVER_TO_CLIENT.APPEARANCE_CHANGED, onChanged);
		socket.off(SERVER_TO_CLIENT.APPEARANCE_ERROR, onError);
	};
	const onChanged = (data) => {
		cleanup();
		resolve({ ok: true, ...data });
	};
	const onError = (data) => {
		cleanup();
		resolve({ ok: false, reason: data?.reason || 'appearanceError' });
	};
	const timer = setTimeout(() => {
		cleanup();
		resolve({ ok: false, reason: 'timeout waiting for appearanceChanged' });
	}, timeout);
	socket.once(SERVER_TO_CLIENT.APPEARANCE_CHANGED, onChanged);
	socket.once(SERVER_TO_CLIENT.APPEARANCE_ERROR, onError);
	socket.emit(CLIENT_TO_SERVER.APPLY_APPEARANCE_CHANGE, { cosmetic });
});

window.__saveCharacterBoothForTest = (timeoutMs) => new Promise((resolve) => {
	if (!socket?.connected) {
		resolve({ ok: false, reason: 'no socket' });
		return;
	}
	const timeout = Math.max(1000, Math.min(timeoutMs || 10000, 30000));
	const cleanup = () => {
		clearTimeout(timer);
		socket.off(SERVER_TO_CLIENT.APPEARANCE_CHANGED, onChanged);
		socket.off(SERVER_TO_CLIENT.APPEARANCE_ERROR, onError);
	};
	const onChanged = (data) => {
		cleanup();
		resolve({ ok: true, ...data });
	};
	const onError = (data) => {
		cleanup();
		resolve({ ok: false, reason: data?.reason || 'appearanceError' });
	};
	const timer = setTimeout(() => {
		cleanup();
		resolve({ ok: false, reason: 'timeout waiting for appearanceChanged' });
	}, timeout);
	socket.once(SERVER_TO_CLIENT.APPEARANCE_CHANGED, onChanged);
	socket.once(SERVER_TO_CLIENT.APPEARANCE_ERROR, onError);
	requestBoothSave();
	const confirmEl = document.getElementById('character-booth-confirm');
	if (confirmEl && !confirmEl.classList.contains('hidden')) {
		confirmBoothPaidSave();
	}
});

window.__requestDebugScenarioForTest = (name, timeoutMs) => new Promise((resolve) => {
	if (!socket) {
		resolve({ ok: false, reason: 'no socket' });
		return;
	}
	const timeout = Math.max(1000, Math.min(timeoutMs || 10000, 30000));
	const timer = setTimeout(() => {
		socket.off(SERVER_TO_CLIENT.DEBUG_SCENARIO_RESULT, onResult);
		resolve({ ok: false, reason: 'timeout waiting for debugScenarioResult' });
	}, timeout);
	function onResult(data) {
		clearTimeout(timer);
		socket.off(SERVER_TO_CLIENT.DEBUG_SCENARIO_RESULT, onResult);
		debugScenarioResult = data || null;
		resolve(data || { ok: false, reason: 'empty debugScenarioResult' });
	}
	socket.once(SERVER_TO_CLIENT.DEBUG_SCENARIO_RESULT, onResult);
	socket.emit(CLIENT_TO_SERVER.DEBUG_SCENARIO, { name });
});

// Test-only: drive the lobby deck editor over the live socket so a smoke test
// can configure a non-default loadout (remove every current card, then add the
// requested card ids). Behavior-neutral — only wraps the existing deckRemoveCard
// / deckAddCard events that the deck editor UI already emits while in the lobby.
window.__configureDeckForTest = async (targetCardIds, timeoutMs) => {
	if (!socket || !socket.connected) return { ok: false, reason: 'no socket' };
	if (!Array.isArray(targetCardIds)) return { ok: false, reason: 'targetCardIds must be an array' };
	const waitDeck = () => new Promise((resolve) => {
		const timeout = Math.max(1000, Math.min(timeoutMs || 5000, 15000));
		const cleanup = () => {
			clearTimeout(timer);
			socket.off(SERVER_TO_CLIENT.DECK_UPDATE, onUpdate);
			socket.off(SERVER_TO_CLIENT.DECK_ERROR, onError);
		};
		const onUpdate = (data) => { cleanup(); resolve({ ok: true, selectedDeck: data?.selectedDeck || [] }); };
		const onError = (data) => { cleanup(); resolve({ ok: false, reason: data?.reason || 'deckError' }); };
		const timer = setTimeout(() => { cleanup(); resolve({ ok: false, reason: 'timeout waiting for deckUpdate' }); }, timeout);
		socket.once(SERVER_TO_CLIENT.DECK_UPDATE, onUpdate);
		socket.once(SERVER_TO_CLIENT.DECK_ERROR, onError);
	});
	// Empty the current deck one instance at a time.
	let guard = 0;
	while (Array.isArray(mySelectedDeck) && mySelectedDeck.length > 0 && guard < 64) {
		guard += 1;
		const entry = mySelectedDeck[0];
		const pending = waitDeck();
		socket.emit(CLIENT_TO_SERVER.DECK_REMOVE_CARD, { instanceId: entry });
		const res = await pending;
		if (!res.ok) return res;
	}
	// Add each requested card by id (server picks an available owned instance).
	for (const cardId of targetCardIds) {
		const pending = waitDeck();
		socket.emit(CLIENT_TO_SERVER.DECK_ADD_CARD, { cardId });
		const res = await pending;
		if (!res.ok) return { ok: false, reason: `add ${cardId} failed: ${res.reason}` };
	}
	return { ok: true, selectedDeck: Array.isArray(mySelectedDeck) ? [...mySelectedDeck] : [] };
};

/** Test / Playwright hook: evolve a card by instanceId and wait for the result. */
window.__evolveCardForTest = (instanceId, timeoutMs) => new Promise((resolve) => {
	if (!socket) {
		resolve({ ok: false, reason: 'no socket' });
		return;
	}
	if (typeof instanceId !== 'string') {
		resolve({ ok: false, reason: 'instanceId must be a string' });
		return;
	}
	const timeout = Math.max(1000, Math.min(timeoutMs || 10000, 30000));
	const timer = setTimeout(() => {
		socket.off(SERVER_TO_CLIENT.CARD_EVOLUTION_RESULT, onResult);
		socket.off(SERVER_TO_CLIENT.CARD_EVOLUTION_ERROR, onError);
		resolve({ ok: false, reason: 'timeout waiting for evolution result' });
	}, timeout);
	function onResult(data) {
		clearTimeout(timer);
		socket.off(SERVER_TO_CLIENT.CARD_EVOLUTION_RESULT, onResult);
		socket.off(SERVER_TO_CLIENT.CARD_EVOLUTION_ERROR, onError);
		resolve({ ok: true, instance: data?.instance, fromCardId: data?.fromCardId, toCardId: data?.toCardId });
	}
	function onError(data) {
		clearTimeout(timer);
		socket.off(SERVER_TO_CLIENT.CARD_EVOLUTION_RESULT, onResult);
		socket.off(SERVER_TO_CLIENT.CARD_EVOLUTION_ERROR, onError);
		resolve({ ok: false, reason: data?.reason || 'cardEvolutionError' });
	}
	socket.once(SERVER_TO_CLIENT.CARD_EVOLUTION_RESULT, onResult);
	socket.once(SERVER_TO_CLIENT.CARD_EVOLUTION_ERROR, onError);
	socket.emit(CLIENT_TO_SERVER.EVOLVE_CARD, { instanceId });
});

function startHeartbeat() {
	if (heartbeatTimer) return;
	heartbeatTimer = setInterval(() => {
		socket.emit(CLIENT_TO_SERVER.HEARTBEAT, { type: 'heartbeat', timestamp: Date.now() });
	}, 2000);
}

function stopHeartbeat() {
	clearInterval(heartbeatTimer);
	heartbeatTimer = null;
}

/**
 * Start the connect watchdog. If the socket fails to reach `connect` within
 * CONNECT_WATCHDOG_MS, escalate from the transient "retrying..." status to a
 * clear, persistent connection-failed error.
 *
 * Idempotent while a timer is already pending: this enforces an ABSOLUTE
 * deadline per failure episode. In a rapid retry loop, failures can arrive
 * faster than CONNECT_WATCHDOG_MS; if every signal reset the timer the deadline
 * would never be reached and the user would sit in transient status forever.
 * The first call in an episode sets the deadline; subsequent calls leave it
 * intact. A clean recovery (`connect`/`reconnect`) clears the timer via
 * clearConnectWatchdog(), so the next failure re-arms a fresh deadline.
 */
function startConnectWatchdog() {
	if (connectWatchdogTimer) return;
	connectWatchdogTimer = setTimeout(() => {
		connectWatchdogTimer = null;
		// Reaching here means neither `connect` nor `reconnect` fired in time —
		// a real failure, not a normal in-flight connection.
		const msg = 'Connection failed — could not reach the server. Reload the page to retry.';
		updateStatus('Connection failed — reload to retry', 'disconnected');
		showLobbyBrowserError(msg);
	}, CONNECT_WATCHDOG_MS);
}

/** Cancel a pending connect watchdog (called once a connection succeeds). */
function clearConnectWatchdog() {
	if (connectWatchdogTimer) {
		clearTimeout(connectWatchdogTimer);
		connectWatchdogTimer = null;
	}
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
		const title = formatQuestTierLabel(run.questName, run.questTier ?? 1);
		let progress = '';
		if (obj.type === 'collect_items') {
			progress = THEME.objectives.collectPrismsProgress
				.replace('{collected}', String(obj.collectedItems ?? 0))
				.replace('{total}', String(obj.totalItems ?? 0));
		} else if (obj.type === 'defeat_enemies') {
			progress = `Purged ${obj.defeatedEnemies ?? 0} / ${obj.totalEnemies ?? 0} hostiles`;
		}
		objectiveHudEl.textContent = progress ? `${title}\n${progress}` : title;
		objectiveHudEl.style.display = 'block';
	} else {
		objectiveHudEl.style.display = 'none';
	}
}

// ── Stage-boss encounter HUD ──
// Lazily resolved + cached refs for the #boss-encounter-hud nodes added in
// sub-ticket 01. Lazy so the lookup survives jsdom tests that build the DOM
// after main.js is imported.
let bossEncounterHudDom = null;
// Last view-model synced to the boss HUD, exposed for the debug snapshot/hooks.
let bossEncounterModel = null;

function getBossEncounterHudDom() {
	if (bossEncounterHudDom) return bossEncounterHudDom;
	const container = document.getElementById('boss-encounter-hud');
	if (!container) return null;
	bossEncounterHudDom = {
		container,
		nameEl: document.getElementById('boss-encounter-name'),
		fillEl: document.getElementById('boss-encounter-hp-fill'),
	};
	return bossEncounterHudDom;
}

// Build the boss-encounter view-model from live server state and sync it to the
// HUD. Reuses the sub-ticket 01 module unchanged; called from the same per-frame
// update site that refreshes the objective HUD.
function updateBossEncounterHud() {
	bossEncounterModel = buildBossEncounterModel({
		encounter: gameState?.run?.encounter,
		enemies: gameState?.enemies,
		catalog: enemyDisplayCatalog,
		questId: gameState?.run?.questId ?? null,
	});
	const dom = getBossEncounterHudDom();
	if (dom) syncBossEncounterHud(bossEncounterModel, dom);
	return bossEncounterModel;
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
		cardHandEl.classList.toggle('input-locked', isLocalPlayerCardCommitted());
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
			const cardDef = CARD_DEFS[card.id];
			const windUpMs = cardDef?.windUpMs || 0;
			const windupHint = windUpMs > 0
				? `<span class="card-windup-hint">${THEME.cardDescriptions.windupHandHint.replace('{windUpMs}', String(windUpMs))}</span>`
				: '';
			content.innerHTML = `
				${desperationRibbon}
				<span class="card-icon">${style.icon}</span>
				<span class="card-name">${card.name}</span>
				${echoBadge}
				${evolvedBadge}
				${grindBadge}
				${effectText}
				${windupHint}
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
				: windUpMs > 0
				? THEME.cardDescriptions.windupTooltip
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

function applyInRunDeckPayload(data) {
	if (!data) return;
	if (Array.isArray(data.hand)) {
		hand.length = 0;
		for (let i = 0; i < data.hand.length; i++) {
			hand[i] = data.hand[i] ? { ...data.hand[i] } : null;
		}
		if (gameState?.players?.[myId]) {
			gameState.players[myId].hand = data.hand.map((card) => (card ? { ...card } : null));
		}
	}
	if (Array.isArray(data.deck)) {
		setDrawPile(data.deck);
		if (gameState?.players?.[myId]) {
			gameState.players[myId].deck = [...data.deck];
		}
	}
	if (Array.isArray(data.desperationDeck)) {
		setDesperationDrawPile(data.desperationDeck);
		if (gameState?.players?.[myId]) {
			gameState.players[myId].desperationDeck = [...data.desperationDeck];
		}
	}
	if (data.inDesperation != null) {
		setInDesperation(data.inDesperation);
		if (gameState?.players?.[myId]) {
			gameState.players[myId].inDesperation = data.inDesperation;
		}
	}
	if (data.nextDrawAt !== undefined && gameState?.players?.[myId]) {
		gameState.players[myId].nextDrawAt = data.nextDrawAt;
	}
	if (data.runRewards != null && gameState?.players?.[myId]) {
		gameState.players[myId].runRewards = data.runRewards;
	}
	if (data.returnRewardsPreview != null) {
		_lastReturnRewardsPreview = data.returnRewardsPreview;
		if (gameState?.players?.[myId]) {
			gameState.players[myId].returnRewardsPreview = data.returnRewardsPreview;
		}
	}
}

function syncDrawPileFromServer() {
	const serverPlayer = gameState && myId && gameState.players[myId];
	if (!serverPlayer) return;
	if (Array.isArray(serverPlayer.deck)) {
		setDrawPile(serverPlayer.deck);
	}
	if (Array.isArray(serverPlayer.desperationDeck)) {
		setDesperationDrawPile(serverPlayer.desperationDeck);
	}
	if (serverPlayer.inDesperation != null) {
		setInDesperation(serverPlayer.inDesperation);
	}
	updateRunDeckTotal();
	updateDeckStats(
		deck,
		hand,
		Array.isArray(serverPlayer.inventory) ? serverPlayer.inventory : myInventory,
	);
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
	const serverPlayer = gameState && myId && gameState.players[myId];
	const inventory = (serverPlayer && Array.isArray(serverPlayer.inventory))
		? serverPlayer.inventory
		: myInventory;
	const displayIds = showingDesperation
		? deckIdsForDisplay(desperationDeck)
		: deckIdsForDisplay(deck);
	const entries = buildDeckMiniEntries(displayIds, inventory);

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

// ── Variant Codex Overlay ──

let variantCodexOpen = false;

function renderVariantCodexList() {
	if (!variantCodexListEl) return;
	variantCodexListEl.innerHTML = '';
	for (const v of VARIANT_CODEX_DATA) {
		const entry = document.createElement('div');
		entry.className = 'variant-codex-entry';

		const badge = document.createElement('div');
		badge.className = 'variant-codex-badge';
		badge.style.backgroundColor = v.color;
		badge.style.setProperty('--badge-color', v.color);

		const info = document.createElement('div');
		info.className = 'variant-codex-info';

		const name = document.createElement('span');
		name.className = 'variant-codex-name';
		name.style.setProperty('--badge-color', v.color);
		name.textContent = v.name;

		const desc = document.createElement('p');
		desc.className = 'variant-codex-desc';
		desc.textContent = v.description;

		info.appendChild(name);
		info.appendChild(desc);
		entry.appendChild(badge);
		entry.appendChild(info);
		variantCodexListEl.appendChild(entry);
	}
}

function showVariantCodex() {
	if (!variantCodexOverlayEl) return;
	variantCodexOpen = true;
	variantCodexOverlayEl.classList.remove('hidden');
	if (!variantCodexListEl.children.length) renderVariantCodexList();
}

function hideVariantCodex() {
	variantCodexOpen = false;
	if (variantCodexOverlayEl) variantCodexOverlayEl.classList.add('hidden');
}

function toggleVariantCodex() {
	if (variantCodexOpen) {
		hideVariantCodex();
	} else {
		showVariantCodex();
	}
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
const lobbyTabForgeBtn = document.getElementById('lobby-tab-forge');
const photonForgeEl = document.getElementById('photon-forge');
const forgeInventoryGridEl = document.getElementById('forge-inventory-grid');
const forgeSelectedNameEl = document.getElementById('forge-selected-name');
const forgeSelectedMetaEl = document.getElementById('forge-selected-meta');
const forgeStatRowsEl = document.getElementById('forge-stat-rows');
const forgeErrorEl = document.getElementById('forge-error');

let activeLobbyTab = 'forge';
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
			if (instance) socket.emit(CLIENT_TO_SERVER.EVOLVE_CARD, { instanceId: instance.instanceId });
		});
		const addBtn = entry.querySelector('.deck-add-btn');
		addBtn.addEventListener('click', () => {
			const instance = findAvailableInventoryInstance(cardId);
			socket.emit(CLIENT_TO_SERVER.DECK_ADD_CARD, instance ? { instanceId: instance.instanceId, cardId } : { cardId });
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
			socket.emit(CLIENT_TO_SERVER.DECK_REMOVE_CARD, instance ? { instanceId: entryId, cardId } : { cardId });
		});
		selectedDeckListEl.appendChild(entry);
	}

	deckSizeDisplayEl.textContent = `${mySelectedDeck.length}/${DECK_MAX_SIZE}`;

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
		socket.emit(CLIENT_TO_SERVER.RESPOND_CARD_TRADE, { tradeId: pendingTradeOffer.tradeId, accepted: true });
		pendingTradeOffer = null;
		renderTradeOffer();
	});
}

if (rejectTradeBtn) {
	rejectTradeBtn.addEventListener('click', () => {
		if (!pendingTradeOffer) return;
		socket.emit(CLIENT_TO_SERVER.RESPOND_CARD_TRADE, { tradeId: pendingTradeOffer.tradeId, accepted: false });
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
		socket.emit(CLIENT_TO_SERVER.OFFER_CARD_TRADE, { targetPlayerId, offeredCardId, requestedCardId });
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

/** Briefly flash the key-item HUD indicator (success=green, cooldown=red). */
function flashKeyItemIndicator(type) {
	const el = document.getElementById('key-item-indicator');
	if (!el) return;
	const flashClass = type === 'success'
		? 'flash-success'
		: type === 'soft-fail'
			? 'flash-soft-fail'
			: 'flash-cooldown';
	el.classList.add(flashClass);
	// Clear any previous timeout
	if (el._flashTimer) clearTimeout(el._flashTimer);
	el._flashTimer = setTimeout(() => {
		el.classList.remove(flashClass);
		el._flashTimer = null;
	}, 450);
}

function getKeyItemCooldownRemainingMs(me) {
	const serverRemaining = me?.keyItemCooldownRemaining ?? 0;
	const localRemaining = keyItemCooldownUntilClient > Date.now()
		? keyItemCooldownUntilClient - Date.now()
		: 0;
	return Math.max(serverRemaining, localRemaining);
}

/** Update the persistent cooldown state of the key-item HUD indicator. */
function updateKeyItemCooldownHud(cooldownRemainingMs) {
	const el = document.getElementById('key-item-indicator');
	if (!el) return;
	const onCooldown = (cooldownRemainingMs || 0) > 0;
	el.classList.toggle('cooldown', onCooldown);
	if (onCooldown) {
		const seconds = (cooldownRemainingMs / 1000).toFixed(1);
		el.textContent = seconds;
	} else {
		el.textContent = '';
	}
}

/** Clear the key-item cooldown HUD (hide indicator when leaving gameplay). */
function clearKeyItemCooldownHud() {
	keyItemCooldownUntilClient = 0;
	const el = document.getElementById('key-item-indicator');
	if (!el) return;
	el.classList.remove('cooldown', 'ready');
	el.textContent = '';
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
			socket.emit(CLIENT_TO_SERVER.EQUIP_KEY_ITEM, { keyItemId: def.id });
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
	const forgeTabBtn = document.getElementById('lobby-tab-forge');
	const economyTabBtn = document.getElementById('lobby-tab-economy');
	const medicTabBtn = document.getElementById('lobby-tab-medic');
	const keyItemsTabBtn = document.getElementById('lobby-tab-keyitems');
	if (deckEditor) deckEditor.classList.toggle('hidden', activeLobbyTab !== 'deck');
	if (photonForge) photonForge.classList.toggle('hidden', activeLobbyTab !== 'forge');
	if (cardShop) cardShop.classList.toggle('hidden', activeLobbyTab !== 'shop');
	if (cardEconomy) cardEconomy.classList.toggle('hidden', activeLobbyTab !== 'economy');
	if (guildMedic) guildMedic.classList.toggle('hidden', activeLobbyTab !== 'medic');
	if (keyItemLoadout) keyItemLoadout.classList.toggle('hidden', activeLobbyTab !== 'keyitems');
	if (forgeTabBtn) forgeTabBtn.classList.toggle('active', activeLobbyTab === 'forge');
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
				socket.emit(CLIENT_TO_SERVER.SELL_CARD, { instanceId: instance.instanceId, cardId });
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

if (document.getElementById('lobby-tab-forge')) {
	document.getElementById('lobby-tab-forge').addEventListener('click', () => setLobbyTab('forge'));
}
const buyShopCardBtnEl = document.getElementById('buy-shop-card-btn');
if (buyShopCardBtnEl) {
	buyShopCardBtnEl.addEventListener('click', () => {
		if (!socket || !socket.connected) return;
		const offer = gameState && gameState.shopOffer;
		if (!offer || !offer.cardId) return;
		socket.emit(CLIENT_TO_SERVER.BUY_SHOP_CARD);
	});
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
		socket.emit(CLIENT_TO_SERVER.MEDIC_HEAL);
	});
}
if (document.getElementById('forge-attune-btn')) {
	document.getElementById('forge-attune-btn').addEventListener('click', () => {
		if (!selectedForgeInstanceId) return;
		socket.emit(CLIENT_TO_SERVER.GRIND_CARD, { instanceId: selectedForgeInstanceId });
	});
}

// ── Card input handling ──

function isLocalPlayerCardCommitted() {
	const me = myId && gameState?.players ? gameState.players[myId] : null;
	return me?.cardUseState === 'windup';
}

setHandInputLockChecker(isLocalPlayerCardCommitted);

function playActivationEffect(slotIndex) {
	const slot = getCardSlotEl(slotIndex);
	if (!slot) return;

	slot.classList.add('activating');
	setTimeout(() => {
		slot.classList.remove('activating');
		slot.classList.add('cooldown');
	}, 200);

	// Keep in sync with server COOLDOWN_MS (800) so rapid slot re-presses are not
	// rejected client-side before the server would accept the next useCard.
	setTimeout(() => {
		slot.classList.remove('cooldown');
		slotCooldowns[slotIndex] = false;
	}, 800);
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
	socket.emit(CLIENT_TO_SERVER.USE_CARD, {
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
	if (isLocalPlayerCardCommitted()) return;
	if (slotIndex < 0 || slotIndex >= MAX_HAND_SLOTS) return;
	if (!gameState || gameState.gamePhase !== 'playing') return;

	const card = hand[slotIndex];
	if (!card) return;
	if (card.activeMinionId) {
		showCardErrorToast('Creature still active');
		return;
	}

	socket.emit(CLIENT_TO_SERVER.DISCARD_CARD, { slotIndex, cardId: card.id });
}

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

// Pick the slot for a canvas basic attack: the first usable weapon-type slot,
// falling back to the first usable slot of any type. Returns -1 if none usable.
function pickBasicAttackSlot() {
	let fallback = -1;
	for (let i = 0; i < MAX_HAND_SLOTS; i++) {
		const card = hand[i];
		if (!card || !canUseSlot(i)) continue;
		if (weaponCardIds.has(card.id)) return i;
		if (fallback === -1) fallback = i;
	}
	return fallback;
}

// Left-clicking the 3D canvas during a run performs the player's basic attack
// by routing through the existing useCard flow (which emits `useCard` and, on a
// hit, fires the shared attack/flash/damage-number feedback via renderCardUsed).
// Delegated on window so it survives the renderer being recreated between runs;
// the e.target === canvas guard means clicks on HUD/overlay elements (card
// slots, buttons) never double-trigger an attack, and button === 0 leaves
// right-click camera orbit untouched.
window.addEventListener('pointerdown', (e) => {
	if (e.button !== 0) return;
	if (!canUseGameActions()) return;
	const canvas = getRenderer()?.domElement;
	if (!canvas || e.target !== canvas) return;
	const slot = pickBasicAttackSlot();
	if (slot >= 0) useCard(slot);
});

if (deckStackEl) {
	deckStackEl.addEventListener('click', () => {
		if (canUseGameActions()) toggleDeckViewer();
	});
}

if (deckViewerOverlayEl) {
	deckViewerOverlayEl.addEventListener('click', (e) => {
		if (e.target === deckViewerOverlayEl) hideDeckViewer();
	});
}

// ── Variant Codex keyboard toggle ──
if (window.__variantCodexKeydownHandler) {
	window.removeEventListener('keydown', window.__variantCodexKeydownHandler);
}
window.__variantCodexKeydownHandler = (e) => {
	const key = e.key.toLowerCase();
	if (key === 'c' && canUseGameActions()) {
		e.preventDefault();
		toggleVariantCodex();
		return;
	}
	if (key === 'escape' && variantCodexOpen) {
		e.preventDefault();
		hideVariantCodex();
		return;
	}
	if (key === 'escape' && isGameLobbyMenuVisible() && !isLobbyMenuDismissKeyBlocked(e)) {
		e.preventDefault();
		dismissGameLobby();
		return;
	}
	if (key === 'l' && gameState?.gamePhase === 'lobby' && lobbyMenuDismissed && !isLobbyMenuDismissKeyBlocked(e)) {
		e.preventDefault();
		showGameLobby();
		return;
	}
	if (key === 'g' && e.shiftKey && debugScenarioAllowed && socket?.connected && !isDebugGodmodeKeyBlocked(e)) {
		e.preventDefault();
		emitToggleDebugGodmode();
	}
};
window.addEventListener('keydown', window.__variantCodexKeydownHandler);

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
	hideVariantCodex();
	setDeckStackVisible(false);
	if (lobbyEl) lobbyEl.classList.add('hidden');
	setLobbyHudVisible(false);
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

// ── Character customization ──

// Shared in-progress selection for the character-booth overlay.
const cosmeticSelection = createCosmeticSelection();

initCharacterBooth({
	selection: cosmeticSelection,
	patchProfile,
	getAccountCosmetic,
	getGameState: () => gameState,
	getMyId: () => myId,
	setGameStateRef,
	getSocket: () => socket,
	getCurrency: () => myCurrency,
});

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
	activeSocket.emit(CLIENT_TO_SERVER.GIVE_UP);
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

// Ready the local player up via the hub Launch Bay booth: set the shared isReady
// flag and emit playerReady(true). The server's checkAllReady gate routes to
// startGame once the whole party is ready. The Launch Bay booth and the
// ?booth=launch debug hook both call this; no new socket event is introduced.
// Idempotent: a second booth touch or a repeated lobbyJoined (reconnect) does
// NOT re-emit, since we bail out early when the player is already ready.
function launchBoothReadyUp() {
	if (!shouldLaunchReadyUp(isReady)) return;
	isReady = true;
	socket.emit(CLIENT_TO_SERVER.PLAYER_READY, true);
	console.log('[launchBooth] ready-up via booth');
	window.dispatchEvent(new CustomEvent(LAUNCH_READY_EVENT));
}

// The hub Launch Bay booth's first subscriber: when the player interacts with
// the `launch` booth (server emits boothAction → main.js re-dispatches it as the
// `booth:action` window event), ready up exactly as the 2D Ready button does.
window.addEventListener(BOOTH_ACTION_EVENT, (e) => {
	if (isLaunchBoothAction(e.detail)) launchBoothReadyUp();
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
		if (getReservedKeys().has(key)) {
			showCardErrorToast('Key already in use');
			capturingKeyItemKey = false;
			useKeyItemKeyInputEl.blur();
			syncUseKeyItemBindingUI();
			return;
		}
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
				socket.emit(CLIENT_TO_SERVER.CLAIM_CARD_REWARD, { cardId: choice.id });
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
		const questLabel = formatQuestTierLabel(
			data.questName || (data.objective && data.objective.label) || '',
			data.questTier ?? 1,
		);
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

	// Mirror victory onto gameState.run and lastRunSummary only after the overlay
	// is visible so 06-boss-defeated can capture pre-summary combat while the
	// playthrough driver waits for Sortie Complete before 07-victory.
	lastRunSummary = data;
	if (data.status === 'victory' && gameState?.run) {
		gameState.run.status = 'victory';
		if (gameState.run.objective?.type === 'stage_boss') {
			gameState.run.objective.bossDefeated = true;
		} else if (data.objective?.bossDefeated === true && gameState.run.objective) {
			gameState.run.objective.bossDefeated = true;
		}
	}
}

returnToLobbyBtn.addEventListener('click', () => {
	socket.emit(CLIENT_TO_SERVER.RETURN_TO_LOBBY);
});

if (lobbyCloseBtnEl) {
	lobbyCloseBtnEl.addEventListener('click', () => {
		dismissGameLobby();
	});
}

if (createLobbyBtnEl) {
	createLobbyBtnEl.addEventListener('click', () => {
		if (!socket) return;
		const name = createLobbyNameEl ? createLobbyNameEl.value.trim() : '';
		socket.emit(CLIENT_TO_SERVER.CREATE_LOBBY, name ? { name } : {});
	});
}

if (refreshLobbiesBtnEl) {
	refreshLobbiesBtnEl.addEventListener('click', () => {
		if (socket) socket.emit(CLIENT_TO_SERVER.LIST_LOBBIES);
	});
}

if (leaveLobbyBtnEl) {
	leaveLobbyBtnEl.addEventListener('click', () => {
		if (socket) socket.emit(CLIENT_TO_SERVER.LEAVE_LOBBY);
	});
}

if (resumeRunBtnEl) {
	resumeRunBtnEl.addEventListener('click', () => launchBoothReadyUp());
}

if (abandonRunBtnEl) {
	abandonRunBtnEl.addEventListener('click', () => {
		if (!socket) return;
		socket.emit(CLIENT_TO_SERVER.ABANDON_RUN);
		suspendedRunSummary = null;
		clearSuspendedRunUi();
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
window.__getEnemyDisplayCatalog = () => enemyDisplayCatalog;
window.__setEnemyDisplayCatalog = (catalog) => { enemyDisplayCatalog = catalog; };
window.__syncLockOnInfoPanel = syncLockOnInfoPanel;
window.__updateBossEncounterHud = updateBossEncounterHud;
window.__getBossEncounterModel = () => (bossEncounterModel ? { ...bossEncounterModel } : null);
window.__updateKeyItemCooldownHud = updateKeyItemCooldownHud;
window.__flashKeyItemIndicator = flashKeyItemIndicator;
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
window.__setHarnessSceneForTest = (ctx = {}) => {
	if (ctx.hubLayout !== undefined) hubLayout = ctx.hubLayout;
	if (ctx.currentLayout !== undefined) currentLayout = ctx.currentLayout;
	if (ctx.renderedSceneProfile !== undefined) renderedSceneProfile = ctx.renderedSceneProfile;
};

// Expose renderer mesh maps on window for test compatibility
window.enemyHealthBars = (() => {
	const maps = getMeshMaps();
	return maps.enemyHealthBars;
})();
window.createEnemyMesh = rendererCreateEnemyMesh;
window.enemyMeshHalfHeight = rendererEnemyMeshHalfHeight;
window.healthBarColor = rendererHealthBarColor;
window.__mySelectedDeck = () => mySelectedDeck;
// Test-only: snapshot the lobby deck-editor state (selected deck + owned cards +
// inventory instance→card mapping) so a smoke test can build a valid non-default
// loadout from whatever the player actually owns. Read-only, behavior-neutral.
window.__deckStateForTest = () => ({
	selectedDeck: Array.isArray(mySelectedDeck) ? [...mySelectedDeck] : [],
	ownedCards: myOwnedCards ? { ...myOwnedCards } : {},
	inventory: Array.isArray(myInventory)
		? myInventory.map((i) => ({ instanceId: i.instanceId, cardId: i.cardId }))
		: null,
});
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
window.__setQuestBoardState = (quests, questId, tier) =>
	applyQuestBoardFromPayload({ quests, selectedQuestId: questId, selectedQuestTier: tier });
window.__getSelectedQuestId = () => selectedQuestId;
window.__getSelectedQuestTier = () => selectedQuestTier;
window.formatObjectiveSummary = formatObjectiveSummary;
window.formatRewardSummary = formatRewardSummary;
window.renderQuestBoard = renderQuestBoard;
window.__windupFlashing = () => getWindupFlashing();
window.__pickedUpLootIds = () => getPickedUpLootIds();
window.__enemiesMeshes = () => getMeshMaps().enemiesMeshes;
window.__getEnemyRenderScaleForTest = (enemyId) => {
	const enemy = gameState?.enemies?.find((e) => e && e.id === enemyId);
	if (!enemy) return null;
	const info = rendererGetEnemyRenderScaleForTest(enemyId, enemy.type);
	return info ? { scale: info.scale, type: enemy.type } : null;
};
window.__iceBallMeshes = () => getMeshMaps().iceBallMeshes;
window.applyWindupFlash = rendererApplyWindupFlash;
window.applyRevealHighlight = rendererApplyRevealHighlight;
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
window.openCharacterBooth = openCharacterBooth;
window.closeCharacterBooth = closeCharacterBooth;
window.openQuestPanel = openQuestPanel;
// Test hook: exercise the `?booth=` debug open path (localhost gate + once-per-session).
window.__requestBoothDebugOpenForTest = requestBoothDebugOpen;
window.performLogout = performLogout;
window.showGameLobby = showGameLobby;
window.dismissGameLobby = dismissGameLobby;
window.__getLobbyMenuDismissed = () => lobbyMenuDismissed;
window.renderLobbyList = renderLobbyList;
window.applyLobbyJoinedData = applyLobbyJoinedData;
window.applyHubPresence = applyHubPresence;
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
function bandAtLayout(layout, x, z) {
	if (!layout?.rooms) return null;
	for (const room of layout.rooms) {
		const halfW = room.width / 2;
		const halfD = room.depth / 2;
		if (x >= room.x - halfW && x <= room.x + halfW && z >= room.z - halfD && z <= room.z + halfD) {
			return room.band ?? null;
		}
	}
	return null;
}
function activeHarnessLayout() {
	return (gameState?.gamePhase === 'lobby' && hubLayout && renderedSceneProfile === 'hub')
		? hubLayout
		: (currentLayout || (gameState && gameState.layout) || null);
}
window.__sampleFloorAlignmentForHarness = async () => {
	const { sampleFloorY, resolveFloorY } = await import('../shared/floorSampling.esm.js');
	const me = gameState && myId ? gameState.players[myId] : null;
	const layout = activeHarnessLayout();
	if (!me || !layout) return null;
	const x = me.x;
	const z = me.z;
	const floorY = resolveFloorY(sampleFloorY(layout, x, z));
	const playerY = Number.isFinite(me.y) ? me.y : floorY;
	return {
		playerY,
		floorY,
		delta: playerY - floorY,
		layoutProfile: layout.profile ?? null,
		band: bandAtLayout(layout, x, z),
	};
};
window.__AUTOGAME_HARNESS_STATE__ = () => {
	const me = gameState && myId ? gameState.players[myId] : null;
	const lobbyVisible = !!lobbyEl && !lobbyEl.classList.contains('hidden');
	const deckEditorEl = document.getElementById('deck-editor');
	const deckEditorVisible = !!deckEditorEl && !deckEditorEl.classList.contains('hidden');
	const runId = gameState?.run?.id ?? null;
	const cardHandVisible = !!cardHandEl && getComputedStyle(cardHandEl).display !== 'none';

	const runObjective = gameState && gameState.run ? gameState.run.objective : null;
	const runEncounter = gameState && gameState.run ? gameState.run.encounter : null;
	const objective = runObjective ? {
		type: runObjective.type,
		totalEnemies: runObjective.totalEnemies,
		defeatedEnemies: runObjective.defeatedEnemies,
		totalItems: runObjective.totalItems,
		collectedItems: runObjective.collectedItems,
		label: runObjective.label,
		...(runObjective.bossDefeated !== undefined ? { bossDefeated: runObjective.bossDefeated } : {}),
	} : null;
	const encounter = runEncounter ? {
		phase: runEncounter.phase,
		bossEnemyId: runEncounter.bossEnemyId,
		locked: runEncounter.locked,
	} : null;
	// Mirror the server's isRunObjectiveComplete so a test can watch the flip.
	const runObjectiveComplete = !!objective && (
		objective.type === 'collect_items'
			? (objective.collectedItems ?? 0) >= (objective.totalItems ?? 0)
			: objective.type === 'stage_boss'
				? objective.bossDefeated === true
				: (objective.defeatedEnemies ?? 0) >= (objective.totalEnemies ?? 0)
	);

	const sortieCompleteOverlayVisible = !!runSummaryOverlay
		&& !!summaryStatusEl
		&& getComputedStyle(runSummaryOverlay).display !== 'none'
		&& summaryStatusEl.textContent.trim() === THEME.run.sortieComplete;

	return {
		debugScenario,
		debugScenarioAllowed,
		debugScenarioResult,
		debugGodmodeResult,
		objective,
		encounter,
		bossEncounter: bossEncounterModel ? { ...bossEncounterModel } : null,
		runObjectiveComplete,
		lastRunSummary,
		sortieCompleteOverlayVisible,
		myId,
		selectedDeck: Array.isArray(mySelectedDeck) ? [...mySelectedDeck] : [],
		phase: gameState ? gameState.gamePhase : 'unknown',
		runStatus: (gameState && gameState.run && gameState.run.status)
			|| (suspendedRunSummary ? 'suspended' : null),
		suspendedRunSummary: cloneSuspendedRunSummary(suspendedRunSummary),
		extracted: !!(me && me.extracted),
		telepipe: gameState ? gameState.telepipe : null,
		layout: (() => {
			// During the lobby phase the renderer shows hubLayout while currentLayout
			// still holds the selected quest layout from lobbyJoined — report the hub.
			const layout = (gameState?.gamePhase === 'lobby' && hubLayout && renderedSceneProfile === 'hub')
				? hubLayout
				: (currentLayout || (gameState && gameState.layout) || null);
			if (!layout) return null;
			const rooms = Array.isArray(layout.rooms) ? layout.rooms : [];
			const start = rooms.find((r) => r && r.role === 'start') || null;
			return {
				profile: layout.profile ?? null,
				seed: currentLayoutSeed,
				roomCount: rooms.length,
				startRoom: start ? { x: start.x, z: start.z, role: start.role } : null,
			};
		})(),
		connectionState,
		sceneInitialized: isSceneInitialized(),
		hasCanvas: !!document.querySelector('canvas'),
		lobbyVisible,
		lobbyMenuDismissed,
		characterBoothOpen: isCharacterBoothOpen(),
		deckEditorVisible,
		runId,
		cardHandVisible,
		status: statusEl ? statusEl.innerText : '',
		hpText: hpText ? hpText.textContent : '',
		msText: msText ? msText.textContent : '',
		currencyText: currencyDisplayEl ? currencyDisplayEl.textContent : '',
		currency: Number.isFinite(myCurrency) ? myCurrency : (me?.currency ?? null),
		player: me ? (() => {
			const statusNow = Date.now();
			const slowedUntil = me.slowedUntil ?? 0;
			const burningUntil = me.burningUntil ?? 0;
			return {
				hp: me.hp,
				magicStones: me.magicStones,
				currency: Number.isFinite(me.currency) ? me.currency : myCurrency,
				debugScenario: me.debugScenario,
				debugGodmode: !!me.debugGodmode,
				dead: me.dead,
				x: me.x,
				y: me.y,
				z: me.z,
				equippedKeyItemId: me.equippedKeyItemId ?? null,
				keyItemCooldownRemaining: getKeyItemCooldownRemainingMs(me),
				cardUseState: me.cardUseState ?? null,
				cardWindupUntil: me.cardWindupUntil ?? 0,
				cardWindupCardId: me.cardWindupCardId ?? null,
				slowedUntil,
				burningUntil,
				slowActive: slowedUntil > statusNow,
				burnActive: burningUntil > statusNow,
			};
		})() : null,
		keyItemIndicatorOnCooldown: (() => {
			const el = document.getElementById('key-item-indicator');
			return !!el && el.classList.contains('cooldown');
		})(),
		keyItemIndicatorText: (() => {
			const el = document.getElementById('key-item-indicator');
			return el ? el.textContent : '';
		})(),
		players: gameState ? Object.keys(gameState.players).length : 0,
		squadmates: gameState && myId
			? Object.entries(gameState.players)
				.filter(([id]) => id !== myId)
				.map(([id, p]) => ({
					id,
					x: Number.isFinite(p.x) ? p.x : null,
					z: Number.isFinite(p.z) ? p.z : null,
				}))
			: [],
		enemies: gameState ? gameState.enemies.length : 0,
		enemyHp: gameState ? gameState.enemies.map((enemy) => {
			const statusNow = Date.now();
			const slowedUntil = enemy.slowedUntil ?? 0;
			const burningUntil = enemy.burningUntil ?? 0;
			return {
				id: enemy.id,
				hp: enemy.hp,
				maxHp: enemy.maxHp,
				revealedUntil: enemy.revealedUntil ?? undefined,
				type: enemy.type,
				spawnedBy: enemy.spawnedBy ?? null,
				x: enemy.x,
				z: enemy.z,
				slowedUntil,
				burningUntil,
				slowActive: slowedUntil > statusNow,
				burnActive: burningUntil > statusNow,
				...(enemy.slowFactor != null ? { slowFactor: enemy.slowFactor } : {}),
			};
		}) : [],
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
		inventory: Array.isArray(myInventory)
			? myInventory.map((inst) => ({
				instanceId: inst.instanceId,
				cardId: inst.cardId,
				grind: inst.grind,
				isEvolved: inst.isEvolved,
				evolvedFrom: inst.evolvedFrom,
			  }))
			: [],
		lastEvolutionResult: lastEvolutionResult
			? {
				instance: lastEvolutionResult.instance,
				fromCardId: lastEvolutionResult.fromCardId,
				toCardId: lastEvolutionResult.toCardId,
			  }
			: null,
	};
};

// v8 ignore end
