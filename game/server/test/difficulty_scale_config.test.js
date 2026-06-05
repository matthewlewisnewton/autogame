import { describe, it, expect } from 'vitest';
import {
	MAX_PLAYERS,
	DIFFICULTY_SCALE_MIN_PLAYERS,
	DIFFICULTY_SPAWN_RATE_PER_PLAYER,
	DIFFICULTY_ENEMY_DAMAGE_PER_PLAYER,
	DIFFICULTY_MINIBOSS_HP_PER_PLAYER,
	difficultyExtraPlayers,
	difficultyScaleFactor,
	runPlayerCount,
} from '../config.js';

describe('difficulty scaling config', () => {
	it('exports the threshold and three per-player increment constants', () => {
		expect(DIFFICULTY_SCALE_MIN_PLAYERS).toBe(4);
		for (const inc of [
			DIFFICULTY_SPAWN_RATE_PER_PLAYER,
			DIFFICULTY_ENEMY_DAMAGE_PER_PLAYER,
			DIFFICULTY_MINIBOSS_HP_PER_PLAYER,
		]) {
			expect(typeof inc).toBe('number');
			expect(inc).toBeGreaterThan(0);
			expect(inc).toBeLessThan(1);
		}
	});
});

describe('difficultyExtraPlayers', () => {
	it('returns 0 for the baseline range (counts 0..4)', () => {
		for (const count of [0, 1, 2, 3, 4]) {
			expect(difficultyExtraPlayers(count)).toBe(0);
		}
	});

	it('increases by 1 per player above the threshold', () => {
		expect(difficultyExtraPlayers(5)).toBe(1);
		expect(difficultyExtraPlayers(6)).toBe(2);
		expect(difficultyExtraPlayers(8)).toBe(4);
		expect(difficultyExtraPlayers(16)).toBe(12);
	});

	it('clamps at MAX_PLAYERS - threshold (12) for counts >= 16', () => {
		const cap = MAX_PLAYERS - DIFFICULTY_SCALE_MIN_PLAYERS;
		expect(cap).toBe(12);
		expect(difficultyExtraPlayers(16)).toBe(cap);
		expect(difficultyExtraPlayers(20)).toBe(cap);
		expect(difficultyExtraPlayers(100)).toBe(cap);
	});

	it('never returns a negative value', () => {
		expect(difficultyExtraPlayers(-5)).toBe(0);
		expect(difficultyExtraPlayers(0)).toBe(0);
	});
});

describe('difficultyScaleFactor', () => {
	it('is exactly 1.0 for baseline counts 1..4', () => {
		for (const count of [1, 2, 3, 4]) {
			expect(difficultyScaleFactor(count, DIFFICULTY_SPAWN_RATE_PER_PLAYER)).toBe(1.0);
			expect(difficultyScaleFactor(count, DIFFICULTY_ENEMY_DAMAGE_PER_PLAYER)).toBe(1.0);
			expect(difficultyScaleFactor(count, DIFFICULTY_MINIBOSS_HP_PER_PLAYER)).toBe(1.0);
		}
	});

	it('strictly increases across counts 5, 8, 16', () => {
		const inc = DIFFICULTY_SPAWN_RATE_PER_PLAYER;
		const f5 = difficultyScaleFactor(5, inc);
		const f8 = difficultyScaleFactor(8, inc);
		const f16 = difficultyScaleFactor(16, inc);
		expect(f5).toBeGreaterThan(1.0);
		expect(f8).toBeGreaterThan(f5);
		expect(f16).toBeGreaterThan(f8);
		expect(f16).toBeCloseTo(1 + 12 * inc, 10);
	});

	it('clamps beyond 16 (count 16 === count 20 === count 100)', () => {
		const inc = DIFFICULTY_MINIBOSS_HP_PER_PLAYER;
		expect(difficultyScaleFactor(16, inc)).toBe(difficultyScaleFactor(20, inc));
		expect(difficultyScaleFactor(20, inc)).toBe(difficultyScaleFactor(100, inc));
	});
});

describe('runPlayerCount', () => {
	it('returns 0 when there is no gameState or players map', () => {
		expect(runPlayerCount(null)).toBe(0);
		expect(runPlayerCount(undefined)).toBe(0);
		expect(runPlayerCount({})).toBe(0);
	});

	it('returns the number of players in the run', () => {
		expect(runPlayerCount({ players: {} })).toBe(0);
		expect(runPlayerCount({ players: { a: {}, b: {}, c: {} } })).toBe(3);
	});

	it('tracks a changing players map (drop-in JOIN raises, LEAVE lowers)', () => {
		const gameState = { players: {} };
		expect(runPlayerCount(gameState)).toBe(0);
		gameState.players.a = {};
		gameState.players.b = {};
		expect(runPlayerCount(gameState)).toBe(2);
		delete gameState.players.a;
		expect(runPlayerCount(gameState)).toBe(1);
	});

	it('clamps the count to [0, MAX_PLAYERS] even above 16', () => {
		const players = {};
		for (let i = 0; i < 20; i++) players[`p${i}`] = {};
		expect(runPlayerCount({ players })).toBe(MAX_PLAYERS);
	});
});
