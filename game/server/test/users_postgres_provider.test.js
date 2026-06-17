import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newDb } from 'pg-mem';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PostgresProvider } from '../providers.js';
import { USERS_SCHEMA_SQL } from '../db/ensurePlayersSchema.js';
import {
	clearUsers,
	initUsersWithProvider,
	loadUsersAsync,
	createUserAsync,
	findUserByUsernameAsync,
	comparePasswordAsync,
	findUserByAccountId,
	findUserByAccountIdAsync,
	updateProfile,
	unlockQuestTier,
	isQuestTierUnlocked,
	setTestFilePath,
	cacheUserRecordForTest,
} from '../users.js';

const USERNAME = 'cross_inst_user';
const PASSWORD = 'secret-pass';
const QUEST_ID = 'training_caverns';
const TIER_2 = 2;

function createSharedPool() {
	const db = newDb();
	db.public.none(USERS_SCHEMA_SQL);
	const { Pool } = db.adapters.createPg();
	return new Pool();
}

function createProviderOnPool(pool) {
	return new PostgresProvider({ pool, skipSchemaEnsure: true });
}

/** Simulate a fresh server instance: empty in-memory cache, provider wired. */
function bootColdInstance(provider, { preload = false } = {}) {
	clearUsers();
	initUsersWithProvider(provider);
	if (preload) {
		return loadUsersAsync();
	}
	return Promise.resolve();
}

async function queryUserEmailFromDb(sharedPool, accountId) {
	const { rows } = await sharedPool.query(
		`SELECT data->>'email' AS email FROM users WHERE account_id = $1`,
		[accountId],
	);
	return rows[0]?.email ?? null;
}

async function queryUserCosmeticBodyColorFromDb(sharedPool, accountId) {
	const { rows } = await sharedPool.query(
		`SELECT data->'cosmetic'->>'bodyColor' AS body_color FROM users WHERE account_id = $1`,
		[accountId],
	);
	return rows[0]?.body_color ?? null;
}

describe('users postgres provider cross-instance', () => {
	let pool;
	let providerA;
	let providerB;
	let tmpUsersFile;

	beforeEach(() => {
		tmpUsersFile = path.join(
			os.tmpdir(),
			`users-pg-cross-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
		);
		setTestFilePath(tmpUsersFile);
		pool = createSharedPool();
		providerA = createProviderOnPool(pool);
		providerB = createProviderOnPool(pool);
	});

	afterEach(async () => {
		clearUsers();
		initUsersWithProvider(null);
		if (providerA) {
			await providerA.close();
			providerA = null;
		}
		if (providerB) {
			await providerB.close();
			providerB = null;
		}
		if (pool) {
			await pool.end();
			pool = null;
		}
		try {
			fs.unlinkSync(tmpUsersFile);
		} catch {}
	});

	it('register on instance A, login on instance B via shared Postgres', async () => {
		await bootColdInstance(providerA, { preload: true });
		const created = await createUserAsync(USERNAME, PASSWORD);
		expect(created.ok).toBe(true);

		await bootColdInstance(providerB);
		const user = await findUserByUsernameAsync(USERNAME);
		expect(user).not.toBeNull();
		expect(await comparePasswordAsync(PASSWORD, user.passwordHash)).toBe(true);
		expect(fs.existsSync(tmpUsersFile)).toBe(false);
	});

	it('cosmetic update on A is visible on B after hydration', async () => {
		await bootColdInstance(providerA, { preload: true });
		const created = await createUserAsync(USERNAME, PASSWORD);
		expect(created.ok).toBe(true);

		const onA = findUserByAccountId(created.accountId);
		expect(onA).not.toBeNull();
		const cosmeticUpdate = await updateProfile(created.accountId, {
			cosmetic: { hat: 'bandana', bodyShape: 'cone' },
		});
		expect(cosmeticUpdate.ok).toBe(true);

		await bootColdInstance(providerB);
		await findUserByUsernameAsync(USERNAME);
		const onB = findUserByAccountId(created.accountId);
		expect(onB).not.toBeNull();
		expect(onB.cosmetic.hat).toBe('bandana');
		expect(onB.cosmetic.bodyShape).toBe('cone');
	});

	it('unlockQuestTier on A is visible on B after hydration', async () => {
		await bootColdInstance(providerA, { preload: true });
		const created = await createUserAsync(USERNAME, PASSWORD);
		expect(created.ok).toBe(true);

		const unlocked = await unlockQuestTier(created.accountId, QUEST_ID, TIER_2);
		expect(unlocked.ok).toBe(true);

		await bootColdInstance(providerB);
		await findUserByUsernameAsync(USERNAME);
		expect(isQuestTierUnlocked(created.accountId, QUEST_ID, TIER_2)).toBe(true);
		expect(findUserByAccountId(created.accountId).unlockedQuestTiers[QUEST_ID]).toEqual([TIER_2]);
	});

	it('updateProfile on stale instance B does not clobber email written on A', async () => {
		await bootColdInstance(providerA, { preload: true });
		const created = await createUserAsync(USERNAME, PASSWORD);
		expect(created.ok).toBe(true);

		expect((await updateProfile(created.accountId, { email: 'bside@example.com' })).ok).toBe(true);

		await bootColdInstance(providerB, { preload: true });
		const staleRecord = structuredClone(findUserByAccountId(created.accountId));
		expect(staleRecord.email).toBe('bside@example.com');

		await bootColdInstance(providerA, { preload: true });
		expect((await updateProfile(created.accountId, { email: 'survive@example.com' })).ok).toBe(true);
		expect(await queryUserEmailFromDb(pool, created.accountId)).toBe('survive@example.com');

		await bootColdInstance(providerB);
		cacheUserRecordForTest(staleRecord);
		expect(findUserByAccountId(created.accountId).email).toBe('bside@example.com');

		expect(
			(await updateProfile(created.accountId, { cosmetic: { bodyColor: '#ff0000' } })).ok,
		).toBe(true);
		expect(await queryUserEmailFromDb(pool, created.accountId)).toBe('survive@example.com');
		expect(await queryUserCosmeticBodyColorFromDb(pool, created.accountId)).toBe('#ff0000');
	});

	it('findUserByAccountIdAsync refreshes stale cross-instance cache after profile update on A', async () => {
		await bootColdInstance(providerA, { preload: true });
		const created = await createUserAsync(USERNAME, PASSWORD);
		expect(created.ok).toBe(true);

		await bootColdInstance(providerB, { preload: true });
		expect(findUserByAccountId(created.accountId)).not.toBeNull();
		expect(findUserByAccountId(created.accountId).email).toBeUndefined();

		const persisted = await providerA.loadUserByAccountId(created.accountId);
		await providerA.saveUser({ ...persisted, email: 'survive@example.com' });

		expect(findUserByAccountId(created.accountId).email).toBeUndefined();

		const refreshed = await findUserByAccountIdAsync(created.accountId);
		expect(refreshed).not.toBeNull();
		expect(refreshed.email).toBe('survive@example.com');
		expect(findUserByAccountId(created.accountId).email).toBe('survive@example.com');
	});
});
