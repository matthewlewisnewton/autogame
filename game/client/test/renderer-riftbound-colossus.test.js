import { describe, it, expect } from 'vitest';
import { ENEMY_GEOMETRY, ENEMY_ATTACK_VISUAL } from '../renderer.js';
import { modelPathFor } from '../models.js';

// The Riftbound Colossus is the hardest stage boss in the catalog — an
// ice+fire convergence tyrant. The client only needs the procedural
// render-registry entries to match the server attack stats (sub-ticket 01:
// radial, attackRange 5.5, BURNING rider).

describe('riftbound_colossus client render registry', () => {
	it('has the largest-in-class ice/fire two-tone ENEMY_GEOMETRY cone', () => {
		const geo = ENEMY_GEOMETRY.riftbound_colossus;
		expect(geo).toBeDefined();
		expect(geo.type).toBe('cone');
		expect(geo.radius).toBeGreaterThanOrEqual(1.4);
		expect(geo.height).toBeGreaterThanOrEqual(3.0);
		// Largest stage-boss silhouette: bigger than every other cone enemy.
		for (const [type, other] of Object.entries(ENEMY_GEOMETRY)) {
			if (type === 'riftbound_colossus' || other.type !== 'cone') continue;
			expect(geo.radius, `radius must exceed ${type}`).toBeGreaterThan(other.radius);
			expect(geo.height, `height must exceed ${type}`).toBeGreaterThan(other.height);
		}
		// Two-tone identity: deep ice-blue body with an ember-orange glow.
		expect(geo.color).toBe(0x164e63);
		expect(geo.emissive).toBe(0xf97316);
		expect(geo.emissiveIntensity).toBeGreaterThan(0);
	});

	it('has a radial attack telegraph matching the server attack stats', () => {
		const vis = ENEMY_ATTACK_VISUAL.riftbound_colossus;
		expect(vis).toBeDefined();
		expect(vis.style).toBe('radial');
		expect(vis.range).toBe(5.5);
		expect(vis.color).toBe(0xfb923c);
		expect(vis.emissive).toBe(0xea580c);
	});

	it('is procedural (no registry model path, like the other wardens)', () => {
		expect(modelPathFor('riftbound_colossus')).toBeNull();
	});
});
