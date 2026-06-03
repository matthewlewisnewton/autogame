import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KEY_ITEM_DEFS } from '../index.js';
import { damagePlayer, setGameState } from '../simulation.js';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	playerForSocket,
} from './helpers.js';

// ── Def values ──

describe('Barrier Dome — definition', () => {
	it('barrier_dome def is re-tuned to 1s/3m/14s and has no stale fields', () => {
		const def = KEY_ITEM_DEFS.barrier_dome;
		expect(def).toBeDefined();
		expect(def.id).toBe('barrier_dome');
		expect(def.name).toBe('Barrier Dome');
		expect(def.type).toBe('defensive');
		expect(def.cooldownMs).toBe(14000);
		expect(def.durationMs).toBe(1000);
		expect(def.radius).toBe(3);
		// Description should still mention blocking projectiles
		expect(def.description.toLowerCase()).toContain('projectile');
		// No stray legacy values
		expect(def.absorbedDamage).toBeUndefined();
		expect(def.radius).not.toBe(5);
		expect(def.durationMs).not.toBe(8000);
	});
});

// ── Socket integration ──

describe('useKeyItem — barrier_dome (socket integration)', () => {
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

	it('casting sets barrierDomeUntil/radius/center and cooldown on the caster', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);
		const def = KEY_ITEM_DEFS.barrier_dome;

		// Clean state
		player.keyItemCooldownUntil = 0;
		player.barrierDomeUntil = 0;
		player.x = 4;
		player.z = -2;

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'barrier_dome' });
		const result = await resultPromise;

		const now = Date.now();
		expect(result.ok).toBe(true);
		expect(result.keyItemId).toBe('barrier_dome');
		expect(result.barrierDomeUntil).toBeGreaterThan(now);
		expect(result.cooldownUntil).toBeGreaterThan(now);

		// Player transient state
		expect(player.barrierDomeUntil).toBeGreaterThan(now);
		expect(player.barrierDomeRadius).toBe(def.radius);
		expect(player.barrierDomeX).toBe(4);
		expect(player.barrierDomeZ).toBe(-2);
		expect(player.keyItemCooldownUntil).toBeGreaterThan(now);

		// Duration roughly matches def. `barrierDomeUntil` was set to castTime +
		// durationMs on the server; `now` is captured here after the keyItemUsed
		// event has crossed the socket, so the remaining window is durationMs minus
		// a small, variable client-receive latency. Assert it falls in a generous
		// (durationMs - 500ms, durationMs] band instead of an exact ±5ms match,
		// which flaked when socket latency exceeded 5ms under load. This still
		// catches gross regressions (e.g. a duration of 200ms or 8000ms).
		const remainingMs = player.barrierDomeUntil - now;
		expect(remainingMs).toBeLessThanOrEqual(def.durationMs);
		expect(remainingMs).toBeGreaterThan(def.durationMs - 500);
	});

	it('cooldown enforced: immediate re-cast returns on_cooldown and does not refresh the dome', async () => {
		const { socket } = await connectAndStartRun();
		const player = playerForSocket(socket);

		player.keyItemCooldownUntil = 0;

		const result1Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'barrier_dome' });
		const result1 = await result1Promise;
		expect(result1.ok).toBe(true);

		const firstDomeUntil = player.barrierDomeUntil;

		const result2Promise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'barrier_dome' });
		const result2 = await result2Promise;

		expect(result2.ok).toBe(false);
		expect(result2.reason).toBe('on_cooldown');
		expect(result2.remainingMs).toBeGreaterThan(0);

		// Dome window was not refreshed by the rejected re-cast
		expect(player.barrierDomeUntil).toBe(firstDomeUntil);
	});
});

// ── Ranged/projectile blocking (damagePlayer unit) ──

