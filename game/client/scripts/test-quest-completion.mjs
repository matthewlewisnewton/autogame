#!/usr/bin/env node
/**
 * Browser smoke test: play a defeat_enemies quest from acceptance to objective
 * completion and prove the objective flips to complete and the reward /
 * quest-complete (victory) state fires.
 *
 * End-to-end, against its own isolated high-port server + vite (so live runs are
 * untouched):
 *   1. launches `node server/index.js` with ALLOW_DEBUG_SCENARIOS=1 +
 *      PERSISTENCE_BACKEND=memory on an isolated server PORT in the 32xx range,
 *      and vite on an isolated --port in the 52xx range with --strictPort and
 *      HARNESS_GAME_PORT pointed at that server,
 *   2. registers a player and injects the token into localStorage('autogame_token'),
 *   3. creates a solo lobby, readies up, and waits for game phase === 'playing'
 *      with the default `training_caverns` (defeat_enemies) quest,
 *   4. invokes window.__requestDebugScenarioForTest('quest-objective-near-complete'),
 *      asserts it applied (ok: true), and confirms via __AUTOGAME_HARNESS_STATE__
 *      the objective is NOT yet complete (runObjectiveComplete === false, one enemy),
 *   5. locks onto the lone grunt (Z-targeting) and attacks it with a real weapon
 *      card through keyboard/card-slot input until the objective flips to complete
 *      (runObjectiveComplete === true, defeatedEnemies >= totalEnemies),
 *   6. confirms the quest-complete / reward state fired: runStatus === 'victory'
 *      AND lastRunSummary is populated with status === 'victory', a complete
 *      objective, and rewards.currency > 0,
 *   7. saves a screenshot + a JSON state snapshot (final harness state +
 *      lastRunSummary) under docs/walkthroughs/quest-completion/.
 *
 * All spawned processes are torn down on exit (no orphaned server or vite),
 * on both success and failure. Exits non-zero on any unmet assertion.
 *
 * Run: node client/scripts/test-quest-completion.mjs   (from game/)
 */
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.join(__dirname, '..');
const SERVER_DIR = path.join(__dirname, '..', '..', 'server');
const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'walkthroughs', 'quest-completion');

// Isolated high-port ranges so live runs (3000/5173) are untouched.
const SERVER_PORT_RANGE = [3200, 3299];
const VITE_PORT_RANGE = [5200, 5299];

const procs = [];

// Find a free TCP port within [min, max] so we honour the 32xx / 52xx ranges
// while staying robust against a busy port (vite --strictPort would otherwise error).
function findFreePortInRange(min, max) {
	const tryPort = (port) => new Promise((resolve) => {
		const srv = net.createServer();
		srv.unref();
		srv.on('error', () => resolve(false));
		srv.listen(port, '127.0.0.1', () => {
			srv.close(() => resolve(true));
		});
	});
	return (async () => {
		const start = min + Math.floor(Math.random() * (max - min + 1));
		for (let i = 0; i <= max - min; i += 1) {
			const port = min + ((start - min + i) % (max - min + 1));
			// eslint-disable-next-line no-await-in-loop
			if (await tryPort(port)) return port;
		}
		throw new Error(`No free port in range ${min}-${max}`);
	})();
}

function launch(cmd, args, opts) {
	const child = spawn(cmd, args, { detached: true, ...opts });
	procs.push(child);
	const tag = opts?.tag || cmd;
	child.stdout?.on('data', (d) => process.env.VERBOSE && process.stdout.write(`[${tag}] ${d}`));
	child.stderr?.on('data', (d) => process.env.VERBOSE && process.stderr.write(`[${tag}] ${d}`));
	child.on('exit', (code, sig) => {
		if (code && code !== 0 && code !== null) console.log(`[${tag}] exited code=${code} sig=${sig}`);
	});
	return child;
}

function killProc(child, signal) {
	if (!child) return;
	// Kill the whole process group (detached) so vite's esbuild children die too.
	try { process.kill(-child.pid, signal); } catch (_) {
		try { child.kill(signal); } catch (_) {}
	}
}

// Tear down every spawned process group and WAIT for them to actually exit, so
// nothing is orphaned when this script exits.
async function cleanup() {
	const alive = procs.filter((c) => c && c.exitCode === null && c.signalCode === null);
	for (const child of alive) killProc(child, 'SIGTERM');
	await Promise.all(alive.map((child) => new Promise((resolve) => {
		if (child.exitCode !== null || child.signalCode !== null) return resolve();
		const done = () => resolve();
		child.once('exit', done);
		setTimeout(() => { killProc(child, 'SIGKILL'); done(); }, 2000).unref();
	})));
}

