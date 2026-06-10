import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	resetGameState,
	gameState,
	clearAllTimers,
	CARD_DEFS,
	EVOLUTION_TRANSFORMS,
	EVOLUTION_GRIND_REQUIRED,
	createCardInstance,
	evolveCard,
	updateMinions,
	applyWyrmMinionBreathStats,
	scaledGrindStat,
	isBurning,
	getEntityWorldY,
} from '../index.js';
import {
	connectAndJoinLobby,
	startTestServer,
	closeServer,
	waitForEvent,
	lobbyGameState,
} from './helpers.js';

function resetState() {
	resetGameState();
	gameState.gamePhase = 'playing';
	gameState.players.p1 = {
		id: 'p1',
		x: 0,
		z: 0,
		hp: 100,
		dead: false,
		lastActivity: Date.now(),
	};
}

describe('Ancient Wyrm definitions', () => {
	it('defines evolved stats and fire breath parameters', () => {
		expect(EVOLUTION_TRANSFORMS.dungeon_drake).toBe('ancient_wyrm');
		expect(CARD_DEFS.ancient_wyrm).toMatchObject({
			id: 'ancient_wyrm',
			type: 'creature',
			minionHp: 90,
			isEvolved: true,
			specialEffect: 'fire_breath',
			effect: 'ancient_wyrm',
			breathDurationMs: 2500,
			breathTickMs: 500,
		});
	});

	it('scales breath range and hold distance with grind for both wyrms', () => {
		const now = Date.now();
		const vault = {};
		applyWyrmMinionBreathStats(vault, CARD_DEFS.dungeon_drake, 5, now);
		expect(vault.breathRange).toBe(scaledGrindStat(6, 5));
		expect(vault.breathHoldDistance).toBe(scaledGrindStat(3.5, 5));

		const archive = {};
		applyWyrmMinionBreathStats(archive, CARD_DEFS.ancient_wyrm, 3, now);
		expect(archive.breathRange).toBe(scaledGrindStat(10, 3));
		expect(archive.breathHoldDistance).toBe(scaledGrindStat(5.5, 3));
		expect(archive.breathDamage).toBe(scaledGrindStat(4, 3));
	});

	it('evolves Vault Wyrm at +10 grind', () => {
		const player = {
			inventory: [
				createCardInstance('dungeon_drake', {
					instanceId: 'drake-1',
					grind: EVOLUTION_GRIND_REQUIRED,
				}),
			],
			ownedCards: { dungeon_drake: 1 },
			selectedDeck: ['drake-1'],
		};

		const result = evolveCard(player, 'drake-1');

		expect(result.ok).toBe(true);
		expect(result.toCardId).toBe('ancient_wyrm');
		expect(player.inventory[0].cardId).toBe('ancient_wyrm');
		expect(player.inventory[0].isEvolved).toBe(true);
	});
});

describe('Ancient Wyrm gameplay', () => {
	let baseUrl, socket;

	beforeEach(async () => {
		baseUrl = await startTestServer();
		({ socket } = await connectAndJoinLobby(baseUrl));
	});

	afterEach(async () => {
		if (socket && socket.connected) socket.disconnect();
		clearAllTimers();
		await closeServer();
	});

	it('spawns a minion with higher HP than base Vault Wyrm', async () => {
		const debugResultPromise = waitForEvent(socket, 'debugScenarioResult');
		socket.emit('debugScenario', { name: 'summon-ready' });
		await debugResultPromise;
		await waitForEvent(socket, 'stateUpdate');

		const state = lobbyGameState(socket._lobbyId);
		expect(state).toBeDefined();
		const player = state.players[socket._playerId];
		expect(player).toBeDefined();

		player.deck = [];
		player.hand = [{
			id: 'ancient_wyrm',
			name: 'Ancient Wyrm',
			type: 'creature',
			charges: 1,
			remainingCharges: 1,
		}];

		socket.emit('useCard', { cardId: 'ancient_wyrm', slotIndex: 0 });
		await waitForEvent(socket, 'cardUsed');

		const wyrm = state.minions.find(m => m.ownerId === socket._playerId && m.type === 'ancient_wyrm');
		expect(wyrm).toMatchObject({
			hp: 90,
			maxHp: 90,
			flying: true,
			altitude: CARD_DEFS.ancient_wyrm.altitude,
			lastBreathAt: expect.any(Number),
		});
	});
});

