// Per-account settings persistence — one JSON file per accountId.

const fs = require('fs');
const path = require('path');

let settingsBasePath = null;
let _settingsProvider = null;

// Schema constants — kept in sync with game/client/settings.js and input bindings.
const SETTINGS_TOP_LEVEL_KEYS = [
	'soundEnabled',
	'particlesEnabled',
	'showHitboxes',
	'lockOnRepeatAction',
	'keyboard',
	'gamepad',
];

const LOCK_ON_REPEAT_ACTIONS = ['unlock', 'cycle', 'reacquire'];

// Remappable keyboard actions (subset of ACTIONS in game/client/input.js).
const KEYBOARD_BINDING_ACTIONS = ['useKeyItem'];

// Remappable gamepad actions (DEFAULT_GAMEPAD_BUTTONS keys in game/client/input.js).
const GAMEPAD_BINDING_ACTIONS = [
	'useSlot0',
	'useSlot1',
	'useSlot2',
	'useSlot3',
	'useSlot4',
	'useSlot5',
	'toggleDeckViewer',
	'useKeyItem',
];

const GAMEPAD_PROFILES = ['auto', 'standard', '8bitdo-64'];
const MOVE_STICK_VALUES = ['left', 'right'];
const DEADZONE_MIN = 0;
const DEADZONE_MAX = 0.95;
const C_BUTTON_DIRECTIONS = ['up', 'down', 'left', 'right'];
const AXIS_DIRECTIONS = ['positive', 'negative'];
const KEYBOARD_KEY_REGEX = /^[a-z]$/;

// Safe accountId shape (server-issued UUIDs and simple keys). Last-line guard
// against path traversal if a forged/leaked token carries "../../etc/foo".
const SAFE_ACCOUNT_ID_REGEX = /^[A-Za-z0-9_-]+$/;

/** Maximum UTF-8 byte length of persisted settings JSON (pretty-printed). */
const SETTINGS_MAX_BYTES = 8192;

/** Test-only override for SETTINGS_MAX_BYTES (null = use default). */
let settingsMaxBytesOverride = null;

function getSettingsMaxBytes() {
	return settingsMaxBytesOverride ?? SETTINGS_MAX_BYTES;
}

function serializedSettingsByteLength(settings) {
	return Buffer.byteLength(JSON.stringify(settings, null, 2), 'utf-8');
}

