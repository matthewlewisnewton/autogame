// ── Shared cosmetic editor form helpers ──
// Used by the Account overlay Character section and the in-hub character booth
// overlay so both UIs share palette constants and control wiring without
// duplicating logic in main.js.

import {
	PROPORTION_RANGES,
	getHatCatalog,
	getUnlockedHats,
} from './settings.js';

/** Preset body-color swatches (#RRGGBB). First entry mirrors the server default. */
export const BODY_COLOR_PALETTE = [
	'#4f9dde', '#ef4444', '#22c55e', '#a855f7',
	'#f97316', '#14b8a6', '#e2e8f0', '#1e293b',
];

/** Preset accent-color swatches (#RRGGBB). */
export const ACCENT_COLOR_PALETTE = [
	'#f2c94c', '#ffffff', '#ef4444', '#22d3ee',
	'#a855f7', '#f97316', '#84cc16', '#0f172a',
];

/** @returns {Record<string, number>} default proportion values (all 1.0). */
export function createDefaultProportions() {
	return Object.fromEntries(Object.keys(PROPORTION_RANGES).map((k) => [k, 1.0]));
}

/**
 * @returns {{ bodyColor: string, accentColor: string, bodyShape: string, hat: string, proportions: Record<string, number> }}
 */
export function createCosmeticSelection() {
	return {
		bodyColor: '',
		accentColor: '',
		bodyShape: 'box',
		hat: 'none',
		proportions: createDefaultProportions(),
	};
}

/** Clamp a numeric proportion value into the configured range for `key`. */
export function clampProportion(key, value) {
	const range = PROPORTION_RANGES[key];
	if (!range) return value;
	const num = Number(value);
	if (!Number.isFinite(num)) return 1.0;
	return Math.max(range.min, Math.min(range.max, num));
}

export function refreshSwatchSelection(container, color) {
	if (!container) return;
	const target = String(color).toLowerCase();
	for (const btn of container.querySelectorAll('.cosmetic-swatch')) {
		const isSel = (btn.dataset.color || '').toLowerCase() === target;
		btn.classList.toggle('selected', isSel);
	}
}

/**
 * Build swatch buttons for a palette into `container`, wiring each to update
 * `selection[field]` and call `onChange`.
 * @param {HTMLElement|null} container
 * @param {string[]} palette
 * @param {'bodyColor'|'accentColor'} field
 * @param {object} selection
 * @param {() => void} onChange
 */
export function buildCosmeticSwatches(container, palette, field, selection, onChange) {
	if (!container) return;
	container.innerHTML = '';
	for (const color of palette) {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'cosmetic-swatch';
		btn.style.backgroundColor = color;
		btn.dataset.color = color;
		btn.title = color;
		btn.setAttribute('aria-label', color);
		btn.addEventListener('click', () => {
			selection[field] = color;
			refreshSwatchSelection(container, color);
			onChange();
		});
		container.appendChild(btn);
	}
}

/**
 * @param {HTMLElement|null} hatListEl
 * @param {object} selection
 * @param {{ getCurrency: () => number, onUnlockHat: (hatId: string) => void, onChange: () => void }} deps
 */
export function buildHatList(hatListEl, selection, { getCurrency, onUnlockHat, onChange }) {
	if (!hatListEl) return;
	const catalog = getHatCatalog();
	const unlocked = getUnlockedHats();
	hatListEl.innerHTML = '';
	for (const hat of catalog) {
		const owned = unlocked.includes(hat.id);
		const row = document.createElement(owned ? 'button' : 'div');
		if (owned) row.type = 'button';
		row.className = 'cosmetic-hat';
		row.dataset.hatId = hat.id;
		row.classList.toggle('owned', owned);
		row.classList.toggle('locked', !owned);

		const name = document.createElement('span');
		name.className = 'cosmetic-hat-name';
		name.textContent = hat.name;
		row.appendChild(name);

		const status = document.createElement('span');
		status.className = 'cosmetic-hat-status';
		status.textContent = owned ? 'Owned' : `Locked · ${hat.price}`;
		row.appendChild(status);

		if (owned) {
			row.addEventListener('click', () => {
				selection.hat = hat.id;
				refreshHatList(hatListEl, selection);
				onChange();
			});
		} else {
			const currency = getCurrency();
			const affordable = currency >= hat.price;
			const unlockBtn = document.createElement('button');
			unlockBtn.type = 'button';
			unlockBtn.className = 'cosmetic-hat-unlock';
			unlockBtn.textContent = 'Unlock';
			unlockBtn.disabled = !affordable;
			if (!affordable) unlockBtn.setAttribute('aria-disabled', 'true');
			unlockBtn.addEventListener('click', () => {
				onUnlockHat(hat.id);
			});
			row.appendChild(unlockBtn);
		}
		hatListEl.appendChild(row);
	}
	refreshHatList(hatListEl, selection);
}

