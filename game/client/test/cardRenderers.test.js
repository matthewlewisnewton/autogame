import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CARD_DEFS, getCardDef } from '../cards.js';
import { ATTACK_EFFECT_DURATION, PHOTON_BARRAGE_SWING_DELAY_MS, SUMMON_EFFECT_DURATION } from '../config.js';
import {
	renderCardUsed,
	resolveRenderers,
	getAccentHex,
	SPELL_TYPE_DEFAULT_RENDERER,
} from '../cardRenderers.js';

/**
 * Build a fresh context object whose helper functions record every call.
 * Each test inspects `ctx._calls` (a sequence of `[method, ...args]` tuples)
 * to assert exactly which renderer/audio helpers fired and in what order.
 */
function makeCtx(overrides = {}) {
	const calls = [];
	const scheduled = [];
	const record = (name) => (...args) => calls.push([name, ...args]);
	const ctx = {
		spawnAttackEffect: record('spawnAttackEffect'),
		spawnSummonEffect: record('spawnSummonEffect'),
		spawnDivineGraceEffect: record('spawnDivineGraceEffect'),
		spawnPurifyingPulseHealRing: record('spawnPurifyingPulseHealRing'),
		spawnCleanseBurstEffect: record('spawnCleanseBurstEffect'),
		spawnInfernoPillarEffect: record('spawnInfernoPillarEffect'),
		spawnDragonsBreathEffect: record('spawnDragonsBreathEffect'),
		spawnChainLightningEffect: record('spawnChainLightningEffect'),
		spawnLightningArc: record('spawnLightningArc'),
		spawnParticleBurst: record('spawnParticleBurst'),
		spawnProjectileTrail: record('spawnProjectileTrail'),
		spawnImpactDecal: record('spawnImpactDecal'),
		spawnTelegraphRing: record('spawnTelegraphRing'),
		spawnSpikeTrapEffect: record('spawnSpikeTrapEffect'),
		spawnMirrorWardShellEffect: record('spawnMirrorWardShellEffect'),
		dismissMirrorWardShellEffect: record('dismissMirrorWardShellEffect'),
		spawnMirrorWardReflectBurst: record('spawnMirrorWardReflectBurst'),
		spawnMinionSummonInEffect: record('spawnMinionSummonInEffect'),
		flashMesh: record('flashMesh'),
		spawnHitSpark: record('spawnHitSpark'),
		enemyMeshes: () => ({}),
		playSound: record('playSound'),
		scheduleAfter: (ms, fn) => {
			calls.push(['scheduleAfter', ms]);
			scheduled.push({ ms, fn, invoked: false });
		},
		runScheduled: () => {
			for (const entry of scheduled) {
				if (!entry.invoked) {
					entry.invoked = true;
					entry.fn();
				}
			}
		},
		myId: 'me',
		_calls: calls,
		_scheduled: scheduled,
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
		const fireballRenderers = resolveRenderers('fireball');
		expect(fireballRenderers).toHaveLength(1);
		expect(fireballRenderers[0].name).toBe('renderFireball');
		expect(resolveRenderers('ice_ball')).toHaveLength(1);
		expect(resolveRenderers('divine_grace')).toHaveLength(1);
		expect(resolveRenderers('purifying_pulse')).toHaveLength(1);
		expect(resolveRenderers('spike_trap')).toHaveLength(1);
		expect(resolveRenderers('undead_commander')).toHaveLength(1);
		expect(resolveRenderers('thunderbird')).toHaveLength(2);
		expect(resolveRenderers('storm_eagle')).toHaveLength(2);
		const breathRenderers = resolveRenderers('dragons_breath');
		expect(breathRenderers).toHaveLength(1);
		expect(breathRenderers[0].name).toBe('renderDragonsBreath');
		const infernoRenderers = resolveRenderers('inferno_pillar');
		expect(infernoRenderers).toHaveLength(1);
		expect(infernoRenderers[0].name).toBe('renderInfernoPillar');
		expect(resolveRenderers('gravity_well')).toHaveLength(1);
		expect(resolveRenderers('deck_sifter')).toHaveLength(1);
		expect(resolveRenderers('chrono_trigger')).toHaveLength(1);
		expect(resolveRenderers('mana_prism')).toHaveLength(1);
	});

	it('returns the composed renderer list for cards with multiple visuals', () => {
		expect(resolveRenderers('event_horizon')).toHaveLength(1);
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

	it('returns the heavy greatsword renderer for alloy/corebreaker (not the cone default)', () => {
		const plain = resolveRenderers('reapers_scythe')[0];
		for (const cardId of ['steel_claymore', 'magma_greatsword']) {
			expect(resolveRenderers(cardId)).toHaveLength(1);
			expect(resolveRenderers(cardId)[0]).not.toBe(plain);
		}
		expect(resolveRenderers('steel_claymore')[0]).toBe(resolveRenderers('magma_greatsword')[0]);
	});

	it('returns a dedicated renderer for excalibur_photon (not heavy greatsword or cone default)', () => {
		const plain = resolveRenderers('reapers_scythe')[0];
		const heavy = resolveRenderers('steel_claymore')[0];
		expect(resolveRenderers('excalibur_photon')).toHaveLength(1);
		expect(resolveRenderers('excalibur_photon')[0]).not.toBe(plain);
		expect(resolveRenderers('excalibur_photon')[0]).not.toBe(heavy);
	});

	it('returns bespoke renderers for utility support spells', () => {
		expect(resolveRenderers('astral_guardian')).toHaveLength(1);
		expect(resolveRenderers('mana_prism')).toHaveLength(1);
		expect(resolveRenderers('sacrificial_altar')).toHaveLength(1);
		expect(resolveRenderers('chrono_trigger')).toHaveLength(1);
	});

	it('returns bespoke renderers for arcane radial spells', () => {
		expect(resolveRenderers('battle_familiar')).toHaveLength(1);
		expect(resolveRenderers('mana_leach')).toHaveLength(1);
		expect(resolveRenderers('soul_drain')).toHaveLength(1);
	});

	it('does not fall back to the spell default for frost_nova and permafrost_lance', () => {
		const frostCtx = makeCtx();
		renderCardUsed({
			cardId: 'frost_nova',
			origin: { x: 0, z: 0 },
			radius: 4,
			hits: [],
		}, frostCtx);
		expect(frostCtx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
		expect(frostCtx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(true);

		const lanceCtx = makeCtx();
		renderCardUsed({
			cardId: 'permafrost_lance',
			origin: { x: 0, z: 0 },
			radius: 6,
			direction: { x: 1, z: 0 },
			hits: [],
		}, lanceCtx);
		expect(lanceCtx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
		expect(lanceCtx._calls.some((c) => c[0] === 'spawnProjectileTrail')).toBe(true);
	});

	it('falls back to the creature default for plain creature cards', () => {
		expect(resolveRenderers('battery_automaton')).toHaveLength(1);
	});

	it('returns an empty list for unknown card ids', () => {
		expect(resolveRenderers('not_a_real_card')).toEqual([]);
	});

	it('returns composed summon + attack renderers for Vault Wyrm and Archive Wyrm', () => {
		expect(resolveRenderers('dungeon_drake')).toHaveLength(2);
		expect(resolveRenderers('ancient_wyrm')).toHaveLength(2);
	});

	it('returns composed summon + attack renderers for Phase Stalker', () => {
		expect(resolveRenderers('null_crawler')).toHaveLength(2);
	});

	it('returns bespoke attack renderer for Bulkhead Mauler', () => {
		expect(resolveRenderers('bulkhead_mauler')).toHaveLength(1);
	});

	it('returns the chain_lightning arc renderer for Voltaic Chain', () => {
		expect(resolveRenderers('chain_lightning')).toHaveLength(1);
	});

	it('returns a fresh array (mutating one does not affect the next call)', () => {
		const a = resolveRenderers('dragons_breath');
		a.pop();
		const b = resolveRenderers('dragons_breath');
		expect(b).toHaveLength(1);
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
		expect(flashes[0]).toEqual(['flashMesh', meshes.e1, 0xffffff, 200, 'e1']);
		expect(flashes[1]).toEqual(['flashMesh', meshes.e2, 0xffffff, 200, 'e2']);
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
		expect(schedules.map((c) => c[1])).toEqual([
			PHOTON_BARRAGE_SWING_DELAY_MS,
			PHOTON_BARRAGE_SWING_DELAY_MS * 2,
		]);
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
		expect(attacks[0][3]).toMatchObject({
			effect: 'fireball',
			range: 9,
			projectileTravelMs: ATTACK_EFFECT_DURATION,
			color: 0xf97316,
			emissive: 0xff3b00,
		});
	});

	it('fireball adds cast flourish, synced travel timing, and deferred terminal impact', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'fireball',
			origin: { x: 1, z: 2 },
			direction: { x: 1, z: 0 },
			attackRange: 9,
			hits: [],
		}, ctx);
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[1]).toEqual({ x: 1, z: 2 });
		expect(ring[3]).toMatchObject({ color: 0xf97316, emissive: 0xff3b00 });
		const castBurst = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst')
			.find((c) => c[1].x === 1 && c[1].z === 2 && c[2].count === 8);
		expect(castBurst).toBeDefined();
		const trail = ctx._calls.find((c) => c[0] === 'spawnProjectileTrail');
		expect(trail).toBeDefined();
		expect(trail[1]).toEqual({ x: 1, z: 2 });
		expect(trail[2]).toEqual({ x: 1, z: 0 });
		expect(trail[3]).toMatchObject({
			range: 9,
			travelMs: ATTACK_EFFECT_DURATION,
			color: 0xf97316,
		});
		const schedules = ctx._calls.filter((c) => c[0] === 'scheduleAfter');
		expect(schedules).toHaveLength(1);
		expect(schedules[0][1]).toBe(ATTACK_EFFECT_DURATION);
		expect(ctx._scheduled).toHaveLength(1);
		expect(ctx._scheduled[0].invoked).toBe(false);
		// Terminal impact at (10, 2) is deferred — not fired synchronously at cast.
		expect(ctx._calls.find((c) => c[0] === 'spawnImpactDecal')).toBeUndefined();
		expect(ctx._calls.filter((c) => c[0] === 'spawnParticleBurst')
			.some((c) => c[1].x === 10 && c[1].z === 2 && c[2].count === 16)).toBe(false);
		ctx.runScheduled();
		expect(ctx._scheduled[0].invoked).toBe(true);
		// Impact decal + ember burst land at origin + direction * range = (10, 2).
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		expect(decal).toBeDefined();
		expect(decal[1]).toEqual({ x: 10, z: 2 });
		expect(decal[2]).toMatchObject({ color: 0xf97316 });
		const terminalBurst = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst')
			.find((c) => c[1].x === 10 && c[1].z === 2 && c[2].count === 16);
		expect(terminalBurst).toBeDefined();
		expect(terminalBurst[2]).toMatchObject({ color: 0xf97316, emissive: 0xff3b00, spread: 2.0 });
	});

	it('fireball has no positive windUpMs (instant cast; 315 charge telegraph absent)', () => {
		expect(CARD_DEFS.fireball).toBeDefined();
		expect(CARD_DEFS.fireball.windUpMs ?? 0).toBeLessThanOrEqual(0);
	});

	it('fireball spawns immediate per-hit ignite bursts at enemy mesh positions', () => {
		const ctx = makeCtx({
			enemyMeshes: () => ({
				e1: { position: { x: 4, y: 0, z: 2 } },
				e2: { position: { x: 7, y: 0, z: 2 } },
			}),
		});
		renderCardUsed({
			cardId: 'fireball',
			effect: 'fireball',
			origin: { x: 1, z: 2 },
			direction: { x: 1, z: 0 },
			attackRange: 9,
			hits: [{ enemyId: 'e1' }, { enemyId: 'e2' }, { enemyId: 'missing' }],
		}, ctx);
		const hitSparks = ctx._calls.filter((c) => c[0] === 'spawnHitSpark');
		expect(hitSparks).toHaveLength(2);
		expect(hitSparks[0][1]).toEqual({ x: 4, y: 0.6, z: 2 });
		expect(hitSparks[1][1]).toEqual({ x: 7, y: 0.6, z: 2 });
		const igniteBursts = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst')
			.filter((c) => c[2].count === 6);
		expect(igniteBursts).toHaveLength(2);
	});

	it('fireball still renders without throwing when the new ctx primitives are absent', () => {
		const ctx = makeCtx({
			spawnProjectileTrail: undefined,
			spawnImpactDecal: undefined,
			spawnParticleBurst: undefined,
			spawnTelegraphRing: undefined,
			spawnHitSpark: undefined,
		});
		expect(() => renderCardUsed({
			cardId: 'fireball',
			origin: { x: 1, z: 2 },
			direction: { x: 1, z: 0 },
			attackRange: 9,
			hits: [],
		}, ctx)).not.toThrow();
		expect(ctx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'scheduleAfter')).toBe(true);
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

	it('ice_ball adds a projectile trail, freeze-crystal burst, and frost decal at impact', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'ice_ball',
			origin: { x: 1, z: 2 },
			direction: { x: 1, z: 0 },
			attackRange: 9,
			projectileTravelMs: 1200,
			hits: [],
		}, ctx);
		const trail = ctx._calls.find((c) => c[0] === 'spawnProjectileTrail');
		expect(trail).toBeDefined();
		expect(trail[1]).toEqual({ x: 1, z: 2 });
		expect(trail[2]).toEqual({ x: 1, z: 0 });
		expect(trail[3]).toMatchObject({ range: 9, color: 0x67e8f9 });
		// Impact at origin + direction * range = (10, 2).
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		expect(decal).toBeDefined();
		expect(decal[1]).toEqual({ x: 10, z: 2 });
		expect(decal[2]).toMatchObject({ color: 0x67e8f9, emissive: 0x38bdf8 });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 10, z: 2 });
		expect(burst[2]).toMatchObject({ color: 0x67e8f9, emissive: 0x38bdf8, count: 14, spread: 1.8 });
	});

	it('ice_ball still renders without throwing when the new ctx primitives are absent', () => {
		const ctx = makeCtx({
			spawnProjectileTrail: undefined,
			spawnImpactDecal: undefined,
			spawnParticleBurst: undefined,
		});
		expect(() => renderCardUsed({
			cardId: 'ice_ball',
			origin: { x: 1, z: 2 },
			direction: { x: 1, z: 0 },
			attackRange: 9,
			projectileTravelMs: 1200,
			hits: [],
		}, ctx)).not.toThrow();
		expect(ctx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(true);
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
		// First pulse is immediate; the second ring is deferred via scheduleAfter.
		const ringsBefore = ctx._calls.filter((c) => c[0] === 'spawnTelegraphRing');
		expect(ringsBefore).toHaveLength(1);
		expect(ringsBefore[0][2]).toBe(1.6);
		const schedules = ctx._calls.filter((c) => c[0] === 'scheduleAfter');
		expect(schedules.map((c) => c[1])).toEqual([130]);
		ctx.runScheduled();
		const rings = ctx._calls.filter((c) => c[0] === 'spawnTelegraphRing');
		expect(rings).toHaveLength(2);
		expect(rings[1][2]).toBe(2.6);
		// Both pulses share the magenta accent.
		for (const r of rings) expect(r[3]).toMatchObject({ color: 0xe879f9 });
	});

	it('Phase Echo swings pink, then schedules a fainter echo swing', () => {
		const ctx = makeCtx();
		fire('echo_blade', ctx);
		const leadAttacks = ctx._calls.filter((c) => c[0] === 'spawnAttackEffect');
		expect(leadAttacks).toHaveLength(1);
		expect(leadAttacks[0][3]).toMatchObject({ color: 0xf472b6, coneAngle: Math.PI / 4 });
		const schedules = ctx._calls.filter((c) => c[0] === 'scheduleAfter');
		expect(schedules.map((c) => c[1])).toEqual([150]);
		ctx.runScheduled();
		const attacks = ctx._calls.filter((c) => c[0] === 'spawnAttackEffect');
		// Twin slash: the swing plus its delayed echo.
		expect(attacks).toHaveLength(2);
		// The echo is fainter than the lead swing.
		expect(attacks[1][3].fillOpacity).toBeLessThan(attacks[0][3].fillOpacity);
		expect(attacks[1][3].edgeOpacity).toBeLessThan(attacks[0][3].edgeOpacity);
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
		expect(ctx._calls.filter((c) => c[0] === 'spawnAttackEffect')).toHaveLength(1);
		expect(ctx._calls.filter((c) => c[0] === 'scheduleAfter').map((c) => c[1])).toEqual([80]);
		ctx.runScheduled();
		expect(ctx._calls.filter((c) => c[0] === 'spawnAttackEffect')).toHaveLength(2);
		const decal = impactDecal(ctx);
		expect(decal[1]).toEqual({ x: 6, z: 0 });
		expect(decal[2]).toMatchObject({ color: 0xe879f9, radius: 3.0 });
		expect(debrisBurst(ctx)[2]).toMatchObject({ color: 0xe879f9, count: 20 });
	});

	it('heavy greatswords (claymore, magma) do not emit photon-only trail or telegraph ring primitives', () => {
		for (const cardId of ['steel_claymore', 'magma_greatsword']) {
			const ctx = makeCtx();
			fire(cardId, ctx);
			expect(ctx._calls.some((c) => c[0] === 'spawnProjectileTrail')).toBe(false);
			expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(false);
		}
	});

	it('the two heavy greatswords use mutually distinct accent colors and an impact param', () => {
		const read = (cardId) => {
			const ctx = makeCtx();
			fire(cardId, ctx);
			return { color: swingStyle(ctx).color, decalRadius: impactDecal(ctx)[2].radius, count: debrisBurst(ctx)[2].count };
		};
		const rows = ['steel_claymore', 'magma_greatsword'].map(read);
		expect(new Set(rows.map((r) => r.color)).size).toBe(2);
		// Differ from each other by at least one impact param too (decal radius).
		expect(new Set(rows.map((r) => r.decalRadius)).size).toBe(2);
	});

	it('hit harder than the lighter sub-ticket 01/02 blades (bigger decal + more particles)', () => {
		// Lighter blades top out around 12 sparks and use the default ~0.8 decal radius.
		for (const cardId of ['steel_claymore', 'magma_greatsword']) {
			const ctx = makeCtx();
			fire(cardId, ctx);
			expect(impactDecal(ctx)[2].radius).toBeGreaterThan(2);
			expect(debrisBurst(ctx)[2].count).toBeGreaterThan(12);
		}
	});

	it('greatsword swings degrade gracefully when the optional impact primitives are absent', () => {
		const ctx = makeCtx({ spawnImpactDecal: undefined, spawnParticleBurst: undefined });
		for (const cardId of ['steel_claymore', 'magma_greatsword']) {
			expect(() => fire(cardId, ctx)).not.toThrow();
		}
		// The core heavy cone swing still fires.
		expect(ctx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(true);
	});

	it('each heavy greatsword carries a positive windUpMs so the 315 charge telegraph fires', () => {
		for (const cardId of ['steel_claymore', 'magma_greatsword']) {
			expect(CARD_DEFS[cardId]).toBeDefined();
			expect(CARD_DEFS[cardId].windUpMs).toBeGreaterThan(0);
		}
	});

	it('Solar Edge (flame_blade) carries a positive windUpMs so the 315 charge telegraph fires', () => {
		expect(CARD_DEFS['flame_blade']).toBeDefined();
		expect(CARD_DEFS['flame_blade'].windUpMs).toBeGreaterThan(0);
	});
});

