// Per-account settings — load from server, debounced PATCH, apply to subsystems.

import { APPEARANCE_CHANGE_COST } from './config.js';
import { setSoundEnabledFromSettings } from './audio.js';

const SOUND_ENABLED_KEY = 'autogame:soundEnabled';
const PATCH_DEBOUNCE_MS = 300;

// Body-proportion keys and their valid ranges. Mirrors `PROPORTION_RANGES` in
// game/server/cosmetic.js (six keys + min/max, default 1.0). Used to build the
// customization sliders and to clamp/backfill cosmetic proportions client-side.
export const PROPORTION_RANGES = {
	height:        { min: 0.8, max: 1.2 },
	headSize:      { min: 0.7, max: 1.3 },
	torsoWidth:    { min: 0.7, max: 1.3 },
	armLength:     { min: 0.8, max: 1.2 },
	legLength:     { min: 0.8, max: 1.2 },
	shoulderWidth: { min: 0.7, max: 1.3 },
};

const PROPORTION_KEYS = Object.keys(PROPORTION_RANGES);

/** Default proportion map: every key at its neutral value of 1.0. */
function defaultProportions() {
	const out = {};
	for (const key of PROPORTION_KEYS) out[key] = 1.0;
	return out;
}

// Mirrors the server `DEFAULT_COSMETIC` (game/server/cosmetic.js) for the
// customization-relevant fields. Used as the fallback when an account has no
// cosmetic yet (or the field is missing/legacy).
const DEFAULT_COSMETIC = {
	bodyColor: '#4f9dde',
	accentColor: '#f2c94c',
	bodyShape: 'box',
	hat: 'none',
	proportions: defaultProportions(),
};

/** @typedef {{ soundEnabled: boolean, particlesEnabled: boolean, showHitboxes: boolean, lockOnRepeatAction: 'unlock' | 'cycle' | 'reacquire', keyboard: { bindings: Record<string, string> }, gamepad: { bindings: object, moveStick: string, deadzone: number, profile?: string, modifierButton?: number } }} AccountSettings */

/** @type {AccountSettings} */
let cachedSettings = getDefaultSettings();
let cachedProfile = { username: '', email: null };
/** @typedef {{ bodyColor: string, accentColor: string, bodyShape: string, hat: string, proportions: Record<string, number> }} Cosmetic */
/** @type {Cosmetic} */
let cachedCosmetic = { ...DEFAULT_COSMETIC, proportions: defaultProportions() };
/** @type {string[]} Hat ids the logged-in account has unlocked (always includes 'none'). */
let cachedUnlockedHats = ['none'];
/** @type {{ id: string, name: string, price: number }[]} Server hat catalog. */
let cachedHatCatalog = [];
/** @type {number} Gold cost for in-hub booth appearance edits (from GET /api/me). */
let cachedAppearanceChangeCost = APPEARANCE_CHANGE_COST;
let authToken = null;
let patchTimer = null;
/** @type {Set<(s: AccountSettings) => void>} */
const listeners = new Set();

export function getDefaultSettings() {
	return {
		soundEnabled: true,
		particlesEnabled: true,
		showHitboxes: true,
		lockOnRepeatAction: 'unlock',
		keyboard: {
			bindings: {
				useKeyItem: 'e',
			},
		},
		gamepad: {
			bindings: {},
			moveStick: 'left',
			deadzone: 0.15,
			profile: 'auto',
			/** R trigger (RT) — secondary hand palette modifier; see HAND_MODIFIER_GAMEPAD_BUTTON */
			modifierButton: 7,
		}
	};
}

export function getSettings() {
	return cachedSettings;
}

export function getAccountProfile() {
	return cachedProfile;
}

/**
 * Current cached cosmetic for the logged-in account, with any missing fields
 * filled from the defaults that mirror the server `DEFAULT_COSMETIC`.
 * @returns {Cosmetic}
 */
export function getAccountCosmetic() {
	return normalizeCosmetic(cachedCosmetic);
}

/**
 * Replace the cached account cosmetic (e.g. after a charged booth save).
 * @param {object} cosmetic
 */
export function setAccountCosmetic(cosmetic) {
	cachedCosmetic = normalizeCosmetic(cosmetic);
}

