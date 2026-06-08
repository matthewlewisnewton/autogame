import { describe, it, expect, beforeEach } from 'vitest';
import {
	renderCardUsed,
	resolveRenderers,
	getAccentHex,
} from '../cardRenderers.js';
import { CARD_DEFS } from '../cards.js';

/**
 * Build a fresh context object whose helper functions record every call.
 * Each test inspects `ctx._calls` (a sequence of `[method, ...args]` tuples)
 * to assert exactly which renderer/audio helpers fired and in what order.
 */
function makeCtx(overrides = {}) {
	const calls = [];
	const record = (name) => (...args) => calls.push([name, ...args]);
	const ctx = {
		spawnAttackEffect: record('spawnAttackEffect'),
		spawnSummonEffect: record('spawnSummonEffect'),
		spawnDivineGraceEffect: record('spawnDivineGraceEffect'),
		spawnPurifyingPulseHealRing: record('spawnPurifyingPulseHealRing'),
		spawnCleanseBurstEffect: record('spawnCleanseBurstEffect'),
		spawnInfernoPillarEffect: record('spawnInfernoPillarEffect'),
		spawnChainLightningEffect: record('spawnChainLightningEffect'),
		spawnLightningArc: record('spawnLightningArc'),
		spawnParticleBurst: record('spawnParticleBurst'),
		spawnProjectileTrail: record('spawnProjectileTrail'),
		spawnImpactDecal: record('spawnImpactDecal'),
		spawnTelegraphRing: record('spawnTelegraphRing'),
		flashMesh: record('flashMesh'),
		spawnHitSpark: record('spawnHitSpark'),
		enemyMeshes: () => ({}),
		playSound: record('playSound'),
		scheduleAfter: (ms, fn) => {
			calls.push(['scheduleAfter', ms]);
			fn();
		},
		myId: 'me',
		_calls: calls,
		...overrides,
	};
	return ctx;
}

function methodsCalled(ctx) {
	return ctx._calls.map((c) => c[0]);
}

describe('resolveRenderers()', () => {
	it('returns the per-card renderer when one is registered', () => {
		expect(resolveRenderers('infinite_disk')).toHaveLength(1);
		expect(resolveRenderers('fireball')).toHaveLength(1);
		expect(resolveRenderers('ice_ball')).toHaveLength(1);
		expect(resolveRenderers('divine_grace')).toHaveLength(1);
		expect(resolveRenderers('purifying_pulse')).toHaveLength(1);
		expect(resolveRenderers('spike_trap')).toHaveLength(1);
		expect(resolveRenderers('undead_commander')).toHaveLength(1);
		expect(resolveRenderers('thunderbird')).toHaveLength(1);
	});

	it('returns the composed renderer list for cards with multiple visuals', () => {
		expect(resolveRenderers('inferno_pillar')).toHaveLength(2);
	});

	it('falls back to the weapon default for plain weapon cards', () => {
		expect(resolveRenderers('reapers_scythe')).toHaveLength(1);
		expect(resolveRenderers('deck_sifter')).toHaveLength(1);
	});

	it('returns the card-specific weapon swing for the styled standard blades', () => {
		expect(resolveRenderers('iron_sword')).toHaveLength(1);
		expect(resolveRenderers('flame_blade')).toHaveLength(1);
		expect(resolveRenderers('harvesting_scythe')).toHaveLength(1);
		// Distinct from the plain cone-swing default.
		expect(resolveRenderers('iron_sword')[0]).not.toBe(resolveRenderers('reapers_scythe')[0]);
	});

	it('returns card-specific renderers for the energy/photon blades (not the cone default)', () => {
		const plain = resolveRenderers('reapers_scythe')[0];
		for (const cardId of ['saber_of_light', 'photon_slicer', 'arcane_bolt', 'resonance_edge', 'echo_blade']) {
			expect(resolveRenderers(cardId)).toHaveLength(1);
			expect(resolveRenderers(cardId)[0]).not.toBe(plain);
		}
	});

	it('returns the heavy greatsword renderer for the wind-up greatswords (not the cone default)', () => {
		const plain = resolveRenderers('reapers_scythe')[0];
		for (const cardId of ['steel_claymore', 'magma_greatsword', 'excalibur_photon']) {
			expect(resolveRenderers(cardId)).toHaveLength(1);
			expect(resolveRenderers(cardId)[0]).not.toBe(plain);
		}
		// All three share the same heavy-greatsword renderer.
		expect(resolveRenderers('steel_claymore')[0]).toBe(resolveRenderers('magma_greatsword')[0]);
		expect(resolveRenderers('steel_claymore')[0]).toBe(resolveRenderers('excalibur_photon')[0]);
	});

	it('falls back to the spell default for plain spell cards', () => {
		expect(resolveRenderers('battle_familiar')).toHaveLength(1);
		expect(resolveRenderers('frost_nova')).toHaveLength(1);
	});

	it('returns an empty list for creature/enchantment cards without an override', () => {
		expect(resolveRenderers('battery_automaton')).toEqual([]);
	});

	it('returns wyrm attack renderer for Vault Wyrm and Archive Wyrm', () => {
		expect(resolveRenderers('dungeon_drake')).toHaveLength(1);
		expect(resolveRenderers('ancient_wyrm')).toHaveLength(1);
	});

	it('returns bespoke attack renderers for Phase Stalker and Bulkhead Mauler', () => {
		expect(resolveRenderers('null_crawler')).toHaveLength(1);
		expect(resolveRenderers('bulkhead_mauler')).toHaveLength(1);
	});

	it('returns the chain_lightning arc renderer for Voltaic Chain', () => {
		expect(resolveRenderers('chain_lightning')).toHaveLength(1);
	});

	it('returns an empty list for unknown card ids', () => {
		expect(resolveRenderers('not_a_real_card')).toEqual([]);
	});

	it('returns a fresh array (mutating one does not affect the next call)', () => {
		const a = resolveRenderers('inferno_pillar');
		a.pop();
		const b = resolveRenderers('inferno_pillar');
		expect(b).toHaveLength(2);
	});
});

