// Cosmetic profile defaults and validation.
// Defines the per-account character customization shape and validates
// partial updates coming from the profile PATCH route.

// Allowed body shapes (kept in sync with the client renderer's geometry set).
const BODY_SHAPES = ['box', 'cylinder', 'cone', 'capsule'];

// Allowed model identifiers (glTF base meshes). Extended when new character
// models are added; 'player' is the initial procedural fallback.
const MODEL_IDS = ['player'];

// Canonical proportion keys applied to a character model at render time.
const PROPORTION_KEYS = ['height', 'headSize', 'torsoWidth', 'armLength', 'legLength', 'shoulderWidth'];

// Per-key numeric bounds for proportion values (relative multipliers).
const PROPORTION_RANGES = {
	height:        { min: 0.8, max: 1.2 },
	headSize:      { min: 0.7, max: 1.3 },
	torsoWidth:    { min: 0.7, max: 1.3 },
	armLength:     { min: 0.8, max: 1.2 },
	legLength:     { min: 0.8, max: 1.2 },
	shoulderWidth: { min: 0.7, max: 1.3 }
};

// Server-side hat catalog. Each hat has a stable `id`, a display `name`, and an
// integer currency `price`. The `none` entry is the default bare-head option and
// is always free/owned; the others are purchasable via sub-ticket 02.
const HAT_CATALOG = [
	{ id: 'none', name: 'No Hat', price: 0 },
	{ id: 'cap', name: 'Adventurer Cap', price: 50 },
	{ id: 'wizard', name: 'Wizard Hat', price: 150 },
	{ id: 'crown', name: 'Golden Crown', price: 500 }
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

// Default set of hats every account owns. Always includes the bare-head option.
const DEFAULT_UNLOCKED_HATS = ['none'];

// Default cosmetic applied at account creation and used to backfill legacy
// records that predate the cosmetic field.
const DEFAULT_COSMETIC = {
	bodyColor: '#4f9dde',
	accentColor: '#f2c94c',
	bodyShape: 'box',
	hat: 'none',
	modelId: 'player',
	proportions: {
		height: 1.0,
		headSize: 1.0,
		torsoWidth: 1.0,
		armLength: 1.0,
		legLength: 1.0,
		shoulderWidth: 1.0
	}
};

// Case-insensitive 6-digit hex color (e.g. #1a2B3c).
const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;

/**
 * Validate a partial cosmetic update.
 * Only the provided sub-fields are validated; missing fields are left untouched.
 *
 * @param {object} partial - subset of { bodyColor, accentColor, bodyShape }
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

	return { ok: true, value };
}

/**
 * Return a complete cosmetic object, filling any missing/invalid fields from
 * DEFAULT_COSMETIC. Used to backfill legacy account records on load.
 *
 * @param {object|undefined} existing
 * @returns {{ bodyColor: string, accentColor: string, bodyShape: string }}
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
 * Backfill proportion values, falling back to 1.0 for any missing key.
 *
 * @param {object|undefined} existing
 * @returns {object}
 */
function backfillProportions(existing) {
	const result = {};
	for (const key of PROPORTION_KEYS) {
		const val = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing[key] : undefined;
		result[key] = (typeof val === 'number') ? val : DEFAULT_COSMETIC.proportions[key];
	}
	return result;
}

/**
 * Return a deduped array of valid catalog hat ids from an existing unlocked
 * list, always including 'none'. Used to backfill legacy account records and
 * sanitize stored values.
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
	add('none');
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
	backfillUnlockedHats
};
