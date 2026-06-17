import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { setTestProvider } from '../index.js';
import { FileProvider } from '../providers.js';
import { APPEARANCE_CHANGE_COST } from '../config.js';
import {
	startTestServer as startSharedTestServer,
	closeServer,
	connectClient,
	waitForEvent,
	playerForSocket,
} from './helpers.js';

// Same CJS users module instance as index.js (ESM import would be a duplicate store).
const require = createRequire(import.meta.url);
const users = require('../users.js');

const BASELINE_COSMETIC = { bodyColor: '#aabbcc', bodyShape: 'cylinder' };
const PAID_COSMETIC = { bodyColor: '#112233' };
const HAT_ONLY_COSMETIC = { hat: 'bandana' };

function persistentSeed(currency) {
	return {
		currency,
		ownedCards: {},
		selectedDeck: [],
		x: 0,
		y: 0.5,
		z: 0,
		rotation: 0,
		equippedKeyItemId: 'dodge_roll',
	};
}

function reloadFromDisk(progressDir, usersFile) {
	users.clearUsers();
	users.setTestFilePath(usersFile);
	users.loadUsers();
	return new FileProvider(progressDir);
}

function accountCosmeticOnDisk(usersFile, username = 'appearance_buyer') {
	const records = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
	const record = records.find((r) => r.username === username);
	return record ? record.cosmetic : null;
}

