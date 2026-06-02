import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	syncCosmeticForm,
	readCosmeticDraft,
	cosmeticsEqual,
	updateVanguardPortraitCosmetic,
	buildCosmeticPatchPayload,
	selectShapeButton,
	selectSwatchInGrid,
} from '../cosmetic-form.js';

function buildCosmeticDom() {
	const section = document.createElement('div');

	const shapeGroup = document.createElement('div');
	shapeGroup.className = 'cosmetic-shape-group';
	for (const shape of ['box', 'cylinder', 'cone', 'capsule']) {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'cosmetic-shape-btn' + (shape === 'box' ? ' selected' : '');
		btn.dataset.shape = shape;
		btn.setAttribute('aria-checked', shape === 'box' ? 'true' : 'false');
		shapeGroup.appendChild(btn);
	}
	section.appendChild(shapeGroup);

	const bodyGrid = document.createElement('div');
	bodyGrid.id = 'cosmetic-body-colors';
	bodyGrid.className = 'cosmetic-swatch-grid';
	for (const color of ['#4f9dde', '#22c55e', '#ef4444']) {
		const sw = document.createElement('button');
		sw.type = 'button';
		sw.className = 'cosmetic-swatch' + (color === '#4f9dde' ? ' selected' : '');
		sw.dataset.color = color;
		bodyGrid.appendChild(sw);
	}
	section.appendChild(bodyGrid);

	const accentGrid = document.createElement('div');
	accentGrid.id = 'cosmetic-accent-colors';
	accentGrid.className = 'cosmetic-swatch-grid';
	for (const color of ['#f2c94c', '#f472b6']) {
		const sw = document.createElement('button');
		sw.type = 'button';
		sw.className = 'cosmetic-swatch' + (color === '#f2c94c' ? ' selected' : '');
		sw.dataset.color = color;
		accentGrid.appendChild(sw);
	}
	section.appendChild(accentGrid);

	const bodyCustom = document.createElement('input');
	bodyCustom.type = 'color';
	bodyCustom.id = 'cosmetic-body-custom';
	bodyCustom.value = '#4f9dde';
	section.appendChild(bodyCustom);

	const accentCustom = document.createElement('input');
	accentCustom.type = 'color';
	accentCustom.id = 'cosmetic-accent-custom';
	accentCustom.value = '#f2c94c';
	section.appendChild(accentCustom);

	const error = document.createElement('p');
	error.id = 'cosmetic-error';
	error.hidden = true;
	section.appendChild(error);

	document.body.appendChild(section);

	return {
		shapeBtnEls: Array.from(shapeGroup.querySelectorAll('.cosmetic-shape-btn')),
		bodySwatchesEl: bodyGrid,
		accentSwatchesEl: accentGrid,
		bodyCustomInput: bodyCustom,
		accentCustomInput: accentCustom,
		cosmeticErrorEl: error,
	};
}

describe('cosmetic-form', () => {
	/** @type {ReturnType<typeof buildCosmeticDom>} */
	let refs;

	beforeEach(() => {
		document.body.innerHTML = '';
		refs = buildCosmeticDom();
	});

	it('syncCosmeticForm selects shape, swatches, and custom inputs from cached cosmetic', () => {
		const cosmetic = {
			bodyShape: 'capsule',
			bodyColor: '#22c55e',
			accentColor: '#f472b6',
		};

		const draft = syncCosmeticForm(refs, cosmetic);

		expect(draft).toEqual(cosmetic);
		expect(refs.shapeBtnEls.find((b) => b.dataset.shape === 'capsule')?.classList.contains('selected')).toBe(true);
		expect(refs.bodySwatchesEl.querySelector('[data-color="#22c55e"]')?.classList.contains('selected')).toBe(true);
		expect(refs.accentSwatchesEl.querySelector('[data-color="#f472b6"]')?.classList.contains('selected')).toBe(true);
		expect(refs.bodyCustomInput.value).toBe('#22c55e');
		expect(refs.accentCustomInput.value).toBe('#f472b6');
	});

	it('readCosmeticDraft returns current control selection', () => {
		selectShapeButton(refs.shapeBtnEls, 'cone');
		selectSwatchInGrid(refs.bodySwatchesEl, '#ef4444');
		selectSwatchInGrid(refs.accentSwatchesEl, '#f472b6');

		expect(readCosmeticDraft(refs)).toEqual({
			bodyShape: 'cone',
			bodyColor: '#ef4444',
			accentColor: '#f472b6',
		});
	});

	it('buildCosmeticPatchPayload includes bodyColor, accentColor, and bodyShape', () => {
		const draft = { bodyShape: 'cylinder', bodyColor: '#aabbcc', accentColor: '#112233' };
		expect(buildCosmeticPatchPayload(draft)).toEqual({
			cosmetic: draft,
		});
	});

	it('cosmeticsEqual compares all three fields', () => {
		expect(cosmeticsEqual(
			{ bodyShape: 'box', bodyColor: '#4f9dde', accentColor: '#f2c94c' },
			{ bodyShape: 'box', bodyColor: '#4f9dde', accentColor: '#f2c94c' },
		)).toBe(true);
		expect(cosmeticsEqual(
			{ bodyShape: 'box', bodyColor: '#4f9dde', accentColor: '#f2c94c' },
			{ bodyShape: 'cone', bodyColor: '#4f9dde', accentColor: '#f2c94c' },
		)).toBe(false);
	});

	it('updateVanguardPortraitCosmetic applies colors, border, and data-body-shape', () => {
		const frame = document.createElement('div');
		frame.id = 'character-frame';
		document.body.appendChild(frame);

		updateVanguardPortraitCosmetic(frame, {
			bodyColor: '#ff0000',
			accentColor: '#00ff00',
			bodyShape: 'cylinder',
		});

		expect(frame.style.borderColor).toBe('rgb(0, 255, 0)');
		expect(frame.dataset.bodyShape).toBe('cylinder');
		expect(frame.style.background).toContain('#ff0000');
	});
});

describe('cosmetic save (settings patch)', () => {
	it('successful patchProfile updates getCosmetic; failed patch leaves cache unchanged', async () => {
		const initial = { bodyColor: '#4f9dde', accentColor: '#f2c94c', bodyShape: 'box' };
		const updated = { bodyColor: '#010203', accentColor: '#f2c94c', bodyShape: 'capsule' };

		vi.stubGlobal('fetch', vi.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ username: 'u', settings: {}, cosmetic: initial }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ username: 'u', email: null, cosmetic: updated }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ username: 'u', settings: {}, cosmetic: initial }),
			})
			.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: async () => ({ error: 'Invalid cosmetic' }),
			}));

		const { loadAccountSettings, patchProfile, getCosmetic } = await import('../settings.js');
		await loadAccountSettings('token-a');
		const ok = await patchProfile(buildCosmeticPatchPayload(updated));
		expect(ok.error).toBeUndefined();
		expect(getCosmetic()).toEqual(updated);

		await loadAccountSettings('token-b');
		const fail = await patchProfile({ cosmetic: { bodyShape: 'pyramid' } });
		expect(fail.error).toBe('Invalid cosmetic');
		expect(getCosmetic()).toEqual(initial);

		vi.unstubAllGlobals();
	});
});
