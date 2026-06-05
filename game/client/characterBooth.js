// ── In-hub character booth overlay ──
// Dedicated character-edit screen (separate from Account) with live 3D preview.
// Booth anchor interaction wiring lands in a later sub-ticket; this module
// exposes open/close lifecycle and test hooks.

import EVENTS from '../shared/events.json' with { type: 'json' };
import {
	openPreview,
	updatePreview,
	closePreview,
} from './cosmetic-preview.js';
import { createCosmeticForm } from './cosmeticForm.js';
import { getHatCatalog } from './settings.js';

const overlayEl = document.getElementById('character-booth-overlay');
const closeBtnEl = document.getElementById('character-booth-close-btn');
const previewCanvasEl = document.getElementById('character-booth-preview-canvas');
const saveBtnEl = document.getElementById('character-booth-save-btn');

/** @type {ReturnType<typeof createCosmeticForm>|null} */
let form = null;
/** @type {object|null} */
let selection = null;
/** @type {boolean} */
let isOpen = false;

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
			socket.emit(EVENTS.unlockHat, { hatId });
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
}

/** Rebuild the booth hat list (e.g. after a server hatUnlocked event). */
export function rebuildBoothHatList() {
	form?.rebuildHatList();
}

/** Surface hat-unlock errors in the booth error line when visible. */
export function showBoothCosmeticError(message) {
	form?.showError(message);
}

export function openCharacterBooth() {
	if (!overlayEl || !selection || !deps || !form) return;
	form.syncFromAccount(deps.getAccountCosmetic);
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
	const cosmetic = {
		bodyColor: selection.bodyColor,
		accentColor: selection.accentColor,
		bodyShape: selection.bodyShape,
		hat: selection.hat,
		proportions: { ...selection.proportions },
	};
	form.showError('');
	saveBtnEl.disabled = true;
	const result = await deps.patchProfile({ cosmetic });
	saveBtnEl.disabled = false;

	if (result.error) {
		form.showError(result.error);
		return;
	}

	form.syncFromAccount(deps.getAccountCosmetic);
	const myId = deps.getMyId();
	const gameState = deps.getGameState();
	if (myId && gameState?.players?.[myId]) {
		gameState.players[myId].cosmetic = deps.getAccountCosmetic();
		deps.setGameStateRef(gameState);
	}
}

/** Whether the booth overlay is currently open (test/debug helper). */
export function isCharacterBoothOpen() {
	return isOpen;
}
