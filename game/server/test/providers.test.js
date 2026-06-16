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

	it('stores and retrieves player data', () => {
		provider.savePlayer('player1', sampleData);
		const loaded = provider.loadPlayer('player1');
		expect(loaded).toEqual(sampleData);
	});

	it('returns null for unknown player', () => {
		expect(provider.loadPlayer('nonexistent')).toBeNull();
	});

	it('overwrites data on subsequent saves', () => {
		provider.savePlayer('player1', sampleData);
		const updated = { ...sampleData, currency: 100 };
		provider.savePlayer('player1', updated);
		expect(provider.loadPlayer('player1')).toEqual(updated);
	});

	it('isolates data between different players', () => {
		provider.savePlayer('player1', sampleData);
		provider.savePlayer('player2', { ...sampleData, currency: 99 });
		expect(provider.loadPlayer('player1').currency).toBe(42);
		expect(provider.loadPlayer('player2').currency).toBe(99);
	});

	it('save returns a deep copy (mutations do not affect stored data)', () => {
		provider.savePlayer('player1', sampleData);
		sampleData.currency = 999;
		expect(provider.loadPlayer('player1').currency).toBe(42);
	});

	it('load returns a deep copy (mutations do not affect stored data)', () => {
		const data = { currency: 42, ownedCards: {}, selectedDeck: [] };
		provider.savePlayer('player1', data);
		const loaded = provider.loadPlayer('player1');
		loaded.currency = 999;
		expect(provider.loadPlayer('player1').currency).toBe(42);
	});

	it('close is a no-op', () => {
		expect(() => provider.close()).not.toThrow();
		// data should still be accessible after close
		expect(provider.loadPlayer('player1')).toBeNull();
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

	afterEach(() => {
		provider.close();
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	const sampleData = {
		currency: 42,
		ownedCards: { iron_sword: 2, fireball: 1 },
		selectedDeck: ['iron_sword', 'iron_sword', 'fireball'],
	};

	it('stores and retrieves player data', () => {
		provider.savePlayer('player1', sampleData);
		const loaded = provider.loadPlayer('player1');
		expect(loaded).toEqual(sampleData);
	});

	it('returns null when file does not exist', () => {
		expect(provider.loadPlayer('nonexistent')).toBeNull();
	});

	it('throws on non-ENOENT errors (e.g. invalid JSON)', () => {
		fs.writeFileSync(path.join(tmpDir, 'bad.json'), '{not valid json', 'utf-8');
		expect(() => provider.loadPlayer('bad')).toThrow();
	});

	it('overwrites data on subsequent saves', () => {
		provider.savePlayer('player1', sampleData);
		const updated = { ...sampleData, currency: 100 };
		provider.savePlayer('player1', updated);
		expect(provider.loadPlayer('player1')).toEqual(updated);
	});

	it('isolates data between different player files', () => {
		provider.savePlayer('player1', sampleData);
		provider.savePlayer('player2', { ...sampleData, currency: 99 });
		expect(provider.loadPlayer('player1').currency).toBe(42);
		expect(provider.loadPlayer('player2').currency).toBe(99);
	});

	it('writes to .tmp file then renames (atomic save)', () => {
		provider.savePlayer('player1', sampleData);
		// After save, only the .json should exist — no leftover .tmp
		expect(fs.existsSync(path.join(tmpDir, 'player1.json'))).toBe(true);
		expect(fs.existsSync(path.join(tmpDir, 'player1.json.tmp'))).toBe(false);
	});

	it('creates basePath directory if it does not exist', () => {
		const nestedDir = path.join(tmpDir, 'deep', 'nested', 'dir');
		expect(fs.existsSync(nestedDir)).toBe(false);
		const nestedProvider = new FileProvider(nestedDir);
		expect(fs.existsSync(nestedDir)).toBe(true);
		nestedProvider.close();
	});

	it('close is a no-op', () => {
		expect(() => provider.close()).not.toThrow();
	});

	it('persists data across provider instances with same basePath', () => {
		provider.savePlayer('player1', sampleData);
		provider.close();

		const provider2 = new FileProvider(tmpDir);
		expect(provider2.loadPlayer('player1')).toEqual(sampleData);
		provider2.close();
	});

	// ── Path-traversal hardening (Fix 1) ──

	it('rejects a traversal playerId on save and does not escape basePath', () => {
		const parentMarker = path.join(tmpDir, '..', 'escaped.json');
		expect(() => provider.savePlayer('../escaped', sampleData)).toThrow(/Invalid player id/);
		expect(fs.existsSync(parentMarker)).toBe(false);
	});

	it('rejects a traversal playerId on load', () => {
		expect(() => provider.loadPlayer('../../etc/foo')).toThrow(/Invalid player id/);
	});

	it('rejects playerIds containing path separators or dots', () => {
		for (const bad of ['a/b', 'a.b', 'a\\b', '', '..']) {
			expect(() => provider.savePlayer(bad, sampleData)).toThrow(/Invalid player id/);
		}
	});

	it('accepts UUID-shaped playerIds unchanged', () => {
		const uuid = '550e8400-e29b-41d4-a716-446655440000';
		provider.savePlayer(uuid, sampleData);
		expect(provider.loadPlayer(uuid)).toEqual(sampleData);
		expect(fs.existsSync(path.join(tmpDir, `${uuid}.json`))).toBe(true);
	});

	// ── Unique tmp path (Fix 2) ──

	it('uses a unique per-write tmp path (no shared .tmp clobber)', () => {
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
			provider.savePlayer('player1', sampleData);
			provider.savePlayer('player1', { ...sampleData, currency: 2 });
		} finally {
			fs.writeFileSync = realWrite;
		}
		// Two saves should have produced two distinct tmp paths.
		expect(tmpPaths.size).toBe(2);
		// Final state is correct and no .tmp leftover.
		expect(provider.loadPlayer('player1').currency).toBe(2);
		const leftovers = fs.readdirSync(tmpDir).filter((f) => f.endsWith('.tmp'));
		expect(leftovers).toEqual([]);
	});

	it('does not use the legacy fixed "<id>.json.tmp" path', () => {
		const realWrite = fs.writeFileSync;
		let usedFixed = false;
		fs.writeFileSync = (file, ...rest) => {
			if (file === path.join(tmpDir, 'player1.json.tmp')) usedFixed = true;
			return realWrite(file, ...rest);
		};
		try {
			provider.savePlayer('player1', sampleData);
		} finally {
			fs.writeFileSync = realWrite;
		}
		expect(usedFixed).toBe(false);
	});
});
