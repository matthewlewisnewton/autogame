import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Scene } from 'three';
import { patchSettings } from '../settings.js';
import {
	spawnParticleBurst,
	spawnProjectileTrail,
	spawnImpactDecal,
	spawnTelegraphRing,
	spawnAttackEffect,
	spawnDivineGraceEffect,
	spawnDivineGraceColumn,
	spawnMirrorWardShellEffect,
	spawnMirrorWardReflectBurst,
	updateAttackEffects,
	getActiveEffects,
} from '../renderer.js';
import { ATTACK_EFFECT_DURATION, SUMMON_EFFECT_DURATION } from '../config.js';

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

	it('spawnDivineGraceEffect pushes a holy-gold pulse ring + ascending column', () => {
		const before = getActiveEffects().length;
		spawnDivineGraceEffect({ x: 2, z: -3 }, 1.4);
		// Two meshes: the expanding ground pulse ring and the vertical light column.
		expect(getActiveEffects().length).toBe(before + 2);

		const effects = getActiveEffects();
		const ring = effects[before];
		const column = effects[before + 1];

		// Ring is the radius-based expanding pulse with a gold (NOT green) emissive.
		expect(ring.radius).toBe(1.4);
		expect(Number.isFinite(ring.duration)).toBe(true);
		expect(ring.duration).toBeGreaterThan(0);
		expect(ring.mesh.material.emissive.getHex()).not.toBe(0x86efac); // old green
		expect(ring.mesh.material.emissive.getHex()).toBe(0xf59e0b); // gold/amber
		expect(ring.mesh.material.color.getHex()).toBe(0xfde68a); // warm gold

		// Column is the vertical ascending shaft, also gold and finite-lived.
		expect(column.isLightColumn).toBe(true);
		expect(Number.isFinite(column.duration)).toBe(true);
		expect(column.duration).toBeGreaterThan(0);
		expect(column.mesh.material.emissive.getHex()).toBe(0xfbbf24); // bright gold
	});

	it('spawnDivineGraceColumn rises then fades and cleans itself up', () => {
		const before = getActiveEffects().length;
		spawnDivineGraceColumn({ x: 0, z: 0 });
		expect(getActiveEffects().length).toBe(before + 1);

		const fx = lastEffect();
		expect(fx.isLightColumn).toBe(true);

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

	it('spawnMirrorWardShellEffect adds a flagged shell with mirror palette and cleans it up', () => {
		const before = getActiveEffects().length;
		spawnMirrorWardShellEffect({ x: 0, z: 0 }, 11);
		expect(getActiveEffects().length).toBe(before + 1);

		const fx = lastEffect();
		expect(fx.isMirrorWardShell).toBe(true);
		expect(fx.wardRadius).toBe(11);
		expect(fx.duration).toBe(SUMMON_EFFECT_DURATION);
		expect(Number.isFinite(fx.duration)).toBe(true);
		expect(fx.mesh.children.length).toBeGreaterThanOrEqual(3);

		const ring = fx.mesh.children.find((c) => c.userData.isMirrorWardRing);
		expect(ring).toBeDefined();
		expect(ring.material.emissive.getHex()).toBe(0x2dd4bf);
		expect(ring.material.color.getHex()).toBe(0x5eead4);

		const disposeSpy = vi.spyOn(ring.geometry, 'dispose');
		fx.createdAt = performance.now() - fx.duration - 100;
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
		expect(disposeSpy).toHaveBeenCalled();
	});

	it('spawnMirrorWardShellEffect honors style.duration override', () => {
		spawnMirrorWardShellEffect({ x: 1, z: 2 }, 5, { duration: 900 });
		const fx = lastEffect();
		expect(fx.duration).toBe(900);
	});

	it('spawnMirrorWardReflectBurst adds flagged trail, decal, and burst with mirror palette', () => {
		const before = getActiveEffects().length;
		spawnMirrorWardReflectBurst({ x: 0, z: 0 }, { x: 1, z: 0 }, { range: 6 });
		expect(getActiveEffects().length).toBe(before + 3);

		const effects = getActiveEffects().slice(before);
		expect(effects.every((fx) => fx.isMirrorWardReflect)).toBe(true);
		expect(effects.some((fx) => fx.isProjectileTrail)).toBe(true);
		expect(effects.some((fx) => fx.isImpactDecal)).toBe(true);
		expect(effects.some((fx) => fx.isParticleBurst)).toBe(true);

		const trail = effects.find((fx) => fx.isProjectileTrail);
		expect(trail.duration).toBe(ATTACK_EFFECT_DURATION);
		expect(trail.mesh.material.emissive.getHex()).toBe(0x2dd4bf);

		const decal = effects.find((fx) => fx.isImpactDecal);
		expect(decal.mesh.material.color.getHex()).toBe(0x5eead4);

		for (const fx of effects) {
			const disposeSpy = vi.spyOn(
				fx.isParticleBurst ? fx.mesh.children[0].geometry : fx.mesh.geometry,
				'dispose',
			);
			fx.createdAt = performance.now() - fx.duration - 100;
		}
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
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