describe('Wyrm channeled breath', () => {
	beforeEach(() => {
		resetState();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('Vault Wyrm opens a short cone breath that ticks once immediately', () => {
		const now = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(now);

		gameState.enemies.push({
			id: 'e1',
			x: 4,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 4, z: 0 },
		});
		gameState.minions.push({
			id: 'drake-1',
			ownerId: 'p1',
			type: 'dungeon_drake',
			x: 0,
			z: 0,
			hp: 20,
			ttl: 30,
			breathRange: 6,
			breathHoldDistance: 3.5,
			breathConeAngle: Math.PI / 4,
			breathDamage: 2,
			burnDurationMs: 2000,
			breathDurationMs: 2000,
			breathTickMs: 500,
			breathIntervalMs: 2500,
			lastBreathAt: 0,
		});

		updateMinions();

		expect(gameState.enemies[0].hp).toBe(48);
		expect(isBurning(gameState.enemies[0])).toBe(true);
		expect(gameState.enemies[0].burningUntil).toBe(now + 2000);
		expect(gameState.minions[0].breathState).toBe('breathing');
		expect(gameState._pendingMinionBreaths).toHaveLength(1);
		expect(gameState._pendingMinionBreaths[0]).toMatchObject({
			cardId: 'dungeon_drake',
			attackRange: 6,
			attackConeAngle: Math.PI / 4,
			breathPhase: 'start',
			breathDurationMs: 2000,
			hits: [{ enemyId: 'e1', hp: 48 }],
		});
	});

	it('backs away when an enemy closes inside the preferred breath distance', () => {
		gameState.enemies.push({
			id: 'e1',
			x: 2,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 2, z: 0 },
		});
		gameState.minions.push({
			id: 'drake-1',
			ownerId: 'p1',
			type: 'dungeon_drake',
			x: 0,
			z: 0,
			hp: 20,
			ttl: 30,
			breathRange: 6,
			breathHoldDistance: 3.5,
			breathIntervalMs: 2500,
			lastBreathAt: 0,
		});

		const startX = gameState.minions[0].x;
		updateMinions();

		expect(gameState.enemies[0].hp).toBe(50);
		expect(gameState.minions[0].breathState).toBeUndefined();
		expect(gameState.minions[0].x).toBeLessThan(startX);
	});

	it('does not hit again until the next breath tick window', () => {
		const now = Date.now();
		gameState.enemies.push({
			id: 'e1',
			x: 2,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 2, z: 0 },
		});
		gameState.minions.push({
			id: 'drake-1',
			ownerId: 'p1',
			type: 'dungeon_drake',
			x: 0,
			z: 0,
			hp: 20,
			ttl: 30,
			breathState: 'breathing',
			breathStartedAt: now,
			breathDirX: 1,
			breathDirZ: 0,
			lastBreathTickAt: now,
			breathRange: 6,
			breathHoldDistance: 3.5,
			breathConeAngle: Math.PI / 4,
			breathDamage: 2,
			burnDurationMs: 2000,
			breathDurationMs: 2000,
			breathTickMs: 500,
		});

		updateMinions();

		expect(gameState.enemies[0].hp).toBe(50);
		expect(gameState._pendingMinionBreaths).toHaveLength(0);
	});

	it('Archive Wyrm channels fire breath instead of spamming melee swipes', () => {
		const now = Date.now();
		const altitude = CARD_DEFS.ancient_wyrm.altitude;
		gameState.minions.push({
			id: 'wyrm-1',
			ownerId: 'p1',
			type: 'ancient_wyrm',
			x: 0,
			z: 0,
			flying: true,
			altitude,
			hp: 90,
			ttl: 30,
			lastBreathAt: now - 3100,
			breathIntervalMs: 3000,
			breathRange: 10,
			breathHoldDistance: 5.5,
			breathDamage: CARD_DEFS.ancient_wyrm.breathDamage,
			breathConeAngle: CARD_DEFS.ancient_wyrm.breathConeAngle,
			breathDurationMs: 2500,
			breathTickMs: 500,
		});
		gameState.enemies.push({
			id: 'e1',
			x: 6,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 6, z: 0 },
		});

		updateMinions();

		const airborneY = getEntityWorldY(gameState.minions[0]);
		expect(gameState.enemies[0].hp).toBe(50 - CARD_DEFS.ancient_wyrm.breathDamage);
		expect(gameState.minions[0].breathState).toBe('breathing');
		expect(gameState._pendingMinionBreaths).toHaveLength(1);
		expect(gameState._pendingMinionBreaths[0]).toMatchObject({
			cardId: 'ancient_wyrm',
			specialEffect: 'fire_breath',
			breathPhase: 'start',
			hits: [{ enemyId: 'e1', hp: 50 - CARD_DEFS.ancient_wyrm.breathDamage }],
			origin: { x: 0, z: 0, y: airborneY },
		});
	});

	it('waits out breath cooldown instead of melee swiping between channels', () => {
		gameState.enemies.push({
			id: 'e1',
			x: 2,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 2, z: 0 },
		});
		gameState.minions.push({
			id: 'wyrm-1',
			ownerId: 'p1',
			type: 'ancient_wyrm',
			x: 0,
			z: 0,
			flying: true,
			altitude: CARD_DEFS.ancient_wyrm.altitude,
			hp: 90,
			ttl: 30,
			lastBreathAt: Date.now(),
			breathIntervalMs: 3000,
			breathRange: 10,
			breathHoldDistance: 5.5,
			breathDamage: 4,
			breathDurationMs: 2500,
			breathTickMs: 500,
		});

		updateMinions();

		expect(gameState.enemies[0].hp).toBe(50);
		expect(gameState._pendingMinionBreaths).toHaveLength(0);
	});
});
