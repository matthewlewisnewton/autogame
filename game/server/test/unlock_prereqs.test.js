import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
	createUser,
	findUserByUsername,
	clearUsers,
	setTestFilePath,
	unlockQuestTier,
	completeQuestTier,
	hasCompletedQuestTier,
	areUnlockPrereqsMet,
	isQuestTierUnlocked,
} from '../users.js';
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
const { QUEST_DEFS, buildQuestUpdatePayload, getQuest } = require('../quests.js');

const QUEST_A = 'training_caverns';
const QUEST_B = 'crystal_rescue';
const TIER_1 = 1;
const TIER_2 = 2;
const MULTI_PREREQ_FIXTURE_ID = '__multi_prereq_gating_fixture';
const MULTI_PREREQ_UNLOCK_REQUIRES = [
	{ questId: QUEST_A, tier: TIER_1 },
	{ questId: QUEST_B, tier: TIER_1 },
];
const MULTI_PREREQ_TIER2_UNLOCK_REQUIRES = [
	{ questId: QUEST_A, tier: TIER_2 },
	{ questId: QUEST_B, tier: TIER_2 },
];

function runSimulationInPrimaryLobby(fn) {
	const state = testGameState();
	if (!state) throw new Error('runSimulationInPrimaryLobby: no active lobby state');
	const sim = require('../simulation');
	const progression = require('../progression');
	sim.setGameState(state, _timeouts);
	progression.setGameState(state);
	return fn(state);
}

function simulateQuestTierVictory(questId, tier) {
	const quest = getQuest(questId, tier);
	if (!quest) throw new Error(`simulateQuestTierVictory: unknown ${questId} tier ${tier}`);

	runSimulationInPrimaryLobby((state) => {
		state.enemies = [];
		if (!state.run) {
			state.run = { startedAt: Date.now() };
		}
		state.run.status = 'playing';
		state.run.questId = questId;
		state.run.questTier = tier;
		state.run.objective = { type: quest.objectiveType };

		switch (quest.objectiveType) {
			case 'defeat_enemies':
				state.run.objective.totalEnemies = 1;
				state.run.objective.defeatedEnemies = 1;
				break;
			case 'collect_items': {
				const total = quest.itemCount ?? 1;
				state.run.objective.totalItems = total;
				state.run.objective.collectedItems = total;
				if (quest.scriptedEncounters) {
					state.run.objective.totalEnemies = 1;
					state.run.objective.defeatedEnemies = 1;
				}
				if (quest.extractionDestination) {
					state.run.objective.requiresExtraction = true;
					state.run.objective.extractionPhase = true;
					state.run.objective.extractionReached = true;
				}
				break;
			}
			case 'stage_boss':
				state.run.objective.bossDefeated = true;
				break;
			default:
				throw new Error(`simulateQuestTierVictory: unsupported objective ${quest.objectiveType}`);
		}

		checkRunTerminalState();
	});
}

function installMultiPrereqFixtureQuest(unlockRequires = MULTI_PREREQ_UNLOCK_REQUIRES) {
	QUEST_DEFS[MULTI_PREREQ_FIXTURE_ID] = {
		id: MULTI_PREREQ_FIXTURE_ID,
		enemyPool: [{ type: 'grunt', weight: 1 }],
		tiers: {
			1: {
				name: 'Multi-Prereq Fixture Tier I',
				description: 'Test fixture tier.',
				objectiveType: 'defeat_enemies',
				enemyCount: 1,
				rewardCurrency: 1,
				layoutProfile: 'crowded',
			},
			2: {
				tier: 2,
				name: 'Multi-Prereq Fixture Tier II',
				description: 'Test fixture tier with multi-prereq unlock.',
				objectiveType: 'defeat_enemies',
				enemyCount: 1,
				rewardCurrency: 1,
				layoutProfile: 'crowded',
				unlockRequires,
			},
		},
	};
}

function installMultiPrereqTier2FixtureQuest() {
	installMultiPrereqFixtureQuest(MULTI_PREREQ_TIER2_UNLOCK_REQUIRES);
}

function removeMultiPrereqFixtureQuest() {
	delete QUEST_DEFS[MULTI_PREREQ_FIXTURE_ID];
}

