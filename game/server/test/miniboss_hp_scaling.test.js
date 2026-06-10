import { describe, it, expect, beforeEach } from 'vitest';
import {
	gameState,
	createGameState,
	spawnEnemy,
	ENEMY_DEFS,
} from '../index.js';
import {
	DIFFICULTY_MINIBOSS_HP_PER_PLAYER,
	difficultyScaleFactor,
} from '../config.js';

// ── Helpers ──

/**
 * Reset game state in-place so progression._gameState (which points at the same
 * gameState object) keeps seeing the updated contents. Mirrors enemy_damage_scaling.test.js.
 */
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

/** Minimal filler player so runPlayerCount() sees a party of the given size. */
function makePlayer(i) {
	return { x: i, y: 0.5, z: 0, rotation: 0, hp: 100, dead: false, extracted: false };
}

/** Populate gameState.players with exactly `count` players. */
function setPartySize(count) {
	Object.keys(gameState.players).forEach((k) => delete gameState.players[k]);
	for (let i = 1; i <= count; i++) {
		gameState.players[`p${i}`] = makePlayer(i);
	}
}

const BASE_MINIBOSS_HP = ENEMY_DEFS.miniboss.hp;

// ── Tests ──

describe('Miniboss HP scaling with party size at spawn', () => {
	beforeEach(() => {
		resetState();
	});

	it('1–4 players spawn a baseline-HP miniboss', () => {
		for (const count of [1, 2, 3, 4]) {
			gameState.enemies.length = 0;
			setPartySize(count);
			const miniboss = spawnEnemy(gameState, 0, 0, 'miniboss');
			expect(miniboss.hp).toBe(BASE_MINIBOSS_HP);
			expect(miniboss.maxHp).toBe(BASE_MINIBOSS_HP);
		}
	});

	it('5..16 players spawn a miniboss with scaled hp/maxHp', () => {
		for (const count of [5, 8, 12, 16]) {
			gameState.enemies.length = 0;
			setPartySize(count);
			const expected = Math.round(
				BASE_MINIBOSS_HP * difficultyScaleFactor(count, DIFFICULTY_MINIBOSS_HP_PER_PLAYER),
			);
			const miniboss = spawnEnemy(gameState, 0, 0, 'miniboss');
			expect(miniboss.hp).toBeGreaterThan(BASE_MINIBOSS_HP);
			expect(miniboss.hp).toBe(expected);
			expect(miniboss.maxHp).toBe(expected);
		}
	});

	it('a higher-count spawn yields a higher-HP miniboss than a lower-count spawn', () => {
		setPartySize(6);
		const small = spawnEnemy(gameState, 0, 0, 'miniboss');
		setPartySize(14);
		const big = spawnEnemy(gameState, 5, 0, 'miniboss');
		expect(big.hp).toBeGreaterThan(small.hp);
		expect(big.maxHp).toBeGreaterThan(small.maxHp);
	});

	it('non-miniboss enemy types are unaffected by party size', () => {
		setPartySize(16);
		for (const type of ['grunt', 'skirmisher', 'spawner']) {
			gameState.enemies.length = 0;
			const baseHp = ENEMY_DEFS[type].hp;
			const enemy = spawnEnemy(gameState, 0, 0, type);
			expect(enemy.hp).toBe(baseHp);
			expect(enemy.maxHp).toBe(baseHp);
		}
	});

	it('HP is fixed at spawn: a mid-run JOIN/LEAVE does not rescale an existing miniboss', () => {
		// Spawn at a baseline party → unscaled HP.
		setPartySize(4);
		const miniboss = spawnEnemy(gameState, 0, 0, 'miniboss');
		expect(miniboss.hp).toBe(BASE_MINIBOSS_HP);
		expect(miniboss.maxHp).toBe(BASE_MINIBOSS_HP);

		// JOIN: party grows well past the threshold. The existing miniboss must not change.
		setPartySize(16);
		expect(miniboss.hp).toBe(BASE_MINIBOSS_HP);
		expect(miniboss.maxHp).toBe(BASE_MINIBOSS_HP);

		// A newly spawned miniboss at the larger party IS scaled, proving the count is live —
		// only the already-spawned one is frozen.
		const scaled = spawnEnemy(gameState, 5, 0, 'miniboss');
		expect(scaled.hp).toBeGreaterThan(BASE_MINIBOSS_HP);

		// LEAVE: party shrinks. Neither existing miniboss is retroactively rescaled.
		const scaledHpBefore = scaled.hp;
		setPartySize(2);
		expect(miniboss.hp).toBe(BASE_MINIBOSS_HP);
		expect(miniboss.maxHp).toBe(BASE_MINIBOSS_HP);
		expect(scaled.hp).toBe(scaledHpBefore);
	});
});
