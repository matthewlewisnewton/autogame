// Cosmetic profile defaults and validation.
// Defines the per-account character customization shape and validates
// partial updates coming from the profile PATCH route.

// Allowed body shapes (kept in sync with the client renderer's geometry set).
const BODY_SHAPES = ['box', 'cylinder', 'cone', 'capsule'];

// Allowed model IDs (base mesh variants). Starts with the default player model.
const MODEL_IDS = ['player'];

// Proportion keys and their valid ranges for character body scaling.
const PROPORTION_KEYS = ['height', 'headSize', 'torsoWidth', 'armLength', 'legLength', 'shoulderWidth'];

const PROPORTION_RANGES = {
	height:        { min: 0.8, max: 1.2 },
	headSize:      { min: 0.7, max: 1.3 },
	torsoWidth:    { min: 0.7, max: 1.3 },
	armLength:     { min: 0.8, max: 1.2 },
	legLength:     { min: 0.8, max: 1.2 },
	shoulderWidth: { min: 0.7, max: 1.3 }
};

// Server-side hat catalog. Each hat has a stable `id`, a display `name`, and an
// integer currency `price`. The `none`/`bandana`/`beanie` entries are free
// starter hats every account owns by default; the others are purchasable.
const HAT_CATALOG = [
	{ id: 'none', name: 'No Hat', price: 0 },
	{ id: 'cap', name: 'Adventurer Cap', price: 50 },
	{ id: 'wizard', name: 'Wizard Hat', price: 150 },
	{ id: 'crown', name: 'Golden Crown', price: 500 },
	{ id: 'bandana', name: 'Bandana', price: 0 },
	{ id: 'beanie', name: 'Beanie', price: 0 }
];

// Set of valid hat ids derived from the catalog, for fast membership checks.
const HAT_IDS = new Set(HAT_CATALOG.map((h) => h.id));

/**
 * Look up a catalog hat by id.
 * @param {string} id
 * @returns {{ id: string, name: string, price: number }|undefined}
 */
function getHat(id) {
	return HAT_CATALOG.find((h) => h.id === id);
}

// Default set of hats every account owns. Always includes the bare-head option
// plus the free starter hats.
const DEFAULT_UNLOCKED_HATS = ['none', 'bandana', 'beanie'];

// Default cosmetic applied at account creation and used to backfill legacy
// records that predate the cosmetic field.
const DEFAULT_COSMETIC = {
	bodyColor: '#4f9dde',
	accentColor: '#f2c94c',
	bodyShape: 'box',
	hat: 'none',
	modelId: 'player',
	proportions: Object.fromEntries(PROPORTION_KEYS.map((k) => [k, 1.0]))
};

// Case-insensitive 6-digit hex color (e.g. #1a2B3c).
const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;

/**
 * Validate a partial cosmetic update.
 * Only the provided sub-fields are validated; missing fields are left untouched.
 *
 * @param {object} partial - subset of { bodyColor, accentColor, bodyShape, hat, modelId, proportions }
 * @returns {{ ok: true, value: object } | { ok: false, reason: string }}
 *   On success, `value` contains the validated (normalized) provided fields.
 */
