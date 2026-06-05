import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const gameRoot = join(__dirname, '..', '..');

const SOCKET_IO_ALLOWLIST = new Set(['connect', 'disconnect', 'connect_error']);

const eventsCatalog = JSON.parse(readFileSync(join(gameRoot, 'shared/events.json'), 'utf8'));
const serverToClient = new Set(Object.values(eventsCatalog.serverToClient));
const clientToServer = new Set(Object.values(eventsCatalog.clientToServer));

const SERVER_ROOT_FILES = [
	'server/index.js',
	'server/progression.js',
	'server/cardEffects.js',
	'server/keyItemEffects.js',
	'server/debugScenarios.js',
	'server/hubPresence.js',
];

function listSocketHandlerFiles() {
	const dir = join(gameRoot, 'server/socketHandlers');
	return readdirSync(dir)
		.filter((name) => name.endsWith('.js'))
		.map((name) => `server/socketHandlers/${name}`);
}

/** Strip comments so doc/inline references like socket.on('useCard') are not scanned. */
function stripComments(source) {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\/\/.*$/gm, '');
}

function findLiteralMatches(source, regex) {
	const matches = [];
	const lines = source.split('\n');
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		regex.lastIndex = 0;
		let match;
		while ((match = regex.exec(line)) !== null) {
			matches.push({ line: i + 1, event: match[1] });
		}
	}
	return matches;
}

const EMIT_LITERAL = /\.emit\s*\(\s*['"]([^'"]+)['"]/g;
const SOCKET_ON_LITERAL = /socket\.on\s*\(\s*['"]([^'"]+)['"]/g;
const S_ON_LITERAL = /\bs\.on\s*\(\s*['"]([^'"]+)['"]/g;
const SOCKET_EMIT_LITERAL = /socket\.emit\s*\(\s*['"]([^'"]+)['"]/g;

function scanServerFile(relativePath) {
	const source = stripComments(readFileSync(join(gameRoot, relativePath), 'utf8'));
	const offenses = [];

	for (const { line, event } of findLiteralMatches(source, EMIT_LITERAL)) {
		if (!serverToClient.has(event)) {
			offenses.push({ file: relativePath, line, event, kind: '.emit(' });
		}
	}

	for (const { line, event } of findLiteralMatches(source, SOCKET_ON_LITERAL)) {
		if (!SOCKET_IO_ALLOWLIST.has(event) && !clientToServer.has(event)) {
			offenses.push({ file: relativePath, line, event, kind: 'socket.on(' });
		}
	}

	return offenses;
}

function scanClientMain() {
	const relativePath = 'client/main.js';
	const source = stripComments(readFileSync(join(gameRoot, relativePath), 'utf8'));
	const offenses = [];

	for (const { line, event } of findLiteralMatches(source, S_ON_LITERAL)) {
		if (!SOCKET_IO_ALLOWLIST.has(event) && !serverToClient.has(event)) {
			offenses.push({ file: relativePath, line, event, kind: 's.on(' });
		}
	}

	for (const { line, event } of findLiteralMatches(source, SOCKET_EMIT_LITERAL)) {
		if (!clientToServer.has(event)) {
			offenses.push({ file: relativePath, line, event, kind: 'socket.emit(' });
		}
	}

	return offenses;
}

function formatOffenses(offenses) {
	return offenses
		.map(({ file, line, event, kind }) => `${file}:${line} ${kind}'${event}' not in shared event catalog`)
		.join('\n');
}

describe('socket event drift guard', () => {
	it('flags unregistered string literals in a sample snippet', () => {
		const sample = "socket.emit('typoEvent', {});\nsocket.on('typoEvent', () => {});";
		const emitHits = findLiteralMatches(stripComments(sample), EMIT_LITERAL);
		const onHits = findLiteralMatches(stripComments(sample), SOCKET_ON_LITERAL);
		expect(emitHits.some((h) => h.event === 'typoEvent')).toBe(true);
		expect(onHits.some((h) => h.event === 'typoEvent')).toBe(true);
		expect(clientToServer.has('typoEvent')).toBe(false);
	});

	it('server production paths only use catalogued wire strings for .emit( and socket.on(', () => {
		const paths = [...SERVER_ROOT_FILES, ...listSocketHandlerFiles()];
		const offenses = paths.flatMap(scanServerFile);
		expect(offenses, formatOffenses(offenses)).toEqual([]);
	});

	it('client main.js only uses catalogued wire strings for s.on( and socket.emit(', () => {
		const offenses = scanClientMain();
		expect(offenses, formatOffenses(offenses)).toEqual([]);
	});
});