describe('hasCompletedQuestTier', () => {
	let tmpFile;
	let accountId;

	beforeEach(() => {
		tmpFile = path.join(
			os.tmpdir(),
			`unlock-prereqs-users-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
		);
		setTestFilePath(tmpFile);
		clearUsers();
		createUser('prereq_player', 'pass');
		accountId = findUserByUsername('prereq_player').accountId;
	});

	afterEach(() => {
		try {
			fs.unlinkSync(tmpFile);
		} catch {}
		try {
			fs.unlinkSync(tmpFile + '.tmp');
		} catch {}
	});

	it('returns false before tier 1 is completed', () => {
		expect(hasCompletedQuestTier(accountId, QUEST_A, TIER_1)).toBe(false);
	});

	it('returns true after unlockQuestTier records tier 2 (tier 1 victory)', () => {
		unlockQuestTier(accountId, QUEST_A, TIER_2);
		expect(hasCompletedQuestTier(accountId, QUEST_A, TIER_1)).toBe(true);
	});

	it('returns true when tier completion is recorded explicitly', () => {
		completeQuestTier(accountId, QUEST_A, TIER_2);
		expect(hasCompletedQuestTier(accountId, QUEST_A, TIER_2)).toBe(true);
	});

	it('returns false for unknown accounts and invalid quest/tier pairs', () => {
		expect(hasCompletedQuestTier('missing-account', QUEST_A, TIER_1)).toBe(false);
		expect(hasCompletedQuestTier(accountId, 'not_a_quest', TIER_1)).toBe(false);
		expect(hasCompletedQuestTier(accountId, QUEST_A, 99)).toBe(false);
	});
});

describe('areUnlockPrereqsMet', () => {
	let tmpFile;
	let accountId;

	beforeEach(() => {
		tmpFile = path.join(
			os.tmpdir(),
			`unlock-prereqs-met-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
		);
		setTestFilePath(tmpFile);
		clearUsers();
		createUser('prereq_and_player', 'pass');
		accountId = findUserByUsername('prereq_and_player').accountId;
	});

	afterEach(() => {
		try {
			fs.unlinkSync(tmpFile);
		} catch {}
		try {
			fs.unlinkSync(tmpFile + '.tmp');
		} catch {}
	});

	it('returns true when there are zero prerequisites', () => {
		expect(areUnlockPrereqsMet(accountId, null)).toBe(true);
		expect(areUnlockPrereqsMet(accountId, undefined)).toBe(true);
	});

	it('returns false for a single unmet prerequisite', () => {
		expect(
			areUnlockPrereqsMet(accountId, { questId: QUEST_A, tier: TIER_1 }),
		).toBe(false);
	});

	it('returns true for a single met prerequisite', () => {
		unlockQuestTier(accountId, QUEST_A, TIER_2);
		expect(
			areUnlockPrereqsMet(accountId, { questId: QUEST_A, tier: TIER_1 }),
		).toBe(true);
	});

	it('returns false when only one of two AND prerequisites is met', () => {
		unlockQuestTier(accountId, QUEST_A, TIER_2);
		expect(
			areUnlockPrereqsMet(accountId, [
				{ questId: QUEST_A, tier: TIER_1 },
				{ questId: QUEST_B, tier: TIER_1 },
			]),
		).toBe(false);
	});

	it('returns true when both AND prerequisites are met', () => {
		unlockQuestTier(accountId, QUEST_A, TIER_2);
		unlockQuestTier(accountId, QUEST_B, TIER_2);
		expect(
			areUnlockPrereqsMet(accountId, [
				{ questId: QUEST_A, tier: TIER_1 },
				{ questId: QUEST_B, tier: TIER_1 },
			]),
		).toBe(true);
	});

	it('accepts backward-compatible single-object unlockRequires input', () => {
		unlockQuestTier(accountId, QUEST_A, TIER_2);
		expect(
			areUnlockPrereqsMet(accountId, { questId: QUEST_A, tier: TIER_1 }),
		).toBe(true);
	});
});