describe('damagePlayer — barrier dome blocks ranged/projectile', () => {
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
			...overrides,
		};
	}

	function setupState({ players = {}, enemies = [], minions = [] } = {}) {
		const state = { players, enemies, minions };
		setGameState(state, []);
		return state;
	}

	afterEach(() => {
		setGameState(null, null);
	});

	it('ranged damage from outside an active dome is fully blocked (hp unchanged)', () => {
		const victim = makePlayer('v', {
			x: 0, z: 0, hp: 100,
			barrierDomeUntil: FUTURE(), barrierDomeRadius: 3, barrierDomeX: 0, barrierDomeZ: 0,
		});
		setupState({
			players: { v: victim },
			enemies: [{ id: 'e1', x: 10, z: 0, hp: 50 }], // well outside the dome
		});

		const result = damagePlayer('v', 30, { ranged: true, attackerEnemyId: 'e1' });

		expect(result).toBeNull();
		expect(victim.hp).toBe(100);
	});

	it('melee damage to a player inside the dome still applies', () => {
		const victim = makePlayer('v', {
			x: 0, z: 0, hp: 100,
			barrierDomeUntil: FUTURE(), barrierDomeRadius: 3, barrierDomeX: 0, barrierDomeZ: 0,
		});
		setupState({
			players: { v: victim },
			enemies: [{ id: 'e1', x: 10, z: 0, hp: 50 }],
		});

		damagePlayer('v', 30, { attackerEnemyId: 'e1' }); // no ranged marker

		expect(victim.hp).toBe(70);
	});

	it('an ally standing inside the caster\'s dome is protected from outside ranged damage', () => {
		const caster = makePlayer('caster', {
			x: 0, z: 0, hp: 100,
			barrierDomeUntil: FUTURE(), barrierDomeRadius: 3, barrierDomeX: 0, barrierDomeZ: 0,
		});
		// Ally has no dome of their own, but stands inside the caster's dome.
		const ally = makePlayer('ally', { x: 1, z: 1, hp: 100 });
		setupState({
			players: { caster, ally },
			enemies: [{ id: 'e1', x: 10, z: 0, hp: 50 }],
		});

		const result = damagePlayer('ally', 30, { ranged: true, attackerEnemyId: 'e1' });

		expect(result).toBeNull();
		expect(ally.hp).toBe(100);
	});

	it('an expired dome blocks nothing', () => {
		const victim = makePlayer('v', {
			x: 0, z: 0, hp: 100,
			barrierDomeUntil: PAST(), barrierDomeRadius: 3, barrierDomeX: 0, barrierDomeZ: 0,
		});
		setupState({
			players: { v: victim },
			enemies: [{ id: 'e1', x: 10, z: 0, hp: 50 }],
		});

		damagePlayer('v', 30, { ranged: true, attackerEnemyId: 'e1' });

		expect(victim.hp).toBe(70);
	});

	it('ranged damage from an attacker already inside the dome is NOT blocked', () => {
		const victim = makePlayer('v', {
			x: 0, z: 0, hp: 100,
			barrierDomeUntil: FUTURE(), barrierDomeRadius: 3, barrierDomeX: 0, barrierDomeZ: 0,
		});
		setupState({
			players: { v: victim },
			enemies: [{ id: 'e1', x: 1, z: 0, hp: 50 }], // inside the 3m dome
		});

		damagePlayer('v', 30, { ranged: true, attackerEnemyId: 'e1' });

		expect(victim.hp).toBe(70);
	});

	it('ranged damage with no resolvable attacker position is still blocked inside an active dome', () => {
		const victim = makePlayer('v', {
			x: 0, z: 0, hp: 100,
			barrierDomeUntil: FUTURE(), barrierDomeRadius: 3, barrierDomeX: 0, barrierDomeZ: 0,
		});
		setupState({ players: { v: victim } });

		const result = damagePlayer('v', 30, { ranged: true }); // no attacker info

		expect(result).toBeNull();
		expect(victim.hp).toBe(100);
	});

	it('a ranged attack on a player standing OUTSIDE every dome is not blocked', () => {
		const caster = makePlayer('caster', {
			x: 0, z: 0, hp: 100,
			barrierDomeUntil: FUTURE(), barrierDomeRadius: 3, barrierDomeX: 0, barrierDomeZ: 0,
		});
		const victim = makePlayer('v', { x: 20, z: 0, hp: 100 }); // far from the dome
		setupState({
			players: { caster, v: victim },
			enemies: [{ id: 'e1', x: 25, z: 0, hp: 50 }],
		});

		damagePlayer('v', 30, { ranged: true, attackerEnemyId: 'e1' });

		expect(victim.hp).toBe(70);
	});
});