/** Update the equipped/selected highlight on rendered hat entries. */
export function refreshHatList(hatListEl, selection) {
	if (!hatListEl) return;
	for (const btn of hatListEl.querySelectorAll('.cosmetic-hat')) {
		btn.classList.toggle('selected', btn.dataset.hatId === selection.hat);
	}
}

/**
 * Wire proportion sliders inside `proportionsEl` and return a map of controls.
 * @param {HTMLElement|null} proportionsEl
 * @param {object} selection
 * @param {() => void} onChange
 * @param {string} valueIdPrefix - e.g. `cosmetic-prop` or `character-booth-prop`
 * @returns {Map<string, { input: HTMLInputElement, value: HTMLElement|null }>}
 */
export function wireProportionSliders(proportionsEl, selection, onChange, valueIdPrefix) {
	/** @type {Map<string, { input: HTMLInputElement, value: HTMLElement|null }>} */
	const propEls = new Map();
	if (!proportionsEl) return propEls;
	const sliders = proportionsEl.querySelectorAll('input[type="range"][data-prop]');
	for (const input of sliders) {
		const key = input.dataset.prop;
		const range = PROPORTION_RANGES[key];
		if (!range) continue;
		input.min = String(range.min);
		input.max = String(range.max);
		input.step = '0.01';
		const valueEl = document.getElementById(`${valueIdPrefix}-${key}-value`);
		propEls.set(key, { input, value: valueEl });
		input.addEventListener('input', () => {
			const clamped = clampProportion(key, input.value);
			selection.proportions[key] = clamped;
			if (valueEl) valueEl.textContent = clamped.toFixed(2);
			onChange();
		});
	}
	return propEls;
}

/** Set every proportion slider position + readout from `selection`. */
export function refreshProportionSliders(propEls, selection) {
	for (const [key, { input, value }] of propEls) {
		const val = clampProportion(key, selection.proportions[key]);
		selection.proportions[key] = val;
		input.value = String(val);
		if (value) value.textContent = val.toFixed(2);
	}
}

/**
 * Create a wired cosmetic form bound to shared `selection` state.
 * @param {{
 *   elements: {
 *     bodySwatches: HTMLElement|null,
 *     accentSwatches: HTMLElement|null,
 *     shapeSelect: HTMLSelectElement|null,
 *     hatList: HTMLElement|null,
 *     proportions: HTMLElement|null,
 *     errorEl?: HTMLElement|null,
 *   },
 *   selection: ReturnType<typeof createCosmeticSelection>,
 *   onPreviewChange: () => void,
 *   getCurrency: () => number,
 *   onUnlockHat: (hatId: string) => void,
 *   proportionIdPrefix: string,
 * }} config
 */
export function createCosmeticForm({
	elements,
	selection,
	onPreviewChange,
	getCurrency,
	onUnlockHat,
	proportionIdPrefix,
}) {
	const {
		bodySwatches,
		accentSwatches,
		shapeSelect,
		hatList,
		proportions,
		errorEl,
	} = elements;

	const propEls = wireProportionSliders(proportions, selection, onPreviewChange, proportionIdPrefix);

	buildCosmeticSwatches(bodySwatches, BODY_COLOR_PALETTE, 'bodyColor', selection, onPreviewChange);
	buildCosmeticSwatches(accentSwatches, ACCENT_COLOR_PALETTE, 'accentColor', selection, onPreviewChange);

	if (shapeSelect) {
		shapeSelect.addEventListener('change', () => {
			selection.bodyShape = shapeSelect.value;
			onPreviewChange();
		});
	}

	function showError(message) {
		if (!errorEl) return;
		if (message) {
			errorEl.textContent = message;
			errorEl.hidden = false;
		} else {
			errorEl.textContent = '';
			errorEl.hidden = true;
		}
	}

	function syncUI(cosmetic) {
		refreshSwatchSelection(bodySwatches, cosmetic.bodyColor);
		refreshSwatchSelection(accentSwatches, cosmetic.accentColor);
		if (shapeSelect) shapeSelect.value = cosmetic.bodyShape;
		refreshProportionSliders(propEls, selection);
		rebuildHatList();
		showError('');
	}

	function syncFromAccount(getAccountCosmetic) {
		const cosmetic = getAccountCosmetic();
		selection.bodyColor = cosmetic.bodyColor;
		selection.accentColor = cosmetic.accentColor;
		selection.bodyShape = cosmetic.bodyShape;
		selection.hat = cosmetic.hat;
		selection.proportions = { ...cosmetic.proportions };
		syncUI(cosmetic);
		return cosmetic;
	}

	function rebuildHatList() {
		buildHatList(hatList, selection, {
			getCurrency,
			onUnlockHat,
			onChange: onPreviewChange,
		});
	}

	return {
		showError,
		syncFromAccount,
		syncUI,
		rebuildHatList,
		propEls,
	};
}
