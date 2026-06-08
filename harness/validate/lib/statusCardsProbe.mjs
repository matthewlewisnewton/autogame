/**
 * Slow/burn mutual-exclusivity + heal/cleanse status-card probe (tickets 301 / 299).
 *
 * Drives three card-grant debug scenarios against the LIVE spire run and reads
 * window.__AUTOGAME_HARNESS_STATE__() to assert:
 *   1. The slow card marks a live enemy: slowedUntil is in the future and the
 *      enemy's burningUntil is cleared.
 *   2. The burn card then marks the SAME enemy: burningUntil is in the future and
 *      slowedUntil is cleared — demonstrating BURNING and SLOW are mutually
 *      exclusive (per ticket 301). The probe fails if both are ever active at once.
 *   3. The heal/cleanse card, cast on a damaged + status-afflicted player, raises
 *      HP and clears the active slow/burn statuses.
 *
 * Read-only instrumentation: it only requests debug scenarios, plays a hand slot,
 * and reads harness state — it never mutates game state directly, and the
 * applySlow/applyBurning/clearNegativeStatuses logic in simulation.js is unchanged.
 */
import path from 'path';
import { readHarness } from './harnessState.mjs';
import { writeScreenshot } from './screenshot.mjs';

const POLL_TIMEOUT_MS = 8000;
const POLL_INTERVAL_MS = 150;

/** True when a status timer (absolute ms) is still in the future. */
function active(until) {
	return Number.isFinite(Number(until)) && Number(until) > Date.now();
}

/** Capture the three status fields the acceptance criteria track. */
function snapshotStatus(entity) {
	return {
		slowedUntil: entity?.slowedUntil ?? 0,
		burningUntil: entity?.burningUntil ?? 0,
		slowFactor: entity?.slowFactor ?? 1,
	};
}

function enemyById(harness, id) {
	return (harness?.enemyHp || []).find((e) => e && e.id === id) || null;
}

/** Live target preference: a remaining add, else the locked boss, else anything. */
function liveTarget(harness, bossType) {
	const live = (harness?.enemyHp || []).filter((e) => e && e.hp > 0);
	return live.find((e) => e.type !== bossType)
		|| live.find((e) => e.type === bossType)
		|| live[0]
		|| null;
}

async function requestScenario(page, scenario) {
	const result = await page.evaluate((name) => {
		if (typeof window.__requestDebugScenarioForTest !== 'function') {
			return { ok: false, reason: '__requestDebugScenarioForTest missing' };
		}
		return window.__requestDebugScenarioForTest(name);
	}, scenario);
	if (!result?.ok) {
		throw new Error(`statusCards probe: debug scenario ${scenario} failed: ${result?.reason || 'unknown'}`);
	}
	return result;
}

/** Poll the live enemy until `predicate(enemy)` holds, then return that enemy. */
async function waitForEnemy(page, enemyId, predicate, label) {
	const deadline = Date.now() + POLL_TIMEOUT_MS;
	let last = null;
	while (Date.now() < deadline) {
		const harness = await readHarness(page);
		const enemy = enemyById(harness, enemyId);
		if (enemy) {
			last = enemy;
			if (predicate(enemy)) return enemy;
		}
		await page.waitForTimeout(POLL_INTERVAL_MS);
	}
	throw new Error(`statusCards probe: ${label} not observed for enemy ${enemyId}: ${JSON.stringify(last)}`);
}

/** Poll the local player until `predicate(player)` holds, then return it. */
async function waitForPlayer(page, predicate, label) {
	const deadline = Date.now() + POLL_TIMEOUT_MS;
	let last = null;
	while (Date.now() < deadline) {
		const harness = await readHarness(page);
		const player = harness?.player ?? null;
		if (player) {
			last = player;
			if (predicate(player)) return player;
		}
		await page.waitForTimeout(POLL_INTERVAL_MS);
	}
	throw new Error(`statusCards probe: ${label} not observed: ${JSON.stringify(last)}`);
}

async function focusCanvas(page) {
	await page.evaluate(() => {
		document.querySelector('canvas:not(.cosmetic-preview-canvas)')?.focus();
	});
}

/**
 * Run the slow/burn + heal/cleanse status-card probe during the active boss phase.
 *
 * @param {import('playwright').Page} page
 * @param {{
 *   outDir: string, repoRoot: string, bossType: string,
 *   slowScenario: string, burnScenario: string, healScenario: string,
 *   screenshotName?: string,
 * }} opts
 * @returns {Promise<{ statusCards: object, healCleanse: object, screenshot: string }>}
 */
