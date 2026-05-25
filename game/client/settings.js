// Per-account settings — load from server, debounced PATCH, apply to subsystems.

import { setSoundEnabledFromSettings } from './audio.js';

const SOUND_ENABLED_KEY = 'autogame:soundEnabled';
const PATCH_DEBOUNCE_MS = 300;

/** @typedef {{ soundEnabled: boolean, particlesEnabled: boolean, showHitboxes: boolean, lockOnRepeatAction: 'unlock' | 'cycle' | 'reacquire', gamepad: { bindings: object, moveStick: string, deadzone: number } }} AccountSettings */

/** @type {AccountSettings} */
let cachedSettings = getDefaultSettings();
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
		gamepad: {
			bindings: {},
			moveStick: 'left',
			deadzone: 0.15
		}
	};
}

export function getSettings() {
	return cachedSettings;
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

/** @returns {'unlock' | 'cycle' | 'reacquire'} */
export function getLockOnRepeatAction() {
	const action = cachedSettings.lockOnRepeatAction;
	if (action === 'cycle' || action === 'reacquire') return action;
	return 'unlock';
}
