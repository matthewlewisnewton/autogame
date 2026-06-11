#!/usr/bin/env node
/**
 * Headless Playwright playthrough driver for autogame validation.
 *
 *   node harness/validate/playthrough.mjs [--preset rooms|hub] [--out <dir>] [--steps <slice>]
 *
 * When --out is omitted, output defaults to game/validation/<preset>/ (e.g. --preset open-plaza
 * → game/validation/open-plaza/). Explicit --out overrides the preset default.
 *
 * Rooms / stage preset steps: auth, hub | deploy, boss-encounter, full,
 *   telepipe-new-sortie (stage presets with telepipeScenario).
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
	defeatAllEnemies,
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
import {
	runSlowBurnExercise,
	runPurifyingPulseExercise,
	runWindupCardExercise,
} from './lib/cardExercise.mjs';
import { runEmberBurnStep, runGlacialSlowStep, runCardMechanicsStep } from './lib/cardMechanics.mjs';
import { runSlipperyFloorStep } from './lib/slipperyFloor.mjs';
import {
	runStageBossTelepipeNewSortieStep,
	runSpireAscentTelepipeNewSortieStep,
	runTelepipeResetStep,
} from './lib/telepipe.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const PRESET_MODULES = {
	rooms: () => import('./presets/rooms.mjs'),
	hub: () => import('./presets/hub.mjs'),
	'spire-ascent': () => import('./presets/spire-ascent.mjs'),
	'open-plaza': () => import('./presets/open-plaza.mjs'),
	'sunken-canyon': () => import('./presets/sunken-canyon.mjs'),
	fire: () => import('./presets/fire.mjs'),
	ice: () => import('./presets/ice.mjs'),
};

const STAGE_PRESETS = new Set(['rooms', 'open-plaza', 'spire-ascent', 'sunken-canyon', 'fire', 'ice']);
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

function assertStepsForPreset(presetName, steps, presetConfig = null) {
	if (presetName === 'hub') {
		if (!HUB_PRESET_STEPS.has(steps)) {
			throw new Error(`Unknown --steps value "${steps}" for preset hub — expected: ${[...HUB_PRESET_STEPS].join(', ')}`);
		}
		return;
	}
	if (!STAGE_PRESETS.has(presetName)) {
		throw new Error(`Unknown preset "${presetName}"`);
	}
	const stageSteps = new Set([
		'auth',
		...ROOMS_HUB_STEPS,
		...ROOMS_BOSS_ENCOUNTER_STEPS,
		...ROOMS_FULL_STEPS,
	]);
	if (presetConfig?.telepipeScenario) {
		stageSteps.add('telepipe-new-sortie');
	}
	if (!stageSteps.has(steps)) {
		throw new Error(`Unknown --steps value "${steps}" for preset ${presetName} — expected: ${[...stageSteps].join(', ')}`);
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

async function captureBossEncounterUiProbe(page) {
	return page.evaluate(() => {
		const hud = document.getElementById('boss-encounter-hud');
		const nameEl = document.getElementById('boss-encounter-name');
		const fillEl = document.getElementById('boss-encounter-hp-fill');
		const harness = window.__AUTOGAME_HARNESS_STATE__?.();
		const hudVisible = !!hud
			&& !hud.classList.contains('hidden')
			&& hud.getAttribute('aria-hidden') !== 'true';
		const bossName = nameEl?.textContent?.trim() ?? '';
		let hpFillWidthPct = null;
		if (fillEl) {
			const match = (fillEl.style.width || '').match(/^([\d.]+)%$/);
			if (match) hpFillWidthPct = Number(match[1]);
		}
		if (hpFillWidthPct == null && harness?.bossEncounter?.hpPct != null) {
			hpFillWidthPct = harness.bossEncounter.hpPct;
		}
		return {
			hudVisible,
			bossName,
			hpFillWidthPct,
			encounterLocked: harness?.encounter?.locked === true,
			encounterPhase: harness?.encounter?.phase ?? null,
		};
	});
}

async function captureBossVisualIdentityProbe(page, bossType) {
	return page.evaluate((expectedBossType) => {
		if (typeof window.__captureBossVisualIdentityForTest === 'function') {
			return window.__captureBossVisualIdentityForTest(expectedBossType);
		}
		const harness = window.__AUTOGAME_HARNESS_STATE__?.();
		const bossEnemyId = harness?.encounter?.bossEnemyId ?? null;
		const boss = (harness?.enemyHp || []).find((e) => e.id === bossEnemyId && e.hp > 0)
			|| (harness?.enemyHp || []).find((e) => e.type === expectedBossType && e.hp > 0)
			|| null;
		const adds = (harness?.enemyHp || []).filter(
			(e) => e.hp > 0 && e.id !== boss?.id && e.type !== expectedBossType,
		);
		let nearestAdd = null;
		let nearestDist = Infinity;
		if (boss) {
			for (const add of adds) {
				const dist = Math.hypot((add.x ?? 0) - (boss.x ?? 0), (add.z ?? 0) - (boss.z ?? 0));
				if (dist < nearestDist) {
					nearestDist = dist;
					nearestAdd = add;
				}
			}
		}
		const nearestAddType = nearestAdd?.type ?? null;
		const bossDistinctFromAdds = !!boss
			&& !!nearestAdd
			&& boss.type !== nearestAddType
			&& (boss.maxHp ?? 0) > (nearestAdd.maxHp ?? 0);
		const bossRenderScale = boss && typeof window.__getEnemyRenderScaleForTest === 'function'
			? window.__getEnemyRenderScaleForTest(boss.id)?.scale ?? null
			: null;
		const addRenderScale = nearestAdd && typeof window.__getEnemyRenderScaleForTest === 'function'
			? window.__getEnemyRenderScaleForTest(nearestAdd.id)?.scale ?? null
			: null;
		return {
			bossType: boss?.type ?? expectedBossType,
			bossEnemyId: boss?.id ?? bossEnemyId,
			nearestAddType,
			bossDistinctFromAdds,
			bossRenderScale,
			addRenderScale,
		};
	}, bossType);
}

async function waitForBossVisualIdentityProbeReady(page, bossType, timeoutMs = 15000) {
	await page.waitForFunction((expectedBoss) => {
		if (typeof window.__captureBossVisualIdentityForTest !== 'function') return false;
		const probe = window.__captureBossVisualIdentityForTest(expectedBoss);
		return probe?.bossDistinctFromAdds === true;
	}, bossType, { timeout: timeoutMs });
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

	await waitForHubLobby(page).catch(async () => {
		await failWithHarness(page, 'Ship hub lobby not ready after create channel');
	});

	await page.evaluate(() => {
		if (typeof window.showGameLobby === 'function') {
			window.showGameLobby();
		}
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

	const objectiveType = preset.objectiveType ?? 'stage_boss';
	if (objectiveType === 'defeat_enemies') {
		await page.waitForFunction(() => {
			const h = window.__AUTOGAME_HARNESS_STATE__?.();
			return h
				&& h.phase === 'playing'
				&& h.cardHandVisible === true
				&& h.objective?.type === 'defeat_enemies';
		}, { timeout: 25000 }).catch(async () => {
			await failWithHarness(page, `${deployRunLabel(preset)} defeat_enemies run did not start after ${preset.deployScenario}`);
		});

		const playingHarness = await readHarness(page);
		if (preset.layoutProfile && playingHarness?.layout?.profile !== preset.layoutProfile) {
			await failWithHarness(page, `Expected layout.profile ${preset.layoutProfile}`);
		}
		const liveEnemyCount = (playingHarness?.enemyHp || []).filter((enemy) => enemy.hp > 0).length;
		if (liveEnemyCount === 0) {
			await failWithHarness(page, 'Expected live enemies after defeat_enemies deploy');
		}

		const entryScreenshot = await writeScreenshot(page, outDirAbs, '02-level-entry');
		const levelEntryFloor = await captureFloorAlignmentProbe(page);

		return {
			hubScreenshot: path.relative(REPO_ROOT, hubScreenshot),
			entryScreenshot: path.relative(REPO_ROOT, entryScreenshot),
			deployScenario: preset.deployScenario,
			deployOk: true,
			objectiveType: playingHarness?.objective?.type ?? null,
			layoutProfile: playingHarness?.layout?.profile ?? null,
			liveEnemyCount,
			enemyTypes: (playingHarness?.enemyHp || []).map((e) => e.type),
			floorAlignment: levelEntryFloor ? { levelEntry: levelEntryFloor } : {},
		};
	}

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

async function runDefeatEnemiesCombatStep({ page, preset, outDirAbs }) {
	await enableGodmode(page);
	if (preset.nearAddsScenario) {
		await requestScenario(page, preset.nearAddsScenario);
	}

	const preCombatHarness = await readHarness(page);
	const preLiveEnemyCount = (preCombatHarness?.enemyHp || []).filter((enemy) => enemy.hp > 0).length;
	if (preLiveEnemyCount === 0) {
		throw new Error(`No live enemies for mid-combat capture (nearAddsScenario=${preset.nearAddsScenario ?? 'none'}): ${JSON.stringify(preCombatHarness)}`);
	}

	let midCombatScreenshot = null;
	const floorAlignment = {};
	const midCombatBasename = preset.slipperyFloorScenario ? '04-mid-combat' : '03-mid-combat';
	const afterCombatHarness = await defeatAllEnemies(page, {
		timeoutMs: preset.addsTimeoutMs ?? 90000,
		minEnemiesLeft: 1,
		onMidCombat: async () => {
			const midHarness = await readHarness(page);
			const midLiveCount = (midHarness?.enemyHp || []).filter((enemy) => enemy.hp > 0).length;
			if (midLiveCount === 0) {
				throw new Error('onMidCombat requested with zero live enemies');
			}
			const shotPath = await writeScreenshot(page, outDirAbs, midCombatBasename);
			midCombatScreenshot = path.relative(REPO_ROOT, shotPath);
			const midCombatFloor = await captureFloorAlignmentProbe(page);
			if (midCombatFloor) floorAlignment.midCombat = midCombatFloor;
		},
	});

	if (!midCombatScreenshot) {
		throw new Error('defeatAllEnemies finished without capturing mid-combat screenshot');
	}

	const postLiveEnemyCount = (afterCombatHarness?.enemyHp || []).filter((enemy) => enemy.hp > 0).length;

	return {
		midCombatScreenshot,
		preLiveEnemyCount,
		postLiveEnemyCount,
		enemiesDefeated: preLiveEnemyCount > postLiveEnemyCount,
		probes: {
			...(Object.keys(floorAlignment).length > 0 ? { floorAlignment } : {}),
		},
	};
}

async function runStageBossMidCombatProbeStep({ page, preset, outDirAbs }) {
	const { bossType, nearAddsScenario, addTypes } = preset;

	await enableGodmode(page);
	if (nearAddsScenario) {
		await requestScenario(page, nearAddsScenario);
	}

	const preCombatHarness = await readHarness(page);
	if (liveAdds(preCombatHarness, bossType, addTypes).length === 0) {
		throw new Error(`No live adds for mid-combat capture (nearAddsScenario=${nearAddsScenario ?? 'none'}): ${JSON.stringify(preCombatHarness)}`);
	}

	const shotPath = await writeScreenshot(page, outDirAbs, '03-mid-combat');
	const midCombatScreenshot = path.relative(REPO_ROOT, shotPath);
	const floorAlignment = {};
	const midCombatFloor = await captureFloorAlignmentProbe(page);
	if (midCombatFloor) floorAlignment.midCombat = midCombatFloor;

	// Training Caverns clears non-boss enemies on encounter activation; capture
	// boss-vs-add visuals while dormant boss and live adds still coexist.
	let bossVisualIdentity = null;
	if (bossType === 'annex_overseer') {
		const midHarness = await readHarness(page);
		if (liveAdds(midHarness, bossType, addTypes).length === 0) {
			throw new Error('mid-combat boss visual probe requested with zero live adds');
		}
		await waitForBossVisualIdentityProbeReady(page, bossType);
		bossVisualIdentity = await captureBossVisualIdentityProbe(page, bossType);
		if (!bossVisualIdentity?.bossDistinctFromAdds) {
			throw new Error(
				`bossVisualIdentity mid-combat probe missing distinct boss vs add: ${JSON.stringify(bossVisualIdentity)}`,
			);
		}
	}

	return {
		midCombatScreenshot,
		probes: {
			...(Object.keys(floorAlignment).length > 0 ? { floorAlignment } : {}),
			...(bossVisualIdentity ? { bossVisualIdentity } : {}),
		},
	};
}

/** @deprecated Use runStageBossMidCombatProbeStep */
const runSunkenCanyonMidCombatProbeStep = runStageBossMidCombatProbeStep;

