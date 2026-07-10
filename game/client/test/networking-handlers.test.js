import { describe, it, expect, vi } from 'vitest';
import { bindStateHandlers } from '../socketHandlers/stateHandlers.js';
import { bindLobbyHandlers } from '../socketHandlers/lobbyHandlers.js';
import { bindCardHandlers } from '../socketHandlers/cardHandlers.js';
import { bindLobbyBrowserHandlers } from '../socketHandlers/lobbyBrowserHandlers.js';
import { emitVolatile } from '../renderer.js';

function recordingSocket() {
	const listeners = new Map();
	return {
		listeners,
		on(event, handler) {
			if (!listeners.has(event)) listeners.set(event, []);
			listeners.get(event).push(handler);
		},
	};
}

function stateContext() {
	const ctx = {
		myId: 'p1',
		gameState: {
			gamePhase: 'playing',
			players: {
				p1: { x: 0, z: 0, dead: true, hand: [{ id: 'card-a' }], magicStones: 5 },
			},
		},
		currentLayout: null,
		hubLayout: null,
		currentLayoutSeed: null,
		lobbyEl: null,
		renderHand: vi.fn(),
		isLevelSettingsOpen: () => false,
		syncLocalCollectionState: () => false,
		isTerminalRunSummaryActive: () => false,
		needsTerminalRunSummaryFromState: () => false,
		getKeyItemCooldownRemainingMs: () => 100,
	};
	return new Proxy(ctx, {
		get(target, prop) {
			if (prop in target) return target[prop];
			const noop = vi.fn();
			target[prop] = noop;
			return noop;
		},
	});
}

describe('networking socket handlers', () => {
	it('does not rerender an unchanged preserved hand on a hot snapshot', () => {
		const socket = recordingSocket();
		const ctx = stateContext();
		bindStateHandlers(socket, ctx);
		const stateUpdate = socket.listeners.get('stateUpdate')[0];

		stateUpdate({
			gamePhase: 'playing',
			players: {
				p1: { x: 0, z: 0, dead: true, magicStones: 5 },
			},
			loot: [],
		});

		expect(ctx.gameState.players.p1.hand).toEqual([{ id: 'card-a' }]);
		expect(ctx.renderHand).not.toHaveBeenCalled();
	});

	it('registers exactly one questDialogue listener', () => {
		const socket = recordingSocket();
		const ctx = new Proxy({}, { get: () => vi.fn() });
		bindLobbyHandlers(socket, ctx);
		bindCardHandlers(socket, ctx);
		expect(socket.listeners.get('questDialogue')).toHaveLength(1);
	});

	it('clears a pending join only after lobbyJoined acknowledgement', () => {
		const socket = recordingSocket();
		const clearPendingLobbyJoin = vi.fn();
		const ctx = new Proxy({
			clearPendingLobbyJoin,
			showLobbyBrowserError: vi.fn(),
			applyLobbyJoinedData: vi.fn(),
			getBoothDebugHook: () => null,
		}, {
			get(target, prop) {
				if (prop in target) return target[prop];
				return vi.fn();
			},
		});
		bindLobbyBrowserHandlers(socket, ctx);

		socket.listeners.get('lobbyError')[0]({ reason: 'full' });
		expect(clearPendingLobbyJoin).not.toHaveBeenCalled();
		socket.listeners.get('lobbyJoined')[0]({ state: { gamePhase: 'lobby' } });
		expect(clearPendingLobbyJoin).toHaveBeenCalledTimes(1);
	});

	it('uses volatile transport for supersedable packets and drops while disconnected', () => {
		const reliableEmit = vi.fn();
		const volatileEmit = vi.fn();
		const socket = { connected: true, emit: reliableEmit, volatile: { emit: volatileEmit } };

		emitVolatile(socket, 'move', { sequence: 1 });
		expect(volatileEmit).toHaveBeenCalledWith('move', { sequence: 1 });
		expect(reliableEmit).not.toHaveBeenCalled();

		socket.connected = false;
		emitVolatile(socket, 'move', { sequence: 2 });
		expect(volatileEmit).toHaveBeenCalledTimes(1);
	});
});
