import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { InMemoryProvider, FileProvider } from '../providers.js';

// ── InMemoryProvider ──

describe('InMemoryProvider', () => {
	let provider;

	beforeEach(() => {
		provider = new InMemoryProvider();
	});

	const sampleData = {
		currency: 42,
		ownedCards: { iron_sword: 2, fireball: 1 },
		selectedDeck: ['iron_sword', 'iron_sword', 'fireball'],
	};

	it('stores and retrieves player data', async () => {
		await provider.savePlayer('player1', sampleData);
		const loaded = await provider.loadPlayer('player1');
		expect(loaded).toEqual(sampleData);
	});

	it('returns null for unknown player', async () => {
		expect(await provider.loadPlayer('nonexistent')).toBeNull();
	});

	it('overwrites data on subsequent saves', async () => {
		await provider.savePlayer('player1', sampleData);
		const updated = { ...sampleData, currency: 100 };
		await provider.savePlayer('player1', updated);
		expect(await provider.loadPlayer('player1')).toEqual(updated);
	});

	it('isolates data between different players', async () => {
		await provider.savePlayer('player1', sampleData);
		await provider.savePlayer('player2', { ...sampleData, currency: 99 });
		expect((await provider.loadPlayer('player1')).currency).toBe(42);
		expect((await provider.loadPlayer('player2')).currency).toBe(99);
	});

	it('save returns a deep copy (mutations do not affect stored data)', async () => {
		await provider.savePlayer('player1', sampleData);
		sampleData.currency = 999;
		expect((await provider.loadPlayer('player1')).currency).toBe(42);
	});

	it('load returns a deep copy (mutations do not affect stored data)', async () => {
		const data = { currency: 42, ownedCards: {}, selectedDeck: [] };
		await provider.savePlayer('player1', data);
		const loaded = await provider.loadPlayer('player1');
		loaded.currency = 999;
		expect((await provider.loadPlayer('player1')).currency).toBe(42);
	});

	it('close is a no-op', async () => {
		await expect(provider.close()).resolves.toBeUndefined();
		expect(await provider.loadPlayer('player1')).toBeNull();
	});
});

// ── InMemoryProvider settings ──

describe('InMemoryProvider settings', () => {
	let provider;

	beforeEach(() => {
		provider = new InMemoryProvider();
	});

	it('stores and retrieves settings', async () => {
		const sampleSettings = {
			soundEnabled: false,
			particlesEnabled: true,
			lockOnRepeatAction: 'cycle',
		};
		await provider.saveSettings('acct1', sampleSettings);
		const loaded = await provider.loadSettings('acct1');
		expect(loaded).toEqual(sampleSettings);
	});

	it('returns null for unknown accountId', async () => {
		expect(await provider.loadSettings('nonexistent')).toBeNull();
	});

	it('settings are independent from player store', async () => {
		const sampleSettings = { soundEnabled: false, particlesEnabled: true };
		await provider.savePlayer('player1', { currency: 42 });
		await provider.saveSettings('player1', sampleSettings);
		expect(await provider.loadPlayer('player1')).toEqual({ currency: 42 });
		expect(await provider.loadSettings('player1')).toEqual(sampleSettings);
	});

	it('overwrites settings on subsequent saves', async () => {
		const sampleSettings = { soundEnabled: false, particlesEnabled: true };
		await provider.saveSettings('acct1', sampleSettings);
		const updated = { ...sampleSettings, soundEnabled: true };
		await provider.saveSettings('acct1', updated);
		expect(await provider.loadSettings('acct1')).toEqual(updated);
	});

	it('save returns a deep copy', async () => {
		const data = { soundEnabled: false, particlesEnabled: true };
		await provider.saveSettings('acct1', data);
		data.soundEnabled = true;
		expect((await provider.loadSettings('acct1')).soundEnabled).toBe(false);
	});

	it('load returns a deep copy', async () => {
		const data = { soundEnabled: false, particlesEnabled: true };
		await provider.saveSettings('acct1', data);
		const loaded = await provider.loadSettings('acct1');
		loaded.soundEnabled = true;
		expect((await provider.loadSettings('acct1')).soundEnabled).toBe(false);
	});
});