async function runStageBossRevalidateFullStep({
	page,
	preset,
	outDirAbs,
	game,
	telepipeSummaryKey,
}) {
	const midCombatPart = await runStageBossMidCombatProbeStep({ page, preset, outDirAbs });
	const cardExerciseOpts = {
		outDir: outDirAbs,
		repoRoot: REPO_ROOT,
		layoutProfile: preset.layoutProfile ?? 'sunken-canyon',
		preset,
	};
	const cardExercises = {
		slowBurn: await runSlowBurnExercise(page, cardExerciseOpts),
		purifyingPulse: await runPurifyingPulseExercise(page, cardExerciseOpts),
		windup: await runWindupCardExercise(page, {
			...cardExerciseOpts,
			cardId: preset.windupCardId ?? 'magma_greatsword',
			scenario: preset.windupScenario ?? 'magma-windup-ready',
		}),
	};
	const telepipe = await runStageBossTelepipeNewSortieStep({
		page,
		preset,
		outDirAbs,
		repoRoot: REPO_ROOT,
		serverLogPath: game.serverLogPath,
		gameProcess: game,
		fromPlaying: true,
	});
	const bossPart = await runBossEncounterStep({
		page,
		preset,
		outDirAbs,
		skipMidCombatCapture: true,
	});
	const bossVisualIdentity = bossPart.probes?.bossVisualIdentity
		?? midCombatPart.probes?.bossVisualIdentity
		?? null;
	const bossEncounter = {
		...bossPart,
		midCombatScreenshot: midCombatPart.midCombatScreenshot,
		probes: {
			...(bossPart.probes || {}),
			bossVisualIdentity,
			floorAlignment: {
				...(midCombatPart.probes?.floorAlignment || {}),
				...(bossPart.probes?.floorAlignment || {}),
			},
		},
	};
	const victory = await runVictoryStep({ page, preset, outDirAbs });
	return {
		bossEncounter,
		cardExercises,
		[telepipeSummaryKey]: telepipe,
		victory,
	};
}

