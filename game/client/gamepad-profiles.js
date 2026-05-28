import {
	is8BitDo64Gamepad,
	is8BitDoGamepad,
	getConnectedGamepads,
} from './gamepad-detect.js';
import { HAND_MODIFIER_GAMEPAD_BUTTON, LOCK_ON_GAMEPAD_BUTTON } from './config.js';

/** Re-export for convenience. */
export { EIGHTBITDO_64_PRODUCT_ID, is8BitDo64Gamepad } from './gamepad-detect.js';

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

/** Z and R bottom triggers on the 8BitDo 64 (SDL lefttrigger:b8, righttrigger:b9). */
export const EIGHTBITDO_64_TRIGGER_BUTTON_INDICES = [8, 9];

/**
 * Discrete C-button indices in browser raw HID.
 * C↑/C↓ are commonly btn 2/3; SDL N64 axis-as-buttons use -rightx:b4 (C←), +rightx:b9 (C→).
 * @type {Record<'up' | 'down' | 'left' | 'right', number[]>}
 */
export const EIGHTBITDO_64_C_DISCRETE_BUTTONS = {
	up: [2],
	down: [3],
	left: [4],
	right: [5, 9],
};

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
export function isGamepadButtonActive(gamepad, index) {
	if (!gamepad?.buttons?.[index]) return false;
	const btn = gamepad.buttons[index];
	return btn.pressed || btn.value > 0.5;
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
 * Read analog C directions from axes 2/3 when horizontal/vertical motion is clearly intentional.
 * Skips horizontal reads when vertical axis dominates (avoids ghost left/right on C↑/C↓).
 * @param {number} axisX
 * @param {number} axisY
 * @param {number} threshold
 * @param {{ up?: boolean, down?: boolean }} [discrete]
 * @returns {Record<'up' | 'down' | 'left' | 'right', boolean>}
 */
function read8BitDo64CAxisDirections(axisX, axisY, threshold, discrete = {}) {
	const result = { up: false, down: false, left: false, right: false };
	const x = Number.isFinite(axisX) ? axisX : 0;
	const y = Number.isFinite(axisY) ? axisY : 0;

	if (!discrete.up && y <= -threshold) result.up = true;
	if (!discrete.down && y >= threshold) result.down = true;

	if (Math.abs(x) >= threshold && Math.abs(x) >= Math.abs(y)) {
		if (x <= -threshold) result.left = true;
		else if (x >= threshold) result.right = true;
	}

	return result;
}

/**
 * Read 8BitDo 64 C-buttons from discrete browser buttons and/or axes 2/3 (SDL C cluster).
 * @param {Gamepad} gamepad
 * @param {number} [threshold]
 * @returns {Record<'up' | 'down' | 'left' | 'right', boolean>}
 */
export function read8BitDo64CButtonState(gamepad, threshold = 0.3) {
	const state = { up: false, down: false, left: false, right: false };
	const discrete = { up: false, down: false, left: false, right: false };

	for (const [direction, indices] of Object.entries(EIGHTBITDO_64_C_DISCRETE_BUTTONS)) {
		for (const index of indices) {
			if (isGamepadButtonActive(gamepad, index)) {
				state[direction] = true;
				discrete[direction] = true;
			}
		}
	}

	if (gamepad.axes.length >= 4) {
		mergeCButtonState(
			state,
			read8BitDo64CAxisDirections(
				gamepad.axes[2] ?? 0,
				gamepad.axes[3] ?? 0,
				threshold,
				discrete,
			),
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
	lockOnButton: 8,
	modifierButton: 6,
	moveStick: 'left',
	lookSource: 'cStick',
	bindings: {
		useSlot0: { type: 'button', index: 0 },
		useSlot1: { type: 'button', index: 1 },
		useSlot2: { type: 'cButton', direction: 'up', threshold: 0.3 },
		useSlot3: { type: 'cButton', direction: 'down', threshold: 0.3 },
		useSlot4: { type: 'cButton', direction: 'left', threshold: 0.3 },
		useSlot5: { type: 'cButton', direction: 'right', threshold: 0.3 },
		toggleDeckViewer: { type: 'button', index: 10 },
	},
	buttonLabels: [
		{ index: 0, label: 'A' },
		{ index: 1, label: 'B' },
		{ index: 2, label: 'C↑ (btn 2)' },
		{ index: 3, label: 'C↓ (btn 3)' },
		{ index: 4, label: 'C← (btn 4)' },
		{ index: 5, label: 'C→ (btn 5, fallback)' },
		{ index: 6, label: 'L' },
		{ index: 7, label: 'R' },
		{ index: 8, label: 'Z (lock-on)' },
		{ index: 9, label: 'C→ / R analog (btn 9)' },
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
			binding.threshold ?? 0.35,
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
	const c = read8BitDo64CButtonState(gamepad, deadzone);
	if (c.left && !c.right) return -1;
	if (c.right && !c.left) return 1;
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
