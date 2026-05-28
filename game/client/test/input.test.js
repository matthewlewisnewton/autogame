import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	initInput,
	getMovementDirection,
	pollInput,
	resetInputState,
	getActionLabels,
	getDefaultGamepadButtonIndex,
	ACTIONS
} from '../input.js';
import { mockGamepad, clearMockGamepads, installGamepadMock, uninstallGamepadMock } from './gamepad-mock.js';
import { patchSettings } from '../settings.js';

describe('input.js', () => {
	beforeEach(() => {
		resetInputState();
		installGamepadMock();
		clearMockGamepads();
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
});
