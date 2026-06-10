// Spherical AoE verification suite — one labeled block per AoE/radius card,
// each driven with the card's REAL merged stats from CARD_DEFS (cardDefs.json
// + cardStats.json) or ENEMY_DEFS / VARIANT_DEFS. Every block asserts both
// directions of the sphere check:
//   (a) a target at a different height (dy ≠ 0) whose 3D distance is ≤ the
//       radius IS affected, and
//   (b) a target whose XZ distance is ≤ the radius but whose 3D distance
//       exceeds it is NOT affected.
// This is the regression net for flying/elevated enemies — if any radius
// check regresses to 2D (XZ-only), direction (b) fails.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	CARD_DEFS,
	ENEMY_DEFS,
	MAX_MAGIC_STONES,
	SUMMON_RADIUS,
	createGameState,
	gameState,
	resetGameState,
	spawnEnemy,
	applyFreezeInRadius,
	isEnemyFrozen,
	healPlayersInRadius,
	pullEnemiesToward,
	applyEventHorizon,
	collectRadialHits,
	collectConeHits,
	updateAreaEffects,
	spawnInfernoPillarEffect,
	spawnDragonsBreathEffect,
	spawnVolatileExplosion,
	isEntityInEnemyAttack,
	healFieldMedicAlly,
	findSacrificeTarget,
	resolveProjectileAim,
	computeWalkableAABBs,
	rebuildWallColliders,
} from '../index.js';
import { handleUseCard, setCallbacks as setCardEffectCallbacks } from '../cardEffects.js';
import { SERVER_TO_CLIENT } from '../../shared/events.js';
import { VARIANT_DEFS } from '../enemyVariants.js';

// With no layout in gameState, the floor fallback resolves to DEFAULT_FLOOR_Y.
const FLOOR_Y = 0.5;

function resetState() {
	Object.assign(gameState, createGameState());
	// Keys createGameState() does not emit — clear them explicitly so a prior
	// describe's resetGameState() layout cannot leak into these tests.
	gameState.layout = null;
	gameState.dungeonBounds = null;
	gameState.walkableAABBs = null;
	gameState.run = null;
	gameState.gamePhase = 'playing';
}

function addPlayer(id, overrides = {}) {
	gameState.players[id] = {
		x: 0,
		y: FLOOR_Y,
		z: 0,
		rotation: 0,
		hp: 100,
		dead: false,
		extracted: false,
		debuffs: [],
		...overrides,
	};
	return gameState.players[id];
}

function addEnemy(id, overrides = {}) {
	const enemy = { id, type: 'grunt', x: 0, z: 0, hp: 40, ...overrides };
	gameState.enemies.push(enemy);
	return enemy;
}

// pullEnemiesToward displaces via tryEntityDisplacement, which only moves
// entities inside a walkable area — give the pull tests a flat open room.
function setupWalkableRoom() {
	gameState.layout = {
		rooms: [{ x: 0, z: 0, width: 40, depth: 40, walls: [] }],
		passages: [],
	};
	gameState.dungeonBounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
	gameState.walkableAABBs = computeWalkableAABBs(gameState.layout);
	rebuildWallColliders();
}

afterEach(() => {
	vi.useRealTimers();
});

describe('frost_nova — freeze radius is a 3D sphere', () => {
	const def = CARD_DEFS.frost_nova;
	// Production resolves the freeze radius as cardDef.radius || SUMMON_RADIUS
	// (cardEffects.js frost_nova/glacier_collapse branch).
	const radius = def.radius || SUMMON_RADIUS;

	beforeEach(resetState);

	it('freezes and damages an elevated enemy inside the sphere', () => {
		// 3D distance hypot(6, 6) ≈ 8.49 ≤ 10.
		const lifted = addEnemy('lifted', { x: 6, z: 0, y: FLOOR_Y + 6 });
		const hits = applyFreezeInRadius(
			0, FLOOR_Y, 0, radius, def.freezeDurationMs, def.damage, def.frozenBonusDamage || 0,
		);
		expect(hits).toEqual([{ enemyId: 'lifted', hp: 40 - def.damage }]);
		expect(lifted.hp).toBe(40 - def.damage);
		expect(isEnemyFrozen(lifted)).toBe(true);
	});

	it('skips an enemy XZ-inside the radius but outside the sphere', () => {
		// XZ distance 9 ≤ 10, but 3D distance hypot(9, 9) ≈ 12.73 > 10.
		const high = addEnemy('high', { x: 9, z: 0, y: FLOOR_Y + 9 });
		const hits = applyFreezeInRadius(
			0, FLOOR_Y, 0, radius, def.freezeDurationMs, def.damage, def.frozenBonusDamage || 0,
		);
		expect(hits).toHaveLength(0);
		expect(high.hp).toBe(40);
		expect(isEnemyFrozen(high)).toBe(false);
	});
});

