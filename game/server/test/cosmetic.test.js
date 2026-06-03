import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
	BODY_SHAPES,
	DEFAULT_COSMETIC,
	DEFAULT_UNLOCKED_HATS,
	HAT_CATALOG,
	getHat,
	validateCosmetic,
	backfillCosmetic,
	backfillUnlockedHats
} from '../cosmetic.js';
import { createUser, findUserByUsername, updateProfile, clearUsers, setTestFilePath } from '../users.js';

describe('DEFAULT_COSMETIC', () => {
	it('has the three cosmetic fields with valid defaults', () => {
		expect(Object.keys(DEFAULT_COSMETIC).sort()).toEqual(['accentColor', 'bodyColor', 'bodyShape', 'hat']);
		expect(DEFAULT_COSMETIC.bodyColor).toMatch(/^#[0-9a-f]{6}$/i);
		expect(DEFAULT_COSMETIC.accentColor).toMatch(/^#[0-9a-f]{6}$/i);
		expect(BODY_SHAPES).toContain(DEFAULT_COSMETIC.bodyShape);
		expect(DEFAULT_COSMETIC.hat).toBe('none');
	});

	it('exposes the expected body shapes', () => {
		expect(BODY_SHAPES).toEqual(['box', 'cylinder', 'cone', 'capsule']);
	});
});

describe('validateCosmetic', () => {
	it('accepts a full valid cosmetic', () => {
		const result = validateCosmetic({ bodyColor: '#112233', accentColor: '#ABCDEF', bodyShape: 'cone' });
		expect(result.ok).toBe(true);
		expect(result.value).toEqual({ bodyColor: '#112233', accentColor: '#ABCDEF', bodyShape: 'cone' });
	});

	it('accepts a partial update with only the provided field', () => {
		const result = validateCosmetic({ bodyShape: 'capsule' });
		expect(result.ok).toBe(true);
		expect(result.value).toEqual({ bodyShape: 'capsule' });
	});

	it('accepts case-insensitive hex colors', () => {
		expect(validateCosmetic({ bodyColor: '#aAbBcC' }).ok).toBe(true);
	});

	it('rejects an invalid bodyShape', () => {
		const result = validateCosmetic({ bodyShape: 'pyramid' });
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/bodyShape/);
	});

	it('rejects a malformed bodyColor', () => {
		expect(validateCosmetic({ bodyColor: 'red' }).ok).toBe(false);
		expect(validateCosmetic({ bodyColor: '#fff' }).ok).toBe(false);
		expect(validateCosmetic({ bodyColor: '112233' }).ok).toBe(false);
		expect(validateCosmetic({ bodyColor: '#11223g' }).ok).toBe(false);
	});

	it('rejects a malformed accentColor', () => {
		expect(validateCosmetic({ accentColor: '#12345' }).ok).toBe(false);
	});

	it('rejects non-object input', () => {
		expect(validateCosmetic(null).ok).toBe(false);
		expect(validateCosmetic('box').ok).toBe(false);
		expect(validateCosmetic([]).ok).toBe(false);
	});
});

describe('backfillCosmetic', () => {
	it('returns defaults for undefined input', () => {
		expect(backfillCosmetic(undefined)).toEqual(DEFAULT_COSMETIC);
	});

	it('fills only the missing fields', () => {
		const result = backfillCosmetic({ bodyShape: 'cylinder' });
		expect(result.bodyShape).toBe('cylinder');
		expect(result.bodyColor).toBe(DEFAULT_COSMETIC.bodyColor);
		expect(result.accentColor).toBe(DEFAULT_COSMETIC.accentColor);
	});

	it('replaces invalid stored fields with defaults', () => {
		const result = backfillCosmetic({ bodyColor: 'nope', accentColor: '#00ff00', bodyShape: 'blob' });
		expect(result.bodyColor).toBe(DEFAULT_COSMETIC.bodyColor);
		expect(result.accentColor).toBe('#00ff00');
		expect(result.bodyShape).toBe(DEFAULT_COSMETIC.bodyShape);
	});
});

describe('starter hats catalog', () => {
	it('includes bandana and beanie at price 0', () => {
		const bandana = getHat('bandana');
		const beanie = getHat('beanie');
		expect(bandana).toEqual({ id: 'bandana', name: 'Bandana', price: 0 });
		expect(beanie).toEqual({ id: 'beanie', name: 'Beanie', price: 0 });
	});

	it('leaves the existing none/cap/wizard/crown entries and prices unchanged', () => {
		expect(getHat('none')).toEqual({ id: 'none', name: 'No Hat', price: 0 });
		expect(getHat('cap')).toEqual({ id: 'cap', name: 'Adventurer Cap', price: 50 });
		expect(getHat('wizard')).toEqual({ id: 'wizard', name: 'Wizard Hat', price: 150 });
		expect(getHat('crown')).toEqual({ id: 'crown', name: 'Golden Crown', price: 500 });
	});

	it('keeps the catalog ids in their expected order', () => {
		expect(HAT_CATALOG.map((h) => h.id)).toEqual(['none', 'cap', 'wizard', 'crown', 'bandana', 'beanie']);
	});

	it('DEFAULT_UNLOCKED_HATS is the free starter set in order', () => {
		expect(DEFAULT_UNLOCKED_HATS).toEqual(['none', 'bandana', 'beanie']);
	});

	it('validates the starter hats as known catalog ids', () => {
		expect(validateCosmetic({ hat: 'bandana' }).ok).toBe(true);
		expect(validateCosmetic({ hat: 'beanie' }).ok).toBe(true);
	});
});

describe('backfillUnlockedHats with starter set', () => {
	it('seeds the full starter set for undefined input', () => {
		expect(backfillUnlockedHats(undefined)).toEqual(['none', 'bandana', 'beanie']);
	});

	it('backfills the starter set onto a legacy ["none"] record', () => {
		expect(backfillUnlockedHats(['none'])).toEqual(['none', 'bandana', 'beanie']);
	});

	it('dedupes, drops unknown ids, and preserves extra unlocked catalog ids', () => {
		const result = backfillUnlockedHats(['beanie', 'bogus', 'crown', 'crown']);
		expect(result).toEqual(['none', 'bandana', 'beanie', 'crown']);
	});
});

describe('equipping starter hats on a fresh account', () => {
	let tmpFile;

	beforeEach(() => {
		tmpFile = path.join(os.tmpdir(), `cosmetic-starter-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
		setTestFilePath(tmpFile);
		clearUsers();
	});

	afterEach(() => {
		try { fs.unlinkSync(tmpFile); } catch {}
		try { fs.unlinkSync(tmpFile + '.tmp'); } catch {}
	});

	it('lets a default account equip bandana and beanie without unlocking first', () => {
		createUser('starterhats', 'password123');
		const user = findUserByUsername('starterhats');
		expect(user.unlockedHats).toEqual(['none', 'bandana', 'beanie']);

		const bandanaResult = updateProfile(user.accountId, { cosmetic: { hat: 'bandana' } });
		expect(bandanaResult.ok).toBe(true);
		expect(findUserByUsername('starterhats').cosmetic.hat).toBe('bandana');

		const beanieResult = updateProfile(user.accountId, { cosmetic: { hat: 'beanie' } });
		expect(beanieResult.ok).toBe(true);
		expect(findUserByUsername('starterhats').cosmetic.hat).toBe('beanie');
	});

	it('still blocks equipping a locked purchasable hat', () => {
		createUser('lockedhats', 'password123');
		const user = findUserByUsername('lockedhats');
		const result = updateProfile(user.accountId, { cosmetic: { hat: 'crown' } });
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/not unlocked/i);
	});
});
