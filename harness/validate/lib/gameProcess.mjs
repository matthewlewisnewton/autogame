/**
 * Spawn and tear down an isolated game server + Vite client for harness validation.
 * Mirrors game/client/scripts/test-deck-loadout.mjs / test-quest-completion.mjs.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const CLIENT_DIR = path.join(REPO_ROOT, 'game', 'client');
const SERVER_DIR = path.join(REPO_ROOT, 'game', 'server');

const SERVER_PORT_RANGE = [3200, 3299];
const VITE_PORT_RANGE = [5200, 5299];

const procs = [];
let activeServerChild = null;

/** @param {string | null | undefined} serverLogPath @param {number} [maxLines] */
export function getServerLogTail(serverLogPath, maxLines = 40) {
	if (!serverLogPath || !fs.existsSync(serverLogPath)) return '<missing server.log>';
	const lines = fs.readFileSync(serverLogPath, 'utf8').split('\n');
	return lines.slice(-maxLines).join('\n');
}

/**
 * Fail fast when the isolated game server exits or stops accepting HTTP.
 * @param {{ serverUrl?: string, serverChild?: import('child_process').ChildProcess | null, serverLogPath?: string | null }} opts
 */
export async function assertGameProcessAlive({ serverUrl, serverChild, serverLogPath } = {}) {
	const child = serverChild ?? activeServerChild;
	if (child && child.exitCode !== null) {
		throw new Error(
			`Game server process exited (code=${child.exitCode}):\n${getServerLogTail(serverLogPath)}`,
		);
	}
	if (!serverUrl) return;
	try {
		const res = await fetch(`${serverUrl}/healthz`, { signal: AbortSignal.timeout(3000) });
		if (!res.ok) {
			throw new Error(`HTTP ${res.status}`);
		}
	} catch (err) {
		throw new Error(
			`Game server unreachable at ${serverUrl} (${err.message}):\n${getServerLogTail(serverLogPath)}`,
		);
	}
}

function tryPort(port) {
	return new Promise((resolve) => {
		const srv = net.createServer();
		srv.unref();
		srv.on('error', () => resolve(false));
		srv.listen(port, '127.0.0.1', () => {
			srv.close(() => resolve(true));
		});
	});
}

export async function findFreePortInRange(min, max) {
	const start = min + Math.floor(Math.random() * (max - min + 1));
	for (let i = 0; i <= max - min; i += 1) {
		const port = min + ((start - min + i) % (max - min + 1));
		// eslint-disable-next-line no-await-in-loop
		if (await tryPort(port)) return port;
	}
	throw new Error(`No free port in range ${min}-${max}`);
}

function launch(cmd, args, opts) {
	const child = spawn(cmd, args, { detached: true, ...opts });
	procs.push(child);
	const tag = opts?.tag || cmd;
	child.stdout?.on('data', (d) => process.env.VERBOSE && process.stdout.write(`[${tag}] ${d}`));
	child.stderr?.on('data', (d) => process.env.VERBOSE && process.stderr.write(`[${tag}] ${d}`));
	child.on('exit', (code, sig) => {
		if (code && code !== 0 && code !== null) console.error(`[${tag}] exited code=${code} sig=${sig}`);
	});
	return child;
}

function killProc(child, signal) {
	if (!child) return;
	try { process.kill(-child.pid, signal); } catch (_) {
		try { child.kill(signal); } catch (_) { /* ignore */ }
	}
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

/**
 * Start isolated server + Vite on high ports with harness env flags.
 * @returns {{ serverUrl: string, clientUrl: string, serverPort: number, clientPort: number }}
 */
export async function startGame({ serverPort, clientPort, serverLogPath } = {}) {
	const resolvedServerPort = serverPort ?? await findFreePortInRange(...SERVER_PORT_RANGE);
	const resolvedClientPort = clientPort ?? await findFreePortInRange(...VITE_PORT_RANGE);
	const serverUrl = `http://localhost:${resolvedServerPort}`;
	const clientUrl = `http://localhost:${resolvedClientPort}`;

	let serverLogStream = null;
	if (serverLogPath) {
		fs.mkdirSync(path.dirname(serverLogPath), { recursive: true });
		serverLogStream = fs.createWriteStream(serverLogPath, { flags: 'a' });
	}

	const serverChild = launch(process.execPath, ['index.js'], {
		cwd: SERVER_DIR,
		tag: 'server',
		env: {
			...process.env,
			PORT: String(resolvedServerPort),
			ALLOW_DEBUG_SCENARIOS: '1',
			ALLOW_DEV_AUTH: '1',
			PERSISTENCE_BACKEND: 'memory',
		},
	});
	activeServerChild = serverChild;
	serverChild.once('exit', (code, sig) => {
		if (activeServerChild === serverChild) activeServerChild = null;
		if (code && code !== 0) {
			console.error(`[server] exited during harness run code=${code} sig=${sig}`);
		}
	});
	serverChild.stdout?.on('data', (d) => {
		serverLogStream?.write(d);
	});
	serverChild.stderr?.on('data', (d) => {
		serverLogStream?.write(d);
	});
	await waitForHttp(`${serverUrl}/healthz`, { timeout: 30000, expectOk: true });

	launch('npx', ['vite', '--port', String(resolvedClientPort), '--strictPort'], {
		cwd: CLIENT_DIR,
		tag: 'vite',
		env: { ...process.env, HARNESS_GAME_PORT: String(resolvedServerPort) },
	});
	await waitForHttp(clientUrl, { timeout: 60000, expectOk: true });

	return {
		serverUrl,
		clientUrl,
		serverPort: resolvedServerPort,
		clientPort: resolvedClientPort,
		serverLogPath: serverLogPath ?? null,
		serverChild,
	};
}

/** Tear down every spawned process group and wait for exit. */
export async function stopGame() {
	activeServerChild = null;
	const alive = procs.filter((c) => c && c.exitCode === null && c.signalCode === null);
	for (const child of alive) killProc(child, 'SIGTERM');
	await Promise.all(alive.map((child) => new Promise((resolve) => {
		if (child.exitCode !== null || child.signalCode !== null) return resolve();
		const done = () => resolve();
		child.once('exit', done);
		setTimeout(() => { killProc(child, 'SIGKILL'); done(); }, 2000).unref();
	})));
}