describe('getAccentHex()', () => {
	it('parses the hex color string from CARD_ACCENT_STYLE', () => {
		expect(getAccentHex('saber_of_light')).toBe(0xfef08a);
		expect(getAccentHex('frost_nova')).toBe(0x67e8f9);
	});

	it('returns undefined when the card has no accent style', () => {
		expect(getAccentHex('iron_sword')).toBeUndefined();
	});

	it('returns undefined for unknown card ids', () => {
		expect(getAccentHex('not_a_real_card')).toBeUndefined();
	});
});

describe('renderCardUsed() — common post-effects', () => {
	it('always plays the card sound exactly once', () => {
		const ctx = makeCtx();
		renderCardUsed({ cardId: 'iron_sword', hits: [] }, ctx);
		const cardSoundCount = ctx._calls.filter((c) => c[0] === 'playSound' && c[1] === 'card').length;
		expect(cardSoundCount).toBe(1);
	});

	it('no-ops when data is null', () => {
		const ctx = makeCtx();
		renderCardUsed(null, ctx);
		expect(ctx._calls).toEqual([]);
	});

	it('renders the enchantment trigger ring when enchantmentTriggered is set', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'spike_trap',
			origin: { x: 1, z: 2 },
			radius: 3,
			enchantmentTriggered: true,
		}, ctx);
		const triggerCalls = ctx._calls.filter(
			(c) => c[0] === 'spawnSummonEffect' && c[3] && c[3].color === 0xfbbf24,
		);
		expect(triggerCalls).toHaveLength(1);
		expect(triggerCalls[0][1]).toEqual({ x: 1, z: 2 });
		expect(triggerCalls[0][2]).toBe(3);
	});

	it('plays the heal sound when the local player gained HP from Healing Font', () => {
		const ctx = makeCtx({ myId: 'me' });
		renderCardUsed({
			cardId: 'healing_font',
			origin: { x: 0, z: 0 },
			radius: 4,
			hpGained: 6,
			playerId: 'me',
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'playSound' && c[1] === 'heal')).toBe(true);
	});

	it('does not play the heal sound when another player used Healing Font', () => {
		const ctx = makeCtx({ myId: 'me' });
		renderCardUsed({
			cardId: 'healing_font',
			origin: { x: 0, z: 0 },
			radius: 4,
			hpGained: 6,
			playerId: 'someone-else',
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'playSound' && c[1] === 'heal')).toBe(false);
	});

	it('plays a single enemyHit sound for multi-hit events (throttle)', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'iron_sword',
			hits: [
				{ enemyId: 'e1' },
				{ enemyId: 'e2' },
				{ enemyId: 'e3' },
			],
		}, ctx);
		const hitSounds = ctx._calls.filter((c) => c[0] === 'playSound' && c[1] === 'enemyHit');
		expect(hitSounds).toHaveLength(1);
	});

	it('does not play enemyHit sound when no enemies were hit', () => {
		const ctx = makeCtx();
		renderCardUsed({ cardId: 'iron_sword', hits: [] }, ctx);
		expect(ctx._calls.some((c) => c[0] === 'playSound' && c[1] === 'enemyHit')).toBe(false);
	});

	it('suppresses the regular enemyHit sound when shockwave hits are present (shockwave plays its own)', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'echo_blade',
			origin: { x: 0, z: 0 },
			hits: [{ enemyId: 'e1' }],
			shockwaveHits: [{ enemyId: 'e2' }],
		}, ctx);
		const hitSounds = ctx._calls.filter((c) => c[0] === 'playSound' && c[1] === 'enemyHit');
		// One from the shockwave only — not doubled by the regular hit path.
		expect(hitSounds).toHaveLength(1);
	});

	it('flashes every hit enemy mesh with the accent color (or white fallback)', () => {
		const meshes = { e1: { id: 'mesh-1' }, e2: { id: 'mesh-2' } };
		const ctx = makeCtx({ enemyMeshes: () => meshes });
		renderCardUsed({
			cardId: 'iron_sword',
			hits: [{ enemyId: 'e1' }, { enemyId: 'e2' }],
		}, ctx);
		const flashes = ctx._calls.filter((c) => c[0] === 'flashMesh');
		expect(flashes).toHaveLength(2);
		expect(flashes[0]).toEqual(['flashMesh', meshes.e1, 0xffffff, 200]);
		expect(flashes[1]).toEqual(['flashMesh', meshes.e2, 0xffffff, 200]);
	});

	it('uses a longer cyan flash for frozenShatter hits', () => {
		const meshes = { e1: { id: 'mesh-1' } };
		const ctx = makeCtx({ enemyMeshes: () => meshes });
		renderCardUsed({
			cardId: 'glacier_collapse',
			origin: { x: 0, z: 0 },
			radius: 4,
			hits: [{ enemyId: 'e1', frozenShatter: true }],
		}, ctx);
		const flashes = ctx._calls.filter((c) => c[0] === 'flashMesh');
		expect(flashes).toHaveLength(1);
		expect(flashes[0][2]).toBe(0x7dd3fc);
		expect(flashes[0][3]).toBe(350);
	});

	it('uses the card accent color when flashing enemies of accented cards', () => {
		const meshes = { e1: {} };
		const ctx = makeCtx({ enemyMeshes: () => meshes });
		renderCardUsed({
			cardId: 'saber_of_light',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			hits: [{ enemyId: 'e1' }],
		}, ctx);
		const flash = ctx._calls.find((c) => c[0] === 'flashMesh');
		expect(flash[2]).toBe(0xfef08a);
	});

	it('renders a shockwave summon ring at radius 6 with the accent color', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'echo_blade',
			origin: { x: 5, z: 6 },
			shockwaveHits: [{ enemyId: 'e1' }],
		}, ctx);
		const shock = ctx._calls.find(
			(c) => c[0] === 'spawnSummonEffect' && c[2] === 6,
		);
		expect(shock).toBeDefined();
		expect(shock[1]).toEqual({ x: 5, z: 6 });
	});
});

