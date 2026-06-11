import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	clearAllTimers,
	CARD_DEFS,
	isBurning,
	isSlowed,
} from '../index.js';
import { isPlayerCardCommitted } from '../simulation.js';
import {
	connectClient,
	startTestServer,
	closeServer,
	waitForEvent,
	testGameState,
	playerForSocket,
} from './helpers.js';

const TRAINING_CAVERNS_ID = 'training_caverns';
const TRAINING_CAVERNS_TIER_2 = 2;

describe('card exercises on crowded training_caverns tier 2', () => {
	let baseUrl;
	let socket;
	let prevAllowDebug;

	beforeEach(async () => {
		prevAllowDebug = process.env.ALLOW_DEBUG_SCENARIOS;
		process.env.ALLOW_DEBUG_SCENARIOS = '1';
		baseUrl = await startTestServer();
		({ socket } = await connectClient(baseUrl));
	});

	afterEach(async () => {
		if (socket?.connected) socket.disconnect();
		clearAllTimers();
		await closeServer();
		if (prevAllowDebug === undefined) {
			delete process.env.ALLOW_DEBUG_SCENARIOS;
		} else {
			process.env.ALLOW_DEBUG_SCENARIOS = prevAllowDebug;
		}
	});

	async function deployTrainingCavernsTier2() {
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'training-caverns-tier-2' });
		const result = await debugResultPromise;
		expect(result.ok).toBe(true);
		await waitForEvent(socket, 'stateUpdate');

		const state = testGameState();
		expect(state.gamePhase).toBe('playing');
		expect(state.selectedQuestId).toBe(TRAINING_CAVERNS_ID);
		expect(state.selectedQuestTier).toBe(TRAINING_CAVERNS_TIER_2);
		expect(state.layout.profile).toBe('crowded');
		expect(state.run?.status).toBe('playing');
		expect(state.run?.objective?.type).toBe('stage_boss');
		return state;
	}

	async function emitScenario(name) {
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name });
		const result = await debugResultPromise;
		expect(result.ok).toBe(true);
		await waitForEvent(socket, 'stateUpdate');
		return testGameState();
	}

	it('slow/burn mutual exclusivity after training-caverns-tier-2 deploy', async () => {
		const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);
		await deployTrainingCavernsTier2();

		const iceState = await emitScenario('ice-ball-ready');
		const player = playerForSocket(socket);
		const targetId = iceState.enemies.find((e) => e.type === 'grunt')?.id;
		expect(targetId).toBeTruthy();
		const iceSlot = player.hand.findIndex((c) => c && c.id === 'ice_ball');
		expect(iceSlot).toBeGreaterThanOrEqual(0);

		const iceUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { cardId: 'ice_ball', slotIndex: iceSlot });
		await iceUsedPromise;
		await waitForEvent(socket, 'stateUpdate');

		const afterIce = testGameState();
		const slowedTarget = afterIce.enemies.find((e) => e.id === targetId);
		expect(isSlowed(slowedTarget)).toBe(true);
		expect(testGameState().run?.status).toBe('playing');

		await emitScenario('fireball-hand-ready');
		const firePlayer = playerForSocket(socket);
		const fireSlot = firePlayer.hand.findIndex((c) => c && c.id === 'fireball');

		const fireUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { cardId: 'fireball', slotIndex: fireSlot });
		await fireUsedPromise;
		await waitForEvent(socket, 'stateUpdate');

		const afterFire = testGameState();
		const burnedTarget = afterFire.enemies.find((e) => e.id === targetId);
		const now = Date.now();

		expect(isBurning(burnedTarget)).toBe(true);
		expect(burnedTarget.burningUntil).toBeGreaterThan(now);
		expect(isSlowed(burnedTarget)).toBe(false);
		expect(isBurning(burnedTarget) && isSlowed(burnedTarget)).toBe(false);
		expect(afterFire.layout.profile).toBe('crowded');

		randomSpy.mockRestore();
	});

	it('purifying pulse heal/cleanse after training-caverns-tier-2 deploy', async () => {
		await deployTrainingCavernsTier2();
		await emitScenario('purifying-pulse-ready');

		const player = playerForSocket(socket);
		const slotIndex = player.hand.findIndex((c) => c && c.id === 'purifying_pulse');
		expect(slotIndex).toBeGreaterThanOrEqual(0);
		expect(isBurning(player)).toBe(true);
		const hpBefore = player.hp;

		const cardUsedPromise = waitForEvent(socket, 'cardUsed');
		socket.emit('useCard', { cardId: 'purifying_pulse', slotIndex });
		await cardUsedPromise;
		await waitForEvent(socket, 'stateUpdate');

		const state = testGameState();
		const afterPlayer = playerForSocket(socket);
		expect(afterPlayer.hp).toBe(hpBefore + CARD_DEFS.purifying_pulse.healAmount);
		expect(isSlowed(afterPlayer)).toBe(false);
		expect(isBurning(afterPlayer)).toBe(false);
		expect(state.enemies.every((e) => !isSlowed(e) && !isBurning(e))).toBe(true);
		expect(state.layout.profile).toBe('crowded');
	});

	it('magma greatsword wind-up after training-caverns-tier-2 deploy', async () => {
		await deployTrainingCavernsTier2();
		await emitScenario('magma-windup-ready');

		const player = playerForSocket(socket);
		const slotIndex = player.hand.findIndex((c) => c && c.id === 'magma_greatsword');
		expect(slotIndex).toBeGreaterThanOrEqual(0);

		const stateUpdatePromise = waitForEvent(socket, 'stateUpdate');
		socket.emit('useCard', { cardId: 'magma_greatsword', slotIndex, rotation: 0 });
		await stateUpdatePromise;

		const after = playerForSocket(socket);
		expect(after.cardUseState).toBe('windup');
		expect(after.pendingCardUse).toMatchObject({
			slotIndex,
			cardId: 'magma_greatsword',
		});
		expect(isPlayerCardCommitted(after)).toBe(true);
		expect(after.cardWindupStartTime + after.cardWindupMs).toBeGreaterThan(Date.now());
		expect(testGameState().layout.profile).toBe('crowded');
	});
});
