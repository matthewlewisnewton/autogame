// Unified keyboard + gamepad input with remappable gamepad bindings.
//
// Gamepad hand palettes (keyboard uses direct keys 1–6 only, no modifier layer):
//   Primary:    face buttons / bumpers → slots 1–6 (current max hand)
//   Secondary:  hold R trigger (RT), then face buttons → slots 7–8 when hand size grows
//   Lock-on:    L trigger (LT) — handled in gamepad.js, not here

import { getGamepadConfig } from './settings.js';
import { HAND_MODIFIER_GAMEPAD_BUTTON } from './config.js';

export const ACTIONS = {
	moveUp: 'moveUp',
	moveDown: 'moveDown',
	moveLeft: 'moveLeft',
	moveRight: 'moveRight',
	useSlot0: 'useSlot0',
	useSlot1: 'useSlot1',
	useSlot2: 'useSlot2',
	useSlot3: 'useSlot3',
	useSlot4: 'useSlot4',
	useSlot5: 'useSlot5',
	toggleDeckViewer: 'toggleDeckViewer'
};

const DEFAULT_KEYBOARD = {
	moveUp: ['w'],
	moveDown: ['s'],
	moveLeft: ['a'],
	moveRight: ['d'],
	useSlot0: ['1'],
	useSlot1: ['2'],
	useSlot2: ['3'],
	useSlot3: ['4'],
	useSlot4: ['5'],
	useSlot5: ['6'],
	toggleDeckViewer: ['v']
};

const DEFAULT_GAMEPAD_BUTTONS = {
	useSlot0: 0,
	useSlot1: 1,
	useSlot2: 2,
	useSlot3: 3,
	useSlot4: 4,
	useSlot5: 5,
	toggleDeckViewer: 8
};

const keyState = {
	moveUp: false,
	moveDown: false,
	moveLeft: false,
	moveRight: false
};

/** @type {{ onUseSlot?: (n: number) => void, onToggleDeck?: () => void, canUseGameActions?: () => boolean }} */
let callbacks = {};
let listenersAdded = false;
const prevGamepadButtons = new Map();

/**
 * @param {{ onMove?: never, onUseSlot?: (slot: number) => void, onToggleDeck?: () => void, canUseGameActions?: () => boolean }} opts
 */
export function initInput(opts = {}) {
	callbacks = opts;
	if (!listenersAdded) {
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		listenersAdded = true;
	}
}

function onKeyDown(e) {
	if (e.repeat) return;
	const key = e.key.toLowerCase();
	for (const [action, keys] of Object.entries(DEFAULT_KEYBOARD)) {
		if (!keys.includes(key)) continue;
		if (action.startsWith('move')) {
			keyState[action] = true;
			return;
		}
		if (!callbacks.canUseGameActions || !callbacks.canUseGameActions()) continue;
		if (action === 'toggleDeckViewer') {
			e.preventDefault();
			callbacks.onToggleDeck?.();
			return;
		}
		const slotMatch = action.match(/^useSlot(\d)$/);
		if (slotMatch) {
			e.preventDefault();
			callbacks.onUseSlot?.(parseInt(slotMatch[1], 10));
			return;
		}
	}
}

function onKeyUp(e) {
	const key = e.key.toLowerCase();
	for (const [action, keys] of Object.entries(DEFAULT_KEYBOARD)) {
		if (keys.includes(key) && action.startsWith('move')) {
			keyState[action] = false;
		}
	}
}

function isHandModifierHeld(gp) {
	const cfg = getGamepadConfig();
	const index = Number.isInteger(cfg.modifierButton) ? cfg.modifierButton : HAND_MODIFIER_GAMEPAD_BUTTON;
	return isButtonPressed(gp, index);
}

function bindingMatchesModifier(binding, modifierHeld) {
	if (!binding || binding.type !== 'button') return false;
	const wantsModifier = binding.modifier === true;
	return wantsModifier ? modifierHeld : !modifierHeld;
}

function getBindingButtonIndex(action) {
	const cfg = getGamepadConfig();
	const custom = cfg.bindings && cfg.bindings[action];
	if (custom && custom.type === 'button' && typeof custom.index === 'number') {
		return custom;
	}
	if (DEFAULT_GAMEPAD_BUTTONS[action] !== undefined) {
		return { type: 'button', index: DEFAULT_GAMEPAD_BUTTONS[action], modifier: false };
	}
	return null;
}

/**
 * @returns {Gamepad[]}
 */
