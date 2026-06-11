import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { generateLayout } from '../dungeon.js';
import { createGameState } from '../game-state.js';

// Direct unit tests for exported helpers that the integration suites only
// exercise indirectly. Loaded via CJS require so the calls execute in the same
// module instances the server uses at runtime (and so the v8 coverage merge
// reliably attributes them — the ESM/CJS dual-load split otherwise drops these
// functions from the merged report even though socket suites do call them).
const require = createRequire(import.meta.url);
const sim = require('../simulation.js');
const prog = require('../progression.js');
const { LOBBY_REVIVE_HP } = require('../config.js');

const SEED = 1234;

function freshSimState() {
  const state = createGameState();
  state.layout = generateLayout(SEED, 'crowded');
  state.layoutSeed = SEED;
  state.dungeonBounds = sim.computeDungeonBounds(state.layout);
  sim.setGameState(state);
  return state;
}

function activePlayer(overrides = {}) {
  return {
    x: 0,
    y: 0.5,
    z: 0,
    rotation: 0,
    hp: 100,
    dead: false,
    extracted: false,
    ...overrides,
  };
}

describe('simulation.js helper units', () => {
  let state;

  beforeEach(() => {
    state = freshSimState();
    sim.setTerminalCheckCallback(() => {});
    sim.setFindSocketCallback(() => null);
  });

  it('enemyDefFor returns live defs and throws for unknown types', () => {
    expect(sim.enemyDefFor('riftbound_colossus').name).toBe('Riftbound Colossus');
    expect(() => sim.enemyDefFor('not_a_real_enemy')).toThrow(/Unknown enemy type/);
  });

  it('isEnemyFrozen tracks the frozenUntil timestamp', () => {
    expect(sim.isEnemyFrozen({})).toBe(false);
    expect(sim.isEnemyFrozen({ frozenUntil: Date.now() + 5000 })).toBe(true);
    expect(sim.isEnemyFrozen({ frozenUntil: Date.now() - 5000 })).toBe(false);
  });

  it('computeAimDirection3D returns a unit vector and a safe fallback', () => {
    const aim = sim.computeAimDirection3D({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 4 });
    expect(aim.dirX).toBeCloseTo(0.6);
    expect(aim.dirZ).toBeCloseTo(0.8);
    expect(Math.hypot(aim.dirX, aim.dirY, aim.dirZ)).toBeCloseTo(1);
    expect(
      sim.computeAimDirection3D({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3 }),
    ).toEqual({ dirX: 1, dirY: 0, dirZ: 0 });
  });

  it('segmentIntersectsAABB detects crossings and misses', () => {
    const aabb = { minX: -1, maxX: 1, minZ: -5, maxZ: 5 };
    expect(sim.segmentIntersectsAABB(-3, 0, 3, 0, aabb)).toBe(true);
    expect(sim.segmentIntersectsAABB(-3, 10, 3, 10, aabb)).toBe(false);
  });

  it('hasLineOfSight is blocked only by intervening colliders', () => {
    const wall = { minX: -1, maxX: 1, minZ: -5, maxZ: 5 };
    expect(sim.hasLineOfSight(-3, 0, 3, 0, [wall])).toBe(false);
    expect(sim.hasLineOfSight(-3, 0, 3, 0, [])).toBe(true);
  });

  it('rebuildMovementContext rebuilds from the live layout', () => {
    expect(sim.rebuildMovementContext(state)).toBeTruthy();
  });

  it('firstRoomPosition returns the start room center', () => {
    const startRoom = state.layout.rooms.find((r) => r.role === 'start') || state.layout.rooms[0];
    expect(sim.firstRoomPosition()).toEqual({ x: startRoom.x, z: startRoom.z });
  });

  it('randomRoomPosition and randomWanderTarget land inside a room', () => {
    for (const pos of [sim.randomRoomPosition(), sim.randomWanderTarget()]) {
      const containing = state.layout.rooms.find(
        (r) =>
          Math.abs(pos.x - r.x) <= r.width / 2 && Math.abs(pos.z - r.z) <= r.depth / 2,
      );
      expect(containing).toBeDefined();
    }
  });

  it('pickFloorSpawnPosition stays inside the start room', () => {
    const startRoom = state.layout.rooms.find((r) => r.role === 'start') || state.layout.rooms[0];
    const pos = sim.pickFloorSpawnPosition(state.layout, () => 0.5);
    expect(Math.abs(pos.x - startRoom.x)).toBeLessThanOrEqual(startRoom.width / 2);
    expect(Math.abs(pos.z - startRoom.z)).toBeLessThanOrEqual(startRoom.depth / 2);
  });

  it('nearbySpawnPosition stays within the requested radius', () => {
    const room = state.layout.rooms[0];
    const pos = sim.nearbySpawnPosition(room.x, room.z, 3);
    expect(Math.hypot(pos.x - room.x, pos.z - room.z)).toBeLessThanOrEqual(3.0001);
  });

  it('isEntityInEnemyAttack and isPlayerInEnemyAttack honor radial range', () => {
    const enemy = { x: 0, z: 0, attackStyle: 'radial', attackRange: 5 };
    expect(sim.isEntityInEnemyAttack(enemy, { x: 3, z: 0 })).toBe(true);
    expect(sim.isEntityInEnemyAttack(enemy, { x: 9, z: 0 })).toBe(false);
    expect(sim.isPlayerInEnemyAttack(enemy, { x: 3, z: 0 })).toBe(true);
  });

  it('healPlayer heals living players up to the cap and skips the dead', () => {
    state.players.p1 = activePlayer({ hp: 50 });
    state.players.p2 = activePlayer({ hp: 0, dead: true });
    expect(sim.healPlayer('p1', 20)).toBe(20);
    expect(state.players.p1.hp).toBe(70);
    expect(sim.healPlayer('p1', 9999)).toBeGreaterThan(0);
    const cappedHp = state.players.p1.hp;
    expect(sim.healPlayer('p1', 10)).toBe(0);
    expect(state.players.p1.hp).toBe(cappedHp);
    expect(sim.healPlayer('p2', 20)).toBe(0);
  });

  it('clearNegativeStatuses wipes slow/burn/freeze/debuffs', () => {
    const entity = {
      slowedUntil: Date.now() + 5000,
      slowFactor: 0.5,
      burningUntil: Date.now() + 5000,
      lastBurnTickAt: Date.now(),
      frozenUntil: Date.now() + 5000,
      debuffs: [{ type: 'weaken' }],
    };
    sim.clearNegativeStatuses(entity);
    expect(entity.slowedUntil).toBe(0);
    expect(entity.slowFactor).toBe(1);
    expect(entity.burningUntil).toBe(0);
    expect(entity.frozenUntil).toBe(0);
    expect(entity.debuffs).toEqual([]);
  });

  it('healPlayersInRadius heals and cleanses only players inside the sphere', () => {
    state.players.near = activePlayer({ hp: 40, slowedUntil: Date.now() + 5000 });
    state.players.far = activePlayer({ hp: 40, x: 50, z: 50 });
    const healed = sim.healPlayersInRadius(0, 0.5, 0, 5, 30);
    expect(healed).toEqual([{ playerId: 'near', hpGained: 30, cleansed: true }]);
    expect(state.players.near.hp).toBe(70);
    expect(state.players.near.slowedUntil).toBe(0);
    expect(state.players.far.hp).toBe(40);
  });

  it('addDebuff appends in insertion order and tolerates null', () => {
    const player = activePlayer();
    sim.addDebuff(player, 'weaken', 111);
    const second = sim.addDebuff(player, 'expose', 222);
    expect(player.debuffs.map((d) => d.type)).toEqual(['weaken', 'expose']);
    expect(second).toEqual({ type: 'expose', expiresAt: 222 });
    expect(sim.addDebuff(null, 'weaken', 1)).toBeNull();
  });

  it('updateBurning ticks interval-gated damage on burning players and enemies', () => {
    const now = Date.now();
    state.players.p1 = activePlayer({ hp: 60, burningUntil: now + 10000, lastBurnTickAt: now - 600 });
    state.enemies.push({ id: 'e1', type: 'grunt', x: 5, z: 5, hp: 50, burningUntil: now + 10000, lastBurnTickAt: now - 600 });
    sim.updateBurning();
    expect(state.players.p1.hp).toBe(55);
    expect(state.enemies[0].hp).toBe(45);
  });

  it('collectRadialHits damages enemies inside the sphere and reports gains', () => {
    state.enemies.push({ id: 'e1', type: 'grunt', x: 1, z: 1, hp: 50 });
    state.enemies.push({ id: 'e2', type: 'grunt', x: 40, z: 40, hp: 50 });
    const result = sim.collectRadialHits(0, 0.5, 0, 5, 20, { magicStoneOnHit: 2 });
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]).toMatchObject({ enemyId: 'e1', hp: 30 });
    expect(result.magicStonesGained).toBe(2);
    expect(state.enemies.find((e) => e.id === 'e2').hp).toBe(50);
  });

  it('collectProjectileHits damages the first enemy along the ray', () => {
    state.enemies.push({ id: 'e1', type: 'grunt', x: 5, z: 0, hp: 50 });
    const result = sim.collectProjectileHits(0, 0, 1, 0, 10, 15);
    expect(result.hits).toHaveLength(1);
    expect(state.enemies[0].hp).toBe(35);
  });

  it('collectChainLightningHits chains reduced damage to a nearby enemy', () => {
    state.enemies.push({ id: 'primary', type: 'grunt', x: 5, z: 0, hp: 50 });
    state.enemies.push({ id: 'chained', type: 'grunt', x: 7, z: 0, hp: 50 });
    const result = sim.collectChainLightningHits(0, 0, 1, 0, 10, 20);
    const ids = result.hits.map((h) => h.enemyId);
    expect(ids).toContain('primary');
    expect(ids).toContain('chained');
    expect(state.enemies.find((e) => e.id === 'primary').hp).toBe(30);
    expect(state.enemies.find((e) => e.id === 'chained').hp).toBe(40);
  });

  it('collectPhaseBeamHits pierces every enemy along the beam', () => {
    state.enemies.push({ id: 'e1', type: 'grunt', x: 4, z: 0, hp: 50 });
    state.enemies.push({ id: 'e2', type: 'grunt', x: 8, z: 0, hp: 50 });
    const result = sim.collectPhaseBeamHits(0, 0, 1, 0, 10, 12);
    expect(result.hits.map((h) => h.enemyId).sort()).toEqual(['e1', 'e2']);
    expect(state.enemies.every((e) => e.hp === 38)).toBe(true);
  });
});

