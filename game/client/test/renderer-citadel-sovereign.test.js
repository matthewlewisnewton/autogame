import { describe, it, expect } from 'vitest';
import { ENEMY_GEOMETRY, ENEMY_ATTACK_VISUAL } from '../renderer.js';
import { modelPathFor } from '../models.js';

// The Citadel Sovereign is the capstone boss — a crowned violet/gold tower.
// The client only needs the procedural render-registry entries to match the
// server attack stats (sub-ticket 01: radial, attackRange 6, BURNING rider).

describe('citadel_sovereign client render registry', () => {
	it('has the only crowned-cylinder ENEMY_GEOMETRY silhouette, in the citadel palette', () => {
		const geo = ENEMY_GEOMETRY.citadel_sovereign;
		expect(geo).toBeDefined();
		expect(geo.type).toBe('cylinder');
		// Unique silhouette: no other catalog body shares the cylinder type.
		for (const [type, other] of Object.entries(ENEMY_GEOMETRY)) {
			if (type === 'citadel_sovereign') continue;
			expect(other.type, `${type} must not share the cylinder silhouette`).not.toBe('cylinder');
		}
		// Crowned: the top flares wider than the base; tallest body in the catalog.
		expect(geo.radiusTop).toBeGreaterThan(geo.radius);
		expect(geo.height).toBeGreaterThan(ENEMY_GEOMETRY.riftbound_colossus.height);
		// Citadel palette: deep-violet body with a gold emissive glow.
		expect(geo.color).toBe(0x312e81);
		expect(geo.emissive).toBe(0xfacc15);
		expect(geo.emissiveIntensity).toBeGreaterThan(0);
		// Distinct from the riftbound colossus geometry and colors.
		const rift = ENEMY_GEOMETRY.riftbound_colossus;
		expect(geo.type).not.toBe(rift.type);
		expect(geo.color).not.toBe(rift.color);
		expect(geo.emissive).not.toBe(rift.emissive);
	});

	it('has a radial attack telegraph matching the server attack stats', () => {
		const vis = ENEMY_ATTACK_VISUAL.citadel_sovereign;
		expect(vis).toBeDefined();
		expect(vis.style).toBe('radial');
		expect(vis.range).toBe(6);
		expect(vis.color).toBe(0xfde047);
		expect(vis.emissive).toBe(0xca8a04);
	});

	it('is procedural (no registry model path, like the other bosses)', () => {
		expect(modelPathFor('citadel_sovereign')).toBeNull();
	});
});
