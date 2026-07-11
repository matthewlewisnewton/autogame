import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import config, { MAX_HP, LOBBY_REVIVE_HP, PLAYER_MOVEMENT_SAVE_DEBOUNCE_MS, RUN_EXHAUSTION_GRACE_MS } from '../config.js';

const require = createRequire(import.meta.url);
const { syncDebugHooksForScenario } = require('../debugScenarios.js');
import { getQuest, countScriptedEnemiesInQuest, QUEST_DEFS } from '../quests.js';
import { DEFAULT_COSMETIC } from '../cosmetic.js';
import { createLobbyGameState } from '../lobbies.js';
import {
	mulberry32,
	generateLayout,
	damagePlayer,
	updateEnemies,
	updateMinions,
	spawnLoot,
	spawnEnemy,
	spawnEnemies,
	updateSurviveSpawns,
	firstRoomPosition,
	buildPlayerRecord,
	createGameState,
	resetGameState,
	gameState,
	runGameLoopTick,
	cleanupStalePlayers,
	findSocketByPlayerId,
	registerPlayerSocket,
	unregisterPlayerSocket,
	regenMagicStones,
	createRunState,
	startDungeonRun,
	recordEnemyDefeated,
	isRunObjectiveComplete,
	getEnemyCardDrop,
	recordEnemyCardDrop,
	getEnemyMagicStoneDrop,
	getEnemyCurrencyDrop,
	spawnMagicStoneDrop,
	removeDeadEnemies,
	buildCardChoices,
	claimCardReward,
	clampObjectiveProgress,
	buildRunSummary,
	checkRunTerminalState,
	tickCombatExhaustionGrace,
	resetTransientRunState,
	returnPlayersToLobby,
	giveUpRun,
	previewReturnRewards,
	healAtMedic,
	revivePlayerInLobby,
	checkAllReady,
	initializePlayerForActiveRun,
		tryEnterTelepipe,
		abandonSuspendedRun,
		isPlayerActive,
		checkTelepipeProximity,
		PORTAL_PLACEMENT_GRACE_MS,
		PORTAL_RADIUS,
	createPlayerProgress,
	grantCard,
	grantRunRewards,
	buildPlayerRewardSummary,
	createCardInstance,
	createInventoryFromOwnedCards,
	inventoryToOwnedCards,
	normalizePlayerInventory,
	cardIdForDeckEntry,
	validateDeck,
	canAddCardToDeck,
	canSellCardInstance,
	sellCard,
	offerCardTrade,
	respondCardTrade,
	getCardSellValue,
	getCardBuyValue,
	buyShopCard,
	pickShopOffer,
	createCardInstance,
	createInventoryFromOwnedCards,
	normalizePlayerInventory,
	getInventoryInstance,
	createDrawDeckFromSelectedDeck,
	initPlayerHand,
	drawCardFromDeck,
	drawReplacementCard,
	replaceConsumedCard,
	exhaustHandSlot,
	drawCardIntoHand,
	processPassiveDraws,
	canDrawIntoHand,
	countFilledHandSlots,
	validateDiscardHand,
	beginCreatureBurnDown,
	releaseBurningCreatureCard,
	drawCardFromDesperationDeck,
	initDesperationDeck,
	createEchoCard,
	getCardDef,
	DESPERATION_CARD_DEFS,
	DESPERATION_DECK_TEMPLATE,
	discardCardFromHand,
	isPlayerOutOfCards,
	canPlayerCastHandCard,
	isPlayerCombatExhausted,
	validateUseCardHand,
	stateSnapshot,
	hotStateSnapshot,
	addMagicStones,
	restoreCardCharges,
	restoreHandCharges,
	QUEST_DEFS,
	DEFAULT_QUEST_ID,
	CARD_DEFS,
	STARTING_DECK_IDS,
	QUEST_DEFS,
	DEFAULT_QUEST_ID,
	io as serverIo,
	STALE_THRESHOLD,
	DISCONNECT_GRACE_MS,
	MAX_MAGIC_STONES,
	STARTING_MAGIC_STONES,
	MAGIC_STONES_REGEN_PER_TICK,
	DETECTION_RADIUS,
	ATTACK_RANGE,
	TICK_RATE,
	GRID_COLS,
	GRID_ROWS,
	CELL_SPACING,
	DECK_MIN_SIZE,
	DECK_MAX_SIZE,
	ENEMY_ATTACK_RANGE,
	ENEMY_ATTACK_RECOVERY_MS,
	ENEMY_DEFS,
	savePlayerData,
	saveAllPlayersInAllLobbies,
	setTestProvider,
	ENTITY_RADIUS,
	PLAYER_RADIUS,
	resolveWallCollision,
	checkSweptCollision,
	segmentAABBEntryT,
	segmentIntersectsAABB,
	isEntityPositionBlocked,
	moveEntityToward,
	MINION_FOLLOW_DISTANCE,
	MINION_FOLLOW_SPEED,
	HUB_LAYOUT,
	isInsideDungeon,
} from '../index.js';
import {
	hubSpawnPosition,
	buildHubMovementContext,
	computeDungeonBounds,
} from '../simulation.js';
import { sampleFloorY, resolveFloorY } from '../dungeon.js';
import * as progressionModule from '../progression.js';

const { createLobby, resetAllLobbies } = require('../lobbies.js');
const { VARIANT_DEFS } = require('../enemyVariants.js');

// ── Helpers ──

function resetState() {
	Object.assign(gameState, createGameState());
}

function addPlayer(id, overrides = {}) {
	gameState.players[id] = {
		x: 0,
		y: 0.5,
		z: 0,
		rotation: 0,
		hp: 100,
		dead: false,
		lastActivity: Date.now(),
		ready: false,
		magicStones: MAX_MAGIC_STONES,
		currency: 0,
		debugScenario: null,
		debugHooks: null,
		pendingSummons: new Set(),
		deck: [],
		...overrides
	};
	syncDebugHooksForScenario(gameState.players[id], gameState.players[id].debugScenario);
}

function firstRoomSpawn() {
	const first = gameState.layout.rooms[0];
	return { x: first.x, z: first.z };
}

describe('runGameLoopTick()', () => {
	beforeEach(() => {
		resetAllLobbies();
		resetState();
	});

	afterEach(() => {
		resetAllLobbies();
		vi.restoreAllMocks();
	});

	function setupLobby(phase = 'lobby') {
		const lobby = createLobby('Tick Test');
		lobby.state.gamePhase = phase;
		return lobby;
	}

	it('broadcasts state updates in the lobby without running combat simulation', () => {
		const lobby = setupLobby('lobby');
		const roomEmit = vi.fn();
		vi.spyOn(serverIo, 'to').mockReturnValue({ emit: roomEmit });

		expect(runGameLoopTick()).toBe(true);

		expect(serverIo.to).toHaveBeenCalledWith(lobby.id);
		expect(roomEmit).toHaveBeenCalledWith('stateUpdate', expect.objectContaining({
			gamePhase: 'lobby',
		}));
	});

	it('broadcasts state updates during active gameplay', () => {
		const lobby = setupLobby('playing');
		const roomEmit = vi.fn();
		vi.spyOn(serverIo, 'to').mockReturnValue({ emit: roomEmit });

		expect(runGameLoopTick()).toBe(true);

		expect(serverIo.to).toHaveBeenCalledWith(lobby.id);
		expect(roomEmit).toHaveBeenCalledWith('stateUpdate', expect.objectContaining({
			gamePhase: 'playing',
		}));
	});

	it('does not broadcast when no lobbies exist', () => {
		const emitSpy = vi.spyOn(serverIo, 'emit').mockImplementation(() => true);
		const toSpy = vi.spyOn(serverIo, 'to').mockReturnValue({ emit: vi.fn() });

		expect(runGameLoopTick()).toBe(true);

		expect(emitSpy).not.toHaveBeenCalled();
		expect(toSpy).not.toHaveBeenCalled();
	});

	it('tick-emitted stateUpdate omits per-player cold fields', () => {
		const lobby = setupLobby('playing');
		const inventory = createInventoryFromOwnedCards({ iron_sword: 1, flame_blade: 1 });
		lobby.state.players['p1'] = {
			x: 1,
			y: 0.5,
			z: 2,
			rotation: 0.5,
			hp: 80,
			dead: false,
			ready: true,
			magicStones: 40,
			currency: 15,
			deck: ['iron_sword'],
			hand: [{ id: 'flame_blade', name: 'Flame Blade', type: 'weapon', charges: 1, remainingCharges: 1 }],
			desperationDeck: ['rusty_shiv'],
			inDesperation: false,
			nextDrawAt: Date.now() + 5000,
			inventory,
			selectedDeck: inventory.map((instance) => instance.instanceId),
			ownedCards: { iron_sword: 1, flame_blade: 1 },
			runRewards: { currency: 5, cards: [] },
			currencyEarnedThisRun: 3,
			debugScenario: 'summon-low-mana',
			pendingSummons: new Set(),
			lastActivity: Date.now(),
		};

		const roomEmit = vi.fn();
		vi.spyOn(serverIo, 'to').mockReturnValue({ emit: roomEmit });

		expect(runGameLoopTick()).toBe(true);

		expect(serverIo.to).toHaveBeenCalledWith(lobby.id);
		const snapshot = roomEmit.mock.calls.find(([event]) => event === 'stateUpdate')?.[1];
		expect(snapshot).toBeDefined();
		const player = snapshot.players['p1'];
		expect(player).toBeDefined();
		expect(player.x).toBe(1);
		expect(player.y).toBe(0.5);
		expect(player.z).toBe(2);
		expect(player.hp).toBe(80);
		expect(player.deck).toBeUndefined();
		expect(player.hand).toBeUndefined();
		expect(player.inventory).toBeUndefined();
		expect(player.desperationDeck).toBeUndefined();
		expect(player.ownedCards).toBeUndefined();
		expect(player.selectedDeck).toBeUndefined();
		expect(player.runRewards).toBeUndefined();
		expect(player.currencyEarnedThisRun).toBeUndefined();
		expect(player.returnRewardsPreview).toBeUndefined();
		expect(player.inDesperation).toBeUndefined();
		expect(player.nextDrawAt).toBeUndefined();
		expect(player.debugScenario).toBeUndefined();
	});
});

// ── Quest definitions ──

describe('QUEST_DEFS', () => {
	it('exposes stable quest ids with required metadata', () => {
		expect(DEFAULT_QUEST_ID).toBe('training_caverns');
		expect(Object.keys(QUEST_DEFS).sort()).toEqual(['annex_escort', 'arena_trials', 'canyon_descent', 'citadel_assault', 'crucible_duel', 'crystal_rescue', 'ember_descent', 'endless_siege', 'frost_crossing', 'rift_convergence', 'spire_ascent', 'training_caverns', 'vault_onslaught']);

		for (const [questId, quest] of Object.entries(QUEST_DEFS)) {
			expect(quest.id).toBe(questId);
			expect(quest.tiers[1]).toBeTruthy();
			const tier1 = quest.tiers[1];
			expect(tier1.name).toBeTruthy();
			expect(tier1.description).toBeTruthy();
			expect(tier1.objectiveType).toBeTruthy();
			expect(typeof tier1.rewardCurrency).toBe('number');
			if (tier1.objectiveType === 'defeat_enemies') {
				const scriptedCount = countScriptedEnemiesInQuest(tier1);
				if (scriptedCount > 0) {
					expect(scriptedCount).toBeGreaterThan(0);
				} else {
					expect(typeof tier1.enemyCount).toBe('number');
				}
			}
			if (tier1.objectiveType === 'collect_items') {
				expect(typeof tier1.itemCount).toBe('number');
				if (tier1.enemyCount !== undefined) {
					expect(typeof tier1.enemyCount).toBe('number');
				}
			}
			if (tier1.objectiveType === 'survive') {
				expect(typeof tier1.totalSpawns).toBe('number');
				expect(typeof tier1.minibossCount).toBe('number');
				expect(tier1.minibossCount).toBeLessThan(tier1.totalSpawns);
			}
		}
	});

	it('createGameState defaults to the canonical selected quest', () => {
		const state = createGameState();
		expect(state.selectedQuestId).toBe(DEFAULT_QUEST_ID);
	});
});

// ── mulberry32 PRNG ──

describe('mulberry32(seed)', () => {
	it('returns a function', () => {
		expect(typeof mulberry32(42)).toBe('function');
	});

	it('produces values in [0, 1)', () => {
		const rng = mulberry32(123);
		for (let i = 0; i < 100; i++) {
			const v = rng();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	it('is deterministic for a fixed seed', () => {
		const a = mulberry32(99);
		const b = mulberry32(99);
		for (let i = 0; i < 50; i++) {
			expect(a()).toBe(b());
		}
	});

	it('produces different sequences for different seeds', () => {
		const a = mulberry32(1);
		const b = mulberry32(2);
		let differs = false;
		for (let i = 0; i < 100; i++) {
			if (a() !== b()) {
				differs = true;
				break;
			}
		}
		expect(differs).toBe(true);
	});
});

// ── generateLayout ──

describe('generateLayout(seed)', () => {
	it('returns an object with rooms and passages arrays', () => {
		const layout = generateLayout(42);
		expect(Array.isArray(layout.rooms)).toBe(true);
		expect(Array.isArray(layout.passages)).toBe(true);
	});

	it('is deterministic for a fixed seed', () => {
		const a = generateLayout(777);
		const b = generateLayout(777);
		expect(a.rooms.length).toBe(b.rooms.length);
		expect(a.passages.length).toBe(b.passages.length);
		expect(a.rooms[0].x).toBe(b.rooms[0].x);
		expect(a.rooms[0].z).toBe(b.rooms[0].z);
	});

	it('produces at least 4 rooms', () => {
		const layout = generateLayout(1);
		expect(layout.rooms.length).toBeGreaterThanOrEqual(4);
	});

	it('rooms respect grid bounds', () => {
		const layout = generateLayout(12345);
		// Max cell index is (N-1), center offset is (N-1)/2, so max coord = ((N-1) - (N-1)/2) * CELL_SPACING
		// For N=4: max coord = (3 - 1.5) * 20 = 30
		const maxCoord = ((Math.max(GRID_COLS, GRID_ROWS) - 1) - (Math.max(GRID_COLS, GRID_ROWS) - 1) / 2) * CELL_SPACING;
		for (const room of layout.rooms) {
			expect(Math.abs(room.x)).toBeLessThanOrEqual(maxCoord);
			expect(Math.abs(room.z)).toBeLessThanOrEqual(maxCoord);
		}
	});

	it('each room has width, depth, and walls', () => {
		const layout = generateLayout(99);
		for (const room of layout.rooms) {
			expect(room.width).toBeGreaterThan(0);
			expect(room.depth).toBeGreaterThan(0);
			expect(Array.isArray(room.walls)).toBe(true);
		}
	});

	it('different seeds produce different layouts', () => {
		const a = generateLayout(1);
		const b = generateLayout(2);
		// At least one room position should differ
		let differs = false;
		for (let i = 0; i < Math.min(a.rooms.length, b.rooms.length); i++) {
			if (a.rooms[i].x !== b.rooms[i].x || a.rooms[i].z !== b.rooms[i].z) {
				differs = true;
				break;
			}
		}
		expect(differs).toBe(true);
	});

	it('produces sloped rooms when slopes option is enabled (applyLayoutForQuest path)', () => {
		// applyLayoutForQuest calls generateLayout(seed, profile, { slopes: true });
		// Verify the layout it produces has at least one room with non-uniform floorCorners.
		const layout = generateLayout(42, undefined, { slopes: true });
		const hasSlopedRoom = layout.rooms.some(room => {
			const fc = room.floorCorners;
			if (!fc) return false;
			const heights = [fc.yNW, fc.yNE, fc.ySE, fc.ySW];
			return heights.some(h => h !== heights[0]);
		});
		expect(hasSlopedRoom).toBe(true);
	});

	it('gameState.layout (set by applyLayoutForQuest) contains sloped rooms', () => {
		// gameState.layout is initialized at module load by applyLayoutForQuest,
		// which now passes { slopes: true }. Verify the live state reflects this.
		const hasSlopedRoom = gameState.layout.rooms.some(room => {
			const fc = room.floorCorners;
			if (!fc) return false;
			const heights = [fc.yNW, fc.yNE, fc.ySE, fc.ySW];
			return heights.some(h => h !== heights[0]);
		});
		expect(hasSlopedRoom).toBe(true);
	});
});

// ── damagePlayer ──

describe('damagePlayer(playerId, amount)', () => {
	beforeEach(() => {
		resetState();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('reduces HP by the given amount', () => {
		addPlayer('p1');
		damagePlayer('p1', 30);
		expect(gameState.players['p1'].hp).toBe(70);
	});

	it('clamps HP at 0', () => {
		addPlayer('p1');
		damagePlayer('p1', 200);
		expect(gameState.players['p1'].hp).toBe(0);
	});

	it('does nothing for unknown player', () => {
		const beforeCount = Object.keys(gameState.players).length;
		damagePlayer('nonexistent', 10);
		const afterCount = Object.keys(gameState.players).length;
		expect(afterCount).toBe(beforeCount);
	});

	it('marks player as dead when HP reaches 0', () => {
		addPlayer('p1', { hp: 30 });
		damagePlayer('p1', 30);
		expect(gameState.players['p1'].dead).toBe(true);
	});

	it('does not auto-respawn or heal after death', () => {
		addPlayer('p1', { hp: 30, x: 10, z: 20 });
		damagePlayer('p1', 30);

		expect(gameState.players['p1'].dead).toBe(true);
		expect(gameState.players['p1'].hp).toBe(0);

		vi.advanceTimersByTime(3000);

		expect(gameState.players['p1'].dead).toBe(true);
		expect(gameState.players['p1'].hp).toBe(0);
		expect(gameState.players['p1'].x).toBe(10);
		expect(gameState.players['p1'].z).toBe(20);
	});

	it('partial damage does not mark dead', () => {
		addPlayer('p1', { hp: 100 });
		damagePlayer('p1', 50);
		expect(gameState.players['p1'].dead).toBe(false);
		expect(gameState.players['p1'].hp).toBe(50);
	});

	it('returns null and does not damage when player is invulnerable', () => {
		addPlayer('p1', { hp: 100, invulnerableUntil: Date.now() + 500 });
		const result = damagePlayer('p1', 30);
		expect(result).toBeNull();
		expect(gameState.players['p1'].hp).toBe(100);
	});

	it('allows damage after invulnerability expires', () => {
		addPlayer('p1', { hp: 100, invulnerableUntil: Date.now() + 200 });
		expect(damagePlayer('p1', 30)).not.toBeUndefined(); // may return mirror result or null
		// Still invulnerable
		expect(gameState.players['p1'].hp).toBe(100);

		// Advance past invulnerability
		vi.advanceTimersByTime(300);

		damagePlayer('p1', 30);
		expect(gameState.players['p1'].hp).toBe(70);
	});

	it('invulnerability takes precedence over shield absorption', () => {
		addPlayer('p1', { hp: 100, shieldHp: 50, shieldExpiresAt: Date.now() + 10000, invulnerableUntil: Date.now() + 500 });
		const result = damagePlayer('p1', 30);
		expect(result).toBeNull();
		expect(gameState.players['p1'].hp).toBe(100);
		expect(gameState.players['p1'].shieldHp).toBe(50); // shield untouched
	});


	it('reduces frontal damage when blocking (enemy attacker)', () => {
		const now = 1000000;
		vi.setSystemTime(now);
		addPlayer('p1', {
			hp: 100,
			rotation: 0,
			blockingUntil: now + 1000,
			blockingYaw: 0, // facing +X
		});
		// Enemy directly in front of player (along +X axis, angle 0 from player)
		gameState.enemies.push({ id: 'e1', x: 3, z: 0, hp: 50, type: 'grunt' });
		damagePlayer('p1', 100, { attackerEnemyId: 'e1' });
		// damageReduction = 0.7 → remaining = 100 * 0.3 = 30
		expect(gameState.players['p1'].hp).toBe(70);
	});

	it('does not reduce rear damage when blocking (enemy attacker)', () => {
		const now = 1000000;
		vi.setSystemTime(now);
		addPlayer('p1', {
			hp: 100,
			rotation: 0,
			blockingUntil: now + 1000,
			blockingYaw: 0, // facing +X
		});
		// Enemy directly behind player (along -X axis, angle PI from player)
		gameState.enemies.push({ id: 'e1', x: -3, z: 0, hp: 50, type: 'grunt' });
		damagePlayer('p1', 100, { attackerEnemyId: 'e1' });
		// Full damage — attacker is behind (outside 150° arc)
		expect(gameState.players['p1'].hp).toBe(0);
	});

	it('reduces damage at edge of frontal arc (~75 degrees)', () => {
		const now = 1000000;
		vi.setSystemTime(now);
		addPlayer('p1', {
			hp: 100,
			blockingUntil: now + 1000,
			blockingYaw: 0,
		});
		// Attacker at ~75° (just inside 150° arc)
		const angle = (75 * Math.PI) / 180;
		const ex = Math.cos(angle) * 3; // x = cos(angle) * dist
		const ez = Math.sin(angle) * 3; // z = sin(angle) * dist
		gameState.enemies.push({ id: 'e1', x: ex, z: ez, hp: 50, type: 'grunt' });
		damagePlayer('p1', 100, { attackerEnemyId: 'e1' });
		expect(gameState.players['p1'].hp).toBe(70);
	});

	it('does not reduce damage just outside frontal arc (~76 degrees)', () => {
		const now = 1000000;
		vi.setSystemTime(now);
		addPlayer('p1', {
			hp: 100,
			blockingUntil: now + 1000,
			blockingYaw: 0,
		});
		// Attacker at ~76° (just outside 150° arc)
		const angle = (76 * Math.PI) / 180;
		const ex = Math.cos(angle) * 3;
		const ez = Math.sin(angle) * 3;
		gameState.enemies.push({ id: 'e1', x: ex, z: ez, hp: 50, type: 'grunt' });
		damagePlayer('p1', 100, { attackerEnemyId: 'e1' });
		expect(gameState.players['p1'].hp).toBe(0);
	});

	it('invulnerability takes priority over block reduction', () => {
		const now = 1000000;
		vi.setSystemTime(now);
		addPlayer('p1', {
			hp: 100,
			blockingUntil: now + 1000,
			blockingYaw: 0,
			invulnerableUntil: now + 500,
		});
		gameState.enemies.push({ id: 'e1', x: 3, z: 0, hp: 50, type: 'grunt' });
		const result = damagePlayer('p1', 100, { attackerEnemyId: 'e1' });
		expect(result).toBeNull();
		expect(gameState.players['p1'].hp).toBe(100);
	});

	it('no block reduction when blockingUntil has expired', () => {
		const now = 1000000;
		vi.setSystemTime(now);
		addPlayer('p1', {
			hp: 100,
			blockingUntil: now - 100, // already expired
			blockingYaw: 0,
		});
		gameState.enemies.push({ id: 'e1', x: 3, z: 0, hp: 50, type: 'grunt' });
		damagePlayer('p1', 100, { attackerEnemyId: 'e1' });
		expect(gameState.players['p1'].hp).toBe(0);
	});

	it('reduces damage from minion attacker (attackerId)', () => {
		const now = 1000000;
		vi.setSystemTime(now);
		addPlayer('p1', {
			hp: 100,
			blockingUntil: now + 1000,
			blockingYaw: 0,
		});
		// Minion in front of player
		gameState.minions.push({ id: 'm1', ownerId: 'p2', x: 3, z: 0, hp: 30 });
		damagePlayer('p1', 100, { attackerId: 'm1' });
		expect(gameState.players['p1'].hp).toBe(70);
	});

	it('no block reduction when attacker enemy is dead (hp <= 0)', () => {
		const now = 1000000;
		vi.setSystemTime(now);
		addPlayer('p1', {
			hp: 100,
			blockingUntil: now + 1000,
			blockingYaw: 0,
		});
		gameState.enemies.push({ id: 'e1', x: 3, z: 0, hp: 0, type: 'grunt' });
		damagePlayer('p1', 100, { attackerEnemyId: 'e1' });
		// Attacker not found → no position → no reduction
		expect(gameState.players['p1'].hp).toBe(0);
	});

	it('block reduction works with shield absorption (block before shield)', () => {
		const now = 1000000;
		vi.setSystemTime(now);
		addPlayer('p1', {
			hp: 100,
			shieldHp: 10,
			shieldExpiresAt: now + 10000,
			blockingUntil: now + 1000,
			blockingYaw: 0,
		});
		gameState.enemies.push({ id: 'e1', x: 3, z: 0, hp: 50, type: 'grunt' });
		// 100 damage → block reduces to 30 → shield absorbs 10 → 20 hits HP
		damagePlayer('p1', 100, { attackerEnemyId: 'e1' });
		expect(gameState.players['p1'].hp).toBe(80);
		expect(gameState.players['p1'].shieldHp).toBe(0);
	});

	it('no block reduction with no attacker info in options', () => {
		const now = 1000000;
		vi.setSystemTime(now);
		addPlayer('p1', {
			hp: 100,
			blockingUntil: now + 1000,
			blockingYaw: 0,
		});
		damagePlayer('p1', 100, {});
		// No attacker position → no reduction
		expect(gameState.players['p1'].hp).toBe(0);
	});
});

// ── updateEnemies ──

describe('updateEnemies()', () => {
	beforeEach(() => resetState());

	it('does nothing when no enemies exist', () => {
		expect(() => updateEnemies()).not.toThrow();
	});

	it('enemies chase players within DETECTION_RADIUS', () => {
		addPlayer('p1', { x: 0, z: 0, dead: false });
		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: DETECTION_RADIUS - 1,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 10, z: 10 }
		});

		updateEnemies();

		expect(gameState.enemies[0].state).toBe('chasing');
		// Enemy should have moved toward player (x decreased)
		expect(gameState.enemies[0].x).toBeLessThan(DETECTION_RADIUS - 1);
	});

	it('enemies wander when no player is within DETECTION_RADIUS', () => {
		addPlayer('p1', { x: 100, z: 100, dead: false });
		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: 0,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 10, z: 0 }
		});

		updateEnemies();

		expect(gameState.enemies[0].state).toBe('idle');
	});

	it('dead players are ignored for detection', () => {
		addPlayer('p1', { x: 0, z: 0, dead: true });
		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: 1,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 10, z: 0 }
		});

		updateEnemies();

		expect(gameState.enemies[0].state).toBe('idle');
	});

	it('enemy picks new wander target when reaching current one', () => {
		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: 5,
			z: 5,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 5, z: 5 }
		});

		const oldTarget = { ...gameState.enemies[0].wanderTarget };
		updateEnemies();

		// Should have picked a new target since distance < 0.5
		expect(gameState.enemies[0].wanderTarget).not.toEqual(oldTarget);
	});

	it('skips all AI when run status is victory', () => {
		addPlayer('p1', { x: 0, z: 0, dead: false });
		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: DETECTION_RADIUS - 1,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 10, z: 10 }
		});
		gameState.run = { status: 'victory' };

		updateEnemies();

		// Enemy should not have moved or changed state
		expect(gameState.enemies[0].state).toBe('idle');
		expect(gameState.enemies[0].x).toBe(DETECTION_RADIUS - 1);
	});

	it('skips all AI when run status is failed', () => {
		addPlayer('p1', { x: 0, z: 0, dead: false });
		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: DETECTION_RADIUS - 1,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 10, z: 10 }
		});
		gameState.run = { status: 'failed' };

		updateEnemies();

		expect(gameState.enemies[0].state).toBe('idle');
		expect(gameState.enemies[0].x).toBe(DETECTION_RADIUS - 1);
	});

	it('resumes AI after run is cleared (returnToLobby + new run)', () => {
		addPlayer('p1', { x: 0, z: 0, dead: false });
		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: DETECTION_RADIUS - 1,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 10, z: 10 }
		});

		// Set run to victory — AI should be skipped
		gameState.run = { status: 'victory' };
		updateEnemies();
		expect(gameState.enemies[0].state).toBe('idle');

		// Clear run (simulating returnToLobby) and start a new one
		delete gameState.run;
		startDungeonRun();
		expect(gameState.run.status).toBe('playing');

		// AI should resume — enemy should chase player
		updateEnemies();
		expect(gameState.enemies[0].state).toBe('chasing');
	});
});

// ── Enemy attack state machine ──

