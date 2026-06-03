import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
	BODY_SHAPES,
	DEFAULT_COSMETIC,
	DEFAULT_UNLOCKED_HATS,
	HAT_CATALOG,
	MODEL_IDS,
	PROPORTION_KEYS,
	PROPORTION_RANGES,
	getHat,
	validateCosmetic,
	backfillCosmetic,
	backfillProportions,
	backfillUnlockedHats
} from '../cosmetic.js';
import { createUser, findUserByUsername, updateProfile, clearUsers, setTestFilePath } from '../users.js';

describe('DEFAULT_COSMETIC', () => {
	it('has the expected cosmetic fields with valid defaults', () => {
		expect(Object.keys(DEFAULT_COSMETIC).sort()).toEqual(['accentColor', 'bodyColor', 'bodyShape', 'hat', 'modelId', 'proportions']);
		expect(DEFAULT_COSMETIC.bodyColor).toMatch(/^#[0-9a-f]{6}$/i);
		expect(DEFAULT_COSMETIC.accentColor).toMatch(/^#[0-9a-f]{6}$/i);
		expect(BODY_SHAPES).toContain(DEFAULT_COSMETIC.bodyShape);
		expect(DEFAULT_COSMETIC.hat).toBe('none');
		expect(DEFAULT_COSMETIC.modelId).toBe('player');
		expect(DEFAULT_COSMETIC.proportions).toBeDefined();
		for (const key of PROPORTION_KEYS) {
			expect(DEFAULT_COSMETIC.proportions[key]).toBe(1.0);
		}
	});

	it('exposes the expected body shapes', () => {
		expect(BODY_SHAPES).toEqual(['box', 'cylinder', 'cone', 'capsule']);
	});
});

describe('MODEL_IDS', () => {
	it('contains the default player model', () => {
		expect(MODEL_IDS).toEqual(['player']);
	});

	it('membership check works for valid id', () => {
		expect(MODEL_IDS.includes('player')).toBe(true);
	});

	it('rejects unknown model id', () => {
		expect(MODEL_IDS.includes('unknown')).toBe(false);
	});
});

describe('PROPORTION_KEYS', () => {
	it('has exactly 6 keys', () => {
		expect(PROPORTION_KEYS.length).toBe(6);
	});

	it('contains the expected keys in order', () => {
		expect(PROPORTION_KEYS).toEqual(['height', 'headSize', 'torsoWidth', 'armLength', 'legLength', 'shoulderWidth']);
	});
});

describe('PROPORTION_RANGES', () => {
	it('has an entry for every PROPORTION_KEY', () => {
		for (const key of PROPORTION_KEYS) {
			expect(PROPORTION_RANGES[key]).toBeDefined();
			expect(typeof PROPORTION_RANGES[key].min).toBe('number');
			expect(typeof PROPORTION_RANGES[key].max).toBe('number');
			expect(PROPORTION_RANGES[key].min).toBeLessThan(PROPORTION_RANGES[key].max);
		}
	});

	it('has the correct bounds for height', () => {
		expect(PROPORTION_RANGES.height).toEqual({ min: 0.8, max: 1.2 });
	});

	it('has the correct bounds for headSize', () => {
		expect(PROPORTION_RANGES.headSize).toEqual({ min: 0.7, max: 1.3 });
	});

	it('has the correct bounds for torsoWidth', () => {
		expect(PROPORTION_RANGES.torsoWidth).toEqual({ min: 0.7, max: 1.3 });
	});

	it('has the correct bounds for armLength', () => {
		expect(PROPORTION_RANGES.armLength).toEqual({ min: 0.8, max: 1.2 });
	});

	it('has the correct bounds for legLength', () => {
		expect(PROPORTION_RANGES.legLength).toEqual({ min: 0.8, max: 1.2 });
	});

	it('has the correct bounds for shoulderWidth', () => {
		expect(PROPORTION_RANGES.shoulderWidth).toEqual({ min: 0.7, max: 1.3 });
	});
});

describe('backfillProportions', () => {
	it('returns all 1.0 for undefined input', () => {
		const result = backfillProportions(undefined);
		for (const key of PROPORTION_KEYS) {
			expect(result[key]).toBe(1.0);
		}
	});

	it('returns all 1.0 for null input', () => {
		const result = backfillProportions(null);
		for (const key of PROPORTION_KEYS) {
			expect(result[key]).toBe(1.0);
		}
	});

	it('preserves valid proportion values', () => {
		const result = backfillProportions({ height: 1.1, headSize: 0.9 });
		expect(result.height).toBe(1.1);
		expect(result.headSize).toBe(0.9);
		// missing keys filled with 1.0
		expect(result.torsoWidth).toBe(1.0);
	});

	it('clamps out-of-range values to bounds', () => {
		const result = backfillProportions({ height: 0.5, headSize: 2.0 });
		expect(result.height).toBe(PROPORTION_RANGES.height.min);
		expect(result.headSize).toBe(PROPORTION_RANGES.headSize.max);
	});

	it('fills missing keys with 1.0 even when some keys are present', () => {
		const result = backfillProportions({ shoulderWidth: 1.2 });
		expect(result.shoulderWidth).toBe(1.2);
		expect(result.height).toBe(1.0);
		expect(result.legLength).toBe(1.0);
	});
});

describe('backfillCosmetic with modelId and proportions', () => {
	it('returns defaults for undefined input including modelId and proportions', () => {
		const result = backfillCosmetic(undefined);
		expect(result.modelId).toBe('player');
		expect(result.proportions).toEqual(DEFAULT_COSMETIC.proportions);
	});

	it('preserves valid modelId', () => {
		const result = backfillCosmetic({ modelId: 'player' });
		expect(result.modelId).toBe('player');
	});

	it('falls back to default modelId for unknown value', () => {
		const result = backfillCosmetic({ modelId: 'unknown' });
		expect(result.modelId).toBe('player');
	});

	it('backfills proportions when missing', () => {
		const result = backfillCosmetic({});
		for (const key of PROPORTION_KEYS) {
			expect(result.proportions[key]).toBe(1.0);
		}
	});

	it('preserves valid partial proportions and fills rest', () => {
		const result = backfillCosmetic({ proportions: { height: 1.15 } });
		expect(result.proportions.height).toBe(1.15);
		expect(result.proportions.headSize).toBe(1.0);
	});

	it('clamps out-of-range proportion values', () => {
		const result = backfillCosmetic({ proportions: { height: 0.1 } });
		expect(result.proportions.height).toBe(PROPORTION_RANGES.height.min);
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

	it('accepts a valid modelId', () => {
		const result = validateCosmetic({ modelId: 'player' });
		expect(result.ok).toBe(true);
		expect(result.value.modelId).toBe('player');
	});

	it('rejects an unknown modelId', () => {
		const result = validateCosmetic({ modelId: 'unknown' });
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/modelId/);
	});

	it('rejects modelId that is null', () => {
		const result = validateCosmetic({ modelId: null });
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/modelId/);
	});

	it('rejects modelId that is a number', () => {
		const result = validateCosmetic({ modelId: 42 });
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/modelId/);
	});

	it('accepts valid proportions', () => {
		const result = validateCosmetic({ proportions: { height: 1.0, headSize: 0.9 } });
		expect(result.ok).toBe(true);
		expect(result.value.proportions).toEqual({ height: 1.0, headSize: 0.9 });
	});

	it('accepts partial proportions (only provided keys validated)', () => {
		const result = validateCosmetic({ proportions: { height: 1.0 } });
		expect(result.ok).toBe(true);
		expect(result.value.proportions).toEqual({ height: 1.0 });
	});

	it('rejects proportions with NaN value', () => {
		const result = validateCosmetic({ proportions: { height: NaN } });
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/must be a number/);
	});

	it('rejects proportions value above max bound', () => {
		const result = validateCosmetic({ proportions: { height: 2.0 } });
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/between/);
	});

	it('rejects proportions value below min bound', () => {
		const result = validateCosmetic({ proportions: { height: 0.1 } });
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/between/);
	});

	it('rejects proportions with string value', () => {
		const result = validateCosmetic({ proportions: { height: 'tall' } });
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/must be a number/);
	});

	it('rejects proportions with unknown key', () => {
		const result = validateCosmetic({ proportions: { bogus: 1.0 } });
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/Unknown proportion key/);
	});

	it('rejects proportions that is not an object', () => {
		expect(validateCosmetic({ proportions: null }).ok).toBe(false);
		expect(validateCosmetic({ proportions: [] }).ok).toBe(false);
		expect(validateCosmetic({ proportions: 'nope' }).ok).toBe(false);
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

	it('restores modelId to player when missing', () => {
		const result = backfillCosmetic({});
		expect(result.modelId).toBe('player');
	});

	it('restores modelId to player when invalid', () => {
		const result = backfillCosmetic({ modelId: 'phantom' });
		expect(result.modelId).toBe('player');
	});

	it('restores modelId to player when null', () => {
		const result = backfillCosmetic({ modelId: null });
		expect(result.modelId).toBe('player');
	});

	it('clamps proportion value below min to min', () => {
		const result = backfillCosmetic({ proportions: { height: 0.1 } });
		expect(result.proportions.height).toBe(PROPORTION_RANGES.height.min);
	});

	it('clamps proportion value above max to max', () => {
		const result = backfillCosmetic({ proportions: { height: 5.0 } });
		expect(result.proportions.height).toBe(PROPORTION_RANGES.height.max);
	});

	it('fills missing proportion key with 1.0', () => {
		const result = backfillCosmetic({ proportions: { height: 1.0 } });
		expect(result.proportions.headSize).toBe(1.0);
		expect(result.proportions.torsoWidth).toBe(1.0);
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