async function runBossEncounterStep({ page, preset, outDirAbs, skipMidCombatCapture = false }) {
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
		throw new Error(`No live adds for boss encounter (nearAddsScenario=${nearAddsScenario ?? 'none'}): ${JSON.stringify(preCombatHarness)}`);
	}

	let midCombatScreenshot = null;
	const floorAlignment = {};
	// Training Caverns clears non-boss enemies on encounter activation; capture
	// boss-vs-add visuals while dormant boss and live adds still coexist.
	const captureBossVisualAtMidCombat = bossType === 'annex_overseer';
	let bossVisualIdentity = null;
	const onMidCombat = skipMidCombatCapture ? null : async () => {
		const midHarness = await readHarness(page);
		if (liveAdds(midHarness, bossType, addTypes).length === 0) {
			throw new Error('onMidCombat requested with zero live adds');
		}
		const midCombatBasename = preset.midCombatScreenshot ?? '03-mid-combat';
		const shotPath = await writeScreenshot(page, outDirAbs, midCombatBasename);
		midCombatScreenshot = path.relative(REPO_ROOT, shotPath);
		const midCombatFloor = await captureFloorAlignmentProbe(page);
		if (midCombatFloor) floorAlignment.midCombat = midCombatFloor;
		if (captureBossVisualAtMidCombat) {
			await waitForBossVisualIdentityProbeReady(page, bossType);
			bossVisualIdentity = await captureBossVisualIdentityProbe(page, bossType);
		}
	};
	const afterAddsHarness = await defeatAdds(page, {
		bossType,
		timeoutMs: preset.addsTimeoutMs ?? 90000,
		minAddsLeft: 0,
		addTypes,
		onMidCombat,
	});

	if (!skipMidCombatCapture && !midCombatScreenshot) {
		throw new Error('defeatAdds finished without capturing mid-combat screenshot');
	}

	assertDormantBoss(afterAddsHarness, bossType);
	const dormantProbe = buildEncounterProbe(afterAddsHarness, bossType, addTypes);
	const dormantBasename = preset.bossDormantScreenshot ?? '04-boss-dormant';
	const dormantScreenshotPath = await writeScreenshot(page, outDirAbs, dormantBasename);
	const dormantScreenshot = path.relative(REPO_ROOT, dormantScreenshotPath);
	const dormantFloor = await captureFloorAlignmentProbe(page);
	if (dormantFloor) floorAlignment.bossDormant = dormantFloor;

	if (bossApproachScenario) {
		await requestScenario(page, bossApproachScenario);
		const approachHarness = await readHarness(page);
		assertDormantBoss(approachHarness, bossType);
	}

	// Prefer a preset-driven encounter-trigger debug scenario (which activates the dormant
	// boss AND leaves a live add beside it for the bossDistinctFromAdds probe, since normal
	// proximity activation clears non-boss enemies). Fall back to the keyboard walk-in for
	// presets that do not provide one.
	const encounterTriggerByApproach = {
		'canyon-descent-boss-approach': 'canyon-descent-encounter-trigger',
		'spire-ascent-boss-approach': 'spire-ascent-encounter-trigger',
		'frost-crossing-boss-approach': 'frost-crossing-encounter-trigger',
	};
	const encounterTriggerScenario = preset.encounterTriggerScenario
		?? encounterTriggerByApproach[bossApproachScenario];
	let activeHarness;
	if (encounterTriggerScenario) {
		await requestScenario(page, encounterTriggerScenario);
		activeHarness = await readHarness(page);
	} else {
		activeHarness = await activateEncounter(page, {
			bossType,
			triggerRadius: encounterTriggerRadius,
			timeoutMs: preset.encounterTimeoutMs ?? 60000,
		});
	}
	if (activeHarness?.encounter?.phase !== 'active' || activeHarness?.encounter?.locked !== true) {
		throw new Error(`Encounter did not reach active/locked: ${JSON.stringify(activeHarness?.encounter)}`);
	}

	const activeProbe = buildEncounterProbe(activeHarness, bossType, addTypes);
	const activeBasename = preset.bossActiveScreenshot ?? '05-boss-active';
	const activeScreenshotPath = await writeScreenshot(page, outDirAbs, activeBasename);
	const activeScreenshot = path.relative(REPO_ROOT, activeScreenshotPath);
	const activeFloor = await captureFloorAlignmentProbe(page);
	if (activeFloor) floorAlignment.bossActive = activeFloor;
	const bossEncounterUi = await captureBossEncounterUiProbe(page);
	if (!captureBossVisualAtMidCombat) {
		bossVisualIdentity = await captureBossVisualIdentityProbe(page, bossType);
	} else if (!skipMidCombatCapture && !bossVisualIdentity?.bossDistinctFromAdds) {
		throw new Error(
			`bossVisualIdentity mid-combat probe missing distinct boss vs add: ${JSON.stringify(bossVisualIdentity)}`,
		);
	}

	return {
		midCombatScreenshot,
		dormantScreenshot,
		activeScreenshot,
		encounterPhase: activeHarness.encounter.phase,
		encounterLocked: activeHarness.encounter.locked,
		probes: {
			dormant: dormantProbe,
			active: activeProbe,
			bossEncounterUi,
			bossVisualIdentity,
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

function buildDefeatEnemiesVictoryProbe(harness) {
	return {
		runStatus: harness?.runStatus ?? null,
		runObjectiveComplete: harness?.runObjectiveComplete ?? false,
		lastRunSummaryStatus: harness?.lastRunSummary?.status ?? null,
	};
}

async function waitForDefeatEnemiesVictoryState(page, { timeoutMs = 30000 } = {}) {
	await page.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		return h
			&& h.runStatus === 'victory'
			&& h.runObjectiveComplete === true
			&& h.lastRunSummary?.status === 'victory';
	}, { timeout: timeoutMs }).catch(async () => {
		await failWithHarness(page, 'Victory state not reached');
	});
	return readHarness(page);
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
	const objectiveType = preset.objectiveType ?? 'stage_boss';

	if (objectiveType === 'defeat_enemies') {
		if (preset.lastEnemyScenario) {
			await requestScenario(page, preset.lastEnemyScenario);
		}

		const afterEnemiesHarness = await defeatAllEnemies(page, {
			timeoutMs: preset.bossDefeatTimeoutMs ?? 180000,
			minEnemiesLeft: 0,
		});
		const afterEnemiesProbe = buildDefeatEnemiesVictoryProbe(afterEnemiesHarness);
		const objectiveBasename = preset.objectiveCompleteScreenshot ?? '06-objective-complete';
		const victoryBasename = preset.victoryScreenshot ?? '07-victory';
		const objectiveCompleteScreenshotPath = await writeScreenshot(page, outDirAbs, objectiveBasename);

		const victoryHarness = await waitForDefeatEnemiesVictoryState(page, {
			timeoutMs: preset.victoryTimeoutMs ?? 30000,
		});
		await waitForSortieCompleteOverlay(page, {
			timeoutMs: preset.victoryTimeoutMs ?? 30000,
		});
		const victoryProbe = buildDefeatEnemiesVictoryProbe(victoryHarness);
		const victoryScreenshotPath = await writeScreenshot(page, outDirAbs, victoryBasename);

		return {
			objectiveCompleteScreenshot: path.relative(REPO_ROOT, objectiveCompleteScreenshotPath),
			victoryScreenshot: path.relative(REPO_ROOT, victoryScreenshotPath),
			probes: {
				afterEnemies: afterEnemiesProbe,
				victory: victoryProbe,
			},
		};
	}

	const { bossType, bossLowHpScenario } = preset;

	if (bossLowHpScenario) {
		await requestScenario(page, bossLowHpScenario);
	}

	const afterBossHarness = await defeatBoss(page, {
		bossType,
		timeoutMs: preset.bossDefeatTimeoutMs ?? 180000,
	});
	const afterBossProbe = buildVictoryProbe(afterBossHarness);
	const bossDefeatedBasename = preset.bossDefeatedScreenshot ?? '06-boss-defeated';
	const bossDefeatedScreenshotPath = await writeScreenshot(page, outDirAbs, bossDefeatedBasename);

	const victoryHarness = await waitForVictoryState(page, {
		timeoutMs: preset.victoryTimeoutMs ?? 30000,
	});
	await waitForSortieCompleteOverlay(page, {
		timeoutMs: preset.victoryTimeoutMs ?? 30000,
	});
	const victoryProbe = buildVictoryProbe(victoryHarness);
	const victoryBasename = preset.victoryScreenshot ?? '07-victory';
	const victoryScreenshotPath = await writeScreenshot(page, outDirAbs, victoryBasename);

	return {
		bossDefeatedScreenshot: path.relative(REPO_ROOT, bossDefeatedScreenshotPath),
		victoryScreenshot: path.relative(REPO_ROOT, victoryScreenshotPath),
		probes: {
			afterBoss: afterBossProbe,
			victory: victoryProbe,
		},
	};
}

