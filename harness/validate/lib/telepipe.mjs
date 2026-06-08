/**
 * Telepipe UP → hub → fresh-redeploy validation helpers.
 * Ticket 281 originally expected MS reset; ticket 287 expects vitals preserved.
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { enableGodmode } from './combat.mjs';
import { assertGameProcessAlive } from './gameProcess.mjs';
import { readHarness } from './harnessState.mjs';
import { createLobby, waitForHubLobby } from './multiPlayer.mjs';
import { writeScreenshot } from './screenshot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { STARTING_MAGIC_STONES } = require(path.resolve(__dirname, '../../../game/shared/constants.json'));
const { PORTAL_PLACEMENT_GRACE_MS, MAGIC_STONES_REGEN_PER_TICK } = require(path.resolve(__dirname, '../../../game/server/config.js'));

export { STARTING_MAGIC_STONES, PORTAL_PLACEMENT_GRACE_MS };

function usable(card) {
	return card && (card.remainingCharges == null || card.remainingCharges > 0);
}

function probesMatchDepletion(probe, startingMs = STARTING_MAGIC_STONES) {
	const ms = probe?.magicStones;
	const msDepleted = Number.isFinite(ms) && ms < startingMs;
	const chargeDepleted = (probe?.hand || []).some(
		(card) => card && card.charges != null && card.remainingCharges < card.charges,
	);
	return msDepleted && chargeDepleted;
}

// Passive regen ticks at 20Hz once playing; probe may run a few ticks after waitForPlaying.
const FRESH_DEPLOY_MS_REGEN_TICKS = 10;
const FRESH_DEPLOY_MS_TOLERANCE = MAGIC_STONES_REGEN_PER_TICK * FRESH_DEPLOY_MS_REGEN_TICKS;
const VITALS_MS_REGEN_TICKS = FRESH_DEPLOY_MS_REGEN_TICKS;
const VITALS_MS_TOLERANCE = FRESH_DEPLOY_MS_TOLERANCE;

export function probesMatchVitalsPreserved(pre, post, msTolerance = VITALS_MS_TOLERANCE) {
	const hpMatch = Number.isFinite(pre?.hp) && Number.isFinite(post?.hp) && pre.hp === post.hp;
	const ms = pre?.magicStones;
	const postMs = post?.magicStones;
	const msMatch = Number.isFinite(ms) && Number.isFinite(postMs)
		&& postMs >= ms
		&& postMs <= ms + msTolerance;
	return hpMatch && msMatch;
}

export function probesMatchFreshDeploy(probe, startingMs = STARTING_MAGIC_STONES) {
	const ms = probe?.magicStones;
	const msReset = Number.isFinite(ms)
		&& ms >= startingMs
		&& ms <= startingMs + FRESH_DEPLOY_MS_TOLERANCE;
	const occupied = (probe?.hand || []).filter(Boolean);
	const chargesFull = occupied.length > 0
		&& occupied.every((card) => card.remainingCharges === card.charges);
	return msReset && chargesFull;
}

function probesMatchFreshRunId(pre, post) {
	return pre?.runId != null && post?.runId != null && pre.runId !== post.runId;
}

/**
 * @param {string | null | undefined} logPath
 * @param {number} fromByteOffset
 * @param {string} substr
 * @returns {boolean} true when substr appears in the log slice after fromByteOffset
 */
export function readServerLogForbidden(logPath, fromByteOffset, substr) {
	if (!logPath || !substr || !fs.existsSync(logPath)) return false;
	const stat = fs.statSync(logPath);
	const start = Math.min(Math.max(0, fromByteOffset), stat.size);
	const slice = fs.readFileSync(logPath).subarray(start);
	return slice.toString('utf8').includes(substr);
}

/**
 * @param {import('playwright').Page} page
 */
export async function probeHandAndMs(page) {
	const harness = await readHarness(page);
	return {
		hp: harness?.player?.hp ?? null,
		magicStones: harness?.player?.magicStones ?? null,
		msText: harness?.msText ?? null,
		hand: (harness?.hand || []).map((card) => (card ? {
			id: card.id,
			type: card.type,
			remainingCharges: card.remainingCharges,
			charges: card.charges,
		} : null)),
		phase: harness?.phase ?? null,
		runStatus: harness?.runStatus ?? null,
		extracted: harness?.extracted ?? null,
		suspendedRunSummary: harness?.suspendedRunSummary ?? null,
		layoutSeed: harness?.layout?.seed ?? null,
		runId: harness?.runId ?? null,
	};
}

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