function isPlainObject(val) {
	return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function isValidDeadzone(value) {
	return typeof value === 'number' && value === value
		&& value >= DEADZONE_MIN && value <= DEADZONE_MAX;
}

function backfillDeadzone(value, defaultValue) {
	if (typeof value !== 'number' || value !== value) return defaultValue;
	if (value < DEADZONE_MIN) return defaultValue;
	if (value > DEADZONE_MAX) {
		// Slightly high values coerce into range; absurd values are dropped.
		if (value <= 1) return DEADZONE_MAX;
		return defaultValue;
	}
	return value;
}

/**
 * Validate a single gamepad binding object (button / axis / cButton).
 * @param {unknown} binding
 * @returns {{ ok: true, value: object } | { ok: false, reason: string }}
 */
function validateGamepadBinding(binding) {
	if (!isPlainObject(binding) || typeof binding.type !== 'string') {
		return { ok: false, reason: 'gamepad binding must be an object with a type field' };
	}

	if (binding.modifier !== undefined && typeof binding.modifier !== 'boolean') {
		return { ok: false, reason: 'gamepad binding modifier must be a boolean' };
	}

	if (binding.type === 'button') {
		if (!Number.isInteger(binding.index) || binding.index < 0) {
			return { ok: false, reason: 'button binding index must be a non-negative integer' };
		}
		const value = { type: 'button', index: binding.index };
		if (binding.modifier !== undefined) value.modifier = binding.modifier;
		return { ok: true, value };
	}

	if (binding.type === 'axis') {
		const axis = binding.axis;
		const axisValid = axis === 'cX' || axis === 'cY' || (Number.isInteger(axis) && axis >= 0);
		if (!axisValid) {
			return { ok: false, reason: 'axis binding axis must be cX, cY, or a non-negative integer' };
		}
		if (!AXIS_DIRECTIONS.includes(binding.direction)) {
			return { ok: false, reason: `axis binding direction must be one of: ${AXIS_DIRECTIONS.join(', ')}` };
		}
		if (binding.threshold !== undefined) {
			if (typeof binding.threshold !== 'number' || binding.threshold !== binding.threshold) {
				return { ok: false, reason: 'axis binding threshold must be a number' };
			}
			if (binding.threshold < 0 || binding.threshold > 1) {
				return { ok: false, reason: 'axis binding threshold must be between 0 and 1' };
			}
		}
		const value = { type: 'axis', axis, direction: binding.direction };
		if (binding.threshold !== undefined) value.threshold = binding.threshold;
		if (binding.modifier !== undefined) value.modifier = binding.modifier;
		return { ok: true, value };
	}

	if (binding.type === 'cButton') {
		if (!C_BUTTON_DIRECTIONS.includes(binding.direction)) {
			return { ok: false, reason: `cButton binding direction must be one of: ${C_BUTTON_DIRECTIONS.join(', ')}` };
		}
		if (binding.threshold !== undefined) {
			if (typeof binding.threshold !== 'number' || binding.threshold !== binding.threshold) {
				return { ok: false, reason: 'cButton binding threshold must be a number' };
			}
			if (binding.threshold < 0 || binding.threshold > 1) {
				return { ok: false, reason: 'cButton binding threshold must be between 0 and 1' };
			}
		}
		const value = { type: 'cButton', direction: binding.direction };
		if (binding.threshold !== undefined) value.threshold = binding.threshold;
		if (binding.modifier !== undefined) value.modifier = binding.modifier;
		return { ok: true, value };
	}

	return { ok: false, reason: `gamepad binding type must be button, axis, or cButton` };
}

/**
 * Validate a partial settings update.
 * Unknown top-level keys in the partial are ignored; unknown nested keys are rejected.
 *
 * @param {object} partial
 * @returns {{ ok: true, value: object } | { ok: false, reason: string }}
 */
function validateSettings(partial) {
	if (partial === null || typeof partial !== 'object' || Array.isArray(partial)) {
		return { ok: false, reason: 'Settings must be an object' };
	}

	const value = {};

	if (partial.soundEnabled !== undefined) {
		if (typeof partial.soundEnabled !== 'boolean') {
			return { ok: false, reason: 'soundEnabled must be a boolean' };
		}
		value.soundEnabled = partial.soundEnabled;
	}

	if (partial.particlesEnabled !== undefined) {
		if (typeof partial.particlesEnabled !== 'boolean') {
			return { ok: false, reason: 'particlesEnabled must be a boolean' };
		}
		value.particlesEnabled = partial.particlesEnabled;
	}

	if (partial.showHitboxes !== undefined) {
		if (typeof partial.showHitboxes !== 'boolean') {
			return { ok: false, reason: 'showHitboxes must be a boolean' };
		}
		value.showHitboxes = partial.showHitboxes;
	}

	if (partial.lockOnRepeatAction !== undefined) {
		if (!LOCK_ON_REPEAT_ACTIONS.includes(partial.lockOnRepeatAction)) {
			return { ok: false, reason: `lockOnRepeatAction must be one of: ${LOCK_ON_REPEAT_ACTIONS.join(', ')}` };
		}
		value.lockOnRepeatAction = partial.lockOnRepeatAction;
	}

	if (partial.keyboard !== undefined) {
		if (!isPlainObject(partial.keyboard)) {
			return { ok: false, reason: 'keyboard must be an object' };
		}
		const keyboard = {};
		if (partial.keyboard.bindings !== undefined) {
			if (!isPlainObject(partial.keyboard.bindings)) {
				return { ok: false, reason: 'keyboard.bindings must be an object' };
			}
			const bindings = {};
			for (const [action, key] of Object.entries(partial.keyboard.bindings)) {
				if (!KEYBOARD_BINDING_ACTIONS.includes(action)) {
					return { ok: false, reason: `Unknown keyboard binding action: ${action}` };
				}
				if (typeof key !== 'string' || !KEYBOARD_KEY_REGEX.test(key)) {
					return { ok: false, reason: `keyboard.bindings.${action} must be a single lowercase key` };
				}
				bindings[action] = key;
			}
			if (Object.keys(bindings).length > 0) {
				keyboard.bindings = bindings;
			} else {
				keyboard.bindings = {};
			}
		}
		if (Object.keys(keyboard).length > 0) {
			value.keyboard = keyboard;
		}
	}

	if (partial.gamepad !== undefined) {
		if (!isPlainObject(partial.gamepad)) {
			return { ok: false, reason: 'gamepad must be an object' };
		}
		const gamepad = {};
		if (partial.gamepad.bindings !== undefined) {
			if (!isPlainObject(partial.gamepad.bindings)) {
				return { ok: false, reason: 'gamepad.bindings must be an object' };
			}
			const bindings = {};
			for (const [action, binding] of Object.entries(partial.gamepad.bindings)) {
				if (!GAMEPAD_BINDING_ACTIONS.includes(action)) {
					return { ok: false, reason: `Unknown gamepad binding action: ${action}` };
				}
				const result = validateGamepadBinding(binding);
				if (!result.ok) return result;
				bindings[action] = result.value;
			}
			gamepad.bindings = bindings;
		}
		if (partial.gamepad.moveStick !== undefined) {
			if (!MOVE_STICK_VALUES.includes(partial.gamepad.moveStick)) {
				return { ok: false, reason: `gamepad.moveStick must be one of: ${MOVE_STICK_VALUES.join(', ')}` };
			}
			gamepad.moveStick = partial.gamepad.moveStick;
		}
		if (partial.gamepad.deadzone !== undefined) {
			if (!isValidDeadzone(partial.gamepad.deadzone)) {
				return { ok: false, reason: `gamepad.deadzone must be a number between ${DEADZONE_MIN} and ${DEADZONE_MAX}` };
			}
			gamepad.deadzone = partial.gamepad.deadzone;
		}
		if (partial.gamepad.profile !== undefined) {
			if (!GAMEPAD_PROFILES.includes(partial.gamepad.profile)) {
				return { ok: false, reason: `gamepad.profile must be one of: ${GAMEPAD_PROFILES.join(', ')}` };
			}
			gamepad.profile = partial.gamepad.profile;
		}
		if (partial.gamepad.modifierButton !== undefined) {
			if (!Number.isInteger(partial.gamepad.modifierButton) || partial.gamepad.modifierButton < 0) {
				return { ok: false, reason: 'gamepad.modifierButton must be a non-negative integer' };
			}
			gamepad.modifierButton = partial.gamepad.modifierButton;
		}
		if (Object.keys(gamepad).length > 0) {
			value.gamepad = gamepad;
		}
	}

	return { ok: true, value };
}

function backfillKeyboardBindings(existing) {
	const defaults = getDefaultSettings().keyboard.bindings;
	const src = isPlainObject(existing) ? existing : {};
	const out = {};
	for (const action of KEYBOARD_BINDING_ACTIONS) {
		const key = src[action];
		if (typeof key === 'string' && KEYBOARD_KEY_REGEX.test(key)) {
			out[action] = key;
		} else if (defaults[action] !== undefined) {
			out[action] = defaults[action];
		}
	}
	return out;
}

function backfillGamepadBindings(existing) {
	const src = isPlainObject(existing) ? existing : {};
	const out = {};
	for (const [action, binding] of Object.entries(src)) {
		if (!GAMEPAD_BINDING_ACTIONS.includes(action)) continue;
		const result = validateGamepadBinding(binding);
		if (result.ok) out[action] = result.value;
	}
	return out;
}

function backfillGamepad(existing, defaults) {
	const src = isPlainObject(existing) ? existing : {};
	const gamepad = {
		bindings: backfillGamepadBindings(src.bindings),
		moveStick: MOVE_STICK_VALUES.includes(src.moveStick) ? src.moveStick : defaults.moveStick,
		deadzone: backfillDeadzone(src.deadzone, defaults.deadzone),
		profile: GAMEPAD_PROFILES.includes(src.profile) ? src.profile : defaults.profile,
	};
	if (Number.isInteger(src.modifierButton) && src.modifierButton >= 0) {
		gamepad.modifierButton = src.modifierButton;
	}
	return gamepad;
}

/**
 * Return a complete settings object with only whitelisted keys, filling defaults
 * and dropping unknown or invalid stored fields.
 *
 * @param {object|undefined} existing
 * @returns {object}
 */
function backfillSettings(existing) {
	const defaults = getDefaultSettings();
	const src = isPlainObject(existing) ? existing : {};
	return {
		soundEnabled: typeof src.soundEnabled === 'boolean' ? src.soundEnabled : defaults.soundEnabled,
		particlesEnabled: typeof src.particlesEnabled === 'boolean' ? src.particlesEnabled : defaults.particlesEnabled,
		showHitboxes: typeof src.showHitboxes === 'boolean' ? src.showHitboxes : defaults.showHitboxes,
		lockOnRepeatAction: LOCK_ON_REPEAT_ACTIONS.includes(src.lockOnRepeatAction)
			? src.lockOnRepeatAction
			: defaults.lockOnRepeatAction,
		keyboard: {
			bindings: backfillKeyboardBindings(src.keyboard?.bindings),
		},
		gamepad: backfillGamepad(src.gamepad, defaults.gamepad),
	};
}

/**
 * Default settings for new accounts.
 * graphicsQuality intentionally omitted until multi-tier rendering exists.
 */
function getDefaultSettings() {
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
		}
	};
}

