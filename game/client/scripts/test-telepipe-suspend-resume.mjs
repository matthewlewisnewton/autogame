#!/usr/bin/env node
/**
 * Browser smoke test: solo Telepipe SUSPEND → RESUME run-state preservation.
 *
 * Drives the real game through a solo Telepipe extraction (which leaves zero
 * active players and so SUSPENDS the run to the lobby), then re-deploys to
 * RESUME, and asserts the run state is preserved across the boundary: the
 * suspended quest summary is well-formed, the resumed dungeon layout (seed +
 * profile) matches the pre-suspend layout, and the resumed enemy set matches
 * the pre-suspend set (same count + ids; hp preserved for undefeated enemies).
 *
 * Server-side flow exercised (no server logic is modified by this ticket):
 *   tryEnterTelepipe → maybeSuspendRun → suspendRunToLobby  (suspend)
 *   checkAllReady → restoreRunCheckpoint                    (resume)
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

async function register(username) {
	const res = await fetch(`${SERVER_URL}/api/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password: 'password123' }),
	});
	const body = await res.json();
	if (body.token) return body.token;
	const login = await fetch(`${SERVER_URL}/api/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password: 'password123' }),
	});
	return (await login.json()).token;
}

async function loginWithToken(page, token) {
	await page.goto(SCENARIO_URL);
	await page.evaluate((t) => localStorage.setItem('autogame_token', t), token);
	await page.reload();
	await page.waitForFunction(() => {
		const browserEl = document.getElementById('lobby-browser');
		const auth = document.getElementById('auth-overlay');
		return browserEl && !browserEl.classList.contains('hidden')
			&& auth && auth.classList.contains('hidden');
	}, { timeout: 15000 });
}

async function readHarness(page) {
	return page.evaluate(() => window.__AUTOGAME_HARNESS_STATE__());
}

// Normalize the slice of harness state this test cares about into a stable,
// JSON-serializable snapshot. Enemies use the `enemyHp` array (ids + hp); the
// top-level `enemies` field is only a count.
function snapshot(state) {
	return {
		phase: state.phase,
		runStatus: state.runStatus,
		suspendedRunSummary: state.suspendedRunSummary || null,
		layout: state.layout ? { profile: state.layout.profile, seed: state.layout.seed } : null,
		telepipe: state.telepipe ? { x: state.telepipe.x, z: state.telepipe.z } : null,
		player: state.player ? { x: state.player.x, z: state.player.z } : null,
		enemyCount: state.enemies,
		enemies: (state.enemyHp || []).map((e) => ({ id: e.id, hp: e.hp })),
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
		document.getElementById('create-lobby-name').value = 'Telepipe Suspend QA';
		document.getElementById('create-lobby-btn')?.click();
	});
	await page.waitForFunction(() => {
		const lobby = document.getElementById('lobby');
		return lobby && !lobby.classList.contains('hidden');
	}, { timeout: 10000 });

	// Belt-and-suspenders: the ?debugScenario=telepipe-ready URL param is already
	// requested on lobbyJoined, but re-request explicitly so the run deploys with
	// a telepipe card in hand slot 0 even if the auto-request was missed.
	await page.evaluate(() => window.__requestDebugScenarioForTest?.('telepipe-ready')).catch(() => {});

	await page.evaluate(() => document.getElementById('ready-btn')?.click());
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

// Solo extraction: place the portal (hand slot key `1`) at the player's feet,
// then let the server-side proximity check auto-extract once the placement grace
// (2s) expires. A solo extraction leaves zero active players, so the run
// suspends to the lobby. Poll harness state for the suspend signal.
async function suspendViaTelepipe(page) {
	await page.keyboard.press('1');
	await page.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		return !!h?.telepipe;
	}, { timeout: 10000 });

	const deadline = Date.now() + 30000;
	while (Date.now() < deadline) {
		const h = await readHarness(page);
		const suspended = h.runStatus === 'suspended'
			|| (h.phase === 'lobby' && h.suspendedRunSummary);
		if (suspended) return;
		// Nudge toward the portal in case the player drifted out of radius.
		await page.keyboard.press('w');
		await page.waitForTimeout(500);
	}
	const h = await readHarness(page);
	throw new Error(`Run did not suspend: phase=${h.phase} runStatus=${h.runStatus} `
		+ `extracted=${h.extracted} suspendedRunSummary=${JSON.stringify(h.suspendedRunSummary)}`);
}

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

function enemyMapById(enemies) {
	const m = new Map();
	for (const e of enemies) m.set(e.id, e.hp);
	return m;
}

async function main() {
	// 1. Boot isolated server + vite.
	spawnChild('server', 'node', ['index.js'], {
		PORT: String(SERVER_PORT),
		ALLOW_DEBUG_SCENARIOS: '1',
	});
	await waitForHttp(`${SERVER_URL}/api/login`, { timeout: 30000 });
	console.log(`server up on ${SERVER_URL}`);

	const viteBin = path.join(CLIENT_DIR, 'node_modules', '.bin', 'vite');
	spawnChild('vite', viteBin, ['--port', String(VITE_PORT), '--strictPort'], {
		HARNESS_GAME_PORT: String(SERVER_PORT),
	});
	await waitForHttp(`${CLIENT_URL}/`, { timeout: 30000, expectOk: true });
	console.log(`vite up on ${CLIENT_URL}`);

	const token = await register(`telepipe-suspend-${Date.now()}`);

	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

	// Surface client-side TypeErrors (esp. on stateUpdate) so the run fails loudly.
	const consoleErrors = [];
	page.on('console', (msg) => {
		if (msg.type() === 'error') {
			consoleErrors.push(msg.text());
			console.log('[browser]', msg.text());
		}
	});

	try {
		await loginWithToken(page, token);
		await createLobbyAndDeploy(page);

		// 2. PRE-SUSPEND: confirm telepipe is in hand slot 0 and snapshot state.
		const preState = await readHarness(page);
		assert(preState.hand?.[0]?.id === 'telepipe',
			`Expected telepipe in hand slot 0, got ${JSON.stringify(preState.hand?.[0])}`);
		const pre = snapshot(preState);
		assert(pre.phase === 'playing', `Expected phase 'playing' pre-suspend, got '${pre.phase}'`);
		assert(pre.enemies.length > 0, 'Expected at least one enemy in the dungeon pre-suspend');
		console.log('pre-suspend:', JSON.stringify({
			phase: pre.phase, layout: pre.layout, enemies: pre.enemies.length, player: pre.player,
		}));
		await screenshot(page, '01-in-dungeon');

		// 3. SUSPEND via solo telepipe extraction.
		await suspendViaTelepipe(page);
		const suspendedState = await readHarness(page);
		const suspended = snapshot(suspendedState);
		assert(suspended.runStatus === 'suspended'
			|| (suspended.phase === 'lobby' && suspended.suspendedRunSummary),
			`Run not suspended: ${JSON.stringify(suspended)}`);
		const summary = suspended.suspendedRunSummary;
		assert(summary && summary.questId && summary.questName && summary.objective,
			`Suspended summary missing quest fields: ${JSON.stringify(summary)}`);
		console.log('suspended:', JSON.stringify({
			phase: suspended.phase, runStatus: suspended.runStatus,
			quest: summary.questName, objective: summary.objective.type,
		}));
		await screenshot(page, '02-suspended-lobby');

		// 4. RESUME by re-deploying (Ready/Deploy → restoreRunCheckpoint).
		await page.evaluate(() => document.getElementById('ready-btn')?.click());
		await waitForPlaying(page);
		const resumedState = await readHarness(page);
		const resumed = snapshot(resumedState);
		await screenshot(page, '03-resumed-dungeon');
		console.log('resumed:', JSON.stringify({
			phase: resumed.phase, runStatus: resumed.runStatus,
			layout: resumed.layout, enemies: resumed.enemies.length,
		}));

		// 5. Assert state is PRESERVED across the suspend → resume boundary.
		assert(resumed.phase === 'playing', `Expected phase 'playing' after resume, got '${resumed.phase}'`);
		assert(resumed.runStatus !== 'suspended',
			`runStatus 'suspended' lingered after resume: ${resumed.runStatus}`);

		// Quest / layout identity: the resumed run restores the same dungeon as the
		// suspended one (suspendedRunSummary is intentionally consumed on resume, so
		// the suspended quest is proven via the well-formed summary captured above
		// plus the restored layout seed/profile here).
		assert(resumed.layout && pre.layout, 'Missing layout on pre-suspend or resumed snapshot');
		assert(resumed.layout.seed === pre.layout.seed,
			`Resumed layout seed ${resumed.layout.seed} != pre-suspend ${pre.layout.seed}`);
		assert(resumed.layout.profile === pre.layout.profile,
			`Resumed layout profile ${resumed.layout.profile} != pre-suspend ${pre.layout.profile}`);

		// Enemy set preserved: same count + ids; hp preserved for undefeated enemies
		// (none were defeated in this run, so every hp must match exactly).
		assert(resumed.enemies.length === pre.enemies.length,
			`Enemy count changed across suspend/resume: ${pre.enemies.length} → ${resumed.enemies.length}`);
		const preById = enemyMapById(pre.enemies);
		const resumedById = enemyMapById(resumed.enemies);
		for (const [id, hp] of preById) {
			assert(resumedById.has(id), `Enemy ${id} missing after resume`);
			assert(resumedById.get(id) === hp,
				`Enemy ${id} hp changed: ${hp} → ${resumedById.get(id)}`);
		}

		// 6. No client TypeErrors during the run (esp. on stateUpdate).
		const typeErrors = consoleErrors.filter((t) => /TypeError|stateUpdate/i.test(t));
		assert(typeErrors.length === 0,
			`Console TypeError(s) during run:\n${typeErrors.slice(0, 5).join('\n')}`);

		// 7. Write the JSON state snapshot evidence.
		fs.mkdirSync(OUT_DIR, { recursive: true });
		const snapshotFile = path.join(OUT_DIR, 'state-snapshot.json');
		fs.writeFileSync(snapshotFile, JSON.stringify({
			capturedAt: new Date().toISOString(),
			preSuspend: pre,
			suspended,
			postResume: resumed,
		}, null, 2));
		console.log(`snapshot: ${snapshotFile}`);

		console.log(`PASS: suspended quest '${summary.questName}', resumed same layout `
			+ `(seed ${resumed.layout.seed}, ${resumed.enemies.length} enemies preserved)`);
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
