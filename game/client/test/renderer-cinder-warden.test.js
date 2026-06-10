import { describe, it, expect } from 'vitest';
import { ENEMY_GEOMETRY, ENEMY_ATTACK_VISUAL } from '../renderer.js';
import { MODEL_REGISTRY, modelPathFor } from '../models.js';

// The Cinder Warden is the Fire L1 stage miniboss. The lock-on / boss HUD is
// generic (server enemy catalog), so the client only needs the procedural
// render-registry entries to match the server attack stats (sub-ticket 01:
// cone, coneAngle (2*PI)/3, attackRange 5.5).

describe('cinder_warden client render registry', () => {
	it('has a boss-scale fire-toned ENEMY_GEOMETRY cone', () => {
		const geo = ENEMY_GEOMETRY.cinder_warden;
		expect(geo).toBeDefined();
		expect(geo.type).toBe('cone');
		// Boss-scale: at least as tall as the spire_warden it mirrors.
		expect(geo.height).toBeGreaterThanOrEqual(ENEMY_GEOMETRY.spire_warden.height);
		// Fire-toned color + emissive glow.
		expect(geo.color).toBe(0xff5522);
		expect(geo.emissive).toBe(0xff2200);
		expect(geo.emissiveIntensity).toBeGreaterThan(0);
	});

	it('has a cone attack telegraph matching the server attack stats', () => {
		const vis = ENEMY_ATTACK_VISUAL.cinder_warden;
		expect(vis).toBeDefined();
		expect(vis.style).toBe('cone');
		expect(vis.coneAngle).toBe((2 * Math.PI) / 3);
		expect(vis.range).toBe(5.5);
		expect(vis.color).toBe(0xff7733);
		expect(vis.emissive).toBe(0xff2200);
	});

	it('is procedural in MODEL_REGISTRY (null path, like the other wardens)', () => {
		expect(MODEL_REGISTRY.cinder_warden).toBeNull();
		expect(modelPathFor('cinder_warden')).toBeNull();
	});
});