function deepMerge(target, source) {
	if (!source || typeof source !== 'object') return target;
	const out = { ...target };
	for (const key of Object.keys(source)) {
		const val = source[key];
		if (val !== null && typeof val === 'object' && !Array.isArray(val) && typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])) {
			out[key] = deepMerge(target[key], val);
		} else if (val !== undefined) {
			out[key] = val;
		}
	}
	return out;
}

function mergeWithDefaults(stored) {
	return backfillSettings(stored);
}

function getSettingsDir() {
	if (!settingsBasePath) {
		const dataPath = process.env.PERSISTENCE_PATH || path.resolve(__dirname, '..', 'data');
		settingsBasePath = path.join(dataPath, 'settings');
	}
	return settingsBasePath;
}

function settingsFilePath(accountId) {
	if (typeof accountId !== 'string' || !SAFE_ACCOUNT_ID_REGEX.test(accountId)) {
		throw new Error(`Invalid account id: ${JSON.stringify(accountId)}`);
	}
	return path.join(getSettingsDir(), `${accountId}.json`);
}

/**
 * Configure the settings storage directory (call from server startup / tests).
 * Switches back to file-based mode, clearing any previously set provider.
 * @param {string} basePath - directory containing settings JSON files
 */
function initSettingsPath(basePath) {
	_settingsProvider = null;
	settingsBasePath = path.join(basePath, 'settings');
	fs.mkdirSync(settingsBasePath, { recursive: true });
}