describe('progression.js helper units', () => {
  let state;

  beforeEach(() => {
    state = createGameState();
    prog.setGameState(state);
  });

  it('key item helpers expose the catalog and honor the test override', () => {
    const all = prog.getUnlockedKeyItems();
    expect(all.length).toBeGreaterThan(0);
    const first = all[0];
    expect(prog.getKeyItemDef(first.id)).toBe(first);
    expect(prog.getKeyItemDef('not_a_key_item')).toBeUndefined();
    expect(prog.isKeyItemUnlocked({}, first.id)).toBe(true);
    expect(prog.isKeyItemUnlocked({}, 'not_a_key_item')).toBe(false);
    prog.setTestKeyItemUnlockOverride(() => false);
    expect(prog.isKeyItemUnlocked({}, first.id)).toBe(false);
    prog.setTestKeyItemUnlockOverride(null);
  });

  it('createInventoryFromCardIds mints unique instances for known cards', () => {
    const inventory = prog.createInventoryFromCardIds(['iron_sword', 'flame_blade']);
    expect(inventory).toHaveLength(2);
    expect(inventory.map((i) => i.cardId)).toEqual(['iron_sword', 'flame_blade']);
    expect(inventory[0].instanceId).not.toBe(inventory[1].instanceId);
  });

  it('cardIdForDeckEntry resolves instance ids, raw card ids, and rejects junk', () => {
    const inventory = [{ instanceId: 'i1', cardId: 'iron_sword' }];
    expect(prog.cardIdForDeckEntry('i1', inventory)).toBe('iron_sword');
    expect(prog.cardIdForDeckEntry('flame_blade', [])).toBe('flame_blade');
    expect(prog.cardIdForDeckEntry('not_a_card', [])).toBeNull();
  });

  it('findAvailableInventoryInstance skips instances already in the deck', () => {
    const inventory = [{ instanceId: 'i1', cardId: 'iron_sword' }];
    expect(prog.findAvailableInventoryInstance('iron_sword', [], inventory)).toBe(inventory[0]);
    expect(prog.findAvailableInventoryInstance('iron_sword', ['i1'], inventory)).toBeNull();
  });

  it('canAddCardInstanceToDeck blocks duplicates and unknown instances', () => {
    const inventory = [{ instanceId: 'i1', cardId: 'iron_sword' }];
    expect(prog.canAddCardInstanceToDeck('i1', [], inventory)).toBe(true);
    expect(prog.canAddCardInstanceToDeck('i1', ['i1'], inventory)).toBe(false);
    expect(prog.canAddCardInstanceToDeck('ghost', [], inventory)).toBe(false);
  });

  it('canAddCardToDeck enforces owned-copy counts', () => {
    expect(prog.canAddCardToDeck('iron_sword', [], { iron_sword: 1 })).toBe(true);
    expect(prog.canAddCardToDeck('iron_sword', ['iron_sword'], { iron_sword: 1 })).toBe(false);
    expect(prog.canAddCardToDeck('not_a_card', [], {})).toBe(false);
  });

  it('grind helpers scale costs and stats monotonically', () => {
    expect(prog.getGrindCost(1)).toBeGreaterThan(prog.getGrindCost(0));
    expect(prog.getStatMultiplier(0)).toBe(1);
    expect(prog.getStatMultiplier(2)).toBeGreaterThan(1);
    expect(prog.scaledGrindStat(10, 0)).toBe(10);
    expect(prog.scaledGrindStat(10, 4)).toBeGreaterThan(10);
  });

  it('applyWyrmMinionBreathStats primes breath fields from the card def', () => {
    const minion = {};
    const now = 1000000;
    prog.applyWyrmMinionBreathStats(minion, { breathIntervalMs: 2000, breathRange: 8 }, 0, now);
    expect(minion.breathIntervalMs).toBe(2000);
    expect(minion.lastBreathAt).toBe(now - 2000);
    expect(minion.breathRange).toBe(8);
    expect(minion.breathHoldDistance).toBeGreaterThan(0);
  });

  it('isPlayerActive and hasActivePlayers ignore dead/extracted players', () => {
    expect(prog.isPlayerActive(activePlayer())).toBe(true);
    expect(prog.isPlayerActive(activePlayer({ dead: true }))).toBe(false);
    expect(prog.isPlayerActive(activePlayer({ extracted: true }))).toBe(false);
    state.players.p1 = activePlayer({ dead: true });
    expect(prog.hasActivePlayers()).toBe(false);
    state.players.p2 = activePlayer();
    expect(prog.hasActivePlayers()).toBe(true);
  });

  it('getCardDef resolves catalog cards and rejects unknowns', () => {
    expect(prog.getCardDef('iron_sword')).toBeTruthy();
    expect(prog.getCardDef('not_a_card')).toBeNull();
  });

  it('drawCardIntoHand returns null when both decks are empty', () => {
    const player = activePlayer({ hand: [], deck: [], desperationDeck: [] });
    expect(prog.drawCardIntoHand(player)).toBeNull();
    expect(player.hand.every((slot) => slot === null)).toBe(true);
  });

  it('exhaustHandSlot records the consumed card and empties the slot', () => {
    const player = activePlayer({ hand: [], deck: [], desperationDeck: [], exhaustedCards: [] });
    prog.exhaustHandSlot(player, 0, { id: 'iron_sword', charges: 3 });
    expect(player.hand[0]).toBeNull();
    expect(player.exhaustedCards).toHaveLength(1);
    expect(player.exhaustedCards[0].id).toBe('iron_sword');
  });

  it('discardHandSlot clears the slot without recording an exhaust', () => {
    const player = activePlayer({
      hand: [{ id: 'iron_sword' }],
      deck: [],
      desperationDeck: [],
      exhaustedCards: [],
    });
    prog.discardHandSlot(player, 0);
    expect(player.hand[0]).toBeNull();
    expect(player.exhaustedCards).toHaveLength(0);
  });

  it('validateUseCardHand rejects bad slots and missing cards', () => {
    expect(prog.validateUseCardHand(activePlayer({ hand: [] }), -1, 'iron_sword').valid).toBe(false);
    expect(
      prog.validateUseCardHand(activePlayer({ hand: [null] }), 0, 'iron_sword').valid,
    ).toBe(false);
  });

  it('validateDiscardHand accepts a held card and rejects active creatures', () => {
    const held = prog.validateDiscardHand(
      activePlayer({ hand: [{ id: 'iron_sword' }] }),
      0,
      'iron_sword',
    );
    expect(held.valid).toBe(true);
    const burning = prog.validateDiscardHand(
      activePlayer({ hand: [{ id: 'battle_familiar', activeMinionId: 'm1' }] }),
      0,
      'battle_familiar',
    );
    expect(burning.valid).toBe(false);
  });

  it('discardCardFromHand discards through validation', () => {
    const player = activePlayer({ hand: [{ id: 'iron_sword' }], deck: [], desperationDeck: [] });
    expect(prog.discardCardFromHand(player, 0, 'iron_sword')).toEqual({ valid: true });
    expect(player.hand[0]).toBeNull();
    expect(prog.discardCardFromHand(player, 0, 'iron_sword').valid).toBe(false);
  });

  it('processPassiveDraws clears the timer when no draw is possible', () => {
    state.gamePhase = 'playing';
    state.players.p1 = activePlayer({
      hand: [],
      deck: [],
      desperationDeck: [],
      nextDrawAt: Date.now() - 1000,
    });
    prog.processPassiveDraws(Date.now());
    expect(state.players.p1.nextDrawAt).toBeNull();
  });

  it('addMagicStones adds up to the cap and rejects junk amounts', () => {
    const player = activePlayer({ magicStones: 5 });
    const gained = prog.addMagicStones(player, 10);
    expect(gained).toBeGreaterThan(0);
    expect(player.magicStones).toBe(5 + gained);
    expect(prog.addMagicStones(player, -3)).toBe(0);
    expect(prog.addMagicStones(null, 5)).toBe(0);
  });

  it('restoreCardCharges refills up to the printed charge count', () => {
    const card = { charges: 3, remainingCharges: 1 };
    expect(prog.restoreCardCharges(card, 1)).toBe(1);
    expect(card.remainingCharges).toBe(2);
    expect(prog.restoreCardCharges(card, 99)).toBe(1);
    expect(card.remainingCharges).toBe(3);
  });

  it('restoreHandCharges restores a depleted hand card in place', () => {
    const player = activePlayer({
      hand: [{ id: 'iron_sword', type: 'weapon', charges: 3, remainingCharges: 1 }],
    });
    const restored = prog.restoreHandCharges(player, 1);
    expect(Array.isArray(restored)).toBe(true);
    expect(player.hand[0].remainingCharges).toBe(2);
  });

  it('createEchoCard builds a half-damage single-charge echo', () => {
    const echo = prog.createEchoCard({ id: 'iron_sword', grind: 0 });
    expect(echo.isEcho).toBe(true);
    expect(echo.remainingCharges).toBe(1);
    const def = prog.getCardDef('iron_sword');
    if (def.damage != null) {
      expect(echo.echoDamage).toBe(Math.max(1, Math.floor(def.damage * 0.5)));
    }
  });

  it('clampObjectiveProgress caps defeatedEnemies at totalEnemies', () => {
    const run = { objective: { type: 'defeat_enemies', totalEnemies: 3, defeatedEnemies: 9 } };
    prog.clampObjectiveProgress(run);
    expect(run.objective.defeatedEnemies).toBe(3);
  });

  it('syncRunObjectiveToEnemies tolerates objectives without a sync hook', () => {
    state.run = { objective: { type: 'stage_boss', bossDefeated: false } };
    expect(() => prog.syncRunObjectiveToEnemies()).not.toThrow();
  });

  it('persistenceKey prefers accountId and falls back to the player id', () => {
    state.players.p1 = activePlayer({ accountId: 'acct-zz' });
    expect(prog.persistenceKey('p1')).toBe('acct-zz');
    expect(prog.persistenceKey('ghost')).toBe('ghost');
  });

  it('createPlayerProgress and extractPersistentData round-trip the defaults', () => {
    const progress = prog.createPlayerProgress();
    expect(progress.equippedKeyItemId).toBe('dodge_roll');
    const player = activePlayer({ ...progress });
    const persisted = prog.extractPersistentData(player);
    expect(Array.isArray(persisted.inventory)).toBe(true);
    expect(persisted.equippedKeyItemId).toBe('dodge_roll');
    expect(persisted.dead).toBe(false);
  });

  it('buildPlayerDeckUpdatePayload returns a payload object for a player', () => {
    const player = activePlayer({ ...prog.createPlayerProgress(), hand: [] });
    const payload = prog.buildPlayerDeckUpdatePayload(player);
    expect(payload).toBeTruthy();
    expect(typeof payload).toBe('object');
  });

  it('validateDeck rejects oversized decks and accepts the default loadout', () => {
    const oversized = prog.validateDeck(
      Array(25).fill('iron_sword'),
      { iron_sword: 25 },
    );
    expect(oversized.valid).toBe(false);
    const undersized = prog.validateDeck(['iron_sword'], { iron_sword: 1 });
    expect(undersized.valid).toBe(false);
    const progress = prog.createPlayerProgress();
    const starterDeck = progress.inventory.map((instance) => instance.instanceId);
    expect(prog.validateDeck(starterDeck, progress.inventory).valid).toBe(true);
  });

  it('revivePlayerInLobby restores dead players for redeploy', () => {
    const player = activePlayer({ dead: true, hp: 0 });
    prog.revivePlayerInLobby(player);
    expect(player.dead).toBe(false);
    expect(player.hp).toBe(LOBBY_REVIVE_HP);
    const living = activePlayer({ hp: 80 });
    prog.revivePlayerInLobby(living);
    expect(living.hp).toBe(80);
  });

  it('healAtMedic charges gold in the lobby and provides charity heal when broke', () => {
    state.gamePhase = 'lobby';
    state.players.rich = activePlayer({ hp: 40, currency: 1000 });
    state.players.broke = activePlayer({ hp: 40, currency: 0 });
    const healed = prog.healAtMedic('rich', state);
    expect(healed.ok).toBe(true);
    expect(healed.cost).toBe(10);
    expect(state.players.rich.hp).toBeGreaterThan(40);
    expect(state.players.rich.currency).toBeLessThan(1000);
    expect(prog.healAtMedic('broke', state)).toMatchObject({ ok: true, cost: 0 });
    expect(state.players.broke.currency).toBe(0);
  });

  it('resetTransientRunState clears world arrays and the telepipe', () => {
    state.enemies.push({ id: 'e1', hp: 10 });
    state.loot.push({ id: 'l1' });
    state.telepipe = { x: 1, z: 1 };
    prog.resetTransientRunState();
    expect(state.enemies).toEqual([]);
    expect(state.loot).toEqual([]);
    expect(state.telepipe).toBeNull();
  });
});
