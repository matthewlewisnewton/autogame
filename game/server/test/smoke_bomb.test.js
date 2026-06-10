import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KEY_ITEM_DEFS, resetGameState, gameState, updateEnemies, isPlayerConcealed, clearAllTimers } from '../index.js';
import { getEntityWorldY } from '../simulation.js';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	playerForSocket,
} from './helpers.js';

// ── Def values ──

describe('Smoke Bomb — definition', () => {
	it('smoke_bomb def is tuned to 2s/8s with a numeric radius and stealth type', () => {
		const def = KEY_ITEM_DEFS.smoke_bomb;
		expect(def).toBeDefined();
		expect(def.id).toBe('smoke_bomb');
		expect(def.name).toBe('Smoke Bomb');
		expect(def.type).toBe('stealth');
		expect(def.cooldownMs).toBe(8000);
		expect(def.durationMs).toBe(2000);
		expect(typeof def.radius).toBe('number');
		expect(def.radius).toBeGreaterThan(0);
		// No stale legacy values from the un-tuned entry
		expect(def.cooldownMs).not.toBe(18000);
		expect(def.durationMs).not.toBe(3000);
	});
});

// ── Socket integration (cast / cooldown) ──

describe('useKeyItem — smoke_bomb (socket integration)', () => {
	let baseUrl;
	let activeSocket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	}, 20000);

	afterEach(async () => {
		if (activeSocket) {
			try { activeSocket.disconnect(); } catch (_) {}
			activeSocket = null;
		}
		await closeServer();
	}, 20000);

	async function connectAndStartRun() {
		const { socket } = await connectClient(baseUrl);
		activeSocket = socket;
		const startGamePromise = waitForEvent(socket, 'startGame', 15000);
		socket.emit('playerReady', true);
		await startGamePromise;
		return { socket };
	}

	it('casting sets smokeBombUntil/radius/center and cooldown on the caster', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);
		const def = KEY_ITEM_DEFS.smoke_bomb;

		// Clean state
		player.keyItemCooldownUntil = 0;
		player.equippedKeyItemId = 'smoke_bomb';
		player.smokeBombUntil = 0;
		player.x = 5;
		player.z = -3;

		// Stop the game-loop flush interval so a tick cannot clear persistenceDirty
		// before we read it (batched saves landed on main since this test was written).
		clearAllTimers();

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'smoke_bomb' });
		const result = await resultPromise;

		const now = Date.now();
		expect(result.ok).toBe(true);
		expect(result.keyItemId).toBe('smoke_bomb');
		expect(result.smokeBombUntil).toBeGreaterThan(now);
		expect(result.cooldownUntil).toBeGreaterThan(now);

		// Player transient state
		expect(player.smokeBombUntil).toBeGreaterThan(now);
		expect(player.smokeBombRadius).toBe(def.radius);
		expect(player.smokeBombX).toBe(5);
		expect(player.smokeBombZ).toBe(-3);
		// Caster world Y is recorded at cast time so the zone is a 3D sphere
		expect(Number.isFinite(player.smokeBombY)).toBe(true);
		expect(player.smokeBombY).toBe(getEntityWorldY(player));
		expect(player.keyItemCooldownUntil).toBeGreaterThan(now);
		expect(player.persistenceDirty).toBe(true);

		// Duration roughly matches def (allow a few ms elapsed since `now`)
		const smokeRemainingMs = player.smokeBombUntil - now;
		expect(smokeRemainingMs).toBeLessThanOrEqual(def.durationMs);
		expect(smokeRemainingMs).toBeGreaterThan(def.durationMs - 50);
	});

	it('cooldown enforced: immediate re-cast returns on_cooldown and does not refresh the smoke window', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);

		player.keyItemCooldownUntil = 0;
		player.equippedKeyItemId = 'smoke_bomb';

		const result1Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'smoke_bomb' });
		const result1 = await result1Promise;
		expect(result1.ok).toBe(true);

		const firstSmokeUntil = player.smokeBombUntil;

		const result2Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'smoke_bomb' });
		const result2 = await result2Promise;

		expect(result2.ok).toBe(false);
		expect(result2.reason).toBe('on_cooldown');
		expect(result2.remainingMs).toBeGreaterThan(0);

		// Smoke window was not refreshed by the rejected re-cast
		expect(player.smokeBombUntil).toBe(firstSmokeUntil);
	});
});

// ── Concealment / targeting (updateEnemies + isPlayerConcealed unit) ──