describe('renderCardUsed() — excalibur_photon', () => {
	function fire(ctx, extra = {}) {
		renderCardUsed({
			cardId: 'excalibur_photon',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			hits: [],
			...extra,
		}, ctx);
	}
	function swingStyle(ctx) {
		const attack = ctx._calls.find((c) => c[0] === 'spawnAttackEffect');
		expect(attack).toBeDefined();
		return attack[3];
	}

	it('matches server timing contract (windUpMs 600, swingsPerUse 2)', () => {
		expect(CARD_DEFS.excalibur_photon.windUpMs).toBe(600);
		expect(CARD_DEFS.excalibur_photon.swingsPerUse).toBe(2);
	});

	it('photon_barrage fires two cone swings staggered by PHOTON_BARRAGE_SWING_DELAY_MS', () => {
		const ctx = makeCtx();
		fire(ctx, { swingCount: 2, specialEffect: 'photon_barrage' });
		expect(ctx._calls.filter((c) => c[0] === 'spawnAttackEffect')).toHaveLength(1);
		expect(ctx._calls.filter((c) => c[0] === 'scheduleAfter').map((c) => c[1])).toEqual([
			PHOTON_BARRAGE_SWING_DELAY_MS,
		]);
		ctx.runScheduled();
		expect(ctx._calls.filter((c) => c[0] === 'spawnAttackEffect')).toHaveLength(2);
	});

	it('schedules impact primitives per swing (second swing behind scheduleAfter)', () => {
		const pending = [];
		const ctx = makeCtx({
			scheduleAfter: (ms, fn) => {
				ctx._calls.push(['scheduleAfter', ms]);
				pending.push({ ms, fn });
			},
		});
		fire(ctx, { swingCount: 2, specialEffect: 'photon_barrage' });
		expect(ctx._calls.filter((c) => c[0] === 'spawnImpactDecal')).toHaveLength(1);
		expect(ctx._calls.filter((c) => c[0] === 'spawnTelegraphRing')).toHaveLength(1);
		expect(ctx._calls.filter((c) => c[0] === 'spawnParticleBurst')).toHaveLength(1);
		expect(pending).toHaveLength(1);
		expect(pending[0].ms).toBe(PHOTON_BARRAGE_SWING_DELAY_MS);
		pending[0].fn();
		expect(ctx._calls.filter((c) => c[0] === 'spawnImpactDecal')).toHaveLength(2);
		expect(ctx._calls.filter((c) => c[0] === 'spawnTelegraphRing')).toHaveLength(2);
		expect(ctx._calls.filter((c) => c[0] === 'spawnParticleBurst')).toHaveLength(2);
	});

	it('greatslashes magenta with trail, pulse ring, and light-shard burst per swing', () => {
		const ctx = makeCtx();
		fire(ctx, { swingCount: 2, specialEffect: 'photon_barrage' });
		ctx.runScheduled();
		const style = swingStyle(ctx);
		expect(style).toMatchObject({ color: 0xe879f9, coneAngle: Math.PI / 2.5, range: 6 });
		const trails = ctx._calls.filter((c) => c[0] === 'spawnProjectileTrail');
		expect(trails).toHaveLength(2);
		for (const trail of trails) {
			expect(trail[3]).toMatchObject({ color: 0xe879f9, emissive: 0xc026d3, range: 6 });
		}
		const rings = ctx._calls.filter((c) => c[0] === 'spawnTelegraphRing');
		expect(rings).toHaveLength(2);
		for (const ring of rings) {
			expect(ring[1]).toEqual({ x: 6, z: 0 });
			expect(ring[2]).toBe(2.1);
			expect(ring[3]).toMatchObject({ color: 0xe879f9, emissive: 0xc026d3 });
		}
		const decals = ctx._calls.filter((c) => c[0] === 'spawnImpactDecal');
		expect(decals).toHaveLength(2);
		expect(decals[0][2]).toMatchObject({ color: 0xe879f9, radius: 3.0 });
		const bursts = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst');
		expect(bursts).toHaveLength(2);
		for (const burst of bursts) {
			expect(burst[1]).toEqual({ x: 6, z: 0 });
			expect(burst[2]).toMatchObject({ color: 0xe879f9, emissive: 0xc026d3, count: 20, spread: 2.2 });
		}
	});

	it('hit harder than the lighter sub-ticket 01/02 blades (bigger decal + more particles)', () => {
		const ctx = makeCtx();
		fire(ctx);
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(decal[2].radius).toBeGreaterThan(2);
		expect(burst[2].count).toBeGreaterThan(12);
	});

	it('degrades gracefully when photon VFX primitives are absent', () => {
		const ctx = makeCtx({
			spawnProjectileTrail: undefined,
			spawnTelegraphRing: undefined,
			spawnImpactDecal: undefined,
			spawnParticleBurst: undefined,
		});
		expect(() => fire(ctx)).not.toThrow();
		expect(ctx._calls.filter((c) => c[0] === 'spawnAttackEffect')).toHaveLength(1);
		expect(ctx._calls.some((c) => c[0] === 'spawnProjectileTrail')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(false);
	});

	it('carries a positive windUpMs so the 315 charge telegraph fires', () => {
		expect(CARD_DEFS.excalibur_photon).toBeDefined();
		expect(CARD_DEFS.excalibur_photon.windUpMs).toBeGreaterThan(0);
	});
});

describe('renderCardUsed() — spell dispatch', () => {
	it('every spell card has a bespoke renderer', () => {
		for (const [cardId, def] of Object.entries(CARD_DEFS)) {
			if (def.type !== 'spell') continue;
			const renderers = resolveRenderers(cardId);
			expect(renderers.length).toBeGreaterThan(0);
			expect(renderers).not.toContain(SPELL_TYPE_DEFAULT_RENDERER);
		}
	});

	it('spell type default renderer still produces accent-tinted summon rings', () => {
		const ctx = makeCtx();
		SPELL_TYPE_DEFAULT_RENDERER({
			cardId: 'frost_nova',
			origin: { x: 0, z: 0 },
			radius: 4,
		}, ctx);
		const ring = ctx._calls.find((c) => c[0] === 'spawnSummonEffect');
		expect(ring).toBeDefined();
		expect(ring[2]).toBe(4);
		expect(ring[3]).toMatchObject({ color: 0x67e8f9 });
	});

	it('battle_familiar adds an indigo arcane telegraph and spark burst at the cast origin', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'battle_familiar',
			origin: { x: 2, z: 3 },
			radius: 4,
			hits: [],
		}, ctx);
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[1]).toEqual({ x: 2, z: 3 });
		expect(ring[2]).toBe(4);
		expect(ring[3]).toMatchObject({ color: 0x818cf8, emissive: 0x6366f1 });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 2, z: 3 });
		expect(burst[2]).toMatchObject({ color: 0x818cf8, count: 14, spread: 2.0 });
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
	});

	it('mana_leach adds a purple drain telegraph and siphon burst at AoE radius', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'mana_leach',
			origin: { x: 1, z: 2 },
			radius: 4,
			specialEffect: 'mana_drain',
			hits: [],
		}, ctx);
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[1]).toEqual({ x: 1, z: 2 });
		expect(ring[2]).toBe(4);
		expect(ring[3]).toMatchObject({ color: 0xa855f7, emissive: 0x9333ea });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[2]).toMatchObject({ color: 0xa855f7, count: 16, spread: 2.2 });
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
	});

	it('soul_drain adds pink drain telegraph, primary burst, and heal flourish decal', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'soul_drain',
			origin: { x: 0, z: 0 },
			radius: 4,
			specialEffect: 'soul_drain',
			hpHealed: 12,
			hits: [],
		}, ctx);
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[3]).toMatchObject({ color: 0xe879f9, emissive: 0xd946ef });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[2]).toMatchObject({ color: 0xe879f9, count: 14, spread: 2.4 });
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		expect(decal).toBeDefined();
		expect(decal[1]).toEqual({ x: 0, z: 0 });
		expect(decal[2]).toMatchObject({ color: 0xd946ef, emissive: 0xf0abfc });
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'playSound' && c[1] === 'heal')).toBe(false);
	});

	it('arcane radial spells still render without throwing when new ctx primitives are absent', () => {
		const minimalCtx = makeCtx({
			spawnTelegraphRing: undefined,
			spawnParticleBurst: undefined,
			spawnImpactDecal: undefined,
		});
		for (const cardId of ['battle_familiar', 'mana_leach', 'soul_drain']) {
			const ctx = { ...minimalCtx, _calls: [] };
			expect(() => renderCardUsed({
				cardId,
				origin: { x: 0, z: 0 },
				radius: 4,
				hits: [],
			}, ctx)).not.toThrow();
		}
	});

	it('frost_nova adds an icy telegraph ring and radial frost burst at the cast origin', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'frost_nova',
			origin: { x: 2, z: 3 },
			radius: 4,
			hits: [],
		}, ctx);
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[1]).toEqual({ x: 2, z: 3 });
		expect(ring[2]).toBe(4);
		expect(ring[3]).toMatchObject({ color: 0x67e8f9, emissive: 0x38bdf8 });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 2, z: 3 });
		expect(burst[2]).toMatchObject({ color: 0x67e8f9 });
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
	});

	it('permafrost_lance uses a narrower telegraph, lance projectile, trail, tip decal, and burst', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'permafrost_lance',
			origin: { x: 0, z: 0 },
			radius: 6,
			direction: { x: 1, z: 0 },
			hits: [],
		}, ctx);
		const attack = ctx._calls.find((c) => c[0] === 'spawnAttackEffect');
		expect(attack).toBeDefined();
		expect(attack[1]).toEqual({ x: 0, z: 0 });
		expect(attack[2]).toEqual({ x: 1, z: 0 });
		expect(attack[3]).toMatchObject({
			effect: 'permafrost_lance',
			range: 6,
			color: 0x67e8f9,
			emissive: 0x38bdf8,
			duration: ATTACK_EFFECT_DURATION,
		});
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[1]).toEqual({ x: 0, z: 0 });
		expect(ring[2]).toBeCloseTo(6 * 0.55, 5);
		expect(ring[3]).toMatchObject({ color: 0x67e8f9, emissive: 0x38bdf8 });
		const trail = ctx._calls.find((c) => c[0] === 'spawnProjectileTrail');
		expect(trail).toBeDefined();
		expect(trail[1]).toEqual({ x: 0, z: 0 });
		expect(trail[2]).toEqual({ x: 1, z: 0 });
		expect(trail[3]).toMatchObject({
			range: 6,
			color: 0x67e8f9,
			emissive: 0x38bdf8,
			travelMs: ATTACK_EFFECT_DURATION,
		});
		expect(trail[3].travelMs).toBe(600);
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		expect(decal).toBeDefined();
		expect(decal[1]).toEqual({ x: 6, z: 0 });
		expect(decal[2]).toMatchObject({ color: 0x67e8f9, emissive: 0x38bdf8 });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 6, z: 0 });
		expect(burst[2]).toMatchObject({ color: 0x67e8f9, emissive: 0x38bdf8 });
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
	});

	it('frost_nova and permafrost_lance resolve to different renderer functions', () => {
		expect(resolveRenderers('frost_nova')[0]).not.toBe(resolveRenderers('permafrost_lance')[0]);
	});

	it('frost_nova and permafrost_lance produce different helper call signatures for equivalent radial payloads', () => {
		const payload = {
			origin: { x: 0, z: 0 },
			radius: 6,
			direction: { x: 1, z: 0 },
			hits: [],
		};
		const novaCtx = makeCtx();
		resolveRenderers('frost_nova')[0]({ ...payload, cardId: 'frost_nova' }, novaCtx);
		const lanceCtx = makeCtx();
		resolveRenderers('permafrost_lance')[0]({ ...payload, cardId: 'permafrost_lance' }, lanceCtx);
		expect(methodsCalled(novaCtx)).not.toEqual(methodsCalled(lanceCtx));
	});

	it('Permafrost Lance has no positive windUpMs (instant cast, distinct from wind-up blades)', () => {
		expect(CARD_DEFS.permafrost_lance).toBeDefined();
		const windUp = CARD_DEFS.permafrost_lance.windUpMs;
		expect(windUp == null || windUp <= 0).toBe(true);
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

	it('glacier_collapse adds a glacier telegraph ring and shatter burst at the rupture point', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'glacier_collapse',
			origin: { x: 1, z: 2 },
			radius: 5,
			hits: [],
		}, ctx);
		const telegraph = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(telegraph).toBeDefined();
		expect(telegraph[1]).toEqual({ x: 1, z: 2 });
		expect(telegraph[2]).toBe(5);
		expect(telegraph[3]).toMatchObject({ color: 0x38bdf8, emissive: 0x0ea5e9 });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 1, z: 2 });
		expect(burst[2]).toMatchObject({ color: 0x38bdf8, emissive: 0x0ea5e9 });
	});

	it('healing_font and divine_grace resolve to different renderer functions', () => {
		expect(resolveRenderers('healing_font')[0]).not.toBe(resolveRenderers('divine_grace')[0]);
	});

	it('healing_font and divine_grace produce different helper call signatures for the same payload', () => {
		const payload = {
			origin: { x: 0, z: 0 },
			radius: 3,
			hpGained: 6,
			playerId: 'me',
			hits: [],
		};
		const fontCtx = makeCtx({ myId: 'me' });
		resolveRenderers('healing_font')[0]({ ...payload, cardId: 'healing_font' }, fontCtx);
		const graceCtx = makeCtx({ myId: 'me' });
		resolveRenderers('divine_grace')[0]({ ...payload, cardId: 'divine_grace' }, graceCtx);
		const fontHelpers = fontCtx._calls.map((c) => c[0]);
		const graceHelpers = graceCtx._calls.map((c) => c[0]);
		expect(fontHelpers).not.toEqual(graceHelpers);
	});

	it('healing_font renders a green telegraph ring and burst without divine grace', () => {
		const ctx = makeCtx({ myId: 'me' });
		renderCardUsed({
			cardId: 'healing_font',
			origin: { x: 0, z: 0 },
			radius: 3,
			hpGained: 6,
			playerId: 'me',
			hits: [],
		}, ctx);
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[1]).toEqual({ x: 0, z: 0 });
		expect(ring[2]).toBe(3);
		expect(ring[3]).toMatchObject({ color: 0x86efac, emissive: 0x4ade80 });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[2]).toMatchObject({ color: 0x86efac, count: 14, spread: 2.0 });
		expect(ctx._calls.some((c) => c[0] === 'spawnDivineGraceEffect')).toBe(false);
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

	it('healing_font skips VFX when radius is absent', () => {
		const ctx = makeCtx({ myId: 'me' });
		renderCardUsed({
			cardId: 'healing_font',
			origin: { x: 0, z: 0 },
			hpGained: 6,
			playerId: 'me',
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnParticleBurst')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'playSound' && c[1] === 'heal')).toBe(false);
	});

	it('divine_grace renders sanctum heal ring, gold burst, and heal sound when hpGained > 0', () => {
		const ctx = makeCtx({ myId: 'me' });
		renderCardUsed({
			cardId: 'divine_grace',
			origin: { x: 0, z: 0 },
			radius: 3,
			hpGained: 10,
			playerId: 'me',
			hits: [],
		}, ctx);
		const grace = ctx._calls.find((c) => c[0] === 'spawnDivineGraceEffect');
		expect(grace).toBeDefined();
		expect(grace[1]).toEqual({ x: 0, z: 0 });
		expect(grace[2]).toBe(3);
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[2]).toMatchObject({ color: 0xfde68a, emissive: 0xfbbf24, count: 12, spread: 2.2 });
		expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(false);
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

	it('divine_grace skips VFX when radius is absent', () => {
		const ctx = makeCtx({ myId: 'me' });
		renderCardUsed({
			cardId: 'divine_grace',
			origin: { x: 0, z: 0 },
			hpGained: 10,
			playerId: 'me',
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnDivineGraceEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnParticleBurst')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'playSound' && c[1] === 'heal')).toBe(false);
	});

	it('divine_grace does not play heal sound for another player even when hpGained > 0', () => {
		const ctx = makeCtx({ myId: 'me' });
		renderCardUsed({
			cardId: 'divine_grace',
			origin: { x: 0, z: 0 },
			radius: 3,
			hpGained: 10,
			playerId: 'someone-else',
			hits: [],
		}, ctx);
		// VFX still play for the spectator, but the heal cue is local-only.
		expect(ctx._calls.some((c) => c[0] === 'spawnDivineGraceEffect')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'playSound' && c[1] === 'heal')).toBe(false);
	});

	it('divine_grace and purifying_pulse produce different helper signatures and palette for the same payload', () => {
		const payload = {
			origin: { x: 0, z: 0 },
			radius: 3,
			hpGained: 8,
			playerId: 'me',
			hits: [],
		};
		const graceCtx = makeCtx({ myId: 'me' });
		resolveRenderers('divine_grace')[0]({ ...payload, cardId: 'divine_grace' }, graceCtx);
		const pulseCtx = makeCtx({ myId: 'me' });
		resolveRenderers('purifying_pulse')[0]({ ...payload, cardId: 'purifying_pulse' }, pulseCtx);
		const graceHelpers = graceCtx._calls.map((c) => c[0]);
		const pulseHelpers = pulseCtx._calls.map((c) => c[0]);
		// Distinct primitive mix: gold sanctum effect vs mint heal ring + cleanse burst.
		expect(graceHelpers).not.toEqual(pulseHelpers);
		expect(graceHelpers).toContain('spawnDivineGraceEffect');
		expect(pulseHelpers).not.toContain('spawnDivineGraceEffect');
		expect(graceHelpers).not.toContain('spawnPurifyingPulseHealRing');
		// Gold particle palette is unique to divine_grace (purifying_pulse never bursts gold).
		const graceBurst = graceCtx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(graceBurst).toBeDefined();
		expect(graceBurst[2]).toMatchObject({ color: 0xfde68a, emissive: 0xfbbf24 });
		expect(pulseCtx._calls.some((c) => c[0] === 'spawnParticleBurst' && c[2]?.color === 0xfde68a)).toBe(false);
	});

	it('divine_grace invokes spawnDivineGraceEffect synchronously with no deferred scheduling', () => {
		// scheduleAfter is rigged to NEVER run its callback, so anything deferred
		// through it would be missing from _calls. setTimeout is spied to prove no
		// timer-based projectile-travel delay is introduced (server resolves instantly).
		const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
		const ctx = makeCtx({
			myId: 'me',
			scheduleAfter: (ms) => { ctx._calls.push(['scheduleAfter', ms]); },
		});
		renderCardUsed({
			cardId: 'divine_grace',
			origin: { x: 0, z: 0 },
			radius: 3,
			hpGained: 10,
			playerId: 'me',
			hits: [],
		}, ctx);
		// The pulse primitive fired during the synchronous render call itself.
		expect(ctx._calls.some((c) => c[0] === 'spawnDivineGraceEffect')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'scheduleAfter')).toBe(false);
		expect(timeoutSpy).not.toHaveBeenCalled();
		timeoutSpy.mockRestore();
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

	it('gravity_well adds a purple pull telegraph, inward burst, and center impact decal', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'gravity_well',
			origin: { x: 1, z: 2 },
			radius: 12,
			pulled: 2,
			hits: [],
		}, ctx);
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[1]).toEqual({ x: 1, z: 2 });
		expect(ring[2]).toBe(12);
		expect(ring[3]).toMatchObject({ color: 0xc084fc, emissive: 0xa855f7 });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 1, z: 2 });
		expect(burst[2]).toMatchObject({ color: 0xc084fc, count: 18, spread: 2.8 });
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		expect(decal).toBeDefined();
		expect(decal[1]).toEqual({ x: 1, z: 2 });
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
	});

	it('gravity_well still renders without throwing when the new ctx primitives are absent', () => {
		const ctx = makeCtx({
			spawnTelegraphRing: undefined,
			spawnParticleBurst: undefined,
			spawnImpactDecal: undefined,
		});
		expect(() => renderCardUsed({
			cardId: 'gravity_well',
			origin: { x: 0, z: 0 },
			radius: 12,
			pulled: 0,
			hits: [],
		}, ctx)).not.toThrow();
	});

	it('event_horizon renders outer pull telegraph/burst and inner crush ring at centerRadius', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'event_horizon',
			origin: { x: 0, z: 0 },
			radius: 12,
			centerRadius: 2.5,
			hits: [],
		}, ctx);
		const telegraph = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(telegraph).toBeDefined();
		expect(telegraph[2]).toBe(12);
		expect(telegraph[3]).toMatchObject({ color: 0x581c87, emissive: 0x7c3aed });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[2]).toMatchObject({ color: 0x581c87, count: 12, spread: 2.4 });
		const crush = ctx._calls.find((c) => c[0] === 'spawnSummonEffect');
		expect(crush).toBeDefined();
		expect(crush[2]).toBe(2.5);
		expect(crush[3]).toMatchObject({ color: 0x581c87, emissive: 0x7c3aed });
		const outerSummon = ctx._calls.filter(
			(c) => c[0] === 'spawnSummonEffect' && c[2] === 12,
		);
		expect(outerSummon).toHaveLength(0);
	});

	it('event_horizon still renders without throwing when the new ctx primitives are absent', () => {
		const ctx = makeCtx({
			spawnTelegraphRing: undefined,
			spawnParticleBurst: undefined,
		});
		expect(() => renderCardUsed({
			cardId: 'event_horizon',
			origin: { x: 0, z: 0 },
			radius: 12,
			centerRadius: 2.5,
			hits: [],
		}, ctx)).not.toThrow();
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(true);
	});

	it('inferno_pillar renders the pillar without the generic accent summon ring', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'inferno_pillar',
			origin: { x: 0, z: 0 },
			radius: 7,
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnInfernoPillarEffect')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
	});

	it('inferno_pillar dispatches spawnInfernoPillarEffect with server-synced timing style', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'inferno_pillar',
			origin: { x: 4, z: 5 },
			radius: 7,
			hits: [],
		}, ctx);
		const pillar = ctx._calls.find((c) => c[0] === 'spawnInfernoPillarEffect');
		expect(pillar).toBeDefined();
		expect(pillar[1]).toEqual({ x: 4, z: 5 });
		expect(pillar[2]).toBe(7);
		expect(pillar[3]).toMatchObject({
			color: 0xef4444,
			emissive: 0xff3b00,
			dotTicks: 4,
			dotIntervalMs: 500,
			duration: 2250,
		});
	});

	it('inferno_pillar fires eruption telegraph, burst, and decal synchronously at cast', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'inferno_pillar',
			origin: { x: 4, z: 5 },
			radius: 7,
			hits: [],
		}, ctx);
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[1]).toEqual({ x: 4, z: 5 });
		expect(ring[2]).toBe(7);
		expect(ring[3]).toMatchObject({ color: 0xef4444, emissive: 0xff3b00 });
		const castBurst = ctx._calls.find(
			(c) => c[0] === 'spawnParticleBurst' && c[2].count === 14,
		);
		expect(castBurst).toBeDefined();
		expect(castBurst[1]).toEqual({ x: 4, z: 5 });
		expect(castBurst[2]).toMatchObject({ color: 0xef4444, emissive: 0xff3b00, spread: 2.2 });
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		expect(decal).toBeDefined();
		expect(decal[1]).toEqual({ x: 4, z: 5 });
		expect(decal[2]).toMatchObject({ color: 0xef4444, emissive: 0xff3b00 });
		// DoT tick pulses are deferred — only the cast ring exists before scheduling runs.
		expect(ctx._calls.filter((c) => c[0] === 'spawnTelegraphRing' && c[2] === 7 * 0.65)).toHaveLength(0);
		expect(ctx._calls.filter((c) => c[0] === 'spawnParticleBurst' && c[2].count === 8)).toHaveLength(0);
	});

	it('inferno_pillar schedules four DoT tick pulses at 500ms intervals', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'inferno_pillar',
			origin: { x: 0, z: 0 },
			radius: 7,
			hits: [],
		}, ctx);
		const schedules = ctx._calls.filter((c) => c[0] === 'scheduleAfter');
		expect(schedules.map((c) => c[1])).toEqual([500, 1000, 1500, 2000]);
		expect(ctx._scheduled).toHaveLength(4);
		for (const entry of ctx._scheduled) expect(entry.invoked).toBe(false);
		ctx.runScheduled();
		const tickRings = ctx._calls.filter(
			(c) => c[0] === 'spawnTelegraphRing' && c[2] === 7 * 0.65,
		);
		expect(tickRings).toHaveLength(4);
		for (const r of tickRings) {
			expect(r[3]).toMatchObject({ color: 0xef4444, emissive: 0xff3b00 });
		}
		const tickBursts = ctx._calls.filter(
			(c) => c[0] === 'spawnParticleBurst' && c[2].count === 8,
		);
		expect(tickBursts).toHaveLength(4);
	});

	it('inferno_pillar spawns immediate per-hit ignite bursts at enemy mesh positions', () => {
		const ctx = makeCtx({
			enemyMeshes: () => ({
				e1: { position: { x: 4, y: 0, z: 2 } },
				e2: { position: { x: 7, y: 0, z: 2 } },
			}),
		});
		renderCardUsed({
			cardId: 'inferno_pillar',
			origin: { x: 1, z: 2 },
			radius: 7,
			hits: [{ enemyId: 'e1' }, { enemyId: 'e2' }, { enemyId: 'missing' }],
		}, ctx);
		const hitSparks = ctx._calls.filter((c) => c[0] === 'spawnHitSpark');
		expect(hitSparks).toHaveLength(2);
		expect(hitSparks[0][1]).toEqual({ x: 4, y: 0.6, z: 2 });
		expect(hitSparks[1][1]).toEqual({ x: 7, y: 0.6, z: 2 });
		expect(hitSparks[0][2]).toMatchObject({ color: 0xef4444, emissive: 0xff3b00, count: 5 });
		const igniteBursts = ctx._calls.filter(
			(c) => c[0] === 'spawnParticleBurst' && c[2].count === 6,
		);
		expect(igniteBursts).toHaveLength(2);
		expect(igniteBursts[0][1]).toEqual({ x: 4, y: 0.6, z: 2 });
		expect(igniteBursts[1][1]).toEqual({ x: 7, y: 0.6, z: 2 });
	});

	it('inferno_pillar has no positive windUpMs (instant cast; 315 charge telegraph absent)', () => {
		expect(CARD_DEFS.inferno_pillar).toBeDefined();
		expect(CARD_DEFS.inferno_pillar.windUpMs ?? 0).toBeLessThanOrEqual(0);
	});

	it('inferno_pillar still renders without throwing when the new ctx primitives are absent', () => {
		const ctx = makeCtx({
			spawnTelegraphRing: undefined,
			spawnParticleBurst: undefined,
			spawnImpactDecal: undefined,
			spawnHitSpark: undefined,
		});
		expect(() => renderCardUsed({
			cardId: 'inferno_pillar',
			origin: { x: 0, z: 0 },
			radius: 7,
			hits: [{ enemyId: 'e1' }],
		}, ctx)).not.toThrow();
		expect(ctx._calls.some((c) => c[0] === 'spawnInfernoPillarEffect')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
		expect(ctx._calls.filter((c) => c[0] === 'scheduleAfter').map((c) => c[1])).toEqual([
			500, 1000, 1500, 2000,
		]);
	});

	it('dragons_breath dispatches spawnDragonsBreathEffect with server-synced timing style', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'dragons_breath',
			origin: { x: 1, z: 2 },
			direction: { x: 1, z: 0 },
			radius: 7,
			dotTicks: 4,
			specialEffect: 'fire_dot',
			hits: [],
		}, ctx);
		const breath = ctx._calls.find((c) => c[0] === 'spawnDragonsBreathEffect');
		expect(breath).toBeDefined();
		expect(breath[1]).toEqual({ x: 1, z: 2 });
		expect(breath[2]).toEqual({ x: 1, z: 0 });
		expect(breath[3]).toMatchObject({
			color: 0xfb923c,
			emissive: 0xff3b00,
			range: 7,
			coneAngle: Math.PI / 3,
			dotTicks: 4,
			dotIntervalMs: 500,
			duration: 2250,
		});
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
	});

	it('dragons_breath fires cone burst primitives synchronously at cast', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'dragons_breath',
			origin: { x: 1, z: 2 },
			direction: { x: 1, z: 0 },
			radius: 7,
			hits: [],
		}, ctx);
		const attacks = ctx._calls.filter((c) => c[0] === 'spawnAttackEffect');
		expect(attacks).toHaveLength(1);
		expect(attacks[0][1]).toEqual({ x: 1, z: 2 });
		expect(attacks[0][2]).toEqual({ x: 1, z: 0 });
		expect(attacks[0][3]).toMatchObject({
			range: 7,
			coneAngle: Math.PI / 3,
			color: 0xfb923c,
			emissive: 0xff3b00,
		});
		const castBurstOrigin = ctx._calls.find(
			(c) => c[0] === 'spawnParticleBurst' && c[1].x === 1 && c[1].z === 2,
		);
		expect(castBurstOrigin).toBeDefined();
		expect(castBurstOrigin[2]).toMatchObject({ color: 0xfb923c, emissive: 0xff3b00 });
		const castBurstTip = ctx._calls.find(
			(c) => c[0] === 'spawnParticleBurst' && c[1].x === 8 && c[1].z === 2,
		);
		expect(castBurstTip).toBeDefined();
		expect(castBurstTip[2]).toMatchObject({ color: 0xfb923c, emissive: 0xff3b00 });
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		expect(decal).toBeDefined();
		expect(decal[1]).toEqual({ x: 8, z: 2 });
		expect(decal[2]).toMatchObject({ color: 0xfb923c, emissive: 0xff3b00 });
		expect(ctx._calls.some((c) => c[0] === 'spawnProjectileTrail')).toBe(false);
		// DoT tick pulses are deferred — only cast primitives exist before scheduling runs.
		const scheduleIdx = ctx._calls.findIndex((c) => c[0] === 'scheduleAfter');
		const preSchedule = ctx._calls.slice(0, scheduleIdx);
		expect(preSchedule.some((c) => c[0] === 'spawnAttackEffect')).toBe(true);
		expect(preSchedule.filter((c) => c[0] === 'spawnParticleBurst')).toHaveLength(2);
		expect(preSchedule.some((c) => c[0] === 'spawnImpactDecal')).toBe(true);
		expect(ctx._calls.filter((c) => c[0] === 'spawnParticleBurst' && c[2].count === 8)).toHaveLength(0);
	});

	it('dragons_breath spawns immediate per-hit ignite bursts at enemy mesh positions', () => {
		const ctx = makeCtx({
			enemyMeshes: () => ({
				e1: { position: { x: 4, y: 0, z: 2 } },
				e2: { position: { x: 7, y: 0, z: 2 } },
			}),
		});
		renderCardUsed({
			cardId: 'dragons_breath',
			origin: { x: 1, z: 2 },
			direction: { x: 1, z: 0 },
			radius: 7,
			hits: [{ enemyId: 'e1' }, { enemyId: 'e2' }, { enemyId: 'missing' }],
		}, ctx);
		const hitSparks = ctx._calls.filter((c) => c[0] === 'spawnHitSpark');
		expect(hitSparks).toHaveLength(2);
		expect(hitSparks[0][1]).toEqual({ x: 4, y: 0.6, z: 2 });
		expect(hitSparks[1][1]).toEqual({ x: 7, y: 0.6, z: 2 });
		expect(hitSparks[0][2]).toMatchObject({ color: 0xfb923c, emissive: 0xff3b00, count: 5 });
		const igniteBursts = ctx._calls.filter(
			(c) => c[0] === 'spawnParticleBurst' && c[2].count === 6,
		);
		expect(igniteBursts).toHaveLength(2);
		expect(igniteBursts[0][1]).toEqual({ x: 4, y: 0.6, z: 2 });
		expect(igniteBursts[1][1]).toEqual({ x: 7, y: 0.6, z: 2 });
	});

	it('dragons_breath schedules four DoT tick pulses at 500ms intervals', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'dragons_breath',
			origin: { x: 1, z: 2 },
			direction: { x: 1, z: 0 },
			radius: 7,
			hits: [],
		}, ctx);
		const schedules = ctx._calls.filter((c) => c[0] === 'scheduleAfter');
		expect(schedules.map((c) => c[1])).toEqual([500, 1000, 1500, 2000]);
		expect(ctx._scheduled).toHaveLength(4);
		for (const entry of ctx._scheduled) expect(entry.invoked).toBe(false);
		ctx.runScheduled();
		const tickBursts = ctx._calls.filter(
			(c) => c[0] === 'spawnParticleBurst' && c[2].count === 8,
		);
		expect(tickBursts).toHaveLength(4);
		for (const burst of tickBursts) {
			expect(burst[1]).toEqual({ x: 5.55, z: 2 });
			expect(burst[2]).toMatchObject({ color: 0xfb923c, emissive: 0xff3b00 });
		}
	});

	it('dragons_breath has no positive windUpMs (instant cast; 315 charge telegraph absent)', () => {
		expect(CARD_DEFS.dragons_breath).toBeDefined();
		expect(CARD_DEFS.dragons_breath.windUpMs ?? 0).toBeLessThanOrEqual(0);
	});

	it('dragons_breath still renders without throwing when the new ctx primitives are absent', () => {
		const ctx = makeCtx({
			spawnTelegraphRing: undefined,
			spawnParticleBurst: undefined,
			spawnImpactDecal: undefined,
			spawnHitSpark: undefined,
		});
		expect(() => renderCardUsed({
			cardId: 'dragons_breath',
			origin: { x: 1, z: 2 },
			direction: { x: 1, z: 0 },
			radius: 7,
			hits: [{ enemyId: 'e1' }],
		}, ctx)).not.toThrow();
		expect(ctx._calls.some((c) => c[0] === 'spawnDragonsBreathEffect')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnProjectileTrail')).toBe(false);
		expect(ctx._calls.filter((c) => c[0] === 'scheduleAfter').map((c) => c[1])).toEqual([
			500, 1000, 1500, 2000,
		]);
	});

	it('astral_guardian adds indigo shield telegraph, burst, and minion spawn ring', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'astral_guardian',
			origin: { x: 2, z: 3 },
			radius: 4,
			shieldGranted: 14,
			minionId: 'minion-1',
			hits: [],
		}, ctx);
		const telegraph = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(telegraph).toBeDefined();
		expect(telegraph[1]).toEqual({ x: 2, z: 3 });
		expect(telegraph[2]).toBe(4);
		expect(telegraph[3]).toMatchObject({ color: 0x818cf8, emissive: 0x6366f1 });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 2, z: 3 });
		const summon = ctx._calls.find(
			(c) => c[0] === 'spawnSummonEffect' && c[2] === 1.2,
		);
		expect(summon).toBeDefined();
		expect(summon[3]).toMatchObject({ color: 0x818cf8, emissive: 0x6366f1 });
	});

	it('mana_prism adds a violet/cyan prism telegraph and arcane burst at radius 1', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'mana_prism',
			origin: { x: 1, z: 2 },
			radius: 1,
			hits: [],
		}, ctx);
		const telegraph = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(telegraph).toBeDefined();
		expect(telegraph[1]).toEqual({ x: 1, z: 2 });
		expect(telegraph[2]).toBe(1);
		expect(telegraph[3]).toMatchObject({ color: 0xa855f7, emissive: 0x22d3ee });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[2]).toMatchObject({ color: 0xa855f7, count: 12, spread: 1.6 });
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
	});

	it('sacrificial_altar adds a gold/red ritual telegraph and burst at sacrifice radius', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'sacrificial_altar',
			origin: { x: 0, z: 0 },
			radius: 10,
			sacrificedMinionId: 'minion-2',
			hits: [],
		}, ctx);
		const telegraph = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(telegraph).toBeDefined();
		expect(telegraph[2]).toBe(10);
		expect(telegraph[3]).toMatchObject({ color: 0xfbbf24, emissive: 0xef4444 });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[2]).toMatchObject({ color: 0xfbbf24, count: 16, spread: 2.4 });
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
	});

	it('chrono_trigger adds a time-ripple telegraph and burst using a default radius', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'chrono_trigger',
			origin: { x: 3, z: 4 },
			restoredCharges: 2,
			hits: [],
		}, ctx);
		const telegraph = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(telegraph).toBeDefined();
		expect(telegraph[1]).toEqual({ x: 3, z: 4 });
		expect(telegraph[2]).toBe(2);
		expect(telegraph[3]).toMatchObject({ color: 0x67e8f9, emissive: 0xfbbf24 });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 3, z: 4 });
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
	});

	it('chrono_trigger no-ops when origin is absent', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'chrono_trigger',
			restoredCharges: 2,
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnParticleBurst')).toBe(false);
	});

	it('utility spells still render without throwing when new ctx primitives are absent', () => {
		const minimalCtx = makeCtx({
			spawnTelegraphRing: undefined,
			spawnParticleBurst: undefined,
		});
		for (const payload of [
			{ cardId: 'astral_guardian', origin: { x: 0, z: 0 }, radius: 4, hits: [] },
			{ cardId: 'mana_prism', origin: { x: 0, z: 0 }, radius: 1, hits: [] },
			{ cardId: 'sacrificial_altar', origin: { x: 0, z: 0 }, radius: 10, hits: [] },
			{ cardId: 'chrono_trigger', origin: { x: 0, z: 0 }, hits: [] },
		]) {
			const ctx = { ...minimalCtx, _calls: [] };
			expect(() => renderCardUsed(payload, ctx)).not.toThrow();
		}
	});
});

