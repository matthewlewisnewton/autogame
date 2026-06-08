/**
 * Spire-ascent lifecycle probes (tickets 287 / 289).
 *
 *   - probeTelepipePersistence: returning to the hub via a Telepipe-up preserves
 *     the player's vitals (HP / magic stones) — ticket 287. It deploys a fresh
 *     spire sortie, spends resources, snapshots vitals + remaining card charges,
 *     Telepipe-ups back to the hub, re-reads vitals IN THE HUB, and asserts the
 *     vitals survived within the existing telepipe MS-regen tolerance. The run
 *     fails if HP / magic stones are reset or lost across the Telepipe-up.
 *
 *   - probeCardChargeReset: starting a NEW sortie resets every granted hand
 *     card's remainingCharges back to its full `charges` — ticket 289. It takes
 *     the spent end-of-sortie hand (from the telepipe probe, or it produces one
 *     itself), deploys a fresh sortie, and asserts every occupied card is back to
 *     full charges.
 *
 * Read-only driver: it requests debug scenarios, presses hand slots / moves, and
 * reads window.__AUTOGAME_HARNESS_STATE__(). The vitals-persistence and
 * charge-reset logic in game/server/ is observed, not modified — every helper it
 * reuses already lives in telepipe.mjs.
 */
import path from 'path';
import { readHarness } from './harnessState.mjs';
import { writeScreenshot } from './screenshot.mjs';
import {
	deployViaLaunchBooth,
	depleteRunResources,
	probeHandAndMs,
	probesMatchVitalsPreserved,
	suspendViaTelepipe,
} from './telepipe.mjs';

/** Normalize a probe hand into the id/type/charges shape recorded in the summary. */
function chargeView(hand) {
	return (hand || []).filter(Boolean).map((card) => ({
		id: card.id,
		type: card.type,
		remainingCharges: card.remainingCharges,
		charges: card.charges,
	}));
}

/** A card is "spent" once its remainingCharges dropped below its full charges. */
function anyCardSpent(hand) {
	return chargeView(hand).some(
		(card) => card.charges != null && card.remainingCharges < card.charges,
	);
}

/** Every occupied card is at full charges (remainingCharges === charges). */
function allChargesFull(hand) {
	const occupied = chargeView(hand);
	return occupied.length > 0
		&& occupied.every((card) => card.remainingCharges === card.charges);
}

async function deployFreshSortie(page, lifecycleScenario) {
	await deployViaLaunchBooth(page, lifecycleScenario);
	const harness = await readHarness(page);
	const telepipeInHand = (harness?.hand || []).some((card) => card?.id === 'telepipe');
	if (!telepipeInHand) {
		throw new Error(`lifecycle probe: telepipe not in fresh-sortie hand: ${JSON.stringify(harness?.hand)}`);
	}
	return harness;
}

/**
 * Telepipe-up vitals-persistence probe (ticket 287).
 *
 * @param {import('playwright').Page} page
 * @param {{ outDir: string, repoRoot: string, lifecycleScenario: string, screenshotName?: string }} opts
 * @returns {Promise<{ telepipePersistence: object, screenshot: string, spentHand: object[] }>}
 */
export async function probeTelepipePersistence(page, {
	outDir,
	repoRoot,
	lifecycleScenario,
	screenshotName = '08-telepipe-hub',
} = {}) {
	await deployFreshSortie(page, lifecycleScenario);

	// Spend run resources so the Telepipe-up has real vitals (and charges) to
	// carry across: this depletes magic stones below run-start and reduces at
	// least one hand card's charges.
	const preTelepipe = await depleteRunResources(page);

	// Telepipe-up back to the hub, then read vitals IN THE HUB.
	const hubHarness = await suspendViaTelepipe(page);
	const hubReturned = hubHarness?.phase === 'lobby'
		&& (hubHarness?.runStatus === 'suspended'
			|| !!hubHarness?.suspendedRunSummary
			|| hubHarness?.runId == null);
	if (!hubReturned) {
		throw new Error(`lifecycle probe: expected hub lobby after Telepipe-up: ${JSON.stringify(hubHarness)}`);
	}
	const postTelepipe = await probeHandAndMs(page);

	const vitalsPreserved = probesMatchVitalsPreserved(preTelepipe, postTelepipe);
	const shotAbs = await writeScreenshot(page, outDir, screenshotName);

	if (!vitalsPreserved) {
		throw new Error(
			'lifecycle probe: vitals NOT preserved across Telepipe-up (ticket 287 regressed): '
			+ `pre=${JSON.stringify({ hp: preTelepipe.hp, magicStones: preTelepipe.magicStones })} `
			+ `post=${JSON.stringify({ hp: postTelepipe.hp, magicStones: postTelepipe.magicStones })}`,
		);
	}

	return {
		telepipePersistence: {
			lifecycleScenario,
			vitalsPreserved,
			before: {
				hp: preTelepipe.hp,
				magicStones: preTelepipe.magicStones,
				charges: chargeView(preTelepipe.hand),
			},
			afterHub: {
				phase: postTelepipe.phase,
				hp: postTelepipe.hp,
				magicStones: postTelepipe.magicStones,
				charges: chargeView(postTelepipe.hand),
			},
		},
		screenshot: path.relative(repoRoot, shotAbs),
		spentHand: chargeView(preTelepipe.hand),
	};
}

/**
 * New-sortie card-charge reset probe (ticket 289).
 *
 * `endOfSortieHand` is the spent hand captured at the end of the previous sortie
 * (the telepipe probe hands this over). When it is omitted, the probe produces
 * its own spent hand first (deploy → deplete → Telepipe-up) so it stays runnable
 * on its own.
 *
 * @param {import('playwright').Page} page
 * @param {{ outDir: string, repoRoot: string, lifecycleScenario: string, endOfSortieHand?: object[]|null, screenshotName?: string }} opts
 * @returns {Promise<{ cardChargeReset: object, screenshot: string }>}
 */
export async function probeCardChargeReset(page, {
	outDir,
	repoRoot,
	lifecycleScenario,
	endOfSortieHand = null,
	screenshotName = '09-new-sortie-charges',
} = {}) {
	let endOfSortie = endOfSortieHand;
	if (!endOfSortie) {
		// Self-contained path: spend a sortie, then Telepipe-up so the next deploy
		// starts from a cleared hand.
		await deployFreshSortie(page, lifecycleScenario);
		const spent = await depleteRunResources(page);
		endOfSortie = chargeView(spent.hand);
		await suspendViaTelepipe(page);
	}

	if (!anyCardSpent(endOfSortie)) {
		throw new Error(
			`lifecycle probe: end-of-sortie hand shows no spent charges, so the reset is unverifiable: ${JSON.stringify(endOfSortie)}`,
		);
	}

	// Start a NEW sortie and read its fresh hand.
	await deployFreshSortie(page, lifecycleScenario);
	const newSortie = await probeHandAndMs(page);
	const newSortieCharges = chargeView(newSortie.hand);
	const allReset = allChargesFull(newSortie.hand);

	const shotAbs = await writeScreenshot(page, outDir, screenshotName);

	if (!allReset) {
		throw new Error(
			`lifecycle probe: new-sortie card charges NOT fully reset (ticket 289 regressed): ${JSON.stringify(newSortieCharges)}`,
		);
	}

	return {
		cardChargeReset: {
			lifecycleScenario,
			allReset,
			endOfSortie,
			newSortie: newSortieCharges,
		},
		screenshot: path.relative(repoRoot, shotAbs),
	};
}
