#!/usr/bin/env node
/**
 * Browser smoke test: drive the full card-evolution flow and capture evidence.
 *
 * End-to-end, against its own isolated high-port server + vite (so live runs are
 * untouched):
 *   1. launches `node server/index.js` with ALLOW_DEBUG_SCENARIOS=1 +
 *      PERSISTENCE_BACKEND=memory on an isolated high PORT, and vite on an
 *      isolated high --strictPort with HARNESS_GAME_PORT pointed at that server,
 *   2. registers a player via session cookie login,
 *   3. creates + enters a solo lobby,
 *   4. invokes the `evolution-ready` debug scenario (skeleton_knight at grind 10),
 *   5. triggers evolution via __evolveCardForTest(instanceId),
 *   6. asserts the evolved card replaces the base form (undead_commander),
 *   7. saves a screenshot of the deck editor + a JSON snapshot as evidence.
 *
 * All spawned processes are torn down on exit (no orphaned server or vite).
 *
 * Run: node client/scripts/test-card-evolution.mjs   (from game/)
 */
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loginInBrowser } from './session-auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.join(__dirname, '..');
const SERVER_DIR = path.join(__dirname, '..', '..', 'server');
const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'walkthroughs', 'card-evolution');

const procs = [];

function findFreePort() {
	return new Promise((resolve, reject) => {
		const srv = net.createServer();
		srv.unref();
		srv.on('error', reject);
		srv.listen(0, '127.0.0.1', () => {
			const { port } = srv.address();
			srv.close(() => resolve(port));
		});
	});
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
	try { process.kill(-child.pid, signal); } catch (_) {
		try { child.kill(signal); } catch (_) {}
	}
}