describe('isQuestTierUnlocked multi-prereq AND gating', () => {
	let tmpFile;
	let accountId;

	beforeEach(() => {
		installMultiPrereqFixtureQuest();
		tmpFile = path.join(
			os.tmpdir(),
			`unlock-prereqs-tier-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
		);
		setTestFilePath(tmpFile);
		clearUsers();
		createUser('multi_prereq_player', 'pass');
		accountId = findUserByUsername('multi_prereq_player').accountId;
	});

	afterEach(() => {
		removeMultiPrereqFixtureQuest();
		try {
			fs.unlinkSync(tmpFile);
		} catch {}
		try {
			fs.unlinkSync(tmpFile + '.tmp');
		} catch {}
	});

	it('keeps tier 1 always unlocked for the fixture quest', () => {
		expect(isQuestTierUnlocked(accountId, MULTI_PREREQ_FIXTURE_ID, TIER_1)).toBe(true);
	});

	it('returns false with persisted tier-2 unlock but no prerequisites completed', () => {
		unlockQuestTier(accountId, MULTI_PREREQ_FIXTURE_ID, TIER_2);
		expect(isQuestTierUnlocked(accountId, MULTI_PREREQ_FIXTURE_ID, TIER_2)).toBe(false);
	});

	it('returns true when persisted tier-2 unlock and all prerequisites are met', () => {
		unlockQuestTier(accountId, MULTI_PREREQ_FIXTURE_ID, TIER_2);
		unlockQuestTier(accountId, QUEST_A, TIER_2);
		unlockQuestTier(accountId, QUEST_B, TIER_2);
		expect(isQuestTierUnlocked(accountId, MULTI_PREREQ_FIXTURE_ID, TIER_2)).toBe(true);
	});

	it('still gates single-object unlockRequires the same as before', () => {
		unlockQuestTier(accountId, QUEST_A, TIER_2);
		expect(isQuestTierUnlocked(accountId, QUEST_A, TIER_2)).toBe(true);
	});
});

describe('isQuestTierUnlocked tier-2 multi-prereq normal flow', () => {
	let tmpFile;
	let baseUrl;
	let accountId;
	let socket;

	beforeEach(async () => {
		installMultiPrereqTier2FixtureQuest();
		tmpFile = path.join(
			os.tmpdir(),
			`unlock-prereqs-tier2-flow-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
		);
		users.setTestFilePath(tmpFile);
		users.clearUsers();
		baseUrl = await startTestServer();
		users.createUser('tier2_flow_player', 'pass');
		accountId = users.findUserByUsername('tier2_flow_player').accountId;
		setTestProvider(new InMemoryProvider());
		const connected = await connectClient(baseUrl, accountId, { name: 'Tier 2 Flow Room' });
		socket = connected.socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
		setTestProvider(null);
		removeMultiPrereqFixtureQuest();
		try {
			fs.unlinkSync(tmpFile);
		} catch {}
		try {
			fs.unlinkSync(tmpFile + '.tmp');
		} catch {}
	});

	it('unlocks fixture tier 2 after tier-1 and tier-2 victories on prerequisites', async () => {
		users.unlockQuestTier(accountId, MULTI_PREREQ_FIXTURE_ID, TIER_2);
		expect(users.isQuestTierUnlocked(accountId, MULTI_PREREQ_FIXTURE_ID, TIER_2)).toBe(false);

		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;
		await waitForEvent(socket, 'stateUpdate');

		simulateQuestTierVictory(QUEST_A, TIER_1);
		expect(users.hasCompletedQuestTier(accountId, QUEST_A, TIER_1)).toBe(true);
		expect(users.isQuestTierUnlocked(accountId, QUEST_A, TIER_2)).toBe(true);
		expect(users.hasCompletedQuestTier(accountId, QUEST_A, TIER_2)).toBe(false);

		simulateQuestTierVictory(QUEST_B, TIER_1);
		expect(users.hasCompletedQuestTier(accountId, QUEST_B, TIER_1)).toBe(true);
		expect(users.isQuestTierUnlocked(accountId, QUEST_B, TIER_2)).toBe(true);
		expect(users.hasCompletedQuestTier(accountId, QUEST_B, TIER_2)).toBe(false);
		expect(users.isQuestTierUnlocked(accountId, MULTI_PREREQ_FIXTURE_ID, TIER_2)).toBe(false);

		simulateQuestTierVictory(QUEST_A, TIER_2);
		expect(users.hasCompletedQuestTier(accountId, QUEST_A, TIER_2)).toBe(true);
		expect(users.isQuestTierUnlocked(accountId, MULTI_PREREQ_FIXTURE_ID, TIER_2)).toBe(false);

		simulateQuestTierVictory(QUEST_B, TIER_2);
		expect(users.hasCompletedQuestTier(accountId, QUEST_B, TIER_2)).toBe(true);
		expect(users.isQuestTierUnlocked(accountId, MULTI_PREREQ_FIXTURE_ID, TIER_2)).toBe(true);
	});
});

