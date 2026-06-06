#!/usr/bin/env node
/**
 * Headless Playwright playthrough driver for autogame validation.
 *
 *   node harness/validate/playthrough.mjs [--preset rooms] [--out game/validation/rooms/] [--steps auth|hub|deploy|boss-encounter|full]
 *
 * Steps: auth (register/login), hub | deploy (ship hub + character save + tier-2 deploy),
 * boss-encounter (godmode + defeat adds + dormant/active boss screenshots),
 * full (auth → hub/deploy → boss-encounter → victory).
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerUser, injectToken, isSocketConnected } from './lib/auth.mjs';
import {
	enableGodmode,
	defeatAdds,
	defeatBoss,
	activateEncounter,
	assertDormantBoss,
} from './lib/combat.mjs';
import { wireConsoleLog, writeConsoleLog } from './lib/consoleLog.mjs';
import { renderFindings } from './lib/findings.mjs';
import { startGame, stopGame } from './lib/gameProcess.mjs';
import { readHarness } from './lib/harnessState.mjs';
import { writeScreenshot } from './lib/screenshot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const PRESET_MODULES = {
	rooms: () => import('./presets/rooms.mjs'),
	'spire-ascent': () => import('./presets/spire-ascent.mjs'),
};

const FULL_STEPS = new Set(['full']);
const HUB_STEPS = new Set(['hub', 'deploy']);
const BOSS_ENCOUNTER_STEPS = new Set(['boss-encounter']);
const DEFAULT_ADD_TYPES = ['grunt', 'skirmisher'];

function parseArgs(argv) {
	const opts = {
		preset: 'rooms',
		out: 'game/validation/rooms/',
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

function liveAdds(harness, bossType, addTypes) {
	const types = new Set(addTypes ?? DEFAULT_ADD_TYPES);
	return (harness?.enemyHp || []).filter(
		(e) => e.type !== bossType && e.hp > 0 && types.has(e.type),
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

function buildEncounterProbe(harness, bossType, addTypes) {
	const boss = (harness?.enemyHp || []).find((e) => e.type === bossType && e.hp > 0) || null;
	return {
		encounterPhase: harness?.encounter?.phase ?? null,
		encounterLocked: harness?.encounter?.locked ?? null,
		bossEnemyId: harness?.encounter?.bossEnemyId ?? null,
		bossHp: boss?.hp ?? null,
		liveAddCount: liveAdds(harness, bossType, addTypes).length,
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

function deployLabel(preset) {
	const quest = preset.questId ?? 'unknown';
	const tier = preset.questTier ?? '?';
	return `${quest} tier ${tier}`;
}

async function runHubStep({ page, preset, outDirAbs }) {
	const lobbyName = preset.lobbyName ?? 'Validation Lobby';
	await page.evaluate((name) => {
		const input = document.getElementById('create-lobby-name');
		if (input) input.value = name;
		document.getElementById('create-lobby-btn')?.click();
	}, lobbyName);

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
		await failWithHarness(page, `${deployLabel(preset)} deploy did not start`);
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
	const {
		bossType,
		nearAddsScenario,
		bossApproachScenario,
		encounterTriggerRadius,
		addTypes,
	} = preset;

	await enableGodmode(page);
	await requestScenario(page, nearAddsScenario);

	const preCombatHarness = await readHarness(page);
	if (liveAdds(preCombatHarness, bossType, addTypes).length === 0) {
		throw new Error(`nearAddsScenario left no live adds for mid-combat capture: ${JSON.stringify(preCombatHarness)}`);
	}

	let midCombatScreenshot = null;
	const afterAddsHarness = await defeatAdds(page, {
		bossType,
		timeoutMs: preset.addsTimeoutMs ?? 90000,
		minAddsLeft: 0,
		addTypes,
		onMidCombat: async () => {
			const midHarness = await readHarness(page);
			if (liveAdds(midHarness, bossType, addTypes).length === 0) {
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
	const dormantProbe = buildEncounterProbe(afterAddsHarness, bossType, addTypes);
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

	const activeProbe = buildEncounterProbe(activeHarness, bossType, addTypes);
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

function buildVictoryProbe(harness) {
	return {
		runStatus: harness?.runStatus ?? null,
		runObjectiveComplete: harness?.runObjectiveComplete ?? false,
		bossDefeated: harness?.objective?.bossDefeated ?? null,
		lastRunSummaryStatus: harness?.lastRunSummary?.status ?? null,
	};
}

async function waitForVictoryState(page, { timeoutMs = 30000 } = {}) {
	await page.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		return h
			&& h.runStatus === 'victory'
			&& h.runObjectiveComplete === true
			&& h.objective?.bossDefeated === true
			&& h.lastRunSummary?.status === 'victory';
	}, { timeout: timeoutMs }).catch(async () => {
		await failWithHarness(page, 'Victory state not reached');
	});
	return readHarness(page);
}

async function runVictoryStep({ page, preset, outDirAbs }) {
	const { bossType, bossLowHpScenario } = preset;

	if (bossLowHpScenario) {
		await requestScenario(page, bossLowHpScenario);
	}

	const afterBossHarness = await defeatBoss(page, {
		bossType,
		timeoutMs: preset.bossDefeatTimeoutMs ?? 180000,
	});
	const afterBossProbe = buildVictoryProbe(afterBossHarness);
	const bossDefeatedScreenshotPath = await writeScreenshot(page, outDirAbs, '06-boss-defeated');

	const victoryHarness = await waitForVictoryState(page, {
		timeoutMs: preset.victoryTimeoutMs ?? 30000,
	});
	const victoryProbe = buildVictoryProbe(victoryHarness);
	const victoryScreenshotPath = await writeScreenshot(page, outDirAbs, '07-victory');

	return {
		bossDefeatedScreenshot: path.relative(REPO_ROOT, bossDefeatedScreenshotPath),
		victoryScreenshot: path.relative(REPO_ROOT, victoryScreenshotPath),
		probes: {
			afterBoss: afterBossProbe,
			victory: victoryProbe,
		},
	};
}

function buildAssertions(summary, preset) {
	const bossSpawned = Array.isArray(summary.hub?.bossTypes)
		&& summary.hub.bossTypes.includes(preset.bossType);
	const encounterActivated = summary.bossEncounter?.encounterPhase === 'active'
		&& summary.bossEncounter?.encounterLocked === true;
	const victoryProbe = summary.victory?.probes?.victory;
	const afterBossProbe = summary.victory?.probes?.afterBoss;
	const bossDefeated = afterBossProbe?.bossDefeated === true
		|| victoryProbe?.bossDefeated === true;
	const victoryFired = victoryProbe?.runStatus === 'victory'
		&& victoryProbe?.runObjectiveComplete === true
		&& victoryProbe?.bossDefeated === true
		&& victoryProbe?.lastRunSummaryStatus === 'victory';
	return {
		bossSpawned,
		encounterActivated,
		bossDefeated,
		victoryFired,
	};
}

function collectScreenshots(summary) {
	const shots = [];
	if (summary.auth?.screenshot) shots.push(summary.auth.screenshot);
	if (summary.hub?.hubScreenshot) shots.push(summary.hub.hubScreenshot);
	if (summary.hub?.entryScreenshot) shots.push(summary.hub.entryScreenshot);
	if (summary.bossEncounter?.midCombatScreenshot) shots.push(summary.bossEncounter.midCombatScreenshot);
	if (summary.bossEncounter?.dormantScreenshot) shots.push(summary.bossEncounter.dormantScreenshot);
	if (summary.bossEncounter?.activeScreenshot) shots.push(summary.bossEncounter.activeScreenshot);
	if (summary.victory?.bossDefeatedScreenshot) shots.push(summary.victory.bossDefeatedScreenshot);
	if (summary.victory?.victoryScreenshot) shots.push(summary.victory.victoryScreenshot);
	return shots;
}

function writeFullArtifacts({ outDirAbs, summary, consoleEntries }) {
	const probes = {
		...(summary.bossEncounter?.probes || {}),
		...(summary.victory?.probes || {}),
	};
	fs.writeFileSync(path.join(outDirAbs, 'probes.json'), JSON.stringify(probes, null, 2));

	const findings = renderFindings({
		ok: summary.ok === true,
		preset: summary.preset,
		assertions: summary.assertions || {},
		consoleErrors: consoleEntries || [],
		screenshots: collectScreenshots(summary),
		error: summary.error || null,
	});
	fs.writeFileSync(path.join(outDirAbs, 'findings.md'), findings);
}

async function main() {
	const opts = parseArgs(process.argv);
	const outDirAbs = path.resolve(REPO_ROOT, opts.out);
	fs.mkdirSync(outDirAbs, { recursive: true });

	const knownSteps = new Set(['auth', ...HUB_STEPS, ...BOSS_ENCOUNTER_STEPS, ...FULL_STEPS]);
	if (!knownSteps.has(opts.steps)) {
		throw new Error(`Unknown --steps value: ${opts.steps}`);
	}

	const preset = await loadPreset(opts.preset);
	const runsHub = HUB_STEPS.has(opts.steps) || FULL_STEPS.has(opts.steps);
	const runsBossEncounter = BOSS_ENCOUNTER_STEPS.has(opts.steps) || FULL_STEPS.has(opts.steps);
	const runsFull = FULL_STEPS.has(opts.steps);

	let browser;
	let game;
	let consoleLog;
	let exitCode = 0;
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

		if (runsHub) {
			summary.hub = await runHubStep({ page, preset, outDirAbs });
		}

		if (runsBossEncounter) {
			summary.bossEncounter = await runBossEncounterStep({ page, preset, outDirAbs });
		}

		if (runsFull) {
			summary.victory = await runVictoryStep({ page, preset, outDirAbs });
			summary.assertions = buildAssertions(summary, preset);
			summary.ok = Object.values(summary.assertions).every((value) => value === true);
			if (!summary.ok) {
				summary.error = summary.error || 'One or more assertions failed';
				exitCode = 1;
			}
		}

		console.log(JSON.stringify(summary));
	} catch (err) {
		summary.ok = false;
		summary.error = err.message;
		console.error(`playthrough failed: ${err.message}`);
		exitCode = 1;
		if (runsFull && !summary.assertions) {
			summary.assertions = buildAssertions(summary, preset);
		}
	} finally {
		const consoleEntries = consoleLog ? consoleLog.flush() : [];
		if (consoleLog) {
			writeConsoleLog(outDirAbs, consoleEntries);
		}
		if (runsFull) {
			if (!summary.assertions) {
				summary.assertions = buildAssertions(summary, preset);
			}
			writeFullArtifacts({ outDirAbs, summary, consoleEntries });
		} else if (summary.bossEncounter?.probes) {
			const probesPath = path.join(outDirAbs, 'probes.json');
			fs.writeFileSync(probesPath, JSON.stringify(summary.bossEncounter.probes, null, 2));
		}
		const summaryPath = path.join(outDirAbs, 'run-summary.json');
		fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
		if (browser) await browser.close().catch(() => {});
		await stopGame();
	}

	return exitCode;
}

async function shutdown(code) {
	await stopGame();
	process.exit(code);
}

process.on('SIGINT', () => { shutdown(130); });
process.on('SIGTERM', () => { shutdown(143); });

main()
	.then((code) => {
		process.exit(code ?? 0);
	})
	.catch(() => {
		process.exit(1);
	});
