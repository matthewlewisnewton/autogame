import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	CARD_DEFS,
	SUMMON_RADIUS,
	createGameState,
	gameState,
	applyFreezeInRadius,
	collectRadialHits,
	collectConeHits,
	healPlayersInRadius,
	pullEnemiesToward,
	applyEventHorizon,
	spawnInfernoPillarEffect,
	updateAreaEffects,
	isEnemyFrozen,
	resolveProjectileAim,
} from '../index.js';
import { handleUseCard, setCallbacks as setCardEffectCallbacks } from '../cardEffects.js';
import { handleUseKeyItem, setCallbacks as setKeyItemCallbacks } from '../keyItemEffects.js';
import { setGameState as setSimGameState } from '../simulation.js';
import { setGameState as setProgressionGameState, KEY_ITEM_DEFS } from '../progression.js';

const CASTER_Y = 0;
const H_OFFSET = 3;
const PULL_OFFSET = 4;
const IN_SPHERE_Y = 3;
const IN_CRUSH_Y = 2;
const OUT_SPHERE_Y = 12;

function mockIo() {
	return {
		to: () => ({
			emit: () => {},
		}),
	};
}

function wireCallbacks() {
	const io = mockIo();
	setCardEffectCallbacks({
		io,
		emitCardError: () => {},
		findSacrificeTarget: () => null,
		resolveAttackRotation: (player, data) => (
			Number.isFinite(data?.rotation) ? data.rotation : (player.rotation || 0)
		),
		resolveProjectileAim,
	});
	setKeyItemCallbacks({ io });
}

function resetState() {
	Object.assign(gameState, createGameState());
	setSimGameState(gameState, {});
	setProgressionGameState(gameState);
}

function addEnemy(id, x, z, hp = 100, y = undefined) {
	const enemy = { id, type: 'grunt', x, z, hp, maxHp: hp };
	if (y !== undefined) enemy.y = y;
	gameState.enemies.push(enemy);
}

function addPlayer(id, overrides = {}) {
	gameState.players[id] = {
		id,
		x: 0,
		y: CASTER_Y,
		z: 0,
		rotation: 0,
		hp: 50,
		dead: false,
		extracted: false,
		magicStones: 100,
		hand: [],
		deck: [],
		pendingSummons: new Set(),
		slotCooldowns: [null, null, null, null],
		debuffs: [],
		keyItemCooldownUntil: 0,
		...overrides,
	};
}

function setupPlayingRun() {
	gameState.gamePhase = 'playing';
	gameState.run = {
		status: 'playing',
		objective: { type: 'defeat_enemies', current: 0, target: 1 },
	};
}

function setupCardCaster(cardId, casterOverrides = {}) {
	const cardDef = CARD_DEFS[cardId];
	const playerId = 'caster';
	addPlayer(playerId, {
		hand: [{
			id: cardId,
			name: cardDef.name,
			type: cardDef.type,
			remainingCharges: cardDef.charges || 1,
			grind: 0,
		}, null, null, null],
		...casterOverrides,
	});
	setupPlayingRun();
	return {
		playerId,
		cardDef,
		socket: { playerId, emit: () => {} },
		lobby: { id: 'lobby1', state: gameState },
		cast(extra = {}) {
			handleUseCard(
				this.socket,
				gameState,
				this.lobby,
				{ cardId, slotIndex: 0, rotation: 0, ...extra },
			);
		},
	};
}

function radialOptions(casterY = CASTER_Y) {
	return { originY: casterY };
}

describe('frost_nova spherical height integration', () => {
	beforeEach(() => {
		resetState();
		wireCallbacks();
	});

	it('freezes an in-sphere target at a different height with constant horizontal offset', () => {
		const def = CARD_DEFS.frost_nova;
		addEnemy('in-sphere', H_OFFSET, 0, 100, IN_SPHERE_Y);
		const hpBefore = gameState.enemies[0].hp;

		const caster = setupCardCaster('frost_nova', { y: CASTER_Y });
		caster.cast();

		expect(gameState.enemies[0].hp).toBe(hpBefore - def.damage);
		expect(isEnemyFrozen(gameState.enemies[0])).toBe(true);
	});

	it('skips an out-of-sphere target at the same horizontal offset', () => {
		addEnemy('out-sphere', H_OFFSET, 0, 100, OUT_SPHERE_Y);
		const hpBefore = gameState.enemies[0].hp;

		const caster = setupCardCaster('frost_nova', { y: CASTER_Y });
		caster.cast();

		expect(gameState.enemies[0].hp).toBe(hpBefore);
		expect(gameState.enemies[0].frozenUntil).toBeUndefined();
	});
});