export function getConnectedGamepads() {
	if (!navigator.getGamepads) return [];
	return Array.from(navigator.getGamepads()).filter(Boolean);
}

function getPrimaryGamepad() {
	const pads = getConnectedGamepads();
	return pads[0] || null;
}

function readMoveStick(gp) {
	const cfg = getGamepadConfig();
	const deadzone = cfg.deadzone ?? 0.15;
	const useRight = cfg.moveStick === 'right';
	const x = useRight ? gp.axes[2] : gp.axes[0];
	const z = useRight ? gp.axes[3] : gp.axes[1];
	const mag = Math.hypot(x, z);
	if (mag < deadzone) return { dx: 0, dz: 0, mag: 0 };
	const scale = (mag - deadzone) / (1 - deadzone);
	const nx = (x / mag) * scale;
	const nz = (z / mag) * scale;
	return { dx: nx, dz: nz, mag: Math.hypot(nx, nz) };
}

/**
 * Movement direction for the local player (normalized when mag > 0).
 * @returns {{ dx: number, dz: number, mag: number }}
 */
export function getMovementDirection() {
	let dirX = 0;
	let dirZ = 0;
	if (keyState.moveUp) dirZ -= 1;
	if (keyState.moveDown) dirZ += 1;
	if (keyState.moveLeft) dirX -= 1;
	if (keyState.moveRight) dirX += 1;

	const gp = getPrimaryGamepad();
	if (gp) {
		const stick = readMoveStick(gp);
		if (stick.mag > 0) {
			dirX = stick.dx;
			dirZ = stick.dz;
			return { dx: dirX, dz: dirZ, mag: stick.mag };
		}
	}

	const mag = Math.hypot(dirX, dirZ);
	if (mag > 0) {
		return { dx: dirX / mag, dz: dirZ / mag, mag: 1 };
	}
	return { dx: 0, dz: 0, mag: 0 };
}

function isButtonPressed(gp, index) {
	const btn = gp.buttons[index];
	if (!btn) return false;
	return btn.pressed || btn.value > 0.5;
}

/**
 * Poll gamepad buttons for edge-triggered actions. Call each frame.
 */
export function pollInput() {
	const gp = getPrimaryGamepad();
	if (!gp) return;
	if (callbacks.canUseGameActions && !callbacks.canUseGameActions()) return;

	const padKey = gp.index;
	if (!prevGamepadButtons.has(padKey)) {
		prevGamepadButtons.set(padKey, {});
	}
	const prev = prevGamepadButtons.get(padKey);
	const modifierHeld = isHandModifierHeld(gp);

	for (const action of Object.keys(DEFAULT_GAMEPAD_BUTTONS)) {
		const binding = getBindingButtonIndex(action);
		if (!binding || !bindingMatchesModifier(binding, modifierHeld)) continue;
		const index = binding.index;
		const pressed = isButtonPressed(gp, index);
		const wasPressed = !!prev[action];
		prev[action] = pressed;
		if (pressed && !wasPressed) {
			if (action === 'toggleDeckViewer') {
				callbacks.onToggleDeck?.();
			} else {
				const slotMatch = action.match(/^useSlot(\d)$/);
				if (slotMatch) callbacks.onUseSlot?.(parseInt(slotMatch[1], 10));
			}
		}
	}
}

/** @returns {Record<string, string>} */
export function getActionLabels() {
	return {
		moveUp: 'Move up',
		moveDown: 'Move down',
		moveLeft: 'Move left',
		moveRight: 'Move right',
		useSlot0: 'Hand slot 1',
		useSlot1: 'Hand slot 2',
		useSlot2: 'Hand slot 3',
		useSlot3: 'Hand slot 4',
		useSlot4: 'Hand slot 5',
		useSlot5: 'Hand slot 6',
		toggleDeckViewer: 'Toggle deck viewer',
	};
}

export function getDefaultGamepadButtonIndex(action) {
	const binding = DEFAULT_GAMEPAD_BUTTONS[action];
	return binding === undefined ? undefined : binding;
}

export function getHandModifierGamepadButton() {
	const cfg = getGamepadConfig();
	return Number.isInteger(cfg.modifierButton) ? cfg.modifierButton : HAND_MODIFIER_GAMEPAD_BUTTON;
}

/** Test-only: reset key state */
export function resetInputState() {
	for (const k of Object.keys(keyState)) keyState[k] = false;
	prevGamepadButtons.clear();
}