function validateCosmetic(partial) {
	if (partial === null || typeof partial !== 'object' || Array.isArray(partial)) {
		return { ok: false, reason: 'Cosmetic must be an object' };
	}

	const value = {};

	if (partial.bodyColor !== undefined) {
		if (typeof partial.bodyColor !== 'string' || !HEX_COLOR_REGEX.test(partial.bodyColor)) {
			return { ok: false, reason: 'bodyColor must be a #RRGGBB hex color' };
		}
		value.bodyColor = partial.bodyColor;
	}

	if (partial.accentColor !== undefined) {
		if (typeof partial.accentColor !== 'string' || !HEX_COLOR_REGEX.test(partial.accentColor)) {
			return { ok: false, reason: 'accentColor must be a #RRGGBB hex color' };
		}
		value.accentColor = partial.accentColor;
	}

	if (partial.bodyShape !== undefined) {
		if (!BODY_SHAPES.includes(partial.bodyShape)) {
			return { ok: false, reason: `bodyShape must be one of: ${BODY_SHAPES.join(', ')}` };
		}
		value.bodyShape = partial.bodyShape;
	}

	if (partial.hat !== undefined) {
		if (typeof partial.hat !== 'string' || !HAT_IDS.has(partial.hat)) {
			return { ok: false, reason: 'hat must be a known catalog hat id' };
		}
		value.hat = partial.hat;
	}

	if (partial.modelId !== undefined) {
		if (!MODEL_IDS.includes(partial.modelId)) {
			return { ok: false, reason: `modelId must be one of: ${MODEL_IDS.join(', ')}` };
		}
		value.modelId = partial.modelId;
	}

	if (partial.proportions !== undefined) {
		if (!partial.proportions || typeof partial.proportions !== 'object' || Array.isArray(partial.proportions)) {
			return { ok: false, reason: 'proportions must be an object' };
		}
		const validatedProps = {};
		for (const [key, val] of Object.entries(partial.proportions)) {
			if (!PROPORTION_KEYS.includes(key)) {
				return { ok: false, reason: `Unknown proportion key: ${key}` };
			}
			if (typeof val !== 'number' || val !== val) {
				return { ok: false, reason: `proportions.${key} must be a number` };
			}
			const range = PROPORTION_RANGES[key];
			if (val < range.min || val > range.max) {
				return { ok: false, reason: `proportions.${key} must be between ${range.min} and ${range.max}` };
			}
			validatedProps[key] = val;
		}
		if (Object.keys(validatedProps).length > 0) {
			value.proportions = validatedProps;
		}
	}

	return { ok: true, value };
}

/**
 * Fill missing proportion keys with their default value (1.0) and clamp
 * existing values to their valid range. Returns a new object.
 *
 * @param {object|undefined} existing
 * @returns {object}
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
 * Return a complete cosmetic object, filling any missing/invalid fields from
 * DEFAULT_COSMETIC. Used to backfill legacy account records on load.
 *
 * @param {object|undefined} existing
 * @returns {{ bodyColor: string, accentColor: string, bodyShape: string, hat: string, modelId: string, proportions: object }}
 */
function backfillCosmetic(existing) {
	const src = (existing && typeof existing === 'object' && !Array.isArray(existing)) ? existing : {};
	return {
		bodyColor: HEX_COLOR_REGEX.test(src.bodyColor) ? src.bodyColor : DEFAULT_COSMETIC.bodyColor,
		accentColor: HEX_COLOR_REGEX.test(src.accentColor) ? src.accentColor : DEFAULT_COSMETIC.accentColor,
		bodyShape: BODY_SHAPES.includes(src.bodyShape) ? src.bodyShape : DEFAULT_COSMETIC.bodyShape,
		hat: HAT_IDS.has(src.hat) ? src.hat : DEFAULT_COSMETIC.hat,
		modelId: MODEL_IDS.includes(src.modelId) ? src.modelId : DEFAULT_COSMETIC.modelId,
		proportions: backfillProportions(src.proportions)
	};
}

/**
 * Return a deduped array of valid catalog hat ids from an existing unlocked
 * list, always including the full default-owned starter set
 * (DEFAULT_UNLOCKED_HATS). Used to backfill legacy account records and sanitize
 * stored values, retroactively granting newly-added starter hats.
 *
 * @param {string[]|undefined} existing
 * @returns {string[]}
 */
function backfillUnlockedHats(existing) {
	const out = [];
	const seen = new Set();
	const add = (id) => {
		if (HAT_IDS.has(id) && !seen.has(id)) {
			seen.add(id);
			out.push(id);
		}
	};
	for (const id of DEFAULT_UNLOCKED_HATS) add(id);
	if (Array.isArray(existing)) {
		for (const id of existing) add(id);
	}
	return out;
}

module.exports = {
	BODY_SHAPES,
	MODEL_IDS,
	PROPORTION_KEYS,
	PROPORTION_RANGES,
	HAT_CATALOG,
	HAT_IDS,
	getHat,
	DEFAULT_UNLOCKED_HATS,
	DEFAULT_COSMETIC,
	validateCosmetic,
	backfillCosmetic,
	backfillProportions,
	backfillUnlockedHats
};
