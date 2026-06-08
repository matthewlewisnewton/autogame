import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	resetGameState,
	MAX_HP,
} from '../index.js';
import { InMemoryProvider } from '../providers.js';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	playerForSocket,
	testGameState,
} from './helpers.js';

/**
 * Integration tests for the `field_medic_kit` key item.
 * Verifies AoE HP heal, radius boundary, dead-player skip, cooldown gate,
 * and caster self-heal using socket-based test helpers.
 */
describe('useKeyItem — field_medic_kit', () => {
	let baseUrl;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
	});

	/**
	 * Connect a single client and enter the 'playing' phase via ready-up.
	 */
	async function connectAndStartRun(accountId) {
		const { socket } = await connectClient(baseUrl, accountId);
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;
		return { socket };
	}

	/**
	 * Connect two clients to the same lobby and enter 'playing' phase.
	 * Returns [{ socket }, { socket }].
	 */
	async function connectTwoAndStartRun() {
		const { socket: s1 } = await connectClient(baseUrl, `p1-${Date.now()}`);
		const { socket: s2, lobbyId } = await connectClient(
			baseUrl,
			`p2-${Date.now()}`,
			{ joinLobbyId: s1._lobbyId }
		);

		// Both ready up to trigger checkAllReady → playing phase
		const start1 = waitForEvent(s1, 'startGame');
		const start2 = waitForEvent(s2, 'startGame');
		s1.emit('playerReady', true);
		s2.emit('playerReady', true);
		await start1;
		await start2;

		return [{ socket: s1 }, { socket: s2 }];
	}

	/**
	 * Connect three clients to the same lobby and enter 'playing' phase.
	 */
	async function connectThreeAndStartRun() {
		const { socket: s1 } = await connectClient(baseUrl, `p1-${Date.now()}`);
		const { socket: s2, lobbyId } = await connectClient(
			baseUrl,
			`p2-${Date.now()}`,
			{ joinLobbyId: s1._lobbyId }
		);
		const { socket: s3 } = await connectClient(
			baseUrl,
			`p3-${Date.now()}`,
			{ joinLobbyId: s1._lobbyId }
		);

		const start1 = waitForEvent(s1, 'startGame');
		const start2 = waitForEvent(s2, 'startGame');
		const start3 = waitForEvent(s3, 'startGame');
		s1.emit('playerReady', true);
		s2.emit('playerReady', true);
		s3.emit('playerReady', true);
		await start1;
		await start2;
		await start3;

		return [{ socket: s1 }, { socket: s2 }, { socket: s3 }];
	}

	it('two players in range both gain HP (MS unchanged)', async () => {
		const players = await connectTwoAndStartRun();
		const state = testGameState();

		const p1 = playerForSocket(players[0].socket);
		const p2 = playerForSocket(players[1].socket);

		// Place both players within 3 m of each other (well within 5 m radius)
		p1.x = 0; p1.z = 0;
		p2.x = 2; p2.z = 0;

		// Set both to low HP and some MS
		const p1HpBefore = 20;
		const p2HpBefore = 30;
		p1.hp = p1HpBefore;
		p1.magicStones = 2;
		p2.hp = p2HpBefore;
		p2.magicStones = 5;

		// Clear cooldown on caster
		p1.keyItemCooldownUntil = 0;

		// Use field_medic_kit from player 1
		const resultPromise = waitForEvent(players[0].socket, 'keyItemUsed');
		players[0].socket.emit('useKeyItem', { keyItemId: 'field_medic_kit' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.keyItemId).toBe('field_medic_kit');
		expect(result.alliesRestored).toBe(2);

		// Both should have gained HP (hpRestore=8, capped at MAX_HP)
		expect(playerForSocket(players[0].socket).hp).toBe(p1HpBefore + 8); // 20 + 8 = 28
		expect(playerForSocket(players[1].socket).hp).toBe(p2HpBefore + 8); // 30 + 8 = 38

		// MS must not change (may tick regen by a fraction)
		expect(playerForSocket(players[0].socket).magicStones).toBeCloseTo(2, 1);
		expect(playerForSocket(players[1].socket).magicStones).toBeCloseTo(5, 1);
	});

	it('out-of-range player unchanged', async () => {
		const players = await connectThreeAndStartRun();

		const p1 = playerForSocket(players[0].socket);
		const p2 = playerForSocket(players[1].socket);
		const p3 = playerForSocket(players[2].socket);

		// Place p1 and p2 close together, p3 far away (> 5 m)
		p1.x = 0; p1.z = 0;
		p2.x = 3; p2.z = 0; // 3 m from p1 — in range
		p3.x = 20; p3.z = 20; // ~28 m from p1 — out of range

		const p3HpBefore = 50;
		const p3MsBefore = 10;
		const p1HpBefore = 20;
		const p2HpBefore = 30;
		p1.hp = p1HpBefore;
		p1.magicStones = 2;
		p2.hp = p2HpBefore;
		p2.magicStones = 5;
		p3.hp = p3HpBefore;
		p3.magicStones = p3MsBefore;

		p1.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(players[0].socket, 'keyItemUsed');
		players[0].socket.emit('useKeyItem', { keyItemId: 'field_medic_kit' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.alliesRestored).toBe(2); // only p1 and p2

		// p1 and p2 should have gained HP
		expect(playerForSocket(players[0].socket).hp).toBe(p1HpBefore + 8);
		expect(playerForSocket(players[1].socket).hp).toBe(p2HpBefore + 8);

		// p3 should be unchanged (HP exact; MS may tick regen by a fraction)
		expect(playerForSocket(players[2].socket).hp).toBe(p3HpBefore);
		const p3MsAfter = playerForSocket(players[2].socket).magicStones;
		expect(p3MsAfter).toBeCloseTo(p3MsBefore, 1);
	});

	it('dead players skipped', async () => {
		const players = await connectTwoAndStartRun();

		const p1 = playerForSocket(players[0].socket);
		const p2 = playerForSocket(players[1].socket);

		// Place both players in range
		p1.x = 0; p1.z = 0;
		p2.x = 2; p2.z = 0;

		// Set p2 as dead
		const p1HpBefore = 20;
		const p2HpBefore = 30;
		p1.hp = p1HpBefore;
		p1.magicStones = 2;
		p2.hp = p2HpBefore;
		p2.magicStones = 5;
		p2.dead = true;

		p1.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(players[0].socket, 'keyItemUsed');
		players[0].socket.emit('useKeyItem', { keyItemId: 'field_medic_kit' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.alliesRestored).toBe(1); // only p1 (caster), p2 is dead

		// p1 HP increased by 8; MS unchanged
		expect(playerForSocket(players[0].socket).hp).toBe(p1HpBefore + 8);
		expect(playerForSocket(players[0].socket).magicStones).toBeCloseTo(2, 1);

		// p2 should be unchanged (still dead, HP not modified)
		expect(playerForSocket(players[1].socket).hp).toBe(p2HpBefore);
		// MS regen tick may add fractional amounts during the test
		expect(playerForSocket(players[1].socket).magicStones).toBeCloseTo(5, 1);
	});

	it('cooldown gate: reusing within 7s returns on_cooldown', async () => {
		const players = await connectTwoAndStartRun();

		const p1 = playerForSocket(players[0].socket);

		// Set both players in range and at low HP
		p1.x = 0; p1.z = 0;
		const p1HpBefore = 20;
		p1.hp = p1HpBefore;
		p1.magicStones = 2;

		p1.keyItemCooldownUntil = 0;

		// First use — should succeed
		const result1Promise = waitForEvent(players[0].socket, 'keyItemUsed');
		players[0].socket.emit('useKeyItem', { keyItemId: 'field_medic_kit' });
		const result1 = await result1Promise;

		expect(result1.ok).toBe(true);
		expect(result1.alliesRestored).toBeGreaterThanOrEqual(1);

		// Immediate second use — should be rejected with on_cooldown
		const result2Promise = waitForEvent(players[0].socket, 'keyItemUsed');
		players[0].socket.emit('useKeyItem', { keyItemId: 'field_medic_kit' });
		const result2 = await result2Promise;

		expect(result2.ok).toBe(false);
		expect(result2.reason).toBe('on_cooldown');
		expect(result2.remainingMs).toBeGreaterThan(0);

		// HP increased by 8 after first use only
		expect(playerForSocket(players[0].socket).hp).toBe(p1HpBefore + 8);
	});

	it('caster receives HP heal (included in AoE)', async () => {
		const { socket } = await connectAndStartRun(`solo-${Date.now()}`);
		const player = playerForSocket(socket);

		// Set caster to low HP and some MS
		const hpBefore = 10;
		const msBefore = 1;
		player.hp = hpBefore;
		player.magicStones = msBefore;
		player.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'field_medic_kit' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.alliesRestored).toBe(1); // only the caster

		// Caster HP increased by 8; MS unchanged
		expect(playerForSocket(socket).hp).toBe(hpBefore + 8); // 10 + 8 = 18
		expect(playerForSocket(socket).magicStones).toBeCloseTo(msBefore, 1);

		// Cooldown should be set
		expect(playerForSocket(socket).keyItemCooldownUntil).toBeGreaterThan(Date.now());
	});

	it('broadcasts keyItemHealPulse to all lobby clients with caster position and healRadius', async () => {
		const players = await connectTwoAndStartRun();

		const p1 = playerForSocket(players[0].socket);
		const p2 = playerForSocket(players[1].socket);

		p1.x = 10;
		p1.z = -5;
		p2.x = 12;
		p2.z = -5;
		p1.keyItemCooldownUntil = 0;

		const casterPulsePromise = waitForEvent(players[0].socket, 'keyItemHealPulse');
		const allyPulsePromise = waitForEvent(players[1].socket, 'keyItemHealPulse');
		const resultPromise = waitForEvent(players[0].socket, 'keyItemUsed');
		players[0].socket.emit('useKeyItem', { keyItemId: 'field_medic_kit' });

		const [result, casterPulse, allyPulse] = await Promise.all([
			resultPromise,
			casterPulsePromise,
			allyPulsePromise,
		]);

		expect(result.ok).toBe(true);
		expect(casterPulse.playerId).toBe(players[0].socket._playerId);
		expect(allyPulse.playerId).toBe(players[0].socket._playerId);
		expect(casterPulse.x).toBe(10);
		expect(casterPulse.z).toBe(-5);
		expect(allyPulse.x).toBe(10);
		expect(allyPulse.z).toBe(-5);
		expect(casterPulse.healRadius).toBe(5);
		expect(allyPulse.healRadius).toBe(5);
	});

	it('HP capped at MAX_HP and MS unchanged', async () => {
		const players = await connectTwoAndStartRun();

		const p1 = playerForSocket(players[0].socket);
		const p2 = playerForSocket(players[1].socket);

		// Place both in range
		p1.x = 0; p1.z = 0;
		p2.x = 2; p2.z = 0;

		const p1HpBefore = MAX_HP - 5; // 5 below max — heal of 8 would overflow
		const p2HpBefore = MAX_HP; // already at max
		const p1MsBefore = 50;
		const p2MsBefore = 90;
		p1.hp = p1HpBefore;
		p1.magicStones = p1MsBefore;
		p2.hp = p2HpBefore;
		p2.magicStones = p2MsBefore;

		p1.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(players[0].socket, 'keyItemUsed');
		players[0].socket.emit('useKeyItem', { keyItemId: 'field_medic_kit' });
		await resultPromise;

		// p1 should be capped at MAX_HP (not overflow)
		expect(playerForSocket(players[0].socket).hp).toBe(MAX_HP);
		// p2 already at MAX_HP — stays at MAX_HP
		expect(playerForSocket(players[1].socket).hp).toBe(MAX_HP);

		// MS unchanged for both (may tick regen by a fraction)
		expect(playerForSocket(players[0].socket).magicStones).toBeCloseTo(p1MsBefore, 1);
		expect(playerForSocket(players[1].socket).magicStones).toBeCloseTo(p2MsBefore, 1);
	});
});