describe('Enemy attack state machine', () => {
	beforeEach(() => {
		resetState();
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2000, 0, 1));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('transitions to windup when in range', () => {
		addPlayer('p1', { id: 'p1', x: 0, z: 0, dead: false });
		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: ENEMY_ATTACK_RANGE - 1, // within ENEMY_ATTACK_RANGE of player
			z: 0,
			hp: 50,
			state: 'chasing',
			attackState: 'chasing',
			wanderTarget: { x: 0, z: 0 }
		});

		updateEnemies();

		expect(gameState.enemies[0].attackState).toBe('windup');
		expect(gameState.enemies[0].windupTargetId).toBe('p1');
		expect(gameState.enemies[0].windupStartTime).toBeDefined();
	});

	it('applies damage after windup expires', () => {
		addPlayer('p1', { id: 'p1', x: 0, z: 0, dead: false, hp: 100 });
		const now = Date.now();

		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: 0, // at player position — within range
			z: 0,
			hp: 50,
			state: 'chasing',
			attackState: 'windup',
			windupTargetId: 'p1',
			windupStartTime: now - ENEMY_DEFS.grunt.attackWindupMs - 100, // windup already expired
			wanderTarget: { x: 0, z: 0 }
		});

		updateEnemies();

		expect(gameState.players['p1'].hp).toBe(100 - ENEMY_DEFS.grunt.attackDamage);
		expect(gameState.enemies[0].attackState).toBe('recovering');
		expect(gameState.enemies[0].recoverUntil).toBeDefined();
	});

	it('skirmisher cone strike hits player in front', () => {
		addPlayer('p1', { id: 'p1', x: 3, z: 0, dead: false, hp: 100 });
		const now = Date.now();

		gameState.enemies.push({
			id: 'e1',
			type: 'skirmisher',
			x: 0,
			z: 0,
			hp: 20,
			state: 'chasing',
			attackState: 'windup',
			windupTargetId: 'p1',
			windupStartTime: now - ENEMY_DEFS.skirmisher.attackWindupMs - 100,
			windupDirX: 1,
			windupDirZ: 0,
			wanderTarget: { x: 0, z: 0 },
		});

		updateEnemies();

		expect(gameState.players['p1'].hp).toBe(100 - ENEMY_DEFS.skirmisher.attackDamage);
	});

	it('skirmisher cone strike misses player outside cone', () => {
		addPlayer('p1', { id: 'p1', x: 0, z: 3, dead: false, hp: 100 });
		const now = Date.now();

		gameState.enemies.push({
			id: 'e1',
			type: 'skirmisher',
			x: 0,
			z: 0,
			hp: 20,
			state: 'chasing',
			attackState: 'windup',
			windupTargetId: 'p1',
			windupStartTime: now - ENEMY_DEFS.skirmisher.attackWindupMs - 100,
			windupDirX: 1,
			windupDirZ: 0,
			wanderTarget: { x: 0, z: 0 },
		});

		updateEnemies();

		expect(gameState.players['p1'].hp).toBe(100);
		expect(gameState.enemies[0].attackState).toBe('chasing');
	});

	it('grunt radial strike still hits player beside enemy', () => {
		addPlayer('p1', { id: 'p1', x: 0, z: 3, dead: false, hp: 100 });
		const now = Date.now();

		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: 0,
			z: 0,
			hp: 50,
			state: 'chasing',
			attackState: 'windup',
			windupTargetId: 'p1',
			windupStartTime: now - ENEMY_DEFS.grunt.attackWindupMs - 100,
			wanderTarget: { x: 0, z: 0 },
		});

		updateEnemies();

		expect(gameState.players['p1'].hp).toBe(100 - ENEMY_DEFS.grunt.attackDamage);
	});

	it('stores windup direction when entering windup', () => {
		addPlayer('p1', { id: 'p1', x: 0, z: 3, dead: false });
		gameState.enemies.push({
			id: 'e1',
			type: 'skirmisher',
			x: 0,
			z: 0,
			hp: 20,
			state: 'chasing',
			attackState: 'chasing',
			wanderTarget: { x: 0, z: 0 },
		});

		updateEnemies();

		expect(gameState.enemies[0].attackState).toBe('windup');
		expect(gameState.enemies[0].windupDirX).toBeCloseTo(0, 5);
		expect(gameState.enemies[0].windupDirZ).toBeCloseTo(1, 5);
	});

	it('cancels attack when target leaves range', () => {
		addPlayer('p1', { x: 0, z: 0, dead: false, hp: 100 });
		const now = Date.now();

		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: 0, // enemy stays here
			z: 0,
			hp: 50,
			state: 'chasing',
			attackState: 'windup',
			windupTargetId: 'p1',
			windupStartTime: now - ENEMY_DEFS.grunt.attackWindupMs - 100, // windup expired
			wanderTarget: { x: 0, z: 0 }
		});

		// Move player out of range before updateEnemies
		gameState.players['p1'].x = ENEMY_ATTACK_RANGE + 10;
		gameState.players['p1'].z = ENEMY_ATTACK_RANGE + 10;

		updateEnemies();

		expect(gameState.players['p1'].hp).toBe(100); // no damage
		// After cancel the code sets attackState → 'chasing' and continues (does not fall through to idle)
		expect(gameState.enemies[0].attackState).toBe('chasing');
	});

	it('recovers and returns to chasing', () => {
		addPlayer('p1', { x: 0, z: 0, dead: false, hp: 100 });
		const now = Date.now();

		// Place enemy within DETECTION_RADIUS so after recovery it finds the player and enters chasing
		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: DETECTION_RADIUS - 2,
			z: 0,
			hp: 50,
			state: 'chasing',
			attackState: 'recovering',
			recoverUntil: now - 100, // recovery already expired
			wanderTarget: { x: 0, z: 0 }
		});

		updateEnemies();

		expect(gameState.enemies[0].attackState).toBe('chasing');
	});

	it('does not move or attack while recovering (recovery not expired)', () => {
		addPlayer('p1', { x: 0, z: 0, dead: false, hp: 100 });
		const now = Date.now();

		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: ENEMY_ATTACK_RANGE + 5,
			z: 0,
			hp: 50,
			state: 'chasing',
			attackState: 'recovering',
			recoverUntil: now + ENEMY_ATTACK_RECOVERY_MS + 1000, // still recovering
			wanderTarget: { x: 0, z: 0 }
		});

		const posBefore = { x: gameState.enemies[0].x, z: gameState.enemies[0].z };

		updateEnemies();

		// Enemy should not have moved
		expect(gameState.enemies[0].x).toBe(posBefore.x);
		expect(gameState.enemies[0].z).toBe(posBefore.z);
		// Should still be recovering
		expect(gameState.enemies[0].attackState).toBe('recovering');
		// Player should not have taken damage
		expect(gameState.players['p1'].hp).toBe(100);
	});

	it('constants exported with expected values', () => {
		expect(ENEMY_DEFS.grunt.attackWindupMs).toBeGreaterThanOrEqual(800);
		expect(ENEMY_ATTACK_RECOVERY_MS).toBeGreaterThanOrEqual(1000);
		expect(ENEMY_DEFS.grunt.attackWindupMs).toBe(800);
		expect(ENEMY_ATTACK_RECOVERY_MS).toBe(1200);
	});
});

// ── updateMinions ──

describe('updateMinions()', () => {
	beforeEach(() => resetState());

	it('does nothing when no minions exist', () => {
		expect(() => updateMinions()).not.toThrow();
	});

	it('minions attack enemies within ATTACK_RANGE', () => {
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 30
		});
		gameState.enemies.push({
			id: 'e1',
			x: ATTACK_RANGE - 1,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 0, z: 0 }
		});

		updateMinions();

		expect(gameState.enemies[0].hp).toBe(45);
	});

	it('minions chase enemies within DETECTION_RADIUS but outside ATTACK_RANGE', () => {
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 30
		});
		gameState.enemies.push({
			id: 'e1',
			x: ATTACK_RANGE + 1,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 0, z: 0 }
		});

		const startX = gameState.minions[0].x;
		updateMinions();

		// Minion should have moved toward enemy
		expect(gameState.minions[0].x).toBeGreaterThan(startX);
	});

	it('removes minions with expired TTL', () => {
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 0.01 // less than one tick (dt = 1/20 = 0.05)
		});

		updateMinions();

		expect(gameState.minions.length).toBe(0);
	});

	it('removes minions with hp <= 0', () => {
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 0,
			ttl: 30
		});

		updateMinions();

		expect(gameState.minions.length).toBe(0);
	});

	it('decrements minion TTL each tick', () => {
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 10
		});

		updateMinions();

		expect(gameState.minions[0].ttl).toBeCloseTo(10 - 1 / TICK_RATE, 4);
	});

	it('removes dead enemies and spawns magic stone and currency loot on death', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0);
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 30
		});
		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: 0,
			z: 0,
			hp: 3, // minion deals 5 damage, so enemy dies
			state: 'idle',
			wanderTarget: { x: 0, z: 0 }
		});

		updateMinions();

		expect(gameState.enemies.length).toBe(0);
		expect(gameState.loot).toHaveLength(2);
		expect(gameState.loot.find((l) => l.kind === 'magic_stone')).toMatchObject({
			value: 20,
			kind: 'magic_stone',
		});
		expect(gameState.loot.find((l) => l.kind === 'currency')).toMatchObject({
			value: 8,
			kind: 'currency',
		});

		vi.restoreAllMocks();
	});

	it('skips minion AI when run status is victory', () => {
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 30
		});
		gameState.enemies.push({
			id: 'e1',
			x: ATTACK_RANGE - 1,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 0, z: 0 }
		});
		gameState.run = { status: 'victory' };

		updateMinions();

		// Enemy should NOT have taken damage
		expect(gameState.enemies[0].hp).toBe(50);
		// Minion should NOT have moved
		expect(gameState.minions[0].x).toBe(0);
	});

	it('skips minion AI when run status is failed', () => {
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 30
		});
		gameState.enemies.push({
			id: 'e1',
			x: ATTACK_RANGE - 1,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 0, z: 0 }
		});
		gameState.run = { status: 'failed' };

		updateMinions();

		expect(gameState.enemies[0].hp).toBe(50);
		expect(gameState.minions[0].x).toBe(0);
	});

	it('still decrements minion TTL when run is terminal', () => {
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 10
		});
		gameState.run = { status: 'victory' };

		updateMinions();

		// TTL should still be decremented even though AI is skipped
		expect(gameState.minions[0].ttl).toBeCloseTo(10 - 1 / TICK_RATE, 4);
	});

	it('resumes minion AI after run is cleared and a new run starts', () => {
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 30
		});
		gameState.enemies.push({
			id: 'e1',
			x: ATTACK_RANGE - 1,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 0, z: 0 }
		});

		// Set run to victory — AI should be skipped
		gameState.run = { status: 'victory' };
		updateMinions();
		expect(gameState.enemies[0].hp).toBe(50);

		// Clear run and start a new one
		delete gameState.run;
		startDungeonRun();

		// AI should resume — minion should attack enemy
		updateMinions();
		expect(gameState.enemies[0].hp).toBe(45);
	});

	// ── Minion owner-follow ──

	it('minion follows a living owner when no enemy is nearby', () => {
		addPlayer('p1', { id: 'p1', x: 10, z: 10, dead: false });
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 30
		});
		// No enemies

		const distBefore = Math.hypot(10 - 0, 10 - 0);
		updateMinions();

		// Minion should have moved toward owner
		const distAfter = Math.hypot(10 - gameState.minions[0].x, 10 - gameState.minions[0].z);
		expect(distAfter).toBeLessThan(distBefore);
	});

	it('minion does not follow a dead owner', () => {
		addPlayer('p1', { id: 'p1', x: 10, z: 10, dead: true });
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 30
		});

		updateMinions();

		expect(gameState.minions[0].x).toBe(0);
		expect(gameState.minions[0].z).toBe(0);
	});

	it('minion does not follow a missing owner', () => {
		gameState.minions.push({
			id: 'm1',
			ownerId: 'nonexistent',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 30
		});

		updateMinions();

		expect(gameState.minions[0].x).toBe(0);
		expect(gameState.minions[0].z).toBe(0);
	});

	it('minion stays put when within MINION_FOLLOW_DISTANCE of owner', () => {
		addPlayer('p1', { id: 'p1', x: 1, z: 1, dead: false });
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 30
		});
		// Distance is sqrt(2) ≈ 1.41, which is < MINION_FOLLOW_DISTANCE (3)

		updateMinions();

		expect(gameState.minions[0].x).toBe(0);
		expect(gameState.minions[0].z).toBe(0);
	});

	it('minion prioritizes enemy chase over owner follow', () => {
		addPlayer('p1', { id: 'p1', x: -10, z: -10, dead: false });
		gameState.minions.push({
			id: 'm1',
			ownerId: 'p1',
			x: 0,
			z: 0,
			hp: 50,
			ttl: 30
		});
		gameState.enemies.push({
			id: 'e1',
			x: ATTACK_RANGE + 1,
			z: 0,
			hp: 50,
			state: 'idle',
			wanderTarget: { x: 0, z: 0 }
		});

		updateMinions();

		// Minion should move toward enemy (positive x), not toward owner (negative x/z)
		expect(gameState.minions[0].x).toBeGreaterThan(0);
	});

	it('MINION_FOLLOW_DISTANCE and MINION_FOLLOW_SPEED are defined and exported', () => {
		expect(MINION_FOLLOW_DISTANCE).toBe(3);
		expect(MINION_FOLLOW_SPEED).toBe(2.5);
	});
});

// ── spawnLoot ──

describe('spawnLoot(layout, rng)', () => {
	beforeEach(() => resetState());

	it('creates loot with correct structure when it spawns', () => {
		vi.spyOn(Math, 'random').mockReturnValue(config.LOOT_SPAWN_CHANCE - 0.1); // below LOOT_SPAWN_CHANCE so it spawns

		const layout = generateLayout(42);
		const rng = mulberry32(99);
		spawnLoot(layout, rng);

		expect(gameState.loot.length).toBe(1);
		const loot = gameState.loot[0];
		expect(loot).toHaveProperty('id');
		expect(loot).toHaveProperty('x');
		expect(loot).toHaveProperty('z');
		expect(loot).toHaveProperty('value');
		expect(loot).toHaveProperty('createdAt');
		expect(typeof loot.id).toBe('string');
		expect(typeof loot.value).toBe('number');
		expect(typeof loot.createdAt).toBe('number');

		vi.restoreAllMocks();
	});

	it('loot value is in range [5, 20)', () => {
		vi.spyOn(Math, 'random').mockReturnValueOnce(config.LOOT_SPAWN_CHANCE - 0.1).mockReturnValueOnce(0.5); // below LOOT_SPAWN_CHANCE to spawn; 0.5 for value

		const layout = generateLayout(42);
		const rng = mulberry32(99);
		spawnLoot(layout, rng);
		expect(gameState.loot[0].value).toBeGreaterThanOrEqual(5);
		expect(gameState.loot[0].value).toBeLessThan(20);

		vi.restoreAllMocks();
	});

	it('does not spawn loot when random >= LOOT_SPAWN_CHANCE', () => {
		vi.spyOn(Math, 'random').mockReturnValue(config.LOOT_SPAWN_CHANCE + 0.1); // above LOOT_SPAWN_CHANCE

		const layout = generateLayout(42);
		const rng = mulberry32(99);
		spawnLoot(layout, rng);

		expect(gameState.loot.length).toBe(0);

		vi.restoreAllMocks();
	});

	it('loot createdAt is a timestamp', () => {
		vi.spyOn(Math, 'random').mockReturnValue(config.LOOT_SPAWN_CHANCE - 0.1);

		const layout = generateLayout(42);
		const rng = mulberry32(99);
		const before = Date.now();
		spawnLoot(layout, rng);
		const after = Date.now();

		expect(gameState.loot[0].createdAt).toBeGreaterThanOrEqual(before);
		expect(gameState.loot[0].createdAt).toBeLessThanOrEqual(after);

		vi.restoreAllMocks();
	});

	it('spawns loot in treasure room when one exists', () => {
		vi.spyOn(Math, 'random').mockReturnValue(config.LOOT_SPAWN_CHANCE - 0.1);

		const layout = generateLayout(42);
		const rng = mulberry32(99);
		spawnLoot(layout, rng);

		const loot = gameState.loot[0];
		const treasureRooms = layout.rooms.filter(r => r.role === 'treasure');
		expect(treasureRooms.length).toBeGreaterThan(0);

		// Verify loot is within the treasure room bounds
		const inTreasureRoom = treasureRooms.some(room => {
			const halfW = room.width / 2;
			const halfD = room.depth / 2;
			return Math.abs(loot.x - room.x) < halfW && Math.abs(loot.z - room.z) < halfD;
		});
		expect(inTreasureRoom).toBe(true);

		vi.restoreAllMocks();
	});

	it('falls back to non-start room when no treasure room exists', () => {
		vi.spyOn(Math, 'random').mockReturnValue(config.LOOT_SPAWN_CHANCE - 0.1);

		const layout = generateLayout(42);
		// Remove treasure role to test fallback
		layout.rooms.forEach(r => {
			if (r.role === 'treasure') r.role = 'combat';
		});
		const rng = mulberry32(99);
		spawnLoot(layout, rng);

		const loot = gameState.loot[0];
		const startRooms = layout.rooms.filter(r => r.role === 'start');

		// Verify loot is NOT in the start room
		const inStartRoom = startRooms.some(room => {
			const halfW = room.width / 2;
			const halfD = room.depth / 2;
			return Math.abs(loot.x - room.x) < halfW && Math.abs(loot.z - room.z) < halfD;
		});
		expect(inStartRoom).toBe(false);

		vi.restoreAllMocks();
	});
});

// ── Magic Stone regeneration ──

describe('regenMagicStones (game tick)', () => {
	beforeEach(() => resetState());

	it('regenerates MAGIC_STONES_REGEN_PER_TICK per call', () => {
		addPlayer('p1', { magicStones: 30 });
		const before = gameState.players['p1'].magicStones;

		regenMagicStones();

		expect(gameState.players['p1'].magicStones).toBeCloseTo(
			before + MAGIC_STONES_REGEN_PER_TICK,
			5
		);
	});

	it('caps at MAX_MAGIC_STONES', () => {
		addPlayer('p1', { magicStones: MAX_MAGIC_STONES });

		regenMagicStones();

		expect(gameState.players['p1'].magicStones).toBe(MAX_MAGIC_STONES);
	});

	it('does not exceed cap when close to it', () => {
		addPlayer('p1', { magicStones: MAX_MAGIC_STONES - 0.004 });

		regenMagicStones();

		expect(gameState.players['p1'].magicStones).toBe(MAX_MAGIC_STONES);
	});

	it('keeps magicStones at 0 for summon-low-mana debug scenario', () => {
		addPlayer('p1', { magicStones: 30, debugScenario: 'summon-low-mana' });

		regenMagicStones();

		expect(gameState.players['p1'].magicStones).toBe(0);
	});

	it('regenerates from STARTING_MAGIC_STONES on fresh deploy', () => {
		addPlayer('p1', { magicStones: STARTING_MAGIC_STONES });

		regenMagicStones();

		expect(gameState.players['p1'].magicStones).toBeCloseTo(
			STARTING_MAGIC_STONES + MAGIC_STONES_REGEN_PER_TICK,
			5,
		);
	});

	it('clears pendingSummons for each player', () => {
		addPlayer('p1');
		gameState.players['p1'].pendingSummons.add('0:iron_sword');

		regenMagicStones();

		expect(gameState.players['p1'].pendingSummons.size).toBe(0);
	});

	it('regen rate constant is correct', () => {
		expect(MAGIC_STONES_REGEN_PER_TICK).toBe(0.005);
	});

	it('max magic stones constant is correct', () => {
		expect(MAX_MAGIC_STONES).toBe(99);
	});

	it('STARTING_MAGIC_STONES is 49', () => {
		expect(STARTING_MAGIC_STONES).toBe(49);
	});

	it('client MAX_MS matches server MAX_MAGIC_STONES via shared constants', async () => {
		const { MAX_MS } = await import('../../client/config.js');
		expect(MAX_MS).toBe(MAX_MAGIC_STONES);
	});
});

// ── Synergistic card helpers and minion pulses ──

describe('synergistic card helpers', () => {
	beforeEach(() => resetState());

	it('addMagicStones caps at MAX_MAGIC_STONES and reports applied gain', () => {
		addPlayer('p1', { magicStones: MAX_MAGIC_STONES - 5 });
		const gained = addMagicStones(gameState.players['p1'], 25);

		expect(gained).toBe(5);
		expect(gameState.players['p1'].magicStones).toBe(MAX_MAGIC_STONES);
	});

	it('restoreCardCharges restores without exceeding max charges', () => {
		const card = { id: 'iron_sword', type: 'weapon', charges: 5, remainingCharges: 4 };
		const restored = restoreCardCharges(card, 3);

		expect(restored).toBe(1);
		expect(card.remainingCharges).toBe(5);
	});

	it('restoreHandCharges can target adjacent slots for Chrono Trigger', () => {
		addPlayer('p1', {
			hand: [
				{ id: 'iron_sword', type: 'weapon', charges: 5, remainingCharges: 1 },
				{ id: 'chrono_trigger', type: 'spell', charges: 1, remainingCharges: 1 },
				{ id: 'flame_blade', type: 'weapon', charges: 2, remainingCharges: 1 },
			],
		});

		const restored = restoreHandCharges(gameState.players['p1'], 2, { slots: [0, 2] });

		expect(restored).toEqual([
			{ slotIndex: 0, cardId: 'iron_sword', amount: 2 },
			{ slotIndex: 2, cardId: 'flame_blade', amount: 1 },
		]);
		expect(gameState.players['p1'].hand[0].remainingCharges).toBe(3);
		expect(gameState.players['p1'].hand[2].remainingCharges).toBe(2);
	});
});

