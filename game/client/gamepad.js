import { GAMEPAD_DEADZONE, GAMEPAD_LOOK_SENSITIVITY, LOCK_ON_GAMEPAD_BUTTON } from './config.js';
import { isLockOnActive, isLockOnCameraReleasing } from './lockOn.js';
import { getGamepadConfig } from './settings.js';
import { resetGamepadButtonState } from './input.js';
import { onGamepadActivationChange } from './gamepad-activation.js';
import {
	resolveGamepadProfile,
	read8BitDo64CStickHorizontal,
	read8BitDo64CButtonState,
	getPrimaryGamepad,
	isProfileLockOnPressed,
	EIGHTBITDO_64_C_BUTTON_THRESHOLD,
} from './gamepad-profiles.js';

let prevLockOnPressed = false;
let listenersAdded = false;

/**
 * Shared per-frame gamepad snapshot. Captured once near the top of the animation
 * loop via `pollGamepadSnapshot()` so every reader (movement, look, buttons,
 * input.js bindings) consumes a single `navigator.getGamepads()` poll instead of
 * each re-resolving the pad/profile/config. Readers fall back to a fresh lazy
 * build when no frame snapshot is captured (e.g. unit tests call readers directly).
 * @typedef {{
 *   pad: Gamepad | null,
 *   profile: import('./gamepad-profiles.js').GamepadProfile,
 *   cfg: ReturnType<typeof getGamepadConfig>,
 *   cState: Record<'up' | 'down' | 'left' | 'right', boolean> | null,
 * }} GamepadSnapshot
 * @type {GamepadSnapshot | null}
 */
let frameSnapshot = null;
let frameSnapshotCaptured = false;

/**
 * Resolve the primary pad, profile, config, and (8BitDo 64 only) C-button state.
 * @returns {GamepadSnapshot}
 */
function buildGamepadSnapshot() {
	const cfg = getGamepadConfig();
	const configuredProfile = cfg.profile ?? 'auto';
	const pad = getPrimaryGamepad(configuredProfile);
	const profile = resolveGamepadProfile(pad, configuredProfile);
	// The 8BitDo 64 C-buttons drive four hand-slot bindings; read their state once
	// here (at the binding threshold) so pollInput reuses one result per frame.
	const cState = pad && profile.id === '8bitdo-64'
		? read8BitDo64CButtonState(pad, EIGHTBITDO_64_C_BUTTON_THRESHOLD)
		: null;
	return { pad, profile, cfg, cState };
}

/**
 * Capture the shared per-frame snapshot. Call once near the top of `animate()`
 * before movement/look/button readers run.
 * @returns {GamepadSnapshot}
 */
export function pollGamepadSnapshot() {
	frameSnapshot = buildGamepadSnapshot();
	frameSnapshotCaptured = true;
	return frameSnapshot;
}

/**
 * Return the captured frame snapshot, lazily building a fresh one when none was
 * captured this frame (direct reader calls outside the loop take this path).
 * @returns {GamepadSnapshot}
 */
export function getGamepadSnapshot() {
	if (frameSnapshotCaptured && frameSnapshot) return frameSnapshot;
	return buildGamepadSnapshot();
}

/** Drop the captured snapshot so the next read re-polls the pad. */
export function invalidateGamepadSnapshot() {
	frameSnapshot = null;
	frameSnapshotCaptured = false;
}

/**
 * Zero out small stick drift while rescaling the remainder to full range.
 * @param {number} value
 * @param {number} [deadzone]
 * @returns {number}
 */
export function applyDeadzone(value, deadzone = GAMEPAD_DEADZONE) {
	const abs = Math.abs(value);
	if (abs < deadzone) return 0;
	const sign = Math.sign(value);
	return sign * (abs - deadzone) / (1 - deadzone);
}

/**
 * Read a stick as a movement vector preserving analog magnitude (max 1).
 * @param {number} stickX
 * @param {number} stickY
 * @param {number} [deadzone]
 * @returns {{ x: number, z: number } | null}
 */
export function readStickMovement(stickX, stickY, deadzone = GAMEPAD_DEADZONE) {
	const x = applyDeadzone(stickX, deadzone);
	const y = applyDeadzone(stickY, deadzone);
	if (x === 0 && y === 0) return null;
	const mag = Math.hypot(x, y);
	if (mag > 1) return { x: x / mag, z: -(y / mag) };
	return { x, z: -y };
}

/**
 * Read the standard-gamepad D-pad as a digital movement vector.
 * @param {Gamepad | null | undefined} gamepad
 * @returns {{ x: number, z: number } | null}
 */
