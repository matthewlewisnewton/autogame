import { describe, it, expect, beforeEach } from 'vitest';
import { CARD_DEFS } from '../cards.js';
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
		expect(resolveRenderers('dragons_breath')).toHaveLength(1);
		expect(resolveRenderers('inferno_pillar')).toHaveLength(1);
		expect(resolveRenderers('gravity_well')).toHaveLength(1);
	});

	it('returns the composed renderer list for cards with multiple visuals', () => {
		expect(resolveRenderers('event_horizon')).toHaveLength(1);
	});

	it('falls back to the weapon default for plain weapon cards', () => {
		expect(resolveRenderers('iron_sword')).toHaveLength(1);
		expect(resolveRenderers('flame_blade')).toHaveLength(1);
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
			cardId: 'iron_sword',
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
			cardId: 'saber_of_light',
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

	it('ice_ball adds an accent-tinted projectile trail, impact decal and frost burst', () => {
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
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		expect(decal).toBeDefined();
		expect(decal[1]).toEqual({ x: 10, z: 2 });
		expect(decal[2]).toMatchObject({ color: 0x67e8f9 });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 10, z: 2 });
		expect(burst[2]).toMatchObject({ color: 0x67e8f9 });
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

	it('permafrost_lance uses a narrower telegraph, directional shard trail, and tip burst', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'permafrost_lance',
			origin: { x: 0, z: 0 },
			radius: 6,
			direction: { x: 1, z: 0 },
			hits: [],
		}, ctx);
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[2]).toBeCloseTo(3.3, 5);
		expect(ring[3]).toMatchObject({ color: 0x67e8f9 });
		const trail = ctx._calls.find((c) => c[0] === 'spawnProjectileTrail');
		expect(trail).toBeDefined();
		expect(trail[2]).toEqual({ x: 1, z: 0 });
		expect(trail[3]).toMatchObject({ range: 6, color: 0x67e8f9 });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 6, z: 0 });
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
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

	it('dragons_breath renders a forward fire cone, trail, and tip embers', () => {
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
		const trail = ctx._calls.find((c) => c[0] === 'spawnProjectileTrail');
		expect(trail).toBeDefined();
		expect(trail[3]).toMatchObject({ range: 7, color: 0xfb923c });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 8, z: 2 });
		expect(burst[2]).toMatchObject({ color: 0xfb923c });
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		expect(decal).toBeDefined();
		expect(decal[1]).toEqual({ x: 8, z: 2 });
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
	});

	it('dragons_breath still renders without throwing when the new ctx primitives are absent', () => {
		const ctx = makeCtx({
			spawnProjectileTrail: undefined,
			spawnImpactDecal: undefined,
			spawnParticleBurst: undefined,
		});
		expect(() => renderCardUsed({
			cardId: 'dragons_breath',
			origin: { x: 1, z: 2 },
			direction: { x: 1, z: 0 },
			radius: 7,
			hits: [],
		}, ctx)).not.toThrow();
		expect(ctx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(true);
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
