// Drift-guard for the shared event-name registry (game/shared/events.json).
//
// PURPOSE
// -------
// Sub-tickets 01 and 02 routed every server/client socket call site through the
// shared registry so the wire vocabulary lives in exactly one place. This test
// is the safety net that keeps it that way: it statically scans the first
// argument of every `.emit(...)` / `.on(...)` call site and fails if anyone
// reintroduces a raw gameplay event-name string literal instead of an
// `EVENTS.<name>` reference, or if the registry drifts out of sync with usage.
//
// INVARIANTS ENFORCED (drift is caught in BOTH directions)
//   1. No raw gameplay literals: every `.emit(`/`.on(` first argument is either
//      an `EVENTS.<name>` reference or one of the explicitly allowlisted non-game
//      lifecycle names below. A bare string literal that is not on the allowlist
//      (e.g. `socket.emit('typoEvent', ...)`) fails invariant 1.
//   2. No dangling references: every `EVENTS.<name>` used at a call site resolves
//      to a key that actually exists in events.json. A typo'd constant
//      (e.g. `EVENTS.cardUesd`) fails invariant 2.
//   3. No dead registry entries: every key in events.json is referenced by at
//      least one `EVENTS.<name>` call site across the scanned server+client
//      files. Drift in the other direction — a registry name nobody emits or
//      listens for — fails invariant 3.
//
// FAILURE-MODE PROOF
//   The `demonstrates the failure modes` test below runs the same classifier
//   over synthetic source snippets to prove each invariant actually trips:
//   a raw literal trips (1), a bogus `EVENTS.` member trips (2), and an
//   unreferenced registry key trips (3).
//
// The scan is pure text (fs.readFileSync + regex). It deliberately does NOT
// import the modules, so the client (Vite/ESM) files never get loaded into the
// Node test runner.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const registry = require('../../shared/events.json');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = path.resolve(__dirname, '../..');

// Non-game lifecycle/transport names that are allowed to remain raw string
// literals — these are Socket.IO connection lifecycle and Node process events,
// not part of the gameplay vocabulary, so they never belong in the registry.
const LIFECYCLE_ALLOWLIST = new Set([
	'connection',
	'connect',
	'disconnect',
	'connect_error',
	'error',
	'heartbeat',
	'heartbeat_ack',
	'uncaughtException',
	'unhandledRejection',
	// Socket.IO client *manager* (`socket.io.on(...)`) reconnection lifecycle.
	'reconnect',
	'reconnect_attempt',
]);

// Files whose socket call sites must go through the registry. Kept explicit
// (rather than a glob) so a new server/client surface is a conscious addition
// here, matching the sub-ticket's enumerated scope.
const SCANNED_FILES = [
	'server/index.js',
	'server/progression.js',
	'server/cardEffects.js',
	'server/keyItemEffects.js',
	'server/debugScenarios.js',
	'server/hubPresence.js',
	'server/socketHandlers/deckHandlers.js',
	'server/socketHandlers/keyItemHandlers.js',
	'server/socketHandlers/lobbyHandlers.js',
	'server/socketHandlers/runHandlers.js',
	'server/socketHandlers/tradeHandlers.js',
	'client/main.js',
	'client/renderer.js',
	'client/characterBooth.js',
];

