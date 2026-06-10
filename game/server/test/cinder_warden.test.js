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

const BASE_CINDER_WARDEN_HP = ENEMY_DEFS.cinder_warden.hp;

describe('cinder_warden enemy type', () => {
	beforeEach(() => {
		resetState();
	});

	it('is registered in ENEMY_DEFS with fire-themed stage-boss metadata', () => {
		const def = ENEMY_DEFS.cinder_warden;
		expect(def.name).toBe('Cinder Warden');
		expect(def.description.length).toBeGreaterThan(0);
		expect(def.surfacedStats).toEqual(['hp', 'attackDamage', 'attackStyle', 'attackRange']);
		// Sized as a level-1 stage boss: heavier than the generic miniboss (300),
		// lighter than spire_warden / arena_champion (420).
		expect(def.hp).toBeGreaterThan(ENEMY_DEFS.miniboss.hp);
		expect(def.hp).toBeGreaterThanOrEqual(340);
		expect(def.hp).toBeLessThanOrEqual(380);
		expect(def.hp).toBeLessThan(ENEMY_DEFS.spire_warden.hp);
		expect(['cone', 'radial']).toContain(def.attackStyle);
		expect(def.attackDamage).toBeGreaterThan(0);
		expect(def.attackWindupMs).toBeGreaterThan(0);
		expect(def.attackRange).toBeGreaterThan(0);
	});

	it('spawnEnemy succeeds and exposes type plus baseline combat stats', () => {
		setPartySize(2);
		const warden = spawnEnemy(3, 4, 'cinder_warden');
		expect(warden.type).toBe('cinder_warden');
		expect(warden.hp).toBe(BASE_CINDER_WARDEN_HP);
		expect(warden.maxHp).toBe(BASE_CINDER_WARDEN_HP);
		expect(warden.attackDamage).toBe(ENEMY_DEFS.cinder_warden.attackDamage);
		expect(warden.attackRange).toBe(ENEMY_DEFS.cinder_warden.attackRange);
		expect(warden).not.toHaveProperty('name');
	});

	it('drops a dungeon_drake card and a stage-boss magic stone value', () => {
		expect(getEnemyCardDrop({ type: 'cinder_warden' })).toBe('dungeon_drake');
		const ms = getEnemyMagicStoneDrop({ type: 'cinder_warden' });
		expect(ms).toBeGreaterThanOrEqual(50);
		expect(ms).toBeLessThanOrEqual(55);
		expect(ms).toBeGreaterThanOrEqual(getEnemyMagicStoneDrop({ type: 'miniboss' }));
	});
});

describe('cinder_warden HP scaling with party size at spawn', () => {
	beforeEach(() => {
		resetState();
	});

	it('1–4 players spawn a baseline-HP cinder_warden', () => {
		for (const count of [1, 2, 3, 4]) {
			gameState.enemies.length = 0;
			setPartySize(count);
			const warden = spawnEnemy(0, 0, 'cinder_warden');
			expect(warden.hp).toBe(BASE_CINDER_WARDEN_HP);
			expect(warden.maxHp).toBe(BASE_CINDER_WARDEN_HP);
		}
	});

	it('5..16 players spawn a cinder_warden with scaled hp/maxHp', () => {
		for (const count of [5, 8, 12, 16]) {
			gameState.enemies.length = 0;
			setPartySize(count);
			const expected = Math.round(
				BASE_CINDER_WARDEN_HP * difficultyScaleFactor(count, DIFFICULTY_MINIBOSS_HP_PER_PLAYER),
			);
			const warden = spawnEnemy(0, 0, 'cinder_warden');
			expect(warden.hp).toBeGreaterThan(BASE_CINDER_WARDEN_HP);
			expect(warden.hp).toBe(expected);
			expect(warden.maxHp).toBe(expected);
		}
	});

	it('HP is fixed at spawn when party size changes after spawn', () => {
		setPartySize(4);
		const warden = spawnEnemy(0, 0, 'cinder_warden');
		expect(warden.hp).toBe(BASE_CINDER_WARDEN_HP);

		setPartySize(16);
		expect(warden.hp).toBe(BASE_CINDER_WARDEN_HP);
		expect(warden.maxHp).toBe(BASE_CINDER_WARDEN_HP);
	});
});