describe('applyAppearanceChange persistence (currency before account cosmetic write)', () => {
	let progressDir;
	let usersFile;
	let fileProvider;
	let baseUrl;
	let accountId;
	let initialCurrency;

	beforeEach(async () => {
		progressDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appearance-change-progress-'));
		usersFile = path.join(
			os.tmpdir(),
			`appearance-change-users-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
		);
		users.setTestFilePath(usersFile);
		users.clearUsers();

		initialCurrency = APPEARANCE_CHANGE_COST + 50;

		baseUrl = await startSharedTestServer();

		users.createUser('appearance_buyer', 'testpass');
		accountId = users.findUserByUsername('appearance_buyer').accountId;
		await users.updateProfile(accountId, { cosmetic: BASELINE_COSMETIC });

		fileProvider = new FileProvider(progressDir);
		await fileProvider.savePlayer(accountId, persistentSeed(initialCurrency));
		setTestProvider(fileProvider);
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		setTestProvider(null);
		await closeServer();
		try {
			fs.unlinkSync(usersFile);
		} catch {}
		try {
			fs.unlinkSync(usersFile + '.tmp');
		} catch {}
		try {
			fs.rmSync(progressDir, { recursive: true, force: true });
		} catch {}
	});

	function progressFilePath() {
		return path.join(progressDir, `${accountId}.json`);
	}

	function readProgressCurrencyFromDisk() {
		return JSON.parse(fs.readFileSync(progressFilePath(), 'utf-8')).currency;
	}

	async function connectInLobby() {
		const { socket } = await connectClient(baseUrl, accountId);
		const player = playerForSocket(socket);
		expect(player.accountId).toBe(accountId);
		expect(users.findUserByAccountId(player.accountId)).not.toBeNull();
		expect(player.currency).toBe(initialCurrency);
		return socket;
	}

	it('persists currency via savePlayer before saveUsers on successful paid change', async () => {
		const socket = await connectInLobby();
		const expectedCurrency = initialCurrency - APPEARANCE_CHANGE_COST;
		let usersJsonAfterCurrencySave;

		const savePlayerSpy = vi.spyOn(fileProvider, 'savePlayer').mockImplementation((id, data) => {
			if (data.currency === expectedCurrency && usersJsonAfterCurrencySave === undefined) {
				usersJsonAfterCurrencySave = fs.readFileSync(usersFile, 'utf-8');
			}
			return FileProvider.prototype.savePlayer.call(fileProvider, id, data);
		});

		const changedPromise = waitForEvent(socket, 'appearanceChanged');
		socket.emit('applyAppearanceChange', { cosmetic: PAID_COSMETIC });
		const payload = await changedPromise;

		expect(payload.cost).toBe(APPEARANCE_CHANGE_COST);
		expect(payload.currency).toBe(expectedCurrency);
		expect(savePlayerSpy).toHaveBeenCalled();
		expect(usersJsonAfterCurrencySave).toBeDefined();
		expect(usersJsonAfterCurrencySave).toContain(BASELINE_COSMETIC.bodyColor);
		expect(usersJsonAfterCurrencySave).not.toContain(PAID_COSMETIC.bodyColor);
		expect(accountCosmeticOnDisk(usersFile).bodyColor).toBe(PAID_COSMETIC.bodyColor);

		const reloaded = reloadFromDisk(progressDir, usersFile);
		expect((await reloaded.loadPlayer(accountId)).currency).toBe(expectedCurrency);
		expect(users.findUserByAccountId(accountId).cosmetic.bodyColor).toBe(PAID_COSMETIC.bodyColor);

		socket.disconnect();
	}, 15000);

	it('leaves currency and account cosmetic unchanged on disk when funds are insufficient', async () => {
		const socket = await connectInLobby();
		const player = playerForSocket(socket);
		player.currency = APPEARANCE_CHANGE_COST - 1;

		const errorPromise = waitForEvent(socket, 'appearanceError');
		socket.emit('applyAppearanceChange', { cosmetic: PAID_COSMETIC });
		const err = await errorPromise;

		expect(err.reason).toMatch(/Not enough/i);

		const reloaded = reloadFromDisk(progressDir, usersFile);
		expect((await reloaded.loadPlayer(accountId)).currency).toBe(initialCurrency);
		expect(accountCosmeticOnDisk(usersFile).bodyColor).toBe(BASELINE_COSMETIC.bodyColor);
		expect(users.findUserByAccountId(accountId).cosmetic.bodyColor).toBe(BASELINE_COSMETIC.bodyColor);
		expect(player.cosmetic.bodyColor).toBe(BASELINE_COSMETIC.bodyColor);

		socket.disconnect();
	});

	it('after currency is on disk but account cosmetic write fails, reload shows no free appearance edit', async () => {
		const socket = await connectInLobby();
		const expectedCurrency = initialCurrency - APPEARANCE_CHANGE_COST;
		const usersBasename = path.basename(usersFile);
		const originalRenameSync = fs.renameSync.bind(fs);
		let blockUsersPersist = false;

		vi.spyOn(fs, 'renameSync').mockImplementation((src, dest) => {
			if (blockUsersPersist && String(dest).includes(usersBasename)) {
				blockUsersPersist = false;
				// Simulate a crash after currency was flushed but before users.json updates.
				return undefined;
			}
			return originalRenameSync(src, dest);
		});

		blockUsersPersist = true;
		socket.emit('applyAppearanceChange', { cosmetic: PAID_COSMETIC });
		await new Promise((r) => setTimeout(r, 50));

		// Handler intentionally leaves charged-but-not-applied (retryable), not a refund.
		expect(readProgressCurrencyFromDisk()).toBe(expectedCurrency);
		expect(playerForSocket(socket).currency).toBe(expectedCurrency);

		const reloaded = reloadFromDisk(progressDir, usersFile);
		const account = users.findUserByAccountId(accountId);
		expect((await reloaded.loadPlayer(accountId)).currency).toBe(expectedCurrency);
		expect(account.cosmetic.bodyColor).toBe(BASELINE_COSMETIC.bodyColor);
		expect(accountCosmeticOnDisk(usersFile).bodyColor).toBe(BASELINE_COSMETIC.bodyColor);

		const freeEditExploit =
			account.cosmetic.bodyColor === PAID_COSMETIC.bodyColor &&
			(await reloaded.loadPlayer(accountId)).currency === initialCurrency;
		expect(freeEditExploit).toBe(false);

		socket.disconnect();
	});

	it('refunds currency to disk when account cosmetic update returns ok: false', async () => {
		const socket = await connectInLobby();
		const expectedCurrency = initialCurrency - APPEARANCE_CHANGE_COST;

		vi.spyOn(fileProvider, 'savePlayer').mockImplementation((id, data) => {
			const result = FileProvider.prototype.savePlayer.call(fileProvider, id, data);
			if (data.currency === expectedCurrency) {
				users.clearUsers();
			}
			return result;
		});

		const errorPromise = waitForEvent(socket, 'appearanceError');
		socket.emit('applyAppearanceChange', { cosmetic: PAID_COSMETIC });
		const err = await errorPromise;
		expect(err.reason).toBe('Account not found');

		expect(readProgressCurrencyFromDisk()).toBe(initialCurrency);

		const reloaded = reloadFromDisk(progressDir, usersFile);
		expect((await reloaded.loadPlayer(accountId)).currency).toBe(initialCurrency);
		expect(users.findUserByAccountId(accountId).cosmetic.bodyColor).toBe(BASELINE_COSMETIC.bodyColor);

		socket.disconnect();
	});

	it('does not apply paid cosmetic when currency save throws', async () => {
		const socket = await connectInLobby();
		const expectedCurrency = initialCurrency - APPEARANCE_CHANGE_COST;

		vi.spyOn(fileProvider, 'savePlayer').mockImplementation((id, data) => {
			if (data.currency === expectedCurrency) {
				throw new Error('disk full');
			}
			return FileProvider.prototype.savePlayer.call(fileProvider, id, data);
		});

		const errorPromise = waitForEvent(socket, 'appearanceError');
		socket.emit('applyAppearanceChange', { cosmetic: PAID_COSMETIC });
		const err = await errorPromise;
		expect(err.reason).toBe('Failed to save progress');

		expect(playerForSocket(socket).currency).toBe(initialCurrency);
		expect(accountCosmeticOnDisk(usersFile).bodyColor).toBe(BASELINE_COSMETIC.bodyColor);

		const reloaded = reloadFromDisk(progressDir, usersFile);
		expect((await reloaded.loadPlayer(accountId)).currency).toBe(initialCurrency);
		expect(users.findUserByAccountId(accountId).cosmetic.bodyColor).toBe(BASELINE_COSMETIC.bodyColor);

		socket.disconnect();
	});

	it('applies hat-only changes for free without deducting currency on disk', async () => {
		const socket = await connectInLobby();

		const changedPromise = waitForEvent(socket, 'appearanceChanged');
		socket.emit('applyAppearanceChange', { cosmetic: HAT_ONLY_COSMETIC });
		const payload = await changedPromise;

		expect(payload.cost).toBe(0);
		expect(payload.currency).toBe(initialCurrency);
		expect(payload.cosmetic.hat).toBe('bandana');

		const reloaded = reloadFromDisk(progressDir, usersFile);
		expect((await reloaded.loadPlayer(accountId)).currency).toBe(initialCurrency);
		expect(users.findUserByAccountId(accountId).cosmetic.hat).toBe('bandana');
		expect(accountCosmeticOnDisk(usersFile).hat).toBe('bandana');
		expect(accountCosmeticOnDisk(usersFile).bodyColor).toBe(BASELINE_COSMETIC.bodyColor);

		socket.disconnect();
	});
});
