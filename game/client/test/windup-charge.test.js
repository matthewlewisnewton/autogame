import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Scene } from 'three';
import {
	computeWindupChargeRatio,
	resolveWindupAccentHex,
	applyPlayerCardWindupIndicator,
	getMeshMaps,
} from '../renderer.js';

// The wind-up charge telegraph grows/brightens over a card's lockout window.
// Charge math is a pure helper (no scene); the mesh lifecycle is exercised
// against a mocked three Scene via window.___test_scene, matching the pattern
// in vfx-primitives.test.js.

describe('wind-up charge telegraph', () => {
	describe('computeWindupChargeRatio', () => {
		// start = windupUntil - windUpMs = 1800 - 800 = 1000
		const windUpMs = 800;
		const windupUntil = 1800;

		it('is ~0 at the start of the wind-up', () => {
			expect(computeWindupChargeRatio(1000, windupUntil, windUpMs)).toBeCloseTo(0, 5);
		});

		it('is ~0.5 at the wind-up midpoint', () => {
			expect(computeWindupChargeRatio(1400, windupUntil, windUpMs)).toBeCloseTo(0.5, 5);
		});

		it('reaches 1 exactly when the lockout ends', () => {
			expect(computeWindupChargeRatio(1800, windupUntil, windUpMs)).toBe(1);
		});

		it('clamps to [0,1] outside the window', () => {
			expect(computeWindupChargeRatio(900, windupUntil, windUpMs)).toBe(0);
			expect(computeWindupChargeRatio(2500, windupUntil, windUpMs)).toBe(1);
		});

		it('completes exactly at the lockout end regardless of windUpMs', () => {
			// Short 500ms card (start 1500, end 2000) and long 800ms card
			// (start 1000, end 1800) both read 0 at their start and 1 at their end.
			expect(computeWindupChargeRatio(1500, 2000, 500)).toBe(0);
			expect(computeWindupChargeRatio(2000, 2000, 500)).toBe(1);
			expect(computeWindupChargeRatio(1000, 1800, 800)).toBe(0);
			expect(computeWindupChargeRatio(1800, 1800, 800)).toBe(1);
		});

		it('returns a safe default when duration is missing/invalid', () => {
			expect(computeWindupChargeRatio(1000, 1800, 0)).toBe(1);
			expect(computeWindupChargeRatio(1000, 1800, undefined)).toBe(1);
			expect(computeWindupChargeRatio(1000, 0, 800)).toBe(0);
		});
	});

	describe('resolveWindupAccentHex', () => {
		it('uses the casting card accent color', () => {
			// magma_greatsword accent is #f97316
			expect(resolveWindupAccentHex('magma_greatsword')).toBe(0xf97316);
		});

		it('falls back to the default blue when the card has no accent', () => {
			expect(resolveWindupAccentHex('definitely_not_a_card')).toBe(0x38bdf8);
		});
	});

	describe('telegraph lifecycle', () => {
		beforeEach(() => {
			window.___test_scene = new Scene();
		});

		afterEach(() => {
			const markers = getMeshMaps().playerCardWindupMarkers;
			for (const id of Object.keys(markers)) delete markers[id];
			delete window.___test_scene;
		});

		function windupPlayer() {
			return {
				cardUseState: 'windup',
				cardWindupCardId: 'magma_greatsword',
				cardWindupUntil: 1800, // start 1000, windUpMs 800
			};
		}

		it('creates a tinted charge ring on entry and grows it with the ratio', () => {
			const markers = getMeshMaps().playerCardWindupMarkers;
			expect(markers.p1).toBeUndefined();

			// Near the start: dim + small.
			applyPlayerCardWindupIndicator('p1', windupPlayer(), 2, 3, 1000);
			const ring = markers.p1;
			expect(ring).toBeDefined();
			expect(ring.material.color.getHex()).toBe(0xf97316);
			expect(ring.material.emissive.getHex()).toBe(0xf97316);
			const startScale = ring.scale.x;

			// Near the end: brighter + larger, same mesh reused (no realloc).
			applyPlayerCardWindupIndicator('p1', windupPlayer(), 2, 3, 1800);
			expect(markers.p1).toBe(ring);
			expect(ring.scale.x).toBeGreaterThan(startScale);
		});

		it('tears down the charge ring when the wind-up state ends', () => {
			const markers = getMeshMaps().playerCardWindupMarkers;
			applyPlayerCardWindupIndicator('p1', windupPlayer(), 0, 0, 1400);
			expect(markers.p1).toBeDefined();

			applyPlayerCardWindupIndicator('p1', { cardUseState: null }, 0, 0, 1400);
			expect(markers.p1).toBeUndefined();
		});
	});
});