describe('glacier_collapse — shatter radius is a 3D sphere', () => {
	const def = CARD_DEFS.glacier_collapse;
	const radius = def.radius || SUMMON_RADIUS;

	beforeEach(resetState);

	it('shatters an elevated pre-frozen enemy inside the sphere for bonus damage', () => {
		const frozen = addEnemy('frozen', {
			x: 6, z: 0, y: FLOOR_Y + 6, hp: 60, frozenUntil: Date.now() + 5000,
		});
		const hits = applyFreezeInRadius(
			0, FLOOR_Y, 0, radius, def.freezeDurationMs, def.damage, def.frozenBonusDamage,
		);
		expect(hits).toEqual([
			{ enemyId: 'frozen', hp: 60 - def.damage - def.frozenBonusDamage, frozenShatter: true },
		]);
		expect(frozen.hp).toBe(60 - def.damage - def.frozenBonusDamage);
	});

	it('hits an elevated unfrozen enemy for base damage and freezes it', () => {
		const lifted = addEnemy('lifted', { x: 0, z: 6, y: FLOOR_Y + 6 });
		const hits = applyFreezeInRadius(
			0, FLOOR_Y, 0, radius, def.freezeDurationMs, def.damage, def.frozenBonusDamage,
		);
		expect(hits).toEqual([{ enemyId: 'lifted', hp: 40 - def.damage }]);
		expect(isEnemyFrozen(lifted)).toBe(true);
	});

	it('spares a pre-frozen enemy XZ-inside the radius but outside the sphere', () => {
		// XZ distance 9 ≤ 10, but 3D distance hypot(9, 9) ≈ 12.73 > 10.
		const high = addEnemy('high', {
			x: 9, z: 0, y: FLOOR_Y + 9, frozenUntil: Date.now() + 5000,
		});
		const hits = applyFreezeInRadius(
			0, FLOOR_Y, 0, radius, def.freezeDurationMs, def.damage, def.frozenBonusDamage,
		);
		expect(hits).toHaveLength(0);
		expect(high.hp).toBe(40);
	});
});

describe('purifying_pulse — heal radius is a 3D sphere', () => {
	const def = CARD_DEFS.purifying_pulse;

	beforeEach(resetState);

	it('heals an elevated player inside the sphere', () => {
		// 3D distance hypot(3.3, 3.3) ≈ 4.67 ≤ 5.5.
		addPlayer('lifted', { x: 3.3, z: 0, y: FLOOR_Y + 3.3, hp: 50 });
		const healed = healPlayersInRadius(0, FLOOR_Y, 0, def.radius, def.healAmount);
		expect(healed).toEqual([
			{ playerId: 'lifted', hpGained: def.healAmount, cleansed: true },
		]);
		expect(gameState.players.lifted.hp).toBe(50 + def.healAmount);
	});

	it('skips a player XZ-inside the radius but outside the sphere', () => {
		// XZ distance 4.95 ≤ 5.5, but 3D distance hypot(4.95, 4.95) ≈ 7.0 > 5.5.
		addPlayer('high', { x: 4.95, z: 0, y: FLOOR_Y + 4.95, hp: 50 });
		const healed = healPlayersInRadius(0, FLOOR_Y, 0, def.radius, def.healAmount);
		expect(healed).toEqual([]);
		expect(gameState.players.high.hp).toBe(50);
	});
});

