import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { setTestProvider } from '../index.js';
import { FileProvider } from '../providers.js';
import { getHat } from '../cosmetic.js';
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

const HAT_ID = 'cap';

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

function accountHatsOnDisk(usersFile) {
	const records = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
	const record = records.find((r) => r.username === 'hat_buyer');
	return record ? record.unlockedHats : [];
}

describe('unlockHat persistence (currency before account hat write)', () => {
	let progressDir;
	let usersFile;
	let fileProvider;
	let baseUrl;
	let accountId;
	let initialCurrency;
	let hatPrice;

	beforeEach(async () => {
		progressDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hat-unlock-progress-'));
		usersFile = path.join(
			os.tmpdir(),
			`hat-unlock-users-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
		);
		users.setTestFilePath(usersFile);
		users.clearUsers();

		hatPrice = getHat(HAT_ID).price;
		initialCurrency = hatPrice + 50;

		baseUrl = await startSharedTestServer();

		// startServer() clears the users map in test mode — register the account after it starts.
		users.createUser('hat_buyer', 'testpass');
		accountId = users.findUserByUsername('hat_buyer').accountId;

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

	it('persists currency via savePlayer before saveUsers on successful unlock', async () => {
		const socket = await connectInLobby();
		const expectedCurrency = initialCurrency - hatPrice;
		let usersJsonAfterCurrencySave;

		const savePlayerSpy = vi.spyOn(fileProvider, 'savePlayer').mockImplementation((id, data) => {
			if (data.currency === expectedCurrency && usersJsonAfterCurrencySave === undefined) {
				usersJsonAfterCurrencySave = fs.readFileSync(usersFile, 'utf-8');
			}
			return FileProvider.prototype.savePlayer.call(fileProvider, id, data);
		});

		const unlockedPromise = waitForEvent(socket, 'hatUnlocked');
		socket.emit('unlockHat', { hatId: HAT_ID });
		const payload = await unlockedPromise;

		expect(payload.currency).toBe(expectedCurrency);
		expect(payload.unlockedHats).toContain(HAT_ID);
		expect(savePlayerSpy).toHaveBeenCalled();
		expect(usersJsonAfterCurrencySave).toBeDefined();
		expect(usersJsonAfterCurrencySave).not.toContain(`"${HAT_ID}"`);
		expect(accountHatsOnDisk(usersFile)).toContain(HAT_ID);

		const reloaded = reloadFromDisk(progressDir, usersFile);
		expect((await reloaded.loadPlayer(accountId)).currency).toBe(expectedCurrency);
		expect(users.findUserByAccountId(accountId).unlockedHats).toContain(HAT_ID);

		socket.disconnect();
	}, 15000);

	it('after currency is on disk but account hat write fails, reload shows deduction without free hat', async () => {
		const socket = await connectInLobby();
		const expectedCurrency = initialCurrency - hatPrice;
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
		socket.emit('unlockHat', { hatId: HAT_ID });
		await new Promise((r) => setTimeout(r, 50));

		expect(readProgressCurrencyFromDisk()).toBe(expectedCurrency);
		expect(playerForSocket(socket).currency).toBe(expectedCurrency);

		const reloaded = reloadFromDisk(progressDir, usersFile);
		const account = users.findUserByAccountId(accountId);
		expect((await reloaded.loadPlayer(accountId)).currency).toBe(expectedCurrency);
		expect(account.unlockedHats).not.toContain(HAT_ID);

		// Old ordering (hat before currency) would leave cap unlocked at full currency.
		const freeHatExploit =
			account.unlockedHats.includes(HAT_ID) &&
			(await reloaded.loadPlayer(accountId)).currency === initialCurrency;
		expect(freeHatExploit).toBe(false);

		socket.disconnect();
	});

	it('does not unlock hat when currency save throws', async () => {
		const socket = await connectInLobby();
		const expectedCurrency = initialCurrency - hatPrice;

		vi.spyOn(fileProvider, 'savePlayer').mockImplementation((id, data) => {
			if (data.currency === expectedCurrency) {
				throw new Error('disk full');
			}
			return FileProvider.prototype.savePlayer.call(fileProvider, id, data);
		});

		const errorPromise = waitForEvent(socket, 'hatError');
		socket.emit('unlockHat', { hatId: HAT_ID });
		const err = await errorPromise;
		expect(err.reason).toBe('Failed to save progress');

		expect(playerForSocket(socket).currency).toBe(initialCurrency);
		expect(accountHatsOnDisk(usersFile)).not.toContain(HAT_ID);

		const reloaded = reloadFromDisk(progressDir, usersFile);
		expect((await reloaded.loadPlayer(accountId)).currency).toBe(initialCurrency);
		expect(users.findUserByAccountId(accountId).unlockedHats).not.toContain(HAT_ID);

		socket.disconnect();
	});

	it('refunds currency to disk when account unlock returns ok: false', async () => {
		const socket = await connectInLobby();
		const expectedCurrency = initialCurrency - hatPrice;

		vi.spyOn(fileProvider, 'savePlayer').mockImplementation((id, data) => {
			const result = FileProvider.prototype.savePlayer.call(fileProvider, id, data);
			// Drop the in-memory account after currency is persisted so account unlock fails.
			if (data.currency === expectedCurrency) {
				users.clearUsers();
			}
			return result;
		});

		const errorPromise = waitForEvent(socket, 'hatError');
		socket.emit('unlockHat', { hatId: HAT_ID });
		const err = await errorPromise;
		expect(err.reason).toBe('Account not found');

		expect(readProgressCurrencyFromDisk()).toBe(initialCurrency);

		const reloaded = reloadFromDisk(progressDir, usersFile);
		expect((await reloaded.loadPlayer(accountId)).currency).toBe(initialCurrency);
		expect(users.findUserByAccountId(accountId).unlockedHats).not.toContain(HAT_ID);

		socket.disconnect();
	});
});