describe('renderCardUsed() — weapon dispatch', () => {
	it('spawns a single attack effect for a standard one-swing weapon', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'reapers_scythe',
			origin: { x: 1, z: 2 },
			direction: { x: 0, z: 1 },
			hits: [],
		}, ctx);
		const attacks = ctx._calls.filter((c) => c[0] === 'spawnAttackEffect');
		expect(attacks).toHaveLength(1);
		expect(attacks[0][1]).toEqual({ x: 1, z: 2 });
		expect(attacks[0][2]).toEqual({ x: 0, z: 1 });
	});

	it('spawns swingCount attack effects for multi-swing weapons', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'reapers_scythe',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			swingCount: 3,
			hits: [],
		}, ctx);
		const attacks = ctx._calls.filter((c) => c[0] === 'spawnAttackEffect');
		expect(attacks).toHaveLength(3);
	});

	it('staggers photon_barrage swings via scheduleAfter (80ms per swing)', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'excalibur_photon',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			swingCount: 3,
			specialEffect: 'photon_barrage',
			hits: [],
		}, ctx);
		const schedules = ctx._calls.filter((c) => c[0] === 'scheduleAfter');
		// First swing fires immediately (no scheduleAfter), swings 2 and 3 delay.
		expect(schedules.map((c) => c[1])).toEqual([80, 160]);
	});

	it('spawns three offset projectiles for infinite_disk / triple_returning_projectile', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'infinite_disk',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			specialEffect: 'triple_returning_projectile',
			hits: [],
		}, ctx);
		const attacks = ctx._calls.filter((c) => c[0] === 'spawnAttackEffect');
		expect(attacks).toHaveLength(3);
		// All three share the cyan disc style.
		for (const a of attacks) {
			expect(a[3]).toEqual({ color: 0xa5f3fc, emissive: 0x22d3ee });
		}
		// Perpendicular offsets along z for a +x facing direction → distinct z coords.
		const zs = attacks.map((a) => a[1].z).sort((p, q) => p - q);
		expect(zs).toEqual([-0.6, 0, 0.6]);
	});

	it('infinite_disk adds a cyan trail and spark burst along the disk path', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'infinite_disk',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			hits: [],
		}, ctx);
		// Still three offset disks.
		expect(ctx._calls.filter((c) => c[0] === 'spawnAttackEffect')).toHaveLength(3);
		const trail = ctx._calls.find((c) => c[0] === 'spawnProjectileTrail');
		expect(trail).toBeDefined();
		expect(trail[3]).toMatchObject({ color: 0xa5f3fc, emissive: 0x22d3ee });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 3.5, z: 0 });
		expect(burst[2]).toMatchObject({ color: 0xa5f3fc, emissive: 0x22d3ee });
	});

	it('infinite_disk still renders three disks without the new ctx primitives', () => {
		const ctx = makeCtx({ spawnProjectileTrail: undefined, spawnParticleBurst: undefined });
		expect(() => renderCardUsed({
			cardId: 'infinite_disk',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			hits: [],
		}, ctx)).not.toThrow();
		expect(ctx._calls.filter((c) => c[0] === 'spawnAttackEffect')).toHaveLength(3);
	});

	it('spawns a single fireball-effect projectile for fireball', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'fireball',
			effect: 'fireball',
			origin: { x: 1, z: 2 },
			direction: { x: 1, z: 0 },
			attackRange: 9,
			hits: [],
		}, ctx);
		const attacks = ctx._calls.filter((c) => c[0] === 'spawnAttackEffect');
		expect(attacks).toHaveLength(1);
		expect(attacks[0][1]).toEqual({ x: 1, z: 2 });
		expect(attacks[0][3]).toMatchObject({ effect: 'fireball', range: 9 });
	});

	it('fireball adds an accent-tinted projectile trail, impact decal and ember burst', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'fireball',
			origin: { x: 1, z: 2 },
			direction: { x: 1, z: 0 },
			attackRange: 9,
			hits: [],
		}, ctx);
		// fireball accent color is 0xf97316
		const trail = ctx._calls.find((c) => c[0] === 'spawnProjectileTrail');
		expect(trail).toBeDefined();
		expect(trail[1]).toEqual({ x: 1, z: 2 });
		expect(trail[2]).toEqual({ x: 1, z: 0 });
		expect(trail[3]).toMatchObject({ range: 9, color: 0xf97316 });
		// Impact decal + ember burst land at origin + direction * range = (10, 2).
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		expect(decal).toBeDefined();
		expect(decal[1]).toEqual({ x: 10, z: 2 });
		expect(decal[2]).toMatchObject({ color: 0xf97316 });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 10, z: 2 });
		expect(burst[2]).toMatchObject({ color: 0xf97316 });
	});

	it('fireball still renders without throwing when the new ctx primitives are absent', () => {
		const ctx = makeCtx({
			spawnProjectileTrail: undefined,
			spawnImpactDecal: undefined,
			spawnParticleBurst: undefined,
		});
		expect(() => renderCardUsed({
			cardId: 'fireball',
			origin: { x: 1, z: 2 },
			direction: { x: 1, z: 0 },
			attackRange: 9,
			hits: [],
		}, ctx)).not.toThrow();
		// The original projectile visual still fires.
		expect(ctx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(true);
	});

	it('spawns a single ice_ball-effect projectile with slow travel time', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'ice_ball',
			effect: 'ice_ball',
			origin: { x: 1, z: 2 },
			direction: { x: 1, z: 0 },
			attackRange: 9,
			projectileTravelMs: 1200,
			hits: [],
		}, ctx);
		const attacks = ctx._calls.filter((c) => c[0] === 'spawnAttackEffect');
		expect(attacks).toHaveLength(1);
		expect(attacks[0][1]).toEqual({ x: 1, z: 2 });
		expect(attacks[0][3]).toMatchObject({
			effect: 'ice_ball',
			range: 9,
			projectileTravelMs: 1200,
		});
	});
});

