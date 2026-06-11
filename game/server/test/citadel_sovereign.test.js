import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	resetGameState,
	gameState,
	spawnEnemy,
	updateEnemies,
	isBurning,
	getEntityWorldY,
	computeAimDirection3D,
	ENEMY_DEFS,
	getEnemyCardDrop,
	getEnemyMagicStoneDrop,
} from '../index.js';
import { ENEMY_CARD_DROPS, ENEMY_MS_DROPS } from '../config.js';

const START = 2_000_000;

function setupPlayingRun() {
	gameState.gamePhase = 'playing';
	gameState.run = { status: 'playing' };
}

function addPlayer(id, overrides = {}) {
	gameState.players[id] = {
		id,
		x: 0,
		y: 0.5,
		z: 0,
		hp: 100,
		dead: false,
		...overrides,
	};
	return gameState.players[id];
}

function makeExpiredWindup(type, targetId, overrides = {}) {
	const def = ENEMY_DEFS[type];
	const now = Date.now();
	const enemy = spawnEnemy(0, 0, type);
	Object.assign(enemy, {
		attackState: 'windup',
		windupTargetId: targetId,
		windupTargetType: 'player',
		windupStartTime: now - def.attackWindupMs - 100,
		...overrides,
	});
	const target = gameState.players[targetId];
	if (target) {
		const aim = computeAimDirection3D(
			{ x: enemy.x, y: getEntityWorldY(enemy), z: enemy.z },
			{ x: target.x, y: getEntityWorldY(target), z: target.z },
		);
		enemy.windupDirX = aim.dirX;
		enemy.windupDirY = aim.dirY;
		enemy.windupDirZ = aim.dirZ;
	}
	return enemy;
}

describe('citadel_sovereign enemy def', () => {
	const def = ENEMY_DEFS.citadel_sovereign;

	it('is registered as the citadel capstone tyrant', () => {
		expect(def).toBeDefined();
		expect(def.name).toBe('Citadel Sovereign');
		expect(def.description.toLowerCase()).toContain('citadel');
		expect(def.description.toLowerCase()).toContain('capstone');
	});

	it('has the capstone combat stats from the ticket', () => {
		expect(def.hp).toBe(460);
		expect(def.attackDamage).toBe(30);
		expect(def.attackStyle).toBe('radial');
		expect(def.attackRange).toBe(6);
		expect(def.attackWindupMs).toBe(1200);
		expect(def.chaseSpeed).toBeCloseTo(1.15);
		expect(def.wanderSpeed).toBeCloseTo(0.5);
		expect(def.burnDurationMs).toBe(3500);
	});

	it('surfaces hp, attackDamage, attackStyle, attackRange, and burnDurationMs', () => {
		for (const stat of ['hp', 'attackDamage', 'attackStyle', 'attackRange', 'burnDurationMs']) {
			expect(def.surfacedStats).toContain(stat);
		}
	});

	it('ties the 460 HP defeatBoss validation ceiling without exceeding it', () => {
		// 500 HP could not be defeated inside the 180s defeatBoss validation
		// window (design.md), so 460 is a hard ceiling — the sovereign ties
		// riftbound_colossus there and must NOT exceed it.
		expect(def.hp).toBe(460);
		expect(def.hp).toBeLessThanOrEqual(460);
		expect(def.hp).toBe(ENEMY_DEFS.riftbound_colossus.hp);
	});

	it('out-damages every other entry in ENEMY_DEFS', () => {
		for (const [type, other] of Object.entries(ENEMY_DEFS)) {
			if (type === 'citadel_sovereign') continue;
			expect(
				def.attackDamage,
				`attackDamage must strictly exceed ${type}'s`,
			).toBeGreaterThan(other.attackDamage);
		}
	});
});

describe('citadel_sovereign drop registry', () => {
	it('drops a dungeon_drake card like the other stage bosses', () => {
		expect(ENEMY_CARD_DROPS.citadel_sovereign).toBe('dungeon_drake');
		expect(getEnemyCardDrop({ type: 'citadel_sovereign' })).toBe('dungeon_drake');
	});

	it('drops the highest magic stone value in the table', () => {
		expect(ENEMY_MS_DROPS.citadel_sovereign).toBe(90);
		expect(getEnemyMagicStoneDrop({ type: 'citadel_sovereign' })).toBe(90);
		for (const [type, value] of Object.entries(ENEMY_MS_DROPS)) {
			if (type === 'citadel_sovereign') continue;
			expect(value, `${type} must drop less than the sovereign`).toBeLessThan(90);
		}
	});
});

describe('citadel_sovereign radial strike applies BURNING', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(START);
		resetGameState();
		setupPlayingRun();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('resolved radial hit damages and ignites the player', () => {
		const def = ENEMY_DEFS.citadel_sovereign;
		const player = addPlayer('p1', { x: 3, z: 0, hp: 100 });
		const sovereign = makeExpiredWindup('citadel_sovereign', 'p1');

		updateEnemies();

		expect(player.hp).toBe(100 - def.attackDamage);
		expect(isBurning(player)).toBe(true);
		expect(player.burningUntil).toBe(START + def.burnDurationMs);
		expect(player.burningUntil).toBeGreaterThan(Date.now());
		expect(sovereign.attackState).toBe('recovering');
	});

	it('out-of-range windup cancels without damage or burn', () => {
		const def = ENEMY_DEFS.citadel_sovereign;
		const player = addPlayer('p1', { x: def.attackRange + 3, z: 0, hp: 100 });
		const sovereign = makeExpiredWindup('citadel_sovereign', 'p1');

		updateEnemies();

		expect(player.hp).toBe(100);
		expect(isBurning(player)).toBe(false);
		expect(sovereign.attackState).toBe('chasing');
	});
});
