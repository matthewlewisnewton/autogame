import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	resetGameState,
	MAX_HP,
	MAX_MAGIC_STONES,
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
 * Verifies AoE MS restore, radius boundary, dead-player skip, cooldown gate,
 * and caster self-restore using socket-based test helpers.
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

	it('two players in range both receive MS (HP unchanged, MS capped)', async () => {
		const players = await connectTwoAndStartRun();
		const state = testGameState();

		const p1 = playerForSocket(players[0].socket);
		const p2 = playerForSocket(players[1].socket);

		// Place both players within 3 m of each other (well within 5 m radius)
		p1.x = 0; p1.z = 0;
		p2.x = 2; p2.z = 0;

		// Set both to low HP and low MS
		p1.hp = 20;
		p1.magicStones = 2;
		p2.hp = 30;
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

		// HP must not change
		expect(playerForSocket(players[0].socket).hp).toBe(20);
		expect(playerForSocket(players[1].socket).hp).toBe(30);

		// Both should have gained MS (msRestore=3, capped at MAX_MAGIC_STONES=99)
		// Use toBeCloseTo because MS regen tick may add fractional amounts during test
		expect(playerForSocket(players[0].socket).magicStones).toBeCloseTo(5, 1); // 2 + 3
		expect(playerForSocket(players[1].socket).magicStones).toBeCloseTo(8, 1); // 5 + 3
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
		p1.hp = 20;
		p1.magicStones = 2;
		p2.hp = 30;
		p2.magicStones = 5;
		p3.hp = p3HpBefore;
		p3.magicStones = p3MsBefore;

		p1.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(players[0].socket, 'keyItemUsed');
		players[0].socket.emit('useKeyItem', { keyItemId: 'field_medic_kit' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.alliesRestored).toBe(2); // only p1 and p2

		// p3 should be unchanged (HP exact; MS may tick regen by a fraction)
		expect(playerForSocket(players[2].socket).hp).toBe(p3HpBefore);
		const p3MsAfter = playerForSocket(players[2].socket).magicStones;
		// Out-of-range player must not receive the +3 MS restore; only ambient regen may apply.
		expect(p3MsAfter).toBeLessThan(p3MsBefore + 1);
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
		p1.hp = 20;
		p1.magicStones = 2;
		p2.hp = 30;
		p2.magicStones = 5;
		p2.dead = true;

		p1.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(players[0].socket, 'keyItemUsed');
		players[0].socket.emit('useKeyItem', { keyItemId: 'field_medic_kit' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.alliesRestored).toBe(1); // only p1 (caster), p2 is dead

		// p1 HP unchanged; MS restored
		expect(playerForSocket(players[0].socket).hp).toBe(20);
		expect(playerForSocket(players[0].socket).magicStones).toBeCloseTo(5, 1);

		// p2 should be unchanged (still dead, HP not modified)
		expect(playerForSocket(players[1].socket).hp).toBe(30);
		// MS regen tick may add fractional amounts during the test
		expect(playerForSocket(players[1].socket).magicStones).toBeCloseTo(5, 1);
	});

	it('cooldown gate: reusing within 7s returns on_cooldown', async () => {
		const players = await connectTwoAndStartRun();

		const p1 = playerForSocket(players[0].socket);

		// Set both players in range and at low HP
		p1.x = 0; p1.z = 0;
		p1.hp = 20;
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

		// HP unchanged after first use only
		expect(playerForSocket(players[0].socket).hp).toBe(20);
	});

	it('caster receives MS restore (included in AoE)', async () => {
		const { socket } = await connectAndStartRun(`solo-${Date.now()}`);
		const player = playerForSocket(socket);

		// Set caster to low HP and low MS
		player.hp = 10;
		player.magicStones = 1;
		player.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'field_medic_kit' });
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(result.alliesRestored).toBe(1); // only the caster

		// Caster HP unchanged; MS restored
		expect(playerForSocket(socket).hp).toBe(10);
		expect(playerForSocket(socket).magicStones).toBeCloseTo(4, 1); // 1 + 3

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

	it('HP unchanged and MS capped at MAX_MAGIC_STONES', async () => {
		const players = await connectTwoAndStartRun();

		const p1 = playerForSocket(players[0].socket);
		const p2 = playerForSocket(players[1].socket);

		// Place both in range
		p1.x = 0; p1.z = 0;
		p2.x = 2; p2.z = 0;

		const p1HpBefore = MAX_HP - 10;
		const p2HpBefore = MAX_HP;
		p1.hp = p1HpBefore;
		p1.magicStones = MAX_MAGIC_STONES - 1; // 98
		p2.hp = p2HpBefore;
		p2.magicStones = MAX_MAGIC_STONES; // already at max

		p1.keyItemCooldownUntil = 0;

		const resultPromise = waitForEvent(players[0].socket, 'keyItemUsed');
		players[0].socket.emit('useKeyItem', { keyItemId: 'field_medic_kit' });
		await resultPromise;

		expect(playerForSocket(players[0].socket).hp).toBe(p1HpBefore);
		expect(playerForSocket(players[0].socket).magicStones).toBeCloseTo(MAX_MAGIC_STONES, 0);

		expect(playerForSocket(players[1].socket).hp).toBe(p2HpBefore);
		expect(playerForSocket(players[1].socket).magicStones).toBeCloseTo(MAX_MAGIC_STONES, 0);
	});
});
