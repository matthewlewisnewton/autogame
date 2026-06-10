import { GAMEPAD_DEADZONE, GAMEPAD_LOOK_SENSITIVITY, LOCK_ON_GAMEPAD_BUTTON } from './config.js';
import { isLockOnActive, isLockOnCameraReleasing } from './lockOn.js';
import { getGamepadConfig } from './settings.js';
import { resolveGamepadProfile, read8BitDo64CStickHorizontal, getPrimaryGamepad, isProfileLockOnPressed } from './gamepad-profiles.js';

let prevButtons = [];
let listenersAdded = false;

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
	const cfg = getGamepadConfig();
	return getPrimaryGamepad(cfg.profile ?? 'auto');
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
	const pad = getActiveGamepad();
	if (!pad || delta <= 0) return 0;
	const cfg = getGamepadConfig();
	const profile = resolveGamepadProfile(pad, cfg.profile ?? 'auto');
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
	const pad = getActiveGamepad();
	const result = { lockOn: false };
	if (!pad) {
		prevButtons = [];
		return result;
	}

	const cfg = getGamepadConfig();
	const profile = resolveGamepadProfile(pad, cfg.profile ?? 'auto');
	const lockButton = profile.lockOnButton ?? LOCK_ON_GAMEPAD_BUTTON;
	const buttons = pad.buttons;

	const lockPressed = isProfileLockOnPressed(pad, profile);
	const lockWas = prevButtons[lockButton] ?? false;
	if (lockPressed && !lockWas) result.lockOn = true;

	prevButtons = Array.from({ length: buttons.length }, (_, i) => {
		if (i === lockButton) return lockPressed;
		return buttons[i]?.pressed ?? false;
	});
	return result;
}

/** Clear cached button state when the tab loses focus. */
export function resetGamepadState() {
	prevButtons = [];
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
	listenersAdded = true;
}

/** Whether any connected gamepad is currently providing movement input. */
export function isGamepadMoving(deadzone = GAMEPAD_DEADZONE, moveStick = 'left') {
	return pollGamepadMovement(deadzone, moveStick) != null;
}
