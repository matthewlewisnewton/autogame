import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';

// quests.js resolves `require('./users')` lazily at call time, so the unlock
// graph reads the CJS instance of the users store. Mutate state through that
// same CJS instance (not the ESM import) or the two won't share the in-memory
// map under vitest. See unlock_prereqs.test.js for the same pattern.
const require = createRequire(import.meta.url);
const {
	createUser,
	findUserByUsername,
	clearUsers,
	setTestFilePath,
	completeQuestTier,
	unlockQuestTier,
} = require('../users.js');
const {
	buildLevelUnlockGraph,
	buildQuestUpdatePayload,
	listQuestVariants,
} = require('../quests.js');

const QUEST_ID = 'training_caverns';

function nodeFor(graph, questId, tier) {
	return graph.nodes.find((n) => n.questId === questId && n.tier === tier);
}

describe('buildLevelUnlockGraph', () => {
	let tmpFile;

	beforeEach(() => {
		tmpFile = path.join(
			os.tmpdir(),
			`unlock-graph-users-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
		);
		setTestFilePath(tmpFile);
		clearUsers();
	});

	afterEach(() => {
		try {
			fs.unlinkSync(tmpFile);
		} catch {}
		try {
			fs.unlinkSync(tmpFile + '.tmp');
		} catch {}
	});

	it('emits exactly one node per quest tier variant', () => {
		const graph = buildLevelUnlockGraph();
		expect(graph.nodes).toHaveLength(listQuestVariants().length);
	});

	it('marks stage-boss tiers with isBoss and their authored unlockRequires', () => {
		const graph = buildLevelUnlockGraph();

		// arena_trials tier 2 is a stage_boss gated behind tier 1.
		const arenaBoss = nodeFor(graph, 'arena_trials', 2);
		expect(arenaBoss.isBoss).toBe(true);
		expect(arenaBoss.objectiveType).toBe('stage_boss');
		expect(arenaBoss.unlockRequires).toEqual([
			{ questId: 'arena_trials', tier: 1 },
		]);

		// frost_crossing tier 1 is a stage_boss with no prerequisites.
		const frostBoss = nodeFor(graph, 'frost_crossing', 1);
		expect(frostBoss.isBoss).toBe(true);
		expect(frostBoss.unlockRequires).toBeNull();

		// A non-boss tier-1 node reports isBoss: false.
		const trainingTier1 = nodeFor(graph, QUEST_ID, 1);
		expect(trainingTier1.isBoss).toBe(false);
	});

	it('every node carries the required fields and a valid state', () => {
		const graph = buildLevelUnlockGraph();
		for (const node of graph.nodes) {
			expect(typeof node.questId).toBe('string');
			expect(Number.isInteger(node.tier)).toBe(true);
			expect(typeof node.name).toBe('string');
			expect(typeof node.objectiveType).toBe('string');
			expect(typeof node.isBoss).toBe('boolean');
			expect(['locked', 'unlocked', 'cleared']).toContain(node.state);
		}
	});

	it('defaults to tier-1 unlocked and higher tiers locked when unauthenticated', () => {
		const graph = buildLevelUnlockGraph();
		for (const node of graph.nodes) {
			expect(node.state).not.toBe('cleared');
			if (node.tier === 1) {
				expect(node.state).toBe('unlocked');
			} else {
				expect(node.state).toBe('locked');
			}
		}

		// An unknown account id behaves the same as no account id.
		const unknownGraph = buildLevelUnlockGraph('not-a-real-account');
		expect(nodeFor(unknownGraph, QUEST_ID, 1).state).toBe('unlocked');
		expect(nodeFor(unknownGraph, QUEST_ID, 2).state).toBe('locked');
	});

	it('reports cleared tiers and unlocks the dependent tier after progression', () => {
		createUser('graph_player', 'pass');
		const { accountId } = findUserByUsername('graph_player');

		// Baseline: tier 1 unlocked, tier 2 locked.
		const before = buildLevelUnlockGraph(accountId);
		expect(nodeFor(before, QUEST_ID, 1).state).toBe('unlocked');
		expect(nodeFor(before, QUEST_ID, 2).state).toBe('locked');

		// Clear tier 1 and unlock its dependent tier 2.
		completeQuestTier(accountId, QUEST_ID, 1);
		unlockQuestTier(accountId, QUEST_ID, 2);

		const after = buildLevelUnlockGraph(accountId);
		expect(nodeFor(after, QUEST_ID, 1).state).toBe('cleared');
		expect(nodeFor(after, QUEST_ID, 2).state).toBe('unlocked');
	});
});

describe('buildQuestUpdatePayload levelUnlockGraph', () => {
	let tmpFile;

	beforeEach(() => {
		tmpFile = path.join(
			os.tmpdir(),
			`payload-graph-users-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
		);
		setTestFilePath(tmpFile);
		clearUsers();
	});

	afterEach(() => {
		try {
			fs.unlinkSync(tmpFile);
		} catch {}
		try {
			fs.unlinkSync(tmpFile + '.tmp');
		} catch {}
	});

	it('attaches the per-player unlock graph when an accountId is provided', () => {
		createUser('payload_player', 'pass');
		const { accountId } = findUserByUsername('payload_player');

		const payload = buildQuestUpdatePayload({}, accountId);
		expect(Array.isArray(payload.levelUnlockGraph.nodes)).toBe(true);
		expect(payload.levelUnlockGraph.nodes).toHaveLength(
			listQuestVariants().length,
		);

		// Field matches a freshly built graph for the same account.
		expect(payload.levelUnlockGraph).toEqual(buildLevelUnlockGraph(accountId));

		// Every node carries the per-player state and normalized unlockRequires.
		for (const node of payload.levelUnlockGraph.nodes) {
			expect(['locked', 'unlocked', 'cleared']).toContain(node.state);
			expect(
				node.unlockRequires === null || Array.isArray(node.unlockRequires),
			).toBe(true);
		}

		// State reflects progression once a tier is cleared.
		completeQuestTier(accountId, QUEST_ID, 1);
		unlockQuestTier(accountId, QUEST_ID, 2);
		const after = buildQuestUpdatePayload({}, accountId);
		expect(nodeFor(after.levelUnlockGraph, QUEST_ID, 1).state).toBe('cleared');
		expect(nodeFor(after.levelUnlockGraph, QUEST_ID, 2).state).toBe('unlocked');
	});

	it('omits the per-player graph when no accountId is provided', () => {
		const payload = buildQuestUpdatePayload({});
		expect(payload.levelUnlockGraph).toBeUndefined();
	});
});