describe('renderCardUsed() — creature dispatch', () => {
	it('vanilla creature spawn with minionId triggers the summon-in flourish', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'battery_automaton',
			origin: { x: 2, z: 3 },
			minionId: 'minion-1',
			hits: [],
		}, ctx);
		const summon = ctx._calls.find((c) => c[0] === 'spawnMinionSummonInEffect');
		expect(summon).toBeDefined();
		expect(summon[1]).toEqual({ x: 2, z: 3 });
		expect(methodsCalled(ctx)).toContain('playSound');
	});

	it('vanilla creature spawn without minionId stays sound-only', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'battery_automaton',
			origin: { x: 0, z: 0 },
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnMinionSummonInEffect')).toBe(false);
		expect(methodsCalled(ctx)).toEqual(['playSound']);
	});

	it('Vault Wyrm minion breath renders a forward cone hitbox on breath start', () => {
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
			breathPhase: 'start',
			breathDurationMs: 2000,
			hits: [{ enemyId: 'e1', hp: 47 }],
		}, ctx);
		const attacks = ctx._calls.filter((c) => c[0] === 'spawnAttackEffect');
		expect(attacks).toHaveLength(1);
		expect(attacks[0][1]).toEqual({ x: 1, z: 2 });
		expect(attacks[0][2]).toEqual({ x: 0, z: 1 });
		expect(attacks[0][3]).toMatchObject({
			range: 4,
			coneAngle: Math.PI / 4,
			duration: 2000,
			color: 0x22c55e,
			emissive: 0x16a34a,
		});
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[1]).toEqual({ x: 1, z: 2 });
		expect(ring[2]).toBeCloseTo(4 * 0.55);
		expect(ring[3]).toMatchObject({ color: 0x22c55e, emissive: 0x16a34a });
		const alongBurst = ctx._calls.find(
			(c) => c[0] === 'spawnParticleBurst' && c[1].x === 1 && c[1].z === 2 + 4 * 0.45,
		);
		expect(alongBurst).toBeDefined();
		expect(alongBurst[2]).toMatchObject({ color: 0x22c55e, emissive: 0x16a34a, count: 10 });
		expect(ctx._calls.filter((c) => c[0] === 'spawnHitSpark')).toHaveLength(1);
		expect(ctx._calls.filter((c) => c[0] === 'spawnParticleBurst')).toHaveLength(2);
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
		const ctx = makeCtx({
			enemyMeshes: () => ({
				e1: { position: { x: 5, y: 0.5, z: 0 } },
			}),
		});
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
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[3]).toMatchObject({ color: 0xef4444, emissive: 0x9333ea });
		const alongBurst = ctx._calls.find(
			(c) => c[0] === 'spawnParticleBurst' && c[1].x === 8 * 0.45,
		);
		expect(alongBurst).toBeDefined();
		expect(alongBurst[2]).toMatchObject({ color: 0xef4444, emissive: 0x9333ea, count: 14 });
		expect(ctx._calls.filter((c) => c[0] === 'spawnHitSpark')).toHaveLength(1);
	});

	it('Archive Wyrm airborne fire breath uses origin.y for cone, ring, and burst', () => {
		const ctx = makeCtx({
			enemyMeshes: () => ({
				e1: { position: { x: 5, y: 0.5, z: 0 } },
			}),
		});
		const airborneY = 4;
		const dirY = 0.3;
		const range = 8;
		renderCardUsed({
			cardId: 'ancient_wyrm',
			specialEffect: 'fire_breath',
			origin: { x: 0, z: 0, y: airborneY },
			direction: { x: 1, z: 0, y: dirY },
			attackRange: range,
			attackConeAngle: Math.PI / 3,
			breathPhase: 'start',
			breathDurationMs: 2500,
			hits: [{ enemyId: 'e1', hp: 46 }],
		}, ctx);
		const attacks = ctx._calls.filter((c) => c[0] === 'spawnAttackEffect');
		expect(attacks).toHaveLength(1);
		expect(attacks[0][1]).toEqual({ x: 0, z: 0, y: airborneY });
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[1]).toEqual({ x: 0, z: 0, y: airborneY });
		const alongDist = range * 0.45;
		const len = Math.hypot(1, 0, dirY);
		const expectedBurstY = airborneY + (dirY / len) * alongDist;
		const alongBurst = ctx._calls.find(
			(c) => c[0] === 'spawnParticleBurst' && c[1].x === alongDist,
		);
		expect(alongBurst).toBeDefined();
		expect(alongBurst[1].y).toBeCloseTo(expectedBurstY, 5);
		expect(alongBurst[2]).toMatchObject({ color: 0xef4444, emissive: 0x9333ea, count: 14 });
	});

	it('Vault Wyrm and Archive Wyrm summons use distinct flourish radii', () => {
		const vaultCtx = makeCtx();
		renderCardUsed({
			cardId: 'dungeon_drake',
			origin: { x: 0, z: 0 },
			minionId: 'wyrm-vault',
			hits: [],
		}, vaultCtx);
		const vaultSummon = vaultCtx._calls.find((c) => c[0] === 'spawnMinionSummonInEffect');
		expect(vaultSummon).toBeDefined();
		expect(vaultSummon[2]).toMatchObject({ radius: 1.0, burstCount: 8, burstSpread: 1.2 });

		const archiveCtx = makeCtx();
		renderCardUsed({
			cardId: 'ancient_wyrm',
			origin: { x: 3, z: 4 },
			minionId: 'wyrm-archive',
			hits: [],
		}, archiveCtx);
		const archiveSummon = archiveCtx._calls.find((c) => c[0] === 'spawnMinionSummonInEffect');
		expect(archiveSummon).toBeDefined();
		expect(archiveSummon[2]).toMatchObject({
			radius: 1.85,
			burstCount: 18,
			burstSpread: 2.5,
			color: 0x9333ea,
			emissive: 0x9333ea,
		});
		expect(archiveSummon[2].radius).toBeGreaterThan(vaultSummon[2].radius);
	});

	it('wyrm summon renderers skip breath payloads and attack renderers skip deploy payloads', () => {
		const summonCtx = makeCtx();
		renderCardUsed({
			cardId: 'dungeon_drake',
			origin: { x: 0, z: 0 },
			minionId: 'wyrm-1',
			breathPhase: 'start',
			direction: { x: 1, z: 0 },
			attackRange: 6,
			hits: [],
		}, summonCtx);
		expect(summonCtx._calls.some((c) => c[0] === 'spawnMinionSummonInEffect')).toBe(false);
		expect(summonCtx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(true);

		const deployCtx = makeCtx();
		renderCardUsed({
			cardId: 'ancient_wyrm',
			origin: { x: 0, z: 0 },
			minionId: 'wyrm-2',
			hits: [],
		}, deployCtx);
		expect(deployCtx._calls.some((c) => c[0] === 'spawnMinionSummonInEffect')).toBe(true);
		expect(deployCtx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(false);
	});

	it('Phase Stalker deploy uses a tight cyan telegraph ring and ground swirl', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'null_crawler',
			origin: { x: 2, z: 3 },
			minionId: 'stalker-1',
			hits: [],
		}, ctx);
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[1]).toEqual({ x: 2, z: 3 });
		expect(ring[2]).toBe(0.72);
		expect(ring[3]).toMatchObject({ color: 0x67e8f9, emissive: 0xa5f3fc });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 2, y: 0.4, z: 3 });
		expect(burst[2]).toMatchObject({ color: 0x22d3ee, emissive: 0x67e8f9 });
		expect(ctx._calls.some((c) => c[0] === 'spawnMinionSummonInEffect')).toBe(false);
	});

	it('Phase Stalker beam renders a narrow projectile corridor with trail, terminus burst, and hit sparks', () => {
		const ctx = makeCtx({
			enemyMeshes: () => ({
				e1: { position: { x: 8, y: 0.5, z: 0 } },
			}),
		});
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
		const trail = ctx._calls.find((c) => c[0] === 'spawnProjectileTrail');
		expect(trail).toBeDefined();
		expect(trail[1]).toEqual({ x: 0, z: 0 });
		expect(trail[2]).toEqual({ x: 1, z: 0 });
		expect(trail[3]).toMatchObject({ range: 14, color: 0x22d3ee });
		const terminusBurst = ctx._calls.find(
			(c) => c[0] === 'spawnParticleBurst' && c[1].x === 14 && c[1].z === 0,
		);
		expect(terminusBurst).toBeDefined();
		expect(terminusBurst[2]).toMatchObject({ color: 0x22d3ee, emissive: 0x06b6d4 });
		expect(ctx._calls.filter((c) => c[0] === 'spawnHitSpark')).toHaveLength(1);
	});

	it('Phase Stalker beam still renders without throwing when primitive helpers are absent', () => {
		const ctx = makeCtx({
			spawnProjectileTrail: undefined,
			spawnParticleBurst: undefined,
			spawnHitSpark: undefined,
		});
		expect(() => renderCardUsed({
			cardId: 'null_crawler',
			specialEffect: 'phase_beam',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			attackRange: 14,
			hitWidth: 0.8,
			hits: [{ enemyId: 'e1', hp: 34 }],
		}, ctx)).not.toThrow();
		expect(ctx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(true);
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

	it('undead_commander renders bone-white/purple caster ring and per-skeleton summon flourishes', () => {
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
		const casterRing = ctx._calls.filter((c) => c[0] === 'spawnSummonEffect');
		expect(casterRing).toHaveLength(1);
		expect(casterRing[0][2]).toBe(2);
		expect(casterRing[0][3]).toMatchObject({ color: 0xe4e4e7, emissive: 0xa855f7 });
		const skeletonFlourishes = ctx._calls.filter((c) => c[0] === 'spawnMinionSummonInEffect');
		expect(skeletonFlourishes).toHaveLength(2);
		expect(skeletonFlourishes[0][1]).toEqual({ x: 1, z: 0 });
		expect(skeletonFlourishes[1][1]).toEqual({ x: 0, z: 1 });
		expect(skeletonFlourishes[0][2]).toMatchObject({
			color: 0xe4e4e7,
			emissive: 0xa855f7,
			radius: 0.85,
		});
		const groundBursts = ctx._calls.filter(
			(c) => c[0] === 'spawnParticleBurst' && c[1].y === 0.35,
		);
		expect(groundBursts).toHaveLength(2);
		expect(groundBursts[0][2]).toMatchObject({ color: 0xe4e4e7, emissive: 0xa855f7 });
	});

	it('storm_eagle summon renders a soft cyan minion flourish', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'storm_eagle',
			minionId: 'eagle-1',
			origin: { x: 2, z: 3 },
			hits: [],
		}, ctx);
		const flourishes = ctx._calls.filter((c) => c[0] === 'spawnMinionSummonInEffect');
		expect(flourishes).toHaveLength(1);
		expect(flourishes[0][1]).toEqual({ x: 2, z: 3 });
		expect(flourishes[0][2]).toMatchObject({ color: 0x93c5fd, emissive: 0x7dd3fc });
		expect(ctx._calls.some((c) => c[0] === 'spawnLightningArc')).toBe(false);
	});

	it('storm_eagle attack renders a cyan arc and impact burst', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'storm_eagle',
			minionId: 'eagle-1',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			strikeTarget: { x: 6, z: 0 },
			hits: [{ enemyId: 'e1', hp: 27 }],
		}, ctx);
		const arcs = ctx._calls.filter((c) => c[0] === 'spawnLightningArc');
		expect(arcs).toHaveLength(1);
		expect(arcs[0][1]).toEqual({ x: 0, z: 0 });
		expect(arcs[0][2]).toEqual({ x: 6, z: 0 });
		expect(ctx._calls.some((c) => c[0] === 'spawnParticleBurst')).toBe(true);
	});

	it('thunderbird summon renders a sky-blue flourish distinct from storm_eagle', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'thunderbird',
			minionId: 'bird-1',
			origin: { x: 1, z: 2 },
			hits: [],
		}, ctx);
		const flourishes = ctx._calls.filter((c) => c[0] === 'spawnMinionSummonInEffect');
		expect(flourishes).toHaveLength(1);
		expect(flourishes[0][2]).toMatchObject({ color: 0x38bdf8, emissive: 0x0ea5e9, radius: 1.2 });
	});

	it('thunderbird (chain_lightning) renders zap + enemy-hit cue + follow-up attack', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'thunderbird',
			origin: { x: 3, z: 4 },
			direction: { x: 1, z: 0 },
			specialEffect: 'chain_lightning',
			hits: [{ enemyId: 'e1', hp: 30 }],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnChainLightningEffect')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(true);
		const hitSounds = ctx._calls.filter((c) => c[0] === 'playSound' && c[1] === 'enemyHit');
		expect(hitSounds).toHaveLength(2);
	});

	it('thunderbird chain_lightning with chainSegments invokes spawnLightningArc per hop', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'thunderbird',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			specialEffect: 'chain_lightning',
			chainSegments: [
				{ from: { x: 0, z: 0 }, to: { x: 6, z: 0 } },
				{ from: { x: 6, z: 0 }, to: { x: 8, z: 0 } },
			],
			hits: [
				{ enemyId: 'e1', hp: 30 },
				{ enemyId: 'e2', hp: 10 },
			],
		}, ctx);
		const arcs = ctx._calls.filter((c) => c[0] === 'spawnLightningArc');
		expect(arcs).toHaveLength(2);
		expect(ctx._calls.some((c) => c[0] === 'spawnChainLightningEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(true);
	});

	it('chain_lightning with two chainSegments invokes spawnLightningArc twice', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'chain_lightning',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			chainRadius: 5,
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
		const telegraph = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(telegraph).toBeDefined();
		expect(telegraph[1]).toEqual({ x: 0, z: 0 });
		expect(telegraph[2]).toBe(5);
		expect(telegraph[3]).toMatchObject({ color: 0x38bdf8, emissive: 0x0ea5e9 });
		const endpointBursts = ctx._calls.filter(
			(c) => c[0] === 'spawnParticleBurst' && (c[1].x === 5 || c[1].x === 8),
		);
		expect(endpointBursts).toHaveLength(2);
		expect(endpointBursts[0][1]).toEqual({ x: 5, z: 0 });
		expect(endpointBursts[1][1]).toEqual({ x: 8, z: 0 });
		expect(ctx._calls.some((c) => c[0] === 'spawnChainLightningEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'playSound' && c[1] === 'enemyHit')).toBe(true);
	});

	it('chain_lightning without chainSegments still uses legacy spawnChainLightningEffect', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'chain_lightning',
			origin: { x: 1, z: 2 },
			direction: { x: 0, z: 1 },
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnChainLightningEffect')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'spawnLightningArc')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(false);
	});

	it('chain_lightning segment path still renders without throwing when new ctx primitives are absent', () => {
		const ctx = makeCtx({
			spawnTelegraphRing: undefined,
			spawnParticleBurst: undefined,
			spawnImpactDecal: undefined,
		});
		expect(() => renderCardUsed({
			cardId: 'chain_lightning',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			chainSegments: [
				{ from: { x: 0, z: 0 }, to: { x: 5, z: 0 } },
			],
			hits: [{ enemyId: 'e1', hp: 50 }],
		}, ctx)).not.toThrow();
		expect(ctx._calls.some((c) => c[0] === 'spawnLightningArc')).toBe(true);
	});
});

