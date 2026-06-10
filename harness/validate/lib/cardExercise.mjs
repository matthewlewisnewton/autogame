/**
 * Playwright card-exercise helpers for validation playthroughs.
 */
import path from 'path';
import { readHarness } from './harnessState.mjs';
import { writeScreenshot } from './screenshot.mjs';

function handSlotForCard(harness, cardId) {
	return (harness?.hand || []).findIndex((card) => card && card.id === cardId);
}

function nearestLiveGrunt(harness) {
	const player = harness?.player;
	if (!player) return null;
	const pool = (harness?.enemyHp || []).filter((enemy) => enemy.hp > 0 && enemy.type === 'grunt');
	if (pool.length === 0) return null;
	let nearest = null;
	let bestDist = Infinity;
	for (const enemy of pool) {
		if (enemy.x == null || enemy.z == null) continue;
		const dist = Math.hypot(enemy.x - player.x, enemy.z - player.z);
		if (dist < bestDist) {
			bestDist = dist;
			nearest = enemy;
		}
	}
	return nearest ? { enemy: nearest, dist: bestDist } : null;
}

async function focusCanvas(page) {
	await page.evaluate(() => {
		document.querySelector('canvas:not(.cosmetic-preview-canvas)')?.focus();
	});
}

/**
 * Wait until the run is in the playing phase on the expected layout profile.
 * `layoutProfile` is preset-driven (e.g. 'sunken-canyon', 'open-plaza'); when
 * omitted only the playing phase is required.
 *
 * @param {import('playwright').Page} page
 * @param {string} [layoutProfile]
 */
async function waitForPlayingOnProfile(page, layoutProfile) {
	await page.waitForFunction((expectedProfile) => {
		const harness = window.__AUTOGAME_HARNESS_STATE__?.();
		if (harness?.phase !== 'playing') return false;
		return !expectedProfile || harness?.layout?.profile === expectedProfile;
	}, layoutProfile ?? null, { timeout: 60000 });
}

/**
 * Press the keyboard hint for a 0-based hand slot (1–6).
 *
 * @param {import('playwright').Page} page
 * @param {number} slotIndex
 */
export async function castHandSlot(page, slotIndex) {
	await focusCanvas(page);
	await page.keyboard.press(String(slotIndex + 1));
}

async function requestScenario(page, scenario) {
	const result = await page.evaluate((name) => {
		if (typeof window.__requestDebugScenarioForTest !== 'function') {
			return { ok: false, reason: '__requestDebugScenarioForTest missing' };
		}
		return window.__requestDebugScenarioForTest(name);
	}, scenario);
	if (!result?.ok) {
		const harness = await readHarness(page);
		throw new Error(`Debug scenario ${scenario} failed: ${result?.reason || 'unknown'} — ${JSON.stringify(harness)}`);
	}
	return result;
}

/**
 * @param {object} harness
 * @param {string} enemyId
 */
export function probeEnemyStatus(harness, enemyId) {
	const now = Date.now();
	const enemy = (harness?.enemyHp || []).find((entry) => entry.id === enemyId) || null;
	if (!enemy) {
		return {
			targetEnemyId: enemyId,
			found: false,
			slowedUntil: 0,
			burningUntil: 0,
			slowActive: false,
			burnActive: false,
		};
	}
	const slowedUntil = enemy.slowedUntil ?? 0;
	const burningUntil = enemy.burningUntil ?? 0;
	return {
		targetEnemyId: enemyId,
		found: true,
		slowedUntil,
		burningUntil,
		slowActive: enemy.slowActive ?? slowedUntil > now,
		burnActive: enemy.burnActive ?? burningUntil > now,
	};
}

/**
 * @param {{ afterSlow: object, afterBurn: object, targetEnemyId?: string }} probes
 */
export function assertSlowBurnMutualExclusive(probes) {
	const checks = [probes.afterSlow, probes.afterBurn].filter(Boolean);
	for (const probe of checks) {
		if (probe.slowActive && probe.burnActive) {
			throw new Error(`Slow and burn both active on ${probe.targetEnemyId}: ${JSON.stringify(probe)}`);
		}
	}
	if (!probes.afterSlow?.slowActive) {
		throw new Error(`Expected slow active after Glacial Orb: ${JSON.stringify(probes.afterSlow)}`);
	}
	if (!probes.afterBurn?.burnActive) {
		throw new Error(`Expected burn active after Fireball: ${JSON.stringify(probes.afterBurn)}`);
	}
	if (probes.afterBurn?.slowActive) {
		throw new Error(`Expected slow cleared after Fireball: ${JSON.stringify(probes.afterBurn)}`);
	}
	return { slowBurnMutuallyExclusive: true };
}

