// Pure DOM helpers for account appearance controls (settings overlay).

/** @typedef {{ bodyColor: string, accentColor: string, bodyShape: string, hat: string }} Cosmetic */

export const BODY_SHAPES = ['box', 'cylinder', 'cone', 'capsule'];

export const DEFAULT_COSMETIC = {
	bodyColor: '#4f9dde',
	accentColor: '#f2c94c',
	bodyShape: 'box',
	hat: 'none',
};

/** Preset body-color swatches (aligned with server defaults and index.html). */
export const BODY_COLOR_PALETTE = [
	'#4f9dde',
	'#38bdf8',
	'#22c55e',
	'#a855f7',
	'#f97316',
	'#ef4444',
	'#e2e8f0',
];

const SHAPE_PREVIEW_STYLES = {
	box: { borderRadius: '4px', clipPath: '' },
	cylinder: { borderRadius: '50% / 12%', clipPath: '' },
	cone: { borderRadius: '0', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' },
	capsule: { borderRadius: '999px', clipPath: '' },
};

function normalizeHexColor(value, fallback) {
	if (typeof value !== 'string') return fallback;
	const trimmed = value.trim();
	if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
	return fallback;
}

function normalizeBodyShape(value) {
	return BODY_SHAPES.includes(value) ? value : DEFAULT_COSMETIC.bodyShape;
}

/**
 * @param {ParentNode} root
 * @param {Partial<Cosmetic>|null|undefined} cosmetic
 */
export function syncCosmeticForm(root, cosmetic) {
	if (!root) return;
	const c = { ...DEFAULT_COSMETIC, ...(cosmetic && typeof cosmetic === 'object' ? cosmetic : {}) };
	const bodyColor = normalizeHexColor(c.bodyColor, DEFAULT_COSMETIC.bodyColor);
	const accentColor = normalizeHexColor(c.accentColor, DEFAULT_COSMETIC.accentColor);
	const bodyShape = normalizeBodyShape(c.bodyShape);

	for (const swatch of root.querySelectorAll('.cosmetic-swatch')) {
		const color = swatch.getAttribute('data-color');
		const pressed = color?.toLowerCase() === bodyColor.toLowerCase();
		swatch.setAttribute('aria-pressed', pressed ? 'true' : 'false');
	}

	const accentInput = root.querySelector('#cosmetic-accent-color');
	if (accentInput) accentInput.value = accentColor;

	for (const btn of root.querySelectorAll('.cosmetic-shape-btn')) {
		const shape = btn.getAttribute('data-shape');
		btn.setAttribute('aria-pressed', shape === bodyShape ? 'true' : 'false');
	}
}

/**
 * @param {ParentNode} root
 * @returns {{ bodyColor: string, accentColor: string, bodyShape: string }}
 */
export function readCosmeticFormState(root) {
	if (!root) {
		return {
			bodyColor: DEFAULT_COSMETIC.bodyColor,
			accentColor: DEFAULT_COSMETIC.accentColor,
			bodyShape: DEFAULT_COSMETIC.bodyShape,
		};
	}

	const pressedSwatch = root.querySelector('.cosmetic-swatch[aria-pressed="true"]');
	const bodyColor = normalizeHexColor(
		pressedSwatch?.getAttribute('data-color'),
		DEFAULT_COSMETIC.bodyColor
	);

	const accentInput = root.querySelector('#cosmetic-accent-color');
	const accentColor = normalizeHexColor(
		accentInput?.value,
		DEFAULT_COSMETIC.accentColor
	);

	const pressedShape = root.querySelector('.cosmetic-shape-btn[aria-pressed="true"]');
	const bodyShape = normalizeBodyShape(pressedShape?.getAttribute('data-shape'));

	return { bodyColor, accentColor, bodyShape };
}

/**
 * @param {ParentNode} root
 * @returns {{ bodyColor: string, accentColor: string, bodyShape: string }}
 */
export function buildCosmeticPatchPayload(root) {
	return readCosmeticFormState(root);
}

/**
 * @param {ParentNode} root
 * @param {Partial<Cosmetic>|null|undefined} savedCosmetic
 * @returns {boolean}
 */
export function isCosmeticPatchUnchanged(root, savedCosmetic) {
	const next = readCosmeticFormState(root);
	const saved = { ...DEFAULT_COSMETIC, ...(savedCosmetic && typeof savedCosmetic === 'object' ? savedCosmetic : {}) };
	const bodyColor = normalizeHexColor(saved.bodyColor, DEFAULT_COSMETIC.bodyColor);
	const accentColor = normalizeHexColor(saved.accentColor, DEFAULT_COSMETIC.accentColor);
	const bodyShape = normalizeBodyShape(saved.bodyShape);
	return (
		next.bodyColor === bodyColor
		&& next.accentColor === accentColor
		&& next.bodyShape === bodyShape
	);
}

/**
 * @param {HTMLElement|null|undefined} frameEl
 * @param {HTMLElement|null|undefined} portraitEl
 * @param {Partial<Cosmetic>|null|undefined} cosmetic
 */
export function applyCosmeticToCharacterFrame(frameEl, portraitEl, cosmetic) {
	if (!frameEl) return;
	const c = { ...DEFAULT_COSMETIC, ...(cosmetic && typeof cosmetic === 'object' ? cosmetic : {}) };
	const bodyColor = normalizeHexColor(c.bodyColor, DEFAULT_COSMETIC.bodyColor);
	const accentColor = normalizeHexColor(c.accentColor, DEFAULT_COSMETIC.accentColor);
	const bodyShape = normalizeBodyShape(c.bodyShape);

	frameEl.setAttribute('data-body-shape', bodyShape);
	frameEl.style.setProperty('--cosmetic-body-color', bodyColor);
	frameEl.style.setProperty('--cosmetic-accent-color', accentColor);
	frameEl.style.borderColor = accentColor;

	if (portraitEl) {
		applyCosmeticToPreviewElement(portraitEl, c);
	}
}

/**
 * @param {HTMLElement|null|undefined} previewEl
 * @param {Partial<Cosmetic>|null|undefined} cosmetic
 */
export function applyCosmeticToPreviewElement(previewEl, cosmetic) {
	if (!previewEl) return;
	const c = { ...DEFAULT_COSMETIC, ...(cosmetic && typeof cosmetic === 'object' ? cosmetic : {}) };
	const bodyColor = normalizeHexColor(c.bodyColor, DEFAULT_COSMETIC.bodyColor);
	const accentColor = normalizeHexColor(c.accentColor, DEFAULT_COSMETIC.accentColor);
	const bodyShape = normalizeBodyShape(c.bodyShape);
	const shapeStyle = SHAPE_PREVIEW_STYLES[bodyShape] || SHAPE_PREVIEW_STYLES.box;

	previewEl.setAttribute('data-body-shape', bodyShape);
	previewEl.style.backgroundColor = bodyColor;
	previewEl.style.border = `3px solid ${accentColor}`;
	previewEl.style.borderRadius = shapeStyle.borderRadius;
	previewEl.style.clipPath = shapeStyle.clipPath;
}