function isNewContentPreset(preset) {
	return preset?.newContentFull === true;
}

function isStageRevalidationPreset(preset, summary) {
	const profile = preset?.layoutProfile ?? summary?.preset;
	return profile === 'sunken-canyon' || profile === 'spire-ascent'
		|| summary?.preset === 'sunken-canyon' || summary?.preset === 'spire-ascent';
}

function telepipeSummaryKey(preset, summary) {
	if (summary?.preset === 'rooms') return 'roomsTelepipe';
	const profile = preset?.layoutProfile ?? summary?.preset;
	return profile === 'spire-ascent' || summary?.preset === 'spire-ascent'
		? 'spireTelepipe'
		: 'canyonTelepipe';
}

function isRoomsPreset(preset, summary) {
	return summary?.preset === 'rooms';
}

function buildBossEncounterUiAssertions(summary, { requireAnnexOverseer = false } = {}) {
	const bossEncounterUi = summary.bossEncounter?.probes?.bossEncounterUi;
	const bossVisualIdentity = summary.bossEncounter?.probes?.bossVisualIdentity;
	return {
		bossEncounterUiVisible: bossEncounterUi?.hudVisible === true
			&& typeof bossEncounterUi?.bossName === 'string'
			&& bossEncounterUi.bossName.length > 0
			&& bossEncounterUi?.encounterLocked === true
			&& bossEncounterUi?.encounterPhase === 'active',
		bossDistinctFromAdds: bossVisualIdentity?.bossDistinctFromAdds === true
			&& (!requireAnnexOverseer || bossVisualIdentity?.bossType === 'annex_overseer'),
	};
}

