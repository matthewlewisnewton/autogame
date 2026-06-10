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
} from './helpers.js';
import { setTestProvider, checkRunTerminalState, _timeouts } from '../index.js';
import { InMemoryProvider } from '../providers.js';

const require = createRequire(import.meta.url);
const users = require('../users.js');

const QUEST_ID = 'training_caverns';
const TIER_2 = 2;

async function connectTwoClients(baseUrl, accountIdA, accountIdB) {
	const first = await connectClient(baseUrl, accountIdA, { name: 'Tier Sync Room' });
	const second = await connectClient(baseUrl, accountIdB, { joinLobbyId: first.lobbyId });
	return {
		socketA: first.socket,
		socketB: second.socket,
		lobbyId: first.lobbyId,
	};
}

function waitForQuestTierSelection(socket, questId, tier, timeout = 5000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error(`Timed out waiting for quest ${questId} tier ${tier}`)),
			timeout,
		);
		const handler = (data) => {
			if (
				data &&
				data.selectedQuestId === questId &&
				(data.selectedQuestTier ?? 1) === tier
			) {
				clearTimeout(timer);
				socket.off('questUpdate', handler);
				socket.off('lobbyUpdate', handler);
				resolve(data);
			}
		};
		socket.on('questUpdate', handler);
		socket.on('lobbyUpdate', handler);
	});
}

function waitForLobbyUnlockMap(socket, questId, tier, timeout = 5000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error(`Timed out waiting for unlock map with ${questId}:${tier}`)),
			timeout,
		);
		const handler = (data) => {
			const tiers = data?.unlockedQuestTiers?.[questId];
			if (Array.isArray(tiers) && tiers.includes(tier)) {
				clearTimeout(timer);
				socket.off('lobbyUpdate', handler);
				socket.off('questUpdate', handler);
				resolve(data);
			}
		};
		socket.on('lobbyUpdate', handler);
		socket.on('questUpdate', handler);
	});
}

function runSimulationInPrimaryLobby(fn) {
	const state = testGameState();
	if (!state) throw new Error('runSimulationInPrimaryLobby: no active lobby state');
	const sim = require('../simulation');
	const progression = require('../progression');
	sim.setGameState(state, _timeouts);
	return fn(state);
}

describe('per-account quest unlock lobby sync', () => {
	let tmpFile;
	let baseUrl;

	beforeEach(async () => {
		tmpFile = path.join(
			os.tmpdir(),
			`quest-tier-lobby-sync-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
		);
		users.setTestFilePath(tmpFile);
		users.clearUsers();
		baseUrl = await startTestServer();
		setTestProvider(new InMemoryProvider());
	});

	afterEach(async () => {
		await closeServer();
		setTestProvider(null);
		try {
			fs.unlinkSync(tmpFile);
		} catch {}
		try {
			fs.unlinkSync(tmpFile + '.tmp');
		} catch {}
	});

	it('does not leak Tier 2 unlock map to a locked account on selectQuest', async () => {
		users.createUser('unlock_holder', 'testpass');
		users.createUser('still_locked', 'testpass');
		const accountA = users.findUserByUsername('unlock_holder').accountId;
		const accountB = users.findUserByUsername('still_locked').accountId;
		users.unlockQuestTier(accountA, QUEST_ID, TIER_2);
		expect(users.isQuestTierUnlocked(accountB, QUEST_ID, TIER_2)).toBe(false);

		const { socketA, socketB } = await connectTwoClients(baseUrl, accountA, accountB);

		const lockedPayloadPromise = waitForQuestTierSelection(socketB, QUEST_ID, TIER_2);
		const unlockedPayloadPromise = waitForQuestTierSelection(socketA, QUEST_ID, TIER_2);

		socketA.emit('selectQuest', { questId: QUEST_ID, tier: TIER_2 });

		const lockedPayload = await lockedPayloadPromise;
		const unlockedPayload = await unlockedPayloadPromise;

		expect(lockedPayload.selectedQuestTier).toBe(TIER_2);
		expect(lockedPayload.unlockedQuestTiers?.[QUEST_ID]).toBeUndefined();
		expect(unlockedPayload.unlockedQuestTiers).toEqual({ [QUEST_ID]: [TIER_2] });

		socketA.disconnect();
		socketB.disconnect();
	});

	it('refreshes Tier 2 unlock on lobby return after Tier 1 victory', async () => {
		users.createUser('tier1_winner', 'testpass');
		const accountId = users.findUserByUsername('tier1_winner').accountId;
		expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER_2)).toBe(false);

		const { socket } = await connectClient(baseUrl, accountId, { name: 'Victory Room' });

		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;
		await waitForEvent(socket, 'stateUpdate');

		const state = testGameState();
		state.enemies = [];
		state.run.objective.totalEnemies = 1;
		state.run.objective.defeatedEnemies = 1;

		const runCompletePromise = waitForEvent(socket, 'runComplete');
		runSimulationInPrimaryLobby((state) => checkRunTerminalState(state));
		await runCompletePromise;
		expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER_2)).toBe(true);

		const lobbyUnlockPromise = waitForLobbyUnlockMap(socket, QUEST_ID, TIER_2);
		const stateAfterReturnPromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('returnToLobby');
		await stateAfterReturnPromise;
		const lobbyPayload = await lobbyUnlockPromise;
		expect(lobbyPayload.unlockedQuestTiers).toEqual({ [QUEST_ID]: [TIER_2] });

		const tier2SelectPromise = waitForQuestTierSelection(socket, QUEST_ID, TIER_2);
		socket.emit('selectQuest', { questId: QUEST_ID, tier: TIER_2 });
		const selectPayload = await tier2SelectPromise;
		expect(selectPayload.unlockedQuestTiers).toEqual({ [QUEST_ID]: [TIER_2] });
		expect(testGameState().selectedQuestTier).toBe(TIER_2);

		socket.disconnect();
	});
});
