import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
	extractSessionTokenFromResponse,
	cookieHeaders,
} from './helpers.js';

const require = createRequire(import.meta.url);
const users = require('../users.js');

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

async function registerAndLogin(baseUrl, username, password = 'testpass') {
	const reg = await fetch(`${baseUrl}/api/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password }),
	});
	expect(reg.status).toBe(201);
	const { accountId } = await reg.json();
	const login = await fetch(`${baseUrl}/api/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password }),
	});
	expect(login.status).toBe(200);
	const sessionToken = extractSessionTokenFromResponse(login);
	expect(sessionToken).toBeTruthy();
	return { accountId, sessionToken };
}

describe('applyAppearanceChange socket', () => {
	let progressDir;
	let usersFile;
	let fileProvider;
	let baseUrl;
	let accountId;
	let sessionToken;
	const initialCurrency = APPEARANCE_CHANGE_COST + 100;

	beforeEach(async () => {
		progressDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appearance-change-progress-'));
		usersFile = path.join(
			os.tmpdir(),
			`appearance-users-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
		);
		users.setTestFilePath(usersFile);
		users.clearUsers();

		baseUrl = await startSharedTestServer();
		({ accountId, sessionToken } = await registerAndLogin(baseUrl, 'appearance_player'));

		fileProvider = new FileProvider(progressDir);
		await fileProvider.savePlayer(accountId, persistentSeed(initialCurrency));
		setTestProvider(fileProvider);
	});

	afterEach(async () => {
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

	async function connectInLobby() {
		const { socket } = await connectClient(baseUrl, accountId);
		const player = playerForSocket(socket);
		expect(player.currency).toBe(initialCurrency);
		return socket;
	}

	it('charges gold and applies a paid appearance change', async () => {
		const socket = await connectInLobby();
		const changedPromise = waitForEvent(socket, 'appearanceChanged');
		socket.emit('applyAppearanceChange', { cosmetic: PAID_COSMETIC });
		const payload = await changedPromise;

		expect(payload.cost).toBe(APPEARANCE_CHANGE_COST);
		expect(payload.currency).toBe(initialCurrency - APPEARANCE_CHANGE_COST);
		expect(payload.cosmetic.bodyColor).toBe(PAID_COSMETIC.bodyColor);

		const player = playerForSocket(socket);
		expect(player.currency).toBe(initialCurrency - APPEARANCE_CHANGE_COST);
		expect(player.cosmetic.bodyColor).toBe(PAID_COSMETIC.bodyColor);
		expect(users.findUserByAccountId(accountId).cosmetic.bodyColor).toBe(PAID_COSMETIC.bodyColor);

		socket.disconnect();
	});

	it('emits appearanceError when gold is insufficient', async () => {
		const socket = await connectInLobby();
		const player = playerForSocket(socket);
		player.currency = APPEARANCE_CHANGE_COST - 1;

		const errorPromise = waitForEvent(socket, 'appearanceError');
		socket.emit('applyAppearanceChange', { cosmetic: PAID_COSMETIC });
		const err = await errorPromise;

		expect(err.reason).toMatch(/Not enough/i);
		expect(player.cosmetic.bodyColor).not.toBe(PAID_COSMETIC.bodyColor);
		expect(users.findUserByAccountId(accountId).cosmetic.bodyColor).not.toBe(PAID_COSMETIC.bodyColor);

		socket.disconnect();
	});

	it('applies hat-only changes for free', async () => {
		const socket = await connectInLobby();
		const changedPromise = waitForEvent(socket, 'appearanceChanged');
		socket.emit('applyAppearanceChange', { cosmetic: HAT_ONLY_COSMETIC });
		const payload = await changedPromise;

		expect(payload.cost).toBe(0);
		expect(payload.currency).toBe(initialCurrency);
		expect(payload.cosmetic.hat).toBe('bandana');

		socket.disconnect();
	});

	it('rejects a locked hat via applyAppearanceChange without updating live or account cosmetic', async () => {
		const socket = await connectInLobby();
		const player = playerForSocket(socket);
		expect(player.cosmetic.hat).toBe('none');
		expect(users.findUserByAccountId(accountId).cosmetic.hat).toBe('none');

		const errorPromise = waitForEvent(socket, 'appearanceError');
		socket.emit('applyAppearanceChange', { cosmetic: { hat: 'wizard' } });
		const err = await errorPromise;

		expect(err.reason).toMatch(/not unlocked/i);
		expect(player.cosmetic.hat).toBe('none');
		expect(users.findUserByAccountId(accountId).cosmetic.hat).toBe('none');

		socket.disconnect();
	});

	it('rejects PATCH appearance-field updates while in lobby', async () => {
		const socket = await connectInLobby();

		const blocked = await fetch(`${baseUrl}/api/me/profile`, {
			method: 'PATCH',
			headers: cookieHeaders(sessionToken),
			body: JSON.stringify({ cosmetic: PAID_COSMETIC }),
		});
		expect(blocked.status).toBe(400);
		const blockedBody = await blocked.json();
		expect(blockedBody.error).toMatch(/applyAppearanceChange/i);

		const hatOk = await fetch(`${baseUrl}/api/me/profile`, {
			method: 'PATCH',
			headers: cookieHeaders(sessionToken),
			body: JSON.stringify({ cosmetic: HAT_ONLY_COSMETIC }),
		});
		expect(hatOk.status).toBe(200);
		const hatBody = await hatOk.json();
		expect(hatBody.cosmetic.hat).toBe('bandana');

		socket.disconnect();
	});
});
