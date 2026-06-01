import {
	is8BitDo64Gamepad,
	is8BitDo64BluetoothGamepad,
	get8BitDo64VerticalCAxisIndex,
	is8BitDoGamepad,
	getConnectedGamepads,
} from './gamepad-detect.js';
import { HAND_MODIFIER_GAMEPAD_BUTTON, LOCK_ON_GAMEPAD_BUTTON } from './config.js';

/** Re-export for convenience. */
export {
	EIGHTBITDO_64_PRODUCT_ID,
	EIGHTBITDO_64_BT_PRODUCT_ID,
	is8BitDo64Gamepad,
	is8BitDo64BluetoothGamepad,
	get8BitDo64VerticalCAxisIndex,
} from './gamepad-detect.js';

/** @typedef {'auto' | 'standard' | '8bitdo-64'} GamepadProfileId */

/** @typedef {{ type: 'button', index: number, modifier?: boolean } | { type: 'axis', axis: 'cX' | 'cY' | number, direction: 'positive' | 'negative', threshold?: number, modifier?: boolean } | { type: 'cButton', direction: 'up' | 'down' | 'left' | 'right', threshold?: number, modifier?: boolean }} GamepadBinding */

/** @typedef {{
 *   id: GamepadProfileId,
 *   name: string,
 *   description: string,
 *   lockOnButton: number,
 *   modifierButton: number,
 *   moveStick: 'left' | 'right',
 *   lookSource: 'rightStick' | 'cStick' | 'none',
 *   bindings: Record<string, GamepadBinding>,
 *   buttonLabels: Array<{ index: number, label: string }>,
 *   cStickLabel?: string,
 *   cButtonLabels?: Array<{ direction: 'up' | 'down' | 'left' | 'right', label: string }>,
 *   matchGamepad?: (gamepad: Gamepad) => boolean,
 * }} GamepadProfile */

/** Browser axis indices used for L/R analog triggers on some 8BitDo 64 firmware (not the C cluster). */
export const EIGHTBITDO_64_TRIGGER_AXIS_INDICES = [2, 3];

/** Z trigger (SDL lefttrigger:b8) — lock-on only, not a C-button. */
export const EIGHTBITDO_64_LOCK_ON_BUTTON = 8;

/** R trigger (SDL righttrigger:b9) — not a C-button. */
export const EIGHTBITDO_64_RIGHT_TRIGGER_BUTTON = 9;

/** Z and R bottom triggers on the 8BitDo 64 (SDL lefttrigger:b8, righttrigger:b9). */
export const EIGHTBITDO_64_TRIGGER_BUTTON_INDICES = [
	EIGHTBITDO_64_LOCK_ON_BUTTON,
	EIGHTBITDO_64_RIGHT_TRIGGER_BUTTON,
];

/**
 * Discrete C-button indices in browser raw HID.
 * C↑/C↓ are btn 2/3; C←/C→ are btn 4/5; axis 2 is the C-cluster horizontal.
 * @type {Record<'up' | 'down' | 'left' | 'right', number[]>}
 */
export const EIGHTBITDO_64_C_DISCRETE_BUTTONS = {
	up: [2],
	down: [3],
	left: [4],
	right: [5],
};

/** @deprecated Use EIGHTBITDO_64_C_DISCRETE_BUTTONS. */
export const EIGHTBITDO_64_C_BUTTON_DIRECTIONS = {
	2: 'up',
	3: 'down',
	4: 'left',
	5: 'right',
};

/** Browser C-buttons often report low analog button values — use a lower cutoff. */
export const EIGHTBITDO_64_C_BUTTON_THRESHOLD = 0.2;

/**
 * The 8BitDo 64 exposes four digital C-buttons — not a separate analog C stick on axes 4/5.
 * @returns {boolean}
 */
export function uses8BitDo64DigitalCButtons() {
	return true;
}

/**
 * Analog C-cluster axis pair (SDL Mac/Linux: rightx:a2, righty:a3).
 * Axes 4/5 are unused on the single-stick 8BitDo 64 in the browser.
 * @param {Gamepad} gamepad
 * @returns {{ x: number, y: number } | null}
 */