describe('buildQuestUpdatePayload multi-prereq tierUnlocked', () => {
	let tmpFile;
	let accountId;

	beforeEach(() => {
		installMultiPrereqFixtureQuest();
		tmpFile = path.join(
			os.tmpdir(),
			`unlock-prereqs-payload-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
		);
		users.setTestFilePath(tmpFile);
		users.clearUsers();
		users.createUser('multi_prereq_payload', 'pass');
		accountId = users.findUserByUsername('multi_prereq_payload').accountId;
	});

	afterEach(() => {
		removeMultiPrereqFixtureQuest();
		try {
			fs.unlinkSync(tmpFile);
		} catch {}
		try {
			fs.unlinkSync(tmpFile + '.tmp');
		} catch {}
	});

	function fixtureTier2Variant(payload) {
		return payload.questVariants.find(
			(v) => v.questId === MULTI_PREREQ_FIXTURE_ID && v.tier === TIER_2,
		);
	}

	it('reports tierUnlocked false with one prereq completed and persisted tier-2 unlock', () => {
		users.unlockQuestTier(accountId, MULTI_PREREQ_FIXTURE_ID, TIER_2);
		users.unlockQuestTier(accountId, QUEST_A, TIER_2);

		const payload = buildQuestUpdatePayload({}, accountId);
		const tier2 = fixtureTier2Variant(payload);

		expect(tier2.tierUnlocked).toBe(false);
		expect(tier2.unlockRequires).toEqual(MULTI_PREREQ_UNLOCK_REQUIRES);
		expect(users.getUnlockedQuestTiers(accountId)).toEqual({
			[MULTI_PREREQ_FIXTURE_ID]: [TIER_2],
			[QUEST_A]: [TIER_2],
		});
		expect(payload.unlockedQuestTiers).toEqual(users.getUnlockedQuestTiers(accountId));
	});

	it('reports tierUnlocked true when both prerequisites are met and tier-2 is persisted', () => {
		users.unlockQuestTier(accountId, MULTI_PREREQ_FIXTURE_ID, TIER_2);
		users.unlockQuestTier(accountId, QUEST_A, TIER_2);
		users.unlockQuestTier(accountId, QUEST_B, TIER_2);

		const payload = buildQuestUpdatePayload({}, accountId);
		const tier2 = fixtureTier2Variant(payload);

		expect(tier2.tierUnlocked).toBe(true);
		expect(payload.unlockedQuestTiers).toEqual({
			[MULTI_PREREQ_FIXTURE_ID]: [TIER_2],
			[QUEST_A]: [TIER_2],
			[QUEST_B]: [TIER_2],
		});
	});
});

describe('isQuestTierUnlocked multi-prereq socket selectQuest', () => {
	let tmpFile;
	let baseUrl;
	let accountId;
	let socket;

	beforeEach(async () => {
		installMultiPrereqFixtureQuest();
		tmpFile = path.join(
			os.tmpdir(),
			`unlock-prereqs-socket-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
		);
		users.setTestFilePath(tmpFile);
		users.clearUsers();
		baseUrl = await startTestServer();
		users.createUser('multi_prereq_socket', 'pass');
		accountId = users.findUserByUsername('multi_prereq_socket').accountId;
		setTestProvider(new InMemoryProvider());
		const connected = await connectClient(baseUrl, accountId, { name: 'Multi Prereq Room' });
		socket = connected.socket;
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
		setTestProvider(null);
		removeMultiPrereqFixtureQuest();
		try {
			fs.unlinkSync(tmpFile);
		} catch {}
		try {
			fs.unlinkSync(tmpFile + '.tmp');
		} catch {}
	});

	it('rejects tier 2 selectQuest with tier_locked when prerequisites are unmet', async () => {
		users.unlockQuestTier(accountId, MULTI_PREREQ_FIXTURE_ID, TIER_2);
		expect(users.isQuestTierUnlocked(accountId, MULTI_PREREQ_FIXTURE_ID, TIER_2)).toBe(false);

		const errorPromise = waitForEvent(socket, 'questError');
		socket.emit('selectQuest', { questId: MULTI_PREREQ_FIXTURE_ID, tier: TIER_2 });
		const err = await errorPromise;

		expect(err.reason).toBe('tier_locked');
		expect(testGameState().selectedQuestTier ?? 1).toBe(1);
	});

	it('allows tier 2 selectQuest when persisted unlock and prerequisites are met', async () => {
		users.unlockQuestTier(accountId, MULTI_PREREQ_FIXTURE_ID, TIER_2);
		users.unlockQuestTier(accountId, QUEST_A, TIER_2);
		users.unlockQuestTier(accountId, QUEST_B, TIER_2);
		expect(users.isQuestTierUnlocked(accountId, MULTI_PREREQ_FIXTURE_ID, TIER_2)).toBe(true);

		const updatePromise = waitForEvent(socket, 'questUpdate');
		socket.emit('selectQuest', { questId: MULTI_PREREQ_FIXTURE_ID, tier: TIER_2 });
		const payload = await updatePromise;

		expect(payload.selectedQuestId).toBe(MULTI_PREREQ_FIXTURE_ID);
		expect(payload.selectedQuestTier).toBe(TIER_2);
		expect(testGameState().selectedQuestTier).toBe(TIER_2);
	});
});

