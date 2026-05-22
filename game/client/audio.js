// ── Client audio module ──
// Oscillator-based Web Audio synthesizer for sound effects.
// Import SOUND_CONFIG from config.js; everything else is self-contained.

import { SOUND_CONFIG } from './config.js';

const SOUND_ENABLED_KEY = 'autogame:soundEnabled';

/**
 * Read the persisted sound preference from localStorage.
 * Returns `true` (unmuted) if the key is absent or localStorage is unavailable.
 */
function loadSoundEnabled() {
	try {
		const val = localStorage.getItem(SOUND_ENABLED_KEY);
		if (val === null) return true; // no stored preference — default to unmuted
		return val === 'true';
	} catch (_) {
		return true; // localStorage blocked (e.g. private mode)
	}
}

/**
 * Persist the current sound preference to localStorage.
 * No-ops if localStorage is unavailable.
 * @param {boolean} value
 */
function saveSoundEnabled(value) {
	try {
		localStorage.setItem(SOUND_ENABLED_KEY, String(value));
	} catch (_) {
		// localStorage blocked — silent fail
	}
}

let soundEnabled = loadSoundEnabled();
let audioCtx = null;

/**
 * Resume the AudioContext if it was suspended by the browser's autoplay policy.
 * Safe to call multiple times — no-ops when context is already running or unavailable.
 */
function resumeAudioContext() {
	try {
		if (audioCtx && audioCtx.state === 'suspended') {
			audioCtx.resume();
		}
	} catch (e) {
		// Silent — resume may fail in restricted environments
	}
}

/**
 * Return the lazy-created AudioContext (for test injection).
 * @returns {AudioContext|null}
 */
function getAudioContext() {
	return audioCtx;
}

/**
 * Override the AudioContext reference (for test injection).
 * @param {AudioContext|null} ctx
 */
function setAudioContext(ctx) {
	audioCtx = ctx;
}

// ── Test-only tracking ──

/** Tracks every playSound(type) call when _soundLogEnabled is true */
const _playSoundCallLog = [];

/** Enabled via window.__soundLogEnabled (set by test setup) */
const _soundLogEnabled = typeof window !== 'undefined' && !!window.__soundLogEnabled;

/**
 * Play a short oscillator-based sound effect via the Web Audio API.
 * Never throws — catches errors silently if AudioContext is unavailable or blocked.
 * @param {string} type - one of 'card', 'enemyHit', 'playerDamage', 'loot', 'victory', 'failure'
 */
function playSound(type) {
	if (_soundLogEnabled) _playSoundCallLog.push(type);
	try {
		if (!soundEnabled) return;

		resumeAudioContext();

		if (!audioCtx) {
			const Ctx = window.AudioContext || window.webkitAudioContext;
			audioCtx = Ctx ? new Ctx() : null;
		}
		if (!audioCtx) return;

		const config = SOUND_CONFIG[type];
		if (!config) return;

		const now = audioCtx.currentTime;

		if (config.notes) {
			// Multi-note sound (victory / failure)
			let offset = 0;
			for (const note of config.notes) {
				const osc = audioCtx.createOscillator();
				osc.type = 'sine';
				osc.frequency.value = note.freq;
				osc.connect(audioCtx.destination);
				osc.start(now + offset);
				osc.stop(now + offset + note.duration);
				offset += note.duration;
			}
		} else {
			// Single-note sound
			const osc = audioCtx.createOscillator();
			osc.type = 'sine';
			osc.frequency.value = config.freq;
			osc.connect(audioCtx.destination);
			osc.start(now);
			osc.stop(now + config.duration);
		}
	} catch (e) {
		// Silent — AudioContext may be unavailable or blocked by the browser
	}
}

/**
 * Return the current sound-enabled state.
 * @returns {boolean}
 */
function isSoundEnabled() {
	return soundEnabled;
}

/**
 * Set the sound-enabled state and persist to localStorage.
 * @param {boolean} value
 */
function setSoundEnabled(value) {
	soundEnabled = value;
	saveSoundEnabled(value);
}

// ── Autoplay resume listeners ──
// Resume AudioContext on first user interaction (browser autoplay policy)
function __resumeAudioCtxListener() { resumeAudioContext(); }
document.addEventListener('click', __resumeAudioCtxListener, { once: true });
document.addEventListener('keydown', __resumeAudioCtxListener, { once: true });

// ── Exports ──

export {
	playSound,
	isSoundEnabled,
	setSoundEnabled,
	resumeAudioContext,
	getAudioContext,
	setAudioContext,
	loadSoundEnabled,
	saveSoundEnabled,
	_soundLogEnabled,
	_playSoundCallLog,
};
