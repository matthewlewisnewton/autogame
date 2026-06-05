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
import { questLayoutSeed } from '../dungeon.js';

const require = createRequire(import.meta.url);
const users = require('../users.js');

const QUEST_ID = 'training_caverns';
const TIER_2 = 2;

function waitForQuestSelection(socket, questId, tier, timeout = 5000) {
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

function runSimulationInPrimaryLobby(fn) {
	const state = testGameState();
	if (!state) throw new Error('runSimulationInPrimaryLobby: no active lobby state');
	const sim = require('../simulation');
	const progression = require('../progression');
	sim.setGameState(state, _timeouts);
	progression.setGameState(state);
	return fn(state);
}

describe('quest tier gating (socket + persistence)', () => {
	let tmpFile;
	let baseUrl;
	let accountId;
	let socket;

	beforeEach(async () => {
		tmpFile = path.join(
			os.tmpdir(),
			`quest-tier-gating-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
		);
		users.setTestFilePath(tmpFile);
		users.clearUsers();

		baseUrl = await startTestServer();

		users.createUser('tier_gater', 'testpass');
		accountId = users.findUserByUsername('tier_gater').accountId;
		setTestProvider(new InMemoryProvider());

		const connected = await connectClient(baseUrl, accountId, { name: 'Tier Room' });
		socket = connected.socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
		setTestProvider(null);
		try {
			fs.unlinkSync(tmpFile);
		} catch {}
		try {
			fs.unlinkSync(tmpFile + '.tmp');
		} catch {}
	});

	it('rejects Tier 2 selection before unlock with tier_locked', async () => {
		expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER_2)).toBe(false);

		const errorPromise = waitForEvent(socket, 'questError');
		socket.emit('selectQuest', { questId: QUEST_ID, tier: TIER_2 });
		const err = await errorPromise;

		expect(err.reason).toBe('tier_locked');
		expect(testGameState().selectedQuestId).toBe(QUEST_ID);
		expect(testGameState().selectedQuestTier ?? 1).toBe(1);
	});

	it('allows Tier 2 selection after manual unlockQuestTier', async () => {
		users.unlockQuestTier(accountId, QUEST_ID, TIER_2);
		expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER_2)).toBe(true);

		const updatePromise = waitForQuestSelection(socket, QUEST_ID, TIER_2);
		socket.emit('selectQuest', { questId: QUEST_ID, tier: TIER_2 });
		const payload = await updatePromise;

		expect(payload.selectedQuestId).toBe(QUEST_ID);
		expect(payload.selectedQuestTier).toBe(TIER_2);
		expect(Array.isArray(payload.questVariants)).toBe(true);
		expect(payload.questVariants.some((v) => v.questId === QUEST_ID && v.tier === TIER_2)).toBe(true);
		expect(payload.unlockedQuestTiers).toEqual({ [QUEST_ID]: [TIER_2] });
		expect(testGameState().selectedQuestTier).toBe(TIER_2);
		expect(testGameState().layoutSeed).toBe(questLayoutSeed(QUEST_ID, TIER_2));
	});

	it('victory on Tier 1 unlocks Tier 2 on disk for in-run players', async () => {
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;
		await waitForEvent(socket, 'stateUpdate');

		const state = testGameState();
		expect(state.run.questId).toBe(QUEST_ID);
		expect(state.run.questTier ?? 1).toBe(1);
		expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER_2)).toBe(false);

		state.enemies = [];
		state.run.objective.totalEnemies = 1;
		state.run.objective.defeatedEnemies = 1;

		const runCompletePromise = waitForEvent(socket, 'runComplete');
		runSimulationInPrimaryLobby(() => checkRunTerminalState());
		const summary = await runCompletePromise;

		expect(summary.status).toBe('victory');
		expect(summary.questId).toBe(QUEST_ID);
		expect(summary.questTier ?? 1).toBe(1);
		expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER_2)).toBe(true);

		const onDisk = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
		const record = onDisk.find((r) => r.accountId === accountId);
		expect(record.unlockedQuestTiers).toEqual({ [QUEST_ID]: [TIER_2] });

		users.clearUsers();
		users.loadUsers();
		expect(users.isQuestTierUnlocked(accountId, QUEST_ID, TIER_2)).toBe(true);
	});

	it('rejects unknown quest tier combinations', async () => {
		const errorPromise = waitForEvent(socket, 'questError');
		socket.emit('selectQuest', { questId: 'canyon_descent', tier: 2 });
		const err = await errorPromise;

		expect(err.reason).toContain('Unknown quest or tier');
		expect(testGameState().selectedQuestTier ?? 1).toBe(1);
	});
});

describe('Tier 2 squad ready/deploy gate', () => {
	let tmpFile;
	let baseUrl;

	beforeEach(async () => {
		tmpFile = path.join(
			os.tmpdir(),
			`quest-tier-deploy-gate-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
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

	async function connectTwoClients(accountIdA, accountIdB) {
		const first = await connectClient(baseUrl, accountIdA, { name: 'Tier Deploy Room' });
		const second = await connectClient(baseUrl, accountIdB, { joinLobbyId: first.lobbyId });
		return { socketA: first.socket, socketB: second.socket };
	}

	it('rejects ready for a locked squad member and does not start deploy', async () => {
		users.createUser('unlock_holder', 'testpass');
		users.createUser('still_locked', 'testpass');
		const accountA = users.findUserByUsername('unlock_holder').accountId;
		const accountB = users.findUserByUsername('still_locked').accountId;
		users.unlockQuestTier(accountA, QUEST_ID, TIER_2);

		const { socketA, socketB } = await connectTwoClients(accountA, accountB);

		const tier2Promise = waitForQuestSelection(socketA, QUEST_ID, TIER_2);
		socketA.emit('selectQuest', { questId: QUEST_ID, tier: TIER_2 });
		await tier2Promise;

		let startGameFired = false;
		socketA.on('startGame', () => { startGameFired = true; });
		socketB.on('startGame', () => { startGameFired = true; });

		const errorPromise = waitForEvent(socketB, 'questError');
		socketB.emit('playerReady', true);
		const err = await errorPromise;

		expect(err.reason).toBe('tier_locked');
		expect(testGameState().players[accountB].ready).toBe(false);
		expect(testGameState().gamePhase).toBe('lobby');

		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(startGameFired).toBe(false);

		socketA.disconnect();
		socketB.disconnect();
	});

	it('starts Tier 2 run when every connected player has the tier unlock', async () => {
		users.createUser('tier2_a', 'testpass');
		users.createUser('tier2_b', 'testpass');
		const accountA = users.findUserByUsername('tier2_a').accountId;
		const accountB = users.findUserByUsername('tier2_b').accountId;
		users.unlockQuestTier(accountA, QUEST_ID, TIER_2);
		users.unlockQuestTier(accountB, QUEST_ID, TIER_2);

		const { socketA, socketB } = await connectTwoClients(accountA, accountB);

		const tier2Promise = waitForQuestSelection(socketA, QUEST_ID, TIER_2);
		socketA.emit('selectQuest', { questId: QUEST_ID, tier: TIER_2 });
		await tier2Promise;

		const startGameA = waitForEvent(socketA, 'startGame');
		const startGameB = waitForEvent(socketB, 'startGame');
		socketA.emit('playerReady', true);
		socketB.emit('playerReady', true);
		await startGameA;
		await startGameB;

		const state = testGameState();
		expect(state.run.questId).toBe(QUEST_ID);
		expect(state.run.questTier).toBe(TIER_2);

		socketA.disconnect();
		socketB.disconnect();
	});

	it('checkAllReady aborts when a ready player lacks Tier 2 unlock', async () => {
		users.createUser('unlock_holder', 'testpass');
		users.createUser('still_locked', 'testpass');
		const accountA = users.findUserByUsername('unlock_holder').accountId;
		const accountB = users.findUserByUsername('still_locked').accountId;
		users.unlockQuestTier(accountA, QUEST_ID, TIER_2);

		const { socketA, socketB } = await connectTwoClients(accountA, accountB);

		const tier2Promise = waitForQuestSelection(socketA, QUEST_ID, TIER_2);
		socketA.emit('selectQuest', { questId: QUEST_ID, tier: TIER_2 });
		await tier2Promise;

		const progression = require('../progression');
		runSimulationInPrimaryLobby(() => {
			const state = testGameState();
			state.players[accountA].ready = true;
			state.players[accountB].ready = true;
			progression.checkAllReady();
		});

		const state = testGameState();
		expect(state.gamePhase).toBe('lobby');
		expect(state.players[accountB].ready).toBe(false);
		expect(state.run).toBeUndefined();

		socketA.disconnect();
		socketB.disconnect();
	});
});
