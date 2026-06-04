#!/usr/bin/env node
/**
 * Run vitest in its own process group and always sweep orphaned workers
 * afterward (success, failure, timeout, or SIGINT from an agent shell).
 */
import { execFileSync, spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameDir = dirname(dirname(fileURLToPath(import.meta.url)));
const vitestArgs = process.argv.slice(2);

// kill-vitest.sh must never SIGKILL this launcher (pgrep "vitest" matches vitest.config.js).
process.env.RUN_VITEST_LAUNCHER_PID = String(process.pid);

if (vitestArgs.length === 0) {
	console.error('usage: node scripts/run-vitest.mjs <vitest args…>');
	process.exit(2);
}

function cleanupWorkers() {
	try {
		execFileSync('bash', [join(gameDir, 'scripts/kill-vitest.sh')], {
			cwd: gameDir,
			stdio: 'ignore',
		});
	} catch {
		// Nothing left to kill.
	}
}

let cleaned = false;
function cleanupOnce() {
	if (cleaned) {
		return;
	}
	cleaned = true;
	cleanupWorkers();
}

function killChildTree(child, signal = 'SIGKILL') {
	if (!child?.pid) {
		return;
	}
	if (process.platform === 'win32') {
		try {
			child.kill(signal);
		} catch {
			// Already exited.
		}
		return;
	}
	try {
		process.kill(-child.pid, signal);
	} catch {
		try {
			child.kill(signal);
		} catch {
			// Already exited.
		}
	}
}

const child = spawn('npx', ['vitest', ...vitestArgs], {
	cwd: gameDir,
	stdio: 'inherit',
	detached: process.platform !== 'win32',
});

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
	process.on(sig, () => {
		killChildTree(child, 'SIGKILL');
		cleanupOnce();
		process.exit(128 + (sig === 'SIGINT' ? 2 : sig === 'SIGTERM' ? 15 : 1));
	});
}

child.on('exit', (code, signal) => {
	cleanupOnce();
	if (signal) {
		const sigNum =
			{ SIGINT: 2, SIGKILL: 9, SIGTERM: 15 }[signal] ??
			(typeof signal === 'number' ? signal : 1);
		process.exit(128 + sigNum);
		return;
	}
	process.exit(code === 0 ? 0 : (code ?? 1));
});

child.on('error', (err) => {
	console.error(err);
	cleanupOnce();
	process.exit(1);
});

process.on('exit', cleanupOnce);