describe('renderCardUsed() — styled weapon slashes', () => {
	function swingStyle(ctx) {
		const attack = ctx._calls.find((c) => c[0] === 'spawnAttackEffect');
		expect(attack).toBeDefined();
		return attack[3];
	}

	it('Rust-Forged Saber slashes a tight steely arc with a spark burst and no trail/decal', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'iron_sword',
			origin: { x: 1, z: 2 },
			direction: { x: 1, z: 0 },
			hits: [],
		}, ctx);
		const style = swingStyle(ctx);
		expect(style).toMatchObject({ color: 0x94a3b8, coneAngle: Math.PI / 5, range: 4 });
		// Steel slash kicks up sparks but no flame trail and no ground decal.
		expect(ctx._calls.some((c) => c[0] === 'spawnParticleBurst')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'spawnProjectileTrail')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnImpactDecal')).toBe(false);
	});

	it('Solar Edge slashes a warm fiery arc with a flame trail and ember burst', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'flame_blade',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			hits: [],
		}, ctx);
		const style = swingStyle(ctx);
		expect(style).toMatchObject({ color: 0xff7a18, emissive: 0xff3b00, range: 5 });
		const trail = ctx._calls.find((c) => c[0] === 'spawnProjectileTrail');
		expect(trail).toBeDefined();
		expect(trail[3]).toMatchObject({ color: 0xff7a18, range: 5 });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[2]).toMatchObject({ color: 0xff7a18 });
		// No lingering decal for the fiery blade.
		expect(ctx._calls.some((c) => c[0] === 'spawnImpactDecal')).toBe(false);
	});

	it('Ether Scythe slashes a wide ghostly arc with a lingering decal', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'harvesting_scythe',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			hits: [],
		}, ctx);
		const style = swingStyle(ctx);
		expect(style).toMatchObject({ color: 0x86efac, emissive: 0x8b5cf6, coneAngle: (Math.PI * 2) / 3, range: 6 });
		// Decal lands out along the sweep at range * 0.6 = 3.6.
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		expect(decal).toBeDefined();
		expect(decal[1].x).toBeCloseTo(3.6);
		expect(decal[1].z).toBe(0);
		expect(decal[2]).toMatchObject({ color: 0x86efac });
		// Wide ghostly sweep adds no flame trail.
		expect(ctx._calls.some((c) => c[0] === 'spawnProjectileTrail')).toBe(false);
	});

	it('the three blades use mutually distinct colors and arc shapes', () => {
		const styleFor = (cardId) => {
			const ctx = makeCtx();
			renderCardUsed({ cardId, origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, hits: [] }, ctx);
			return swingStyle(ctx);
		};
		const iron = styleFor('iron_sword');
		const flame = styleFor('flame_blade');
		const scythe = styleFor('harvesting_scythe');
		const colors = new Set([iron.color, flame.color, scythe.color]);
		expect(colors.size).toBe(3);
		const cones = new Set([iron.coneAngle, flame.coneAngle, scythe.coneAngle]);
		expect(cones.size).toBe(3);
	});

	it('weapon swing degrades gracefully when the optional ctx primitives are absent', () => {
		const ctx = makeCtx({
			spawnProjectileTrail: undefined,
			spawnImpactDecal: undefined,
			spawnParticleBurst: undefined,
		});
		expect(() => renderCardUsed({
			cardId: 'flame_blade',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			hits: [],
		}, ctx)).not.toThrow();
		// The core cone swing still fires.
		expect(ctx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(true);
	});
});