/**
 * Switch settings I/O to use a StorageProvider instead of the filesystem.
 * @param {object} provider - a StorageProvider instance with loadSettings/saveSettings
 */
function initSettingsWithProvider(provider) {
	_settingsProvider = provider;
}

/**
 * Load settings for an account, merging with defaults.
 * @param {string} accountId
 * @returns {object}
 */
async function getSettings(accountId) {
	// Sanitize accountId — same guard regardless of backend.
	if (typeof accountId !== 'string' || !SAFE_ACCOUNT_ID_REGEX.test(accountId)) {
		throw new Error(`Invalid account id: ${JSON.stringify(accountId)}`);
	}

	if (_settingsProvider) {
		const raw = await _settingsProvider.loadSettings(accountId);
		const merged = mergeWithDefaults(raw);
		if (serializedSettingsByteLength(merged) > getSettingsMaxBytes()) {
			return getDefaultSettings();
		}
		return merged;
	}

	const filePath = settingsFilePath(accountId);
	try {
		const raw = fs.readFileSync(filePath, 'utf-8');
		const merged = mergeWithDefaults(JSON.parse(raw));
		// Oversized on-disk files (legacy or tampered) fall back to defaults on read.
		if (serializedSettingsByteLength(merged) > getSettingsMaxBytes()) {
			return getDefaultSettings();
		}
		return merged;
	} catch (err) {
		if (err.code === 'ENOENT') return getDefaultSettings();
		throw err;
	}
}