/**
 * Gold cost for changing appearance fields at the in-hub character booth.
 * @returns {number}
 */
export function getAppearanceChangeCost() {
	return cachedAppearanceChangeCost;
}

/**
 * Coerce/backfill a proportions map: every key numeric and clamped to its
 * range; missing or invalid values default to 1.0. Returns a new object with
 * exactly the six known keys.
 * @param {unknown} value
 * @returns {Record<string, number>}
 */
function normalizeProportions(value) {
	const src = (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
	const out = {};
	for (const key of PROPORTION_KEYS) {
		const range = PROPORTION_RANGES[key];
		const raw = src[key];
		out[key] = (typeof raw === 'number' && Number.isFinite(raw))
			? Math.max(range.min, Math.min(range.max, raw))
			: 1.0;
	}
	return out;
}

/**
 * Merge a (possibly partial/legacy) cosmetic onto the defaults.
 * @param {object|undefined|null} cosmetic
 * @returns {Cosmetic}
 */
function normalizeCosmetic(cosmetic) {
	const src = (cosmetic && typeof cosmetic === 'object') ? cosmetic : {};
	return {
		bodyColor: typeof src.bodyColor === 'string' ? src.bodyColor : DEFAULT_COSMETIC.bodyColor,
		accentColor: typeof src.accentColor === 'string' ? src.accentColor : DEFAULT_COSMETIC.accentColor,
		bodyShape: typeof src.bodyShape === 'string' ? src.bodyShape : DEFAULT_COSMETIC.bodyShape,
		hat: typeof src.hat === 'string' ? src.hat : DEFAULT_COSMETIC.hat,
		proportions: normalizeProportions(src.proportions),
	};
}

/**
 * Coerce a server `unlockedHats` payload into a string array that always
 * includes `'none'`, dropping non-string entries.
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeUnlockedHats(value) {
	const ids = Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
	if (!ids.includes('none')) ids.unshift('none');
	return ids;
}

/**
 * Coerce a server `hatCatalog` payload into an array of catalog entries,
 * keeping only objects with a string `id`. Falls back to an empty array.
 * @param {unknown} value
 * @returns {{ id: string, name: string, price: number }[]}
 */
function normalizeHatCatalog(value) {
	if (!Array.isArray(value)) return [];
	return value
		.filter((h) => h && typeof h === 'object' && typeof h.id === 'string')
		.map((h) => ({
			id: h.id,
			name: typeof h.name === 'string' ? h.name : h.id,
			price: Number.isFinite(h.price) ? h.price : 0,
		}));
}

/**
 * Hat ids the logged-in account has unlocked. Always an array and always
 * includes `'none'` (the free bare-head option).
 * @returns {string[]}
 */
export function getUnlockedHats() {
	return Array.isArray(cachedUnlockedHats) ? cachedUnlockedHats : ['none'];
}

/**
 * Replace the cached unlocked-hat set (e.g. after the server reports a new
 * unlock). Coerced to always include `'none'`.
 * @param {unknown} hats
 */
export function setUnlockedHats(hats) {
	cachedUnlockedHats = normalizeUnlockedHats(hats);
}

/**
 * The server hat catalog cached on load. Falls back to an empty array when the
 * server did not supply one.
 * @returns {{ id: string, name: string, price: number }[]}
 */
export function getHatCatalog() {
	return Array.isArray(cachedHatCatalog) ? cachedHatCatalog : [];
}

export function getAuthToken() {
	return authToken;
}

export function onSettingsChange(fn) {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

function notifyListeners() {
	for (const fn of listeners) {
		try { fn(cachedSettings); } catch (_) {}
	}
}

function deepMerge(target, source) {
	if (!source || typeof source !== 'object') return target;
	const out = { ...target };
	for (const key of Object.keys(source)) {
		const val = source[key];
		if (val !== null && typeof val === 'object' && !Array.isArray(val)
			&& typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])) {
			out[key] = deepMerge(target[key], val);
		} else if (val !== undefined) {
			out[key] = val;
		}
	}
	return out;
}

/**
 * Apply current settings to audio, renderer, and input consumers.
 */
export function applySettings() {
	setSoundEnabledFromSettings(cachedSettings.soundEnabled);
	notifyListeners();
}

