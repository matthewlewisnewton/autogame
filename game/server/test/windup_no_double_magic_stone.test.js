// Regression: memory_shard and sacrificial_altar must NOT deduct magic stones a
// second time when resolving from a wind-up (tryBeginCardWindup already paid the
// cost at commit). The two effect branches previously deducted unconditionally,
// unlike the generic spell/creature branches that gate on `!fromWindup`. The real
// defs are cost 0 / no windUpMs so this was a latent double-charge; the test
// drives executeUseCard directly with a non-zero magicStoneCost to lock in the
// invariant for both the instant and the wind-up resolution paths.
import { describe, it, expect, beforeEach } from 'vitest';
import {
	gameState,
	resetGameState,
	findSacrificeTarget,
	resolveProjectileAim,
} from '../index.js';
import {
	executeUseCard,
	setCallbacks as setCardEffectCallbacks,
} from '../cardEffects.js';
import { SERVER_TO_CLIENT } from '../../shared/events.js';

// With no layout in gameState the floor fallback resolves to DEFAULT_FLOOR_Y (0.5).
const FLOOR_Y = 0.5;
const MAGIC_STONE_COST = 30;
const STARTING_STONES = 100;
const playerId = 'altar-windup-caster';

function resetState() {
	resetGameState();
	gameState.gamePhase = 'playing';
	// Keep an incomplete objective so card-exhaustion terminal checks stay quiet.
	gameState.run = {
		status: 'playing',
		objective: { type: 'defeat_enemies', current: 0, target: 5 },
	};
}

function addAltarPlayer() {
	gameState.players[playerId] = {
		id: playerId,
		x: 0,
		y: 0.5,
		z: 0,
		rotation: 0,
		hp: 100,
		dead: false,
		magicStones: STARTING_STONES,
		pendingSummons: new Set(),
		hand: [
			{ id: 'sacrificial_altar', name: 'Sacrificial Altar', type: 'spell', charges: 1, remainingCharges: 1, grind: 0 },
			null,
			null,
			null,
		],
		slotCooldowns: [null, null, null, null],
	};
	return gameState.players[playerId];
}

function addSacrificeMinion() {
	const minion = {
		id: 'doomed-minion',
		ownerId: playerId,
		type: 'dungeon_drake',
		x: 0,
		y: FLOOR_Y,
		z: 0,
		hp: 20,
		ttl: 30,
		createdAt: 10,
	};
	gameState.minions.push(minion);
	return minion;
}

// A sacrificial_altar cardDef carrying a non-zero cost (the real def is 0) so the
// presence/absence of the deduction is observable.
const ALTAR_DEF = {
	id: 'sacrificial_altar',
	name: 'Sacrificial Altar',
	type: 'spell',
	effect: 'sacrificial_altar',
	magicStoneCost: MAGIC_STONE_COST,
	sacrificeRadius: 6,
	magicStoneGain: 0,
	chargeRestore: 0,
};

describe('wind-up resolution does not double-charge magic stones (sacrificial_altar)', () => {
	beforeEach(() => {
		resetState();
		setCardEffectCallbacks({
			io: { to: () => ({ emit: () => {} }) },
			emitCardError: (sock, reason) => sock.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason }),
			findSacrificeTarget,
			resolveAttackRotation: (player, data) => (
				Number.isFinite(data?.rotation) ? data.rotation : (player.rotation || 0)
			),
			resolveProjectileAim,
		});
	});

	function castAltar(fromWindupResolution) {
		const player = gameState.players[playerId];
		const socket = { playerId, emit: () => {} };
		const lobby = { id: 'altar-lobby', state: gameState };
		executeUseCard(
			socket,
			gameState,
			lobby,
			{ cardId: 'sacrificial_altar', slotIndex: 0, rotation: 0 },
			{ now: Date.now(), player, cardDef: ALTAR_DEF, originX: player.x, originY: player.y, originZ: player.z, handCard: player.hand[0] },
			fromWindupResolution
				? { fromWindupResolution: true, originX: player.x, originY: player.y, originZ: player.z, rotation: 0, handCardSnapshot: { grind: 0 } }
				: {},
		);
	}

	it('the instant (non-windup) cast deducts the cost once', () => {
		addAltarPlayer();
		addSacrificeMinion();

		castAltar(false);

		expect(gameState.players[playerId].magicStones).toBe(STARTING_STONES - MAGIC_STONE_COST);
	});

	it('the wind-up resolution does NOT deduct again (cost was paid at commit)', () => {
		addAltarPlayer();
		addSacrificeMinion();

		castAltar(true);

		// fromWindup → no second deduction.
		expect(gameState.players[playerId].magicStones).toBe(STARTING_STONES);
	});
});
