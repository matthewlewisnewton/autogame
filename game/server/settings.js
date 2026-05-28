// Per-account settings persistence — one JSON file per accountId.

const fs = require('fs');
const path = require('path');

let settingsBasePath = null;

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
	return deepMerge(getDefaultSettings(), stored || {});
}

function getSettingsDir() {
	if (!settingsBasePath) {
		const dataPath = process.env.PERSISTENCE_PATH || path.resolve(__dirname, '..', 'data');
		settingsBasePath = path.join(dataPath, 'settings');
	}
	return settingsBasePath;
}

function settingsFilePath(accountId) {
	return path.join(getSettingsDir(), `${accountId}.json`);
}

/**
 * Configure the settings storage directory (call from server startup / tests).
 * @param {string} basePath - directory containing settings JSON files
 */
function initSettingsPath(basePath) {
	settingsBasePath = path.join(basePath, 'settings');
	fs.mkdirSync(settingsBasePath, { recursive: true });
}

/**
 * Load settings for an account, merging with defaults.
 * @param {string} accountId
 * @returns {object}
 */
function getSettings(accountId) {
	const filePath = settingsFilePath(accountId);
	try {
		const raw = fs.readFileSync(filePath, 'utf-8');
		return mergeWithDefaults(JSON.parse(raw));
	} catch (err) {
		if (err.code === 'ENOENT') return getDefaultSettings();
		throw err;
	}
}

/**
 * Deep-merge partial settings and persist.
 * @param {string} accountId
 * @param {object} partial
 * @returns {object} merged settings
 */
function updateSettings(accountId, partial) {
	const current = getSettings(accountId);
	const merged = deepMerge(current, partial);
	const dir = getSettingsDir();
	fs.mkdirSync(dir, { recursive: true });
	const finalPath = settingsFilePath(accountId);
	const tmpPath = finalPath + '.tmp';
	fs.writeFileSync(tmpPath, JSON.stringify(merged, null, 2), 'utf-8');
	fs.renameSync(tmpPath, finalPath);
	return merged;
}

/** Test-only: reset path and clear settings directory reference */
function resetSettingsPath() {
	settingsBasePath = null;
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
	getDefaultSettings,
	getSettings,
	updateSettings,
	initSettingsPath,
	mergeWithDefaults,
	resetSettingsPath,
	clearAllSettings,
	getSettingsDir
};
