import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import {
	BODY_SHAPES,
	DEFAULT_COSMETIC,
	BODY_COLOR_PALETTE,
	syncCosmeticForm,
	readCosmeticFormState,
	buildCosmeticPatchPayload,
	applyCosmeticToPreviewElement,
} from '../cosmetic-form.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function buildCosmeticDom() {
	const dom = new JSDOM(indexHtml);
	const doc = dom.window.document;
	const root = doc.getElementById('account-overlay');
	return { doc, root };
}

describe('cosmetic-form constants', () => {
	it('matches server defaults and palette', () => {
		expect(DEFAULT_COSMETIC).toEqual({
			bodyColor: '#4f9dde',
			accentColor: '#f2c94c',
			bodyShape: 'box',
			hat: 'none',
		});
		expect(BODY_SHAPES).toEqual(['box', 'cylinder', 'cone', 'capsule']);
		expect(BODY_COLOR_PALETTE).toEqual([
			'#4f9dde',
			'#38bdf8',
			'#22c55e',
			'#a855f7',
			'#f97316',
			'#ef4444',
			'#e2e8f0',
		]);
	});
});

describe('syncCosmeticForm', () => {
	let root;

	beforeEach(() => {
		({ root } = buildCosmeticDom());
	});

	it('sets swatch, shape aria-pressed, and accent input from cosmetic', () => {
		syncCosmeticForm(root, {
			bodyColor: '#22c55e',
			accentColor: '#aabbcc',
			bodyShape: 'cone',
		});

		const green = root.querySelector('.cosmetic-swatch[data-color="#22c55e"]');
		const defaultBlue = root.querySelector('.cosmetic-swatch[data-color="#4f9dde"]');
		expect(green?.getAttribute('aria-pressed')).toBe('true');
		expect(defaultBlue?.getAttribute('aria-pressed')).toBe('false');
		expect(root.querySelector('#cosmetic-accent-color')?.value).toBe('#aabbcc');
		expect(root.querySelector('.cosmetic-shape-btn[data-shape="cone"]')?.getAttribute('aria-pressed')).toBe('true');
		expect(root.querySelector('.cosmetic-shape-btn[data-shape="box"]')?.getAttribute('aria-pressed')).toBe('false');
	});
});

describe('readCosmeticFormState', () => {
	let root;

	beforeEach(() => {
		({ root } = buildCosmeticDom());
	});

	it('reads pressed swatch, accent input, and shape', () => {
		syncCosmeticForm(root, {
			bodyColor: '#ef4444',
			accentColor: '#010203',
			bodyShape: 'capsule',
		});

		expect(readCosmeticFormState(root)).toEqual({
			bodyColor: '#ef4444',
			accentColor: '#010203',
			bodyShape: 'capsule',
		});
	});

	it('buildCosmeticPatchPayload matches read state', () => {
		syncCosmeticForm(root, {
			bodyColor: '#a855f7',
			accentColor: '#112233',
			bodyShape: 'cylinder',
		});
		expect(buildCosmeticPatchPayload(root)).toEqual(readCosmeticFormState(root));
	});
});

describe('applyCosmeticToPreviewElement', () => {
	let doc;
	let previewEl;

	beforeEach(() => {
		({ doc } = buildCosmeticDom());
		previewEl = doc.getElementById('cosmetic-preview');
	});

	it('is a no-op when previewEl is null', () => {
		expect(() => applyCosmeticToPreviewElement(null, DEFAULT_COSMETIC)).not.toThrow();
	});

	for (const bodyShape of BODY_SHAPES) {
		it(`applies body/accent styles and data-body-shape for ${bodyShape}`, () => {
			const cosmetic = {
				bodyColor: '#38bdf8',
				accentColor: '#f97316',
				bodyShape,
			};
			applyCosmeticToPreviewElement(previewEl, cosmetic);

			expect(previewEl.getAttribute('data-body-shape')).toBe(bodyShape);
			expect(previewEl.style.backgroundColor).toBe('rgb(56, 189, 248)');
			expect(previewEl.style.border).toContain('rgb(249, 115, 22)');
		});
	}
});

describe('settings cosmetic cache', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('loadAccountSettings caches cosmetic with defaults when absent', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				username: 'tester',
				email: null,
				settings: {},
			}),
		});
		vi.stubGlobal('fetch', fetchMock);

		const { loadAccountSettings, getCosmetic } = await import('../settings.js');
		await loadAccountSettings('token-abc');

		expect(getCosmetic()).toEqual(DEFAULT_COSMETIC);
		vi.unstubAllGlobals();
	});

	it('loadAccountSettings stores server cosmetic', async () => {
		const serverCosmetic = {
			bodyColor: '#ef4444',
			accentColor: '#112233',
			bodyShape: 'cylinder',
			hat: 'cap',
		};
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				username: 'tester',
				email: 'a@b.c',
				settings: {},
				cosmetic: serverCosmetic,
			}),
		}));

		const { loadAccountSettings, getCosmetic } = await import('../settings.js');
		await loadAccountSettings('token-abc');

		expect(getCosmetic()).toEqual(serverCosmetic);
		vi.unstubAllGlobals();
	});

	it('patchProfile merges cosmetic from response into cache', async () => {
		vi.stubGlobal('fetch', vi.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					username: 'tester',
					email: null,
					settings: {},
					cosmetic: { ...DEFAULT_COSMETIC },
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					username: 'tester',
					email: null,
					cosmetic: {
						bodyColor: '#22c55e',
						accentColor: '#f2c94c',
						bodyShape: 'cone',
						hat: 'none',
					},
				}),
			}));

		const { loadAccountSettings, patchProfile, getCosmetic } = await import('../settings.js');
		await loadAccountSettings('token-abc');

		const patchBody = { cosmetic: { bodyShape: 'cone', bodyColor: '#22c55e' } };
		const result = await patchProfile(patchBody);

		expect(fetch).toHaveBeenLastCalledWith('/api/me/profile', expect.objectContaining({
			method: 'PATCH',
			body: JSON.stringify(patchBody),
		}));
		expect(result.cosmetic.bodyShape).toBe('cone');
		expect(getCosmetic().bodyColor).toBe('#22c55e');
		expect(getCosmetic().bodyShape).toBe('cone');
		vi.unstubAllGlobals();
	});
});