describe('renderCardUsed() — enchantment dispatch', () => {
	it('spike_trap resolves to a different renderer fn than cinder_snare', () => {
		const spikeFn = resolveRenderers('spike_trap');
		const snareFn = resolveRenderers('cinder_snare');
		expect(spikeFn).toHaveLength(1);
		expect(snareFn).toHaveLength(1);
		expect(spikeFn[0]).not.toBe(snareFn[0]);
	});

	it('spike_trap erupts steel/red spikes + telegraph ring at the placement origin/radius', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'spike_trap',
			origin: { x: 2, z: 3 },
			radius: 2.5,
			hits: [],
		}, ctx);

		// Erupting-spikes primitive fires at the placement origin with the radius.
		const spikes = ctx._calls.filter((c) => c[0] === 'spawnSpikeTrapEffect');
		expect(spikes).toHaveLength(1);
		expect(spikes[0][1]).toEqual({ x: 2, z: 3 });
		expect(spikes[0][2]).toBe(2.5);

		// Hostile-red telegraph ring at the armed proximity radius, steel/red palette.
		const rings = ctx._calls.filter((c) => c[0] === 'spawnTelegraphRing');
		expect(rings).toHaveLength(1);
		expect(rings[0][1]).toEqual({ x: 2, z: 3 });
		expect(rings[0][2]).toBe(2.5);
		expect(rings[0][3].color).toBe(0xf87171); // steel/blood-red accent, NOT orange fire
		expect(rings[0][3].emissive).toBe(0xdc2626);

		// Placement-only: it must NOT use the generic orange ground-enchantment preview.
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
	});

	it('spike_trap skips all VFX when data.radius is undefined', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'spike_trap',
			origin: { x: 2, z: 3 },
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnSpikeTrapEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(false);
	});

	it('spike_trap gracefully no-ops the spikes when the primitive is absent', () => {
		const ctx = makeCtx({ spawnSpikeTrapEffect: undefined });
		expect(() => renderCardUsed({
			cardId: 'spike_trap',
			origin: { x: 2, z: 3 },
			radius: 2.5,
			hits: [],
		}, ctx)).not.toThrow();
		// Telegraph ring still plays even without the spike primitive.
		expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(true);
	});

	it('spike_trap invokes the spike primitive synchronously within renderCardUsed (no deferred scheduling)', () => {
		const ctx = makeCtx();
		// scheduleAfter would record a ['scheduleAfter', ms] tuple if any work were deferred.
		renderCardUsed({
			cardId: 'spike_trap',
			origin: { x: 2, z: 3 },
			radius: 2.5,
			hits: [],
		}, ctx);
		// By the time renderCardUsed returns the spikes have already fired — synchronously.
		expect(ctx._calls.some((c) => c[0] === 'spawnSpikeTrapEffect')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'scheduleAfter')).toBe(false);
	});

	it('mirror_ward spawns shell, telegraph ring, and burst when target=self', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'mirror_ward',
			playerId: 'p1',
			origin: { x: 0, z: 0 },
			target: 'self',
			hits: [],
		}, ctx);
		const def = CARD_DEFS.mirror_ward;
		const shells = ctx._calls.filter((c) => c[0] === 'spawnMirrorWardShellEffect');
		expect(shells).toHaveLength(1);
		expect(shells[0][1]).toEqual({ x: 0, z: 0 });
		expect(shells[0][2]).toBe(def.reflectRange);
		expect(shells[0][3]).toMatchObject({
			duration: def.ttlMs,
			color: 0x5eead4,
			emissive: 0x2dd4bf,
			playerId: 'p1',
		});

		const rings = ctx._calls.filter((c) => c[0] === 'spawnTelegraphRing');
		expect(rings).toHaveLength(1);
		expect(rings[0][2]).toBe(def.reflectRange);
		expect(rings[0][3]).toMatchObject({
			duration: SUMMON_EFFECT_DURATION,
			color: 0x5eead4,
			emissive: 0x2dd4bf,
		});

		const bursts = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst');
		expect(bursts).toHaveLength(1);
		expect(bursts[0][1]).toEqual({ x: 0, y: 1.0, z: 0 });
		expect(bursts[0][2]).toMatchObject({
			color: 0x5eead4,
			emissive: 0x2dd4bf,
			count: 12,
			spread: 1.6,
		});
		expect(ctx._calls.some((c) => c[0] === 'scheduleAfter')).toBe(false);
	});

	it('mirror_ward does nothing when target is not self', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'mirror_ward',
			origin: { x: 0, z: 0 },
			target: 'ground',
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnMirrorWardShellEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnParticleBurst')).toBe(false);
	});

	it('mirror_ward reflect path spawns reflect burst once without a new shell', () => {
		const ctx = makeCtx();
		const def = CARD_DEFS.mirror_ward;
		renderCardUsed({
			cardId: 'mirror_ward',
			playerId: 'p1',
			origin: { x: 1, z: 2 },
			reflectTriggered: true,
			direction: { x: 0, z: 1 },
			hits: [{ enemyId: 'e1', damage: 17 }],
			reflectDamage: 17,
		}, ctx);

		const bursts = ctx._calls.filter((c) => c[0] === 'spawnMirrorWardReflectBurst');
		expect(bursts).toHaveLength(1);
		expect(bursts[0][1]).toEqual({ x: 1, z: 2 });
		expect(bursts[0][2]).toEqual({ x: 0, z: 1 });
		expect(bursts[0][3]).toMatchObject({
			range: def.reflectRange,
			color: 0x5eead4,
			emissive: 0x2dd4bf,
		});

		const dismissCalls = ctx._calls.filter((c) => c[0] === 'dismissMirrorWardShellEffect');
		expect(dismissCalls).toHaveLength(1);
		expect(dismissCalls[0][1]).toBe('p1');
		const dismissIdx = ctx._calls.findIndex((c) => c[0] === 'dismissMirrorWardShellEffect');
		const burstIdx = ctx._calls.findIndex((c) => c[0] === 'spawnMirrorWardReflectBurst');
		expect(dismissIdx).toBeLessThan(burstIdx);

		expect(ctx._calls.some((c) => c[0] === 'spawnMirrorWardShellEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(false);
	});

	it('mirror_ward resolves to renderMirrorWard, distinct from ground enchantments', () => {
		const mirror = resolveRenderers('mirror_ward');
		const ground = resolveRenderers('spike_trap');
		expect(mirror).toHaveLength(1);
		expect(ground).toHaveLength(1);
		expect(mirror[0]).not.toBe(ground[0]);
	});

	it('mirror_ward has no positive windUpMs', () => {
		const windUp = getCardDef('mirror_ward').windUpMs;
		expect(windUp === undefined || windUp === 0).toBe(true);
	});
});

