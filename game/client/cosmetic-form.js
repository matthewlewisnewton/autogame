// Account appearance form: sync controls from cached cosmetic, draft state, HUD portrait.

const VALID_SHAPES = ['box', 'cylinder', 'cone', 'capsule'];
const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;

/**
 * @typedef {object} CosmeticFormRefs
 * @property {HTMLElement | null} [shapeButtons]
 * @property {NodeListOf<HTMLElement> | HTMLElement[] | null} [shapeBtnEls]
 * @property {HTMLElement | null} [bodySwatchesEl]
 * @property {HTMLElement | null} [accentSwatchesEl]
 * @property {HTMLInputElement | null} [bodyCustomInput]
 * @property {HTMLInputElement | null} [accentCustomInput]
 * @property {HTMLElement | null} [cosmeticErrorEl]
 */

/**
 * @param {{ bodyColor?: string, accentColor?: string, bodyShape?: string }} a
 * @param {{ bodyColor?: string, accentColor?: string, bodyShape?: string }} b
 */
export function cosmeticsEqual(a, b) {
	return a.bodyShape === b.bodyShape
		&& a.bodyColor === b.bodyColor
		&& a.accentColor === b.accentColor;
}

/**
 * @param {HTMLElement | null | undefined} gridEl
 * @param {string} color
 */
export function selectSwatchInGrid(gridEl, color) {
	if (!gridEl) return false;
	const swatches = gridEl.querySelectorAll('.cosmetic-swatch');
	let matched = false;
	for (const swatch of swatches) {
		const isMatch = swatch.getAttribute('data-color') === color;
		swatch.classList.toggle('selected', isMatch);
		if (isMatch) matched = true;
	}
	return matched;
}

/**
 * @param {HTMLElement[]} shapeBtns
 * @param {string} shape
 */
export function selectShapeButton(shapeBtns, shape) {
	const normalized = VALID_SHAPES.includes(shape) ? shape : 'box';
	for (const btn of shapeBtns) {
		const isSelected = btn.getAttribute('data-shape') === normalized;
		btn.classList.toggle('selected', isSelected);
		btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
	}
	return normalized;
}

/**
 * Populate appearance controls from a cosmetic object.
 *
 * @param {CosmeticFormRefs & { shapeBtnEls?: HTMLElement[] }} refs
 * @param {{ bodyColor: string, accentColor: string, bodyShape: string }} cosmetic
 * @returns {{ bodyColor: string, accentColor: string, bodyShape: string }}
 */
export function syncCosmeticForm(refs, cosmetic) {
	const shapeBtns = refs.shapeBtnEls || [];
	const bodyShape = selectShapeButton(shapeBtns, cosmetic.bodyShape);

	if (refs.bodyCustomInput) refs.bodyCustomInput.value = cosmetic.bodyColor;
	if (refs.accentCustomInput) refs.accentCustomInput.value = cosmetic.accentColor;

	if (!selectSwatchInGrid(refs.bodySwatchesEl, cosmetic.bodyColor)) {
		selectSwatchInGrid(refs.bodySwatchesEl, '');
	}
	if (!selectSwatchInGrid(refs.accentSwatchesEl, cosmetic.accentColor)) {
		selectSwatchInGrid(refs.accentSwatchesEl, '');
	}

	if (refs.cosmeticErrorEl) {
		refs.cosmeticErrorEl.textContent = '';
		refs.cosmeticErrorEl.hidden = true;
	}

	return {
		bodyShape,
		bodyColor: cosmetic.bodyColor,
		accentColor: cosmetic.accentColor,
	};
}

/**
 * Read the current draft from form controls.
 *
 * @param {CosmeticFormRefs & { shapeBtnEls?: HTMLElement[] }} refs
 * @param {{ bodyColor: string, accentColor: string, bodyShape: string }} [fallback]
 */
export function readCosmeticDraft(refs, fallback = { bodyColor: '#4f9dde', accentColor: '#f2c94c', bodyShape: 'box' }) {
	const shapeBtns = refs.shapeBtnEls || [];
	let bodyShape = fallback.bodyShape;
	for (const btn of shapeBtns) {
		if (btn.classList.contains('selected')) {
			bodyShape = btn.getAttribute('data-shape') || bodyShape;
			break;
		}
	}
	if (!VALID_SHAPES.includes(bodyShape)) bodyShape = 'box';

	const bodyFromSwatch = refs.bodySwatchesEl?.querySelector('.cosmetic-swatch.selected')?.getAttribute('data-color');
	const accentFromSwatch = refs.accentSwatchesEl?.querySelector('.cosmetic-swatch.selected')?.getAttribute('data-color');

	const bodyCustom = refs.bodyCustomInput?.value;
	const accentCustom = refs.accentCustomInput?.value;

	const bodyColor = (bodyFromSwatch && HEX_COLOR_REGEX.test(bodyFromSwatch))
		? bodyFromSwatch
		: (bodyCustom && HEX_COLOR_REGEX.test(bodyCustom) ? bodyCustom : fallback.bodyColor);
	const accentColor = (accentFromSwatch && HEX_COLOR_REGEX.test(accentFromSwatch))
		? accentFromSwatch
		: (accentCustom && HEX_COLOR_REGEX.test(accentCustom) ? accentCustom : fallback.accentColor);

	return { bodyShape, bodyColor, accentColor };
}

/**
 * @param {HTMLElement | null | undefined} frameEl
 * @param {{ bodyColor?: string, accentColor?: string, bodyShape?: string }} cosmetic
 */
export function updateVanguardPortraitCosmetic(frameEl, cosmetic) {
	if (!frameEl || !cosmetic) return;

	const bodyColor = HEX_COLOR_REGEX.test(cosmetic.bodyColor) ? cosmetic.bodyColor : '#4f9dde';
	const accentColor = HEX_COLOR_REGEX.test(cosmetic.accentColor) ? cosmetic.accentColor : '#f2c94c';
	const bodyShape = VALID_SHAPES.includes(cosmetic.bodyShape) ? cosmetic.bodyShape : 'box';

	frameEl.style.background = `radial-gradient(circle at 35% 30%, ${bodyColor} 0%, #0f172a 70%)`;
	frameEl.style.borderColor = accentColor;
	frameEl.style.boxShadow = `0 0 10px ${accentColor}88, inset 0 0 12px ${accentColor}26`;
	frameEl.dataset.bodyShape = bodyShape;
}

/**
 * @param {HTMLElement | null | undefined} errorEl
 * @param {string} [message]
 */
export function showCosmeticError(errorEl, message) {
	if (!errorEl) return;
	if (message) {
		errorEl.textContent = message;
		errorEl.hidden = false;
	} else {
		errorEl.textContent = '';
		errorEl.hidden = true;
	}
}

/**
 * Build the PATCH payload for cosmetic save.
 *
 * @param {{ bodyColor: string, accentColor: string, bodyShape: string }} draft
 */
export function buildCosmeticPatchPayload(draft) {
	return {
		cosmetic: {
			bodyColor: draft.bodyColor,
			accentColor: draft.accentColor,
			bodyShape: draft.bodyShape,
		},
	};
}
