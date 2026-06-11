import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CARD_DEFS, getCardDef } from '../cards.js';
import {
	ARCHIVE_WYRM_BREATH_DURATION_MS,
	ARCHIVE_WYRM_BREATH_TICK_COUNT,
	ARCHIVE_WYRM_BREATH_TICK_MS,
	ATTACK_EFFECT_DURATION,
	ATTACK_RANGE,
	EVENT_HORIZON_CRUSH_DELAY_MS,
	MINION_SUMMON_IN_MS,
	PHOTON_BARRAGE_SWING_DELAY_MS,
	SUMMON_EFFECT_DURATION,
} from '../config.js';
import {
	renderCardUsed,
	resolveRenderers,
	getAccentHex,
	SPELL_TYPE_DEFAULT_RENDERER,
	WEAPON_TYPE_DEFAULT_RENDERER,
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
		spawnRestorationBeaconEffect: record('spawnRestorationBeaconEffect'),
		spawnEventHorizonEffect: record('spawnEventHorizonEffect'),
		spawnPurifyingPulseHealRing: record('spawnPurifyingPulseHealRing'),
		spawnCleanseBurstEffect: record('spawnCleanseBurstEffect'),
		spawnInfernoPillarEffect: record('spawnInfernoPillarEffect'),
		spawnGlacierRuptureEffect: record('spawnGlacierRuptureEffect'),
		spawnManaPrismEffect: record('spawnManaPrismEffect'),
		spawnDragonsBreathEffect: record('spawnDragonsBreathEffect'),
		spawnFireTrailEffect: record('spawnFireTrailEffect'),
		spawnChainLightningEffect: record('spawnChainLightningEffect'),
		spawnLightningArc: record('spawnLightningArc'),
		spawnParticleBurst: record('spawnParticleBurst'),
		spawnProjectileTrail: record('spawnProjectileTrail'),
		spawnImpactDecal: record('spawnImpactDecal'),
		spawnGravityWellEffect: record('spawnGravityWellEffect'),
		spawnTelegraphRing: record('spawnTelegraphRing'),
		spawnChronoTriggerEffect: record('spawnChronoTriggerEffect'),
		spawnEtherSiphonEffect: record('spawnEtherSiphonEffect'),
		spawnTelepipeCastEffect: record('spawnTelepipeCastEffect'),
		spawnSpikeTrapEffect: record('spawnSpikeTrapEffect'),
		spawnMirrorWardShellEffect: record('spawnMirrorWardShellEffect'),
		dismissMirrorWardShellEffect: record('dismissMirrorWardShellEffect'),
		spawnMirrorWardReflectBurst: record('spawnMirrorWardReflectBurst'),
		spawnMinionSummonInEffect: record('spawnMinionSummonInEffect'),
		spawnBatteryAutomatonDeployEffect: record('spawnBatteryAutomatonDeployEffect'),
		spawnLegionMarshalRallyEffect: record('spawnLegionMarshalRallyEffect'),
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
		const arcaneBoltRenderers = resolveRenderers('arcane_bolt');
		expect(arcaneBoltRenderers).toHaveLength(1);
		expect(arcaneBoltRenderers[0].name).toBe('renderArcaneBolt');
		expect(arcaneBoltRenderers[0].name).not.toBe('renderWeaponSwing');
		const iceBallRenderers = resolveRenderers('ice_ball');
		expect(iceBallRenderers).toHaveLength(1);
		expect(iceBallRenderers[0].name).toBe('renderIceBall');
		expect(resolveRenderers('divine_grace')).toHaveLength(1);
		expect(resolveRenderers('purifying_pulse')).toHaveLength(1);
		expect(resolveRenderers('spike_trap')).toHaveLength(1);
		expect(resolveRenderers('undead_commander')).toHaveLength(1);
		expect(resolveRenderers('skeleton_knight')).toHaveLength(1);
		// Necroframe Knight must use its bespoke renderer, not the generic
		// creature type-default (which battery_automaton falls through to).
		expect(resolveRenderers('skeleton_knight')[0]).not.toBe(resolveRenderers('battery_automaton')[0]);
		const commanderRenderers = resolveRenderers('undead_commander');
		expect(commanderRenderers).toHaveLength(1);
		expect(commanderRenderers[0].name).toBe('renderUndeadCommander');
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
		expect(resolveRenderers('chrono_trigger')[0].name).toBe('renderChronoTrigger');
		expect(resolveRenderers('mana_prism')).toHaveLength(1);
	});

	it('returns the composed renderer list for cards with multiple visuals', () => {
		expect(resolveRenderers('event_horizon')).toHaveLength(1);
	});

	it('registers a dedicated renderer for Reaper\'s Scythe (not the weapon default)', () => {
		const reaper = resolveRenderers('reapers_scythe');
		expect(reaper).toHaveLength(1);
		expect(reaper[0].name).toBe('renderReapersScythe');
		expect(reaper[0]).not.toBe(WEAPON_TYPE_DEFAULT_RENDERER);
		expect(reaper[0]).not.toBe(resolveRenderers('harvesting_scythe')[0]);
		expect(resolveRenderers('deck_sifter')).toHaveLength(1);
	});

	it('returns the card-specific weapon swing for the styled standard blades', () => {
		expect(resolveRenderers('iron_sword')).toHaveLength(1);
		expect(resolveRenderers('flame_blade')).toHaveLength(1);
		expect(resolveRenderers('harvesting_scythe')).toHaveLength(1);
		// Distinct from the plain cone-swing default.
		expect(resolveRenderers('iron_sword')[0]).not.toBe(WEAPON_TYPE_DEFAULT_RENDERER);
	});

	it('returns card-specific renderers for the energy/photon blades (not the cone default)', () => {
		for (const cardId of ['saber_of_light', 'photon_slicer', 'arcane_bolt', 'resonance_edge', 'echo_blade']) {
			expect(resolveRenderers(cardId)).toHaveLength(1);
			expect(resolveRenderers(cardId)[0]).not.toBe(WEAPON_TYPE_DEFAULT_RENDERER);
		}
	});

	it('returns dedicated renderers for alloy greatblade and corebreaker (not the cone default)', () => {
		for (const cardId of ['steel_claymore', 'magma_greatsword']) {
			expect(resolveRenderers(cardId)).toHaveLength(1);
			expect(resolveRenderers(cardId)[0]).not.toBe(WEAPON_TYPE_DEFAULT_RENDERER);
		}
		expect(resolveRenderers('steel_claymore')[0]).not.toBe(resolveRenderers('magma_greatsword')[0]);
	});

	it('returns a dedicated renderer for excalibur_photon (not heavy greatsword or cone default)', () => {
		const plain = WEAPON_TYPE_DEFAULT_RENDERER;
		const heavy = resolveRenderers('magma_greatsword')[0];
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
		const manaLeachRenderers = resolveRenderers('mana_leach');
		expect(manaLeachRenderers).toHaveLength(1);
		expect(manaLeachRenderers[0].name).toBe('renderManaLeach');
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
		const creatureDefault = resolveRenderers('aegis_sentinel');
		expect(creatureDefault).toHaveLength(1);
		expect(creatureDefault[0].name).toBe('renderCreatureSummon');
	});

	it('returns renderBatteryAutomaton for battery_automaton (not the creature type default)', () => {
		const batteryRenderers = resolveRenderers('battery_automaton');
		expect(batteryRenderers).toHaveLength(1);
		expect(batteryRenderers[0].name).toBe('renderBatteryAutomaton');
		expect(batteryRenderers[0]).not.toBe(resolveRenderers('aegis_sentinel')[0]);
	});

	it('returns an empty list for unknown card ids', () => {
		expect(resolveRenderers('not_a_real_card')).toEqual([]);
	});

	it('returns composed summon + attack renderers for Vault Wyrm and Archive Wyrm', () => {
		const vault = resolveRenderers('dungeon_drake');
		const archive = resolveRenderers('ancient_wyrm');
		expect(vault).toHaveLength(2);
		expect(archive).toHaveLength(2);
		expect(vault[0].name).toBe('renderWyrmSummon');
		expect(vault[1].name).toBe('renderWyrmAttack');
		expect(archive[0].name).toBe('renderArchiveWyrmSummon');
		expect(archive[1].name).toBe('renderArchiveWyrmBreath');
		expect(archive[0]).not.toBe(vault[0]);
		expect(archive[1]).not.toBe(vault[1]);
	});

	it('returns composed summon + attack renderers for Phase Stalker', () => {
		expect(resolveRenderers('null_crawler')).toHaveLength(2);
	});

	it('returns bespoke attack renderer for Bulkhead Mauler', () => {
		expect(resolveRenderers('bulkhead_mauler')).toHaveLength(1);
	});

	it('returns the chain_lightning arc renderer for Voltaic Chain', () => {
		const renderers = resolveRenderers('chain_lightning');
		expect(renderers).toHaveLength(1);
		expect(renderers[0].name).toBe('renderChainLightningArcs');
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
		WEAPON_TYPE_DEFAULT_RENDERER({
			origin: { x: 1, z: 2 },
			direction: { x: 0, z: 1 },
		}, ctx);
		const attacks = ctx._calls.filter((c) => c[0] === 'spawnAttackEffect');
		expect(attacks).toHaveLength(1);
		expect(attacks[0][1]).toEqual({ x: 1, z: 2 });
		expect(attacks[0][2]).toEqual({ x: 0, z: 1 });
	});

	it('spawns swingCount attack effects for multi-swing weapons', () => {
		const ctx = makeCtx();
		WEAPON_TYPE_DEFAULT_RENDERER({
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			swingCount: 3,
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
		// Default disc range is 6, so the spark burst lands at the far point.
		expect(burst[1]).toEqual({ x: 6, z: 0 });
		expect(burst[2]).toMatchObject({ color: 0xa5f3fc, emissive: 0x22d3ee });
	});

	it('infinite_disk sizes the disc trail/spark from data.attackRange', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'infinite_disk',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			attackRange: 10,
			hits: [],
		}, ctx);
		const trail = ctx._calls.find((c) => c[0] === 'spawnProjectileTrail');
		expect(trail[3]).toMatchObject({ range: 10 });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst[1]).toEqual({ x: 10, z: 0 });
	});

	it('infinite_disk schedules one return beat per data.returnPasses', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'infinite_disk',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			attackRange: 8,
			returnPasses: 3,
			hits: [],
		}, ctx);
		const schedules = ctx._calls.filter((c) => c[0] === 'scheduleAfter');
		expect(schedules).toHaveLength(3);
		// Beats are staggered and increasing.
		const delays = schedules.map((c) => c[1]);
		expect(delays).toEqual([...delays].sort((a, b) => a - b));
		expect(new Set(delays).size).toBe(3);
		// Running the scheduled beats sends a return trail back from the far point
		// toward the origin (reversed direction).
		ctx.runScheduled();
		const returnTrails = ctx._calls
			.filter((c) => c[0] === 'spawnProjectileTrail')
			.slice(1); // first trail is the outbound polish pass
		expect(returnTrails).toHaveLength(3);
		expect(returnTrails[0][1]).toEqual({ x: 8, z: 0 }); // starts at far point
		expect(returnTrails[0][2].x).toBe(-1); // reversed direction
		expect(returnTrails[0][2].z === 0).toBe(true);
	});

	it('infinite_disk follows a returnPasses: 2 payload (not a hardcoded count)', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'infinite_disk',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			returnPasses: 2,
			hits: [],
		}, ctx);
		expect(ctx._calls.filter((c) => c[0] === 'scheduleAfter')).toHaveLength(2);
	});

	it('infinite_disk degrades gracefully without scheduleAfter (still three discs, no throw)', () => {
		const ctx = makeCtx({ scheduleAfter: undefined });
		expect(() => renderCardUsed({
			cardId: 'infinite_disk',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			returnPasses: 3,
			hits: [],
		}, ctx)).not.toThrow();
		expect(ctx._calls.filter((c) => c[0] === 'spawnAttackEffect')).toHaveLength(3);
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
			color: 0x67e8f9,
			emissive: 0x38bdf8,
		});
	});

	it('ice_ball adds cast flourish, synced travel timing, and deferred terminal impact', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'ice_ball',
			origin: { x: 1, z: 2 },
			direction: { x: 1, z: 0 },
			attackRange: 9,
			projectileTravelMs: 1200,
			hits: [],
		}, ctx);
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[1]).toEqual({ x: 1, z: 2 });
		expect(ring[3]).toMatchObject({ color: 0x67e8f9, emissive: 0x38bdf8 });
		const castBurst = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst')
			.find((c) => c[1].x === 1 && c[1].z === 2 && c[2].count === 8);
		expect(castBurst).toBeDefined();
		const trail = ctx._calls.find((c) => c[0] === 'spawnProjectileTrail');
		expect(trail).toBeDefined();
		expect(trail[1]).toEqual({ x: 1, z: 2 });
		expect(trail[2]).toEqual({ x: 1, z: 0 });
		expect(trail[3]).toMatchObject({
			range: 9,
			travelMs: 1200,
			color: 0x67e8f9,
		});
		const schedules = ctx._calls.filter((c) => c[0] === 'scheduleAfter');
		expect(schedules).toHaveLength(1);
		expect(schedules[0][1]).toBe(1200);
		expect(ctx._scheduled).toHaveLength(1);
		expect(ctx._scheduled[0].invoked).toBe(false);
		// Terminal impact at (10, 2) is deferred — not fired synchronously at cast.
		expect(ctx._calls.find((c) => c[0] === 'spawnImpactDecal')).toBeUndefined();
		expect(ctx._calls.filter((c) => c[0] === 'spawnParticleBurst')
			.some((c) => c[1].x === 10 && c[1].z === 2 && c[2].count === 14)).toBe(false);
		ctx.runScheduled();
		expect(ctx._scheduled[0].invoked).toBe(true);
		// Impact decal + freeze-crystal burst land at origin + direction * range = (10, 2).
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		expect(decal).toBeDefined();
		expect(decal[1]).toEqual({ x: 10, z: 2 });
		expect(decal[2]).toMatchObject({ color: 0x67e8f9, emissive: 0x38bdf8 });
		const terminalBurst = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst')
			.find((c) => c[1].x === 10 && c[1].z === 2 && c[2].count === 14);
		expect(terminalBurst).toBeDefined();
		expect(terminalBurst[2]).toMatchObject({ color: 0x67e8f9, emissive: 0x38bdf8, spread: 1.8 });
	});

	it('ice_ball has no positive windUpMs (instant cast; no charge telegraph)', () => {
		expect(CARD_DEFS.ice_ball).toBeDefined();
		expect(CARD_DEFS.ice_ball.windUpMs ?? 0).toBeLessThanOrEqual(0);
	});

	it('ice_ball spawns immediate per-hit frost bursts at enemy mesh positions', () => {
		const ctx = makeCtx({
			enemyMeshes: () => ({
				e1: { position: { x: 4, y: 0, z: 2 } },
				e2: { position: { x: 7, y: 0, z: 2 } },
			}),
		});
		renderCardUsed({
			cardId: 'ice_ball',
			effect: 'ice_ball',
			origin: { x: 1, z: 2 },
			direction: { x: 1, z: 0 },
			attackRange: 9,
			projectileTravelMs: 1200,
			hits: [{ enemyId: 'e1' }, { enemyId: 'e2' }, { enemyId: 'missing' }],
		}, ctx);
		const hitSparks = ctx._calls.filter((c) => c[0] === 'spawnHitSpark');
		expect(hitSparks).toHaveLength(2);
		expect(hitSparks[0][1]).toEqual({ x: 4, y: 0.6, z: 2 });
		expect(hitSparks[1][1]).toEqual({ x: 7, y: 0.6, z: 2 });
		const frostBursts = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst')
			.filter((c) => c[2].count === 6);
		expect(frostBursts).toHaveLength(2);
	});

	it('ice_ball still renders without throwing when the new ctx primitives are absent', () => {
		const ctx = makeCtx({
			spawnProjectileTrail: undefined,
			spawnImpactDecal: undefined,
			spawnParticleBurst: undefined,
			spawnTelegraphRing: undefined,
			spawnHitSpark: undefined,
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
		expect(ctx._calls.some((c) => c[0] === 'scheduleAfter')).toBe(true);
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

	it('Ether Scythe slashes a wide ghostly arc with a lingering spectral decal and no flame trail', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'harvesting_scythe',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			hits: [],
		}, ctx);
		const style = swingStyle(ctx);
		// Ethereal palette: ghostly ether-green body, spectral-violet emissive.
		expect(style).toMatchObject({ color: 0x86efac, emissive: 0x8b5cf6, coneAngle: (Math.PI * 2) / 3, range: 6 });
		// Decal lands out along the sweep at range * 0.6 = 3.6.
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		expect(decal).toBeDefined();
		expect(decal[1].x).toBeCloseTo(3.6);
		expect(decal[1].z).toBe(0);
		expect(decal[2]).toMatchObject({ color: 0x86efac });
		// Spectral sweep reaps no souls without hits, and never streams a flame trail.
		expect(ctx._calls.some((c) => c[0] === 'spawnProjectileTrail')).toBe(false);
		expect(ctx._calls.some((c) => c[1]?.soulWisp || c[2]?.soulWisp)).toBe(false);
	});

	it('Ether Scythe drives its sweep cone/range from the server payload (attackConeAngle/attackRange)', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'harvesting_scythe',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			// Mirror the real scythe payload: a full 180° cone and an extended reach
			// the hardcoded style (120°, range 6) would under-cover.
			attackConeAngle: Math.PI,
			attackRange: 9,
			hits: [],
		}, ctx);
		const style = swingStyle(ctx);
		// Cone/range come from the server, not the authored style.
		expect(style.coneAngle).toBe(Math.PI);
		expect(style.range).toBe(9);
		// Decal placement scales off the server range: 9 * 0.6 = 5.4.
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		expect(decal).toBeDefined();
		expect(decal[1].x).toBeCloseTo(5.4);
		// The swing fires immediately on cardUsed — no deferred wind-up scheduling.
		expect(ctx._calls.some((c) => c[0] === 'scheduleAfter')).toBe(false);
	});

	it('Ether Scythe falls back to its style cone/range when the payload omits them', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'harvesting_scythe',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			// No attackConeAngle/attackRange (older/minion payloads).
			hits: [],
		}, ctx);
		const style = swingStyle(ctx);
		expect(style.coneAngle).toBe((Math.PI * 2) / 3);
		expect(style.range).toBe(6);
		// Decal still scales off the style range: 6 * 0.6 = 3.6.
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		expect(decal[1].x).toBeCloseTo(3.6);
	});

	it('a sibling blade (flame_blade) ignores the payload attackConeAngle/attackRange and keeps its authored arc', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'flame_blade',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			attackConeAngle: Math.PI,
			attackRange: 9,
			hits: [],
		}, ctx);
		const style = swingStyle(ctx);
		// Flame blade is not opted in, so it keeps its hardcoded cone/range.
		expect(style.coneAngle).toBe(Math.PI / 4);
		expect(style.range).toBe(5);
	});

	it('Ether Scythe reaps an ether-tinted soul-wisp burst at each struck enemy', () => {
		const meshes = {
			ghoul: { position: { x: 4, y: 0, z: -1 } },
			wraith: { position: { x: -2, y: 1, z: 3 } },
		};
		const ctx = makeCtx({ enemyMeshes: () => meshes });
		renderCardUsed({
			cardId: 'harvesting_scythe',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			hits: [{ enemyId: 'ghoul' }, { enemyId: 'wraith' }],
		}, ctx);
		const wisps = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst' && c[2]?.soulWisp);
		expect(wisps).toHaveLength(2);
		// Each wisp rises at its enemy's mesh position (lifted by 0.6) in the scythe palette.
		expect(wisps[0][1]).toMatchObject({ x: 4, y: 0.6, z: -1 });
		expect(wisps[1][1]).toMatchObject({ x: -2, y: 1.6, z: 3 });
		for (const wisp of wisps) {
			expect(wisp[2]).toMatchObject({ color: 0x86efac, emissive: 0x8b5cf6 });
		}
	});

	it('Ether Scythe skips wisps for hits with no resolvable mesh', () => {
		const meshes = { ghoul: { position: { x: 4, y: 0, z: -1 } } };
		const ctx = makeCtx({ enemyMeshes: () => meshes });
		renderCardUsed({
			cardId: 'harvesting_scythe',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			hits: [{ enemyId: 'ghoul' }, { enemyId: 'phantom' }],
		}, ctx);
		const wisps = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst' && c[2]?.soulWisp);
		expect(wisps).toHaveLength(1);
		expect(wisps[0][1]).toMatchObject({ x: 4, y: 0.6, z: -1 });
	});

	it('Ether Scythe harvest degrades gracefully when enemyMeshes/spawnParticleBurst are absent', () => {
		const ctx = makeCtx({ enemyMeshes: undefined, spawnParticleBurst: undefined });
		expect(() => renderCardUsed({
			cardId: 'harvesting_scythe',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			hits: [{ enemyId: 'ghoul' }],
		}, ctx)).not.toThrow();
		// The core cone swing and decal still fire.
		expect(ctx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'spawnImpactDecal')).toBe(true);
	});

	it('the soul-harvest hook fires only for the scythe, not the other styled blades', () => {
		const meshes = { ghoul: { position: { x: 4, y: 0, z: -1 } } };
		for (const cardId of ['iron_sword', 'flame_blade', 'saber_of_light']) {
			const ctx = makeCtx({ enemyMeshes: () => meshes });
			renderCardUsed({
				cardId,
				origin: { x: 0, z: 0 },
				direction: { x: 1, z: 0 },
				hits: [{ enemyId: 'ghoul' }],
			}, ctx);
			expect(ctx._calls.some((c) => c[0] === 'spawnParticleBurst' && c[2]?.soulWisp)).toBe(false);
		}
	});

	it('Reaper\'s Scythe uses the dedicated renderer sweep stack (not the weapon default)', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'reapers_scythe',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			attackConeAngle: Math.PI,
			attackRange: 5,
			hits: [],
		}, ctx);
		const style = swingStyle(ctx);
		expect(style).toMatchObject({
			color: 0x1e293b,
			emissive: 0xe7e5e4,
			coneAngle: Math.PI,
			range: ATTACK_RANGE,
			fillOpacity: 0.34,
			edgeOpacity: 0.82,
		});
		expect(style.color).not.toBe(0x86efac);
		expect(style.emissive).not.toBe(0x8b5cf6);
		expect(ctx._calls.some((c) => c[0] === 'spawnProjectileTrail')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'spawnParticleBurst')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'spawnImpactDecal')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'spawnLightningArc')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'scheduleAfter')).toBe(false);
	});

	it('Reaper\'s Scythe degrades gracefully when optional ctx primitives are absent', () => {
		const ctx = makeCtx({
			spawnProjectileTrail: undefined,
			spawnImpactDecal: undefined,
			spawnParticleBurst: undefined,
			spawnLightningArc: undefined,
			enemyMeshes: undefined,
		});
		expect(() => renderCardUsed({
			cardId: 'reapers_scythe',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			attackConeAngle: Math.PI,
			hits: [{ enemyId: 'e1', hp: 0 }],
			currencyGained: 6,
			hpHealed: 8,
		}, ctx)).not.toThrow();
		expect(ctx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(true);
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

describe('renderCardUsed() — Reaper\'s Scythe', () => {
	it('spawns a soul tether from each killing hit with a live enemy mesh toward the cast origin', () => {
		const ctx = makeCtx({
			enemyMeshes: () => ({
				e1: { position: { x: 4, y: 1, z: 2 } },
				e2: { position: { x: 6, y: 0, z: -1 } },
			}),
		});
		renderCardUsed({
			cardId: 'reapers_scythe',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			attackConeAngle: Math.PI,
			hits: [
				{ enemyId: 'e1', hp: 0 },
				{ enemyId: 'e2', hp: 0 },
				{ enemyId: 'gone', hp: 0 },
			],
		}, ctx);
		const tethers = ctx._calls.filter((c) => c[0] === 'spawnLightningArc');
		expect(tethers).toHaveLength(2);
		expect(tethers[0][1]).toEqual({ x: 4, y: 1, z: 2 });
		expect(tethers[0][2]).toEqual({ x: 0, z: 0 });
		expect(tethers[0][3]).toMatchObject({ color: 0x1e293b, emissive: 0xe7e5e4 });
		expect(tethers[1][1]).toEqual({ x: 6, y: 0, z: -1 });
		expect(tethers[1][2]).toEqual({ x: 0, z: 0 });
		expect(ctx._calls.some((c) => c[0] === 'scheduleAfter')).toBe(false);
	});

	it('spawns a harvest flourish at the origin when currencyGained or hpHealed is positive', () => {
		const currencyCtx = makeCtx();
		renderCardUsed({
			cardId: 'reapers_scythe',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			currencyGained: 6,
			hits: [],
		}, currencyCtx);
		const currencyFlourish = currencyCtx._calls.find(
			(c) => c[0] === 'spawnImpactDecal' && c[1].x === 0 && c[1].z === 0,
		);
		expect(currencyFlourish).toBeDefined();
		expect(currencyFlourish[2]).toMatchObject({ color: 0xb45309, emissive: 0x4ade80 });

		const healCtx = makeCtx();
		renderCardUsed({
			cardId: 'reapers_scythe',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			hpHealed: 8,
			hits: [],
		}, healCtx);
		const healFlourish = healCtx._calls.find(
			(c) => c[0] === 'spawnImpactDecal' && c[1].x === 0 && c[1].z === 0,
		);
		expect(healFlourish).toBeDefined();
		expect(healFlourish[2]).toMatchObject({ color: 0xb45309, emissive: 0x4ade80 });
	});

	it('non-killing swings show the sweep only — no tether or harvest flourish', () => {
		const ctx = makeCtx({
			enemyMeshes: () => ({
				e1: { position: { x: 4, y: 0, z: 2 } },
			}),
		});
		renderCardUsed({
			cardId: 'reapers_scythe',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			specialEffect: 'reap',
			hits: [{ enemyId: 'e1', hp: 40 }],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'spawnLightningArc')).toBe(false);
		const originFlourish = ctx._calls.find(
			(c) => c[0] === 'spawnImpactDecal' && c[1].x === 0 && c[1].z === 0
				&& c[2]?.color === 0xb45309,
		);
		expect(originFlourish).toBeUndefined();
	});

	it('degrades gracefully when spawnLightningArc, enemyMeshes, and flourish primitives are absent', () => {
		const ctx = makeCtx({
			spawnLightningArc: undefined,
			spawnImpactDecal: undefined,
			spawnParticleBurst: undefined,
			enemyMeshes: undefined,
		});
		expect(() => renderCardUsed({
			cardId: 'reapers_scythe',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			hits: [{ enemyId: 'e1', hp: 0 }],
			currencyGained: 6,
			hpHealed: 8,
		}, ctx)).not.toThrow();
		expect(ctx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(true);
	});

	it('has no positive windUpMs (instant cast; no 307 charge telegraph expected)', () => {
		expect(CARD_DEFS.reapers_scythe.windUpMs ?? 0).toBeLessThanOrEqual(0);
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

	it('Photon Slicer throws a returning cyan photon disc to its attackRange', () => {
		const ctx = makeCtx();
		// Mirror the real payload: attackRange 8, no returnPasses.
		fire('photon_slicer', ctx, { attackRange: 8 });
		// A single outbound disc along the firing direction, tinted cyan.
		const attacks = ctx._calls.filter((c) => c[0] === 'spawnAttackEffect');
		expect(attacks).toHaveLength(1);
		expect(attacks[0][1]).toEqual({ x: 0, z: 0 }); // thrown from the origin
		expect(attacks[0][2]).toMatchObject({ x: 1, z: 0 }); // along +x
		expect(attacks[0][3]).toMatchObject({ color: 0x22d3ee });
		// A forward trail plus a spark burst at the far point of the throw (range 8).
		const trail = ctx._calls.find((c) => c[0] === 'spawnProjectileTrail');
		expect(trail).toBeDefined();
		expect(trail[3]).toMatchObject({ range: 8, color: 0x22d3ee });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 8, z: 0 });
		// Exactly one return beat is scheduled even though the payload omits
		// returnPasses (the base card must still boomerang home).
		const schedules = ctx._calls.filter((c) => c[0] === 'scheduleAfter');
		expect(schedules).toHaveLength(1);
		// Running it sends a return trail back from the far point toward the origin.
		ctx.runScheduled();
		const returnTrails = ctx._calls
			.filter((c) => c[0] === 'spawnProjectileTrail')
			.slice(1); // first trail is the outbound polish pass
		expect(returnTrails).toHaveLength(1);
		expect(returnTrails[0][1]).toEqual({ x: 8, z: 0 }); // starts at far point
		expect(returnTrails[0][2].x).toBe(-1); // reversed direction
		expect(returnTrails[0][2].z === 0).toBe(true);
	});

	it('Arcane Bolt fires a violet arcane_bolt projectile with synced travel timing', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'arcane_bolt',
			origin: { x: 1, z: 2 },
			direction: { x: 1, z: 0 },
			attackRange: 10,
			hits: [],
		}, ctx);
		const attacks = ctx._calls.filter((c) => c[0] === 'spawnAttackEffect');
		expect(attacks).toHaveLength(1);
		expect(attacks[0][3]).toMatchObject({
			effect: 'arcane_bolt',
			range: 10,
			projectileTravelMs: ATTACK_EFFECT_DURATION,
			color: 0xa78bfa,
			emissive: 0x7c3aed,
		});
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[1]).toEqual({ x: 1, z: 2 });
		expect(ring[3]).toMatchObject({ color: 0xa78bfa, emissive: 0x7c3aed });
		const castBurst = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst')
			.find((c) => c[1].x === 1 && c[1].z === 2 && c[2].count === 8);
		expect(castBurst).toBeDefined();
		const trail = ctx._calls.find((c) => c[0] === 'spawnProjectileTrail');
		expect(trail).toBeDefined();
		expect(trail[3]).toMatchObject({
			range: 10,
			travelMs: ATTACK_EFFECT_DURATION,
			color: 0xa78bfa,
			emissive: 0x7c3aed,
		});
		const schedules = ctx._calls.filter((c) => c[0] === 'scheduleAfter');
		expect(schedules).toHaveLength(1);
		expect(schedules[0][1]).toBe(ATTACK_EFFECT_DURATION);
		expect(ctx._calls.find((c) => c[0] === 'spawnImpactDecal')).toBeUndefined();
		expect(ctx._calls.filter((c) => c[0] === 'spawnParticleBurst')
			.some((c) => c[1].x === 11 && c[1].z === 2 && c[2].count === 16)).toBe(false);
		ctx.runScheduled();
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		expect(decal).toBeDefined();
		expect(decal[1]).toEqual({ x: 11, z: 2 });
		const terminalBurst = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst')
			.find((c) => c[1].x === 11 && c[1].z === 2 && c[2].count === 16);
		expect(terminalBurst).toBeDefined();
	});

	it('arcane_bolt has no positive windUpMs (instant cast; 315 charge telegraph absent)', () => {
		expect(CARD_DEFS.arcane_bolt).toBeDefined();
		expect(CARD_DEFS.arcane_bolt.windUpMs ?? 0).toBeLessThanOrEqual(0);
	});

	it('arcane_bolt spawns immediate per-hit pierce bursts at enemy mesh positions', () => {
		const ctx = makeCtx({
			enemyMeshes: () => ({
				e1: { position: { x: 4, y: 0, z: 2 } },
				e2: { position: { x: 7, y: 0, z: 2 } },
			}),
		});
		renderCardUsed({
			cardId: 'arcane_bolt',
			origin: { x: 1, z: 2 },
			direction: { x: 1, z: 0 },
			attackRange: 10,
			hits: [{ enemyId: 'e1' }, { enemyId: 'e2' }, { enemyId: 'missing' }],
		}, ctx);
		const hitSparks = ctx._calls.filter((c) => c[0] === 'spawnHitSpark');
		expect(hitSparks).toHaveLength(2);
		expect(hitSparks[0][1]).toEqual({ x: 4, y: 0.6, z: 2 });
		expect(hitSparks[1][1]).toEqual({ x: 7, y: 0.6, z: 2 });
		const pierceBursts = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst')
			.filter((c) => c[2].count === 6);
		expect(pierceBursts).toHaveLength(2);
	});

	it('Resonance Edge slashes magenta and rings twice via a scheduled second pulse', () => {
		const ctx = makeCtx();
		// The common non-discharge swing: server sends an empty shockwaveHits.
		fire('resonance_edge', ctx, { shockwaveHits: [] });
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
		// No resonance-discharge layer on the off-cadence swing: no large ring
		// near the shockwave radius and no heavy burst.
		expect(rings.some((r) => r[2] >= 6)).toBe(false);
		const bursts = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst');
		expect(bursts.every((b) => b[2].count <= 8)).toBe(true);
	});

	it('Resonance Edge discharges a larger resonance burst on the shockwave cadence', () => {
		const ctx = makeCtx();
		// Server collected radial shockwave hits this use (every 2nd use).
		fire('resonance_edge', ctx, { shockwaveHits: [{ enemyId: 'e1' }] });
		// Still the magenta cone swing and base ringing.
		expect(swingStyle(ctx)).toMatchObject({ color: 0xe879f9, coneAngle: Math.PI / 3.5 });
		ctx.runScheduled();
		const rings = ctx._calls.filter((c) => c[0] === 'spawnTelegraphRing');
		// A discharge ring sized to the shockwave radius (~6), far larger than the
		// base 1.6/2.6 pulses, and a still-larger expanding after-ring.
		expect(rings.some((r) => r[2] >= 6)).toBe(true);
		expect(rings.some((r) => r[2] > 6)).toBe(true);
		for (const r of rings) expect(r[3]).toMatchObject({ color: 0xe879f9 });
		// A heavier spark burst than the base count-8 pulses.
		const bursts = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst');
		expect(bursts.some((b) => b[2].count >= 20)).toBe(true);
	});

	it('Phase Echo swings pink, then schedules a fainter echo swing', () => {
		const ctx = makeCtx();
		// The common off-cadence swing: server sends an empty shockwaveHits.
		fire('echo_blade', ctx, { shockwaveHits: [] });
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
		// No phase-shockwave layer off cadence: no large ring near the shockwave
		// radius and no heavy particle burst.
		const rings = ctx._calls.filter((c) => c[0] === 'spawnTelegraphRing');
		expect(rings.some((r) => r[2] >= 6)).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnParticleBurst')).toBe(false);
	});

	it('Phase Echo layers a radial shockwave on the every-3rd-use cadence', () => {
		const ctx = makeCtx();
		// Server collected radial shockwave hits this use (every 3rd use).
		fire('echo_blade', ctx, { shockwaveHits: [{ enemyId: 'e1' }], shockwaveRadius: 7 });
		// Still the pink twin-slash: lead swing then a fainter echo.
		expect(swingStyle(ctx)).toMatchObject({ color: 0xf472b6, coneAngle: Math.PI / 4 });
		ctx.runScheduled();
		const attacks = ctx._calls.filter((c) => c[0] === 'spawnAttackEffect');
		expect(attacks).toHaveLength(2);
		expect(attacks[1][3].fillOpacity).toBeLessThan(attacks[0][3].fillOpacity);
		// A shockwave ring sized to data.shockwaveRadius (7), far larger than the
		// twin-slash, plus a still-larger expanding after-ring.
		const rings = ctx._calls.filter((c) => c[0] === 'spawnTelegraphRing');
		expect(rings.some((r) => r[2] === 7)).toBe(true);
		expect(rings.some((r) => r[2] > 7)).toBe(true);
		for (const r of rings) expect(r[3]).toMatchObject({ color: 0xf472b6 });
		// A heavy particle burst at the cast origin (well above the base swing).
		const bursts = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst');
		expect(bursts.some((b) => b[2].count >= 20)).toBe(true);
	});

	it('Phase Echo falls back to a ~6 shockwave radius when none is reported', () => {
		const ctx = makeCtx();
		fire('echo_blade', ctx, { shockwaveHits: [{ enemyId: 'e1' }] });
		const rings = ctx._calls.filter((c) => c[0] === 'spawnTelegraphRing');
		expect(rings.some((r) => r[2] === 6)).toBe(true);
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
		// The shockwave-cadence path must also degrade gracefully when the ring /
		// burst primitives are absent (resonance_edge and echo_blade both layer one).
		expect(() =>
			fire('resonance_edge', ctx, { shockwaveHits: [{ enemyId: 'e1' }], shockwaveRadius: 6 }),
		).not.toThrow();
		expect(() =>
			fire('echo_blade', ctx, { shockwaveHits: [{ enemyId: 'e1' }], shockwaveRadius: 6 }),
		).not.toThrow();
		// Each blade's core cone swing still fired.
		expect(ctx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(true);
	});
});

describe('renderCardUsed() — saber_of_light reach + swift_slash timing', () => {
	function fireSaber(ctx, extra = {}) {
		renderCardUsed(
			{
				cardId: 'saber_of_light',
				specialEffect: 'swift_slash',
				origin: { x: 0, z: 0 },
				direction: { x: 1, z: 0 },
				swingCount: 1,
				hits: [],
				...extra,
			},
			ctx,
		);
	}
	function swingStyle(ctx) {
		const attack = ctx._calls.find((c) => c[0] === 'spawnAttackEffect');
		expect(attack).toBeDefined();
		return attack[3];
	}
	function impactPoint(ctx) {
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		return ring[1];
	}

	it('uses a dedicated renderer, distinct from the plain cone default and renderWeaponSwing', () => {
		const plainCone = resolveRenderers('reapers_scythe')[0]; // weapon type default (renderConeSwings)
		const weaponSwing = resolveRenderers('iron_sword')[0]; // shared renderWeaponSwing
		const saber = resolveRenderers('saber_of_light');
		expect(saber).toHaveLength(1);
		expect(saber[0]).not.toBe(plainCone);
		expect(saber[0]).not.toBe(weaponSwing);
	});

	it('records the light-themed primitives: cone attack, telegraph flash, and spark burst', () => {
		const ctx = makeCtx();
		fireSaber(ctx, { attackRange: 5 });
		const names = methodsCalled(ctx);
		expect(names).toContain('spawnAttackEffect');
		expect(names).toContain('spawnTelegraphRing');
		expect(names).toContain('spawnParticleBurst');
		// Holy radiant blade, not a flame trail.
		expect(names).not.toContain('spawnProjectileTrail');
		// Pale-gold accent on the cone swing.
		expect(swingStyle(ctx)).toMatchObject({ color: 0xfef08a });
	});

	it('sizes the cone reach and impact placement from data.attackRange (longer for larger range)', () => {
		const near = makeCtx();
		fireSaber(near, { attackRange: 3 });
		const far = makeCtx();
		fireSaber(far, { attackRange: 9 });

		// The cone swing range tracks the server attackRange directly.
		expect(swingStyle(near).range).toBe(3);
		expect(swingStyle(far).range).toBe(9);
		expect(swingStyle(far).range).toBeGreaterThan(swingStyle(near).range);

		// The impact flash / sparks are placed proportionally farther along the
		// facing direction for the larger reach (origin 0,0 facing +x).
		expect(impactPoint(far).x).toBeGreaterThan(impactPoint(near).x);
		expect(impactPoint(far).x / impactPoint(near).x).toBeCloseTo(3);
		// Spark burst rides the same impact point.
		const nearBurst = near._calls.find((c) => c[0] === 'spawnParticleBurst');
		const farBurst = far._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(farBurst[1].x).toBeGreaterThan(nearBurst[1].x);
	});

	it('falls back to a sane default reach when attackRange is absent', () => {
		const ctx = makeCtx();
		fireSaber(ctx, { attackRange: undefined });
		// No hardcoded saber range constant leaks in as 0; a usable default reach.
		expect(swingStyle(ctx).range).toBeGreaterThan(0);
		expect(impactPoint(ctx).x).toBeGreaterThan(0);
	});

	it('fires the single swing immediately with no artificial scheduleAfter delay', () => {
		const ctx = makeCtx();
		fireSaber(ctx, { attackRange: 5, swingCount: 1 });
		// The whole swing — cone, telegraph flash, sparks — lands synchronously.
		expect(ctx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'spawnParticleBurst')).toBe(true);
		// swift_slash, swingCount 1: nothing is deferred.
		expect(ctx._calls.some((c) => c[0] === 'scheduleAfter')).toBe(false);
	});

	it('degrades gracefully when optional light primitives are absent', () => {
		const ctx = makeCtx({
			spawnTelegraphRing: undefined,
			spawnParticleBurst: undefined,
		});
		expect(() => fireSaber(ctx, { attackRange: 5 })).not.toThrow();
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

	it('Alloy Greatblade cleaves a wide slate arc with metallic trail, large decal, and heavy debris', () => {
		const ctx = makeCtx();
		fire('steel_claymore', ctx);
		const style = swingStyle(ctx);
		expect(style).toMatchObject({ color: 0x94a3b8, coneAngle: Math.PI / 2.2, range: 7 });
		const trail = ctx._calls.find((c) => c[0] === 'spawnProjectileTrail');
		expect(trail).toBeDefined();
		expect(trail[3]).toMatchObject({ color: 0x94a3b8, emissive: 0x64748b, range: 7 });
		// Larger-radius decal + high-count debris burst at the strike point (range = 7).
		const decal = impactDecal(ctx);
		expect(decal).toBeDefined();
		expect(decal[1]).toEqual({ x: 7, z: 0 });
		expect(decal[2]).toMatchObject({ color: 0x94a3b8, emissive: 0x64748b, radius: 3.2 });
		const burst = debrisBurst(ctx);
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 7, z: 0 });
		expect(burst[2]).toMatchObject({
			color: 0x94a3b8,
			emissive: 0x64748b,
			count: 18,
			spread: 2.4,
		});
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

	it('alloy greatblade emits a metallic trail; magma greatsword does not', () => {
		const alloyCtx = makeCtx();
		fire('steel_claymore', alloyCtx);
		expect(alloyCtx._calls.some((c) => c[0] === 'spawnProjectileTrail')).toBe(true);
		expect(alloyCtx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(false);

		const magmaCtx = makeCtx();
		fire('magma_greatsword', magmaCtx);
		expect(magmaCtx._calls.some((c) => c[0] === 'spawnProjectileTrail')).toBe(false);
		expect(magmaCtx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(false);
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

	it('mana_leach dispatches spawnEtherSiphonEffect with violet accent colors at AoE radius', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'mana_leach',
			origin: { x: 1, z: 2 },
			radius: 4,
			hits: [],
		}, ctx);
		const siphon = ctx._calls.find((c) => c[0] === 'spawnEtherSiphonEffect');
		expect(siphon).toBeDefined();
		expect(siphon[1]).toEqual({ x: 1, z: 2 });
		expect(siphon[2]).toBe(4);
		expect(siphon[3]).toMatchObject({ color: 0xa855f7, emissive: 0x9333ea });
	});

	it('mana_leach fires telegraph ring and cast burst synchronously (no scheduleAfter)', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'mana_leach',
			origin: { x: 1, z: 2 },
			radius: 4,
			hits: [],
		}, ctx);
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[1]).toEqual({ x: 1, z: 2 });
		expect(ring[2]).toBe(4);
		expect(ring[3]).toMatchObject({ color: 0xa855f7, emissive: 0x9333ea });
		const burst = ctx._calls.find(
			(c) => c[0] === 'spawnParticleBurst' && c[2].count === 16,
		);
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 1, z: 2 });
		expect(burst[2]).toMatchObject({ color: 0xa855f7, emissive: 0x9333ea, spread: 2.2 });
		expect(ctx._calls.some((c) => c[0] === 'scheduleAfter')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
	});

	it('mana_leach spawns immediate per-hit drain arcs and sparks at enemy mesh positions', () => {
		const ctx = makeCtx({
			enemyMeshes: () => ({
				e1: { position: { x: 4, y: 0, z: 2 } },
				e2: { position: { x: 7, y: 0, z: 2 } },
			}),
		});
		renderCardUsed({
			cardId: 'mana_leach',
			origin: { x: 1, z: 2 },
			radius: 4,
			hits: [{ enemyId: 'e1' }, { enemyId: 'e2' }, { enemyId: 'missing' }],
		}, ctx);
		const arcs = ctx._calls.filter((c) => c[0] === 'spawnLightningArc');
		expect(arcs).toHaveLength(2);
		expect(arcs[0][1]).toEqual({ x: 4, y: 0.6, z: 2 });
		expect(arcs[0][2]).toEqual({ x: 1, z: 2 });
		expect(arcs[0][3]).toMatchObject({
			color: 0xa855f7,
			emissive: 0x9333ea,
			duration: ATTACK_EFFECT_DURATION,
		});
		expect(arcs[1][1]).toEqual({ x: 7, y: 0.6, z: 2 });
		const hitSparks = ctx._calls.filter((c) => c[0] === 'spawnHitSpark');
		expect(hitSparks).toHaveLength(2);
		expect(hitSparks[0][1]).toEqual({ x: 4, y: 0.6, z: 2 });
		const hitBursts = ctx._calls.filter(
			(c) => c[0] === 'spawnParticleBurst' && c[2].count === 6,
		);
		expect(hitBursts).toHaveLength(2);
		expect(hitBursts[0][1]).toEqual({ x: 4, y: 0.6, z: 2 });
		expect(ctx._calls.some((c) => c[0] === 'scheduleAfter')).toBe(false);
	});

	it('mana_leach spawns a magic-stone absorption flourish at the caster origin', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'mana_leach',
			origin: { x: 1, z: 2 },
			radius: 4,
			magicStonesGained: 2,
			hits: [],
		}, ctx);
		const absorbBurst = ctx._calls.find(
			(c) => c[0] === 'spawnParticleBurst' && c[2].count === 22,
		);
		expect(absorbBurst).toBeDefined();
		expect(absorbBurst[1]).toEqual({ x: 1, z: 2 });
		expect(absorbBurst[2]).toMatchObject({ color: 0xa855f7, emissive: 0x9333ea, spread: 2.6 });
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		expect(decal).toBeDefined();
		expect(decal[1]).toEqual({ x: 1, z: 2 });
		expect(decal[2]).toMatchObject({ color: 0xa855f7, emissive: 0x9333ea });
	});

	it('mana_leach has no positive windUpMs (instant cast; 315 charge telegraph absent)', () => {
		expect(CARD_DEFS.mana_leach).toBeDefined();
		expect(CARD_DEFS.mana_leach.windUpMs ?? 0).toBeLessThanOrEqual(0);
	});

	it('mana_leach, battle_familiar, and soul_drain produce distinct helper signatures for equivalent radial payloads', () => {
		const payload = {
			origin: { x: 0, z: 0 },
			radius: 4,
			hits: [],
		};
		const familiarCtx = makeCtx();
		resolveRenderers('battle_familiar')[0]({ ...payload, cardId: 'battle_familiar' }, familiarCtx);
		const leachCtx = makeCtx();
		resolveRenderers('mana_leach')[0]({ ...payload, cardId: 'mana_leach' }, leachCtx);
		const drainCtx = makeCtx();
		resolveRenderers('soul_drain')[0]({ ...payload, cardId: 'soul_drain' }, drainCtx);
		const familiarSig = methodsCalled(familiarCtx);
		const leachSig = methodsCalled(leachCtx);
		const drainSig = methodsCalled(drainCtx);
		expect(leachSig).not.toEqual(familiarSig);
		expect(leachSig).not.toEqual(drainSig);
		expect(leachSig).toContain('spawnEtherSiphonEffect');
		expect(familiarSig).not.toContain('spawnEtherSiphonEffect');
		expect(drainSig).not.toContain('spawnEtherSiphonEffect');
	});

	it('soul_drain adds pink drain telegraph, primary burst, per-hit tethers, and heal flourish decal', () => {
		const ctx = makeCtx({
			enemyMeshes: () => ({
				e1: { position: { x: 4, y: 1, z: 2 } },
				e2: { position: { x: 6, y: 0, z: -1 } },
			}),
		});
		renderCardUsed({
			cardId: 'soul_drain',
			origin: { x: 0, z: 0 },
			radius: 4,
			specialEffect: 'soul_drain',
			hpHealed: 12,
			hits: [{ enemyId: 'e1' }, { enemyId: 'e2' }, { enemyId: 'gone' }],
		}, ctx);
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[3]).toMatchObject({ color: 0xe879f9, emissive: 0xd946ef });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[2]).toMatchObject({ color: 0xe879f9, count: 14, spread: 2.4 });
		// One drain tether per hit-with-mesh, each ending at the cast origin; the
		// hit whose enemy has no mesh ('gone') is skipped.
		const tethers = ctx._calls.filter((c) => c[0] === 'spawnLightningArc');
		expect(tethers).toHaveLength(2);
		expect(tethers[0][1]).toEqual({ x: 4, y: 1, z: 2 });
		expect(tethers[0][2]).toEqual({ x: 0, z: 0 });
		expect(tethers[0][3]).toMatchObject({ color: 0xe879f9, emissive: 0xd946ef });
		expect(tethers[1][1]).toEqual({ x: 6, y: 0, z: -1 });
		expect(tethers[1][2]).toEqual({ x: 0, z: 0 });
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		expect(decal).toBeDefined();
		expect(decal[1]).toEqual({ x: 0, z: 0 });
		expect(decal[2]).toMatchObject({ color: 0xd946ef, emissive: 0xf0abfc });
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'playSound' && c[1] === 'heal')).toBe(false);
	});

	it('soul_drain skips the heal flourish when hpHealed is 0 or absent', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'soul_drain',
			origin: { x: 0, z: 0 },
			radius: 4,
			specialEffect: 'soul_drain',
			hpHealed: 0,
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnImpactDecal')).toBe(false);

		const ctxNoHeal = makeCtx();
		renderCardUsed({
			cardId: 'soul_drain',
			origin: { x: 0, z: 0 },
			radius: 4,
			specialEffect: 'soul_drain',
			hits: [],
		}, ctxNoHeal);
		expect(ctxNoHeal._calls.some((c) => c[0] === 'spawnImpactDecal')).toBe(false);
		expect(ctxNoHeal._calls.some((c) => c[0] === 'playSound' && c[1] === 'heal')).toBe(false);
	});

	it('arcane radial spells still render without throwing when new ctx primitives are absent', () => {
		const minimalCtx = makeCtx({
			spawnEtherSiphonEffect: undefined,
			spawnTelegraphRing: undefined,
			spawnParticleBurst: undefined,
			spawnImpactDecal: undefined,
			spawnLightningArc: undefined,
			enemyMeshes: undefined,
		});
		for (const cardId of ['battle_familiar', 'mana_leach', 'soul_drain']) {
			const ctx = { ...minimalCtx, _calls: [] };
			expect(() => renderCardUsed({
				cardId,
				origin: { x: 0, z: 0 },
				radius: 4,
				hpHealed: 8,
				hits: [{ enemyId: 'e1' }],
			}, ctx)).not.toThrow();
		}
	});

	it('frost_nova composes an icy shockwave ring, denser radial shard burst, and frozen impact decal at the origin', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'frost_nova',
			origin: { x: 2, z: 3 },
			radius: 4,
			hits: [],
		}, ctx);
		// Expanding frost shockwave ring sized to the radius.
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[1]).toEqual({ x: 2, z: 3 });
		expect(ring[2]).toBe(4);
		expect(ring[3]).toMatchObject({ color: 0x67e8f9, emissive: 0x38bdf8 });
		// Dense radial ice-shard burst — denser/wider than the old count:14, spread:2.0.
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 2, z: 3 });
		expect(burst[2]).toMatchObject({ color: 0x67e8f9, emissive: 0x38bdf8 });
		expect(burst[2].count).toBeGreaterThan(14);
		expect(burst[2].spread).toBeGreaterThan(2.0);
		// Frozen ground impact decal at the cast origin.
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		expect(decal).toBeDefined();
		expect(decal[1]).toEqual({ x: 2, z: 3 });
		expect(decal[2]).toMatchObject({ color: 0x67e8f9, emissive: 0x38bdf8 });
		// Stays distinct from the generic summon / glacier_collapse look.
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
	});

	it('frost_nova spawns a lingering frost field timed to the 2.5s freeze when the payload is frozen', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'frost_nova',
			origin: { x: 2, z: 3 },
			radius: 4,
			frozen: true,
			specialEffect: 'freeze',
			hits: [],
		}, ctx);
		const decals = ctx._calls.filter((c) => c[0] === 'spawnImpactDecal');
		// The lingering frost field is a decal sized to the radius whose lifetime
		// equals the 2500ms server freeze window (not the default impact lifetime).
		const linger = decals.find((c) => c[2]?.duration === 2500);
		expect(linger).toBeDefined();
		expect(linger[1]).toEqual({ x: 2, z: 3 });
		expect(linger[2]).toMatchObject({
			color: 0x67e8f9,
			emissive: 0x38bdf8,
			radius: 4,
			duration: 2500,
		});
		// Same frost palette as the cast burst.
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring[3]).toMatchObject({ color: 0x67e8f9, emissive: 0x38bdf8 });
		// Everything fires synchronously — no async scheduling.
		expect(ctx._calls.some((c) => c[0] === 'scheduleAfter')).toBe(false);
		expect(ctx._scheduled).toHaveLength(0);
	});

	it('frost_nova does not spawn the lingering frost field when the payload is not frozen, but the cast burst still fires', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'frost_nova',
			origin: { x: 2, z: 3 },
			radius: 4,
			hits: [],
		}, ctx);
		// No lingering (2.5s) decal without the freeze flag.
		expect(ctx._calls.filter((c) => c[0] === 'spawnImpactDecal')
			.some((c) => c[2]?.duration === 2500)).toBe(false);
		// The immediate cast burst still fires regardless of the freeze gate.
		expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'spawnParticleBurst')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'spawnImpactDecal')).toBe(true);
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

	it('glacier_collapse dispatches the polished rupture primitive, telegraph, decal, and radial burst synchronously', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'glacier_collapse',
			origin: { x: 1, z: 2 },
			radius: 5,
			hits: [],
		}, ctx);
		const rupture = ctx._calls.find((c) => c[0] === 'spawnGlacierRuptureEffect');
		expect(rupture).toBeDefined();
		expect(rupture[1]).toEqual({ x: 1, z: 2 });
		expect(rupture[2]).toBe(5);
		expect(rupture[3]).toEqual({ color: 0x38bdf8, emissive: 0x0ea5e9 });
		const telegraph = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(telegraph).toBeDefined();
		expect(telegraph[1]).toEqual({ x: 1, z: 2 });
		expect(telegraph[2]).toBe(5);
		expect(telegraph[3]).toEqual({ color: 0x38bdf8, emissive: 0x0ea5e9 });
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		expect(decal).toBeDefined();
		expect(decal[1]).toEqual({ x: 1, z: 2 });
		expect(decal[2]).toEqual({ color: 0x38bdf8, emissive: 0x0ea5e9 });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 1, z: 2 });
		expect(burst[2]).toMatchObject({ color: 0x38bdf8, emissive: 0x0ea5e9, count: 16, spread: 2.4 });
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'scheduleAfter')).toBe(false);
	});

	it('glacier_collapse spawns a per-hit shatter burst at the enemy mesh position', () => {
		const meshes = { e1: { position: { x: 3, y: 0, z: 4 } } };
		const ctx = makeCtx({ enemyMeshes: () => meshes });
		renderCardUsed({
			cardId: 'glacier_collapse',
			origin: { x: 0, z: 0 },
			radius: 5,
			hits: [{ enemyId: 'e1' }],
		}, ctx);
		const hitPos = { x: 3, y: 0.6, z: 4 };
		const hitSpark = ctx._calls.find((c) => c[0] === 'spawnHitSpark' && c[1].x === 3);
		const hitBurst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst' && c[1].x === 3);
		expect(hitSpark ?? hitBurst).toBeDefined();
		if (hitSpark) {
			expect(hitSpark[1]).toEqual(hitPos);
			expect(hitSpark[2]).toMatchObject({ color: 0x38bdf8, emissive: 0x0ea5e9 });
		}
		if (hitBurst) {
			expect(hitBurst[1]).toEqual(hitPos);
			expect(hitBurst[2]).toMatchObject({ color: 0x38bdf8, emissive: 0x0ea5e9 });
		}
	});

	it('glacier_collapse uses a larger shatter burst for frozenShatter hits than normal freeze hits', () => {
		const meshes = { e1: { position: { x: 1, y: 0, z: 1 } } };
		const normalCtx = makeCtx({ enemyMeshes: () => meshes });
		renderCardUsed({
			cardId: 'glacier_collapse',
			origin: { x: 0, z: 0 },
			radius: 5,
			hits: [{ enemyId: 'e1' }],
		}, normalCtx);
		const shatterCtx = makeCtx({ enemyMeshes: () => meshes });
		renderCardUsed({
			cardId: 'glacier_collapse',
			origin: { x: 0, z: 0 },
			radius: 5,
			hits: [{ enemyId: 'e1', frozenShatter: true }],
		}, shatterCtx);
		const normalBurst = normalCtx._calls.find((c) => c[0] === 'spawnParticleBurst' && c[1].x === 1);
		const shatterBurst = shatterCtx._calls.find((c) => c[0] === 'spawnParticleBurst' && c[1].x === 1);
		expect(normalBurst).toBeDefined();
		expect(shatterBurst).toBeDefined();
		expect(shatterBurst[2].count).toBeGreaterThan(normalBurst[2].count);
		expect(shatterBurst[2].spread).toBeGreaterThan(normalBurst[2].spread);
	});

	it('glacier_collapse and frost_nova resolve to different renderer functions and helper signatures', () => {
		expect(resolveRenderers('glacier_collapse')[0]).not.toBe(resolveRenderers('frost_nova')[0]);
		const payload = {
			origin: { x: 0, z: 0 },
			radius: 6,
			hits: [],
		};
		const glacierCtx = makeCtx();
		resolveRenderers('glacier_collapse')[0]({ ...payload, cardId: 'glacier_collapse' }, glacierCtx);
		const novaCtx = makeCtx();
		resolveRenderers('frost_nova')[0]({ ...payload, cardId: 'frost_nova' }, novaCtx);
		expect(methodsCalled(glacierCtx)).not.toEqual(methodsCalled(novaCtx));
		expect(glacierCtx._calls.some((c) => c[0] === 'spawnGlacierRuptureEffect')).toBe(true);
		expect(novaCtx._calls.some((c) => c[0] === 'spawnGlacierRuptureEffect')).toBe(false);
	});

	it('Glacier Collapse carries windUpMs 700 so the 307/315 charge telegraph fires during wind-up', () => {
		expect(getCardDef('glacier_collapse')).toBeDefined();
		expect(getCardDef('glacier_collapse').windUpMs).toBe(700);
	});

	it('glacier_collapse degrades gracefully when optional ctx primitives are absent', () => {
		const ctx = makeCtx({
			spawnGlacierRuptureEffect: undefined,
			spawnTelegraphRing: undefined,
			spawnImpactDecal: undefined,
			spawnParticleBurst: undefined,
			spawnHitSpark: undefined,
			enemyMeshes: undefined,
		});
		expect(() => renderCardUsed({
			cardId: 'glacier_collapse',
			origin: { x: 0, z: 0 },
			radius: 5,
			hits: [{ enemyId: 'e1' }],
		}, ctx)).not.toThrow();
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

	it('healing_font spawns the emerald beacon effect (column + heal ring + motes) without divine grace', () => {
		const ctx = makeCtx({ myId: 'me' });
		renderCardUsed({
			cardId: 'healing_font',
			origin: { x: 0, z: 0 },
			radius: 3,
			hpGained: 6,
			playerId: 'me',
			hits: [],
		}, ctx);
		const beacon = ctx._calls.find((c) => c[0] === 'spawnRestorationBeaconEffect');
		expect(beacon).toBeDefined();
		expect(beacon[1]).toEqual({ x: 0, z: 0 });
		expect(beacon[2]).toBe(3);
		// Restoration Beacon must not reuse Sanctum Pulse's gold sanctum effect.
		expect(ctx._calls.some((c) => c[0] === 'spawnDivineGraceEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'playSound' && c[1] === 'heal')).toBe(true);
	});

	it('healing_font does not throw when optional ctx spawners are absent', () => {
		const ctx = makeCtx({ myId: 'me' });
		// Strip the optional spawners the beacon path guards for.
		ctx.spawnRestorationBeaconEffect = undefined;
		ctx.spawnParticleBurst = undefined;
		expect(() => renderCardUsed({
			cardId: 'healing_font',
			origin: { x: 0, z: 0 },
			radius: 3,
			hpGained: 6,
			playerId: 'me',
			hits: [],
		}, ctx)).not.toThrow();
		// Heal sound still gated to the local caster.
		expect(ctx._calls.some((c) => c[0] === 'playSound' && c[1] === 'heal')).toBe(true);
	});

	it('healing_font does not play the heal sound for a non-caster', () => {
		const ctx = makeCtx({ myId: 'me' });
		renderCardUsed({
			cardId: 'healing_font',
			origin: { x: 0, z: 0 },
			radius: 3,
			hpGained: 6,
			playerId: 'someone-else',
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnRestorationBeaconEffect')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'playSound' && c[1] === 'heal')).toBe(false);
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
		expect(ctx._calls.some((c) => c[0] === 'spawnRestorationBeaconEffect')).toBe(false);
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
		// Purifying pulse pulses outward via >=2 heal waves plus a distinct rise.
		expect(pulseHelpers.filter((h) => h === 'spawnPurifyingPulseHealRing').length).toBeGreaterThanOrEqual(2);
		expect(pulseHelpers).toContain('spawnCleanseBurstEffect');
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

	it('purifying_pulse pulses outward via >=2 staggered heal waves plus a cleanse rise', () => {
		// setTimeout is spied to prove the multi-wave sequence is synchronous — the
		// server resolves heal_and_cleanse instantly, so no timer-based travel delay.
		const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
		const ctx = makeCtx({ myId: 'me' });
		renderCardUsed({
			cardId: 'purifying_pulse',
			origin: { x: 2, z: 3 },
			radius: 5.5,
			playerId: 'me',
			specialEffect: 'heal_and_cleanse',
			hits: [],
		}, ctx);
		const healRings = ctx._calls.filter((c) => c[0] === 'spawnPurifyingPulseHealRing');
		// At least two concentric waves so the effect visibly pulses outward.
		expect(healRings.length).toBeGreaterThanOrEqual(2);
		// Every wave fires at the cast origin and expands to the card radius; the
		// waves are staggered (distinct, increasing wave indices), not identical.
		for (const ring of healRings) {
			expect(ring[1]).toEqual({ x: 2, z: 3 });
			expect(ring[2]).toBe(5.5);
		}
		const waveIndices = healRings.map((c) => c[3]?.wave);
		expect(new Set(waveIndices).size).toBe(healRings.length);
		expect(Math.max(...waveIndices)).toBe(healRings.length - 1);
		// Distinct upward cleanse rise, separate from the ground rings.
		const cleanse = ctx._calls.find((c) => c[0] === 'spawnCleanseBurstEffect');
		expect(cleanse).toBeDefined();
		expect(cleanse[1]).toEqual({ x: 2, z: 3 });
		// Heal cue plays for the caster, all synchronously (no setTimeout).
		expect(ctx._calls.some((c) => c[0] === 'playSound' && c[1] === 'heal')).toBe(true);
		expect(timeoutSpy).not.toHaveBeenCalled();
		timeoutSpy.mockRestore();
	});

	it('purifying_pulse never emits Divine Grace gold', () => {
		const ctx = makeCtx({ myId: 'me' });
		renderCardUsed({
			cardId: 'purifying_pulse',
			origin: { x: 0, z: 0 },
			radius: 4,
			playerId: 'me',
			hits: [],
		}, ctx);
		// The purifying renderer never reaches for Divine Grace's sanctum effect or
		// its gold particle palette.
		expect(ctx._calls.some((c) => c[0] === 'spawnDivineGraceEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnParticleBurst' && (c[2]?.color === 0xfde68a || c[2]?.emissive === 0xfbbf24))).toBe(false);
	});

	it('purifying_pulse heal cue is local-only: caster or a healed target, not a spectator', () => {
		// Caster hears it.
		const casterCtx = makeCtx({ myId: 'me' });
		renderCardUsed({
			cardId: 'purifying_pulse', origin: { x: 0, z: 0 }, radius: 4,
			playerId: 'me', hits: [],
		}, casterCtx);
		expect(casterCtx._calls.some((c) => c[0] === 'playSound' && c[1] === 'heal')).toBe(true);

		// A healed (but non-casting) target hears it.
		const healedCtx = makeCtx({ myId: 'me' });
		renderCardUsed({
			cardId: 'purifying_pulse', origin: { x: 0, z: 0 }, radius: 4,
			playerId: 'someone-else',
			healedTargets: [{ playerId: 'me', hpGained: 6, cleansed: true }],
			hits: [],
		}, healedCtx);
		expect(healedCtx._calls.some((c) => c[0] === 'playSound' && c[1] === 'heal')).toBe(true);

		// A pure spectator (not caster, not in healedTargets) does NOT hear it, but
		// the VFX still play for them.
		const spectatorCtx = makeCtx({ myId: 'me' });
		renderCardUsed({
			cardId: 'purifying_pulse', origin: { x: 0, z: 0 }, radius: 4,
			playerId: 'someone-else',
			healedTargets: [{ playerId: 'other', hpGained: 6, cleansed: true }],
			hits: [],
		}, spectatorCtx);
		expect(spectatorCtx._calls.some((c) => c[0] === 'spawnPurifyingPulseHealRing')).toBe(true);
		expect(spectatorCtx._calls.some((c) => c[0] === 'spawnCleanseBurstEffect')).toBe(true);
		expect(spectatorCtx._calls.some((c) => c[0] === 'playSound' && c[1] === 'heal')).toBe(false);
	});

	it('purifying_pulse skips VFX and sound when radius is absent', () => {
		const ctx = makeCtx({ myId: 'me' });
		renderCardUsed({
			cardId: 'purifying_pulse',
			origin: { x: 0, z: 0 },
			playerId: 'me',
			healedTargets: [{ playerId: 'me', hpGained: 6, cleansed: true }],
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnPurifyingPulseHealRing')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnCleanseBurstEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'playSound' && c[1] === 'heal')).toBe(false);
	});

	it('gravity_well resolves to a single bespoke renderer', () => {
		const renderers = resolveRenderers('gravity_well');
		expect(renderers).toHaveLength(1);
		expect(renderers[0].name).toBe('renderGravityWell');
	});

	it('gravity_well fires spawnGravityWellEffect and center impact synchronously at t=0', () => {
		const origin = { x: 1, z: 2 };
		const enemyMeshes = () => ({
			e1: { position: { x: 5, y: 0.6, z: 0 } },
			e2: { position: { x: -3, y: 0.6, z: 2 } },
		});
		const ctx = makeCtx({ enemyMeshes });
		renderCardUsed({
			cardId: 'gravity_well',
			origin,
			radius: 12,
			pulled: [{ enemyId: 'e1' }, { enemyId: 'e2' }, { enemyId: 'gone' }],
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'scheduleAfter')).toBe(false);
		const pull = ctx._calls.find((c) => c[0] === 'spawnGravityWellEffect');
		expect(pull).toBeDefined();
		expect(pull[1]).toEqual(origin);
		expect(pull[2]).toBe(12);
		expect(pull[3]).toMatchObject({
			color: 0xc084fc,
			emissive: 0xa855f7,
			duration: ATTACK_EFFECT_DURATION,
		});
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		expect(decal).toBeDefined();
		expect(decal[1]).toEqual(origin);
		expect(decal[2]).toMatchObject({ color: 0xc084fc, emissive: 0xa855f7 });
		const streaks = ctx._calls.filter((c) => c[0] === 'spawnLightningArc');
		expect(streaks).toHaveLength(2);
		expect(streaks[0][1]).toEqual({ x: 5, y: 0.6, z: 0 });
		expect(streaks[0][2]).toEqual(origin);
		expect(streaks[0][3]).toMatchObject({
			color: 0xc084fc,
			emissive: 0xa855f7,
			duration: 320,
		});
		expect(streaks[1][1]).toEqual({ x: -3, y: 0.6, z: 2 });
		expect(streaks[1][2]).toEqual(origin);
		expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnParticleBurst')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
	});

	it('gravity_well fires no per-enemy pull arcs when pulled is empty or absent', () => {
		const origin = { x: 1, z: 2 };
		const enemyMeshes = () => ({
			e1: { position: { x: 5, y: 0.6, z: 0 } },
		});
		for (const pulled of [[], undefined]) {
			const ctx = makeCtx({ enemyMeshes });
			const payload = {
				cardId: 'gravity_well',
				origin,
				radius: 12,
				hits: [],
			};
			if (pulled !== undefined) payload.pulled = pulled;
			renderCardUsed(payload, ctx);
			expect(ctx._calls.some((c) => c[0] === 'spawnLightningArc')).toBe(false);
			expect(ctx._calls.some((c) => c[0] === 'spawnGravityWellEffect')).toBe(true);
			expect(ctx._calls.some((c) => c[0] === 'spawnImpactDecal')).toBe(true);
		}
	});

	it('gravity_well has no positive windUpMs (instant cast; no 307 charge telegraph expected)', () => {
		expect(CARD_DEFS.gravity_well.windUpMs ?? 0).toBeLessThanOrEqual(0);
	});

	it('gravity_well skips VFX when radius is absent', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'gravity_well',
			origin: { x: 0, z: 0 },
			pulled: [{ enemyId: 'e1' }],
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnGravityWellEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnImpactDecal')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnLightningArc')).toBe(false);
	});

	it('gravity_well still renders without throwing when the new ctx primitives are absent', () => {
		const ctx = makeCtx({
			spawnGravityWellEffect: undefined,
			spawnImpactDecal: undefined,
			spawnLightningArc: undefined,
			enemyMeshes: undefined,
		});
		expect(() => renderCardUsed({
			cardId: 'gravity_well',
			origin: { x: 0, z: 0 },
			radius: 12,
			pulled: [{ enemyId: 'e1' }],
			hits: [],
		}, ctx)).not.toThrow();
	});

	it('event_horizon invokes spawnEventHorizonEffect synchronously with pull/center radii and palette', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'event_horizon',
			origin: { x: 0, z: 0 },
			radius: 12,
			centerRadius: 2.5,
			hits: [],
		}, ctx);
		const singularity = ctx._calls.find((c) => c[0] === 'spawnEventHorizonEffect');
		expect(singularity).toBeDefined();
		expect(singularity[1]).toEqual({ x: 0, z: 0 });
		expect(singularity[2]).toBe(12);
		expect(singularity[3]).toBe(2.5);
		expect(singularity[4]).toMatchObject({ color: 0x581c87, emissive: 0x7c3aed });
		expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing' && c[2] === 12)).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
	});

	it('event_horizon schedules crush impact via EVENT_HORIZON_CRUSH_DELAY_MS', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'event_horizon',
			origin: { x: 1, z: 2 },
			radius: 12,
			centerRadius: 2.5,
			hits: [],
		}, ctx);
		const schedules = ctx._calls.filter((c) => c[0] === 'scheduleAfter');
		expect(schedules).toHaveLength(1);
		expect(schedules[0][1]).toBe(EVENT_HORIZON_CRUSH_DELAY_MS);
		expect(ctx._calls.some((c) => c[0] === 'spawnImpactDecal')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing' && c[2] === 2.5)).toBe(false);
		ctx.runScheduled();
		const decal = ctx._calls.find((c) => c[0] === 'spawnImpactDecal');
		expect(decal).toBeDefined();
		expect(decal[1]).toEqual({ x: 1, z: 2 });
		expect(decal[2]).toMatchObject({ color: 0x581c87, emissive: 0x7c3aed });
		const crushRing = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing' && c[2] === 2.5);
		expect(crushRing).toBeDefined();
		expect(crushRing[1]).toEqual({ x: 1, z: 2 });
		const crushBurst = ctx._calls.find(
			(c) => c[0] === 'spawnParticleBurst' && c[1].x === 1 && c[2].count === 10,
		);
		expect(crushBurst).toBeDefined();
	});

	it('event_horizon is visually distinct from gravity_well (no bare outer telegraph without singularity)', () => {
		const horizonCtx = makeCtx();
		renderCardUsed({
			cardId: 'event_horizon',
			origin: { x: 0, z: 0 },
			radius: 12,
			centerRadius: 2.5,
			hits: [],
		}, horizonCtx);
		const wellCtx = makeCtx();
		renderCardUsed({
			cardId: 'gravity_well',
			origin: { x: 0, z: 0 },
			radius: 12,
			pulled: 1,
			hits: [],
		}, wellCtx);
		expect(horizonCtx._calls.some((c) => c[0] === 'spawnEventHorizonEffect')).toBe(true);
		expect(wellCtx._calls.some((c) => c[0] === 'spawnEventHorizonEffect')).toBe(false);
		expect(wellCtx._calls.some((c) => c[0] === 'spawnGravityWellEffect' && c[2] === 12)).toBe(true);
		expect(horizonCtx._calls.some((c) => c[0] === 'spawnGravityWellEffect')).toBe(false);
		expect(wellCtx._calls.some((c) => c[0] === 'spawnTelegraphRing' && c[2] === 12)).toBe(false);
		expect(horizonCtx._calls.some((c) => c[0] === 'spawnTelegraphRing' && c[2] === 12)).toBe(false);
		wellCtx.runScheduled();
		horizonCtx.runScheduled();
		expect(wellCtx._calls.some((c) => c[0] === 'spawnTelegraphRing' && c[2] === 2.5)).toBe(false);
		expect(horizonCtx._calls.some((c) => c[0] === 'spawnTelegraphRing' && c[2] === 2.5)).toBe(true);
	});

	it('event_horizon spawns per-hit crush bursts at enemy mesh positions', () => {
		const ctx = makeCtx({
			enemyMeshes: () => ({
				e1: { position: { x: 4, y: 0, z: 2 } },
				e2: { position: { x: 7, y: 0, z: 2 } },
			}),
		});
		renderCardUsed({
			cardId: 'event_horizon',
			origin: { x: 1, z: 2 },
			radius: 12,
			centerRadius: 2.5,
			crushed: [{ enemyId: 'e1' }, { enemyId: 'e2' }, { enemyId: 'missing' }],
		}, ctx);
		const hitSparks = ctx._calls.filter((c) => c[0] === 'spawnHitSpark');
		expect(hitSparks).toHaveLength(2);
		expect(hitSparks[0][1]).toEqual({ x: 4, y: 0.6, z: 2 });
		expect(hitSparks[1][1]).toEqual({ x: 7, y: 0.6, z: 2 });
		expect(hitSparks[0][2]).toMatchObject({ color: 0x581c87, emissive: 0x7c3aed, count: 5 });
		const crushBursts = ctx._calls.filter(
			(c) => c[0] === 'spawnParticleBurst' && c[2].count === 6,
		);
		expect(crushBursts).toHaveLength(2);
		expect(crushBursts[0][1]).toEqual({ x: 4, y: 0.6, z: 2 });
		expect(crushBursts[1][1]).toEqual({ x: 7, y: 0.6, z: 2 });
	});

	it('event_horizon has no positive windUpMs (instant cast; 315 charge telegraph absent)', () => {
		expect(CARD_DEFS.event_horizon).toBeDefined();
		expect(CARD_DEFS.event_horizon.windUpMs ?? 0).toBeLessThanOrEqual(0);
	});

	it('event_horizon skips VFX when radius is absent', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'event_horizon',
			origin: { x: 0, z: 0 },
			centerRadius: 2.5,
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnEventHorizonEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'scheduleAfter')).toBe(false);
	});

	it('event_horizon still renders without throwing when optional ctx primitives are absent', () => {
		const ctx = makeCtx({
			spawnEventHorizonEffect: undefined,
			spawnImpactDecal: undefined,
			spawnParticleBurst: undefined,
			spawnTelegraphRing: undefined,
			spawnHitSpark: undefined,
		});
		expect(() => renderCardUsed({
			cardId: 'event_horizon',
			origin: { x: 0, z: 0 },
			radius: 12,
			centerRadius: 2.5,
			hits: [{ enemyId: 'e1' }],
		}, ctx)).not.toThrow();
		expect(ctx._calls.filter((c) => c[0] === 'scheduleAfter').map((c) => c[1])).toEqual([
			EVENT_HORIZON_CRUSH_DELAY_MS,
		]);
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
		const prism = ctx._calls.find((c) => c[0] === 'spawnManaPrismEffect');
		expect(prism).toBeDefined();
		expect(prism[1]).toEqual({ x: 1, z: 2 });
		expect(prism[2]).toMatchObject({ color: 0xa855f7, emissive: 0x22d3ee });
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

	it('mana_prism schedules six stone-emission pulses at the server cadence (2000ms over 12s)', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'mana_prism',
			origin: { x: 1, z: 2 },
			radius: 1,
			hits: [],
		}, ctx);
		// Pulse count and interval are derived from CARD_DEFS.mana_prism, so the
		// telegraph stays locked to the server addMagicStones cadence.
		const delays = ctx._calls.filter((c) => c[0] === 'scheduleAfter').map((c) => c[1]);
		expect(delays).toEqual([2000, 4000, 6000, 8000, 10000, 12000]);
	});

	it('mana_prism each scheduled pulse emits a distinct stone-gain ring + upward burst', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'mana_prism',
			origin: { x: 1, z: 2 },
			radius: 1,
			hits: [],
		}, ctx);
		// Before the timers fire only the initial cast flourish has rendered.
		const ringsBefore = ctx._calls.filter((c) => c[0] === 'spawnTelegraphRing').length;
		const burstsBefore = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst').length;
		expect(ringsBefore).toBe(1);
		expect(burstsBefore).toBe(1);

		ctx.runScheduled();

		// Each of the six pulses adds one small ring + one cyan-cored mote burst.
		const pulseRings = ctx._calls
			.filter((c) => c[0] === 'spawnTelegraphRing')
			.slice(ringsBefore);
		const pulseBursts = ctx._calls
			.filter((c) => c[0] === 'spawnParticleBurst')
			.slice(burstsBefore);
		expect(pulseRings).toHaveLength(6);
		expect(pulseBursts).toHaveLength(6);
		expect(pulseRings[0][1]).toEqual({ x: 1, z: 2 });
		expect(pulseRings[0][2]).toBe(0.9);
		expect(pulseRings[0][3]).toMatchObject({ color: 0xa855f7, emissive: 0x22d3ee });
		expect(pulseBursts[0][2]).toMatchObject({
			color: 0x22d3ee,
			emissive: 0xa855f7,
			count: 8,
			spread: 0.8,
		});
	});

	it('mana_prism pulse schedule no-ops gracefully when scheduleAfter and spawn primitives are absent', () => {
		const ctx = makeCtx({
			scheduleAfter: undefined,
			spawnTelegraphRing: undefined,
			spawnParticleBurst: undefined,
			spawnManaPrismEffect: undefined,
		});
		expect(() => renderCardUsed({
			cardId: 'mana_prism',
			origin: { x: 0, z: 0 },
			radius: 1,
			hits: [],
		}, ctx)).not.toThrow();
		expect(ctx._calls.some((c) => c[0] === 'scheduleAfter')).toBe(false);
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

	it('chrono_trigger fires spawnChronoTriggerEffect at cast with amber/cyan palette', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'chrono_trigger',
			origin: { x: 3, z: 4 },
			restoredCharges: [],
			hits: [],
		}, ctx);
		const ripple = ctx._calls.find((c) => c[0] === 'spawnChronoTriggerEffect');
		expect(ripple).toBeDefined();
		expect(ripple[1]).toEqual({ x: 3, z: 4 });
		expect(ripple[2]).toBe(2);
		expect(ripple[3]).toMatchObject({ color: 0xf59e0b, emissive: 0x67e8f9 });
		expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
	});

	it('chrono_trigger no-ops when origin is absent', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'chrono_trigger',
			restoredCharges: [{ slotIndex: 0, cardId: 'iron_sword', amount: 2 }],
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnChronoTriggerEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnParticleBurst')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnLightningArc')).toBe(false);
	});

	it('utility spells still render without throwing when new ctx primitives are absent', () => {
		const minimalCtx = makeCtx({
			spawnTelegraphRing: undefined,
			spawnParticleBurst: undefined,
			spawnManaPrismEffect: undefined,
		});
		for (const payload of [
			{ cardId: 'astral_guardian', origin: { x: 0, z: 0 }, radius: 4, hits: [] },
			{ cardId: 'mana_prism', origin: { x: 0, z: 0 }, radius: 1, hits: [] },
			{ cardId: 'sacrificial_altar', origin: { x: 0, z: 0 }, radius: 10, hits: [] },
			{ cardId: 'chrono_trigger', origin: { x: 0, z: 0 }, restoredCharges: [], hits: [] },
		]) {
			const ctx = { ...minimalCtx, _calls: [] };
			expect(() => renderCardUsed(payload, ctx)).not.toThrow();
		}
	});
});