describe('renderCardUsed() — economy card VFX', () => {
	describe('deck_sifter', () => {
		it('spawns a parchment/gold particle burst at the caster origin', () => {
			const ctx = makeCtx();
			renderCardUsed({
				cardId: 'deck_sifter',
				origin: { x: 3, z: 4 },
				hits: [],
			}, ctx);
			const bursts = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst');
			expect(bursts).toHaveLength(1);
			expect(bursts[0][1]).toEqual({ x: 3, z: 4 });
			expect(bursts[0][2]).toMatchObject({
				color: 0xf5deb3,
				emissive: 0xdaa520,
				count: 10,
				spread: 1.8,
			});
		});

		it('does not throw when spawnParticleBurst is absent', () => {
			const ctx = makeCtx({ spawnParticleBurst: undefined });
			expect(() => renderCardUsed({
				cardId: 'deck_sifter',
				origin: { x: 0, z: 0 },
				hits: [],
			}, ctx)).not.toThrow();
			expect(ctx._calls.filter((c) => c[0] === 'spawnParticleBurst')).toHaveLength(0);
		});
	});

	describe('chrono_trigger', () => {
		it('spawns a temporal amber/gold telegraph ring around the caster', () => {
			const ctx = makeCtx();
			renderCardUsed({
				cardId: 'chrono_trigger',
				origin: { x: 5, z: 6 },
				direction: { x: 1, z: 0 },
				hits: [],
			}, ctx);
			const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
			expect(ring).toBeDefined();
			expect(ring[1]).toEqual({ x: 5, z: 6 });
			expect(ring[2]).toBe(3);
			expect(ring[3]).toMatchObject({ color: 0xfbbf24, emissive: 0xf59e0b });
		});

		it('spawns two particle bursts at adjacent hand-slot positions', () => {
			const ctx = makeCtx();
			renderCardUsed({
				cardId: 'chrono_trigger',
				origin: { x: 0, z: 0 },
				direction: { x: 1, z: 0 },
				hits: [],
			}, ctx);
			const bursts = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst');
			expect(bursts).toHaveLength(2);
			// Direction is +x, so perpendicular is along z: offsets at z = -1.2 and z = +1.2.
			const positions = bursts.map((b) => b[1]).sort((p, q) => p.z - q.z);
			expect(positions[0]).toEqual({ x: 0, z: -1.2 });
			expect(positions[1]).toEqual({ x: 0, z: 1.2 });
			// Both bursts use the amber/gold palette.
			for (const b of bursts) {
				expect(b[2]).toMatchObject({ color: 0xfbbf24, emissive: 0xf59e0b, count: 8, spread: 1.0 });
			}
		});

		it('does not throw when telegraph ring or particle burst primitives are absent', () => {
			const ctx = makeCtx({ spawnTelegraphRing: undefined, spawnParticleBurst: undefined });
			expect(() => renderCardUsed({
				cardId: 'chrono_trigger',
				origin: { x: 0, z: 0 },
				hits: [],
			}, ctx)).not.toThrow();
			expect(ctx._calls.filter((c) => c[0] === 'spawnTelegraphRing')).toHaveLength(0);
			expect(ctx._calls.filter((c) => c[0] === 'spawnParticleBurst')).toHaveLength(0);
		});
	});

	describe('mana_prism', () => {
		it('spawns a violet summon ring at the placement point', () => {
			const ctx = makeCtx();
			renderCardUsed({
				cardId: 'mana_prism',
				origin: { x: 7, z: 8 },
				hits: [],
			}, ctx);
			const rings = ctx._calls.filter((c) => c[0] === 'spawnSummonEffect');
			expect(rings).toHaveLength(1);
			expect(rings[0][1]).toEqual({ x: 7, z: 8 });
			expect(rings[0][2]).toBe(2);
			expect(rings[0][3]).toMatchObject({ color: 0xa78bfa, emissive: 0x8b5cf6 });
		});

		it('spawns a violet/cyan crystal particle burst at the center', () => {
			const ctx = makeCtx();
			renderCardUsed({
				cardId: 'mana_prism',
				origin: { x: 7, z: 8 },
				hits: [],
			}, ctx);
			const bursts = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst');
			expect(bursts).toHaveLength(1);
			expect(bursts[0][1]).toEqual({ x: 7, z: 8 });
			expect(bursts[0][2]).toMatchObject({
				color: 0x22d3ee,
				emissive: 0xa78bfa,
				count: 12,
				spread: 1.2,
			});
		});

		it('still renders the summon ring when spawnParticleBurst is absent', () => {
			const ctx = makeCtx({ spawnParticleBurst: undefined });
			renderCardUsed({
				cardId: 'mana_prism',
				origin: { x: 0, z: 0 },
				hits: [],
			}, ctx);
			expect(ctx._calls.filter((c) => c[0] === 'spawnSummonEffect')).toHaveLength(1);
			expect(ctx._calls.filter((c) => c[0] === 'spawnParticleBurst')).toHaveLength(0);
		});
	});
});