describe('gravity_well — pull radius is a 3D sphere', () => {
	const def = CARD_DEFS.gravity_well;

	beforeEach(() => {
		resetState();
		setupWalkableRoom();
	});

	it('pulls an elevated enemy inside the sphere along XZ only', () => {
		// 3D distance hypot(7, 7) ≈ 9.9 ≤ 12.
		const lifted = addEnemy('lifted', { x: 7, z: 0, y: FLOOR_Y + 7 });
		const moved = pullEnemiesToward(0, FLOOR_Y, 0, def.pullRadius, def.pullStrength);
		expect(moved.map((m) => m.enemyId)).toEqual(['lifted']);
		expect(lifted.x).toBeCloseTo(7 - def.pullStrength);
		expect(lifted.z).toBe(0);
		expect(lifted.y).toBe(FLOOR_Y + 7);
	});

	it('ignores an enemy XZ-inside the radius but outside the sphere', () => {
		// XZ distance 10 ≤ 12, but 3D distance hypot(10, 8) ≈ 12.81 > 12.
		const high = addEnemy('high', { x: 10, z: 0, y: FLOOR_Y + 8 });
		const moved = pullEnemiesToward(0, FLOOR_Y, 0, def.pullRadius, def.pullStrength);
		expect(moved).toHaveLength(0);
		expect(high.x).toBe(10);
	});
});

describe('event_horizon — pull and center-crush spheres are both 3D', () => {
	const def = CARD_DEFS.event_horizon;

	beforeEach(() => {
		resetState();
		setupWalkableRoom();
	});

	it('pull sphere: drags an elevated enemy inside pullRadius, ignores an XZ-close one above it', () => {
		// edge: 3D distance hypot(8, 6) = 10 ≤ pullRadius 12.
		const edge = addEnemy('edge', { x: 8, z: 0, y: FLOOR_Y + 6 });
		// aloft: XZ distance 4 ≤ 12, but 3D distance hypot(4, 12) ≈ 12.65 > 12.
		const aloft = addEnemy('aloft', { x: 4, z: 0, y: FLOOR_Y + 12 });

		const { pulled, crushed } = applyEventHorizon(0, FLOOR_Y, 0, def, 'p1');

		expect(pulled.map((m) => m.enemyId)).toEqual(['edge']);
		expect(edge.x).toBeCloseTo(8 - def.pullStrength);
		expect(edge.y).toBe(FLOOR_Y + 6);
		expect(aloft.x).toBe(4);
		expect(crushed).toHaveLength(0);
		expect(edge.hp).toBe(40);
		expect(aloft.hp).toBe(40);
	});

	it('crush sphere: crushes a lifted enemy inside centerRadius, spares one XZ-inside but above it', () => {
		// core: pulled to the origin first, then crush distance dy 1.5 ≤ centerRadius 2.5.
		const core = addEnemy('core', { x: 1.5, z: 0, y: FLOOR_Y + 1.5 });
		// hover: also pulled to the origin XZ, but crush distance dy 2.6 > 2.5 —
		// XZ-inside the crush sphere yet excluded by height alone.
		const hover = addEnemy('hover', { x: 2, z: 0, y: FLOOR_Y + 2.6 });

		const { crushed } = applyEventHorizon(0, FLOOR_Y, 0, def, 'p1');

		expect(crushed).toEqual([{ enemyId: 'core', hp: 40 - def.centerDamage, magicStonesGained: 0 }]);
		expect(core.hp).toBe(40 - def.centerDamage);
		expect(hover.hp).toBe(40);
	});
});

describe('inferno_pillar — burst and persistent ticks are 3D spheres', () => {
	const def = CARD_DEFS.inferno_pillar;

	beforeEach(resetState);

	it('initial burst damages an elevated enemy inside attackRange, skips an XZ-close one outside it', () => {
		// lifted: 3D distance hypot(4.2, 4.2) ≈ 5.94 ≤ 7.
		const lifted = addEnemy('lifted', { x: 4.2, z: 0, y: FLOOR_Y + 4.2 });
		// high: XZ distance 6.3 ≤ 7, but 3D distance hypot(6.3, 6.3) ≈ 8.91 > 7.
		const high = addEnemy('high', { x: 6.3, z: 0, y: FLOOR_Y + 6.3 });

		const { hits } = collectRadialHits(0, FLOOR_Y, 0, def.attackRange, def.damage, {
			attackerId: 'p1',
		});

		expect(hits.map((h) => h.enemyId)).toEqual(['lifted']);
		expect(lifted.hp).toBe(40 - def.damage);
		expect(high.hp).toBe(40);
	});

	it('persistent DoT ticks keep the same spherical inclusion across multiple ticks', () => {
		const t0 = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(t0);
		// lifted: 3D distance hypot(3, 4) = 5 ≤ 7.
		const lifted = addEnemy('lifted', { x: 3, z: 0, y: FLOOR_Y + 4 });
		// high: XZ distance 0, but 3D distance 8 > 7.
		const high = addEnemy('high', { x: 0, z: 0, y: FLOOR_Y + 8 });
		spawnInfernoPillarEffect(0, 0, def, 'p1', FLOOR_Y);

		vi.setSystemTime(t0 + def.dotIntervalMs + 50);
		updateAreaEffects();
		expect(lifted.hp).toBe(40 - def.damage);
		expect(high.hp).toBe(40);

		vi.setSystemTime(t0 + 2 * def.dotIntervalMs + 100);
		updateAreaEffects();
		expect(lifted.hp).toBe(40 - 2 * def.damage);
		expect(high.hp).toBe(40);
	});
});

