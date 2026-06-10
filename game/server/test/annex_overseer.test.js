import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	gameState,
	createGameState,
	spawnEnemy,
	updateEnemies,
	ENEMY_DEFS,
	getEnemyCardDrop,
	getEnemyMagicStoneDrop,
	getEnemyCurrencyDrop,
} from '../index.js';
import {
	DIFFICULTY_MINIBOSS_HP_PER_PLAYER,
	difficultyScaleFactor,
} from '../config.js';

function resetState() {
	const fresh = createGameState();
	Object.keys(gameState.players).forEach((k) => delete gameState.players[k]);
	gameState.enemies.length = 0;
	gameState.minions.length = 0;
	gameState.loot.length = 0;
	gameState.areaEffects.length = 0;
	gameState.enchantments.length = 0;
	gameState.lobby.length = 0;
	gameState.gamePhase = fresh.gamePhase;
	gameState.selectedQuestId = fresh.selectedQuestId;
	gameState.pendingTrades = {};
	gameState.shopOffer = null;
	gameState.telepipe = null;
	gameState._pendingMinionBreaths = [];
	gameState.run = null;
}

function makePlayer(i) {
	return { x: i, y: 0.5, z: 0, rotation: 0, hp: 100, dead: false, extracted: false };
}

function addPlayer(id, overrides = {}) {
	gameState.players[id] = { id, x: 0, z: 0, hp: 100, dead: false, ...overrides };
}

function setPartySize(count) {
	Object.keys(gameState.players).forEach((k) => delete gameState.players[k]);
	for (let i = 1; i <= count; i++) {
		gameState.players[`p${i}`] = makePlayer(i);
	}
}

const BASE_OVERSEER_HP = ENEMY_DEFS.annex_overseer.hp;

describe('ENEMY_DEFS.annex_overseer', () => {
	it('defines Annex Overseer with radial area-denial stats distinct from miniboss', () => {
		expect(ENEMY_DEFS.annex_overseer.name).toBe('Annex Overseer');
		expect(ENEMY_DEFS.annex_overseer.attackStyle).toBe('radial');
		expect(ENEMY_DEFS.annex_overseer.attackRange).toBe(3.5);
		expect(ENEMY_DEFS.miniboss.attackStyle).toBe('cone');
		expect(ENEMY_DEFS.miniboss.attackRange).toBe(5);
		expect(ENEMY_DEFS.annex_overseer.surfacedStats).toContain('attackStyle');
		expect(ENEMY_DEFS.annex_overseer.surfacedStats).toContain('attackRange');
	});
});

describe('spawnEnemy(annex_overseer)', () => {
	beforeEach(() => resetState());

	it('spawns without throwing and copies combat stats from the def', () => {
		const overseer = spawnEnemy(2, 3, 'annex_overseer');
		expect(overseer.type).toBe('annex_overseer');
		expect(overseer.x).toBe(2);
		expect(overseer.z).toBe(3);
		expect(overseer.attackStyle).toBe('radial');
		expect(overseer.attackRange).toBe(ENEMY_DEFS.annex_overseer.attackRange);
		expect(overseer.hp).toBe(BASE_OVERSEER_HP);
		expect(overseer.maxHp).toBe(BASE_OVERSEER_HP);
	});

	it('scales HP for parties of 5+ using the miniboss scaling path', () => {
		setPartySize(8);
		const expected = Math.round(
			BASE_OVERSEER_HP * difficultyScaleFactor(8, DIFFICULTY_MINIBOSS_HP_PER_PLAYER),
		);
		const overseer = spawnEnemy(0, 0, 'annex_overseer');
		expect(overseer.hp).toBe(expected);
		expect(overseer.maxHp).toBe(expected);
		expect(overseer.hp).toBeGreaterThan(BASE_OVERSEER_HP);
	});
});

describe('annex_overseer loot hooks', () => {
	it('resolves currency, magic stones, and card drops like miniboss tier', () => {
		const enemy = { type: 'annex_overseer' };
		expect(getEnemyMagicStoneDrop(enemy)).toBe(50);
		expect(getEnemyCardDrop(enemy)).toBe('dungeon_drake');

		const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
		expect(getEnemyCurrencyDrop(enemy)).toBe(35);
		randomSpy.mockRestore();
	});
});

describe('annex_overseer radial attack style', () => {
	beforeEach(() => {
		resetState();
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2000, 0, 1));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('hits a player behind the locked windup direction within range', () => {
		const range = ENEMY_DEFS.annex_overseer.attackRange;
		const now = Date.now();

		addPlayer('p1', { id: 'p1', x: -(range - 0.5), z: 0, dead: false, hp: 100 });
		gameState.enemies.push({
			id: 'overseer1',
			x: 0,
			z: 0,
			type: 'annex_overseer',
			hp: 100,
			attackStyle: 'radial',
			attackRange: range,
			state: 'chasing',
			attackState: 'windup',
			windupTargetId: 'p1',
			windupStartTime: now - ENEMY_DEFS.annex_overseer.attackWindupMs - 100,
			windupDirX: 1,
			windupDirZ: 0,
			wanderTarget: { x: 0, z: 0 },
		});

		updateEnemies();

		expect(gameState.players.p1.hp).toBe(100 - ENEMY_DEFS.annex_overseer.attackDamage);
	});

	it('misses a player at the same (x, z) beyond vertical range', () => {
		const range = ENEMY_DEFS.annex_overseer.attackRange;
		const now = Date.now();

		addPlayer('p1', { id: 'p1', x: 0, z: 0, y: range + 1, dead: false, hp: 100 });
		gameState.enemies.push({
			id: 'overseer1',
			x: 0,
			z: 0,
			y: 0,
			type: 'annex_overseer',
			hp: 100,
			attackStyle: 'radial',
			attackRange: range,
			state: 'chasing',
			attackState: 'windup',
			windupTargetId: 'p1',
			windupStartTime: now - ENEMY_DEFS.annex_overseer.attackWindupMs - 100,
			windupDirX: 1,
			windupDirZ: 0,
			wanderTarget: { x: 0, z: 0 },
		});

		updateEnemies();

		expect(gameState.players.p1.hp).toBe(100);
	});

	it('contrasts with miniboss cone missing the same behind-the-back position', () => {
		const range = ENEMY_DEFS.miniboss.attackRange;
		const now = Date.now();

		addPlayer('p1', { id: 'p1', x: -(range - 0.5), z: 0, dead: false, hp: 100 });
		gameState.enemies.push({
			id: 'warden1',
			x: 0,
			z: 0,
			type: 'miniboss',
			hp: 100,
			attackStyle: 'cone',
			attackConeAngle: ENEMY_DEFS.miniboss.attackConeAngle,
			attackRange: range,
			state: 'chasing',
			attackState: 'windup',
			windupTargetId: 'p1',
			windupStartTime: now - ENEMY_DEFS.miniboss.attackWindupMs - 100,
			windupDirX: 1,
			windupDirZ: 0,
			wanderTarget: { x: 0, z: 0 },
		});

		updateEnemies();

		expect(gameState.players.p1.hp).toBe(100);
	});
});
