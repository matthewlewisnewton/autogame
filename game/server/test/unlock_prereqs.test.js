import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
	createUser,
	findUserByUsername,
	clearUsers,
	setTestFilePath,
	unlockQuestTier,
	hasCompletedQuestTier,
	areUnlockPrereqsMet,
} from '../users.js';

const QUEST_A = 'training_caverns';
const QUEST_B = 'crystal_rescue';
const TIER_1 = 1;
const TIER_2 = 2;

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