function isIceStageBossPreset(preset) {
	return preset?.questId === 'frost_crossing'
		&& (preset.objectiveType ?? 'stage_boss') === 'stage_boss';
}

function buildAssertions(summary, preset) {
	const objectiveType = preset.objectiveType ?? 'stage_boss';

	if (objectiveType === 'defeat_enemies') {
		const layoutDeployed = summary.hub?.deployOk === true
			&& summary.hub?.objectiveType === 'defeat_enemies'
			&& (!preset.layoutProfile || summary.hub?.layoutProfile === preset.layoutProfile);
		const combat = summary.defeatEnemiesCombat;
		const enemiesCleared = combat?.enemiesDefeated === true
			&& (combat?.postLiveEnemyCount ?? 1) <= 1;
		const victoryProbe = summary.victory?.probes?.victory;
		const victoryFired = victoryProbe?.runStatus === 'victory'
			&& victoryProbe?.runObjectiveComplete === true
			&& victoryProbe?.lastRunSummaryStatus === 'victory';
		const assertions = {
			layoutDeployed,
			enemiesCleared,
			victoryFired,
		};
		if (preset.questId === 'frost_crossing' || preset.slipperyFloorScenario) {
			assertions.slipperyFloorOk = summary.slipperyFloor?.ok === true;
		}
		if (preset.questId === 'frost_crossing') {
			assertions.glacialSlowApplied = summary.glacialSlow?.glacialSlowApplied === true;
		}
		if (preset.emberBurnScenario || preset.questId === 'ember_descent') {
			assertions.emberBurnApplied = summary.emberBurn?.burnTickDamageApplied === true;
		}
		if (preset.cardMechanicsScenarios && Object.keys(preset.cardMechanicsScenarios).length > 0) {
			assertions.cardMechanicsOk = summary.cardMechanics?.ok === true;
		}
		if (preset.telepipeScenario || summary.telepipeReset) {
			assertions.telepipeVitalsPreserved = summary.telepipeReset?.telepipeVitalsPreserved === true;
			assertions.cardChargesResetOnFreshSortie = summary.telepipeReset?.cardChargesResetOnFreshSortie === true;
		}
		return assertions;
	}

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
	const base = {
		bossSpawned,
		encounterActivated,
		bossDefeated,
		victoryFired,
	};
	if (isRoomsPreset(preset, summary)) {
		return {
			...base,
			...buildBossEncounterUiAssertions(summary, { requireAnnexOverseer: true }),
			slowBurnMutuallyExclusive: summary.cardExercises?.slowBurn?.slowBurnMutuallyExclusive === true,
			healCleanseApplied: summary.cardExercises?.purifyingPulse?.healCleanseApplied === true,
			windupTelegraphActive: summary.cardExercises?.windup?.windupTelegraphActive === true,
			telepipeVitalsPreserved: summary.roomsTelepipe?.telepipeVitalsPreserved === true,
			cardChargesResetOnNewSortie: summary.roomsTelepipe?.cardChargesResetOnNewSortie === true,
		};
	}
	if (isIceStageBossPreset(preset)) {
		const telepipe = summary.telepipeReset;
		return {
			...base,
			...buildBossEncounterUiAssertions(summary),
			slipperyFloorOk: summary.slipperyFloor?.ok === true,
			glacialSlowApplied: summary.glacialSlow?.glacialSlowApplied === true,
			cardMechanicsOk: summary.cardMechanics?.ok === true,
			telepipeVitalsPreserved: telepipe?.telepipeVitalsPreserved === true,
			cardChargesResetOnFreshSortie: telepipe?.cardChargesResetOnFreshSortie === true,
		};
	}
	if (!isNewContentPreset(preset) && !isStageRevalidationPreset(preset, summary)) {
		return base;
	}
	const telepipeKey = telepipeSummaryKey(preset, summary);
	const questTelepipe = summary[telepipeKey];
	return {
		...base,
		...buildBossEncounterUiAssertions(summary),
		slowBurnMutuallyExclusive: summary.cardExercises?.slowBurn?.slowBurnMutuallyExclusive === true,
		healCleanseApplied: summary.cardExercises?.purifyingPulse?.healCleanseApplied === true,
		windupTelegraphActive: summary.cardExercises?.windup?.windupTelegraphActive === true,
		telepipeVitalsPreserved: questTelepipe?.telepipeVitalsPreserved === true,
		cardChargesResetOnNewSortie: questTelepipe?.cardChargesResetOnNewSortie === true,
	};
}

