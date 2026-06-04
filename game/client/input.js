// Unified keyboard + gamepad input with remappable gamepad bindings.
//
// Gamepad hand palettes (keyboard uses direct keys 1–6 only, no modifier layer):
//   Primary:    face buttons / C-buttons → slots 1–6 (profile-dependent)
//   Secondary:  hold modifier (RT on standard, L on 8BitDo 64) → extended slots
//   Lock-on:    LT (standard) or Z (8BitDo 64) — handled in gamepad.js

import { pollGamepadMovement, pollGamepadButtons, mergeMovementVectors } from './gamepad.js';
import { getGamepadConfig, getKeyboardBindings } from './settings.js';
import { HAND_MODIFIER_GAMEPAD_BUTTON } from './config.js';
import { renderCButtonMark, getCButtonAccessibleLabel } from './c-button-icons.js';
import {
	resolveGamepadProfile,
	isBindingActive,
	STANDARD_PROFILE,
	EIGHTBITDO_64_PROFILE,
	getPrimaryGamepad as getProfilePrimaryGamepad,
} from './gamepad-profiles.js';

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
	toggleDeckViewer: 'toggleDeckViewer',
	useKeyItem: 'useKeyItem',
	lockOn: 'lockOn',
	dodge: 'dodge',
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
	toggleDeckViewer: ['v'],
	useKeyItem: ['e'],
	lockOn: ['z'],
	dodge: [],
};

const DEFAULT_GAMEPAD_BUTTONS = {
	useSlot0: 0,
	useSlot1: 1,
	useSlot2: 2,
	useSlot3: 3,
	useSlot4: 4,
	useSlot5: 5,
	toggleDeckViewer: 8,
	useKeyItem: 13
};

const POLLABLE_ACTIONS = Object.keys(DEFAULT_GAMEPAD_BUTTONS);

const keyState = {
	moveUp: false,
	moveDown: false,
	moveLeft: false,
	moveRight: false
};

/** @type {{ onUseSlot?: (n: number) => void, onToggleDeck?: () => void, onUseKeyItem?: () => void, onLockOn?: () => void, canUseGameActions?: () => boolean }} */
let callbacks = {};
let listenersAdded = false;
const prevGamepadButtons = new Map();

/**
 * @param {{ onMove?: never, onUseSlot?: (slot: number) => void, onToggleDeck?: () => void, onUseKeyItem?: () => void, onLockOn?: () => void, canUseGameActions?: () => boolean }} opts
 */
export function initInput(opts = {}) {
	callbacks = opts;
	if (!listenersAdded) {
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		listenersAdded = true;
	}
}

function isTypingTarget(target) {
	return target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target?.isContentEditable;
}

