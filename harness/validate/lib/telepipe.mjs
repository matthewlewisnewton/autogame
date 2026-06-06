/**
 * Telepipe UP → hub → redeploy persistence validation (ticket 287 sub-ticket 05).
 * Asserts magic stones and HP survive telepipe-up and resume the same run (runId).
 */
import { createRequire } from 'module';
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
	return Number.isFinite(ms) && ms < startingMs;
}

// Passive regen ticks at 20Hz while playing; allow regen during the post-redeploy probe window.
const REDEPLOY_MS_REGEN_TICKS = 120;
const REDEPLOY_MS_TOLERANCE = MAGIC_STONES_REGEN_PER_TICK * REDEPLOY_MS_REGEN_TICKS;

function probesMatchPreservedMs(pre, post, startingMs = STARTING_MAGIC_STONES) {
	const preMs = pre?.magicStones;
	const postMs = post?.magicStones;
	if (!Number.isFinite(preMs) || !Number.isFinite(postMs)) return false;
	if (postMs >= startingMs) return false;
	return postMs >= preMs && postMs <= preMs + REDEPLOY_MS_TOLERANCE;
}

function probesMatchPreservedHp(pre, post) {
	const preHp = pre?.hp;
	const postHp = post?.hp;
	if (!Number.isFinite(preHp) || !Number.isFinite(postHp)) return true;
	return preHp === postHp;
}

function probesMatchSameRunId(pre, post) {
	return pre?.runId != null && post?.runId != null && pre.runId === post.runId;
}

function isSuspendedHarness(h) {
	return h?.runStatus === 'suspended'
		|| (h?.phase === 'lobby' && h?.runPaused === true)
		|| (h?.phase === 'lobby' && h?.suspendedRunSummary);
}

/**
 * @param {import('playwright').Page} page
 */
export async function probeHandAndMs(page) {
	const harness = await readHarness(page);
	return {
		magicStones: harness?.player?.magicStones ?? null,
		hp: harness?.player?.hp ?? null,
		msText: harness?.msText ?? null,
		hpText: harness?.hpText ?? null,
		hand: (harness?.hand || []).map((card) => (card ? {
			id: card.id,
			type: card.type,
			remainingCharges: card.remainingCharges,
			charges: card.charges,
		} : null)),
		phase: harness?.phase ?? null,
		runStatus: harness?.runStatus ?? null,
		extracted: harness?.extracted ?? null,
		runPaused: harness?.runPaused ?? null,
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

async function waitForSuspendedLobby(page, timeout = 30000) {
	await page.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		return h?.phase === 'lobby'
			&& (h?.runStatus === 'suspended' || h?.runPaused === true);
	}, { timeout }).catch(async () => {
		const harness = await readHarness(page);
		throw new Error(`Suspended lobby not reached: ${JSON.stringify(harness)}`);
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
		if (isSuspendedHarness(h)) return h;
		await page.keyboard.press('w');
		await page.waitForTimeout(500);
	}

	const h = await readHarness(page);
	throw new Error(`Run did not suspend via telepipe: phase=${h?.phase} runStatus=${h?.runStatus} `
		+ `runPaused=${h?.runPaused} extracted=${h?.extracted}`);
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
export async function runTelepipePersistenceStep({
	page,
	preset,
	outDirAbs,
	repoRoot,
	serverLogPath = null,
	gameProcess = null,
}) {
	await assertServerAlive(gameProcess, serverLogPath);
	await createLobby(page, 'Telepipe Persistence');
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

	const beforeScreenshotPath = await writeScreenshot(page, outDirAbs, '07-telepipe-before');

	await suspendViaTelepipe(page);
	await waitForSuspendedLobby(page);
	await assertServerAlive(gameProcess, serverLogPath);
	const suspendedHarness = await readHarness(page);
	if (!isSuspendedHarness(suspendedHarness)) {
		throw new Error(`Expected suspended lobby after telepipe UP: ${JSON.stringify(suspendedHarness)}`);
	}

	// Redeploy without abandon — resume the in-memory suspended run.
	await deployViaLaunchBooth(page);
	await assertServerAlive(gameProcess, serverLogPath);

	const postDeploy = await probeHandAndMs(page);
	const postHarness = await readHarness(page);
	if (postHarness?.runStatus === 'suspended' || postHarness?.runPaused === true) {
		throw new Error(`Redeploy still shows suspended run: ${JSON.stringify(postHarness)}`);
	}

	const msPreserved = probesMatchPreservedMs(preSuspend, postDeploy);
	if (!msPreserved) {
		throw new Error(
			`postDeploy.magicStones must match preSuspend (within regen tolerance): `
			+ `pre=${preSuspend.magicStones} post=${postDeploy.magicStones}`,
		);
	}

	const hpPreserved = probesMatchPreservedHp(preSuspend, postDeploy);
	if (!hpPreserved) {
		throw new Error(
			`postDeploy.hp must match preSuspend: pre=${preSuspend.hp} post=${postDeploy.hp}`,
		);
	}

	const sameRunIdConfirmed = probesMatchSameRunId(preSuspend, postDeploy);
	if (!sameRunIdConfirmed) {
		throw new Error(
			`postDeploy.runId must equal preSuspend.runId (resume, not fresh run): `
			+ `pre=${preSuspend.runId} post=${postDeploy.runId}`,
		);
	}

	const afterScreenshotPath = await writeScreenshot(page, outDirAbs, '08-telepipe-after');

	const telepipePreservesPlayerState = msPreserved
		&& hpPreserved
		&& sameRunIdConfirmed;

	return {
		telepipeScenario: preset.telepipeScenario,
		preSuspend,
		postDeploy,
		telepipePreservesPlayerState,
		sameRunIdConfirmed,
		msPreserved,
		hpPreserved,
		beforeScreenshot: path.relative(repoRoot, beforeScreenshotPath),
		afterScreenshot: path.relative(repoRoot, afterScreenshotPath),
	};
}

/** @deprecated ticket 281 — use runTelepipePersistenceStep */
export const runTelepipeResetStep = runTelepipePersistenceStep;
