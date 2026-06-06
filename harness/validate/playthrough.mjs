#!/usr/bin/env node
/**
 * Headless Playwright playthrough driver for autogame validation.
 *
 *   node harness/validate/playthrough.mjs [--preset rooms] [--out validation/rooms/] [--steps auth|hub|deploy|boss-encounter|full]
 *
 * Steps: auth (register/login), hub | deploy (ship hub + character save + tier-2 deploy),
 * boss-encounter (godmode + defeat adds + dormant/active boss screenshots), full (stubbed for sub-ticket 07).
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerUser, injectToken, isSocketConnected } from './lib/auth.mjs';
import {
	enableGodmode,
	defeatAdds,
	activateEncounter,
	assertDormantBoss,
} from './lib/combat.mjs';
import { wireConsoleLog, writeConsoleLog } from './lib/consoleLog.mjs';
import { startGame, stopGame } from './lib/gameProcess.mjs';
import { readHarness } from './lib/harnessState.mjs';
import { writeScreenshot } from './lib/screenshot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const PRESET_MODULES = {
	rooms: () => import('./presets/rooms.mjs'),
};

const STUB_STEPS = new Set(['full']);
const HUB_STEPS = new Set(['hub', 'deploy']);
const BOSS_ENCOUNTER_STEPS = new Set(['boss-encounter']);
const ADD_TYPES = new Set(['grunt', 'skirmisher']);

function parseArgs(argv) {
	const opts = {
		preset: 'rooms',
		out: 'validation/rooms/',
		steps: 'auth',
	};
	for (let i = 2; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === '--preset' && argv[i + 1]) {
			opts.preset = argv[++i];
		} else if (arg === '--out' && argv[i + 1]) {
			opts.out = argv[++i];
		} else if (arg === '--steps' && argv[i + 1]) {
			opts.steps = argv[++i];
		} else if (arg === '--help' || arg === '-h') {
			console.log('usage: node harness/validate/playthrough.mjs [--preset <name>] [--out <dir>] [--steps auth|hub|deploy|boss-encounter|full]');
			process.exit(0);
		} else {
			throw new Error(`Unknown argument: ${arg}`);
		}
	}
	return opts;
}

async function loadPreset(name) {
	const loader = PRESET_MODULES[name];
	if (!loader) throw new Error(`Unknown preset "${name}" — available: ${Object.keys(PRESET_MODULES).join(', ')}`);
	const mod = await loader();
	return mod.default ?? mod;
}

async function waitForLobbyBrowser(page) {
	await page.waitForFunction(() => {
		const el = document.querySelector('#lobby-browser');
		return el && !el.classList.contains('hidden')
			&& window.getComputedStyle(el).display !== 'none';
	}, { timeout: 15000 }).catch(async () => {
		const state = await page.evaluate(() => ({
			lobbyBrowserHidden: document.querySelector('#lobby-browser')?.classList.contains('hidden'),
			authHidden: document.querySelector('#auth-overlay')?.classList.contains('hidden'),
			statusText: document.querySelector('#status')?.innerText,
		}));
		throw new Error(`#lobby-browser not visible: ${JSON.stringify(state)}`);
	});
}

async function failWithHarness(page, message) {
	const harness = await readHarness(page);
	throw new Error(`${message}: ${JSON.stringify(harness)}`);
}

function liveAdds(harness, bossType) {
	return (harness?.enemyHp || []).filter(
		(e) => e.type !== bossType && e.hp > 0 && ADD_TYPES.has(e.type),
	);
}

async function requestScenario(page, scenario) {
	const result = await page.evaluate((name) => {
		if (typeof window.__requestDebugScenarioForTest !== 'function') {
			return { ok: false, reason: '__requestDebugScenarioForTest missing' };
		}
		return window.__requestDebugScenarioForTest(name);
	}, scenario);
	if (!result?.ok) {
		await failWithHarness(page, `Debug scenario ${scenario} failed: ${result?.reason || 'unknown'}`);
	}
	return result;
}

function buildEncounterProbe(harness, bossType) {
	const boss = (harness?.enemyHp || []).find((e) => e.type === bossType && e.hp > 0) || null;
	return {
		encounterPhase: harness?.encounter?.phase ?? null,
		encounterLocked: harness?.encounter?.locked ?? null,
		bossEnemyId: harness?.encounter?.bossEnemyId ?? null,
		bossHp: boss?.hp ?? null,
		liveAddCount: liveAdds(harness, bossType).length,
	};
}

async function runAuthStep({ page, serverUrl, clientUrl, outDirAbs }) {
	const username = `playthrough-${Date.now()}`;
	const password = 'harness-test-password';
	const token = await registerUser(serverUrl, username, password);
	await injectToken(page, token, clientUrl);
	await waitForLobbyBrowser(page);

	const harness = await readHarness(page);
	const connected = await isSocketConnected(page);
	const screenshotPath = await writeScreenshot(page, outDirAbs, '01-lobby-browser');

	return {
		username,
		connected,
		lobbyBrowserVisible: true,
		harnessPhase: harness?.phase ?? null,
		screenshot: path.relative(REPO_ROOT, screenshotPath),
	};
}

async function runHubStep({ page, preset, outDirAbs }) {
	await page.evaluate(() => {
		const name = document.getElementById('create-lobby-name');
		if (name) name.value = 'Rooms Validation';
		document.getElementById('create-lobby-btn')?.click();
	});

	await page.waitForFunction(() => {
		const lobby = document.getElementById('lobby');
		return lobby && !lobby.classList.contains('hidden');
	}, { timeout: 15000 }).catch(async () => {
		await failWithHarness(page, '#lobby not visible after create channel');
	});

	await page.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		return h
			&& h.phase === 'lobby'
			&& h.hasCanvas === true
			&& h.layout?.profile === 'hub';
	}, { timeout: 20000 }).catch(async () => {
		await failWithHarness(page, 'Ship hub lobby not ready');
	});

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
		await failWithHarness(page, 'Character booth did not open');
	});

	await page.click('#character-booth-save-btn');

	await page.waitForFunction(() => {
		const overlay = document.getElementById('character-booth-overlay');
		const err = document.getElementById('character-booth-cosmetic-error');
		const errText = err && !err.hidden ? err.textContent.trim() : '';
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		return overlay?.classList.contains('hidden')
			&& h?.characterBoothOpen === false
			&& !errText;
	}, { timeout: 15000 }).catch(async () => {
		await failWithHarness(page, 'Character booth save did not close cleanly');
	});

	const hubScreenshot = await writeScreenshot(page, outDirAbs, '01-hub');

	await requestScenario(page, preset.deployScenario);

	await page.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		return h
			&& h.phase === 'playing'
			&& h.cardHandVisible === true
			&& h.objective?.type === 'stage_boss';
	}, { timeout: 25000 }).catch(async () => {
		await failWithHarness(page, 'Training Caverns Tier II run did not start');
	});

	const playingHarness = await readHarness(page);
	const hasOverseer = Array.isArray(playingHarness?.enemyHp)
		&& playingHarness.enemyHp.some((enemy) => enemy.type === preset.bossType);
	if (!hasOverseer) {
		await failWithHarness(page, `Expected ${preset.bossType} in enemyHp`);
	}
	if (playingHarness?.encounter?.phase !== 'dormant') {
		await failWithHarness(page, 'Expected dormant stage-boss encounter after deploy');
	}

	const entryScreenshot = await writeScreenshot(page, outDirAbs, '02-level-entry');

	return {
		hubScreenshot: path.relative(REPO_ROOT, hubScreenshot),
		entryScreenshot: path.relative(REPO_ROOT, entryScreenshot),
		deployScenario: preset.deployScenario,
		deployOk: true,
		objectiveType: playingHarness?.objective?.type ?? null,
		encounterPhase: playingHarness?.encounter?.phase ?? null,
		bossTypes: (playingHarness?.enemyHp || []).map((e) => e.type),
	};
}

async function runBossEncounterStep({ page, preset, outDirAbs }) {
	const { bossType, nearAddsScenario, bossApproachScenario, encounterTriggerRadius } = preset;

	await enableGodmode(page);
	await requestScenario(page, nearAddsScenario);

	const preCombatHarness = await readHarness(page);
	if (liveAdds(preCombatHarness, bossType).length === 0) {
		throw new Error(`nearAddsScenario left no live adds for mid-combat capture: ${JSON.stringify(preCombatHarness)}`);
	}

	let midCombatScreenshot = null;
	const afterAddsHarness = await defeatAdds(page, {
		bossType,
		timeoutMs: preset.addsTimeoutMs ?? 90000,
		minAddsLeft: 0,
		onMidCombat: async () => {
			const midHarness = await readHarness(page);
			if (liveAdds(midHarness, bossType).length === 0) {
				throw new Error('onMidCombat requested with zero live adds');
			}
			const shotPath = await writeScreenshot(page, outDirAbs, '03-mid-combat');
			midCombatScreenshot = path.relative(REPO_ROOT, shotPath);
		},
	});

	if (!midCombatScreenshot) {
		throw new Error('defeatAdds finished without capturing mid-combat screenshot');
	}

	assertDormantBoss(afterAddsHarness, bossType);
	const dormantProbe = buildEncounterProbe(afterAddsHarness, bossType);
	const dormantScreenshotPath = await writeScreenshot(page, outDirAbs, '04-boss-dormant');
	const dormantScreenshot = path.relative(REPO_ROOT, dormantScreenshotPath);

	await requestScenario(page, bossApproachScenario);
	const approachHarness = await readHarness(page);
	assertDormantBoss(approachHarness, bossType);

	const activeHarness = await activateEncounter(page, {
		bossType,
		triggerRadius: encounterTriggerRadius,
		timeoutMs: preset.encounterTimeoutMs ?? 60000,
	});
	if (activeHarness?.encounter?.phase !== 'active' || activeHarness?.encounter?.locked !== true) {
		throw new Error(`Encounter did not reach active/locked: ${JSON.stringify(activeHarness?.encounter)}`);
	}

	const activeProbe = buildEncounterProbe(activeHarness, bossType);
	const activeScreenshotPath = await writeScreenshot(page, outDirAbs, '05-boss-active');
	const activeScreenshot = path.relative(REPO_ROOT, activeScreenshotPath);

	return {
		midCombatScreenshot,
		dormantScreenshot,
		activeScreenshot,
		encounterPhase: activeHarness.encounter.phase,
		encounterLocked: activeHarness.encounter.locked,
		probes: {
			dormant: dormantProbe,
			active: activeProbe,
		},
	};
}

async function main() {
	const opts = parseArgs(process.argv);
	const outDirAbs = path.resolve(REPO_ROOT, opts.out);
	fs.mkdirSync(outDirAbs, { recursive: true });

	if (STUB_STEPS.has(opts.steps)) {
		throw new Error(`--steps ${opts.steps} is not implemented yet (sub-ticket 07)`);
	}
	const knownSteps = new Set(['auth', ...HUB_STEPS, ...BOSS_ENCOUNTER_STEPS]);
	if (!knownSteps.has(opts.steps)) {
		throw new Error(`Unknown --steps value: ${opts.steps}`);
	}

	const preset = await loadPreset(opts.preset);
	let browser;
	let game;
	let consoleLog;
	const summary = {
		ok: true,
		preset: opts.preset,
		steps: opts.steps,
		outDir: path.relative(REPO_ROOT, outDirAbs),
		presetConfig: preset,
	};

	try {
		game = await startGame();
		summary.serverPort = game.serverPort;
		summary.clientPort = game.clientPort;

		browser = await chromium.launch({ headless: true });
		const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
		consoleLog = wireConsoleLog(page);

		summary.auth = await runAuthStep({
			page,
			serverUrl: game.serverUrl,
			clientUrl: game.clientUrl,
			outDirAbs,
		});

		if (HUB_STEPS.has(opts.steps) || BOSS_ENCOUNTER_STEPS.has(opts.steps)) {
			summary.hub = await runHubStep({ page, preset, outDirAbs });
		}

		if (BOSS_ENCOUNTER_STEPS.has(opts.steps)) {
			summary.bossEncounter = await runBossEncounterStep({ page, preset, outDirAbs });
		}

		console.log(JSON.stringify(summary));
	} catch (err) {
		summary.ok = false;
		summary.error = err.message;
		console.error(`playthrough failed: ${err.message}`);
		throw err;
	} finally {
		if (consoleLog) {
			writeConsoleLog(outDirAbs, consoleLog.flush());
		}
		if (summary.bossEncounter?.probes) {
			const probesPath = path.join(outDirAbs, 'probes.json');
			fs.writeFileSync(probesPath, JSON.stringify(summary.bossEncounter.probes, null, 2));
		}
		const summaryPath = path.join(outDirAbs, 'run-summary.json');
		fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
		if (browser) await browser.close().catch(() => {});
		await stopGame();
	}
}

async function shutdown(code) {
	await stopGame();
	process.exit(code);
}

process.on('SIGINT', () => { shutdown(130); });
process.on('SIGTERM', () => { shutdown(143); });

main().catch(() => {
	process.exit(1);
});