export function get8BitDo64CStickAxes(gamepad) {
	if (uses8BitDo64DigitalCButtons()) return null;
	if (gamepad.axes.length >= 4) return { x: 2, y: 3 };
	return null;
}

/**
 * @param {Gamepad} gamepad
 * @returns {Array<{ x: number, y: number }>}
 */
export function get8BitDo64CAxisPairs(gamepad) {
	if (uses8BitDo64DigitalCButtons()) return [];
	if (gamepad.axes.length >= 4) return [{ x: 2, y: 3 }];
	return [];
}

/**
 * @param {Gamepad | null | undefined} gamepad
 * @param {number} index
 * @returns {boolean}
 */
export function isGamepadButtonActive(gamepad, index, threshold = 0.5) {
	if (!gamepad?.buttons?.[index]) return false;
	const btn = gamepad.buttons[index];
	return btn.pressed || btn.value > threshold;
}

/**
 * @param {Gamepad | null | undefined} gamepad
 * @param {number} index
 * @returns {boolean}
 */
export function is8BitDo64DiscreteCButtonActive(gamepad, index) {
	return isGamepadButtonActive(gamepad, index, EIGHTBITDO_64_C_BUTTON_THRESHOLD);
}

/**
 * Convert a C-cluster axis pair into four-way digital directions.
 * Each axis is evaluated independently (better for horizontal C on noisy Y).
 * @param {number} axisX
 * @param {number} axisY
 * @param {number} [threshold]
 * @returns {Record<'up' | 'down' | 'left' | 'right', boolean>}
 */
export function readAxisSectorDirections(axisX, axisY, threshold = 0.35) {
	const result = { up: false, down: false, left: false, right: false };
	const x = Number.isFinite(axisX) ? axisX : 0;
	const y = Number.isFinite(axisY) ? axisY : 0;
	if (x <= -threshold) result.left = true;
	else if (x >= threshold) result.right = true;
	if (y <= -threshold) result.up = true;
	else if (y >= threshold) result.down = true;
	return result;
}

/**
 * @param {Record<'up' | 'down' | 'left' | 'right', boolean>} target
 * @param {Record<'up' | 'down' | 'left' | 'right', boolean>} source
 */
function mergeCButtonState(target, source) {
	for (const direction of /** @type {const} */ (['up', 'down', 'left', 'right'])) {
		if (source[direction]) target[direction] = true;
	}
}

/**
 * Read horizontal C from axis 2 (SDL Mac/Linux rightx:a2).
 * Axis 3 often carries L-trigger rest in the browser — do not use it for C↑/C↓.
 * @param {number} axisX
 * @param {number} axisY
 * @param {number} threshold
 * @returns {Record<'up' | 'down' | 'left' | 'right', boolean>}
 */
function read8BitDo64CAxisDirections(axisX, axisY, threshold) {
	const result = { up: false, down: false, left: false, right: false };
	const x = Number.isFinite(axisX) ? axisX : 0;
	const y = Number.isFinite(axisY) ? axisY : 0;

	if (Math.abs(x) >= threshold && Math.abs(x) >= Math.abs(y)) {
		if (x <= -threshold) result.left = true;
		else if (x >= threshold) result.right = true;
	}

	return result;
}

/**
 * Bluetooth 8BitDo 64 maps C↑/C↓ to a dedicated vertical axis (browser axis 5).
 * @param {number} axisY
 * @param {number} threshold
 * @returns {Record<'up' | 'down' | 'left' | 'right', boolean>}
 */
function read8BitDo64VerticalCAxisDirections(axisY, threshold) {
	const y = Number.isFinite(axisY) ? axisY : 0;
	const result = { up: false, down: false, left: false, right: false };
	if (y <= -threshold) result.up = true;
	else if (y >= threshold) result.down = true;
	return result;
}