async function waitForPlaying(page, timeout = 30000) {
	await page.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		return h?.phase === 'playing'
			&& h.player
			&& h.player.x != null
			&& h.cardHandVisible
			&& Array.isArray(h.enemyHp)
			&& h.layout
			&& h.layout.seed != null;
	}, { timeout }).catch(async () => {
		const harness = await readHarness(page);
		throw new Error(`Playing phase not reached: ${JSON.stringify(harness)}`);
	});
}

/**
 * @param {import('playwright').Page} page
 * @param {string} [scenario]
 */
export async function deployViaLaunchBooth(page, scenario) {
	if (scenario) {
		await requestScenario(page, scenario);
	}
	const launched = await page.evaluate(() => {
		if (typeof window.__launchReadyUpForTest !== 'function') {
			return { ok: false, reason: '__launchReadyUpForTest missing' };
		}
		window.__launchReadyUpForTest();
		return { ok: true };
	});
	if (!launched?.ok) {
		const harness = await readHarness(page);
		throw new Error(`Launch Bay ready-up failed: ${JSON.stringify(launched)} harness=${JSON.stringify(harness)}`);
	}
	await waitForPlaying(page);
}

function chooseDepletionAttack(harness) {
	if (!harness || !Array.isArray(harness.hand)) return null;
	const weaponSlot = harness.hand.findIndex(
		(card) => usable(card) && card.type === 'weapon' && card.id !== 'telepipe',
	);
	if (weaponSlot >= 0) return { mode: 'weapon', slot: weaponSlot };
	const spellSlot = harness.hand.findIndex(
		(card) => usable(card)
			&& card.id !== 'telepipe'
			&& (card.type === 'spell' || card.type === 'creature'),
	);
	if (spellSlot >= 0) return { mode: 'spell', slot: spellSlot };
	return null;
}

async function lockOntoNearestEnemy(page) {
	const harness = await readHarness(page);
	const player = harness?.player;
	const enemies = (harness?.enemyHp || []).filter((e) => e.hp > 0 && e.x != null && e.z != null);
	if (!player || enemies.length === 0) return false;

	let nearest = null;
	let bestDist = Infinity;
	for (const enemy of enemies) {
		const dist = Math.hypot(enemy.x - player.x, enemy.z - player.z);
		if (dist < bestDist) {
			bestDist = dist;
			nearest = enemy;
		}
	}
	if (!nearest) return false;

	if (bestDist > 5) {
		const dx = nearest.x - player.x;
		const dz = nearest.z - player.z;
		const keys = [];
		if (Math.abs(dx) >= Math.abs(dz)) {
			if (dx > 0.5) keys.push('d');
			else if (dx < -0.5) keys.push('a');
		} else if (dz > 0.5) keys.push('s');
		else if (dz < -0.5) keys.push('w');
		if (keys.length === 0) keys.push('w');
		for (let i = 0; i < 3; i += 1) {
			for (const key of keys) {
				await page.keyboard.down(key);
				await page.waitForTimeout(450);
				await page.keyboard.up(key);
			}
		}
	}

	await page.keyboard.press('z');
	await page.waitForTimeout(300);
	const lock = await page.evaluate(async () => {
		const mod = await import('/lockOn.js');
		return { active: mod.isLockOnActive(), targetId: mod.getLockedEnemyId() };
	});
	return lock.active;
}

/**
 * Deplete MS below run-start and reduce at least one occupied hand card's charges via combat.
 * @param {import('playwright').Page} page
 */
