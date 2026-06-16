import { describe, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runnerPath = path.join(__dirname, 'postgres_provider.pgmem.cjs');

function runPgmemCase(name) {
	const result = spawnSync(process.execPath, [runnerPath, name], {
		encoding: 'utf8',
		cwd: path.join(__dirname, '..'),
		env: { ...process.env, NODE_ENV: 'test' },
	});
	if (result.status !== 0) {
		throw new Error(result.stderr || result.stdout || `postgres_provider.pgmem.cjs failed: ${name}`);
	}
}

// PostgresProvider uses deasync for synchronous I/O; that blocks inside vitest workers.
// Each case runs in a plain Node child process against pg-mem (no live DATABASE_URL).
describe('PostgresProvider', () => {
	it('stores and retrieves player data', () => {
		runPgmemCase('stores and retrieves player data');
	});

	it('returns null for unknown player', () => {
		runPgmemCase('returns null for unknown player');
	});

	it('overwrites data on subsequent saves', () => {
		runPgmemCase('overwrites data on subsequent saves');
	});

	it('isolates data between different players', () => {
		runPgmemCase('isolates data between different players');
	});

	it('save returns a deep copy (mutations do not affect stored data)', () => {
		runPgmemCase('save returns a deep copy (mutations do not affect stored data)');
	});

	it('load returns a deep copy (mutations do not affect stored data)', () => {
		runPgmemCase('load returns a deep copy (mutations do not affect stored data)');
	});

	it('close is a no-op when pool is injected', () => {
		runPgmemCase('close is a no-op when pool is injected');
	});

	it('rejects a traversal playerId on save', () => {
		runPgmemCase('rejects a traversal playerId on save');
	});

	it('rejects a traversal playerId on load', () => {
		runPgmemCase('rejects a traversal playerId on load');
	});

	it('rejects playerIds containing path separators or dots', () => {
		runPgmemCase('rejects playerIds containing path separators or dots');
	});

	it('accepts UUID-shaped playerIds unchanged', () => {
		runPgmemCase('accepts UUID-shaped playerIds unchanged');
	});

	it('stores and retrieves settings', () => {
		runPgmemCase('stores and retrieves settings');
	});

	it('returns null for unknown settings accountId', () => {
		runPgmemCase('returns null for unknown settings accountId');
	});

	it('overwrites settings on subsequent saves', () => {
		runPgmemCase('overwrites settings on subsequent saves');
	});

	it('isolates settings between different accounts', () => {
		runPgmemCase('isolates settings between different accounts');
	});

	it('settings are independent from player data', () => {
		runPgmemCase('settings are independent from player data');
	});

	it('rejects a traversal accountId on settings save', () => {
		runPgmemCase('rejects a traversal accountId on settings save');
	});

	it('rejects a traversal accountId on settings load', () => {
		runPgmemCase('rejects a traversal accountId on settings load');
	});

	it('accepts UUID-shaped accountIds for settings', () => {
		runPgmemCase('accepts UUID-shaped accountIds for settings');
	});
});
