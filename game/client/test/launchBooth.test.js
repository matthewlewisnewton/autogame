import { describe, it, expect } from 'vitest';
import {
	LAUNCH_BOOTH_ID,
	LAUNCH_READY_EVENT,
	isLaunchBoothAction,
	getBoothDebugHook,
	shouldLaunchReadyUp,
} from '../launchBooth.js';

// Pure-helper contract for the Launch Bay booth, mirroring boothPrompt.test.js:
// main.js (v8-ignored UI glue) wires these to the `booth:action` window event
// and the page query string, so we exercise the DOM-free helpers directly.
describe('launch booth helpers', () => {
	describe('isLaunchBoothAction', () => {
		it('is true for the launch booth detail', () => {
			expect(isLaunchBoothAction({ boothId: LAUNCH_BOOTH_ID })).toBe(true);
			expect(isLaunchBoothAction({ boothId: 'launch', action: 'launch' })).toBe(true);
		});

		it('is false for a different booth id', () => {
			expect(isLaunchBoothAction({ boothId: 'shop' })).toBe(false);
			expect(isLaunchBoothAction({ boothId: 'quest', action: 'launch' })).toBe(false);
		});

		it('is false for missing/empty details', () => {
			expect(isLaunchBoothAction(null)).toBe(false);
			expect(isLaunchBoothAction(undefined)).toBe(false);
			expect(isLaunchBoothAction({})).toBe(false);
		});
	});

	describe('getBoothDebugHook', () => {
		it('returns "launch" when ?booth=launch is present', () => {
			expect(getBoothDebugHook('?booth=launch')).toBe(LAUNCH_BOOTH_ID);
		});

		it('returns a different booth value verbatim', () => {
			expect(getBoothDebugHook('?booth=shop')).toBe('shop');
		});

		it('returns null when the booth param is absent', () => {
			expect(getBoothDebugHook('')).toBe(null);
			expect(getBoothDebugHook('?other=1')).toBe(null);
		});
	});

	describe('shouldLaunchReadyUp', () => {
		it('is true when the player is not yet ready and no request is pending', () => {
			expect(shouldLaunchReadyUp(false)).toBe(true);
			expect(shouldLaunchReadyUp(false, false)).toBe(true);
			expect(shouldLaunchReadyUp(undefined)).toBe(true);
			expect(shouldLaunchReadyUp(null)).toBe(true);
		});

		it('is false when the player is already ready', () => {
			expect(shouldLaunchReadyUp(true)).toBe(false);
			expect(shouldLaunchReadyUp(true, false)).toBe(false);
		});

		it('is false while a launch ready request is in flight', () => {
			expect(shouldLaunchReadyUp(false, true)).toBe(false);
			expect(shouldLaunchReadyUp(undefined, true)).toBe(false);
		});
	});

	describe('LAUNCH_READY_EVENT', () => {
		it('is the stable "launch:ready" window event name', () => {
			expect(LAUNCH_READY_EVENT).toBe('launch:ready');
		});
	});
});