describe('dragons_breath — burst cone and persistent ticks use 3D range', () => {
	const def = CARD_DEFS.dragons_breath;

	beforeEach(resetState);

	it('initial burst with an up-tilted aim hits an elevated on-axis enemy, excludes one beyond 3D range', () => {
		// Aim 45° upward along +X so both targets sit dead-center on the cone axis —
		// inclusion/exclusion is decided purely by the 3D range gate.
		const dirX = Math.SQRT1_2;
		const dirY = Math.SQRT1_2;
		// onAxis: 3D distance hypot(4, 4) ≈ 5.66 ≤ 7.
		const onAxis = addEnemy('onAxis', { x: 4, z: 0, y: FLOOR_Y + 4 });
		// farAxis: XZ distance 5.5 ≤ 7, but 3D distance hypot(5.5, 5.5) ≈ 7.78 > 7.
		const farAxis = addEnemy('farAxis', { x: 5.5, z: 0, y: FLOOR_Y + 5.5 });

		const { hits } = collectConeHits(
			0, 0, dirX, 0, def.attackRange, def.attackConeAngle, def.damage,
			{ attackerId: 'p1', originY: FLOOR_Y, dirY },
		);

		expect(hits.map((h) => h.enemyId)).toEqual(['onAxis']);
		expect(onAxis.hp).toBe(40 - def.damage);
		expect(farAxis.hp).toBe(40);
	});

	it('persistent DoT ticks hit an elevated in-cone enemy and respect the 3D range', () => {
		const t0 = 1_000_000;
		vi.useFakeTimers();
		vi.setSystemTime(t0);
		// inCone: 3D distance hypot(5, 2) ≈ 5.39 ≤ 7, inside the 60° cone.
		const inCone = addEnemy('inCone', { x: 5, z: 0, y: FLOOR_Y + 2 });
		// tooHigh: XZ distance 2 ≤ 7, but 3D distance hypot(2, 7) ≈ 7.28 > 7.
		const tooHigh = addEnemy('tooHigh', { x: 2, z: 0, y: FLOOR_Y + 7 });
		spawnDragonsBreathEffect(0, 0, 1, 0, def, 'p1', { originY: FLOOR_Y, dirY: 0 });

		vi.setSystemTime(t0 + def.dotIntervalMs + 50);
		updateAreaEffects();
		expect(inCone.hp).toBe(40 - def.damage);
		expect(tooHigh.hp).toBe(40);

		vi.setSystemTime(t0 + 2 * def.dotIntervalMs + 100);
		updateAreaEffects();
		expect(inCone.hp).toBe(40 - 2 * def.damage);
		expect(tooHigh.hp).toBe(40);
	});
});

describe('volatile_explosion — enemy on-death blast is a 3D sphere', () => {
	const def = VARIANT_DEFS.volatile;

	beforeEach(resetState);

	it('damages an elevated player inside the blast sphere', () => {
		// 3D distance hypot(3, 3) ≈ 4.24 ≤ 5.
		addPlayer('lifted', { x: 3, z: 0, y: FLOOR_Y + 3 });
		spawnVolatileExplosion(0, 0, def);
		updateAreaEffects();
		expect(gameState.players.lifted.hp).toBe(100 - def.damage);
	});

	it('spares a player XZ-inside the radius but outside the sphere', () => {
		// XZ distance 4.5 ≤ 5, but 3D distance hypot(4.5, 4.5) ≈ 6.36 > 5.
		addPlayer('high', { x: 4.5, z: 0, y: FLOOR_Y + 4.5 });
		spawnVolatileExplosion(0, 0, def);
		updateAreaEffects();
		expect(gameState.players.high.hp).toBe(100);
	});
});

