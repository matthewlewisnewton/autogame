import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	gameState,
	createGameState,
	startDungeonRun,
	removeDeadEnemies,
	checkRunTerminalState,
	buildPlayerRecord,
	extractPersistentData,
	xpRequiredForLevel,
	levelForXp,
	killXpForEnemy,
	awardXp,
	VICTORY_XP_BONUS,
	setTestProvider,
	MAX_MAGIC_STONES,
} from '../index.js';
import { buildPlayerHotSnapshot } from '../progression.js';
import { InMemoryProvider } from '../providers.js';

function resetState() {
	Object.assign(gameState, createGameState());
}

function addPlayer(id, overrides = {}) {
	gameState.players[id] = {
		x: 0, y: 0.5, z: 0, rotation: 0, hp: 100, dead: false,
		lastActivity: Date.now(), ready: false, magicStones: MAX_MAGIC_STONES,
		currency: 0, debugScenario: null, pendingSummons: new Set(),
		deck: [], xp: 0, level: 1, ...overrides,
	};
	return gameState.players[id];
}

function addDeadEnemy(id, overrides = {}) {
	const enemy = {
		id, type: 'grunt', x: 0, z: 0, hp: 0, maxHp: 30,
		state: 'idle', wanderTarget: { x: 0, z: 0 }, ...overrides,
	};
	gameState.enemies.push(enemy);
	return enemy;
}

// ── Level curve helpers ──

describe('XP level curve', () => {
	it('xpRequiredForLevel follows 100 * (n-1) * n / 2', () => {
		expect(xpRequiredForLevel(1)).toBe(0);
		expect(xpRequiredForLevel(2)).toBe(100);
		expect(xpRequiredForLevel(3)).toBe(300);
		expect(xpRequiredForLevel(4)).toBe(600);
		expect(xpRequiredForLevel(5)).toBe(1000);
	});

	it('levelForXp returns level 1 at 0 XP', () => {
		expect(levelForXp(0)).toBe(1);
	});

	it('levelForXp returns level 2 at exactly 100 XP and level 3 at 300', () => {
		expect(levelForXp(99)).toBe(1);
		expect(levelForXp(100)).toBe(2);
		expect(levelForXp(299)).toBe(2);
		expect(levelForXp(300)).toBe(3);
		expect(levelForXp(600)).toBe(4);
	});

	it('levelForXp never goes below 1 for bad input', () => {
		expect(levelForXp(-50)).toBe(1);
		expect(levelForXp(NaN)).toBe(1);
		expect(levelForXp(undefined)).toBe(1);
	});

	it('killXpForEnemy scales with maxHp with a floor of 5', () => {
		expect(killXpForEnemy({ maxHp: 30 })).toBe(5);
		expect(killXpForEnemy({ maxHp: 12 })).toBe(5);
		expect(killXpForEnemy({})).toBe(5);
		expect(killXpForEnemy({ maxHp: 60 })).toBe(10);
		expect(killXpForEnemy({ maxHp: 300 })).toBe(50);
	});

	it('awardXp accumulates XP, raises level across thresholds, and never lowers it', () => {
		const player = { xp: 0, level: 1 };
		awardXp(player, 50);
		expect(player.xp).toBe(50);
		expect(player.level).toBe(1);
		awardXp(player, 50);
		expect(player.xp).toBe(100);
		expect(player.level).toBe(2);
		expect(player.persistenceDirty).toBe(true);
		// Level is monotonic even if it starts above what the XP implies.
		const veteran = { xp: 0, level: 5 };
		awardXp(veteran, 10);
		expect(veteran.level).toBe(5);
	});
});

// ── Kill attribution and victory bonus (run flow) ──

