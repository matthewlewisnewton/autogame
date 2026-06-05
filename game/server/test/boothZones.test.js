import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { generateHub } from '../dungeon.js';
import {
	startTestServer,
	closeServer,
	connectClient,
	testGameState,
	waitForEvent,
} from './helpers.js';

const require = createRequire(import.meta.url);
// The server consumes the CJS bridge; exercise the same module here so the
// dual-file primitive is covered exactly as production loads it.
const { findBoothInRange, BOOTH_INTERACT_RADIUS } = require('../../shared/boothZones.js');

const HUB = generateHub(0);
const ANCHORS = HUB.boothAnchors;

describe('findBoothInRange (zone primitive)', () => {
	it('exports a sensible radius comfortably inside the anchor inset', () => {
		expect(typeof BOOTH_INTERACT_RADIUS).toBe('number');
		expect(BOOTH_INTERACT_RADIUS).toBeGreaterThan(0);
		// HUB_ANCHOR_INSET is 4; radius must stay well below so the two booths
		// sharing a hub room never both trigger.
		expect(BOOTH_INTERACT_RADIUS).toBeLessThan(4);
	});

	it('zone enter: a position at a booth centre returns that booth id', () => {
		for (const [id, anchor] of Object.entries(ANCHORS)) {
			expect(findBoothInRange(ANCHORS, anchor.x, anchor.z)).toBe(id);
		}
	});

	it('zone enter: a position just inside the radius returns the booth id', () => {
		const id = 'quest';
		const a = ANCHORS[id];
		const offset = BOOTH_INTERACT_RADIUS - 0.1;
		expect(findBoothInRange(ANCHORS, a.x + offset, a.z)).toBe(id);
	});

	it('zone exit: a position just beyond the radius returns null', () => {
		const a = ANCHORS.quest;
		const offset = BOOTH_INTERACT_RADIUS + 0.1;
		expect(findBoothInRange(ANCHORS, a.x + offset, a.z)).toBeNull();
	});

	it('zone exit: a position far from every booth returns null', () => {
		expect(findBoothInRange(ANCHORS, 1000, 1000)).toBeNull();
	});

	it('nearest: between two booths it returns the closer one, or null if both out of range', () => {
		const quest = ANCHORS.quest;
		const launch = ANCHORS.launch;

		// Exact midpoint between the two operations-room booths: both are far
		// outside BOOTH_INTERACT_RADIUS (they sit ~11 units apart), so null.
		const midX = (quest.x + launch.x) / 2;
		const midZ = (quest.z + launch.z) / 2;
		expect(findBoothInRange(ANCHORS, midX, midZ)).toBeNull();

		// Nudge a hair toward quest but stay in range of quest only.
		const nearQuestX = quest.x + 1;
		const nearQuestZ = quest.z + 1;
		expect(findBoothInRange(ANCHORS, nearQuestX, nearQuestZ)).toBe('quest');
	});

	it('respects an explicit radius override', () => {
		const quest = ANCHORS.quest;
		const launch = ANCHORS.launch;
		const between = Math.hypot(quest.x - launch.x, quest.z - launch.z);
		// With a wide radius both are in range; the centre of quest is closest.
		expect(findBoothInRange(ANCHORS, quest.x, quest.z, between)).toBe('quest');
		// With a zero radius nothing matches.
		expect(findBoothInRange(ANCHORS, quest.x, quest.z, 0)).toBe('quest');
		expect(findBoothInRange(ANCHORS, quest.x + 0.01, quest.z, 0)).toBeNull();
	});

	it('returns null for malformed inputs', () => {
		expect(findBoothInRange(null, 0, 0)).toBeNull();
		expect(findBoothInRange(ANCHORS, NaN, 0)).toBeNull();
		expect(findBoothInRange(ANCHORS, 0, Infinity)).toBeNull();
	});
});

describe('boothInteract socket handler', () => {
	let baseUrl;
	let socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		socket = (await connectClient(baseUrl)).socket;
		expect(testGameState().gamePhase).toBe('lobby');
	});

	afterEach(async () => {
		if (socket?.connected) socket.disconnect();
		await closeServer();
	});

	it('emits boothAction with the correct id when the player is in range', async () => {
		const player = testGameState().players[socket._playerId];
		const anchor = ANCHORS.shop;
		player.x = anchor.x;
		player.z = anchor.z;

		socket.emit('boothInteract', { boothId: 'shop' });
		const action = await waitForEvent(socket, 'boothAction', 3000);
		expect(action).toEqual({ boothId: 'shop', action: 'shop' });
	});

	it('emits boothError out_of_range when the player is too far away', async () => {
		const player = testGameState().players[socket._playerId];
		const anchor = ANCHORS.shop;
		player.x = anchor.x + 100;
		player.z = anchor.z + 100;

		socket.emit('boothInteract', { boothId: 'shop' });
		const err = await waitForEvent(socket, 'boothError', 3000);
		expect(err.reason).toBe('out_of_range');
	});

	it('emits boothError out_of_range when standing in a different booth', async () => {
		const player = testGameState().players[socket._playerId];
		const anchor = ANCHORS.quest;
		player.x = anchor.x;
		player.z = anchor.z;

		// Standing in quest but asking for launch → rejected.
		socket.emit('boothInteract', { boothId: 'launch' });
		const err = await waitForEvent(socket, 'boothError', 3000);
		expect(err.reason).toBe('out_of_range');
	});

	it('emits boothError unknown_booth for an unknown or missing booth id', async () => {
		const player = testGameState().players[socket._playerId];
		const anchor = ANCHORS.shop;
		player.x = anchor.x;
		player.z = anchor.z;

		socket.emit('boothInteract', { boothId: 'not-a-booth' });
		const err1 = await waitForEvent(socket, 'boothError', 3000);
		expect(err1.reason).toBe('unknown_booth');

		socket.emit('boothInteract', {});
		const err2 = await waitForEvent(socket, 'boothError', 3000);
		expect(err2.reason).toBe('unknown_booth');
	});

	it('emits boothError not_in_lobby when the socket is not in a lobby', async () => {
		const lone = (await connectClient(baseUrl, undefined, { skipLobby: true })).socket;
		try {
			lone.emit('boothInteract', { boothId: 'shop' });
			const err = await waitForEvent(lone, 'boothError', 3000);
			expect(err.reason).toBe('not_in_lobby');
		} finally {
			if (lone.connected) lone.disconnect();
		}
	});
});
