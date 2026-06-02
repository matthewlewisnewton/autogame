// Cosmetic profile defaults and validation.
// Defines the per-account character customization shape and validates
// partial updates coming from the profile PATCH route.

// Allowed body shapes (kept in sync with the client renderer's geometry set).
const BODY_SHAPES = ['box', 'cylinder', 'cone', 'capsule'];

/**
 * Registry of available player body models.
 *
 * Each entry describes a selectable body model for the character.
 * - `key`: unique identifier used in account storage and network messages
 * - `displayName`: human-readable label for UI pickers
 * - `glbPath`: relative path under `client/public/models/`, or `null` for
 *   the primitive fallback (box geometry built from Three.js primitives)
 *
 * Adding a new model requires:
 * 1. Placing the GLB file in `game/client/public/models/`
 * 2. Adding an entry here with the correct `glbPath`
 * 3. Updating the client renderer to load the GLB when `glbPath` is set
 *    (client-side work in a follow-up ticket)
 */
const BODY_MODELS = {
	default: {
		key: 'default',
		displayName: 'Default',
		glbPath: null
	},
	player: {
		key: 'player',
		displayName: 'Player',
		glbPath: 'models/player.glb'
	}
};

/**
 * Return an array of valid model keys from the registry.
 *
 * @returns {string[]} e.g. ['default', 'player']
 */
function getAvailableModelKeys() {
	return Object.keys(BODY_MODELS);
}

// Default cosmetic applied at account creation and used to backfill legacy
// records that predate the cosmetic field.
const DEFAULT_COSMETIC = {
	bodyColor: '#4f9dde',
	accentColor: '#f2c94c',
	bodyShape: 'box'
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
		bodyShape: BODY_SHAPES.includes(src.bodyShape) ? src.bodyShape : DEFAULT_COSMETIC.bodyShape
	};
}

module.exports = {
	BODY_SHAPES,
	BODY_MODELS,
	getAvailableModelKeys,
	DEFAULT_COSMETIC,
	validateCosmetic,
	backfillCosmetic
};