describe('XP awards during a run', () => {
	beforeEach(() => {
		resetState();
		setTestProvider(new InMemoryProvider());
	});

	afterEach(() => {
		setTestProvider(null);
	});

	it('awards kill XP to the player identified by lastDamagedBy', () => {
		startDungeonRun();
		gameState.enemies = [];
		const p1 = addPlayer('p1');
		addDeadEnemy('e1', { maxHp: 60, lastDamagedBy: 'p1' });
		removeDeadEnemies();
		expect(p1.xp).toBe(10);
		expect(p1.level).toBe(1);
	});

	it('awards no XP and does not throw when there is no attributable killer', () => {
		startDungeonRun();
		gameState.enemies = [];
		const p1 = addPlayer('p1');
		addDeadEnemy('e1'); // no lastDamagedBy at all
		addDeadEnemy('e2', { lastDamagedBy: 'ghost-player' }); // killer no longer present
		expect(() => removeDeadEnemies()).not.toThrow();
		expect(gameState.enemies).toHaveLength(0);
		expect(p1.xp).toBe(0);
		expect(p1.level).toBe(1);
	});

	it('raises the level when a kill crosses an XP threshold', () => {
		startDungeonRun();
		gameState.enemies = [];
		const p1 = addPlayer('p1', { xp: 95, level: 1 });
		addDeadEnemy('e1', { maxHp: 30, lastDamagedBy: 'p1' });
		removeDeadEnemies();
		expect(p1.xp).toBe(100);
		expect(p1.level).toBe(2);
	});

	it('awards the flat victory bonus to every player on run victory', () => {
		startDungeonRun();
		const p1 = addPlayer('p1');
		const p2 = addPlayer('p2', { xp: 95, level: 1 });
		gameState.run.objective.defeatedEnemies = gameState.run.objective.totalEnemies;
		checkRunTerminalState();
		expect(gameState.run.status).toBe('victory');
		expect(p1.xp).toBe(VICTORY_XP_BONUS);
		expect(p1.level).toBe(1);
		expect(p2.xp).toBe(95 + VICTORY_XP_BONUS);
		expect(p2.level).toBe(2);
	});

	it('awards no victory bonus on a failed run', () => {
		startDungeonRun();
		const p1 = addPlayer('p1', { hp: 0, dead: true });
		checkRunTerminalState();
		expect(gameState.run.status).toBe('failed');
		expect(p1.xp).toBe(0);
	});
});

// ── Persistence round-trip ──

describe('XP/level persistence', () => {
	beforeEach(resetState);

	it('a fresh player with no saved data starts at xp 0 / level 1', () => {
		const player = buildPlayerRecord('p1', 'acct-1', 'fresh', null);
		expect(player.xp).toBe(0);
		expect(player.level).toBe(1);
	});

	it('extractPersistentData includes xp and level', () => {
		const player = buildPlayerRecord('p1', 'acct-1', 'vet', null);
		awardXp(player, 150);
		const data = extractPersistentData(player);
		expect(data.xp).toBe(150);
		expect(data.level).toBe(2);
	});

	it('round-trips xp and level through extract → restore', () => {
		const player = buildPlayerRecord('p1', 'acct-1', 'vet', null);
		awardXp(player, 350);
		const restored = buildPlayerRecord('p1', 'acct-1', 'vet', extractPersistentData(player));
		expect(restored.xp).toBe(350);
		expect(restored.level).toBe(3);
	});

	it('recomputes level from saved xp so the two never disagree', () => {
		const player = buildPlayerRecord('p1', 'acct-1', 'vet', {
			xp: 100, level: 9,
		});
		expect(player.xp).toBe(100);
		expect(player.level).toBe(2);
	});

	it('legacy saved data without xp restores to xp 0 / level 1', () => {
		const player = buildPlayerRecord('p1', 'acct-1', 'old-timer', { currency: 25 });
		expect(player.currency).toBe(25);
		expect(player.xp).toBe(0);
		expect(player.level).toBe(1);
	});
});

// ── Snapshot inclusion ──

describe('XP/level in state snapshots', () => {
	it('buildPlayerHotSnapshot carries xp and level', () => {
		const player = { x: 0, y: 0.5, z: 0, rotation: 0, hp: 100, dead: false, xp: 120, level: 2 };
		const snap = buildPlayerHotSnapshot('p1', player);
		expect(snap.xp).toBe(120);
		expect(snap.level).toBe(2);
	});

	it('buildPlayerHotSnapshot defaults missing xp/level to 0 and 1', () => {
		const snap = buildPlayerHotSnapshot('p1', { x: 0, y: 0.5, z: 0, rotation: 0, hp: 100 });
		expect(snap.xp).toBe(0);
		expect(snap.level).toBe(1);
	});
});