describe('renderCardUsed() — energy & photon blade slashes', () => {
	function fire(cardId, ctx, extra = {}) {
		renderCardUsed({ cardId, origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, hits: [], ...extra }, ctx);
	}
	function swingStyle(ctx) {
		const attack = ctx._calls.find((c) => c[0] === 'spawnAttackEffect');
		expect(attack).toBeDefined();
		return attack[3];
	}

	it('Saber of Light slashes a radiant pale-gold arc using its accent color', () => {
		const ctx = makeCtx();
		fire('saber_of_light', ctx);
		const style = swingStyle(ctx);
		expect(style).toMatchObject({ color: 0xfef08a, coneAngle: Math.PI / 3, range: 5.5 });
		// Radiant blade throws sparks but no flame trail.
		expect(ctx._calls.some((c) => c[0] === 'spawnParticleBurst')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'spawnProjectileTrail')).toBe(false);
	});

	it('Photon Slicer cuts a wide cyan spin slice with a light trail', () => {
		const ctx = makeCtx();
		fire('photon_slicer', ctx);
		const style = swingStyle(ctx);
		expect(style).toMatchObject({ color: 0x22d3ee, coneAngle: Math.PI, range: 4.5 });
		expect(ctx._calls.some((c) => c[0] === 'spawnProjectileTrail')).toBe(true);
	});

	it('Arcane Bolt thrusts a tight violet energy lance with a beam streak', () => {
		const ctx = makeCtx();
		fire('arcane_bolt', ctx);
		const style = swingStyle(ctx);
		expect(style).toMatchObject({ color: 0xa78bfa, coneAngle: Math.PI / 9, range: 7.5 });
		const trail = ctx._calls.find((c) => c[0] === 'spawnProjectileTrail');
		expect(trail).toBeDefined();
		expect(trail[3]).toMatchObject({ color: 0xa78bfa, range: 7.5 });
	});

	it('Resonance Edge slashes magenta and rings twice via a scheduled second pulse', () => {
		const ctx = makeCtx();
		fire('resonance_edge', ctx);
		const style = swingStyle(ctx);
		expect(style).toMatchObject({ color: 0xe879f9, coneAngle: Math.PI / 3.5 });
		// Double pulse: two telegraph rings, the second delayed via scheduleAfter.
		const rings = ctx._calls.filter((c) => c[0] === 'spawnTelegraphRing');
		expect(rings).toHaveLength(2);
		expect(rings[0][2]).toBe(1.6);
		expect(rings[1][2]).toBe(2.6);
		const schedules = ctx._calls.filter((c) => c[0] === 'scheduleAfter');
		expect(schedules.map((c) => c[1])).toEqual([130]);
		// Both pulses share the magenta accent.
		for (const r of rings) expect(r[3]).toMatchObject({ color: 0xe879f9 });
	});

	it('Phase Echo swings pink, then schedules a fainter echo swing', () => {
		const ctx = makeCtx();
		fire('echo_blade', ctx);
		const attacks = ctx._calls.filter((c) => c[0] === 'spawnAttackEffect');
		// Twin slash: the swing plus its delayed echo.
		expect(attacks).toHaveLength(2);
		expect(attacks[0][3]).toMatchObject({ color: 0xf472b6, coneAngle: Math.PI / 4 });
		// The echo is fainter than the lead swing.
		expect(attacks[1][3].fillOpacity).toBeLessThan(attacks[0][3].fillOpacity);
		expect(attacks[1][3].edgeOpacity).toBeLessThan(attacks[0][3].edgeOpacity);
		// Delivered via a delayed second swing.
		const schedules = ctx._calls.filter((c) => c[0] === 'scheduleAfter');
		expect(schedules.map((c) => c[1])).toEqual([150]);
	});

	it('the five energy blades use mutually distinct accent colors', () => {
		const colorFor = (cardId) => {
			const ctx = makeCtx();
			fire(cardId, ctx);
			return swingStyle(ctx).color;
		};
		const colors = new Set(
			['saber_of_light', 'photon_slicer', 'arcane_bolt', 'resonance_edge', 'echo_blade'].map(colorFor),
		);
		expect(colors.size).toBe(5);
	});

	it('energy blade slashes degrade gracefully when optional ctx primitives are absent', () => {
		const ctx = makeCtx({
			spawnProjectileTrail: undefined,
			spawnParticleBurst: undefined,
			spawnTelegraphRing: undefined,
			spawnImpactDecal: undefined,
		});
		for (const cardId of ['saber_of_light', 'photon_slicer', 'arcane_bolt', 'resonance_edge', 'echo_blade']) {
			expect(() => fire(cardId, ctx)).not.toThrow();
		}
		// Each blade's core cone swing still fired.
		expect(ctx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(true);
	});
});

