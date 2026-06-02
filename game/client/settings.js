// Per-account settings — load from server, debounced PATCH, apply to subsystems.

import { setSoundEnabledFromSettings } from './audio.js';

const SOUND_ENABLED_KEY = 'autogame:soundEnabled';
const PATCH_DEBOUNCE_MS = 300;

const DEFAULT_COSMETIC = {
	bodyColor: '#4f9dde',
	accentColor: '#f2c94c',
	bodyShape: 'box'
};
const BODY_SHAPES = ['box', 'cylinder', 'cone', 'capsule'];
const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;

/** @typedef {{ soundEnabled: boolean, particlesEnabled: boolean, showHitboxes: boolean, lockOnRepeatAction: 'unlock' | 'cycle' | 'reacquire', keyboard: { bindings: Record<string, string> }, gamepad: { bindings: object, moveStick: string, deadzone: number, profile?: string, modifierButton?: number } }} AccountSettings */

/** @type {AccountSettings} */
let cachedSettings = getDefaultSettings();
let cachedProfile = { username: '', email: null };
/** @type {{ bodyColor: string, accentColor: string, bodyShape: string }} */
let cachedCosmetic = { ...DEFAULT_COSMETIC };
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

export function getCosmetic() {
	return { ...cachedCosmetic };
}

function backfillCosmetic(existing) {
	const src = (existing && typeof existing === 'object' && !Array.isArray(existing)) ? existing : {};
	return {
		bodyColor: HEX_COLOR_REGEX.test(src.bodyColor) ? src.bodyColor : DEFAULT_COSMETIC.bodyColor,
		accentColor: HEX_COLOR_REGEX.test(src.accentColor) ? src.accentColor : DEFAULT_COSMETIC.accentColor,
		bodyShape: BODY_SHAPES.includes(src.bodyShape) ? src.bodyShape : DEFAULT_COSMETIC.bodyShape
	};
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
	cachedCosmetic = backfillCosmetic(data.cosmetic);
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
 * Update profile (username / email / cosmetic).
 * @param {{ username?: string, email?: string|null, cosmetic?: { bodyColor?: string, accentColor?: string, bodyShape?: string } }} fields
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
		cachedCosmetic = backfillCosmetic(data.cosmetic);
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
