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
	spawnTelepipeCastEffect,
	spawnSpikeTrapEffect,
	spawnMirrorWardShellEffect,
	dismissMirrorWardShellEffect,
	spawnMirrorWardReflectBurst,
	spawnInfernoPillarEffect,
	spawnEtherSiphonEffect,
	spawnDragonsBreathEffect,
	spawnGravityWellEffect,
	spawnEventHorizonEffect,
	spawnGlacierRuptureEffect,
	spawnLegionMarshalRallyEffect,
	spawnBatteryAutomatonDeployEffect,
	spawnBatteryChargePulseEffect,
	BATTERY_AUTOMATON_COLOR,
	BATTERY_AUTOMATON_EMISSIVE,
	spawnAegisSentinelShieldFlourish,
	spawnAegisSentinelDeployEffect,
	AEGIS_SENTINEL_COLOR,
	AEGIS_SENTINEL_EMISSIVE,
	AEGIS_SENTINEL_GOLD,
	spawnChronoTriggerEffect,
	spawnSolarEdgeImpactFlourish,
	SOLAR_EDGE_CORE_COLOR,
	SOLAR_EDGE_CORE_EMISSIVE,
	SOLAR_EDGE_CORONA_COLOR,
	SOLAR_EDGE_CORONA_EMISSIVE,
	updateAttackEffects,
	getActiveEffects,
} from '../renderer.js';
import { ATTACK_EFFECT_KINDS } from '../renderer/attackEffectUpdaters.js';
import { ATTACK_EFFECT_DURATION, ATTACK_RANGE, MINION_SUMMON_IN_MS, SUMMON_EFFECT_DURATION } from '../config.js';

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
		expect(fx.kind).toBe(ATTACK_EFFECT_KINDS.particleBurst);
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
		expect(fx.kind).toBe(ATTACK_EFFECT_KINDS.projectileTrail);
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
		expect(fx.kind).toBe(ATTACK_EFFECT_KINDS.impactDecal);
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
		expect(fx.kind).toBe(ATTACK_EFFECT_KINDS.telegraphRing);
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

		// Ring is the expand-fade ground pulse with a gold (NOT green) emissive.
		expect(ring.kind).toBe(ATTACK_EFFECT_KINDS.expandFadeRing);
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

	it('spawnTelepipeCastEffect pushes cyan ring, warp-tube column, and particle burst', () => {
		const before = getActiveEffects().length;
		spawnTelepipeCastEffect({ x: 4, z: -1 }, 2.5);
		expect(getActiveEffects().length).toBe(before + 3);

		const effects = getActiveEffects().slice(before);
		const ring = effects.find((fx) => fx.kind === ATTACK_EFFECT_KINDS.expandFadeRing);
		const column = effects.find((fx) => fx.isLightColumn);
		const burst = effects.find((fx) => fx.isParticleBurst);

		expect(ring).toBeDefined();
		expect(ring.kind).toBe(ATTACK_EFFECT_KINDS.expandFadeRing);
		expect(ring.radius).toBe(2.5);
		expect(Number.isFinite(ring.duration)).toBe(true);
		expect(ring.duration).toBeGreaterThan(0);
		expect(ring.mesh.material.color.getHex()).toBe(0x67e8f9);
		expect(ring.mesh.material.emissive.getHex()).toBe(0x22d3ee);

		expect(column).toBeDefined();
		expect(column.isLightColumn).toBe(true);
		expect(Number.isFinite(column.duration)).toBe(true);
		expect(column.duration).toBeGreaterThan(0);
		expect(column.mesh.material.color.getHex()).toBe(0x67e8f9);
		expect(column.mesh.material.emissive.getHex()).toBe(0x22d3ee);

		expect(burst).toBeDefined();
		expect(burst.isParticleBurst).toBe(true);
		expect(Number.isFinite(burst.duration)).toBe(true);
		expect(burst.duration).toBeGreaterThan(0);

		const ringDispose = vi.spyOn(ring.mesh.geometry, 'dispose');
		const columnDispose = vi.spyOn(column.mesh.geometry, 'dispose');
		const burstDispose = vi.spyOn(burst.mesh.children[0].geometry, 'dispose');
		for (const fx of effects) fx.createdAt = performance.now() - fx.duration - 100;
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
		expect(ringDispose).toHaveBeenCalled();
		expect(columnDispose).toHaveBeenCalled();
		expect(burstDispose).toHaveBeenCalled();
	});

	it('spawnTelepipeCastEffect defaults radius to 2.5 and honors color overrides', () => {
		spawnTelepipeCastEffect({ x: 0, z: 0 });
		const ring = getActiveEffects().find((fx) => fx.kind === ATTACK_EFFECT_KINDS.expandFadeRing);
		expect(ring.radius).toBe(2.5);

		getActiveEffects().length = 0;
		spawnTelepipeCastEffect({ x: 0, z: 0 }, 1.8, { color: 0x123456, emissive: 0x654321 });
		const effects = getActiveEffects();
		const ringFx = effects.find((fx) => fx.kind === ATTACK_EFFECT_KINDS.expandFadeRing);
		const columnFx = effects.find((fx) => fx.isLightColumn);
		expect(ringFx.mesh.material.color.getHex()).toBe(0x123456);
		expect(ringFx.mesh.material.emissive.getHex()).toBe(0x654321);
		expect(columnFx.mesh.material.color.getHex()).toBe(0x123456);
		expect(columnFx.mesh.material.emissive.getHex()).toBe(0x654321);
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
		const ring = effects.find((fx) => fx.kind === ATTACK_EFFECT_KINDS.spikeTrapRing);
		const spikes = effects.filter((fx) => fx.isSpikeTrapSpike);

		// One hazard ring plus several upward spike meshes (NOT a flat ring alone).
		expect(ring).toBeDefined();
		expect(ring.kind).toBe(ATTACK_EFFECT_KINDS.spikeTrapRing);
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

	it('spawnLegionMarshalRallyEffect pushes bone/purple rally ring + rising column and cleans up', () => {
		const before = getActiveEffects().length;
		spawnLegionMarshalRallyEffect({ x: 1, z: -2 }, 2);
		expect(getActiveEffects().length).toBeGreaterThanOrEqual(before + 2);

		const effects = getActiveEffects().slice(before);
		const ring = effects.find((fx) => fx.kind === ATTACK_EFFECT_KINDS.expandFadeRing);
		const column = effects.find((fx) => fx.isLegionMarshalColumn);

		expect(ring).toBeDefined();
		expect(ring.kind).toBe(ATTACK_EFFECT_KINDS.expandFadeRing);
		expect(ring.radius).toBe(2);
		expect(Number.isFinite(ring.duration)).toBe(true);
		expect(ring.duration).toBeGreaterThan(0);
		expect(ring.mesh.material.color.getHex()).toBe(0xe4e4e7);
		expect(ring.mesh.material.emissive.getHex()).toBe(0xa855f7);

		expect(column).toBeDefined();
		expect(column.isLegionMarshalColumn).toBe(true);
		expect(Number.isFinite(column.duration)).toBe(true);
		expect(column.duration).toBeGreaterThan(0);
		expect(column.mesh.material.color.getHex()).toBe(0xe4e4e7);
		expect(column.mesh.material.emissive.getHex()).toBe(0xa855f7);

		const ringDispose = vi.spyOn(ring.mesh.geometry, 'dispose');
		const columnDispose = vi.spyOn(column.mesh.geometry, 'dispose');
		for (const fx of effects) fx.createdAt = performance.now() - fx.duration - 100;
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
		expect(ringDispose).toHaveBeenCalled();
		expect(columnDispose).toHaveBeenCalled();
	});

	it('spawnBatteryAutomatonDeployEffect pushes amber ring + electric column and cleans up', () => {
		const before = getActiveEffects().length;
		spawnBatteryAutomatonDeployEffect({ x: 1, z: -2 }, { radius: 1.4 });
		expect(getActiveEffects().length).toBe(before + 2);

		const effects = getActiveEffects().slice(before);
		const ring = effects.find((fx) => fx.isBatteryAutomatonRing);
		const column = effects.find((fx) => fx.isBatteryAutomatonColumn);

		expect(ring).toBeDefined();
		expect(ring.radius).toBe(1.4);
		expect(ring.duration).toBe(MINION_SUMMON_IN_MS);
		expect(ring.mesh.material.color.getHex()).toBe(BATTERY_AUTOMATON_COLOR);
		expect(ring.mesh.material.emissive.getHex()).toBe(BATTERY_AUTOMATON_EMISSIVE);

		expect(column).toBeDefined();
		expect(column.isBatteryAutomatonColumn).toBe(true);
		expect(column.duration).toBe(MINION_SUMMON_IN_MS);
		expect(column.mesh.material.color.getHex()).toBe(BATTERY_AUTOMATON_COLOR);
		expect(column.mesh.material.emissive.getHex()).toBe(BATTERY_AUTOMATON_EMISSIVE);

		const ringDispose = vi.spyOn(ring.mesh.geometry, 'dispose');
		const columnDispose = vi.spyOn(column.mesh.geometry, 'dispose');
		for (const fx of effects) fx.createdAt = performance.now() - fx.duration - 100;
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
		expect(ringDispose).toHaveBeenCalled();
		expect(columnDispose).toHaveBeenCalled();
	});

	it('spawnBatteryAutomatonDeployEffect honors color, emissive, duration, and radius overrides', () => {
		spawnBatteryAutomatonDeployEffect({ x: 0, z: 0 }, {
			color: 0x123456,
			emissive: 0x654321,
			duration: 900,
			radius: 1.8,
		});
		const effects = getActiveEffects();
		const ring = effects.find((fx) => fx.isBatteryAutomatonRing);
		const column = effects.find((fx) => fx.isBatteryAutomatonColumn);
		expect(ring.radius).toBe(1.8);
		expect(ring.duration).toBe(900);
		expect(column.duration).toBe(900);
		expect(ring.mesh.material.color.getHex()).toBe(0x123456);
		expect(ring.mesh.material.emissive.getHex()).toBe(0x654321);
		expect(column.mesh.material.color.getHex()).toBe(0x123456);
		expect(column.mesh.material.emissive.getHex()).toBe(0x654321);
	});

	it('spawnBatteryChargePulseEffect pushes cyan/amber pulse ring + upward spark burst and cleans up', () => {
		const before = getActiveEffects().length;
		spawnBatteryChargePulseEffect({ x: 2, z: -1 });
		expect(getActiveEffects().length).toBe(before + 2);

		const effects = getActiveEffects().slice(before);
		const ring = effects.find((fx) => fx.isBatteryAutomatonRing);
		const burst = effects.find((fx) => fx.isParticleBurst);

		expect(ring).toBeDefined();
		expect(ring.radius).toBe(1.0);
		expect(ring.duration).toBe(700);
		expect(ring.mesh.material.emissive.getHex()).toBe(BATTERY_AUTOMATON_EMISSIVE);

		expect(burst).toBeDefined();
		expect(burst.isParticleBurst).toBe(true);
		expect(burst.duration).toBe(700);
		expect(burst.mesh.children.length).toBeGreaterThanOrEqual(3);
		expect(burst.mesh.children[0].material.color.getHex()).toBe(BATTERY_AUTOMATON_COLOR);
		expect(burst.mesh.children[0].material.emissive.getHex()).toBe(BATTERY_AUTOMATON_EMISSIVE);

		const ringDispose = vi.spyOn(ring.mesh.geometry, 'dispose');
		const burstDispose = vi.spyOn(burst.mesh.children[0].geometry, 'dispose');
		for (const fx of effects) fx.createdAt = performance.now() - fx.duration - 100;
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
		expect(ringDispose).toHaveBeenCalled();
		expect(burstDispose).toHaveBeenCalled();
	});

	it('spawnAegisSentinelShieldFlourish adds flagged shield wrap with aegis palette and cleans up', () => {
		const before = getActiveEffects().length;
		spawnAegisSentinelShieldFlourish({ x: 0, z: 0 }, { radius: 1.5 });
		expect(getActiveEffects().length).toBe(before + 1);

		const fx = lastEffect();
		expect(fx.isAegisSentinelShield).toBe(true);
		expect(fx.radius).toBe(1.5);
		expect(fx.duration).toBe(MINION_SUMMON_IN_MS);
		expect(Number.isFinite(fx.duration)).toBe(true);
		expect(fx.mesh.children.length).toBeGreaterThanOrEqual(3);

		const ring = fx.mesh.children.find((c) => c.userData.isAegisSentinelRing);
		const dome = fx.mesh.children.find((c) => c.userData.isAegisSentinelDome);
		expect(ring).toBeDefined();
		expect(dome).toBeDefined();
		expect(ring.material.color.getHex()).toBe(AEGIS_SENTINEL_COLOR);
		expect(ring.material.emissive.getHex()).toBe(AEGIS_SENTINEL_EMISSIVE);
		expect(dome.material.color.getHex()).toBe(AEGIS_SENTINEL_COLOR);
		expect(dome.material.emissive.getHex()).toBe(AEGIS_SENTINEL_EMISSIVE);

		const facets = fx.mesh.children.filter((c) => c.userData.isAegisSentinelFacet);
		expect(facets.length).toBeGreaterThanOrEqual(2);
		expect(facets.some((f) => f.material.emissive.getHex() === AEGIS_SENTINEL_GOLD)).toBe(true);

		const disposeSpy = vi.spyOn(ring.geometry, 'dispose');
		fx.createdAt = performance.now() - fx.duration - 100;
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
		expect(disposeSpy).toHaveBeenCalled();
	});

	it('spawnAegisSentinelShieldFlourish honors color, emissive, and duration overrides', () => {
		spawnAegisSentinelShieldFlourish({ x: 1, z: 2 }, {
			color: 0x123456,
			emissive: 0x654321,
			duration: 900,
			radius: 1.8,
		});
		const fx = lastEffect();
		expect(fx.radius).toBe(1.8);
		expect(fx.duration).toBe(900);
		const ring = fx.mesh.children.find((c) => c.userData.isAegisSentinelRing);
		expect(ring.material.color.getHex()).toBe(0x123456);
		expect(ring.material.emissive.getHex()).toBe(0x654321);
	});

	it('spawnAegisSentinelDeployEffect adds flagged ward ring + shield wall and cleans up', () => {
		const before = getActiveEffects().length;
		spawnAegisSentinelDeployEffect({ x: 1, z: -2 }, { radius: 2.0 });
		expect(getActiveEffects().length).toBe(before + 1);

		const fx = lastEffect();
		expect(fx.isAegisSentinelDeploy).toBe(true);
		expect(fx.radius).toBe(2.0);
		expect(fx.duration).toBe(MINION_SUMMON_IN_MS);
		expect(Number.isFinite(fx.duration)).toBe(true);

		const ring = fx.mesh.children.find((c) => c.userData.isAegisSentinelRing);
		const wall = fx.mesh.children.find((c) => c.userData.isAegisSentinelWall);
		const trim = fx.mesh.children.find((c) => c.userData.isAegisSentinelWallTrim);
		expect(ring).toBeDefined();
		expect(wall).toBeDefined();
		expect(trim).toBeDefined();
		expect(ring.material.color.getHex()).toBe(AEGIS_SENTINEL_COLOR);
		expect(ring.material.emissive.getHex()).toBe(AEGIS_SENTINEL_EMISSIVE);
		expect(wall.material.color.getHex()).toBe(AEGIS_SENTINEL_COLOR);
		expect(wall.material.emissive.getHex()).toBe(AEGIS_SENTINEL_EMISSIVE);
		expect(trim.material.emissive.getHex()).toBe(AEGIS_SENTINEL_GOLD);

		const ringDispose = vi.spyOn(ring.geometry, 'dispose');
		const wallDispose = vi.spyOn(wall.geometry, 'dispose');
		fx.createdAt = performance.now() - fx.duration - 100;
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
		expect(ringDispose).toHaveBeenCalled();
		expect(wallDispose).toHaveBeenCalled();
	});

	it('spawnAegisSentinelDeployEffect honors color, emissive, duration, and radius overrides', () => {
		spawnAegisSentinelDeployEffect({ x: 0, z: 0 }, {
			color: 0xabcdef,
			emissive: 0xfedcba,
			duration: 850,
			radius: 2.4,
		});
		const fx = lastEffect();
		expect(fx.radius).toBe(2.4);
		expect(fx.duration).toBe(850);
		const ring = fx.mesh.children.find((c) => c.userData.isAegisSentinelRing);
		const wall = fx.mesh.children.find((c) => c.userData.isAegisSentinelWall);
		expect(ring.material.color.getHex()).toBe(0xabcdef);
		expect(ring.material.emissive.getHex()).toBe(0xfedcba);
		expect(wall.material.color.getHex()).toBe(0xabcdef);
		expect(wall.material.emissive.getHex()).toBe(0xfedcba);
	});

	it('spawnBatteryChargePulseEffect honors style.duration and palette overrides', () => {
		spawnBatteryChargePulseEffect({ x: 0, z: 0 }, {
			color: 0xabcdef,
			emissive: 0xfedcba,
			duration: 800,
			radius: 1.3,
		});
		const effects = getActiveEffects();
		const ring = effects.find((fx) => fx.isBatteryAutomatonRing);
		const burst = effects.find((fx) => fx.isParticleBurst);
		expect(ring.radius).toBe(1.3);
		expect(ring.duration).toBe(800);
		expect(ring.mesh.material.emissive.getHex()).toBe(0xfedcba);
		expect(burst.duration).toBe(800);
		expect(burst.mesh.children[0].material.color.getHex()).toBe(0xabcdef);
		expect(burst.mesh.children[0].material.emissive.getHex()).toBe(0xfedcba);
	});

	it('spawnChronoTriggerEffect pushes staggered time ripples + temporal column with amber/cyan palette', () => {
		const before = getActiveEffects().length;
		spawnChronoTriggerEffect({ x: 2, z: -1 }, 2);
		expect(getActiveEffects().length).toBe(before + 3);

		const effects = getActiveEffects().slice(before);
		const ripples = effects.filter((fx) => fx.isChronoTriggerRipple);
		const column = effects.find((fx) => fx.isChronoTriggerColumn);

		expect(ripples.length).toBe(2);
		for (const ripple of ripples) {
			expect(ripple.radius).toBe(2);
			expect(Number.isFinite(ripple.duration)).toBe(true);
			expect(ripple.duration).toBeGreaterThan(0);
			expect(ripple.wave).toBeGreaterThanOrEqual(0);
			expect(ripple.waveCount).toBe(2);
			expect(ripple.mesh.material.color.getHex()).toBe(0xf59e0b);
			expect(ripple.mesh.material.emissive.getHex()).toBe(0x67e8f9);
		}
		expect(ripples[0].wave).toBe(0);
		expect(ripples[1].wave).toBe(1);
		expect(ripples[1].createdAt).toBeGreaterThan(ripples[0].createdAt);

		expect(column).toBeDefined();
		expect(column.isChronoTriggerColumn).toBe(true);
		expect(Number.isFinite(column.duration)).toBe(true);
		expect(column.duration).toBeGreaterThan(0);
		expect(column.mesh.material.color.getHex()).toBe(0xf59e0b);
		expect(column.mesh.material.emissive.getHex()).toBe(0x67e8f9);

		const rippleDispose = vi.spyOn(ripples[0].mesh.geometry, 'dispose');
		const columnDispose = vi.spyOn(column.mesh.geometry, 'dispose');
		for (const fx of effects) fx.createdAt = performance.now() - fx.duration - 100;
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
		expect(rippleDispose).toHaveBeenCalled();
		expect(columnDispose).toHaveBeenCalled();
	});

	it('spawnChronoTriggerEffect defaults radius to 2 and honors color overrides', () => {
		spawnChronoTriggerEffect({ x: 0, z: 0 });
		const ripple = getActiveEffects().find((fx) => fx.isChronoTriggerRipple);
		expect(ripple.radius).toBe(2);

		getActiveEffects().length = 0;
		spawnChronoTriggerEffect({ x: 0, z: 0 }, 1.6, {
			color: 0x123456,
			emissive: 0x654321,
			duration: 900,
		});
		const effects = getActiveEffects();
		const rippleFx = effects.find((fx) => fx.isChronoTriggerRipple);
		const columnFx = effects.find((fx) => fx.isChronoTriggerColumn);
		expect(rippleFx.radius).toBe(1.6);
		expect(rippleFx.duration).toBe(900);
		expect(columnFx.duration).toBe(900);
		expect(rippleFx.mesh.material.color.getHex()).toBe(0x123456);
		expect(rippleFx.mesh.material.emissive.getHex()).toBe(0x654321);
		expect(columnFx.mesh.material.color.getHex()).toBe(0x123456);
		expect(columnFx.mesh.material.emissive.getHex()).toBe(0x654321);
	});

	it('spawnLegionMarshalRallyEffect defaults radius to 2 and honors color overrides', () => {
		spawnLegionMarshalRallyEffect({ x: 0, z: 0 });
		const ring = getActiveEffects().find((fx) => fx.kind === ATTACK_EFFECT_KINDS.expandFadeRing);
		expect(ring.radius).toBe(2);

		getActiveEffects().length = 0;
		spawnLegionMarshalRallyEffect({ x: 0, z: 0 }, 1.6, {
			color: 0x123456,
			emissive: 0x654321,
			duration: 900,
		});
		const effects = getActiveEffects();
		const ringFx = effects.find((fx) => fx.kind === ATTACK_EFFECT_KINDS.expandFadeRing);
		const columnFx = effects.find((fx) => fx.isLegionMarshalColumn);
		expect(ringFx.radius).toBe(1.6);
		expect(ringFx.duration).toBe(900);
		expect(columnFx.duration).toBe(900);
		expect(ringFx.mesh.material.color.getHex()).toBe(0x123456);
		expect(ringFx.mesh.material.emissive.getHex()).toBe(0x654321);
		expect(columnFx.mesh.material.color.getHex()).toBe(0x123456);
		expect(columnFx.mesh.material.emissive.getHex()).toBe(0x654321);
	});

	it('spawnEtherSiphonEffect pushes a contracting violet ring + ascending ether column', () => {
		const before = getActiveEffects().length;
		spawnEtherSiphonEffect({ x: 3, z: -1 }, 2.2);
		expect(getActiveEffects().length).toBe(before + 2);

		const effects = getActiveEffects().slice(before);
		const ring = effects.find((fx) => fx.isEtherSiphonRing);
		const column = effects.find((fx) => fx.isEtherSiphonColumn);

		expect(ring).toBeDefined();
		expect(ring.radius).toBe(2.2);
		expect(Number.isFinite(ring.duration)).toBe(true);
		expect(ring.duration).toBeGreaterThan(0);
		expect(ring.mesh.material.color.getHex()).toBe(0xa855f7);
		expect(ring.mesh.material.emissive.getHex()).toBe(0x9333ea);

		expect(column).toBeDefined();
		expect(Number.isFinite(column.duration)).toBe(true);
		expect(column.duration).toBeGreaterThan(0);
		expect(column.mesh.material.color.getHex()).toBe(0xa855f7);
		expect(column.mesh.material.emissive.getHex()).toBe(0x9333ea);

		const ringDispose = vi.spyOn(ring.mesh.geometry, 'dispose');
		const columnDispose = vi.spyOn(column.mesh.geometry, 'dispose');
		for (const fx of effects) fx.createdAt = performance.now() - fx.duration - 100;
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
		expect(ringDispose).toHaveBeenCalled();
		expect(columnDispose).toHaveBeenCalled();
	});

	it('spawnEtherSiphonEffect honors color/emissive/duration style overrides', () => {
		spawnEtherSiphonEffect({ x: 0, z: 0 }, 1.5, {
			color: 0x123456,
			emissive: 0x654321,
			duration: 900,
		});
		const effects = getActiveEffects();
		const ring = effects.find((fx) => fx.isEtherSiphonRing);
		const column = effects.find((fx) => fx.isEtherSiphonColumn);
		expect(ring.duration).toBe(900);
		expect(column.duration).toBe(900);
		expect(ring.mesh.material.color.getHex()).toBe(0x123456);
		expect(ring.mesh.material.emissive.getHex()).toBe(0x654321);
		expect(column.mesh.material.color.getHex()).toBe(0x123456);
		expect(column.mesh.material.emissive.getHex()).toBe(0x654321);
	});

	it('spawnDragonsBreathEffect pushes a forward breath cone + ground scorch fan', () => {
		const before = getActiveEffects().length;
		spawnDragonsBreathEffect({ x: 1, z: -2 }, { x: 1, z: 0 });
		expect(getActiveEffects().length).toBe(before + 2);

		const effects = getActiveEffects();
		const scorch = effects[before];
		const cone = effects[before + 1];

		expect(scorch.kind).toBe(ATTACK_EFFECT_KINDS.dragonsBreathScorch);
		expect(scorch.isDragonsBreathScorch).toBe(true);
		expect(scorch.radius).toBe(7);
		expect(scorch.duration).toBe(2250);
		expect(scorch.mesh.material.color.getHex()).toBe(0xfb923c);
		expect(scorch.mesh.material.emissive.getHex()).toBe(0xff3b00);

		expect(cone.isDragonsBreathCone).toBe(true);
		expect(cone.range).toBe(7);
		expect(cone.duration).toBe(2250);
		expect(cone.mesh.material.color.getHex()).toBe(0xfb923c);
		expect(cone.mesh.material.emissive.getHex()).toBe(0xff3b00);

		const scorchDisposeSpy = vi.spyOn(scorch.mesh.geometry, 'dispose');
		const coneDisposeSpy = vi.spyOn(cone.mesh.geometry, 'dispose');
		scorch.createdAt = performance.now() - scorch.duration - 100;
		cone.createdAt = performance.now() - cone.duration - 100;
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
		expect(scorchDisposeSpy).toHaveBeenCalled();
		expect(coneDisposeSpy).toHaveBeenCalled();
	});

	it('spawnGravityWellEffect pushes contracting pull ring, void core, and inward inflow', () => {
		const before = getActiveEffects().length;
		spawnGravityWellEffect({ x: 2, z: -4 }, 12);
		expect(getActiveEffects().length).toBe(before + 3);

		const effects = getActiveEffects().slice(before);
		const ring = effects.find((fx) => fx.isGravityWellRing);
		const voidCore = effects.find((fx) => fx.isGravityWellVoid);
		const inflow = effects.find((fx) => fx.isGravityWellInflow);

		expect(ring).toBeDefined();
		expect(ring.isGravityWellPull).toBe(true);
		expect(ring.pullRadius).toBe(12);
		expect(ring.duration).toBe(ATTACK_EFFECT_DURATION);
		expect(ring.mesh.material.color.getHex()).toBe(0xc084fc);
		expect(ring.mesh.material.emissive.getHex()).toBe(0xa855f7);

		expect(voidCore).toBeDefined();
		expect(voidCore.isGravityWellPull).toBe(true);
		expect(voidCore.duration).toBe(ATTACK_EFFECT_DURATION);
		expect(voidCore.mesh.material.color.getHex()).toBe(0x581c87);

		expect(inflow).toBeDefined();
		expect(inflow.isGravityWellPull).toBe(true);
		expect(inflow.duration).toBe(ATTACK_EFFECT_DURATION);
		expect(inflow.mesh.children.length).toBeGreaterThanOrEqual(2);
		const sampleParticle = inflow.mesh.children[0];
		const sampleVel = sampleParticle.userData.velocity;
		const samplePos = sampleParticle.position;
		expect(samplePos.x * sampleVel.x + samplePos.z * sampleVel.z).toBeLessThan(0);

		const ringDisposeSpy = vi.spyOn(ring.mesh.geometry, 'dispose');
		const coreDisposeSpy = vi.spyOn(voidCore.mesh.geometry, 'dispose');
		const inflowDisposeSpy = vi.spyOn(inflow.mesh.children[0].geometry, 'dispose');
		for (const fx of effects) fx.createdAt = performance.now() - fx.duration - 100;
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
		expect(ringDisposeSpy).toHaveBeenCalled();
		expect(coreDisposeSpy).toHaveBeenCalled();
		expect(inflowDisposeSpy).toHaveBeenCalled();
	});

	it('spawnGravityWellEffect honors style.color, style.emissive, and style.duration', () => {
		getActiveEffects().length = 0;
		spawnGravityWellEffect({ x: 0, z: 0 }, 8, {
			color: 0x112233,
			emissive: 0x445566,
			duration: 900,
		});
		const ring = getActiveEffects().find((fx) => fx.isGravityWellRing);
		expect(ring.duration).toBe(900);
		expect(ring.mesh.material.color.getHex()).toBe(0x112233);
		expect(ring.mesh.material.emissive.getHex()).toBe(0x445566);
	});

	it('spawnInfernoPillarEffect pushes a fire scorch ring + rising thermal column', () => {
		const before = getActiveEffects().length;
		spawnInfernoPillarEffect({ x: 1, z: -2 }, 3.5);
		expect(getActiveEffects().length).toBe(before + 2);

		const effects = getActiveEffects();
		const ring = effects[before];
		const column = effects[before + 1];

		expect(ring.kind).toBe(ATTACK_EFFECT_KINDS.expandFadeRing);
		expect(ring.radius).toBe(3.5);
		expect(ring.duration).toBe(2250);
		expect(column.isThermalColumn).toBe(true);
		expect(column.duration).toBe(2250);
		expect(column.mesh.material.color.getHex()).toBe(0xef4444);
		expect(column.mesh.material.emissive.getHex()).toBe(0xdc2626);

		const ringDisposeSpy = vi.spyOn(ring.mesh.geometry, 'dispose');
		const columnDisposeSpy = vi.spyOn(column.mesh.geometry, 'dispose');
		ring.createdAt = performance.now() - ring.duration - 100;
		column.createdAt = performance.now() - column.duration - 100;
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
		expect(ringDisposeSpy).toHaveBeenCalled();
		expect(columnDisposeSpy).toHaveBeenCalled();
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

	it('dismissMirrorWardShellEffect removes tracked shell by playerId immediately', () => {
		const before = getActiveEffects().length;
		spawnMirrorWardShellEffect({ x: 0, z: 0 }, 11, { playerId: 'p1' });
		expect(getActiveEffects().length).toBe(before + 1);

		const fx = lastEffect();
		expect(fx.isMirrorWardShell).toBe(true);
		expect(fx.playerId).toBe('p1');

		const ring = fx.mesh.children.find((c) => c.userData.isMirrorWardRing);
		const disposeSpy = vi.spyOn(ring.geometry, 'dispose');
		dismissMirrorWardShellEffect('p1');

		expect(getActiveEffects().length).toBe(before);
		expect(getActiveEffects().some((e) => e.isMirrorWardShell && e.playerId === 'p1')).toBe(false);
		expect(disposeSpy).toHaveBeenCalled();
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

	it('spawnEventHorizonEffect adds a singularity group with palette, radii, and cleanup', () => {
		const before = getActiveEffects().length;
		spawnEventHorizonEffect({ x: 0, z: 0 }, 12, 2.5);
		expect(getActiveEffects().length).toBe(before + 1);

		const fx = lastEffect();
		expect(fx.isEventHorizonEffect).toBe(true);
		expect(fx.pullRadius).toBe(12);
		expect(fx.centerRadius).toBe(2.5);
		expect(Number.isFinite(fx.duration)).toBe(true);
		expect(fx.duration).toBeGreaterThan(0);

		const core = fx.mesh.children.find((c) => c.userData.isEventHorizonCore);
		const accretion = fx.mesh.children.find((c) => c.userData.isEventHorizonAccretion);
		const halo = fx.mesh.children.find((c) => c.userData.isEventHorizonHalo);
		const particles = fx.mesh.children.filter((c) => c.userData.isEventHorizonParticle);

		expect(core).toBeDefined();
		expect(accretion).toBeDefined();
		expect(halo).toBeDefined();
		expect(particles.length).toBeGreaterThanOrEqual(8);

		expect(core.material.color.getHex()).toBeLessThanOrEqual(0x1a0a2e);
		expect(accretion.material.color.getHex()).toBe(0x581c87);
		expect(accretion.material.emissive.getHex()).toBe(0x7c3aed);
		expect(halo.material.emissive.getHex()).toBe(0x7c3aed);

		const disposeSpy = vi.spyOn(core.geometry, 'dispose');
		fx.createdAt = performance.now() - fx.duration - 100;
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
		expect(disposeSpy).toHaveBeenCalled();
	});

	it('spawnEventHorizonEffect honors color/emissive style overrides', () => {
		spawnEventHorizonEffect({ x: 1, z: -2 }, 8, 1.8, {
			color: 0x123456,
			emissive: 0x654321,
			duration: 850,
		});
		const fx = lastEffect();
		expect(fx.duration).toBe(850);
		const accretion = fx.mesh.children.find((c) => c.userData.isEventHorizonAccretion);
		expect(accretion.material.color.getHex()).toBe(0x123456);
		expect(accretion.material.emissive.getHex()).toBe(0x654321);
	});

	it('spawnGlacierRuptureEffect pushes ice-fracture ring + shard burst with glacier palette', () => {
		const before = getActiveEffects().length;
		spawnGlacierRuptureEffect({ x: 2, z: -3 }, 2.2);
		expect(getActiveEffects().length).toBe(before + 2);

		const effects = getActiveEffects().slice(before);
		const ring = effects.find((fx) => fx.isGlacierRuptureRing);
		const shards = effects.find((fx) => fx.isGlacierRuptureShards);

		expect(ring).toBeDefined();
		expect(ring.radius).toBe(2.2);
		expect(Number.isFinite(ring.duration)).toBe(true);
		expect(ring.duration).toBeGreaterThan(0);
		expect(ring.mesh.material.color.getHex()).toBe(0x38bdf8);
		expect(ring.mesh.material.emissive.getHex()).toBe(0x0ea5e9);

		expect(shards).toBeDefined();
		expect(shards.mesh.children.length).toBeGreaterThanOrEqual(3);
		expect(Number.isFinite(shards.duration)).toBe(true);
		expect(shards.duration).toBeGreaterThan(0);
		expect(shards.mesh.children[0].material.color.getHex()).toBe(0x38bdf8);
		expect(shards.mesh.children[0].material.emissive.getHex()).toBe(0x0ea5e9);

		const ringDispose = vi.spyOn(ring.mesh.geometry, 'dispose');
		const shardDispose = vi.spyOn(shards.mesh.children[0].geometry, 'dispose');
		for (const fx of effects) fx.createdAt = performance.now() - fx.duration - 100;
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
		expect(ringDispose).toHaveBeenCalled();
		expect(shardDispose).toHaveBeenCalled();
	});

	it('spawnGlacierRuptureEffect honors style.color, style.emissive, and style.duration', () => {
		spawnGlacierRuptureEffect({ x: 0, z: 0 }, 1.5, {
			color: 0x123456,
			emissive: 0x654321,
			duration: 900,
		});
		const ring = getActiveEffects().find((fx) => fx.isGlacierRuptureRing);
		const shards = getActiveEffects().find((fx) => fx.isGlacierRuptureShards);
		expect(ring.duration).toBe(900);
		expect(shards.duration).toBe(900);
		expect(ring.mesh.material.color.getHex()).toBe(0x123456);
		expect(ring.mesh.material.emissive.getHex()).toBe(0x654321);
		expect(shards.mesh.children[0].material.color.getHex()).toBe(0x123456);
		expect(shards.mesh.children[0].material.emissive.getHex()).toBe(0x654321);
	});

	it('spawnAttackEffect ice_ball adds a glacial orb projectile and cleans it up', () => {
		const before = getActiveEffects().length;
		spawnAttackEffect(
			{ x: 0, z: 0 },
			{ x: 1, z: 0 },
			{
				effect: 'ice_ball',
				range: 9,
				projectileTravelMs: 1200,
				color: 0x67e8f9,
				emissive: 0x38bdf8,
			},
		);
		expect(getActiveEffects().length).toBe(before + 1);

		const fx = lastEffect();
		expect(fx.isGlacialOrbProjectile).toBe(true);
		expect(fx.range).toBe(9);
		expect(fx.duration).toBe(1200);
		expect(fx.mesh.children.length).toBeGreaterThanOrEqual(2);
		const core = fx.mesh.children[0];
		expect(core.material.color.getHex()).toBe(0x67e8f9);
		expect(core.material.emissive.getHex()).toBe(0x38bdf8);

		fx.createdAt = performance.now() - fx.duration - 100;
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

	it('spawnSolarEdgeImpactFlourish adds flagged solar disc, corona, and embers with default palette', () => {
		const before = getActiveEffects().length;
		spawnSolarEdgeImpactFlourish({ x: 0, z: 0 }, { x: 1, z: 0 });
		expect(getActiveEffects().length).toBe(before + 1);

		const fx = lastEffect();
		expect(fx.isSolarEdgeImpact).toBe(true);
		expect(fx.duration).toBe(ATTACK_EFFECT_DURATION);
		expect(Number.isFinite(fx.duration)).toBe(true);
		expect(fx.ringRadius).toBeGreaterThanOrEqual(1.8);
		expect(fx.ringRadius).toBeLessThanOrEqual(2.2);
		expect(fx.origin.x).toBeCloseTo(ATTACK_RANGE);
		expect(fx.origin.z).toBeCloseTo(0);

		const disc = fx.mesh.children.find((c) => c.userData.isSolarEdgeDisc);
		const corona = fx.mesh.children.find((c) => c.userData.isSolarEdgeCorona);
		const embers = fx.mesh.children.filter((c) => c.userData.isSolarEdgeEmber);
		expect(disc).toBeDefined();
		expect(corona).toBeDefined();
		expect(embers.length).toBeGreaterThanOrEqual(10);
		expect(embers.length).toBeLessThanOrEqual(14);
		expect(disc.material.color.getHex()).toBe(SOLAR_EDGE_CORE_COLOR);
		expect(disc.material.emissive.getHex()).toBe(SOLAR_EDGE_CORE_EMISSIVE);
		expect(corona.material.color.getHex()).toBe(SOLAR_EDGE_CORONA_COLOR);
		expect(corona.material.emissive.getHex()).toBe(SOLAR_EDGE_CORONA_EMISSIVE);
		expect(embers[0].material.color.getHex()).toBe(SOLAR_EDGE_CORE_COLOR);
		expect(embers[0].material.emissive.getHex()).toBe(SOLAR_EDGE_CORONA_EMISSIVE);

		const disposeSpy = vi.spyOn(disc.geometry, 'dispose');
		fx.createdAt = performance.now() - fx.duration - 100;
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
		expect(disposeSpy).toHaveBeenCalled();
	});

	it('spawnSolarEdgeImpactFlourish honors color, emissive, corona, range, and duration overrides', () => {
		spawnSolarEdgeImpactFlourish({ x: 2, z: 3 }, { x: 0, z: 1 }, {
			color: 0x123456,
			emissive: 0x654321,
			coronaColor: 0xabcdef,
			coronaEmissive: 0xfedcba,
			range: 4.5,
			duration: 900,
			ringRadius: 1.9,
		});
		const fx = lastEffect();
		expect(fx.duration).toBe(900);
		expect(fx.ringRadius).toBe(1.9);
		expect(fx.origin.x).toBeCloseTo(2);
		expect(fx.origin.z).toBeCloseTo(7.5);

		const disc = fx.mesh.children.find((c) => c.userData.isSolarEdgeDisc);
		const corona = fx.mesh.children.find((c) => c.userData.isSolarEdgeCorona);
		expect(disc.material.color.getHex()).toBe(0x123456);
		expect(disc.material.emissive.getHex()).toBe(0x654321);
		expect(corona.material.color.getHex()).toBe(0xabcdef);
		expect(corona.material.emissive.getHex()).toBe(0xfedcba);
	});

	it('spawnAttackEffect arcane_bolt adds a flagged violet lance projectile and cleans it up', () => {
		const before = getActiveEffects().length;
		spawnAttackEffect(
			{ x: 0, z: 0 },
			{ x: 1, z: 0 },
			{
				effect: 'arcane_bolt',
				range: 10,
				color: 0xa78bfa,
				emissive: 0x7c3aed,
				projectileTravelMs: ATTACK_EFFECT_DURATION,
			},
		);
		expect(getActiveEffects().length).toBe(before + 1);

		const fx = lastEffect();
		expect(fx.isArcaneBoltProjectile).toBe(true);
		expect(fx.range).toBe(10);
		expect(fx.duration).toBe(ATTACK_EFFECT_DURATION);
		expect(fx.coreMesh.material.color.getHex()).toBe(0xa78bfa);
		expect(fx.coreMesh.material.emissive.getHex()).toBe(0x7c3aed);

		const disposeSpy = vi.spyOn(fx.coreMesh.geometry, 'dispose');
		fx.createdAt = performance.now() - fx.duration - 100;
		updateAttackEffects();

		expect(getActiveEffects().length).toBe(before);
		expect(disposeSpy).toHaveBeenCalled();
	});
});
