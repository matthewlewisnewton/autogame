import { describe, it, expect, beforeEach } from 'vitest';
import {
	gameState,
	createGameState,
	updateEnemies,
	computeWalkableAABBs,
} from '../index.js';
import {
	DIFFICULTY_ENEMY_DAMAGE_PER_PLAYER,
	difficultyScaleFactor,
} from '../config.js';

// ── Helpers ──

/**
 * Reset game state in-place so simulation._gameState (which points at the same
 * gameState object) keeps seeing the updated contents. Mirrors guard_block.test.js.
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

function buildLayout() {
	return {
		rooms: [{ x: 0, z: 0, width: 12, depth: 12, walls: [] }],
		passages: [],
	};
}

function setupLayout() {
	const layout = buildLayout();
	gameState.layout = layout;
	gameState.walkableAABBs = computeWalkableAABBs(layout);
	gameState.dungeonBounds = { minX: -20, maxX: 40, minZ: -20, maxZ: 20 };
}

const BASE_DAMAGE = 20;

/** Plain target player with a huge HP pool so damage never clamps at 0. */
function makeTargetPlayer() {
	return { x: 0, y: 0.5, z: 0, rotation: 0, hp: 1e6, dead: false, extracted: false };
}

/** Minimal filler player so runPlayerCount() sees a larger party. */
function makeFillerPlayer(i) {
	return { x: 100 + i, y: 0.5, z: 100, rotation: 0, hp: 1e6, dead: false, extracted: false };
}

/**
 * Populate gameState.players with `count` players: 'p1' is the strike target,
 * the rest are far-away fillers that only exist to raise the live count.
 */
function setPartySize(count) {
	Object.keys(gameState.players).forEach((k) => delete gameState.players[k]);
	gameState.players['p1'] = makeTargetPlayer();
	for (let i = 2; i <= count; i++) {
		gameState.players[`p${i}`] = makeFillerPlayer(i);
	}
}

/**
 * Place an enemy adjacent to p1, poised at the end of its wind-up so the very
 * next updateEnemies() resolves the strike against p1. chaseSpeed is set so
 * ensureEnemyCombatStats() does not backfill (and overwrite attackDamage).
 */
function poiseEnemyToStrike() {
	const enemy = {
		id: 'striker',
		type: 'grunt',
		x: 1,
		y: 0.5,
		z: 0,
		hp: 50,
		maxHp: 50,
		dead: false,
		attackState: 'windup',
		windupStartTime: Date.now() - 10000,
		attackWindupMs: 100,
		windupTargetId: 'p1',
		windupTargetType: 'player',
		attackDamage: BASE_DAMAGE,
		chaseSpeed: 2,
	};
	gameState.enemies.length = 0;
	gameState.enemies.push(enemy);
	return enemy;
}

/** Run one strike against p1 at the current party size; return HP lost by p1. */
function strikeDamageAtCurrentParty() {
	poiseEnemyToStrike();
	const before = gameState.players['p1'].hp;
	updateEnemies();
	return before - gameState.players['p1'].hp;
}

// ── Tests ──

describe('Enemy damage scaling with party size', () => {
	beforeEach(() => {
		resetState();
		setupLayout();
	});

	it('1–4 players take baseline (unscaled) damage', () => {
		for (const count of [1, 2, 3, 4]) {
			setPartySize(count);
			const dealt = strikeDamageAtCurrentParty();
			expect(dealt).toBeCloseTo(BASE_DAMAGE, 5);
		}
	});

	it('5..16 players take damage scaled by difficultyScaleFactor', () => {
		for (const count of [5, 8, 12, 16]) {
			setPartySize(count);
			const expected = BASE_DAMAGE * difficultyScaleFactor(count, DIFFICULTY_ENEMY_DAMAGE_PER_PLAYER);
			const dealt = strikeDamageAtCurrentParty();
			expect(dealt).toBeGreaterThan(BASE_DAMAGE);
			expect(dealt).toBeCloseTo(expected, 5);
		}
	});

	it('a mid-run JOIN raises subsequent strike damage; a LEAVE lowers it', () => {
		// Start at baseline party of 4 → unscaled.
		setPartySize(4);
		const baseline = strikeDamageAtCurrentParty();
		expect(baseline).toBeCloseTo(BASE_DAMAGE, 5);

		// JOIN: party grows to 10 → next strike hits harder.
		setPartySize(10);
		const afterJoin = strikeDamageAtCurrentParty();
		expect(afterJoin).toBeGreaterThan(baseline);
		expect(afterJoin).toBeCloseTo(
			BASE_DAMAGE * difficultyScaleFactor(10, DIFFICULTY_ENEMY_DAMAGE_PER_PLAYER),
			5,
		);

		// LEAVE: party shrinks back to 6 → next strike is weaker than the peak,
		// still above baseline. The enemy's stored stat was never mutated.
		setPartySize(6);
		const afterLeave = strikeDamageAtCurrentParty();
		expect(afterLeave).toBeLessThan(afterJoin);
		expect(afterLeave).toBeGreaterThan(baseline);
		expect(afterLeave).toBeCloseTo(
			BASE_DAMAGE * difficultyScaleFactor(6, DIFFICULTY_ENEMY_DAMAGE_PER_PLAYER),
			5,
		);

		// LEAVE back below threshold → fully baseline again.
		setPartySize(3);
		const afterDrop = strikeDamageAtCurrentParty();
		expect(afterDrop).toBeCloseTo(BASE_DAMAGE, 5);
	});

	it('does not mutate the enemy stored attackDamage stat', () => {
		setPartySize(12);
		const enemy = poiseEnemyToStrike();
		updateEnemies();
		expect(enemy.attackDamage).toBe(BASE_DAMAGE);
	});
});
