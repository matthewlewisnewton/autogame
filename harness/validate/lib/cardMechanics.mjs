/**
 * Fire preset card-mechanics probe helpers (burn, slow/exclusion, cleanse, windup).
 */
import path from 'path';
import { readHarness } from './harnessState.mjs';
import { writeScreenshot } from './screenshot.mjs';

// Must stay in sync with game/server/simulation.js BURN_TICK_INTERVAL_MS.
const BURN_TICK_INTERVAL_MS = 500;

async function focusCanvas(page) {
	await page.evaluate(() => {
		document.querySelector('canvas:not(.cosmetic-preview-canvas)')?.focus();
	});
}

async function requestScenario(page, scenario) {
	const result = await page.evaluate(async (name) => {
		if (typeof window.__requestDebugScenarioForTest !== 'function') {
			return { ok: false, reason: '__requestDebugScenarioForTest missing' };
		}
		return window.__requestDebugScenarioForTest(name);
	}, scenario);
	if (!result?.ok) {
		const harness = await readHarness(page);
		throw new Error(`Debug scenario ${scenario} failed: ${JSON.stringify(result)} harness=${JSON.stringify(harness)}`);
	}
	return result;
}

async function prepareCardMechanicsPage(page) {
	await page.evaluate(() => {
		const overlay = document.getElementById('run-summary-overlay');
		if (overlay) overlay.style.display = 'none';
		if (typeof window.__clearHandCooldownsForTest === 'function') {
			window.__clearHandCooldownsForTest();
		}
		if (typeof window.__toggleDebugGodmodeForTest === 'function') {
			const h = window.__AUTOGAME_HARNESS_STATE__?.();
			if (!h?.player?.debugGodmode) {
				window.__toggleDebugGodmodeForTest();
			}
		}
	});
	await focusCanvas(page);
}

async function castCardSlot(page, slot, cardId, waitMs = 2500) {
	await focusCanvas(page);
	await page.evaluate(({ slotIndex, expectedCardId }) => {
		if (typeof window.__emitUseCardForTest === 'function' && expectedCardId) {
			window.__emitUseCardForTest(expectedCardId, slotIndex);
			return;
		}
		if (typeof window.__useCardForTest === 'function') {
			window.__useCardForTest(slotIndex);
		}
	}, { slotIndex: slot, expectedCardId: cardId });
	// Probe scenarios pin server hands that may not mirror on the client yet; do not
	// block for long on client charge UI — server resolution is authoritative.
	await page.waitForTimeout(300);
	await page.waitForFunction((id) => {
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		const handCard = h?.hand?.find((c) => c && c.id === id);
		if (!handCard) return true;
		return handCard.remainingCharges < handCard.charges;
	}, cardId, { timeout: Math.min(waitMs, 800) }).catch(() => {});
}

async function pressCardSlot(page, slot, holdMs = 500) {
	await focusCanvas(page);
	await page.keyboard.press(String(slot + 1));
	await page.waitForTimeout(holdMs);
}

async function waitForHarness(page, predicate, timeoutMs = 15000) {
	await page.waitForFunction(predicate, { timeout: timeoutMs }).catch(async () => {
		const harness = await readHarness(page);
		throw new Error(`Harness wait timed out: ${JSON.stringify(harness)}`);
	});
}

function enemyStatusProbe(harness) {
	const enemy = (harness?.enemyHp || []).find((e) => e.hp > 0) || null;
	return {
		burningUntil: enemy?.burningUntil ?? 0,
		slowedUntil: enemy?.slowedUntil ?? 0,
		hp: enemy?.hp ?? null,
	};
}

function playerStatusProbe(harness) {
	return {
		burningUntil: harness?.player?.burningUntil ?? 0,
		slowedUntil: harness?.player?.slowedUntil ?? 0,
		cardUseState: harness?.player?.cardUseState ?? null,
		hp: harness?.player?.hp ?? null,
		x: harness?.player?.x ?? null,
		z: harness?.player?.z ?? null,
		windupFlashing: harness?.windupFlashing === true,
	};
}

/**
 * @param {import('playwright').Page} page
 * @param {{ preset: object, outDirAbs: string, repoRoot: string }} opts
 */