/**
 * Deep-merge partial settings and persist.
 * @param {string} accountId
 * @param {object} partial
 * @returns {{ ok: true, settings: object } | { ok: false, reason: string }}
 */
async function updateSettings(accountId, partial) {
	const validation = validateSettings(partial);
	if (!validation.ok) {
		return validation;
	}

	const current = await getSettings(accountId);
	const merged = backfillSettings(deepMerge(current, validation.value));
	const serialized = JSON.stringify(merged, null, 2);
	if (Buffer.byteLength(serialized, 'utf-8') > getSettingsMaxBytes()) {
		return {
			ok: false,
			reason: `Settings exceed maximum size of ${getSettingsMaxBytes()} bytes`,
		};
	}

	if (_settingsProvider) {
		await _settingsProvider.saveSettings(accountId, merged);
		return { ok: true, settings: merged };
	}

	const dir = getSettingsDir();
	fs.mkdirSync(dir, { recursive: true });
	const finalPath = settingsFilePath(accountId);
	const tmpPath = finalPath + '.tmp';
	fs.writeFileSync(tmpPath, serialized, 'utf-8');
	fs.renameSync(tmpPath, finalPath);
	return { ok: true, settings: merged };
}

/** Test-only: reset path and clear settings directory reference */
function resetSettingsPath() {
	settingsBasePath = null;
	_settingsProvider = null;
}

/** Test-only: clear the storage provider (switch back to file-based mode) */
function resetSettingsProvider() {
	_settingsProvider = null;
}

/** Test-only: lower the settings size cap for cap-rejection tests */
function setSettingsMaxBytesForTests(maxBytes) {
	settingsMaxBytesOverride = maxBytes;
}

/** Test-only: restore default settings size cap */
function resetSettingsMaxBytesForTests() {
	settingsMaxBytesOverride = null;
}

/** Test-only: delete all settings files in the configured directory */
function clearAllSettings() {
	const dir = getSettingsDir();
	try {
		const files = fs.readdirSync(dir);
		for (const f of files) {
			if (f.endsWith('.json')) fs.unlinkSync(path.join(dir, f));
		}
	} catch (err) {
		if (err.code !== 'ENOENT') throw err;
	}
}

module.exports = {
	SETTINGS_MAX_BYTES,
	SETTINGS_TOP_LEVEL_KEYS,
	LOCK_ON_REPEAT_ACTIONS,
	KEYBOARD_BINDING_ACTIONS,
	GAMEPAD_BINDING_ACTIONS,
	GAMEPAD_PROFILES,
	MOVE_STICK_VALUES,
	DEADZONE_MIN,
	DEADZONE_MAX,
	getDefaultSettings,
	getSettings,
	updateSettings,
	initSettingsPath,
	initSettingsWithProvider,
	mergeWithDefaults,
	validateSettings,
	backfillSettings,
	resetSettingsPath,
	resetSettingsProvider,
	setSettingsMaxBytesForTests,
	resetSettingsMaxBytesForTests,
	clearAllSettings,
	getSettingsDir,
	settingsFilePath,
	SAFE_ACCOUNT_ID_REGEX
};
