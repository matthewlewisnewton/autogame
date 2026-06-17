#!/usr/bin/env node
/**
 * Browser smoke test: solo Telepipe extract → hub return → fresh redeploy.
 *
 * Drives the real game through a solo Telepipe extraction (which returns the
 * squad to the hub lobby with no checkpoint), then re-deploys via the Launch Bay
 * ready-up path and asserts vitals persist while the dungeon is freshly spawned.
 *
 * Server-side flow exercised (no server logic is modified by this ticket):
 *   tryEnterTelepipe → maybeSuspendRun → suspendRunToLobby  (hub return)
 *   checkAllReady → startDungeonRun                          (fresh redeploy)
 *
 * Like test-world-stage-transition.mjs this script OWNS its servers on isolated
 * high ports so it never collides with a running dev/harness instance. It spawns
 *   - `node index.js` with PORT=<server> ALLOW_DEBUG_SCENARIOS=1
 *   - `vite --port <vite> --strictPort` with HARNESS_GAME_PORT=<server>
 * and tears all three processes (server, vite, browser) down in a finally,
 * including on failure. Override ports with SERVER_PORT / VITE_PORT.
 *
 * Evidence (three screenshots + state-snapshot.json) lands in
 *   game/docs/walkthroughs/telepipe-suspend-resume/
 *
 * Requires playwright chromium installed in game/client.
 */
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loginInBrowser } from './session-auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.join(__dirname, '..'); // game/client
const SERVER_DIR = path.join(__dirname, '..', '..', 'server'); // game/server
const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'walkthroughs', 'telepipe-suspend-resume');

// Isolated high ports: server in the 32xx band, vite in the 52xx band.
const SERVER_PORT = Number(process.env.SERVER_PORT || 3275);
const VITE_PORT = Number(process.env.VITE_PORT || 5275);
const SERVER_URL = `http://localhost:${SERVER_PORT}`;
const CLIENT_URL = `http://localhost:${VITE_PORT}`;
const SCENARIO_URL = `${CLIENT_URL}/?debugScenario=telepipe-ready`;

const children = [];
let cleanedUp = false;

function spawnChild(label, cmd, args, env) {
	const child = spawn(cmd, args, {
		cwd: label === 'server' ? SERVER_DIR : CLIENT_DIR,
		env: { ...process.env, ...env },
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	child.stdout.on('data', (d) => process.stdout.write(`[${label}] ${d}`));
	child.stderr.on('data', (d) => process.stderr.write(`[${label}] ${d}`));
	child.on('exit', (code, signal) => {
		if (!cleanedUp && code && code !== 0) {
			console.error(`[${label}] exited early code=${code} signal=${signal}`);
		}
	});
	children.push(child);
	return child;
}

function killAll() {
	cleanedUp = true;
	for (const child of children) {
		try {
			if (!child.killed) child.kill('SIGTERM');
		} catch { /* already gone */ }
	}
}

async function waitForHttp(url, { timeout = 30000, expectOk = false } = {}) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(url);
			if (!expectOk || res.ok) return;
		} catch { /* connection refused — not up yet */ }
		await new Promise((r) => setTimeout(r, 250));
	}
	throw new Error(`Timed out waiting for ${url}`);
}

async function readHarness(page) {
	return page.evaluate(() => window.__AUTOGAME_HARNESS_STATE__());
}

function snapshot(state) {
	return {
		phase: state.phase,
		runStatus: state.runStatus,
		layout: state.layout ? { profile: state.layout.profile, seed: state.layout.seed } : null,
		telepipe: state.telepipe ? { x: state.telepipe.x, z: state.telepipe.z } : null,
		player: state.player ? {
			hp: state.player.hp,
			magicStones: state.player.magicStones,
			x: state.player.x,
			z: state.player.z,
		} : null,
		enemyCount: state.enemies,
		enemies: (state.enemyHp || []).map((e) => ({ id: e.id, hp: e.hp })),
		hpText: state.hpText,
		msText: state.msText,
	};
}

async function screenshot(page, name) {
	fs.mkdirSync(OUT_DIR, { recursive: true });
	const file = path.join(OUT_DIR, `${name}.png`);
	await page.waitForTimeout(400);
	await page.screenshot({ path: file, fullPage: false });
	console.log(`screenshot: ${file}`);
	return file;
}

async function createLobbyAndDeploy(page) {
	await page.evaluate(() => {
		document.getElementById('create-lobby-name').value = 'Telepipe Hub QA';
		document.getElementById('create-lobby-btn')?.click();
	});
	await page.waitForFunction(() => {
		const lobby = document.getElementById('lobby');
		return lobby && !lobby.classList.contains('hidden');
	}, { timeout: 10000 });

	await page.evaluate(() => window.__requestDebugScenarioForTest?.('telepipe-ready')).catch(() => {});
	await page.evaluate(() => window.__launchReadyUpForTest?.());
	await waitForPlaying(page);
}

async function waitForPlaying(page, timeout = 30000) {
	await page.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		return h?.phase === 'playing' && h.player && h.player.x != null
			&& h.cardHandVisible && Array.isArray(h.enemyHp)
			&& h.layout && h.layout.seed != null;
	}, { timeout });
}

async function waitForHubLobby(page, timeout = 30000) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		const h = await readHarness(page);
		if (h.phase === 'lobby' && !h.runStatus && h.lobbyVisible) return h;
		await page.keyboard.press('w');
		await page.waitForTimeout(500);
	}
	const h = await readHarness(page);
	throw new Error(`Run did not return to hub lobby: phase=${h.phase} runStatus=${h.runStatus} `
		+ `lobbyVisible=${h.lobbyVisible}`);
}