function read8BitDo64DiscreteCButtons(gamepad) {
	const state = { up: false, down: false, left: false, right: false };
	for (const [direction, indices] of Object.entries(EIGHTBITDO_64_C_DISCRETE_BUTTONS)) {
		for (const index of indices) {
			if (is8BitDo64DiscreteCButtonActive(gamepad, index)) {
				state[direction] = true;
			}
		}
	}
	return state;
}

/**
 * Read 8BitDo 64 C-buttons from discrete browser buttons and/or axes 2/3 (SDL C cluster).
 * @param {Gamepad} gamepad
 * @param {number} [threshold]
 * @returns {Record<'up' | 'down' | 'left' | 'right', boolean>}
 */
export function read8BitDo64CButtonState(gamepad, threshold = 0.3) {
	const state = read8BitDo64DiscreteCButtons(gamepad);

	if (gamepad.axes.length >= 4) {
		mergeCButtonState(
			state,
			read8BitDo64CAxisDirections(
				gamepad.axes[2] ?? 0,
				gamepad.axes[3] ?? 0,
				threshold,
			),
		);
	}

	const verticalAxis = get8BitDo64VerticalCAxisIndex(gamepad);
	if (verticalAxis != null && gamepad.axes.length > verticalAxis) {
		mergeCButtonState(
			state,
			read8BitDo64VerticalCAxisDirections(gamepad.axes[verticalAxis] ?? 0, threshold),
		);
	}

	return state;
}

/**
 * @param {Gamepad} gamepad
 * @param {'up' | 'down' | 'left' | 'right'} direction
 * @param {number} [threshold]
 * @returns {boolean}
 */
export function is8BitDo64CButtonActive(gamepad, direction, threshold = 0.3) {
	return read8BitDo64CButtonState(gamepad, threshold)[direction];
}

/** @type {GamepadProfile} */
export const STANDARD_PROFILE = {
	id: 'standard',
	name: 'Standard gamepad',
	description: 'XInput / DualShock-style face buttons and triggers',
	lockOnButton: LOCK_ON_GAMEPAD_BUTTON,
	modifierButton: HAND_MODIFIER_GAMEPAD_BUTTON,
	moveStick: 'left',
	lookSource: 'rightStick',
	bindings: {
		useSlot0: { type: 'button', index: 0 },
		useSlot1: { type: 'button', index: 1 },
		useSlot2: { type: 'button', index: 2 },
		useSlot3: { type: 'button', index: 3 },
		useSlot4: { type: 'button', index: 4 },
		useSlot5: { type: 'button', index: 5 },
		toggleDeckViewer: { type: 'button', index: 8 },
		useKeyItem: { type: 'button', index: 13 },
	},
	buttonLabels: [
		{ index: 0, label: 'South (A / Cross)' },
		{ index: 1, label: 'East (B / Circle)' },
		{ index: 2, label: 'West (X / Square)' },
		{ index: 3, label: 'North (Y / Triangle)' },
		{ index: 4, label: 'L1 / LB' },
		{ index: 5, label: 'R1 / RB' },
		{ index: 6, label: 'L2 / LT' },
		{ index: 7, label: 'R2 / RT' },
		{ index: 8, label: 'Select / Back' },
		{ index: 9, label: 'Start' },
		{ index: 10, label: 'L3' },
		{ index: 11, label: 'R3' },
		{ index: 12, label: 'D-pad Up' },
		{ index: 13, label: 'D-pad Down' },
		{ index: 14, label: 'D-pad Left' },
		{ index: 15, label: 'D-pad Right' },
	],
};

/**
 * 8BitDo 64 — SDL GameControllerDB mapping (product 0x1930).
 * A/B, C-stick (axes), Z lock-on, L/R shoulders, Select/Start/Home.
 * @type {GamepadProfile}
 */