describe('lobby broadcast multi-prereq tierUnlocked', () => {
	let tmpFile;
	let baseUrl;
	let accountId;
	let socket;

	function fixtureTier2Variant(payload) {
		return payload.questVariants.find(
			(v) => v.questId === MULTI_PREREQ_FIXTURE_ID && v.tier === TIER_2,
		);
	}

	beforeEach(async () => {
		installMultiPrereqFixtureQuest();
		tmpFile = path.join(
			os.tmpdir(),
			`unlock-prereqs-broadcast-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
		);
		users.setTestFilePath(tmpFile);
		users.clearUsers();
		baseUrl = await startTestServer();
		users.createUser('multi_prereq_broadcast', 'pass');
		accountId = users.findUserByUsername('multi_prereq_broadcast').accountId;
		setTestProvider(new InMemoryProvider());
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		await closeServer();
		setTestProvider(null);
		removeMultiPrereqFixtureQuest();
		try {
			fs.unlinkSync(tmpFile);
		} catch {}
		try {
			fs.unlinkSync(tmpFile + '.tmp');
		} catch {}
	});

	async function connectWithPartialPrereqs() {
		users.unlockQuestTier(accountId, MULTI_PREREQ_FIXTURE_ID, TIER_2);
		users.unlockQuestTier(accountId, QUEST_A, TIER_2);
		expect(users.isQuestTierUnlocked(accountId, MULTI_PREREQ_FIXTURE_ID, TIER_2)).toBe(false);

		const connected = await connectClient(baseUrl, accountId, { name: 'Multi Prereq Broadcast' });
		socket = connected.socket;
	}

	it('lobbyUpdate includes evaluated tierUnlocked on questVariants', async () => {
		await connectWithPartialPrereqs();

		const lobbyUpdatePromise = waitForEvent(socket, 'lobbyUpdate');
		socket.emit('playerReady', true);
		const payload = await lobbyUpdatePromise;

		const tier2 = fixtureTier2Variant(payload);
		expect(tier2).toBeDefined();
		expect(tier2.tierUnlocked).toBe(false);
		expect(payload.unlockedQuestTiers).toEqual({
			[MULTI_PREREQ_FIXTURE_ID]: [TIER_2],
			[QUEST_A]: [TIER_2],
		});
	});

	it('questUpdate from emitQuestPayloadToLobby includes evaluated tierUnlocked', async () => {
		await connectWithPartialPrereqs();

		const questUpdatePromise = waitForEvent(socket, 'questUpdate');
		socket.emit('selectQuest', { questId: QUEST_A, tier: TIER_1 });
		const payload = await questUpdatePromise;

		const tier2 = fixtureTier2Variant(payload);
		expect(tier2).toBeDefined();
		expect(tier2.tierUnlocked).toBe(false);
		expect(payload.unlockedQuestTiers).toEqual({
			[MULTI_PREREQ_FIXTURE_ID]: [TIER_2],
			[QUEST_A]: [TIER_2],
		});
	});
});