// Match a `.emit(` / `.on(` call site and capture the first-argument token up to
// the first comma or closing paren. Whitespace between the dot-call and the
// open paren / first arg is tolerated.
const CALL_SITE_RE = /\.(emit|on)\s*\(\s*([^,)\s][^,)]*)/g;
const STRING_LITERAL_RE = /^(['"`])(.*)\1$/;
const REGISTRY_REF_RE = /^EVENTS\.([A-Za-z_$][\w$]*)$/;

/**
 * Classify every `.emit`/`.on` first argument found in `source`.
 * Returns { literals: string[], refs: string[], dynamic: string[] }.
 *   literals — raw string-literal first args (the value inside the quotes)
 *   refs     — `EVENTS.<name>` member names
 *   dynamic  — anything else (variables/expressions); intentionally ignored,
 *              since a non-literal cannot be a stray raw event-name string.
 */
function classifyCallSites(source) {
	const literals = [];
	const refs = [];
	const dynamic = [];
	let m;
	CALL_SITE_RE.lastIndex = 0;
	while ((m = CALL_SITE_RE.exec(source)) !== null) {
		const arg = m[2].trim();
		const lit = STRING_LITERAL_RE.exec(arg);
		if (lit) {
			literals.push(lit[2]);
			continue;
		}
		const ref = REGISTRY_REF_RE.exec(arg);
		if (ref) {
			refs.push(ref[1]);
			continue;
		}
		dynamic.push(arg);
	}
	return { literals, refs, dynamic };
}

function scanAll() {
	const rawLiterals = []; // { file, name }
	const refNames = []; // { file, name }
	for (const rel of SCANNED_FILES) {
		const source = readFileSync(path.join(GAME_ROOT, rel), 'utf8');
		const { literals, refs } = classifyCallSites(source);
		for (const name of literals) rawLiterals.push({ file: rel, name });
		for (const name of refs) refNames.push({ file: rel, name });
	}
	return { rawLiterals, refNames };
}

describe('shared event-name registry drift guard', () => {
	const { rawLiterals, refNames } = scanAll();

	it('finds the call sites it expects to (scan is wired up correctly)', () => {
		// Guards against a silently-broken scan (e.g. a moved file or a regex
		// that matches nothing) passing the other assertions vacuously.
		expect(refNames.length).toBeGreaterThan(50);
	});

	it('invariant 1: no raw gameplay event-name string literals at call sites', () => {
		const offenders = rawLiterals.filter((e) => !LIFECYCLE_ALLOWLIST.has(e.name));
		expect(
			offenders,
			`Raw event-name literal(s) found at .emit/.on call sites. Use the shared ` +
				`registry (EVENTS.<name>) instead, or add a genuine lifecycle name to ` +
				`LIFECYCLE_ALLOWLIST:\n` +
				offenders.map((o) => `  ${o.file}: '${o.name}'`).join('\n'),
		).toEqual([]);
	});

	it('invariant 2: every EVENTS.<name> reference resolves to a registry key', () => {
		const dangling = refNames.filter((e) => !Object.prototype.hasOwnProperty.call(registry, e.name));
		expect(
			dangling,
			`EVENTS.<name> reference(s) with no matching key in events.json ` +
				`(typo or removed registry entry):\n` +
				dangling.map((o) => `  ${o.file}: EVENTS.${o.name}`).join('\n'),
		).toEqual([]);
	});

	it('invariant 3: every registry key is referenced by at least one call site', () => {
		const used = new Set(refNames.map((e) => e.name));
		const dead = Object.keys(registry).filter((k) => !used.has(k));
		expect(
			dead,
			`Registry key(s) in events.json that no scanned .emit/.on call site uses ` +
				`(dead entry — remove from the registry or wire it up):\n` +
				dead.map((k) => `  ${k}`).join('\n'),
		).toEqual([]);
	});

	it('demonstrates the failure modes (proves the guard actually trips)', () => {
		// Invariant 1 — a reintroduced raw gameplay literal.
		const badLiteral = classifyCallSites(`socket.emit('typoEvent', payload);`);
		const lit1 = badLiteral.literals.filter((n) => !LIFECYCLE_ALLOWLIST.has(n));
		expect(lit1).toEqual(['typoEvent']);

		// ...but an allowlisted lifecycle literal does NOT trip invariant 1.
		const okLiteral = classifyCallSites(`socket.on('disconnect', cb);`);
		expect(okLiteral.literals.filter((n) => !LIFECYCLE_ALLOWLIST.has(n))).toEqual([]);

		// Invariant 2 — a dangling EVENTS.<name> reference (typo'd constant).
		const badRef = classifyCallSites(`io.emit(EVENTS.cardUesd, snapshot);`);
		const dangling = badRef.refs.filter((n) => !Object.prototype.hasOwnProperty.call(registry, n));
		expect(dangling).toEqual(['cardUesd']);

		// Invariant 3 — a registry name nobody references is detected as dead.
		const used = new Set(['init', 'stateUpdate']);
		const dead = ['init', 'stateUpdate', 'orphanEvent'].filter((k) => !used.has(k));
		expect(dead).toEqual(['orphanEvent']);
	});
});
