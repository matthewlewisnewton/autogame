import { describe, it, expect } from 'vitest';
import { ENEMY_GEOMETRY, ENEMY_ATTACK_VISUAL } from '../renderer.js';
import { MODEL_REGISTRY, modelPathFor } from '../models.js';

// The Magma Colossus is the Ember Descent Tier-II stage boss. The lock-on / boss
// HUD is generic (server enemy catalog), so the client only needs the procedural
// render-registry entries to match the server attack stats (sub-ticket 02:
// radial, attackRange 5).

describe('magma_colossus client render registry', () => {
	it('has a boss-scale molten fire-toned ENEMY_GEOMETRY cone', () => {
		const geo = ENEMY_GEOMETRY.magma_colossus;
		expect(geo).toBeDefined();
		expect(geo.type).toBe('cone');
		// Tier-II colossus: larger than the Tier-I cinder warden it supersedes.
		expect(geo.height).toBeGreaterThan(ENEMY_GEOMETRY.cinder_warden.height);
		expect(geo.radius).toBeGreaterThan(ENEMY_GEOMETRY.cinder_warden.radius);
		// Molten fire-toned color + emissive glow, distinct from cinder warden.
		expect(geo.color).toBe(0xff7711);
		expect(geo.emissive).toBe(0xff5500);
		expect(geo.emissiveIntensity).toBeGreaterThan(0);
		expect(geo.color).not.toBe(ENEMY_GEOMETRY.cinder_warden.color);
		expect(geo.emissive).not.toBe(ENEMY_GEOMETRY.cinder_warden.emissive);
	});

	it('has a radial attack telegraph matching the server attack stats', () => {
		const vis = ENEMY_ATTACK_VISUAL.magma_colossus;
		expect(vis).toBeDefined();
		expect(vis.style).toBe('radial');
		expect(vis.range).toBe(5);
		expect(vis.color).toBe(0xffaa33);
		expect(vis.emissive).toBe(0xff5500);
	});

	it('is procedural in MODEL_REGISTRY (null path, like the other wardens)', () => {
		expect(MODEL_REGISTRY.magma_colossus).toBeNull();
		expect(modelPathFor('magma_colossus')).toBeNull();
	});
});