export async function runEmberBurnStep({ page, preset, outDirAbs, repoRoot }) {
	const scenario = preset.emberBurnScenario;
	if (!scenario) {
		return { emberBurnApplied: false, reason: 'emberBurnScenario not configured' };
	}

	await requestScenario(page, scenario);
	await page.evaluate(() => {
		const overlay = document.getElementById('run-summary-overlay');
		if (overlay) overlay.style.display = 'none';
		if (typeof window.__toggleDebugGodmodeForTest === 'function') {
			const h = window.__AUTOGAME_HARNESS_STATE__?.();
			if (h?.player?.debugGodmode) {
				window.__toggleDebugGodmodeForTest();
			}
		}
	});

	const afterGodmodeHarness = await readHarness(page);
	const debugGodmodeOff = afterGodmodeHarness?.player?.debugGodmode !== true;
	const hpBefore = afterGodmodeHarness?.player?.hp ?? null;
	const deadline = Date.now() + 60000;
	let burningApplied = false;
	let hpAtBurnStart = hpBefore;
	while (Date.now() < deadline) {
		const harness = await readHarness(page);
		const now = Date.now();
		const burningUntil = harness?.player?.burningUntil ?? 0;
		if (burningUntil > now) {
			burningApplied = true;
			hpAtBurnStart = harness?.player?.hp ?? hpBefore;
			break;
		}
		await page.waitForTimeout(BURN_TICK_INTERVAL_MS);
	}

	// Poll past the burn-tick arming delay so at least one tick can apply damage.
	let hpAfterTicks = hpAtBurnStart;
	let burnTickDamageApplied = false;
	const tickDeadline = Date.now() + 10000;
	while (Date.now() < tickDeadline) {
		await page.waitForTimeout(BURN_TICK_INTERVAL_MS);
		const harness = await readHarness(page);
		const hp = harness?.player?.hp ?? null;
		if (Number.isFinite(hp)) {
			hpAfterTicks = hp;
			if (Number.isFinite(hpAtBurnStart) && hp < hpAtBurnStart) {
				burnTickDamageApplied = true;
				break;
			}
		}
	}

	const midHarness = await readHarness(page);
	const hpDelta = Number.isFinite(hpBefore) && Number.isFinite(hpAfterTicks)
		? hpAfterTicks - hpBefore
		: null;
	if (!burnTickDamageApplied && Number.isFinite(hpDelta) && hpDelta < 0) {
		burnTickDamageApplied = true;
	}

	const screenshotPath = await writeScreenshot(page, outDirAbs, '04-ember-burn');

	return {
		emberBurnApplied: burningApplied && burnTickDamageApplied,
		burnTickDamageApplied,
		debugGodmodeOff,
		playerBurningUntil: midHarness?.player?.burningUntil ?? 0,
		hpBefore,
		hpAfterTicks,
		hpDelta,
		screenshot: path.relative(repoRoot, screenshotPath),
	};
}

/**
 * @param {import('playwright').Page} page
 * @param {{ preset: object, outDirAbs: string, repoRoot: string }} opts
 */
export async function runGlacialSlowStep({ page, preset, outDirAbs, repoRoot }) {
	const scenario = preset.glacialSlowScenario;
	if (!scenario) {
		return { glacialSlowApplied: false, reason: 'glacialSlowScenario not configured' };
	}

	await requestScenario(page, scenario);
	await page.evaluate(() => {
		const overlay = document.getElementById('run-summary-overlay');
		if (overlay) overlay.style.display = 'none';
		if (typeof window.__toggleDebugGodmodeForTest === 'function') {
			const h = window.__AUTOGAME_HARNESS_STATE__?.();
			if (h?.player?.debugGodmode) {
				window.__toggleDebugGodmodeForTest();
			}
		}
	});

	const afterGodmodeHarness = await readHarness(page);
	const debugGodmodeOff = afterGodmodeHarness?.player?.debugGodmode !== true;
	const hpBefore = afterGodmodeHarness?.player?.hp ?? null;
	const deadline = Date.now() + 60000;
	let slowApplied = false;
	let hpAfterHit = hpBefore;
	let playerSlowedUntil = 0;
	while (Date.now() < deadline) {
		const harness = await readHarness(page);
		const now = Date.now();
		const slowedUntil = harness?.player?.slowedUntil ?? 0;
		if (slowedUntil > now) {
			slowApplied = true;
			playerSlowedUntil = slowedUntil;
			hpAfterHit = harness?.player?.hp ?? hpBefore;
			break;
		}
		await page.waitForTimeout(100);
	}

	const screenshotPath = await writeScreenshot(page, outDirAbs, '05-glacial-slow');

	return {
		glacialSlowApplied: slowApplied,
		debugGodmodeOff,
		playerSlowedUntil,
		hpBefore,
		hpAfterHit,
		screenshot: path.relative(repoRoot, screenshotPath),
	};
}

/**
 * @param {import('playwright').Page} page
 * @param {{ preset: object, outDirAbs: string, repoRoot: string }} opts
 */
