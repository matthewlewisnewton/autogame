/**
 * Character booth helpers for hub playthrough validation (ticket 281 sub-ticket 03).
 */
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { readHarness } from './harnessState.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { APPEARANCE_CHANGE_COST } = require(path.resolve(__dirname, '../../../game/server/config.js'));

export { APPEARANCE_CHANGE_COST };

/** Default unlocked hat id for free hat-swap validation (first catalog hat after `none`). */
export const DEFAULT_HAT_SWAP_ID = 'cap';

/**
 * Read numeric player currency from harness state (falls back to parsing currencyText).
 * @param {import('playwright').Page} page
 * @returns {Promise<number|null>}
 */
export async function readCurrency(page) {
	const harness = await readHarness(page);
	if (Number.isFinite(harness?.currency)) {
		return harness.currency;
	}
	if (Number.isFinite(harness?.player?.currency)) {
		return harness.player.currency;
	}
	const text = harness?.currencyText;
	if (typeof text === 'string') {
		const digits = text.replace(/[^\d]/g, '');
		if (digits) {
			const parsed = Number(digits);
			if (Number.isFinite(parsed)) return parsed;
		}
	}
	return null;
}

/**
 * Request the hub currency debug scenario and wait until currency is sufficient.
 * @param {import('playwright').Page} page
 * @param {string} scenario
 */
export async function grantHubCurrency(page, scenario) {
	const result = await page.evaluate(async (name) => {
		if (typeof window.__requestDebugScenarioForTest !== 'function') {
			return { ok: false, reason: '__requestDebugScenarioForTest missing' };
		}
		return window.__requestDebugScenarioForTest(name);
	}, scenario);
	if (!result?.ok) {
		const harness = await readHarness(page);
		throw new Error(`grantHubCurrency(${scenario}) failed: ${JSON.stringify(result)} harness=${JSON.stringify(harness)}`);
	}
	await page.waitForFunction((minCost) => {
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		const currency = Number.isFinite(h?.currency) ? h.currency : h?.player?.currency;
		return Number.isFinite(currency) && currency >= minCost;
	}, APPEARANCE_CHANGE_COST, { timeout: 10000 }).catch(async () => {
		const harness = await readHarness(page);
		throw new Error(`Currency not at least ${APPEARANCE_CHANGE_COST} after ${scenario}: ${JSON.stringify(harness)}`);
	});
}

/** Open the in-hub character booth overlay. */
export async function openCharacterBooth(page) {
	await page.evaluate(() => {
		if (typeof window.openCharacterBooth !== 'function') {
			throw new Error('openCharacterBooth missing');
		}
		window.openCharacterBooth();
	});
	await page.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		return h?.characterBoothOpen === true;
	}, { timeout: 5000 }).catch(async () => {
		const harness = await readHarness(page);
		throw new Error(`Character booth did not open: ${JSON.stringify(harness)}`);
	});
}

/**
 * Apply a paid appearance patch, confirm save, and wait for appearanceChanged.
 * @param {import('playwright').Page} page
 * @param {object} patch
 */
export async function savePaidAppearance(page, patch) {
	const result = await page.evaluate(async (appearancePatch) => {
		if (typeof window.__patchCharacterBoothForTest !== 'function') {
			return { ok: false, reason: '__patchCharacterBoothForTest missing' };
		}
		if (typeof window.__saveCharacterBoothForTest !== 'function') {
			return { ok: false, reason: '__saveCharacterBoothForTest missing' };
		}
		window.__patchCharacterBoothForTest(appearancePatch);
		return window.__saveCharacterBoothForTest();
	}, patch);
	if (!result?.ok) {
		const harness = await readHarness(page);
		throw new Error(`savePaidAppearance failed: ${JSON.stringify(result)} harness=${JSON.stringify(harness)}`);
	}
	await page.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		return h?.characterBoothOpen === false;
	}, { timeout: 15000 }).catch(async () => {
		const harness = await readHarness(page);
		throw new Error(`Booth did not close after paid save: ${JSON.stringify(harness)}`);
	});
	return result;
}

/**
 * Change only the equipped hat and save (free path).
 * @param {import('playwright').Page} page
 * @param {string} hatId
 */
export async function saveHatOnly(page, hatId) {
	const result = await page.evaluate(async (id) => {
		if (typeof window.__patchCharacterBoothForTest !== 'function') {
			return { ok: false, reason: '__patchCharacterBoothForTest missing' };
		}
		window.__patchCharacterBoothForTest({ hat: id });
		if (typeof window.__saveCharacterBoothForTest !== 'function') {
			return { ok: false, reason: '__saveCharacterBoothForTest missing' };
		}
		return window.__saveCharacterBoothForTest();
	}, hatId);
	if (!result?.ok) {
		const harness = await readHarness(page);
		throw new Error(`saveHatOnly(${hatId}) failed: ${JSON.stringify(result)} harness=${JSON.stringify(harness)}`);
	}
	await page.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		return h?.characterBoothOpen === false;
	}, { timeout: 15000 }).catch(async () => {
		const harness = await readHarness(page);
		throw new Error(`Booth did not close after hat save: ${JSON.stringify(harness)}`);
	});
	return result;
}

/**
 * Patch booth selection and open the paid-save confirm dialog (no confirm yet).
 * @param {import('playwright').Page} page
 * @param {object} patch
 */
export async function stagePaidAppearanceConfirm(page, patch) {
	await page.evaluate((appearancePatch) => {
		window.__patchCharacterBoothForTest(appearancePatch);
		window.__requestBoothSaveForTest();
	}, patch);
	await page.waitForFunction(() => {
		const confirm = document.getElementById('character-booth-confirm');
		return confirm && !confirm.classList.contains('hidden');
	}, { timeout: 5000 });
}

/** Confirm a staged paid save and wait for the booth to close. */
export async function completePaidAppearanceConfirm(page) {
	await page.evaluate(() => {
		if (typeof window.__confirmBoothPaidSaveForTest !== 'function') {
			throw new Error('__confirmBoothPaidSaveForTest missing');
		}
		window.__confirmBoothPaidSaveForTest();
	});
	await page.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		const err = document.getElementById('character-booth-cosmetic-error');
		const errText = err && !err.hidden ? err.textContent.trim() : '';
		return h?.characterBoothOpen === false && !errText;
	}, { timeout: 15000 }).catch(async () => {
		const harness = await readHarness(page);
		throw new Error(`Paid save confirm did not complete: ${JSON.stringify(harness)}`);
	});
}
