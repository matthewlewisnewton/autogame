import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Scene } from 'three';
import { patchSettings } from '../settings.js';
import {
	spawnParticleBurst,
	spawnProjectileTrail,
	spawnImpactDecal,
	spawnTelegraphRing,
	spawnAttackEffect,
	updateAttackEffects,
	getActiveEffects,
} from '../renderer.js';

// Each primitive should: add exactly one entry to activeEffects on spawn, and be
// removed (and its mesh's geometry/material disposed) once updateAttackEffects()
// runs past its duration. We force expiry by back-dating createdAt rather than
// waiting on the real clock, matching the hit-spark cleanup test in main.test.js.
// (The mocked three Scene.remove is a no-op, so cleanup is asserted via the
// activeEffects array shrinking and the dispose() spies firing.)

describe('shared VFX primitives', () => {
	beforeEach(() => {
		window.___test_scene = new Scene();
		patchSettings({ particlesEnabled: true });
		getActiveEffects().length = 0;
	});

	afterEach(() => {
		getActiveEffects().length = 0;
		delete window.___test_scene;
	});

	function lastEffect() {
		const effects = getActiveEffects();
		return effects[effects.length - 1];
	}

	it('spawnParticleBurst adds a flagged burst and cleans it up', () => {
		const before = getActiveEffects().length;
		spawnParticleBurst({ x: 1, y: 1, z: 2 }, { count: 6, color: 0x00ff00 });
		expect(getActiveEffects().length).toBe(before + 1);

		const fx = lastEffect();
		expect(fx.isParticleBurst).toBe(true);
		expect(fx.mesh.children.length).toBe(6);

		const disposeSpy = vi.spyOn(fx.mesh.children[0].geometry, 'dispose');
		fx.createdAt = performance.now() - fx.duration - 100;
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
		expect(disposeSpy).toHaveBeenCalled();
	});

	it('spawnParticleBurst no-ops when particles are disabled', () => {
		patchSettings({ particlesEnabled: false });
		const before = getActiveEffects().length;
		spawnParticleBurst({ x: 0, y: 1, z: 0 });
		expect(getActiveEffects().length).toBe(before);
	});

	it('spawnProjectileTrail adds a flagged trail and cleans it up', () => {
		const before = getActiveEffects().length;
		spawnProjectileTrail({ x: 0, z: 0 }, { x: 1, z: 0 }, { range: 6 });
		expect(getActiveEffects().length).toBe(before + 1);

		const fx = lastEffect();
		expect(fx.isProjectileTrail).toBe(true);

		const disposeSpy = vi.spyOn(fx.mesh.geometry, 'dispose');
		fx.createdAt = performance.now() - fx.duration - 100;
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
		expect(disposeSpy).toHaveBeenCalled();
	});

	it('spawnImpactDecal adds a flagged decal and cleans it up', () => {
		const before = getActiveEffects().length;
		spawnImpactDecal({ x: 3, z: 4 }, { radius: 1.2 });
		expect(getActiveEffects().length).toBe(before + 1);

		const fx = lastEffect();
		expect(fx.isImpactDecal).toBe(true);

		const disposeSpy = vi.spyOn(fx.mesh.geometry, 'dispose');
		fx.createdAt = performance.now() - fx.duration - 100;
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
		expect(disposeSpy).toHaveBeenCalled();
	});

	it('spawnTelegraphRing adds a flagged ring and cleans it up', () => {
		const before = getActiveEffects().length;
		spawnTelegraphRing({ x: 0, z: 0 }, 2.5);
		expect(getActiveEffects().length).toBe(before + 1);

		const fx = lastEffect();
		expect(fx.isTelegraphRing).toBe(true);
		expect(fx.telegraphRadius).toBe(2.5);

		const disposeSpy = vi.spyOn(fx.mesh.geometry, 'dispose');
		fx.createdAt = performance.now() - fx.duration - 100;
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
		expect(disposeSpy).toHaveBeenCalled();
	});

	it('primitives honor color/emissive accent overrides on the mesh material', () => {
		spawnImpactDecal({ x: 0, z: 0 }, { color: 0x123456, emissive: 0x654321 });
		const fx = lastEffect();
		expect(fx.mesh.material.color.getHex()).toBe(0x123456);
		expect(fx.mesh.material.emissive.getHex()).toBe(0x654321);
	});

	it('spawnAttackEffect permafrost_lance adds a flagged lance projectile and cleans it up', () => {
		const before = getActiveEffects().length;
		spawnAttackEffect(
			{ x: 0, z: 0 },
			{ x: 1, z: 0 },
			{ effect: 'permafrost_lance', range: 6, color: 0x67e8f9, emissive: 0x38bdf8 },
		);
		expect(getActiveEffects().length).toBe(before + 1);

		const fx = lastEffect();
		expect(fx.effect).toBe('permafrost_lance');
		expect(fx.range).toBe(6);
		expect(fx.mesh.geometry._name).toBe('ConeGeometry');
		const { height, radius } = fx.mesh.geometry.parameters;
		expect(height / radius).toBeGreaterThan(5);
		expect(fx.mesh.material.color.getHex()).toBe(0x67e8f9);
		expect(fx.mesh.material.emissive.getHex()).toBe(0x38bdf8);

		const disposeSpy = vi.spyOn(fx.mesh.geometry, 'dispose');
		fx.createdAt = performance.now() - fx.duration - 100;
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
		expect(disposeSpy).toHaveBeenCalled();
	});
});