describe('glacier_collapse spherical height integration', () => {
	beforeEach(() => {
		resetState();
		wireCallbacks();
	});

	it('damages and freezes an in-sphere target at a different height', () => {
		const def = CARD_DEFS.glacier_collapse;
		addEnemy('in-sphere', H_OFFSET, 0, 100, IN_SPHERE_Y);
		const hpBefore = gameState.enemies[0].hp;

		applyFreezeInRadius(
			0,
			0,
			def.radius || SUMMON_RADIUS,
			def.freezeDurationMs,
			def.damage,
			def.frozenBonusDamage,
			radialOptions(),
		);

		expect(gameState.enemies[0].hp).toBe(hpBefore - def.damage);
		expect(isEnemyFrozen(gameState.enemies[0])).toBe(true);
	});

	it('skips an out-of-sphere target at the same horizontal offset', () => {
		const def = CARD_DEFS.glacier_collapse;
		addEnemy('out-sphere', H_OFFSET, 0, 100, OUT_SPHERE_Y);
		const hpBefore = gameState.enemies[0].hp;

		applyFreezeInRadius(
			0,
			0,
			def.radius || SUMMON_RADIUS,
			def.freezeDurationMs,
			def.damage,
			def.frozenBonusDamage,
			radialOptions(),
		);

		expect(gameState.enemies[0].hp).toBe(hpBefore);
		expect(gameState.enemies[0].frozenUntil).toBeUndefined();
	});
});

describe('inferno_pillar spherical height integration', () => {
	beforeEach(() => {
		resetState();
		wireCallbacks();
	});

	it('radial burst hits an in-sphere elevated target', () => {
		const def = CARD_DEFS.inferno_pillar;
		addEnemy('in-sphere', H_OFFSET, 0, 100, IN_SPHERE_Y);
		const hpBefore = gameState.enemies[0].hp;

		const caster = setupCardCaster('inferno_pillar', { y: CASTER_Y });
		caster.cast();

		expect(gameState.enemies[0].hp).toBe(hpBefore - def.damage);
	});

	it('radial burst skips an out-of-sphere target at the same horizontal offset', () => {
		const def = CARD_DEFS.inferno_pillar;
		addEnemy('out-sphere', H_OFFSET, 0, 100, OUT_SPHERE_Y);
		const hpBefore = gameState.enemies[0].hp;

		const caster = setupCardCaster('inferno_pillar', { y: CASTER_Y });
		caster.cast();

		expect(gameState.enemies[0].hp).toBe(hpBefore);
	});

	it('DoT tick damages an in-sphere elevated target', () => {
		const def = CARD_DEFS.inferno_pillar;
		addEnemy('in-sphere', H_OFFSET, 0, 100, IN_SPHERE_Y);
		spawnInfernoPillarEffect(0, 0, def, 'caster', radialOptions());
		gameState.areaEffects[0].lastTickAt = Date.now() - def.dotIntervalMs;
		const hpBefore = gameState.enemies[0].hp;

		updateAreaEffects();

		expect(gameState.enemies[0].hp).toBe(hpBefore - def.damage);
	});

	it('DoT tick skips an out-of-sphere target at the same horizontal offset', () => {
		const def = CARD_DEFS.inferno_pillar;
		addEnemy('out-sphere', H_OFFSET, 0, 100, OUT_SPHERE_Y);
		spawnInfernoPillarEffect(0, 0, def, 'caster', radialOptions());
		gameState.areaEffects[0].lastTickAt = Date.now() - def.dotIntervalMs;
		const hpBefore = gameState.enemies[0].hp;

		updateAreaEffects();

		expect(gameState.enemies[0].hp).toBe(hpBefore);
	});
});