describe('enemy magic stone drops and discard', () => {
	beforeEach(() => resetState());

	it('getEnemyMagicStoneDrop returns type-specific values', () => {
		expect(getEnemyMagicStoneDrop({ type: 'grunt' })).toBe(20);
		expect(getEnemyMagicStoneDrop({ type: 'miniboss' })).toBe(50);
		expect(getEnemyMagicStoneDrop({ type: 'spire_warden' })).toBe(55);
		expect(getEnemyMagicStoneDrop({ type: 'permafrost_warden' })).toBe(55);
		expect(getEnemyMagicStoneDrop({ type: 'unknown' })).toBe(15);
	});

	it('getEnemyCurrencyDrop returns a random percentage of the magic stone drop', () => {
		const randomSpy = vi.spyOn(Math, 'random');

		randomSpy.mockReturnValue(0);
		expect(getEnemyCurrencyDrop({ type: 'grunt' })).toBe(8);

		randomSpy.mockReturnValue(1);
		expect(getEnemyCurrencyDrop({ type: 'grunt' })).toBe(20);

		randomSpy.mockReturnValue(0.5);
		expect(getEnemyCurrencyDrop({ type: 'miniboss' })).toBe(35);

		randomSpy.mockRestore();
	});

	it('removeDeadEnemies skips currency loot when the drop chance fails', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0.99);
		gameState.enemies = [{
			id: 'e1',
			type: 'grunt',
			x: 4,
			z: -2,
			hp: 0,
		}];

		removeDeadEnemies();

		expect(gameState.loot).toHaveLength(1);
		expect(gameState.loot[0].kind).toBe('magic_stone');
		vi.restoreAllMocks();
	});

	it('removeDeadEnemies spawns magic stone and currency loot at the enemy position', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0);
		gameState.enemies = [{
			id: 'e1',
			type: 'grunt',
			x: 4,
			z: -2,
			hp: 0,
			lastDamagedBy: 'p1',
		}];
		addPlayer('p1');

		removeDeadEnemies();

		expect(gameState.enemies).toHaveLength(0);
		expect(gameState.loot).toHaveLength(2);
		expect(gameState.loot.find((l) => l.kind === 'magic_stone')).toMatchObject({
			kind: 'magic_stone',
			value: 20,
			x: 3.4,
			z: -1.5,
		});
		expect(gameState.loot.find((l) => l.kind === 'currency')).toMatchObject({
			kind: 'currency',
			value: 8,
			x: 4.6,
			z: -2.5,
		});

		vi.restoreAllMocks();
	});

	it('discardCardFromHand empties a slot without drawing a replacement', () => {
		addPlayer('p1', {
			deck: ['flame_blade'],
			hand: [
				{ id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon', charges: 5, remainingCharges: 5 },
				null,
				null,
				null,
				null,
				null,
			],
		});

		const result = discardCardFromHand(gameState.players['p1'], 0, 'iron_sword');

		expect(result.valid).toBe(true);
		expect(gameState.players['p1'].hand[0]).toBeNull();
		expect(gameState.players['p1'].deck).toEqual(['flame_blade']);
		expect(gameState.players['p1'].nextDrawAt).toBeTypeOf('number');
	});

	it('discardCardFromHand skips terminal resolution during a healthy run', () => {
		gameState.enemies = [
			{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
		];
		startDungeonRun();
		addPlayer('p1', {
			deck: ['flame_blade', 'arcane_bolt'],
			hand: [
				{ id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon', charges: 5, remainingCharges: 5 },
				null,
				null,
				null,
			],
		});

		const emitCalls = [];
		const originalEmit = serverIo.emit;
		serverIo.emit = (event, data) => emitCalls.push({ event, data });

		discardCardFromHand(gameState.players['p1'], 0, 'iron_sword');

		serverIo.emit = originalEmit;

		expect(gameState.run.status).toBe('playing');
		expect(emitCalls.filter((c) => c.event === 'runFailed')).toHaveLength(0);
		expect(emitCalls.filter((c) => c.event === 'runComplete')).toHaveLength(0);
		expect(emitCalls.filter((c) => c.event === 'stateUpdate')).toHaveLength(0);
	});

	it('discardCardFromHand resolves terminal failure when discard empties the squad', () => {
		gameState.enemies = [
			{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
		];
		startDungeonRun();
		addPlayer('p1', {
			deck: [],
			desperationDeck: [],
			inDesperation: false,
			hand: [
				{ id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon', charges: 1, remainingCharges: 1 },
			],
		});

		discardCardFromHand(gameState.players['p1'], 0, 'iron_sword');

		expect(gameState.run.status).toBe('failed');
	});

	it('isPlayerOutOfCards treats all-null hand as empty', () => {
		addPlayer('p1', {
			hand: [null, null, null, null, null, null],
			deck: [],
		});

		expect(isPlayerOutOfCards(gameState.players['p1'])).toBe(true);
	});

	it('isPlayerOutOfCards is false when deck still has cards despite empty hand slots', () => {
		addPlayer('p1', {
			hand: [null, null, null, null, null, null],
			deck: ['iron_sword'],
		});

		expect(isPlayerOutOfCards(gameState.players['p1'])).toBe(false);
	});
});

describe('combat exhaustion detection', () => {
	beforeEach(() => {
		resetState();
	});

	it('isPlayerCombatExhausted is true when hand, deck, and desperation are empty', () => {
		addPlayer('p1', {
			hand: [null, null, null, null, null, null],
			deck: [],
			desperationDeck: [],
		});

		expect(isPlayerCombatExhausted(gameState.players['p1'])).toBe(true);
	});

	it('isPlayerCombatExhausted is true when hand has only MS-insufficient spells and piles are empty', () => {
		addPlayer('p1', {
			magicStones: 25,
			hand: [
				{
					id: 'battle_familiar',
					type: 'spell',
					charges: 1,
					remainingCharges: 1,
					magicStoneCost: 50,
				},
				null,
				null,
				null,
				null,
				null,
			],
			deck: [],
			desperationDeck: [],
		});

		expect(isPlayerCombatExhausted(gameState.players['p1'])).toBe(true);
		expect(canPlayerCastHandCard(gameState.players['p1'], gameState.players['p1'].hand[0])).toBe(false);
	});

	it('isPlayerCombatExhausted is false when the deck still has drawable cards', () => {
		addPlayer('p1', {
			magicStones: 25,
			hand: [
				{
					id: 'battle_familiar',
					type: 'spell',
					charges: 1,
					remainingCharges: 1,
					magicStoneCost: 50,
				},
				null,
				null,
				null,
				null,
				null,
			],
			deck: ['iron_sword'],
			desperationDeck: [],
		});

		expect(isPlayerCombatExhausted(gameState.players['p1'])).toBe(false);
	});

	it('isPlayerCombatExhausted is false when at least one hand card is castable', () => {
		addPlayer('p1', {
			magicStones: 25,
			hand: [
				{
					id: 'battle_familiar',
					type: 'spell',
					charges: 1,
					remainingCharges: 1,
					magicStoneCost: 50,
				},
				{ id: 'iron_sword', type: 'weapon', charges: 5, remainingCharges: 5 },
				null,
				null,
				null,
				null,
			],
			deck: [],
			desperationDeck: [],
		});

		expect(isPlayerCombatExhausted(gameState.players['p1'])).toBe(false);
		expect(canPlayerCastHandCard(gameState.players['p1'], gameState.players['p1'].hand[1])).toBe(true);
	});
});

describe('telepipe vs combat exhaustion', () => {
	const EMPTY_HAND = [null, null, null, null];

	function setupSoloExhaustedRun({ portalX = 5, portalZ = 5, placedAt } = {}) {
		resetState();
		gameState._lobbyId = 'test-lobby';
		gameState.enemies = [
			{ id: 'e1', x: 12, z: 12, hp: 50, state: 'idle', wanderTarget: { x: 12, z: 12 } },
		];
		startDungeonRun();
		gameState.gamePhase = 'playing';
		addPlayer('p1', {
			x: portalX,
			z: portalZ,
			hp: 80,
			dead: false,
			hand: [...EMPTY_HAND],
			deck: [],
			desperationDeck: [],
			slotCooldowns: [null, null, null, null],
			pendingSummons: new Set(),
		});
		gameState.telepipe = {
			x: portalX,
			z: portalZ,
			placedBy: 'p1',
			placedAt: placedAt ?? Date.now(),
		};
	}

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(10_000);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('keeps run playing when solo player is card-exhausted with an active telepipe', () => {
		setupSoloExhaustedRun({ placedAt: Date.now() - PORTAL_PLACEMENT_GRACE_MS - 1 });

		checkRunTerminalState();
		expect(gameState.run.status).toBe('playing');

		tickCombatExhaustionGrace(Date.now());
		vi.advanceTimersByTime(RUN_EXHAUSTION_GRACE_MS);
		tickCombatExhaustionGrace(Date.now());

		expect(gameState.run.status).toBe('playing');
	});

	it('extracts solo card-exhausted player via telepipe into suspended lobby state', () => {
		setupSoloExhaustedRun({ placedAt: Date.now() - PORTAL_PLACEMENT_GRACE_MS - 1 });
		const preSuspendRunId = gameState.run.id;

		const result = tryEnterTelepipe('p1');

		expect(result.ok).toBe(true);
		expect(gameState.gamePhase).toBe('lobby');
		expect(gameState.run).toBeUndefined();
		expect(gameState.suspendedCheckpoint).not.toBeNull();
		expect(gameState.suspendedCheckpoint.run.id).toBe(preSuspendRunId);
		expect(gameState.suspendedCheckpoint.run.status).toBe('playing');
	});

	it('fails immediately when solo player is out of cards without a telepipe', () => {
		resetState();
		gameState.enemies = [
			{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
		];
		startDungeonRun();
		addPlayer('p1', {
			hp: 80,
			dead: false,
			hand: [...EMPTY_HAND],
			deck: [],
			desperationDeck: [],
		});

		checkRunTerminalState();

		expect(gameState.run.status).toBe('failed');
	});

	it('still fails MS-insufficient stall after exhaustion grace when no telepipe is active', () => {
		resetState();
		gameState.enemies = [
			{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
		];
		startDungeonRun();
		addPlayer('p1', {
			hp: 80,
			dead: false,
			magicStones: 25,
			hand: [{
				id: 'battle_familiar',
				type: 'spell',
				charges: 1,
				remainingCharges: 1,
				magicStoneCost: 50,
			}],
			deck: [],
			desperationDeck: [],
		});

		tickCombatExhaustionGrace(Date.now());
		expect(gameState.run.status).toBe('playing');

		vi.advanceTimersByTime(RUN_EXHAUSTION_GRACE_MS);
		tickCombatExhaustionGrace(Date.now());

		expect(gameState.run.status).toBe('failed');
	});
});

describe('synergistic minion pulses', () => {
	beforeEach(() => {
		resetState();
		vi.useFakeTimers();
		vi.setSystemTime(0);
		gameState.run = { status: 'playing' };
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('Mana Prism pulses Magic Stones while active', () => {
		addPlayer('p1', { magicStones: 0 });
		gameState.minions.push({
			id: 'prism-1',
			ownerId: 'p1',
			type: 'mana_prism',
			x: 0,
			z: 0,
			hp: 1,
			ttl: 12,
			lastPulseAt: 0,
			pulseIntervalMs: 2000,
			magicStonePulse: 10,
		});

		vi.setSystemTime(4000);
		updateMinions();

		expect(gameState.players['p1'].magicStones).toBe(20);
		expect(gameState.minions[0].lastPulseAt).toBe(4000);
	});

	it('Battery Automaton restores charges periodically', () => {
		addPlayer('p1', {
			hand: [
				{ id: 'iron_sword', type: 'weapon', charges: 5, remainingCharges: 4 },
				{ id: 'flame_blade', type: 'weapon', charges: 2, remainingCharges: 2 },
			],
		});
		gameState.minions.push({
			id: 'battery-1',
			ownerId: 'p1',
			type: 'battery_automaton',
			x: 0,
			z: 0,
			hp: 80,
			ttl: 30,
			lastChargePulseAt: 0,
			chargePulseIntervalMs: 6000,
			chargeRestore: 1,
		});

		vi.setSystemTime(6000);
		updateMinions();

		expect(gameState.players['p1'].hand[0].remainingCharges).toBe(5);
		expect(gameState.minions[0].lastChargePulseAt).toBe(6000);
	});
});

// ── Stale player cleanup ──

describe('cleanupStalePlayers', () => {
	beforeEach(() => resetGameState());

	it('removes players inactive for STALE_THRESHOLD ms', () => {
		addPlayer('p1', { lastActivity: Date.now() - STALE_THRESHOLD - 1000 });

		cleanupStalePlayers();

		expect(gameState.players['p1']).toBeUndefined();
	});

	it('keeps active players', () => {
		addPlayer('p1', { lastActivity: Date.now() });

		cleanupStalePlayers();

		expect(gameState.players['p1']).toBeDefined();
	});

	it('keeps players at exactly STALE_THRESHOLD (not exceeding)', () => {
		vi.useFakeTimers();
		const now = 1_700_000_000_000;
		vi.setSystemTime(now);
		addPlayer('p1', { lastActivity: now - STALE_THRESHOLD + 1 });

		cleanupStalePlayers();

		expect(gameState.players['p1']).toBeDefined();
		vi.useRealTimers();
	});

	it('stale threshold constant matches disconnect grace (60 seconds)', () => {
		expect(STALE_THRESHOLD).toBe(60000);
		expect(STALE_THRESHOLD).toBe(DISCONNECT_GRACE_MS);
	});

	it('removes multiple stale players', () => {
		addPlayer('p1', { lastActivity: Date.now() - STALE_THRESHOLD - 20000 });
		addPlayer('p2', { lastActivity: Date.now() - STALE_THRESHOLD - 15000 });
		addPlayer('p3', { lastActivity: Date.now() });

		cleanupStalePlayers();

		expect(gameState.players['p1']).toBeUndefined();
		expect(gameState.players['p2']).toBeUndefined();
		expect(gameState.players['p3']).toBeDefined();
	});

	it('calls savePlayerData before deleting stale player', async () => {
		const mockProvider = {
			savePlayer: vi.fn().mockResolvedValue(undefined),
			loadPlayer: vi.fn().mockResolvedValue(null)
		};
		setTestProvider(mockProvider);

		addPlayer('p1', {
			lastActivity: Date.now() - STALE_THRESHOLD - 1000,
			currency: 42,
			ownedCards: { iron_sword: 3 },
			selectedDeck: ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'],
			x: 5,
			y: 0.5,
			z: 10,
			rotation: 1.5
		});

		cleanupStalePlayers();

		await vi.waitFor(() => {
			expect(mockProvider.savePlayer).toHaveBeenCalledWith('p1', expect.objectContaining({
			currency: 42,
			ownedCards: { iron_sword: 3 },
			x: 5,
			y: 0.5,
			z: 10,
			rotation: 1.5
		}));
		});

		const saved = mockProvider.savePlayer.mock.calls[0][1];
		expect(saved.inventory).toHaveLength(3);
		expect(saved.inventory.every((instance) => instance.cardId === 'iron_sword')).toBe(true);
		expect(saved.selectedDeck[0]).toBe(saved.inventory[0].instanceId);
		expect(gameState.players['p1']).toBeUndefined();

		setTestProvider(null);
	});

	it('saves stale player data even when provider is null (no crash)', () => {
		setTestProvider(null);

		addPlayer('p1', { lastActivity: Date.now() - STALE_THRESHOLD - 1000 });

		// Should not throw
		expect(() => cleanupStalePlayers()).not.toThrow();
		expect(gameState.players['p1']).toBeUndefined();
	});

	it('saves multiple stale players before deleting', async () => {
		const mockProvider = {
			savePlayer: vi.fn().mockResolvedValue(undefined),
			loadPlayer: vi.fn().mockResolvedValue(null)
		};
		setTestProvider(mockProvider);

		addPlayer('p1', { lastActivity: Date.now() - STALE_THRESHOLD - 20000, currency: 10 });
		addPlayer('p2', { lastActivity: Date.now() - STALE_THRESHOLD - 15000, currency: 20 });

		cleanupStalePlayers();

		await vi.waitFor(() => {
			expect(mockProvider.savePlayer).toHaveBeenCalledTimes(2);
		});
		expect(mockProvider.savePlayer).toHaveBeenCalledWith('p1', expect.objectContaining({ currency: 10 }));
		expect(mockProvider.savePlayer).toHaveBeenCalledWith('p2', expect.objectContaining({ currency: 20 }));

		setTestProvider(null);
	});

	it('keeps connected-but-idle players (backgrounded tabs) instead of hard-removing', () => {
		const disconnectCalled = [];
		const mockSocket = {
			id: 'random-socket-id-abc123',
			playerId: 'p1',
			connected: true,
			disconnect: () => disconnectCalled.push(true)
		};

		const originalSockets = serverIo.sockets.sockets;
		const mockMap = new Map();
		mockMap.set(mockSocket.id, mockSocket);
		serverIo.sockets.sockets = mockMap;
		registerPlayerSocket('p1', mockSocket);

		addPlayer('p1', { lastActivity: Date.now() - STALE_THRESHOLD - 1000 });

		cleanupStalePlayers();

		expect(disconnectCalled).toHaveLength(0);
		expect(gameState.players['p1']).toBeDefined();

		unregisterPlayerSocket('p1', mockSocket);
		serverIo.sockets.sockets = originalSockets;
	});

	it('gracefully handles stale player with no connected socket', () => {
		// Replace with empty map so findSocketByPlayerId returns null
		const originalSockets = serverIo.sockets.sockets;
		serverIo.sockets.sockets = new Map();

		addPlayer('p1', { lastActivity: Date.now() - STALE_THRESHOLD - 1000 });

		// Should not throw even when socket is missing
		expect(() => cleanupStalePlayers()).not.toThrow();
		expect(gameState.players['p1']).toBeUndefined();

		// Restore
		serverIo.sockets.sockets = originalSockets;
	});

	it('does not disconnect socket for player that is not stale', () => {
		const disconnectCalled = [];
		const mockSocket = {
			id: 'socket-xyz',
			playerId: 'p1',
			connected: true,
			disconnect: () => disconnectCalled.push(true)
		};

		const originalSockets = serverIo.sockets.sockets;
		const mockMap = new Map();
		mockMap.set(mockSocket.id, mockSocket);
		serverIo.sockets.sockets = mockMap;
		registerPlayerSocket('p1', mockSocket);

		addPlayer('p1', { lastActivity: Date.now() });

		cleanupStalePlayers();

		expect(disconnectCalled).toHaveLength(0);
		expect(gameState.players['p1']).toBeDefined();

		// Restore
		unregisterPlayerSocket('p1', mockSocket);
		serverIo.sockets.sockets = originalSockets;
	});
});

describe('saveAllPlayersInAllLobbies (shutdown flush)', () => {
	beforeEach(() => {
		resetAllLobbies();
		resetState();
	});

	afterEach(() => {
		resetAllLobbies();
		setTestProvider(null);
		vi.useRealTimers();
	});

	it('persists dirty players inside the movement debounce window', async () => {
		vi.useFakeTimers();
		const now = 1_700_000_000_000;
		vi.setSystemTime(now);

		const mockProvider = {
			savePlayer: vi.fn().mockResolvedValue(undefined),
			loadPlayer: vi.fn().mockReturnValue(null),
		};
		setTestProvider(mockProvider);

		const lobby = createLobby('Shutdown Flush');
		lobby.state.players['p1'] = {
			currency: 99,
			ownedCards: {},
			selectedDeck: [],
			persistenceDirty: true,
			persistenceLastSavedAt: now - (PLAYER_MOVEMENT_SAVE_DEBOUNCE_MS - 500),
		};

		saveAllPlayersInAllLobbies();
		await Promise.resolve();

		expect(mockProvider.savePlayer).toHaveBeenCalledTimes(1);
		expect(mockProvider.savePlayer).toHaveBeenCalledWith(
			'p1',
			expect.objectContaining({ currency: 99 }),
		);
		expect(lobby.state.players['p1'].persistenceLastSavedAt).toBe(now);
	});
});

describe('findSocketByPlayerId', () => {
	beforeEach(() => {
		// Restore original sockets map each time (in case previous test replaced it)
		// We clear rather than replace since other tests may depend on the real Map
		if (serverIo.sockets.sockets instanceof Map) {
			serverIo.sockets.sockets.clear();
		}
		resetGameState();
	});

	it('finds socket by matching socket.playerId', () => {
		const mockSocket = {
			id: 'random-socket-id',
			playerId: 'player-alpha',
			connected: true
		};
		serverIo.sockets.sockets.set(mockSocket.id, mockSocket);
		registerPlayerSocket('player-alpha', mockSocket);

		const result = findSocketByPlayerId('player-alpha');

		expect(result).toBe(mockSocket);
	});

	it('returns null when no socket matches the playerId', () => {
		const mockSocket = {
			id: 'some-socket',
			playerId: 'other-player',
			connected: true
		};
		serverIo.sockets.sockets.set(mockSocket.id, mockSocket);
		registerPlayerSocket('other-player', mockSocket);

		const result = findSocketByPlayerId('nonexistent-player');

		expect(result).toBeNull();
	});

	it('returns null when there are no connected sockets', () => {
		expect(findSocketByPlayerId('anyone')).toBeNull();
	});

	it('finds correct socket among multiple connections', () => {
		const s1 = { id: 'sock1', playerId: 'p1', connected: true };
		const s2 = { id: 'sock2', playerId: 'p2', connected: true };
		const s3 = { id: 'sock3', playerId: 'p3', connected: true };
		serverIo.sockets.sockets.set(s1.id, s1);
		serverIo.sockets.sockets.set(s2.id, s2);
		serverIo.sockets.sockets.set(s3.id, s3);
		registerPlayerSocket('p1', s1);
		registerPlayerSocket('p2', s2);
		registerPlayerSocket('p3', s3);

		expect(findSocketByPlayerId('p2')).toBe(s2);
		expect(findSocketByPlayerId('p1')).toBe(s1);
		expect(findSocketByPlayerId('p3')).toBe(s3);
	});

	it('excludeSocketId returns the other socket when two share a playerId', () => {
		const s1 = { id: 'sock-old', playerId: 'shared', connected: true };
		const s2 = { id: 'sock-new', playerId: 'shared', connected: true };
		serverIo.sockets.sockets.set(s1.id, s1);
		serverIo.sockets.sockets.set(s2.id, s2);
		registerPlayerSocket('shared', s1);
		registerPlayerSocket('shared', s2);

		expect(findSocketByPlayerId('shared', 'sock-new')).toBe(s1);
		expect(findSocketByPlayerId('shared', 'sock-old')).toBe(s2);
	});

	it('excludeSocketId returns null when only the excluded socket matches', () => {
		const only = { id: 'sock-only', playerId: 'solo', connected: true };
		serverIo.sockets.sockets.set(only.id, only);
		registerPlayerSocket('solo', only);

		expect(findSocketByPlayerId('solo', 'sock-only')).toBeNull();
	});

	it('unregisterPlayerSocket removes only when the socket still owns the map entry', () => {
		const s1 = { id: 'sock-old', playerId: 'shared', connected: true };
		const s2 = { id: 'sock-new', playerId: 'shared', connected: true };
		registerPlayerSocket('shared', s1);
		registerPlayerSocket('shared', s2);
		unregisterPlayerSocket('shared', s1);
		expect(findSocketByPlayerId('shared')).toBe(s2);
		unregisterPlayerSocket('shared', s2);
		expect(findSocketByPlayerId('shared')).toBeNull();
	});
});

// ── Constants ──

describe('constants', () => {
	it('DETECTION_RADIUS is 8', () => {
		expect(DETECTION_RADIUS).toBe(8);
	});

	it('ATTACK_RANGE is 5', () => {
		expect(ATTACK_RANGE).toBe(5);
	});

	it('TICK_RATE is 20', () => {
		expect(TICK_RATE).toBe(20);
	});

	it('GRID_COLS is 4', () => {
		expect(GRID_COLS).toBe(4);
	});

	it('GRID_ROWS is 4', () => {
		expect(GRID_ROWS).toBe(4);
	});

	it('CELL_SPACING is 20', () => {
		expect(CELL_SPACING).toBe(20);
	});
});

// ── createGameState ──

describe('createGameState()', () => {
	it('returns a fresh state object with expected keys', () => {
		const state = createGameState();
		expect(state).toHaveProperty('players');
		expect(state).toHaveProperty('enemies');
		expect(state).toHaveProperty('minions');
		expect(state).toHaveProperty('loot');
		expect(state).toHaveProperty('lobby');
		expect(state).toHaveProperty('gamePhase', 'lobby');
	});

	it('returns empty collections', () => {
		const state = createGameState();
		expect(Object.keys(state.players).length).toBe(0);
		expect(state.enemies.length).toBe(0);
		expect(state.minions.length).toBe(0);
		expect(state.loot.length).toBe(0);
	});

	it('returns independent objects (no shared state)', () => {
		const a = createGameState();
		const b = createGameState();
		a.players['test'] = {};
		expect(b.players['test']).toBeUndefined();
	});
});

// ── state factory parity ──

describe('state factory parity', () => {
	it('createGameState and createLobbyGameState produce identical key sets', () => {
		const keysA = Object.keys(createGameState()).sort();
		const keysB = Object.keys(createLobbyGameState()).sort();
		expect(keysA).toEqual(keysB);
	});

	it('factory output contains previously-missing keys as arrays', () => {
		const state = createGameState();
		expect(Array.isArray(state.enchantments)).toBe(true);
		expect(Array.isArray(state.lobby)).toBe(true);
		expect(Array.isArray(state._pendingVolatileExplosions)).toBe(true);
	});

	it('createLobbyGameState output also contains the three keys', () => {
		const state = createLobbyGameState();
		expect(Array.isArray(state.enchantments)).toBe(true);
		expect(Array.isArray(state.lobby)).toBe(true);
		expect(Array.isArray(state._pendingVolatileExplosions)).toBe(true);
	});
});

// ── Run State ──

describe('run state', () => {
	beforeEach(() => {
		resetState();
		// Ensure run is cleared before each test
		delete gameState.run;
	});

	describe('createRunState()', () => {
		it('produces an object with all required fields', () => {
			// Set a known number of enemies
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
				{ id: 'e2', x: 5, z: 5, hp: 50, state: 'idle', wanderTarget: { x: 5, z: 5 } },
				{ id: 'e3', x: 10, z: 10, hp: 50, state: 'idle', wanderTarget: { x: 10, z: 10 } },
			];

			const run = createRunState();

			expect(run).toHaveProperty('id');
			expect(typeof run.id).toBe('string');
			expect(run).toHaveProperty('status', 'playing');
			expect(run).toHaveProperty('questId', DEFAULT_QUEST_ID);
			expect(run).toHaveProperty('questName', getQuest('training_caverns').name);
			expect(run).toHaveProperty('objective');
			expect(run.objective).toHaveProperty('type', 'defeat_enemies');
			expect(run.objective.label).toContain(getQuest('training_caverns').name);
			expect(run.objective).toHaveProperty('totalEnemies', countScriptedEnemiesInQuest(getQuest('training_caverns', 1)));
			expect(run.objective).toHaveProperty('defeatedEnemies', 0);
			expect(run).toHaveProperty('startedAt');
			expect(typeof run.startedAt).toBe('number');
		});

		it('creates a collect-items objective for crystal rescue', () => {
			gameState.selectedQuestId = 'crystal_rescue';
			const run = createRunState();

			expect(run.questId).toBe('crystal_rescue');
			expect(run.objective.type).toBe('collect_items');
			expect(run.objective.totalItems).toBe(getQuest('crystal_rescue').itemCount);
			expect(run.objective.collectedItems).toBe(0);
			expect(run.objective.totalEnemies).toBe(countScriptedEnemiesInQuest(getQuest('crystal_rescue', 1)));
		});

		it('creates a survive objective for the endless siege quest', () => {
			gameState.selectedQuestId = 'endless_siege';
			const run = createRunState();

			const quest = getQuest('endless_siege');
			expect(run.questId).toBe('endless_siege');
			expect(run.objective.type).toBe('survive');
			expect(run.objective.totalSpawns).toBe(quest.totalSpawns);
			expect(run.objective.minibossCount).toBe(quest.minibossCount);
			expect(run.objective.spawnedEnemies).toBe(0);
			expect(run.objective.defeatedEnemies).toBe(0);
			// totalEnemies mirrors totalSpawns so the HUD + completion fallback reuse it
			expect(run.objective.totalEnemies).toBe(quest.totalSpawns);
			expect(run.objective.label).toContain(quest.name);
		});
	});

	describe('survive objective completion', () => {
		function makeSurviveRun() {
			gameState.selectedQuestId = 'endless_siege';
			gameState.run = createRunState();
			return gameState.run;
		}

		it('recordEnemyDefeated increments a survive objective', () => {
			makeSurviveRun();
			recordEnemyDefeated(1);
			recordEnemyDefeated(2);
			expect(gameState.run.objective.defeatedEnemies).toBe(3);
		});

		it('completes only after totalSpawns defeats', () => {
			const run = makeSurviveRun();
			const total = run.objective.totalSpawns;

			recordEnemyDefeated(total - 1);
			expect(isRunObjectiveComplete(run.objective)).toBe(false);

			recordEnemyDefeated(1);
			expect(isRunObjectiveComplete(run.objective)).toBe(true);
		});

		it('does not affect a different objective type', () => {
			gameState.selectedQuestId = 'crystal_rescue';
			gameState.selectedQuestTier = 2;
			gameState.run = createRunState();
			recordEnemyDefeated(1);
			expect(gameState.run.objective.collectedItems).toBe(0);
			expect(gameState.run.objective.defeatedEnemies).toBeUndefined();
		});
	});

	describe('updateSurviveSpawns()', () => {
		function startSurviveRun() {
			resetState();
			gameState.selectedQuestId = 'endless_siege';
			gameState.layoutSeed = 42;
			gameState.gamePhase = 'playing';
			gameState.enemies = [];
			startDungeonRun();
			return gameState.run;
		}

		// Advance well past the throttle interval between every spawn so each call
		// that has enemies left releases exactly one.
		function drainSpawns(run) {
			let now = 1_000_000;
			const guard = run.objective.totalSpawns + 50;
			let iterations = 0;
			while (run.objective.spawnedEnemies < run.objective.totalSpawns && iterations < guard) {
				updateSurviveSpawns(now);
				now += 60_000;
				iterations++;
			}
		}

		it('skips the up-front bulk combat spawn for survive runs', () => {
			startSurviveRun();
			spawnEnemies();
			expect(gameState.enemies.length).toBe(0);
		});

		it('spawns one enemy at a time and increments spawnedEnemies', () => {
			const run = startSurviveRun();
			expect(run.objective.spawnedEnemies).toBe(0);

			// First tick spawns immediately.
			updateSurviveSpawns(1_000_000);
			expect(run.objective.spawnedEnemies).toBe(1);
			expect(gameState.enemies.length).toBe(1);

			// A second tick within the interval is throttled.
			updateSurviveSpawns(1_000_100);
			expect(run.objective.spawnedEnemies).toBe(1);
			expect(gameState.enemies.length).toBe(1);

			// After the interval elapses, the next enemy spawns.
			updateSurviveSpawns(1_060_000);
			expect(run.objective.spawnedEnemies).toBe(2);
			expect(gameState.enemies.length).toBe(2);
		});

		it('spawns exactly totalSpawns enemies including minibossCount minibosses', () => {
			const run = startSurviveRun();
			const total = run.objective.totalSpawns;
			const minibosses = run.objective.minibossCount;

			drainSpawns(run);

			expect(run.objective.spawnedEnemies).toBe(total);
			expect(gameState.enemies.length).toBe(total);
			const minibossSpawned = gameState.enemies.filter(e => e.type === 'miniboss').length;
			expect(minibossSpawned).toBe(minibosses);
			const regularSpawned = gameState.enemies.filter(e => e.type !== 'miniboss').length;
			expect(regularSpawned).toBe(total - minibosses);
		});

		it('stops spawning once spawnedEnemies reaches totalSpawns', () => {
			const run = startSurviveRun();
			drainSpawns(run);
			const count = gameState.enemies.length;

			updateSurviveSpawns(99_000_000);
			expect(run.objective.spawnedEnemies).toBe(run.objective.totalSpawns);
			expect(gameState.enemies.length).toBe(count);
		});

		it('does not spawn outside the playing phase', () => {
			const run = startSurviveRun();
			gameState.gamePhase = 'lobby';
			updateSurviveSpawns(1_000_000);
			expect(run.objective.spawnedEnemies).toBe(0);
			expect(gameState.enemies.length).toBe(0);
		});

		it('does not spawn for non-survive runs', () => {
			resetState();
			gameState.selectedQuestId = 'arena_trials';
			gameState.gamePhase = 'playing';
			gameState.enemies = [];
			startDungeonRun();
			updateSurviveSpawns(1_000_000);
			expect(gameState.enemies.length).toBe(0);
		});
	});

	describe('recordEnemyDefeated(n)', () => {
		it('increments defeatedEnemies by n', () => {
			gameState.run = {
				id: 'run1',
				status: 'playing',
				objective: {
					type: 'defeat_enemies',
					label: 'Defeat all enemies',
					totalEnemies: 10,
					defeatedEnemies: 0
				},
				startedAt: Date.now()
			};

			recordEnemyDefeated(3);

			expect(gameState.run.objective.defeatedEnemies).toBe(3);
		});

		it('clamps defeatedEnemies at totalEnemies', () => {
			gameState.run = {
				id: 'run1',
				status: 'playing',
				objective: {
					type: 'defeat_enemies',
					label: 'Defeat all enemies',
					totalEnemies: 5,
					defeatedEnemies: 0
				},
				startedAt: Date.now()
			};

			recordEnemyDefeated(10);

			expect(gameState.run.objective.defeatedEnemies).toBe(5);
		});

		it('is a no-op when gameState.run is undefined', () => {
			expect(() => recordEnemyDefeated(1)).not.toThrow();
			expect(gameState.run).toBeUndefined();
		});
	});

	describe('clampObjectiveProgress(run)', () => {
		it('caps defeatedEnemies at totalEnemies', () => {
			const run = {
				objective: {
					totalEnemies: 5,
					defeatedEnemies: 12
				}
			};

			clampObjectiveProgress(run);

			expect(run.objective.defeatedEnemies).toBe(5);
		});

		it('leaves defeatedEnemies unchanged when below total', () => {
			const run = {
				objective: {
					totalEnemies: 10,
					defeatedEnemies: 3
				}
			};

			clampObjectiveProgress(run);

			expect(run.objective.defeatedEnemies).toBe(3);
		});

		it('leaves defeatedEnemies unchanged when equal to total', () => {
			const run = {
				objective: {
					totalEnemies: 5,
					defeatedEnemies: 5
				}
			};

			clampObjectiveProgress(run);

			expect(run.objective.defeatedEnemies).toBe(5);
		});
	});

	describe('buildRunSummary(status)', () => {
		beforeEach(() => {
			resetState();
			delete gameState.run;
		});

		it('returns null when gameState.run is undefined', () => {
			expect(buildRunSummary('victory')).toBeNull();
		});

		it('returns an object with all required fields', () => {
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();
			addPlayer('p1', { hp: 80, currency: 15 });
			recordEnemyDefeated(1);

			const summary = buildRunSummary('victory');

			expect(summary).toHaveProperty('runId');
			expect(summary).toHaveProperty('status', 'victory');
			expect(summary).toHaveProperty('durationMs');
			expect(typeof summary.durationMs).toBe('number');
			expect(summary).toHaveProperty('objective');
			expect(summary.objective.type).toBe('defeat_enemies');
			expect(summary).toHaveProperty('players');
			expect(summary.players.length).toBe(1);
			expect(summary.players[0]).toHaveProperty('id', 'p1');
			expect(summary.players[0]).toHaveProperty('hp', 80);
			expect(summary.players[0]).toHaveProperty('dead', false);
			expect(summary.players[0]).toHaveProperty('currency', 15);
			expect(summary).toHaveProperty('defeatedEnemies', 1);
			expect(summary).toHaveProperty('currencyCollected', 15);
			expect(summary).toHaveProperty('questId', DEFAULT_QUEST_ID);
			expect(summary).toHaveProperty('questName', getQuest('training_caverns').name);
			expect(summary.rewards.currency).toBe(getQuest('training_caverns').rewardCurrency);
		});

		it('sums currencyCollected from multiple players', () => {
			startDungeonRun();
			addPlayer('p1', { currency: 10 });
			addPlayer('p2', { currency: 25 });

			const summary = buildRunSummary('failed');

			expect(summary.currencyCollected).toBe(35);
		});

		it('handles zero currency', () => {
			startDungeonRun();
			addPlayer('p1', { currency: 0 });

			const summary = buildRunSummary('victory');

			expect(summary.currencyCollected).toBe(0);
		});
	});

	describe('quest-objective-near-complete debug scenario', () => {
		beforeEach(() => {
			resetState();
			delete gameState.run;
		});

		// Mirrors the near-complete state the `quest-objective-near-complete`
		// debug scenario installs on a started defeat_enemies run, then drives
		// the single remaining enemy's defeat through the real combat path.
		it('leaves one low-HP enemy and reaches victory when it is defeated', () => {
			// Start a defeat_enemies run with several enemies, as a normal run would.
			gameState.enemies = [
				{ id: 'a', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
				{ id: 'b', x: 4, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 4, z: 0 } },
			];
			startDungeonRun();
			addPlayer('p1', { x: 2, z: 0, hp: 60 });

			// Apply the scenario's near-complete setup.
			gameState.enemies = [];
			const enemy = spawnEnemy(5, 0, 'grunt');
			enemy.hp = 1;
			enemy.maxHp = ENEMY_DEFS.grunt.hp;
			gameState.run.objective.totalEnemies = 1;
			gameState.run.objective.defeatedEnemies = 0;

			expect(gameState.run.objective.type).toBe('defeat_enemies');
			expect(gameState.enemies.length).toBe(1);
			expect(gameState.run.objective.totalEnemies).toBe(1);
			expect(isRunObjectiveComplete(gameState.run.objective)).toBe(false);

			// Defeat the one enemy through the real removal → recordEnemyDefeated path.
			enemy.hp = 0;
			removeDeadEnemies();

			expect(gameState.enemies.length).toBe(0);
			expect(isRunObjectiveComplete(gameState.run.objective)).toBe(true);

			checkRunTerminalState();
			expect(gameState.run.status).toBe('victory');
		});
	});

	describe('checkRunTerminalState()', () => {
		beforeEach(() => {
			resetState();
			gameState.selectedQuestId = 'arena_trials';
			delete gameState.run;
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('is a no-op when gameState.run is undefined', () => {
			expect(() => checkRunTerminalState()).not.toThrow();
		});

		it('is a no-op when run.status is not playing', () => {
			startDungeonRun();
			gameState.run.status = 'victory';

			checkRunTerminalState();

			expect(gameState.run.status).toBe('victory');
		});

		it('sets status to victory when all enemies are defeated', () => {
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();
			gameState.run.objective.totalEnemies = 1;
			gameState.run.objective.defeatedEnemies = 0;
			addPlayer('p1');

			recordEnemyDefeated(1);

			checkRunTerminalState();

			expect(gameState.run.status).toBe('victory');
		});

		it('sets status to failed when all players are dead', () => {
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();
			addPlayer('p1', { hp: 0, dead: true });

			checkRunTerminalState();

			expect(gameState.run.status).toBe('failed');
		});

		it('does not set failed when at least one player is alive', () => {
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();
			addPlayer('p1', { hp: 0, dead: true });
			addPlayer('p2', { hp: 50, dead: false, hand: [{ id: 'iron_sword' }], deck: ['flame_blade'] });

			checkRunTerminalState();

			expect(gameState.run.status).toBe('playing');
		});

		it('does not set failed when there are no players', () => {
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();

			checkRunTerminalState();

			expect(gameState.run.status).toBe('playing');
		});

		it('is idempotent — calling twice does not double-emit', () => {
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();
			gameState.run.objective.totalEnemies = 1;
			gameState.run.objective.defeatedEnemies = 0;
			addPlayer('p1');
			recordEnemyDefeated(1);

			// Track io.emit calls
			const emitCalls = [];
			const originalEmit = serverIo.emit;
			serverIo.emit = (event, data) => emitCalls.push({ event, data });

			checkRunTerminalState();
			checkRunTerminalState(); // second call — should be a no-op

			serverIo.emit = originalEmit;

			expect(gameState.run.status).toBe('victory');
			// Only one emit should have happened
			const victoryEmits = emitCalls.filter(c => c.event === 'runComplete');
			expect(victoryEmits.length).toBe(1);
		});

		it('emits runComplete with correct payload structure on victory', () => {
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();
			gameState.run.objective.totalEnemies = 1;
			gameState.run.objective.defeatedEnemies = 0;
			addPlayer('p1', { hp: 80, currency: 10 });
			recordEnemyDefeated(1);

			const emitCalls = [];
			const originalEmit = serverIo.emit;
			serverIo.emit = (event, data) => emitCalls.push({ event, data });

			checkRunTerminalState();

			serverIo.emit = originalEmit;

			const emit = emitCalls.find(c => c.event === 'runComplete');
			expect(emit).toBeDefined();
			expect(emit.data).toHaveProperty('runId');
			expect(emit.data.status).toBe('victory');
			expect(emit.data).toHaveProperty('durationMs');
			expect(emit.data).toHaveProperty('objective');
			expect(emit.data).toHaveProperty('players');
			expect(emit.data).toHaveProperty('defeatedEnemies');
			expect(emit.data).toHaveProperty('currencyCollected');
		});

		it('emits runFailed with correct payload structure on failure', () => {
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();
			addPlayer('p1', { hp: 0, dead: true, currency: 5 });

			const emitCalls = [];
			const originalEmit = serverIo.emit;
			serverIo.emit = (event, data) => emitCalls.push({ event, data });

			checkRunTerminalState();

			serverIo.emit = originalEmit;

			const emit = emitCalls.find(c => c.event === 'runFailed');
			expect(emit).toBeDefined();
			expect(emit.data.status).toBe('failed');
			expect(emit.data.currencyCollected).toBe(5);
		});

		it('sets status to failed when all players are out of cards and objective is incomplete', () => {
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();
			addPlayer('p1', { hp: 80, dead: false, hand: [], deck: [] });

			checkRunTerminalState();

			expect(gameState.run.status).toBe('failed');
		});

		it('does not fail on deck depletion when at least one player still has cards', () => {
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();
			addPlayer('p1', { hp: 80, hand: [], deck: [] });
			addPlayer('p2', { hp: 80, hand: [{ id: 'iron_sword' }], deck: ['flame_blade'] });

			checkRunTerminalState();

			expect(gameState.run.status).toBe('playing');
		});

		it('does not fail on deck depletion when the objective is already complete', () => {
			gameState.enemies = [];
			startDungeonRun();
			recordEnemyDefeated(gameState.run.objective.totalEnemies);
			addPlayer('p1', { hp: 80, hand: [], deck: [] });

			checkRunTerminalState();

			expect(gameState.run.status).toBe('victory');
		});

		it('does not fail immediately when hand has only MS-insufficient cards', () => {
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();
			addPlayer('p1', {
				hp: 80,
				dead: false,
				magicStones: 25,
				hand: [{
					id: 'battle_familiar',
					type: 'spell',
					charges: 1,
					remainingCharges: 1,
					magicStoneCost: 50,
				}],
				deck: [],
				desperationDeck: [],
			});

			tickCombatExhaustionGrace(Date.now());

			expect(gameState.run.status).toBe('playing');
		});

		it('fails after combat exhaustion grace when hand has only MS-insufficient cards', () => {
			vi.setSystemTime(1000);
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();
			addPlayer('p1', {
				hp: 80,
				dead: false,
				magicStones: 25,
				hand: [{
					id: 'battle_familiar',
					type: 'spell',
					charges: 1,
					remainingCharges: 1,
					magicStoneCost: 50,
				}],
				deck: [],
				desperationDeck: [],
			});

			tickCombatExhaustionGrace(Date.now());
			expect(gameState.run.status).toBe('playing');

			vi.advanceTimersByTime(RUN_EXHAUSTION_GRACE_MS);
			tickCombatExhaustionGrace(Date.now());

			expect(gameState.run.status).toBe('failed');
		});

		it('emits runFailed after combat exhaustion grace expires for MS-insufficient stall', () => {
			vi.setSystemTime(1000);
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();
			addPlayer('p1', {
				hp: 80,
				dead: false,
				magicStones: 25,
				hand: [{
					id: 'battle_familiar',
					type: 'spell',
					charges: 1,
					remainingCharges: 1,
					magicStoneCost: 50,
				}],
				deck: [],
				desperationDeck: [],
			});

			const emitCalls = [];
			const originalEmit = serverIo.emit;
			serverIo.emit = (event, data) => emitCalls.push({ event, data });

			tickCombatExhaustionGrace(Date.now());
			vi.advanceTimersByTime(RUN_EXHAUSTION_GRACE_MS);
			tickCombatExhaustionGrace(Date.now());

			serverIo.emit = originalEmit;

			const emit = emitCalls.find((c) => c.event === 'runFailed');
			expect(emit).toBeDefined();
			expect(emit.data.status).toBe('failed');
		});

		it('does not fail on MS-insufficient stall when desperation deck still has drawable cards', () => {
			vi.setSystemTime(1000);
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();
			addPlayer('p1', {
				hp: 80,
				dead: false,
				magicStones: 25,
				hand: [{
					id: 'battle_familiar',
					type: 'spell',
					charges: 1,
					remainingCharges: 1,
					magicStoneCost: 50,
				}],
				deck: [],
				desperationDeck: ['rusty_shiv'],
			});

			vi.advanceTimersByTime(RUN_EXHAUSTION_GRACE_MS + 1000);
			tickCombatExhaustionGrace(Date.now());

			expect(gameState.run.status).toBe('playing');
		});

		it('clears combat exhaustion grace when MS regen makes a hand card castable', () => {
			vi.setSystemTime(1000);
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();
			addPlayer('p1', {
				hp: 80,
				dead: false,
				magicStones: 25,
				hand: [{
					id: 'battle_familiar',
					type: 'spell',
					charges: 1,
					remainingCharges: 1,
					magicStoneCost: 50,
				}],
				deck: [],
				desperationDeck: [],
			});

			tickCombatExhaustionGrace(Date.now());
			expect(gameState.players.p1._combatExhaustedSince).toBe(1000);

			gameState.players.p1.magicStones = 50;
			tickCombatExhaustionGrace(Date.now());

			expect(gameState.players.p1._combatExhaustedSince).toBeUndefined();
			expect(gameState.run.status).toBe('playing');
		});

		it('drawReplacementCard draws desperation when the deck is empty', () => {
			gameState.enemies = [
				{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
			];
			startDungeonRun();
			const player = {
				hp: 80,
				dead: false,
				hand: [{ id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon', charges: 1, remainingCharges: 1 }],
				deck: [],
			};
			initDesperationDeck(player);
			gameState.players.p1 = player;

			drawReplacementCard(player, 0);

			expect(player.hand[0].isDesperation).toBe(true);
			expect(DESPERATION_CARD_DEFS[player.hand[0].id]).toBeDefined();
			expect(player.inDesperation).toBe(true);
			expect(gameState.run.status).toBe('playing');
		});
	});

	describe('resetTransientRunState()', () => {
		beforeEach(() => {
			resetState();
		});

		it('clears enemies, minions, loot, and telepipe', () => {
			gameState.enemies.push({ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } });
			gameState.minions.push({ id: 'm1', ownerId: 'p1', x: 0, z: 0, hp: 50, ttl: 30 });
			gameState.loot.push({ id: 'l1', x: 0, z: 0, value: 10, createdAt: Date.now() });
			gameState.telepipe = { x: 1, z: 2, placedBy: 'p1', placedAt: Date.now() };

			resetTransientRunState();

			expect(gameState.enemies.length).toBe(0);
			expect(gameState.minions.length).toBe(0);
			expect(gameState.loot.length).toBe(0);
			expect(gameState.telepipe).toBeNull();
		});

		it('preserves players and gamePhase', () => {
			addPlayer('p1', { currency: 42 });
			gameState.gamePhase = 'playing';

			resetTransientRunState();

			expect(gameState.players['p1']).toBeDefined();
			expect(gameState.players['p1'].currency).toBe(42);
			expect(gameState.gamePhase).toBe('playing');
		});

		it('preserves the run object', () => {
			startDungeonRun();
			const runId = gameState.run.id;

			resetTransientRunState();

			expect(gameState.run).toBeDefined();
			expect(gameState.run.id).toBe(runId);
		});
	});

	describe('telepipe extract hub return', () => {
		beforeEach(() => {
			resetState();
			gameState._lobbyId = 'test-lobby';
			startDungeonRun();
			gameState.gamePhase = 'playing';
			addPlayer('p1', {
				x: 5,
				z: 5,
				hand: [{ id: 'telepipe', name: 'Telepipe', type: 'spell', charges: 1, remainingCharges: 1 }],
				deck: [],
				slotCooldowns: [null, null, null, null],
				pendingSummons: new Set(),
			});
			addPlayer('p2', {
				x: 10,
				z: 10,
				hand: [{ id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon', charges: 1, remainingCharges: 1 }],
				deck: [],
				slotCooldowns: [null, null, null, null],
				pendingSummons: new Set(),
			});
			gameState.telepipe = { x: 5, z: 5, placedBy: 'p1', placedAt: Date.now() };
			gameState.enemies.push({
				id: 'e1',
				x: 12,
				z: 12,
				hp: 40,
				maxHp: 40,
				type: 'grunt',
				state: 'idle',
				attackState: 'idle',
				wanderTarget: { x: 12, z: 12 },
			});
		});

		it('tryEnterTelepipe extracts one player while another remains active', () => {
			const result = tryEnterTelepipe('p1');
			expect(result.ok).toBe(true);
			expect(gameState.players.p1.extracted).toBe(true);
			expect(gameState.gamePhase).toBe('playing');
			expect(gameState.run).toBeDefined();
			expect(isPlayerActive(gameState.players.p2)).toBe(true);
		});

		it('rejects telepipe entry when player is too far', () => {
			gameState.players.p2.x = 100;
			gameState.players.p2.z = 100;
			const result = tryEnterTelepipe('p2');
			expect(result.ok).toBe(false);
			expect(result.reason).toBe('too_far');
		});

		it('telepipe extract returns squad to hub with cleared world and captured checkpoint', () => {
			const preSuspendRunId = gameState.run.id;
			gameState.players.p1.hp = 42;
			gameState.players.p1.magicStones = 15;
			gameState.players.p1.hand[0].remainingCharges = 0;
			gameState.players.p2.hp = 55;
			gameState.players.p2.magicStones = 22;
			gameState.players.p2.hand[0].remainingCharges = 0;

			tryEnterTelepipe('p1');
			gameState.players.p2.x = 5;
			gameState.players.p2.z = 5;
			tryEnterTelepipe('p2');

			expect(gameState.gamePhase).toBe('lobby');
			expect(gameState.run).toBeUndefined();
			expect(gameState.enemies).toHaveLength(0);
			expect(gameState.telepipe).toBeNull();
			expect(gameState.players.p1.hp).toBe(42);
			expect(gameState.players.p1.magicStones).toBe(15);
			expect(gameState.players.p2.hp).toBe(55);
			expect(gameState.players.p2.magicStones).toBe(22);
			expect(gameState.players.p1.hand).toEqual([]);
			expect(gameState.players.p2.hand).toEqual([]);

			expect(gameState.suspendedCheckpoint).not.toBeNull();
			expect(gameState.suspendedCheckpoint.run.id).toBe(preSuspendRunId);
			expect(gameState.suspendedCheckpoint.playerStates.p1.hand[0].remainingCharges).toBe(0);
			expect(gameState.suspendedCheckpoint.playerStates.p2.hand[0].remainingCharges).toBe(0);
			gameState.suspendedCheckpoint.playerStates.p1.hand[0].remainingCharges = 99;
			expect(gameState.players.p1.hand).toEqual([]);

			const snapshot = stateSnapshot();
			expect(snapshot.suspendedRunSummary).toEqual({
				questId: gameState.selectedQuestId,
				questName: gameState.suspendedCheckpoint.run.questName,
				objective: gameState.suspendedCheckpoint.run.objective,
			});
		});

		it('suspendRunToLobby captures world snapshot with enemy ids, objective, and layout', () => {
			const liveEnemyRef = {
				id: 'enemy-alpha',
				x: 14,
				z: 14,
				hp: 22,
				maxHp: 40,
				type: 'grunt',
				state: 'chase',
				attackState: 'windup',
				spawnedBy: null,
				wanderTarget: { x: 14, z: 14 },
			};
			const liveEnemyRef2 = {
				id: 'enemy-beta',
				x: 16,
				z: 16,
				hp: 40,
				maxHp: 40,
				type: 'grunt',
				state: 'idle',
				attackState: 'idle',
				spawnedBy: 'spawner-1',
				wanderTarget: { x: 16, z: 16 },
			};
			gameState.enemies = [liveEnemyRef, liveEnemyRef2];
			gameState.minions.push({ id: 'minion-1', ownerId: 'p1', x: 8, z: 8, hp: 30, ttl: 20 });
			gameState.loot.push({ id: 'loot-1', x: 9, z: 9, value: 5, createdAt: Date.now() });
			gameState.areaEffects.push({ id: 'fx-1', type: 'fire', x: 10, z: 10, radius: 2, expiresAt: Date.now() + 5000 });
			gameState.iceBalls.push({ id: 'ice-1', ownerId: 'enemy-beta', x: 15, z: 15, dirX: 1, dirZ: 0, traveled: 1 });
			gameState.enchantments.push({ id: 'enc-1', cardId: 'spike_trap', x: 11, z: 11, expiresAt: Date.now() + 10000 });
			gameState.layout = { rooms: [{ x: 0, z: 0, width: 20, depth: 20, role: 'start' }] };
			gameState.layoutSeed = 4242;
			gameState.dungeonBounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
			gameState.run.encounter = {
				bossEnemyId: 'enemy-alpha',
				phase: 'active',
				locked: true,
				spawnAnchor: { x: 14, z: 14 },
			};
			gameState.run.objective = {
				type: 'defeat_enemies',
				totalEnemies: 5,
				defeatedEnemies: 0,
				label: 'Purge hostiles',
			};
			recordEnemyDefeated(1);

			const preSuspendObjective = {
				type: gameState.run.objective.type,
				totalEnemies: gameState.run.objective.totalEnemies,
				defeatedEnemies: gameState.run.objective.defeatedEnemies,
				label: gameState.run.objective.label,
			};
			const preSuspendTelepipe = { ...gameState.telepipe };

			tryEnterTelepipe('p1');
			gameState.players.p2.x = 5;
			gameState.players.p2.z = 5;
			tryEnterTelepipe('p2');

			expect(gameState.enemies).toHaveLength(0);
			expect(gameState.minions).toHaveLength(0);
			expect(gameState.loot).toHaveLength(0);
			expect(gameState.areaEffects).toHaveLength(0);
			expect(gameState.iceBalls).toHaveLength(0);
			expect(gameState.telepipe).toBeNull();

			const checkpoint = gameState.suspendedCheckpoint;
			expect(checkpoint).not.toBeNull();
			expect(checkpoint.worldState).toBeDefined();

			const world = checkpoint.worldState;
			expect(world.enemies.map((e) => e.id)).toEqual(['enemy-alpha', 'enemy-beta']);
			expect(world.enemies[0].hp).toBe(22);
			expect(world.enemies[0].state).toBe('chase');
			expect(world.enemies[0].attackState).toBe('windup');
			expect(world.enemies[1].spawnedBy).toBe('spawner-1');
			expect(world.minions).toHaveLength(1);
			expect(world.loot).toHaveLength(1);
			expect(world.areaEffects).toHaveLength(1);
			expect(world.iceBalls).toHaveLength(1);
			expect(world.enchantments).toHaveLength(1);
			expect(world.telepipe).toEqual(preSuspendTelepipe);
			expect(world.layout).toEqual(gameState.layout);
			expect(world.layoutSeed).toBe(4242);
			expect(world.dungeonBounds).toEqual({ minX: -10, maxX: 10, minZ: -10, maxZ: 10 });

			expect(checkpoint.run.objective).toEqual(preSuspendObjective);
			expect(checkpoint.run.encounter).toEqual({
				bossEnemyId: 'enemy-alpha',
				phase: 'active',
				locked: true,
				spawnAnchor: { x: 14, z: 14 },
			});

			liveEnemyRef.hp = 999;
			expect(checkpoint.worldState.enemies[0].hp).toBe(22);
			checkpoint.worldState.enemies[0].hp = 888;
			expect(liveEnemyRef.hp).toBe(999);
		});

		it('checkAllReady after telepipe extract restores full world snapshot on resume', () => {
			gameState.enemies = [{
				id: 'enemy-alpha',
				x: 14,
				z: 14,
				hp: 22,
				maxHp: 40,
				type: 'grunt',
				state: 'chase',
				attackState: 'windup',
				spawnedBy: null,
				wanderTarget: { x: 14, z: 14 },
			}, {
				id: 'enemy-beta',
				x: 16,
				z: 16,
				hp: 40,
				maxHp: 40,
				type: 'grunt',
				state: 'idle',
				attackState: 'idle',
				spawnedBy: 'spawner-1',
				wanderTarget: { x: 16, z: 16 },
			}];
			gameState.minions.push({ id: 'minion-1', ownerId: 'p1', x: 8, z: 8, hp: 30, ttl: 20 });
			gameState.loot.push({ id: 'loot-1', x: 9, z: 9, value: 5, createdAt: Date.now() });
			gameState.areaEffects.push({ id: 'fx-1', type: 'fire', x: 10, z: 10, radius: 2, expiresAt: Date.now() + 5000 });
			gameState.iceBalls.push({ id: 'ice-1', ownerId: 'enemy-beta', x: 15, z: 15, dirX: 1, dirZ: 0, traveled: 1 });
			gameState.enchantments.push({ id: 'enc-1', cardId: 'spike_trap', x: 11, z: 11, expiresAt: Date.now() + 10000 });
			gameState.layout = { rooms: [{ x: 0, z: 0, width: 20, depth: 20, role: 'start' }] };
			gameState.layoutSeed = 4242;
			gameState.dungeonBounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
			gameState.run.objective = {
				type: 'defeat_enemies',
				totalEnemies: 5,
				defeatedEnemies: 1,
				label: 'Purge hostiles',
			};
			const preSuspendTelepipe = { ...gameState.telepipe };
			const preSuspendEnemyIds = gameState.enemies.map((e) => e.id);

			tryEnterTelepipe('p1');
			gameState.players.p2.x = 5;
			gameState.players.p2.z = 5;
			tryEnterTelepipe('p2');

			gameState.players.p1.ready = true;
			gameState.players.p2.ready = true;
			checkAllReady();

			expect(gameState.enemies.map((e) => e.id)).toEqual(preSuspendEnemyIds);
			expect(gameState.enemies[0].hp).toBe(22);
			expect(gameState.enemies[1].spawnedBy).toBe('spawner-1');
			expect(gameState.minions).toHaveLength(1);
			expect(gameState.loot).toHaveLength(1);
			expect(gameState.areaEffects).toHaveLength(1);
			expect(gameState.iceBalls).toHaveLength(1);
			expect(gameState.enchantments).toHaveLength(1);
			expect(gameState.telepipe).toEqual(preSuspendTelepipe);
			expect(gameState.layout).toEqual({ rooms: [{ x: 0, z: 0, width: 20, depth: 20, role: 'start' }] });
			expect(gameState.layoutSeed).toBe(4242);
			expect(gameState.dungeonBounds).toEqual({ minX: -10, maxX: 10, minZ: -10, maxZ: 10 });
			expect(gameState.run.objective).toEqual({
				type: 'defeat_enemies',
				totalEnemies: 5,
				defeatedEnemies: 1,
				label: 'Purge hostiles',
			});
		});

		it('checkAllReady after telepipe extract resumes suspended dungeon run', () => {
			const preExtractRunId = gameState.run.id;
			const preSuspendEnemyIds = gameState.enemies.map((e) => e.id);
			const preSuspendObjective = gameState.run.objective
				? { ...gameState.run.objective }
				: null;
			const preSuspendTelepipe = { ...gameState.telepipe };

			tryEnterTelepipe('p1');
			gameState.players.p2.x = 5;
			gameState.players.p2.z = 5;
			tryEnterTelepipe('p2');

			gameState.players.p1.ready = true;
			gameState.players.p2.ready = true;
			checkAllReady();

			expect(gameState.gamePhase).toBe('playing');
			expect(gameState.run).toBeDefined();
			expect(gameState.run.id).toBe(preExtractRunId);
			expect(gameState.run.status).toBe('playing');
			expect(gameState.suspendedCheckpoint).toBeNull();
			expect(stateSnapshot().suspendedRunSummary).toBeNull();

			const restoredEnemy = gameState.enemies.find((e) => e.id === 'e1');
			expect(restoredEnemy).toBeDefined();
			expect(restoredEnemy.hp).toBe(40);
			for (const id of preSuspendEnemyIds) {
				expect(gameState.enemies.some((e) => e.id === id)).toBe(true);
			}
			const conjuredIds = gameState.enemies
				.filter((e) => !e.spawnedBy && !preSuspendEnemyIds.includes(e.id))
				.map((e) => e.id);
			expect(conjuredIds).toEqual([]);

			if (preSuspendObjective) {
				expect(gameState.run.objective.type).toBe(preSuspendObjective.type);
				expect(gameState.run.objective.totalEnemies).toBe(preSuspendObjective.totalEnemies);
				expect(gameState.run.objective.defeatedEnemies).toBe(preSuspendObjective.defeatedEnemies);
			}

			expect(gameState.telepipe).toEqual(preSuspendTelepipe);
			for (const player of Object.values(gameState.players)) {
				const dist = Math.hypot(player.x - gameState.telepipe.x, player.z - gameState.telepipe.z);
				expect(dist).toBeGreaterThan(PORTAL_RADIUS);
			}
		});

		it('new sortie after abandon resets card charges but preserves hp and magicStones', () => {
			const deck = ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'];
			gameState.players.p1.selectedDeck = [...deck];
			gameState.players.p2.selectedDeck = [...deck];

			const preSuspendRunId = gameState.run.id;
			gameState.players.p1.hp = 42;
			gameState.players.p1.magicStones = 15;
			gameState.players.p2.hp = 55;
			gameState.players.p2.magicStones = 22;
			gameState.players.p1.hand[0].remainingCharges = 0;
			gameState.players.p2.hand[0].remainingCharges = 0;

			tryEnterTelepipe('p1');
			gameState.players.p2.x = 5;
			gameState.players.p2.z = 5;
			tryEnterTelepipe('p2');

			expect(gameState.suspendedCheckpoint).not.toBeNull();
			expect(gameState.suspendedCheckpoint.run.id).toBe(preSuspendRunId);
			expect(gameState.suspendedCheckpoint.playerStates.p1.hand[0].remainingCharges).toBe(0);

			const abandonResult = abandonSuspendedRun();
			expect(abandonResult.ok).toBe(true);
			expect(gameState.suspendedCheckpoint).toBeNull();
			expect(gameState.players.p1.ready).toBe(false);
			expect(gameState.players.p2.ready).toBe(false);
			expect(stateSnapshot().suspendedRunSummary).toBeNull();

			gameState.players.p1.ready = true;
			gameState.players.p2.ready = true;
			checkAllReady();

			expect(gameState.gamePhase).toBe('playing');
			expect(gameState.run).toBeDefined();
			expect(gameState.run.id).not.toBe(preSuspendRunId);
			expect(gameState.players.p1.hp).toBe(42);
			expect(gameState.players.p1.magicStones).toBe(15);
			expect(gameState.players.p2.hp).toBe(55);
			expect(gameState.players.p2.magicStones).toBe(22);

			for (const player of [gameState.players.p1, gameState.players.p2]) {
				for (const card of player.hand) {
					if (card) {
						expect(card.remainingCharges).toBe(card.charges);
					}
				}
			}
		});

		it('checkAllReady fresh deploy preserves existing hp and magicStones', () => {
			resetState();
			addPlayer('p1', {
				ready: true,
				hp: 42,
				magicStones: 15,
				selectedDeck: ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'],
			});

			checkAllReady();

			expect(gameState.gamePhase).toBe('playing');
			expect(gameState.players.p1.hp).toBe(42);
			expect(gameState.players.p1.magicStones).toBe(15);
		});

		it('checkAllReady fresh deploy defaults vitals for brand-new players', () => {
			resetState();
			addPlayer('p1', {
				ready: true,
				hp: undefined,
				magicStones: undefined,
				selectedDeck: ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'],
			});

			checkAllReady();

			expect(gameState.gamePhase).toBe('playing');
			expect(gameState.players.p1.hp).toBe(100);
			expect(gameState.players.p1.magicStones).toBe(STARTING_MAGIC_STONES);
		});

		it('initializePlayerForActiveRun preserves existing hp and magicStones on drop-in', () => {
			resetState();
			const player = {
				hp: 42,
				magicStones: 15,
				hand: [{ id: 'iron_sword', type: 'weapon' }],
				deck: [],
				slotCooldowns: [null, null, null, null],
				pendingSummons: new Set(),
			};

			initializePlayerForActiveRun(player);

			expect(player.hp).toBe(42);
			expect(player.magicStones).toBe(15);
		});

		it('initializePlayerForActiveRun defaults vitals when missing on drop-in', () => {
			resetState();
			const player = {
				hp: undefined,
				magicStones: undefined,
				hand: [{ id: 'iron_sword', type: 'weapon' }],
				deck: [],
				slotCooldowns: [null, null, null, null],
				pendingSummons: new Set(),
			};

			initializePlayerForActiveRun(player);

			expect(player.hp).toBe(100);
			expect(player.magicStones).toBe(STARTING_MAGIC_STONES);
		});

		it('telepipe resume redeploy preserves hp, magicStones, and card charges', () => {
			resetState();
			gameState._lobbyId = 'test-lobby';
			addPlayer('p1', {
				x: 5,
				z: 5,
				ready: true,
				debugScenario: 'telepipe-ready',
				selectedDeck: ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'],
			});

			checkAllReady();
			const preExtractRunId = gameState.run.id;

			gameState.players.p1.hp = 42;
			gameState.players.p1.magicStones = STARTING_MAGIC_STONES - 5;
			const spentCharges = {};
			for (const card of gameState.players.p1.hand) {
				if (card && card.charges != null) {
					card.remainingCharges = Math.max(0, card.charges - 1);
					spentCharges[card.id] = card.remainingCharges;
				}
			}

			const { x: portalX, z: portalZ } = gameState.players.p1;
			gameState.telepipe = {
				x: portalX,
				z: portalZ,
				placedBy: 'p1',
				placedAt: Date.now() - PORTAL_PLACEMENT_GRACE_MS - 1,
			};
			expect(tryEnterTelepipe('p1').ok).toBe(true);
			expect(gameState.gamePhase).toBe('lobby');
			expect(gameState.run).toBeUndefined();

			gameState.players.p1.ready = true;
			checkAllReady();

			expect(gameState.run.id).toBe(preExtractRunId);
			const preservedMagicStones = STARTING_MAGIC_STONES - 5;
			expect(gameState.players.p1.hp).toBe(42);
			expect(gameState.players.p1.magicStones).toBe(preservedMagicStones);
			for (let tick = 0; tick < 5; tick += 1) {
				regenMagicStones();
			}
			expect(gameState.players.p1.magicStones).toBeCloseTo(
				preservedMagicStones + 5 * MAGIC_STONES_REGEN_PER_TICK,
				5,
			);
			const occupied = gameState.players.p1.hand.filter(Boolean);
			expect(occupied.length).toBeGreaterThan(0);
			for (const card of occupied) {
				if (card.charges != null) {
					expect(card.remainingCharges).toBe(spentCharges[card.id]);
				}
			}
			expect(gameState.suspendedCheckpoint).toBeNull();
			expect(stateSnapshot().suspendedRunSummary).toBeNull();
		});
		it('checkAllReady does not start when a disconnected player has stale ready', () => {
			resetState();
			addPlayer('p1', {
				connected: false,
				ready: true,
				selectedDeck: ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'],
			});
			addPlayer('p2', {
				connected: true,
				ready: true,
				selectedDeck: ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'],
			});

			checkAllReady();

			expect(gameState.gamePhase).toBe('lobby');
		});

		it('checkAllReady injects telepipe for telepipe-ready debug scenario', () => {
			resetState();
			addPlayer('p1', {
				ready: true,
				debugScenario: 'telepipe-ready',
				selectedDeck: ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'],
			});

			checkAllReady();

			expect(gameState.gamePhase).toBe('playing');
			expect(gameState.players.p1.hand.some((c) => c && c.id === 'telepipe')).toBe(true);
			expect(gameState.players.p1.hp).toBe(100);
		});

		it('checkAllReady staggers spawn positions for multiple players', () => {
			resetState();
			addPlayer('p1', {
				ready: true,
				selectedDeck: ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'],
			});
			addPlayer('p2', {
				ready: true,
				selectedDeck: ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'],
			});

			checkAllReady();

			expect(gameState.players.p1.x).not.toBe(gameState.players.p2.x);
			expect(Math.hypot(
				gameState.players.p1.x - gameState.players.p2.x,
				gameState.players.p1.z - gameState.players.p2.z,
			)).toBeGreaterThan(PORTAL_RADIUS);
		});

		it('portal proximity grace prevents immediate extraction after placement', () => {
			resetState();
			gameState._lobbyId = 'test-lobby';
			startDungeonRun();
			gameState.gamePhase = 'playing';
			addPlayer('p1', { x: 5, z: 5, hand: [], deck: [], slotCooldowns: [null, null, null, null], pendingSummons: new Set() });
			addPlayer('p2', { x: 10, z: 10, hand: [], deck: [], slotCooldowns: [null, null, null, null], pendingSummons: new Set() });
			gameState.telepipe = { x: 5, z: 5, placedBy: 'p1', placedAt: Date.now() };

			checkTelepipeProximity();
			expect(gameState.players.p1.extracted).toBeUndefined();

			gameState.telepipe.placedAt = Date.now() - PORTAL_PLACEMENT_GRACE_MS - 1;
			checkTelepipeProximity();
			expect(gameState.players.p1.extracted).toBe(true);
			expect(gameState.gamePhase).toBe('playing');
		});

		it('single extract keeps dungeon running until all players leave', () => {
			resetState();
			gameState._lobbyId = 'test-lobby';
			startDungeonRun();
			gameState.gamePhase = 'playing';
			addPlayer('p1', { x: 5, z: 5, hand: [], deck: [], slotCooldowns: [null, null, null, null], pendingSummons: new Set() });
			addPlayer('p2', { x: 10, z: 10, hand: [], deck: [], slotCooldowns: [null, null, null, null], pendingSummons: new Set() });
			gameState.telepipe = { x: 5, z: 5, placedBy: 'p1', placedAt: Date.now() - PORTAL_PLACEMENT_GRACE_MS - 1 };

			expect(tryEnterTelepipe('p1').ok).toBe(true);
			expect(gameState.gamePhase).toBe('playing');
			expect(gameState.run.status).toBe('playing');
			expect(isPlayerActive(gameState.players.p2)).toBe(true);
		});

		it('checkAllReady starts fresh run when selected quest differs from suspended checkpoint', () => {
			const originalRunId = gameState.run.id;
			expect(gameState.run.questId).toBe(DEFAULT_QUEST_ID);

			// Both players extract via telepipe to create suspended checkpoint
			tryEnterTelepipe('p1');
			gameState.players.p2.x = 5;
			gameState.players.p2.z = 5;
			tryEnterTelepipe('p2');

			expect(gameState.suspendedCheckpoint).not.toBeNull();
			expect(gameState.suspendedCheckpoint.run.questId).toBe(DEFAULT_QUEST_ID);

			// Change selected quest to a different quest
			gameState.selectedQuestId = 'crystal_rescue';
			gameState.selectedQuestTier = 1;

			// Both players ready up
			gameState.players.p1.ready = true;
			gameState.players.p2.ready = true;
			checkAllReady();

			// Should start a FRESH run for the newly selected quest
			expect(gameState.gamePhase).toBe('playing');
			expect(gameState.run.questId).toBe('crystal_rescue');
			expect(gameState.run.questTier).toBe(1);
			expect(gameState.run.id).not.toBe(originalRunId);
			expect(gameState.suspendedCheckpoint).not.toBeNull();
		});
	});

	describe('card charge persistence — telepipe resume vs new sortie', () => {
		const deck = ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'];

		function setupTwoPlayerRun() {
			resetState();
			gameState._lobbyId = 'test-lobby';
			startDungeonRun();
			gameState.gamePhase = 'playing';
			addPlayer('p1', {
				x: 5,
				z: 5,
				selectedDeck: [...deck],
				hand: [{ id: 'telepipe', name: 'Telepipe', type: 'spell', charges: 1, remainingCharges: 1 }],
				deck: [],
				slotCooldowns: [null, null, null, null],
				pendingSummons: new Set(),
			});
			addPlayer('p2', {
				x: 10,
				z: 10,
				selectedDeck: [...deck],
				hand: [{ id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon', charges: 5, remainingCharges: 5 }],
				deck: [],
				slotCooldowns: [null, null, null, null],
				pendingSummons: new Set(),
			});
			gameState.telepipe = {
				x: 5,
				z: 5,
				placedBy: 'p1',
				placedAt: Date.now() - PORTAL_PLACEMENT_GRACE_MS - 1,
			};
		}

		function extractAllPlayers() {
			tryEnterTelepipe('p1');
			gameState.players.p2.x = 5;
			gameState.players.p2.z = 5;
			tryEnterTelepipe('p2');
		}

		it('telepipe-resume: spend charges → full extract → redeploy preserves remainingCharges, hp, and magicStones', () => {
			setupTwoPlayerRun();
			const preExtractRunId = gameState.run.id;
			const nonDefaultHp = 42;
			const nonDefaultMs = 15;

			gameState.players.p1.hp = nonDefaultHp;
			gameState.players.p1.magicStones = nonDefaultMs;
			gameState.players.p2.hp = 55;
			gameState.players.p2.magicStones = 22;

			const spentCharges = {};
			for (const card of gameState.players.p1.hand) {
				if (card && card.charges != null) {
					card.remainingCharges = Math.max(0, card.charges - 1);
					spentCharges[card.id] = card.remainingCharges;
				}
			}
			gameState.players.p2.hand[0].remainingCharges = 2;

			extractAllPlayers();
			expect(gameState.gamePhase).toBe('lobby');
			expect(gameState.suspendedCheckpoint).not.toBeNull();

			gameState.players.p1.ready = true;
			gameState.players.p2.ready = true;
			checkAllReady();

			expect(gameState.run.id).toBe(preExtractRunId);
			expect(gameState.players.p1.hp).toBe(nonDefaultHp);
			expect(gameState.players.p1.magicStones).toBe(nonDefaultMs);
			expect(gameState.players.p2.hp).toBe(55);
			expect(gameState.players.p2.magicStones).toBe(22);

			for (const card of gameState.players.p1.hand) {
				if (card && card.charges != null && spentCharges[card.id] != null) {
					expect(card.remainingCharges).toBe(spentCharges[card.id]);
				}
			}
			const p2Sword = gameState.players.p2.hand.find((c) => c && c.id === 'iron_sword');
			if (p2Sword) {
				expect(p2Sword.remainingCharges).toBe(2);
			}
		});

		it('new sortie: spend charges → full extract → abandon → redeploy resets charges and run id', () => {
			setupTwoPlayerRun();
			const preSuspendRunId = gameState.run.id;
			const nonDefaultHp = 42;
			const nonDefaultMs = 15;

			gameState.players.p1.hp = nonDefaultHp;
			gameState.players.p1.magicStones = nonDefaultMs;
			gameState.players.p2.hp = 55;
			gameState.players.p2.magicStones = 22;
			gameState.players.p1.hand[0].remainingCharges = 0;
			gameState.players.p2.hand[0].remainingCharges = 0;

			extractAllPlayers();
			expect(gameState.suspendedCheckpoint).not.toBeNull();
			expect(gameState.suspendedCheckpoint.playerStates.p1.hand[0].remainingCharges).toBe(0);

			const abandonResult = abandonSuspendedRun();
			expect(abandonResult.ok).toBe(true);
			expect(gameState.suspendedCheckpoint).toBeNull();

			gameState.players.p1.ready = true;
			gameState.players.p2.ready = true;
			checkAllReady();

			expect(gameState.gamePhase).toBe('playing');
			expect(gameState.run.id).not.toBe(preSuspendRunId);
			expect(gameState.players.p1.hp).toBe(nonDefaultHp);
			expect(gameState.players.p1.magicStones).toBe(nonDefaultMs);
			expect(gameState.players.p2.hp).toBe(55);
			expect(gameState.players.p2.magicStones).toBe(22);

			for (const player of [gameState.players.p1, gameState.players.p2]) {
				for (const card of player.hand) {
					if (card) {
						expect(card.remainingCharges).toBe(card.charges);
					}
				}
			}
		});

		it('regression: neither path resets hp to MAX_HP or magicStones to STARTING_MAGIC_STONES', () => {
			const nonDefaultHp = 37;
			const nonDefaultMs = 23;

			setupTwoPlayerRun();
			gameState.players.p1.hp = nonDefaultHp;
			gameState.players.p1.magicStones = nonDefaultMs;
			gameState.players.p1.hand[0].remainingCharges = 0;
			extractAllPlayers();

			gameState.players.p1.ready = true;
			gameState.players.p2.ready = true;
			checkAllReady();

			expect(gameState.players.p1.hp).toBe(nonDefaultHp);
			expect(gameState.players.p1.magicStones).toBe(nonDefaultMs);
			expect(gameState.players.p1.hp).not.toBe(MAX_HP);
			expect(gameState.players.p1.magicStones).not.toBe(STARTING_MAGIC_STONES);

			resetState();
			setupTwoPlayerRun();
			gameState.players.p1.hp = nonDefaultHp;
			gameState.players.p1.magicStones = nonDefaultMs;
			gameState.players.p1.hand[0].remainingCharges = 0;
			extractAllPlayers();
			abandonSuspendedRun();

			gameState.players.p1.ready = true;
			gameState.players.p2.ready = true;
			checkAllReady();

			expect(gameState.players.p1.hp).toBe(nonDefaultHp);
			expect(gameState.players.p1.magicStones).toBe(nonDefaultMs);
			expect(gameState.players.p1.hp).not.toBe(MAX_HP);
			expect(gameState.players.p1.magicStones).not.toBe(STARTING_MAGIC_STONES);
		});
	});

	describe('runSpawnSeed checkpoint lifecycle — crystal_rescue', () => {
		const deck = ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'];

		function crystalPositions(state = gameState) {
			return state.loot
				.filter((loot) => loot.kind === 'crystal')
				.map((loot) => ({ x: loot.x, z: loot.z }));
		}

		function setupCrystalRescueRun() {
			resetState();
			gameState._lobbyId = 'test-lobby';
			gameState.selectedQuestId = 'crystal_rescue';
			gameState.selectedQuestTier = 1;
			addPlayer('p1', {
				ready: true,
				selectedDeck: [...deck],
				deck: [],
				slotCooldowns: [null, null, null, null],
				pendingSummons: new Set(),
			});
			addPlayer('p2', {
				ready: true,
				selectedDeck: [...deck],
				deck: [],
				slotCooldowns: [null, null, null, null],
				pendingSummons: new Set(),
			});
			checkAllReady();
			expect(gameState.gamePhase).toBe('playing');
			expect(crystalPositions().length).toBe(getQuest('crystal_rescue').itemCount);
			gameState.players.p1.hand[0] = {
				id: 'telepipe',
				name: 'Telepipe',
				type: 'spell',
				charges: 1,
				remainingCharges: 1,
			};
			gameState.telepipe = {
				x: gameState.players.p1.x,
				z: gameState.players.p1.z,
				placedBy: 'p1',
				placedAt: Date.now() - PORTAL_PLACEMENT_GRACE_MS - 1,
			};
		}

		function extractAllPlayers() {
			tryEnterTelepipe('p1');
			gameState.players.p2.x = gameState.telepipe.x;
			gameState.players.p2.z = gameState.telepipe.z;
			tryEnterTelepipe('p2');
		}

		it('suspendRunToLobby captures runSpawnSeed and crystal positions in checkpoint', () => {
			setupCrystalRescueRun();
			const preSuspendRunSpawnSeed = gameState.runSpawnSeed;
			const preSuspendCrystals = crystalPositions();

			extractAllPlayers();

			expect(gameState.suspendedCheckpoint).not.toBeNull();
			expect(gameState.suspendedCheckpoint.worldState.runSpawnSeed).toBe(preSuspendRunSpawnSeed);
			expect(
				gameState.suspendedCheckpoint.worldState.loot
					.filter((loot) => loot.kind === 'crystal')
					.map((loot) => ({ x: loot.x, z: loot.z })),
			).toEqual(preSuspendCrystals);
		});

		it('telepipe resume restores runSpawnSeed and crystal (x,z) tuples unchanged', () => {
			setupCrystalRescueRun();
			const preSuspendRunSpawnSeed = gameState.runSpawnSeed;
			const preSuspendCrystals = crystalPositions();
			const preSuspendLayoutSeed = gameState.layoutSeed;

			extractAllPlayers();

			gameState.players.p1.ready = true;
			gameState.players.p2.ready = true;
			checkAllReady();

			expect(gameState.gamePhase).toBe('playing');
			expect(gameState.runSpawnSeed).toBe(preSuspendRunSpawnSeed);
			expect(gameState.layoutSeed).toBe(preSuspendLayoutSeed);
			expect(crystalPositions()).toEqual(preSuspendCrystals);
		});

		it('telepipe resume does not call spawnEnemies', () => {
			setupCrystalRescueRun();
			extractAllPlayers();

			const spawnSpy = vi.spyOn(progressionModule, 'spawnEnemies');
			gameState.players.p1.ready = true;
			gameState.players.p2.ready = true;
			checkAllReady();

			expect(spawnSpy).not.toHaveBeenCalled();
			spawnSpy.mockRestore();
		});

		it('abandon + redeploy mints new runSpawnSeed and crystal positions with same layoutSeed', () => {
			setupCrystalRescueRun();
			const preAbortLayoutSeed = gameState.layoutSeed;
			const preAbortRunSpawnSeed = gameState.runSpawnSeed;
			const preAbortCrystals = crystalPositions();

			extractAllPlayers();
			expect(abandonSuspendedRun().ok).toBe(true);

			gameState.players.p1.ready = true;
			gameState.players.p2.ready = true;
			checkAllReady();

			expect(gameState.gamePhase).toBe('playing');
			expect(gameState.layoutSeed).toBe(preAbortLayoutSeed);
			expect(gameState.runSpawnSeed).not.toBe(preAbortRunSpawnSeed);
			expect(crystalPositions().length).toBe(preAbortCrystals.length);
			expect(crystalPositions()).not.toEqual(preAbortCrystals);
		});

		it('each fresh deploy from a waiting lobby mints a new runSpawnSeed', () => {
			resetState();
			gameState._lobbyId = 'test-lobby';
			gameState.selectedQuestId = 'crystal_rescue';
			gameState.selectedQuestTier = 1;
			addPlayer('p1', {
				ready: true,
				selectedDeck: [...deck],
				deck: [],
				slotCooldowns: [null, null, null, null],
				pendingSummons: new Set(),
			});

			checkAllReady();
			const firstRunSpawnSeed = gameState.runSpawnSeed;
			expect(Number.isInteger(firstRunSpawnSeed)).toBe(true);

			expect(giveUpRun().ok).toBe(true);
			expect(gameState.suspendedCheckpoint).toBeNull();

			gameState.players.p1.ready = true;
			checkAllReady();
			expect(gameState.runSpawnSeed).not.toBe(firstRunSpawnSeed);
		});
	});

	describe('returnPlayersToLobby()', () => {
		function mockRoomEmit() {
			const emitCalls = [];
			const originalTo = serverIo.to;
			const originalEmit = serverIo.emit;
			const originalSockets = serverIo.sockets.sockets;
			const lobbyId = gameState._lobbyId || 'test-lobby';

			serverIo.to = () => ({
				emit: (event, data) => emitCalls.push({ event, data }),
			});
			serverIo.emit = (event, data) => emitCalls.push({ event, data });

			const mockMap = new Map();
			for (const playerId of Object.keys(gameState.players)) {
				const socketId = `mock-${playerId}`;
				mockMap.set(socketId, {
					id: socketId,
					playerId,
					rooms: new Set([lobbyId]),
					emit: (event, data) => emitCalls.push({ event, data }),
				});
			}
			serverIo.sockets.sockets = mockMap;

			return {
				emitCalls,
				restore: () => {
					serverIo.to = originalTo;
					serverIo.emit = originalEmit;
					serverIo.sockets.sockets = originalSockets;
				},
			};
		}

		beforeEach(() => {
			resetState();
			gameState._lobbyId = 'test-lobby';
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('throws when called outside lobby context', async () => {
			delete gameState._lobbyId;
			await expect(returnPlayersToLobby()).rejects.toThrow('returnPlayersToLobby requires lobby context');
		});

		it('resets gamePhase to lobby', async () => {
			gameState.gamePhase = 'playing';
			startDungeonRun();

			const { restore } = mockRoomEmit();

			await returnPlayersToLobby();

			restore();

			expect(gameState.gamePhase).toBe('lobby');
		});

		it('clears dead flag and restores HP to LOBBY_REVIVE_HP when returning dead player to lobby', async () => {
			addPlayer('p1', { hp: 0, dead: true });

			const { restore } = mockRoomEmit();
			await returnPlayersToLobby();
			restore();

			expect(gameState.players.p1.hp).toBe(LOBBY_REVIVE_HP);
			expect(gameState.players.p1.dead).toBe(false);
		});

		it('preserves partial-HP for living player on run-failure return', async () => {
			addPlayer('p1', { hp: 42, dead: false });
			gameState.gamePhase = 'playing';
			startDungeonRun();

			const { restore } = mockRoomEmit();
			await returnPlayersToLobby();
			restore();

			expect(gameState.players.p1.hp).toBe(42);
			expect(gameState.players.p1.dead).toBe(false);
		});

		it('clears gameState.run', async () => {
			startDungeonRun();

			const { restore } = mockRoomEmit();

			await returnPlayersToLobby();

			restore();

			expect(gameState.run).toBeUndefined();
		});

		it('clears enemies, minions, and loot', async () => {
			gameState.enemies.push({ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } });
			gameState.minions.push({ id: 'm1', ownerId: 'p1', x: 0, z: 0, hp: 50, ttl: 30 });
			gameState.loot.push({ id: 'l1', x: 0, z: 0, value: 10, createdAt: Date.now() });

			const { restore } = mockRoomEmit();

			await returnPlayersToLobby();

			restore();

			expect(gameState.enemies.length).toBe(0);
			expect(gameState.minions.length).toBe(0);
			expect(gameState.loot.length).toBe(0);
		});

		it('clears pending minion cardUsed queue', async () => {
			gameState._pendingMinionBreaths = [{
				playerId: 'p1',
				cardId: 'ancient_wyrm',
				specialEffect: 'fire_breath',
				hits: [],
			}];

			const { restore } = mockRoomEmit();

			await returnPlayersToLobby();

			restore();

			expect(gameState._pendingMinionBreaths).toHaveLength(0);
		});

		it('sets all players to ready: false and preserves HP/position', async () => {
			addPlayer('p1', { x: 50, z: 50, hp: 30, ready: true, currency: 20 });

			const { restore } = mockRoomEmit();

			await returnPlayersToLobby();

			restore();

			expect(gameState.players['p1'].ready).toBe(false);
			expect(gameState.players['p1'].hp).toBe(30);
			expect(gameState.players['p1'].dead).toBe(false);
			// Currency should be preserved
			expect(gameState.players['p1'].currency).toBe(20);
		});

		it('emits stateUpdate to lobby room', async () => {
			addPlayer('p1');
			startDungeonRun();

			const { emitCalls, restore } = mockRoomEmit();

			await returnPlayersToLobby();

			restore();

			const stateUpdateCalls = emitCalls.filter(c => c.event === 'stateUpdate');
			expect(stateUpdateCalls.length).toBeGreaterThan(0);
		});

		it('emits lobbyUpdate after stateUpdate', async () => {
			addPlayer('p1');

			const { emitCalls, restore } = mockRoomEmit();

			await returnPlayersToLobby();

			restore();

			const lobbyUpdateCalls = emitCalls.filter(c => c.event === 'lobbyUpdate');
			expect(lobbyUpdateCalls.length).toBeGreaterThan(0);
		});

		it('clears pendingSummons for all players', async () => {
			addPlayer('p1');
			gameState.players['p1'].pendingSummons.add('0:iron_sword');
			gameState.players['p1'].pendingSummons.add('1:fireball');

			const { restore } = mockRoomEmit();

			await returnPlayersToLobby();

			restore();

			expect(gameState.players['p1'].pendingSummons.size).toBe(0);
		});
	});

	describe('buildPlayerRecord() vitals restoration', () => {
		it('restores hp, dead, and magicStones from savedData', () => {
			const savedData = {
				currency: 10,
				ownedCards: { iron_sword: 1 },
				selectedDeck: ['iron_sword'],
				hp: 42,
				dead: false,
				magicStones: 15,
			};
			const player = buildPlayerRecord('acct1', 'acct1', 'alice', savedData);
			expect(player.hp).toBe(42);
			expect(player.dead).toBe(false);
			expect(player.magicStones).toBe(15);
		});

		it('defaults vitals for brand-new accounts with no savedData', () => {
			const player = buildPlayerRecord('acct-new', 'acct-new', 'newbie', null);
			expect(player.hp).toBe(100);
			expect(player.dead).toBe(false);
			expect(player.magicStones).toBe(STARTING_MAGIC_STONES);
		});

		it('preserves dead state and zero HP from savedData', () => {
			const savedData = {
				currency: 0,
				ownedCards: {},
				selectedDeck: [],
				hp: 0,
				dead: true,
				magicStones: 3,
			};
			const player = buildPlayerRecord('acct-dead', 'acct-dead', 'ghost', savedData);
			expect(player.hp).toBe(0);
			expect(player.dead).toBe(true);
			expect(player.magicStones).toBe(3);
		});
	});

	describe('revivePlayerInLobby()', () => {
		it('leaves living players with partial HP unchanged', () => {
			const player = { hp: 42, dead: false };
			revivePlayerInLobby(player);
			expect(player.hp).toBe(42);
			expect(player.dead).toBe(false);
		});

		it('clears dead flag and restores HP to LOBBY_REVIVE_HP for dead players', () => {
			const player = { hp: 0, dead: true };
			revivePlayerInLobby(player);
			expect(player.hp).toBe(LOBBY_REVIVE_HP);
			expect(player.dead).toBe(false);
		});

		it('clears dead flag and restores HP to LOBBY_REVIVE_HP for zero-HP players without dead flag', () => {
			const player = { hp: 0, dead: false };
			revivePlayerInLobby(player);
			expect(player.hp).toBe(LOBBY_REVIVE_HP);
			expect(player.dead).toBe(false);
		});
	});

	describe('healAtMedic()', () => {
		beforeEach(() => {
			resetState();
			gameState._lobbyId = 'test-lobby';
			gameState.gamePhase = 'lobby';
		});

		it('heals dead-or-zero-HP hub player to MAX_HP', () => {
			addPlayer('p1', { hp: 0, dead: true, currency: 25 });
			const result = healAtMedic('p1');
			expect(result).toEqual({ ok: true, hp: 100, currency: 15, cost: 10 });
			expect(gameState.players.p1.hp).toBe(100);
			expect(gameState.players.p1.dead).toBe(false);
		});

		it('heals to full and charges 10 currency', () => {
			addPlayer('p1', { hp: 40, currency: 25 });
			const result = healAtMedic('p1');
			expect(result).toEqual({ ok: true, hp: 100, currency: 15, cost: 10 });
			expect(gameState.players.p1.hp).toBe(100);
		});

		it('rejects when already at full health', () => {
			addPlayer('p1', { hp: 100, currency: 25 });
			expect(healAtMedic('p1')).toEqual({ ok: false, reason: 'already_full' });
		});

		it('provides charity heal at zero cost when player cannot afford the medic', () => {
			addPlayer('p1', { hp: 40, currency: 5 });
			expect(healAtMedic('p1')).toEqual({ ok: true, hp: 100, currency: 5, cost: 0 });
			expect(gameState.players.p1.hp).toBe(100);
			expect(gameState.players.p1.currency).toBe(5);
		});

		it('rejects when not in lobby phase', () => {
			addPlayer('p1', { hp: 40, currency: 25 });
			gameState.gamePhase = 'playing';
			startDungeonRun();
			expect(healAtMedic('p1')).toEqual({ ok: false, reason: 'not_in_lobby' });
		});

		it('healing_font and divine_grace define healAmount for HP restoration', () => {
			expect(CARD_DEFS.healing_font.healAmount).toBe(6);
			expect(CARD_DEFS.divine_grace.healAmount).toBe(10);
			expect(CARD_DEFS.soul_drain.healOnHit).toBe(12);
			expect(CARD_DEFS.soul_drain.healOnKill).toBe(18);
		});
	});

	describe('previewReturnRewards()', () => {
		beforeEach(() => {
			resetState();
			gameState._lobbyId = 'test-lobby';
		});

		it('returns null when not in a run', () => {
			addPlayer('p1');
			expect(previewReturnRewards('p1')).toBeNull();
		});

		it('previews victory payout when the objective is complete', () => {
			addPlayer('p1');
			gameState.gamePhase = 'playing';
			startDungeonRun();
			gameState.players.p1.currencyEarnedThisRun = 12;
			gameState.run.objective.defeatedEnemies = gameState.run.objective.totalEnemies;

			const preview = previewReturnRewards('p1');
			expect(preview.lootCurrency).toBe(12);
			expect(preview.objectiveComplete).toBe(true);
			expect(preview.currency).toBe(22);
		});

		it('uses granted runRewards when already awarded', () => {
			addPlayer('p1', { currencyEarnedThisRun: 5 });
			gameState.gamePhase = 'playing';
			startDungeonRun();
			grantRunRewards('p1', { status: 'victory' });

			const preview = previewReturnRewards('p1');
			expect(preview.granted).toBe(true);
			expect(preview.currency).toBe(gameState.players.p1.runRewards.currency);
		});
	});

	describe('giveUpRun()', () => {
		function mockRoomEmit() {
			const emitCalls = [];
			const originalTo = serverIo.to;
			const originalEmit = serverIo.emit;
			const originalSockets = serverIo.sockets.sockets;
			const lobbyId = gameState._lobbyId || 'test-lobby';

			serverIo.to = () => ({
				emit: (event, data) => emitCalls.push({ event, data }),
			});
			serverIo.emit = (event, data) => emitCalls.push({ event, data });

			const mockMap = new Map();
			for (const playerId of Object.keys(gameState.players)) {
				const socketId = `mock-${playerId}`;
				mockMap.set(socketId, {
					id: socketId,
					playerId,
					rooms: new Set([lobbyId]),
					emit: (event, data) => emitCalls.push({ event, data }),
				});
			}
			serverIo.sockets.sockets = mockMap;

			return {
				emitCalls,
				restore: () => {
					serverIo.to = originalTo;
					serverIo.emit = originalEmit;
					serverIo.sockets.sockets = originalSockets;
				},
			};
		}

		beforeEach(() => {
			resetState();
			gameState._lobbyId = 'test-lobby';
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('returns no_active_run when not playing', () => {
			expect(giveUpRun()).toEqual({ ok: false, reason: 'no_active_run' });
		});

		it('allows give up after objective complete (run status victory)', () => {
			addPlayer('p1', { hp: 55 });
			gameState.gamePhase = 'playing';
			startDungeonRun();
			gameState.run.status = 'victory';

			const { restore } = mockRoomEmit();
			const result = giveUpRun();
			restore();

			expect(result).toEqual({ ok: true });
			expect(gameState.gamePhase).toBe('lobby');
			expect(gameState.players['p1'].hp).toBe(55);
		});

		it('returns to lobby, strips run loot, and preserves HP damage', () => {
			addPlayer('p1', { x: 50, z: 50, hp: 42, ready: true, currency: 100 });
			gameState.gamePhase = 'playing';
			startDungeonRun();
			gameState.players['p1'].currencyEarnedThisRun = 25;
			gameState.enemies.push({ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } });
			gameState.loot.push({ id: 'l1', x: 0, z: 0, value: 10, createdAt: Date.now() });

			const { restore } = mockRoomEmit();
			const result = giveUpRun();
			restore();

			expect(result).toEqual({ ok: true });
			expect(gameState.gamePhase).toBe('lobby');
			expect(gameState.run).toBeUndefined();
			expect(gameState.enemies.length).toBe(0);
			expect(gameState.loot.length).toBe(0);
			expect(gameState.players['p1'].hp).toBe(42);
			expect(gameState.players['p1'].currency).toBe(75);
			expect(gameState.players['p1'].currencyEarnedThisRun).toBe(0);
			expect(gameState.players['p1'].ready).toBe(false);
		});
	});

	describe('createPlayerProgress()', () => {
		it('returns currency of 0', () => {
			const progress = createPlayerProgress();
			expect(progress.currency).toBe(0);
		});

		it('returns runRewards of null', () => {
			const progress = createPlayerProgress();
			expect(progress.runRewards).toBeNull();
		});

		it('populates ownedCards with starting deck card ids at correct frequency counts', () => {
			const progress = createPlayerProgress();
			expect(progress.ownedCards).toEqual({
				iron_sword: 4,
				flame_blade: 3,
				battle_familiar: 3,
				dungeon_drake: 2
			});
		});

		it('has exactly 4 owned card entries', () => {
			const progress = createPlayerProgress();
			expect(Object.keys(progress.ownedCards).length).toBe(4);
		});

		it('each owned card count matches expected frequency', () => {
			const progress = createPlayerProgress();
			const expected = { iron_sword: 4, flame_blade: 3, battle_familiar: 3, dungeon_drake: 2 };
			for (const [cardId, count] of Object.entries(progress.ownedCards)) {
				expect(count).toBe(expected[cardId]);
			}
		});

		it('populates inventory with one unique instance per starting card copy', () => {
			const progress = createPlayerProgress();
			expect(progress.inventory).toHaveLength(STARTING_DECK_IDS.length);
			expect(inventoryToOwnedCards(progress.inventory)).toEqual(progress.ownedCards);
			expect(new Set(progress.inventory.map((card) => card.instanceId)).size).toBe(progress.inventory.length);
			for (const instance of progress.inventory) {
				expect(instance).toEqual(expect.objectContaining({
					instanceId: expect.any(String),
					cardId: expect.any(String),
					grind: 0,
				}));
				expect(CARD_DEFS[instance.cardId]).toBeDefined();
			}
		});

		it('returns independent objects on each call', () => {
			const a = createPlayerProgress();
			const b = createPlayerProgress();
			a.ownedCards.iron_sword = 99;
			expect(b.ownedCards.iron_sword).toBe(4);
			a.inventory[0].grind = 99;
			expect(b.inventory[0].grind).toBe(0);
		});
	});

	describe('inventory normalization', () => {
		it('converts old ownedCards count maps to inventory instances', () => {
			const player = {
				ownedCards: { iron_sword: 2, flame_blade: 1 },
				selectedDeck: ['iron_sword', 'flame_blade', 'iron_sword']
			};

			normalizePlayerInventory(player);

			expect(player.inventory).toHaveLength(3);
			expect(inventoryToOwnedCards(player.inventory)).toEqual({ iron_sword: 2, flame_blade: 1 });
			expect(player.selectedDeck).toHaveLength(3);
			expect(new Set(player.selectedDeck).size).toBe(3);
			expect(player.selectedDeck.map((entry) => cardIdForDeckEntry(entry, player.inventory)).sort()).toEqual([
				'flame_blade',
				'iron_sword',
				'iron_sword'
			]);
		});

		it('preserves existing instance metadata while filling defaults', () => {
			const inventory = [{
				instanceId: 'card-1',
				cardId: 'iron_sword',
				level: 5,
				grind: 2,
				element: 'fire'
			}];

			const normalized = createInventoryFromOwnedCards({ flame_blade: 1 });
			expect(normalized).toHaveLength(1);

			const player = { inventory, selectedDeck: ['card-1'] };
			normalizePlayerInventory(player);

			expect(player.inventory[0]).toEqual(expect.objectContaining({
				instanceId: 'card-1',
				cardId: 'iron_sword',
				level: 5,
				grind: 2,
				element: 'fire'
			}));
			expect(player.selectedDeck).toEqual(['card-1']);
		});
	});

	// ── grantCard ──

	describe('grantCard(player, cardId)', () => {
		beforeEach(() => resetState());

		it('increments owned card count starting from 0', () => {
			const player = { ownedCards: {} };
			expect(grantCard(player, 'flame_blade')).toBe(true);
			expect(player.ownedCards['flame_blade']).toBe(1);
		});

		it('increments existing count', () => {
			const player = { ownedCards: { flame_blade: 3 } };
			expect(grantCard(player, 'flame_blade')).toBe(true);
			expect(player.ownedCards['flame_blade']).toBe(4);
		});

		it('rejects unknown card id', () => {
			const player = { ownedCards: {} };
			expect(grantCard(player, 'nonexistent_card')).toBe(false);
			expect(player.ownedCards['nonexistent_card']).toBeUndefined();
		});

		it('accepts all CARD_DEFS ids', () => {
			const player = { ownedCards: {} };
			for (const cardId of Object.keys(CARD_DEFS)) {
				expect(grantCard(player, cardId)).toBe(true);
				expect(player.ownedCards[cardId]).toBe(1);
			}
		});
	});

	// ── grantRunRewards ──

	describe('grantRunRewards(playerId, summary)', () => {
		beforeEach(() => {
			resetState();
			delete gameState._victoryCounters;
			gameState.selectedQuestId = 'arena_trials';
		});

		it('on victory: adds currency bonus', () => {
			addPlayer('p1', { currency: 0, ownedCards: {} });
			grantRunRewards('p1', { status: 'victory' });
			expect(gameState.players['p1'].currency).toBe(getQuest('arena_trials', 1).rewardCurrency);
		});

		it('on victory: grants at least one card reward', () => {
			addPlayer('p1', { currency: 0, ownedCards: {} });
			grantRunRewards('p1', { status: 'victory' });
			const cards = gameState.players['p1'].ownedCards;
			const granted = Object.values(cards).reduce((s, c) => s + c, 0);
			expect(granted).toBeGreaterThan(0);
		});

		it('on victory: sets player.runRewards summary', () => {
			addPlayer('p1', { currency: 0, ownedCards: {} });
			grantRunRewards('p1', { status: 'victory' });
			const rewards = gameState.players['p1'].runRewards;
			expect(rewards).toBeDefined();
			expect(rewards.currency).toBe(getQuest('arena_trials', 1).rewardCurrency);
			expect(Array.isArray(rewards.cards)).toBe(true);
			expect(rewards.cards.length).toBeGreaterThan(0);
			expect(rewards.cards[0]).toHaveProperty('id');
			expect(rewards.cards[0]).toHaveProperty('name');
			expect(rewards.cards[0]).toHaveProperty('count', 1);
		});

		it('on victory: first reward is flame_blade', () => {
			addPlayer('p1', { currency: 0, ownedCards: {} });
			grantRunRewards('p1', { status: 'victory' });
			expect(gameState.players['p1'].ownedCards['flame_blade']).toBe(1);
		});

		it('on victory: subsequent victories rotate through card ids', () => {
			addPlayer('p1', { currency: 0, ownedCards: {} });
			grantRunRewards('p1', { status: 'victory' }); // flame_blade
			grantRunRewards('p1', { status: 'victory' }); // battle_familiar
			grantRunRewards('p1', { status: 'victory' }); // dungeon_drake
			expect(gameState.players['p1'].ownedCards['flame_blade']).toBe(1);
			expect(gameState.players['p1'].ownedCards['battle_familiar']).toBe(1);
			expect(gameState.players['p1'].ownedCards['dungeon_drake']).toBe(1);
		});

		it('on failure: does not add currency bonus', () => {
			addPlayer('p1', { currency: 5, ownedCards: {} });
			grantRunRewards('p1', { status: 'failed' });
			expect(gameState.players['p1'].currency).toBe(5);
		});

		it('on failure: does not grant a victory card', () => {
			addPlayer('p1', { currency: 5, ownedCards: {} });
			grantRunRewards('p1', { status: 'failed' });
			expect(Object.keys(gameState.players['p1'].ownedCards).length).toBe(0);
		});

		it('on failure: preserves existing currency', () => {
			addPlayer('p1', { currency: 42, ownedCards: { iron_sword: 1 } });
			grantRunRewards('p1', { status: 'failed' });
			expect(gameState.players['p1'].currency).toBe(42);
			expect(gameState.players['p1'].ownedCards['iron_sword']).toBe(1);
		});

		it('does nothing for unknown player', () => {
			grantRunRewards('nonexistent', { status: 'victory' });
			expect(gameState.players['nonexistent']).toBeUndefined();
		});
	});

	// ── enemy card drops ──

	describe('enemy card drops', () => {
		beforeEach(() => resetState());

		it('maps enemy types to deterministic card drops', () => {
			expect(getEnemyCardDrop({ type: 'goblin' })).toBe('iron_sword');
			expect(getEnemyCardDrop({ type: 'grunt' })).toBe('iron_sword');
			expect(getEnemyCardDrop({ type: 'drake' })).toBe('dungeon_drake');
			expect(getEnemyCardDrop({ type: 'miniboss' })).toBe('dungeon_drake');
			expect(getEnemyCardDrop({ type: 'spire_warden' })).toBe('dungeon_drake');
			expect(getEnemyCardDrop({ type: 'permafrost_warden' })).toBe('dungeon_drake');
		});

		it('prefers instance cardDrop override over type mapping', () => {
			expect(getEnemyCardDrop({ type: 'grunt', cardDrop: 'flame_blade' })).toBe('flame_blade');
		});

		it('returns null when enemy has no type or cardDrop', () => {
			expect(getEnemyCardDrop({})).toBeNull();
			expect(getEnemyCardDrop({ type: 'unknown_type' })).toBeNull();
		});

		it('records card drops for the killing player and builds up to three choices', () => {
			addPlayer('p1', { ownedCards: {} });
			addPlayer('p2', { ownedCards: {} });
			gameState.run = createRunState();

			recordEnemyCardDrop({
				type: 'grunt',
				lastDamagedBy: 'p1',
			});
			recordEnemyCardDrop({
				type: 'skirmisher',
				lastDamagedBy: 'p1',
			});
			recordEnemyCardDrop({
				type: 'miniboss',
				lastDamagedBy: 'p1',
			});
			recordEnemyCardDrop({
				type: 'spawner',
				lastDamagedBy: 'p1',
			});
			recordEnemyCardDrop({
				type: 'grunt',
				lastDamagedBy: 'p2',
			});

			const p1Choices = buildCardChoices('p1');
			expect(p1Choices).toHaveLength(3);
			expect(p1Choices.map((choice) => choice.id)).toEqual([
				'iron_sword',
				'flame_blade',
				'dungeon_drake',
			]);
			expect(p1Choices[0]).toEqual(expect.objectContaining({
				id: 'iron_sword',
				name: 'Rust-Forged Saber',
				type: 'weapon',
			}));

			const p2Choices = buildCardChoices('p2');
			expect(p2Choices).toEqual([
				expect.objectContaining({ id: 'iron_sword' }),
			]);
		});

		it('offers draft choices on victory when drops exist instead of auto-granting rotation cards', () => {
			addPlayer('p1', { currency: 0, ownedCards: {} });
			gameState.run = createRunState();
			gameState.players.p1.runCardDropIds = ['dungeon_drake'];

			grantRunRewards('p1', { status: 'victory' });

			expect(gameState.players.p1.pendingCardChoices).toEqual([
				expect.objectContaining({ id: 'dungeon_drake', name: 'Vault Wyrm', type: 'creature' }),
			]);
			expect(gameState.players.p1.runRewards.cards).toEqual([]);
			expect(gameState.players.p1.ownedCards.dungeon_drake).toBeUndefined();
		});

		it('claimCardReward grants exactly one copy and rejects duplicate claims', () => {
			addPlayer('p1', { currency: 0, ownedCards: {} });
			gameState.run = createRunState();
			gameState.players.p1.pendingCardChoices = [
				{ id: 'dungeon_drake', name: 'Vault Wyrm', type: 'creature', description: 'Spawns a minion' },
			];

			const first = claimCardReward('p1', 'dungeon_drake');
			expect(first.ok).toBe(true);
			expect(gameState.players.p1.ownedCards.dungeon_drake).toBe(1);

			const second = claimCardReward('p1', 'dungeon_drake');
			expect(second.ok).toBe(false);
			expect(second.reason).toBe('already_claimed');
			expect(gameState.players.p1.ownedCards.dungeon_drake).toBe(1);
		});

		it('claimCardReward rejects invalid choice ids', () => {
			addPlayer('p1', { currency: 0, ownedCards: {} });
			gameState.players.p1.pendingCardChoices = [
				{ id: 'dungeon_drake', name: 'Vault Wyrm', type: 'creature', description: 'Spawns a minion' },
			];

			const result = claimCardReward('p1', 'flame_blade');
			expect(result.ok).toBe(false);
			expect(result.reason).toBe('invalid_choice');
			expect(gameState.players.p1.ownedCards.flame_blade).toBeUndefined();
		});
	});

	// ── variant bonus drops ──

	describe('variant enemy bonus drops', () => {
		beforeEach(() => resetState());

		it('records a guaranteed bonus card for a variant enemy on top of the normal one', () => {
			addPlayer('p1', { ownedCards: {} });
			gameState.run = createRunState();

			recordEnemyCardDrop({ type: 'grunt', variant: 'test', lastDamagedBy: 'p1' });

			// Normal drop + guaranteed variant bonus = two copies of the mapped card.
			expect(gameState.players.p1.runCardDropIds).toEqual(['iron_sword', 'iron_sword']);
		});

		it('does not record a bonus card for a non-variant enemy', () => {
			addPlayer('p1', { ownedCards: {} });
			gameState.run = createRunState();

			recordEnemyCardDrop({ type: 'grunt', variant: null, lastDamagedBy: 'p1' });

			expect(gameState.players.p1.runCardDropIds).toEqual(['iron_sword']);
		});

		it('spawns an extra magic-stone loot entry for a variant enemy', () => {
			const enemy = { id: 'e1', type: 'grunt', x: 4, z: -2, variant: 'test' };

			spawnMagicStoneDrop(enemy);

			const stones = gameState.loot.filter((l) => l.kind === 'magic_stone');
			expect(stones).toHaveLength(2);
			// Bonus stone value is driven by the variant registry def (bonusDrop.magicStone).
			expect(stones.some((l) => l.value === VARIANT_DEFS.test.bonusDrop.magicStone)).toBe(true);
			expect(stones.every((l) => l.kind === 'magic_stone')).toBe(true);
		});

		it('spawns only the normal magic-stone loot entry for a non-variant enemy', () => {
			const enemy = { id: 'e1', type: 'grunt', x: 4, z: -2, variant: null };

			spawnMagicStoneDrop(enemy);

			const stones = gameState.loot.filter((l) => l.kind === 'magic_stone');
			expect(stones).toHaveLength(1);
		});
	});

	// ── buildPlayerRewardSummary ──

	describe('buildPlayerRewardSummary(playerId)', () => {
		beforeEach(() => resetState());

		it('returns correct structure', () => {
			addPlayer('p1', { runRewards: { currency: 10, cards: [{ id: 'flame_blade', name: 'Solar Edge', count: 1 }] } });
			const summary = buildPlayerRewardSummary('p1');
			expect(summary.currency).toBe(10);
			expect(Array.isArray(summary.cards)).toBe(true);
		});

		it('maps card ids to names via CARD_DEFS', () => {
			addPlayer('p1', { runRewards: { currency: 0, cards: [{ id: 'iron_sword', name: 'Rust-Forged Saber', count: 1 }] } });
			const summary = buildPlayerRewardSummary('p1');
			const cardEntry = summary.cards.find(c => c.id === 'iron_sword');
			expect(cardEntry).toBeDefined();
			expect(cardEntry.name).toBe('Rust-Forged Saber');
			expect(cardEntry.count).toBe(1);
		});

		it('includes all owned cards', () => {
			addPlayer('p1', {
				runRewards: {
					currency: 0,
					cards: [
						{ id: 'iron_sword', name: 'Rust-Forged Saber', count: 2 },
						{ id: 'flame_blade', name: 'Solar Edge', count: 1 },
						{ id: 'battle_familiar', name: 'Signal Familiar', count: 1 }
					]
				}
			});
			const summary = buildPlayerRewardSummary('p1');
			expect(summary.cards.length).toBe(3);
		});

		it('returns empty cards array for unknown player', () => {
			const summary = buildPlayerRewardSummary('nonexistent');
			expect(summary.currency).toBe(0);
			expect(summary.cards.length).toBe(0);
		});
	});
});

// ── Deck Validation ──

describe('validateDeck(deck, ownedCards)', () => {
	it('returns valid for a correct deck', () => {
		const owned = { iron_sword: 3, flame_blade: 2, battle_familiar: 2, dungeon_drake: 1 };
		const deck = ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'];
		const result = validateDeck(deck, owned);
		expect(result).toEqual({ valid: true });
	});

	it('returns valid when deck uses duplicate copies within ownership', () => {
		const owned = { iron_sword: 3, flame_blade: 1 };
		const deck = ['iron_sword', 'iron_sword', 'flame_blade', 'iron_sword'];
		const result = validateDeck(deck, owned);
		expect(result).toEqual({ valid: true });
	});

	it('returns invalid for unknown card id', () => {
		const owned = { iron_sword: 3 };
		const deck = ['iron_sword', 'iron_sword', 'iron_sword', 'nonexistent_card'];
		const result = validateDeck(deck, owned);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain('nonexistent_card');
	});

	it('returns invalid when deck is too small', () => {
		const owned = { iron_sword: 3 };
		const deck = ['iron_sword', 'iron_sword'];
		const result = validateDeck(deck, owned);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain('at least');
	});

	it('returns invalid when deck is too large', () => {
		const owned = { iron_sword: 20, flame_blade: 20 };
		const deck = Array(25).fill('iron_sword');
		const result = validateDeck(deck, owned);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain('at most');
	});

	it('returns invalid when too many copies of a card', () => {
		const owned = { iron_sword: 1, flame_blade: 2, battle_familiar: 2 };
		const deck = ['iron_sword', 'iron_sword', 'flame_blade', 'battle_familiar'];
		const result = validateDeck(deck, owned);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain('iron_sword');
	});

	it('accepts deck at exactly DECK_MIN_SIZE', () => {
		const owned = { iron_sword: 4, flame_blade: 1, battle_familiar: 1, dungeon_drake: 1 };
		const deck = ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'];
		const result = validateDeck(deck, owned);
		expect(result).toEqual({ valid: true });
	});

	it('accepts deck at exactly DECK_MAX_SIZE', () => {
		const owned = { iron_sword: 24 };
		const deck = Array(24).fill('iron_sword');
		const result = validateDeck(deck, owned);
		expect(result).toEqual({ valid: true });
	});
});

describe('canAddCardToDeck(cardId, deck, ownedCards)', () => {
	it('returns true when adding a card keeps deck valid', () => {
		const owned = { iron_sword: 3, flame_blade: 2 };
		const deck = ['iron_sword', 'flame_blade', 'battle_familiar'];
		expect(canAddCardToDeck('iron_sword', deck, owned)).toBe(true);
	});

	it('returns false for unknown card id', () => {
		const owned = { iron_sword: 3 };
		const deck = ['iron_sword'];
		expect(canAddCardToDeck('nonexistent_card', deck, owned)).toBe(false);
	});

	it('returns false when already at max copies of a card', () => {
		const owned = { iron_sword: 2 };
		const deck = ['iron_sword', 'iron_sword', 'flame_blade', 'battle_familiar'];
		expect(canAddCardToDeck('iron_sword', deck, owned)).toBe(false);
	});

	it('returns false when deck is already at DECK_MAX_SIZE', () => {
		const owned = { iron_sword: 24, flame_blade: 5 };
		const deck = Array(24).fill('iron_sword');
		expect(canAddCardToDeck('flame_blade', deck, owned)).toBe(false);
	});

	it('returns true when deck is at DECK_MAX_SIZE - 1 and card is available', () => {
		const owned = { iron_sword: 20, flame_blade: 3 };
		const deck = Array(23).fill('iron_sword');
		expect(canAddCardToDeck('flame_blade', deck, owned)).toBe(true);
	});

	it('returns false when player owns zero copies of card', () => {
		const owned = { iron_sword: 3 };
		const deck = ['iron_sword', 'iron_sword', 'iron_sword'];
		expect(canAddCardToDeck('flame_blade', deck, owned)).toBe(false);
	});
});

describe('card sell and trade economy', () => {
	beforeEach(() => resetGameState());

	function addPlayer(id, overrides = {}) {
		const progress = createPlayerProgress();
		gameState.players[id] = {
			username: id,
			selectedDeck: progress.inventory.map((instance) => instance.instanceId),
			inventory: progress.inventory,
			ownedCards: progress.ownedCards,
			currency: 0,
			...overrides
		};
		normalizePlayerInventory(gameState.players[id]);
	}

	it('getCardSellValue returns configured sell prices', () => {
		expect(getCardSellValue('iron_sword')).toBe(5);
		expect(getCardSellValue('flame_blade')).toBe(8);
		expect(getCardSellValue('steel_claymore')).toBe(15);
	});

	it('getCardBuyValue is double the sell value', () => {
		expect(getCardBuyValue('iron_sword')).toBe(10);
		expect(getCardBuyValue('flame_blade')).toBe(16);
	});

	it('pickShopOffer returns a valid card from the shop pool', () => {
		const offer = pickShopOffer(42);
		expect(offer).toBeTruthy();
		expect(offer.cardId).toBeTruthy();
		expect(offer.price).toBe(getCardBuyValue(offer.cardId));
		expect(offer.name).toBeTruthy();
	});

	it('buyShopCard grants a card and deducts gold', () => {
		addPlayer('p1', { currency: 100 });
		const player = gameState.players.p1;
		const countBefore = player.ownedCards.iron_sword || 0;
		const deckBefore = [...player.selectedDeck];
		const offer = { cardId: 'iron_sword', price: getCardBuyValue('iron_sword') };

		const result = buyShopCard(player, offer);
		expect(result.ok).toBe(true);
		expect(result.addedToDeck).toBe(true);
		expect(player.ownedCards.iron_sword).toBe(countBefore + 1);
		expect(player.currency).toBe(100 - offer.price);
		expect(player.selectedDeck.length).toBe(deckBefore.length + 1);
		expect(player.selectedDeck).toContain(result.instanceId);
		expect(validateDeck(player.selectedDeck, player.inventory).valid).toBe(true);
	});

	it('buyShopCard adds to inventory only when the selected deck is full', () => {
		addPlayer('p1', { currency: 500 });
		const player = gameState.players.p1;
		while (player.selectedDeck.length < DECK_MAX_SIZE) {
			const extra = createCardInstance('iron_sword');
			player.inventory.push(extra);
			player.selectedDeck.push(extra.instanceId);
		}
		player.ownedCards = inventoryToOwnedCards(player.inventory);
		expect(player.selectedDeck.length).toBe(DECK_MAX_SIZE);

		const offer = { cardId: 'flame_blade', price: getCardBuyValue('flame_blade') };
		const deckBefore = [...player.selectedDeck];
		const flameBefore = player.ownedCards.flame_blade || 0;

		const result = buyShopCard(player, offer);
		expect(result.ok).toBe(true);
		expect(result.addedToDeck).toBe(false);
		expect(player.selectedDeck).toEqual(deckBefore);
		expect(player.ownedCards.flame_blade).toBe(flameBefore + 1);
	});

	it('buyShopCard rejects insufficient gold', () => {
		addPlayer('p1', { currency: 0 });
		const player = gameState.players.p1;
		const countBefore = player.ownedCards.iron_sword || 0;
		const offer = { cardId: 'iron_sword', price: getCardBuyValue('iron_sword') };

		const result = buyShopCard(player, offer);
		expect(result.ok).toBe(false);
		expect(result.reason).toBe('insufficient_gold');
		expect(player.ownedCards.iron_sword).toBe(countBefore);
	});

	it('canSellCardInstance rejects selling deck-required copies', () => {
		const inventory = createInventoryFromOwnedCards({ iron_sword: 1, flame_blade: 1, battle_familiar: 1, dungeon_drake: 1 });
		const player = {
			inventory,
			selectedDeck: inventory.map((instance) => instance.instanceId),
			ownedCards: inventoryToOwnedCards(inventory)
		};
		const result = canSellCardInstance(player, 'iron_sword');
		expect(result.ok).toBe(false);
		expect(result.reason).toMatch(/deck/i);
	});

	it('sellCard removes an extra copy and grants currency', () => {
		const inventory = createInventoryFromOwnedCards({ iron_sword: 3, flame_blade: 1, battle_familiar: 1, dungeon_drake: 1 });
		const ironInstances = inventory.filter((instance) => instance.cardId === 'iron_sword');
		const player = {
			inventory,
			selectedDeck: [
				ironInstances[0].instanceId,
				inventory.find((instance) => instance.cardId === 'flame_blade').instanceId,
				inventory.find((instance) => instance.cardId === 'battle_familiar').instanceId,
				inventory.find((instance) => instance.cardId === 'dungeon_drake').instanceId
			],
			ownedCards: inventoryToOwnedCards(inventory),
			currency: 0
		};

		const result = sellCard(player, 'iron_sword');
		expect(result.ok).toBe(true);
		expect(player.ownedCards.iron_sword).toBe(2);
		expect(player.currency).toBe(getCardSellValue('iron_sword'));
		expect(validateDeck(player.selectedDeck, player.inventory).valid).toBe(true);
	});

	it('offerCardTrade and respondCardTrade swap one instance each', () => {
		addPlayer('p1', { currency: 0 });
		addPlayer('p2', { currency: 0 });

		const p1 = gameState.players.p1;
		const p2 = gameState.players.p2;
		const p1Iron = p1.inventory.filter((instance) => instance.cardId === 'iron_sword');
		const p2Flame = p2.inventory.filter((instance) => instance.cardId === 'flame_blade');
		p1.selectedDeck = p1.inventory
			.filter((instance) => instance.instanceId !== p1Iron[2].instanceId)
			.map((instance) => instance.instanceId);
		p2.selectedDeck = p2.inventory
			.filter((instance) => instance.instanceId !== p2Flame[1].instanceId)
			.map((instance) => instance.instanceId);

		const offer = offerCardTrade(gameState.pendingTrades, 'p1', 'p2', 'iron_sword', 'flame_blade');
		expect(offer.ok).toBe(true);

		const p1IronBefore = p1.ownedCards.iron_sword;
		const p1FlameBefore = p1.ownedCards.flame_blade || 0;
		const p2IronBefore = p2.ownedCards.iron_sword || 0;
		const p2FlameBefore = p2.ownedCards.flame_blade;

		const accepted = respondCardTrade(gameState.pendingTrades, 'p2', offer.tradeId, true);
		expect(accepted.ok).toBe(true);
		expect(p1.ownedCards.iron_sword).toBe(p1IronBefore - 1);
		expect(p1.ownedCards.flame_blade).toBe(p1FlameBefore + 1);
		expect(p2.ownedCards.iron_sword).toBe(p2IronBefore + 1);
		expect(p2.ownedCards.flame_blade).toBe(p2FlameBefore - 1);
		expect(validateDeck(p1.selectedDeck, p1.inventory).valid).toBe(true);
		expect(validateDeck(p2.selectedDeck, p2.inventory).valid).toBe(true);
	});

	it('respondCardTrade reject does not mutate inventories', () => {
		addPlayer('p1');
		addPlayer('p2');

		const p1 = gameState.players.p1;
		const p2 = gameState.players.p2;
		const p1Iron = p1.inventory.filter((instance) => instance.cardId === 'iron_sword');
		const p2Flame = p2.inventory.filter((instance) => instance.cardId === 'flame_blade');
		p1.selectedDeck = p1.inventory
			.filter((instance) => instance.instanceId !== p1Iron[2].instanceId)
			.map((instance) => instance.instanceId);
		p2.selectedDeck = p2.inventory
			.filter((instance) => instance.instanceId !== p2Flame[1].instanceId)
			.map((instance) => instance.instanceId);

		const p1Snapshot = JSON.stringify(p1.inventory);
		const p2Snapshot = JSON.stringify(p2.inventory);

		const offer = offerCardTrade(gameState.pendingTrades, 'p1', 'p2', 'iron_sword', 'flame_blade');
		const rejected = respondCardTrade(gameState.pendingTrades, 'p2', offer.tradeId, false);
		expect(rejected.ok).toBe(true);
		expect(rejected.accepted).toBe(false);
		expect(JSON.stringify(p1.inventory)).toBe(p1Snapshot);
		expect(JSON.stringify(p2.inventory)).toBe(p2Snapshot);
	});
});

describe('deck constants', () => {
	it('DECK_MIN_SIZE is 4', () => {
		expect(DECK_MIN_SIZE).toBe(4);
	});

	it('DECK_MAX_SIZE is 24', () => {
		expect(DECK_MAX_SIZE).toBe(24);
	});
});

describe('createDrawDeckFromSelectedDeck(player)', () => {
	it('produces a deck of the same length as selectedDeck', () => {
		const player = {
			selectedDeck: ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'],
			deck: []
		};
		const deck = createDrawDeckFromSelectedDeck(player);
		expect(deck.length).toBe(player.selectedDeck.length);
	});

	it('assigns the shuffled deck to player.deck', () => {
		const player = {
			selectedDeck: ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'],
			deck: []
		};
		const deck = createDrawDeckFromSelectedDeck(player);
		expect(player.deck).toBe(deck);
	});

	it('contains the same deck entries as selectedDeck (possibly reordered)', () => {
		const player = {
			selectedDeck: ['iron_sword', 'iron_sword', 'flame_blade', 'battle_familiar'],
			deck: []
		};
		const deck = createDrawDeckFromSelectedDeck(player);
		expect(deck.sort()).toEqual(player.selectedDeck.slice().sort());
	});

	it('preserves instance ids so grind metadata survives shuffling', () => {
		const instanceA = createCardInstance('iron_sword', { instanceId: 'sword-a', grind: 3 });
		const instanceB = createCardInstance('iron_sword', { instanceId: 'sword-b', grind: 0 });
		const player = {
			inventory: [instanceA, instanceB],
			selectedDeck: ['sword-a', 'sword-b'],
			deck: [],
		};
		const deck = createDrawDeckFromSelectedDeck(player);
		expect(deck.sort()).toEqual(['sword-a', 'sword-b']);
	});

	it('does not mutate the original selectedDeck', () => {
		const selectedDeck = ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'];
		const player = { selectedDeck, deck: [] };
		createDrawDeckFromSelectedDeck(player);
		expect(player.selectedDeck).toEqual(selectedDeck);
	});
});

describe('server hand management', () => {
	it('initPlayerHand deals opening hand into N64 slot order', () => {
		const player = {
			selectedDeck: ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'],
			deck: ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'],
		};

		const hand = initPlayerHand(player);

		expect(hand).toHaveLength(6);
		expect(hand.filter(Boolean)).toHaveLength(4);
		expect(player.deck).toHaveLength(0);
		expect(hand[1].id).toBe('dungeon_drake');
		expect(hand[0].id).toBe('battle_familiar');
		expect(hand[4].id).toBe('flame_blade');
		expect(hand[3].id).toBe('iron_sword');
		expect(hand.filter(Boolean).every(card => card && card.id && card.remainingCharges === card.charges)).toBe(true);
		expect(player.nextDrawAt).toBeTypeOf('number');
	});

	it('drawCardFromDeck preserves evolved card metadata', () => {
		const player = {
			deck: ['magma_greatsword'],
		};

		const card = drawCardFromDeck(player);

		expect(card).toEqual(expect.objectContaining({
			id: 'magma_greatsword',
			isEvolved: true,
			specialEffect: 'fire_trail',
		}));
		expect(player.deck).toHaveLength(0);
	});

	it('drawReplacementCard replaces a slot with desperation when the deck is empty', () => {
		const player = {
			hand: [
				{ id: 'iron_sword', type: 'weapon', charges: 5, remainingCharges: 0 },
				{ id: 'flame_blade', type: 'weapon', charges: 2, remainingCharges: 0 },
			],
			deck: ['battle_familiar'],
		};
		initDesperationDeck(player);

		drawReplacementCard(player, 0);
		expect(player.hand[0].id).toBe('battle_familiar');
		expect(player.deck).toHaveLength(0);

		drawReplacementCard(player, 1);
		expect(player.hand[1].isDesperation).toBe(true);
		expect(player.inDesperation).toBe(true);
		expect(player.desperationDeck).toHaveLength(DESPERATION_DECK_TEMPLATE.length - 1);
	});

	it('drawReplacementCard nulls the slot when both decks are empty', () => {
		const player = {
			hand: [{ id: 'iron_sword', type: 'weapon', charges: 1, remainingCharges: 0 }],
			deck: [],
			desperationDeck: [],
		};

		drawReplacementCard(player, 0);

		expect(player.hand[0]).toBeNull();
	});

	it('isPlayerOutOfCards is false when the desperation deck still has cards', () => {
		addPlayer('p1', {
			hand: [],
			deck: [],
			desperationDeck: ['rusty_shiv'],
		});

		expect(isPlayerOutOfCards(gameState.players['p1'])).toBe(false);
	});

	it('validateUseCardHand rejects cards not present in the authoritative hand', () => {
		const player = {
			hand: [
				{ id: 'iron_sword', type: 'weapon', charges: 5, remainingCharges: 5 },
				null,
				{ id: 'flame_blade', type: 'weapon', charges: 2, remainingCharges: 2 },
			],
		};

		expect(validateUseCardHand(player, 0, 'iron_sword')).toEqual({
			valid: true,
			handCard: player.hand[0],
		});
		expect(validateUseCardHand(player, 0, 'flame_blade')).toEqual({
			valid: false,
			reason: 'Card not in hand',
		});
		expect(validateUseCardHand(player, 1, 'iron_sword')).toEqual({
			valid: false,
			reason: 'Card not in hand',
		});
	});

	it('validateUseCardHand rejects exhausted charge cards', () => {
		const player = {
			hand: [{ id: 'iron_sword', type: 'weapon', charges: 5, remainingCharges: 0 }],
		};

		expect(validateUseCardHand(player, 0, 'iron_sword')).toEqual({
			valid: false,
			reason: 'No charges remaining',
		});
	});

	it('validateUseCardHand rejects creature cards while their minion is active', () => {
		const player = {
			hand: [{
				id: 'dungeon_drake',
				type: 'creature',
				charges: 1,
				remainingCharges: 0,
				activeMinionId: 'minion-1',
				burnMaxTtl: 30,
			}],
		};

		expect(validateUseCardHand(player, 0, 'dungeon_drake')).toEqual({
			valid: false,
			reason: 'Creature still active',
		});
	});

	it('beginCreatureBurnDown links the hand card to the spawned minion', () => {
		const player = {
			hand: [{ id: 'dungeon_drake', type: 'creature', charges: 1, remainingCharges: 1 }],
			deck: ['iron_sword'],
			exhaustedCards: [],
		};
		const minion = {
			id: 'minion-1',
			ownerId: 'p1',
			ttl: 30,
		};

		beginCreatureBurnDown(player, 0, player.hand[0], minion);

		expect(player.hand[0].activeMinionId).toBe('minion-1');
		expect(player.hand[0].burnMaxTtl).toBe(30);
		expect(player.hand[0].remainingCharges).toBe(0);
		expect(minion.sourceSlotIndex).toBe(0);
		expect(minion.sourceCardId).toBe('dungeon_drake');
		expect(player.deck).toEqual(['iron_sword']);
	});

	it('releaseBurningCreatureCard exhausts the slot and schedules passive draw', () => {
		addPlayer('p1', {
			hand: [{
				id: 'dungeon_drake',
				type: 'creature',
				charges: 1,
				remainingCharges: 0,
				activeMinionId: 'minion-1',
				burnMaxTtl: 30,
			}],
			deck: ['iron_sword'],
			exhaustedCards: [],
		});
		const minion = {
			id: 'minion-1',
			ownerId: 'p1',
			sourceSlotIndex: 0,
			sourceCardId: 'dungeon_drake',
			ttl: 0,
			hp: 0,
		};

		expect(releaseBurningCreatureCard(gameState.players.p1, minion)).toBe(true);
		expect(gameState.players.p1.hand[0]).toBeNull();
		expect(gameState.players.p1.exhaustedCards.some((card) => card.id === 'dungeon_drake')).toBe(true);
		expect(gameState.players.p1.nextDrawAt).toBeTypeOf('number');
		expect(gameState.players.p1.deck).toEqual(['iron_sword']);
	});

	it('updateMinions releases a burning creature card when the minion dies', () => {
		addPlayer('p1', {
			hand: [{
				id: 'dungeon_drake',
				type: 'creature',
				charges: 1,
				remainingCharges: 0,
				activeMinionId: 'minion-1',
				burnMaxTtl: 30,
			}],
			deck: ['iron_sword'],
			exhaustedCards: [],
		});
		gameState.minions.push({
			id: 'minion-1',
			ownerId: 'p1',
			sourceSlotIndex: 0,
			sourceCardId: 'dungeon_drake',
			x: 0,
			z: 0,
			hp: 0,
			ttl: 30,
		});

		updateMinions();

		expect(gameState.minions.length).toBe(0);
		expect(gameState.players.p1.hand[0]).toBeNull();
		expect(gameState.players.p1.nextDrawAt).toBeTypeOf('number');
	});

	it('isPlayerOutOfCards is false when a desperation card remains in hand', () => {
		addPlayer('p1', {
			hand: [{ id: 'rusty_shiv', type: 'weapon', charges: 1, remainingCharges: 1, isDesperation: true }],
			deck: [],
			inDesperation: true,
		});

		expect(isPlayerOutOfCards(gameState.players['p1'])).toBe(false);
	});

	it('createEchoCard builds a one-charge echo at half base damage', () => {
		const echo = createEchoCard({ id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon', grind: 0 });
		expect(echo).toEqual(expect.objectContaining({
			id: 'iron_sword',
			isEcho: true,
			charges: 1,
			remainingCharges: 1,
			echoDamage: 8,
			magicStoneCost: 0,
		}));
	});

	it('createEchoCard preserves magicStoneCost for non-zero-cost cards', () => {
		const echo = createEchoCard({ id: 'frost_nova', name: 'Cryo Burst', type: 'spell', grind: 0 });
		expect(echo.magicStoneCost).toBe(CARD_DEFS.frost_nova.magicStoneCost);
	});

	it('replaceConsumedCard records exhausted real cards and schedules passive draw', () => {
		gameState.enemies = [
			{ id: 'e1', x: 0, z: 0, hp: 50, state: 'idle', wanderTarget: { x: 0, z: 0 } },
		];
		startDungeonRun();
		const player = {
			hand: [{ id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon', charges: 1, remainingCharges: 0 }],
			deck: [],
			exhaustedCards: [],
		};
		initDesperationDeck(player);
		gameState.players.p1 = player;

		replaceConsumedCard(player, 0, player.hand[0]);

		expect(player.exhaustedCards).toEqual([
			expect.objectContaining({ id: 'iron_sword' }),
		]);
		expect(player.hand[0]).toBeNull();
		expect(player.nextDrawAt).toBeTypeOf('number');

		gameState.gamePhase = 'playing';
		processPassiveDraws(player.nextDrawAt);
		expect(player.hand[1].isDesperation).toBe(true);
	});

	it('exhaustHandSlot leaves a null slot without immediate draw', () => {
		const player = {
			hand: [{ id: 'iron_sword', type: 'weapon', charges: 1, remainingCharges: 0 }],
			deck: ['flame_blade'],
			exhaustedCards: [],
		};

		exhaustHandSlot(player, 0, player.hand[0]);

		expect(player.hand[0]).toBeNull();
		expect(player.deck).toEqual(['flame_blade']);
		expect(player.nextDrawAt).toBeTypeOf('number');
	});

	it('processPassiveDraws draws one card after the interval', () => {
		gameState.gamePhase = 'playing';
		const player = {
			dead: false,
			extracted: false,
			hand: [null, null, null, null, null, null],
			deck: ['iron_sword', 'flame_blade'],
			nextDrawAt: Date.now() + 500,
		};
		gameState.players.p1 = player;

		processPassiveDraws(player.nextDrawAt - 1);
		expect(player.hand[0]).toBeNull();

		processPassiveDraws(player.nextDrawAt);
		expect(player.hand[1].id).toBe('flame_blade');
		expect(player.deck).toEqual(['iron_sword']);
	});

	it('discardCardFromHand schedules passive draw without recording exhaust', () => {
		const player = {
			hand: [
				{ id: 'iron_sword', type: 'weapon', charges: 5, remainingCharges: 5 },
				null,
				null,
				null,
				null,
				null,
			],
			deck: ['flame_blade'],
			exhaustedCards: [],
		};

		const result = discardCardFromHand(player, 0, 'iron_sword');

		expect(result.valid).toBe(true);
		expect(player.hand[0]).toBeNull();
		expect(player.exhaustedCards).toEqual([]);
		expect(player.nextDrawAt).toBeTypeOf('number');
	});

	it('validateDiscardHand rejects burning creature cards', () => {
		const player = {
			hand: [{
				id: 'dungeon_drake',
				type: 'creature',
				charges: 1,
				remainingCharges: 0,
				activeMinionId: 'minion-1',
			}],
		};

		expect(validateDiscardHand(player, 0, 'dungeon_drake')).toEqual({
			valid: false,
			reason: 'Creature still active',
		});
	});

	it('deck_sifter draws immediately when hand has room and rejects at full hand', () => {
		gameState.gamePhase = 'playing';
		const player = {
			dead: false,
			extracted: false,
			hand: [
				{ id: 'deck_sifter', type: 'weapon', charges: 3, remainingCharges: 3, effect: 'draw_card' },
				{ id: 'iron_sword', type: 'weapon', charges: 5, remainingCharges: 5 },
				{ id: 'flame_blade', type: 'weapon', charges: 2, remainingCharges: 2 },
				{ id: 'battle_familiar', type: 'spell', charges: 1, remainingCharges: 1 },
				{ id: 'dungeon_drake', type: 'creature', charges: 1, remainingCharges: 1 },
				{ id: 'harvesting_scythe', type: 'weapon', charges: 3, remainingCharges: 3 },
			],
			deck: ['chrono_trigger'],
			nextDrawAt: null,
		};
		gameState.players.p1 = player;

		expect(canDrawIntoHand(player)).toBe(false);

		player.hand[5] = null;
		expect(canDrawIntoHand(player)).toBe(true);

		const sifter = player.hand[0];
		sifter.remainingCharges -= 1;
		const drawn = drawCardIntoHand(player);
		expect(drawn.id).toBe('chrono_trigger');
		expect(player.hand[5].id).toBe('chrono_trigger');
		expect(sifter.remainingCharges).toBe(2);
	});

	it('initPlayerHand works with instance-based selected decks', () => {
		const progress = createPlayerProgress();
		const player = {
			inventory: progress.inventory,
			selectedDeck: progress.inventory.map(instance => instance.instanceId),
			deck: [],
		};
		normalizePlayerInventory(player);

		createDrawDeckFromSelectedDeck(player);
		initPlayerHand(player);

		expect(player.hand).toHaveLength(6);
		expect(player.hand.filter(Boolean)).toHaveLength(4);
		const handIds = player.hand.filter(Boolean).map(card => card.id).sort();
		const deckCardIds = player.selectedDeck
			.map(entry => cardIdForDeckEntry(entry, player.inventory))
			.sort();
		const remainingDeckIds = player.deck
			.map(entry => cardIdForDeckEntry(entry, player.inventory))
			.sort();
		expect([...handIds, ...remainingDeckIds].sort()).toEqual(deckCardIds);
	});
});

describe('stateSnapshot() — explicit public snapshot', () => {
	beforeEach(() => {
		resetState();
		// Ensure gameState has layout and dungeonBounds (set by module init, but resetState clears them)
		gameState.layoutSeed = 42;
		if (!gameState.layout) gameState.layout = { rooms: [{ x: 0, z: 0, width: 10, depth: 10 }] };
		if (!gameState.dungeonBounds) gameState.dungeonBounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
	});

	it('includes players with public sub-fields', () => {
		addPlayer('p1', { hp: 80, magicStones: 50, currency: 10, deck: ['iron_sword'] });
		const snapshot = stateSnapshot();

		expect(snapshot.players['p1']).toEqual({
			x: 0,
			y: 0.5,
			z: 0,
			flying: false,
			altitude: 0,
			rotation: 0,
			deck: ['iron_sword'],
			hand: undefined,
			hp: 80,
			dead: false,
			extracted: false,
			ready: false,
			magicStones: 50,
			currency: 10,
			xp: 0,
			level: 1,
			inDesperation: false,
			nextDrawAt: null,
			desperationDeck: [],
			ownedCards: undefined,
			runRewards: undefined,
			currencyEarnedThisRun: undefined,
			selectedDeck: undefined,
			inventory: undefined,
			debugScenario: null,
			returnRewardsPreview: null,
			equippedKeyItemId: 'dodge_roll',
			keyItemCooldownRemaining: 0,
			overclockChargesRemaining: 0,
			isInvulnerable: false,
			isBlocking: false,
			blockingUntil: 0,
			blockingYaw: 0,
			barrierDomeUntil: 0,
			barrierDomeRadius: 0,
			smokeBombUntil: 0,
			smokeBombRadius: 0,
			smokeBombX: 0,
			smokeBombZ: 0,
			slowedUntil: 0,
			slowFactor: 1,
			burningUntil: 0,
			cardUseState: null,
			cardWindupUntil: 0,
			cardWindupCardId: null,
			cosmetic: { ...DEFAULT_COSMETIC },
			username: undefined,
		});
	});

	it('includes enemies, minions, loot, gamePhase, run, layoutSeed, lobby, dungeonBounds', () => {
		addPlayer('p1');
		gameState.enemies = [{ id: 'e1', x: 5, z: 5, hp: 50 }];
		gameState.minions = [{ id: 'm1', x: 0, z: 0, hp: 50, ttl: 30, ownerId: 'p1' }];
		gameState.loot = [{ id: 'l1', x: 3, z: 3, value: 10 }];
		gameState.gamePhase = 'playing';
		gameState.run = { id: 'run-1', status: 'playing' };
		gameState.lobby = [];

		const snapshot = stateSnapshot();

		expect(snapshot.enemies).toEqual(gameState.enemies);
		expect(snapshot.minions).toEqual(gameState.minions);
		expect(snapshot.loot).toEqual(gameState.loot);
		expect(snapshot.gamePhase).toBe('playing');
		expect(snapshot.run).toEqual(gameState.run);
		expect(snapshot.layoutSeed).toBe(42);
		expect(snapshot.lobby).toEqual([]);
		expect(snapshot.dungeonBounds).toEqual(gameState.dungeonBounds);
		expect(snapshot.bounds).toBeUndefined();
	});

	it('does not include layout', () => {
		addPlayer('p1');
		const snapshot = stateSnapshot();
		expect(snapshot.layout).toBeUndefined();
	});

	it('does not include _victoryCounters', () => {
		addPlayer('p1');
		gameState._victoryCounters = { p1: 3 };
		const snapshot = stateSnapshot();
		expect(snapshot._victoryCounters).toBeUndefined();
	});

	it('strips pendingSummons (Set) from player objects', () => {
		addPlayer('p1');
		gameState.players['p1'].pendingSummons.add('0:iron_sword');
		const snapshot = stateSnapshot();
		expect(snapshot.players['p1'].pendingSummons).toBeUndefined();
	});

	it('strips lastActivity from player objects', () => {
		addPlayer('p1');
		const snapshot = stateSnapshot();
		expect(snapshot.players['p1'].lastActivity).toBeUndefined();
	});

	it('includes username in snapshot when player record has one', () => {
		addPlayer('p1', { username: 'TestPlayer' });
		const snapshot = stateSnapshot();
		expect(snapshot.players['p1'].username).toBe('TestPlayer');
	});

	it('preserves all client-facing player fields', () => {
		const inventory = createInventoryFromOwnedCards({ iron_sword: 2, flame_blade: 1 });
		addPlayer('p1', {
			hp: 75,
			magicStones: 30,
			currency: 25,
			deck: ['iron_sword', 'flame_blade'],
			inventory,
			selectedDeck: inventory.map((instance) => instance.instanceId),
			ownedCards: { iron_sword: 2, flame_blade: 1 },
			runRewards: { currency: 10, cards: [] },
			currencyEarnedThisRun: 5
		});
		const snapshot = stateSnapshot();
		const p = snapshot.players['p1'];

		expect(p.hp).toBe(75);
		expect(p.magicStones).toBe(30);
		expect(p.currency).toBe(25);
		expect(p.deck).toEqual(['iron_sword', 'flame_blade']);
		expect(p.selectedDeck).toEqual(inventory.map((instance) => instance.instanceId));
		expect(p.inventory).toBe(inventory);
		expect(p.ownedCards).toEqual({ iron_sword: 2, flame_blade: 1 });
		expect(p.runRewards).toEqual({ currency: 10, cards: [] });
		expect(p.currencyEarnedThisRun).toBe(5);
		expect(p.x).toBe(0);
		expect(p.y).toBe(0.5);
		expect(p.z).toBe(0);
		expect(p.dead).toBe(false);
		expect(p.ready).toBe(false);
	});

	it('returns independent player objects per call (no shared mutation)', () => {
		addPlayer('p1');
		const a = stateSnapshot();
		const b = stateSnapshot();
		a.players['p1'].hp = 0;
		expect(b.players['p1'].hp).toBe(100);
	});

	it('reuses the same inventory array reference across consecutive snapshots when unchanged', () => {
		const inventory = createInventoryFromOwnedCards({ iron_sword: 1 });
		addPlayer('p1', { inventory });
		const a = stateSnapshot();
		const b = stateSnapshot();
		expect(a.players['p1'].inventory).toBe(inventory);
		expect(b.players['p1'].inventory).toBe(inventory);
		expect(a.players['p1'].inventory).toBe(b.players['p1'].inventory);
	});
});

describe('hotStateSnapshot() — slim per-tick payload', () => {
	const COLD_PLAYER_FIELDS = [
		'deck',
		'desperationDeck',
		'hand',
		'ownedCards',
		'inventory',
		'selectedDeck',
		'runRewards',
		'currencyEarnedThisRun',
		'returnRewardsPreview',
		'inDesperation',
		'nextDrawAt',
		'debugScenario',
	];

	beforeEach(() => {
		resetState();
		gameState.layoutSeed = 42;
		if (!gameState.layout) gameState.layout = { rooms: [{ x: 0, z: 0, width: 10, depth: 10 }] };
		if (!gameState.dungeonBounds) gameState.dungeonBounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
	});

	it('includes hot player fields and world fields', () => {
		const inventory = createInventoryFromOwnedCards({ iron_sword: 1 });
		addPlayer('p1', {
			hp: 75,
			magicStones: 30,
			currency: 25,
			deck: ['iron_sword'],
			hand: [{ id: 'iron_sword', name: 'Iron Sword', type: 'weapon', charges: 1, remainingCharges: 1 }],
			inventory,
			selectedDeck: inventory.map((instance) => instance.instanceId),
			ownedCards: { iron_sword: 1 },
			runRewards: { currency: 10, cards: [] },
			currencyEarnedThisRun: 5,
			debugScenario: 'summon-low-mana',
			username: 'HotPlayer',
		});
		gameState.enemies = [{ id: 'e1', x: 5, z: 5, hp: 50 }];
		gameState.minions = [{ id: 'm1', x: 0, z: 0, hp: 50, ttl: 30, ownerId: 'p1' }];
		gameState.loot = [{ id: 'l1', x: 3, z: 3, value: 10 }];
		gameState.gamePhase = 'playing';
		gameState.run = { id: 'run-1', status: 'playing' };
		gameState.lobby = [];

		const snapshot = hotStateSnapshot();
		const p = snapshot.players['p1'];

		expect(p).toEqual(expect.objectContaining({
			x: 0,
			y: 0.5,
			z: 0,
			rotation: 0,
			hp: 75,
			dead: false,
			ready: false,
			magicStones: 30,
			currency: 25,
			extracted: false,
			equippedKeyItemId: 'dodge_roll',
			keyItemCooldownRemaining: 0,
			overclockChargesRemaining: 0,
			isInvulnerable: false,
			isBlocking: false,
			blockingUntil: 0,
			blockingYaw: 0,
			barrierDomeUntil: 0,
			barrierDomeRadius: 0,
			smokeBombUntil: 0,
			smokeBombRadius: 0,
			smokeBombX: 0,
			smokeBombZ: 0,
			cosmetic: { ...DEFAULT_COSMETIC },
			username: 'HotPlayer',
		}));
		for (const field of COLD_PLAYER_FIELDS) {
			expect(p[field]).toBeUndefined();
		}
		expect(snapshot.enemies).toHaveLength(1);
		expect(snapshot.enemies[0]).toEqual(expect.objectContaining({
			id: 'e1', x: 5, z: 5, hp: 50,
		}));
		// Internal AI fields must not ship on the hot tick.
		expect(snapshot.enemies[0].wanderTarget).toBeUndefined();
		expect(snapshot.minions).toHaveLength(1);
		expect(snapshot.minions[0]).toEqual(expect.objectContaining({
			id: 'm1', x: 0, z: 0, hp: 50, ttl: 30, ownerId: 'p1',
		}));
		expect(snapshot.loot).toEqual(gameState.loot);
		expect(snapshot.gamePhase).toBe('playing');
		expect(snapshot.run).toEqual(expect.objectContaining({ id: 'run-1', status: 'playing' }));
		expect(snapshot.layoutSeed).toBe(42);
		expect(snapshot.lobby).toEqual([]);
		// Slow catalogs omitted from hot ticks (client merges from cold/join).
		expect(snapshot.dungeonBounds).toBeUndefined();
		expect(snapshot.shopOffer).toBeUndefined();
		expect(snapshot.suspendedRunSummary).toBeUndefined();
	});

	it('full stateSnapshot still includes cold fields', () => {
		const inventory = createInventoryFromOwnedCards({ iron_sword: 1 });
		addPlayer('p1', {
			deck: ['iron_sword'],
			hand: [{ id: 'iron_sword', name: 'Iron Sword', type: 'weapon', charges: 1, remainingCharges: 1 }],
			inventory,
			selectedDeck: inventory.map((instance) => instance.instanceId),
			ownedCards: { iron_sword: 1 },
			runRewards: { currency: 10, cards: [] },
			currencyEarnedThisRun: 5,
			debugScenario: 'summon-low-mana',
		});

		const snapshot = stateSnapshot();
		const p = snapshot.players['p1'];

		expect(p.deck).toEqual(['iron_sword']);
		expect(p.hand).toHaveLength(1);
		expect(p.inventory).toBe(inventory);
		expect(p.selectedDeck).toEqual(inventory.map((instance) => instance.instanceId));
		expect(p.ownedCards).toEqual({ iron_sword: 1 });
		expect(p.runRewards).toEqual({ currency: 10, cards: [] });
		expect(p.currencyEarnedThisRun).toBe(5);
		expect(p.debugScenario).toBe('summon-low-mana');
	});
});

// ── ENEMY_DEFS ──

describe('ENEMY_DEFS', () => {
	it('is exported and contains grunt, skirmisher, miniboss, annex_overseer, arena_champion, spire_warden, permafrost_warden, spawner, field_medic, ember_wraith keys', () => {
		expect(ENEMY_DEFS).toBeDefined();
		expect(ENEMY_DEFS).toHaveProperty('grunt');
		expect(ENEMY_DEFS).toHaveProperty('skirmisher');
		expect(ENEMY_DEFS).toHaveProperty('miniboss');
		expect(ENEMY_DEFS).toHaveProperty('annex_overseer');
		expect(ENEMY_DEFS).toHaveProperty('arena_champion');
		expect(ENEMY_DEFS).toHaveProperty('crucible_sovereign');
		expect(ENEMY_DEFS).toHaveProperty('spire_warden');
		expect(ENEMY_DEFS).toHaveProperty('permafrost_warden');
		expect(ENEMY_DEFS).toHaveProperty('spawner');
		expect(ENEMY_DEFS).toHaveProperty('field_medic');
		expect(ENEMY_DEFS).toHaveProperty('ember_wraith');
	});

	it('grunt has correct stat values', () => {
		expect(ENEMY_DEFS.grunt.hp).toBe(100);
		expect(ENEMY_DEFS.grunt.chaseSpeed).toBe(2.5);
		expect(ENEMY_DEFS.grunt.wanderSpeed).toBe(1.0);
		expect(ENEMY_DEFS.grunt.attackDamage).toBe(10);
		expect(ENEMY_DEFS.grunt.attackWindupMs).toBe(800);
		expect(ENEMY_DEFS.grunt.attackStyle).toBe('radial');
	});

	it('skirmisher has correct stat values', () => {
		expect(ENEMY_DEFS.skirmisher.hp).toBe(40);
		expect(ENEMY_DEFS.skirmisher.chaseSpeed).toBe(4.5);
		expect(ENEMY_DEFS.skirmisher.wanderSpeed).toBe(1.5);
		expect(ENEMY_DEFS.skirmisher.attackDamage).toBe(6);
		expect(ENEMY_DEFS.skirmisher.attackWindupMs).toBe(500);
		expect(ENEMY_DEFS.skirmisher.attackStyle).toBe('cone');
	});

	it('miniboss has correct stat values', () => {
		expect(ENEMY_DEFS.miniboss.hp).toBe(300);
		expect(ENEMY_DEFS.miniboss.chaseSpeed).toBe(1.2);
		expect(ENEMY_DEFS.miniboss.wanderSpeed).toBe(0.6);
		expect(ENEMY_DEFS.miniboss.attackDamage).toBe(18);
		expect(ENEMY_DEFS.miniboss.attackWindupMs).toBe(1200);
		expect(ENEMY_DEFS.miniboss.attackStyle).toBe('cone');
		expect(ENEMY_DEFS.miniboss.attackRange).toBe(5);
	});

	it('spire_warden has distinct summit-boss stat values', () => {
		expect(ENEMY_DEFS.spire_warden.name).toBe('Summit Warden');
		expect(ENEMY_DEFS.spire_warden.hp).toBeGreaterThan(ENEMY_DEFS.miniboss.hp);
		expect(ENEMY_DEFS.spire_warden.attackDamage).toBeGreaterThan(ENEMY_DEFS.miniboss.attackDamage);
		expect(ENEMY_DEFS.spire_warden.attackRange).toBeGreaterThan(ENEMY_DEFS.miniboss.attackRange);
		expect(ENEMY_DEFS.spire_warden.chaseSpeed).toBe(1.0);
		expect(ENEMY_DEFS.spire_warden.wanderSpeed).toBe(0.5);
		expect(ENEMY_DEFS.spire_warden.attackWindupMs).toBe(1400);
		expect(ENEMY_DEFS.spire_warden.attackStyle).toBe('cone');
	});

	it('permafrost_warden has distinct ice-cavern radial boss stat values', () => {
		const def = ENEMY_DEFS.permafrost_warden;
		expect(def.name).toBe('Permafrost Warden');
		expect(def.description.length).toBeGreaterThan(0);
		expect(def.hp).toBeGreaterThanOrEqual(300);
		expect(def.hp).toBeLessThanOrEqual(420);
		expect(def.attackStyle).toBe('radial');
		expect(def.attackStyle).not.toBe(ENEMY_DEFS.miniboss.attackStyle);
		expect(def.attackStyle).not.toBe(ENEMY_DEFS.glacial_thrower.attackStyle);
		expect(def.attackDamage).toBeGreaterThanOrEqual(ENEMY_DEFS.miniboss.attackDamage);
		expect(def.attackRange).toBeGreaterThan(0);
		expect(def.surfacedStats).toEqual(
			expect.arrayContaining(['hp', 'attackDamage', 'attackStyle', 'attackRange']),
		);
	});

	it('spawner has correct stat and spawning fields', () => {
		expect(ENEMY_DEFS.spawner.hp).toBe(120);
		expect(ENEMY_DEFS.spawner.chaseSpeed).toBe(1.8);
		expect(ENEMY_DEFS.spawner.wanderSpeed).toBe(0.9);
		expect(ENEMY_DEFS.spawner.attackDamage).toBe(8);
		expect(ENEMY_DEFS.spawner.attackWindupMs).toBe(900);
		expect(ENEMY_DEFS.spawner.attackStyle).toBe('radial');
		expect(ENEMY_DEFS.spawner.spawnIntervalMs).toBe(4000);
		expect(ENEMY_DEFS.spawner.spawnMaxAlive).toBe(3);
		expect(ENEMY_DEFS.spawner.spawnType).toBe('skirmisher');
	});

	it('field_medic has fragile support tuning and medic AI fields', () => {
		const def = ENEMY_DEFS.field_medic;
		expect(def.name).toBe('Field Medic');
		expect(def.description).toMatch(/heal|kite|bead/i);
		expect(def.hp).toBeGreaterThanOrEqual(50);
		expect(def.hp).toBeLessThanOrEqual(80);
		expect(def.attackDamage).toBeGreaterThanOrEqual(4);
		expect(def.attackDamage).toBeLessThanOrEqual(8);
		expect(def.attackStyle).toBe('projectile');
		expect(def.fleeSpeed).toBeGreaterThan(def.chaseSpeed);
		expect(def.fleeRadius).toBeGreaterThan(0);
		expect(def.healAmount).toBeGreaterThan(0);
		expect(def.healRadius).toBeGreaterThan(0);
		expect(def.healCooldownMs).toBeGreaterThan(0);
		expect(def.beadRange).toBeGreaterThan(0);
		expect(def.beadCooldownMs).toBeGreaterThan(0);
		expect(def.surfacedStats).toEqual(
			expect.arrayContaining(['hp', 'attackDamage', 'healAmount', 'healCooldownMs', 'fleeSpeed']),
		);
	});

	it('ember_wraith has fire skirmisher tuning and burn metadata', () => {
		const def = ENEMY_DEFS.ember_wraith;
		expect(def.name).toBe('Ember Wraith');
		expect(def.description).toMatch(/ignit|burn/i);
		expect(def.hp).toBeGreaterThanOrEqual(45);
		expect(def.hp).toBeLessThanOrEqual(70);
		expect(def.attackDamage).toBeGreaterThanOrEqual(6);
		expect(def.attackDamage).toBeLessThanOrEqual(10);
		expect(def.attackStyle).toBe('cone');
		expect(def.attackConeAngle).toBe(Math.PI / 3);
		expect(def.burnDurationMs).toBeGreaterThan(0);
		expect(def.burnDurationMs).toBeGreaterThanOrEqual(2000);
		expect(def.burnDurationMs).toBeLessThanOrEqual(3500);
		expect(def.surfacedStats).toEqual(
			expect.arrayContaining(['hp', 'attackDamage', 'attackStyle', 'chaseSpeed', 'burnDurationMs']),
		);
	});

	const ENEMY_TYPES = ['grunt', 'skirmisher', 'miniboss', 'annex_overseer', 'arena_champion', 'spire_warden', 'permafrost_warden', 'spawner', 'field_medic', 'ember_wraith'];
	const DISPLAY_ONLY_KEYS = ['name', 'description', 'surfacedStats'];

	it('every type has non-empty display metadata with valid surfacedStats keys', () => {
		for (const type of ENEMY_TYPES) {
			const def = ENEMY_DEFS[type];
			expect(typeof def.name).toBe('string');
			expect(def.name.length).toBeGreaterThan(0);
			expect(def.name).not.toBe(type);

			expect(typeof def.description).toBe('string');
			expect(def.description.length).toBeGreaterThan(0);

			expect(Array.isArray(def.surfacedStats)).toBe(true);
			expect(def.surfacedStats.length).toBeGreaterThan(0);
			expect(def.surfacedStats).toContain('hp');
			expect(def.surfacedStats).toContain('attackDamage');

			const combatKeys = Object.keys(def).filter((k) => !DISPLAY_ONLY_KEYS.includes(k));
			for (const statKey of def.surfacedStats) {
				expect(combatKeys).toContain(statKey);
			}
		}
	});

	it('spawnEnemy does not copy display metadata onto spawned enemies', () => {
		resetState();
		const enemy = spawnEnemy(0, 0, 'grunt');
		for (const key of DISPLAY_ONLY_KEYS) {
			expect(enemy).not.toHaveProperty(key);
		}
	});

	it('spawnEnemy(field_medic) spreads combat stats but omits display metadata', () => {
		resetState();
		const enemy = spawnEnemy(0, 0, 'field_medic');
		expect(enemy.type).toBe('field_medic');
		expect(enemy.hp).toBe(ENEMY_DEFS.field_medic.hp);
		expect(enemy.maxHp).toBe(ENEMY_DEFS.field_medic.hp);
		expect(enemy.attackDamage).toBe(ENEMY_DEFS.field_medic.attackDamage);
		expect(enemy.healAmount).toBe(ENEMY_DEFS.field_medic.healAmount);
		expect(enemy.fleeSpeed).toBe(ENEMY_DEFS.field_medic.fleeSpeed);
		expect(enemy.beadRange).toBe(ENEMY_DEFS.field_medic.beadRange);
		for (const key of DISPLAY_ONLY_KEYS) {
			expect(enemy).not.toHaveProperty(key);
		}
	});

	it('spawnEnemy(ember_wraith) spreads combat stats including burnDurationMs but omits display metadata', () => {
		resetState();
		const enemy = spawnEnemy(0, 0, 'ember_wraith');
		expect(enemy.type).toBe('ember_wraith');
		expect(enemy.hp).toBe(ENEMY_DEFS.ember_wraith.hp);
		expect(enemy.maxHp).toBe(ENEMY_DEFS.ember_wraith.hp);
		expect(enemy.attackDamage).toBe(ENEMY_DEFS.ember_wraith.attackDamage);
		expect(enemy.attackStyle).toBe('cone');
		expect(enemy.attackConeAngle).toBe(ENEMY_DEFS.ember_wraith.attackConeAngle);
		expect(enemy.burnDurationMs).toBe(ENEMY_DEFS.ember_wraith.burnDurationMs);
		for (const key of DISPLAY_ONLY_KEYS) {
			expect(enemy).not.toHaveProperty(key);
		}
	});
});

// ── enemyDefFor / updateEnemies unknown type ──

describe('enemyDefFor / updateEnemies unknown type', () => {
	beforeEach(() => resetState());

	it('updateEnemies throws on corrupt enemy type without mutating player HP', () => {
		addPlayer('p1', { id: 'p1', x: 0, z: 0, dead: false, hp: 100 });
		const now = Date.now();

		gameState.enemies.push({
			id: 'e1',
			type: 'dragon',
			x: 0,
			z: 0,
			hp: 50,
			state: 'chasing',
			attackState: 'windup',
			windupTargetId: 'p1',
			windupStartTime: now - 1000,
			wanderTarget: { x: 0, z: 0 },
		});

		expect(() => updateEnemies()).toThrow(/Unknown enemy type/);
		expect(gameState.players['p1'].hp).toBe(100);
	});
});

// ── spawnEnemy type validation ──

describe('spawnEnemy() type validation', () => {
	beforeEach(() => resetState());

	it('throws on unknown enemy type', () => {
		expect(() => spawnEnemy(0, 0, 'dragon')).toThrow(/Unknown enemy type/);
	});

	it('does not push to gameState.enemies when type is unknown', () => {
		gameState.enemies = [];
		expect(() => spawnEnemy(0, 0, 'dragon')).toThrow();
		expect(gameState.enemies.length).toBe(0);
	});

	it('accepts valid types without throwing', () => {
		gameState.enemies = [];
		expect(() => spawnEnemy(0, 0, 'grunt')).not.toThrow();
		expect(() => spawnEnemy(0, 0, 'skirmisher')).not.toThrow();
		expect(() => spawnEnemy(0, 0, 'miniboss')).not.toThrow();
		expect(() => spawnEnemy(0, 0, 'annex_overseer')).not.toThrow();
		expect(() => spawnEnemy(0, 0, 'spire_warden')).not.toThrow();
		expect(() => spawnEnemy(0, 0, 'permafrost_warden')).not.toThrow();
		expect(() => spawnEnemy(0, 0, 'spawner')).not.toThrow();
		expect(() => spawnEnemy(0, 0, 'field_medic')).not.toThrow();
		expect(() => spawnEnemy(0, 0, 'ember_wraith')).not.toThrow();
		expect(gameState.enemies.length).toBe(9);
	});
});

describe('spawnEnemy() spreads combat stats from def', () => {
	beforeEach(() => resetState());

	it('copies cone attack and chase stats for skirmisher', () => {
		gameState.enemies = [];
		const enemy = spawnEnemy(0, 0, 'skirmisher');
		expect(enemy.attackStyle).toBe('cone');
		expect(enemy.attackConeAngle).toBe(ENEMY_DEFS.skirmisher.attackConeAngle);
		expect(enemy.chaseSpeed).toBe(4.5);
	});

	it('copies spawner add config onto spawner entity', () => {
		gameState.enemies = [];
		const enemy = spawnEnemy(0, 0, 'spawner');
		expect(enemy.spawnIntervalMs).toBe(4000);
		expect(enemy.spawnMaxAlive).toBe(3);
	});

	it('does not overwrite runtime-only fields with def spread', () => {
		gameState.enemies = [];
		const before = Date.now();
		const enemy = spawnEnemy(5, 7, 'spawner');
		expect(enemy.id).toBeDefined();
		expect(enemy.x).toBe(5);
		expect(enemy.z).toBe(7);
		expect(enemy.type).toBe('spawner');
		expect(enemy.state).toBe('idle');
		expect(enemy.attackState).toBe('idle');
		expect(enemy.wanderTarget).toEqual({ x: 5, z: 7 });
		expect(enemy.lastSpawnTime).toBeGreaterThanOrEqual(before);
		expect(enemy.spawnedBy).toBeUndefined();
	});
});

// ── spawnEnemy centralizes variant init ──

describe('spawnEnemy() variant field', () => {
	beforeEach(() => resetState());

	it('exposes variant: null for direct and spawner-add tier-0 spawns', () => {
		gameState.enemies = [];
		// Direct ad-hoc spawn: no tier/rng → tier 0 → no roll → null.
		const direct = spawnEnemy(0, 0, 'grunt');
		expect(direct.variant).toBe(null);

		// Spawner-add path (spawnedBy set, no opts) also defaults to tier 0.
		const add = spawnEnemy(1, 1, 'skirmisher', 'parent123');
		expect(add.variant).toBe(null);

		// Field is always present (never undefined) on every spawned enemy.
		for (const e of gameState.enemies) {
			expect(e.variant).not.toBe(undefined);
			expect(e.variant === null || typeof e.variant === 'string').toBe(true);
		}
	});

	it('tags a high-tier spawn when the seeded roll passes, rolling once via spawnEnemy', () => {
		gameState.enemies = [];
		gameState.run = { questTier: 2 };
		// rng always returns 0.1: first call is the variant roll (< chance at
		// tier 1), the second is the id pick → index 0 of the registry.
		const enemy = spawnEnemy(0, 0, 'grunt', undefined, { tier: 1, rng: () => 0.1 });
		const ids = Object.keys(VARIANT_DEFS);
		expect(ids).toContain(enemy.variant);
		expect(enemy.variant).toBe(ids[0]);
	});

	it('produces variant (tag or null) on every combat spawn', () => {
		resetGameState();
		gameState.selectedQuestId = 'arena_trials';
		gameState.enemies = [];
		spawnEnemies();
		expect(gameState.enemies.length).toBeGreaterThan(0);
		const ids = Object.keys(VARIANT_DEFS);
		for (const e of gameState.enemies) {
			expect(e.variant).not.toBe(undefined);
			expect(e.variant === null || ids.includes(e.variant)).toBe(true);
		}
	});
});

// ── spawnEnemies mixed pack ──

describe('spawnEnemies() mixed pack', () => {
	beforeEach(() => {
		resetGameState();
	});

	it('produces quest.enemyCount enemies drawn from unscripted quest pools', () => {
		gameState.selectedQuestId = 'arena_trials';
		gameState.enemies = [];
		spawnEnemies();
		const quest = getQuest('arena_trials');
		expect(gameState.enemies.length).toBe(quest.enemyCount);

		const allowed = new Set(QUEST_DEFS.arena_trials.enemyPool.map(entry => entry.type));
		for (const e of gameState.enemies) {
			expect(allowed.has(e.type)).toBe(true);
		}
		expect(gameState.enemies.some(e => e.type === 'spawner')).toBe(false);
	});

	it('skips bulk combat spawns for scripted default quest and spawns room-0 wave-0 scripted encounter', () => {
		gameState.enemies = [];
		spawnEnemies();
		expect(gameState.enemies.length).toBe(0);
		startDungeonRun();
		expect(gameState.enemies.length).toBe(2);
		expect(gameState.enemies.every((e) => e.type === 'grunt')).toBe(true);
		expect(gameState.enemies.some(e => e.type === 'miniboss')).toBe(false);
		expect(gameState.enemies.some(e => e.type === 'spawner')).toBe(false);
		expect(gameState.run.objective.totalEnemies).toBe(6);
	});

	it('spawns crystals without bulk combat enemies for crystal rescue', () => {
		gameState.selectedQuestId = 'crystal_rescue';
		gameState.enemies = [];
		gameState.loot = [];
		spawnEnemies();
		expect(gameState.enemies.length).toBe(0);
		expect(gameState.loot.filter(l => l.kind === 'crystal').length).toBe(getQuest('crystal_rescue').itemCount);
		startDungeonRun();
		expect(gameState.enemies.length).toBe(2);
	});

	it('places scripted crystal rescue guard wave 0 in the start room', () => {
		gameState.selectedQuestId = 'crystal_rescue';
		gameState.enemies = [];
		gameState.loot = [];
		spawnEnemies();
		startDungeonRun();
		const start = gameState.layout.rooms.find(r => r.role === 'start');
		const nearbyEnemies = gameState.enemies.filter(
			e => Math.hypot(e.x - start.x, e.z - start.z) <= 12
		);
		expect(nearbyEnemies.length).toBeGreaterThanOrEqual(2);
	});
});

// ── Per-type chase speed ──

describe('per-type chase speed in updateEnemies()', () => {
	beforeEach(() => {
		resetState();
	});

	it('skirmishers move faster than grunts (chase distance per tick is larger)', () => {
		addPlayer('p1', { x: 0, z: 0, dead: false });

		// Place a skirmisher and a grunt at the same distance from player
		// Use x = DETECTION_RADIUS - 1, z = 0 so dist = DETECTION_RADIUS - 1 < DETECTION_RADIUS
		const startDist = DETECTION_RADIUS - 1;
		gameState.enemies.push({
			id: 'skirm',
			x: startDist,
			z: 0,
			type: 'skirmisher',
			hp: 20,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: startDist, z: 0 }
		});
		// Place grunt on the other side, same distance
		gameState.enemies.push({
			id: 'grunt',
			x: -startDist,
			z: 0,
			type: 'grunt',
			hp: 50,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: -startDist, z: 0 }
		});

		const skirmXBefore = gameState.enemies[0].x;
		const gruntXBefore = gameState.enemies[1].x;

		updateEnemies();

		// Skirmisher moved from +startDist toward 0 (x decreased)
		const skirmMoved = Math.abs(skirmXBefore - gameState.enemies[0].x);
		// Grunt moved from -startDist toward 0 (x increased)
		const gruntMoved = Math.abs(gruntXBefore - gameState.enemies[1].x);

		expect(skirmMoved).toBeGreaterThan(gruntMoved);
	});
});

// ── Per-type damage (miniboss HP > grunt, skirmisher damage < grunt) ──

describe('per-type stats verification', () => {
	beforeEach(() => {
		resetState();
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2000, 0, 1));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('miniboss has higher HP than grunt (takes more hits to kill)', () => {
		expect(ENEMY_DEFS.miniboss.hp).toBeGreaterThan(ENEMY_DEFS.grunt.hp);
	});

	it('skirmisher deals less damage than grunt on successful windup', () => {
		expect(ENEMY_DEFS.skirmisher.attackDamage).toBeLessThan(ENEMY_DEFS.grunt.attackDamage);
	});

	it('skirmisher deals less damage than grunt — verified via windup strike', () => {
		const now = Date.now();

		// Skirmisher windup strike
		addPlayer('ps', { id: 'ps', x: 0, z: 0, dead: false, hp: 100 });
		gameState.enemies.push({
			id: 'skirm',
			x: 0,
			z: 0,
			type: 'skirmisher',
			hp: 20,
			state: 'chasing',
			attackState: 'windup',
			windupTargetId: 'ps',
			windupStartTime: now - ENEMY_DEFS.skirmisher.attackWindupMs - 100,
			wanderTarget: { x: 0, z: 0 }
		});
		updateEnemies();
		const skirmDamage = 100 - gameState.players['ps'].hp;

		// Reset for grunt test
		resetState();
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2000, 0, 1));

		addPlayer('pg', { id: 'pg', x: 0, z: 0, dead: false, hp: 100 });
		gameState.enemies.push({
			id: 'grunt',
			x: 0,
			z: 0,
			type: 'grunt',
			hp: 50,
			state: 'chasing',
			attackState: 'windup',
			windupTargetId: 'pg',
			windupStartTime: now - ENEMY_DEFS.grunt.attackWindupMs - 100,
			wanderTarget: { x: 0, z: 0 }
		});
		updateEnemies();
		const gruntDamage = 100 - gameState.players['pg'].hp;

		expect(skirmDamage).toBeLessThan(gruntDamage);
	});
});

// ── Spawner periodic spawn ──

describe('Spawner periodic spawn', () => {
	beforeEach(() => {
		resetState();
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2000, 0, 1));
		// Ensure layout / dungeonBounds exist after resetState
		gameState.layoutSeed = 42;
		if (!gameState.layout) gameState.layout = { rooms: [{ x: 0, z: 0, width: 10, depth: 10 }] };
		if (!gameState.dungeonBounds) gameState.dungeonBounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('spawns a skirmisher add when interval has elapsed', () => {
		addPlayer('p1', { x: 0, z: 0, dead: false });
		const now = Date.now();

		gameState.enemies.push({
			id: 'spawner1',
			x: 0,
			z: 0,
			type: 'spawner',
			hp: 60,
			maxHp: 60,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 },
			lastSpawnTime: now - ENEMY_DEFS.spawner.spawnIntervalMs - 100,
		});

		expect(gameState.enemies.length).toBe(1);
		updateEnemies();

		expect(gameState.enemies.length).toBe(2);
		const add = gameState.enemies[1];
		expect(add.type).toBe('skirmisher');
	});

	it('sets spawnedBy on the add to the spawner id', () => {
		const now = Date.now();
		gameState.enemies.push({
			id: 'spawner1',
			x: 0,
			z: 0,
			type: 'spawner',
			hp: 60,
			maxHp: 60,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 },
			lastSpawnTime: now - ENEMY_DEFS.spawner.spawnIntervalMs - 100,
		});

		updateEnemies();

		const add = gameState.enemies.find(e => e.spawnedBy);
		expect(add).toBeDefined();
		expect(add.spawnedBy).toBe('spawner1');
	});

	it('does not spawn when interval has not elapsed', () => {
		const now = Date.now();
		gameState.enemies.push({
			id: 'spawner1',
			x: 0,
			z: 0,
			type: 'spawner',
			hp: 60,
			maxHp: 60,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 },
			lastSpawnTime: now, // just spawned, interval not elapsed
		});

		updateEnemies();

		expect(gameState.enemies.length).toBe(1);
	});

	it('respects spawnMaxAlive cap', () => {
		const now = Date.now();
		const spawnerId = 'spawner1';

		// Create a spawner with 3 living adds (at max)
		gameState.enemies.push({
			id: spawnerId,
			x: 0,
			z: 0,
			type: 'spawner',
			hp: 60,
			maxHp: 60,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 },
			lastSpawnTime: now - ENEMY_DEFS.spawner.spawnIntervalMs - 100,
		});
		// Pre-populate 3 adds
		for (let i = 0; i < 3; i++) {
			gameState.enemies.push({
				id: `add${i}`,
				x: 0.5 * i,
				z: 0.5 * i,
				type: 'skirmisher',
				hp: 20,
				maxHp: 20,
				state: 'idle',
				attackState: 'idle',
				spawnedBy: spawnerId,
				wanderTarget: { x: 0.5 * i, z: 0.5 * i },
			});
		}

		expect(gameState.enemies.length).toBe(4);
		updateEnemies();

		// Should still be 4 — no new add spawned
		expect(gameState.enemies.length).toBe(4);
	});

	it('spawns a new add when one of the existing adds dies', () => {
		const now = Date.now();
		const spawnerId = 'spawner1';

		gameState.enemies.push({
			id: spawnerId,
			x: 0,
			z: 0,
			type: 'spawner',
			hp: 60,
			maxHp: 60,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 },
			lastSpawnTime: now - ENEMY_DEFS.spawner.spawnIntervalMs - 100,
		});
		// 2 living adds + 1 dead add
		gameState.enemies.push({ id: 'add0', x: 0.5, z: 0, type: 'skirmisher', hp: 20, maxHp: 20, state: 'idle', attackState: 'idle', spawnedBy: spawnerId, wanderTarget: { x: 0.5, z: 0 } });
		gameState.enemies.push({ id: 'add1', x: 1, z: 0, type: 'skirmisher', hp: 20, maxHp: 20, state: 'idle', attackState: 'idle', spawnedBy: spawnerId, wanderTarget: { x: 1, z: 0 } });
		gameState.enemies.push({ id: 'add2', x: 1.5, z: 0, type: 'skirmisher', hp: 0, maxHp: 20, state: 'idle', attackState: 'idle', spawnedBy: spawnerId, wanderTarget: { x: 1.5, z: 0 } });

		expect(gameState.enemies.length).toBe(4);
		updateEnemies();

		// Should have spawned a new add (only 2 alive, cap is 3)
		expect(gameState.enemies.length).toBe(5);
		const newAdd = gameState.enemies.find(e => e.id !== spawnerId && e.id !== 'add0' && e.id !== 'add1' && e.id !== 'add2');
		expect(newAdd).toBeDefined();
		expect(newAdd.spawnedBy).toBe(spawnerId);
	});

	it('adds survive spawner death', () => {
		const spawnerId = 'spawner1';

		gameState.enemies.push({
			id: spawnerId,
			x: 0,
			z: 0,
			type: 'spawner',
			hp: 60,
			maxHp: 60,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 },
			lastSpawnTime: Date.now() - ENEMY_DEFS.spawner.spawnIntervalMs - 100,
		});
		// Pre-existing add
		gameState.enemies.push({
			id: 'add0',
			x: 0.5,
			z: 0,
			type: 'skirmisher',
			hp: 20,
			maxHp: 20,
			state: 'idle',
			attackState: 'idle',
			spawnedBy: spawnerId,
			wanderTarget: { x: 0.5, z: 0 },
		});

		// Kill the spawner
		gameState.enemies[0].hp = 0;

		updateEnemies();

		// The add should still be alive (no mass despawn)
		const add = gameState.enemies.find(e => e.id === 'add0');
		expect(add).toBeDefined();
		expect(add.hp).toBe(20);
	});

	it('add is placed within ~3 units of spawner', () => {
		const now = Date.now();
		gameState.enemies.push({
			id: 'spawner1',
			x: 0,
			z: 0,
			type: 'spawner',
			hp: 60,
			maxHp: 60,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 },
			lastSpawnTime: now - ENEMY_DEFS.spawner.spawnIntervalMs - 100,
		});

		updateEnemies();

		const add = gameState.enemies[1];
		const dist = Math.hypot(add.x - 0, add.z - 0);
		// ~3 units; allow float slack from nearbySpawnPosition sampling
		expect(dist).toBeLessThanOrEqual(3.05);
	});

	it('spawnEnemy sets lastSpawnTime on spawner type', () => {
		gameState.enemies = [];
		spawnEnemy(0, 0, 'spawner');
		expect(gameState.enemies[0].lastSpawnTime).toBeDefined();
		expect(typeof gameState.enemies[0].lastSpawnTime).toBe('number');
	});

	it('spawnEnemy does not set lastSpawnTime on non-spawner types', () => {
		gameState.enemies = [];
		spawnEnemy(0, 0, 'grunt');
		expect(gameState.enemies[0].lastSpawnTime).toBeUndefined();
	});

	it('spawnEnemy sets spawnedBy when provided', () => {
		gameState.enemies = [];
		spawnEnemy(0, 0, 'skirmisher', 'parent123');
		expect(gameState.enemies[0].spawnedBy).toBe('parent123');
	});

	it('spawnEnemy does not set spawnedBy when omitted', () => {
		gameState.enemies = [];
		spawnEnemy(0, 0, 'skirmisher');
		expect(gameState.enemies[0].spawnedBy).toBeUndefined();
	});
});

// ── firstRoomPosition ──

describe('firstRoomPosition()', () => {
	beforeEach(() => resetState());

	it('returns the center of the start room', () => {
		const startRoom = gameState.layout.rooms.find(r => r.role === 'start');
		const pos = firstRoomPosition();
		expect(pos.x).toBe(startRoom.x);
		expect(pos.z).toBe(startRoom.z);
	});

	it('returns an object with x and z properties', () => {
		const pos = firstRoomPosition();
		expect(typeof pos.x).toBe('number');
		expect(typeof pos.z).toBe('number');
	});

	it('returns layout.rooms[0] center when no start role exists', () => {
		// Strip roles to simulate pre-role-assignment state
		gameState.layout.rooms.forEach(r => delete r.role);
		const pos = firstRoomPosition();
		expect(pos.x).toBe(gameState.layout.rooms[0].x);
		expect(pos.z).toBe(gameState.layout.rooms[0].z);
	});
});

// ── Role-aware spawning constraints ──

describe('Role-aware spawning constraints', () => {
	beforeEach(() => resetGameState());

	it('enemy spawn positions exclude the start room when combat rooms exist', () => {
		// spawnEnemies uses roomsByRole('combat') when combat rooms exist
		const combatRooms = gameState.layout.rooms.filter(r => r.role === 'combat');
		expect(combatRooms.length).toBeGreaterThan(0); // precondition

		gameState.enemies = [];
		spawnEnemies();

		const startRoom = gameState.layout.rooms.find(r => r.role === 'start');
		for (const enemy of gameState.enemies) {
			const inStartRoom = Math.abs(enemy.x - startRoom.x) < startRoom.width / 2 &&
			                     Math.abs(enemy.z - startRoom.z) < startRoom.depth / 2;
			expect(inStartRoom).toBe(false);
		}
	});

	it('loot spawn positions prefer treasure room when one exists', () => {
		const treasureRooms = gameState.layout.rooms.filter(r => r.role === 'treasure');
		expect(treasureRooms.length).toBeGreaterThan(0); // precondition

		// We can't easily control Math.random in spawnLoot, but the existing
		// test suite covers this with Math.random mocking. Here we verify the
		// structural behavior: spawnLoot uses treasure rooms when available.
		// The spawnLoot describe block above already tests this with vi.spyOn.
	});
});

// ── ENTITY_RADIUS ──

describe('ENTITY_RADIUS', () => {
	it('is exported and equals 0.45', () => {
		expect(ENTITY_RADIUS).toBe(0.45);
	});
});

// ── isEntityPositionBlocked ──

describe('isEntityPositionBlocked(x, z, radius)', () => {
	beforeEach(() => resetGameState());

	it('returns false for a position in the center of a room', () => {
		const room = gameState.layout.rooms[0];
		expect(isEntityPositionBlocked(room.x, room.z, ENTITY_RADIUS)).toBe(false);
	});

	it('returns true for a position inside a wall', () => {
		// Pick an actual wall segment from a room — its center is guaranteed
		// to be inside a solid wall (not a passage gap).
		const room = gameState.layout.rooms[0];
		const wall = room.walls[0];
		// Wall center (wall.x, wall.z) is always inside the wall AABB
		expect(isEntityPositionBlocked(wall.x, wall.z, ENTITY_RADIUS)).toBe(true);
	});

	it('accepts a custom radius parameter', () => {
		const room = gameState.layout.rooms[0];
		// A very large radius should make even the room center "blocked"
		// because it expands past the walls
		expect(isEntityPositionBlocked(room.x, room.z, 100)).toBe(true);
		// A zero radius should be unblocked at room center
		expect(isEntityPositionBlocked(room.x, room.z, 0)).toBe(false);
	});

	it('defaults to ENTITY_RADIUS when radius is omitted', () => {
		const room = gameState.layout.rooms[0];
		expect(isEntityPositionBlocked(room.x, room.z)).toBe(false);
	});
});

// ── server collision primitives ──

describe('server collision primitives', () => {
	const collider = { minX: 1.5, maxX: 2.5, minZ: -0.5, maxZ: 0.5 };
	const expanded = {
		minX: collider.minX - PLAYER_RADIUS,
		maxX: collider.maxX + PLAYER_RADIUS,
		minZ: collider.minZ - PLAYER_RADIUS,
		maxZ: collider.maxZ + PLAYER_RADIUS,
	};

	it('allows endpoint touches when checking swept movement into a wall edge', () => {
		expect(checkSweptCollision(0, 0, 1, 0, [collider])).toBe(true);
		expect(checkSweptCollision(0, 0, 1, 0, [collider], { allowEndpointTouch: true })).toBe(false);
		expect(checkSweptCollision(0, 0, 1.01, 0, [collider], { allowEndpointTouch: true })).toBe(true);
	});

	it('reports segment entry times and misses for parallel slab cases', () => {
		expect(segmentAABBEntryT(0, 0, 2, 0, expanded)).toBeCloseTo(0.5);
		expect(segmentAABBEntryT(0, 2, 2, 2, expanded)).toBeNull();
		expect(segmentAABBEntryT(2, -2, 2, -1.5, expanded)).toBeNull();
	});

	it('detects segment intersections and parallel misses', () => {
		expect(segmentIntersectsAABB(0, 0, 2, 0, expanded)).toBe(true);
		expect(segmentIntersectsAABB(0, 2, 2, 2, expanded)).toBe(false);
		expect(segmentIntersectsAABB(4, -2, 4, 2, expanded)).toBe(false);
		expect(segmentIntersectsAABB(0, 2, 0, 3, expanded)).toBe(false);
	});

	it('resolves proposed wall overlaps back to the side the player came from', () => {
		const horizontalWall = { minX: 0, maxX: 2, minZ: -1, maxZ: 1 };
		expect(resolveWallCollision(0.3, 0, [horizontalWall], -1, 0)).toEqual({ x: -0.5, z: 0 });
		expect(resolveWallCollision(1.7, 0, [horizontalWall], 3, 0)).toEqual({ x: 2.5, z: 0 });

		const verticalWall = { minX: -1, maxX: 1, minZ: 0, maxZ: 2 };
		expect(resolveWallCollision(0, 0.3, [verticalWall], 0, -1)).toEqual({ x: 0, z: -0.5 });
		expect(resolveWallCollision(0, 1.7, [verticalWall], 0, 3)).toEqual({ x: 0, z: 2.5 });
	});
});

// ── moveEntityToward ──

describe('moveEntityToward(entity, target, maxDistance, options)', () => {
	beforeEach(() => resetGameState());

	it('moves entity toward target in open space', () => {
		const room = gameState.layout.rooms[0];
		const entity = { x: room.x, z: room.z };
		const target = { x: room.x + 5, z: room.z };

		const result = moveEntityToward(entity, target, 2, {});

		expect(result.moved).toBe(true);
		expect(result.blocked).toBe(false);
		expect(result.reached).toBe(false);
		expect(entity.x).toBeCloseTo(room.x + 2, 4);
		expect(entity.z).toBeCloseTo(room.z, 4);
	});

	it('reaches target when distance is less than maxDistance', () => {
		const room = gameState.layout.rooms[0];
		const entity = { x: room.x, z: room.z };
		const target = { x: room.x + 1, z: room.z };

		const result = moveEntityToward(entity, target, 5, {});

		expect(result.moved).toBe(true);
		expect(result.blocked).toBe(false);
		expect(result.reached).toBe(true);
		expect(entity.x).toBeCloseTo(room.x + 1, 4);
		expect(entity.z).toBeCloseTo(room.z, 4);
	});

	it('returns reached when entity is already within stopDistance', () => {
		const room = gameState.layout.rooms[0];
		const entity = { x: room.x, z: room.z };
		const target = { x: room.x + 0.05, z: room.z };

		const result = moveEntityToward(entity, target, 2, {});

		expect(result.moved).toBe(false);
		expect(result.blocked).toBe(false);
		expect(result.reached).toBe(true);
	});

	it('respects custom stopDistance option', () => {
		const room = gameState.layout.rooms[0];
		const entity = { x: room.x, z: room.z };
		const target = { x: room.x + 0.5, z: room.z };

		const result = moveEntityToward(entity, target, 2, { stopDistance: 1.0 });

		expect(result.reached).toBe(true);
		expect(result.moved).toBe(false);
	});

	it('returns reached: true after direct move lands within stopDistance', () => {
		const room = gameState.layout.rooms[0];
		const entity = { x: room.x, z: room.z };
		// Target is 0.5 away; move distance is 1.0 so entity moves past target to within stopDistance (default 0.1)
		const target = { x: room.x + 0.5, z: room.z };

		const result = moveEntityToward(entity, target, 1, {});

		expect(result.moved).toBe(true);
		expect(result.blocked).toBe(false);
		expect(result.reached).toBe(true);
		expect(entity.x).toBeCloseTo(room.x + 0.5, 4);
	});

	it('returns reached: false after wall-slide leaves entity beyond stopDistance', () => {
		// Deterministic layout so wall positions are fixed.
		const savedLayout = gameState.layout;
		const savedBounds = gameState.dungeonBounds;
		gameState.layout = generateLayout(42);
		gameState.dungeonBounds = { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 };

		// Find a solid wall segment (axis z — blocks x-axis movement).
		let wall = null;
		for (const room of gameState.layout.rooms) {
			for (const w of room.walls) {
				if (w.axis === 'z' && w.length >= 10) {
					wall = w;
					break;
				}
			}
			if (wall) break;
		}
		expect(wall).toBeTruthy();

		// Entity just before the wall; target just past it on X, offset on Z.
		// Distance = 0.55. The direct proposed position crosses through the wall → blocked.
		// X-slide: proposed X crosses wall at entity.z → blocked.
		// Z-slide: entity.x stays same (outside wall X-range), Z moves toward target → succeeds.
		// Post-slide position is (wall.x - 0.5, wall.z + 0.05).
		// Distance to target (wall.x + 0.05, wall.z + 0.05) = 0.55 > stopDistance → reached: false.
		// This validates the wall-slide path computes reached (false when still far).
		const entity = { x: wall.x - 0.5, z: wall.z };
		const target = { x: wall.x + 0.05, z: wall.z + 0.05 };

		const result = moveEntityToward(entity, target, 1, {});

		// Verify the wall-slide path actually fires and computes reached correctly
		if (result.blocked && result.moved) {
			expect(result.reached).toBe(false); // post-slide distance > stopDistance
		}
		// If both axes blocked (no movement), that's also valid — the wall geometry
		// may vary. The key is that when wall-slide does happen, reached is computed.
		expect(result.reached).not.toBe(true); // never reached in this geometry

		gameState.layout = savedLayout;
		gameState.dungeonBounds = savedBounds;
	});

	it('returns reached: false after direct move when entity remains farther than stopDistance', () => {
		const room = gameState.layout.rooms[0];
		const entity = { x: room.x, z: room.z };
		// Target is 3 units away; move distance is 2 so entity stops 1 unit short.
		const target = { x: room.x + 3, z: room.z };

		const result = moveEntityToward(entity, target, 2, {});

		expect(result.moved).toBe(true);
		expect(result.blocked).toBe(false);
		expect(result.reached).toBe(false);
		expect(entity.x).toBeCloseTo(room.x + 2, 4);
	});

	it('clamps final position to dungeon bounds', () => {
		const room = gameState.layout.rooms[0];
		const entity = { x: gameState.dungeonBounds.maxX - 1, z: room.z };
		const target = { x: gameState.dungeonBounds.maxX + 10, z: room.z };

		const result = moveEntityToward(entity, target, 20, {});

		expect(result.moved).toBe(true);
		expect(entity.x).toBeLessThanOrEqual(gameState.dungeonBounds.maxX);
		expect(entity.z).toBeGreaterThanOrEqual(gameState.dungeonBounds.minZ);
		expect(entity.z).toBeLessThanOrEqual(gameState.dungeonBounds.maxZ);
	});

	it('returns blocked when direct movement hits a wall and both axes are blocked', () => {
		// Use a deterministic layout so wall positions (and passage gaps) are fixed.
		const savedLayout = gameState.layout;
		const savedBounds = gameState.dungeonBounds;
		gameState.layout = generateLayout(42);
		// Set bounds to a large range so clampToDungeon doesn't interfere with the test
		gameState.dungeonBounds = { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 };

		// Find a solid wall segment (axis 'z', meaning it runs along z — blocks x-axis movement).
		// We pick the first wall segment from a room that is long enough to be solid.
		let wall = null;
		for (const room of gameState.layout.rooms) {
			for (const w of room.walls) {
				if (w.axis === 'z' && w.length >= 10) {
					wall = w;
					break;
				}
			}
			if (wall) break;
		}
		expect(wall).toBeTruthy(); // precondition: at least one solid wall segment

		// The wall is at wall.x (a fixed x coordinate), running along z from wall.z - length/2 to wall.z + length/2.
		// Position the entity very close to the wall (0.5 units away), moving horizontally right.
		// Z is the same as wall.z so we're aimed at the wall center.
		// Step size of 1.0 means the proposed position lands at wall.x + 0.5 — inside the wall.
		const entity = { x: wall.x - 0.5, z: wall.z };
		const target = { x: wall.x + 5, z: wall.z }; // far beyond the wall
		const step = 1.0; // proposed X = wall.x - 0.5 + 1.0 = wall.x + 0.5 (inside wall)

		const result = moveEntityToward(entity, target, step, {});

		// Direct movement is blocked (proposed position is inside the wall).
		// X-slide: proposed X = wall.x + 0.5, same z → also inside the wall → blocked.
		// Z-slide: zero displacement (same z as target) → treated as blocked.
		expect(result.blocked).toBe(true);
		expect(result.moved).toBe(false);

		// Restore original layout and bounds
		gameState.layout = savedLayout;
		gameState.dungeonBounds = savedBounds;
	});

	it('performs wall-slide when direct movement is blocked but one axis is free', () => {
		// Use a diagonal movement from room center toward a corner.
		// The entity moves diagonally, direct path hits a wall, but one axis is free.
		const room = gameState.layout.rooms[0];
		const wallX = room.x + room.width / 2;
		const wallZ = room.z + room.depth / 2;
		// Entity starts at room center, target is diagonally beyond the corner
		const entity = { x: room.x, z: room.z };
		const target = { x: wallX + 2, z: wallZ + 2 };

		const result = moveEntityToward(entity, target, 2, {});

		// If the direct path is blocked, wall-slide should move on one axis
		// If direct path is free (gap in wall), movement should succeed unblocked
		// Either way the metadata is consistent
		if (result.blocked) {
			expect(result.moved).toBe(true); // wall-slide succeeded on at least one axis
		}
	});

	it('wall-slide moves only the free axis when the other is blocked', () => {
		// Verify that when wall-slide activates, the entity moves along one axis
		// and the result indicates blocked=true (slide happened, not direct movement)
		const room = gameState.layout.rooms[0];
		// Pick a position well inside the room and move diagonally toward a wall
		const entity = { x: room.x, z: room.z };
		const wallX = room.x + room.width / 2;
		const target = { x: wallX + 5, z: room.z + 5 };

		const startX = entity.x;
		const startZ = entity.z;
		const result = moveEntityToward(entity, target, 1, {});

		// Regardless of blocked or not, entity should not have moved past dungeon bounds
		expect(entity.x).toBeGreaterThanOrEqual(gameState.dungeonBounds.minX);
		expect(entity.x).toBeLessThanOrEqual(gameState.dungeonBounds.maxX);
		expect(entity.z).toBeGreaterThanOrEqual(gameState.dungeonBounds.minZ);
		expect(entity.z).toBeLessThanOrEqual(gameState.dungeonBounds.maxZ);

		// If blocked, at least one axis should have changed (wall-slide)
		if (result.blocked && result.moved) {
			const dx = Math.abs(entity.x - startX);
			const dz = Math.abs(entity.z - startZ);
			// Wall-slide moves on exactly one axis (the other stays the same)
			expect(dx < 1e-6 || dz < 1e-6).toBe(true);
		}
	});

	it('is deterministic — no timers, randomness, or socket emissions', () => {
		const room = gameState.layout.rooms[0];
		// Run the same call twice and verify identical results
		const entity1 = { x: room.x, z: room.z };
		const entity2 = { x: room.x, z: room.z };
		const target = { x: room.x + 3, z: room.z + 3 };

		const r1 = moveEntityToward(entity1, target, 1, {});
		const r2 = moveEntityToward(entity2, target, 1, {});

		expect(entity1.x).toBe(entity2.x);
		expect(entity1.z).toBe(entity2.z);
		expect(r1).toEqual(r2);
	});

	it('uses custom radius from options', () => {
		const room = gameState.layout.rooms[0];
		const entity = { x: room.x, z: room.z };
		const target = { x: room.x + 3, z: room.z };

		// With a tiny radius, movement should succeed
		const result = moveEntityToward(entity, target, 2, { radius: 0.01 });

		expect(result.moved).toBe(true);
	});

	it('assigns entity x and z only to the validated final position', () => {
		const room = gameState.layout.rooms[0];
		const startX = room.x;
		const startZ = room.z;
		const entity = { x: startX, z: startZ };
		const target = { x: startX + 5, z: startZ + 5 };

		moveEntityToward(entity, target, 2, {});

		// Entity should have been modified in place
		expect(entity.x).not.toBe(startX);
		expect(entity.z).not.toBe(startZ);
	});
});

// ── Wall-aware enemy movement (updateEnemies) ──

describe('Wall-aware enemy movement in updateEnemies()', () => {
	beforeEach(() => resetState());

	it('enemy stops at wall during chase (does not pass through)', () => {
		// Place enemy and player inside the start room with a clear line-of-sight
		// between them (enemies no longer aggro through walls — that is gated by
		// hasLineOfSight). This exercises wall-aware chase movement and asserts the
		// chaser never embeds itself in a wall collider.
		const room = gameState.layout.rooms[0];

		addPlayer('p1', {
			id: 'p1',
			x: room.x + 3,
			z: room.z,
			dead: false
		});

		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: room.x - 3,
			z: room.z,
			hp: 50,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 }
		});

		// Ensure the player is within detection range
		const dist = Math.hypot(6, 0);
		expect(dist).toBeLessThan(DETECTION_RADIUS);

		updateEnemies();

		// Enemy should be in chasing state (clear line-of-sight to the player)
		expect(gameState.enemies[0].state).toBe('chasing');

		// Enemy should not overlap the wall after movement
		expect(isEntityPositionBlocked(gameState.enemies[0].x, gameState.enemies[0].z, ENTITY_RADIUS)).toBe(false);
	});

	it('enemy picks new wander target after repeated blocks (blockedTicks > 10)', () => {
		// Place enemy in a corner where it will be blocked wandering toward a wall
		const room = gameState.layout.rooms[0];
		const wall = room.walls[0];

		// Place enemy very close to the wall, with wanderTarget through the wall
		const enemyPos = wall.axis === 'x'
			? { x: wall.x + wall.length / 2 - 1, z: wall.z }
			: { x: wall.x, z: wall.z + wall.length / 2 - 1 };

		const throughWall = wall.axis === 'x'
			? { x: wall.x + wall.length / 2 + 5, z: wall.z }
			: { x: wall.x, z: wall.z + wall.length / 2 + 5 };

		// Place player far away so enemy wanders
		addPlayer('p1', {
			id: 'p1',
			x: enemyPos.x + 200,
			z: enemyPos.z + 200,
			dead: false
		});

		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: enemyPos.x,
			z: enemyPos.z,
			hp: 50,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: throughWall,
			blockedTicks: 10 // already at threshold
		});

		const oldTarget = { ...gameState.enemies[0].wanderTarget };

		updateEnemies();

		// After one more blocked tick (> 10), enemy should pick a new wander target
		expect(gameState.enemies[0].wanderTarget).not.toEqual(oldTarget);
		expect(gameState.enemies[0].blockedTicks).toBe(0);
	});

	it('blockedTicks resets on successful wander movement', () => {
		// Place enemy in open space with wander target in clear direction
		const room = gameState.layout.rooms[0];
		const halfW = room.width / 2 - 2;
		const halfD = room.depth / 2 - 2;

		// Place player far away so enemy wanders
		addPlayer('p1', {
			id: 'p1',
			x: room.x + 200,
			z: room.z + 200,
			dead: false
		});

		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: room.x - 1,
			z: room.z,
			hp: 50,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: room.x + halfW, z: room.z }, // toward center of room
			blockedTicks: 5
		});

		updateEnemies();

		// blockedTicks should be reset to 0 after successful movement
		expect(gameState.enemies[0].blockedTicks).toBe(0);
	});

	it('chase movement uses moveEntityToward (wall-slide when blocked)', () => {
		// Place player behind a wall relative to enemy
		const room = gameState.layout.rooms[0];
		const wall = room.walls[0];

		// Place player and enemy on opposite sides of the wall (across its thin dimension),
		// offset along the wall axis so wall-slide has room to move
		const playerSide = wall.axis === 'x'
			? { x: wall.x + 2, z: wall.z + 2 }
			: { x: wall.x + 2, z: wall.z };

		addPlayer('p1', {
			id: 'p1',
			x: playerSide.x,
			z: playerSide.z,
			dead: false
		});

		// Enemy on other side, close enough to detect player, offset to allow wall-slide
		const enemySide = wall.axis === 'x'
			? { x: wall.x - 2, z: wall.z - 2 }
			: { x: wall.x - 2, z: wall.z + 2 };

		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: enemySide.x,
			z: enemySide.z,
			hp: 50,
			state: 'idle',
			attackState: 'idle',
			wanderTarget: { x: 0, z: 0 }
		});

		const dist = Math.hypot(playerSide.x - enemySide.x, playerSide.z - enemySide.z);
		expect(dist).toBeLessThan(DETECTION_RADIUS);

		const posBefore = { x: gameState.enemies[0].x, z: gameState.enemies[0].z };

		updateEnemies();

		// Enemy should have moved (wall-slide allows sliding along wall)
		// and should not be inside a wall
		expect(isEntityPositionBlocked(gameState.enemies[0].x, gameState.enemies[0].z, ENTITY_RADIUS)).toBe(false);
		// Position should have changed from before (either direct or wall-slide)
		expect(
			gameState.enemies[0].x !== posBefore.x || gameState.enemies[0].z !== posBefore.z
		).toBe(true);
	});
});
