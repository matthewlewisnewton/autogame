import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	applyDeadzone,
	readStickMovement,
	readDpadMovement,
	mergeMovementVectors,
	pollGamepadButtons,
	pollGamepadLook,
	resetGamepadState,
} from '../gamepad.js';
import { GAMEPAD_DEADZONE, GAMEPAD_LOOK_SENSITIVITY, LOCK_ON_GAMEPAD_BUTTON } from '../config.js';
import { patchSettings } from '../settings.js';
import {
	handleLockOnPress,
	isLockOnActive,
	isLockOnCameraReleasing,
	clearAllLockOnState,
	updateLockOn,
} from '../lockOn.js';
import { DEFAULT_FLOOR_Y } from '../../shared/floorSampling.esm.js';
import { installGamepadMock, uninstallGamepadMock, mockGamepad, clearMockGamepads } from './gamepad-mock.js';

const LOCK_ON_ENEMIES = [{ id: 'a', x: 3, z: 0, hp: 50 }];
const PY = DEFAULT_FLOOR_Y;

describe('applyDeadzone()', () => {
	it('returns zero inside the deadzone', () => {
		expect(applyDeadzone(0.1, 0.15)).toBe(0);
		expect(applyDeadzone(-0.14, 0.15)).toBe(0);
	});

	it('rescales values beyond the deadzone to full range', () => {
		expect(applyDeadzone(1, 0.15)).toBeCloseTo(1);
		expect(applyDeadzone(0.575, 0.15)).toBeCloseTo(0.5);
	});
});

describe('readStickMovement()', () => {
	it('returns null when both axes are inside the deadzone', () => {
		expect(readStickMovement(0, 0)).toBeNull();
		expect(readStickMovement(0.05, -0.05, 0.15)).toBeNull();
	});

	it('returns a unit direction for full stick deflection', () => {
		const movement = readStickMovement(1, 0, 0.15);
		expect(movement.x).toBeCloseTo(1);
		expect(movement.z).toBeCloseTo(0);
	});

	it('preserves partial stick magnitude below full deflection', () => {
		const movement = readStickMovement(0.575, 0, 0.15);
		expect(movement.x).toBeCloseTo(0.5);
		expect(Math.hypot(movement.x, movement.z)).toBeCloseTo(0.5);
	});

	it('maps forward stick input to positive z like WASD', () => {
		const movement = readStickMovement(0, -1, 0.15);
		expect(movement.x).toBeCloseTo(0);
		expect(movement.z).toBeCloseTo(1);
	});
});

describe('readDpadMovement()', () => {
	it('returns null when no D-pad buttons are pressed', () => {
		expect(readDpadMovement({ buttons: [] })).toBeNull();
	});

	it('returns normalized diagonal input', () => {
		const movement = readDpadMovement({
			buttons: [
				...Array(12).fill({ pressed: false }),
				{ pressed: true },
				{ pressed: false },
				{ pressed: true },
			],
		});
		expect(movement.x).toBeCloseTo(-Math.SQRT1_2);
		expect(movement.z).toBeCloseTo(Math.SQRT1_2);
	});
});

describe('mergeMovementVectors()', () => {
	it('returns the non-null vector when only one source is active', () => {
		expect(mergeMovementVectors({ x: 1, z: 0 }, null)).toEqual({ x: 1, z: 0 });
	});

	it('combines keyboard and stick input into one direction', () => {
		const merged = mergeMovementVectors({ x: 1, z: 0 }, { x: 0, z: 1 });
		expect(merged.x).toBeCloseTo(Math.SQRT1_2);
		expect(merged.z).toBeCloseTo(Math.SQRT1_2);
	});

	it('does not inflate a partial stick vector when it is the only source', () => {
		const partial = { x: 0.5, z: 0 };
		expect(mergeMovementVectors(partial, null)).toEqual(partial);
	});
});

describe('pollGamepadButtons()', () => {
	beforeEach(() => {
		resetGamepadState();
	});

	it('fires lock-on only on button press edge', () => {
		navigator.getGamepads = () => [{
			connected: true,
			buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === LOCK_ON_GAMEPAD_BUTTON })),
			axes: [0, 0, 0, 0],
		}];
		expect(pollGamepadButtons().lockOn).toBe(true);
		expect(pollGamepadButtons().lockOn).toBe(false);
	});

	it('fires 8BitDo Z lock-on once per press with profile 8bitdo-64', () => {
		installGamepadMock();
		clearMockGamepads();
		patchSettings({ gamepad: { profile: '8bitdo-64' } });
		const buttons = Array(12).fill({ pressed: false, value: 0 });
		buttons[8] = { pressed: false, value: 0.25 };
		mockGamepad(0, { id: '8BitDo 64 (Vendor: 2dc8 Product: 1930)', axes: [0, 0, 0, 0], buttons });
		expect(pollGamepadButtons().lockOn).toBe(true);
		expect(pollGamepadButtons().lockOn).toBe(false);
		uninstallGamepadMock();
	});
});

describe('pollGamepadLook()', () => {
	beforeEach(() => {
		resetGamepadState();
		clearAllLockOnState();
		installGamepadMock();
		clearMockGamepads();
		patchSettings({ gamepad: { profile: '8bitdo-64' } });
		mockGamepad(0, {
			id: '8BitDo 64 (Vendor: 2dc8 Product: 1930)',
			axes: [0, 0, 0.9, 0.2, 0, 0],
			buttons: [],
		});
	});

	afterEach(() => {
		clearAllLockOnState();
		uninstallGamepadMock();
	});

	it('returns non-zero yaw from axis 2 when lock-on is inactive', () => {
		const delta = 0.016;
		const look = pollGamepadLook(delta);
		expect(look).not.toBe(0);
		expect(look).toBeCloseTo(-0.9 * GAMEPAD_LOOK_SENSITIVITY * delta);
	});

	it('returns 0 when lock-on is active even with axis 2 deflected', () => {
		handleLockOnPress(LOCK_ON_ENEMIES, 0, PY, 0, 'unlock', 0, null);
		expect(isLockOnActive()).toBe(true);
		expect(pollGamepadLook(0.016)).toBe(0);
	});

	it('returns 0 during post-death camera release', () => {
		handleLockOnPress(LOCK_ON_ENEMIES, 0, PY, 0, 'unlock', 0, null);
		updateLockOn(LOCK_ON_ENEMIES, 0, PY, 0, 0.1, 0, 0, null);
		updateLockOn([{ id: 'a', x: 3, z: 0, hp: 0 }], 0, PY, 0, 0.1, 0, 0, null);
		expect(isLockOnCameraReleasing()).toBe(true);
		expect(pollGamepadLook(0.016)).toBe(0);
	});
});

describe('GAMEPAD_DEADZONE', () => {
	it('matches the expected default deadzone', () => {
		expect(GAMEPAD_DEADZONE).toBe(0.15);
	});
});
