import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	initInput,
	getMovementDirection,
	pollInput,
	resetInputState,
	getActionLabels,
	getDefaultGamepadButtonIndex,
	getHandSlotInputHints,
	getHandSlotGamepadHints,
	is8BitDo64HandHintsActive,
	getUseKeyItemBinding,
	ACTIONS
} from '../input.js';
import { mockGamepad, clearMockGamepads, installGamepadMock, uninstallGamepadMock } from './gamepad-mock.js';
import { patchSettings, getDefaultSettings, getSettings } from '../settings.js';

describe('input.js', () => {
	beforeEach(() => {
		resetInputState();
		installGamepadMock();
		clearMockGamepads();
		patchSettings(getDefaultSettings());
		const settings = getSettings();
		settings.gamepad.bindings = {};
		settings.gamepad.profile = 'auto';
	});

	afterEach(() => {
		uninstallGamepadMock();
		resetInputState();
	});

	it('keyboard W produces upward movement', () => {
		initInput({});
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
		const dir = getMovementDirection();
		expect(dir.mag).toBeGreaterThan(0);
		expect(dir.dz).toBeLessThan(0);
		window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
	});

	it('keyboard keys 1–6 trigger hand slots 0–5', () => {
		const onUseSlot = vi.fn();
		initInput({
			onUseSlot,
			canUseGameActions: () => true,
		});

		for (let slot = 0; slot < 6; slot++) {
			window.dispatchEvent(new KeyboardEvent('keydown', { key: String(slot + 1) }));
		}

		expect(onUseSlot.mock.calls.map((call) => call[0])).toEqual([0, 1, 2, 3, 4, 5]);
	});

	it('gamepad left stick above deadzone moves', () => {
		initInput({});
		mockGamepad(0, { axes: [0, -0.9, 0, 0], buttons: [] });
		const dir = getMovementDirection();
		expect(dir.mag).toBeGreaterThan(0);
		expect(dir.dz).toBeLessThan(0);
	});

	it('default gamepad buttons 0–5 trigger hand slots 0–5', () => {
		const onUseSlot = vi.fn();
		initInput({
			onUseSlot,
			canUseGameActions: () => true,
		});

		for (let buttonIndex = 0; buttonIndex < 6; buttonIndex++) {
			resetInputState();
			installGamepadMock();
			const buttons = Array(6).fill({ pressed: false, value: 0 });
			buttons[buttonIndex] = { pressed: true, value: 1 };
			mockGamepad(0, { buttons, axes: [0, 0, 0, 0] });
			pollInput();
			expect(onUseSlot).toHaveBeenCalledWith(buttonIndex);
			onUseSlot.mockClear();
		}
	});

	it('gamepad button 0 triggers onUseSlot(0)', () => {
		const onUseSlot = vi.fn();
		initInput({
			onUseSlot,
			canUseGameActions: () => true
		});
		mockGamepad(0, {
			buttons: [{ pressed: true, value: 1 }],
			axes: [0, 0, 0, 0]
		});
		pollInput();
		expect(onUseSlot).toHaveBeenCalledWith(0);
	});

	it('custom gamepad binding triggers remapped slot', () => {
		patchSettings({
			gamepad: { bindings: { useSlot2: { type: 'button', index: 5 } } }
		});

		const onUseSlot = vi.fn();
		initInput({
			onUseSlot,
			canUseGameActions: () => true
		});
		const buttons = Array(6).fill({ pressed: false, value: 0 });
		buttons[5] = { pressed: true, value: 1 };
		mockGamepad(0, { buttons, axes: [0, 0, 0, 0] });
		pollInput();
		expect(onUseSlot).toHaveBeenCalledWith(2);
	});

	it('custom gamepad binding can remap hand slot 6 to a different button', () => {
		patchSettings({
			gamepad: { bindings: { useSlot5: { type: 'button', index: 9, modifier: false } } }
		});

		const onUseSlot = vi.fn();
		initInput({
			onUseSlot,
			canUseGameActions: () => true,
		});
		const buttons = Array(10).fill({ pressed: false, value: 0 });
		buttons[9] = { pressed: true, value: 1 };
		mockGamepad(0, { buttons, axes: [0, 0, 0, 0] });
		pollInput();
		expect(onUseSlot).toHaveBeenCalledWith(5);
	});

	it('gamepad Select toggles deck viewer when remapped default button is pressed', () => {
		const onToggleDeck = vi.fn();
		initInput({
			onToggleDeck,
			canUseGameActions: () => true,
		});
		const buttons = Array(9).fill({ pressed: false, value: 0 });
		buttons[8] = { pressed: true, value: 1 };
		mockGamepad(0, { buttons, axes: [0, 0, 0, 0] });
		pollInput();
		expect(onToggleDeck).toHaveBeenCalledTimes(1);
	});

	it('does not fire gamepad actions when canUseGameActions is false', () => {
		const onUseSlot = vi.fn();
		initInput({
			onUseSlot,
			canUseGameActions: () => false
		});
		mockGamepad(0, {
			buttons: [{ pressed: true, value: 1 }],
			axes: [0, 0, 0, 0]
		});
		pollInput();
		expect(onUseSlot).not.toHaveBeenCalled();
	});

	it('does not fire held buttons when gameplay actions first become enabled', () => {
		const onUseSlot = vi.fn();
		let actionsEnabled = false;
		initInput({
			onUseSlot,
			canUseGameActions: () => actionsEnabled,
		});
		const buttons = Array(10).fill({ pressed: false, value: 0 });
		buttons[0] = { pressed: true, value: 1 };
		mockGamepad(0, { buttons, axes: [0, 0, 0, 0] });
		pollInput();
		pollInput();
		actionsEnabled = true;
		pollInput();
		expect(onUseSlot).not.toHaveBeenCalled();
	});

	it('modifier bindings only fire while R trigger is held', () => {
		patchSettings({
			gamepad: { modifierButton: 7 },
		});

		const onUseSlot = vi.fn();
		initInput({
			onUseSlot,
			canUseGameActions: () => true,
		});

		const buttons = Array(8).fill({ pressed: false, value: 0 });
		buttons[0] = { pressed: true, value: 1 };
		mockGamepad(0, { buttons, axes: [0, 0, 0, 0] });
		pollInput();
		expect(onUseSlot).toHaveBeenCalledWith(0);
		onUseSlot.mockClear();

		resetInputState();
		installGamepadMock();
		buttons[0] = { pressed: true, value: 1 };
		buttons[7] = { pressed: true, value: 1 };
		mockGamepad(0, { buttons, axes: [0, 0, 0, 0] });
		pollInput();
		expect(onUseSlot).not.toHaveBeenCalled();
	});

	it('exposes labels and defaults for all six hand slots', () => {
		expect(getActionLabels()).toMatchObject({
			useSlot4: 'Hand slot 5',
			useSlot5: 'Hand slot 6',
		});
		expect(getDefaultGamepadButtonIndex(ACTIONS.useSlot4)).toBe(4);
		expect(getDefaultGamepadButtonIndex(ACTIONS.useSlot5)).toBe(5);
	});

	it('8BitDo 64 profile maps C-left to hand slot 5 via discrete button', () => {
		patchSettings({ gamepad: { profile: '8bitdo-64' } });
		const onUseSlot = vi.fn();
		initInput({
			onUseSlot,
			canUseGameActions: () => true,
		});

		const buttons = Array(14).fill({ pressed: false, value: 0 });
		buttons[4] = { pressed: true, value: 1 };
		mockGamepad(0, {
			id: '8BitDo 64 (Vendor: 2dc8 Product: 1930)',
			buttons,
			axes: [0, 0, 0, 0],
		});
		pollInput();
		expect(onUseSlot).toHaveBeenCalledWith(4);
	});

	it('8BitDo 64 profile maps C-up and C-down to hand slots 3 and 4', () => {
		patchSettings({ gamepad: { profile: '8bitdo-64' } });
		const onUseSlot = vi.fn();
		initInput({
			onUseSlot,
			canUseGameActions: () => true,
		});

		const upButtons = Array(14).fill({ pressed: false, value: 0 });
		upButtons[2] = { pressed: true, value: 1 };
		mockGamepad(0, {
			id: '8BitDo 64 (Vendor: 2dc8 Product: 1930)',
			buttons: upButtons,
			axes: [0, 0, 0, 0.5, 0.5],
		});
		pollInput();
		expect(onUseSlot).toHaveBeenCalledWith(2);

		onUseSlot.mockClear();
		const downButtons = Array(14).fill({ pressed: false, value: 0 });
		downButtons[3] = { pressed: true, value: 1 };
		mockGamepad(0, {
			id: '8BitDo 64 (Vendor: 2dc8 Product: 1930)',
			buttons: downButtons,
			axes: [0, 0, 0, 0.5, 0.5],
		});
		pollInput();
		expect(onUseSlot).toHaveBeenCalledWith(3);
	});

	it('exposes 8BitDo 64 hand slot button hints when that profile is selected', () => {
		patchSettings({ gamepad: { profile: '8bitdo-64' } });
		expect(is8BitDo64HandHintsActive()).toBe(true);
		const result = getHandSlotInputHints();
		expect(result.mode).toBe('gamepad');
		expect(result.hints.slice(0, 2)).toEqual(['A', 'B']);
		expect(result.hintLabels).toEqual(['A', 'B', 'C up', 'C down', 'C left', 'C right']);
		expect(result.hints[2]).toContain('c-button-mark');
		expect(result.hints[3]).toContain('rotate(180 6 6)');
		expect(result.hints[4]).toContain('rotate(-90 6 6)');
		expect(result.hints[5]).toContain('rotate(90 6 6)');
		expect(getHandSlotGamepadHints()?.slice(0, 2)).toEqual(['A', 'B']);
	});

	it('exposes standard gamepad face button hints when that profile is selected', () => {
		patchSettings({ gamepad: { profile: 'standard' } });
		expect(getHandSlotInputHints()).toEqual({
			mode: 'gamepad',
			hints: ['A', 'B', 'X', 'Y', 'LB', 'RB'],
			hintLabels: ['A', 'B', 'X', 'Y', 'LB', 'RB'],
		});
	});

	it('uses keyboard number hints when auto profile has no connected gamepad', () => {
		patchSettings({ gamepad: { profile: 'auto' } });
		expect(getHandSlotInputHints()).toEqual({
			mode: 'keyboard',
			hints: ['1', '2', '3', '4', '5', '6'],
		});
		expect(getHandSlotGamepadHints()).toBeNull();
	});

	it('uses gamepad hints in auto profile when a controller is connected', () => {
		patchSettings({ gamepad: { profile: 'auto' } });
		mockGamepad(0, { id: 'Xbox 360 Controller (XInput)', buttons: [], axes: [0, 0, 0, 0] });
		expect(getHandSlotInputHints()).toEqual({
			mode: 'gamepad',
			hints: ['A', 'B', 'X', 'Y', 'LB', 'RB'],
			hintLabels: ['A', 'B', 'X', 'Y', 'LB', 'RB'],
		});
	});

	it('hides legacy gamepad-only hints for the standard profile', () => {
		patchSettings({ gamepad: { profile: 'standard' } });
		expect(is8BitDo64HandHintsActive()).toBe(false);
		expect(getHandSlotGamepadHints()).toBeNull();
	});

	it('keyboard E triggers useKeyItem by default', () => {
		const onUseKeyItem = vi.fn();
		initInput({
			onUseKeyItem,
			canUseGameActions: () => true,
		});
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
		expect(onUseKeyItem).toHaveBeenCalledTimes(1);
	});

	it('custom keyboard binding for useKeyItem overrides default', () => {
		patchSettings({ keyboard: { bindings: { useKeyItem: 'u' } } });
		const onUseKeyItem = vi.fn();
		initInput({
			onUseKeyItem,
			canUseGameActions: () => true,
		});
		// Default 'e' should NOT trigger
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
		expect(onUseKeyItem).not.toHaveBeenCalled();
		// Custom 'u' should trigger
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u' }));
		expect(onUseKeyItem).toHaveBeenCalledTimes(1);
	});

	it('getUseKeyItemBinding returns default binding', () => {
		patchSettings(getDefaultSettings());
		getSettings().keyboard.bindings = { useKeyItem: 'e' };
		getSettings().gamepad.bindings = {};
		const binding = getUseKeyItemBinding();
		expect(binding.keyboard).toBe('e');
		expect(binding.gamepad).toBe(13);
	});

	it('getUseKeyItemBinding reflects custom keyboard binding', () => {
		patchSettings({ keyboard: { bindings: { useKeyItem: 'r' } } });
		const binding = getUseKeyItemBinding();
		expect(binding.keyboard).toBe('r');
	});

	it('getUseKeyItemBinding reflects custom gamepad binding', () => {
		patchSettings({ gamepad: { bindings: { useKeyItem: { type: 'button', index: 4 } } } });
		const binding = getUseKeyItemBinding();
		expect(binding.gamepad).toBe(4);
	});
});
