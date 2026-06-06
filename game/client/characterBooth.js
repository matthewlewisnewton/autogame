// ── In-hub character booth overlay ──
// Dedicated character-edit screen (separate from Account) with live 3D preview.
// Booth anchor interaction wiring lands in a later sub-ticket; this module
// exposes open/close lifecycle and test hooks.

import {
	openPreview,
	updatePreview,
	closePreview,
} from './cosmetic-preview.js';
import { createCosmeticForm } from './cosmeticForm.js';
import { getHatCatalog } from './settings.js';
import { APPEARANCE_CHANGE_COST } from './config.js';
import { hasAppearanceFieldChanges } from '../shared/cosmeticAppearance.esm.js';
import { formatCurrencyPrice } from './theme.js';
import eventsCatalog from '../shared/events.json' with { type: 'json' };

const { clientToServer: CLIENT_TO_SERVER } = eventsCatalog;

const overlayEl = document.getElementById('character-booth-overlay');
const closeBtnEl = document.getElementById('character-booth-close-btn');
const previewCanvasEl = document.getElementById('character-booth-preview-canvas');
const saveBtnEl = document.getElementById('character-booth-save-btn');
const confirmEl = document.getElementById('character-booth-confirm');
const confirmMessageEl = document.getElementById('character-booth-confirm-message');
const confirmOkBtnEl = document.getElementById('character-booth-confirm-ok');
const confirmCancelBtnEl = document.getElementById('character-booth-confirm-cancel');

/** @type {ReturnType<typeof createCosmeticForm>|null} */
let form = null;
/** @type {object|null} */
let selection = null;
/** @type {boolean} */
let isOpen = false;
/** @type {boolean} */
let saveInFlight = false;
/** @type {object|null} */
let pendingCosmetic = null;

/** @type {{
 *   patchProfile: (patch: object) => Promise<{ error?: string }>,
 *   getAccountCosmetic: () => object,
 *   getGameState: () => object|null,
 *   getMyId: () => string|null,
 *   setGameStateRef: (state: object|null) => void,
 *   getSocket: () => { connected: boolean, emit: (event: string, data: object) => void }|null,
 *   getCurrency: () => number,
 * }|null} */
let deps = null;

function buildCosmeticPayload() {
	return {
		bodyColor: selection.bodyColor,
		accentColor: selection.accentColor,
		bodyShape: selection.bodyShape,
		hat: selection.hat,
		proportions: { ...selection.proportions },
	};
}

function isPaidAppearanceChange(cosmetic) {
	return hasAppearanceFieldChanges(deps.getAccountCosmetic(), cosmetic);
}

function updateSaveButtonLabel() {
	if (!saveBtnEl || !selection || !deps) return;
	const cosmetic = buildCosmeticPayload();
	if (isPaidAppearanceChange(cosmetic)) {
		saveBtnEl.textContent = `Save character (${formatCurrencyPrice(APPEARANCE_CHANGE_COST)})`;
	} else {
		saveBtnEl.textContent = 'Save character';
	}
}

function refreshBoothPreview() {
	if (!isOpen) return;
	updatePreview({ ...selection });
	updateSaveButtonLabel();
}

function hideConfirm() {
	pendingCosmetic = null;
	if (confirmEl) confirmEl.classList.add('hidden');
}

function showConfirm(cosmetic) {
	pendingCosmetic = cosmetic;
	if (confirmMessageEl) {
		confirmMessageEl.textContent =
			`Save appearance changes for ${formatCurrencyPrice(APPEARANCE_CHANGE_COST)}?`;
	}
	if (confirmEl) confirmEl.classList.remove('hidden');
}

function setSaveDisabled(disabled) {
	if (saveBtnEl) saveBtnEl.disabled = disabled;
	if (confirmOkBtnEl) confirmOkBtnEl.disabled = disabled;
	if (confirmCancelBtnEl) confirmCancelBtnEl.disabled = disabled && saveInFlight;
}

function syncSavedCosmeticToGameState() {
	const myId = deps.getMyId();
	const gameState = deps.getGameState();
	if (myId && gameState?.players?.[myId]) {
		gameState.players[myId].cosmetic = deps.getAccountCosmetic();
		deps.setGameStateRef(gameState);
	}
}

function finishSuccessfulSave() {
	saveInFlight = false;
	hideConfirm();
	setSaveDisabled(false);
	form.syncFromAccount(deps.getAccountCosmetic);
	syncSavedCosmeticToGameState();
	updateSaveButtonLabel();
	closeCharacterBooth();
}

/**
 * Wire booth DOM controls and lifecycle. Called once from main.js after the
 * shared `cosmeticSelection` object is created.
 * @param {object} config
 */