describe('smoke_bomb concealment — enemy targeting', () => {
	const FUTURE = () => Date.now() + 5000;
	const PAST = () => Date.now() - 5000;

	function makePlayer(id, overrides = {}) {
		return {
			id,
			x: 0,
			y: 0.5,
			z: 0,
			hp: 100,
			dead: false,
			extracted: false,
			...overrides,
		};
	}

	function makeGrunt(overrides = {}) {
		return {
			id: 'e1',
			type: 'grunt',
			x: 0,
			z: 0,
			hp: 100,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 },
			...overrides,
		};
	}

	// Use the real game state (with a generated dungeon layout) so the enemy
	// AI's wander/clamp helpers have the layout they expect.
	function setupState({ players = {}, enemies = [], minions = [] } = {}) {
		resetGameState();
		gameState.gamePhase = 'playing';
		gameState.run = { status: 'playing' };
		gameState.players = players;
		gameState.enemies = enemies;
		gameState.minions = minions;
		return gameState;
	}

	it('isPlayerConcealed is true inside an active zone and false once expired or exited', () => {
		const caster = makePlayer('c', {
			x: 2, z: 0,
			smokeBombUntil: FUTURE(), smokeBombRadius: 4, smokeBombX: 2, smokeBombZ: 0,
		});
		setupState({ players: { c: caster } });

		// Standing in the zone → concealed
		expect(isPlayerConcealed(caster, Date.now())).toBe(true);

		// Walked out of the zone → targetable again
		caster.x = 20;
		expect(isPlayerConcealed(caster, Date.now())).toBe(false);

		// Back in, but the zone has expired → targetable again
		caster.x = 2;
		caster.smokeBombUntil = PAST();
		expect(isPlayerConcealed(caster, Date.now())).toBe(false);
	});

	it('an ally standing in the caster\'s zone is concealed even without their own smoke', () => {
		const caster = makePlayer('c', {
			x: 0, z: 0,
			smokeBombUntil: FUTURE(), smokeBombRadius: 4, smokeBombX: 0, smokeBombZ: 0,
		});
		const ally = makePlayer('a', { x: 1, z: 1 });
		setupState({ players: { c: caster, a: ally } });

		expect(isPlayerConcealed(ally, Date.now())).toBe(true);
	});

	it('a concealed player is never acquired as an enemy target', () => {
		const player = makePlayer('p', {
			x: 2, z: 0,
			smokeBombUntil: FUTURE(), smokeBombRadius: 4, smokeBombX: 2, smokeBombZ: 0,
		});
		const enemy = makeGrunt();
		setupState({ players: { p: player }, enemies: [enemy] });

		updateEnemies();

		// No target acquired — enemy stays idle and never winds up against p
		expect(enemy.attackState).not.toBe('windup');
		expect(enemy.windupTargetId).toBeUndefined();
		expect(enemy.state).toBe('idle');
	});

	it('the same player IS acquired once the smoke zone has expired', () => {
		const player = makePlayer('p', {
			x: 2, z: 0,
			smokeBombUntil: PAST(), smokeBombRadius: 4, smokeBombX: 2, smokeBombZ: 0,
		});
		const enemy = makeGrunt();
		setupState({ players: { p: player }, enemies: [enemy] });

		updateEnemies();

		// In attack range (2 < 4) so the grunt acquires p and begins its wind-up
		expect(enemy.attackState).toBe('windup');
		expect(enemy.windupTargetId).toBe('p');
		expect(enemy.windupTargetType).toBe('player');
	});

	it('an enemy mid-wind-up against a newly concealed player cancels the strike', () => {
		const player = makePlayer('p', {
			x: 2, z: 0,
			smokeBombUntil: FUTURE(), smokeBombRadius: 4, smokeBombX: 2, smokeBombZ: 0,
		});
		const enemy = makeGrunt({
			attackState: 'windup',
			windupTargetType: 'player',
			windupTargetId: 'p',
			windupStartTime: Date.now() - 10000, // wind-up already elapsed
			windupDirX: 1,
			windupDirZ: 0,
		});
		setupState({ players: { p: player }, enemies: [enemy] });

		updateEnemies();

		// Strike cancelled, no damage dealt, enemy returns to chasing (not recovering)
		expect(player.hp).toBe(100);
		expect(enemy.attackState).toBe('chasing');
	});

	it('an enemy mid-wind-up against a non-concealed player still deals damage', () => {
		const player = makePlayer('p', { x: 2, z: 0 });
		const enemy = makeGrunt({
			attackState: 'windup',
			windupTargetType: 'player',
			windupTargetId: 'p',
			windupStartTime: Date.now() - 10000,
			windupDirX: 1,
			windupDirZ: 0,
		});
		setupState({ players: { p: player }, enemies: [enemy] });

		updateEnemies();

		// Damage applied and the enemy enters its recovery window
		expect(player.hp).toBeLessThan(100);
		expect(enemy.attackState).toBe('recovering');
	});
});
