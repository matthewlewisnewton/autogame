/**
 * Ice preset slippery-floor momentum probe helpers (ticket 292).
 */
import path from 'path';
import { readHarness } from './harnessState.mjs';
import { writeScreenshot } from './screenshot.mjs';
import { enableGodmode } from './combat.mjs';

// Must stay in sync with game/server/config.js TICK_RATE (20 Hz).
const SERVER_TICK_MS = 50;
const MIN_HOLD_MS = 400;
const MIN_DRIFT_TICKS = 6;
const MOVEMENT_KEYS = ['w', 'a', 's', 'd'];

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

async function releaseAllKeys(page) {
	for (const key of MOVEMENT_KEYS) {
		await page.keyboard.up(key);
	}
}

async function readPlayerPos(page) {
	const harness = await readHarness(page);
	const player = harness?.player;
	if (!player || player.x == null || player.z == null) {
		throw new Error(`Missing player position: ${JSON.stringify(harness?.player)}`);
	}
	return { x: player.x, z: player.z };
}

function positionDelta(a, b) {
	return Math.hypot(b.x - a.x, b.z - a.z);
}

function speedBetween(a, b, dtMs) {
	if (dtMs <= 0) return 0;
	return positionDelta(a, b) / (dtMs / 1000);
}

function perpendicularKey(forwardKey) {
	const map = { w: 'd', s: 'a', a: 'w', d: 's' };
	return map[forwardKey] || 'd';
}

function detectDirectionChangeWhileSliding(releasePos, midPos, afterPos) {
	const headingBefore = { dx: midPos.x - releasePos.x, dz: midPos.z - releasePos.z };
	const headingAfter = { dx: afterPos.x - midPos.x, dz: afterPos.z - midPos.z };
	const speedBefore = Math.hypot(headingBefore.dx, headingBefore.dz);
	const speedAfter = Math.hypot(headingAfter.dx, headingAfter.dz);
	if (speedBefore < 0.02) return false;

	const dot = headingBefore.dx * headingAfter.dx + headingBefore.dz * headingAfter.dz;
	if (dot < 0 && speedAfter > 0.01) return true;

	const norm = speedBefore || 1;
	const fwdX = headingBefore.dx / norm;
	const fwdZ = headingBefore.dz / norm;
	const lateralBefore = Math.abs(headingBefore.dx * fwdZ - headingBefore.dz * fwdX);
	const lateralAfter = Math.abs(headingAfter.dx * fwdZ - headingAfter.dz * fwdX);
	return lateralAfter > lateralBefore + 0.01 && speedAfter > 0.01;
}

async function sampleFloorSurface(page, x, z) {
	return page.evaluate(async ({ sampleX, sampleZ }) => {
		if (typeof window.__sampleFloorSurfaceForHarness !== 'function') {
			return null;
		}
		const result = window.__sampleFloorSurfaceForHarness(sampleX, sampleZ);
		return result instanceof Promise ? await result : result;
	}, { sampleX: x, sampleZ: z });
}

/**
 * @param {import('playwright').Page} page
 * @param {{ preset: object, outDirAbs: string, repoRoot: string }} opts
 */
export async function runSlipperyFloorStep({ page, preset, outDirAbs, repoRoot }) {
	const scenario = preset.slipperyFloorScenario;
	if (!scenario) {
		return { ok: false, reason: 'slipperyFloorScenario not configured' };
	}

	await requestScenario(page, scenario);
	await enableGodmode(page);
	await focusCanvas(page);
	await releaseAllKeys(page);

	const forwardKey = 'w';
	const accelStart = await readPlayerPos(page);
	await page.keyboard.down(forwardKey);
	await page.waitForTimeout(250);
	const accelMid = await readPlayerPos(page);
	await page.waitForTimeout(MIN_HOLD_MS - 250 + 50);
	const accelEnd = await readPlayerPos(page);
	await page.keyboard.up(forwardKey);

	const speedWhileHolding = Math.max(
		speedBetween(accelStart, accelMid, 250),
		speedBetween(accelMid, accelEnd, MIN_HOLD_MS - 250 + 50),
	);

	await releaseAllKeys(page);
	const releasePos = await readPlayerPos(page);

	for (let i = 0; i < MIN_DRIFT_TICKS; i += 1) {
		await page.waitForTimeout(SERVER_TICK_MS);
	}
	const driftEnd = await readPlayerPos(page);
	const driftAfterRelease = positionDelta(releasePos, driftEnd);

	const beforePerp = driftEnd;
	const perpKey = perpendicularKey(forwardKey);
	await page.keyboard.down(perpKey);
	await page.waitForTimeout(MIN_HOLD_MS);
	await page.keyboard.up(perpKey);
	await releaseAllKeys(page);
	const afterPerp = await readPlayerPos(page);
	const directionChangeWhileSliding = detectDirectionChangeWhileSliding(releasePos, beforePerp, afterPerp);

	const transitionScenario = preset.surfaceTransitionScenario;
	let enteredSlipperyBand = false;
	if (transitionScenario) {
		await requestScenario(page, transitionScenario);
		await focusCanvas(page);
		await releaseAllKeys(page);

		for (let i = 0; i < 80; i += 1) {
			await page.waitForTimeout(SERVER_TICK_MS);
			const pos = await readPlayerPos(page);
			const surface = await sampleFloorSurface(page, pos.x, pos.z);
			if (surface === 'slippery') {
				enteredSlipperyBand = true;
				break;
			}
		}
	}

	const screenshotPath = await writeScreenshot(page, outDirAbs, '03-slippery-floor');
	const ok = speedWhileHolding > 0
		&& driftAfterRelease > 0
		&& directionChangeWhileSliding === true
		&& enteredSlipperyBand === true;

	return {
		ok,
		slipperyFloorScenario: scenario,
		surfaceTransitionScenario: transitionScenario ?? null,
		speedWhileHolding,
		driftAfterRelease,
		directionChangeWhileSliding,
		enteredSlipperyBand,
		screenshot: path.relative(repoRoot, screenshotPath),
	};
}