describe('purifying_pulse spherical height integration', () => {
	beforeEach(() => {
		resetState();
		wireCallbacks();
	});

	it('heals an in-sphere ally at a different height with constant horizontal offset', () => {
		const def = CARD_DEFS.purifying_pulse;
		addPlayer('caster', { x: 0, z: 0, y: CASTER_Y, hp: 40 });
		addPlayer('ally', { x: H_OFFSET, z: 0, y: IN_SPHERE_Y, hp: 40 });

		const healed = healPlayersInRadius(0, 0, def.radius, def.healAmount, radialOptions());

		expect(healed).toEqual([
			{ playerId: 'caster', hpGained: def.healAmount, cleansed: true },
			{ playerId: 'ally', hpGained: def.healAmount, cleansed: true },
		]);
		expect(gameState.players.ally.hp).toBe(40 + def.healAmount);
	});

	it('skips an out-of-sphere ally at the same horizontal offset', () => {
		const def = CARD_DEFS.purifying_pulse;
		addPlayer('caster', { x: 0, z: 0, y: CASTER_Y, hp: 40 });
		addPlayer('ally', { x: H_OFFSET, z: 0, y: OUT_SPHERE_Y, hp: 40 });

		const healed = healPlayersInRadius(0, 0, def.radius, def.healAmount, radialOptions());

		expect(healed).toEqual([
			{ playerId: 'caster', hpGained: def.healAmount, cleansed: true },
		]);
		expect(gameState.players.ally.hp).toBe(40);
	});
});

describe('event_horizon spherical height integration', () => {
	beforeEach(() => {
		resetState();
		wireCallbacks();
	});

	it('pulls an in-sphere elevated enemy and crushes one at the center height', () => {
		const def = CARD_DEFS.event_horizon;
		addEnemy('pulled', PULL_OFFSET, 0, 100, IN_SPHERE_Y);
		addEnemy('crushed', 0, 0, 100, IN_CRUSH_Y);
		const crushedHpBefore = gameState.enemies[1].hp;

		const { pulled, crushed } = applyEventHorizon(0, 0, def, 'caster', radialOptions());

		expect(pulled.some((entry) => entry.enemyId === 'pulled')).toBe(true);
		expect(crushed.some((entry) => entry.enemyId === 'crushed')).toBe(true);
		expect(gameState.enemies[1].hp).toBe(crushedHpBefore - def.centerDamage);
	});

	it('skips pull and crush for out-of-sphere targets at the same horizontal offsets', () => {
		const def = CARD_DEFS.event_horizon;
		addEnemy('far-pull', PULL_OFFSET, 0, 100, OUT_SPHERE_Y);
		addEnemy('far-crush', 0, 0, 100, OUT_SPHERE_Y);
		const crushedHpBefore = gameState.enemies[1].hp;

		const { pulled, crushed } = applyEventHorizon(0, 0, def, 'caster', radialOptions());

		expect(pulled).toHaveLength(0);
		expect(crushed).toHaveLength(0);
		expect(gameState.enemies[1].hp).toBe(crushedHpBefore);
	});
});

describe('gravity_well spherical height integration', () => {
	beforeEach(() => {
		resetState();
		wireCallbacks();
	});

	it('pulls an in-sphere elevated enemy', () => {
		const def = CARD_DEFS.gravity_well;
		addEnemy('in-sphere', PULL_OFFSET, 0, 100, IN_SPHERE_Y);

		const pulled = pullEnemiesToward(
			0,
			0,
			def.pullRadius,
			def.pullStrength,
			radialOptions(),
		);

		expect(pulled).toHaveLength(1);
		expect(pulled[0].enemyId).toBe('in-sphere');
	});

	it('skips an out-of-sphere enemy at the same horizontal offset', () => {
		const def = CARD_DEFS.gravity_well;
		addEnemy('out-sphere', PULL_OFFSET, 0, 100, OUT_SPHERE_Y);

		const pulled = pullEnemiesToward(
			0,
			0,
			def.pullRadius,
			def.pullStrength,
			radialOptions(),
		);

		expect(pulled).toHaveLength(0);
	});
});

