import { describe, it, expect } from 'vitest';
import { MODEL_REGISTRY, modelPathFor } from '../models.js';
import { ENEMY_GEOMETRY, ENEMY_ATTACK_VISUAL } from '../renderer.js';

// The two flying enemy types added in ticket 378. Each must be wired into the
// model registry, enemy geometry, and attack-visual tables so a spawn of either
// produces a mesh + telegraph instead of falling through a missing-geometry path.
const FLYING_TYPES = ['void_seraph', 'rime_drifter'];

describe('flying enemy client rendering registries', () => {
	it('registers each flying type as procedural-only in MODEL_REGISTRY', () => {
		for (const key of FLYING_TYPES) {
			expect(MODEL_REGISTRY).toHaveProperty(key);
			expect(MODEL_REGISTRY[key]).toBeNull();
			expect(modelPathFor(key)).toBeNull();
		}
	});

	it('gives each flying type a renderable ENEMY_GEOMETRY entry', () => {
		for (const key of FLYING_TYPES) {
			const geo = ENEMY_GEOMETRY[key];
			expect(geo, key).toBeTruthy();
			expect(typeof geo.type).toBe('string');
			expect(typeof geo.radius).toBe('number');
			expect(typeof geo.color).toBe('number');
		}
	});

	it('gives each flying type an ENEMY_ATTACK_VISUAL telegraph matching its server attack style', () => {
		// void_seraph fires a spherical void burst → radial telegraph.
		expect(ENEMY_ATTACK_VISUAL.void_seraph).toBeTruthy();
		expect(ENEMY_ATTACK_VISUAL.void_seraph.style).toBe('radial');

		// rime_drifter lobs a height-aware ice ball → projectile telegraph,
		// consistent with glacial_thrower.
		expect(ENEMY_ATTACK_VISUAL.rime_drifter).toBeTruthy();
		expect(ENEMY_ATTACK_VISUAL.rime_drifter.style).toBe('projectile');
		expect(ENEMY_ATTACK_VISUAL.rime_drifter.style).toBe(
			ENEMY_ATTACK_VISUAL.glacial_thrower.style,
		);
	});
});
