import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
	createUser,
	findUserByUsername,
	clearUsers,
	loadUsers,
	setTestFilePath,
	unlockQuestTier,
	completeQuestTier,
	isQuestTierUnlocked,
	hasCompletedQuestTier,
	getUnlockedQuestTiers,
} from '../users.js';

const QUEST_ID = 'training_caverns';
const TIER_2 = 2;

describe('quest tier unlock persistence', () => {
	let tmpFile;

	beforeEach(() => {
		tmpFile = path.join(
			os.tmpdir(),
			`quest-tier-users-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
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

	it('new users include empty unlockedQuestTiers and completedQuestTiers maps', () => {
		createUser('tier_player', 'pass');
		const user = findUserByUsername('tier_player');
		expect(user.unlockedQuestTiers).toEqual({});
		expect(user.completedQuestTiers).toEqual({});

		const onDisk = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
		expect(onDisk[0].unlockedQuestTiers).toEqual({});
		expect(onDisk[0].completedQuestTiers).toEqual({});
	});

	it('loadUsers backfills missing or invalid unlockedQuestTiers to {}', () => {
		const legacy = [
			{
				username: 'legacy_a',
				passwordHash: 'x',
				accountId: 'legacy-a-id',
				unlockedQuestTiers: null,
			},
			{
				username: 'legacy_b',
				passwordHash: 'x',
				accountId: 'legacy-b-id',
				unlockedQuestTiers: { bogus_quest: [2], [QUEST_ID]: [1, 2, 'x'] },
			},
		];
		fs.writeFileSync(tmpFile, JSON.stringify(legacy), 'utf-8');
		clearUsers();
		loadUsers();

		expect(findUserByUsername('legacy_a').unlockedQuestTiers).toEqual({});
		// Tier 1 stripped; bogus quest dropped; tier 2 kept when valid.
		expect(findUserByUsername('legacy_b').unlockedQuestTiers).toEqual({
			[QUEST_ID]: [TIER_2],
		});
	});

	it('unlockQuestTier persists tier 2 and is idempotent', () => {
		createUser('unlocker', 'pass');
		const { accountId } = findUserByUsername('unlocker');

		expect(isQuestTierUnlocked(accountId, QUEST_ID, 1)).toBe(true);
		expect(isQuestTierUnlocked(accountId, QUEST_ID, TIER_2)).toBe(false);

		const first = unlockQuestTier(accountId, QUEST_ID, TIER_2);
		expect(first).toEqual({
			ok: true,
			unlockedQuestTiers: { [QUEST_ID]: [TIER_2] },
		});
		expect(isQuestTierUnlocked(accountId, QUEST_ID, TIER_2)).toBe(true);

		const onDiskAfterFirst = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
		expect(onDiskAfterFirst[0].unlockedQuestTiers).toEqual({ [QUEST_ID]: [TIER_2] });

		const second = unlockQuestTier(accountId, QUEST_ID, TIER_2);
		expect(second).toEqual({
			ok: true,
			unlockedQuestTiers: { [QUEST_ID]: [TIER_2] },
		});
		expect(getUnlockedQuestTiers(accountId)).toEqual({ [QUEST_ID]: [TIER_2] });
	});

	it('reload-from-disk restores unlocks without sockets', () => {
		createUser('reloader', 'pass');
		const { accountId } = findUserByUsername('reloader');
		unlockQuestTier(accountId, QUEST_ID, TIER_2);

		clearUsers();
		loadUsers();

		const restored = findUserByUsername('reloader');
		expect(restored.accountId).toBe(accountId);
		expect(getUnlockedQuestTiers(accountId)).toEqual({ [QUEST_ID]: [TIER_2] });
		expect(isQuestTierUnlocked(accountId, QUEST_ID, TIER_2)).toBe(true);
	});

	it('rejects unknown quest or tier', () => {
		createUser('rejecter', 'pass');
		const { accountId } = findUserByUsername('rejecter');

		expect(unlockQuestTier(accountId, 'not_a_quest', TIER_2)).toEqual({
			ok: false,
			reason: 'Unknown quest or tier',
		});
		expect(unlockQuestTier(accountId, QUEST_ID, 99)).toEqual({
			ok: false,
			reason: 'Unknown quest or tier',
		});
		expect(unlockQuestTier('missing-account', QUEST_ID, TIER_2)).toEqual({
			ok: false,
			reason: 'Account not found',
		});
	});

	it('tier 1 unlock succeeds without persisting tier 1', () => {
		createUser('tier_one', 'pass');
		const { accountId } = findUserByUsername('tier_one');

		const result = unlockQuestTier(accountId, QUEST_ID, 1);
		expect(result.ok).toBe(true);
		expect(result.unlockedQuestTiers).toEqual({});
		expect(getUnlockedQuestTiers(accountId)).toEqual({});

		const onDisk = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
		expect(onDisk[0].unlockedQuestTiers).toEqual({});
	});

	it('loadUsers backfills missing or invalid completedQuestTiers to {}', () => {
		const legacy = [
			{
				username: 'legacy_complete_a',
				passwordHash: 'x',
				accountId: 'legacy-complete-a-id',
				completedQuestTiers: null,
			},
			{
				username: 'legacy_complete_b',
				passwordHash: 'x',
				accountId: 'legacy-complete-b-id',
				completedQuestTiers: { bogus_quest: [2], [QUEST_ID]: [0, 2, 'x'] },
			},
		];
		fs.writeFileSync(tmpFile, JSON.stringify(legacy), 'utf-8');
		clearUsers();
		loadUsers();

		expect(findUserByUsername('legacy_complete_a').completedQuestTiers).toEqual({});
		expect(findUserByUsername('legacy_complete_b').completedQuestTiers).toEqual({
			[QUEST_ID]: [TIER_2],
		});
	});

	it('completeQuestTier persists tier 2 and is idempotent', () => {
		createUser('completer', 'pass');
		const { accountId } = findUserByUsername('completer');

		expect(hasCompletedQuestTier(accountId, QUEST_ID, TIER_2)).toBe(false);

		const first = completeQuestTier(accountId, QUEST_ID, TIER_2);
		expect(first).toEqual({
			ok: true,
			completedQuestTiers: { [QUEST_ID]: [TIER_2] },
		});
		expect(hasCompletedQuestTier(accountId, QUEST_ID, TIER_2)).toBe(true);

		const onDiskAfterFirst = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
		expect(onDiskAfterFirst[0].completedQuestTiers).toEqual({ [QUEST_ID]: [TIER_2] });

		const second = completeQuestTier(accountId, QUEST_ID, TIER_2);
		expect(second).toEqual({
			ok: true,
			completedQuestTiers: { [QUEST_ID]: [TIER_2] },
		});

		clearUsers();
		loadUsers();
		expect(hasCompletedQuestTier(accountId, QUEST_ID, TIER_2)).toBe(true);
	});
});
