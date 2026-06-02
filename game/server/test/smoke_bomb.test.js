import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KEY_ITEM_DEFS } from '../index.js';
import {
	setGameState,
	collectPhaseBeamHits,
	updateEnemies,
	isInSmokeZone,
} from '../simulation.js';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	playerForSocket,
	testGameState,
} from './helpers.js';

// Connect a client and start a dungeon run so we're in the 'playing' phase.
async function connectAndStartRun(baseUrl) {
	const { socket } = await connectClient(baseUrl);
	const startGamePromise = waitForEvent(socket, 'startGame');
	socket.emit('playerReady', true);
	await startGamePromise;
	return { socket };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Definition check (unit) ──

describe('KEY_ITEM_DEFS.smoke_bomb — Smoke Veil definition', () => {
	it('is redefined as Smoke Veil with cooldown/duration/radius/missChance', () => {
		const def = KEY_ITEM_DEFS.smoke_bomb;
		expect(def).toBeDefined();
		expect(def.id).toBe('smoke_bomb');
		expect(def.name).toBe('Smoke Veil');
		expect(def.cooldownMs).toBe(8000);
		expect(def.durationMs).toBe(2000);
		expect(def.radius).toBe(4);
		expect(def.missChance).toBe(0.75);
		// Description text matches the "short fog at feet; enemies lose accuracy" concept.
		expect(def.description.toLowerCase()).toMatch(/fog/);
		expect(def.description.toLowerCase()).toMatch(/accuracy|miss|lose/);
	});
});

// ── Integration tests (via socket) ──

describe('useKeyItem — smoke_bomb (Smoke Veil)', () => {
	let baseUrl;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		await closeServer();
	});

	// (a) using the item sets the ~8s cooldown and creates a zone at the caster.
	it('sets ~8s cooldown and spawns a zone fixed at the caster position', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = testGameState();

		player.keyItemCooldownUntil = 0;
		state.smokeZones = [];
		const castX = player.x;
		const castZ = player.z;

		const before = Date.now();
		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'smoke_bomb' });
		const result = await resultPromise;
		const after = Date.now();

		expect(result.ok).toBe(true);
		expect(result.keyItemId).toBe('smoke_bomb');
		expect(result.x).toBe(castX);
		expect(result.z).toBe(castZ);
		expect(result.radius).toBe(4);
		expect(result.durationMs).toBe(2000);
		// ~8s cooldown
		expect(result.cooldownUntil).toBeGreaterThanOrEqual(before + 8000);
		expect(result.cooldownUntil).toBeLessThanOrEqual(after + 8000);
		expect(player.keyItemCooldownUntil).toBe(result.cooldownUntil);

		// Zone is stored fixed at the cast point with the right radius + expiry.
		expect(state.smokeZones.length).toBe(1);
		const zone = state.smokeZones[0];
		expect(zone.x).toBe(castX);
		expect(zone.z).toBe(castZ);
		expect(zone.radius).toBe(4);
		expect(zone.ownerId).toBe(socket._playerId);
		expect(zone.expiry).toBeGreaterThanOrEqual(before + 2000);
		expect(zone.expiry).toBeLessThanOrEqual(after + 2000);
	});

	it('is included in the broadcast stateUpdate snapshot', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = testGameState();

		player.keyItemCooldownUntil = 0;
		state.smokeZones = [];

		const snapshotPromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('useKeyItem', { keyItemId: 'smoke_bomb' });
		const snapshot = await snapshotPromise;

		expect(Array.isArray(snapshot.smokeZones)).toBe(true);
		expect(snapshot.smokeZones.length).toBe(1);
		expect(snapshot.smokeZones[0].radius).toBe(4);
		expect(snapshot.smokeZones[0].ownerId).toBe(socket._playerId);
	});

	it('returns on_cooldown and does not spawn a zone when on cooldown', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = testGameState();

		player.keyItemCooldownUntil = 0;
		state.smokeZones = [];

		// First use — succeeds.
		const r1 = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'smoke_bomb' });
		expect((await r1).ok).toBe(true);
		expect(state.smokeZones.length).toBe(1);

		// Immediate second use — on cooldown, no new zone.
		const r2 = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'smoke_bomb' });
		const result2 = await r2;

		expect(result2.ok).toBe(false);
		expect(result2.reason).toBe('on_cooldown');
		expect(result2.remainingMs).toBeGreaterThan(0);
		expect(result2.remainingMs).toBeCloseTo(8000, -1);
		expect(state.smokeZones.length).toBe(1); // unchanged
	});

	// (b) over many simulated attacks, the in-zone miss rate is measurably higher.
	it('enemy attacks against a player inside an active zone miss far more often', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = testGameState();

		// Bind the simulation to this lobby's state (the socket handler restores
		// the default state when it returns, mirroring withLobbyContext).
		setGameState(state, []);

		player.invulnerableUntil = 0;
		player.blockingUntil = 0;
		player.shieldHitsRemaining = 0;
		player.barrierDomeUntil = 0;
		player.dead = false;

		const ATTACKS = 400;
		// Fire a phase beam straight through the player's position each attack and
		// count how many actually land (HP dropped). Reset HP between attacks.
		const countHits = () => {
			let landed = 0;
			for (let i = 0; i < ATTACKS; i++) {
				player.hp = 1000;
				collectPhaseBeamHits(player.x, player.z, 1, 0, 5, 10, { attackerId: 'enemy' });
				if (player.hp < 1000) landed++;
			}
			return landed;
		};

		// Control: no zone — every beam lands.
		state.smokeZones = [];
		expect(isInSmokeZone(player)).toBe(false);
		const hitsNoZone = countHits();

		// With an active zone covering the player — many beams miss.
		state.smokeZones = [
			{ ownerId: socket._playerId, x: player.x, z: player.z, radius: 4, expiry: Date.now() + 60000 },
		];
		expect(isInSmokeZone(player)).toBe(true);
		const hitsInZone = countHits();

		const missesNoZone = ATTACKS - hitsNoZone;
		const missesInZone = ATTACKS - hitsInZone;

		// No zone → no smoke misses; in-zone → measurably more misses.
		expect(missesNoZone).toBe(0);
		expect(missesInZone).toBeGreaterThan(missesNoZone);
		// With missChance 0.75 the in-zone miss rate should be well above half.
		expect(missesInZone / ATTACKS).toBeGreaterThan(0.5);
	});

	// (c) the zone is pruned after durationMs elapses.
	it('prunes the zone after its duration elapses', async () => {
		const { socket } = await connectAndStartRun(baseUrl);
		const player = playerForSocket(socket);
		const state = testGameState();

		player.keyItemCooldownUntil = 0;
		state.smokeZones = [];

		const resultPromise = waitForEvent(socket, 'keyItemUsed');
		socket.emit('useKeyItem', { keyItemId: 'smoke_bomb' });
		await resultPromise;
		expect(state.smokeZones.length).toBe(1);

		const def = KEY_ITEM_DEFS.smoke_bomb;

		// Bind the sim to this lobby and confirm the zone survives a tick before
		// its duration elapses.
		setGameState(state, []);
		updateEnemies();
		expect(state.smokeZones.length).toBe(1);

		// Wait out the full duration, then a tick prunes the expired zone.
		await sleep(def.durationMs + 150);
		setGameState(state, []);
		updateEnemies();
		expect(state.smokeZones.length).toBe(0);
	});
});
