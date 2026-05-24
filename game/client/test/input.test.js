import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	initInput,
	getMovementDirection,
	pollInput,
	resetInputState,
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

	it('gamepad left stick above deadzone moves', () => {
		initInput({});
		mockGamepad(0, { axes: [0, -0.9, 0, 0], buttons: [] });
		const dir = getMovementDirection();
		expect(dir.mag).toBeGreaterThan(0);
		expect(dir.dz).toBeLessThan(0);
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
});