export async function depleteRunResources(page) {
	await focusCanvas(page);
	await enableGodmode(page);

	const deadline = Date.now() + 120000;
	while (Date.now() < deadline) {
		const probe = await probeHandAndMs(page);
		if (probesMatchDepletion(probe)) {
			return probe;
		}

		const harness = await readHarness(page);
		const attack = chooseDepletionAttack(harness);
		if (!attack) {
			throw new Error(`No usable card to deplete resources: ${JSON.stringify(harness?.hand)}`);
		}

		const attackKey = String(attack.slot + 1);
		if (attack.mode === 'weapon') {
			await lockOntoNearestEnemy(page);
			for (let swing = 0; swing < 4; swing += 1) {
				await page.keyboard.press(attackKey);
				await page.waitForTimeout(900);
				const mid = await probeHandAndMs(page);
				if (probesMatchDepletion(mid)) return mid;
			}
		} else {
			await page.keyboard.press(attackKey);
			await page.waitForTimeout(3500);
		}
	}

	const finalProbe = await probeHandAndMs(page);
	throw new Error(`Failed to deplete run resources: ${JSON.stringify(finalProbe)}`);
}

/**
 * Place telepipe, wait past portal grace, solo-extract until run suspends to lobby.
 * @param {import('playwright').Page} page
 */
export async function suspendViaTelepipe(page) {
	await focusCanvas(page);
	const harness = await readHarness(page);
	const telepipeSlot = (harness?.hand || []).findIndex((card) => card?.id === 'telepipe');
	if (telepipeSlot < 0) {
		throw new Error(`Telepipe not in hand before suspend: ${JSON.stringify(harness?.hand)}`);
	}

	const slotKey = String(telepipeSlot + 1);
	await page.keyboard.press(slotKey);
	await page.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		return !!h?.telepipe;
	}, { timeout: 10000 }).catch(async () => {
		const state = await readHarness(page);
		throw new Error(`Telepipe portal not placed: ${JSON.stringify(state)}`);
	});

	await page.waitForTimeout(PORTAL_PLACEMENT_GRACE_MS + 500);

	const deadline = Date.now() + 30000;
	while (Date.now() < deadline) {
		const h = await readHarness(page);
		const hubReturned = h.phase === 'lobby'
			&& (h.runStatus === 'suspended'
				|| !!h.suspendedRunSummary
				|| h.extracted === true
				|| h.runId == null);
		if (hubReturned) return h;
		await page.keyboard.press('w');
		await page.waitForTimeout(500);
	}

	const h = await readHarness(page);
	throw new Error(`Run did not suspend via telepipe: phase=${h?.phase} runStatus=${h?.runStatus} `
		+ `extracted=${h?.extracted} suspendedRunSummary=${JSON.stringify(h?.suspendedRunSummary)}`);
}

/**
 * Abandon the suspended checkpoint via #abandon-run-btn (not resume).
 * @param {import('playwright').Page} page
 */
export async function abandonSuspendedRun(page) {
	await page.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		return h?.abandonRunBtnUsable === true
			|| typeof window.__abandonSuspendedRunForTest === 'function';
	}, { timeout: 15000 }).catch(async () => {
		const harness = await readHarness(page);
		throw new Error(`Abandon not available: ${JSON.stringify(harness)}`);
	});

	const result = await page.evaluate(() => window.__abandonSuspendedRunForTest?.());
	if (!result?.ok) {
		await page.click('#abandon-run-btn', { timeout: 5000 });
	}

	await page.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		return h?.phase === 'lobby'
			&& !h?.suspendedRunSummary
			&& h?.runStatus !== 'suspended'
			&& h?.abandonRunBtnUsable !== true
			&& h?.resumeBtnUsable !== true;
	}, { timeout: 15000 }).catch(async () => {
		const harness = await readHarness(page);
		throw new Error(`Suspended run not cleared after abandon: ${JSON.stringify(harness)}`);
	});
}

async function assertServerAlive(gameProcess, serverLogPath) {
	if (!gameProcess) return;
	await assertGameProcessAlive({
		serverUrl: gameProcess.serverUrl,
		serverChild: gameProcess.serverChild,
		serverLogPath: serverLogPath ?? gameProcess.serverLogPath ?? null,
	});
}

/**
 * @param {import('playwright').Page} page
 * @param {{ preset: object, outDirAbs: string, repoRoot: string, serverLogPath?: string | null, gameProcess?: object | null }} opts
 */
