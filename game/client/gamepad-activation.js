import { getConnectedGamepads } from './gamepad-detect.js';

/** @typedef {{ connected: Gamepad | null, pads: Gamepad[] }} GamepadActivationDetail */

const GESTURE_EVENTS = ['pointerdown', 'keydown', 'touchstart'];

let accessPrimed = false;
let initDone = false;
let pollRunning = false;
/** @type {Map<number, string>} */
let previousSnapshot = new Map();
/** @type {Set<(detail: GamepadActivationDetail) => void>} */
const callbacks = new Set();
/** @type {(() => void) | null} */
let pollFrame = null;

/**
 * @param {Gamepad[]} pads
 * @returns {Map<number, string>}
 */
function buildSnapshot(pads) {
	const snapshot = new Map();
	for (const pad of pads) {
		snapshot.set(pad.index, pad.id);
	}
	return snapshot;
}

/**
 * @param {Gamepad | null} connected
 * @param {Gamepad[]} pads
 */
function notifyChange(connected, pads) {
	const detail = { connected, pads };
	for (const callback of callbacks) {
		callback(detail);
	}
}

/**
 * Compare the current pad list to the previous snapshot and emit transitions.
 * @param {Gamepad[]} pads
 */
function detectTransitions(pads) {
	const current = buildSnapshot(pads);

	for (const [index] of previousSnapshot) {
		if (!current.has(index)) {
			notifyChange(null, pads);
		}
	}

	for (const pad of pads) {
		const previousId = previousSnapshot.get(pad.index);
		if (previousId === undefined || previousId !== pad.id) {
			notifyChange(pad, pads);
		}
	}

	previousSnapshot = current;
}

function runPollFrame() {
	if (accessPrimed) {
		detectTransitions(getConnectedGamepads());
	}
	requestAnimationFrame(pollFrame);
}

function startPollLoop() {
	if (pollRunning || typeof requestAnimationFrame === 'undefined') return;
	pollRunning = true;
	pollFrame = runPollFrame;
	requestAnimationFrame(pollFrame);
}

function onGesture() {
	primeGamepadAccess();
}

function removeGestureListeners() {
	if (!onGesture || typeof window === 'undefined') return;
	for (const event of GESTURE_EVENTS) {
		window.removeEventListener(event, onGesture);
	}
}

/**
 * Mark gamepad access as primed after a user gesture and call getGamepads() once
 * so Safari exposes connected controllers.
 */
export function primeGamepadAccess() {
	if (accessPrimed) return;
	accessPrimed = true;
	if (typeof navigator !== 'undefined' && navigator.getGamepads) {
		navigator.getGamepads();
	}
	removeGestureListeners();
}

/**
 * Register one-time gesture listeners and start the rAF poll loop.
 */
export function initGamepadActivation() {
	if (initDone || typeof window === 'undefined') return;
	initDone = true;

	for (const event of GESTURE_EVENTS) {
		window.addEventListener(event, onGesture, { once: true, passive: true });
	}

	startPollLoop();
}

/**
 * Subscribe to poll-detected connect/disconnect transitions.
 * @param {(detail: GamepadActivationDetail) => void} callback
 * @returns {() => void}
 */
export function onGamepadActivationChange(callback) {
	callbacks.add(callback);
	return () => callbacks.delete(callback);
}

/** @returns {boolean} */
export function isGamepadAccessPrimed() {
	return accessPrimed;
}