export function initCharacterBooth({
	selection: sharedSelection,
	patchProfile,
	getAccountCosmetic,
	getGameState,
	getMyId,
	setGameStateRef,
	getSocket,
	getCurrency,
}) {
	selection = sharedSelection;
	deps = {
		patchProfile,
		getAccountCosmetic,
		getGameState,
		getMyId,
		setGameStateRef,
		getSocket,
		getCurrency,
	};

	form = createCosmeticForm({
		elements: {
			bodySwatches: document.getElementById('character-booth-body-swatches'),
			accentSwatches: document.getElementById('character-booth-accent-swatches'),
			shapeSelect: document.getElementById('character-booth-shape-select'),
			hatList: document.getElementById('character-booth-hat-list'),
			proportions: document.getElementById('character-booth-proportions'),
			errorEl: document.getElementById('character-booth-cosmetic-error'),
		},
		selection,
		onPreviewChange: refreshBoothPreview,
		getCurrency,
		onUnlockHat: (hatId) => {
			const socket = getSocket();
			if (!socket || !socket.connected) return;
			const hat = getHatCatalog().find((h) => h.id === hatId);
			if (!hat || getCurrency() < hat.price) return;
			socket.emit(CLIENT_TO_SERVER.UNLOCK_HAT, { hatId });
		},
		proportionIdPrefix: 'character-booth-prop',
	});

	if (closeBtnEl) {
		closeBtnEl.addEventListener('click', closeCharacterBooth);
	}
	if (overlayEl) {
		overlayEl.addEventListener('click', (e) => {
			if (e.target === overlayEl) closeCharacterBooth();
		});
	}
	if (saveBtnEl) {
		saveBtnEl.addEventListener('click', saveCharacterBooth);
	}
	if (confirmOkBtnEl) {
		confirmOkBtnEl.addEventListener('click', confirmPaidSave);
	}
	if (confirmCancelBtnEl) {
		confirmCancelBtnEl.addEventListener('click', cancelPaidSave);
	}
}

/** Rebuild the booth hat list (e.g. after a server hatUnlocked event). */
export function rebuildBoothHatList() {
	form?.rebuildHatList();
}

/** Surface hat-unlock errors in the booth error line when visible. */
export function showBoothCosmeticError(message) {
	form?.showError(message);
}

/** Handle a successful `appearanceChanged` socket event while the booth is open. */
export function handleAppearanceChanged() {
	if (!isOpen || !deps || !form) return;
	finishSuccessfulSave();
}

/** Re-enable save after `appearanceError`; error message is shown by main.js. */
export function handleAppearanceError() {
	if (!isOpen) return;
	saveInFlight = false;
	hideConfirm();
	setSaveDisabled(false);
}

export function openCharacterBooth() {
	if (!overlayEl || !selection || !deps || !form) return;
	form.syncFromAccount(deps.getAccountCosmetic);
	hideConfirm();
	saveInFlight = false;
	setSaveDisabled(false);
	updateSaveButtonLabel();
	overlayEl.classList.remove('hidden');
	isOpen = true;
	openPreview(previewCanvasEl, { ...selection });
}

export function closeCharacterBooth() {
	if (!overlayEl) return;
	if (isOpen) {
		closePreview();
	}
	hideConfirm();
	saveInFlight = false;
	setSaveDisabled(false);
	overlayEl.classList.add('hidden');
	form?.showError('');
	isOpen = false;
}

function cancelPaidSave() {
	if (saveInFlight) return;
	hideConfirm();
}

async function confirmPaidSave() {
	if (!pendingCosmetic || saveInFlight || !deps || !form) return;
	await emitAppearanceChange(pendingCosmetic);
}

async function emitAppearanceChange(cosmetic) {
	const socket = deps.getSocket();
	if (socket?.connected) {
		saveInFlight = true;
		setSaveDisabled(true);
		form.showError('');
		socket.emit(CLIENT_TO_SERVER.APPLY_APPEARANCE_CHANGE, { cosmetic });
		return;
	}

	saveInFlight = true;
	setSaveDisabled(true);
	form.showError('');
	const result = await deps.patchProfile({ cosmetic });
	saveInFlight = false;
	setSaveDisabled(false);

	if (result.error) {
		form.showError(result.error);
		return;
	}

	finishSuccessfulSave();
}

async function saveCharacterBooth() {
	if (!saveBtnEl || !selection || !deps || !form || saveInFlight) return;
	const cosmetic = buildCosmeticPayload();
	const paidChange = isPaidAppearanceChange(cosmetic);

	form.showError('');

	if (paidChange) {
		showConfirm(cosmetic);
		return;
	}

	await emitAppearanceChange(cosmetic);
}

/** Whether the booth overlay is currently open (test/debug helper). */
export function isCharacterBoothOpen() {
	return isOpen;
}

/**
 * Apply a partial cosmetic patch to the in-progress booth selection and refresh
 * the preview/save label. Test/harness helper only.
 * @param {object} patch
 * @returns {boolean}
 */
export function patchBoothSelection(patch) {
	if (!selection || !patch || typeof patch !== 'object') return false;
	if (patch.bodyColor !== undefined) selection.bodyColor = patch.bodyColor;
	if (patch.accentColor !== undefined) selection.accentColor = patch.accentColor;
	if (patch.bodyShape !== undefined) selection.bodyShape = patch.bodyShape;
	if (patch.hat !== undefined) selection.hat = patch.hat;
	if (patch.proportions && typeof patch.proportions === 'object') {
		selection.proportions = { ...selection.proportions, ...patch.proportions };
	}
	refreshBoothPreview();
	form?.syncUI(buildCosmeticPayload());
	return true;
}

/** Trigger the booth save flow (may open the paid-change confirm dialog). */
export function requestBoothSave() {
	saveCharacterBooth();
}

/** Confirm a pending paid booth save when the confirm dialog is visible. */
export function confirmBoothPaidSave() {
	confirmPaidSave();
}