// ── FileProvider ──

describe('FileProvider', () => {
	let tmpDir;
	let provider;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-test-'));
		provider = new FileProvider(tmpDir);
	});

	afterEach(async () => {
		await provider.close();
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	const sampleData = {
		currency: 42,
		ownedCards: { iron_sword: 2, fireball: 1 },
		selectedDeck: ['iron_sword', 'iron_sword', 'fireball'],
	};

	it('stores and retrieves player data', async () => {
		await provider.savePlayer('player1', sampleData);
		const loaded = await provider.loadPlayer('player1');
		expect(loaded).toEqual(sampleData);
	});

	it('returns null when file does not exist', async () => {
		expect(await provider.loadPlayer('nonexistent')).toBeNull();
	});

	it('throws on non-ENOENT errors (e.g. invalid JSON)', async () => {
		fs.writeFileSync(path.join(tmpDir, 'bad.json'), '{not valid json', 'utf-8');
		await expect(provider.loadPlayer('bad')).rejects.toThrow();
	});

	it('overwrites data on subsequent saves', async () => {
		await provider.savePlayer('player1', sampleData);
		const updated = { ...sampleData, currency: 100 };
		await provider.savePlayer('player1', updated);
		expect(await provider.loadPlayer('player1')).toEqual(updated);
	});

	it('isolates data between different player files', async () => {
		await provider.savePlayer('player1', sampleData);
		await provider.savePlayer('player2', { ...sampleData, currency: 99 });
		expect((await provider.loadPlayer('player1')).currency).toBe(42);
		expect((await provider.loadPlayer('player2')).currency).toBe(99);
	});

	it('writes to .tmp file then renames (atomic save)', async () => {
		await provider.savePlayer('player1', sampleData);
		expect(fs.existsSync(path.join(tmpDir, 'player1.json'))).toBe(true);
		expect(fs.existsSync(path.join(tmpDir, 'player1.json.tmp'))).toBe(false);
	});

	it('creates basePath directory if it does not exist', async () => {
		const nestedDir = path.join(tmpDir, 'deep', 'nested', 'dir');
		expect(fs.existsSync(nestedDir)).toBe(false);
		const nestedProvider = new FileProvider(nestedDir);
		expect(fs.existsSync(nestedDir)).toBe(true);
		await nestedProvider.close();
	});

	it('close is a no-op', async () => {
		await expect(provider.close()).resolves.toBeUndefined();
	});

	it('persists data across provider instances with same basePath', async () => {
		await provider.savePlayer('player1', sampleData);
		await provider.close();

		const provider2 = new FileProvider(tmpDir);
		expect(await provider2.loadPlayer('player1')).toEqual(sampleData);
		await provider2.close();
	});

	it('rejects a traversal playerId on save and does not escape basePath', async () => {
		const parentMarker = path.join(tmpDir, '..', 'escaped.json');
		await expect(provider.savePlayer('../escaped', sampleData)).rejects.toThrow(/Invalid player id/);
		expect(fs.existsSync(parentMarker)).toBe(false);
	});

	it('rejects a traversal playerId on load', async () => {
		await expect(provider.loadPlayer('../../etc/foo')).rejects.toThrow(/Invalid player id/);
	});

	it('rejects playerIds containing path separators or dots', async () => {
		for (const bad of ['a/b', 'a.b', 'a\\b', '', '..']) {
			await expect(provider.savePlayer(bad, sampleData)).rejects.toThrow(/Invalid player id/);
		}
	});

	it('accepts UUID-shaped playerIds unchanged', async () => {
		const uuid = '550e8400-e29b-41d4-a716-446655440000';
		await provider.savePlayer(uuid, sampleData);
		expect(await provider.loadPlayer(uuid)).toEqual(sampleData);
		expect(fs.existsSync(path.join(tmpDir, `${uuid}.json`))).toBe(true);
	});

	it('uses a unique per-write tmp path (no shared .tmp clobber)', async () => {
		const tmpPaths = new Set();
		const realWrite = fs.writeFileSync;
		const spy = (file, ...rest) => {
			if (typeof file === 'string' && file.endsWith('.tmp')) {
				tmpPaths.add(file);
			}
			return realWrite(file, ...rest);
		};
		fs.writeFileSync = spy;
		try {
			await provider.savePlayer('player1', sampleData);
			await provider.savePlayer('player1', { ...sampleData, currency: 2 });
		} finally {
			fs.writeFileSync = realWrite;
		}
		expect(tmpPaths.size).toBe(2);
		expect((await provider.loadPlayer('player1')).currency).toBe(2);
		const leftovers = fs.readdirSync(tmpDir).filter((f) => f.endsWith('.tmp'));
		expect(leftovers).toEqual([]);
	});

	it('does not use the legacy fixed "<id>.json.tmp" path', async () => {
		const realWrite = fs.writeFileSync;
		let usedFixed = false;
		fs.writeFileSync = (file, ...rest) => {
			if (file === path.join(tmpDir, 'player1.json.tmp')) usedFixed = true;
			return realWrite(file, ...rest);
		};
		try {
			await provider.savePlayer('player1', sampleData);
		} finally {
			fs.writeFileSync = realWrite;
		}
		expect(usedFixed).toBe(false);
	});
});

