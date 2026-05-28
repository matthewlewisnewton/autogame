import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	resolveGamepadProfile,
	isBindingActive,
	get8BitDo64CStickAxes,
	get8BitDo64CAxisPairs,
	EIGHTBITDO_64_PROFILE,
	EIGHTBITDO_64_TRIGGER_BUTTON_INDICES,
	describeActiveGamepadProfile,
	is8BitDo64Gamepad,
	read8BitDo64CButtonState,
	readProfileCStick,
	readAxisSectorDirections,
	uses8BitDo64DigitalCButtons,
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
		expect(EIGHTBITDO_64_PROFILE.lockOnButton).toBe(8);
		expect(EIGHTBITDO_64_PROFILE.bindings.useSlot0).toEqual({ type: 'button', index: 0 });
		expect(EIGHTBITDO_64_PROFILE.bindings.useSlot2).toMatchObject({ type: 'cButton', direction: 'up' });
	});

	it('uses digital C-buttons without a secondary analog C stick on axes 4/5', () => {
		expect(uses8BitDo64DigitalCButtons()).toBe(true);
		mockGamepad(0, { id: '8BitDo 64', axes: [0, 0, 0.8, -0.7, 0, 0], buttons: [] });
		const pad = navigator.getGamepads()[0];
		expect(get8BitDo64CStickAxes(pad)).toBeNull();
		expect(get8BitDo64CAxisPairs(pad)).toEqual([]);
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

	it('reads C-right from discrete button 5 and SDL axis-as-button index 9', () => {
		const buttons = Array(12).fill({ pressed: false, value: 0 });
		buttons[5] = { pressed: true, value: 1 };
		mockGamepad(0, { id: '8BitDo 64', axes: [0, 0, 0, 0], buttons });
		expect(read8BitDo64CButtonState(navigator.getGamepads()[0]).right).toBe(true);

		clearMockGamepads();
		const buttonsNine = Array(12).fill({ pressed: false, value: 0 });
		buttonsNine[9] = { pressed: true, value: 1 };
		mockGamepad(0, { id: '8BitDo 64', axes: [0, 0, 0, 0, 0, 0], buttons: buttonsNine });
		expect(read8BitDo64CButtonState(navigator.getGamepads()[0]).right).toBe(true);
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

	it('synthesizes C-stick display from digital buttons when no analog C stick exists', () => {
		const buttons = Array(12).fill({ pressed: false, value: 0 });
		buttons[4] = { pressed: true, value: 1 };
		mockGamepad(0, { id: '8BitDo 64', axes: [0, 0, 0, 0], buttons });
		const pad = navigator.getGamepads()[0];
		expect(get8BitDo64CStickAxes(pad)).toBeNull();
		expect(readProfileCStick(pad, EIGHTBITDO_64_PROFILE)).toEqual({ x: -1, y: 0 });
	});

	it('does not treat Z (button 8) as C-up', () => {
		const buttons = Array(12).fill({ pressed: false, value: 0 });
		buttons[8] = { pressed: true, value: 1 };
		mockGamepad(0, { id: '8BitDo 64', axes: [0, 0, 0, 0], buttons });
		const pad = navigator.getGamepads()[0];
		expect(read8BitDo64CButtonState(pad).up).toBe(false);
	});

	it('documents Z/R trigger button indices separately from C inputs', () => {
		expect(EIGHTBITDO_64_TRIGGER_BUTTON_INDICES).toEqual([8, 9]);
	});

	it('derives four-way directions from axis sectors', () => {
		expect(readAxisSectorDirections(0, -0.8).up).toBe(true);
		expect(readAxisSectorDirections(0.8, 0).right).toBe(true);
	});
});