async function extractViaTelepipe(page) {
	await page.keyboard.press('1');
	await page.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		return !!h?.telepipe;
	}, { timeout: 10000 });

	const deadline = Date.now() + 30000;
	while (Date.now() < deadline) {
		const h = await readHarness(page);
		if (h.phase === 'lobby' && !h.runStatus) return h;
		await page.keyboard.press('w');
		await page.waitForTimeout(500);
	}
	return waitForHubLobby(page);
}

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

async function main() {
	spawnChild('server', 'node', ['index.js'], {
		PORT: String(SERVER_PORT),
		ALLOW_DEBUG_SCENARIOS: '1',
		ALLOW_DEV_AUTH: '1',
	});
	await waitForHttp(`${SERVER_URL}/api/login`, { timeout: 30000 });
	console.log(`server up on ${SERVER_URL}`);

	const viteBin = path.join(CLIENT_DIR, 'node_modules', '.bin', 'vite');
	spawnChild('vite', viteBin, ['--port', String(VITE_PORT), '--strictPort'], {
		HARNESS_GAME_PORT: String(SERVER_PORT),
	});
	await waitForHttp(`${CLIENT_URL}/`, { timeout: 30000, expectOk: true });
	console.log(`vite up on ${CLIENT_URL}`);

	const username = `telepipe-hub-${Date.now()}`;

	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

	const consoleErrors = [];
	page.on('console', (msg) => {
		if (msg.type() === 'error') {
			consoleErrors.push(msg.text());
			console.log('[browser]', msg.text());
		}
	});

	try {
		await loginInBrowser(page, SCENARIO_URL, username);
		await createLobbyAndDeploy(page);

		const preState = await readHarness(page);
		assert(preState.hand?.[0]?.id === 'telepipe',
			`Expected telepipe in hand slot 0, got ${JSON.stringify(preState.hand?.[0])}`);
		const pre = snapshot(preState);
		assert(pre.phase === 'playing', `Expected phase 'playing' pre-extract, got '${pre.phase}'`);
		assert(pre.enemies.length > 0, 'Expected at least one enemy in the dungeon pre-extract');
		console.log('pre-extract:', JSON.stringify({
			phase: pre.phase, layout: pre.layout, enemies: pre.enemies.length, player: pre.player,
		}));
		await screenshot(page, '01-in-dungeon');

		await extractViaTelepipe(page);
		const hubState = await readHarness(page);
		const hub = snapshot(hubState);
		assert(hub.phase === 'lobby', `Expected lobby after extract, got '${hub.phase}'`);
		assert(!hub.runStatus, `Expected no active run after extract, got runStatus=${hub.runStatus}`);
		assert(hub.player, 'Missing player vitals after hub return');
		assert(hub.player.hp === pre.player.hp,
			`HP changed across extract: ${pre.player.hp} → ${hub.player.hp}`);
		assert(hub.player.magicStones === pre.player.magicStones,
			`MS changed across extract: ${pre.player.magicStones} → ${hub.player.magicStones}`);
		console.log('hub-return:', JSON.stringify({
			phase: hub.phase, hp: hub.player.hp, ms: hub.player.magicStones,
		}));
		await screenshot(page, '02-hub-lobby');

		await page.evaluate(() => window.__launchReadyUpForTest?.());
		await waitForPlaying(page);
		const redeployState = await readHarness(page);
		const redeployed = snapshot(redeployState);
		await screenshot(page, '03-redeployed-dungeon');
		console.log('redeployed:', JSON.stringify({
			phase: redeployed.phase, layout: redeployed.layout, enemies: redeployed.enemies.length,
		}));

		assert(redeployed.phase === 'playing', `Expected phase 'playing' after redeploy, got '${redeployed.phase}'`);
		assert(redeployed.layout && pre.layout, 'Missing layout on pre-extract or redeployed snapshot');
		assert(redeployed.enemies.length > 0, 'Expected enemies in the fresh redeployed dungeon');
		assert(redeployed.player.hp === pre.player.hp,
			`HP changed across redeploy: ${pre.player.hp} → ${redeployed.player.hp}`);
		assert(redeployed.player.magicStones === pre.player.magicStones,
			`MS changed across redeploy: ${pre.player.magicStones} → ${redeployed.player.magicStones}`);
		assert(!redeployed.telepipe, 'Fresh redeploy should not restore the old telepipe portal');

		const typeErrors = consoleErrors.filter((t) => /TypeError|stateUpdate/i.test(t));
		assert(typeErrors.length === 0,
			`Console TypeError(s) during run:\n${typeErrors.slice(0, 5).join('\n')}`);

		fs.mkdirSync(OUT_DIR, { recursive: true });
		const snapshotFile = path.join(OUT_DIR, 'state-snapshot.json');
		fs.writeFileSync(snapshotFile, JSON.stringify({
			capturedAt: new Date().toISOString(),
			preExtract: pre,
			hubReturn: hub,
			postRedeploy: redeployed,
		}, null, 2));
		console.log(`snapshot: ${snapshotFile}`);

		console.log(`PASS: hub return preserved vitals (HP ${hub.player.hp}, MS ${hub.player.magicStones}); `
			+ `fresh redeploy spawned ${redeployed.enemies.length} enemies`);
	} finally {
		await browser.close().catch(() => {});
	}
}

process.on('SIGINT', () => { killAll(); process.exit(130); });
process.on('SIGTERM', () => { killAll(); process.exit(143); });

main()
	.then(() => { killAll(); process.exit(0); })
	.catch((err) => {
		console.error('FAIL:', err.message);
		killAll();
		process.exit(1);
	});