function onKeyDown(e) {
	if (isTypingTarget(e.target)) return;
	if (e.repeat) return;
	const key = e.key.toLowerCase();
	const kbBindings = getKeyboardBindings();
	for (const [action, keys] of Object.entries(DEFAULT_KEYBOARD)) {
		let matchedKeys = keys;
		// For useKeyItem, check custom keyboard binding from settings first
		if (action === 'useKeyItem' && kbBindings.useKeyItem) {
			matchedKeys = [kbBindings.useKeyItem.toLowerCase()];
		}
		if (!matchedKeys.includes(key)) continue;
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
		if (action === 'useKeyItem') {
			e.preventDefault();
			callbacks.onUseKeyItem?.();
			return;
		}
		if (action === 'lockOn') {
			e.preventDefault();
			callbacks.onLockOn?.();
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

function getPrimaryGamepad() {
	const cfg = getGamepadConfig();
	return getProfilePrimaryGamepad(cfg.profile ?? 'auto');
}

function getActiveProfile(gamepad) {
	const cfg = getGamepadConfig();
	return resolveGamepadProfile(gamepad, cfg.profile ?? 'auto');
}

function getModifierButtonIndex(gamepad) {
	const cfg = getGamepadConfig();
	if (Number.isInteger(cfg.modifierButton)) return cfg.modifierButton;
	return getActiveProfile(gamepad).modifierButton ?? HAND_MODIFIER_GAMEPAD_BUTTON;
}

function isHandModifierHeld(gp) {
	return isButtonPressed(gp, getModifierButtonIndex(gp));
}

function bindingMatchesModifier(binding, modifierHeld) {
	if (!binding) return false;
	const wantsModifier = binding.modifier === true;
	return wantsModifier ? modifierHeld : !modifierHeld;
}

function getBindingForAction(action, gamepad) {
	const cfg = getGamepadConfig();
	const custom = cfg.bindings && cfg.bindings[action];
	if (custom && (custom.type === 'button' || custom.type === 'axis' || custom.type === 'cButton')) {
		return custom;
	}
	const profile = getActiveProfile(gamepad);
	return profile.bindings[action] ?? null;
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

	let keyboardVec = null;
	const kbMag = Math.hypot(dirX, dirZ);
	if (kbMag > 0) {
		// Map keyboard axes into gamepad stick space (world dz = -stick.z).
		keyboardVec = { x: dirX / kbMag, z: -dirZ / kbMag };
	}

	let stickVec = null;
	const gp = getPrimaryGamepad();
	if (gp) {
		const cfg = getGamepadConfig();
		const profile = getActiveProfile(gp);
		const deadzone = cfg.deadzone ?? 0.15;
		const moveStick = cfg.moveStick ?? profile.moveStick ?? 'left';
		stickVec = pollGamepadMovement(deadzone, moveStick);
	}

	const merged = mergeMovementVectors(keyboardVec, stickVec);
	if (merged) {
		const mag = Math.hypot(merged.x, merged.z);
		return { dx: merged.x, dz: -merged.z, mag };
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
	const actionsEnabled = !callbacks.canUseGameActions || callbacks.canUseGameActions();
	const gp = getPrimaryGamepad();

	if (gp) {
		const padKey = gp.index;
		if (!prevGamepadButtons.has(padKey)) {
			prevGamepadButtons.set(padKey, {});
		}
		const prev = prevGamepadButtons.get(padKey);
		const modifierHeld = isHandModifierHeld(gp);

		for (const action of POLLABLE_ACTIONS) {
			const binding = getBindingForAction(action, gp);
			if (!binding || !bindingMatchesModifier(binding, modifierHeld)) continue;
			const pressed = isBindingActive(gp, binding);
			const wasPressed = !!prev[action];
			prev[action] = pressed;
			if (actionsEnabled && pressed && !wasPressed) {
				if (action === 'toggleDeckViewer') {
					callbacks.onToggleDeck?.();
				} else if (action === 'useKeyItem') {
					callbacks.onUseKeyItem?.();
				} else {
					const slotMatch = action.match(/^useSlot(\d)$/);
					if (slotMatch) callbacks.onUseSlot?.(parseInt(slotMatch[1], 10));
				}
			}
		}
	}

	if (actionsEnabled) {
		const { lockOn } = pollGamepadButtons();
		if (lockOn) callbacks.onLockOn?.();
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
		useKeyItem: 'Use key item',
		lockOn: 'Lock on',
		dodge: 'Dodge',
	};
}

export function getDefaultGamepadButtonIndex(action) {
	const binding = STANDARD_PROFILE.bindings[action];
	if (!binding || binding.type !== 'button') return undefined;
	return binding.index;
}

const STANDARD_BUTTON_HINTS = {
	0: 'A',
	1: 'B',
	2: 'X',
	3: 'Y',
	4: 'LB',
	5: 'RB',
	6: 'LT',
	7: 'RT',
	8: 'Back',
	9: 'Start',
	12: 'DPad Up',
	13: 'DPad Down',
	14: 'DPad Left',
	15: 'DPad Right',
};

const EIGHTBITDO_64_SLOT_HINTS = {
	useSlot0: 'A',
	useSlot1: 'B',
	useSlot2: renderCButtonMark('up'),
	useSlot3: renderCButtonMark('down'),
	useSlot4: renderCButtonMark('left'),
	useSlot5: renderCButtonMark('right'),
};

const EIGHTBITDO_64_SLOT_HINT_LABELS = {
	useSlot0: 'A',
	useSlot1: 'B',
	useSlot2: getCButtonAccessibleLabel('up'),
	useSlot3: getCButtonAccessibleLabel('down'),
	useSlot4: getCButtonAccessibleLabel('left'),
	useSlot5: getCButtonAccessibleLabel('right'),
};

const KEYBOARD_SLOT_HINTS = ['1', '2', '3', '4', '5', '6'];

/**
 * @param {import('./gamepad-profiles.js').GamepadBinding | null | undefined} binding
 * @param {number} slotIndex
 * @returns {string}
 */
function describeStandardHandSlotBindingHint(binding, slotIndex) {
	if (binding?.type === 'button' && STANDARD_BUTTON_HINTS[binding.index]) {
		return STANDARD_BUTTON_HINTS[binding.index];
	}
	if (binding?.type === 'button') return `Btn ${binding.index}`;
	return KEYBOARD_SLOT_HINTS[slotIndex] ?? String(slotIndex + 1);
}

/**
 * @param {import('./gamepad-profiles.js').GamepadBinding | null | undefined} binding
 * @param {number} slotIndex
 * @returns {string}
 */
function describe8BitDo64HandSlotBindingHint(binding, slotIndex) {
	if (binding?.type === 'cButton') {
		return renderCButtonMark(binding.direction);
	}
	if (binding?.type === 'button' && binding.index === 0) return 'A';
	if (binding?.type === 'button' && binding.index === 1) return 'B';
	if (binding?.type === 'button') return `Btn ${binding.index}`;
	return EIGHTBITDO_64_SLOT_HINTS[`useSlot${slotIndex}`] ?? String(slotIndex + 1);
}

function describe8BitDo64HandSlotBindingHintLabel(binding, slotIndex) {
	if (binding?.type === 'cButton') {
		return getCButtonAccessibleLabel(binding.direction);
	}
	if (binding?.type === 'button' && binding.index === 0) return 'A';
	if (binding?.type === 'button' && binding.index === 1) return 'B';
	if (binding?.type === 'button') return `Button ${binding.index}`;
	return EIGHTBITDO_64_SLOT_HINT_LABELS[`useSlot${slotIndex}`] ?? String(slotIndex + 1);
}

/** @returns {boolean} */
function isGamepadInputHintsActive() {
	const cfg = getGamepadConfig();
	const profileId = cfg.profile ?? 'auto';
	if (profileId === 'standard' || profileId === '8bitdo-64') return true;
	if (profileId === 'auto') return !!getPrimaryGamepad();
	return false;
}

/** True when the active gamepad profile is the 8BitDo 64 layout. */
export function is8BitDo64HandHintsActive() {
	const cfg = getGamepadConfig();
	const profileId = cfg.profile ?? 'auto';
	if (profileId === '8bitdo-64') return true;
	if (profileId === 'auto') {
		const gp = getPrimaryGamepad();
		return gp ? getActiveProfile(gp).id === '8bitdo-64' : false;
	}
	return false;
}

/**
 * Input hint badges for each hand slot.
 * @returns {{ mode: 'keyboard' | 'gamepad', hints: string[], hintLabels?: string[] }}
 */
export function getHandSlotInputHints() {
	if (!isGamepadInputHintsActive()) {
		return { mode: 'keyboard', hints: [...KEYBOARD_SLOT_HINTS] };
	}

	const gp = getPrimaryGamepad();
	const profile = getActiveProfile(gp);
	const hints = [];
	const hintLabels = [];

	for (let i = 0; i < 6; i++) {
		const action = `useSlot${i}`;
		const binding = getBindingForAction(action, gp);
		if (profile.id === '8bitdo-64') {
			hints.push(
				EIGHTBITDO_64_SLOT_HINTS[action]
				?? describe8BitDo64HandSlotBindingHint(binding, i),
			);
			hintLabels.push(
				EIGHTBITDO_64_SLOT_HINT_LABELS[action]
				?? describe8BitDo64HandSlotBindingHintLabel(binding, i),
			);
		} else {
			hints.push(describeStandardHandSlotBindingHint(binding, i));
			hintLabels.push(hints[hints.length - 1]);
		}
	}

	return { mode: 'gamepad', hints, hintLabels };
}

/** @deprecated Use getHandSlotInputHints() */
export function getHandSlotGamepadHints() {
	const result = getHandSlotInputHints();
	if (result.mode !== 'gamepad' || !is8BitDo64HandHintsActive()) return null;
	return result.hints;
}

export function getHandModifierGamepadButton() {
	const gp = getPrimaryGamepad();
	if (gp) return getModifierButtonIndex(gp);
	const cfg = getGamepadConfig();
	return Number.isInteger(cfg.modifierButton) ? cfg.modifierButton : HAND_MODIFIER_GAMEPAD_BUTTON;
}

/**
 * Resolved binding for useKeyItem action.
 * @returns {{ keyboard: string, gamepad: number, gamepadHint: string }}
 */
export function getUseKeyItemBinding() {
	const kbBindings = getKeyboardBindings();
	const keyboardKey = (kbBindings.useKeyItem || 'e').toLowerCase();
	const cfg = getGamepadConfig();
	const customGamepad = cfg.bindings && cfg.bindings.useKeyItem;
	let gamepadIndex = DEFAULT_GAMEPAD_BUTTONS.useKeyItem;
	if (customGamepad && customGamepad.type === 'button' && Number.isInteger(customGamepad.index)) {
		gamepadIndex = customGamepad.index;
	}
	let gamepadHint;
	if (is8BitDo64HandHintsActive()) {
		const label = EIGHTBITDO_64_PROFILE.buttonLabels.find((l) => l.index === gamepadIndex);
		gamepadHint = label ? label.label : `Btn ${gamepadIndex}`;
	} else {
		gamepadHint = STANDARD_BUTTON_HINTS[gamepadIndex] ?? `Btn ${gamepadIndex}`;
	}
	return { keyboard: keyboardKey, gamepad: gamepadIndex, gamepadHint };
}

/** Test-only: reset key state */
export function resetInputState() {
	for (const k of Object.keys(keyState)) keyState[k] = false;
	prevGamepadButtons.clear();
}

/** @returns {Gamepad | null} */
export { getPrimaryGamepad };
