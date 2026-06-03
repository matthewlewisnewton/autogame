// Cosmetic profile defaults and validation.
// Defines the per-account character customization shape and validates
// partial updates coming from the profile PATCH route.

// Allowed body shapes (kept in sync with the client renderer's geometry set).
const BODY_SHAPES = ['box', 'cylinder', 'cone', 'capsule'];

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
	hat: 'none'
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
		hat: HAT_IDS.has(src.hat) ? src.hat : DEFAULT_COSMETIC.hat
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
	HAT_CATALOG,
	HAT_IDS,
	getHat,
	DEFAULT_UNLOCKED_HATS,
	DEFAULT_COSMETIC,
	validateCosmetic,
	backfillCosmetic,
	backfillUnlockedHats
};