// ── FileProvider settings ──

describe('FileProvider settings', () => {
	let tmpDir;
	let provider;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-settings-test-'));
		provider = new FileProvider(tmpDir);
	});

	afterEach(async () => {
		await provider.close();
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it('stores and retrieves settings in settings/ subdirectory', async () => {
		const sampleSettings = {
			soundEnabled: false,
			particlesEnabled: true,
			lockOnRepeatAction: 'cycle',
		};
		await provider.saveSettings('acct1', sampleSettings);
		const loaded = await provider.loadSettings('acct1');
		expect(loaded).toEqual(sampleSettings);
		expect(fs.existsSync(path.join(tmpDir, 'settings', 'acct1.json'))).toBe(true);
	});

	it('returns null when settings file does not exist', async () => {
		expect(await provider.loadSettings('nonexistent')).toBeNull();
	});

	it('overwrites settings on subsequent saves', async () => {
		const sampleSettings = { soundEnabled: false, particlesEnabled: true };
		await provider.saveSettings('acct1', sampleSettings);
		const updated = { ...sampleSettings, soundEnabled: true };
		await provider.saveSettings('acct1', updated);
		expect(await provider.loadSettings('acct1')).toEqual(updated);
	});

	it('persists settings across provider instances', async () => {
		const sampleSettings = { soundEnabled: false, particlesEnabled: true };
		await provider.saveSettings('acct1', sampleSettings);
		await provider.close();

		const provider2 = new FileProvider(tmpDir);
		expect(await provider2.loadSettings('acct1')).toEqual(sampleSettings);
		await provider2.close();
	});

	it('settings are independent from player data', async () => {
		const sampleSettings = { soundEnabled: false, particlesEnabled: true };
		await provider.savePlayer('acct1', { currency: 42 });
		await provider.saveSettings('acct1', sampleSettings);
		expect(await provider.loadPlayer('acct1')).toEqual({ currency: 42 });
		expect(await provider.loadSettings('acct1')).toEqual(sampleSettings);
		expect(fs.existsSync(path.join(tmpDir, 'acct1.json'))).toBe(true);
		expect(fs.existsSync(path.join(tmpDir, 'settings', 'acct1.json'))).toBe(true);
	});

	it('rejects a traversal accountId on save', async () => {
		await expect(provider.saveSettings('../escaped', { soundEnabled: false })).rejects.toThrow(/Invalid player id/);
	});

	it('rejects a traversal accountId on load', async () => {
		await expect(provider.loadSettings('../../etc/foo')).rejects.toThrow(/Invalid player id/);
	});

	it('uses atomic tmp+rename for settings writes', async () => {
		await provider.saveSettings('acct1', { soundEnabled: false });
		const settingsDir = path.join(tmpDir, 'settings');
		expect(fs.existsSync(path.join(settingsDir, 'acct1.json'))).toBe(true);
		const leftovers = fs.readdirSync(settingsDir).filter((f) => f.endsWith('.tmp'));
		expect(leftovers).toEqual([]);
	});
});
