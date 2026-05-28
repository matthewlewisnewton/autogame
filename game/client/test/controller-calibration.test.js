import { describe, it, expect } from 'vitest';
import {
	buildCalibrationDebugLine,
	roundCalibrationDebugValue,
} from '../controller-calibration.js';
import { EIGHTBITDO_64_PROFILE } from '../gamepad-profiles.js';

describe('controller calibration debug log', () => {
	it('rounds values to three decimal places', () => {
		expect(roundCalibrationDebugValue(0.123456)).toBe(0.123);
	});

	it('builds GPDBG lines with axes, active buttons, and C-state', () => {
		const gamepad = {
			id: '8BitDo 64 (Vendor: 2dc8 Product: 1930)',
			axes: [0, 0, 0.55, -0.85, 0, 0],
			buttons: Array.from({ length: 12 }, (_, i) => ({
				pressed: i === 2,
				value: i === 2 ? 1 : 0,
			})),
		};
		const line = buildCalibrationDebugLine(gamepad, EIGHTBITDO_64_PROFILE, 'btn2+c-up');
		expect(line.startsWith('GPDBG ')).toBe(true);
		const payload = JSON.parse(line.slice(6));
		expect(payload.reason).toBe('btn2+c-up');
		expect(payload.profile).toBe('8bitdo-64');
		expect(payload.axes).toEqual([0, 0, 0.55, -0.85, 0, 0]);
		expect(payload.btn).toEqual([{ i: 2, p: 1, v: 1 }]);
		expect(payload.c.up).toBe(true);
	});
});
