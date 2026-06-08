import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Scene } from 'three';
import { patchSettings } from '../settings.js';
import {
	spawnParticleBurst,
	spawnProjectileTrail,
	spawnImpactDecal,
	spawnTelegraphRing,
	spawnDivineGraceEffect,
	spawnDivineGraceColumn,
	spawnSpikeTrapEffect,
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

	it('spawnSpikeTrapEffect pushes erupting steel spikes + a blood-red hazard ring', () => {
		const before = getActiveEffects().length;
		spawnSpikeTrapEffect({ x: 5, z: -2 }, 1.4);

		const effects = getActiveEffects().slice(before);
		const ring = effects.find((fx) => fx.spikeTrapRing);
		const spikes = effects.filter((fx) => fx.isSpikeTrapSpike);

		// One hazard ring plus several upward spike meshes (NOT a flat ring alone).
		expect(ring).toBeDefined();
		expect(spikes.length).toBeGreaterThanOrEqual(3);
		expect(effects.length).toBe(spikes.length + 1);

		// Ring: radius-based expanding hazard ring in blood-red, finite-lived,
		// distinct from cinder_snare's orange inferno (color 0xef4444).
		expect(ring.radius).toBe(1.4);
		expect(Number.isFinite(ring.duration)).toBe(true);
		expect(ring.duration).toBeGreaterThan(0);
		expect(ring.mesh.material.color.getHex()).toBe(0xb91c1c);

		// Spikes: metallic steel grey body with a blood-red emissive glow, each a
		// vertical cone (height-bearing ConeGeometry) with a finite, lifted lifecycle.
		for (const spike of spikes) {
			expect(spike.mesh.material.color.getHex()).toBe(0x9ca3af); // steel grey
			expect(spike.mesh.material.emissive.getHex()).toBe(0xdc2626); // blood-red
			expect(spike.spikeHeight).toBeGreaterThan(0); // vertical spike geometry
			expect(spike.mesh.geometry.parameters.height).toBe(spike.spikeHeight);
			expect(Number.isFinite(spike.duration)).toBe(true);
			expect(spike.duration).toBeGreaterThan(0);
		}

		// Animation cleanup: once past duration, every mesh is disposed and removed.
		const ringDispose = vi.spyOn(ring.mesh.geometry, 'dispose');
		const spikeDispose = vi.spyOn(spikes[0].mesh.geometry, 'dispose');
		for (const fx of effects) fx.createdAt = performance.now() - fx.duration - 100;
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
		expect(ringDispose).toHaveBeenCalled();
		expect(spikeDispose).toHaveBeenCalled();
	});

	it('primitives honor color/emissive accent overrides on the mesh material', () => {
		spawnImpactDecal({ x: 0, z: 0 }, { color: 0x123456, emissive: 0x654321 });
		const fx = lastEffect();
		expect(fx.mesh.material.color.getHex()).toBe(0x123456);
		expect(fx.mesh.material.emissive.getHex()).toBe(0x654321);
	});
});