export const EIGHTBITDO_64_PROFILE = {
	id: '8bitdo-64',
	name: '8BitDo 64',
	description: 'N64 layout from SDL GameControllerDB: A, B, C↑↓←→, Z, L, R, Select, Start',
	matchGamepad: is8BitDo64Gamepad,
	lockOnButton: EIGHTBITDO_64_LOCK_ON_BUTTON,
	modifierButton: 6,
	moveStick: 'left',
	lookSource: 'cStick',
	bindings: {
		useSlot0: { type: 'button', index: 0 },
		useSlot1: { type: 'button', index: 1 },
		useSlot2: { type: 'cButton', direction: 'up', threshold: 0.2 },
		useSlot3: { type: 'cButton', direction: 'down', threshold: 0.2 },
		useSlot4: { type: 'cButton', direction: 'left', threshold: 0.2 },
		useSlot5: { type: 'cButton', direction: 'right', threshold: 0.2 },
		toggleDeckViewer: { type: 'button', index: 10 },
		useKeyItem: { type: 'button', index: 13 },
	},
	buttonLabels: [
		{ index: 0, label: 'A' },
		{ index: 1, label: 'B' },
		{ index: 2, label: 'C↑ (btn 2)' },
		{ index: 3, label: 'C↓ (btn 3)' },
		{ index: 4, label: 'C← (btn 4)' },
		{ index: 5, label: 'C→ (btn 5)' },
		{ index: 6, label: 'L' },
		{ index: 7, label: 'R' },
		{ index: 8, label: 'Z (left Z / lock-on)' },
		{ index: 9, label: 'R (right Z trigger)' },
		{ index: 10, label: 'Select (−)' },
		{ index: 11, label: 'Start (+)' },
		{ index: 12, label: 'Home' },
		{ index: 13, label: 'Stick click' },
	],
	cStickLabel: 'C-buttons',
	triggerAxisLabels: ['L analog (axis 2)', 'R analog (axis 3)'],
	cButtonLabels: [
		{ direction: 'up', label: 'C↑' },
		{ direction: 'down', label: 'C↓' },
		{ direction: 'left', label: 'C←' },
		{ direction: 'right', label: 'C→' },
	],
};

/** @type {GamepadProfile[]} */
export const GAMEPAD_PROFILES = [STANDARD_PROFILE, EIGHTBITDO_64_PROFILE];

/** @type {Record<string, GamepadProfile>} */
const PROFILE_BY_ID = Object.fromEntries(GAMEPAD_PROFILES.map((p) => [p.id, p]));

/**
 * @param {GamepadProfileId | string | undefined | null} profileId
 * @returns {GamepadProfile}
 */
export function getGamepadProfileById(profileId) {
	if (profileId && PROFILE_BY_ID[profileId]) return PROFILE_BY_ID[profileId];
	return STANDARD_PROFILE;
}

/**
 * Resolve the active profile from settings + connected pad.
 * @param {Gamepad | null | undefined} gamepad
 * @param {GamepadProfileId | string | undefined | null} configuredProfile
 * @returns {GamepadProfile}
 */
export function resolveGamepadProfile(gamepad, configuredProfile = 'auto') {
	if (configuredProfile && configuredProfile !== 'auto') {
		return getGamepadProfileById(configuredProfile);
	}
	if (gamepad) {
		for (const profile of GAMEPAD_PROFILES) {
			if (profile.id !== 'standard' && profile.matchGamepad?.(gamepad)) {
				return profile;
			}
		}
	}
	return STANDARD_PROFILE;
}

/**
 * @param {Gamepad | null | undefined} gamepad
 * @param {GamepadProfileId | string | undefined | null} configuredProfile
 * @returns {string}
 */
export function describeActiveGamepadProfile(gamepad, configuredProfile = 'auto') {
	const profile = resolveGamepadProfile(gamepad, configuredProfile);
	if (configuredProfile === 'auto' && profile.id !== 'standard' && gamepad) {
		return `${profile.name} (auto-detected)`;
	}
	if (configuredProfile === 'auto') return 'Standard gamepad (auto)';
	return profile.name;
}

/**
 * @param {Gamepad} gamepad
 * @param {GamepadBinding} binding
 * @returns {number}
 */
export function readBindingAxisValue(gamepad, binding) {
	if (binding.type !== 'axis') return 0;
	if (binding.axis === 'cX' || binding.axis === 'cY') {
		const cStick = get8BitDo64CStickAxes(gamepad);
		if (!cStick) return 0;
		return binding.axis === 'cX'
			? (gamepad.axes[cStick.x] ?? 0)
			: (gamepad.axes[cStick.y] ?? 0);
	}
	return gamepad.axes[binding.axis] ?? 0;
}

