/**
 * Wind-up card input-lock + charge-telegraph probe (ticket 308).
 *
 * Drives a wind-up card-grant debug scenario against the LIVE spire run and
 * reads window.__AUTOGAME_HARNESS_STATE__().windUp to assert:
 *   1. The granted wind-up card carries a positive windUpMs and its hand slot
 *      renders the wind-up charge telegraph (the `.card-windup-hint` element),
 *      so the diff shows the telegraph exists, not just the timing.
 *   2. Playing the card commits the player into the wind-up window: hand input
 *      locks (isHandInputLocked() true) and a second card play mid-wind-up is
 *      rejected — proving the input-lock guard is intact.
 *   3. Input unlocks once the wind-up window elapses.
 * The run fails if input is never locked (the input-lock guard regressed).
 *
 * Read-only instrumentation: it only requests a debug scenario, presses hand
 * slots, and reads harness state — it never mutates game state directly, and
 * the isHandInputLocked() / wind-up telegraph logic itself is unchanged.
 */
import path from 'path';
import { readHarness } from './harnessState.mjs';
import { writeScreenshot } from './screenshot.mjs';

const POLL_TIMEOUT_MS = 8000;
const POLL_INTERVAL_MS = 50;

async function requestScenario(page, scenario) {
	const result = await page.evaluate((name) => {
		if (typeof window.__requestDebugScenarioForTest !== 'function') {
			return { ok: false, reason: '__requestDebugScenarioForTest missing' };
		}
		return window.__requestDebugScenarioForTest(name);
	}, scenario);
	if (!result?.ok) {
		throw new Error(`windUp probe: debug scenario ${scenario} failed: ${result?.reason || 'unknown'}`);
	}
	return result;
}

async function focusCanvas(page) {
	await page.evaluate(() => {
		document.querySelector('canvas:not(.cosmetic-preview-canvas)')?.focus();
	});
}

/** Poll the live windUp state until `predicate(windUp)` holds, then return it. */
async function waitForWindUp(page, predicate, label) {
	const deadline = Date.now() + POLL_TIMEOUT_MS;
	let last = null;
	while (Date.now() < deadline) {
		const harness = await readHarness(page);
		const windUp = harness?.windUp ?? null;
		if (windUp) {
			last = windUp;
			if (predicate(windUp)) return windUp;
		}
		await page.waitForTimeout(POLL_INTERVAL_MS);
	}
	throw new Error(`windUp probe: ${label} not observed: ${JSON.stringify(last)}`);
}

/**
 * Run the wind-up input-lock + charge-telegraph probe during the active boss
 * phase.
 *
 * @param {import('playwright').Page} page
 * @param {{ outDir: string, repoRoot: string, windUpScenario: string, screenshotName?: string }} opts
 * @returns {Promise<{ windUp: object, screenshot: string }>}
 */
export async function probeWindUp(page, {
	outDir,
	repoRoot,
	windUpScenario,
	screenshotName = '05c-windup',
} = {}) {
	await focusCanvas(page);

	// Grant the wind-up card into the current spire run's hand.
	const grant = await requestScenario(page, windUpScenario);
	const cardId = grant.cardId ?? null;
	const cardSlot = Number.isInteger(grant.cardSlot) ? grant.cardSlot : null;

	// Baseline: the granted card carries a positive windUpMs and its slot already
	// shows the wind-up charge telegraph BEFORE the card is committed.
	const baseline = await waitForWindUp(
		page,
		(w) => w.telegraphSlot != null && w.telegraphPresent && Number(w.windUpMs) > 0,
		'wind-up card granted with charge telegraph present',
	);
	const slotIndex = cardSlot ?? baseline.telegraphSlot;
	if (!(slotIndex >= 0)) {
		throw new Error(`windUp probe: could not resolve wind-up card slot: grant=${JSON.stringify(grant)} baseline=${JSON.stringify(baseline)}`);
	}
	if (baseline.handInputLocked) {
		throw new Error(`windUp probe: hand input already locked before playing the card: ${JSON.stringify(baseline)}`);
	}
	const windUpMs = Number(baseline.windUpMs);

	// Commit the wind-up card (slot keys are 1-indexed) to enter the lock window.
	await focusCanvas(page);
	await page.keyboard.press(String(slotIndex + 1));

	// The play must lock hand input and keep the charge telegraph presented.
	const locked = await waitForWindUp(
		page,
		(w) => w.handInputLocked === true && w.cardUseState === 'windup',
		'hand input locked during wind-up commitment',
	);
	if (!locked.telegraphPresent) {
		throw new Error(`windUp probe: wind-up telegraph not presented during the lock window: ${JSON.stringify(locked)}`);
	}

	// Capture the wind-up window before it elapses.
	const shotAbs = await writeScreenshot(page, outDir, screenshotName);

	// A second card play mid-wind-up must be rejected (the input-lock guard).
	// Press another filled slot (or the same slot again) and confirm the player
	// is still committed to the original wind-up card — nothing new started.
	const secondHarness = await readHarness(page);
	const otherSlot = (secondHarness?.hand || []).findIndex(
		(c, i) => c && i !== slotIndex,
	);
	const secondPressSlot = otherSlot >= 0 ? otherSlot : slotIndex;
	await focusCanvas(page);
	await page.keyboard.press(String(secondPressSlot + 1));
	const afterSecond = await readHarness(page);
	const stillLocked = afterSecond?.windUp ?? null;
	const secondPlayRejected = stillLocked?.handInputLocked === true
		&& stillLocked?.cardUseState === 'windup'
		&& stillLocked?.activeCardId === locked.activeCardId;
	if (!secondPlayRejected) {
		throw new Error(`windUp probe: second card play was NOT rejected mid-wind-up (input-lock guard regressed): pressed slot ${secondPressSlot}, state=${JSON.stringify(stillLocked)}`);
	}

	// Input must unlock once the wind-up window elapses.
	const unlocked = await waitForWindUp(
		page,
		(w) => w.handInputLocked === false && w.cardUseState !== 'windup',
		'hand input unlocked after the wind-up window',
	);

	const windUp = {
		cardId: cardId ?? locked.activeCardId ?? null,
		slotIndex,
		windUpMs,
		telegraphPresent: locked.telegraphPresent === true,
		telegraphSlot: locked.telegraphSlot ?? baseline.telegraphSlot ?? null,
		lockedDuringWindUp: locked.handInputLocked === true,
		secondPlayRejected,
		secondPressSlot,
		unlockedAfterWindUp: unlocked.handInputLocked === false,
		before: {
			handInputLocked: baseline.handInputLocked === true,
			telegraphPresent: baseline.telegraphPresent === true,
			cardUseState: baseline.cardUseState ?? null,
		},
		during: {
			handInputLocked: locked.handInputLocked === true,
			telegraphPresent: locked.telegraphPresent === true,
			cardUseState: locked.cardUseState ?? null,
			cardWindupUntil: locked.cardWindupUntil ?? null,
		},
		after: {
			handInputLocked: unlocked.handInputLocked === true,
			cardUseState: unlocked.cardUseState ?? null,
		},
	};

	// Hard invariants: input must have locked during the window and unlocked after.
	if (!windUp.lockedDuringWindUp) {
		throw new Error(`windUp probe: hand input was never locked during wind-up: ${JSON.stringify(windUp)}`);
	}
	if (!windUp.unlockedAfterWindUp) {
		throw new Error(`windUp probe: hand input did not unlock after the wind-up window: ${JSON.stringify(windUp)}`);
	}

	return {
		windUp,
		screenshot: path.relative(repoRoot, shotAbs),
	};
}