describe('renderCardUsed() — heavy wind-up greatswords', () => {
	function fire(cardId, ctx, extra = {}) {
		renderCardUsed({ cardId, origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, hits: [], ...extra }, ctx);
	}
	function swingStyle(ctx) {
		const attack = ctx._calls.find((c) => c[0] === 'spawnAttackEffect');
		expect(attack).toBeDefined();
		return attack[3];
	}
	function impactDecal(ctx) {
		return ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
	}
	function debrisBurst(ctx) {
		return ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
	}

	it('Alloy Greatblade cleaves a wide slate arc with a large decal and heavy debris', () => {
		const ctx = makeCtx();
		fire('steel_claymore', ctx);
		const style = swingStyle(ctx);
		expect(style).toMatchObject({ color: 0x94a3b8, coneAngle: Math.PI / 2.2, range: 7 });
		// Larger-radius decal + high-count debris burst at the strike point (range = 7).
		const decal = impactDecal(ctx);
		expect(decal).toBeDefined();
		expect(decal[1]).toEqual({ x: 7, z: 0 });
		expect(decal[2]).toMatchObject({ color: 0x94a3b8, radius: 3.2 });
		const burst = debrisBurst(ctx);
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 7, z: 0 });
		expect(burst[2]).toMatchObject({ color: 0x94a3b8, count: 18 });
	});

	it('Corebreaker Greatsword erupts a wide magma swing with the biggest decal/debris', () => {
		const ctx = makeCtx();
		fire('magma_greatsword', ctx);
		const style = swingStyle(ctx);
		expect(style).toMatchObject({ color: 0xf97316, emissive: 0xff3b00, coneAngle: Math.PI / 1.8, range: 7 });
		const decal = impactDecal(ctx);
		expect(decal[2]).toMatchObject({ color: 0xf97316, radius: 3.8 });
		const burst = debrisBurst(ctx);
		expect(burst[2]).toMatchObject({ color: 0xf97316, count: 24 });
	});

	it('Excalibur Photon greatslashes magenta with a light-shard burst, honoring the photon_barrage stagger', () => {
		const ctx = makeCtx();
		fire('excalibur_photon', ctx, { swingCount: 2, specialEffect: 'photon_barrage' });
		const style = swingStyle(ctx);
		expect(style).toMatchObject({ color: 0xe879f9, coneAngle: Math.PI / 2.5, range: 6 });
		// Two staggered swings (first immediate, second delayed 80ms).
		expect(ctx._calls.filter((c) => c[0] === 'spawnAttackEffect')).toHaveLength(2);
		expect(ctx._calls.filter((c) => c[0] === 'scheduleAfter').map((c) => c[1])).toEqual([80]);
		const decal = impactDecal(ctx);
		expect(decal[1]).toEqual({ x: 6, z: 0 });
		expect(decal[2]).toMatchObject({ color: 0xe879f9, radius: 3.0 });
		expect(debrisBurst(ctx)[2]).toMatchObject({ color: 0xe879f9, count: 20 });
	});

	it('the three greatswords use mutually distinct accent colors and an impact param', () => {
		const read = (cardId) => {
			const ctx = makeCtx();
			fire(cardId, ctx);
			return { color: swingStyle(ctx).color, decalRadius: impactDecal(ctx)[2].radius, count: debrisBurst(ctx)[2].count };
		};
		const rows = ['steel_claymore', 'magma_greatsword', 'excalibur_photon'].map(read);
		expect(new Set(rows.map((r) => r.color)).size).toBe(3);
		// Differ from each other by at least one impact param too (decal radius).
		expect(new Set(rows.map((r) => r.decalRadius)).size).toBe(3);
	});

	it('hit harder than the lighter sub-ticket 01/02 blades (bigger decal + more particles)', () => {
		// Lighter blades top out around 12 sparks and use the default ~0.8 decal radius.
		for (const cardId of ['steel_claymore', 'magma_greatsword', 'excalibur_photon']) {
			const ctx = makeCtx();
			fire(cardId, ctx);
			expect(impactDecal(ctx)[2].radius).toBeGreaterThan(2);
			expect(debrisBurst(ctx)[2].count).toBeGreaterThan(12);
		}
	});

	it('greatsword swings degrade gracefully when the optional impact primitives are absent', () => {
		const ctx = makeCtx({ spawnImpactDecal: undefined, spawnParticleBurst: undefined });
		for (const cardId of ['steel_claymore', 'magma_greatsword', 'excalibur_photon']) {
			expect(() => fire(cardId, ctx)).not.toThrow();
		}
		// The core heavy cone swing still fires.
		expect(ctx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(true);
	});

	it('each greatsword carries a positive windUpMs so the 315 charge telegraph fires', () => {
		for (const cardId of ['steel_claymore', 'magma_greatsword', 'excalibur_photon']) {
			expect(CARD_DEFS[cardId]).toBeDefined();
			expect(CARD_DEFS[cardId].windUpMs).toBeGreaterThan(0);
		}
	});

	it('Solar Edge (flame_blade) carries a positive windUpMs so the 315 charge telegraph fires', () => {
		expect(CARD_DEFS['flame_blade']).toBeDefined();
		expect(CARD_DEFS['flame_blade'].windUpMs).toBeGreaterThan(0);
	});
});