/**
 * Cast ice_ball then fireball on the same grunt and assert ticket 301 exclusivity.
 *
 * @param {import('playwright').Page} page
 * @param {{ outDir?: string, repoRoot?: string }} [opts]
 */
export async function runSlowBurnExercise(page, { outDir, repoRoot, layoutProfile } = {}) {
	await waitForPlayingOnProfile(page, layoutProfile);

	await focusCanvas(page);
	await requestScenario(page, 'ice-ball-ready');

	let harness = await readHarness(page);
	const nearest = nearestLiveGrunt(harness);
	if (!nearest) {
		throw new Error(`No live grunt for slow/burn exercise: ${JSON.stringify(harness?.enemyHp)}`);
	}
	const targetEnemyId = nearest.enemy.id;

	const iceSlot = handSlotForCard(harness, 'ice_ball');
	if (iceSlot < 0) {
		throw new Error(`ice_ball not in hand after ice-ball-ready: ${JSON.stringify(harness?.hand)}`);
	}

	await page.evaluate(() => {
		const original = Math.random;
		Math.random = () => 0.1;
		window.__restoreHarnessMathRandom = () => {
			Math.random = original;
		};
	});

	await castHandSlot(page, iceSlot);
	await page.waitForTimeout(2200);
	await page.evaluate(() => window.__restoreHarnessMathRandom?.());

	harness = await readHarness(page);
	const afterSlow = probeEnemyStatus(harness, targetEnemyId);

	await requestScenario(page, 'fireball-hand-ready');

	harness = await readHarness(page);
	const fireSlot = handSlotForCard(harness, 'fireball');
	if (fireSlot < 0) {
		throw new Error(`fireball not in hand after fireball-hand-ready: ${JSON.stringify(harness?.hand)}`);
	}

	await castHandSlot(page, fireSlot);
	await page.waitForTimeout(1500);

	harness = await readHarness(page);
	const afterBurn = probeEnemyStatus(harness, targetEnemyId);
	const assertion = assertSlowBurnMutualExclusive({ afterSlow, afterBurn, targetEnemyId });

	let screenshot = null;
	if (outDir) {
		const shotPath = await writeScreenshot(page, outDir, '08-slow-burn-mutual-exclusive');
		screenshot = repoRoot ? path.relative(repoRoot, shotPath) : shotPath;
	}

	return {
		targetEnemyId,
		afterSlow,
		afterBurn,
		screenshot,
		...assertion,
	};
}

/**
 * @param {object} harness
 */
export function probePlayerStatus(harness) {
	const now = Date.now();
	const player = harness?.player;
	if (!player) {
		return {
			found: false,
			hp: null,
			slowedUntil: 0,
			burningUntil: 0,
			slowActive: false,
			burnActive: false,
		};
	}
	const slowedUntil = player.slowedUntil ?? 0;
	const burningUntil = player.burningUntil ?? 0;
	return {
		found: true,
		hp: player.hp,
		slowedUntil,
		burningUntil,
		slowActive: player.slowActive ?? slowedUntil > now,
		burnActive: player.burnActive ?? burningUntil > now,
	};
}

function enemyStatusesCleared(harness) {
	return (harness?.enemyHp || []).every((enemy) => !enemy.slowActive && !enemy.burnActive);
}

/**
 * Probe DOM signals for an active card wind-up telegraph while input is locked.
 *
 * @param {import('playwright').Page} page
 */
export async function probeWindupTelegraphDom(page) {
	return page.evaluate(() => {
		const cardHand = document.getElementById('card-hand');
		const inputLocked = !!cardHand?.classList.contains('input-locked');
		const activatingSlot = document.querySelector('.card-slot.activating');
		const windupIndicator = document.querySelector('.card-windup-indicator');
		const indicatorWidth = windupIndicator?.getBoundingClientRect().width ?? 0;
		const telegraphVisible = !!activatingSlot || indicatorWidth > 0 || inputLocked;
		return {
			inputLocked,
			activatingSlot: !!activatingSlot,
			windupIndicatorWidth: indicatorWidth,
			telegraphVisible,
		};
	});
}

/**
 * Cast Purifying Pulse after purifying-pulse-ready and assert heal + cleanse.
 *
 * @param {import('playwright').Page} page
 * @param {{ outDir?: string, repoRoot?: string }} [opts]
 */