export async function runCardMechanicsStep({ page, preset, outDirAbs, repoRoot }) {
	const scenarios = preset.cardMechanicsScenarios;
	if (!scenarios || typeof scenarios !== 'object') {
		return { ok: false, reason: 'cardMechanicsScenarios not configured', probes: {} };
	}

	const probes = {};
	let allOk = true;

	await prepareCardMechanicsPage(page);

	if (scenarios.burn) {
		await requestScenario(page, scenarios.burn);
		await prepareCardMechanicsPage(page);
		const before = enemyStatusProbe(await readHarness(page));
		await castCardSlot(page, 0, 'fireball', 2500);
		await waitForHarness(page, () => {
			const h = window.__AUTOGAME_HARNESS_STATE__?.();
			const enemy = (h?.enemyHp || []).find((e) => e.hp > 0);
			return (enemy?.burningUntil ?? 0) > Date.now();
		}, 10000);
		const after = enemyStatusProbe(await readHarness(page));
		const burnOk = (after.burningUntil ?? 0) > Date.now();
		probes.burn = { ok: burnOk, before, after };
		if (!burnOk) allOk = false;
		const burnShot = await writeScreenshot(page, outDirAbs, '05-card-burn');
		probes.burn.screenshot = path.relative(repoRoot, burnShot);
	}

	if (scenarios.mutualExclusion) {
		await requestScenario(page, scenarios.mutualExclusion);
		await prepareCardMechanicsPage(page);
		await castCardSlot(page, 0, 'fireball', 2500);
		await waitForHarness(page, () => {
			const h = window.__AUTOGAME_HARNESS_STATE__?.();
			const enemy = (h?.enemyHp || []).find((e) => e.hp > 0);
			return (enemy?.burningUntil ?? 0) > Date.now();
		}, 10000);
		const afterBurn = enemyStatusProbe(await readHarness(page));
		await castCardSlot(page, 1, 'permafrost_lance', 3500);
		await waitForHarness(page, () => {
			const h = window.__AUTOGAME_HARNESS_STATE__?.();
			const enemy = (h?.enemyHp || []).find((e) => e.hp > 0);
			return (enemy?.slowedUntil ?? 0) > Date.now();
		}, 10000);
		const afterSlow = enemyStatusProbe(await readHarness(page));
		const slowOk = (afterSlow.slowedUntil ?? 0) > Date.now();
		const burnCleared = (afterSlow.burningUntil ?? 0) <= Date.now();
		probes.slow = { ok: slowOk && burnCleared, afterBurn, afterSlow, burnCleared };
		if (!slowOk || !burnCleared) allOk = false;
	}

	if (scenarios.cleanse) {
		await requestScenario(page, scenarios.cleanse);
		await prepareCardMechanicsPage(page);
		const before = playerStatusProbe(await readHarness(page));
		const now = Date.now();
		const burningBefore = (before.burningUntil ?? 0) > now;
		const slowedBefore = (before.slowedUntil ?? 0) > now;
		if (burningBefore && slowedBefore) {
			throw new Error(`Cleanse probe before state has mutually exclusive burn+slow: ${JSON.stringify(before)}`);
		}
		const seededStatus = burningBefore ? 'burn' : slowedBefore ? 'slow' : null;
		if (!seededStatus) {
			throw new Error(`Cleanse probe before state missing seeded debuff: ${JSON.stringify(before)}`);
		}
		const hpBeforeCleanse = before.hp ?? 0;
		await castCardSlot(page, 0, 'purifying_pulse', 2500);
		await page.waitForFunction(({ hpBefore, status }) => {
			const h = window.__AUTOGAME_HARNESS_STATE__?.();
			const p = h?.player;
			const burning = (p?.burningUntil ?? 0) > Date.now();
			const slowed = (p?.slowedUntil ?? 0) > Date.now();
			const statusCleared = status === 'burn' ? !burning : !slowed;
			return statusCleared && (p?.hp ?? 0) > hpBefore;
		}, { hpBefore: hpBeforeCleanse, status: seededStatus }, { timeout: 10000 }).catch(async () => {
			const harness = await readHarness(page);
			throw new Error(`Cleanse probe timed out: ${JSON.stringify(harness)}`);
		});
		const after = playerStatusProbe(await readHarness(page));
		const afterNow = Date.now();
		const seededCleared = seededStatus === 'burn'
			? (after.burningUntil ?? 0) <= afterNow
			: (after.slowedUntil ?? 0) <= afterNow;
		const cleanseOk = seededCleared && (after.hp ?? 0) > (before.hp ?? 0);
		probes.cleanse = { ok: cleanseOk, seededStatus, before, after };
		if (!cleanseOk) allOk = false;
	}

	if (scenarios.windup) {
		await requestScenario(page, scenarios.windup);
		await prepareCardMechanicsPage(page);
		const start = playerStatusProbe(await readHarness(page));
		await pressCardSlot(page, 0, 200);
		await waitForHarness(page, () => {
			const h = window.__AUTOGAME_HARNESS_STATE__?.();
			return h?.player?.cardUseState === 'windup' && h?.windupFlashing === true;
		}, 8000);
		const during = playerStatusProbe(await readHarness(page));
		const windupOk = during.cardUseState === 'windup' && during.windupFlashing === true;
		await page.keyboard.down('w');
		await page.waitForTimeout(400);
		await page.keyboard.up('w');
		const afterMove = playerStatusProbe(await readHarness(page));
		const movementBlocked = start.x === afterMove.x && start.z === afterMove.z;
		probes.windup = {
			ok: windupOk && movementBlocked,
			start,
			during,
			afterMove,
			movementBlocked,
		};
		if (!windupOk || !movementBlocked) allOk = false;
	}

	return { ok: allOk, probes };
}