describe('renderCardUsed() — spell dispatch', () => {
	it('spawns a generic accent-tinted ring for plain spell cards', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'frost_nova',
			origin: { x: 0, z: 0 },
			radius: 4,
			hits: [],
		}, ctx);
		const ring = ctx._calls.find((c) => c[0] === 'spawnSummonEffect');
		expect(ring).toBeDefined();
		expect(ring[2]).toBe(4);
		// frost_nova accent color is 0x67e8f9
		expect(ring[3]).toEqual({ color: 0x67e8f9, emissive: 0x67e8f9 });
	});

	it('uses the fixed glacier palette for glacier_collapse (not the accent)', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'glacier_collapse',
			origin: { x: 0, z: 0 },
			radius: 5,
			hits: [],
		}, ctx);
		const ring = ctx._calls.find((c) => c[0] === 'spawnSummonEffect');
		expect(ring[3]).toEqual({ color: 0x38bdf8, emissive: 0x0ea5e9 });
	});

	it('healing_font renders the heal ring and plays heal sound when hpGained > 0', () => {
		const ctx = makeCtx({ myId: 'me' });
		renderCardUsed({
			cardId: 'healing_font',
			origin: { x: 0, z: 0 },
			radius: 3,
			hpGained: 6,
			playerId: 'me',
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnDivineGraceEffect')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'playSound' && c[1] === 'heal')).toBe(true);
	});

	it('healing_font does not play heal sound when no HP was gained', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'healing_font',
			origin: { x: 0, z: 0 },
			radius: 3,
			hpGained: 0,
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'playSound' && c[1] === 'heal')).toBe(false);
	});

	it('divine_grace renders the heal ring and plays heal sound when hpGained > 0', () => {
		const ctx = makeCtx({ myId: 'me' });
		renderCardUsed({
			cardId: 'divine_grace',
			origin: { x: 0, z: 0 },
			radius: 3,
			hpGained: 10,
			playerId: 'me',
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnDivineGraceEffect')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'playSound' && c[1] === 'heal')).toBe(true);
	});

	it('divine_grace does not play heal sound when no HP was gained', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'divine_grace',
			origin: { x: 0, z: 0 },
			radius: 3,
			hpGained: 0,
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'playSound' && c[1] === 'heal')).toBe(false);
	});

	it('purifying_pulse renders heal ring and cleanse burst with heal sound', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'purifying_pulse',
			origin: { x: 2, z: 3 },
			radius: 5.5,
			specialEffect: 'heal_and_cleanse',
			hits: [],
		}, ctx);
		const healRing = ctx._calls.find((c) => c[0] === 'spawnPurifyingPulseHealRing');
		const cleanse = ctx._calls.find((c) => c[0] === 'spawnCleanseBurstEffect');
		expect(healRing).toBeDefined();
		expect(healRing[1]).toEqual({ x: 2, z: 3 });
		expect(healRing[2]).toBe(5.5);
		expect(cleanse).toBeDefined();
		expect(cleanse[1]).toEqual({ x: 2, z: 3 });
		expect(ctx._calls.some((c) => c[0] === 'playSound' && c[1] === 'heal')).toBe(true);
	});

	it('purifying_pulse skips VFX when radius is absent', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'purifying_pulse',
			origin: { x: 0, z: 0 },
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnPurifyingPulseHealRing')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnCleanseBurstEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'playSound' && c[1] === 'heal')).toBe(false);
	});

	it('event_horizon renders both the outer pull ring and the inner crush ring', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'event_horizon',
			origin: { x: 0, z: 0 },
			radius: 12,
			centerRadius: 2.5,
			hits: [],
		}, ctx);
		const rings = ctx._calls.filter((c) => c[0] === 'spawnSummonEffect');
		const radii = rings.map((r) => r[2]).sort((p, q) => p - q);
		expect(radii).toEqual([2.5, 12]);
	});

	it('inferno_pillar renders both the pillar and the accent AoE ring', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'inferno_pillar',
			origin: { x: 0, z: 0 },
			radius: 7,
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnInfernoPillarEffect')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(true);
	});

	it('inferno_pillar adds an accent telegraph ring and ember burst at the eruption point', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'inferno_pillar',
			origin: { x: 4, z: 5 },
			radius: 7,
			hits: [],
		}, ctx);
		// inferno_pillar accent color is 0xef4444
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[1]).toEqual({ x: 4, z: 5 });
		expect(ring[2]).toBe(7);
		expect(ring[3]).toMatchObject({ color: 0xef4444 });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 4, z: 5 });
		expect(burst[2]).toMatchObject({ color: 0xef4444 });
	});

	it('inferno_pillar still renders without throwing when the new ctx primitives are absent', () => {
		const ctx = makeCtx({ spawnTelegraphRing: undefined, spawnParticleBurst: undefined });
		expect(() => renderCardUsed({
			cardId: 'inferno_pillar',
			origin: { x: 0, z: 0 },
			radius: 7,
			hits: [],
		}, ctx)).not.toThrow();
		expect(ctx._calls.some((c) => c[0] === 'spawnInfernoPillarEffect')).toBe(true);
	});
});