/**
 * Load profile + settings from GET /api/me.
 * @param {string} token
 * @returns {Promise<{ accountId: string, username: string, email: string|null, settings: AccountSettings }>}
 */
export async function loadAccountSettings(token) {
	authToken = token;
	const res = await fetch('/api/me', {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!res.ok) {
		throw new Error('Failed to load account settings');
	}
	const data = await res.json();
	cachedProfile = {
		username: data.username || '',
		email: data.email || null,
	};
	cachedCosmetic = normalizeCosmetic(data.cosmetic);
	cachedUnlockedHats = normalizeUnlockedHats(data.unlockedHats);
	cachedHatCatalog = normalizeHatCatalog(data.hatCatalog);
	if (Number.isFinite(data.appearanceChangeCost) && data.appearanceChangeCost > 0) {
		cachedAppearanceChangeCost = data.appearanceChangeCost;
	}
	cachedSettings = deepMerge(getDefaultSettings(), data.settings || {});
	await migrateLocalStorageMute();
	applySettings();
	return data;
}

async function migrateLocalStorageMute() {
	try {
		const val = localStorage.getItem(SOUND_ENABLED_KEY);
		if (val === null) return;
		const soundEnabled = val === 'true';
		localStorage.removeItem(SOUND_ENABLED_KEY);
		cachedSettings = { ...cachedSettings, soundEnabled };
		await patchSettingsImmediate({ soundEnabled });
		applySettings();
	} catch (_) {}
}

/**
 * Merge partial settings locally and debounce server PATCH.
 * @param {Partial<AccountSettings>} partial
 */
export function patchSettings(partial) {
	cachedSettings = deepMerge(cachedSettings, partial);
	applySettings();
	if (!authToken) return;
	if (patchTimer) clearTimeout(patchTimer);
	patchTimer = setTimeout(() => {
		patchSettingsImmediate(partial).catch(() => {});
	}, PATCH_DEBOUNCE_MS);
}

/**
 * PATCH settings immediately (no debounce).
 * @param {Partial<AccountSettings>} partial
 */
export async function patchSettingsImmediate(partial) {
	if (!authToken) return;
	const res = await fetch('/api/me/settings', {
		method: 'PATCH',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${authToken}`
		},
		body: JSON.stringify(partial)
	});
	if (res.ok) {
		const data = await res.json();
		if (data.settings) {
			cachedSettings = deepMerge(getDefaultSettings(), data.settings);
			applySettings();
		}
	}
}

/**
 * Update profile (username / email).
 * @param {{ username?: string, email?: string|null }} fields
 * @returns {Promise<{ token?: string, username: string, email: string|null, error?: string }>}
 */
export async function patchProfile(fields) {
	if (!authToken) return { error: 'Not logged in' };
	const res = await fetch('/api/me/profile', {
		method: 'PATCH',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${authToken}`
		},
		body: JSON.stringify(fields)
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		return { error: data.error || 'Profile update failed' };
	}
	if (data.token) {
		authToken = data.token;
		try { localStorage.setItem('autogame_token', data.token); } catch (_) {}
	}
	cachedProfile = {
		username: data.username || cachedProfile.username,
		email: data.email ?? cachedProfile.email,
	};
	if (data.cosmetic) {
		cachedCosmetic = normalizeCosmetic(data.cosmetic);
	}
	return data;
}

export function setAuthToken(token) {
	authToken = token;
}

export function areParticlesEnabled() {
	return cachedSettings.particlesEnabled !== false;
}

export function areHitboxesVisible() {
	return cachedSettings.showHitboxes !== false;
}

export function getGamepadConfig() {
	return cachedSettings.gamepad || getDefaultSettings().gamepad;
}

export function getGamepadProfileSetting() {
	const profile = cachedSettings.gamepad?.profile;
	if (profile === 'standard' || profile === '8bitdo-64') return profile;
	return 'auto';
}

/** @returns {'unlock' | 'cycle' | 'reacquire'} */
export function getLockOnRepeatAction() {
	const action = cachedSettings.lockOnRepeatAction;
	if (action === 'cycle' || action === 'reacquire') return action;
	return 'unlock';
}

/** @returns {Record<string, string>} Keyboard action→key bindings */
export function getKeyboardBindings() {
	return cachedSettings.keyboard?.bindings || {};
}