export async function runPurifyingPulseExercise(page, { outDir, repoRoot, layoutProfile } = {}) {
	await waitForPlayingOnProfile(page, layoutProfile);

	await focusCanvas(page);
	await requestScenario(page, 'purifying-pulse-ready');

	let harness = await readHarness(page);
	const pulseSlot = handSlotForCard(harness, 'purifying_pulse');
	if (pulseSlot < 0) {
		throw new Error(`purifying_pulse not in hand after purifying-pulse-ready: ${JSON.stringify(harness?.hand)}`);
	}

	const preCast = probePlayerStatus(harness);
	if (!preCast.slowActive && !preCast.burnActive) {
		throw new Error(`Expected slow or burn active before Purifying Pulse: ${JSON.stringify(preCast)}`);
	}

	await castHandSlot(page, pulseSlot);
	await page.waitForTimeout(1500);

	harness = await readHarness(page);
	const postCast = probePlayerStatus(harness);
	const healCleanseApplied = postCast.hp > preCast.hp
		&& !postCast.slowActive
		&& !postCast.burnActive
		&& enemyStatusesCleared(harness);

	if (!healCleanseApplied) {
		throw new Error(`Purifying Pulse heal/cleanse failed: pre=${JSON.stringify(preCast)} post=${JSON.stringify(postCast)} enemies=${JSON.stringify(harness?.enemyHp)}`);
	}

	let screenshot = null;
	if (outDir) {
		const shotPath = await writeScreenshot(page, outDir, '09-purifying-pulse');
		screenshot = repoRoot ? path.relative(repoRoot, shotPath) : shotPath;
	}

	return {
		preCast,
		postCast,
		healCleanseApplied,
		screenshot,
	};
}

/**
 * Press a wind-up weapon once and capture harness + DOM probes during lockout.
 *
 * @param {import('playwright').Page} page
 * @param {{ outDir?: string, repoRoot?: string, cardId?: string, scenario?: string }} [opts]
 */
export async function runWindupCardExercise(page, {
	outDir,
	repoRoot,
	cardId = 'magma_greatsword',
	scenario = 'magma-windup-ready',
	layoutProfile,
} = {}) {
	await waitForPlayingOnProfile(page, layoutProfile);

	await focusCanvas(page);
	await requestScenario(page, scenario);

	let harness = await readHarness(page);
	const weaponSlot = handSlotForCard(harness, cardId);
	if (weaponSlot < 0) {
		throw new Error(`${cardId} not in hand after ${scenario}: ${JSON.stringify(harness?.hand)}`);
	}

	await castHandSlot(page, weaponSlot);

	const windupProbe = await page.waitForFunction((expectedCardId) => {
		const harness = window.__AUTOGAME_HARNESS_STATE__?.();
		const player = harness?.player;
		if (!player) return false;
		if (player.cardUseState !== 'windup') return false;
		if (!(player.cardWindupUntil > Date.now())) return false;
		if (player.cardWindupCardId !== expectedCardId) return false;

		const cardHand = document.getElementById('card-hand');
		const inputLocked = !!cardHand?.classList.contains('input-locked');
		const activatingSlot = document.querySelector('.card-slot.activating');
		const windupIndicator = document.querySelector('.card-windup-indicator');
		const indicatorWidth = windupIndicator?.getBoundingClientRect().width ?? 0;
		const telegraphVisible = !!activatingSlot || indicatorWidth > 0 || inputLocked;
		if (!inputLocked || !telegraphVisible) return false;

		return {
			cardUseState: player.cardUseState,
			cardWindupUntil: player.cardWindupUntil,
			cardWindupCardId: player.cardWindupCardId,
			inputLocked,
			activatingSlot: !!activatingSlot,
			windupIndicatorWidth: indicatorWidth,
			telegraphVisible,
		};
	}, cardId, { timeout: 5000 });

	const duringWindup = await windupProbe.jsonValue();
	const domProbe = await probeWindupTelegraphDom(page);
	const windupTelegraphActive = duringWindup.cardUseState === 'windup'
		&& duringWindup.cardWindupUntil > Date.now()
		&& duringWindup.cardWindupCardId === cardId
		&& domProbe.inputLocked
		&& domProbe.telegraphVisible;

	if (!windupTelegraphActive) {
		throw new Error(`Wind-up telegraph mismatch: probe=${JSON.stringify(duringWindup)} dom=${JSON.stringify(domProbe)}`);
	}

	let screenshot = null;
	if (outDir) {
		const shotPath = await writeScreenshot(page, outDir, '10-windup-charge');
		screenshot = repoRoot ? path.relative(repoRoot, shotPath) : shotPath;
	}

	return {
		cardId,
		scenario,
		duringWindup,
		domProbe,
		windupTelegraphActive,
		screenshot,
	};
}
