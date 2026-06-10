import { describe, it, expect, beforeEach } from 'vitest';
import {
	gameState,
	createGameState,
	spawnEnemy,
	ENEMY_DEFS,
	getEnemyCardDrop,
	getEnemyMagicStoneDrop,
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

function setPartySize(count) {
	Object.keys(gameState.players).forEach((k) => delete gameState.players[k]);
	for (let i = 1; i <= count; i++) {
		gameState.players[`p${i}`] = makePlayer(i);
	}
}

const BASE_MAGMA_COLOSSUS_HP = ENEMY_DEFS.magma_colossus.hp;

describe('magma_colossus enemy type', () => {
	beforeEach(() => {
		resetState();
	});

	it('is registered in ENEMY_DEFS with fire-themed stage-boss metadata', () => {
		const def = ENEMY_DEFS.magma_colossus;
		expect(def.name).toBe('Magma Colossus');
		expect(def.description.length).toBeGreaterThan(0);
		expect(def.surfacedStats).toEqual(['hp', 'attackDamage', 'attackStyle', 'attackRange']);
		// Tier-II stage boss: heavier than cinder_warden (360), comparable to spire_warden (420).
		expect(def.hp).toBeGreaterThan(ENEMY_DEFS.cinder_warden.hp);
		expect(def.hp).toBeGreaterThanOrEqual(400);
		expect(def.hp).toBeLessThanOrEqual(420);
		expect(['cone', 'radial']).toContain(def.attackStyle);
		expect(def.attackDamage).toBeGreaterThan(0);
		expect(def.attackWindupMs).toBeGreaterThan(0);
		expect(def.attackRange).toBeGreaterThan(0);
	});

	it('spawnEnemy succeeds and exposes type plus baseline combat stats', () => {
		setPartySize(2);
		const colossus = spawnEnemy(3, 4, 'magma_colossus');
		expect(colossus.type).toBe('magma_colossus');
		expect(colossus.hp).toBe(BASE_MAGMA_COLOSSUS_HP);
		expect(colossus.maxHp).toBe(BASE_MAGMA_COLOSSUS_HP);
		expect(colossus.attackDamage).toBe(ENEMY_DEFS.magma_colossus.attackDamage);
		expect(colossus.attackRange).toBe(ENEMY_DEFS.magma_colossus.attackRange);
		expect(colossus).not.toHaveProperty('name');
	});

	it('drops a dungeon_drake card and a stage-boss magic stone value', () => {
		expect(getEnemyCardDrop({ type: 'magma_colossus' })).toBe('dungeon_drake');
		const ms = getEnemyMagicStoneDrop({ type: 'magma_colossus' });
		expect(ms).toBeGreaterThanOrEqual(52);
		expect(ms).toBeLessThanOrEqual(55);
		expect(ms).toBeGreaterThanOrEqual(getEnemyMagicStoneDrop({ type: 'miniboss' }));
	});
});

describe('magma_colossus HP scaling with party size at spawn', () => {
	beforeEach(() => {
		resetState();
	});

	it('1–4 players spawn a baseline-HP magma_colossus', () => {
		for (const count of [1, 2, 3, 4]) {
			gameState.enemies.length = 0;
			setPartySize(count);
			const colossus = spawnEnemy(0, 0, 'magma_colossus');
			expect(colossus.hp).toBe(BASE_MAGMA_COLOSSUS_HP);
			expect(colossus.maxHp).toBe(BASE_MAGMA_COLOSSUS_HP);
		}
	});

	it('5..16 players spawn a magma_colossus with scaled hp/maxHp', () => {
		for (const count of [5, 8, 12, 16]) {
			gameState.enemies.length = 0;
			setPartySize(count);
			const expected = Math.round(
				BASE_MAGMA_COLOSSUS_HP * difficultyScaleFactor(count, DIFFICULTY_MINIBOSS_HP_PER_PLAYER),
			);
			const colossus = spawnEnemy(0, 0, 'magma_colossus');
			expect(colossus.hp).toBeGreaterThan(BASE_MAGMA_COLOSSUS_HP);
			expect(colossus.hp).toBe(expected);
			expect(colossus.maxHp).toBe(expected);
		}
	});

	it('HP is fixed at spawn when party size changes after spawn', () => {
		setPartySize(4);
		const colossus = spawnEnemy(0, 0, 'magma_colossus');
		expect(colossus.hp).toBe(BASE_MAGMA_COLOSSUS_HP);

		setPartySize(16);
		expect(colossus.hp).toBe(BASE_MAGMA_COLOSSUS_HP);
		expect(colossus.maxHp).toBe(BASE_MAGMA_COLOSSUS_HP);
	});
});
