import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DEFAULT_FLOOR_Y, sampleFloorY } from '../../shared/floorSampling.esm.js';

// Floor-aware airborne render/shadow math: a flier on a non-default floor must
// rise/fall with the surface beneath it, while grounded entities are untouched.
describe('airborne floor-aware render + shadow', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	// A flat room raised to a non-default height (every corner at 2.0), so
	// sampleFloorY at its centre is 2.0 — well above DEFAULT_FLOOR_Y (0.5).
	const RAISED = 2.0;
	const raisedLayout = {
		rooms: [
			{ x: 0, z: 0, width: 10, depth: 10, floorCorners: { yNW: RAISED, yNE: RAISED, ySE: RAISED, ySW: RAISED } },
		],
	};
	// A flat default-height room for the "unchanged on default floor" baseline.
	const flatLayout = { rooms: [{ x: 0, z: 0, width: 10, depth: 10 }] };
	const ALT = 3;

	it('sanity: the raised room samples to a non-default floor height', () => {
		expect(sampleFloorY(raisedLayout, 0, 0)).toBe(RAISED);
		expect(sampleFloorY(raisedLayout, 0, 0)).not.toBe(DEFAULT_FLOOR_Y);
		expect(sampleFloorY(flatLayout, 0, 0)).toBe(DEFAULT_FLOOR_Y);
	});

	it('flying enemy render offset tracks the floor surface via server world Y', async () => {
		const { flyingRenderOffset } = await import('../renderer.js');
		// Server-authoritative world Y = sampleFloorY(2.0) + altitude(3) = 5.0.
		const enemy = { id: 'e1', flying: true, x: 0, z: 0, altitude: ALT, y: RAISED + ALT };
		const offset = flyingRenderOffset(enemy, raisedLayout);
		// Offset carries the floor delta (1.5) plus the altitude (3).
		expect(offset).toBeCloseTo((RAISED - DEFAULT_FLOOR_Y) + ALT, 6);
		// On the default floor the same flier's offset is just the altitude.
		const flatEnemy = { id: 'e1', flying: true, x: 0, z: 0, altitude: ALT, y: DEFAULT_FLOOR_Y + ALT };
		expect(flyingRenderOffset(flatEnemy, flatLayout)).toBeCloseTo(ALT, 6);
		// So the raised result exceeds the default by exactly the floor delta.
		expect(offset).toBeCloseTo(flyingRenderOffset(flatEnemy, flatLayout) + (RAISED - DEFAULT_FLOOR_Y), 6);
	});

	it('flying minion render offset is floor-aware from the altitude fallback (no world Y)', async () => {
		const { flyingRenderOffset } = await import('../renderer.js');
		// No `y`: the bare altitude must still be combined with the sampled floor.
		const minion = { id: 'm1', flying: true, x: 0, z: 0, altitude: ALT };
		expect(flyingRenderOffset(minion, raisedLayout)).toBeCloseTo((RAISED - DEFAULT_FLOOR_Y) + ALT, 6);
		// On the default floor the fallback reduces to the plain altitude.
		expect(flyingRenderOffset(minion, flatLayout)).toBeCloseTo(ALT, 6);
	});

	it('flying shadow Y sits on the sampled floor surface, not a fixed plane', async () => {
		const { flyingShadowY } = await import('../renderer.js');
		const flatShadowY = flyingShadowY(flatLayout, 0, 0);
		const raisedShadowY = flyingShadowY(raisedLayout, 0, 0);
		// The constant overlay offset (GROUND_OVERLAY_Y - FLOOR_Y) is whatever sits
		// above the default floor; on the raised floor the shadow gains the delta.
		const overlay = flatShadowY - DEFAULT_FLOOR_Y;
		expect(raisedShadowY).toBeCloseTo(RAISED + overlay, 6);
		expect(raisedShadowY).toBeCloseTo(flatShadowY + (RAISED - DEFAULT_FLOOR_Y), 6);
		expect(raisedShadowY).toBeGreaterThan(flatShadowY);
	});

	it('grounded enemies and minions are unchanged on a non-default floor', async () => {
		const { flyingRenderOffset } = await import('../renderer.js');
		// No `flying` flag → offset is 0 regardless of floor height or world Y,
		// so the grounded render base is byte-for-byte unchanged.
		const groundedEnemy = { id: 'e2', x: 0, z: 0, y: RAISED };
		const groundedMinion = { id: 'm2', x: 0, z: 0, y: RAISED, altitude: ALT };
		expect(flyingRenderOffset(groundedEnemy, raisedLayout)).toBe(0);
		expect(flyingRenderOffset(groundedMinion, raisedLayout)).toBe(0);
	});
});
