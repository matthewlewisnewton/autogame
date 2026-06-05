import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { setTestProvider } from '../index.js';
import { FileProvider } from '../providers.js';
import { backfillCosmetic } from '../cosmetic.js';
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

const USERNAME = 'appearance_buyer';
const NEW_BODY_COLOR = '#ff0000';

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

function accountCosmeticOnDisk(usersFile) {
	const records = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
	const record = records.find((r) => r.username === USERNAME);
	return record ? backfillCosmetic(record.cosmetic) : null;
}

describe('applyAppearance persistence (currency before account cosmetic write)', () => {
	let progressDir;
	let usersFile;
	let fileProvider;
	let baseUrl;
	let accountId;
	let initialCurrency;

	beforeEach(async () => {
		progressDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appearance-progress-'));
		usersFile = path.join(
			os.tmpdir(),
			`appearance-users-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
		);
		users.setTestFilePath(usersFile);
		users.clearUsers();

		initialCurrency = APPEARANCE_CHANGE_COST + 50;

		baseUrl = await startSharedTestServer();

		// startServer() clears the users map in test mode — register the account after it starts.
		users.createUser(USERNAME, 'testpass');
		accountId = users.findUserByUsername(USERNAME).accountId;

		fileProvider = new FileProvider(progressDir);
		fileProvider.savePlayer(accountId, persistentSeed(initialCurrency));
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

	function paidAppearancePayload() {
		return { cosmetic: { bodyColor: NEW_BODY_COLOR } };
	}

	it('rejects paid appearance change when currency is insufficient', async () => {
		const lowCurrency = APPEARANCE_CHANGE_COST - 1;
		fileProvider.savePlayer(accountId, persistentSeed(lowCurrency));
		const { socket } = await connectClient(baseUrl, accountId);
		const player = playerForSocket(socket);
		expect(player.currency).toBe(lowCurrency);
		const beforeCosmetic = backfillCosmetic(
			users.findUserByAccountId(accountId).cosmetic,
		);

		const errorPromise = waitForEvent(socket, 'appearanceError');
		socket.emit('applyAppearance', paidAppearancePayload());
		const err = await errorPromise;
		expect(err.reason).toBe('insufficient_gold');

		expect(playerForSocket(socket).currency).toBe(lowCurrency);
		expect(readProgressCurrencyFromDisk()).toBe(lowCurrency);
		expect(accountCosmeticOnDisk(usersFile).bodyColor).toBe(beforeCosmetic.bodyColor);

		const reloaded = reloadFromDisk(progressDir, usersFile);
		expect(reloaded.loadPlayer(accountId).currency).toBe(lowCurrency);
		expect(
			backfillCosmetic(users.findUserByAccountId(accountId).cosmetic).bodyColor,
		).toBe(beforeCosmetic.bodyColor);

		socket.disconnect();
	});

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

		const appliedPromise = waitForEvent(socket, 'appearanceApplied');
		socket.emit('applyAppearance', paidAppearancePayload());
		const payload = await appliedPromise;

		expect(payload.cost).toBe(APPEARANCE_CHANGE_COST);
		expect(payload.currency).toBe(expectedCurrency);
		expect(payload.cosmetic.bodyColor).toBe(NEW_BODY_COLOR);
		expect(savePlayerSpy).toHaveBeenCalled();
		expect(usersJsonAfterCurrencySave).toBeDefined();
		expect(usersJsonAfterCurrencySave).not.toContain(NEW_BODY_COLOR);
		expect(accountCosmeticOnDisk(usersFile).bodyColor).toBe(NEW_BODY_COLOR);

		const reloaded = reloadFromDisk(progressDir, usersFile);
		expect(reloaded.loadPlayer(accountId).currency).toBe(expectedCurrency);
		expect(
			backfillCosmetic(users.findUserByAccountId(accountId).cosmetic).bodyColor,
		).toBe(NEW_BODY_COLOR);

		socket.disconnect();
	}, 15000);

	it('after currency is on disk but account cosmetic write fails, reload shows deduction without cosmetic update', async () => {
		const socket = await connectInLobby();
		const expectedCurrency = initialCurrency - APPEARANCE_CHANGE_COST;
		const beforeColor = accountCosmeticOnDisk(usersFile).bodyColor;
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
		socket.emit('applyAppearance', paidAppearancePayload());
		await new Promise((r) => setTimeout(r, 50));

		expect(readProgressCurrencyFromDisk()).toBe(expectedCurrency);
		expect(playerForSocket(socket).currency).toBe(expectedCurrency);

		const reloaded = reloadFromDisk(progressDir, usersFile);
		const account = users.findUserByAccountId(accountId);
		expect(reloaded.loadPlayer(accountId).currency).toBe(expectedCurrency);
		expect(backfillCosmetic(account.cosmetic).bodyColor).toBe(beforeColor);

		const freeEditExploit =
			backfillCosmetic(account.cosmetic).bodyColor === NEW_BODY_COLOR &&
			reloaded.loadPlayer(accountId).currency === initialCurrency;
		expect(freeEditExploit).toBe(false);

		socket.disconnect();
	});

	it('refunds currency to disk when account cosmetic write returns ok: false', async () => {
		const socket = await connectInLobby();
		const expectedCurrency = initialCurrency - APPEARANCE_CHANGE_COST;

		vi.spyOn(fileProvider, 'savePlayer').mockImplementation((id, data) => {
			const result = FileProvider.prototype.savePlayer.call(fileProvider, id, data);
			// Drop the in-memory account after currency is persisted so updateProfile fails.
			if (data.currency === expectedCurrency) {
				users.clearUsers();
			}
			return result;
		});

		const errorPromise = waitForEvent(socket, 'appearanceError');
		socket.emit('applyAppearance', paidAppearancePayload());
		const err = await errorPromise;
		expect(err.reason).toBe('Account not found');

		expect(readProgressCurrencyFromDisk()).toBe(initialCurrency);

		const reloaded = reloadFromDisk(progressDir, usersFile);
		expect(reloaded.loadPlayer(accountId).currency).toBe(initialCurrency);
		expect(
			backfillCosmetic(users.findUserByAccountId(accountId).cosmetic).bodyColor,
		).not.toBe(NEW_BODY_COLOR);

		socket.disconnect();
	});

	it('applies hat-only changes for free without deducting currency', async () => {
		const socket = await connectInLobby();
		const beforeCurrency = readProgressCurrencyFromDisk();

		const appliedPromise = waitForEvent(socket, 'appearanceApplied');
		socket.emit('applyAppearance', { cosmetic: { hat: 'bandana' } });
		const payload = await appliedPromise;

		expect(payload.cost).toBe(0);
		expect(payload.currency).toBe(beforeCurrency);
		expect(payload.cosmetic.hat).toBe('bandana');
		expect(readProgressCurrencyFromDisk()).toBe(beforeCurrency);

		const reloaded = reloadFromDisk(progressDir, usersFile);
		expect(reloaded.loadPlayer(accountId).currency).toBe(beforeCurrency);
		expect(
			backfillCosmetic(users.findUserByAccountId(accountId).cosmetic).hat,
		).toBe('bandana');

		socket.disconnect();
	});

	it('does not update cosmetic when currency save throws', async () => {
		const socket = await connectInLobby();
		const expectedCurrency = initialCurrency - APPEARANCE_CHANGE_COST;
		const beforeColor = accountCosmeticOnDisk(usersFile).bodyColor;

		vi.spyOn(fileProvider, 'savePlayer').mockImplementation((id, data) => {
			if (data.currency === expectedCurrency) {
				throw new Error('disk full');
			}
			return FileProvider.prototype.savePlayer.call(fileProvider, id, data);
		});

		const errorPromise = waitForEvent(socket, 'appearanceError');
		socket.emit('applyAppearance', paidAppearancePayload());
		const err = await errorPromise;
		expect(err.reason).toBe('Failed to save progress');

		expect(playerForSocket(socket).currency).toBe(initialCurrency);
		expect(readProgressCurrencyFromDisk()).toBe(initialCurrency);
		expect(accountCosmeticOnDisk(usersFile).bodyColor).toBe(beforeColor);

		const reloaded = reloadFromDisk(progressDir, usersFile);
		expect(reloaded.loadPlayer(accountId).currency).toBe(initialCurrency);
		expect(
			backfillCosmetic(users.findUserByAccountId(accountId).cosmetic).bodyColor,
		).toBe(beforeColor);

		socket.disconnect();
	});
});