describe('radial enemy attack — isEntityInEnemyAttack range is a 3D sphere', () => {
	const def = ENEMY_DEFS.annex_overseer;

	beforeEach(resetState);

	function makeRadialEnemy() {
		return {
			id: 'overseer',
			type: 'annex_overseer',
			x: 0,
			y: FLOOR_Y,
			z: 0,
			attackStyle: def.attackStyle,
			attackRange: def.attackRange,
		};
	}

	it('hits an elevated target inside the attack sphere', () => {
		// 3D distance hypot(2.1, 2.1) ≈ 2.97 ≤ 3.5.
		const target = { x: 2.1, z: 0, y: FLOOR_Y + 2.1, hp: 100, dead: false };
		expect(isEntityInEnemyAttack(makeRadialEnemy(), target)).toBe(true);
	});

	it('misses a target XZ-inside attackRange but outside the sphere', () => {
		// XZ distance 2.8 ≤ 3.5, but 3D distance hypot(2.8, 2.8) ≈ 3.96 > 3.5.
		const target = { x: 2.8, z: 0, y: FLOOR_Y + 2.8, hp: 100, dead: false };
		expect(isEntityInEnemyAttack(makeRadialEnemy(), target)).toBe(false);
	});
});

describe('field medic — healRadius is a 3D sphere', () => {
	const def = ENEMY_DEFS.field_medic;

	beforeEach(() => {
		resetGameState();
		gameState.run = { status: 'playing' };
	});

	it('heals an elevated wounded ally inside the sphere', () => {
		const medic = spawnEnemy(0, 0, 'field_medic');
		medic.y = FLOOR_Y;
		// 3D distance hypot(3.6, 3.6) ≈ 5.09 ≤ healRadius 6.
		const grunt = spawnEnemy(3.6, 0, 'grunt');
		grunt.y = FLOOR_Y + 3.6;
		grunt.hp = Math.floor(grunt.maxHp * 0.3);
		const hpBefore = grunt.hp;

		expect(healFieldMedicAlly(medic, Date.now())).toBe(true);
		expect(grunt.hp).toBe(Math.min(grunt.maxHp, hpBefore + def.healAmount));
	});

	it('does not heal an XZ-close ally outside the sphere', () => {
		const medic = spawnEnemy(0, 0, 'field_medic');
		medic.y = FLOOR_Y;
		// XZ distance 5.4 ≤ 6, but 3D distance hypot(5.4, 5.4) ≈ 7.64 > 6.
		const grunt = spawnEnemy(5.4, 0, 'grunt');
		grunt.y = FLOOR_Y + 5.4;
		grunt.hp = Math.floor(grunt.maxHp * 0.3);
		const hpBefore = grunt.hp;

		expect(healFieldMedicAlly(medic, Date.now())).toBe(false);
		expect(grunt.hp).toBe(hpBefore);
	});
});

