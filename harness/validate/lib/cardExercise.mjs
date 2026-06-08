/**
 * Playwright card-exercise helpers for validation playthroughs.
 */
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
 * @param {{ outDir?: string }} [opts]
 */
export async function runSlowBurnExercise(page, { outDir } = {}) {
	await page.waitForFunction(() => {
		const harness = window.__AUTOGAME_HARNESS_STATE__?.();
		return harness?.phase === 'playing' && harness?.layout?.profile === 'sunken-canyon';
	}, { timeout: 60000 });

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

	await page.keyboard.press(String(iceSlot + 1));
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

	await page.keyboard.press(String(fireSlot + 1));
	await page.waitForTimeout(1500);

	harness = await readHarness(page);
	const afterBurn = probeEnemyStatus(harness, targetEnemyId);
	const assertion = assertSlowBurnMutualExclusive({ afterSlow, afterBurn, targetEnemyId });

	if (outDir) {
		await writeScreenshot(page, outDir, '08-slow-burn-mutual-exclusive');
	}

	return {
		targetEnemyId,
		afterSlow,
		afterBurn,
		...assertion,
	};
}
