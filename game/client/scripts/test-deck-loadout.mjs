#!/usr/bin/env node
/**
 * Browser smoke test: prove a NON-DEFAULT deck loadout applies to the in-run hand.
 *
 * End-to-end, against its own isolated high-port server + vite (so live runs are
 * untouched):
 *   1. launches `node server/index.js` with ALLOW_DEBUG_SCENARIOS=1 +
 *      PERSISTENCE_BACKEND=memory on an isolated high PORT, and vite on an
 *      isolated high --strictPort with HARNESS_GAME_PORT pointed at that server,
 *   2. registers a player and injects the token into localStorage('autogame_token'),
 *   3. enters a lobby and configures a non-default 4-card deck loadout (a
 *      selectedDeck that differs from the player's 12-card default) by driving
 *      the live socket's deckRemoveCard/deckAddCard via __configureDeckForTest,
 *   4. readies up, waits for phase === 'playing', and asserts the opening hand
 *      (size 4) is exactly the configured 4-card loadout — exiting NON-ZERO with
 *      a diff if it does not match,
 *   5. saves a screenshot of the in-run hand + a JSON snapshot as evidence.
 *
 * All spawned processes are torn down on exit (no orphaned server or vite).
 *
 * Run: node client/scripts/test-deck-loadout.mjs   (from game/)
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
const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'walkthroughs', 'deck-loadout');

// DECK_MIN_SIZE === OPENING_HAND_SIZE === 4 (see server/config.js): a 4-card deck
// is fully drawn into the opening hand, so the hand reveals the whole loadout.
const LOADOUT_SIZE = 4;

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

// Build a non-default loadout of LOADOUT_SIZE card ids from what the player owns:
// prefer distinct cards, then fill with extra owned copies if needed.
function buildLoadout(ownedCards) {
	const distinct = Object.entries(ownedCards).filter(([, n]) => n > 0).map(([id]) => id);
	const remaining = { ...ownedCards };
	const loadout = [];
	for (const id of distinct) {
		if (loadout.length >= LOADOUT_SIZE) break;
		loadout.push(id);
		remaining[id] -= 1;
	}
	for (const id of distinct) {
		while (loadout.length < LOADOUT_SIZE && remaining[id] > 0) {
			loadout.push(id);
			remaining[id] -= 1;
		}
	}
	return loadout;
}

const sortedJoin = (arr) => [...arr].sort().join(', ');

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
		const token = await register(SERVER_URL, `deck-loadout-${Date.now()}`);
		await loginWithToken(page, CLIENT_URL, token);
		console.log('✓ logged in, lobby browser visible');

		// Create + enter a solo lobby.
		await page.evaluate(() => {
			const name = document.getElementById('create-lobby-name');
			if (name) name.value = 'Deck Loadout QA';
			document.getElementById('create-lobby-btn')?.click();
		});
		await page.waitForFunction(() => {
			const lobby = document.getElementById('lobby');
			return lobby && !lobby.classList.contains('hidden');
		}, { timeout: 10000 });
		// Wait for the deck-editor state to arrive from the server.
		await page.waitForFunction(() => {
			const s = window.__deckStateForTest?.();
			return s && Array.isArray(s.selectedDeck) && s.selectedDeck.length > 0;
		}, { timeout: 10000 });
		console.log('✓ lobby entered');

		const deckState = await page.evaluate(() => window.__deckStateForTest());
		const defaultDeck = deckState.selectedDeck;
		const loadout = buildLoadout(deckState.ownedCards);
		if (loadout.length !== LOADOUT_SIZE) {
			throw new Error(`Could not build a ${LOADOUT_SIZE}-card loadout from owned cards: ${JSON.stringify(deckState.ownedCards)}`);
		}
		console.log(`default deck: ${defaultDeck.length} cards; configuring loadout: [${loadout.join(', ')}]`);

		// 3. Configure the non-default loadout over the live socket.
		const configured = await page.evaluate((cards) => window.__configureDeckForTest(cards), loadout);
		if (!configured.ok) {
			throw new Error(`Failed to configure deck loadout: ${configured.reason}`);
		}
		const configuredDeck = configured.selectedDeck;
		if (configuredDeck.length !== LOADOUT_SIZE) {
			throw new Error(`Configured deck has ${configuredDeck.length} cards, expected ${LOADOUT_SIZE}`);
		}
		// Prove it is genuinely non-default.
		if (configuredDeck.length === defaultDeck.length
			&& sortedJoin(configuredDeck) === sortedJoin(defaultDeck)) {
			throw new Error('Configured deck is identical to the default deck — not a non-default loadout');
		}
		console.log(`✓ non-default loadout configured (${configuredDeck.length} vs default ${defaultDeck.length})`);

		// 4. Ready up and wait for the run to begin.
		await page.evaluate(() => document.getElementById('ready-btn')?.click());
		await page.waitForFunction(() => {
			const h = window.__AUTOGAME_HARNESS_STATE__?.();
			return h && h.phase === 'playing' && h.cardHandVisible
				&& Array.isArray(h.hand) && h.hand.filter(Boolean).length >= 4;
		}, { timeout: 20000 }).catch(async () => {
			const h = await page.evaluate(() => window.__AUTOGAME_HARNESS_STATE__?.());
			throw new Error(`Run did not start with a full hand: ${JSON.stringify({ phase: h?.phase, hand: h?.hand })}`);
		});
		const harness = await page.evaluate(() => window.__AUTOGAME_HARNESS_STATE__());
		const handCardIds = harness.hand.filter(Boolean).map((c) => c.id);
		console.log(`in-run hand: [${handCardIds.join(', ')}]`);

		// 5. Assert the in-run hand is exactly the configured loadout (multiset).
		const expected = sortedJoin(loadout);
		const actual = sortedJoin(handCardIds);
		const match = expected === actual;

		fs.mkdirSync(OUT_DIR, { recursive: true });
		const shotPath = path.join(OUT_DIR, 'in-run-hand.png');
		const handEl = await page.$('#card-hand');
		if (handEl) await handEl.screenshot({ path: shotPath });
		else await page.screenshot({ path: shotPath, fullPage: false });
		console.log(`screenshot: ${shotPath}`);

		const snapshot = {
			ok: match,
			configuredLoadout: { cardIds: loadout, selectedDeck: configuredDeck },
			defaultDeck,
			inRunHandCardIds: handCardIds,
			expectedSorted: expected,
			actualSorted: actual,
			harnessState: harness,
			timestamp: new Date().toISOString(),
		};
		const snapPath = path.join(OUT_DIR, 'deck-loadout-snapshot.json');
		fs.writeFileSync(snapPath, JSON.stringify(snapshot, null, 2));
		console.log(`snapshot: ${snapPath}`);

		if (!match) {
			throw new Error(`Hand does not match configured loadout:\n  expected: [${expected}]\n  actual:   [${actual}]`);
		}
		console.log(`PASS: in-run hand matches the configured non-default loadout [${expected}]`);
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