function buildAssertionFailureDetail(summary, preset) {
	const assertions = summary.assertions || {};
	const failed = Object.entries(assertions).filter(([, value]) => value !== true).map(([key]) => key);
	if (failed.length === 0) return 'One or more assertions failed';
	const details = [];
	if (failed.includes('bossEncounterUiVisible')) {
		details.push(`bossEncounterUi=${JSON.stringify(summary.bossEncounter?.probes?.bossEncounterUi)}`);
	}
	if (failed.includes('bossDistinctFromAdds')) {
		details.push(`bossVisualIdentity=${JSON.stringify(summary.bossEncounter?.probes?.bossVisualIdentity)}`);
	}
	if (failed.includes('slowBurnMutuallyExclusive')) {
		details.push(`slowBurn=${JSON.stringify(summary.cardExercises?.slowBurn)}`);
	}
	if (failed.includes('healCleanseApplied')) {
		details.push(`purifyingPulse=${JSON.stringify(summary.cardExercises?.purifyingPulse)}`);
	}
	if (failed.includes('windupTelegraphActive')) {
		details.push(`windup=${JSON.stringify(summary.cardExercises?.windup)}`);
	}
	if (failed.includes('telepipeVitalsPreserved') || failed.includes('cardChargesResetOnNewSortie')) {
		const telepipeKey = telepipeSummaryKey(preset, summary);
		details.push(`${telepipeKey}=${JSON.stringify(summary[telepipeKey])}`);
	}
	if (failed.includes('slipperyFloorOk')) {
		details.push(`slipperyFloor=${JSON.stringify(summary.slipperyFloor)}`);
	}
	if (failed.includes('glacialSlowApplied')) {
		details.push(`glacialSlow=${JSON.stringify(summary.glacialSlow)}`);
	}
	const base = `Assertion(s) failed: ${failed.join(', ')}`;
	return details.length > 0 ? `${base} — ${details.join('; ')}` : base;
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
	if (summary.slipperyFloor?.screenshot) shots.push(summary.slipperyFloor.screenshot);
	if (summary.defeatEnemiesCombat?.midCombatScreenshot) shots.push(summary.defeatEnemiesCombat.midCombatScreenshot);
	if (summary.glacialSlow?.screenshot) shots.push(summary.glacialSlow.screenshot);
	if (summary.emberBurn?.screenshot) shots.push(summary.emberBurn.screenshot);
	if (summary.cardMechanics?.probes?.burn?.screenshot) shots.push(summary.cardMechanics.probes.burn.screenshot);
	if (summary.bossEncounter?.midCombatScreenshot) shots.push(summary.bossEncounter.midCombatScreenshot);
	if (summary.bossEncounter?.dormantScreenshot) shots.push(summary.bossEncounter.dormantScreenshot);
	if (summary.bossEncounter?.activeScreenshot) shots.push(summary.bossEncounter.activeScreenshot);
	if (summary.victory?.objectiveCompleteScreenshot) shots.push(summary.victory.objectiveCompleteScreenshot);
	if (summary.victory?.bossDefeatedScreenshot) shots.push(summary.victory.bossDefeatedScreenshot);
	if (summary.victory?.victoryScreenshot) shots.push(summary.victory.victoryScreenshot);
	if (summary.telepipeReset?.beforeScreenshot) shots.push(summary.telepipeReset.beforeScreenshot);
	if (summary.telepipeReset?.afterScreenshot) shots.push(summary.telepipeReset.afterScreenshot);
	if (summary.cardExercises?.slowBurn?.screenshot) shots.push(summary.cardExercises.slowBurn.screenshot);
	if (summary.cardExercises?.purifyingPulse?.screenshot) shots.push(summary.cardExercises.purifyingPulse.screenshot);
	if (summary.cardExercises?.windup?.screenshot) shots.push(summary.cardExercises.windup.screenshot);
	if (summary.canyonTelepipe?.beforeScreenshot) shots.push(summary.canyonTelepipe.beforeScreenshot);
	if (summary.canyonTelepipe?.afterScreenshot) shots.push(summary.canyonTelepipe.afterScreenshot);
	if (summary.roomsTelepipe?.beforeScreenshot) shots.push(summary.roomsTelepipe.beforeScreenshot);
	if (summary.roomsTelepipe?.afterScreenshot) shots.push(summary.roomsTelepipe.afterScreenshot);
	if (summary.spireTelepipe?.beforeScreenshot) shots.push(summary.spireTelepipe.beforeScreenshot);
	if (summary.spireTelepipe?.afterScreenshot) shots.push(summary.spireTelepipe.afterScreenshot);
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
		...(summary.defeatEnemiesCombat?.probes?.floorAlignment || {}),
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
		const { floorAlignment: _defeatFloorAlignment, ...defeatProbes } = summary.defeatEnemiesCombat?.probes || {};
		const { floorAlignment: _bossFloorAlignment, ...encounterProbes } = summary.bossEncounter?.probes || {};
		const stageProbes = { ...defeatProbes, ...encounterProbes };
		const floorAlignment = mergeFloorAlignmentProbes(summary);
		if (floorAlignment) {
			stageProbes.floorAlignment = floorAlignment;
		}
		probes = {
			...stageProbes,
			...(summary.victory?.probes || {}),
			...(summary.slipperyFloor ? { slipperyFloor: summary.slipperyFloor } : {}),
			...(summary.glacialSlow ? { glacialSlow: summary.glacialSlow } : {}),
			...(summary.emberBurn ? { emberBurn: summary.emberBurn } : {}),
			...(summary.cardMechanics ? { cardMechanics: summary.cardMechanics } : {}),
			...(summary.telepipeReset ? {
				telepipeReset: {
					preSuspend: summary.telepipeReset.preSuspend ?? null,
					postDeploy: summary.telepipeReset.postDeploy ?? null,
					telepipeVitalsPreserved: summary.telepipeReset.telepipeVitalsPreserved ?? null,
					cardChargesResetOnFreshSortie: summary.telepipeReset.cardChargesResetOnFreshSortie ?? null,
				},
			} : {}),
			...(summary.cardExercises ? { cardExercises: summary.cardExercises } : {}),
			...(summary.canyonTelepipe ? {
				canyonTelepipe: {
					preSuspend: summary.canyonTelepipe.preSuspend ?? null,
					postDeploy: summary.canyonTelepipe.postDeploy ?? null,
					telepipeVitalsPreserved: summary.canyonTelepipe.telepipeVitalsPreserved ?? null,
					cardChargesResetOnNewSortie: summary.canyonTelepipe.cardChargesResetOnNewSortie ?? null,
				},
			} : {}),
			...(summary.roomsTelepipe ? {
				roomsTelepipe: {
					preSuspend: summary.roomsTelepipe.preSuspend ?? null,
					postDeploy: summary.roomsTelepipe.postDeploy ?? null,
					telepipeVitalsPreserved: summary.roomsTelepipe.telepipeVitalsPreserved ?? null,
					cardChargesResetOnNewSortie: summary.roomsTelepipe.cardChargesResetOnNewSortie ?? null,
				},
			} : {}),
			...(summary.spireTelepipe ? {
				spireTelepipe: {
					preSuspend: summary.spireTelepipe.preSuspend ?? null,
					postDeploy: summary.spireTelepipe.postDeploy ?? null,
					telepipeVitalsPreserved: summary.spireTelepipe.telepipeVitalsPreserved ?? null,
					cardChargesResetOnNewSortie: summary.spireTelepipe.cardChargesResetOnNewSortie ?? null,
				},
			} : {}),
		};
		findings = renderFindings({
			ok: summary.ok === true,
			preset: summary.preset,
			questId: preset?.questId,
			objectiveType: preset?.objectiveType ?? 'stage_boss',
			findingsTitle: preset?.findingsTitle,
			bossSpawnLabel: preset?.bossSpawnLabel,
			bossType: preset?.bossType,
			assertions: summary.assertions || {},
			bossEncounterUi: summary.bossEncounter?.probes?.bossEncounterUi ?? null,
			bossVisualIdentity: summary.bossEncounter?.probes?.bossVisualIdentity ?? null,
			cardExercises: summary.cardExercises ?? null,
			canyonTelepipe: summary.canyonTelepipe ?? null,
			roomsTelepipe: summary.roomsTelepipe ?? null,
			spireTelepipe: summary.spireTelepipe ?? null,
			floorAlignment,
			emberBurn: summary.emberBurn || null,
			slipperyFloor: summary.slipperyFloor || null,
			glacialSlow: summary.glacialSlow || null,
			cardMechanics: summary.cardMechanics || null,
			telepipeReset: summary.telepipeReset || null,
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
	let runsQuestTelepipeReset = false;
	let runsSpireTelepipeNewSortie = false;
	const summary = {
		ok: true,
		preset: opts.preset,
		steps: opts.steps,
		outDir: path.relative(REPO_ROOT, outDirAbs),
	};

	try {
		preset = await loadPreset(opts.preset);
		assertStepsForPreset(opts.preset, opts.steps, preset);
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
		runsQuestTelepipeReset = runsRoomsFull
			&& (opts.preset === 'fire' || opts.preset === 'ice')
			&& !!preset.telepipeScenario;
		runsSpireTelepipeNewSortie = opts.preset === 'spire-ascent'
			&& opts.steps === 'telepipe-new-sortie';
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

		if (runsSpireTelepipeNewSortie && page) {
			await assertGameProcessAlive({
				serverUrl: game.serverUrl,
				serverChild: game.serverChild,
				serverLogPath: game.serverLogPath,
			});
			summary.spireTelepipe = await runSpireAscentTelepipeNewSortieStep({
				page,
				preset,
				outDirAbs,
				repoRoot: REPO_ROOT,
				serverLogPath: game.serverLogPath,
				gameProcess: game,
			});
			summary.assertions = {
				telepipeVitalsPreserved: summary.spireTelepipe.telepipeVitalsPreserved === true,
				cardChargesResetOnNewSortie: summary.spireTelepipe.cardChargesResetOnNewSortie === true,
			};
			summary.ok = Object.values(summary.assertions).every((value) => value === true);
			if (!summary.ok) {
				summary.error = summary.error || 'One or more telepipe-new-sortie assertions failed';
				exitCode = 1;
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

		if (runsRoomsFull && page && preset.slipperyFloorScenario) {
			summary.slipperyFloor = await runSlipperyFloorStep({
				page,
				preset,
				outDirAbs,
				repoRoot: REPO_ROOT,
			});
		}

		const runsNewContentFull = preset.newContentFull === true && runsRoomsFull;
		const runsSunkenCanyonFull = opts.preset === 'sunken-canyon' && runsRoomsFull;
		const runsSpireAscentFull = opts.preset === 'spire-ascent' && runsRoomsFull;
		const runsRoomsRevalidateFull = opts.preset === 'rooms' && runsRoomsFull;
		const runsStageBossRevalidateFull = runsSunkenCanyonFull || runsSpireAscentFull || runsRoomsRevalidateFull;
		const runsExtendedRevalidationFull = runsNewContentFull || runsStageBossRevalidateFull;

		if (runsBossEncounter && page) {
			const objectiveType = preset.objectiveType ?? 'stage_boss';
			if (objectiveType === 'defeat_enemies') {
				summary.defeatEnemiesCombat = await runDefeatEnemiesCombatStep({ page, preset, outDirAbs });
			} else if (!runsExtendedRevalidationFull) {
				summary.bossEncounter = await runBossEncounterStep({ page, preset, outDirAbs });
			}
		}

		if (runsRoomsFull && page && preset.emberBurnScenario) {
			summary.emberBurn = await runEmberBurnStep({
				page,
				preset,
				outDirAbs,
				repoRoot: REPO_ROOT,
			});
		}

		if (runsRoomsFull && page && preset.glacialSlowScenario) {
			summary.glacialSlow = await runGlacialSlowStep({
				page,
				preset,
				outDirAbs,
				repoRoot: REPO_ROOT,
			});
		}

		if (runsRoomsFull && page && preset.cardMechanicsScenarios) {
			summary.cardMechanics = await runCardMechanicsStep({
				page,
				preset,
				outDirAbs,
				repoRoot: REPO_ROOT,
			});
		}

		if (runsRoomsFull && page && !runsExtendedRevalidationFull) {
			summary.victory = await runVictoryStep({ page, preset, outDirAbs });
		}

		if (runsSunkenCanyonFull && page) {
			const result = await runStageBossRevalidateFullStep({
				page,
				preset,
				outDirAbs,
				game,
				telepipeSummaryKey: 'canyonTelepipe',
			});
			summary.bossEncounter = result.bossEncounter;
			summary.cardExercises = result.cardExercises;
			summary.canyonTelepipe = result.canyonTelepipe;
			summary.victory = result.victory;
		}

		if (runsSpireAscentFull && page) {
			const result = await runStageBossRevalidateFullStep({
				page,
				preset,
				outDirAbs,
				game,
				telepipeSummaryKey: 'spireTelepipe',
			});
			summary.bossEncounter = result.bossEncounter;
			summary.cardExercises = result.cardExercises;
			summary.spireTelepipe = result.spireTelepipe;
			summary.victory = result.victory;
		}

		if (runsNewContentFull && page && !runsSunkenCanyonFull) {
			const result = await runStageBossRevalidateFullStep({
				page,
				preset,
				outDirAbs,
				game,
				telepipeSummaryKey: 'canyonTelepipe',
			});
			summary.bossEncounter = result.bossEncounter;
			summary.cardExercises = result.cardExercises;
			summary.canyonTelepipe = result.canyonTelepipe;
			summary.victory = result.victory;
		}

		if (runsRoomsRevalidateFull && page) {
			const result = await runStageBossRevalidateFullStep({
				page,
				preset,
				outDirAbs,
				game,
				telepipeSummaryKey: 'roomsTelepipe',
			});
			summary.bossEncounter = result.bossEncounter;
			summary.cardExercises = result.cardExercises;
			summary.roomsTelepipe = result.roomsTelepipe;
			summary.victory = result.victory;
		}

		if (runsQuestTelepipeReset && page) {
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
		}

		if (runsRoomsFull) {
			summary.assertions = buildAssertions(summary, preset);
			summary.ok = Object.values(summary.assertions).every((value) => value === true);
			if (!summary.ok) {
				summary.error = summary.error || buildAssertionFailureDetail(summary, preset);
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
			summary.screenshots = collectScreenshots(summary);
			writeFullArtifacts({ outDirAbs, summary, consoleEntries, preset });
		} else if (summary.defeatEnemiesCombat?.probes || summary.bossEncounter?.probes) {
			const probesPath = path.join(outDirAbs, 'probes.json');
			const probes = summary.defeatEnemiesCombat?.probes || summary.bossEncounter.probes;
			fs.writeFileSync(probesPath, JSON.stringify(probes, null, 2));
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
