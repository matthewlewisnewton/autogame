#!/usr/bin/env node
/**
 * Headless Playwright playthrough driver for autogame validation.
 *
 *   node harness/validate/playthrough.mjs [--preset rooms|hub] [--out <dir>] [--steps <slice>]
 *
 * When --out is omitted, output defaults to game/validation/<preset>/ (e.g. --preset open-plaza
 * → game/validation/open-plaza/). Explicit --out overrides the preset default.
 *
 * Rooms / stage preset steps: auth, hub | deploy, boss-encounter, full.
 * Hub preset steps: auth, hub-walk, booth, telepipe-reset, full.
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
import { renderHubFindings, evaluateWalkablePresentation } from './lib/findingsHub.mjs';
import { assertGameProcessAlive, getServerLogTail, startGame, stopGame } from './lib/gameProcess.mjs';
import { readHarness } from './lib/harnessState.mjs';
import { writeScreenshot } from './lib/screenshot.mjs';
import { probeBossUi } from './lib/bossUiProbe.mjs';
import { walkToZone } from './lib/hubMovement.mjs';
import {
	waitForHubLobby,
	createLobby,
	joinLobby,
	dismissLobbyOverlay,
} from './lib/multiPlayer.mjs';
import {
	APPEARANCE_CHANGE_COST,
	DEFAULT_HAT_SWAP_ID,
	grantHubCurrency,
	openCharacterBooth,
	readCurrency,
	stagePaidAppearanceConfirm,
	completePaidAppearanceConfirm,
} from './lib/booth.mjs';
import { runTelepipeResetStep } from './lib/telepipe.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const PRESET_MODULES = {
	rooms: () => import('./presets/rooms.mjs'),
	hub: () => import('./presets/hub.mjs'),
	'spire-ascent': () => import('./presets/spire-ascent.mjs'),
	'open-plaza': () => import('./presets/open-plaza.mjs'),
	'sunken-canyon': () => import('./presets/sunken-canyon.mjs'),
};

const STAGE_PRESETS = new Set(['rooms', 'open-plaza', 'spire-ascent', 'sunken-canyon']);
const ROOMS_FULL_STEPS = new Set(['full']);
const ROOMS_HUB_STEPS = new Set(['hub', 'deploy']);
const ROOMS_BOSS_ENCOUNTER_STEPS = new Set(['boss-encounter']);
const HUB_PRESET_STEPS = new Set(['auth', 'hub-walk', 'booth', 'telepipe-reset', 'full']);
const HUB_FULL_STEPS = new Set(['full']);
const DEFAULT_ADD_TYPES = ['grunt', 'skirmisher'];

function parseArgs(argv) {
	const opts = {
		preset: 'rooms',
		out: null,
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
			console.log('usage: node harness/validate/playthrough.mjs [--preset <name>] [--out <dir>] [--steps <slice>]');
			process.exit(0);
		} else {
			throw new Error(`Unknown argument: ${arg}`);
		}
	}
	if (opts.out == null) {
		opts.out = `game/validation/${opts.preset}/`;
	}
	return opts;
}

function assertStepsForPreset(preset, steps) {
	if (preset === 'hub') {
		if (!HUB_PRESET_STEPS.has(steps)) {
			throw new Error(`Unknown --steps value "${steps}" for preset hub — expected: ${[...HUB_PRESET_STEPS].join(', ')}`);
		}
		return;
	}
	if (!STAGE_PRESETS.has(preset)) {
		throw new Error(`Unknown preset "${preset}"`);
	}
	const stageSteps = new Set([
		'auth',
		...ROOMS_HUB_STEPS,
		...ROOMS_BOSS_ENCOUNTER_STEPS,
		...ROOMS_FULL_STEPS,
	]);
	if (!stageSteps.has(steps)) {
		throw new Error(`Unknown --steps value "${steps}" for preset ${preset} — expected: ${[...stageSteps].join(', ')}`);
	}
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

async function failWithHarnessPair(hostPage, joinerPage, message) {
	const hostHarness = await readHarness(hostPage);
	const joinerHarness = await readHarness(joinerPage);
	throw new Error(`${message}: host=${JSON.stringify(hostHarness)} joiner=${JSON.stringify(joinerHarness)}`);
}

function firstSquadmate(harness) {
	const mates = Array.isArray(harness?.squadmates) ? harness.squadmates : [];
	return mates.find((m) => m && Number.isFinite(m.x) && Number.isFinite(m.z)) || null;
}

async function probeWalkableHubPresentation(page) {
	return page.evaluate(() => {
		const harness = window.__AUTOGAME_HARNESS_STATE__?.();
		const lobby = document.getElementById('lobby');
		const canvas = document.querySelector('canvas');
		const squadmates = Array.isArray(harness?.squadmates) ? harness.squadmates : [];
		const remoteSquadmateCount = squadmates.filter(
			(m) => m && Number.isFinite(m.x) && Number.isFinite(m.z),
		).length;
		return {
			lobbyHidden: lobby ? lobby.classList.contains('hidden') : false,
			lobbyMenuDismissed: harness?.lobbyMenuDismissed === true,
			hubCanvasActive: harness?.hasCanvas === true
				&& !!canvas
				&& canvas.width > 0
				&& canvas.height > 0,
			playersOnHost: harness?.players ?? null,
			remoteSquadmateCount,
			layoutProfile: harness?.layout?.profile ?? null,
		};
	});
}

function assertWalkableHubPresentation(probe) {
	if (probe.lobbyHidden !== true || probe.lobbyMenuDismissed !== true || probe.hubCanvasActive !== true) {
		throw new Error(`Walkable hub presentation probe failed: ${JSON.stringify(probe)}`);
	}
}

async function requireWalkableHubPresentation(page) {
	const probe = await probeWalkableHubPresentation(page);
	assertWalkableHubPresentation(probe);
	return probe;
}

async function nudgeJoinerForPresence(joinerPage, targetX, targetZ) {
	await joinerPage.evaluate(() => document.querySelector('canvas')?.focus());
	const harness = await readHarness(joinerPage);
	const player = harness?.player;
	if (!player) return;
	const dx = targetX - player.x;
	const dz = targetZ - player.z;
	const keys = [];
	if (Math.abs(dx) >= Math.abs(dz)) {
		if (dx > 0.5) keys.push('d');
		else if (dx < -0.5) keys.push('a');
	} else if (dz > 0.5) keys.push('s');
	else if (dz < -0.5) keys.push('w');
	if (keys.length === 0) keys.push('d');
	for (let i = 0; i < 4; i += 1) {
		for (const key of keys) {
			await joinerPage.keyboard.down(key);
			await joinerPage.waitForTimeout(450);
			await joinerPage.keyboard.up(key);
		}
	}
}

async function runBoothStep({ page, preset, outDirAbs }) {
	await createLobby(page, 'Booth Validation');
	await waitForHubLobby(page);

	await grantHubCurrency(page, preset.currencyScenario);
	const currencyBefore = await readCurrency(page);
	if (!Number.isFinite(currencyBefore)) {
		const harness = await readHarness(page);
		throw new Error(`currencyBefore is not numeric: ${JSON.stringify(harness)}`);
	}

	await openCharacterBooth(page);
	await stagePaidAppearanceConfirm(page, { bodyColor: '#1e293b' });
	const paidScreenshotPath = await writeScreenshot(page, outDirAbs, '05-booth-paid');
	await completePaidAppearanceConfirm(page);

	const currencyAfterPaid = await readCurrency(page);
	const paidDelta = Number.isFinite(currencyAfterPaid) ? currencyAfterPaid - currencyBefore : null;
	const boothDeductsGold = currencyAfterPaid === currencyBefore - APPEARANCE_CHANGE_COST;

	const hatsResult = await page.evaluate(async (scenario) => {
		if (typeof window.__requestDebugScenarioForTest !== 'function') {
			return { ok: false, reason: '__requestDebugScenarioForTest missing' };
		}
		return window.__requestDebugScenarioForTest(scenario);
	}, preset.hatsScenario);
	if (!hatsResult?.ok) {
		const harness = await readHarness(page);
		throw new Error(`hats scenario ${preset.hatsScenario} failed: ${JSON.stringify(hatsResult)} harness=${JSON.stringify(harness)}`);
	}

	const currencyBeforeHat = await readCurrency(page);
	if (!Number.isFinite(currencyBeforeHat)) {
		const harness = await readHarness(page);
		throw new Error(`currencyBeforeHat is not numeric: ${JSON.stringify(harness)}`);
	}

	await openCharacterBooth(page);
	await page.evaluate((hatId) => {
		window.__patchCharacterBoothForTest({ hat: hatId });
	}, DEFAULT_HAT_SWAP_ID);
	const hatScreenshotPath = await writeScreenshot(page, outDirAbs, '06-hat-swap');
	const hatSaveResult = await page.evaluate(() => window.__saveCharacterBoothForTest());
	if (!hatSaveResult?.ok) {
		const harness = await readHarness(page);
		throw new Error(`Hat save failed: ${JSON.stringify(hatSaveResult)} harness=${JSON.stringify(harness)}`);
	}
	await page.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		return h?.characterBoothOpen === false;
	}, { timeout: 15000 });

	const currencyAfterHat = await readCurrency(page);
	const hatDelta = Number.isFinite(currencyAfterHat) ? currencyAfterHat - currencyBeforeHat : null;
	const hatSwapFree = currencyAfterHat === currencyBeforeHat;

	return {
		currencyScenario: preset.currencyScenario,
		hatsScenario: preset.hatsScenario,
		currencyBefore,
		currencyAfterPaid,
		paidDelta,
		currencyBeforeHat,
		currencyAfterHat,
		hatDelta,
		appearanceChangeCost: APPEARANCE_CHANGE_COST,
		hatId: DEFAULT_HAT_SWAP_ID,
		boothDeductsGold,
		hatSwapFree,
		paidScreenshot: path.relative(REPO_ROOT, paidScreenshotPath),
		hatScreenshot: path.relative(REPO_ROOT, hatScreenshotPath),
	};
}

async function runHubWalkStep({ browser, game, preset, outDirAbs }) {
	const stamp = Date.now();
	const lobbyName = `Hub Walk ${stamp}`;
	const hostUsername = `hub-host-${stamp}`;
	const joinerUsername = `hub-joiner-${stamp}`;
	const password = 'harness-test-password';

	const hostPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
	const joinerPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });

	try {
		const hostToken = await registerUser(game.serverUrl, hostUsername, password);
		const joinerToken = await registerUser(game.serverUrl, joinerUsername, password);

		await injectToken(hostPage, hostToken, game.clientUrl);
		await injectToken(joinerPage, joinerToken, game.clientUrl);
		await waitForLobbyBrowser(hostPage);
		await waitForLobbyBrowser(joinerPage);

		await createLobby(hostPage, lobbyName);
		await joinLobby(joinerPage, lobbyName);
		await waitForHubLobby(hostPage);
		await waitForHubLobby(joinerPage);

		const hostHarness = await readHarness(hostPage);
		if ((hostHarness?.players ?? 0) < 2) {
			await failWithHarnessPair(hostPage, joinerPage, 'Expected at least two players on host after join');
		}

		const mateAtJoin = firstSquadmate(hostHarness);
		if (!mateAtJoin) {
			await failWithHarnessPair(hostPage, joinerPage, 'Expected a remote squadmate on host at join time');
		}

		const joinerHarness = await readHarness(joinerPage);
		const joinerPlayer = joinerHarness?.player;
		if (!joinerPlayer || joinerPlayer.x == null) {
			await failWithHarnessPair(hostPage, joinerPage, 'Joiner local player missing position');
		}
		await nudgeJoinerForPresence(joinerPage, joinerPlayer.x + 2, joinerPlayer.z);

		await hostPage.waitForFunction(({ x, z }) => {
			const h = window.__AUTOGAME_HARNESS_STATE__?.();
			const mate = (h?.squadmates || []).find((m) => m && Number.isFinite(m.x) && Number.isFinite(m.z));
			if (!mate) return false;
			return Math.hypot(mate.x - x, mate.z - z) > 0.05;
		}, { x: mateAtJoin.x, z: mateAtJoin.z }, { timeout: 15000 }).catch(async () => {
			await failWithHarnessPair(hostPage, joinerPage, 'Remote squadmate position did not update after joiner move');
		});

		// Assert both players are close enough for both avatars to fit in the overview frame.
		const hState = await readHarness(hostPage);
		const jState = await readHarness(joinerPage);
		const hostP = hState?.player;
		const joinerP = jState?.player;
		if (hostP && joinerP && Number.isFinite(hostP.x) && Number.isFinite(joinerP.x)) {
			const dist = Math.hypot(hostP.x - joinerP.x, hostP.z - joinerP.z);
			if (dist > 4) {
				await failWithHarnessPair(hostPage, joinerPage,
					`Host-joiner distance ${dist.toFixed(1)} exceeds 4 units for overview frame`);
			}
		}

		await dismissLobbyOverlay(hostPage);
		const overviewProbe = await requireWalkableHubPresentation(hostPage);
		const overviewScreenshot = await writeScreenshot(hostPage, outDirAbs, '01-hub-overview');

		const zoneScreenshots = {};
		const zoneProbes = {};
		const zoneShotNames = {
			operations: '02-room-operations',
			commerce: '03-room-commerce',
			salon: '04-room-salon',
		};
		for (const zoneName of preset.hubZones) {
			const afterWalk = await walkToZone(hostPage, zoneName, preset.boothAnchors);
			if (afterWalk?.layout?.profile !== 'hub') {
				await failWithHarnessPair(hostPage, joinerPage, `Layout left hub profile in zone ${zoneName}`);
			}
			const shotName = zoneShotNames[zoneName];
			if (!shotName) {
				throw new Error(`No screenshot name mapped for hub zone ${zoneName}`);
			}
			await dismissLobbyOverlay(hostPage);
			zoneProbes[zoneName] = await requireWalkableHubPresentation(hostPage);
			const shotPath = await writeScreenshot(hostPage, outDirAbs, shotName);
			zoneScreenshots[zoneName] = path.relative(REPO_ROOT, shotPath);
		}

		const finalHostHarness = await readHarness(hostPage);
		return {
			lobbyName,
			hostUsername,
			joinerUsername,
			playersOnHost: finalHostHarness?.players ?? null,
			overviewScreenshot: path.relative(REPO_ROOT, overviewScreenshot),
			zoneScreenshots,
			layoutProfile: finalHostHarness?.layout?.profile ?? null,
			layoutRoomCount: finalHostHarness?.layout?.roomCount ?? null,
			walkablePresentation: {
				overview: overviewProbe,
				zones: zoneProbes,
			},
		};
	} finally {
		await hostPage.close().catch(() => {});
		await joinerPage.close().catch(() => {});
	}
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

async function probeHubLobbyFinder(page) {
	return page.evaluate(() => {
		const lobbyBrowser = document.getElementById('lobby-browser');
		const lobby = document.getElementById('lobby');
		const canvas = document.querySelector('canvas');
		const lobbyBrowserStyle = lobbyBrowser ? getComputedStyle(lobbyBrowser) : null;
		const lobbyBrowserVisible = !!lobbyBrowser
			&& !lobbyBrowser.classList.contains('hidden')
			&& lobbyBrowserStyle?.display !== 'none';
		const lobbyHidden = !lobby || lobby.classList.contains('hidden');
		const hasCanvas = !!canvas;
		const canvasActiveFullscreen = !!canvas
			&& canvas.width > 0
			&& canvas.height > 0
			&& getComputedStyle(canvas).display !== 'none';
		const harness = window.__AUTOGAME_HARNESS_STATE__?.();
		const hub3dStarted = canvasActiveFullscreen
			&& (harness?.sceneInitialized === true || harness?.layout?.profile === 'hub');
		const position = lobbyBrowserStyle?.position ?? null;
		const activePlayingCanvas = canvasActiveFullscreen && harness?.phase === 'playing';
		const fixedOverPlayingCanvas = position === 'fixed'
			&& lobbyBrowserVisible
			&& activePlayingCanvas;

		return {
			lobbyBrowserVisible,
			lobbyHidden,
			hasCanvas,
			hub3dStarted,
			position,
			fixedOverPlayingCanvas,
		};
	});
}

async function captureFloorAlignmentProbe(page) {
	return page.evaluate(async () => {
		if (typeof window.__sampleFloorAlignmentForHarness === 'function') {
			return window.__sampleFloorAlignmentForHarness();
		}
		const { sampleFloorY, resolveFloorY } = await import('/shared/floorSampling.esm.js');
		const harness = window.__AUTOGAME_HARNESS_STATE__?.();
		if (!harness?.player || harness.player.x == null || harness.player.z == null) {
			return null;
		}
		const layout = harness.layout;
		if (!layout?.rooms || !Array.isArray(layout.rooms)) {
			return null;
		}
		const { x, z } = harness.player;
		const playerY = Number.isFinite(harness.player.y) ? harness.player.y : null;
		const floorY = resolveFloorY(sampleFloorY(layout, x, z));
		let band = null;
		for (const room of layout.rooms) {
			const halfW = room.width / 2;
			const halfD = room.depth / 2;
			if (x >= room.x - halfW && x <= room.x + halfW && z >= room.z - halfD && z <= room.z + halfD) {
				band = room.band ?? null;
				break;
			}
		}
		if (playerY == null) return null;
		return {
			playerY,
			floorY,
			delta: playerY - floorY,
			layoutProfile: layout.profile ?? null,
			band,
		};
	});
}

async function assertHubLobbyFinder(page) {
	const probe = await probeHubLobbyFinder(page);
	if (!probe.lobbyBrowserVisible) {
		throw new Error(`#lobby-browser not visible in lobby-finder probe: ${JSON.stringify(probe)}`);
	}
	if (!probe.lobbyHidden) {
		throw new Error(`#lobby should be hidden in lobby-finder probe: ${JSON.stringify(probe)}`);
	}
	if (probe.hub3dStarted) {
		throw new Error(`Hub 3D should not be active in lobby-finder probe: ${JSON.stringify(probe)}`);
	}
	if (probe.fixedOverPlayingCanvas) {
		throw new Error(`#lobby-browser must not be fixed over an active playing canvas: ${JSON.stringify(probe)}`);
	}
	return probe;
}

async function runAuthStep({ page, serverUrl, clientUrl, outDirAbs, presetName }) {
	const username = `playthrough-${Date.now()}`;
	const password = 'harness-test-password';
	const token = await registerUser(serverUrl, username, password);
	await injectToken(page, token, clientUrl);
	await waitForLobbyBrowser(page);

	const harness = await readHarness(page);
	const connected = await isSocketConnected(page);
	const isHubPreset = presetName === 'hub';
	let lobbyFinderProbe = null;
	if (isHubPreset) {
		lobbyFinderProbe = await assertHubLobbyFinder(page);
	}
	const screenshotName = isHubPreset ? '09-lobby-finder' : '01-lobby-browser';
	const screenshotPath = await writeScreenshot(page, outDirAbs, screenshotName);

	return {
		username,
		connected,
		lobbyBrowserVisible: true,
		harnessPhase: harness?.phase ?? null,
		...(lobbyFinderProbe ? { lobbyFinder: lobbyFinderProbe } : {}),
		screenshot: path.relative(REPO_ROOT, screenshotPath),
	};
}

function deployRunLabel(preset) {
	return `${preset.questId} tier ${preset.questTier}`;
}

async function runHubStep({ page, preset, outDirAbs }) {
	const lobbyName = preset.lobbyName || 'Playthrough Validation';
	await page.evaluate((channelName) => {
		const name = document.getElementById('create-lobby-name');
		if (name) name.value = channelName;
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
		await failWithHarness(page, `${deployRunLabel(preset)} stage_boss run did not start after ${preset.deployScenario}`);
	});

	const playingHarness = await readHarness(page);
	if (preset.layoutProfile && playingHarness?.layout?.profile !== preset.layoutProfile) {
		await failWithHarness(page, `Expected layout.profile ${preset.layoutProfile}`);
	}
	const hasBoss = Array.isArray(playingHarness?.enemyHp)
		&& playingHarness.enemyHp.some((enemy) => enemy.type === preset.bossType);
	if (!hasBoss) {
		await failWithHarness(page, `Expected ${preset.bossType} in enemyHp`);
	}
	if (playingHarness?.encounter?.phase !== 'dormant') {
		await failWithHarness(page, 'Expected dormant stage-boss encounter after deploy');
	}

	const entryScreenshot = await writeScreenshot(page, outDirAbs, '02-level-entry');
	const levelEntryFloor = await captureFloorAlignmentProbe(page);

	return {
		hubScreenshot: path.relative(REPO_ROOT, hubScreenshot),
		entryScreenshot: path.relative(REPO_ROOT, entryScreenshot),
		deployScenario: preset.deployScenario,
		deployOk: true,
		objectiveType: playingHarness?.objective?.type ?? null,
		encounterPhase: playingHarness?.encounter?.phase ?? null,
		bossTypes: (playingHarness?.enemyHp || []).map((e) => e.type),
		floorAlignment: levelEntryFloor ? { levelEntry: levelEntryFloor } : {},
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
	if (nearAddsScenario) {
		await requestScenario(page, nearAddsScenario);
	}

	const preCombatHarness = await readHarness(page);
	if (liveAdds(preCombatHarness, bossType, addTypes).length === 0) {
		throw new Error(`No live adds for mid-combat capture (nearAddsScenario=${nearAddsScenario ?? 'none'}): ${JSON.stringify(preCombatHarness)}`);
	}

	let midCombatScreenshot = null;
	const floorAlignment = {};
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
			const midCombatFloor = await captureFloorAlignmentProbe(page);
			if (midCombatFloor) floorAlignment.midCombat = midCombatFloor;
		},
	});

	if (!midCombatScreenshot) {
		throw new Error('defeatAdds finished without capturing mid-combat screenshot');
	}

	assertDormantBoss(afterAddsHarness, bossType);
	const dormantProbe = buildEncounterProbe(afterAddsHarness, bossType, addTypes);
	const dormantScreenshotPath = await writeScreenshot(page, outDirAbs, '04-boss-dormant');
	const dormantScreenshot = path.relative(REPO_ROOT, dormantScreenshotPath);
	const dormantFloor = await captureFloorAlignmentProbe(page);
	if (dormantFloor) floorAlignment.bossDormant = dormantFloor;

	if (bossApproachScenario) {
		await requestScenario(page, bossApproachScenario);
		const approachHarness = await readHarness(page);
		assertDormantBoss(approachHarness, bossType);
	}

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
	const activeFloor = await captureFloorAlignmentProbe(page);
	if (activeFloor) floorAlignment.bossActive = activeFloor;

	// Boss health-bar / encounter-HUD + distinct-visual probe (tickets 283 / 284),
	// gated behind the preset flag so other presets are unaffected.
	let bossUiResult = null;
	if (preset.probeBossUi) {
		bossUiResult = await probeBossUi(page, {
			outDir: outDirAbs,
			repoRoot: REPO_ROOT,
			bossType,
		});
	}

	return {
		midCombatScreenshot,
		dormantScreenshot,
		activeScreenshot,
		encounterPhase: activeHarness.encounter.phase,
		encounterLocked: activeHarness.encounter.locked,
		...(bossUiResult ? {
			bossUi: bossUiResult.bossUi,
			bossVisuals: bossUiResult.bossVisuals,
			bossUiScreenshot: bossUiResult.screenshot,
		} : {}),
		probes: {
			dormant: dormantProbe,
			active: activeProbe,
			...(bossUiResult ? { bossUi: bossUiResult.bossUi, bossVisuals: bossUiResult.bossVisuals } : {}),
			...(Object.keys(floorAlignment).length > 0 ? { floorAlignment } : {}),
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

function loadSortieCompleteLabel() {
	const themePath = path.join(REPO_ROOT, 'game', 'shared', 'theme.json');
	const theme = JSON.parse(fs.readFileSync(themePath, 'utf8'));
	return theme.run?.sortieComplete ?? 'Sortie Complete';
}

async function waitForSortieCompleteOverlay(page, { timeoutMs = 30000 } = {}) {
	const sortieCompleteLabel = loadSortieCompleteLabel();
	await page.waitForFunction((expected) => {
		const overlay = document.getElementById('run-summary-overlay');
		const status = document.getElementById('summary-status');
		if (!overlay || !status) return false;
		const style = getComputedStyle(overlay);
		if (style.display === 'none' || style.visibility === 'hidden') return false;
		if (status.textContent.trim() !== expected) return false;
		return overlay.getBoundingClientRect().height > 0;
	}, sortieCompleteLabel, { timeout: timeoutMs }).catch(async () => {
		await failWithHarness(page, 'Sortie Complete overlay not visible');
	});
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
	await waitForSortieCompleteOverlay(page, {
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

function buildHubAssertions(summary) {
	return {
		boothDeductsGold: summary.booth?.boothDeductsGold === true,
		hatSwapFree: summary.booth?.hatSwapFree === true,
		telepipeVitalsPreserved: summary.telepipeReset?.telepipeVitalsPreserved === true,
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
	if (summary.bossEncounter?.bossUiScreenshot) shots.push(summary.bossEncounter.bossUiScreenshot);
	if (summary.victory?.bossDefeatedScreenshot) shots.push(summary.victory.bossDefeatedScreenshot);
	if (summary.victory?.victoryScreenshot) shots.push(summary.victory.victoryScreenshot);
	return shots;
}

function collectHubScreenshots(summary) {
	const shots = [];
	if (summary.hubWalk?.overviewScreenshot) shots.push(summary.hubWalk.overviewScreenshot);
	if (summary.hubWalk?.zoneScreenshots && typeof summary.hubWalk.zoneScreenshots === 'object') {
		for (const zone of ['operations', 'commerce', 'salon']) {
			const shot = summary.hubWalk.zoneScreenshots[zone];
			if (shot) shots.push(shot);
		}
	}
	if (summary.booth?.paidScreenshot) shots.push(summary.booth.paidScreenshot);
	if (summary.booth?.hatScreenshot) shots.push(summary.booth.hatScreenshot);
	if (summary.telepipeReset?.beforeScreenshot) shots.push(summary.telepipeReset.beforeScreenshot);
	if (summary.telepipeReset?.afterScreenshot) shots.push(summary.telepipeReset.afterScreenshot);
	if (summary.auth?.screenshot) shots.push(summary.auth.screenshot);
	return shots;
}

function mergeFloorAlignmentProbes(summary) {
	const merged = {
		...(summary.hub?.floorAlignment || {}),
		...(summary.bossEncounter?.probes?.floorAlignment || {}),
	};
	return Object.keys(merged).length > 0 ? merged : null;
}

function writeFullArtifacts({ outDirAbs, summary, consoleEntries, preset }) {
	const isHub = summary.preset === 'hub';
	let probes;
	let findings;
	if (isHub) {
		probes = {
			booth: summary.booth || null,
			telepipeReset: {
				preSuspend: summary.telepipeReset?.preSuspend ?? null,
				postDeploy: summary.telepipeReset?.postDeploy ?? null,
				telepipeVitalsPreserved: summary.telepipeReset?.telepipeVitalsPreserved ?? null,
			},
			hubWalk: summary.hubWalk || null,
		};
		findings = renderHubFindings({
			ok: summary.ok === true,
			preset: summary.preset,
			assertions: summary.assertions || {},
			consoleErrors: consoleEntries || [],
			screenshots: collectHubScreenshots(summary),
			hubWalk: summary.hubWalk,
			booth: summary.booth,
			telepipeReset: summary.telepipeReset,
			error: summary.error || null,
		});
	} else {
		const { floorAlignment: _bossFloorAlignment, ...encounterProbes } = summary.bossEncounter?.probes || {};
		const bossProbes = { ...encounterProbes };
		const floorAlignment = mergeFloorAlignmentProbes(summary);
		if (floorAlignment) {
			bossProbes.floorAlignment = floorAlignment;
		}
		probes = {
			...bossProbes,
			...(summary.victory?.probes || {}),
		};
		findings = renderFindings({
			ok: summary.ok === true,
			preset: summary.preset,
			findingsTitle: preset?.findingsTitle,
			bossSpawnLabel: preset?.bossSpawnLabel,
			bossType: preset?.bossType,
			assertions: summary.assertions || {},
			floorAlignment,
			consoleErrors: consoleEntries || [],
			screenshots: collectScreenshots(summary),
			error: summary.error || null,
		});
	}
	fs.writeFileSync(path.join(outDirAbs, 'probes.json'), JSON.stringify(probes, null, 2));
	fs.writeFileSync(path.join(outDirAbs, 'findings.md'), findings);
}

async function main() {
	const opts = parseArgs(process.argv);
	const outDirAbs = path.resolve(REPO_ROOT, opts.out);
	fs.mkdirSync(outDirAbs, { recursive: true });

	let browser;
	let game;
	let consoleLog;
	let exitCode = 0;
	let preset;
	let runsRoomsHub = false;
	let runsBossEncounter = false;
	let runsRoomsFull = false;
	let runsFull = false;
	let runsHubFull = false;
	let runsHubWalk = false;
	let runsBooth = false;
	let runsTelepipeReset = false;
	const summary = {
		ok: true,
		preset: opts.preset,
		steps: opts.steps,
		outDir: path.relative(REPO_ROOT, outDirAbs),
	};

	try {
		assertStepsForPreset(opts.preset, opts.steps);
		preset = await loadPreset(opts.preset);
		summary.presetConfig = preset;
		const isStagePreset = STAGE_PRESETS.has(opts.preset);
		runsRoomsHub = isStagePreset
			&& (ROOMS_HUB_STEPS.has(opts.steps) || ROOMS_FULL_STEPS.has(opts.steps));
		runsBossEncounter = isStagePreset
			&& (ROOMS_BOSS_ENCOUNTER_STEPS.has(opts.steps) || ROOMS_FULL_STEPS.has(opts.steps));
		runsRoomsFull = isStagePreset && ROOMS_FULL_STEPS.has(opts.steps);
		runsHubFull = opts.preset === 'hub' && HUB_FULL_STEPS.has(opts.steps);
		runsFull = runsRoomsFull || runsHubFull;
		runsHubWalk = opts.preset === 'hub'
			&& (opts.steps === 'hub-walk' || runsHubFull);
		runsBooth = opts.preset === 'hub'
			&& (opts.steps === 'booth' || runsHubFull);
		runsTelepipeReset = opts.preset === 'hub'
			&& (opts.steps === 'telepipe-reset' || runsHubFull);
		const serverLogPath = path.join(outDirAbs, 'server.log');
		game = await startGame({ serverLogPath });
		summary.serverPort = game.serverPort;
		summary.clientPort = game.clientPort;

		browser = await chromium.launch({ headless: true });
		let page = null;

		if (runsHubFull || !runsHubWalk) {
			page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
			consoleLog = wireConsoleLog(page);
		}

		if (runsHubFull) {
			summary.auth = await runAuthStep({
				page,
				serverUrl: game.serverUrl,
				clientUrl: game.clientUrl,
				outDirAbs,
				presetName: opts.preset,
			});
		} else if (runsHubWalk) {
			summary.hubWalk = await runHubWalkStep({
				browser,
				game,
				preset,
				outDirAbs,
			});
		} else if (page) {
			summary.auth = await runAuthStep({
				page,
				serverUrl: game.serverUrl,
				clientUrl: game.clientUrl,
				outDirAbs,
				presetName: opts.preset,
			});
		}

		if (runsHubWalk && runsHubFull) {
			summary.hubWalk = await runHubWalkStep({
				browser,
				game,
				preset,
				outDirAbs,
			});
		}

		if (runsBooth && page) {
			summary.booth = await runBoothStep({ page, preset, outDirAbs });
			if (!runsHubFull) {
				summary.assertions = {
					boothDeductsGold: summary.booth.boothDeductsGold === true,
					hatSwapFree: summary.booth.hatSwapFree === true,
				};
				summary.ok = summary.assertions.boothDeductsGold && summary.assertions.hatSwapFree;
				if (!summary.ok) {
					summary.error = summary.error || 'One or more booth assertions failed';
					exitCode = 1;
				}
			}
		}

		if (runsTelepipeReset && page) {
			await assertGameProcessAlive({
				serverUrl: game.serverUrl,
				serverChild: game.serverChild,
				serverLogPath: game.serverLogPath,
			});
			summary.telepipeReset = await runTelepipeResetStep({
				page,
				preset,
				outDirAbs,
				repoRoot: REPO_ROOT,
				serverLogPath: game.serverLogPath,
				gameProcess: game,
			});
			if (!runsHubFull) {
				summary.assertions = {
					telepipeVitalsPreserved: summary.telepipeReset.telepipeVitalsPreserved === true,
				};
				summary.ok = summary.assertions.telepipeVitalsPreserved;
				if (!summary.ok) {
					summary.error = summary.error || 'telepipeVitalsPreserved assertion failed';
					exitCode = 1;
				}
			}
		}

		if (runsHubFull) {
			summary.assertions = buildHubAssertions(summary);
			const walkableOk = evaluateWalkablePresentation(summary.hubWalk).ok;
			const assertionsOk = Object.values(summary.assertions).every((value) => value === true);
			summary.ok = assertionsOk && walkableOk;
			if (!summary.ok) {
				if (!walkableOk) {
					summary.error = summary.error || 'Walkable hub presentation probes failed';
				} else {
					summary.error = summary.error || 'One or more hub assertions failed';
				}
				exitCode = 1;
			}
		}

		if (runsRoomsHub && page) {
			summary.hub = await runHubStep({ page, preset, outDirAbs });
		}

		if (runsBossEncounter && page) {
			summary.bossEncounter = await runBossEncounterStep({ page, preset, outDirAbs });
		}

		if (runsRoomsFull && page) {
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
		let errorText = err.message;
		if (game?.serverLogPath) {
			const tail = getServerLogTail(game.serverLogPath);
			if (tail && !errorText.includes(tail)) {
				errorText += `\n\n--- server.log tail ---\n${tail}`;
			}
		}
		summary.error = errorText;
		console.error(`playthrough failed: ${errorText}`);
		exitCode = 1;
		if (runsFull && !summary.assertions) {
			summary.assertions = runsHubFull
				? buildHubAssertions(summary)
				: buildAssertions(summary, preset);
		}
	} finally {
		const consoleEntries = consoleLog ? consoleLog.flush() : [];
		if (consoleLog) {
			writeConsoleLog(outDirAbs, consoleEntries);
		}
		if (runsFull) {
			if (!summary.assertions) {
				summary.assertions = runsHubFull
					? buildHubAssertions(summary)
					: buildAssertions(summary, preset);
			}
			writeFullArtifacts({ outDirAbs, summary, consoleEntries, preset });
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
	.catch((err) => {
		console.error(`playthrough failed: ${err.message}`);
		process.exit(1);
	});
