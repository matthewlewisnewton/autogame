import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
	startTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	testGameState,
	playerForSocket,
} from './helpers.js';
import { setTestProvider } from '../index.js';
import { InMemoryProvider } from '../providers.js';

const require = createRequire(import.meta.url);
const users = require('../users.js');
const { questLayoutSeed } = require('../dungeon.js');

const DEFAULT_QUEST_ID = 'training_caverns';
const SELECTED_QUEST_ID = 'crystal_rescue';
const TIER_1 = 1;

function waitForQuestSelection(socket, questId, timeout = 5000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error(`Timed out waiting for quest ${questId} selection`)),
			timeout,
		);
		const handler = (data) => {
			if (data && data.selectedQuestId === questId) {
				clearTimeout(timer);
				socket.off('questUpdate', handler);
				resolve(data);
			}
		};
		socket.on('questUpdate', handler);
	});
}

describe('defer quest layout swap + spawn teleport to deploy', () => {
	let tmpFile;
	let baseUrl;

	beforeEach(async () => {
		tmpFile = path.join(
			os.tmpdir(),
			`defer-quest-layout-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
		);
		users.setTestFilePath(tmpFile);
		users.clearUsers();
		baseUrl = await startTestServer();
		setTestProvider(new InMemoryProvider());
	});

	afterEach(async () => {
		await closeServer();
		setTestProvider(null);
		try { fs.unlinkSync(tmpFile); } catch {}
		try { fs.unlinkSync(tmpFile + '.tmp'); } catch {}
	});

	it('selecting a quest records selection + previews layout without teleporting or swapping the live layout, and deploy applies it', async () => {
		users.createUser('selector', 'testpass');
		const accountId = users.findUserByUsername('selector').accountId;

		const { socket } = await connectClient(baseUrl, accountId, { name: 'Defer Room' });

		const state = testGameState();
		const defaultSeed = questLayoutSeed(DEFAULT_QUEST_ID, TIER_1);
		const selectedSeed = questLayoutSeed(SELECTED_QUEST_ID, TIER_1);
		expect(state.layoutSeed).toBe(defaultSeed);

		// Snapshot the player's hub position before selecting a non-default quest.
		const player = playerForSocket(socket);
		const before = { x: player.x, y: player.y, z: player.z };

		const questPromise = waitForQuestSelection(socket, SELECTED_QUEST_ID);
		socket.emit('selectQuest', { questId: SELECTED_QUEST_ID, tier: TIER_1 });
		const payload = await questPromise;

		// Selection is recorded.
		expect(state.selectedQuestId).toBe(SELECTED_QUEST_ID);
		expect(state.selectedQuestTier).toBe(TIER_1);

		// No teleport: the player's position is untouched.
		expect(player.x).toBe(before.x);
		expect(player.y).toBe(before.y);
		expect(player.z).toBe(before.z);

		// Live layout is NOT swapped — still the hub/default-quest layout.
		expect(state.layoutSeed).toBe(defaultSeed);

		// But a deterministic preview for the selected quest is emitted for caching.
		expect(payload.layoutSeed).toBe(selectedSeed);
		expect(payload.layout).toBeTruthy();
		expect(payload.layout.rooms.length).toBeGreaterThan(0);

		// Deploy: ready up and the run swaps to the selected quest's layout + spawns.
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;

		expect(state.layoutSeed).toBe(selectedSeed);
		// Player has been teleported to a run spawn (no longer at the hub position).
		const moved = player.x !== before.x || player.y !== before.y || player.z !== before.z;
		expect(moved).toBe(true);

		socket.disconnect();
	});

	it('sends the generated preview only to the selecting player', async () => {
		users.createUser('preview_selector', 'testpass');
		users.createUser('preview_observer', 'testpass');
		const selectorId = users.findUserByUsername('preview_selector').accountId;
		const observerId = users.findUserByUsername('preview_observer').accountId;
		const selector = await connectClient(baseUrl, selectorId, { name: 'Preview Room' });
		const observer = await connectClient(baseUrl, observerId, { joinLobbyId: selector.lobbyId });

		const selectorUpdate = waitForQuestSelection(selector.socket, SELECTED_QUEST_ID);
		const observerUpdate = waitForQuestSelection(observer.socket, SELECTED_QUEST_ID);
		selector.socket.emit('selectQuest', { questId: SELECTED_QUEST_ID, tier: TIER_1 });

		const [selected, observed] = await Promise.all([selectorUpdate, observerUpdate]);
		expect(selected.layout).toBeTruthy();
		expect(selected.layoutSeed).toBe(questLayoutSeed(SELECTED_QUEST_ID, TIER_1));
		expect(observed.layout).toBeUndefined();
		expect(observed.layoutSeed).toBeUndefined();

		selector.socket.disconnect();
		observer.socket.disconnect();
	});
});