async function waitForHttp(url, { timeout = 30000, expectOk = false } = {}) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(url);
			if (!expectOk || res.ok) return true;
		} catch (_) { /* not up yet */ }
		await new Promise((r) => setTimeout(r, 300));
	}
	throw new Error(`Timed out waiting for ${url}`);
}

async function register(serverUrl, username) {
	const res = await fetch(`${serverUrl}/api/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password: 'password123' }),
	});
	const body = await res.json();
	if (body.token) return body.token;
	const login = await fetch(`${serverUrl}/api/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password: 'password123' }),
	});
	return (await login.json()).token;
}

async function loginWithToken(page, clientUrl, token) {
	page.on('console', (msg) => {
		if (msg.type() === 'error') console.log('[browser]', msg.text());
	});
	await page.goto(clientUrl);
	await page.evaluate((t) => localStorage.setItem('autogame_token', t), token);
	await page.reload();
	await page.waitForFunction(() => {
		const browserEl = document.getElementById('lobby-browser');
		const auth = document.getElementById('auth-overlay');
		return browserEl && !browserEl.classList.contains('hidden')
			&& auth && auth.classList.contains('hidden');
	}, { timeout: 15000 }).catch(async () => {
		const state = await page.evaluate(() => ({
			lobbyHidden: document.getElementById('lobby-browser')?.classList.contains('hidden'),
			authHidden: document.getElementById('auth-overlay')?.classList.contains('hidden'),
			authError: document.getElementById('login-error')?.textContent,
		}));
		throw new Error(`Login UI not ready: ${JSON.stringify(state)}`);
	});
}

async function readHarness(page) {
	return page.evaluate(() => window.__AUTOGAME_HARNESS_STATE__());
}

async function readLockOnState(page) {
	return page.evaluate(async () => {
		const mod = await import('/lockOn.js');
		return { active: mod.isLockOnActive(), targetId: mod.getLockedEnemyId() };
	});
}

const usable = (card) => card && (card.remainingCharges == null || card.remainingCharges > 0);

// Pick how to defeat the lone grunt with whatever the shuffled opening hand dealt.
// Weapons fire a forward cone (aimed via lock-on) — preferred and present in ~99%
// of hands. The remaining ~1% (no weapon) fall back to a summoner card (creature
// or familiar spell) whose minion auto-engages the adjacent grunt. The starting
// deck has only 2 creature cards, so a 4-card hand always holds an attack card.
function chooseAttack(harness) {
	if (!harness || !Array.isArray(harness.hand)) return null;
	const weaponSlot = harness.hand.findIndex((c) => usable(c) && c.type === 'weapon');
	if (weaponSlot >= 0) return { mode: 'weapon', slot: weaponSlot, card: harness.hand[weaponSlot] };
	const summonSlot = harness.hand.findIndex((c) => usable(c) && (c.type === 'creature' || c.type === 'spell'));
	if (summonSlot >= 0) return { mode: 'summon', slot: summonSlot, card: harness.hand[summonSlot] };
	return null;
}

// Poll the harness for the objective flip within `timeout`ms; resolves true/false.
async function waitForObjectiveComplete(page, timeout) {
	return page.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__();
		return !!h && h.runObjectiveComplete === true
			&& h.objective && h.objective.defeatedEnemies >= h.objective.totalEnemies;
	}, { timeout }).then(() => true).catch(() => false);
}

