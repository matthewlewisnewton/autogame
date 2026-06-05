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
import { getHatCatalog, PROPORTION_RANGES } from './settings.js';
import { formatCurrencyPrice } from './theme.js';

const overlayEl = document.getElementById('character-booth-overlay');
const closeBtnEl = document.getElementById('character-booth-close-btn');
const previewCanvasEl = document.getElementById('character-booth-preview-canvas');
const saveBtnEl = document.getElementById('character-booth-save-btn');
const appearanceCostHintEl = document.getElementById('character-booth-appearance-cost-hint');

// Mirrors server `APPEARANCE_KEYS` (game/server/cosmetic.js) — hat excluded.
const APPEARANCE_KEYS = ['bodyColor', 'accentColor', 'bodyShape', 'modelId'];
const PROPORTION_KEYS = Object.keys(PROPORTION_RANGES);

/** @type {ReturnType<typeof createCosmeticForm>|null} */
let form = null;
/** @type {object|null} */
let selection = null;
/** @type {boolean} */
let isOpen = false;
/** @type {((result: { ok: boolean, error?: string }) => void)|null} */
let pendingSaveResolve = null;

/** @type {{
 *   getAccountCosmetic: () => object,
 *   setAccountCosmetic: (cosmetic: object) => void,
 *   getGameState: () => object|null,
 *   getMyId: () => string|null,
 *   setGameStateRef: (state: object|null) => void,
 *   getSocket: () => { connected: boolean, emit: (event: string, data: object) => void }|null,
 *   getCurrency: () => number,
 *   getAppearanceChangeCost: () => number,
 * }|null} */
let deps = null;

function backfillForAppearanceCompare(cosmetic) {
	const src = (cosmetic && typeof cosmetic === 'object') ? cosmetic : {};
	return {
		bodyColor: typeof src.bodyColor === 'string' ? src.bodyColor : '#4f9dde',
		accentColor: typeof src.accentColor === 'string' ? src.accentColor : '#f2c94c',
		bodyShape: typeof src.bodyShape === 'string' ? src.bodyShape : 'box',
		modelId: typeof src.modelId === 'string' ? src.modelId : 'player',
		hat: typeof src.hat === 'string' ? src.hat : 'none',
		proportions: { ...defaultProportions(), ...(src.proportions || {}) },
	};
}

function defaultProportions() {
	const out = {};
	for (const key of PROPORTION_KEYS) out[key] = 1.0;
	return out;
}

/**
 * Whether any appearance field (excluding hat) differs between two cosmetics.
 * Mirrors server `appearanceFieldsChanged`.
 * @param {object} current
 * @param {object} next
 * @returns {boolean}
 */
export function appearanceFieldsChanged(current, next) {
	const cur = backfillForAppearanceCompare(current);
	const nxt = backfillForAppearanceCompare(next);
	for (const key of APPEARANCE_KEYS) {
		if (cur[key] !== nxt[key]) return true;
	}
	for (const key of PROPORTION_KEYS) {
		if (cur.proportions[key] !== nxt.proportions[key]) return true;
	}
	return false;
}

function buildCosmeticFromSelection() {
	return {
		bodyColor: selection.bodyColor,
		accentColor: selection.accentColor,
		bodyShape: selection.bodyShape,
		hat: selection.hat,
		proportions: { ...selection.proportions },
	};
}

function refreshAppearanceCostHint() {
	if (!appearanceCostHintEl || !deps) return;
	const cost = deps.getAppearanceChangeCost();
	appearanceCostHintEl.textContent =
		`Appearance edits: ${formatCurrencyPrice(cost)}`;
}

function finishPendingSave(result) {
	if (!pendingSaveResolve) return;
	const resolve = pendingSaveResolve;
	pendingSaveResolve = null;
	resolve(result);
}