describe('renderCardUsed() — creature dispatch', () => {
	it('battery_automaton summon uses battery palette, deploy effect, and no scheduleAfter deferral', () => {
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
		expect(summon[2]).toMatchObject({
			color: 0xfbbf24,
			emissive: 0x38bdf8,
			radius: 1.1,
			burstCount: 10,
		});
		expect(summon[2].color).not.toBe(0x22c55e);
		const deploy = ctx._calls.find((c) => c[0] === 'spawnBatteryAutomatonDeployEffect');
		expect(deploy).toBeDefined();
		expect(deploy[1]).toEqual({ x: 2, z: 3 });
		expect(deploy[2]).toMatchObject({
			color: 0xfbbf24,
			emissive: 0x38bdf8,
			radius: 1.4,
			duration: MINION_SUMMON_IN_MS,
		});
		expect(ctx._calls.some((c) => c[0] === 'scheduleAfter')).toBe(false);
		expect(methodsCalled(ctx)).toContain('playSound');
	});

	it('battery_automaton summon without minionId stays sound-only (no deploy or summon flourish)', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'battery_automaton',
			origin: { x: 0, z: 0 },
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnBatteryAutomatonDeployEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnMinionSummonInEffect')).toBe(false);
		expect(methodsCalled(ctx)).toEqual(['playSound']);
	});

	it('battery_automaton summon degrades gracefully when spawnBatteryAutomatonDeployEffect is absent', () => {
		const ctx = makeCtx({ spawnBatteryAutomatonDeployEffect: undefined });
		expect(() => renderCardUsed({
			cardId: 'battery_automaton',
			origin: { x: 1, z: 2 },
			minionId: 'minion-2',
			hits: [],
		}, ctx)).not.toThrow();
		expect(ctx._calls.some((c) => c[0] === 'spawnBatteryAutomatonDeployEffect')).toBe(false);
		expect(ctx._calls.filter((c) => c[0] === 'spawnMinionSummonInEffect')).toHaveLength(1);
		const summon = ctx._calls.find((c) => c[0] === 'spawnMinionSummonInEffect');
		expect(summon[2]).toMatchObject({ color: 0xfbbf24, emissive: 0x38bdf8 });
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
		const fireTrail = ctx._calls.find((c) => c[0] === 'spawnFireTrailEffect');
		expect(fireTrail).toBeDefined();
		expect(fireTrail[3]).toMatchObject({
			color: 0xef4444,
			emissive: 0x9333ea,
			range: 8,
			coneAngle: Math.PI / 3,
		});
		const projectileTrail = ctx._calls.find((c) => c[0] === 'spawnProjectileTrail');
		expect(projectileTrail).toBeDefined();
		expect(projectileTrail[3]).toMatchObject({
			color: 0xef4444,
			emissive: 0x9333ea,
			range: 8,
			y: 0.8,
		});
		expect(ctx._calls.filter((c) => c[0] === 'spawnHitSpark')).toHaveLength(1);
		const schedules = ctx._calls.filter((c) => c[0] === 'scheduleAfter').map((c) => c[1]);
		expect(schedules).toHaveLength(ARCHIVE_WYRM_BREATH_TICK_COUNT);
		expect(schedules).toEqual(
			Array.from({ length: ARCHIVE_WYRM_BREATH_TICK_COUNT }, (_, i) => ARCHIVE_WYRM_BREATH_TICK_MS * (i + 1)),
		);
	});

	describe('ancient_wyrm', () => {
		it('breath start uses server breath duration and schedules mid-channel tick pulses', () => {
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
				attackRange: 10,
				attackConeAngle: Math.PI / 3,
				breathPhase: 'start',
				breathDurationMs: ARCHIVE_WYRM_BREATH_DURATION_MS,
				hits: [{ enemyId: 'e1', hp: 46 }],
			}, ctx);
			const attacks = ctx._calls.filter((c) => c[0] === 'spawnAttackEffect');
			expect(attacks).toHaveLength(1);
			expect(attacks[0][3].duration).toBe(ARCHIVE_WYRM_BREATH_DURATION_MS);
			const schedules = ctx._calls.filter((c) => c[0] === 'scheduleAfter').map((c) => c[1]);
			expect(schedules).toEqual([500, 1000, 1500, 2000]);
		});

		it('breath tick emits hit feedback only (no cone or scheduled pulses)', () => {
			const ctx = makeCtx({
				enemyMeshes: () => ({
					e1: { position: { x: 2, y: 0.5, z: 3 } },
				}),
			});
			renderCardUsed({
				cardId: 'ancient_wyrm',
				specialEffect: 'fire_breath',
				origin: { x: 1, z: 2 },
				direction: { x: 0, z: 1 },
				attackRange: 10,
				attackConeAngle: Math.PI / 3,
				breathPhase: 'tick',
				breathDurationMs: ARCHIVE_WYRM_BREATH_DURATION_MS,
				hits: [{ enemyId: 'e1', hp: 44 }],
			}, ctx);
			expect(ctx._calls.filter((c) => c[0] === 'spawnAttackEffect')).toHaveLength(0);
			expect(ctx._calls.filter((c) => c[0] === 'scheduleAfter')).toHaveLength(0);
			expect(ctx._calls.filter((c) => c[0] === 'spawnHitSpark')).toHaveLength(1);
		});

		it('getCardDef documents server breath timing contract (no deploy wind-up)', () => {
			const def = getCardDef('ancient_wyrm');
			expect(def.breathDurationMs).toBe(ARCHIVE_WYRM_BREATH_DURATION_MS);
			expect(def.breathTickMs).toBe(ARCHIVE_WYRM_BREATH_TICK_MS);
			expect(def.breathRange).toBe(10);
			expect(def.breathConeAngle ?? Math.PI / 3).toBe(Math.PI / 3);
			expect(def.windUpMs ?? 0).toBeLessThanOrEqual(0);
		});

		it('airborne fire breath mid-channel pulses respect origin.y and tilted direction.y', () => {
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
				breathDurationMs: ARCHIVE_WYRM_BREATH_DURATION_MS,
				hits: [{ enemyId: 'e1', hp: 46 }],
			}, ctx);
			ctx.runScheduled();
			const len = Math.hypot(1, 0, dirY);
			const pulseRings = ctx._calls.filter((c) => c[0] === 'spawnTelegraphRing');
			const scheduledRings = pulseRings.slice(1);
			expect(scheduledRings.length).toBeGreaterThanOrEqual(ARCHIVE_WYRM_BREATH_TICK_COUNT);
			for (let n = 1; n <= ARCHIVE_WYRM_BREATH_TICK_COUNT; n++) {
				const alongDist = range * (0.2 + 0.15 * n);
				const expectedY = airborneY + (dirY / len) * alongDist;
				const ring = scheduledRings[n - 1];
				expect(ring[1].y).toBeCloseTo(expectedY, 5);
			}
		});
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
		const projectileTrail = ctx._calls.find((c) => c[0] === 'spawnProjectileTrail');
		expect(projectileTrail).toBeDefined();
		expect(projectileTrail[3].y).toBeCloseTo(airborneY, 5);
	});

	it('Vault Wyrm breath start does not emit archive-only fire trail primitives', () => {
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
		expect(ctx._calls.some((c) => c[0] === 'spawnFireTrailEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnDragonsBreathEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnProjectileTrail')).toBe(false);
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
		const archiveRing = archiveCtx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(archiveRing).toBeDefined();
		expect(archiveRing[1]).toEqual({ x: 3, z: 4 });
		expect(archiveRing[2]).toBe(1.85);
		expect(archiveRing[3]).toMatchObject({ color: 0x9333ea, emissive: 0x9333ea });
		const archiveBurst = archiveCtx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(archiveBurst).toBeDefined();
		expect(archiveBurst[2]).toMatchObject({
			color: 0xef4444,
			emissive: 0xff3b00,
			count: 18,
			spread: 2.5,
		});
		expect(vaultCtx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(false);
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
			minionId: 'commander-1',
			origin: { x: 0, z: 0 },
			summonedMinions: [
				{ x: 1, z: 0 },
				{ x: 0, z: 1 },
			],
			hits: [],
		}, ctx);
		const rally = ctx._calls.filter((c) => c[0] === 'spawnLegionMarshalRallyEffect');
		expect(rally).toHaveLength(1);
		expect(rally[0][1]).toEqual({ x: 0, z: 0 });
		expect(rally[0][2]).toBe(2);
		expect(rally[0][3]).toMatchObject({ color: 0xe4e4e7, emissive: 0xa855f7 });
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'scheduleAfter')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnProjectileTrail')).toBe(false);
		const flourishes = ctx._calls.filter((c) => c[0] === 'spawnMinionSummonInEffect');
		expect(flourishes).toHaveLength(3);
		expect(flourishes[0][1]).toEqual({ x: 0, z: 0 });
		expect(flourishes[0][2]).toMatchObject({
			color: 0xe4e4e7,
			emissive: 0xa855f7,
			radius: 1.6,
		});
		expect(flourishes[1][1]).toEqual({ x: 1, z: 0 });
		expect(flourishes[2][1]).toEqual({ x: 0, z: 1 });
		expect(flourishes[1][2]).toMatchObject({
			color: 0xe4e4e7,
			emissive: 0xa855f7,
			radius: 0.85,
		});
		const tethers = ctx._calls.filter((c) => c[0] === 'spawnLightningArc');
		expect(tethers).toHaveLength(2);
		expect(tethers[0][1]).toEqual({ x: 0, z: 0 });
		expect(tethers[0][2]).toEqual({ x: 1, z: 0 });
		expect(tethers[1][2]).toEqual({ x: 0, z: 1 });
		const groundBursts = ctx._calls.filter(
			(c) => c[0] === 'spawnParticleBurst' && c[1].y === 0.35,
		);
		expect(groundBursts).toHaveLength(2);
		expect(groundBursts[0][2]).toMatchObject({ color: 0xe4e4e7, emissive: 0xa855f7 });
	});

	it('skeleton_knight summon renders a bone-white/necrotic-purple flourish bound to the summon window', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'skeleton_knight',
			minionId: 'knight-1',
			origin: { x: 4, z: 5 },
			hits: [],
		}, ctx);
		const flourishes = ctx._calls.filter((c) => c[0] === 'spawnMinionSummonInEffect');
		expect(flourishes).toHaveLength(1);
		expect(flourishes[0][1]).toEqual({ x: 4, z: 5 });
		expect(flourishes[0][2]).toMatchObject({ color: 0xe4e4e7, emissive: 0xa855f7 });
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[1]).toEqual({ x: 4, z: 5 });
		expect(ring[3]).toMatchObject({ color: 0xe4e4e7, emissive: 0xa855f7 });
		// Bone-shard burst is staggered, but capped well within the summon window.
		const sched = ctx._calls.find((c) => c[0] === 'scheduleAfter');
		expect(sched).toBeDefined();
		expect(sched[1]).toBeLessThan(MINION_SUMMON_IN_MS);
		ctx.runScheduled();
		const shardBurst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst' && c[1].y === 0.35);
		expect(shardBurst).toBeDefined();
		expect(shardBurst[1]).toMatchObject({ x: 4, z: 5 });
		expect(shardBurst[2]).toMatchObject({ color: 0xe4e4e7, emissive: 0xa855f7 });
	});

	it('skeleton_knight summon stays sound-only with no minionId and never throws', () => {
		const ctx = makeCtx();
		expect(() => renderCardUsed({
			cardId: 'skeleton_knight',
			origin: { x: 0, z: 0 },
			hits: [],
		}, ctx)).not.toThrow();
		expect(ctx._calls.some((c) => c[0] === 'spawnMinionSummonInEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(false);
	});

	it('skeleton_knight summon degrades gracefully when optional ctx helpers are absent', () => {
		const ctx = makeCtx({
			spawnTelegraphRing: undefined,
			spawnParticleBurst: undefined,
			scheduleAfter: undefined,
		});
		expect(() => renderCardUsed({
			cardId: 'skeleton_knight',
			minionId: 'knight-2',
			origin: { x: 1, z: 1 },
			hits: [],
		}, ctx)).not.toThrow();
		expect(ctx._calls.filter((c) => c[0] === 'spawnMinionSummonInEffect')).toHaveLength(1);
	});

	it('undead_commander has no positive windUpMs (instant cast; 315 charge telegraph absent)', () => {
		expect(getCardDef('undead_commander').windUpMs ?? 0).toBeLessThanOrEqual(0);
	});

	it('undead_commander degrades gracefully when Legion Marshal VFX primitives are absent', () => {
		const payload = {
			cardId: 'undead_commander',
			minionId: 'commander-1',
			origin: { x: 0, z: 0 },
			summonedMinions: [
				{ x: 1, z: 0 },
				{ x: 0, z: 1 },
			],
			hits: [],
		};
		const ctx = makeCtx({
			spawnLegionMarshalRallyEffect: undefined,
			spawnMinionSummonInEffect: undefined,
			spawnLightningArc: undefined,
			spawnParticleBurst: undefined,
		});
		expect(() => renderCardUsed(payload, ctx)).not.toThrow();
		expect(ctx._calls.some((c) => c[0] === 'spawnLegionMarshalRallyEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnMinionSummonInEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnLightningArc')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnParticleBurst')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'scheduleAfter')).toBe(false);
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
		// Tighter/smaller than Thunderbird's wider sky-blue summon (radius 1.2).
		expect(flourishes[0][2].radius).toBeLessThan(1.2);
		expect(flourishes[0][2]).not.toMatchObject({ color: 0x38bdf8, emissive: 0x0ea5e9 });
		// Wing/wind cue on top of the base flourish: a storm-palette ripple ring
		// and a wing-beat spark burst, both in the cyan storm palette.
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[1]).toEqual({ x: 2, z: 3 });
		expect(ring[3]).toMatchObject({ color: 0x93c5fd, emissive: 0x7dd3fc });
		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[2]).toMatchObject({ color: 0x93c5fd, emissive: 0x7dd3fc });
		// No lightning arc on the deploy event.
		expect(ctx._calls.some((c) => c[0] === 'spawnLightningArc')).toBe(false);
	});

	it('storm_eagle attack renders a single cyan storm bolt to strikeTarget with one impact burst', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'storm_eagle',
			minionId: 'eagle-1',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			strikeTarget: { x: 6, z: 0 },
			hits: [{ enemyId: 'e1', hp: 27 }],
		}, ctx);
		// Exactly one arc, in the storm palette, terminating at the server hit point.
		const arcs = ctx._calls.filter((c) => c[0] === 'spawnLightningArc');
		expect(arcs).toHaveLength(1);
		expect(arcs[0][2]).toEqual({ x: 6, z: 0 });
		expect(arcs[0][3]).toMatchObject({ color: 0x67e8f9, emissive: 0x22d3ee });
		// Exactly one impact burst, in the storm palette, at the strike target.
		const bursts = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst');
		expect(bursts).toHaveLength(1);
		expect(bursts[0][1]).toEqual({ x: 6, z: 0 });
		expect(bursts[0][2]).toMatchObject({ color: 0x67e8f9, emissive: 0x22d3ee });
	});

	it('storm_eagle attack fires the bolt from the drone aerial position using the 3D tilted direction', () => {
		const ctx = makeCtx();
		// Drone above and beside the target: direction tilts downward (negative Y).
		renderCardUsed({
			cardId: 'storm_eagle',
			minionId: 'eagle-1',
			origin: { x: 0, z: 0 },
			direction: { x: 0.6, y: -0.8, z: 0 },
			strikeTarget: { x: 6, z: 0 },
			hits: [{ enemyId: 'e1', hp: 27 }],
		}, ctx);
		const arc = ctx._calls.find((c) => c[0] === 'spawnLightningArc');
		const from = arc[1];
		// Origin is lifted to an aerial height derived from the downward tilt
		// (|dirY|/|dirXZ| × horizontal reach = 0.8/0.6 × 6 = 8).
		expect(from.x).toBe(0);
		expect(from.z).toBe(0);
		expect(from.y).toBeCloseTo(8, 5);
		// Impact still lands on the ground-level server target.
		expect(arc[2]).toEqual({ x: 6, z: 0 });
	});

	it('storm_eagle attack without strikeTarget falls back along the 3D direction by attackRange', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'storm_eagle',
			minionId: 'eagle-1',
			origin: { x: 0, z: 0 },
			direction: { x: 1, y: -0.5, z: 0 },
			attackRange: 7,
			hits: [{ enemyId: 'e1', hp: 27 }],
		}, ctx);
		const arc = ctx._calls.find((c) => c[0] === 'spawnLightningArc');
		expect(arc).toBeDefined();
		const to = arc[2];
		// Horizontal component normalized over XZ length (=1): reach 7 along +X.
		expect(to.x).toBeCloseTo(7, 5);
		expect(to.z).toBe(0);
		// Tilt carried through: y = (dirY / |dir3D|) × distance, |dir3D| = √1.25.
		const len3D = Math.hypot(1, 0.5);
		expect(to.y).toBeCloseTo((-0.5 / len3D) * 7, 5);
	});

	it('storm_eagle summon-only event produces no strike arc', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'storm_eagle',
			minionId: 'eagle-1',
			origin: { x: 2, z: 3 },
			hits: [],
		}, ctx);
		// The strike renderer is gated behind non-empty hits, so a deploy event
		// (empty hits) emits no storm bolt; the only burst is the deploy puff.
		const arcs = ctx._calls.filter((c) => c[0] === 'spawnLightningArc');
		expect(arcs).toHaveLength(0);
		const summonBursts = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst');
		expect(summonBursts.every((c) => c[1].x === 2 && c[1].z === 3)).toBe(true);
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
		expect(flourishes[0][1]).toEqual({ x: 1, z: 2 });
		expect(flourishes[0][2]).toMatchObject({
			color: 0x38bdf8,
			emissive: 0x0ea5e9,
			radius: 1.2,
			burstCount: 14,
		});
		expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(true);
		const wingBursts = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst');
		expect(wingBursts).toHaveLength(1);
		expect(wingBursts[0][1]).toMatchObject({ x: 1, y: 3.5, z: 2 });
		expect(ctx._calls.some((c) => c[0] === 'spawnChainLightningEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'scheduleAfter')).toBe(false);
	});

	it('thunderbird summon early-returns on attack payloads with hits', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'thunderbird',
			minionId: 'bird-1',
			origin: { x: 0, z: 0 },
			hits: [{ enemyId: 'e1', hp: 30 }],
		}, ctx);
		expect(ctx._calls.filter((c) => c[0] === 'spawnMinionSummonInEffect')).toHaveLength(0);
	});

	it('resolveRenderers thunderbird second renderer is renderThunderbirdStrike', () => {
		const renderers = resolveRenderers('thunderbird');
		expect(renderers).toHaveLength(2);
		expect(renderers[0].name).toBe('renderThunderbirdSummon');
		expect(renderers[1].name).toBe('renderThunderbirdStrike');
	});

	it('thunderbird single-target strike uses legacy bolt, origin flare, and no renderer enemyHit', () => {
		const enemyMesh = { position: { x: 6, y: 1.2, z: 0 } };
		const ctx = makeCtx({
			enemyMeshes: () => ({ e1: enemyMesh }),
		});
		renderCardUsed({
			cardId: 'thunderbird',
			origin: { x: 3, z: 4 },
			direction: { x: 1, z: 0 },
			specialEffect: 'chain_lightning',
			hits: [{ enemyId: 'e1', hp: 30 }],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnChainLightningEffect')).toBe(true);
		expect(ctx._calls.some((c) => c[0] === 'spawnLightningArc')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(false);
		const bursts = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst');
		expect(bursts).toHaveLength(2);
		expect(bursts.filter((c) => c[1].x === 3 && c[1].z === 4)).toHaveLength(1);
		expect(bursts[1][1]).toEqual({ x: 6, y: 1.2, z: 0 });
		const hitSounds = ctx._calls.filter((c) => c[0] === 'playSound' && c[1] === 'enemyHit');
		expect(hitSounds).toHaveLength(1);
	});

	it('thunderbird chain strike schedules later hops and uses thunderbird arc style', () => {
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
		expect(arcs).toHaveLength(1);
		expect(arcs[0][3]).toMatchObject({
			color: 0x38bdf8,
			emissive: 0x0ea5e9,
			duration: ATTACK_EFFECT_DURATION,
		});
		expect(ctx._calls.some((c) => c[0] === 'spawnChainLightningEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnAttackEffect')).toBe(false);
		const schedules = ctx._calls.filter((c) => c[0] === 'scheduleAfter');
		expect(schedules).toHaveLength(1);
		expect(schedules[0][1]).toBe(100);
		expect(schedules[0][1]).toBeLessThan(ATTACK_EFFECT_DURATION);
		ctx.runScheduled();
		const allArcs = ctx._calls.filter((c) => c[0] === 'spawnLightningArc');
		expect(allArcs).toHaveLength(2);
		expect(allArcs[0][1]).toEqual({ x: 0, z: 0 });
		expect(allArcs[0][2]).toEqual({ x: 6, z: 0 });
		expect(allArcs[1][1]).toEqual({ x: 6, z: 0 });
		expect(allArcs[1][2]).toEqual({ x: 8, z: 0 });
		const endpointBursts = ctx._calls.filter(
			(c) => c[0] === 'spawnParticleBurst' && !(c[1].x === 0 && c[1].z === 0),
		);
		expect(endpointBursts).toHaveLength(2);
		expect(endpointBursts[0][1]).toEqual({ x: 6, z: 0 });
		expect(endpointBursts[1][1]).toEqual({ x: 8, z: 0 });
	});

	it('thunderbird chain strike without spawnLightningArc does not throw', () => {
		const ctx = makeCtx({ spawnLightningArc: undefined });
		expect(() => renderCardUsed({
			cardId: 'thunderbird',
			origin: { x: 0, z: 0 },
			direction: { x: 1, z: 0 },
			chainSegments: [{ from: { x: 0, z: 0 }, to: { x: 5, z: 0 } }],
			hits: [{ enemyId: 'e1', hp: 30 }],
		}, ctx)).not.toThrow();
	});

	it('chain_lightning has no positive windUpMs (instant cast; 307 charge telegraph absent)', () => {
		expect(CARD_DEFS.chain_lightning.windUpMs ?? 0).toBeLessThanOrEqual(0);
	});

	it('chain_lightning with two chainSegments schedules later hops and uses voltaic arc style', () => {
		const enemyMesh = { position: { x: 8, y: 1.1, z: 0.2 } };
		const payload = {
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
		};
		const rendererCtx = makeCtx({
			enemyMeshes: () => ({ e2: enemyMesh }),
		});
		resolveRenderers('chain_lightning')[0](payload, rendererCtx);
		expect(rendererCtx._calls.some((c) => c[0] === 'playSound' && c[1] === 'enemyHit')).toBe(false);

		const ctx = makeCtx({
			enemyMeshes: () => ({ e2: enemyMesh }),
		});
		renderCardUsed(payload, ctx);

		const telegraph = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(telegraph).toBeDefined();
		expect(telegraph[1]).toEqual({ x: 0, z: 0 });
		expect(telegraph[2]).toBe(5);
		expect(telegraph[3]).toMatchObject({
			color: 0x38bdf8,
			emissive: 0x0ea5e9,
			duration: ATTACK_EFFECT_DURATION,
		});
		const castBurst = ctx._calls.find(
			(c) => c[0] === 'spawnParticleBurst' && c[1].x === 0 && c[1].z === 0 && c[2].spread === 1.4,
		);
		expect(castBurst).toBeDefined();
		const scheduleIdx = ctx._calls.findIndex((c) => c[0] === 'scheduleAfter');
		expect(scheduleIdx).toBeGreaterThan(0);
		expect(ctx._calls.findIndex((c) => c[0] === 'spawnTelegraphRing')).toBeLessThan(scheduleIdx);
		expect(ctx._calls.findIndex((c) => c[0] === 'spawnParticleBurst' && c[2]?.spread === 1.4)).toBeLessThan(scheduleIdx);

		const arcs = ctx._calls.filter((c) => c[0] === 'spawnLightningArc');
		expect(arcs).toHaveLength(1);
		expect(arcs[0][3]).toMatchObject({
			color: 0x38bdf8,
			emissive: 0x0ea5e9,
			duration: ATTACK_EFFECT_DURATION,
		});
		expect(arcs[0][1]).toEqual({ x: 0, z: 0 });
		expect(arcs[0][2]).toEqual({ x: 5, z: 0 });
		expect(ctx._calls.findIndex((c) => c[0] === 'spawnLightningArc')).toBeLessThan(scheduleIdx);

		const hop0Burst = ctx._calls.find(
			(c) => c[0] === 'spawnParticleBurst' && c[1].x === 5 && c[1].z === 0,
		);
		expect(hop0Burst).toBeDefined();
		expect(ctx._calls.indexOf(hop0Burst)).toBeLessThan(scheduleIdx);

		const schedules = ctx._calls.filter((c) => c[0] === 'scheduleAfter');
		expect(schedules).toHaveLength(1);
		expect(schedules[0][1]).toBeGreaterThanOrEqual(80);
		expect(schedules[0][1]).toBeLessThanOrEqual(120);
		expect(schedules[0][1]).toBeLessThan(ATTACK_EFFECT_DURATION);

		ctx.runScheduled();
		const allArcs = ctx._calls.filter((c) => c[0] === 'spawnLightningArc');
		expect(allArcs).toHaveLength(2);
		expect(allArcs[1][1]).toEqual({ x: 5, z: 0 });
		expect(allArcs[1][2]).toEqual({ x: 8, z: 0 });

		const endpointBursts = ctx._calls.filter(
			(c) => c[0] === 'spawnParticleBurst' && (c[1].x === 5 || c[1].x === 8),
		);
		expect(endpointBursts).toHaveLength(2);
		expect(endpointBursts[0][1]).toEqual({ x: 5, z: 0 });
		expect(endpointBursts[1][1]).toEqual({ x: 8, y: 1.1, z: 0.2 });

		expect(ctx._calls.some((c) => c[0] === 'spawnChainLightningEffect')).toBe(false);
		const hitSounds = ctx._calls.filter((c) => c[0] === 'playSound' && c[1] === 'enemyHit');
		expect(hitSounds).toHaveLength(1);
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
		expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(true);
		expect(ctx._calls.some(
			(c) => c[0] === 'spawnParticleBurst' && c[1].x === 1 && c[1].z === 2,
		)).toBe(true);
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

	it('cinder_snare resolves to its own renderCinderSnare, distinct from spike_trap', () => {
		const snare = resolveRenderers('cinder_snare');
		expect(snare).toHaveLength(1);
		expect(snare[0].name).toBe('renderCinderSnare');
		expect(snare[0]).not.toBe(resolveRenderers('spike_trap')[0]);
	});

	it('cinder_snare spawns a fiery ember snare at the placement origin/radius with the card accent', () => {
		const ctx = makeCtx();
		const def = getCardDef('cinder_snare');
		renderCardUsed({
			cardId: 'cinder_snare',
			origin: { x: 5, z: -2 },
			radius: def.radius,
			effect: 'cinder_snare',
			hits: [],
		}, ctx);

		// Initial ember snare fired at the placement origin / stat-derived radius.
		const pillars = ctx._calls.filter((c) => c[0] === 'spawnInfernoPillarEffect');
		expect(pillars).toHaveLength(1);
		expect(pillars[0][1]).toEqual({ x: 5, z: -2 });
		expect(pillars[0][2]).toBe(def.radius);

		// Themed to the card accent (#f97316), NOT the generic 0xf87171/0xef4444 palette.
		const style = pillars[0][3];
		expect(style.color).toBe(0xf97316);
		expect(style.color).toBe(getAccentHex('cinder_snare'));
		expect(style.color).not.toBe(0xf87171);
		expect(style.emissive).not.toBe(0xef4444);

		// Ember spark burst at the placement origin, themed orange.
		const bursts = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst');
		expect(bursts.length).toBeGreaterThanOrEqual(1);
		expect(bursts[0][1]).toEqual({ x: 5, z: -2 });
		expect(bursts[0][2].color).toBe(0xf97316);

		// Distinct from spike_trap: no steel-spike primitive, no generic preview.
		expect(ctx._calls.some((c) => c[0] === 'spawnSpikeTrapEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnSummonEffect')).toBe(false);
	});

	it('cinder_snare derives its smolder cadence and duration from the card stats', () => {
		const ctx = makeCtx();
		const def = getCardDef('cinder_snare');
		renderCardUsed({
			cardId: 'cinder_snare',
			origin: { x: 0, z: 0 },
			radius: def.radius,
			effect: 'cinder_snare',
			hits: [],
		}, ctx);

		// Lingering smolder reflects the server stats, not hardcoded numbers.
		const pillars = ctx._calls.filter((c) => c[0] === 'spawnInfernoPillarEffect');
		expect(pillars[0][3].dotTicks).toBe(def.dotTicks);
		expect(pillars[0][3].dotIntervalMs).toBe(def.dotIntervalMs);
		expect(pillars[0][3].duration).toBe(def.ttlMs);

		// One scheduled smolder pulse per DoT tick, aligned to dotIntervalMs.
		const schedules = ctx._calls.filter((c) => c[0] === 'scheduleAfter');
		expect(schedules).toHaveLength(def.dotTicks);
		for (let i = 0; i < schedules.length; i += 1) {
			expect(schedules[i][1]).toBe(def.dotIntervalMs * (i + 1));
		}
	});

	it('cinder_snare fires the initial placement VFX synchronously (no windUpMs gating)', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'cinder_snare',
			origin: { x: 0, z: 0 },
			radius: 2.5,
			effect: 'cinder_snare',
			hits: [],
		}, ctx);

		const pillarIdx = ctx._calls.findIndex((c) => c[0] === 'spawnInfernoPillarEffect');
		const firstScheduleIdx = ctx._calls.findIndex((c) => c[0] === 'scheduleAfter');
		expect(pillarIdx).toBeGreaterThanOrEqual(0);
		// Placement effect resolves before any deferred smolder scheduling.
		expect(firstScheduleIdx === -1 || pillarIdx < firstScheduleIdx).toBe(true);

		// And the card itself carries no positive windUpMs.
		const windUp = getCardDef('cinder_snare').windUpMs;
		expect(windUp === undefined || windUp === 0).toBe(true);
	});

	it('cinder_snare no-ops on a malformed event with no radius', () => {
		const ctx = makeCtx();
		renderCardUsed({
			cardId: 'cinder_snare',
			origin: { x: 0, z: 0 },
			effect: 'cinder_snare',
			hits: [],
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnInfernoPillarEffect')).toBe(false);
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
		it('composes a staggered parchment/gold card-riffle flourish at the caster', () => {
			const ctx = makeCtx();
			renderCardUsed({
				cardId: 'deck_sifter',
				origin: { x: 3, z: 4 },
				direction: { x: 1, z: 0 },
				hits: [],
			}, ctx);

			// Ground accent ring on the deck_sifter parchment/gold palette.
			const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
			expect(ring).toBeDefined();
			expect(ring[1]).toEqual({ x: 3, z: 4 });
			expect(ring[2]).toBe(1.4);
			expect(ring[3]).toMatchObject({ color: 0xd4a843, emissive: 0xdaa520 });

			// The centre card puffs immediately so it stays synced to the instant
			// draw; the flanking cards riffle out via short scheduled beats.
			let bursts = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst');
			expect(bursts).toHaveLength(1);
			expect(bursts[0][1]).toEqual({ x: 3, y: 1.0, z: 4 });

			const delays = ctx._calls
				.filter((c) => c[0] === 'scheduleAfter')
				.map((c) => c[1]);
			expect(delays).toEqual([70, 140]);
			for (const d of delays) expect(d).toBeLessThan(300);

			// After the staggered beats fire, three cards fan out perpendicular to
			// the cast direction (+x → spread along z), all on the parchment theme.
			ctx.runScheduled();
			bursts = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst');
			expect(bursts).toHaveLength(3);
			const zs = bursts.map((b) => b[1].z).sort((a, b) => a - b);
			expect(zs).toEqual([3.3, 4, 4.7]);
			for (const b of bursts) {
				expect(b[1]).toMatchObject({ x: 3, y: 1.0 });
				expect(b[2]).toMatchObject({
					color: 0xf5deb3,
					emissive: 0xdaa520,
					count: 6,
					spread: 0.8,
				});
			}
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
		it('resolveRenderers returns exactly renderChronoTrigger', () => {
			const renderers = resolveRenderers('chrono_trigger');
			expect(renderers).toHaveLength(1);
			expect(renderers[0].name).toBe('renderChronoTrigger');
		});

		it('calls spawnChronoTriggerEffect(origin, radius, style) with amber/cyan accent colors', () => {
			const ctx = makeCtx();
			renderCardUsed({
				cardId: 'chrono_trigger',
				origin: { x: 5, z: 6 },
				restoredCharges: [],
				hits: [],
			}, ctx);
			const ripple = ctx._calls.find((c) => c[0] === 'spawnChronoTriggerEffect');
			expect(ripple).toBeDefined();
			expect(ripple[1]).toEqual({ x: 5, z: 6 });
			expect(ripple[2]).toBe(2);
			expect(ripple[3]).toMatchObject({ color: 0xf59e0b, emissive: 0x67e8f9 });
		});

		it('fires all VFX synchronously at cast without scheduleAfter', () => {
			const ctx = makeCtx();
			renderCardUsed({
				cardId: 'chrono_trigger',
				origin: { x: 0, z: 0 },
				slotIndex: 1,
				direction: { x: 1, z: 0 },
				restoredCharges: [
					{ slotIndex: 0, cardId: 'iron_sword', amount: 2 },
					{ slotIndex: 2, cardId: 'flame_blade', amount: 1 },
				],
				hits: [],
			}, ctx);
			expect(ctx._calls.some((c) => c[0] === 'scheduleAfter')).toBe(false);
			expect(ctx._calls.some((c) => c[0] === 'spawnChronoTriggerEffect')).toBe(true);
			expect(ctx._calls.filter((c) => c[0] === 'spawnLightningArc')).toHaveLength(2);
			expect(ctx._calls.filter((c) => c[0] === 'spawnParticleBurst')).toHaveLength(2);
		});

		it('spawns per-slot charge-restore flares at perpendicular offsets from cast direction', () => {
			const ctx = makeCtx();
			renderCardUsed({
				cardId: 'chrono_trigger',
				origin: { x: 0, z: 0 },
				slotIndex: 1,
				direction: { x: 1, z: 0 },
				restoredCharges: [
					{ slotIndex: 0, cardId: 'iron_sword', amount: 2 },
					{ slotIndex: 2, cardId: 'flame_blade', amount: 1 },
				],
				hits: [],
			}, ctx);
			const bursts = ctx._calls.filter((c) => c[0] === 'spawnParticleBurst');
			expect(bursts).toHaveLength(2);
			const positions = bursts.map((b) => b[1]).sort((p, q) => p.z - q.z);
			expect(positions[0]).toEqual({ x: 0, z: -1.2 });
			expect(positions[1]).toEqual({ x: 0, z: 1.2 });
			const arcs = ctx._calls.filter((c) => c[0] === 'spawnLightningArc');
			expect(arcs).toHaveLength(2);
			expect(arcs[0][1]).toEqual({ x: 0, z: 0 });
			expect(arcs[1][1]).toEqual({ x: 0, z: 0 });
			const arcTargets = arcs.map((a) => a[2]).sort((p, q) => p.z - q.z);
			expect(arcTargets[0]).toEqual({ x: 0, z: -1.2 });
			expect(arcTargets[1]).toEqual({ x: 0, z: 1.2 });
			for (const b of bursts) {
				expect(b[2]).toMatchObject({ color: 0xf59e0b, emissive: 0x67e8f9, count: 8, spread: 1.0 });
			}
		});

		it('with empty restoredCharges only the center time-ripple fires', () => {
			const ctx = makeCtx();
			renderCardUsed({
				cardId: 'chrono_trigger',
				origin: { x: 2, z: 3 },
				restoredCharges: [],
				hits: [],
			}, ctx);
			expect(ctx._calls.filter((c) => c[0] === 'spawnChronoTriggerEffect')).toHaveLength(1);
			expect(ctx._calls.some((c) => c[0] === 'spawnLightningArc')).toBe(false);
			expect(ctx._calls.some((c) => c[0] === 'spawnParticleBurst')).toBe(false);
		});

		it('no-ops when origin is absent', () => {
			const ctx = makeCtx();
			renderCardUsed({
				cardId: 'chrono_trigger',
				slotIndex: 1,
				restoredCharges: [{ slotIndex: 0, cardId: 'iron_sword', amount: 2 }],
				hits: [],
			}, ctx);
			expect(ctx._calls.some((c) => c[0] === 'spawnChronoTriggerEffect')).toBe(false);
			expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(false);
			expect(ctx._calls.some((c) => c[0] === 'spawnParticleBurst')).toBe(false);
			expect(ctx._calls.some((c) => c[0] === 'spawnLightningArc')).toBe(false);
		});

		it('does not use spawnTelegraphRing as the primary cast read', () => {
			const ctx = makeCtx();
			renderCardUsed({
				cardId: 'chrono_trigger',
				origin: { x: 0, z: 0 },
				restoredCharges: [],
				hits: [],
			}, ctx);
			expect(ctx._calls.some((c) => c[0] === 'spawnChronoTriggerEffect')).toBe(true);
			expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(false);
		});

		it('has no positive windUpMs (instant cast; 307 charge telegraph absent)', () => {
			expect(CARD_DEFS.chrono_trigger).toBeDefined();
			expect(CARD_DEFS.chrono_trigger.windUpMs ?? 0).toBeLessThanOrEqual(0);
		});

		it('chrono_trigger, mana_prism, and sacrificial_altar produce distinct helper signatures for equivalent utility payloads', () => {
			const origin = { x: 0, z: 0 };
			const chronoCtx = makeCtx();
			resolveRenderers('chrono_trigger')[0]({
				cardId: 'chrono_trigger',
				origin,
				restoredCharges: [],
				hits: [],
			}, chronoCtx);
			const prismCtx = makeCtx();
			resolveRenderers('mana_prism')[0]({
				cardId: 'mana_prism',
				origin,
				radius: 1,
				hits: [],
			}, prismCtx);
			const altarCtx = makeCtx();
			resolveRenderers('sacrificial_altar')[0]({
				cardId: 'sacrificial_altar',
				origin,
				radius: 10,
				hits: [],
			}, altarCtx);
			const chronoSig = methodsCalled(chronoCtx);
			const prismSig = methodsCalled(prismCtx);
			const altarSig = methodsCalled(altarCtx);
			expect(chronoSig).not.toEqual(prismSig);
			expect(chronoSig).not.toEqual(altarSig);
			expect(chronoSig).toContain('spawnChronoTriggerEffect');
			expect(chronoSig).not.toContain('spawnTelegraphRing');
			expect(prismSig).toContain('spawnTelegraphRing');
			expect(altarSig).toContain('spawnTelegraphRing');
		});

		it('does not throw when spawnChronoTriggerEffect or optional flare primitives are absent', () => {
			const ctx = makeCtx({
				spawnChronoTriggerEffect: undefined,
				spawnLightningArc: undefined,
				spawnParticleBurst: undefined,
			});
			expect(() => renderCardUsed({
				cardId: 'chrono_trigger',
				origin: { x: 0, z: 0 },
				slotIndex: 1,
				direction: { x: 1, z: 0 },
				restoredCharges: [{ slotIndex: 0, cardId: 'iron_sword', amount: 2 }],
				hits: [],
			}, ctx)).not.toThrow();
			expect(ctx._calls.filter((c) => c[0] === 'spawnChronoTriggerEffect')).toHaveLength(0);
			expect(ctx._calls.filter((c) => c[0] === 'spawnLightningArc')).toHaveLength(0);
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

describe('telepipe', () => {
	const samplePayload = {
		cardId: 'telepipe',
		effect: 'telepipe',
		specialEffect: 'portal',
		origin: { x: 3, z: -5 },
	};

	function renderTelepipe(data, ctx) {
		return resolveRenderers('telepipe')[0](data, ctx);
	}

	it('resolveRenderers returns a single non-empty renderer named renderTelepipe', () => {
		const renderers = resolveRenderers('telepipe');
		expect(renderers.length).toBeGreaterThan(0);
		expect(renderers).toHaveLength(1);
		expect(renderers[0].name).toBe('renderTelepipe');
	});

	it('invokes spawnTelepipeCastEffect, spawnTelegraphRing, and spawnParticleBurst at cast origin with cyan accent palette', () => {
		const ctx = makeCtx();
		renderTelepipe(samplePayload, ctx);

		const accent = getAccentHex('telepipe');
		expect(accent).toBe(0x67e8f9);

		const cast = ctx._calls.find((c) => c[0] === 'spawnTelepipeCastEffect');
		expect(cast).toBeDefined();
		expect(cast[1]).toEqual({ x: 3, z: -5 });
		expect(cast[2]).toBe(2.5);
		expect(cast[3]).toMatchObject({ color: accent, emissive: 0x22d3ee });

		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring).toBeDefined();
		expect(ring[1]).toEqual({ x: 3, z: -5 });
		expect(ring[2]).toBe(2.5);
		expect(ring[3]).toMatchObject({ color: accent, emissive: 0x22d3ee });

		const burst = ctx._calls.find((c) => c[0] === 'spawnParticleBurst');
		expect(burst).toBeDefined();
		expect(burst[1]).toEqual({ x: 3, y: 1.0, z: -5 });
		expect(burst[2]).toMatchObject({ color: accent, emissive: 0x22d3ee, count: 10, spread: 1.6 });
	});

	it('no-ops when data.origin is absent', () => {
		const ctx = makeCtx();
		renderTelepipe({
			cardId: 'telepipe',
			effect: 'telepipe',
			specialEffect: 'portal',
		}, ctx);
		expect(ctx._calls.some((c) => c[0] === 'spawnTelepipeCastEffect')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnTelegraphRing')).toBe(false);
		expect(ctx._calls.some((c) => c[0] === 'spawnParticleBurst')).toBe(false);
	});

	it('has no positive windUpMs (instant cast; no 307 charge telegraph expected)', () => {
		expect(CARD_DEFS.telepipe).toBeDefined();
		expect(CARD_DEFS.telepipe.windUpMs ?? 0).toBeLessThanOrEqual(0);
	});

	it('does not call scheduleAfter (synchronous instant cast)', () => {
		const ctx = makeCtx();
		renderTelepipe(samplePayload, ctx);
		expect(ctx._calls.some((c) => c[0] === 'scheduleAfter')).toBe(false);
	});

	it('defaults portal radius to 2.5 when data.radius is omitted', () => {
		const ctx = makeCtx();
		renderTelepipe(samplePayload, ctx);
		const cast = ctx._calls.find((c) => c[0] === 'spawnTelepipeCastEffect');
		expect(cast[2]).toBe(2.5);
		const ring = ctx._calls.find((c) => c[0] === 'spawnTelegraphRing');
		expect(ring[2]).toBe(2.5);
	});
});
