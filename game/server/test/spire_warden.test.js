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

const BASE_SPIRE_WARDEN_HP = ENEMY_DEFS.spire_warden.hp;

describe('spire_warden enemy type', () => {
	beforeEach(() => {
		resetState();
	});

	it('is registered in ENEMY_DEFS with summit display metadata', () => {
		const def = ENEMY_DEFS.spire_warden;
		expect(def.name).toBe('Summit Warden');
		expect(def.description.length).toBeGreaterThan(0);
		expect(def.surfacedStats).toContain('hp');
		expect(def.hp).toBeGreaterThan(ENEMY_DEFS.miniboss.hp);
	});

	it('spawnEnemy succeeds and exposes type plus baseline combat stats', () => {
		setPartySize(2);
		const warden = spawnEnemy(3, 4, 'spire_warden');
		expect(warden.type).toBe('spire_warden');
		expect(warden.hp).toBe(BASE_SPIRE_WARDEN_HP);
		expect(warden.maxHp).toBe(BASE_SPIRE_WARDEN_HP);
		expect(warden.attackDamage).toBe(ENEMY_DEFS.spire_warden.attackDamage);
		expect(warden.attackRange).toBe(ENEMY_DEFS.spire_warden.attackRange);
		expect(warden).not.toHaveProperty('name');
	});

	it('has boss-tier card and magic stone drops at least as generous as miniboss', () => {
		expect(getEnemyCardDrop({ type: 'spire_warden' })).toBe('dungeon_drake');
		expect(getEnemyMagicStoneDrop({ type: 'spire_warden' })).toBeGreaterThanOrEqual(
			getEnemyMagicStoneDrop({ type: 'miniboss' }),
		);
	});
});

describe('spire_warden HP scaling with party size at spawn', () => {
	beforeEach(() => {
		resetState();
	});

	it('1–4 players spawn a baseline-HP spire_warden', () => {
		for (const count of [1, 2, 3, 4]) {
			gameState.enemies.length = 0;
			setPartySize(count);
			const warden = spawnEnemy(0, 0, 'spire_warden');
			expect(warden.hp).toBe(BASE_SPIRE_WARDEN_HP);
			expect(warden.maxHp).toBe(BASE_SPIRE_WARDEN_HP);
		}
	});

	it('5..16 players spawn a spire_warden with scaled hp/maxHp', () => {
		for (const count of [5, 8, 12, 16]) {
			gameState.enemies.length = 0;
			setPartySize(count);
			const expected = Math.round(
				BASE_SPIRE_WARDEN_HP * difficultyScaleFactor(count, DIFFICULTY_MINIBOSS_HP_PER_PLAYER),
			);
			const warden = spawnEnemy(0, 0, 'spire_warden');
			expect(warden.hp).toBeGreaterThan(BASE_SPIRE_WARDEN_HP);
			expect(warden.hp).toBe(expected);
			expect(warden.maxHp).toBe(expected);
		}
	});

	it('HP is fixed at spawn when party size changes after spawn', () => {
		setPartySize(4);
		const warden = spawnEnemy(0, 0, 'spire_warden');
		expect(warden.hp).toBe(BASE_SPIRE_WARDEN_HP);

		setPartySize(16);
		expect(warden.hp).toBe(BASE_SPIRE_WARDEN_HP);
		expect(warden.maxHp).toBe(BASE_SPIRE_WARDEN_HP);
	});
});
