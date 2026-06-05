// Canonical implementation of cosmetic appearance diff helpers (single source of truth).
// The CJS bridge (cosmeticAppearance.js) loads this file at require time via
// `fs.readFileSync` + `new Function` — do not duplicate logic there.

/** Appearance fields that incur a paid booth change; hat swaps are excluded. */
export const APPEARANCE_FIELD_KEYS = ['bodyColor', 'accentColor', 'bodyShape', 'modelId', 'proportions'];

const PROPORTION_KEYS = ['height', 'headSize', 'torsoWidth', 'armLength', 'legLength', 'shoulderWidth'];

const PROPORTION_RANGES = {
	height:        { min: 0.8, max: 1.2 },
	headSize:      { min: 0.7, max: 1.3 },
	torsoWidth:    { min: 0.7, max: 1.3 },
	armLength:     { min: 0.8, max: 1.2 },
	legLength:     { min: 0.8, max: 1.2 },
	shoulderWidth: { min: 0.7, max: 1.3 },
};

// Mirrors game/server/cosmetic.js DEFAULT_COSMETIC appearance fields.
const DEFAULT_APPEARANCE = {
	bodyColor: '#4f9dde',
	accentColor: '#f2c94c',
	bodyShape: 'box',
	modelId: 'player',
	proportions: Object.fromEntries(PROPORTION_KEYS.map((k) => [k, 1.0])),
};

const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;

/**
 * Fill missing proportion keys with 1.0 and clamp valid numbers to their range.
 * @param {unknown} existing
 * @returns {Record<string, number>}
 */
function backfillProportions(existing) {
	const out = {};
	for (const key of PROPORTION_KEYS) {
		const range = PROPORTION_RANGES[key];
		if (existing && typeof existing === 'object' && !Array.isArray(existing) && typeof existing[key] === 'number') {
			out[key] = Math.max(range.min, Math.min(range.max, existing[key]));
		} else {
			out[key] = 1.0;
		}
	}
	return out;
}

/**
 * Normalize appearance-relevant cosmetic fields with backfill-style defaults.
 * Hat is intentionally excluded — only paid appearance fields are compared.
 * @param {unknown} cosmetic
 * @returns {{ bodyColor: string, accentColor: string, bodyShape: string, modelId: string, proportions: Record<string, number> }}
 */
function normalizeAppearanceFields(cosmetic) {
	const src = (cosmetic && typeof cosmetic === 'object' && !Array.isArray(cosmetic)) ? cosmetic : {};
	return {
		bodyColor: HEX_COLOR_REGEX.test(src.bodyColor) ? src.bodyColor : DEFAULT_APPEARANCE.bodyColor,
		accentColor: HEX_COLOR_REGEX.test(src.accentColor) ? src.accentColor : DEFAULT_APPEARANCE.accentColor,
		bodyShape: typeof src.bodyShape === 'string' ? src.bodyShape : DEFAULT_APPEARANCE.bodyShape,
		modelId: typeof src.modelId === 'string' ? src.modelId : DEFAULT_APPEARANCE.modelId,
		proportions: backfillProportions(src.proportions),
	};
}

/**
 * Return true when any paid appearance field differs between baseline and proposed.
 * Hat-only (or no) changes return false. Proportions are compared key-wise after
 * backfilling missing keys to defaults.
 *
 * @param {object|undefined|null} baseline
 * @param {object|undefined|null} proposed
 * @returns {boolean}
 */
export function hasAppearanceFieldChanges(baseline, proposed) {
	const base = normalizeAppearanceFields(baseline);
	const next = normalizeAppearanceFields(proposed);

	for (const key of APPEARANCE_FIELD_KEYS) {
		if (key === 'proportions') {
			for (const propKey of PROPORTION_KEYS) {
				if (base.proportions[propKey] !== next.proportions[propKey]) {
					return true;
				}
			}
		} else if (base[key] !== next[key]) {
			return true;
		}
	}
	return false;
}
