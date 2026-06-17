import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	clearAllTimers,
	getCardDef,
	runGameLoopTick,
} from '../index.js';
import {
	isPlayerCardCommitted,
	processPendingCardWindups,
	setGameState as setSimGameState,
} from '../simulation.js';
import { setGameState as setProgressionGameState } from '../progression.js';
import { MAX_MAGIC_STONES } from '../config.js';
import {
	connectClient,
	startTestServer,
	closeServer,
	waitForEvent,
	lobbyGameState,
} from './helpers.js';

describe('card wind-up by card type', () => {
	let baseUrl;
	let socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		clearAllTimers();
		await closeServer();
	});

	async function connectAndStartRun() {
		({ socket } = await connectClient(baseUrl));
		const startGamePromise = waitForEvent(socket, 'startGame');
		socket.emit('playerReady', true);
		await startGamePromise;
		return lobbyGameState(socket._lobbyId);
	}

	function setupWindupCard({ cardId, handCard, enemyNear = true }) {
		const state = lobbyGameState(socket._lobbyId);
		const player = state.players[socket._playerId];
		player.rotation = 0;
		player.magicStones = MAX_MAGIC_STONES;
		player.slotCooldowns = new Array(player.hand.length).fill(null);
		player.hand[0] = handCard;
		if (enemyNear) {
			const targetX = player.x + 2;
			const targetZ = player.z;
			state.enemies = [{
				id: 'windup-type-target',
				type: 'grunt',
				x: targetX,
				z: targetZ,
				y: 0.5,
				hp: 200,
				maxHp: 200,
				state: 'idle',
				attackState: 'idle',
				wanderTarget: { x: targetX, z: targetZ },
			}];
		} else {
			state.enemies = [];
		}
		state.enchantments = state.enchantments || [];
		state.minions = state.minions || [];
		return { state, player };
	}

	async function waitForPlayerWindup(player, timeoutMs = 10000) {
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			if (player.cardUseState === 'windup') return;
			await new Promise((resolve) => setTimeout(resolve, 5));
		}
		throw new Error('Timed out waiting for cardUseState windup');
	}

	async function expectWindupLifecycle({
		cardId,
		handCard,
		windUpMs,
		magicStoneCost = 0,
		enemyNear = true,
		assertNoEffectAtCommit,
		assertEffectAfterResolve,
		handAfterCommit,
	}) {
		const { state, player } = setupWindupCard({ cardId, handCard, enemyNear });
		const msBefore = player.magicStones;
		const chargesBefore = player.hand[0].remainingCharges;
		const handIdBefore = player.hand[0]?.id;

		let cardUsed = false;
		socket.on('cardUsed', () => { cardUsed = true; });

		socket.emit('useCard', { cardId, slotIndex: 0, rotation: 0 });
		await waitForPlayerWindup(player);

		expect(cardUsed).toBe(false);
		expect(player.cardUseState).toBe('windup');
		expect(isPlayerCardCommitted(player)).toBe(true);
		expect(player.magicStones).toBeCloseTo(msBefore - magicStoneCost, 1);
		expect(player.slotCooldowns[0]).toBeGreaterThan(Date.now() - 1000);
		if (handAfterCommit) {
			handAfterCommit({ player, chargesBefore, handIdBefore });
		}
		assertNoEffectAtCommit({ state, player });

		const msAfterCommit = player.magicStones;
		const cooldownAfterCommit = player.slotCooldowns[0];

		setSimGameState(state, {});
		setProgressionGameState(state);
		player.cardWindupStartTime = Date.now() + 100000;
		await processPendingCardWindups();
		expect(cardUsed).toBe(false);
		assertNoEffectAtCommit({ state, player });

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		player.cardWindupStartTime = Date.now() - windUpMs - 50;
		runGameLoopTick();
		const cardUsedPayload = await cardUsedPromise;

		expect(player.cardUseState).toBeUndefined();
		expect(isPlayerCardCommitted(player)).toBe(false);
		expect(player.pendingCardUse).toBeUndefined();
		// runGameLoopTick during resolve may apply MAGIC_STONES_REGEN_PER_TICK (0.005).
		expect(player.magicStones).toBeCloseTo(msAfterCommit, 1);
		expect(player.slotCooldowns[0]).toBe(cooldownAfterCommit);
		expect(cardUsedPayload.cardId).toBe(cardId);
		assertEffectAfterResolve({ state, player, cardUsedPayload });
	}

	it('glacier_collapse commits to windup and resolves freeze damage once', async () => {
		await connectAndStartRun();
		const windUpMs = getCardDef('glacier_collapse').windUpMs;
		const magicStoneCost = getCardDef('glacier_collapse').magicStoneCost;

		await expectWindupLifecycle({
			cardId: 'glacier_collapse',
			windUpMs,
			magicStoneCost,
			handCard: {
				id: 'glacier_collapse',
				name: 'Glacier Rupture',
				type: 'spell',
				charges: 1,
				remainingCharges: 1,
			},
			handAfterCommit: ({ player }) => {
				expect(player.hand[0]).toBeNull();
			},
			assertNoEffectAtCommit: ({ state }) => {
				expect(state.enemies[0].hp).toBe(200);
			},
			assertEffectAfterResolve: ({ state, cardUsedPayload }) => {
				expect(state.enemies[0].hp).toBeLessThan(200);
				expect(cardUsedPayload.frozen).toBe(true);
			},
		});
	});

	it('dungeon_drake commits to windup and spawns a minion once after windUpMs', async () => {
		await connectAndStartRun();
		const windUpMs = getCardDef('dungeon_drake').windUpMs;

		await expectWindupLifecycle({
			cardId: 'dungeon_drake',
			windUpMs,
			magicStoneCost: 0,
			enemyNear: false,
			handCard: {
				id: 'dungeon_drake',
				name: 'Vault Wyrm',
				type: 'creature',
				charges: 1,
				remainingCharges: 1,
			},
			handAfterCommit: ({ player, chargesBefore }) => {
				expect(player.hand[0].id).toBe('dungeon_drake');
				expect(player.hand[0].remainingCharges).toBe(chargesBefore);
			},
			assertNoEffectAtCommit: ({ state }) => {
				expect(state.minions.length).toBe(0);
			},
			assertEffectAfterResolve: ({ state, player, cardUsedPayload }) => {
				expect(state.minions.length).toBe(1);
				expect(state.minions[0].ownerId).toBe(socket._playerId);
				expect(cardUsedPayload.minionId).toBe(state.minions[0].id);
				expect(player.hand[0].activeMinionId).toBe(state.minions[0].id);
				expect(player.hand[0].remainingCharges).toBe(0);
			},
		});
	});

	it('spike_trap commits to windup and places a ground enchantment after windUpMs', async () => {
		await connectAndStartRun();
		const windUpMs = getCardDef('spike_trap').windUpMs;
		const magicStoneCost = getCardDef('spike_trap').magicStoneCost;

		await expectWindupLifecycle({
			cardId: 'spike_trap',
			windUpMs,
			magicStoneCost,
			enemyNear: false,
			handCard: {
				id: 'spike_trap',
				name: 'Spike Trap',
				type: 'enchantment',
				charges: 1,
				remainingCharges: 1,
			},
			handAfterCommit: ({ player }) => {
				expect(player.hand[0]).toBeNull();
			},
			assertNoEffectAtCommit: ({ state }) => {
				expect(state.enchantments.length).toBe(0);
			},
			assertEffectAfterResolve: ({ state, cardUsedPayload }) => {
				expect(state.enchantments.length).toBe(1);
				expect(state.enchantments[0].cardId).toBe('spike_trap');
				expect(cardUsedPayload.effect).toBe('spike_trap');
			},
		});
	});
});
