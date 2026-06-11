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

// design.md stage-boss band: every non-capstone objectiveType-boss def the
// colossus must strictly out-stat on both hp and attackDamage. The
// citadel_sovereign capstone is deliberately NOT in this list — it ties the
// colossus at the 460 HP ceiling and out-damages it.
const STAGE_BOSS_BAND = [
	'miniboss',
	'annex_overseer',
	'arena_champion',
	'crucible_sovereign',
	'spire_warden',
	'cinder_warden',
	'magma_colossus',
	'permafrost_warden',
	'glacial_tyrant',
];

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

describe('riftbound_colossus enemy def', () => {
	const def = ENEMY_DEFS.riftbound_colossus;

	it('is registered with ice+fire rift-convergence metadata', () => {
		expect(def).toBeDefined();
		expect(def.name).toBe('Riftbound Colossus');
		expect(def.description.toLowerCase()).toContain('rift');
		expect(def.description.toLowerCase()).toContain('ice');
		expect(def.description.toLowerCase()).toContain('fire');
	});

	it('has the hardest-stage-boss combat stats from the ticket', () => {
		expect(def.hp).toBe(460);
		expect(def.attackDamage).toBe(28);
		expect(def.attackStyle).toBe('radial');
		expect(def.attackRange).toBe(5.5);
		expect(def.attackWindupMs).toBe(1200);
		expect(def.chaseSpeed).toBeCloseTo(1.1);
		expect(def.wanderSpeed).toBeCloseTo(0.5);
		expect(def.burnDurationMs).toBe(3000);
	});

	it('surfaces hp, attackDamage, attackStyle, attackRange, and burnDurationMs', () => {
		for (const stat of ['hp', 'attackDamage', 'attackStyle', 'attackRange', 'burnDurationMs']) {
			expect(def.surfacedStats).toContain(stat);
		}
	});

	it('strictly out-stats every non-capstone stage-boss band def, with hp capped at 460', () => {
		// 500 HP could not be defeated inside the 180s defeatBoss validation
		// window (design.md), so the cap is a hard ceiling.
		expect(def.hp).toBeLessThanOrEqual(460);
		for (const type of STAGE_BOSS_BAND) {
			const other = ENEMY_DEFS[type];
			expect(other, `missing band def ${type}`).toBeDefined();
			expect(def.hp, `hp must exceed ${type}`).toBeGreaterThan(other.hp);
			expect(def.attackDamage, `attackDamage must exceed ${type}`).toBeGreaterThan(other.attackDamage);
		}
	});
});

describe('riftbound_colossus drop registry', () => {
	it('drops a dungeon_drake card like the other stage bosses', () => {
		expect(ENEMY_CARD_DROPS.riftbound_colossus).toBe('dungeon_drake');
		expect(getEnemyCardDrop({ type: 'riftbound_colossus' })).toBe('dungeon_drake');
	});

	it('drops the highest magic stone value among non-capstone entries', () => {
		expect(ENEMY_MS_DROPS.riftbound_colossus).toBe(80);
		expect(getEnemyMagicStoneDrop({ type: 'riftbound_colossus' })).toBe(80);
		for (const [type, value] of Object.entries(ENEMY_MS_DROPS)) {
			if (type === 'riftbound_colossus') continue;
			if (type === 'citadel_sovereign') {
				// The citadel capstone now tops the table at 90.
				expect(value, 'citadel_sovereign tops the table').toBe(90);
				expect(value).toBeGreaterThan(ENEMY_MS_DROPS.riftbound_colossus);
				continue;
			}
			expect(value, `${type} must drop less than the colossus`).toBeLessThan(80);
		}
	});
});

describe('riftbound_colossus radial strike applies BURNING', () => {
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
		const def = ENEMY_DEFS.riftbound_colossus;
		const player = addPlayer('p1', { x: 3, z: 0, hp: 100 });
		const colossus = makeExpiredWindup('riftbound_colossus', 'p1');

		updateEnemies();

		expect(player.hp).toBe(100 - def.attackDamage);
		expect(isBurning(player)).toBe(true);
		expect(player.burningUntil).toBe(START + def.burnDurationMs);
		expect(player.burningUntil).toBeGreaterThan(Date.now());
		expect(colossus.attackState).toBe('recovering');
	});

	it('out-of-range windup cancels without damage or burn', () => {
		const def = ENEMY_DEFS.riftbound_colossus;
		const player = addPlayer('p1', { x: def.attackRange + 3, z: 0, hp: 100 });
		const colossus = makeExpiredWindup('riftbound_colossus', 'p1');

		updateEnemies();

		expect(player.hp).toBe(100);
		expect(isBurning(player)).toBe(false);
		expect(colossus.attackState).toBe('chasing');
	});
});