describe('renderCardUsed() — creature dispatch', () => {
	it('does not render any extra visuals for vanilla creature spawns', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'battle_familiar',
			origin: { x: 0, z: 0 },
			hits: [],
		}, ctx);
		// Only the card sound — no summon ring, no attack flash.
		expect(methodsCalled(ctx)).toEqual(['playSound']);
	});

	it('Vault Wyrm minion breath renders a forward cone hitbox on breath start', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'dungeon_drake',
			origin: { x: 1, z: 2 },
			direction: { x: 0, z: 1 },
			attackRange: 4,
			attackConeAngle: Math.PI / 4,
			breathPhase: 'start',
			breathDurationMs: 2000,
			hits: [{ enemyId: 'e1', hp: 47 }],
		}, ctx);
		const attacks = ctx._calls.filter((c) => c[0] === 'spawnAttackEffect');
		expect(attacks).toHaveLength(1);
		expect(attacks[0][1]).toEqual({ x: 1, z: 2 });
		expect(attacks[0][2]).toEqual({ x: 0, z: 1 });
		expect(attacks[0][3]).toMatchObject({ range: 4, coneAngle: Math.PI / 4, duration: 2000 });
	});

	it('Vault Wyrm breath ticks skip duplicate cone visuals but still emit hit particles', () => {
		const ctx = makeCtx({
			enemyMeshes: () => ({
				e1: { position: { x: 2, y: 0.5, z: 3 } },
			}),
		});
		renderCardUsed({
			cardId: 'dungeon_drake',
			origin: { x: 1, z: 2 },
			direction: { x: 0, z: 1 },
			attackRange: 4,
			attackConeAngle: Math.PI / 4,
			breathPhase: 'tick',
			hits: [{ enemyId: 'e1', hp: 44 }],
		}, ctx);
		expect(ctx._calls.filter((c) => c[0] === 'spawnAttackEffect')).toHaveLength(0);
		expect(ctx._calls.filter((c) => c[0] === 'spawnHitSpark')).toHaveLength(1);
	});

	it('Archive Wyrm fire breath renders a channeled cone hitbox', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'ancient_wyrm',
			specialEffect: 'fire_breath',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			attackRange: 8,
			attackConeAngle: Math.PI / 3,
			breathPhase: 'start',
			breathDurationMs: 2500,
			hits: [{ enemyId: 'e1', hp: 46 }],
		}, ctx);
		const attacks = ctx._calls.filter((c) => c[0] === 'spawnAttackEffect');
		expect(attacks).toHaveLength(1);
		expect(attacks[0][3]).toMatchObject({
			range: 8,
			coneAngle: Math.PI / 3,
			color: 0xef4444,
			emissive: 0x9333ea,
			duration: 2500,
		});
	});

	it('Phase Stalker beam renders a narrow projectile corridor', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'null_crawler',
			specialEffect: 'phase_beam',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			attackRange: 14,
			hitWidth: 0.8,
			hits: [{ enemyId: 'e1', hp: 34 }],
		}, ctx);
		const attacks = ctx._calls.filter((c) => c[0] === 'spawnAttackEffect');
		expect(attacks).toHaveLength(1);
		expect(attacks[0][3]).toMatchObject({
			effect: 'returning_projectile',
			returnPasses: 0,
			range: 14,
			projectileHitWidth: 0.8,
			color: 0x22d3ee,
		});
	});

	it('Bulkhead Mauler shockwave renders a short wide cone', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'bulkhead_mauler',
			specialEffect: 'shockwave_sweep',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			attackRange: 4,
			attackConeAngle: (Math.PI * 2) / 3,
			hits: [{ enemyId: 'e1', hp: 41 }],
		}, ctx);
		const attacks = ctx._calls.filter((c) => c[0] === 'spawnAttackEffect');
		expect(attacks).toHaveLength(1);
		expect(attacks[0][3]).toMatchObject({
			range: 4,
			coneAngle: (Math.PI * 2) / 3,
			color: 0x78716c,
			emissive: 0xf59e0b,
		});
		// Accent-tinted debris burst at the construct's feet.
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 0, z: 0 });
		expect(burst[2]).toMatchObject({ color: 0x78716c, emissive: 0xf59e0b });
	});

	it('Bulkhead Mauler still renders without throwing when spawnParticleBurst is absent', () => {
		const ctx = makeCtx({ spawnParticleBurst: undefined });
		expect(() => renderCardUsed({
			cardId: 'bulkhead_mauler',
			specialEffect: 'shockwave_sweep',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			attackRange: 4,
			attackConeAngle: (Math.PI * 2) / 3,
			hits: [{ enemyId: 'e1', hp: 41 }],
		}, ctx)).not.toThrow();
		expect(ctx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(true);
	});

	it('undead_commander renders a caster ring and one ring per spawned skeleton', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'undead_commander',
			origin: { x: 0, z: 0 },
			summonedMinions: [
				{ x: 1, z: 0 },
				{ x: 0, z: 1 },
			],
			hits: [],
		}, ctx);
		const rings = ctx._calls.filter((c) => c[0] === 'spawnSummonEffect');
		// 1 caster ring (radius 2) + 2 skeleton rings (radius 1.2)
		expect(rings).toHaveLength(3);
		const radii = rings.map((r) => r[2]).sort();
		expect(radii).toEqual([1.2, 1.2, 2]);
	});

	it('thunderbird (chain_lightning) renders zap + enemy-hit cue + follow-up attack', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'thunderbird',
			origin: { x: 3, z: 4 },
			direction: { x: 1, z: 0 },
			specialEffect: 'chain_lightning',
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnChainLightningEffect')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(true);
		const hitSounds = ctx._calls.filter((c) => c[0] === 'playSound' && c[1] === 'enemyHit');
		expect(hitSounds).toHaveLength(1);
	});

	it('chain_lightning with two chainSegments invokes spawnLightningArc twice', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'chain_lightning',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			chainSegments: [
				{ from: { x: 0, z: 0 }, to: { x: 5, z: 0 } },
				{ from: { x: 5, z: 0 }, to: { x: 8, z: 0 } },
			],
			hits: [
				{ enemyId: 'e1', hp: 50 },
				{ enemyId: 'e2', hp: 30 },
			],
		}, ctx);
		const arcs = ctx._calls.filter((c) => c[0] === 'spawnLightningArc');
		expect(arcs).toHaveLength(2);
		expect(arcs[0][1]).toEqual({ x: 0, z: 0 });
		expect(arcs[0][2]).toEqual({ x: 5, z: 0 });
		expect(arcs[1][1]).toEqual({ x: 5, z: 0 });
		expect(arcs[1][2]).toEqual({ x: 8, z: 0 });
		expect(ctx._calls.some((c) => c[0] === 'spawnChainLightningEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'playSound' && c[1] === 'enemyHit')).toBe(true);
	});
});

describe('renderCardUsed() — enchantment dispatch', () => {
	it('spike_trap renders a red ground-trap AoE preview at the placement point', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'spike_trap',
			origin: { x: 2, z: 3 },
			radius: 2.5,
			hits: [],
		}, ctx);
		const rings = ctx._calls.filter(
			(c) => c[0] === 'spawnSummonEffect' && c[3] && c[3].color === 0xf87171,
		);
		expect(rings).toHaveLength(1);
		expect(rings[0][1]).toEqual({ x: 2, z: 3 });
		expect(rings[0][2]).toBe(2.5);
	});

	it('mirror_ward renders a teal self ring only when target=self', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'mirror_ward',
			origin: { x: 0, z: 0 },
			target: 'self',
			hits: [],
		}, ctx);
		const rings = ctx._calls.filter(
			(c) => c[0] === 'spawnSummonEffect' && c[3] && c[3].color === 0x5eead4,
		);
		expect(rings).toHaveLength(1);
		expect(rings[0][2]).toBe(2);
	});

	it('mirror_ward does nothing when target is not self', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'mirror_ward',
			origin: { x: 0, z: 0 },
			target: 'ground',
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
	});
});