export async function runTelepipeResetStep({
	page,
	preset,
	outDirAbs,
	repoRoot,
	serverLogPath = null,
	gameProcess = null,
}) {
	await assertServerAlive(gameProcess, serverLogPath);
	await createLobby(page, 'Telepipe Reset');
	await waitForHubLobby(page);
	await requestScenario(page, preset.telepipeScenario);
	await deployViaLaunchBooth(page);

	const deployedHarness = await readHarness(page);
	const telepipeInHand = (deployedHarness?.hand || []).some((card) => card?.id === 'telepipe');
	if (!telepipeInHand) {
		throw new Error(`Expected telepipe in hand after deploy: ${JSON.stringify(deployedHarness?.hand)}`);
	}

	const preSuspend = await depleteRunResources(page);
	if (!probesMatchDepletion(preSuspend)) {
		throw new Error(`preSuspend probes failed depletion criteria: ${JSON.stringify(preSuspend)}`);
	}
	await assertServerAlive(gameProcess, serverLogPath);

	const beforeShotName = preset.telepipeBeforeScreenshot ?? '07-telepipe-before';
	const afterShotName = preset.telepipeAfterScreenshot ?? '08-telepipe-after';
	const beforeScreenshotPath = await writeScreenshot(page, outDirAbs, beforeShotName);

	const logSliceStart = serverLogPath && fs.existsSync(serverLogPath)
		? fs.statSync(serverLogPath).size
		: 0;

	await suspendViaTelepipe(page);
	await assertServerAlive(gameProcess, serverLogPath);
	const hubHarness = await readHarness(page);
	const hubReturned = hubHarness?.phase === 'lobby'
		&& (hubHarness?.runStatus === 'suspended'
			|| !!hubHarness?.suspendedRunSummary
			|| hubHarness?.runId == null);
	if (!hubReturned) {
		throw new Error(`Expected hub lobby after telepipe UP: ${JSON.stringify(hubHarness)}`);
	}

	await deployViaLaunchBooth(page, preset.telepipeScenario);
	await assertServerAlive(gameProcess, serverLogPath);

	const postDeploy = await probeHandAndMs(page);
	const postHarness = await readHarness(page);
	if (postHarness?.suspendedRunSummary || postHarness?.runStatus === 'suspended') {
		throw new Error(`Fresh deploy still shows suspended checkpoint: ${JSON.stringify(postHarness)}`);
	}
	if (!probesMatchVitalsPreserved(preSuspend, postDeploy)) {
		throw new Error(`postDeploy probes failed vitals-preservation criteria: pre=${JSON.stringify({ hp: preSuspend.hp, magicStones: preSuspend.magicStones })} post=${JSON.stringify({ hp: postDeploy.hp, magicStones: postDeploy.magicStones })}`);
	}

	const freshRunIdConfirmed = probesMatchFreshRunId(preSuspend, postDeploy);
	if (!freshRunIdConfirmed) {
		throw new Error(
			`postDeploy.runId must differ from preSuspend (fresh createRunState, not checkpoint restore): `
			+ `pre=${preSuspend.runId} post=${postDeploy.runId}`,
		);
	}

	const afterScreenshotPath = await writeScreenshot(page, outDirAbs, afterShotName);
	const checkpointRestoredInLog = readServerLogForbidden(
		serverLogPath,
		logSliceStart,
		'[run] checkpoint restored',
	);
	if (checkpointRestoredInLog) {
		throw new Error(
			'telepipe-reset slice contains forbidden "[run] checkpoint restored" — resume path ran instead of abandon+fresh deploy',
		);
	}

	const cardChargesResetOnFreshSortie = probesMatchFreshDeploy(postDeploy);
	const telepipeVitalsPreserved = probesMatchDepletion(preSuspend)
		&& probesMatchVitalsPreserved(preSuspend, postDeploy)
		&& freshRunIdConfirmed
		&& !checkpointRestoredInLog;

	return {
		telepipeScenario: preset.telepipeScenario,
		preSuspend,
		postDeploy,
		telepipeVitalsPreserved,
		cardChargesResetOnFreshSortie,
		telepipeUpReset: false,
		freshRunIdConfirmed,
		checkpointRestoredInLog,
		beforeScreenshot: path.relative(repoRoot, beforeScreenshotPath),
		afterScreenshot: path.relative(repoRoot, afterScreenshotPath),
	};
}