describe('sacrificial_altar — sacrificeRadius is a 3D sphere', () => {
	const def = CARD_DEFS.sacrificial_altar;
	// Production resolves the sacrifice radius as cardDef.sacrificeRadius ||
	// SUMMON_RADIUS (cardEffects.js sacrificial_altar branch).
	const radius = def.sacrificeRadius || SUMMON_RADIUS;
	const playerId = 'altar-caster';

	let socketEvents;
	let lobbyEvents;
	let socket;
	let lobby;

	beforeEach(() => {
		resetState();
		// handleUseCard requires an active run; keep the objective incomplete so
		// checkRunTerminalState() (triggered by card exhaustion) leaves it alone.
		gameState.run = {
			status: 'playing',
			objective: { type: 'defeat_enemies', current: 0, target: 5 },
		};
		addPlayer(playerId, {
			magicStones: 0,
			pendingSummons: new Set(),
			hand: [
				{ id: 'sacrificial_altar', name: def.name, type: 'spell', charges: def.charges, remainingCharges: 1, grind: 0 },
				{ id: 'iron_sword', name: 'Rust-Forged Saber', type: 'weapon', charges: 5, remainingCharges: 1, grind: 0 },
				null,
				null,
			],
			slotCooldowns: [null, null, null, null],
		});

		socketEvents = [];
		lobbyEvents = [];
		socket = { playerId, emit: (event, payload) => socketEvents.push({ event, payload }) };
		lobby = { id: 'altar-lobby', state: gameState };
		// Wire cardEffects with the REAL findSacrificeTarget so the cast path
		// under test exercises the production 3D sphere check end to end.
		setCardEffectCallbacks({
			io: { to: () => ({ emit: (event, payload) => lobbyEvents.push({ event, payload }) }) },
			emitCardError: (sock, reason) => sock.emit(SERVER_TO_CLIENT.CARD_ERROR, { reason }),
			findSacrificeTarget,
			resolveAttackRotation: (player, data) => (
				Number.isFinite(data?.rotation) ? data.rotation : (player.rotation || 0)
			),
			resolveProjectileAim,
		});
	});

	function addMinion(id, overrides = {}) {
		const minion = {
			id,
			ownerId: playerId,
			type: 'dungeon_drake',
			x: 0,
			y: FLOOR_Y,
			z: 0,
			hp: 20,
			ttl: 30,
			createdAt: 10,
			...overrides,
		};
		gameState.minions.push(minion);
		return minion;
	}

	function castAltar() {
		handleUseCard(socket, gameState, lobby, { cardId: 'sacrificial_altar', slotIndex: 0 });
		return {
			used: lobbyEvents.find(e => e.event === SERVER_TO_CLIENT.CARD_USED)?.payload || null,
			errors: socketEvents.filter(e => e.event === SERVER_TO_CLIENT.CARD_ERROR).map(e => e.payload),
		};
	}

	it('sacrifices an elevated minion inside the sphere', () => {
		// 3D distance hypot(0.6r, 0.6r) ≈ 0.85 × radius ≤ radius (8.49 ≤ 10).
		addMinion('lifted', { x: radius * 0.6, z: 0, y: FLOOR_Y + radius * 0.6 });

		const { used, errors } = castAltar();

		expect(errors).toHaveLength(0);
		expect(used).not.toBeNull();
		expect(used.sacrificedMinionId).toBe('lifted');
		expect(gameState.minions).toHaveLength(0);
		const player = gameState.players[playerId];
		const expectedGain = Math.min(MAX_MAGIC_STONES, def.magicStoneGain);
		expect(used.magicStonesGained).toBe(expectedGain);
		expect(player.magicStones).toBe(expectedGain);
		// chargeRestore still flows to the depleted weapon in hand.
		expect(player.hand[1].remainingCharges).toBe(1 + (def.chargeRestore || 0));
	});

	it('skips a minion XZ-inside the radius but outside the sphere and errors with no candidates', () => {
		// XZ distance 0.9 × radius ≤ radius, but 3D distance hypot(0.9r, 0.9r)
		// ≈ 1.27 × radius > radius (12.73 > 10).
		addMinion('high', { x: radius * 0.9, z: 0, y: FLOOR_Y + radius * 0.9 });

		const { used, errors } = castAltar();

		expect(used).toBeNull();
		expect(errors).toEqual([{ reason: 'No friendly summon to sacrifice' }]);
		expect(gameState.minions.map(m => m.id)).toEqual(['high']);
		const player = gameState.players[playerId];
		expect(player.magicStones).toBe(0);
		// The failed cast must not consume the card.
		expect(player.hand[0].remainingCharges).toBe(1);
	});

	it('still sacrifices the oldest same-Y minion inside the radius (regression guard)', () => {
		// Both minions at the cast origin's Y, XZ distances 1 and 2 ≤ 10.
		addMinion('old-minion', { x: 1, createdAt: 10 });
		addMinion('new-minion', { x: 2, createdAt: 20 });

		const { used, errors } = castAltar();

		expect(errors).toHaveLength(0);
		expect(used.sacrificedMinionId).toBe('old-minion');
		expect(gameState.minions.map(m => m.id)).toEqual(['new-minion']);
	});
});