describe('dragons_breath spherical height integration', () => {
	beforeEach(() => {
		resetState();
		wireCallbacks();
	});

	it('initial cone burst hits an elevated in-sphere target with tilted aim', () => {
		const def = CARD_DEFS.dragons_breath;
		addEnemy('in-sphere', H_OFFSET, 0, 100, IN_SPHERE_Y);
		const hpBefore = gameState.enemies[0].hp;

		const caster = setupCardCaster('dragons_breath', { y: CASTER_Y });
		caster.cast({ lockTargetId: 'in-sphere' });

		expect(gameState.enemies[0].hp).toBeLessThan(hpBefore);
	});

	it('initial cone burst misses an elevated out-of-sphere target with flat aim', () => {
		addEnemy('out-sphere', H_OFFSET, 0, 100, OUT_SPHERE_Y);
		const hpBefore = gameState.enemies[0].hp;
		const def = CARD_DEFS.dragons_breath;
		const range = def.attackRange || 7;
		const coneAngle = def.attackConeAngle || Math.PI / 3;

		const flat = collectConeHits(0, 0, 1, 0, range, coneAngle, def.damage, radialOptions());
		expect(flat.hits).toHaveLength(0);

		const caster = setupCardCaster('dragons_breath', { y: CASTER_Y });
		caster.cast({ rotation: 0 });

		expect(gameState.enemies[0].hp).toBe(hpBefore);
	});

	it('DoT tick damages an elevated in-sphere target with tilted aim', () => {
		const def = CARD_DEFS.dragons_breath;
		addEnemy('in-sphere', H_OFFSET, 0, 100, IN_SPHERE_Y);

		const caster = setupCardCaster('dragons_breath', { y: CASTER_Y });
		caster.cast({ lockTargetId: 'in-sphere' });
		const hpAfterBurst = gameState.enemies[0].hp;

		expect(gameState.areaEffects).toHaveLength(1);
		gameState.areaEffects[0].lastTickAt = Date.now() - def.dotIntervalMs;
		updateAreaEffects();

		expect(gameState.enemies[0].hp).toBe(hpAfterBurst - def.damage);
	});

	it('DoT tick skips an elevated out-of-sphere target with flat aim', () => {
		const def = CARD_DEFS.dragons_breath;
		addEnemy('out-sphere', H_OFFSET, 0, 100, OUT_SPHERE_Y);
		const hpBefore = gameState.enemies[0].hp;

		const caster = setupCardCaster('dragons_breath', { y: CASTER_Y });
		caster.cast({ rotation: 0 });

		expect(gameState.enemies[0].hp).toBe(hpBefore);
		expect(gameState.areaEffects).toHaveLength(1);
		gameState.areaEffects[0].lastTickAt = Date.now() - def.dotIntervalMs;
		updateAreaEffects();

		expect(gameState.enemies[0].hp).toBe(hpBefore);
	});
});

describe('field_medic_kit spherical height integration', () => {
	beforeEach(() => {
		resetState();
		wireCallbacks();
	});

	it('heals an in-sphere ally at a different height via the key-item handler', () => {
		const def = KEY_ITEM_DEFS.field_medic_kit;
		setupPlayingRun();
		addPlayer('caster', { x: 0, z: 0, y: CASTER_Y, hp: 20, keyItemCooldownUntil: 0 });
		addPlayer('ally', { x: H_OFFSET, z: 0, y: IN_SPHERE_Y, hp: 20 });

		const socket = { playerId: 'caster', emit: vi.fn() };
		handleUseKeyItem(socket, gameState, { id: 'lobby1' }, { keyItemId: 'field_medic_kit' });

		expect(gameState.players.caster.hp).toBe(20 + def.hpRestore);
		expect(gameState.players.ally.hp).toBe(20 + def.hpRestore);
	});

	it('skips an out-of-sphere ally at the same horizontal offset', () => {
		const def = KEY_ITEM_DEFS.field_medic_kit;
		setupPlayingRun();
		addPlayer('caster', { x: 0, z: 0, y: CASTER_Y, hp: 20, keyItemCooldownUntil: 0 });
		addPlayer('ally', { x: H_OFFSET, z: 0, y: OUT_SPHERE_Y, hp: 20 });

		const socket = { playerId: 'caster', emit: vi.fn() };
		handleUseKeyItem(socket, gameState, { id: 'lobby1' }, { keyItemId: 'field_medic_kit' });

		expect(gameState.players.caster.hp).toBe(20 + def.hpRestore);
		expect(gameState.players.ally.hp).toBe(20);
	});
});