async function cleanup() {
	const alive = procs.filter((c) => c && c.exitCode === null && c.signalCode === null);
	for (const child of alive) killProc(child, 'SIGTERM');
	await Promise.all(alive.map((child) => new Promise((resolve) => {
		if (child.exitCode !== null || child.signalCode === null) return resolve();
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

function readHarness(page) {
	return page.evaluate(() => window.__AUTOGAME_HARNESS_STATE__());
}

async function main() {
	const [serverPort, vitePort] = await Promise.all([findFreePort(), findFreePort()]);
	const SERVER_URL = `http://localhost:${serverPort}`;
	const CLIENT_URL = `http://localhost:${vitePort}`;
	console.log(`server :${serverPort}  client :${vitePort}`);

	// 1. Isolated server with debug scenarios allowed + ephemeral persistence.
	launch(process.execPath, ['index.js'], {
		cwd: SERVER_DIR,
		tag: 'server',
		env: { ...process.env, PORT: String(serverPort), ALLOW_DEBUG_SCENARIOS: '1', ALLOW_DEV_AUTH: '1', PERSISTENCE_BACKEND: 'memory' },
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
		// 3. Register + login.
		const username = `evolution-${Date.now()}`;
		page.on('console', (msg) => {
			if (msg.type() === 'error') console.log('[browser]', msg.text());
		});
		await loginInBrowser(page, CLIENT_URL, username);
		console.log('✓ logged in, lobby browser visible');

		// 4. Create + enter a solo lobby.
		await page.evaluate(() => {
			const name = document.getElementById('create-lobby-name');
			if (name) name.value = 'Card Evolution QA';
			document.getElementById('create-lobby-btn')?.click();
		});
		await page.waitForFunction(() => {
			const lobby = document.getElementById('lobby');
			return lobby && !lobby.classList.contains('hidden');
		}, { timeout: 10000 });
		// Wait for deck-editor state to arrive.
		await page.waitForFunction(() => {
			const s = window.__deckStateForTest?.();
			return s && Array.isArray(s.selectedDeck) && s.selectedDeck.length > 0;
		}, { timeout: 10000 });
		console.log('✓ lobby entered');

		// 5. Invoke the evolution-ready debug scenario.
		const scenarioResult = await page.evaluate((name) => window.__requestDebugScenarioForTest(name), 'evolution-ready');
		if (!scenarioResult.ok) {
			throw new Error(`Debug scenario 'evolution-ready' failed: ${scenarioResult.reason || JSON.stringify(scenarioResult)}`);
		}
		console.log(`✓ debug scenario applied: ${scenarioResult.scenario}`);

		// 6. Read harness state and confirm inventory has skeleton_knight at grind >= 10.
		const harnessBefore = await readHarness(page);
		const skInstance = harnessBefore.inventory.find(
			(inst) => inst.cardId === 'skeleton_knight' && inst.grind >= 10
		);
		if (!skInstance) {
			throw new Error(
				`Inventory missing skeleton_knight with grind >= 10. ` +
				`Inventory: ${JSON.stringify(harnessBefore.inventory)}`
			);
		}
		console.log(`✓ found skeleton_knight instance ${skInstance.instanceId} (grind=${skInstance.grind})`);

		// 7. Trigger evolution via __evolveCardForTest.
		const evolveResult = await page.evaluate(
			(id) => window.__evolveCardForTest(id),
			skInstance.instanceId
		);
		if (!evolveResult.ok) {
			throw new Error(`Evolution failed: ${evolveResult.reason || JSON.stringify(evolveResult)}`);
		}
		if (evolveResult.fromCardId !== 'skeleton_knight') {
			throw new Error(`Expected fromCardId='skeleton_knight', got '${evolveResult.fromCardId}'`);
		}
		if (evolveResult.toCardId !== 'undead_commander') {
			throw new Error(`Expected toCardId='undead_commander', got '${evolveResult.toCardId}'`);
		}
		console.log(`✓ evolution: skeleton_knight → undead_commander`);

		// 8. Read post-evolution harness state and verify.
		const harnessAfter = await readHarness(page);

		// 8a. lastEvolutionResult is populated.
		if (!harnessAfter.lastEvolutionResult) {
			throw new Error('lastEvolutionResult is null after evolution');
		}
		if (harnessAfter.lastEvolutionResult.fromCardId !== 'skeleton_knight') {
			throw new Error(
				`lastEvolutionResult.fromCardId='${harnessAfter.lastEvolutionResult.fromCardId}', expected 'skeleton_knight'`
			);
		}
		if (harnessAfter.lastEvolutionResult.toCardId !== 'undead_commander') {
			throw new Error(
				`lastEvolutionResult.toCardId='${harnessAfter.lastEvolutionResult.toCardId}', expected 'undead_commander'`
			);
		}

		// 8b. The inventory instance now has cardId='undead_commander', isEvolved=true,
		// evolvedFrom='skeleton_knight', grind=0.
		const evolvedInstance = harnessAfter.inventory.find(
			(inst) => inst.instanceId === skInstance.instanceId
		);
		if (!evolvedInstance) {
			throw new Error(
				`Inventory missing instance ${skInstance.instanceId} after evolution. ` +
				`Inventory: ${JSON.stringify(harnessAfter.inventory)}`
			);
		}
		if (evolvedInstance.cardId !== 'undead_commander') {
			throw new Error(`Expected cardId='undead_commander', got '${evolvedInstance.cardId}'`);
		}
		if (!evolvedInstance.isEvolved) {
			throw new Error('Expected isEvolved=true after evolution');
		}
		if (evolvedInstance.evolvedFrom !== 'skeleton_knight') {
			throw new Error(`Expected evolvedFrom='skeleton_knight', got '${evolvedInstance.evolvedFrom}'`);
		}
		if (evolvedInstance.grind !== 0) {
			throw new Error(`Expected grind=0 after evolution, got ${evolvedInstance.grind}`);
		}
		console.log('✓ post-evolution state verified (undead_commander, isEvolved, grind=0)');

		// 9. Save evidence: screenshot + JSON snapshot.
		fs.mkdirSync(OUT_DIR, { recursive: true });

		// Screenshot the page (deck editor area should be visible in lobby).
		const shotPath = path.join(OUT_DIR, 'evolved-card.png');
		const deckEditor = await page.$('#deck-editor');
		if (deckEditor) {
			await deckEditor.screenshot({ path: shotPath });
		} else {
			await page.screenshot({ path: shotPath, fullPage: false });
		}
		console.log(`screenshot: ${shotPath}`);

		// JSON state snapshot.
		const snapshot = {
			ok: true,
			preEvolution: {
				instanceId: skInstance.instanceId,
				cardId: skInstance.cardId,
				grind: skInstance.grind,
			},
			evolveResult: {
				ok: evolveResult.ok,
				fromCardId: evolveResult.fromCardId,
				toCardId: evolveResult.toCardId,
			},
			postEvolution: {
				instanceId: evolvedInstance.instanceId,
				cardId: evolvedInstance.cardId,
				grind: evolvedInstance.grind,
				isEvolved: evolvedInstance.isEvolved,
				evolvedFrom: evolvedInstance.evolvedFrom,
			},
			lastEvolutionResult: harnessAfter.lastEvolutionResult,
			fullHarnessState: harnessAfter,
			timestamp: new Date().toISOString(),
		};
		const snapPath = path.join(OUT_DIR, 'card-evolution-snapshot.json');
		fs.writeFileSync(snapPath, JSON.stringify(snapshot, null, 2));
		console.log(`snapshot: ${snapPath}`);

		console.log('PASS: full evolution flow confirmed (lobby → evolution-ready → evolve → verify)');
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
