import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	resolveGamepadProfile,
	isBindingActive,
	EIGHTBITDO_64_PROFILE,
	EIGHTBITDO_64_LOCK_ON_BUTTON,
	EIGHTBITDO_64_RIGHT_TRIGGER_BUTTON,
	EIGHTBITDO_64_TRIGGER_BUTTON_INDICES,
	describeActiveGamepadProfile,
	is8BitDo64Gamepad,
	read8BitDo64CButtonState,
	read8BitDo64CStickHorizontal,
	isProfileLockOnPressed,
} from '../gamepad-profiles.js';
import { mockGamepad, clearMockGamepads, installGamepadMock, uninstallGamepadMock } from './gamepad-mock.js';

describe('8BitDo 64 profile', () => {
	beforeEach(() => {
		installGamepadMock();
		clearMockGamepads();
	});

	afterEach(() => {
		uninstallGamepadMock();
	});

	it('auto-detects the 8BitDo 64 by name and product id', () => {
		mockGamepad(0, { id: '8BitDo 64 (Vendor: 2dc8 Product: 1930)' });
		const pad = navigator.getGamepads()[0];
		expect(is8BitDo64Gamepad(pad)).toBe(true);
		expect(resolveGamepadProfile(pad, 'auto').id).toBe('8bitdo-64');
		expect(describeActiveGamepadProfile(pad, 'auto')).toContain('8BitDo 64');
	});

	it('maps N64 controls to hand slots and lock-on', () => {
		expect(EIGHTBITDO_64_PROFILE.lockOnButton).toBe(EIGHTBITDO_64_LOCK_ON_BUTTON);
		expect(EIGHTBITDO_64_PROFILE.bindings.useSlot0).toEqual({ type: 'button', index: 0 });
		expect(EIGHTBITDO_64_PROFILE.bindings.useSlot2).toMatchObject({ type: 'cButton', direction: 'up' });
	});

	it('reads C-buttons from discrete browser buttons 2–5', () => {
		const buttons = Array(12).fill({ pressed: false, value: 0 });
		buttons[2] = { pressed: true, value: 1 };
		mockGamepad(0, { id: '8BitDo 64', axes: [0, 0, 0, 0, 0, 0], buttons });
		const pad = navigator.getGamepads()[0];
		expect(read8BitDo64CButtonState(pad).up).toBe(true);
		expect(read8BitDo64CButtonState(pad).left).toBe(false);
		expect(isBindingActive(pad, EIGHTBITDO_64_PROFILE.bindings.useSlot2)).toBe(true);
	});

	it('does not cross-trigger left/right when pressing discrete C up/down', () => {
		const buttons = Array(12).fill({ pressed: false, value: 0 });
		buttons[2] = { pressed: true, value: 1 };
		mockGamepad(0, {
			id: '8BitDo 64',
			axes: [0, 0, 0.2, -0.8, 0.9, -0.9],
			buttons,
		});
		const pad = navigator.getGamepads()[0];
		const state = read8BitDo64CButtonState(pad);
		expect(state.up).toBe(true);
		expect(state.left).toBe(false);
		expect(state.right).toBe(false);
	});

	it('reads C-right from discrete button 5 and axis 2', () => {
		const buttons = Array(12).fill({ pressed: false, value: 0 });
		buttons[5] = { pressed: true, value: 1 };
		mockGamepad(0, { id: '8BitDo 64', axes: [0, 0, 0, 0], buttons });
		expect(read8BitDo64CButtonState(navigator.getGamepads()[0]).right).toBe(true);

		clearMockGamepads();
		mockGamepad(0, { id: '8BitDo 64', axes: [0, 0, 0.9, 0.2, 0, 0], buttons: [] });
		expect(read8BitDo64CButtonState(navigator.getGamepads()[0]).right).toBe(true);
	});

	it('reserves R trigger (button 9) instead of C-right', () => {
		const buttons = Array(12).fill({ pressed: false, value: 0 });
		buttons[9] = { pressed: false, value: 0.25 };
		mockGamepad(0, { id: '8BitDo 64', axes: [0, 0, 0, 0], buttons });
		const pad = navigator.getGamepads()[0];
		expect(read8BitDo64CButtonState(pad).right).toBe(false);
		expect(isBindingActive(pad, EIGHTBITDO_64_PROFILE.bindings.useSlot5)).toBe(false);
	});

	it('reads C-up from a low analog button value on index 2', () => {
		const buttons = Array(12).fill({ pressed: false, value: 0 });
		buttons[2] = { pressed: false, value: 0.25 };
		mockGamepad(0, { id: '8BitDo 64', axes: [0, 0, 0, 0], buttons });
		const pad = navigator.getGamepads()[0];
		expect(read8BitDo64CButtonState(pad).up).toBe(true);
	});

	it('reads C-down from browser button 3', () => {
		const buttons = Array(12).fill({ pressed: false, value: 0 });
		buttons[3] = { pressed: true, value: 1 };
		mockGamepad(0, { id: '8BitDo 64', axes: [0, 0, 0, 0], buttons });
		const state = read8BitDo64CButtonState(navigator.getGamepads()[0]);
		expect(state.down).toBe(true);
		expect(state.up).toBe(false);
		expect(isBindingActive(navigator.getGamepads()[0], EIGHTBITDO_64_PROFILE.bindings.useSlot3)).toBe(true);
	});

	it('does not read C-up/down from axis 3 trigger rest bias', () => {
		mockGamepad(0, { id: '8BitDo 64', axes: [0, 0, 0.55, 0.85], buttons: [] });
		const state = read8BitDo64CButtonState(navigator.getGamepads()[0]);
		expect(state.up).toBe(false);
		expect(state.down).toBe(false);
	});

	it('reads C-left/right from axis 2 when horizontal motion dominates', () => {
		mockGamepad(0, { id: '8BitDo 64', axes: [0, 0, -0.9, 0.2, 0, 0], buttons: [] });
		const pad = navigator.getGamepads()[0];
		expect(read8BitDo64CButtonState(pad).left).toBe(true);
		expect(read8BitDo64CButtonState(pad).up).toBe(false);

		clearMockGamepads();
		mockGamepad(0, { id: '8BitDo 64', axes: [0, 0, 0.9, -0.2, 0, 0], buttons: [] });
		expect(read8BitDo64CButtonState(navigator.getGamepads()[0]).right).toBe(true);
	});

	it('does not map digital C-buttons to camera look', () => {
		const buttonsLeft = Array(12).fill({ pressed: false, value: 0 });
		buttonsLeft[4] = { pressed: true, value: 1 };
		mockGamepad(0, { id: '8BitDo 64', axes: [0, 0, 0, 0], buttons: buttonsLeft });
		expect(read8BitDo64CStickHorizontal(navigator.getGamepads()[0])).toBe(0);

		clearMockGamepads();
		const buttonsRight = Array(12).fill({ pressed: false, value: 0 });
		buttonsRight[5] = { pressed: true, value: 1 };
		mockGamepad(0, { id: '8BitDo 64', axes: [0, 0, 0, 0], buttons: buttonsRight });
		expect(read8BitDo64CStickHorizontal(navigator.getGamepads()[0])).toBe(0);
	});

	it('isProfileLockOnPressed is false when Z (button 8) is idle', () => {
		const buttons = Array(12).fill({ pressed: false, value: 0 });
		buttons[8] = { pressed: false, value: 0.1 };
		mockGamepad(0, { id: '8BitDo 64', axes: [0, 0, 0, 0], buttons });
		const pad = navigator.getGamepads()[0];
		expect(isProfileLockOnPressed(pad, EIGHTBITDO_64_PROFILE)).toBe(false);
	});

	it('reserves Z (button 8) for lock-on instead of C-down', () => {
		const buttons = Array(12).fill({ pressed: false, value: 0 });
		buttons[8] = { pressed: false, value: 0.25 };
		mockGamepad(0, { id: '8BitDo 64', axes: [0, 0, 0, 0], buttons });
		const pad = navigator.getGamepads()[0];
		expect(isProfileLockOnPressed(pad, EIGHTBITDO_64_PROFILE)).toBe(true);
		expect(read8BitDo64CButtonState(pad).down).toBe(false);
		expect(isBindingActive(pad, EIGHTBITDO_64_PROFILE.bindings.useSlot3)).toBe(false);
	});

	it('documents Z/R trigger button indices separately from C inputs', () => {
		expect(EIGHTBITDO_64_TRIGGER_BUTTON_INDICES).toEqual([
			EIGHTBITDO_64_LOCK_ON_BUTTON,
			EIGHTBITDO_64_RIGHT_TRIGGER_BUTTON,
		]);
	});

	it('auto-detects Bluetooth 8BitDo 64 by product id 3019', () => {
		mockGamepad(0, { id: '8BitDo 64 Bluetooth Controller (Vendor: 2dc8 Product: 3019)' });
		const pad = navigator.getGamepads()[0];
		expect(is8BitDo64Gamepad(pad)).toBe(true);
		expect(resolveGamepadProfile(pad, 'auto').id).toBe('8bitdo-64');
	});

	it('reads C-up/down from axis 5 on Bluetooth 8BitDo 64', () => {
		mockGamepad(0, {
			id: '8BitDo 64 Bluetooth Controller (Vendor: 2dc8 Product: 3019)',
			axes: [0.004, 0.004, -0.004, -1, -1, 1, 0, 0],
			buttons: [],
		});
		const pad = navigator.getGamepads()[0];
		expect(read8BitDo64CButtonState(pad).down).toBe(true);
		expect(read8BitDo64CButtonState(pad).up).toBe(false);
		expect(isBindingActive(pad, EIGHTBITDO_64_PROFILE.bindings.useSlot3)).toBe(true);

		clearMockGamepads();
		mockGamepad(0, {
			id: '8BitDo 64 Bluetooth Controller (Vendor: 2dc8 Product: 3019)',
			axes: [0.004, 0.004, -0.004, -1, -1, -1, 0, 0],
			buttons: [],
		});
		const upPad = navigator.getGamepads()[0];
		expect(read8BitDo64CButtonState(upPad).up).toBe(true);
		expect(read8BitDo64CButtonState(upPad).down).toBe(false);
		expect(isBindingActive(upPad, EIGHTBITDO_64_PROFILE.bindings.useSlot2)).toBe(true);
	});
});
