import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { CLIENT_TO_SERVER, SERVER_TO_CLIENT } = require('../../shared/events.js');
const { register } = require('../socketHandlers/lobbyHandlers.js');

// Drive only the SET_DEBUG_TIME_SCALE handler with a mock socket + ctx. The
// gate must depend strictly on ALLOW_DEBUG_SCENARIOS=1 and NOT on the
// localhost-permissive isDebugScenarioAllowed path, so the mock ctx makes
// isDebugScenarioAllowed() always return true to prove it is bypassed.
function wireHandler() {
	const state = { debugTimeScale: 1 };
	const emits = [];
	const handlers = {};
	const socket = {
		on(event, cb) { handlers[event] = cb; },
		emit(event, payload) { emits.push({ event, payload }); },
	};
	const ctx = {
		// isDebugScenarioAllowed deliberately returns true: if the handler still
		// consulted it, the env-unset rejection test below would fail.
		isDebugScenarioAllowed: () => true,
		withLobbyPlayer: (_sock, _opts, fn) => fn(state),
	};
	register(socket, ctx);
	return { state, emits, handlers };
}

function lastResult(emits) {
	const results = emits.filter((e) => e.event === SERVER_TO_CLIENT.DEBUG_TIME_SCALE_RESULT);
	return results.length ? results[results.length - 1].payload : null;
}

describe('SET_DEBUG_TIME_SCALE strict ALLOW_DEBUG_SCENARIOS gate', () => {
	let prevAllowDebug;

	beforeEach(() => {
		prevAllowDebug = process.env.ALLOW_DEBUG_SCENARIOS;
	});

	afterEach(() => {
		if (prevAllowDebug === undefined) {
			delete process.env.ALLOW_DEBUG_SCENARIOS;
		} else {
			process.env.ALLOW_DEBUG_SCENARIOS = prevAllowDebug;
		}
	});

	it('rejects with ok:false and leaves state unchanged when ALLOW_DEBUG_SCENARIOS is unset (even on a localhost socket)', () => {
		delete process.env.ALLOW_DEBUG_SCENARIOS;
		const { state, emits, handlers } = wireHandler();
		handlers[CLIENT_TO_SERVER.SET_DEBUG_TIME_SCALE]({ scale: 0 });

		expect(state.debugTimeScale).toBe(1); // unchanged
		const result = lastResult(emits);
		expect(result).toMatchObject({ ok: false });
		expect(typeof result.reason).toBe('string');
	});

	it('applies and clamps the scale when ALLOW_DEBUG_SCENARIOS=1', () => {
		process.env.ALLOW_DEBUG_SCENARIOS = '1';
		const { state, emits, handlers } = wireHandler();
		handlers[CLIENT_TO_SERVER.SET_DEBUG_TIME_SCALE]({ scale: 0.25 });

		expect(state.debugTimeScale).toBe(0.25);
		expect(lastResult(emits)).toEqual({ ok: true, scale: 0.25 });
	});

	it('clamps out-of-range scales to [0, 1] when authorized', () => {
		process.env.ALLOW_DEBUG_SCENARIOS = '1';
		const { state, emits, handlers } = wireHandler();
		handlers[CLIENT_TO_SERVER.SET_DEBUG_TIME_SCALE]({ scale: 5 });

		expect(state.debugTimeScale).toBe(1);
		expect(lastResult(emits)).toEqual({ ok: true, scale: 1 });
	});

	it('rejects a non-finite scale with ok:false when authorized', () => {
		process.env.ALLOW_DEBUG_SCENARIOS = '1';
		const { state, emits, handlers } = wireHandler();
		handlers[CLIENT_TO_SERVER.SET_DEBUG_TIME_SCALE]({ scale: 'fast' });

		expect(state.debugTimeScale).toBe(1); // unchanged
		expect(lastResult(emits)).toMatchObject({ ok: false });
	});
});