export function readDpadMovement(gamepad) {
	if (!gamepad?.buttons) return null;
	let inputX = 0;
	let inputZ = 0;
	if (gamepad.buttons[12]?.pressed) inputZ += 1;
	if (gamepad.buttons[13]?.pressed) inputZ -= 1;
	if (gamepad.buttons[14]?.pressed) inputX -= 1;
	if (gamepad.buttons[15]?.pressed) inputX += 1;
	const mag = Math.hypot(inputX, inputZ);
	if (mag <= 0) return null;
	return { x: inputX / mag, z: inputZ / mag };
}

/**
 * Combine two movement vectors, clamping combined magnitude to 1.
 * @param {{ x: number, z: number } | null} a
 * @param {{ x: number, z: number } | null} b
 * @returns {{ x: number, z: number } | null}
 */
export function mergeMovementVectors(a, b) {
	if (!a && !b) return null;
	if (!a) return b;
	if (!b) return a;
	const x = a.x + b.x;
	const z = a.z + b.z;
	const mag = Math.hypot(x, z);
	if (mag <= 0) return null;
	if (mag > 1) return { x: x / mag, z: z / mag };
	return { x, z };
}

/**
 * Return the first connected gamepad, if any.
 * @returns {Gamepad | null}
 */
export function getActiveGamepad() {
	return getGamepadSnapshot().pad;
}

/**
 * Poll the active gamepad for left-stick and D-pad movement.
 * @param {number} [deadzone]
 * @returns {{ x: number, z: number } | null}
 */
export function pollGamepadMovement(deadzone = GAMEPAD_DEADZONE, moveStick = 'left') {
	const pad = getActiveGamepad();
	if (!pad) return null;
	const useRight = moveStick === 'right';
	const stickX = useRight ? (pad.axes[2] ?? 0) : (pad.axes[0] ?? 0);
	const stickY = useRight ? (pad.axes[3] ?? 0) : (pad.axes[1] ?? 0);
	const stick = readStickMovement(stickX, stickY, deadzone);
	const dpad = readDpadMovement(pad);
	return mergeMovementVectors(stick, dpad);
}

/**
 * Poll the active gamepad right stick for camera yaw delta this frame.
 * @param {number} delta - seconds since last frame
 * @param {number} [deadzone]
 * @returns {number}
 */
export function pollGamepadLook(delta, deadzone = GAMEPAD_DEADZONE) {
	if (isLockOnActive() || isLockOnCameraReleasing()) return 0;
	const { pad, profile, cfg } = getGamepadSnapshot();
	if (!pad || delta <= 0) return 0;
	let lookX = 0;
	if (profile.lookSource === 'cStick') {
		lookX = read8BitDo64CStickHorizontal(pad, deadzone);
	} else {
		// When movement is bound to the right stick, it owns axis 2 — read
		// look from the left stick instead so one stick never drives both.
		const lookAxisIndex = cfg.moveStick === 'right' ? 0 : 2;
		lookX = applyDeadzone(pad.axes[lookAxisIndex] ?? 0, deadzone);
	}
	return -lookX * GAMEPAD_LOOK_SENSITIVITY * delta;
}

/**
 * Poll lock-on button presses (edge-triggered). Card slots and deck toggle
 * are handled by input.js pollInput() with remappable bindings.
 * @returns {{ lockOn: boolean }}
 */
export function pollGamepadButtons() {
	const { pad, profile } = getGamepadSnapshot();
	const result = { lockOn: false };
	if (!pad) {
		prevLockOnPressed = false;
		return result;
	}

	const lockPressed = isProfileLockOnPressed(pad, profile);
	if (lockPressed && !prevLockOnPressed) result.lockOn = true;
	prevLockOnPressed = lockPressed;
	return result;
}

/** Clear cached button state when the tab loses focus. */
export function resetGamepadState() {
	prevLockOnPressed = false;
	invalidateGamepadSnapshot();
	resetGamepadButtonState();
}

/** Register gamepad connect/disconnect listeners once. */
export function initGamepadListeners() {
	if (listenersAdded || typeof window === 'undefined') return;
	window.addEventListener('gamepadconnected', resetGamepadState);
	window.addEventListener('gamepaddisconnected', resetGamepadState);
	window.addEventListener('blur', resetGamepadState);
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState !== 'visible') resetGamepadState();
	});
	onGamepadActivationChange(() => {
		resetGamepadState();
	});
	listenersAdded = true;
}