/**
 * @param {Gamepad} gamepad
 * @param {GamepadBinding} binding
 * @returns {boolean}
 */
export function isBindingActive(gamepad, binding) {
	if (binding.type === 'button') {
		return isGamepadButtonActive(gamepad, binding.index);
	}
	if (binding.type === 'cButton') {
		return is8BitDo64CButtonActive(
			gamepad,
			binding.direction,
			binding.threshold ?? EIGHTBITDO_64_C_BUTTON_THRESHOLD,
		);
	}
	const threshold = binding.threshold ?? 0.5;
	const value = readBindingAxisValue(gamepad, binding);
	return binding.direction === 'positive' ? value >= threshold : value <= -threshold;
}

/**
 * @param {Gamepad | null | undefined} gamepad
 * @param {GamepadProfile} profile
 * @returns {{ x: number, y: number } | null}
 */
export function readProfileCStick(gamepad, profile) {
	if (!gamepad || profile.id !== '8bitdo-64') return null;
	const cStick = get8BitDo64CStickAxes(gamepad);
	if (cStick) {
		return { x: gamepad.axes[cStick.x] ?? 0, y: gamepad.axes[cStick.y] ?? 0 };
	}
	const c = read8BitDo64CButtonState(gamepad);
	let x = 0;
	let y = 0;
	if (c.left) x -= 1;
	if (c.right) x += 1;
	if (c.up) y -= 1;
	if (c.down) y += 1;
	return { x, y };
}

/**
 * Whether the profile lock-on button is held (supports analog trigger values).
 * @param {Gamepad} gamepad
 * @param {GamepadProfile} profile
 * @returns {boolean}
 */
export function isProfileLockOnPressed(gamepad, profile) {
	if (!gamepad?.buttons) return false;
	const lockButton = profile.lockOnButton ?? LOCK_ON_GAMEPAD_BUTTON;
	const threshold = profile.id === '8bitdo-64'
		? EIGHTBITDO_64_C_BUTTON_THRESHOLD
		: 0.5;
	return isGamepadButtonActive(gamepad, lockButton, threshold);
}

/**
 * Horizontal C-axis for camera look on the 8BitDo 64 profile.
 * @param {Gamepad} gamepad
 * @param {number} [deadzone]
 * @returns {number}
 */
export function read8BitDo64CStickHorizontal(gamepad, deadzone = 0.15) {
	if (gamepad.axes.length >= 3) {
		const x = gamepad.axes[2] ?? 0;
		const y = gamepad.axes[3] ?? 0;
		if (Math.abs(x) >= deadzone && Math.abs(x) >= Math.abs(y)) return x;
	}
	// Digital C-buttons are card bindings — never map them to camera look.
	return 0;
}

/**
 * @param {Gamepad | null | undefined} gamepad
 * @returns {string}
 */
export function describeGamepadConnectionWithProfile(gamepad, configuredProfile = 'auto') {
	if (!gamepad) return 'No controller detected';
	if (is8BitDo64Gamepad(gamepad)) return '8BitDo 64 controller connected';
	if (is8BitDoGamepad(gamepad)) return '8BitDo controller connected';
	return 'Controller connected';
}

/**
 * Prefer a pad matching the configured/auto profile.
 * @param {GamepadProfileId | string | undefined | null} [configuredProfile]
 * @returns {Gamepad | null}
 */
export function getPrimaryGamepad(configuredProfile = 'auto') {
	const pads = getConnectedGamepads();
	if (pads.length === 0) return null;
	if (configuredProfile === '8bitdo-64') {
		return pads.find((pad) => is8BitDo64Gamepad(pad)) ?? pads[0];
	}
	if (configuredProfile === 'auto') {
		const matched = pads.find((pad) => resolveGamepadProfile(pad, 'auto').id !== 'standard');
		if (matched) return matched;
	}
	return pads[0];
}