function syncAfterSuccessfulSave(cosmetic) {
	deps.setAccountCosmetic(cosmetic);
	form.syncFromAccount(deps.getAccountCosmetic);
	const myId = deps.getMyId();
	const gameState = deps.getGameState();
	if (myId && gameState?.players?.[myId]) {
		gameState.players[myId].cosmetic = deps.getAccountCosmetic();
		deps.setGameStateRef(gameState);
	}
}

function refreshBoothPreview() {
	if (!isOpen) return;
	updatePreview({ ...selection });
}

/**
 * Wire booth DOM controls and lifecycle. Called once from main.js after the
 * shared `cosmeticSelection` object is created.
 * @param {object} config
 */
export function initCharacterBooth({
	selection: sharedSelection,
	getAccountCosmetic,
	setAccountCosmetic,
	getGameState,
	getMyId,
	setGameStateRef,
	getSocket,
	getCurrency,
	getAppearanceChangeCost,
}) {
	selection = sharedSelection;
	deps = {
		getAccountCosmetic,
		setAccountCosmetic,
		getGameState,
		getMyId,
		setGameStateRef,
		getSocket,
		getCurrency,
		getAppearanceChangeCost,
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
			socket.emit('unlockHat', { hatId });
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

	refreshAppearanceCostHint();
}

/** Rebuild the booth hat list (e.g. after a server hatUnlocked event). */
export function rebuildBoothHatList() {
	form?.rebuildHatList();
}

/** Surface hat-unlock or appearance-save errors in the booth error line when visible. */
export function showBoothCosmeticError(message) {
	form?.showError(message);
}

/**
 * Handle `appearanceApplied` from the server after a booth save.
 * @param {{ cosmetic?: object, currency?: number }} data
 */
export function handleCharacterBoothAppearanceApplied(data) {
	if (!pendingSaveResolve) return;
	if (data?.cosmetic) {
		syncAfterSuccessfulSave(data.cosmetic);
	}
	finishPendingSave({ ok: true });
	if (saveBtnEl) saveBtnEl.disabled = false;
}

/**
 * Handle `appearanceError` from the server after a booth save attempt.
 * @param {string} message
 */
export function handleCharacterBoothAppearanceError(message) {
	if (!pendingSaveResolve) return;
	finishPendingSave({ ok: false, error: message });
	if (saveBtnEl) saveBtnEl.disabled = false;
	showBoothCosmeticError(message);
}

export function openCharacterBooth() {
	if (!overlayEl || !selection || !deps || !form) return;
	form.syncFromAccount(deps.getAccountCosmetic);
	refreshAppearanceCostHint();
	overlayEl.classList.remove('hidden');
	isOpen = true;
	openPreview(previewCanvasEl, { ...selection });
}

export function closeCharacterBooth() {
	if (!overlayEl) return;
	if (isOpen) {
		closePreview();
	}
	overlayEl.classList.add('hidden');
	form?.showError('');
	isOpen = false;
}

async function saveCharacterBooth() {
	if (!saveBtnEl || !selection || !deps || !form) return;
	const cosmetic = buildCosmeticFromSelection();
	const accountCosmetic = deps.getAccountCosmetic();
	const paidEdit = appearanceFieldsChanged(accountCosmetic, cosmetic);

	form.showError('');

	if (paidEdit) {
		const cost = deps.getAppearanceChangeCost();
		const price = formatCurrencyPrice(cost);
		const confirmed = window.confirm(
			`Save appearance changes? This will cost ${price}.`
		);
		if (!confirmed) return;
	}

	const socket = deps.getSocket();
	if (!socket || !socket.connected) {
		form.showError('Not connected to server');
		return;
	}

	saveBtnEl.disabled = true;
	const result = await new Promise((resolve) => {
		pendingSaveResolve = resolve;
		socket.emit('applyAppearance', { cosmetic });
	});

	if (!result.ok) {
		if (result.error) form.showError(result.error);
		return;
	}
}

/** Whether the booth overlay is currently open (test/debug helper). */
export function isCharacterBoothOpen() {
	return isOpen;
}
