import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	gameState,
	CARD_DEFS,
	damagePlayer,
	spawnGroundEnchantment,
	armSelfEnchantment,
	updateEnchantments,
	updateMinions,
	runGameLoopTick,
	io as serverIo,
} from '../index.js';

const { createLobby, resetAllLobbies } = require('../lobbies.js');

function resetState() {
	gameState.players = {};
	gameState.enemies = [];
	gameState.minions = [];
	gameState.loot = [];
	gameState.areaEffects = [];
	gameState.enchantments = [];
	gameState.lobby = [];
	gameState.gamePhase = 'playing';
	gameState.run = { status: 'playing' };
	gameState._pendingMirrorReflects = [];
}

describe('enchantment cards', () => {
	beforeEach(resetState);

	afterEach(() => {
		resetAllLobbies();
		vi.restoreAllMocks();
	});

	it('spike_trap triggers when an enemy enters radius', () => {
		gameState.players.p1 = {
			x: 0,
			z: 0,
			hp: 100,
			dead: false,
			activeEnchantment: null,
		};
		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: 10,
			z: 0,
			hp: 50,
			attackState: 'idle',
		});

		spawnGroundEnchantment(0, 0, CARD_DEFS.spike_trap, 'p1');
		expect(gameState.enchantments).toHaveLength(1);

		gameState.enemies[0].x = 0.5;
		gameState.enemies[0].z = 0;
		updateEnchantments();

		expect(gameState.enchantments).toHaveLength(0);
		expect(gameState.enemies[0].hp).toBe(11);
	});

	it('cinder_snare drops a ticking inferno DoT when an enemy enters radius', () => {
		gameState.players.p1 = {
			x: 0,
			z: 0,
			hp: 100,
			dead: false,
			activeEnchantment: null,
		};
		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: 10,
			z: 0,
			hp: 50,
			attackState: 'idle',
		});

		spawnGroundEnchantment(0, 0, CARD_DEFS.cinder_snare, 'p1');
		expect(gameState.enchantments).toHaveLength(1);

		// Trap not consumed until an enemy actually enters.
		updateEnchantments();
		expect(gameState.enchantments).toHaveLength(1);
		expect(gameState.areaEffects).toHaveLength(0);

		gameState.enemies[0].x = 0.5;
		gameState.enemies[0].z = 0;
		updateEnchantments();

		// Trap disarmed and an inferno_pillar area effect spawned at trap pos.
		expect(gameState.enchantments).toHaveLength(0);
		expect(gameState.areaEffects).toHaveLength(1);
		const area = gameState.areaEffects[0];
		expect(area.type).toBe('inferno_pillar');
		expect(area.originX).toBe(0);
		expect(area.originZ).toBe(0);
		expect(area.damagePerTick).toBe(CARD_DEFS.cinder_snare.damagePerTick);
		expect(area.ticksRemaining).toBe(CARD_DEFS.cinder_snare.dotTicks);

		// Advancing the tick loop damages the enemy repeatedly (sustained DoT).
		const hpStart = gameState.enemies[0].hp;
		gameState.areaEffects[0].lastTickAt = Date.now() - CARD_DEFS.cinder_snare.dotIntervalMs;
		updateMinions();
		const hpAfterTick1 = gameState.enemies[0].hp;
		expect(hpAfterTick1).toBe(hpStart - CARD_DEFS.cinder_snare.damagePerTick);

		gameState.areaEffects[0].lastTickAt = Date.now() - CARD_DEFS.cinder_snare.dotIntervalMs;
		updateMinions();
		expect(gameState.enemies[0].hp).toBe(hpAfterTick1 - CARD_DEFS.cinder_snare.damagePerTick);
	});

	it('cinder_snare DoT attributes kill credit to the trap owner', () => {
		// A DoT kill runs the defeat bookkeeping, which reads run.objective.
		gameState.run = {
			status: 'playing',
			objective: { type: 'defeat_enemies', current: 0, target: 1 },
		};
		gameState.players.p1 = {
			x: 0,
			z: 0,
			hp: 100,
			dead: false,
			activeEnchantment: null,
		};
		// Low-HP enemy so a single DoT tick kills it.
		const enemy = {
			id: 'e1',
			type: 'grunt',
			x: 0.5,
			z: 0,
			hp: CARD_DEFS.cinder_snare.damagePerTick,
			attackState: 'idle',
		};
		gameState.enemies.push(enemy);

		spawnGroundEnchantment(0, 0, CARD_DEFS.cinder_snare, 'p1');
		updateEnchantments();
		expect(gameState.areaEffects).toHaveLength(1);

		// Advance the DoT tick so it lands and kills the enemy. The dead enemy is
		// pruned from gameState.enemies, so assert against the held reference.
		gameState.areaEffects[0].lastTickAt = Date.now() - CARD_DEFS.cinder_snare.dotIntervalMs;
		updateMinions();

		// Drop credit is attributed to the trap owner via lastDamagedBy.
		expect(enemy.hp).toBeLessThanOrEqual(0);
		expect(enemy.lastDamagedBy).toBe('p1');
	});

	it('spike_trap expires after ttl when untriggered', () => {
		spawnGroundEnchantment(0, 0, CARD_DEFS.spike_trap, 'p1');
		gameState.enchantments[0].expiresAt = Date.now() - 1;
		updateEnchantments();
		expect(gameState.enchantments).toHaveLength(0);
	});

	it('mirror_ward reflectRange matches balance target', () => {
		expect(CARD_DEFS.mirror_ward.reflectRange).toBe(11);
	});

	it('mirror_ward reflects damage back to the attacking enemy', () => {
		gameState.players.p1 = {
			x: 0,
			z: 0,
			hp: 100,
			dead: false,
			activeEnchantment: null,
		};
		gameState.enemies.push({
			id: 'e1',
			type: 'grunt',
			x: 2,
			z: 0,
			hp: 50,
			attackState: 'idle',
		});

		armSelfEnchantment(gameState.players.p1, CARD_DEFS.mirror_ward);
		const result = damagePlayer('p1', 20, { attackerEnemyId: 'e1' });

		expect(gameState.players.p1.hp).toBe(80);
		expect(gameState.players.p1.activeEnchantment).toBeNull();
		expect(result).toBeTruthy();
		expect(result.reflectDamage).toBeGreaterThanOrEqual(15);
		expect(gameState.enemies[0].hp).toBeLessThan(50);
		expect(gameState._pendingMirrorReflects).toHaveLength(1);
		expect(gameState._pendingMirrorReflects[0]).toMatchObject({
			cardId: 'mirror_ward',
			playerId: 'p1',
			origin: { x: 0, z: 0 },
			reflectTriggered: true,
			direction: { x: 1, z: 0 },
			reflectDamage: result.reflectDamage,
		});
		expect(gameState._pendingMirrorReflects[0].hits).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ enemyId: 'e1', damage: result.reflectDamage }),
			]),
		);
	});

	it('mirror_ward pending reflect drains as cardUsed on game loop tick', () => {
		resetAllLobbies();
		const lobby = createLobby('Mirror Ward Reflect');
		lobby.state.gamePhase = 'playing';
		lobby.state.run = { status: 'playing' };
		lobby.state._pendingMirrorReflects = [{
			cardId: 'mirror_ward',
			playerId: 'p1',
			origin: { x: 0, z: 0 },
			reflectTriggered: true,
			direction: { x: 1, z: 0 },
			hits: [{ enemyId: 'e1', damage: 17 }],
			reflectDamage: 17,
		}];

		const roomEmit = vi.fn();
		vi.spyOn(serverIo, 'to').mockReturnValue({ emit: roomEmit });

		runGameLoopTick();

		expect(serverIo.to).toHaveBeenCalledWith(lobby.id);
		expect(roomEmit).toHaveBeenCalledWith('cardUsed', expect.objectContaining({
			cardId: 'mirror_ward',
			playerId: 'p1',
			reflectTriggered: true,
			hits: [{ enemyId: 'e1', damage: 17 }],
			reflectDamage: 17,
		}));
		expect(lobby.state._pendingMirrorReflects).toHaveLength(0);
	});

	it('mirror_ward expires when ttl elapses without taking damage', () => {
		gameState.players.p1 = {
			x: 0,
			z: 0,
			hp: 100,
			dead: false,
			activeEnchantment: null,
		};
		armSelfEnchantment(gameState.players.p1, CARD_DEFS.mirror_ward);
		gameState.players.p1.activeEnchantment.expiresAt = Date.now() - 1;
		updateMinions();
		expect(gameState.players.p1.activeEnchantment).toBeNull();
	});
});