async function main() {
	const [serverPort, vitePort] = await Promise.all([
		findFreePortInRange(...SERVER_PORT_RANGE),
		findFreePortInRange(...VITE_PORT_RANGE),
	]);
	const SERVER_URL = `http://localhost:${serverPort}`;
	const CLIENT_URL = `http://localhost:${vitePort}`;
	console.log(`server :${serverPort}  client :${vitePort}`);

	// 1. Isolated server with debug scenarios allowed + ephemeral persistence.
	launch(process.execPath, ['index.js'], {
		cwd: SERVER_DIR,
		tag: 'server',
		env: { ...process.env, PORT: String(serverPort), ALLOW_DEBUG_SCENARIOS: '1', PERSISTENCE_BACKEND: 'memory' },
	});
	await waitForHttp(`${SERVER_URL}/api/me`, { timeout: 30000 });
	console.log('✓ server up');

	// 2. Isolated vite, strict port, proxying /api + /socket.io to our server.
	launch('npx', ['vite', '--port', String(vitePort), '--strictPort'], {
		cwd: CLIENT_DIR,
		tag: 'vite',
		env: { ...process.env, HARNESS_GAME_PORT: String(serverPort) },
	});
	await waitForHttp(CLIENT_URL, { timeout: 60000, expectOk: true });
	console.log('✓ client up');

	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

	try {
		const token = await register(SERVER_URL, `quest-completion-${Date.now()}`);
		await loginWithToken(page, CLIENT_URL, token);
		console.log('✓ logged in, lobby browser visible');

		// 3. Create + enter a solo lobby and ready up (default training_caverns quest).
		await page.evaluate(() => {
			const name = document.getElementById('create-lobby-name');
			if (name) name.value = 'Quest Completion QA';
			document.getElementById('create-lobby-btn')?.click();
		});
		await page.waitForFunction(() => {
			const lobby = document.getElementById('lobby');
			return lobby && !lobby.classList.contains('hidden');
		}, { timeout: 10000 });
		await page.evaluate(() => document.getElementById('ready-btn')?.click());
		await page.waitForFunction(() => {
			const h = window.__AUTOGAME_HARNESS_STATE__?.();
			return h && h.phase === 'playing' && h.cardHandVisible;
		}, { timeout: 20000 }).catch(async () => {
			const h = await readHarness(page);
			throw new Error(`Run did not start: ${JSON.stringify({ phase: h?.phase, cardHandVisible: h?.cardHandVisible })}`);
		});
		console.log('✓ run started (playing)');

		// 4. Position the run one enemy-defeat away from objective completion.
		const scenario = await page.evaluate(() => {
			if (typeof window.__requestDebugScenarioForTest !== 'function') {
				return { ok: false, reason: '__requestDebugScenarioForTest missing' };
			}
			return window.__requestDebugScenarioForTest('quest-objective-near-complete');
		});
		if (!scenario?.ok) {
			throw new Error(`quest-objective-near-complete scenario failed: ${scenario?.reason || 'unknown'}`);
		}
		// Wait for the scenario's state to land in the client (one enemy, objective not complete).
		await page.waitForFunction(() => {
			const h = window.__AUTOGAME_HARNESS_STATE__();
			return h && h.phase === 'playing'
				&& h.objective && h.objective.type === 'defeat_enemies'
				&& h.runObjectiveComplete === false
				&& h.enemies === 1;
		}, { timeout: 15000 }).catch(async () => {
			const h = await readHarness(page);
			throw new Error(`Near-complete state not reached: ${JSON.stringify({
				objective: h?.objective, runObjectiveComplete: h?.runObjectiveComplete, enemies: h?.enemies,
			})}`);
		});

		const before = await readHarness(page);
		if (before.runObjectiveComplete !== false) {
			throw new Error(`Objective should NOT be complete after scenario: ${JSON.stringify(before.objective)}`);
		}
		if (before.enemies !== 1) {
			throw new Error(`Expected exactly one enemy after scenario, got ${before.enemies}`);
		}
		console.log(`✓ scenario applied — objective ${before.objective.defeatedEnemies}/${before.objective.totalEnemies}, not yet complete, ${before.enemies} enemy present`);

		const attack = chooseAttack(before);
		if (!attack) {
			throw new Error(`No usable attack/summon card in hand to defeat the grunt: ${JSON.stringify(before.hand)}`);
		}
		const attackKey = String(attack.slot + 1);
		console.log(`attack card in slot ${attack.slot}: ${attack.card.id} (${attack.mode})`);

		// 5. Defeat the lone grunt through real input/combat, then poll the harness
		//    until the objective flips to complete.
		let completed = false;
		if (attack.mode === 'weapon') {
			// Lock onto the grunt so the forward cone faces it. The grunt spawns ~2
			// units away (well inside LOCK_ON_RANGE), so Z acquires it immediately.
			await page.keyboard.press('z');
			await page.waitForTimeout(300);
			let lock = await readLockOnState(page);
			for (let i = 0; i < 6 && !lock.active; i += 1) {
				await page.keyboard.down('w');
				await page.waitForTimeout(250);
				await page.keyboard.up('w');
				await page.keyboard.press('z');
				await page.waitForTimeout(250);
				lock = await readLockOnState(page);
			}
			if (!lock.active) {
				throw new Error('Could not lock onto the grunt to aim the attack');
			}
			console.log(`✓ locked onto target ${lock.targetId}`);

			// Swing the weapon; poll for the flip across each COOLDOWN_MS (800ms) window.
			for (let swing = 0; swing < 10 && !completed; swing += 1) {
				await page.keyboard.press(attackKey);
				completed = await waitForObjectiveComplete(page, 1200);
			}
		} else {
			// Summon a minion that auto-engages the adjacent grunt. The minion needs
			// a few seconds to close and strike, so poll over a longer window and
			// re-summon if the first minion expires before finishing the kill.
			for (let cast = 0; cast < 4 && !completed; cast += 1) {
				await page.keyboard.press(attackKey);
				completed = await waitForObjectiveComplete(page, 8000);
			}
		}
		if (!completed) {
			const h = await readHarness(page);
			throw new Error(`Objective did not complete after combat (${attack.mode}): ${JSON.stringify({
				objective: h?.objective, runObjectiveComplete: h?.runObjectiveComplete,
				enemies: h?.enemies, enemyHp: h?.enemyHp, minions: h?.minions,
			})}`);
		}
		console.log('✓ objective flipped to complete via real combat');

		// 6. Confirm the quest-complete / reward (victory) state fired.
		await page.waitForFunction(() => {
			const h = window.__AUTOGAME_HARNESS_STATE__();
			return !!h && h.runStatus === 'victory'
				&& h.lastRunSummary && h.lastRunSummary.status === 'victory';
		}, { timeout: 15000 }).catch(async () => {
			const h = await readHarness(page);
			throw new Error(`Victory / run summary not observed: ${JSON.stringify({
				runStatus: h?.runStatus, lastRunSummary: h?.lastRunSummary,
			})}`);
		});

		const after = await readHarness(page);
		const summary = after.lastRunSummary;
		const objComplete = summary?.objective
			&& summary.objective.defeatedEnemies >= summary.objective.totalEnemies;
		if (after.runStatus !== 'victory') {
			throw new Error(`Expected runStatus 'victory', got '${after.runStatus}'`);
		}
		if (!summary || summary.status !== 'victory') {
			throw new Error(`lastRunSummary not a victory: ${JSON.stringify(summary)}`);
		}
		if (!objComplete) {
			throw new Error(`Run summary objective not complete: ${JSON.stringify(summary?.objective)}`);
		}
		if (!(summary.rewards && summary.rewards.currency > 0)) {
			throw new Error(`Expected positive reward currency, got ${JSON.stringify(summary?.rewards)}`);
		}
		console.log(`✓ victory fired — reward currency ${summary.rewards.currency}, objective ${summary.objective.defeatedEnemies}/${summary.objective.totalEnemies}`);

		// 7. Save evidence: a screenshot + a JSON state snapshot.
		fs.mkdirSync(OUT_DIR, { recursive: true });
		const shotPath = path.join(OUT_DIR, 'quest-complete.png');
		await page.screenshot({ path: shotPath, fullPage: false });
		console.log(`screenshot: ${shotPath}`);

		const snapshot = {
			ok: true,
			scenario: 'quest-objective-near-complete',
			before: { objective: before.objective, runObjectiveComplete: before.runObjectiveComplete, enemies: before.player.enemies },
			after: { runStatus: after.runStatus, objective: after.objective, runObjectiveComplete: after.runObjectiveComplete },
			lastRunSummary: summary,
			harnessState: after,
			timestamp: new Date().toISOString(),
		};
		const snapPath = path.join(OUT_DIR, 'quest-completion-snapshot.json');
		fs.writeFileSync(snapPath, JSON.stringify(snapshot, null, 2));
		console.log(`snapshot: ${snapPath}`);

		console.log('PASS: accept → satisfy objective → complete → reward path verified');
	} finally {
		await browser.close();
	}
}

process.on('SIGINT', async () => { await cleanup(); process.exit(130); });
process.on('SIGTERM', async () => { await cleanup(); process.exit(143); });

main()
	.then(async () => { await cleanup(); process.exit(0); })
	.catch(async (err) => {
		console.error('FAIL:', err.message);
		await cleanup();
		process.exit(1);
	});
