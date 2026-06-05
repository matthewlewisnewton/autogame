// ── Hub Booth Interaction Prompt & Action Hook ──
// Small, DOM-light helpers for the hub booth-interaction primitive, kept in a
// dedicated module so the show/hide and dispatch logic stays unit-testable
// (main.js itself is v8-ignored UI glue). main.js wires these to the renderer's
// per-frame booth-in-range signal and the `boothAction` socket event.

/** booth id → human-readable display name shown in the prompt. */
export const BOOTH_DISPLAY_NAMES = {
	quest: 'Quest Board',
	launch: 'Launch Bay',
	shop: 'Shop',
	deck: 'Deck Editor',
	character: 'Character',
	hats: 'Hats',
};

/** The interact key shown in the prompt — mirrors input.js DEFAULT_KEYBOARD.interact. */
export const INTERACT_KEY_LABEL = 'F';

/**
 * Build the prompt label for a booth, e.g. "Press F — Shop".
 * @param {string|null} boothId
 * @returns {string|null} the label, or null when the booth is unknown/none
 */
export function formatBoothPrompt(boothId) {
	if (!boothId) return null;
	const name = BOOTH_DISPLAY_NAMES[boothId];
	if (!name) return null;
	return `Press ${INTERACT_KEY_LABEL} — ${name}`;
}

/**
 * Show or hide the booth prompt element based on the in-range booth.
 * @param {HTMLElement|null} promptEl - the `#booth-prompt` overlay
 * @param {string|null} boothId - the in-range booth, or null
 * @returns {boolean} whether the prompt is now visible
 */
export function updateBoothPrompt(promptEl, boothId) {
	if (!promptEl) return false;
	const label = formatBoothPrompt(boothId);
	if (label) {
		promptEl.textContent = label;
		promptEl.dataset.boothId = boothId;
		promptEl.classList.remove('hidden');
		return true;
	}
	promptEl.textContent = '';
	delete promptEl.dataset.boothId;
	promptEl.classList.add('hidden');
	return false;
}

/** Event name future booth tickets subscribe to for booth behavior. */
export const BOOTH_ACTION_EVENT = 'booth:action';

/**
 * Single hook point for server `boothAction` payloads. Later booth tickets
 * attach behavior by listening for `BOOTH_ACTION_EVENT` on `window` instead of
 * re-touching this primitive.
 * @param {{ boothId?: string, action?: string }} detail
 */
export function dispatchBoothAction(detail) {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent(BOOTH_ACTION_EVENT, { detail }));
}
