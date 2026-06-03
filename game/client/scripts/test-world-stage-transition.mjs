#!/usr/bin/env node
/**
 * Browser smoke test: world-stage portal transition into the sunken-canyon stage.
 *
 * Starts an ISOLATED server + vite pair on high ports (so it never collides with
 * a running dev/harness instance), drives the real client in headless chromium
 * through the register → create-lobby → ready → playing flow, records the
 * starting stage from the harness `layout` summary, then triggers the
 * `sunken-canyon-stage` debug scenario and verifies the new stage geometry loads
 * and the player is repositioned to the new start room.
 *
 * Unlike the other smoke tests this script owns its servers: it spawns
 *   - `node index.js` with PORT=<server> ALLOW_DEBUG_SCENARIOS=1
 *   - `vite --port <vite> --strictPort` with HARNESS_GAME_PORT=<server>
 * and tears all three processes (server, vite, browser) down on exit, including
 * on failure. Override ports with SERVER_PORT / VITE_PORT.
 *
 * Evidence (two screenshots + snapshot.json) lands in
 *   game/docs/walkthroughs/world-stage-transition/
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
const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'walkthroughs', 'world-stage-transition');

// Isolated high ports: server in the 32xx band, vite in the 52xx band.
const SERVER_PORT = Number(process.env.SERVER_PORT || 3271);
const VITE_PORT = Number(process.env.VITE_PORT || 5271);
const SERVER_URL = `http://localhost:${SERVER_PORT}`;
const CLIENT_URL = `http://localhost:${VITE_PORT}`;

const TARGET_PROFILE = 'sunken-canyon';
const PLACEMENT_TOLERANCE = 1; // units — player must land on the new startRoom

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
			// Any HTTP response means the process is listening. For vite we also
			// want a real 200 so the app HTML is being served.
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
	await page.goto(CLIENT_URL);
	await page.evaluate((t) => localStorage.setItem('autogame_token', t), token);
	await page.reload();
	await page.waitForFunction(() => {
		const browserEl = document.getElementById('lobby-browser');
		const auth = document.getElementById('auth-overlay');
		return browserEl && !browserEl.classList.contains('hidden')
			&& auth && auth.classList.contains('hidden');
	}, { timeout: 15000 });
}

async function startSoloRun(page) {
	await page.evaluate(() => {
		document.getElementById('create-lobby-name').value = 'World Stage QA';
		document.getElementById('create-lobby-btn')?.click();
	});
	await page.waitForFunction(() => {
		const lobby = document.getElementById('lobby');
		return lobby && !lobby.classList.contains('hidden');
	}, { timeout: 10000 });
	await page.evaluate(() => document.getElementById('ready-btn')?.click());
	await page.waitForFunction(() => {
		const ui = document.getElementById('ui');
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		return ui && ui.style.display === 'block'
			&& h?.phase === 'playing'
			&& h.player && h.player.x != null
			&& h.layout && h.layout.profile;
	}, { timeout: 20000 });
}

async function readHarness(page) {
	return page.evaluate(() => window.__AUTOGAME_HARNESS_STATE__());
}

async function screenshot(page, name) {
	fs.mkdirSync(OUT_DIR, { recursive: true });
	const file = path.join(OUT_DIR, `${name}.png`);
	await page.waitForTimeout(400);
	await page.screenshot({ path: file, fullPage: false });
	console.log(`screenshot: ${file}`);
	return file;
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

	const suffix = Date.now();
	const token = await register(`world-stage-${suffix}`);

	const browser = await chromium.launch({ headless: true });
	children.push({ kill: () => browser.close().catch(() => {}), killed: false });
	const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

	try {
		await loginWithToken(page, token);
		await startSoloRun(page);

		// 2. Record the starting (default) stage before the transition.
		const before = await readHarness(page);
		const beforeLayout = before.layout;
		if (!beforeLayout || !beforeLayout.profile) {
			throw new Error('Harness state did not expose a starting layout.profile');
		}
		console.log('before stage:', JSON.stringify({
			profile: beforeLayout.profile,
			roomCount: beforeLayout.roomCount,
			startRoom: beforeLayout.startRoom,
		}));
		console.log('before player:', before.player.x.toFixed(2), before.player.z.toFixed(2));
		if (beforeLayout.profile === TARGET_PROFILE) {
			throw new Error(`Starting profile is already '${TARGET_PROFILE}'; cannot prove a transition`);
		}
		await screenshot(page, '01-before-default-stage');

		// 3. Trigger the world-stage transition.
		const result = await page.evaluate((scenario) => {
			if (typeof window.__requestDebugScenarioForTest !== 'function') {
				return { ok: false, reason: '__requestDebugScenarioForTest missing' };
			}
			return window.__requestDebugScenarioForTest(scenario);
		}, `${TARGET_PROFILE}-stage`);
		if (!result?.ok) {
			throw new Error(`${TARGET_PROFILE}-stage debug scenario failed: ${result?.reason || 'unknown'}`);
		}

		// 4. Wait for the swapped layout to arrive via questUpdate.
		await page.waitForFunction((target) => {
			const h = window.__AUTOGAME_HARNESS_STATE__?.();
			return h?.layout?.profile === target && h.layout.startRoom != null;
		}, TARGET_PROFILE, { timeout: 20000 });

		// 5. Verify the new stage loaded and the player is placed at its start room.
		const after = await readHarness(page);
		const afterLayout = after.layout;
		console.log('after stage:', JSON.stringify({
			profile: afterLayout.profile,
			roomCount: afterLayout.roomCount,
			startRoom: afterLayout.startRoom,
		}));
		console.log('after player:', after.player.x.toFixed(2), after.player.z.toFixed(2));
		await screenshot(page, '02-after-sunken-canyon-stage');

		if (afterLayout.profile !== TARGET_PROFILE) {
			throw new Error(`Expected layout.profile '${TARGET_PROFILE}', got '${afterLayout.profile}'`);
		}
		if (afterLayout.profile === beforeLayout.profile) {
			throw new Error('Stage profile did not change across the transition');
		}
		if (!afterLayout.startRoom) {
			throw new Error('New stage has no startRoom');
		}
		const dx = after.player.x - afterLayout.startRoom.x;
		const dz = after.player.z - afterLayout.startRoom.z;
		const dist = Math.hypot(dx, dz);
		console.log('player offset from new startRoom:', dist.toFixed(3));
		if (dist > PLACEMENT_TOLERANCE) {
			throw new Error(`Player not placed at new startRoom: off by ${dist.toFixed(3)} > ${PLACEMENT_TOLERANCE}`);
		}
		if (!after.sceneInitialized || !after.hasCanvas) {
			throw new Error('Expected Three.js scene/canvas to be active after the transition');
		}

		// 6. Write the JSON state snapshot.
		fs.mkdirSync(OUT_DIR, { recursive: true });
		const snapshotFile = path.join(OUT_DIR, 'snapshot.json');
		fs.writeFileSync(snapshotFile, JSON.stringify({
			capturedAt: new Date().toISOString(),
			target: TARGET_PROFILE,
			placementTolerance: PLACEMENT_TOLERANCE,
			playerOffsetFromStartRoom: dist,
			before: { layout: beforeLayout, player: before.player },
			after: { layout: afterLayout, player: after.player },
		}, null, 2));
		console.log(`snapshot: ${snapshotFile}`);

		console.log(`PASS: transitioned ${beforeLayout.profile} → ${afterLayout.profile}; player placed at start room (off ${dist.toFixed(3)})`);
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