export async function probeStatusCards(page, {
	outDir,
	repoRoot,
	bossType,
	slowScenario,
	burnScenario,
	healScenario,
	screenshotName = '05b-status-cards',
} = {}) {
	await focusCanvas(page);

	// Baseline: a live enemy must exist to receive the slow/burn marks.
	const baseHarness = await readHarness(page);
	const baseTarget = liveTarget(baseHarness, bossType);
	if (!baseTarget) {
		throw new Error(`statusCards probe: no live enemy to target: ${JSON.stringify(baseHarness?.enemyHp)}`);
	}
	const slowBefore = snapshotStatus(baseTarget);

	// ── SLOW: grant the slow card and mark the live enemy. ──
	const slowResult = await requestScenario(page, slowScenario);
	const enemyId = slowResult.enemyId || baseTarget.id;
	const slowedEnemy = await waitForEnemy(
		page,
		enemyId,
		(e) => active(e.slowedUntil) && !active(e.burningUntil),
		'slow applied (slowedUntil future, burning cleared)',
	);
	const slowAfter = snapshotStatus(slowedEnemy);
	if (!active(slowAfter.slowedUntil)) {
		throw new Error(`statusCards probe: slowedUntil not in future after slow: ${JSON.stringify(slowAfter)}`);
	}
	if (active(slowAfter.burningUntil)) {
		throw new Error(`statusCards probe: burningUntil not cleared by slow (statuses must be mutually exclusive): ${JSON.stringify(slowAfter)}`);
	}

	// Capture the slow state before the burn card flips it.
	const shotAbs = await writeScreenshot(page, outDir, screenshotName);

	// ── BURN: ignite the SAME enemy; burn must clear the slow. ──
	const burnResult = await requestScenario(page, burnScenario);
	if (burnResult.enemyId && burnResult.enemyId !== enemyId) {
		throw new Error(`statusCards probe: burn targeted a different enemy (${burnResult.enemyId}) than slow (${enemyId})`);
	}
	const burnedEnemy = await waitForEnemy(
		page,
		enemyId,
		(e) => active(e.burningUntil) && !active(e.slowedUntil),
		'burn applied (burningUntil future, slow cleared)',
	);
	const burnAfter = snapshotStatus(burnedEnemy);
	if (!active(burnAfter.burningUntil)) {
		throw new Error(`statusCards probe: burningUntil not in future after burn: ${JSON.stringify(burnAfter)}`);
	}
	if (active(burnAfter.slowedUntil)) {
		throw new Error(`statusCards probe: slowedUntil not cleared by burn (statuses must be mutually exclusive): ${JSON.stringify(burnAfter)}`);
	}

	// Mutual-exclusivity invariant: neither observed state had both active.
	const mutuallyExclusive = !(active(slowAfter.slowedUntil) && active(slowAfter.burningUntil))
		&& !(active(burnAfter.slowedUntil) && active(burnAfter.burningUntil));
	if (!mutuallyExclusive) {
		throw new Error(`statusCards probe: slow and burn were simultaneously active: ${JSON.stringify({ slowAfter, burnAfter })}`);
	}

	const statusCards = {
		enemyId,
		enemyType: slowedEnemy.type ?? null,
		mutuallyExclusive,
		slow: { before: slowBefore, after: slowAfter },
		burn: { before: slowAfter, after: burnAfter },
	};

	// ── HEAL/CLEANSE: damaged + afflicted player casts the heal/cleanse card. ──
	await requestScenario(page, healScenario);
	const preHeal = await waitForPlayer(
		page,
		(p) => Number.isFinite(p.hp) && (active(p.slowedUntil) || active(p.burningUntil)),
		'damaged + afflicted player before heal',
	);
	const healBefore = {
		hp: preHeal.hp,
		slowedUntil: preHeal.slowedUntil ?? 0,
		burningUntil: preHeal.burningUntil ?? 0,
	};

	const healHarness = await readHarness(page);
	const healSlot = (healHarness?.hand || []).findIndex(
		(c) => c && (c.id === 'purifying_pulse' || c.specialEffect === 'heal_and_cleanse'),
	);
	if (healSlot < 0) {
		throw new Error(`statusCards probe: no heal/cleanse card in hand after ${healScenario}: ${JSON.stringify(healHarness?.hand)}`);
	}

	await focusCanvas(page);
	await page.keyboard.press(String(healSlot + 1));

	const healed = await waitForPlayer(
		page,
		(p) => p.hp > healBefore.hp && !active(p.slowedUntil) && !active(p.burningUntil),
		'heal/cleanse (HP increased + statuses cleared)',
	);
	const healAfter = {
		hp: healed.hp,
		slowedUntil: healed.slowedUntil ?? 0,
		burningUntil: healed.burningUntil ?? 0,
	};
	if (!(healAfter.hp > healBefore.hp)) {
		throw new Error(`statusCards probe: HP did not increase after heal: ${JSON.stringify({ healBefore, healAfter })}`);
	}
	if (active(healAfter.slowedUntil) || active(healAfter.burningUntil)) {
		throw new Error(`statusCards probe: statuses not cleared after cleanse: ${JSON.stringify(healAfter)}`);
	}

	const healCleanse = {
		cardSlot: healSlot,
		before: healBefore,
		after: healAfter,
	};

	return {
		statusCards,
		healCleanse,
		screenshot: path.relative(repoRoot, shotAbs),
	};
}
