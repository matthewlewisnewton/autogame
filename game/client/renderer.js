// ── Client Renderer Module ──
// All Three.js scene creation, mesh management, visual effects, camera follow,
// and the animate() game loop. Import from here instead of embedding rendering
// logic in main.js.
//
// Communication pattern:
//   - main.js calls initScene(layout, spawnPos) to bootstrap the scene
//   - main.js sets game state via setGameStateRef() / setMyId()
//   - main.js calls setGamePhase() on phase transitions
//   - animate() reads gameState from the shared reference each frame
//   - main.js calls mesh-sync helpers (syncLootMeshes, disposeStaleMeshes) as needed

import * as THREE from 'three';
import { clampDelta } from './delta.js';
import {
	buildDungeon,
	clearDungeon,
	buildWallColliders,
	computeWalkableAABBs,
	computeDungeonBounds,
	tryPlayerMove,
	WALL_HEIGHT,
	WALL_THICKNESS,
	FLOOR_Y,
	PASSAGE_WALL_HEIGHT,
	PASSAGE_WALL_THICKNESS,
	floorMaterial,
	wallMaterial,
	passageFloorMaterial,
	groundMaterial,
} from './dungeon.js';
import { sampleFloorY, sampleFloorSurface, DEFAULT_FLOOR_Y, resolveFloorY, findBoothInRange } from './collision.js';
import {
	CARD_HIT_GRACE_MS,
	ATTACK_RANGE,
	ATTACK_CONE_ANGLE,
	ENTITY_RADIUS,
	PROJECTILE_HIT_WIDTH,
	ATTACK_EFFECT_DURATION,
	RUSTY_SHIV_EFFECT_DURATION,
	ATTACK_EFFECT_SPEED,
	SUMMON_EXPAND_MS,
	SUMMON_EFFECT_DURATION,
	HIT_SPARK_DURATION,
	LOOT_COLLECT_DURATION,
	DAMAGE_NUMBER_DURATION,
	CAMERA_FOV,
	CAMERA_NEAR,
	CAMERA_FAR,
	MOVE_SPEED,
	MAX_ELAPSED_MS,
	TICK_RATE,
	SLIPPERY_ACCEL,
	SLIPPERY_FRICTION,
	NORMAL_STOP_FRICTION,
	CAMERA_DISTANCE,
	getCameraFollowHeight,
	CAMERA_YAW_SENSITIVITY,
	ENEMY_ATTACK_RANGE,
	MAX_HP,
	MAX_MS,
	LOOT_PICKUP_RADIUS,
	LOOT_PICKUP_RETRY_MS,
} from './config.js';
import {
	initGamepadListeners,
	pollGamepadLook,
	resetGamepadState,
} from './gamepad.js';
import { pollInput, getMovementDirection, resetInputState } from './input.js';
import { clientMoveSpeedScale, tickMovementPrediction } from './movementPrediction.js';
import { playSound } from './audio.js';
import {
	isLockOnActive,
	findEnemyById,
	getLockedEnemyId,
	clearLockOn,
	clearLockOnCameraRelease,
	clearAllLockOnState,
	isLockOnCameraReleasing,
	updateLockOnCameraRelease,
	handleLockOnPress,
	filterLockOnEnemies,
	updateLockOn,
	targetRelativeDirection,
	getDirectionToTarget,
	resetLockOnTracking,
	normalizeAngle,
	cameraYawFromToTarget,
} from './lockOn.js';
import { syncLockOnInfoPanel } from './lock-on-info-panel.js';
import { getLockOnRepeatAction, getGamepadConfig, areParticlesEnabled, getAccountProfile } from './settings.js';
import { MODEL_REGISTRY, loadModel, modelPathFor } from './models.js';
import eventsCatalog from '../shared/events.json' with { type: 'json' };

const { clientToServer: CLIENT_TO_SERVER } = eventsCatalog;

// ── Three.js scene references ──
let scene, camera, renderer, clock;
const playersMeshes = {};
const playerNameplates = {}; // playerId → THREE.Sprite (username label)
const NAMEPLATE_OFFSET_Y = 1.0; // Units above avatar group Y position
const enemiesMeshes = {};
const enemyHealthBars = {}; // enemy id → health bar mesh
const enemyShieldBars = {}; // enemy id → shield absorb bar mesh
const enemyHitboxMeshes = {}; // enemy id → pulsing hitbox group
const telegraphMeshes = {}; // enemy id → warning ring mesh (ground circle during windup)
const minionTelegraphMeshes = {}; // minion id → beam telegraph during windup
const enemyLockOnRings = {}; // enemy id → lock-on reticle ring
const variantMarkerMeshes = {}; // enemy id → floating badge for variant ("elite") enemies
const frenziedTelegraphMeshes = {}; // enemy id → pulsing red ring (pre-enrage telegraph)
const enemySlowMarkers = {}; // enemy id → icy ground ring shown while slowed
const playerSlowMarkers = {}; // player id → icy ground ring shown while slowed
const enemyBurnMarkers = {}; // enemy id → flickering flame shown while burning
const playerBurnMarkers = {}; // player id → flickering flame shown while burning
const playerCardWindupMarkers = {}; // player id → ground ring during card wind-up
const playerCardWindupFlashing = new Set(); // player ids showing card-windup emissive

// phase_step ally targeting: nearest in-range ally id (or null) recomputed each
// frame, plus the ground ring that highlights it. Read by main.js via
// getPhaseStepTargetId() so the useKeyItem payload can carry targetPlayerId.
const PHASE_STEP_RANGE = 6; // metres — must match server KEY_ITEM_DEFS.phase_step.range
let phaseStepTargetId = null;
let phaseStepAllyRing = null;
const windupFlashing = new Set(); // enemy ids currently showing windup emissive
const minionsMeshes = {};
const lootMeshes = {};
const iceBallMeshes = {}; // ice-ball projectile id → giant icy sphere mesh (glacial thrower)
let telepipeMesh = null;
const activeEffects = []; // { mesh, origin, direction, createdAt, duration }

// ── Player local state ──
let myX = 0;
let myZ = 0;
let playerRotation = 0; // facing angle in radians
let wasDead = false; // tracks previous-frame dead state for respawn detection
let spawnPosition = { x: 0, z: 0 };
let wallColliders = []; // flat array of wall AABBs
let walkableAABBs = [];
let dungeonBounds = null;
let dungeonMeshes = []; // meshes created by buildDungeon()

// ── Camera orbit state ──
let cameraYaw = 0;
let isCameraDragging = false;
let cameraListenersAdded = false;
/** Unit direction toward locked target on XZ plane, when lock-on is active. */
let lockOnToTarget = null;
/** Look-at point while easing out of lock-on after target death. */
let lockOnReleaseLookAt = null;

// ── Shared state references (set by main.js) ──
let gameStateRef = null; // reference to gameState object set by main.js
let myIdRef = null; // current player id string
let socketRef = null; // socket instance for emitting 'move'
/** @type {(() => object | null) | null} */
let enemyDisplayCatalogGetter = null;
/** @type {{ panelEl: HTMLElement, nameEl: HTMLElement, variantEl: HTMLElement, hpEl: HTMLElement, statsEl: HTMLElement, descEl: HTMLElement } | null} */
let lockOnInfoPanelDom = null;

// ── Booth proximity (hub lobby) ──
// The booth id the local player currently stands within, recomputed each frame
// from the hub layout's anchors. `null` when out of range or not in the hub.
let currentBoothInRange = null;
let boothInRangeListener = null; // edge-triggered: fires when the in-range booth changes

// ── Input state ──
let inputListenersAdded = false;
const TICK_DT = 1 / TICK_RATE;
// Mirrors the server's applySlow() default (game/server/simulation.js): used for
// local prediction when a player is slowed but the snapshot omits slowFactor.
const DEFAULT_SLOW_FACTOR = 0.5;
let moveAccumulator = 0;
let moveEmitAccumulator = 0;
let moveSequence = 0;
let enemyHitboxPhase = 0;
/** Fixed-tick simulation position; myX/myZ interpolate between prevSim and sim for smooth rendering. */
let simX = 0;
let simZ = 0;
let simVx = 0;
let simVz = 0;
let prevSimX = 0;
let prevSimZ = 0;
let lastEmittedRotation = null;
const ROTATION_SYNC_EPS = 0.02;

function resetSimVelocity() {
	simVx = 0;
	simVz = 0;
}

function isCoastingOnSlippery(layout) {
	if (!layout) return false;
	if (sampleFloorSurface(layout, simX, simZ) !== 'slippery') return false;
	return Math.hypot(simVx, simVz) >= 1e-4;
}

// ── Loot state ──
const lootGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
const lootMaterial = new THREE.MeshStandardMaterial({
	color: 0xffd700,
	emissive: 0xeab308,
	emissiveIntensity: 0.45,
	roughness: 0.3,
	metalness: 0.8,
});
const crystalGeometry = new THREE.OctahedronGeometry(0.45, 0);
const crystalMaterial = new THREE.MeshStandardMaterial({
	color: 0x88eeff,
	emissive: 0x2288cc,
	emissiveIntensity: 0.85,
	roughness: 0.15,
	metalness: 0.65,
});
const magicStoneGeometry = new THREE.OctahedronGeometry(0.5, 0);
const magicStoneRingGeometry = new THREE.RingGeometry(0.4, 0.7, 24);
const magicStoneMaterial = new THREE.MeshStandardMaterial({
	color: 0xa78bfa,
	emissive: 0x7c3aed,
	emissiveIntensity: 1.1,
	roughness: 0.15,
	metalness: 0.85,
});
const LOOT_FLOAT_COLOR_MONEY = '#ffd700';
const LOOT_FLOAT_COLOR_MAGIC_STONE = '#a78bfa';
const collectingLoot = {}; // lootId → { mesh, value, kind, createdAt }
const previousLootValues = {}; // lootId → { value, kind }

// ── Damage number tracking ──
const damageNumbers = []; // { element, createdAt, position3d, duration }

// ── Card hit tracking ──
const lastCardHitTime = {}; // enemyId → performance.now() of last card hit

/** Record cardUsed hits so minion-damage fallbacks skip duplicate VFX. */
export function markCardHitEnemies(hits) {
	const now = performance.now();
	for (const hit of hits || []) {
		if (hit?.enemyId) lastCardHitTime[hit.enemyId] = now;
	}
}
const previousEnemyHp = {}; // enemyId → hp from previous frame
const previousMinionHp = {}; // minionId → hp from previous frame
const previousPlayerHp = {}; // playerId → hp from previous frame
const lootPickupAttempts = new Map(); // lootId → last emit timestamp (ms)

// ── Scene init flag ──
let sceneInitialized = false;

// ── Layout height atmosphere (spire-ascent, fire-cavern) ──
/** @type {string|null} */
let currentLayoutProfile = null;
/** @type {{ bottomY: number, topY: number }|null} */
let spireAtmosphereBounds = null;
/** @type {{ rimY: number, basinY: number }|null} */
let fireCavernAtmosphereBounds = null;

export const SPIRE_ATMOSPHERE = {
	baseBackground: 0x0f172a,
	summitBackground: 0x7ec8e3,
	baseFogColor: 0x1e293b,
	summitFogColor: 0xb8e0f0,
	baseFogNear: 8,
	baseFogFar: 45,
	summitFogNear: 28,
	summitFogFar: 130,
};

export const FIRE_CAVERN_ATMOSPHERE = {
	rimBackground: 0x0a1018,
	basinBackground: 0x4a2018,
	rimFogColor: 0x151f2e,
	basinFogColor: 0x8b3a20,
	rimFogNear: 8,
	basinFogNear: 14,
	rimFogFar: 42,
	basinFogFar: 58,
};

const DEFAULT_SCENE_BACKGROUND = 0x0f172a;

function lerpHexColor(fromHex, toHex, t) {
	const fr = (fromHex >> 16) & 0xff;
	const fg = (fromHex >> 8) & 0xff;
	const fb = fromHex & 0xff;
	const tr = (toHex >> 16) & 0xff;
	const tg = (toHex >> 8) & 0xff;
	const tb = toHex & 0xff;
	const r = Math.round(fr + (tr - fr) * t);
	const g = Math.round(fg + (tg - fg) * t);
	const b = Math.round(fb + (tb - fb) * t);
	return (r << 16) | (g << 8) | b;
}

function lerpNumber(a, b, t) {
	return a + (b - a) * t;
}

/**
 * Pure lerp of spire-ascent background/fog for a normalized ascent height (0 = base, 1 = summit).
 * Exported for unit tests — no scene dependency.
 *
 * @param {number} normalizedHeight
 * @returns {{ background: number, fogColor: number, fogNear: number, fogFar: number }}
 */
export function lerpSpireAtmosphere(normalizedHeight) {
	const t = Math.max(0, Math.min(1, normalizedHeight));
	return {
		background: lerpHexColor(SPIRE_ATMOSPHERE.baseBackground, SPIRE_ATMOSPHERE.summitBackground, t),
		fogColor: lerpHexColor(SPIRE_ATMOSPHERE.baseFogColor, SPIRE_ATMOSPHERE.summitFogColor, t),
		fogNear: lerpNumber(SPIRE_ATMOSPHERE.baseFogNear, SPIRE_ATMOSPHERE.summitFogNear, t),
		fogFar: lerpNumber(SPIRE_ATMOSPHERE.baseFogFar, SPIRE_ATMOSPHERE.summitFogFar, t),
	};
}

function tierFloorY(room) {
	return room.floorCorners?.yNW ?? DEFAULT_FLOOR_Y;
}

/**
 * Bottom/top tier floor Y from spire-ascent tier rooms.
 * @param {object} layout
 * @returns {{ bottomY: number, topY: number }|null}
 */
export function computeSpireAtmosphereBounds(layout) {
	const tiers = (layout?.rooms ?? []).filter((r) => r.band === 'tier' && r.tierIndex != null);
	if (tiers.length === 0) return null;
	const bottom = tiers.reduce((a, b) => (a.tierIndex < b.tierIndex ? a : b));
	const top = tiers.reduce((a, b) => (a.tierIndex > b.tierIndex ? a : b));
	return { bottomY: tierFloorY(bottom), topY: tierFloorY(top) };
}

function normalizedSpireHeight(playerY) {
	if (!spireAtmosphereBounds) return 0;
	const { bottomY, topY } = spireAtmosphereBounds;
	if (topY <= bottomY) return 0;
	return Math.max(0, Math.min(1, (playerY - bottomY) / (topY - bottomY)));
}

function applySpireAtmosphereValues(values) {
	if (!scene) return;
	scene.background.setHex(values.background);
	if (!scene.fog) {
		scene.fog = new THREE.Fog(values.fogColor, values.fogNear, values.fogFar);
	} else {
		scene.fog.color.setHex(values.fogColor);
		scene.fog.near = values.fogNear;
		scene.fog.far = values.fogFar;
	}
}

/**
 * Restore default stage background and clear fog (hub, lobby, non-spire quests).
 */
export function resetAtmosphere() {
	currentLayoutProfile = null;
	spireAtmosphereBounds = null;
	fireCavernAtmosphereBounds = null;
	if (!scene) return;
	scene.background = new THREE.Color(DEFAULT_SCENE_BACKGROUND);
	scene.fog = null;
}

/**
 * Cache spire tier Y bounds and apply atmosphere for the current player height.
 * @param {object} layout
 * @param {number} [playerY]
 */
export function initSpireAscentAtmosphere(layout, playerY = DEFAULT_FLOOR_Y) {
	currentLayoutProfile = 'spire-ascent';
	spireAtmosphereBounds = computeSpireAtmosphereBounds(layout);
	updateSpireAscentAtmosphere(playerY, layout);
}

/**
 * Interpolate scene background and fog from player height on spire-ascent layouts.
 * @param {number} playerY
 * @param {object} [layout]
 */
export function updateSpireAscentAtmosphere(playerY, layout) {
	if (!scene || currentLayoutProfile !== 'spire-ascent') return;
	if (layout && layout.profile !== 'spire-ascent') {
		resetAtmosphere();
		return;
	}
	if (!spireAtmosphereBounds && layout) {
		spireAtmosphereBounds = computeSpireAtmosphereBounds(layout);
	}
	applySpireAtmosphereValues(lerpSpireAtmosphere(normalizedSpireHeight(playerY)));
}

/**
 * Pure lerp of fire-cavern background/fog for normalized descent depth (0 = rim, 1 = basin).
 * Exported for unit tests — no scene dependency.
 *
 * @param {number} normalizedDepth
 * @returns {{ background: number, fogColor: number, fogNear: number, fogFar: number }}
 */
export function lerpFireCavernAtmosphere(normalizedDepth) {
	const t = Math.max(0, Math.min(1, normalizedDepth));
	return {
		background: lerpHexColor(FIRE_CAVERN_ATMOSPHERE.rimBackground, FIRE_CAVERN_ATMOSPHERE.basinBackground, t),
		fogColor: lerpHexColor(FIRE_CAVERN_ATMOSPHERE.rimFogColor, FIRE_CAVERN_ATMOSPHERE.basinFogColor, t),
		fogNear: lerpNumber(FIRE_CAVERN_ATMOSPHERE.rimFogNear, FIRE_CAVERN_ATMOSPHERE.basinFogNear, t),
		fogFar: lerpNumber(FIRE_CAVERN_ATMOSPHERE.rimFogFar, FIRE_CAVERN_ATMOSPHERE.basinFogFar, t),
	};
}

/**
 * Rim (high) and basin (low) floor Y from fire-cavern band rooms.
 * @param {object} layout
 * @returns {{ rimY: number, basinY: number }|null}
 */
export function computeFireCavernAtmosphereBounds(layout) {
	const rim = (layout?.rooms ?? []).find((r) => r.band === 'rim');
	const basin = (layout?.rooms ?? []).find((r) => r.band === 'basin');
	if (!rim || !basin) return null;
	return { rimY: tierFloorY(rim), basinY: tierFloorY(basin) };
}

function normalizedFireCavernDepth(playerY) {
	if (!fireCavernAtmosphereBounds) return 0;
	const { rimY, basinY } = fireCavernAtmosphereBounds;
	if (rimY <= basinY) return 0;
	return Math.max(0, Math.min(1, (rimY - playerY) / (rimY - basinY)));
}

/**
 * Cache fire-cavern rim/basin Y bounds and apply atmosphere for the current player height.
 * @param {object} layout
 * @param {number} [playerY]
 */
export function initFireCavernAtmosphere(layout, playerY = DEFAULT_FLOOR_Y) {
	currentLayoutProfile = 'fire-cavern';
	fireCavernAtmosphereBounds = computeFireCavernAtmosphereBounds(layout);
	updateFireCavernAtmosphere(playerY, layout);
}

/**
 * Interpolate scene background and fog from player height on fire-cavern layouts.
 * @param {number} playerY
 * @param {object} [layout]
 */
export function updateFireCavernAtmosphere(playerY, layout) {
	if (!scene || currentLayoutProfile !== 'fire-cavern') return;
	if (layout && layout.profile !== 'fire-cavern') {
		resetAtmosphere();
		return;
	}
	if (!fireCavernAtmosphereBounds && layout) {
		fireCavernAtmosphereBounds = computeFireCavernAtmosphereBounds(layout);
	}
	applySpireAtmosphereValues(lerpFireCavernAtmosphere(normalizedFireCavernDepth(playerY)));
}

// ── Enemy geometry table ──
const ENEMY_GEOMETRY = {
	grunt:      { type: 'cone', radius: 0.5, height: 1, segments: 8, color: 0xdc2626 },
	skirmisher: { type: 'cone', radius: 0.3, height: 0.6, segments: 8, color: 0xff6600 },
	miniboss:   { type: 'cone', radius: 1.0, height: 2.2, segments: 12, color: 0x8800cc, emissive: 0x6600aa, emissiveIntensity: 0.3 },
	annex_overseer: { type: 'cone', radius: 1.1, height: 2.4, segments: 14, color: 0x0d9488, emissive: 0x14b8a6, emissiveIntensity: 0.3 },
	arena_champion: { type: 'cone', radius: 1.4, height: 3.0, segments: 16, color: 0xffaa00, emissive: 0xcc3300, emissiveIntensity: 0.45 },
	spire_warden: { type: 'cone', radius: 1.1, height: 2.4, segments: 12, color: 0x3388cc, emissive: 0x2266aa, emissiveIntensity: 0.3 },
	spawner:    { type: 'octahedron', radius: 0.6, color: 0x00ccaa, emissive: 0x00ccaa, emissiveIntensity: 0.4 },
	field_medic: { type: 'octahedron', radius: 0.4, color: 0x10b981, emissive: 0x2dd4bf, emissiveIntensity: 0.55 },
	glacial_thrower: { type: 'cone', radius: 1.0, height: 2.2, segments: 12, color: 0x7dd3fc, emissive: 0x38bdf8, emissiveIntensity: 0.35 },
	ember_wraith: { type: 'octahedron', radius: 0.35, color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.6 },
};

/** Windup telegraph shape per enemy type — mirrors server ENEMY_DEFS attackStyle */
const ENEMY_ATTACK_VISUAL = {
	grunt:      { style: 'radial' },
	skirmisher: { style: 'cone', coneAngle: Math.PI / 3, color: 0xff6600, emissive: 0xff3300 },
	miniboss:   { style: 'cone', coneAngle: Math.PI / 2, range: 5, color: 0xaa44ff, emissive: 0x8800cc },
	annex_overseer: { style: 'radial', range: 3.5, color: 0x2dd4bf, emissive: 0x0d9488 },
	arena_champion: { style: 'cone', coneAngle: (2 * Math.PI) / 3, range: 6.5, color: 0xffcc44, emissive: 0xcc3300 },
	spire_warden: { style: 'cone', coneAngle: Math.PI / 2, range: 6, color: 0x55aaff, emissive: 0x3388cc },
	spawner:    { style: 'radial' },
	field_medic: { style: 'projectile', range: 8, color: 0x2dd4bf, emissive: 0x14b8a6, hitWidth: 0.5 },
	glacial_thrower: { style: 'projectile', range: 7, color: 0x7dd3fc, emissive: 0x38bdf8, hitWidth: 0.9 },
	ember_wraith: { style: 'cone', coneAngle: Math.PI / 3, color: 0xff4400, emissive: 0xff2200 },
};

/** Minion mesh presets keyed by minion.type */
const MINION_VISUAL = {
	ancient_wyrm: {
		shape: 'cylinder',
		radius: 0.6,
		height: 1.5,
		color: 0x9333ea,
		emissive: 0xef4444,
		emissiveIntensity: 0.35,
		scale: 1.5,
	},
	null_crawler: {
		shape: 'octahedron',
		radius: 0.35,
		color: 0x22d3ee,
		emissive: 0x06b6d4,
		emissiveIntensity: 0.55,
	},
	bulkhead_mauler: {
		shape: 'box',
		width: 0.9,
		height: 1.2,
		depth: 0.9,
		color: 0x78716c,
		emissive: 0xf59e0b,
		emissiveIntensity: 0.25,
	},
};

/**
 * Target axis-aligned height for a registry-loaded model, derived from procedural
 * footprint tables. Returns null when `key` has no geometry preset (player, loot).
 * @param {string} key
 * @returns {{ targetHeight: number } | null}
 */
export function getRegistryTargetFootprint(key) {
	const enemy = ENEMY_GEOMETRY[key];
	if (enemy) {
		if (enemy.type === 'octahedron') {
			return { targetHeight: enemy.radius * 2 };
		}
		const diameter = enemy.radius * 2;
		return { targetHeight: Math.max(enemy.height, diameter) };
	}

	const minion = MINION_VISUAL[key];
	if (minion) {
		let targetHeight;
		if (minion.shape === 'octahedron') {
			targetHeight = minion.radius * 2;
		} else if (minion.shape === 'box') {
			targetHeight = minion.height;
		} else {
			targetHeight = minion.height;
		}
		if (minion.scale) {
			targetHeight *= minion.scale;
		}
		return { targetHeight };
	}

	// Player avatar — normalize the glTF humanoid to the spike contract height
	// (~1.8 world units, feet at y=0, footprint within PLAYER_RADIUS = 0.5).
	// See game/docs/MODEL_SPIKE.md.
	if (key === 'player') {
		return { targetHeight: PLAYER_MODEL_HEIGHT };
	}

	return null;
}

/**
 * Vertical offset of the procedural host mesh in world space before the registry
 * model is parented. Registry models are normalized with feet at local y=0; subtract
 * this so world-space feet sit on the floor when the host uses the render-loop y.
 * @param {string} key
 * @returns {number}
 */
export function getRegistryHostVerticalOffset(key) {
	if (ENEMY_GEOMETRY[key]) {
		return enemyMeshHalfHeight(key);
	}
	if (MINION_VISUAL[key]) {
		return 0.5;
	}
	// Player avatar host group is positioned with its origin at floor y (see the
	// (x, floorY, z) placement in the render loop), and the model is normalized
	// with feet at local y=0 — so no extra offset is needed to seat the soles.
	if (key === 'player') {
		return 0;
	}
	return 0;
}

/**
 * Uniformly scale a loaded registry model to `footprint.targetHeight` and sit its
 * feet at y=0 in the host's local space (bbox min.y on the ground plane).
 * @param {THREE.Object3D} model
 * @param {{ targetHeight: number }} footprint
 */
export function normalizeLoadedRegistryModel(model, footprint) {
	const targetHeight = footprint?.targetHeight;
	if (!model || !targetHeight || targetHeight <= 0) return;

	const box = new THREE.Box3().setFromObject(model);
	const size = new THREE.Vector3();
	box.getSize(size);
	if (size.y <= 0) return;

	const scale = targetHeight / size.y;
	model.scale.multiplyScalar(scale);

	box.setFromObject(model);
	model.position.y -= box.min.y;
}

/**
 * Consult MODEL_REGISTRY for `key` and, when a model path is configured, kick off
 * an async load and swap the cloned model in for the procedural primitive on
 * success. This is fire-and-forget: callers build + return their procedural
 * mesh/group synchronously, and this only mutates it later if/when a model
 * resolves. Keys with a null/absent registry path are a no-op (procedural stays).
 *
 * Resilience: a null/absent path is a no-op (procedural stays); a rejected or
 * null `loadModel` result leaves the procedural mesh in place and at most logs —
 * it never throws, never removes the host, and never blocks the render loop.
 *
 * @param {string} key - registry key (e.g. 'player', 'grunt', 'magic_stone').
 * @param {THREE.Object3D} host - the procedural mesh/group already returned.
 */
function attachRegistryModel(key, host) {
	// Unknown keys can't map to a model; skip without touching the registry.
	if (!host || !Object.prototype.hasOwnProperty.call(MODEL_REGISTRY, key)) return;

	const path = modelPathFor(key);
	if (!path) return; // null/absent path → keep procedural (the only path this ticket).

	// Snapshot the procedural meshes now so a later swap hides only the
	// primitives, not the model we're about to attach.
	const procedural = [];
	host.traverse((node) => {
		if (node.isMesh && node.material) procedural.push(node);
	});

	loadModel(path)
		.then((model) => {
			if (!model) return; // load failed/returned null → procedural stays (warned in models.js).
			const footprint = getRegistryTargetFootprint(key);
			if (footprint) {
				normalizeLoadedRegistryModel(model, footprint);
				model.position.y -= getRegistryHostVerticalOffset(key);
			}
			for (const node of procedural) node.material.visible = false;
			host.add(model);
			host.userData.modelOverride = model;

			// Player: retarget the VFX body mesh to the loaded skinned mesh so
			// flash / dead recolor / invuln shimmer / dash all act on the visible
			// glTF model instead of the now-hidden procedural primitive, then seat
			// the equipped hat on the glTF head bone (built here, AFTER the
			// procedural snapshot, so the hiding loop above leaves it visible).
			if (key === 'player') {
				retargetPlayerBodyMesh(host, model);
				attachGltfHat(host, model);
				// Seat the equipped key-item prop on a spine bone, built here AFTER
				// the procedural snapshot so the body-bone prop is left visible.
				attachGltfKeyItemProp(host, model);
			}
		})
		.catch((err) => {
			console.warn(`[renderer] failed to apply model "${path}" for "${key}":`, err);
		});
}

/**
 * Locate the skinned body mesh inside a loaded player glTF — preferring the mesh
 * carrying morph targets (e.g. `SuperHero_Male`), then any `SkinnedMesh`, then
 * any mesh — so proportion morphs (sub-ticket 02/04) and runtime tint land on
 * the right surface.
 * @param {THREE.Object3D} model
 * @returns {THREE.Mesh|null}
 */
function findPlayerBodyMesh(model) {
	let morphed = null;
	let skinned = null;
	let anyMesh = null;
	model.traverse((node) => {
		if (!node.isMesh || !node.material) return;
		if (!anyMesh) anyMesh = node;
		if (node.isSkinnedMesh && !skinned) skinned = node;
		if (node.morphTargetDictionary && !morphed) morphed = node;
	});
	return morphed || skinned || anyMesh;
}

/**
 * Point an avatar host's `userData.bodyMesh` (and `baseColor`) at the loaded
 * glTF body mesh so the existing `resolveBodyMesh`-based VFX keep working after
 * the model swap. The body material is cloned so per-player recolor (dead /
 * flash / invuln) does not bleed across players sharing the cloned glTF.
 * @param {THREE.Object3D} host
 * @param {THREE.Object3D} model
 */
function retargetPlayerBodyMesh(host, model) {
	const bodyMesh = findPlayerBodyMesh(model);
	if (!bodyMesh) return;

	// clone(true) shares materials across player instances; give this avatar its
	// own material so VFX recolors only affect this player.
	if (bodyMesh.material) {
		bodyMesh.material = Array.isArray(bodyMesh.material)
			? bodyMesh.material.map((m) => m.clone())
			: bodyMesh.material.clone();
	}

	host.userData.bodyMesh = bodyMesh;
	// baseColor must match the loaded mesh so the dead/invuln recolor restores
	// the model's own color (not the hidden procedural body's color).
	const mat = Array.isArray(bodyMesh.material) ? bodyMesh.material[0] : bodyMesh.material;
	if (mat && mat.color && mat.color.getHex) {
		host.userData.baseColor = mat.color.getHex();
	}
}

// Desired world-space scale and seating for a hat worn on the loaded glTF head.
// `buildHatMesh` sizes meshes for the ~1-unit procedural body (crown/brim radius
// ~0.4–0.58); the glTF is normalized to ~1.8 units with a much smaller head
// (center y ≈ 1.62, radius ≈ 0.13 per MODEL_SPIKE.md). HAT_HEAD_WORLD_SCALE
// shrinks the built hat to read as worn on that head without being undersized,
// and HAT_HEAD_WORLD_OFFSET lifts it just above the head bone's origin.
const HAT_HEAD_WORLD_SCALE = 0.45;
const HAT_HEAD_WORLD_OFFSET = 0.18;
// World-space y anchor used only when the `Head` bone is missing: top-of-head of
// the ~1.8-unit normalized model (head center ≈ 1.62, crown ≈ 1.8).
const HAT_FALLBACK_WORLD_Y = 1.72;

/**
 * Build the equipped hat (from `host.userData.hatId`) and seat it on the loaded
 * glTF avatar's head so it renders attached to the head and follows it. Called
 * from the player branch of `attachRegistryModel` AFTER the procedural-mesh
 * snapshot is taken, so the head-bone hat is never hidden by the hiding loop.
 *
 * Resilience: a `none`/unknown hat adds nothing; a missing `Head` bone falls
 * back to a top-of-head anchor on the host so the hat still renders; the whole
 * routine is best-effort and never throws (caught by the caller).
 * @param {THREE.Object3D} host - the avatar group.
 * @param {THREE.Object3D} model - the loaded, normalized glTF model.
 */
function attachGltfHat(host, model) {
	// Remove any prior glTF hat (e.g. a cosmetic hat swap on the same host) so the
	// head bone never carries a stale duplicate.
	const existing = host.userData.gltfHatMesh;
	if (existing) {
		if (existing.parent) existing.parent.remove(existing);
		disposeAvatar(existing);
		host.userData.gltfHatMesh = null;
	}

	const hatId = host.userData.hatId;
	const hat = buildHatMesh(hatId);
	if (!hat) return; // `none`/unknown → bare head, nothing to attach.

	const headBone = model.getObjectByName('Head');
	if (headBone) {
		// Parent to the head bone so the hat inherits the head's world position and
		// orientation. Compensate for the bone's world transform so the hat keeps a
		// sensible world scale and stays upright (+Y up) instead of inheriting the
		// bone's rest tilt — while still yawing with the avatar (host) rotation.
		headBone.add(hat);

		const boneScale = new THREE.Vector3();
		headBone.getWorldScale(boneScale);
		const sFactor = HAT_HEAD_WORLD_SCALE / (boneScale.x || 1);
		hat.scale.setScalar(sFactor);

		// hatLocal = inverse(boneWorldQuat) * hostWorldQuat. The host rotation
		// cancels out of both terms, leaving the inverse of the bone's rotation
		// relative to the host — constant across frames, so the hat reads upright
		// and rotates with the avatar rather than drifting as the player turns.
		const boneQuat = new THREE.Quaternion();
		headBone.getWorldQuaternion(boneQuat);
		const hostQuat = new THREE.Quaternion();
		host.getWorldQuaternion(hostQuat);
		hat.quaternion.copy(boneQuat).invert().multiply(hostQuat);

		// Seat the hat just above the head, along the (now-upright) world up axis.
		// Express that world offset in the bone's local space: the local up is the
		// world up rotated by the hat's compensating quaternion; divide the world
		// distance by the bone's world scale to land at the intended world height.
		const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(hat.quaternion);
		hat.position.copy(localUp.multiplyScalar(HAT_HEAD_WORLD_OFFSET / (boneScale.x || 1)));
	} else {
		// No head bone: anchor at the top of the head in the host's world space so
		// the hat still renders and never floats at the group origin.
		host.add(hat);
		hat.scale.setScalar(HAT_HEAD_WORLD_SCALE);
		hat.position.set(0, HAT_FALLBACK_WORLD_Y, 0);
	}

	host.userData.gltfHatMesh = hat;
}

// Desired world-space scale and seating for a key-item prop worn on the loaded
// glTF torso, analogous to the HAT_HEAD_WORLD_* constants. `buildKeyItemProp`
// sizes props for the ~1-unit procedural body; the glTF is normalized to ~1.8
// units, so KEY_ITEM_BODY_WORLD_SCALE shrinks the prop to read as a chest badge.
// KEY_ITEM_BODY_WORLD_OFFSET pushes it just forward of the spine bone (+Z chest).
const KEY_ITEM_BODY_WORLD_SCALE = 0.5;
const KEY_ITEM_BODY_WORLD_OFFSET = 0.16;
// World-space y/z anchor used only when no spine bone exists: mid-chest of the
// ~1.8-unit normalized model, nudged forward so the prop sits on the torso front.
const KEY_ITEM_FALLBACK_WORLD_Y = 1.25;
const KEY_ITEM_FALLBACK_WORLD_Z = 0.22;

// Local chest seating for the procedural primitive avatar (~1-unit body): mid
// torso, nudged forward (+Z) so the prop reads as worn on the chest front.
const KEY_ITEM_PROC_CHEST_Y = 0.18;
const KEY_ITEM_PROC_CHEST_Z = 0.45;

/**
 * Build the equipped key-item prop (from `host.userData.keyItemId`) and seat it
 * on the loaded glTF avatar's torso so it renders attached to the body and
 * follows it. Mirrors attachGltfHat but targets a spine bone (preferring
 * `spine_03`, then `spine_02`, then `spine_01`). Called from the player branch
 * of `attachRegistryModel` AFTER the procedural-mesh snapshot, so the bone prop
 * is never hidden by the hiding loop.
 *
 * Resilience: a `none`/unknown key item adds nothing; a missing spine bone falls
 * back to a host-local chest anchor so the prop still renders; the whole routine
 * is best-effort and never throws (caught by the caller).
 * @param {THREE.Object3D} host - the avatar group.
 * @param {THREE.Object3D} model - the loaded, normalized glTF model.
 */
function attachGltfKeyItemProp(host, model) {
	// Remove any prior prop (e.g. a procedural one seated before the glTF resolved)
	// so the body bone never carries a stale duplicate.
	const existing = host.userData.keyItemPropMesh;
	if (existing) {
		if (existing.parent) existing.parent.remove(existing);
		disposeAvatar(existing);
		host.userData.keyItemPropMesh = null;
	}

	const prop = buildKeyItemProp(host.userData.keyItemId);
	if (!prop) return; // `none`/unknown → no prop to attach.

	const spineBone = model.getObjectByName('spine_03')
		|| model.getObjectByName('spine_02')
		|| model.getObjectByName('spine_01');
	if (spineBone) {
		// Parent to the spine bone so the prop inherits the torso's world position
		// and orientation. Compensate for the bone's world transform so the prop
		// keeps a sensible world scale and stays upright while yawing with the
		// avatar (host) — same pattern as attachGltfHat.
		spineBone.add(prop);

		const boneScale = new THREE.Vector3();
		spineBone.getWorldScale(boneScale);
		const sFactor = KEY_ITEM_BODY_WORLD_SCALE / (boneScale.x || 1);
		prop.scale.setScalar(sFactor);

		const boneQuat = new THREE.Quaternion();
		spineBone.getWorldQuaternion(boneQuat);
		const hostQuat = new THREE.Quaternion();
		host.getWorldQuaternion(hostQuat);
		prop.quaternion.copy(boneQuat).invert().multiply(hostQuat);

		// Seat the prop just forward of the spine, along the (now-upright) world
		// forward axis (+Z). Express that world offset in the bone's local space:
		// rotate world +Z by the prop's compensating quaternion, then divide by the
		// bone's world scale to land at the intended world distance.
		const localFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(prop.quaternion);
		prop.position.copy(localFwd.multiplyScalar(KEY_ITEM_BODY_WORLD_OFFSET / (boneScale.x || 1)));
	} else {
		// No spine bone: anchor at mid-chest in the host's world space so the prop
		// still renders and never floats at the group origin.
		host.add(prop);
		prop.scale.setScalar(KEY_ITEM_BODY_WORLD_SCALE);
		prop.position.set(0, KEY_ITEM_FALLBACK_WORLD_Y, KEY_ITEM_FALLBACK_WORLD_Z);
	}

	host.userData.keyItemPropMesh = prop;
}

/**
 * Build the equipped key-item prop (from `host.userData.keyItemId`) and seat it
 * on the procedural primitive avatar's torso, recording it on
 * `host.userData.keyItemPropMesh`. Used both when the avatar is first built and
 * when the equip changes while the procedural fallback is still in use.
 * Best-effort: `none`/unknown adds nothing.
 * @param {THREE.Object3D} host - the avatar group.
 */
function attachProceduralKeyItemProp(host) {
	const prop = buildKeyItemProp(host.userData.keyItemId);
	if (!prop) return;
	prop.position.set(0, KEY_ITEM_PROC_CHEST_Y, KEY_ITEM_PROC_CHEST_Z);
	host.add(prop);
	host.userData.keyItemPropMesh = prop;
}

/**
 * Apply a key-item equip change to a rendered avatar WITHOUT a page reload: when
 * the equipped id differs from the currently-shown one, remove + dispose the old
 * prop and build/attach the new one (to the glTF spine bone when a model is
 * loaded, else to the procedural torso). Tracks the shown id on
 * `host.userData.keyItemId`. Best-effort and caught so a bad id never crashes the
 * render loop or removes the avatar.
 * @param {THREE.Object3D} host - the avatar group.
 * @param {string} equippedKeyItemId - the snapshot's per-player key item id.
 */
function updateKeyItemProp(host, equippedKeyItemId) {
	const newId = equippedKeyItemId || 'none';
	if (!host || !host.userData) return;
	if (host.userData.keyItemId === newId) return; // unchanged → nothing to do.

	try {
		const old = host.userData.keyItemPropMesh;
		if (old) {
			if (old.parent) old.parent.remove(old);
			disposeAvatar(old);
			host.userData.keyItemPropMesh = null;
		}
		host.userData.keyItemId = newId;
		if (host.userData.modelOverride) {
			attachGltfKeyItemProp(host, host.userData.modelOverride);
		} else {
			attachProceduralKeyItemProp(host);
		}
	} catch (err) {
		console.warn('[renderer] failed to update key-item prop:', err);
	}
}

function createMinionMesh(minionType) {
	const visual = MINION_VISUAL[minionType] || {
		shape: 'cylinder',
		radius: 0.4,
		height: 1,
		color: 0x22c55e,
		emissive: 0x000000,
		emissiveIntensity: 0,
	};

	let geometry;
	if (visual.shape === 'octahedron') {
		geometry = new THREE.OctahedronGeometry(visual.radius, 0);
	} else if (visual.shape === 'box') {
		geometry = new THREE.BoxGeometry(visual.width, visual.height, visual.depth);
	} else {
		geometry = new THREE.CylinderGeometry(visual.radius, visual.radius, visual.height, 8);
	}

	const material = new THREE.MeshStandardMaterial({
		color: visual.color,
		emissive: visual.emissive,
		emissiveIntensity: visual.emissiveIntensity,
	});
	const mesh = new THREE.Mesh(geometry, material);
	if (visual.scale) {
		mesh.scale.setScalar(visual.scale);
	}
	attachRegistryModel(minionType, mesh);
	return mesh;
}

function resetMovementKeys() {
	resetInputState();
	resetGamepadState();
}

function cameraRelativeDirection(inputX, inputZ) {
	const forwardX = -Math.sin(cameraYaw);
	const forwardZ = -Math.cos(cameraYaw);
	const rightX = Math.cos(cameraYaw);
	const rightZ = -Math.sin(cameraYaw);
	return {
		x: rightX * inputX + forwardX * inputZ,
		z: rightZ * inputX + forwardZ * inputZ,
	};
}

function getGamepadRuntimeOptions() {
	const gpCfg = getGamepadConfig();
	return {
		deadzone: typeof gpCfg.deadzone === 'number' ? gpCfg.deadzone : undefined,
		moveStick: gpCfg.moveStick === 'right' ? 'right' : 'left',
	};
}

function getMovementInput() {
	const dir = getMovementDirection();
	if (dir.mag <= 0) return null;
	return { x: dir.dx, z: -dir.dz };
}

function getCameraForwardDirection() {
	return cameraRelativeDirection(0, 1);
}

function lockOnEnemyPool() {
	const gs = gameStateRef;
	return filterLockOnEnemies(gs?.enemies, gs?.run?.encounter);
}

/** Prefer server-authoritative player coords for lock-on targeting (sim can lag after teleports). */
function lockOnAnchorCoords() {
	const me = myIdRef && gameStateRef?.players?.[myIdRef];
	if (me && Number.isFinite(me.x) && Number.isFinite(me.z)) {
		return { x: me.x, z: me.z };
	}
	return { x: simX, z: simZ };
}

export function applyLockOnPress() {
	if (currentGamePhase !== 'playing') return;
	const gs = gameStateRef;
	if (!gs?.enemies) return;

	const anchor = lockOnAnchorCoords();
	const result = handleLockOnPress(
		lockOnEnemyPool(),
		anchor.x,
		anchor.z,
		getLockOnRepeatAction(),
		playerRotation,
	);

	if (result.action === 'locked' && result.enemy) {
		clearLockOnCameraRelease();
		lockOnReleaseLookAt = null;
		resetLockOnTracking();
		const toTarget = getDirectionToTarget(anchor.x, anchor.z, result.enemy);
		lockOnToTarget = toTarget;
		playerRotation = Math.atan2(toTarget.z, toTarget.x);
		lastEmittedRotation = playerRotation;
		cameraYaw = normalizeAngle(cameraYawFromToTarget(toTarget));
	} else {
		lockOnToTarget = null;
		if (result.cameraYaw != null) {
			cameraYaw = normalizeAngle(result.cameraYaw);
		}
	}
}

function updatePlayerFacing() {
	if (isLockOnActive() && lockOnToTarget) {
		syncFacingToServer();
		return;
	}

	const movement = getMovementInput();
	const facing = movement
		? cameraRelativeDirection(movement.x, movement.z)
		: getCameraForwardDirection();
	playerRotation = Math.atan2(facing.z, facing.x);
	syncFacingToServer();
}

function isPlayerCardWindup(player) {
	return player?.cardUseState === 'windup';
}

function isLocalPlayerCardWindup() {
	const me = myIdRef && gameStateRef?.players?.[myIdRef];
	return isPlayerCardWindup(me);
}

function syncFacingToServer() {
	if (!socketRef || !myIdRef) return;
	if (isLocalPlayerCardWindup()) return;
	// While moving, rotation is included in movement packets. Rotation-only
	// packets would zero inputDx/inputDz on the server and fight prediction.
	if (getMovementInput()) {
		lastEmittedRotation = playerRotation;
		return;
	}
	if (lastEmittedRotation != null
		&& Math.abs(playerRotation - lastEmittedRotation) < ROTATION_SYNC_EPS) {
		return;
	}
	lastEmittedRotation = playerRotation;
	socketRef.emit(CLIENT_TO_SERVER.MOVE, { dx: 0, dz: 0, rotation: playerRotation });
}

// Orbit height/lookAt follow the local avatar Y (sampleFloorY on slopes; server
// applyPlayerMovement keeps player.y in sync). Multi-level profiles (spire-ascent,
// sunken-canyon, fire-cavern) need this — pinning to DEFAULT_FLOOR_Y would leave
// the camera behind on ramps.
function updateCameraOrbit(playerX, playerY, playerZ, delta) {
	if (!camera) return;

	const followHeight = getCameraFollowHeight(currentLayoutProfile);
	const targetX = playerX + Math.sin(cameraYaw) * CAMERA_DISTANCE;
	const targetY = playerY + followHeight;
	const targetZ = playerZ + Math.cos(cameraYaw) * CAMERA_DISTANCE;

	if (lockOnReleaseLookAt) {
		const target = new THREE.Vector3(targetX, targetY, targetZ);
		camera.position.lerp(target, 4.0 * delta);
		camera.lookAt(
			lockOnReleaseLookAt.lookAtX,
			lockOnReleaseLookAt.lookAtY,
			lockOnReleaseLookAt.lookAtZ,
		);
		return;
	}

	if (isLockOnActive()) {
		camera.position.set(targetX, targetY, targetZ);
	} else {
		const target = new THREE.Vector3(targetX, targetY, targetZ);
		camera.position.lerp(target, 5.0 * delta);
	}

	const lockedEnemy = findEnemyById(gameStateRef?.enemies, getLockedEnemyId());
	if (lockedEnemy) {
		camera.lookAt(lockedEnemy.x, playerY + 0.5, lockedEnemy.z);
	} else {
		camera.lookAt(playerX, playerY, playerZ);
	}
}

// ── Public API ──

/**
 * Set the reference to the shared gameState object.
 * @param {object} gs
 */
export function setGameStateRef(gs) {
	gameStateRef = gs;
}

/**
 * Set the current player id.
 * @param {string|null} id
 */
export function setMyId(id) {
	myIdRef = id;
}

/**
 * Set the socket reference (for emitting 'move' in updateMyPlayer).
 * @param {Object} s
 */
export function setSocketRef(s) {
	socketRef = s;
}

/**
 * Provide a getter for the server enemy display catalog (set from main.js).
 * @param {() => object | null} getter
 */
export function setEnemyDisplayCatalogGetter(getter) {
	enemyDisplayCatalogGetter = getter;
}

function getLockOnInfoPanelDom() {
	if (lockOnInfoPanelDom) return lockOnInfoPanelDom;
	const panelEl = document.getElementById('lock-on-info-panel');
	if (!panelEl) return null;
	lockOnInfoPanelDom = {
		panelEl,
		nameEl: document.getElementById('lock-on-target-name'),
		variantEl: document.getElementById('lock-on-target-variant'),
		hpEl: document.getElementById('lock-on-target-hp'),
		statsEl: document.getElementById('lock-on-target-stats'),
		descEl: document.getElementById('lock-on-target-description'),
	};
	return lockOnInfoPanelDom;
}

function refreshLockOnInfoPanel() {
	const dom = getLockOnInfoPanelDom();
	if (!dom) return;

	const showPanel = currentGamePhase === 'playing' && isLockOnActive();
	const enemy = showPanel
		? findEnemyById(gameStateRef?.enemies, getLockedEnemyId())
		: null;
	const catalog = enemyDisplayCatalogGetter ? enemyDisplayCatalogGetter() : null;

	syncLockOnInfoPanel({
		...dom,
		enemy,
		catalog,
	});
}

/**
 * Get the current scene.
 * @returns {THREE.Scene|null}
 */
export function getScene() {
	// Check test-scene override first (set via window.__setScene in tests)
	if (typeof window !== 'undefined' && window.___test_scene) {
		return window.___test_scene;
	}
	return scene;
}

/**
 * Get the camera.
 * @returns {THREE.PerspectiveCamera|null}
 */
export function getCamera() {
	return camera;
}

/**
 * Get the renderer.
 * @returns {THREE.WebGLRenderer|null}
 */
export function getRenderer() {
	return renderer;
}

/**
 * Get the mesh maps for test harness access.
 * @returns {object}
 */
export function getMeshMaps() {
	return {
		playersMeshes,
		enemiesMeshes,
		enemyHealthBars,
		enemyShieldBars,
		telegraphMeshes,
		minionTelegraphMeshes,
		minionsMeshes,
		lootMeshes,
		iceBallMeshes,
	};
}

/**
 * Get the current scene initialization flag.
 * @returns {boolean}
 */
export function isSceneInitialized() {
	return sceneInitialized;
}

/**
 * Get the spawn position.
 * @returns {{x: number, z: number}}
 */
export function getSpawnPosition() {
	return { ...spawnPosition };
}

/**
 * Get the internal player position.
 * @returns {{x: number, z: number}}
 */
export function getPlayerPosition() {
	return { x: myX, z: myZ };
}

/**
 * Get the authoritative client sim position (pre-interpolation).
 * @returns {{x: number, z: number}}
 */
export function getSimPlayerPosition() {
	return { x: simX, z: simZ };
}

/**
 * Set the internal player position (used for snapping to spawn on reconnect).
 * @param {number} x
 * @param {number} z
 */
export function setPlayerPosition(x, z) {
	myX = x;
	myZ = z;
	simX = x;
	simZ = z;
	prevSimX = x;
	prevSimZ = z;
	moveAccumulator = 0;
	resetSimVelocity();
}

/**
 * Whether the local player is currently holding movement keys.
 * @returns {boolean}
 */
export function isPlayerMoving() {
	return getMovementDirection().mag > 0;
}

/**
 * Get the player rotation.
 * @returns {number}
 */
export function getPlayerRotation() {
	return playerRotation;
}

/**
 * Current attack facing as a unit direction on the XZ plane.
 * Uses movement direction while moving, otherwise camera forward.
 * @returns {{ x: number, z: number }}
 */
export function getPlayerFacingDirection() {
	if (isLockOnActive() && lockOnToTarget) {
		return { x: lockOnToTarget.x, z: lockOnToTarget.z };
	}

	const movement = getMovementInput();
	return movement
		? cameraRelativeDirection(movement.x, movement.z)
		: getCameraForwardDirection();
}

/**
 * Set the player rotation.
 * @param {number} rot
 */
export function setPlayerRotation(rot) {
	playerRotation = rot;
}

/**
 * Get the wasDead flag.
 * @returns {boolean}
 */
export function getWasDead() {
	return wasDead;
}

/**
 * Set the wasDead flag.
 * @param {boolean} v
 */
export function setWasDead(v) {
	wasDead = v;
}

/**
 * Get the wall colliders array.
 * @returns {object[]}
 */
export function getWallColliders() {
	return wallColliders;
}

/**
 * Get the active effects array.
 * @returns {object[]}
 */
export function getActiveEffects() {
	return activeEffects;
}

/**
 * Get loot IDs with a recent pickup attempt (for test hooks / pruning).
 * @returns {Set}
 */
export function getPickedUpLootIds() {
	return new Set(lootPickupAttempts.keys());
}

/**
 * Drop stale pickup retry timestamps when loot leaves the world.
 * @param {Set<string>} currentLootIds
 */
export function pruneLootPickupAttempts(currentLootIds) {
	for (const id of lootPickupAttempts.keys()) {
		if (!currentLootIds.has(id)) {
			lootPickupAttempts.delete(id);
		}
	}
}

function cloneLootMaterial(kind) {
	if (kind === 'crystal') return crystalMaterial.clone();
	if (kind === 'magic_stone') return magicStoneMaterial.clone();
	return lootMaterial.clone();
}

function createLootMesh(item) {
	const kind = item.kind || 'currency';
	if (kind === 'magic_stone') {
		const group = new THREE.Group();
		group.userData.isMagicStone = true;
		group.userData.lootKind = kind;

		const gem = new THREE.Mesh(magicStoneGeometry, cloneLootMaterial(kind));
		gem.position.y = 0.6;
		group.add(gem);
		group.userData.gemMesh = gem;

		const ring = new THREE.Mesh(
			magicStoneRingGeometry,
			new THREE.MeshBasicMaterial({
				color: 0x8b5cf6,
				transparent: true,
				opacity: 0.45,
				side: THREE.DoubleSide,
			}),
		);
		ring.rotation.x = -Math.PI / 2;
		ring.position.y = 0.04;
		group.add(ring);

		group.position.set(item.x, 0, item.z);
		attachRegistryModel(kind, group);
		return group;
	}

	const isCrystal = kind === 'crystal';
	const mesh = new THREE.Mesh(
		isCrystal ? crystalGeometry : lootGeometry,
		cloneLootMaterial(kind),
	);
	const baseY = isCrystal ? 0.65 : 0.5;
	mesh.position.set(item.x, baseY, item.z);
	mesh.userData.isCrystal = isCrystal;
	mesh.userData.lootKind = kind;
	attachRegistryModel(kind, mesh);
	return mesh;
}

function getLootBaseY(mesh) {
	if (mesh.userData?.isMagicStone) return 0.6;
	if (mesh.userData?.isCrystal) return 0.65;
	return 0.5;
}

/** Dispose per-mesh loot materials (clones / ring mats); shared geometry is kept. */
function disposeLootMeshMaterials(mesh) {
	if (mesh.traverse) {
		mesh.traverse((child) => {
			if (child.material) child.material.dispose();
		});
	} else if (mesh.material) {
		mesh.material.dispose();
	}
}

function tryEmitLootPickup(loot, now) {
	if (!socketRef || !loot) return;
	const last = lootPickupAttempts.get(loot.id) || 0;
	if (now - last < LOOT_PICKUP_RETRY_MS) return;
	lootPickupAttempts.set(loot.id, now);
	socketRef.emit(CLIENT_TO_SERVER.LOOT_PICKUP, { lootId: loot.id });
}

/**
 * Recompute the booth zone the local player stands in. Runs each animate frame.
 * Only the hub layout carries `boothAnchors`, so this is `null` in dungeons.
 * Fires the registered listener (if any) on enter/exit transitions so main.js
 * can show/hide the prompt without polling.
 */
function updateBoothInRange() {
	let next = null;
	const gs = gameStateRef;
	if (gs && gs.layout && gs.layout.profile === 'hub' && gs.layout.boothAnchors) {
		next = findBoothInRange(gs.layout.boothAnchors, myX, myZ);
	}
	if (next !== currentBoothInRange) {
		currentBoothInRange = next;
		boothInRangeListener?.(next);
	}
}

/** @returns {string|null} booth id the local player currently stands within */
export function getCurrentBoothInRange() {
	return currentBoothInRange;
}

/** Register a callback fired with the new booth id (or null) on enter/exit. */
export function setBoothInRangeListener(cb) {
	boothInRangeListener = cb;
}

/**
 * Emit `boothInteract` for the booth the local player currently stands in.
 * No-op (returns null) when no booth is in range.
 * @returns {string|null} the booth id emitted, or null when none in range
 */
export function emitBoothInteract() {
	if (!socketRef || !currentBoothInRange) return null;
	socketRef.emit(CLIENT_TO_SERVER.BOOTH_INTERACT, { boothId: currentBoothInRange });
	return currentBoothInRange;
}

function findClosestLootInRange(lootList, x, z, radius) {
	let closest = null;
	let closestDist = radius;
	for (const loot of lootList) {
		const dist = Math.hypot(x - loot.x, z - loot.z);
		if (dist <= closestDist) {
			closestDist = dist;
			closest = loot;
		}
	}
	return closest;
}

/**
 * Get the windupFlashing set.
 * @returns {Set}
 */
export function getWindupFlashing() {
	return windupFlashing;
}

// ── Scene initialization ──

/**
 * Initialize the Three.js scene, camera, renderer, lights, dungeon geometry,
 * and start the requestAnimationFrame(animate) loop.
 *
 * @param {object} layout - { rooms, passages } from server
 * @param {{x: number, z: number}} spawnPos - spawn position from server
 */
export function initScene(layout, spawnPos) {
	console.log('[initScene] Initializing Three.js scene...');

	// Scene
	scene = new THREE.Scene();
	scene.background = new THREE.Color(DEFAULT_SCENE_BACKGROUND);

	// Camera
	camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, CAMERA_NEAR, CAMERA_FAR);
	spawnPosition.x = spawnPos ? spawnPos.x : 0;
	spawnPosition.z = spawnPos ? spawnPos.z : 0;
	cameraYaw = 0;
	const initialFollowHeight = getCameraFollowHeight(layout?.profile);
	camera.position.set(
		spawnPosition.x + Math.sin(cameraYaw) * CAMERA_DISTANCE,
		initialFollowHeight,
		spawnPosition.z + Math.cos(cameraYaw) * CAMERA_DISTANCE
	);
	const spawnFloorY = layout
		? resolveFloorY(sampleFloorY(layout, spawnPosition.x, spawnPosition.z))
		: DEFAULT_FLOOR_Y;
	camera.lookAt(spawnPosition.x, spawnFloorY, spawnPosition.z);

	// Renderer
	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);
	renderer.domElement.style.pointerEvents = currentGamePhase === 'playing' ? 'auto' : 'none';

	// Lighting
	const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
	scene.add(ambientLight);
	const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
	directionalLight.position.set(10, 20, 10);
	scene.add(directionalLight);

	// Build dungeon geometry from server layout
	if (layout) {
		clearDungeon(scene, dungeonMeshes);
		const { meshes, spawnPosition: spawn } = buildDungeon(scene, layout);
		dungeonMeshes.push(...meshes);
		spawnPosition.x = spawn.x;
		spawnPosition.z = spawn.z;
		wallColliders = buildWallColliders(layout);
		walkableAABBs = computeWalkableAABBs(layout);
		dungeonBounds = computeDungeonBounds(layout);
		cameraYaw = 0;
	}

	if (layout?.profile === 'spire-ascent') {
		const initFloorY = resolveFloorY(sampleFloorY(layout, spawnPosition.x, spawnPosition.z));
		initSpireAscentAtmosphere(layout, initFloorY);
	} else if (layout?.profile === 'fire-cavern') {
		const initFloorY = resolveFloorY(sampleFloorY(layout, spawnPosition.x, spawnPosition.z));
		initFireCavernAtmosphere(layout, initFloorY);
	} else {
		resetAtmosphere();
		if (layout?.profile) currentLayoutProfile = layout.profile;
	}

	// Place player at spawn position
	myX = spawnPosition.x;
	myZ = spawnPosition.z;
	simX = spawnPosition.x;
	simZ = spawnPosition.z;
	prevSimX = spawnPosition.x;
	prevSimZ = spawnPosition.z;
	moveAccumulator = 0;
	resetSimVelocity();

	// Reset movement when the tab loses focus (keyboard state lives in input.js).
	if (!inputListenersAdded) {
		window.addEventListener('blur', resetMovementKeys);
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState !== 'visible') resetMovementKeys();
		});
		inputListenersAdded = true;
	}

	initGamepadListeners();

	if (!cameraListenersAdded) {
		window.addEventListener('mousedown', (e) => {
			if (e.button !== 2) return;
			isCameraDragging = true;
			e.preventDefault();
		});
		window.addEventListener('mousemove', (e) => {
			if (!isCameraDragging || isLockOnActive()) return;
			cameraYaw -= e.movementX * CAMERA_YAW_SENSITIVITY;
		});
		window.addEventListener('mouseup', (e) => {
			if (e.button === 2) isCameraDragging = false;
		});
		window.addEventListener('mouseleave', () => {
			isCameraDragging = false;
		});
		window.addEventListener('contextmenu', (e) => {
			if (currentGamePhase === 'playing') e.preventDefault();
		});
		cameraListenersAdded = true;
	}

	// Frame timer & render loop
	clock = new THREE.Clock();
	requestAnimationFrame(animate);

	// Resize handler
	window.addEventListener('resize', () => {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);
	});

	sceneInitialized = true;
}

/**
 * Rebuild dungeon geometry from a new server layout without recreating the scene.
 * Used when the player selects a different quest in the lobby.
 *
 * @param {object} layout - { rooms, passages } from server
 */
export function rebuildDungeonLayout(layout) {
	if (!scene || !layout) return;

	clearDungeon(scene, dungeonMeshes);
	const { meshes, spawnPosition: spawn } = buildDungeon(scene, layout);
	dungeonMeshes.push(...meshes);
	spawnPosition.x = spawn.x;
	spawnPosition.z = spawn.z;
	wallColliders = buildWallColliders(layout);
	walkableAABBs = computeWalkableAABBs(layout);
	dungeonBounds = computeDungeonBounds(layout);
	myX = spawnPosition.x;
	myZ = spawnPosition.z;
	simX = spawnPosition.x;
	simZ = spawnPosition.z;
	prevSimX = spawnPosition.x;
	prevSimZ = spawnPosition.z;
	moveAccumulator = 0;
	resetSimVelocity();

	if (layout.profile === 'spire-ascent') {
		const floorY = resolveFloorY(sampleFloorY(layout, spawnPosition.x, spawnPosition.z));
		initSpireAscentAtmosphere(layout, floorY);
	} else if (layout.profile === 'fire-cavern') {
		const floorY = resolveFloorY(sampleFloorY(layout, spawnPosition.x, spawnPosition.z));
		initFireCavernAtmosphere(layout, floorY);
	} else {
		resetAtmosphere();
		if (layout.profile) currentLayoutProfile = layout.profile;
	}
}

// ── Game phase ──

let currentGamePhase = 'lobby';

/**
 * Tell the renderer the current game phase (for visibility toggles).
 * @param {string} phase
 */
export function setGamePhase(phase) {
	currentGamePhase = phase;
	if (renderer?.domElement) {
		renderer.domElement.style.pointerEvents = phase === 'playing' ? 'auto' : 'none';
	}
	if (phase !== 'playing') {
		refreshLockOnInfoPanel();
	}
}

// ── Player movement ──

/**
 * Local slow factor for movement prediction. Reads the local player's broadcast
 * snapshot: when it is currently slowed (`slowedUntil` in the future) the
 * clamped `slowFactor` is returned so prediction advances at the same reduced
 * speed the server applies (no rubber-band). Returns 1 when not slowed or when
 * the fields are missing, leaving unslowed movement unchanged.
 * @param {object} me - local player broadcast snapshot
 * @returns {number} factor in (0, 1]
 */
export function localSlowFactor(me) {
	if (!me || !me.slowedUntil || Date.now() >= me.slowedUntil) return 1;
	const f = Number(me.slowFactor);
	return Number.isFinite(f) && f > 0 && f <= 1 ? f : DEFAULT_SLOW_FACTOR;
}

/**
 * Read WASD keys, normalize direction, apply movement speed, resolve wall
 * collision, and emit 'move'. Called each frame from animate().
 * @param {number} delta - clamped delta in seconds
 */
export function updateMyPlayer(delta) {
	if (!myIdRef) return;

	// Block movement when dead
	const me = gameStateRef && gameStateRef.players[myIdRef];
	if (me && me.dead) {
		clearAllLockOnState();
		lockOnToTarget = null;
		lockOnReleaseLookAt = null;
		refreshLockOnInfoPanel();
		return;
	}

	const lockState = updateLockOn(
		lockOnEnemyPool(),
		simX,
		simZ,
		delta,
		cameraYaw,
		playerRotation,
	);

	refreshLockOnInfoPanel();

	if (lockState.locked) {
		playerRotation = lockState.playerRotation;
		cameraYaw = lockState.cameraYaw;
		lockOnToTarget = lockState.liveToTarget ?? lockState.toTarget;
		lockOnReleaseLookAt = null;
	} else if (isLockOnCameraReleasing()) {
		lockOnToTarget = null;
		const release = updateLockOnCameraRelease(delta, simX, 0.5, simZ);
		if (release) {
			cameraYaw = release.cameraYaw;
			lockOnReleaseLookAt = {
				lookAtX: release.lookAtX,
				lookAtY: release.lookAtY,
				lookAtZ: release.lookAtZ,
			};
		} else {
			lockOnReleaseLookAt = null;
		}
	} else {
		lockOnToTarget = null;
		lockOnReleaseLookAt = null;
		cameraYaw += pollGamepadLook(delta, getGamepadRuntimeOptions().deadzone);
	}

	const cardWindupLocked = isLocalPlayerCardWindup();
	const movement = cardWindupLocked ? null : getMovementInput();
	const layout = gameStateRef?.layout;
	let dirX = 0;
	let dirZ = 0;
	let moveRotation = playerRotation;

	if (movement) {
		moveAccumulator += delta;
		moveEmitAccumulator += delta;
		// Target-relative while locked: stick up/down closes or opens distance,
		// left/right strafes. Uses live bearing so frozen close-range camera
		// aim does not swap or zero out forward/back input.
		const dir = lockState.locked && lockState.liveToTarget
			? targetRelativeDirection(movement.x, movement.z, lockState.liveToTarget)
			: cameraRelativeDirection(movement.x, movement.z);
		dirX = dir.x;
		dirZ = dir.z;
		moveRotation = lockState.locked
			? playerRotation
			: Math.atan2(dirZ, dirX);
	} else {
		moveEmitAccumulator = 0;
		if (isCoastingOnSlippery(layout)) {
			moveAccumulator += delta;
		}
	}

	const speedScale = clientMoveSpeedScale(me) * localSlowFactor(me);
	while (moveAccumulator >= TICK_DT) {
		prevSimX = simX;
		prevSimZ = simZ;
		const tickResult = tickMovementPrediction({
			x: simX,
			z: simZ,
			vx: simVx,
			vz: simVz,
			layout,
			inputDx: dirX,
			inputDz: dirZ,
			inputActive: Boolean(movement),
			speedScale,
			tryPlayerMove,
			colliders: wallColliders,
			walkableAABBs,
			bounds: dungeonBounds,
			tickRate: TICK_RATE,
			moveSpeed: MOVE_SPEED,
			slipperyAccel: SLIPPERY_ACCEL,
			slipperyFriction: SLIPPERY_FRICTION,
			normalStopFriction: NORMAL_STOP_FRICTION,
		});
		simX = tickResult.x;
		simZ = tickResult.z;
		simVx = tickResult.vx;
		simVz = tickResult.vz;
		moveAccumulator -= TICK_DT;
	}

	if (movement) {
		while (moveEmitAccumulator >= TICK_DT && socketRef) {
			moveEmitAccumulator -= TICK_DT;
			moveSequence += 1;
			lastEmittedRotation = moveRotation;
			socketRef.emit(CLIENT_TO_SERVER.MOVE, {
				dx: dirX,
				dz: dirZ,
				rotation: moveRotation,
				sequence: moveSequence,
			});
		}
	}

	updatePlayerFacing();

	const alpha = TICK_DT > 0 ? moveAccumulator / TICK_DT : 0;
	myX = prevSimX + (simX - prevSimX) * alpha;
	myZ = prevSimZ + (simZ - prevSimZ) * alpha;
}

// ── Player avatar (cosmetic-driven) ──

// Defaults used when a cosmetic field is missing/invalid. Mirrors the server's
// DEFAULT_COSMETIC in game/server/cosmetic.js.
const DEFAULT_AVATAR_BODY_COLOR = 0x4f9dde;
const DEFAULT_AVATAR_ACCENT_COLOR = 0xf2c94c;
const DEAD_AVATAR_COLOR = 0x808080;

// Standing height (world units) the glTF player avatar is normalized to. Matches
// the spike contract in game/docs/MODEL_SPIKE.md (1.8, feet at y=0).
const PLAYER_MODEL_HEIGHT = 1.8;

// Body-shape vocabulary, kept in sync with the server's BODY_SHAPES.
const AVATAR_BODY_SHAPES = new Set(['box', 'cylinder', 'cone', 'capsule']);
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

// Proportion morph-target vocabulary — the SAME case-sensitive strings used by
// the server's cosmetic.proportions{}, the glTF morph targets, and the UI
// sliders. There is NO alias/rename layer (see game/docs/MODEL_SPIKE.md):
// proportions[key] maps 1:1 onto morphTargetInfluences[morphTargetDictionary[key]].
const PROPORTION_MORPH_KEYS = [
	'height',
	'headSize',
	'torsoWidth',
	'armLength',
	'legLength',
	'shoulderWidth',
];

// Hat catalog ids, kept in sync with the server's HAT_CATALOG in
// game/server/cosmetic.js. 'none' (and any unknown id) renders no hat.
const AVATAR_HAT_IDS = new Set(['none', 'cap', 'wizard', 'crown', 'bandana', 'beanie']);

// Base mesh variant ids, kept in sync with MODEL_IDS in game/server/cosmetic.js.
const AVATAR_MODEL_IDS = new Set(['player']);

// Per-hat colors, distinct from one another and from the default body/accent.
const HAT_CAP_COLOR = 0x2e7d32; // forest green
const HAT_WIZARD_COLOR = 0x5b3a8a; // deep purple
const HAT_CROWN_COLOR = 0xffd700; // gold
const HAT_BANDANA_COLOR = 0xc62828; // crimson red
const HAT_BEANIE_COLOR = 0x00695c; // slate teal

// Per-key-item prop colors (worn as a small torso badge). Ids match the server's
// KEY_ITEM_DEFS in game/server/progression.js. Each defined prop gets a distinct
// geometry + color; ids without a mapping render no prop (see buildKeyItemProp).
const KEY_ITEM_DODGE_COLOR = 0x06b6d4; // cyan
const KEY_ITEM_GUARD_COLOR = 0x3b82f6; // steel blue
const KEY_ITEM_MAGNET_COLOR = 0xdc2626; // magnet red
const KEY_ITEM_MAGNET_PRONG_COLOR = 0x9ca3af; // steel grey
const KEY_ITEM_MEDIC_COLOR = 0xf1f5f9; // medkit white
const KEY_ITEM_MEDIC_CROSS_COLOR = 0xdc2626; // cross red
const KEY_ITEM_SUMMON_COLOR = 0xf59e0b; // amber
const KEY_ITEM_FLARE_COLOR = 0xf97316; // signal orange
const KEY_ITEM_SMOKE_COLOR = 0x64748b; // slate grey
const KEY_ITEM_OVERCLOCK_COLOR = 0xfacc15; // electric yellow
const KEY_ITEM_ANCHOR_COLOR = 0x78716c; // iron brown
const KEY_ITEM_PHASE_COLOR = 0xa855f7; // phase purple

/**
 * Build the ~1-unit-tall body geometry for a given body shape.
 * Unknown/missing shapes fall back to a box.
 * @param {string} shape
 * @returns {THREE.BufferGeometry}
 */
function buildBodyGeometry(shape) {
	switch (shape) {
		case 'cylinder':
			return new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
		case 'cone':
			return new THREE.ConeGeometry(0.55, 1, 24);
		case 'capsule':
			return new THREE.CapsuleGeometry(0.4, 0.5, 8, 16);
		case 'box':
		default:
			return new THREE.BoxGeometry(1, 1, 1);
	}
}

/**
 * Approximate Y coordinate of the top of the ~1-unit-tall body for a given
 * shape, used to seat the hat on the head regardless of bodyShape. The body
 * geometries are centered at the group origin; the capsule is taller than the
 * others (radius 0.4 + half-length 0.25).
 * @param {string} shape
 * @returns {number}
 */
function bodyTopY(shape) {
	switch (shape) {
		case 'capsule':
			return 0.65; // 0.4 radius + 0.25 half-length
		case 'box':
		case 'cylinder':
		case 'cone':
		default:
			return 0.5;
	}
}

/**
 * Build a hat child object for a catalog hat id, seated so its base sits at the
 * group origin (the caller positions it at the body's top). Returns null for
 * `none` or any unknown id so no hat mesh is added. Each catalog hat gets a
 * distinct, recognizable shape and color.
 * @param {string} hatId
 * @returns {THREE.Object3D|null}
 */
function buildHatMesh(hatId) {
	switch (hatId) {
		case 'cap': {
			// A low cap: a short dome-ish cylinder with a thin brim.
			const hat = new THREE.Group();
			const crownGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.22, 20);
			const crownMat = new THREE.MeshStandardMaterial({ color: HAT_CAP_COLOR });
			const crown = new THREE.Mesh(crownGeo, crownMat);
			crown.position.y = 0.13;
			hat.add(crown);
			const brimGeo = new THREE.CylinderGeometry(0.58, 0.58, 0.05, 20);
			const brimMat = new THREE.MeshStandardMaterial({ color: HAT_CAP_COLOR });
			const brim = new THREE.Mesh(brimGeo, brimMat);
			brim.position.y = 0.025;
			hat.add(brim);
			return hat;
		}
		case 'wizard': {
			// A tall pointed cone.
			const geo = new THREE.ConeGeometry(0.42, 0.85, 20);
			const mat = new THREE.MeshStandardMaterial({ color: HAT_WIZARD_COLOR });
			const cone = new THREE.Mesh(geo, mat);
			cone.position.y = 0.425; // half-height so the base sits at the origin
			return cone;
		}
		case 'crown': {
			// A gold ring crown sitting flat on the head.
			const geo = new THREE.TorusGeometry(0.34, 0.09, 12, 24);
			const mat = new THREE.MeshStandardMaterial({
				color: HAT_CROWN_COLOR,
				metalness: 0.6,
				roughness: 0.3
			});
			const ring = new THREE.Mesh(geo, mat);
			ring.rotation.x = Math.PI / 2; // lay the torus flat to read as a ring
			ring.position.y = 0.1;
			return ring;
		}
		case 'bandana': {
			// A thin flat band hugging the head, lower-profile than the crown
			// and a non-gold red. A small knotted tail reads as a tied bandana.
			const hat = new THREE.Group();
			const mat = new THREE.MeshStandardMaterial({ color: HAT_BANDANA_COLOR });
			const bandGeo = new THREE.TorusGeometry(0.4, 0.05, 10, 24);
			const band = new THREE.Mesh(bandGeo, mat);
			band.rotation.x = Math.PI / 2; // lay flat to wrap around the head
			band.position.y = 0.06;
			hat.add(band);
			const knotGeo = new THREE.ConeGeometry(0.08, 0.18, 8);
			const knot = new THREE.Mesh(knotGeo, mat);
			knot.position.set(-0.4, 0.06, 0);
			knot.rotation.z = Math.PI / 2; // point the tail outward to the side
			hat.add(knot);
			return hat;
		}
		case 'beanie': {
			// A small snug dome: a low half-sphere clipped to the upper hemisphere
			// so its base sits at the group origin.
			const geo = new THREE.SphereGeometry(0.44, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
			const mat = new THREE.MeshStandardMaterial({
				color: HAT_BEANIE_COLOR,
				roughness: 0.9
			});
			const dome = new THREE.Mesh(geo, mat);
			return dome;
		}
		case 'none':
		default:
			return null;
	}
}

/**
 * Build a key-item prop child object for a catalog key item id, centered at the
 * group origin (callers seat it on the avatar's torso). Mirrors buildHatMesh:
 * each defined id returns a distinct THREE.Group/Mesh with its own geometry +
 * MeshStandardMaterial color. Returns null for `'none'`, null/undefined, and any
 * unknown/unmapped id so no prop is added (graceful "no prop").
 *
 * Key item ids come from the server's KEY_ITEM_DEFS
 * (game/server/progression.js). Ids without a case here intentionally fall
 * through to `null` rather than erroring.
 * @param {string} keyItemId
 * @returns {THREE.Object3D|null}
 */
export function buildKeyItemProp(keyItemId) {
	switch (keyItemId) {
		case 'dodge_roll': {
			// A faceted gem reads as a quick, agile movement charm.
			const geo = new THREE.OctahedronGeometry(0.2, 0);
			const mat = new THREE.MeshStandardMaterial({ color: KEY_ITEM_DODGE_COLOR });
			return new THREE.Mesh(geo, mat);
		}
		case 'guard_block': {
			// A flat shield plate worn on the chest.
			const geo = new THREE.BoxGeometry(0.32, 0.42, 0.07);
			const mat = new THREE.MeshStandardMaterial({
				color: KEY_ITEM_GUARD_COLOR,
				metalness: 0.4,
				roughness: 0.5,
			});
			return new THREE.Mesh(geo, mat);
		}
		case 'loot_magnet': {
			// A stubby horseshoe magnet: a red body bar with two grey prong tips.
			const prop = new THREE.Group();
			const bodyMat = new THREE.MeshStandardMaterial({ color: KEY_ITEM_MAGNET_COLOR });
			const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.12), bodyMat);
			body.position.y = -0.04;
			prop.add(body);
			const prongMat = new THREE.MeshStandardMaterial({
				color: KEY_ITEM_MAGNET_PRONG_COLOR,
				metalness: 0.6,
				roughness: 0.4,
			});
			for (const x of [-0.09, 0.09]) {
				const prong = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 12), prongMat);
				prong.position.set(x, 0.12, 0);
				prop.add(prong);
			}
			return prop;
		}
		case 'field_medic_kit': {
			// A white medkit box with a red cross on its face.
			const prop = new THREE.Group();
			const boxMat = new THREE.MeshStandardMaterial({
				color: KEY_ITEM_MEDIC_COLOR,
				roughness: 0.8,
			});
			const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.14), boxMat);
			prop.add(box);
			const crossMat = new THREE.MeshStandardMaterial({ color: KEY_ITEM_MEDIC_CROSS_COLOR });
			const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.04), crossMat);
			crossV.position.z = 0.08;
			prop.add(crossV);
			const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.04), crossMat);
			crossH.position.z = 0.08;
			prop.add(crossH);
			return prop;
		}
		case 'summon_recall': {
			// A small whistle/horn cone.
			const geo = new THREE.ConeGeometry(0.14, 0.34, 14);
			const mat = new THREE.MeshStandardMaterial({ color: KEY_ITEM_SUMMON_COLOR });
			const cone = new THREE.Mesh(geo, mat);
			cone.rotation.z = Math.PI / 2; // lay the horn sideways across the chest
			return cone;
		}
		case 'flare_beacon': {
			// A glowing signal ball.
			const geo = new THREE.IcosahedronGeometry(0.2, 0);
			const mat = new THREE.MeshStandardMaterial({
				color: KEY_ITEM_FLARE_COLOR,
				emissive: KEY_ITEM_FLARE_COLOR,
				emissiveIntensity: 0.5,
			});
			return new THREE.Mesh(geo, mat);
		}
		case 'smoke_bomb': {
			// A round grey bomb.
			const geo = new THREE.SphereGeometry(0.2, 16, 12);
			const mat = new THREE.MeshStandardMaterial({
				color: KEY_ITEM_SMOKE_COLOR,
				roughness: 0.9,
			});
			return new THREE.Mesh(geo, mat);
		}
		case 'overclock': {
			// A short cylindrical capacitor/cog.
			const geo = new THREE.CylinderGeometry(0.2, 0.2, 0.12, 16);
			const mat = new THREE.MeshStandardMaterial({
				color: KEY_ITEM_OVERCLOCK_COLOR,
				metalness: 0.5,
				roughness: 0.4,
			});
			const cyl = new THREE.Mesh(geo, mat);
			cyl.rotation.x = Math.PI / 2; // face the disc outward from the chest
			return cyl;
		}
		case 'ground_anchor': {
			// A heavy iron block.
			const geo = new THREE.BoxGeometry(0.2, 0.3, 0.2);
			const mat = new THREE.MeshStandardMaterial({
				color: KEY_ITEM_ANCHOR_COLOR,
				metalness: 0.7,
				roughness: 0.5,
			});
			return new THREE.Mesh(geo, mat);
		}
		case 'phase_step': {
			// A faceted teleport crystal.
			const geo = new THREE.IcosahedronGeometry(0.18, 0);
			const mat = new THREE.MeshStandardMaterial({
				color: KEY_ITEM_PHASE_COLOR,
				emissive: KEY_ITEM_PHASE_COLOR,
				emissiveIntensity: 0.3,
			});
			return new THREE.Mesh(geo, mat);
		}
		case 'none':
		default:
			return null;
	}
}

/**
 * Resolve a #RRGGBB hex string into a numeric hex, falling back to `fallbackHex`
 * when the value is missing or invalid.
 * @param {*} hex
 * @param {number} fallbackHex
 * @returns {number}
 */
function avatarColorHex(hex, fallbackHex) {
	if (typeof hex === 'string' && HEX_COLOR_RE.test(hex)) return parseInt(hex.slice(1), 16);
	return fallbackHex;
}

/**
 * Resolve the MODEL_REGISTRY key for a cosmetic's base mesh variant.
 * Mirrors server MODEL_IDS validation; unknown/absent ids fall back to 'player'.
 * @param {*} modelId
 * @returns {string}
 */
function resolveAvatarModelKey(modelId) {
	return (typeof modelId === 'string' && AVATAR_MODEL_IDS.has(modelId)) ? modelId : 'player';
}

/**
 * Stable signature string for a cosmetic, used to detect when an avatar needs
 * to be rebuilt. Only the fields that affect geometry/material are included.
 * @param {*} cosmetic
 * @returns {string}
 */
function cosmeticSignature(cosmetic) {
	const c = (cosmetic && typeof cosmetic === 'object' && !Array.isArray(cosmetic)) ? cosmetic : {};
	const shape = AVATAR_BODY_SHAPES.has(c.bodyShape) ? c.bodyShape : 'box';
	const body = (typeof c.bodyColor === 'string' && HEX_COLOR_RE.test(c.bodyColor)) ? c.bodyColor.toLowerCase() : 'default';
	const accent = (typeof c.accentColor === 'string' && HEX_COLOR_RE.test(c.accentColor)) ? c.accentColor.toLowerCase() : 'default';
	const hat = AVATAR_HAT_IDS.has(c.hat) ? c.hat : 'none';
	const modelKey = resolveAvatarModelKey(c.modelId);
	return `${shape}|${body}|${accent}|${hat}|${modelKey}`;
}

/**
 * Build a player avatar as a THREE.Group from a cosmetic profile. The body mesh
 * geometry is chosen by `bodyShape` and tinted by `bodyColor`; a smaller accent
 * band is tinted by `accentColor`. A missing/invalid cosmetic falls back to the
 * default colors and box shape rather than crashing.
 *
 * The returned group stores on `userData`:
 *   - `bodyMesh`: the body Mesh (target for color/flash/transparency)
 *   - `accentMesh`: the accent Mesh
 *   - `baseColor`: numeric hex of the alive body color
 *   - `cosmeticKey`: signature for change detection
 *   - `isAvatar`: marker flag
 *
 * @param {object} cosmetic - { bodyColor, accentColor, bodyShape }
 * @param {boolean} isSelf - whether this avatar is the local player
 * @param {string} [equippedKeyItemId] - the player's equipped key item id; its
 *   prop is seated on the torso (omitted/`none`/unknown → no prop).
 * @returns {THREE.Group}
 */
export function createPlayerAvatar(cosmetic, isSelf, equippedKeyItemId) {
	const c = (cosmetic && typeof cosmetic === 'object' && !Array.isArray(cosmetic)) ? cosmetic : {};
	const shape = AVATAR_BODY_SHAPES.has(c.bodyShape) ? c.bodyShape : 'box';

	const group = new THREE.Group();

	// Body mesh — colored from bodyColor (numeric hex so material.color exposes
	// setHex for later state recoloring, matching the rest of the renderer).
	const bodyHex = avatarColorHex(c.bodyColor, DEFAULT_AVATAR_BODY_COLOR);
	const bodyGeo = buildBodyGeometry(shape);
	const bodyMat = new THREE.MeshStandardMaterial({ color: bodyHex });
	const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
	group.add(bodyMesh);

	// Accent band — a thin ring around the body tinted from accentColor.
	const accentHex = avatarColorHex(c.accentColor, DEFAULT_AVATAR_ACCENT_COLOR);
	const accentGeo = new THREE.CylinderGeometry(0.56, 0.56, 0.18, 24);
	const accentMat = new THREE.MeshStandardMaterial({ color: accentHex });
	const accentMesh = new THREE.Mesh(accentGeo, accentMat);
	accentMesh.position.y = 0.18;
	group.add(accentMesh);

	// Hat — a child mesh seated on top of the body so it reads as worn on the
	// head and inherits the group's rotation. `none`/unknown adds no mesh.
	const hatId = AVATAR_HAT_IDS.has(c.hat) ? c.hat : 'none';
	const hat = buildHatMesh(hatId);
	if (hat) {
		hat.position.y = bodyTopY(shape);
		group.add(hat);
		group.userData.hatMesh = hat;
	}
	// Record the resolved hat id so the async glTF load callback can rebuild the
	// hat and seat it on the loaded model's head bone (the procedural group-level
	// hat above is hidden alongside the body when the glTF resolves).
	group.userData.hatId = hatId;

	// Key-item prop — a child mesh seated on the torso so it reads as worn on the
	// chest and inherits the group's rotation. Added BEFORE attachRegistryModel so
	// it is captured by the procedural snapshot and hidden alongside the body when
	// the glTF resolves (a fresh prop is then seated on the spine bone). `none` /
	// unknown / undefined adds no mesh.
	const keyItemId = equippedKeyItemId || 'none';
	group.userData.keyItemId = keyItemId;
	attachProceduralKeyItemProp(group);

	group.userData.isAvatar = true;
	group.userData.bodyMesh = bodyMesh;
	group.userData.accentMesh = accentMesh;
	group.userData.baseColor = bodyHex;
	group.userData.cosmeticKey = cosmeticSignature(c);

	const modelKey = resolveAvatarModelKey(c.modelId);
	attachRegistryModel(modelKey, group);

	return group;
}

/**
 * Drive a loaded glTF body mesh's proportion morph-target influences from a
 * cosmetic `proportions{}` object, mapping each of the six keys 1:1 by IDENTICAL
 * name (no alias/translation table — see game/docs/MODEL_SPIKE.md):
 *   morphTargetInfluences[morphTargetDictionary[key]] = proportions[key].
 *
 * Absent keys and non-finite values are skipped so that target keeps its current
 * (rest) influence rather than becoming `undefined`. Safe no-op when the mesh
 * carries no morph targets (procedural primitive fallback in use).
 *
 * @param {THREE.Mesh|null|undefined} skinnedMesh
 * @param {*} proportions
 */
function applyProportionMorphs(skinnedMesh, proportions) {
	const dict = skinnedMesh && skinnedMesh.morphTargetDictionary;
	const influences = skinnedMesh && skinnedMesh.morphTargetInfluences;
	if (!dict || !influences) return; // no morph targets → procedural fallback, no-op
	if (!proportions || typeof proportions !== 'object' || Array.isArray(proportions)) return;

	for (const key of PROPORTION_MORPH_KEYS) {
		if (!Object.prototype.hasOwnProperty.call(proportions, key)) continue;
		const value = proportions[key];
		if (!Number.isFinite(value)) continue;
		const idx = dict[key];
		if (idx === undefined) continue; // model lacks this morph → skip, leave at rest
		influences[idx] = value;
	}
}

/**
 * (Re)apply cosmetic proportions + body/accent tint to a player's LOADED glTF
 * avatar each update, so a broadcast cosmetic change takes effect WITHOUT a page
 * reload (proportions are not part of cosmeticSignature, so the avatar is not
 * rebuilt for proportion-only changes — we re-apply influences on the existing
 * mesh instead).
 *
 * Body tint flows through `userData.baseColor` so the dead/flash/invuln recolor
 * paths from sub-ticket 01 still win when active (they recolor the same cloned
 * body material this routes through). Accent tint applies only when the body
 * mesh exposes a distinguishable accent material (a material array); the
 * committed player.glb body mesh (`SuperHero_Male`) carries a single material,
 * so accent currently has no separate surface and is left untinted — we do not
 * invent a second mesh (MODEL_SPIKE.md).
 *
 * Safe no-op when the procedural primitive is in use (no `modelOverride`).
 *
 * @param {THREE.Object3D} host - the avatar group from createPlayerAvatar
 * @param {*} cosmetic
 */
function applyLoadedModelCosmetic(host, cosmetic) {
	if (!host || !host.userData || !host.userData.modelOverride) return; // procedural fallback → no-op
	const bodyMesh = host.userData.bodyMesh;
	if (!bodyMesh) return;

	const c = (cosmetic && typeof cosmetic === 'object' && !Array.isArray(cosmetic)) ? cosmetic : {};

	applyProportionMorphs(bodyMesh, c.proportions);

	// Body tint: route through baseColor so the dead/flash/invuln recolor paths
	// restore the cosmetic body color rather than the model's intrinsic color.
	host.userData.baseColor = avatarColorHex(c.bodyColor, DEFAULT_AVATAR_BODY_COLOR);

	// Accent tint: only when the body mesh exposes a separate accent material.
	// Single-material bodies (current player.glb) have no accent surface.
	if (Array.isArray(bodyMesh.material) && bodyMesh.material.length > 1) {
		const accentMat = bodyMesh.material[1];
		if (accentMat && accentMat.color && accentMat.color.setHex) {
			accentMat.color.setHex(avatarColorHex(c.accentColor, DEFAULT_AVATAR_ACCENT_COLOR));
		}
	}
}

/**
 * Apply proportion morph-target influences to a preview/avatar group by
 * resolving its body mesh (`userData.bodyMesh`, else the object itself) and
 * reusing `applyProportionMorphs`. Keeps the 1:1 identical-name mapping with no
 * alias layer, and inherits its no-op guards: a missing morph dictionary (the
 * procedural primitive, or the glTF body not yet loaded) is a safe no-op with no
 * thrown errors. This lets callers re-apply the current proportions every frame
 * so a change made before the async model loads still lands once it is ready.
 *
 * @param {THREE.Object3D|null|undefined} host - avatar group or bare body mesh
 * @param {*} proportions - cosmetic.proportions{} (six identical-name keys)
 */
export function applyAvatarProportions(host, proportions) {
	if (!host) return;
	applyProportionMorphs(resolveBodyMesh(host), proportions);
}

/** @internal Test-only exports for avatar cosmetic morph/tint/hat unit coverage. */
export const __testOnly = {
	applyProportionMorphs,
	applyLoadedModelCosmetic,
	attachGltfHat,
};

/**
 * Resolve the body mesh from an avatar group (via `userData.bodyMesh`), or
 * return the object itself if it's already a bare mesh. Returns null for falsy.
 * @param {THREE.Object3D|null|undefined} obj
 * @returns {THREE.Mesh|null}
 */
function resolveBodyMesh(obj) {
	if (!obj) return null;
	if (obj.userData && obj.userData.bodyMesh) return obj.userData.bodyMesh;
	return obj;
}

/**
 * Dispose every mesh geometry/material under an avatar group (or bare mesh) so
 * it can be safely removed from the scene without leaking GPU resources.
 * @param {THREE.Object3D} obj
 */
export function disposeAvatar(obj) {
	if (!obj) return;
	obj.traverse((node) => {
		if (node.isMesh) {
			if (node.geometry) node.geometry.dispose();
			if (node.material) node.material.dispose();
		}
	});
}

// ── Nameplate sprite helpers ──

/**
 * Create a canvas-texture sprite that displays a player username as a label.
 * Returns a `THREE.Sprite` ready to be added to the scene or parented to an
 * avatar group. Callers are responsible for positioning and lifecycle (add to
 * `playerNameplates`, call `disposeNameplate()` on removal).
 *
 * @param {string} username
 * @returns {THREE.Sprite}
 */
export function createNameplate(username) {
	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = 128;
	const ctx = canvas.getContext('2d');

	// Semi-transparent rounded-rect background
	ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
	const radius = 20;
	const w = canvas.width;
	const h = canvas.height;
	ctx.beginPath();
	ctx.moveTo(radius, 0);
	ctx.lineTo(w - radius, 0);
	ctx.quadraticCurveTo(w, 0, w, radius);
	ctx.lineTo(w, h - radius);
	ctx.quadraticCurveTo(w, h, w - radius, h);
	ctx.lineTo(radius, h);
	ctx.quadraticCurveTo(0, h, 0, h - radius);
	ctx.lineTo(0, radius);
	ctx.quadraticCurveTo(0, 0, radius, 0);
	ctx.closePath();
	ctx.fill();

	// Centered text with shadow (matches spawnDamageNumber text-shadow style)
	ctx.fillStyle = '#ffffff';
	ctx.font = 'bold 48px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
	ctx.shadowBlur = 6;
	ctx.fillText(username, w / 2, h / 2);

	const texture = new THREE.CanvasTexture(canvas);
	texture.minFilter = THREE.LinearFilter;

	const material = new THREE.SpriteMaterial({
		map: texture,
		transparent: true,
		depthTest: false,
	});

	const sprite = new THREE.Sprite(material);
	sprite.scale.set(1.2, 0.3, 1);
	sprite.userData.username = username;

	return sprite;
}

/**
 * Remove and dispose the nameplate sprite for a player. Cleans up the texture,
 * material, and registry entry.
 *
 * @param {string} playerId
 */
export function disposeNameplate(playerId) {
	const sprite = playerNameplates[playerId];
	if (!sprite) return;

	if (sprite.parent) {
		sprite.parent.remove(sprite);
	}
	if (sprite.material) {
		if (sprite.material.map) sprite.material.map.dispose();
		sprite.material.dispose();
	}
	delete playerNameplates[playerId];
}

// ── Flash mesh helper ──

/**
 * Flash a mesh by setting its material emissive to a bright color,
 * then restoring the original emissive/intensity after `durationMs`.
 * @param {THREE.Mesh} mesh
 * @param {number} color - hex color (e.g. 0xffffff)
 * @param {number} durationMs - how long the flash lasts
 */
export function flashMesh(mesh, color, durationMs) {
	// Accept either an avatar group (flash its body mesh) or a bare mesh.
	const target = resolveBodyMesh(mesh);
	if (!target || !target.material) return;

	// Save original emissive state
	const mat = target.material;
	const origEmissive = mat.emissive ? (mat.emissive.getHex ? mat.emissive.getHex() : 0x000000) : 0x000000;
	const origIntensity = mat.emissiveIntensity || 0;

	// Apply flash
	if (mat.emissive && mat.emissive.set) {
		mat.emissive.set(color);
	} else {
		mat.emissive = color;
	}
	mat.emissiveIntensity = 1.5;

	// Restore after duration
	setTimeout(() => {
		if (mat.emissive && mat.emissive.set) {
			mat.emissive.set(origEmissive);
		} else {
			mat.emissive = origEmissive;
		}
		mat.emissiveIntensity = origIntensity;
	}, durationMs);
}

// ── Dash VFX (squash + ghost trail) ──

/**
 * Trigger a squash-and-stretch effect on the local player mesh,
 * plus a short-lived ghost clone at the current position.
 * @param {string} playerId
 */
export function triggerDashVFX(playerId) {
	const mesh = playersMeshes[playerId];
	if (!mesh) return;
	// Resolve the body mesh — squash/ghost target geometry+material from it,
	// while the squash scale applies to the whole avatar (group or bare mesh).
	const bodyMesh = resolveBodyMesh(mesh);
	if (!bodyMesh || !bodyMesh.geometry || !bodyMesh.material) return;

	// Squash: flatten Y, widen X/Z
	mesh.scale.set(1.3, 0.7, 1.3);

	// Lerp scale back to (1,1,1) over 150ms
	const startTime = performance.now();
	const squashDuration = 150;
	function restoreScale() {
		const t = Math.min((performance.now() - startTime) / squashDuration, 1);
		const s = 1 + (1.3 - 1) * (1 - t);
		const sy = 0.7 + (1 - 0.7) * t;
		mesh.scale.set(s, sy, s);
		if (t < 1) requestAnimationFrame(restoreScale);
	}
	requestAnimationFrame(restoreScale);

	// Ghost clone at current position that fades over 200ms
	const ghost = new THREE.Mesh(
		bodyMesh.geometry,
		new THREE.MeshStandardMaterial({
			color: bodyMesh.material.color.getHex(),
			transparent: true,
			opacity: 0.45,
			depthWrite: false,
		})
	);
	ghost.position.copy(mesh.position);
	ghost.rotation.copy(mesh.rotation);
	ghost.scale.setScalar(0.95);
	scene.add(ghost);

	const ghostStart = performance.now();
	const ghostDuration = 200;
	function fadeGhost() {
		const gt = Math.min((performance.now() - ghostStart) / ghostDuration, 1);
		ghost.material.opacity = 0.45 * (1 - gt);
		if (gt < 1) {
			requestAnimationFrame(fadeGhost);
		} else {
			scene.remove(ghost);
			// Don't dispose geometry — it's shared with the player mesh
			ghost.material.dispose();
		}
	}
	requestAnimationFrame(fadeGhost);
}

// ── Heal pulse VFX (Field Medic Kit) ──

const HEAL_PULSE_DURATION = 600;
const HEAL_PULSE_EXPAND_MS = 400;
const HEAL_PULSE_COLOR = 0x44ff44;

// ── Shield VFX (Guard Block) ──

const SHIELD_DURATION = 800;
const SHIELD_COLOR = 0x22d3ee;
const SHIELD_EMISSIVE = 0x06b6d4;
const SHIELD_RADIUS = 0.9;
const SHIELD_OFFSET_DIST = 0.7; // distance in front of player
const shieldVFX = {}; // playerId → { mesh, startTime }

/**
 * Spawn a green expanding ring at the caster's position to visualize
 * the Field Medic Kit heal pulse. Expands from radius 0 to healRadius
 * over ~400 ms, then fades out over ~200 ms.
 *
 * @param {{ x: number, y: number, z: number }} position
 * @param {number} healRadius — metres; must match server KEY_ITEM_DEFS.field_medic_kit.healRadius
 */
export function triggerHealPulseVFX(position, healRadius) {
	if (!scene) return;
	const geometry = new THREE.RingGeometry(0.1, 0.5, 32);
	const material = new THREE.MeshStandardMaterial({
		color: HEAL_PULSE_COLOR,
		emissive: HEAL_PULSE_COLOR,
		emissiveIntensity: 1.2,
		transparent: true,
		opacity: 1.0,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.position.set(position.x, 0.1, position.z);
	mesh.rotation.x = -Math.PI / 2;
	mesh.scale.setScalar(0.001);
	scene.add(mesh);

	const startTime = performance.now();
	function animatePulse() {
		const elapsed = performance.now() - startTime;
		const t = Math.min(elapsed / HEAL_PULSE_DURATION, 1.0);

		if (elapsed < HEAL_PULSE_EXPAND_MS) {
			// Expand phase: scale from 0 to healRadius * 2
			const expandT = elapsed / HEAL_PULSE_EXPAND_MS;
			mesh.scale.setScalar(healRadius * 2 * expandT);
		} else {
			// Fade phase: keep full size, reduce opacity
			mesh.scale.setScalar(healRadius * 2);
			const fadeT = (elapsed - HEAL_PULSE_EXPAND_MS) / (HEAL_PULSE_DURATION - HEAL_PULSE_EXPAND_MS);
			mesh.material.opacity = Math.max(0, 1.0 - fadeT);
		}

		if (t < 1) {
			requestAnimationFrame(animatePulse);
		} else {
			scene.remove(mesh);
			geometry.dispose();
			material.dispose();
		}
	}
	requestAnimationFrame(animatePulse);
}

const MEDIC_BEAD_COLOR = 0x2dd4bf;
const MEDIC_BEAD_EMISSIVE = 0x14b8a6;
const MEDIC_HEAL_DEFAULT_RADIUS = 6;

/**
 * Ally-heal pulse at the medic position (wraps the Field Medic Kit ring VFX).
 *
 * @param {{ x: number, y?: number, z: number }} position
 * @param {number} [healRadius] — metres; matches server ENEMY_DEFS.field_medic.healRadius
 */
export function triggerMedicAllyHealVFX(position, healRadius) {
	if (!scene || !position) return;
	if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) return;
	const radius = Number.isFinite(healRadius) && healRadius > 0
		? healRadius
		: MEDIC_HEAL_DEFAULT_RADIUS;
	triggerHealPulseVFX(position, radius);
}

/**
 * Narrow energy-bead beam along the medic attack vector (phase-beam corridor).
 *
 * @param {{ origin: { x: number, z: number }, direction: { x: number, z: number }, beadRange?: number, hitWidth?: number, hits?: Array<{ playerId?: string }> }} record
 */
export function triggerMedicEnergyBeadVFX(record) {
	if (!scene || !record) return;
	const { origin, direction, beadRange, hitWidth, hits } = record;
	if (!origin || !direction) return;
	if (!Number.isFinite(origin.x) || !Number.isFinite(origin.z)) return;
	if (!Number.isFinite(direction.x) || !Number.isFinite(direction.z)) return;

	spawnAttackEffect(
		{ x: origin.x, z: origin.z },
		{ x: direction.x, z: direction.z },
		{
			effect: 'returning_projectile',
			returnPasses: 0,
			range: Number.isFinite(beadRange) ? beadRange : 8,
			projectileHitWidth: Number.isFinite(hitWidth) ? hitWidth : 0.5,
			color: MEDIC_BEAD_COLOR,
			emissive: MEDIC_BEAD_EMISSIVE,
		},
	);

	if (!hits?.length) return;
	for (const hit of hits) {
		if (!hit.playerId) continue;
		const mesh = playersMeshes[hit.playerId];
		if (!mesh) continue;
		spawnHitSpark(
			{ x: mesh.position.x, y: mesh.position.y + 0.6, z: mesh.position.z },
			{ color: MEDIC_BEAD_COLOR, emissive: MEDIC_BEAD_EMISSIVE, count: 5, spread: 0.55 },
		);
	}
}

// ── Loot magnet VFX ──

const LOOT_MAGNET_DURATION = 700;
const LOOT_MAGNET_EXPAND_MS = 450;
const LOOT_MAGNET_COLOR = 0xf59e0b;
const LOOT_MAGNET_DEFAULT_RADIUS = 8;

/**
 * Spawn a gold/amber expanding ring at the caster's position to visualize a
 * successful Loot Magnet pull. Expands to attractRadius over ~450 ms, then
 * fades out before geometry/material disposal.
 *
 * @param {{ x: number, y: number, z: number }} position
 * @param {number} [attractRadius] — metres; matches server loot_magnet.attractRadius
 */
export function triggerLootMagnetVFX(position, attractRadius = LOOT_MAGNET_DEFAULT_RADIUS) {
	if (!scene) return;
	const radius = Number.isFinite(attractRadius) && attractRadius > 0
		? attractRadius
		: LOOT_MAGNET_DEFAULT_RADIUS;
	const geometry = new THREE.RingGeometry(0.1, 0.5, 32);
	const material = new THREE.MeshStandardMaterial({
		color: LOOT_MAGNET_COLOR,
		emissive: LOOT_MAGNET_COLOR,
		emissiveIntensity: 1.1,
		transparent: true,
		opacity: 1.0,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.position.set(position.x, 0.12, position.z);
	mesh.rotation.x = -Math.PI / 2;
	mesh.scale.setScalar(0.001);
	scene.add(mesh);

	const startTime = performance.now();
	function animatePulse() {
		const elapsed = performance.now() - startTime;
		const t = Math.min(elapsed / LOOT_MAGNET_DURATION, 1.0);

		if (elapsed < LOOT_MAGNET_EXPAND_MS) {
			const expandT = elapsed / LOOT_MAGNET_EXPAND_MS;
			mesh.scale.setScalar(radius * 2 * expandT);
		} else {
			mesh.scale.setScalar(radius * 2);
			const fadeT = (elapsed - LOOT_MAGNET_EXPAND_MS) / (LOOT_MAGNET_DURATION - LOOT_MAGNET_EXPAND_MS);
			mesh.material.opacity = Math.max(0, 1.0 - fadeT);
		}

		if (t < 1) {
			requestAnimationFrame(animatePulse);
		} else {
			scene.remove(mesh);
			geometry.dispose();
			material.dispose();
		}
	}
	requestAnimationFrame(animatePulse);
}

// ── Shield VFX (Guard Block) ──

/**
 * Spawn a translucent cyan shield disc in front of the player to visualize
 * the Guard Block active state. The shield is oriented along the player's
 * facing direction (rotation.y) and fades out after ~800ms.
 *
 * @param {string} playerId
 */
export function triggerShieldVFX(playerId) {
	if (!scene || !playersMeshes[playerId]) return;

	const playerMesh = playersMeshes[playerId];

	// Remove existing shield for this player if present
	if (shieldVFX[playerId]) {
		const old = shieldVFX[playerId];
		scene.remove(old.mesh);
		old.mesh.geometry.dispose();
		old.mesh.material.dispose();
		delete shieldVFX[playerId];
	}

	// Create a semi-transparent disc facing forward
	const geometry = new THREE.CircleGeometry(SHIELD_RADIUS, 24);
	const material = new THREE.MeshStandardMaterial({
		color: SHIELD_COLOR,
		emissive: SHIELD_EMISSIVE,
		emissiveIntensity: 0.8,
		transparent: true,
		opacity: 0.55,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geometry, material);

	// Position in front of the player along facing direction
	const yaw = playerMesh.rotation.y + Math.PI / 2; // convert back from display rotation
	const fx = playerMesh.position.x + Math.cos(yaw) * SHIELD_OFFSET_DIST;
	const fz = playerMesh.position.z + Math.sin(yaw) * SHIELD_OFFSET_DIST;
	mesh.position.set(fx, playerMesh.position.y + 0.5, fz);
	mesh.rotation.y = playerMesh.rotation.y; // align with player facing

	scene.add(mesh);
	shieldVFX[playerId] = { mesh, startTime: performance.now() };

	const startTime = performance.now();
	function animateShield() {
		const elapsed = performance.now() - startTime;
		const t = Math.min(elapsed / SHIELD_DURATION, 1);

		// Fade out in last 30% of duration
		if (elapsed > SHIELD_DURATION * 0.7) {
			const fadeT = (elapsed - SHIELD_DURATION * 0.7) / (SHIELD_DURATION * 0.3);
			material.opacity = 0.55 * (1 - fadeT);
		}

		if (t < 1) {
			requestAnimationFrame(animateShield);
		} else {
			if (shieldVFX[playerId] && shieldVFX[playerId].mesh === mesh) {
				scene.remove(mesh);
				geometry.dispose();
				material.dispose();
				delete shieldVFX[playerId];
			}
		}
	}
	requestAnimationFrame(animateShield);
}

// ── Smoke VFX (Smoke Bomb) ──

const SMOKE_DURATION = 2000; // matches the server smoke-zone durationMs
const SMOKE_FADE_START = 0.6; // fraction of duration before the puff fades out
const SMOKE_COLOR = 0x9aa0a6; // soft grey
const SMOKE_PUFF_COUNT = 6;
const SMOKE_BASE_OPACITY = 0.42;
const smokeVFX = {}; // playerId → { group, geometries, materials, startTime }

function disposeSmoke(entry) {
	if (!entry) return;
	if (scene) scene.remove(entry.group);
	for (const g of entry.geometries) g.dispose();
	for (const m of entry.materials) m.dispose();
}

/**
 * Spawn a translucent grey smoke puff at the given world position to visualize
 * a Smoke Bomb concealment zone. The puff is a small cluster of low-opacity
 * spheres that gently rises and expands, then fades out over ~2s before being
 * removed from the scene and disposed.
 *
 * @param {{ x: number, y: number, z: number }} position
 * @param {string|null} [playerId] - when provided, the puff is tracked per
 *   player so the per-frame update loop can re-trigger it while the zone is
 *   active and avoid spawning duplicates.
 */
export function triggerSmokeVFX(position, playerId = null) {
	if (!scene) return;

	// Replace any existing tracked puff for this player so casts don't stack.
	if (playerId != null && smokeVFX[playerId]) {
		disposeSmoke(smokeVFX[playerId]);
		delete smokeVFX[playerId];
	}

	const group = new THREE.Group();
	const geometries = [];
	const materials = [];
	for (let i = 0; i < SMOKE_PUFF_COUNT; i++) {
		const r = 0.6 + Math.random() * 0.7;
		const geometry = new THREE.SphereGeometry(r, 12, 12);
		const material = new THREE.MeshStandardMaterial({
			color: SMOKE_COLOR,
			emissive: SMOKE_COLOR,
			emissiveIntensity: 0.12,
			transparent: true,
			opacity: SMOKE_BASE_OPACITY,
			depthWrite: false,
		});
		const puff = new THREE.Mesh(geometry, material);
		const angle = (i / SMOKE_PUFF_COUNT) * Math.PI * 2;
		const spread = 0.6 + Math.random() * 0.8;
		puff.position.set(
			Math.cos(angle) * spread,
			0.4 + Math.random() * 0.5,
			Math.sin(angle) * spread,
		);
		group.add(puff);
		geometries.push(geometry);
		materials.push(material);
	}
	group.position.set(position.x, position.y || 0, position.z);
	scene.add(group);

	const entry = { group, geometries, materials, startTime: performance.now() };
	if (playerId != null) smokeVFX[playerId] = entry;

	function animateSmoke() {
		const elapsed = performance.now() - entry.startTime;
		const t = Math.min(elapsed / SMOKE_DURATION, 1);

		// Gentle rise + expansion as the smoke billows out.
		group.scale.setScalar(1 + t * 0.5);

		if (t > SMOKE_FADE_START) {
			const fadeT = (t - SMOKE_FADE_START) / (1 - SMOKE_FADE_START);
			const op = SMOKE_BASE_OPACITY * (1 - fadeT);
			for (const m of materials) m.opacity = op;
		}

		if (t < 1) {
			requestAnimationFrame(animateSmoke);
		} else if (playerId == null || smokeVFX[playerId] === entry) {
			// Only dispose if a re-trigger hasn't already replaced this entry.
			disposeSmoke(entry);
			if (playerId != null) delete smokeVFX[playerId];
		}
	}
	requestAnimationFrame(animateSmoke);
}

// ── Floating damage numbers ──

/**
 * Spawn a floating number above a 3D position.
 * @param {number} x - 3D X coordinate
 * @param {number} y - 3D Y coordinate (height above ground)
 * @param {number} z - 3D Z coordinate
 * @param {number} amount - amount to display
 * @param {string} color - CSS color string
 * @param {boolean} positive - if true, show as "+N" instead of "-N"
 * @param {string} [suffix] - optional text after the number (e.g. " MS")
 */
export function spawnDamageNumber(x, y, z, amount, color, positive, suffix = '') {
	if (!document.body) return;

	const rounded = Math.abs(Math.round(Number(amount) || 0));
	const prefix = positive ? '+' : '-';
	const el = document.createElement('div');
	el.textContent = `${prefix}${rounded}${suffix}`;
	el.style.cssText = `
		position: fixed;
		left: 0;
		top: 0;
		font-size: 22px;
		font-weight: 800;
		color: ${color || '#ff0000'};
		text-shadow: 0 0 6px rgba(0,0,0,0.8), 0 2px 4px rgba(0,0,0,0.6);
		pointer-events: none;
		z-index: 1000;
		transform: translate(-50%, -50%);
		opacity: 1;
		transition: none;
	`;
	document.body.appendChild(el);

	damageNumbers.push({
		element: el,
		createdAt: performance.now(),
		position3d: { x, y, z },
		duration: DAMAGE_NUMBER_DURATION,
	});
}

/**
 * Update floating damage number positions and remove expired ones.
 */
export function updateDamageNumbers() {
	if (!camera || !renderer) return;

	const now = performance.now();
	const vec = new THREE.Vector3();

	for (let i = damageNumbers.length - 1; i >= 0; i--) {
		const dn = damageNumbers[i];
		const elapsed = now - dn.createdAt;

		if (elapsed >= dn.duration) {
			dn.element.remove();
			damageNumbers.splice(i, 1);
			continue;
		}

		// Float upward over time
		const floatOffset = (elapsed / dn.duration) * 1.5;
		vec.set(dn.position3d.x, dn.position3d.y + floatOffset, dn.position3d.z);
		vec.project(camera);

		// Convert to screen coordinates
		const sx = (vec.x * 0.5 + 0.5) * window.innerWidth;
		const sy = (-vec.y * 0.5 + 0.5) * window.innerHeight;

		// Fade out in the last half of the lifetime
		const opacity = elapsed > dn.duration * 0.5
			? 1.0 - (elapsed - dn.duration * 0.5) / (dn.duration * 0.5)
			: 1.0;

		// Hide if behind camera (vec.z > 1)
		if (vec.z > 1) {
			dn.element.style.display = 'none';
		} else {
			dn.element.style.display = 'block';
			dn.element.style.left = `${sx}px`;
			dn.element.style.top = `${sy}px`;
			dn.element.style.opacity = String(Math.max(0, opacity));
		}
	}
}

// ── Enemy mesh creation ──

/**
 * Return the half-height for an enemy type.
 * @param {string} type
 * @returns {number}
 */
export function enemyMeshHalfHeight(type) {
	const def = ENEMY_GEOMETRY[type] || ENEMY_GEOMETRY.grunt;
	return def.type === 'octahedron' ? def.radius : def.height / 2;
}

/**
 * Create a Three.js mesh for an enemy based on its type.
 * @param {string} type - 'grunt', 'skirmisher', 'miniboss', or 'spawner'
 * @returns {THREE.Mesh}
 */
export function createEnemyMesh(type) {
	const def = ENEMY_GEOMETRY[type] || ENEMY_GEOMETRY.grunt;
	let geo;
	if (def.type === 'octahedron') {
		geo = new THREE.OctahedronGeometry(def.radius);
	} else {
		geo = new THREE.ConeGeometry(def.radius, def.height, def.segments);
	}

	const matProps = { color: def.color };
	if (def.emissive != null) matProps.emissive = def.emissive;
	if (def.emissiveIntensity != null) matProps.emissiveIntensity = def.emissiveIntensity;

	const mat = new THREE.MeshStandardMaterial(matProps);
	const mesh = new THREE.Mesh(geo, mat);
	mesh._origColor = def.color;
	mesh._origEmissive = def.emissive != null ? def.emissive : 0x000000;
	mesh._origEmissiveIntensity = def.emissiveIntensity != null ? def.emissiveIntensity : 0;
	attachRegistryModel(type, mesh);
	return mesh;
}

// ── Enemy health bar helpers ──

/**
 * Return a hex color for an enemy health bar based on HP ratio.
 * @param {number} hp
 * @param {number} maxHp
 */
export function healthBarColor(hp, maxHp) {
	const pct = maxHp > 0 ? hp / maxHp : 0;
	if (pct > 0.5) return 0x22c55e;       // green
	if (pct > 0.25) return 0xeab308;      // yellow
	return 0xef4444;                       // red
}

/**
 * Create a health-bar mesh positioned above an enemy.
 * @param {string} enemyId
 * @param {number} x
 * @param {number} z
 * @param {string} [type] - enemy type for correct vertical placement
 * @returns {THREE.Mesh}
 */
export function createHealthBarMesh(enemyId, x, z, type) {
	const geo = new THREE.BoxGeometry(1.2, 0.1, 0.1);
	const mat = new THREE.MeshStandardMaterial({ color: 0x22c55e });
	const mesh = new THREE.Mesh(geo, mat);
	const halfHeight = enemyMeshHalfHeight(type);
	mesh.position.set(x, halfHeight + 0.5, z);
	scene.add(mesh);
	return mesh;
}

function enemyIsDamaged(enemy) {
	const maxHp = enemy.maxHp || enemy.hp;
	return enemy.hp < maxHp;
}

function ensureEnemyHealthBar(enemyId, enemy) {
	if (!enemyIsDamaged(enemy)) return;
	if (!enemyHealthBars[enemyId]) {
		enemyHealthBars[enemyId] = createHealthBarMesh(enemyId, enemy.x, enemy.z, enemy.type);
	}
}

/**
 * Update a health bar's scale and color to reflect current HP.
 * @param {string} enemyId
 * @param {object} enemy - { hp, maxHp }
 */
export function updateHealthBarMesh(enemyId, enemy) {
	const mesh = enemyHealthBars[enemyId];
	if (!mesh) return;

	const maxHp = enemy.maxHp || enemy.hp;
	const ratio = Math.max(0, enemy.hp / maxHp);
	mesh.scale.x = ratio;
	mesh.material.color.setHex(healthBarColor(enemy.hp, maxHp));
}

const ENEMY_SHIELD_BAR_COLOR = 0x22d3ee;

/**
 * Create a slim shield-absorb bar above the HP bar.
 * @param {string} enemyId
 * @param {number} x
 * @param {number} z
 * @param {string} type
 * @returns {THREE.Mesh}
 */
export function createEnemyShieldBarMesh(enemyId, x, z, type) {
	const geo = new THREE.BoxGeometry(1.2, 0.06, 0.1);
	const mat = new THREE.MeshStandardMaterial({ color: ENEMY_SHIELD_BAR_COLOR });
	const mesh = new THREE.Mesh(geo, mat);
	const halfHeight = enemyMeshHalfHeight(type);
	mesh.position.set(x, halfHeight + 0.65, z);
	scene.add(mesh);
	return mesh;
}

function ensureEnemyShieldBar(enemyId, enemy) {
	if ((enemy.shieldHp || 0) <= 0) {
		if (enemyShieldBars[enemyId]) {
			disposeOne(enemyShieldBars, enemyId, scene);
		}
		return;
	}
	if (!enemyShieldBars[enemyId]) {
		enemyShieldBars[enemyId] = createEnemyShieldBarMesh(enemyId, enemy.x, enemy.z, enemy.type);
	}
}

/**
 * Update shield bar scale to reflect remaining absorb HP.
 * @param {string} enemyId
 * @param {object} enemy - { shieldHp, maxShieldHp }
 */
export function updateEnemyShieldBarMesh(enemyId, enemy) {
	const mesh = enemyShieldBars[enemyId];
	if (!mesh) return;

	const maxShield = enemy.maxShieldHp || enemy.shieldHp || 1;
	const ratio = Math.max(0, (enemy.shieldHp || 0) / maxShield);
	mesh.scale.x = ratio;
}

/**
 * Apply or remove the windup emissive flash on an enemy mesh.
 * @param {string} enemyId
 * @param {boolean} isWindup
 */
export function applyWindupFlash(enemyId, isWindup) {
	const mesh = enemiesMeshes[enemyId];
	if (!mesh || !mesh.material || !mesh.material.emissive) return;

	if (isWindup) {
		if (!windupFlashing.has(enemyId)) {
			mesh.material.emissive.set(0xff3333);
			mesh.material.emissiveIntensity = 1.5;
			windupFlashing.add(enemyId);
		}
	} else {
		if (windupFlashing.has(enemyId)) {
			mesh.material.emissive.set(0x000000);
			mesh.material.emissiveIntensity = 0;
			windupFlashing.delete(enemyId);
		}
	}
}

// ── Reveal highlight (Flare Beacon) ──

const REVEAL_GLOW_COLOR = 0xffaa00;
const REVEAL_GLOW_INTENSITY = 1.0;

/**
 * Apply or remove the amber emissive glow on a revealed enemy mesh.
 * Reveal glow takes priority over windup flash and damage flash.
 * @param {string} enemyId
 * @param {object} enemy - { revealedUntil }
 */
export function applyRevealHighlight(enemyId, enemy) {
	const mesh = enemiesMeshes[enemyId];
	if (!mesh || !mesh.material || !mesh.material.emissive) return;

	if (enemy.revealedUntil && Date.now() < enemy.revealedUntil) {
		mesh.material.emissive.set(REVEAL_GLOW_COLOR);
		mesh.material.emissiveIntensity = REVEAL_GLOW_INTENSITY;
	} else {
		mesh.material.emissive.set(mesh._origEmissive || 0x000000);
		mesh.material.emissiveIntensity =
			(mesh._origEmissiveIntensity != null ? mesh._origEmissiveIntensity : 0);
	}
}

// ── Variant visuals (body tint + floating badge) ──

/** Cool cyan body tint for warded enemies — distinct from grunt/skirmisher/miniboss palettes. */
export const WARDED_TINT = 0x22d3ee;

/** Red body tint for frenzied enemies — distinct from volatile hot-orange badge. */
export const FRENZIED_TINT = 0xb91c1c;

/** @type {Record<string, number>} */
const VARIANT_BADGE_COLORS = {
	default: 0xc026d3, // magenta — distinct from amber reveal/yellow lock-on
	leeching: 0x14b8a6, // teal — distinct from default variant badge
	warded: 0x22d3ee, // cyan — matches warded body tint / shield bar
	volatile: 0xf97316, // hot orange — distinct "will detonate" threat read
	frenzied: 0xdc2626, // red — distinct from volatile orange and other variant badges
};

/** @type {Record<string, { color: number, intensity: number }>} */
const VARIANT_MESH_TINTS = {
	leeching: { color: 0x0d9488, intensity: 0.45 },
};

function variantBadgeColor(variant) {
	return VARIANT_BADGE_COLORS[variant] ?? VARIANT_BADGE_COLORS.default;
}

/** Per-variant badge colors; unknown variants use the default badge color. */
export const VARIANT_MARKER_COLORS = {
	warded: VARIANT_BADGE_COLORS.warded,
	volatile: VARIANT_BADGE_COLORS.volatile,
	frenzied: VARIANT_BADGE_COLORS.frenzied,
};

/**
 * Resolve the floating variant badge color for a variant id.
 * @param {string} [variant]
 * @returns {number}
 */
export function variantMarkerColor(variant) {
	return variantBadgeColor(variant);
}

/**
 * Apply or clear per-variant body tints on an enemy mesh (color channel only;
 * windup/reveal flashes continue to use emissive on the same material).
 * @param {string} enemyId
 * @param {object} enemy - { variant }
 */
export function applyEnemyVariantTint(enemyId, enemy) {
	const mesh = enemiesMeshes[enemyId];
	if (!mesh || !mesh.material || !mesh.material.color) return;

	if (enemy && enemy.variant === 'warded') {
		mesh.material.color.setHex(WARDED_TINT);
	} else if (enemy && enemy.variant === 'frenzied') {
		mesh.material.color.setHex(FRENZIED_TINT);
	} else if (mesh._origColor != null) {
		mesh.material.color.setHex(mesh._origColor);
	}
}

/**
 * Build the floating badge shown above a variant ("elite") enemy: a small
 * emissive diamond, kept separate from the enemy mesh so it never collides with
 * the windup/reveal emissive bookkeeping on the enemy material.
 * @param {number} badgeColor
 * @returns {THREE.Mesh}
 */
function createVariantMarker(badgeColor) {
	const geo = new THREE.OctahedronGeometry(0.22);
	const mat = new THREE.MeshStandardMaterial({
		color: badgeColor,
		emissive: badgeColor,
		emissiveIntensity: 0.9,
	});
	return new THREE.Mesh(geo, mat);
}

/**
 * Add or remove a variant badge for an enemy, driven purely by `enemy.variant`
 * each update. A truthy variant gets a badge positioned above the mesh; a
 * falsy/absent variant has any existing badge disposed, so a reused enemy id
 * never keeps a stale marker. Safe when `variant` is undefined/null.
 * @param {string} enemyId
 * @param {object} enemy - { variant, x, z, type }
 */
export function applyVariantMarker(enemyId, enemy) {
	if (enemy && enemy.variant) {
		const badgeColor = variantBadgeColor(enemy.variant);
		if (!variantMarkerMeshes[enemyId]) {
			variantMarkerMeshes[enemyId] = createVariantMarker(badgeColor);
			scene.add(variantMarkerMeshes[enemyId]);
		} else {
			const mat = variantMarkerMeshes[enemyId].material;
			if (mat.color.getHex() !== badgeColor) {
				mat.color.setHex(badgeColor);
				mat.emissive.setHex(badgeColor);
			}
		}
		const halfHeight = enemyMeshHalfHeight(enemy.type);
		const marker = variantMarkerMeshes[enemyId];
		marker.position.set(enemy.x, halfHeight + 0.95, enemy.z);
		// Slow spin so the badge reads as an active marker rather than scenery.
		marker.rotation.y = ((Date.now() % 4000) / 4000) * Math.PI * 2;
	} else if (variantMarkerMeshes[enemyId]) {
		disposeOne(variantMarkerMeshes, enemyId, scene);
	}
}

/**
 * Apply or remove a per-variant emissive tint on the enemy mesh. Reveal glow and
 * windup flash take priority; when neither is active, leeching enemies get a
 * subtle teal tint and all others restore `_origEmissive` bookkeeping.
 * @param {string} enemyId
 * @param {object} enemy - { variant, revealedUntil, attackState }
 */
export function applyVariantEmissiveTint(enemyId, enemy) {
	const mesh = enemiesMeshes[enemyId];
	if (!mesh || !mesh.material || !mesh.material.emissive) return;

	const revealed = enemy.revealedUntil && Date.now() < enemy.revealedUntil;
	const windup = enemy.attackState === 'windup' || windupFlashing.has(enemyId);
	if (revealed || windup) return;

	const tint = enemy.variant ? VARIANT_MESH_TINTS[enemy.variant] : null;
	if (tint) {
		mesh.material.emissive.set(tint.color);
		mesh.material.emissiveIntensity = tint.intensity;
	} else {
		mesh.material.emissive.set(mesh._origEmissive || 0x000000);
		mesh.material.emissiveIntensity =
			(mesh._origEmissiveIntensity != null ? mesh._origEmissiveIntensity : 0);
	}
}

// ── Frenzied enrage telegraph ring ──

/**
 * Create a pulsing red ring on the ground around a frenzied enemy during its
 * pre-enrage telegraph window.
 * @returns {THREE.Mesh}
 */
function createFrenziedTelegraphRing() {
	const geo = new THREE.RingGeometry(2.5, 3.2, 32);
	const mat = new THREE.MeshBasicMaterial({
		color: 0xff2222,
		transparent: true,
		opacity: 0.7,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.rotation.x = -Math.PI / 2;
	return mesh;
}

/**
 * Show or hide the frenzied enrage telegraph ring for an enemy. Driven by
 * `enemy.enrageTelegraphUntil` from the server snapshot: when the timestamp
 * is in the future, the ring is shown with pulsing opacity; otherwise it is
 * disposed.
 * @param {string} enemyId
 * @param {object} enemy - { enrageTelegraphUntil, x, z }
 */
export function applyFrenziedTelegraphRing(enemyId, enemy) {
	const now = Date.now();
	const telegraphActive = enemy && enemy.enrageTelegraphUntil && now < enemy.enrageTelegraphUntil;

	if (telegraphActive) {
		if (!frenziedTelegraphMeshes[enemyId]) {
			frenziedTelegraphMeshes[enemyId] = createFrenziedTelegraphRing();
			scene.add(frenziedTelegraphMeshes[enemyId]);
		}
		const ring = frenziedTelegraphMeshes[enemyId];
		ring.position.set(enemy.x, GROUND_OVERLAY_Y, enemy.z);
		// Pulse opacity: oscillate between 0.25 and 0.85 at ~2 Hz
		const pulse = 0.5 + 0.5 * Math.sin((now % 1000) / 1000 * Math.PI * 4);
		ring.material.opacity = 0.25 + pulse * 0.6;
	} else if (frenziedTelegraphMeshes[enemyId]) {
		disposeOne(frenziedTelegraphMeshes, enemyId, scene);
	}
}

// ── Slow status indicator ──

// Icy cool-blue (0x8fd3ff), deliberately distinct from the amber lock-on ring, red
// frenzied telegraph, and saturated-cyan phase-step/shield visuals so a slowed
// entity reads at a glance without being confused with any other status marker.

/**
 * Create a ground ring marker for a slowed entity. The pale ice-blue colour and
 * wider radius keep it visually separate from the lock-on/frenzied/phase-step
 * rings so "slowed" is never mistaken for another status.
 * @returns {THREE.Mesh}
 */
function createSlowMarker() {
	const geo = new THREE.RingGeometry(0.75, 1.05, 32);
	const mat = new THREE.MeshBasicMaterial({
		color: 0x8fd3ff,
		transparent: true,
		opacity: 0.7,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.rotation.x = -Math.PI / 2;
	return mesh;
}

/**
 * Show or hide the slow indicator for an entity (player or enemy). Driven by
 * `slowedUntil`: while it is in the future the icy ring is shown at the entity's
 * feet with a gentle pulse; once it passes (or the entity is gone) the marker is
 * disposed so nothing stays stuck on screen.
 * @param {Object} markerMap - per-entity marker map (enemySlowMarkers / playerSlowMarkers)
 * @param {string} id - entity id
 * @param {object} entity - { slowedUntil, x, z }
 */
function applySlowIndicator(markerMap, id, entity) {
	const now = Date.now();
	const slowed = entity && entity.slowedUntil && now < entity.slowedUntil;

	if (slowed) {
		if (!markerMap[id]) {
			markerMap[id] = createSlowMarker();
			scene.add(markerMap[id]);
		}
		const marker = markerMap[id];
		marker.position.set(entity.x, GROUND_OVERLAY_Y + 0.01, entity.z);
		// Slow ~1 Hz pulse so the ring reads as an active "drag" effect.
		const pulse = 0.5 + 0.5 * Math.sin((now % 1500) / 1500 * Math.PI * 2);
		marker.material.opacity = 0.4 + pulse * 0.4;
	} else if (markerMap[id]) {
		disposeOne(markerMap, id, scene);
	}
}

// ── Burning status indicator ──

// Warm fire palette (orange shell + bright yellow core), deliberately the
// opposite end of the spectrum from the icy cool-blue slow ring and the pale
// freeze visuals so a burning entity reads instantly and is never confused with
// "slowed" or "frozen".

/**
 * Create an attached flame for a burning entity: two stacked additive cones
 * (an orange outer shell and a brighter yellow inner core) that rise from the
 * entity's feet. Returned as a group so the per-frame flicker can scale the two
 * cones independently. The warm colour keeps it distinct from the icy slow ring.
 * @returns {THREE.Group}
 */
function createBurnMarker() {
	const group = new THREE.Group();
	// Outer shell — broad, deeper orange, semi-transparent.
	const outer = new THREE.Mesh(
		new THREE.ConeGeometry(0.45, 1.3, 12, 1, true),
		new THREE.MeshBasicMaterial({
			color: 0xff5a1e,
			transparent: true,
			opacity: 0.6,
			side: THREE.DoubleSide,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
		}),
	);
	outer.position.y = 0.65;
	group.add(outer);
	// Inner core — narrower, brighter yellow so the flame has a hot centre.
	const inner = new THREE.Mesh(
		new THREE.ConeGeometry(0.25, 0.85, 12, 1, true),
		new THREE.MeshBasicMaterial({
			color: 0xffd24a,
			transparent: true,
			opacity: 0.8,
			side: THREE.DoubleSide,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
		}),
	);
	inner.position.y = 0.45;
	group.add(inner);
	group.userData.outer = outer;
	group.userData.inner = inner;
	return group;
}

/**
 * Show or hide the burning flame for an entity (player or enemy). Driven by
 * `burningUntil`: while it is in the future a flickering flame is shown at the
 * entity's feet; once it passes (or the entity is gone) the flame is disposed so
 * nothing stays stuck on screen. The flicker (fast scale/opacity variation on
 * both cones, plus a slow spin) makes the fire read as alive rather than a
 * static sprite, and contrasts with the slow ring's gentle ~1 Hz pulse.
 * @param {Object} markerMap - per-entity marker map (enemyBurnMarkers / playerBurnMarkers)
 * @param {string} id - entity id
 * @param {object} entity - { burningUntil, x, z }
 */
function applyBurnIndicator(markerMap, id, entity) {
	const now = Date.now();
	const burning = entity && entity.burningUntil && now < entity.burningUntil;

	if (burning) {
		if (!markerMap[id]) {
			markerMap[id] = createBurnMarker();
			scene.add(markerMap[id]);
		}
		const marker = markerMap[id];
		marker.position.set(entity.x, GROUND_OVERLAY_Y, entity.z);
		// Two out-of-phase fast flickers (~4 Hz / ~6 Hz) drive the cones'
		// height and opacity so the flame jitters like real fire.
		const flickerA = 0.5 + 0.5 * Math.sin((now % 250) / 250 * Math.PI * 2);
		const flickerB = 0.5 + 0.5 * Math.sin((now % 170) / 170 * Math.PI * 2);
		const { outer, inner } = marker.userData;
		outer.scale.set(1, 0.85 + flickerA * 0.4, 1);
		outer.material.opacity = 0.45 + flickerA * 0.35;
		inner.scale.set(1, 0.8 + flickerB * 0.5, 1);
		inner.material.opacity = 0.6 + flickerB * 0.35;
		// Slow spin so the flame shimmers instead of sitting flat.
		marker.rotation.y = (now % 2000) / 2000 * Math.PI * 2;
	} else if (markerMap[id]) {
		disposeOne(markerMap, id, scene);
	}
}

// ── Attack visual effects ──

// Room floors are 0.1-tall boxes centered at FLOOR_Y (top ≈ FLOOR_Y + 0.05).
// Ground overlays must sit above that surface or they clip inside the floor mesh.
const GROUND_OVERLAY_Y = FLOOR_Y + 0.07;

function createLockOnRing() {
	const geo = new THREE.RingGeometry(0.55, 0.75, 24);
	const mat = new THREE.MeshBasicMaterial({
		color: 0xfbbf24,
		transparent: true,
		opacity: 0.85,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.rotation.x = -Math.PI / 2;
	return mesh;
}

function syncLockOnRing(enemyId, enemyX, enemyZ) {
	const lockedId = getLockedEnemyId();
	if (lockedId === enemyId) {
		if (!enemyLockOnRings[enemyId]) {
			enemyLockOnRings[enemyId] = createLockOnRing();
			scene.add(enemyLockOnRings[enemyId]);
		}
		enemyLockOnRings[enemyId].position.set(enemyX, GROUND_OVERLAY_Y + 0.02, enemyZ);
		enemyLockOnRings[enemyId].visible = true;
	} else if (enemyLockOnRings[enemyId]) {
		enemyLockOnRings[enemyId].visible = false;
	}
}

function createPhaseStepAllyRing() {
	// Cyan ground ring, distinct from the amber lock-on reticle, to mark the
	// ally that phase_step would swap with.
	const geo = new THREE.RingGeometry(0.6, 0.85, 28);
	const mat = new THREE.MeshBasicMaterial({
		color: 0x22d3ee,
		transparent: true,
		opacity: 0.85,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.rotation.x = -Math.PI / 2;
	return mesh;
}

/**
 * Recompute the nearest living, non-extracted ally within phase_step range and
 * update the highlight ring. Only active while the local player is playing with
 * phase_step equipped; otherwise the target is cleared and the ring hidden.
 * Mirrors the server's nearest-ally selection in handleUseKeyItem.
 */
function syncPhaseStepAllyHighlight(gs, myId) {
	let nearestId = null;
	const me = myId != null ? gs.players[myId] : null;
	if (
		currentGamePhase === 'playing'
		&& me && !me.dead && !me.extracted
		&& me.equippedKeyItemId === 'phase_step'
	) {
		let bestDist = Infinity;
		for (const [id, p] of Object.entries(gs.players)) {
			if (id === myId || !p || p.dead || p.extracted) continue;
			const d = Math.hypot(p.x - me.x, p.z - me.z);
			if (d <= PHASE_STEP_RANGE && d < bestDist) {
				bestDist = d;
				nearestId = id;
			}
		}
	}

	phaseStepTargetId = nearestId;

	if (nearestId && gs.players[nearestId]) {
		if (!phaseStepAllyRing) {
			phaseStepAllyRing = createPhaseStepAllyRing();
			scene.add(phaseStepAllyRing);
		}
		const ally = gs.players[nearestId];
		phaseStepAllyRing.position.set(ally.x, GROUND_OVERLAY_Y + 0.02, ally.z);
		phaseStepAllyRing.visible = true;
	} else if (phaseStepAllyRing) {
		phaseStepAllyRing.visible = false;
	}
}

/** Id of the ally currently highlighted for phase_step, or null when none in range. */
export function getPhaseStepTargetId() {
	return phaseStepTargetId;
}

const HITBOX_FILL_OPACITY = 0.32;
const HITBOX_EDGE_OPACITY = 0.72;

function makeHitboxMaterial(color, emissive, opacity) {
	return new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: 0.65,
		transparent: true,
		opacity,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
}

function disposeEffectObject(mesh, targetScene) {
	const sc = targetScene || scene;
	if (!mesh || !sc) return;
	sc.remove(mesh);
	mesh.traverse?.((child) => {
		if (child.geometry) child.geometry.dispose();
		if (child.material) child.material.dispose();
	});
	if (mesh.geometry) mesh.geometry.dispose();
	if (mesh.material) mesh.material.dispose();
}

function fadeHitboxOpacity(root, lifeRatio) {
	root.traverse((child) => {
		if (child.material && child.material.opacity != null) {
			const base = child.userData.hitboxOpacity ?? HITBOX_FILL_OPACITY;
			child.material.opacity = Math.max(0.01, lifeRatio * base);
		}
	});
}

function createEnemyHitboxGroup(radius) {
	const group = new THREE.Group();
	const color = 0xff4466;
	const emissive = 0xff2244;
	const fillMat = makeHitboxMaterial(color, emissive, 0.22);
	const edgeMat = makeHitboxMaterial(color, emissive, 0.55);

	const fill = new THREE.Mesh(
		new THREE.RingGeometry(radius * 0.2, radius, 32),
		fillMat,
	);
	fill.rotation.x = -Math.PI / 2;
	fill.userData.hitboxKind = 'fill';
	fill.userData.hitboxOpacity = 0.22;
	group.add(fill);

	const edge = new THREE.Mesh(
		new THREE.RingGeometry(Math.max(radius * 0.85, radius - 0.06), radius, 32),
		edgeMat,
	);
	edge.rotation.x = -Math.PI / 2;
	edge.userData.hitboxKind = 'edge';
	edge.userData.hitboxOpacity = 0.55;
	group.add(edge);

	const wire = new THREE.Mesh(
		new THREE.CylinderGeometry(radius, radius, 1.1, 24, 1, true),
		new THREE.MeshBasicMaterial({
			color,
			wireframe: true,
			transparent: true,
			opacity: 0.35,
			depthWrite: false,
		}),
	);
	wire.position.y = 0.55;
	wire.userData.hitboxKind = 'wire';
	group.add(wire);

	return group;
}

function createEnemyRadialTelegraph(range) {
	const geo = new THREE.RingGeometry(range * 0.9, range, 32);
	const mat = new THREE.MeshStandardMaterial({
		color: 0xff3333,
		emissive: 0xff3333,
		emissiveIntensity: 1.0,
		transparent: true,
		opacity: 0.5,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.rotation.x = -Math.PI / 2;
	return mesh;
}

/** Sky-blue ring for player card wind-up — distinct from enemy attack telegraphs. */
function createPlayerCardWindupTelegraph() {
	const geo = new THREE.RingGeometry(0.38, 0.58, 32);
	const mat = new THREE.MeshStandardMaterial({
		color: 0x38bdf8,
		emissive: 0x0ea5e9,
		emissiveIntensity: 1.2,
		transparent: true,
		opacity: 0.55,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.rotation.x = -Math.PI / 2;
	return mesh;
}

function applyPlayerCardWindupFlash(playerId, isWindup) {
	const avatar = playersMeshes[playerId];
	const body = avatar?.userData?.bodyMesh;
	if (!body?.material?.emissive) return;

	if (isWindup) {
		if (!playerCardWindupFlashing.has(playerId)) {
			body.material.emissive.set(0x38bdf8);
			body.material.emissiveIntensity = 1.2;
			playerCardWindupFlashing.add(playerId);
		}
	} else if (playerCardWindupFlashing.has(playerId)) {
		body.material.emissive.set(0x000000);
		body.material.emissiveIntensity = 0;
		playerCardWindupFlashing.delete(playerId);
	}
}

function applyPlayerCardWindupIndicator(id, player, x, z) {
	const windup = isPlayerCardWindup(player);
	if (windup) {
		applyPlayerCardWindupFlash(id, true);
		if (!playerCardWindupMarkers[id]) {
			const ring = createPlayerCardWindupTelegraph();
			scene.add(ring);
			playerCardWindupMarkers[id] = ring;
		}
		playerCardWindupMarkers[id].position.set(x, GROUND_OVERLAY_Y + 0.02, z);
	} else {
		disposeOne(playerCardWindupMarkers, id, scene);
		applyPlayerCardWindupFlash(id, false);
	}
}

function getEnemyWindupDirection(enemy, targetPlayer) {
	if (enemy.windupDirX != null && enemy.windupDirZ != null) {
		return { x: enemy.windupDirX, z: enemy.windupDirZ };
	}
	if (targetPlayer) {
		const dx = targetPlayer.x - enemy.x;
		const dz = targetPlayer.z - enemy.z;
		const len = Math.hypot(dx, dz);
		if (len > 0) return { x: dx / len, z: dz / len };
	}
	return { x: 1, z: 0 };
}

function createEnemyAttackTelegraph(enemy, targetEntity) {
	const visual = ENEMY_ATTACK_VISUAL[enemy.type] || ENEMY_ATTACK_VISUAL.grunt;
	const range = visual.range ?? ENEMY_ATTACK_RANGE;

	if (visual.style === 'cone') {
		const direction = getEnemyWindupDirection(enemy, targetEntity);
		const group = createConeHitboxGroup(
			direction,
			range,
			visual.coneAngle ?? ATTACK_CONE_ANGLE,
			{ color: visual.color ?? 0xff3333, emissive: visual.emissive ?? 0xff1111 },
		);
		group.position.set(enemy.x, GROUND_OVERLAY_Y, enemy.z);
		return group;
	}

	const mesh = createEnemyRadialTelegraph(range);
	const tx = targetEntity ? targetEntity.x : enemy.x;
	const tz = targetEntity ? targetEntity.z : enemy.z;
	mesh.position.set(tx, GROUND_OVERLAY_Y, tz);
	return mesh;
}

function updateEnemyAttackTelegraph(enemy, telegraph, targetEntity) {
	const visual = ENEMY_ATTACK_VISUAL[enemy.type] || ENEMY_ATTACK_VISUAL.grunt;
	if (visual.style === 'cone') {
		telegraph.position.set(enemy.x, GROUND_OVERLAY_Y, enemy.z);
	} else if (targetEntity) {
		telegraph.position.set(targetEntity.x, GROUND_OVERLAY_Y, targetEntity.z);
	}
}

function resolveEnemyWindupTarget(enemy, gameState) {
	if (!enemy?.windupTargetId) return null;
	if (enemy.windupTargetType === 'minion') {
		return gameState?.minions?.find((minion) => minion.id === enemy.windupTargetId) || null;
	}
	return gameState?.players?.[enemy.windupTargetId] || null;
}

function updateEnemyHitboxPulse(delta) {
	if (Object.keys(enemyHitboxMeshes).length === 0) return;
	enemyHitboxPhase += delta * 4.2;
	const pulse = 0.5 + 0.5 * Math.sin(enemyHitboxPhase);

	for (const mesh of Object.values(enemyHitboxMeshes)) {
		mesh.traverse((child) => {
			if (!child.material || child.userData.hitboxKind == null) return;
			if (child.userData.hitboxKind === 'fill') {
				child.material.opacity = 0.1 + pulse * 0.2;
			} else if (child.userData.hitboxKind === 'edge') {
				child.material.opacity = 0.3 + pulse * 0.4;
			} else if (child.userData.hitboxKind === 'wire') {
				child.material.opacity = 0.18 + pulse * 0.28;
			}
		});
		const scale = 1 + pulse * 0.06;
		mesh.scale.set(scale, 1, scale);
	}
}

function createConeHitboxGroup(direction, range, coneAngle, style) {
	const dirAngle = Math.atan2(direction.z, direction.x);
	const group = new THREE.Group();
	const color = style.color ?? 0xffdd44;
	const emissive = style.emissive ?? 0xffaa00;
	const fillOpacity = style.fillOpacity ?? HITBOX_FILL_OPACITY;
	const edgeOpacity = style.edgeOpacity ?? HITBOX_EDGE_OPACITY;
	const fillMat = makeHitboxMaterial(color, emissive, fillOpacity);

	// Bake facing into the wedge; CircleGeometry angles match server collectConeHits (atan2 z,x).
	const thetaStart = dirAngle - coneAngle / 2;
	const fill = new THREE.Mesh(
		new THREE.CircleGeometry(range, 32, thetaStart, coneAngle),
		fillMat,
	);
	fill.rotation.x = -Math.PI / 2;
	fill.position.y = 0.004;
	fill.userData.hitboxOpacity = fillOpacity;
	group.add(fill);

	const boundary = new THREE.LineSegments(
		new THREE.EdgesGeometry(fill.geometry),
		new THREE.LineBasicMaterial({
			color,
			transparent: true,
			opacity: edgeOpacity,
			depthWrite: false,
		}),
	);
	boundary.rotation.copy(fill.rotation);
	boundary.position.y = 0.008;
	boundary.userData.hitboxOpacity = edgeOpacity;
	group.add(boundary);

	return group;
}

function createProjectileHitboxGroup(direction, range, hitWidth, style) {
	const dirAngle = Math.atan2(direction.z, direction.x);
	const group = new THREE.Group();
	const color = style.color ?? 0xffdd44;
	const emissive = style.emissive ?? 0xffaa00;
	const fillMat = makeHitboxMaterial(color, emissive, HITBOX_FILL_OPACITY);
	const edgeMat = makeHitboxMaterial(color, emissive, HITBOX_EDGE_OPACITY);

	const corridor = new THREE.Mesh(
		new THREE.PlaneGeometry(hitWidth * 2, range),
		fillMat,
	);
	corridor.rotation.x = -Math.PI / 2;
	corridor.rotation.y = dirAngle - Math.PI / 2;
	corridor.position.set(direction.x * range / 2, 0, direction.z * range / 2);
	corridor.userData.hitboxOpacity = HITBOX_FILL_OPACITY;
	group.add(corridor);

	const perpX = -direction.z * hitWidth;
	const perpZ = direction.x * hitWidth;
	const endX = direction.x * range;
	const endZ = direction.z * range;
	const outlinePoints = [
		new THREE.Vector3(perpX, 0, perpZ),
		new THREE.Vector3(endX + perpX, 0, endZ + perpZ),
		new THREE.Vector3(-perpX, 0, -perpZ),
		new THREE.Vector3(endX - perpX, 0, endZ - perpZ),
	];
	const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePoints);
	const outline = new THREE.LineSegments(
		outlineGeo,
		new THREE.LineBasicMaterial({ color, transparent: true, opacity: HITBOX_EDGE_OPACITY }),
	);
	outline.userData.hitboxOpacity = HITBOX_EDGE_OPACITY;
	group.add(outline);

	const head = new THREE.Mesh(
		new THREE.SphereGeometry(hitWidth, 10, 10),
		edgeMat,
	);
	head.userData.hitboxOpacity = HITBOX_EDGE_OPACITY;
	head.position.set(0, 0.88, 0);
	group.add(head);

	return { group, head };
}

function createBeamTelegraphGroup(direction, range, hitWidth, style) {
	const group = new THREE.Group();
	const color = style.color ?? 0x22d3ee;
	const emissive = style.emissive ?? 0x06b6d4;
	const lineOpacity = style.opacity ?? 0.55;

	const perpX = -direction.z * hitWidth;
	const perpZ = direction.x * hitWidth;
	const endX = direction.x * range;
	const endZ = direction.z * range;
	const outlinePoints = [
		new THREE.Vector3(perpX, 0, perpZ),
		new THREE.Vector3(endX + perpX, 0, endZ + perpZ),
		new THREE.Vector3(-perpX, 0, -perpZ),
		new THREE.Vector3(endX - perpX, 0, endZ - perpZ),
	];
	const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePoints);
	const outline = new THREE.LineSegments(
		outlineGeo,
		new THREE.LineBasicMaterial({ color: emissive, transparent: true, opacity: lineOpacity }),
	);
	group.add(outline);

	const centerLinePoints = [
		new THREE.Vector3(0, 0, 0),
		new THREE.Vector3(endX, 0, endZ),
	];
	const centerLineGeo = new THREE.BufferGeometry().setFromPoints(centerLinePoints);
	const centerLine = new THREE.Line(
		centerLineGeo,
		new THREE.LineBasicMaterial({ color, transparent: true, opacity: lineOpacity * 0.85 }),
	);
	group.add(centerLine);

	return group;
}

function getMinionWindupDirection(minion) {
	if (minion.windupDirX != null && minion.windupDirZ != null) {
		return { x: minion.windupDirX, z: minion.windupDirZ };
	}
	return { x: 1, z: 0 };
}

function createNullCrawlerTelegraph(minion) {
	const direction = getMinionWindupDirection(minion);
	const range = minion.attackRange ?? 14;
	const hitWidth = minion.projectileHitWidth ?? 0.8;
	const group = createBeamTelegraphGroup(direction, range, hitWidth, {
		color: 0x22d3ee,
		emissive: 0x06b6d4,
		opacity: 0.55,
	});
	group.position.set(minion.x, GROUND_OVERLAY_Y, minion.z);
	return group;
}

function updateNullCrawlerTelegraph(minion, telegraph) {
	telegraph.position.set(minion.x, GROUND_OVERLAY_Y, minion.z);
}

function createRustyShivStabGroup(direction, range, style) {
	const dirAngle = Math.atan2(direction.z, direction.x);
	const group = new THREE.Group();
	group.rotation.y = -dirAngle + Math.PI / 2;

	const bladeColor = style.color ?? 0x78716c;
	const rustEmissive = style.emissive ?? 0x991b1b;
	const bladeLen = Math.min(range * 0.55, 1.15);

	const bladeMat = new THREE.MeshStandardMaterial({
		color: bladeColor,
		emissive: rustEmissive,
		emissiveIntensity: 0.55,
		metalness: 0.65,
		roughness: 0.88,
		transparent: true,
		opacity: 0.95,
	});
	const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, bladeLen), bladeMat);
	blade.position.set(0, 0.88, bladeLen * 0.35);
	group.add(blade);

	const stabWidth = 0.32;
	const corridor = new THREE.Mesh(
		new THREE.PlaneGeometry(stabWidth * 2, range),
		makeHitboxMaterial(rustEmissive, rustEmissive, HITBOX_FILL_OPACITY * 0.55),
	);
	corridor.rotation.x = -Math.PI / 2;
	corridor.position.set(0, 0, range * 0.5);
	corridor.userData.hitboxOpacity = HITBOX_FILL_OPACITY * 0.55;
	group.add(corridor);

	return { group, blade, corridor, bladeLen };
}

/**
 * Spawn a weapon visual aligned with attack direction and hit geometry.
 * @param {object} origin - { x, z }
 * @param {object} direction - { x, z } unit vector
 * @param {object} [style]
 */
export function spawnAttackEffect(origin, direction, style = {}) {
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (!targetScene) return;

	const range = style.range ?? ATTACK_RANGE;
	const coneAngle = style.coneAngle ?? ATTACK_CONE_ANGLE;
	const effect = style.effect ?? 'cone';
	const color = style.color ?? 0xffdd44;
	const emissive = style.emissive ?? 0xffaa00;
	const coneStyle = {
		color,
		emissive,
		fillOpacity: style.fillOpacity,
		edgeOpacity: style.edgeOpacity,
	};

	if (effect === 'throw_rock') {
		const geometry = new THREE.DodecahedronGeometry(0.24, 0);
		const rockColor = style.color ?? 0x78716c;
		const material = new THREE.MeshStandardMaterial({
			color: rockColor,
			emissive: style.emissive ?? 0x44403c,
			emissiveIntensity: 0.35,
			roughness: 0.95,
			metalness: 0.05,
		});
		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.set(origin.x, 1.0, origin.z);
		targetScene.add(mesh);

		activeEffects.push({
			mesh,
			origin: { x: origin.x, z: origin.z },
			direction: { x: direction.x, z: direction.z },
			range,
			createdAt: performance.now(),
			duration: ATTACK_EFFECT_DURATION,
		});
		return;
	}

	if (effect === 'rusty_shiv') {
		const { group, blade, corridor, bladeLen } = createRustyShivStabGroup(direction, range, { color, emissive });
		group.position.set(origin.x, GROUND_OVERLAY_Y, origin.z);
		targetScene.add(group);

		activeEffects.push({
			mesh: group,
			bladeMesh: blade,
			stabCorridor: corridor,
			bladeLen,
			range,
			isRustyShiv: true,
			createdAt: performance.now(),
			duration: RUSTY_SHIV_EFFECT_DURATION,
		});
		return;
	}

	if (effect === 'projectile') {
		const geometry = new THREE.SphereGeometry(0.3, 8, 8);
		const material = new THREE.MeshStandardMaterial({
			color,
			emissive,
			emissiveIntensity: 0.8,
			transparent: true,
			opacity: 1.0,
		});
		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.set(origin.x, 1.0, origin.z);
		targetScene.add(mesh);

		activeEffects.push({
			mesh,
			origin: { x: origin.x, z: origin.z },
			direction: { x: direction.x, z: direction.z },
			range,
			createdAt: performance.now(),
			duration: ATTACK_EFFECT_DURATION,
		});
		return;
	}

	if (effect === 'fireball') {
		// Fiery sphere projectile — same travel/cleanup shape as `projectile`
		// but with warm fire colors and a stronger glow so it reads as flame.
		const geometry = new THREE.SphereGeometry(0.35, 12, 12);
		const material = new THREE.MeshStandardMaterial({
			color: style.color ?? 0xff7a18,
			emissive: style.emissive ?? 0xff3b00,
			emissiveIntensity: 1.6,
			roughness: 0.5,
			metalness: 0.0,
			transparent: true,
			opacity: 1.0,
		});
		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.set(origin.x, 1.0, origin.z);
		targetScene.add(mesh);

		activeEffects.push({
			mesh,
			origin: { x: origin.x, z: origin.z },
			direction: { x: direction.x, z: direction.z },
			range,
			createdAt: performance.now(),
			duration: ATTACK_EFFECT_DURATION,
		});
		return;
	}

	if (effect === 'ice_ball') {
		// Icy sphere projectile — same travel/cleanup shape as `fireball` but
		// with cool cyan/blue colors and a slower `projectileTravelMs` duration.
		const geometry = new THREE.SphereGeometry(0.35, 12, 12);
		const material = new THREE.MeshStandardMaterial({
			color: style.color ?? 0x67e8f9,
			emissive: style.emissive ?? 0x38bdf8,
			emissiveIntensity: 1.2,
			roughness: 0.35,
			metalness: 0.1,
			transparent: true,
			opacity: 1.0,
		});
		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.set(origin.x, 1.0, origin.z);
		targetScene.add(mesh);

		activeEffects.push({
			mesh,
			origin: { x: origin.x, z: origin.z },
			direction: { x: direction.x, z: direction.z },
			range,
			createdAt: performance.now(),
			duration: style.projectileTravelMs ?? 1200,
		});
		return;
	}

	if (effect === 'returning_projectile' || effect === 'triple_returning_projectile') {
		const hitWidth = style.projectileHitWidth ?? PROJECTILE_HIT_WIDTH;
		const { group, head } = createProjectileHitboxGroup(direction, range, hitWidth, { color, emissive });
		group.position.set(origin.x, GROUND_OVERLAY_Y, origin.z);
		targetScene.add(group);

		activeEffects.push({
			mesh: group,
			headMesh: head,
			origin: { x: origin.x, z: origin.z },
			direction: { x: direction.x, z: direction.z },
			range,
			hitWidth,
			returning: true,
			returnPasses: style.returnPasses
				?? (effect === 'triple_returning_projectile' ? 3 : 1),
			createdAt: performance.now(),
			duration: ATTACK_EFFECT_DURATION,
		});
		return;
	}

	// Forward cone wedge on the ground — exact server collectConeHits footprint
	const group = createConeHitboxGroup(direction, range, coneAngle, coneStyle);
	group.position.set(origin.x, GROUND_OVERLAY_Y, origin.z);
	targetScene.add(group);

	activeEffects.push({
		mesh: group,
		origin: { x: origin.x, z: origin.z },
		direction: { x: direction.x, z: direction.z },
		range,
		coneAngle,
		isWeaponCone: true,
		createdAt: performance.now(),
		duration: style.duration ?? ATTACK_EFFECT_DURATION,
	});
}

/**
 * Spawn an expanding ring AoE effect on the ground.
 * @param {object} origin - { x, z }
 * @param {number} radius
 * @param {number} [colorHex] - optional accent color (0xRRGGBB)
 */
export function spawnSummonEffect(origin, radius, styleOrColor = {}) {
	const style = typeof styleOrColor === 'number'
		? { color: styleOrColor, emissive: styleOrColor }
		: styleOrColor;
	const color = style.color ?? 0xf59e0b;
	const emissive = style.emissive ?? color;
	const geometry = new THREE.RingGeometry(0.1, 0.5, 32);
	const material = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: 1.0,
		transparent: true,
		opacity: 1.0,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.position.set(origin.x, 0.1, origin.z);
	mesh.rotation.x = -Math.PI / 2;
	mesh.scale.setScalar(0.001);
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (targetScene) targetScene.add(mesh);

	activeEffects.push({
		mesh,
		origin: { x: origin.x, z: origin.z },
		radius,
		createdAt: performance.now(),
		duration: SUMMON_EFFECT_DURATION,
	});
}

/**
 * Golden heal burst for Divine Grace (heal + magic stone restore).
 * @param {object} origin - { x, z }
 * @param {number} radius
 */
export function spawnDivineGraceEffect(origin, radius) {
	const geometry = new THREE.RingGeometry(0.1, 0.5, 32);
	const material = new THREE.MeshStandardMaterial({
		color: 0xfde68a,
		emissive: 0x86efac,
		emissiveIntensity: 1.2,
		transparent: true,
		opacity: 1.0,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.position.set(origin.x, 0.1, origin.z);
	mesh.rotation.x = -Math.PI / 2;
	mesh.scale.setScalar(0.001);
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (targetScene) targetScene.add(mesh);

	activeEffects.push({
		mesh,
		origin: { x: origin.x, z: origin.z },
		radius,
		createdAt: performance.now(),
		duration: SUMMON_EFFECT_DURATION,
	});
}

const PURIFYING_HEAL_COLOR = 0x6ee7b7;
const PURIFYING_HEAL_EMISSIVE = 0x34d399;
const CLEANSE_BURST_COLOR = 0xffffff;
const CLEANSE_BURST_EMISSIVE = 0x5eead4;
const CLEANSE_BURST_SPARK_COUNT = 10;
const CLEANSE_BURST_SPARK_SPREAD = 1.2;
const CLEANSE_BURST_SPARK_DURATION = 450;

/**
 * Mint-green expanding heal ring for Purifying Pulse (distinct from Divine Grace gold).
 * @param {object} origin - { x, z }
 * @param {number} radius
 */
export function spawnPurifyingPulseHealRing(origin, radius) {
	const geometry = new THREE.RingGeometry(0.1, 0.5, 32);
	const material = new THREE.MeshStandardMaterial({
		color: PURIFYING_HEAL_COLOR,
		emissive: PURIFYING_HEAL_EMISSIVE,
		emissiveIntensity: 1.2,
		transparent: true,
		opacity: 1.0,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.position.set(origin.x, 0.1, origin.z);
	mesh.rotation.x = -Math.PI / 2;
	mesh.scale.setScalar(0.001);
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (targetScene) targetScene.add(mesh);

	activeEffects.push({
		mesh,
		origin: { x: origin.x, z: origin.z },
		radius,
		createdAt: performance.now(),
		duration: SUMMON_EFFECT_DURATION,
	});
}

/**
 * Brief white/teal upward sparkle burst for the cleanse half of Purifying Pulse.
 * @param {object} origin - { x, z }
 */
export function spawnCleanseBurstEffect(origin) {
	if (!origin) return;
	spawnHitSpark(
		{ x: origin.x, y: 0.35, z: origin.z },
		{
			color: CLEANSE_BURST_COLOR,
			emissive: CLEANSE_BURST_EMISSIVE,
			count: CLEANSE_BURST_SPARK_COUNT,
			spread: CLEANSE_BURST_SPARK_SPREAD,
			duration: CLEANSE_BURST_SPARK_DURATION,
		},
	);
}

/**
 * Purifying Pulse: mint heal ring plus a white/teal cleanse sparkle burst.
 * @param {object} origin - { x, z }
 * @param {number} radius
 */
export function spawnPurifyingPulseEffect(origin, radius) {
	spawnPurifyingPulseHealRing(origin, radius);
	spawnCleanseBurstEffect(origin);
}

export function spawnFireTrailEffect(origin, direction, style = {}) {
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (!targetScene) return;

	const range = style.range ?? ATTACK_RANGE;
	const coneAngle = style.coneAngle ?? ATTACK_CONE_ANGLE;
	const dotTicks = style.dotTicks ?? 4;
	const dotIntervalMs = style.dotIntervalMs ?? 500;
	const color = style.color ?? 0xf97316;
	const emissive = style.emissive ?? 0xdc2626;

	const group = createConeHitboxGroup(direction, range, coneAngle, { color, emissive });
	group.position.set(origin.x, GROUND_OVERLAY_Y, origin.z);
	targetScene.add(group);

	activeEffects.push({
		mesh: group,
		origin: { x: origin.x, z: origin.z },
		direction: { x: direction.x, z: direction.z },
		range,
		coneAngle,
		isFireTrail: true,
		createdAt: performance.now(),
		duration: dotTicks * dotIntervalMs,
	});
}

/**
 * Spawn a full radial fire burst on the ground (Inferno Pillar).
 * @param {object} origin - { x, z }
 * @param {number} radius
 */
export function spawnInfernoPillarEffect(origin, radius) {
	const geometry = new THREE.RingGeometry(0.1, 0.5, 48);
	const material = new THREE.MeshStandardMaterial({
		color: 0xef4444,
		emissive: 0xdc2626,
		emissiveIntensity: 1.2,
		transparent: true,
		opacity: 1.0,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.position.set(origin.x, 0.15, origin.z);
	mesh.rotation.x = -Math.PI / 2;
	mesh.scale.setScalar(0.001);
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (targetScene) targetScene.add(mesh);

	activeEffects.push({
		mesh,
		origin: { x: origin.x, z: origin.z },
		radius,
		createdAt: performance.now(),
		duration: SUMMON_EFFECT_DURATION,
		infernoBurst: true,
	});
}

/**
 * Spawn the on-death radial blast of a `volatile`-variant enemy: an expanding
 * ground ring in a hot volatile orange, distinct from the friendly amber summon
 * and red inferno bursts. Reuses the radius-based lifecycle in
 * updateAttackEffects (expand → fade → dispose), so it leaves no persistent mesh.
 * @param {object} origin - { x, z }
 * @param {number} radius
 */
export function spawnVolatileExplosionEffect(origin, radius) {
	const geometry = new THREE.RingGeometry(0.1, 0.5, 48);
	const material = new THREE.MeshStandardMaterial({
		color: 0xfb7185,
		emissive: 0xea580c,
		emissiveIntensity: 1.3,
		transparent: true,
		opacity: 1.0,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.position.set(origin.x, 0.15, origin.z);
	mesh.rotation.x = -Math.PI / 2;
	mesh.scale.setScalar(0.001);
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (targetScene) targetScene.add(mesh);

	activeEffects.push({
		mesh,
		origin: { x: origin.x, z: origin.z },
		radius,
		createdAt: performance.now(),
		duration: SUMMON_EFFECT_DURATION,
		volatileBurst: true,
	});
}

/**
 * Spawn an icosahedron spark at an enemy position (minion attack feedback).
 * @param {object} position - { x, y, z }
 * @param {object} [style]
 */
export function spawnHitSpark(position, style = {}) {
	if (!areParticlesEnabled()) return;
	// Use test-scene override if available (set via window.__setScene in tests)
	const targetScene = window.___test_scene || scene;
	if (!targetScene) return;

	const color = style.color ?? 0xffee44;
	const emissive = style.emissive ?? 0xffaa00;
	const count = style.count ?? 1;
	const spread = style.spread ?? 0;

	for (let i = 0; i < count; i += 1) {
		const geometry = new THREE.IcosahedronGeometry
			? new THREE.IcosahedronGeometry(0.12, 0)
			: new THREE.SphereGeometry(0.12, 6, 6);
		const material = new THREE.MeshStandardMaterial({
			color,
			emissive,
			emissiveIntensity: 1.4,
			transparent: true,
			opacity: 1.0,
		});
		const mesh = new THREE.Mesh(geometry, material);
		const ox = position.x + (Math.random() - 0.5) * spread;
		const oy = (position.y || 1.0) + (Math.random() - 0.5) * spread * 0.4;
		const oz = position.z + (Math.random() - 0.5) * spread;
		mesh.position.set(ox, oy, oz);
		targetScene.add(mesh);

		activeEffects.push({
			mesh,
			_scene: targetScene,
			origin: { x: ox, y: oy, z: oz },
			direction: null,
			isHitSpark: true,
			createdAt: performance.now(),
			duration: style.duration ?? HIT_SPARK_DURATION,
		});
	}
}

const LIGHTNING_ARC_Y = 1.2;

/**
 * Build a jagged polyline between two floor points for a brief lightning arc.
 * @param {object} from - { x, z }
 * @param {object} to - { x, z }
 * @param {object} [style]
 * @returns {{ line: THREE.Line, points: THREE.Vector3[] }}
 */
function createLightningArcLine(from, to, style = {}) {
	const y = style.y ?? LIGHTNING_ARC_Y;
	const color = style.emissive ?? style.color ?? 0x0ea5e9;
	const dx = to.x - from.x;
	const dz = to.z - from.z;
	const len = Math.hypot(dx, dz) || 1;
	const segments = Math.max(3, Math.floor(len * 2));
	const perpX = -dz / len;
	const perpZ = dx / len;
	const points = [];

	for (let i = 0; i <= segments; i++) {
		const t = i / segments;
		const jitter = (i === 0 || i === segments) ? 0 : (Math.random() - 0.5) * 0.4;
		points.push(new THREE.Vector3(
			from.x + dx * t + perpX * jitter,
			y + (Math.random() - 0.5) * 0.15,
			from.z + dz * t + perpZ * jitter,
		));
	}

	const geometry = new THREE.BufferGeometry().setFromPoints(points);
	const material = new THREE.LineBasicMaterial({
		color,
		transparent: true,
		opacity: 1.0,
		depthWrite: false,
	});
	return { line: new THREE.Line(geometry, material), points };
}

/**
 * Spawn a short-lived cyan lightning arc between two floor points.
 * @param {object} from - { x, z }
 * @param {object} to - { x, z }
 * @param {object} [style] - optional color/emissive/y/duration overrides
 */
export function spawnLightningArc(from, to, style = {}) {
	const { line } = createLightningArcLine(from, to, style);
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (targetScene) targetScene.add(line);

	activeEffects.push({
		mesh: line,
		_scene: targetScene,
		isLightningArc: true,
		createdAt: performance.now(),
		duration: style.duration ?? ATTACK_EFFECT_DURATION,
	});
}

/**
 * Spawn a cyan lightning bolt projectile (Thunderbird ranged/chain feedback).
 * @param {object} origin - { x, z }
 * @param {object} direction - { x, z }
 */
export function spawnChainLightningEffect(origin, direction) {
	const geometry = new THREE.SphereGeometry(0.25, 8, 8);
	const material = new THREE.MeshStandardMaterial({
		color: 0x38bdf8,
		emissive: 0x0ea5e9,
		emissiveIntensity: 1.0,
		transparent: true,
		opacity: 1.0,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.position.set(origin.x, 1.2, origin.z);
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (targetScene) targetScene.add(mesh);

	const dir = direction || { x: 1, z: 0 };
	const len = Math.hypot(dir.x, dir.z) || 1;
	activeEffects.push({
		mesh,
		origin: { x: origin.x, z: origin.z },
		direction: { x: dir.x / len, z: dir.z / len },
		createdAt: performance.now(),
		duration: ATTACK_EFFECT_DURATION,
		isChainLightning: true,
	});
}

/**
 * Per-frame update for attack effects: move projectiles, expand/fade summon rings,
 * scale/fade sparks, dispose expired.
 */
export function updateAttackEffects() {
	const now = performance.now();
	for (let i = activeEffects.length - 1; i >= 0; i--) {
		const fx = activeEffects[i];
		const elapsed = now - fx.createdAt;

		// ── Summon AoE effect (has a radius field) ──
		if (fx.radius !== undefined) {
			const expandT = Math.min(elapsed / SUMMON_EXPAND_MS, 1.0);
			const scale = fx.radius * expandT * 2;
			fx.mesh.scale.setScalar(Math.max(0.001, scale));

			if (elapsed > SUMMON_EXPAND_MS) {
				const fadeRatio = 1.0 - (elapsed - SUMMON_EXPAND_MS) / (fx.duration - SUMMON_EXPAND_MS);
				fx.mesh.material.opacity = Math.max(0.01, fadeRatio);
			}

			if (elapsed >= fx.duration) {
				scene.remove(fx.mesh);
				fx.mesh.geometry.dispose();
				fx.mesh.material.dispose();
				activeEffects.splice(i, 1);
			}
			continue;
		}

		// ── Lightning arc (chain segments) ──
		if (fx.isLightningArc) {
			const lifeRatio = 1.0 - (elapsed / fx.duration);
			fx.mesh.material.opacity = Math.max(0.01, lifeRatio);

			if (elapsed >= fx.duration) {
				(fx._scene || scene).remove(fx.mesh);
				fx.mesh.geometry.dispose();
				fx.mesh.material.dispose();
				activeEffects.splice(i, 1);
			}
			continue;
		}

		// ── Hit spark effect ──
		if (fx.isHitSpark) {
			const sparkT = Math.min(elapsed / HIT_SPARK_DURATION, 1.0);
			const scalePhase = sparkT < 0.2 ? sparkT / 0.2 : 1.0 - (sparkT - 0.2) / 0.8;
			fx.mesh.scale.setScalar(Math.max(0.01, 1.0 + scalePhase * 2.0));
			fx.mesh.position.y = fx.origin.y + sparkT * 0.5;
			fx.mesh.material.opacity = Math.max(0.01, 1.0 - sparkT);

			if (elapsed >= fx.duration) {
				(fx._scene || scene).remove(fx.mesh);
				fx.mesh.geometry.dispose();
				fx.mesh.material.dispose();
				activeEffects.splice(i, 1);
			}
			continue;
		}

		// ── Ground fire trail (Magma Greatsword lingering cone) ──
		if (fx.isFireTrail) {
			const lifeRatio = 1.0 - (elapsed / fx.duration);
			fadeHitboxOpacity(fx.mesh, lifeRatio);

			if (elapsed >= fx.duration) {
				disposeEffectObject(fx.mesh, scene);
				activeEffects.splice(i, 1);
			}
			continue;
		}

		// ── Rusty Shiv close-range thrust ──
		if (fx.isRustyShiv) {
			const stabMs = fx.duration * 0.35;
			const holdMs = fx.duration * 0.15;
			const fadeMs = Math.max(1, fx.duration - stabMs - holdMs);
			let thrustT = 0;
			let opacity = 1;

			if (elapsed < stabMs) {
				thrustT = elapsed / stabMs;
			} else if (elapsed < stabMs + holdMs) {
				thrustT = 1;
			} else {
				thrustT = 1;
				opacity = 1 - (elapsed - stabMs - holdMs) / fadeMs;
			}

			const reach = fx.range * thrustT;
			if (fx.bladeMesh) {
				fx.bladeMesh.position.z = 0.12 + reach * 0.78;
				fx.bladeMesh.scale.z = 0.85 + thrustT * 0.2;
				fx.bladeMesh.material.opacity = Math.max(0.01, opacity);
			}
			if (fx.stabCorridor) {
				fadeHitboxOpacity(fx.stabCorridor, Math.max(0.01, opacity));
			}

			if (elapsed >= fx.duration) {
				disposeEffectObject(fx.mesh, scene);
				activeEffects.splice(i, 1);
			}
			continue;
		}

		// ── Weapon cone wedge (matches server forward cone hitbox) ──
		if (fx.isWeaponCone) {
			const lifeRatio = 1.0 - (elapsed / fx.duration);
			fadeHitboxOpacity(fx.mesh, lifeRatio);

			if (elapsed >= fx.duration) {
				disposeEffectObject(fx.mesh, scene);
				activeEffects.splice(i, 1);
			}
			continue;
		}

		// ── Returning projectile corridor + traveling head ──
		if (fx.returning) {
			const totalPasses = 1 + (fx.returnPasses || 1);
			const passDuration = fx.duration / totalPasses;
			const passIndex = Math.min(Math.floor(elapsed / passDuration), totalPasses - 1);
			const passElapsed = elapsed - passIndex * passDuration;
			const passT = Math.min(passElapsed / passDuration, 1.0);
			const outbound = passIndex === 0;
			const travel = outbound ? fx.range * passT : fx.range * (1 - passT);

			if (fx.headMesh) {
				fx.headMesh.position.set(
					fx.direction.x * travel,
					0.88,
					fx.direction.z * travel,
				);
			}

			const lifeRatio = 1.0 - (elapsed / fx.duration);
			fadeHitboxOpacity(fx.mesh, lifeRatio);

			if (elapsed >= fx.duration) {
				disposeEffectObject(fx.mesh, scene);
				activeEffects.splice(i, 1);
			}
			continue;
		}

		// ── Legacy weapon projectile effect ──
		const travelRange = fx.range ?? ATTACK_RANGE;
		const t = Math.min(elapsed / fx.duration, 1.0);
		const travel = travelRange * t;
		fx.mesh.position.x = fx.origin.x + fx.direction.x * travel;
		fx.mesh.position.z = fx.origin.z + fx.direction.z * travel;

		const lifeRatio = 1.0 - (elapsed / fx.duration);
		const weaponScale = Math.max(0.01, lifeRatio);
		fx.mesh.scale.setScalar(weaponScale);
		fx.mesh.material.opacity = Math.max(0.01, lifeRatio);

		if (elapsed >= fx.duration) {
			scene.remove(fx.mesh);
			fx.mesh.geometry.dispose();
			fx.mesh.material.dispose();
			activeEffects.splice(i, 1);
		}
	}
}

// ── Mesh disposal helpers ──

/**
 * Remove and optionally dispose a single mesh from a mesh map.
 * @param {Object} map
 * @param {string} id
 * @param {THREE.Scene} targetScene
 * @param {boolean} [skipDispose]
 */
export function disposeOne(map, id, targetScene, skipDispose) {
	const mesh = map[id];
	if (!mesh) return;
	if (targetScene) targetScene.remove(mesh);
	if (!skipDispose) {
		if (mesh.traverse) {
			mesh.traverse((child) => {
				if (child.geometry) child.geometry.dispose();
				if (child.material) child.material.dispose();
			});
		} else {
			if (mesh.geometry) mesh.geometry.dispose();
			if (mesh.material) mesh.material.dispose();
		}
	}
	delete map[id];
}

/**
 * Iterate a mesh map, remove each mesh from the scene, optionally dispose, and clear.
 * @param {Object} map
 * @param {THREE.Scene} targetScene
 * @param {boolean} [skipDispose]
 */
export function disposeMeshMap(map, targetScene, skipDispose) {
	for (const id of Object.keys(map)) {
		disposeOne(map, id, targetScene, skipDispose);
	}
}

/**
 * Find and dispose meshes in a map whose ids are no longer present in currentIds.
 * @param {Object} map
 * @param {Set<string>} currentIds
 * @param {THREE.Scene} targetScene
 */
export function disposeStaleMeshes(map, currentIds, targetScene) {
	for (const id of Object.keys(map)) {
		if (!currentIds.has(id)) {
			disposeOne(map, id, targetScene);
		}
	}
}

// ── Loot mesh sync & animation ──

/**
 * Play a "collected" animation on a loot mesh: scale-up + fade, then remove.
 * @param {string} lootId
 * @param {number} value - gold amount
 */
export function markLootCollected(lootId, value, kind = 'currency') {
	const mesh = lootMeshes[lootId];
	if (!mesh || !scene) return;

	const px = mesh.position.x;
	const pz = mesh.position.z;
	const isMagicStone = kind === 'magic_stone';

	delete lootMeshes[lootId];
	lootPickupAttempts.delete(lootId);
	collectingLoot[lootId] = { mesh, value, kind, createdAt: performance.now() };

	if (isMagicStone) playSound('loot');

	if (mesh.traverse) {
		mesh.traverse((child) => {
			if (child.material) child.material.transparent = true;
		});
	} else if (mesh.material) {
		mesh.material.transparent = true;
	}

	spawnDamageNumber(
		px,
		1.0,
		pz,
		value,
		isMagicStone ? LOOT_FLOAT_COLOR_MAGIC_STONE : LOOT_FLOAT_COLOR_MONEY,
		true,
		isMagicStone ? ' MS' : '',
	);
}

/**
 * Update collecting-loot animations: scale up, fade out, then dispose.
 */
export function updateCollectingLoot() {
	const now = performance.now();
	for (const id of Object.keys(collectingLoot)) {
		const entry = collectingLoot[id];
		const elapsed = now - entry.createdAt;
		const t = Math.min(elapsed / LOOT_COLLECT_DURATION, 1.0);

		const scale = t < 0.3 ? 1.0 + (t / 0.3) * 1.0 : 2.0 - (t - 0.3) / 0.7 * 1.9;
		entry.mesh.scale.setScalar(Math.max(0.01, scale));

		if (t > 0.5) {
			const fade = Math.max(0.01, 1.0 - (t - 0.5) / 0.5);
			if (entry.mesh.traverse) {
				entry.mesh.traverse((child) => {
					if (child.material) child.material.opacity = fade;
				});
			} else if (entry.mesh.material) {
				entry.mesh.material.opacity = fade;
			}
		}

		const liftY = getLootBaseY(entry.mesh);
		entry.mesh.position.y = liftY + t * 1.5;

		if (elapsed >= LOOT_COLLECT_DURATION) {
			scene.remove(entry.mesh);
			disposeLootMeshMaterials(entry.mesh);
			delete collectingLoot[id];
		}
	}
}

/**
 * Sync the shared telepipe portal mesh with gameState.telepipe.
 */
export function syncTelepipeMesh() {
	const scene = getScene();
	if (!scene) return;

	const telepipe = gameStateRef && gameStateRef.telepipe;
	if (!telepipe) {
		if (telepipeMesh) {
			scene.remove(telepipeMesh);
			telepipeMesh.geometry.dispose();
			telepipeMesh.material.dispose();
			telepipeMesh = null;
		}
		return;
	}

	if (!telepipeMesh) {
		const geo = new THREE.CylinderGeometry(0.9, 1.2, 6, 16, 1, true);
		const mat = new THREE.MeshStandardMaterial({
			color: 0x67e8f9,
			emissive: 0x22d3ee,
			emissiveIntensity: 0.85,
			transparent: true,
			opacity: 0.55,
			side: THREE.DoubleSide,
		});
		telepipeMesh = new THREE.Mesh(geo, mat);
		scene.add(telepipeMesh);

		const ringGeo = new THREE.TorusGeometry(1.3, 0.08, 8, 24);
		const ringMat = new THREE.MeshStandardMaterial({
			color: 0xa5f3fc,
			emissive: 0x06b6d4,
			emissiveIntensity: 1,
		});
		const ring = new THREE.Mesh(ringGeo, ringMat);
		ring.rotation.x = Math.PI / 2;
		ring.position.y = 0.05;
		telepipeMesh.add(ring);
	}

	telepipeMesh.position.set(telepipe.x, 3, telepipe.z);
}

/**
 * Sync loot meshes with current gameState.loot.
 */
export function syncLootMeshes() {
	if (!gameStateRef || !gameStateRef.loot) return;

	const currentLootIds = new Set(gameStateRef.loot.map((l) => l.id));

	for (const item of gameStateRef.loot) {
		previousLootValues[item.id] = { value: item.value || 1, kind: item.kind || 'currency' };
	}

	// Add / update new loot
	for (const item of gameStateRef.loot) {
		if (!lootMeshes[item.id]) {
			const mesh = createLootMesh(item);
			scene.add(mesh);
			lootMeshes[item.id] = mesh;
		} else {
			lootMeshes[item.id].position.x = item.x;
			lootMeshes[item.id].position.z = item.z;
		}
	}

	// Remove stale loot — play collection animation
	for (const id of Object.keys(lootMeshes)) {
		if (!currentLootIds.has(id)) {
			const lootMeta = previousLootValues[id] || { value: 1, kind: 'currency' };
			delete previousLootValues[id];
			markLootCollected(id, lootMeta.value, lootMeta.kind);
		}
	}
}

// ── Ice-ball projectile sync (glacial thrower) ──

// Height of an ice ball's centre above the floor. The server simulates the ball
// on the (x, z) plane only; lift it to roughly the thrower's chest so it reads as
// a lobbed projectile rather than rolling along the ground.
const ICE_BALL_HEIGHT = 1.0;

/**
 * Build a giant icy sphere mesh for a traveling ice ball. Geometry + material are
 * owned per-mesh (like enemy meshes) so disposeStaleMeshes / disposeMeshMap fully
 * free them when the projectile leaves the state array.
 * @param {object} ball - server ice-ball record (uses `radius`)
 * @returns {THREE.Mesh}
 */
function createIceBallMesh(ball) {
	const radius = (ball && ball.radius) || 0.9;
	const geometry = new THREE.SphereGeometry(radius, 16, 16);
	const material = new THREE.MeshStandardMaterial({
		color: 0x9fe0ff,
		emissive: 0x38bdf8,
		emissiveIntensity: 0.55,
		roughness: 0.15,
		metalness: 0.1,
	});
	return new THREE.Mesh(geometry, material);
}

/**
 * Sync ice-ball projectile meshes with gameState.iceBalls: create a mesh for each
 * new projectile id, move existing meshes to follow their server (x, z), and dispose
 * meshes whose projectile has left the state array. Mirrors the enemy/minion/loot
 * keyed-mesh-map pattern so projectiles never leak.
 */
export function syncIceBallMeshes() {
	const gs = gameStateRef;
	if (!gs || !scene) return;

	const balls = Array.isArray(gs.iceBalls) ? gs.iceBalls : [];
	const currentIds = new Set(balls.map((b) => b.id));

	for (const ball of balls) {
		let mesh = iceBallMeshes[ball.id];
		if (!mesh) {
			mesh = createIceBallMesh(ball);
			scene.add(mesh);
			iceBallMeshes[ball.id] = mesh;
		}
		mesh.position.set(ball.x, ICE_BALL_HEIGHT, ball.z);
	}

	// Remove projectiles that have left the broadcast state (hit, expired, run ended).
	disposeStaleMeshes(iceBallMeshes, currentIds, scene);
}

/**
 * Bob and rotate loot meshes each frame.
 */
export function animateLootMeshes() {
	const t = performance.now();
	for (const mesh of Object.values(lootMeshes)) {
		const baseY = getLootBaseY(mesh);
		const bob = Math.sin(t / 280) * 0.18;
		if (mesh.userData?.isMagicStone) {
			mesh.position.y = bob * 0.5;
			mesh.rotation.y += 0.045;
			const gem = mesh.userData.gemMesh;
			if (gem) {
				const pulse = 1 + Math.sin(t / 180) * 0.14;
				gem.scale.setScalar(pulse);
				gem.position.y = baseY + bob;
				if (gem.material?.emissiveIntensity != null) {
					gem.material.emissiveIntensity = 1.0 + Math.sin(t / 140) * 0.35;
				}
			}
			continue;
		}

		mesh.position.y = baseY + bob;
		mesh.rotation.y += mesh.userData.isCrystal ? 0.03 : 0.02;
	}
}

/**
 * Dispose all loot meshes (shared geometry — dispose cloned materials only).
 */
export function disposeAllLootMeshes() {
	for (const id of Object.keys(lootMeshes)) {
		const mesh = lootMeshes[id];
		if (scene) scene.remove(mesh);
		disposeLootMeshMaterials(mesh);
		delete lootMeshes[id];
	}
	lootPickupAttempts.clear();
}

// ── Animate loop ──

/**
 * The per-frame game loop: delta clamping, player movement input, mesh sync
 * (players, enemies, minions, loot), camera follow, effect updates, render.
 *
 * Reads gameState from the shared reference set by setGameStateRef().
 */
export function animate(timestamp) {
	requestAnimationFrame(animate);

	const delta = clampDelta(clock.getDelta());
	updateMyPlayer(delta);

	pollInput();

	// Recompute the hub booth zone each frame so the prompt tracks the local
	// player's predicted position (not just throttled server stateUpdates).
	updateBoothInRange();

	const gs = gameStateRef;
	const myId = myIdRef;

	// ── Loot proximity check — closest drop in range; any player can grab it ──
	if (gs && gs.loot && gs.loot.length > 0) {
		const localPlayer = gs.players[myId];
		if (localPlayer && !localPlayer.dead) {
			const now = performance.now();
			const closest = findClosestLootInRange(gs.loot, myX, myZ, LOOT_PICKUP_RADIUS);
			if (closest) tryEmitLootPickup(closest, now);
		}
	}

	if (gs) {
		for (const [id, pData] of Object.entries(gs.players)) {
			// Build the cosmetic-driven avatar, or rebuild it when the player's
			// broadcast cosmetic changes (signature differs from the rendered one).
			const sig = cosmeticSignature(pData.cosmetic);
			if (!playersMeshes[id] || playersMeshes[id].userData.cosmeticKey !== sig) {
				if (playersMeshes[id]) {
					disposeAvatar(playersMeshes[id]);
					scene.remove(playersMeshes[id]);
				}
				const avatar = createPlayerAvatar(pData.cosmetic, id === myId, pData.equippedKeyItemId);
				scene.add(avatar);
				playersMeshes[id] = avatar;
			}

			// (Re)apply proportion morphs + body/accent tint from the broadcast
			// cosmetic every update (local + remote) so changes take effect without
			// a reload; safe no-op on the procedural fallback. Runs before either
			// recolor path below reads userData.baseColor.
			applyLoadedModelCosmetic(playersMeshes[id], pData.cosmetic);

			// (Re)seat the equipped key-item prop when it changes between snapshots
			// (local + remote), so an equip swap takes effect without a reload.
			updateKeyItemProp(playersMeshes[id], pData.equippedKeyItemId);

			// Slow status ring (local + remote) — driven by the broadcast slowedUntil.
			// For the local player, anchor the ring to the predicted myX/myZ (the
			// slower predicted avatar position) so it does not lag behind the avatar
			// while slowed; remote players use their broadcast x/z directly.
			if (id === myId) {
				applySlowIndicator(playerSlowMarkers, id, {
					slowedUntil: pData.slowedUntil,
					x: myX,
					z: myZ,
				});
			} else {
				applySlowIndicator(playerSlowMarkers, id, pData);
			}

			// Burning flame (local + remote) — driven by the broadcast burningUntil.
			// Local player anchors to the predicted myX/myZ like the slow ring so
			// the flame tracks the avatar; remote players use broadcast x/z.
			if (id === myId) {
				applyBurnIndicator(playerBurnMarkers, id, {
					burningUntil: pData.burningUntil,
					x: myX,
					z: myZ,
				});
			} else {
				applyBurnIndicator(playerBurnMarkers, id, pData);
			}

			const windupX = id === myId ? myX : pData.x;
			const windupZ = id === myId ? myZ : pData.z;
			applyPlayerCardWindupIndicator(id, pData, windupX, windupZ);

			if (id === myId) continue;

			const body = playersMeshes[id].userData.bodyMesh;
			playersMeshes[id].position.set(pData.x, pData.y || 0.5, pData.z);
			if (Number.isFinite(pData.rotation)) {
				playersMeshes[id].rotation.y = pData.rotation - Math.PI / 2;
			}

			if (pData.dead) {
				body.material.color.setHex(DEAD_AVATAR_COLOR);
			} else {
				body.material.color.setHex(playersMeshes[id].userData.baseColor);
			}

			// Detect remote player HP drop — flash red
			if (previousPlayerHp[id] !== undefined && pData.hp < previousPlayerHp[id]) {
				flashMesh(playersMeshes[id], 0xff0000, 200);
			}
			previousPlayerHp[id] = pData.hp;

			// ── Nameplate for remote players (after avatar is positioned) ──
			const remoteUsername = pData.username;
			if (remoteUsername) {
				if (!playerNameplates[id] || playerNameplates[id].userData.username !== remoteUsername) {
					if (playerNameplates[id]) disposeNameplate(id);
					const np = createNameplate(remoteUsername);
					scene.add(np);
					playerNameplates[id] = np;
				}
				const avatar = playersMeshes[id];
				playerNameplates[id].position.set(
					avatar.position.x,
					avatar.position.y + NAMEPLATE_OFFSET_Y,
					avatar.position.z,
				);
			}
		}

		if (myId != null && playersMeshes[myId]) {
			const layout = gs && gs.layout;
			const floorY = layout ? resolveFloorY(sampleFloorY(layout, myX, myZ)) : DEFAULT_FLOOR_Y;
			playersMeshes[myId].position.set(myX, floorY, myZ);
			playersMeshes[myId].rotation.y = playerRotation - Math.PI / 2;

			const me = gs.players[myId];
			const isDead = me && me.dead;

			// Respawn detection: dead → alive resets local position to spawn
			if (wasDead && !isDead) {
				myX = spawnPosition.x;
				myZ = spawnPosition.z;
				simX = spawnPosition.x;
				simZ = spawnPosition.z;
				prevSimX = spawnPosition.x;
				prevSimZ = spawnPosition.z;
				moveAccumulator = 0;
				resetSimVelocity();
				playerRotation = 0;
				lastEmittedRotation = null;
				clearAllLockOnState();
				lockOnToTarget = null;
				lockOnReleaseLookAt = null;
			}
			if (isDead) {
				clearAllLockOnState();
				lockOnToTarget = null;
				lockOnReleaseLookAt = null;
			}
			wasDead = isDead;

			const selfBody = playersMeshes[myId].userData.bodyMesh;
			if (isDead) {
				selfBody.material.color.setHex(DEAD_AVATAR_COLOR);
			} else {
				selfBody.material.color.setHex(playersMeshes[myId].userData.baseColor);
			}

			// Invulnerability shimmer: semi-transparent when i-frames are active (not when dead)
			if (!isDead && me && me.isInvulnerable) {
				selfBody.material.transparent = true;
				selfBody.material.opacity = 0.5;
				selfBody.material.depthWrite = false;
			} else {
				selfBody.material.transparent = false;
				selfBody.material.opacity = 1;
				selfBody.material.depthWrite = true;
			}

			// Shield VFX: ensure visible while blocking (re-trigger if expired)
			if (!isDead && me && me.isBlocking && !shieldVFX[myId]) {
				triggerShieldVFX(myId);
			}
			// Update shield position to follow player; clean up when blocking ends
			if (shieldVFX[myId]) {
				if (!isDead && me && me.isBlocking) {
					const s = shieldVFX[myId];
					const yaw = playersMeshes[myId].rotation.y + Math.PI / 2;
					s.mesh.position.set(
						playersMeshes[myId].position.x + Math.cos(yaw) * SHIELD_OFFSET_DIST,
						playersMeshes[myId].position.y + 0.5,
						playersMeshes[myId].position.z + Math.sin(yaw) * SHIELD_OFFSET_DIST,
					);
					s.mesh.rotation.y = playersMeshes[myId].rotation.y;
				} else if (shieldVFX[myId]) {
					// Blocking ended — let existing VFX finish its fade, don't re-trigger
				}
			}

			// Detect local player HP drop — flash red + spawn damage number
			if (me && previousPlayerHp[myId] !== undefined && me.hp < previousPlayerHp[myId]) {
				const damageAmount = previousPlayerHp[myId] - me.hp;
				flashMesh(playersMeshes[myId], 0xff0000, 200);
				spawnDamageNumber(myX, 1.5, myZ, damageAmount, '#ff0000');
			}
			if (me) {
				previousPlayerHp[myId] = me.hp;
			}

			// ── Nameplate for self-player ──
			const selfUsername = getAccountProfile().username;
			if (selfUsername) {
				if (!playerNameplates[myId] || playerNameplates[myId].userData.username !== selfUsername) {
					if (playerNameplates[myId]) disposeNameplate(myId);
					const np = createNameplate(selfUsername);
					scene.add(np);
					playerNameplates[myId] = np;
				}
				const selfAvatar = playersMeshes[myId];
				playerNameplates[myId].position.set(
					selfAvatar.position.x,
					selfAvatar.position.y + NAMEPLATE_OFFSET_Y,
					selfAvatar.position.z,
				);
			}
		}

		// ── Clean up nameplates for players who left ──
		for (const id of Object.keys(playerNameplates)) {
			if (!gs.players[id]) {
				disposeNameplate(id);
			}
		}

		// ── Clean up slow markers for players who left ──
		for (const id of Object.keys(playerSlowMarkers)) {
			if (!gs.players[id]) {
				disposeOne(playerSlowMarkers, id, scene);
			}
		}

		// ── Clean up burn markers for players who left ──
		for (const id of Object.keys(playerBurnMarkers)) {
			if (!gs.players[id]) {
				disposeOne(playerBurnMarkers, id, scene);
			}
		}

		// ── Clean up card wind-up markers for players who left ──
		for (const id of Object.keys(playerCardWindupMarkers)) {
			if (!gs.players[id]) {
				disposeOne(playerCardWindupMarkers, id, scene);
				playerCardWindupFlashing.delete(id);
			}
		}

		// ── Smoke Bomb VFX: show a puff at each player's active smoke zone ──
		// The zone is fixed at the cast point (smokeBombX/Z), so the puff is
		// re-triggered while the zone is active if its VFX has faded out. Skip
		// the tail end so a near-expired zone doesn't spawn a fresh 2s puff.
		const smokeNow = Date.now();
		for (const [id, pData] of Object.entries(gs.players)) {
			const remaining = (pData.smokeBombUntil || 0) - smokeNow;
			if (remaining > 300 && !smokeVFX[id]) {
				triggerSmokeVFX({ x: pData.smokeBombX, y: 0, z: pData.smokeBombZ }, id);
			}
		}

		// ── phase_step ally highlight: recompute nearest in-range ally each frame ──
		syncPhaseStepAllyHighlight(gs, myId);

		// ── Enemy mesh sync ──
		const currentEnemyIds = new Set(gs.enemies.map((e) => e.id));

		for (const enemy of gs.enemies) {
			if (!enemiesMeshes[enemy.id]) {
				const mesh = createEnemyMesh(enemy.type);
				scene.add(mesh);
				enemiesMeshes[enemy.id] = mesh;

				enemyHitboxMeshes[enemy.id] = createEnemyHitboxGroup(ENTITY_RADIUS);
				scene.add(enemyHitboxMeshes[enemy.id]);
			}
			const halfHeight = enemyMeshHalfHeight(enemy.type);
			enemiesMeshes[enemy.id].position.set(enemy.x, halfHeight, enemy.z);

			ensureEnemyHealthBar(enemy.id, enemy);
			const healthBar = enemyHealthBars[enemy.id];
			if (healthBar) {
				healthBar.position.set(enemy.x, halfHeight + 0.5, enemy.z);
				updateHealthBarMesh(enemy.id, enemy);
			}
			ensureEnemyShieldBar(enemy.id, enemy);
			const shieldBar = enemyShieldBars[enemy.id];
			if (shieldBar) {
				shieldBar.position.set(enemy.x, halfHeight + 0.65, enemy.z);
				updateEnemyShieldBarMesh(enemy.id, enemy);
			}
			if (enemyHitboxMeshes[enemy.id]) {
				enemyHitboxMeshes[enemy.id].position.set(enemy.x, GROUND_OVERLAY_Y, enemy.z);
			}
			syncLockOnRing(enemy.id, enemy.x, enemy.z);

			// Detect HP drop (minion tick damage) — skip if caused by a recent cardUsed hit
			if (previousEnemyHp[enemy.id] !== undefined && enemy.hp < previousEnemyHp[enemy.id]) {
				const cardHit = lastCardHitTime[enemy.id];
				const withinGrace = cardHit !== undefined && (performance.now() - cardHit) < CARD_HIT_GRACE_MS;
				if (!withinGrace) {
					let nearestMinion = null;
					let nearestMinionDist = Infinity;
					for (const m of (gs.minions || [])) {
						const mdist = Math.hypot(m.x - enemy.x, m.z - enemy.z);
						if (mdist < nearestMinionDist && minionsMeshes[m.id]) {
							nearestMinionDist = mdist;
							nearestMinion = m;
						}
					}
					const fromThunderbird = nearestMinion && nearestMinion.type === 'thunderbird';
					const fromAncientWyrm = nearestMinion && nearestMinion.type === 'ancient_wyrm';
					const fromNullCrawler = nearestMinion && nearestMinion.type === 'null_crawler';
					const fromBulkheadMauler = nearestMinion && nearestMinion.type === 'bulkhead_mauler';
					flashMesh(
						enemiesMeshes[enemy.id],
						fromThunderbird ? 0x38bdf8
							: (fromAncientWyrm ? 0xfb923c
								: (fromNullCrawler ? 0x22d3ee
									: (fromBulkheadMauler ? 0xf59e0b : 0xff4444))),
						150
					);
					if (fromThunderbird) {
						const sparkDir = nearestMinion
							? {
								x: enemy.x - nearestMinion.x,
								z: enemy.z - nearestMinion.z,
							}
							: { x: 1, z: 0 };
						spawnChainLightningEffect(
							{ x: nearestMinion.x, z: nearestMinion.z },
							sparkDir
						);
					} else if (fromAncientWyrm) {
						const breathDir = nearestMinion
							? {
								x: enemy.x - nearestMinion.x,
								z: enemy.z - nearestMinion.z,
							}
							: { x: 1, z: 0 };
						spawnAttackEffect(
							{ x: nearestMinion.x, z: nearestMinion.z },
							breathDir,
							{
								range: 8,
								coneAngle: Math.PI / 2,
								color: 0xef4444,
								emissive: 0x9333ea,
							}
						);
					} else if (fromNullCrawler) {
						const beamDir = nearestMinion
							? {
								x: enemy.x - nearestMinion.x,
								z: enemy.z - nearestMinion.z,
							}
							: { x: 1, z: 0 };
						spawnAttackEffect(
							{ x: nearestMinion.x, z: nearestMinion.z },
							beamDir,
							{
								effect: 'returning_projectile',
								returnPasses: 0,
								range: nearestMinion.attackRange ?? 14,
								projectileHitWidth: nearestMinion.projectileHitWidth ?? 0.8,
								color: 0x22d3ee,
								emissive: 0x06b6d4,
							}
						);
					} else if (fromBulkheadMauler) {
						const sweepDir = nearestMinion
							? {
								x: enemy.x - nearestMinion.x,
								z: enemy.z - nearestMinion.z,
							}
							: { x: 1, z: 0 };
						spawnAttackEffect(
							{ x: nearestMinion.x, z: nearestMinion.z },
							sweepDir,
							{
								range: 4,
								coneAngle: (Math.PI * 2) / 3,
								color: 0x78716c,
								emissive: 0xf59e0b,
							}
						);
					} else {
						spawnHitSpark({ x: enemy.x, y: halfHeight, z: enemy.z });
					}

					if (nearestMinion && minionsMeshes[nearestMinion.id]) {
						flashMesh(
							minionsMeshes[nearestMinion.id],
							fromThunderbird ? 0x7dd3fc
								: (fromAncientWyrm ? 0xfb923c
									: (fromNullCrawler ? 0x67e8f9
										: (fromBulkheadMauler ? 0xfbbf24 : 0x88ff88))),
							200
						);
					}
				}
			}
			previousEnemyHp[enemy.id] = enemy.hp;

			// ── Telegraph visuals (windup state) ──
			if (enemy.attackState === 'windup') {
				applyWindupFlash(enemy.id, true);

				const windupTarget = resolveEnemyWindupTarget(enemy, gs);
				if (!telegraphMeshes[enemy.id]) {
					const telegraph = createEnemyAttackTelegraph(enemy, windupTarget);
					scene.add(telegraph);
					telegraphMeshes[enemy.id] = telegraph;
				} else {
					updateEnemyAttackTelegraph(enemy, telegraphMeshes[enemy.id], windupTarget);
				}
			} else {
				disposeOne(telegraphMeshes, enemy.id, scene);
				applyWindupFlash(enemy.id, false);
			}

			// ── Reveal highlight (Flare Beacon) ──
			applyRevealHighlight(enemy.id, enemy);

			// ── Variant body tint (warded cyan; others use type default) ──
			applyEnemyVariantTint(enemy.id, enemy);

			// ── Variant marker (elite enemy badge) ──
			applyVariantMarker(enemy.id, enemy);

			// ── Variant mesh tint (e.g. leeching) ──
			applyVariantEmissiveTint(enemy.id, enemy);

			// ── Frenzied enrage telegraph ring ──
			applyFrenziedTelegraphRing(enemy.id, enemy);

			// ── Slow status ring (driven by the broadcast slowedUntil) ──
			applySlowIndicator(enemySlowMarkers, enemy.id, enemy);

			// ── Burning flame (driven by the broadcast burningUntil) ──
			applyBurnIndicator(enemyBurnMarkers, enemy.id, enemy);
		}

		// Clean up removed enemies
		disposeStaleMeshes(enemiesMeshes, currentEnemyIds, scene);
		disposeStaleMeshes(enemyHealthBars, currentEnemyIds, scene);
		disposeStaleMeshes(enemyShieldBars, currentEnemyIds, scene);
		disposeStaleMeshes(enemyHitboxMeshes, currentEnemyIds, scene);
		disposeStaleMeshes(enemyLockOnRings, currentEnemyIds, scene);
		disposeStaleMeshes(variantMarkerMeshes, currentEnemyIds, scene);
		disposeStaleMeshes(frenziedTelegraphMeshes, currentEnemyIds, scene);
		disposeStaleMeshes(enemySlowMarkers, currentEnemyIds, scene);
		disposeStaleMeshes(enemyBurnMarkers, currentEnemyIds, scene);
		for (const id of Object.keys(previousEnemyHp)) {
			if (!currentEnemyIds.has(id)) {
				delete previousEnemyHp[id];
			}
		}
		for (const id of Object.keys(lastCardHitTime)) {
			if (!currentEnemyIds.has(id)) {
				delete lastCardHitTime[id];
			}
		}
		disposeStaleMeshes(telegraphMeshes, currentEnemyIds, scene);
		for (const id of [...windupFlashing]) {
			if (!currentEnemyIds.has(id)) {
				windupFlashing.delete(id);
			}
		}

		// ── Minion mesh sync ──
		const currentMinionIds = new Set(gs.minions ? gs.minions.map((m) => m.id) : []);

		for (const minion of (gs.minions || [])) {
			if (!minionsMeshes[minion.id]) {
				const mesh = createMinionMesh(minion.type);
				scene.add(mesh);
				minionsMeshes[minion.id] = mesh;
			}
			minionsMeshes[minion.id].position.set(minion.x, 0.5, minion.z);

			if (minion.type === 'null_crawler' && minion.attackState === 'windup') {
				if (!minionTelegraphMeshes[minion.id]) {
					const telegraph = createNullCrawlerTelegraph(minion);
					scene.add(telegraph);
					minionTelegraphMeshes[minion.id] = telegraph;
				} else {
					updateNullCrawlerTelegraph(minion, minionTelegraphMeshes[minion.id]);
				}
				const mesh = minionsMeshes[minion.id];
				if (mesh?.material?.emissive) {
					mesh.material.emissive.setHex(0x67e8f9);
					mesh.material.emissiveIntensity = 1.0;
				}
			} else {
				disposeOne(minionTelegraphMeshes, minion.id, scene);
				if (minion.type === 'null_crawler') {
					const mesh = minionsMeshes[minion.id];
					if (mesh?.material?.emissive) {
						mesh.material.emissive.setHex(0x06b6d4);
						mesh.material.emissiveIntensity = 0.55;
					}
				}
			}

			if (previousMinionHp[minion.id] !== undefined && minion.hp < previousMinionHp[minion.id]) {
				const damageAmount = previousMinionHp[minion.id] - minion.hp;
				flashMesh(minionsMeshes[minion.id], 0xff4444, 150);
				spawnDamageNumber(minion.x, 1.2, minion.z, damageAmount, '#ff4444');
			}
			previousMinionHp[minion.id] = minion.hp;
		}

		disposeStaleMeshes(minionsMeshes, currentMinionIds, scene);
		disposeStaleMeshes(minionTelegraphMeshes, currentMinionIds, scene);
		for (const id of Object.keys(previousMinionHp)) {
			if (!currentMinionIds.has(id)) {
				delete previousMinionHp[id];
			}
		}

		// ── Loot mesh sync ──
		syncLootMeshes();
		// ── Ice-ball projectile sync ──
		syncIceBallMeshes();
		syncTelepipeMesh();
	}

	// Animate loot coins (outside gameState guard)
	animateLootMeshes();

	if (myId != null && playersMeshes[myId]) {
		const playerPos = playersMeshes[myId].position;
		updateCameraOrbit(playerPos.x, playerPos.y, playerPos.z, delta);
	}

	if (gs?.layout?.profile === 'spire-ascent') {
		const atmosY = myId != null && playersMeshes[myId]
			? playersMeshes[myId].position.y
			: camera.position.y;
		updateSpireAscentAtmosphere(atmosY, gs.layout);
	} else if (currentLayoutProfile === 'spire-ascent') {
		resetAtmosphere();
	} else if (gs?.layout?.profile === 'fire-cavern') {
		const atmosY = myId != null && playersMeshes[myId]
			? playersMeshes[myId].position.y
			: camera.position.y;
		updateFireCavernAtmosphere(atmosY, gs.layout);
	} else if (currentLayoutProfile === 'fire-cavern') {
		resetAtmosphere();
	}

	// Animate attack visual effects
	updateAttackEffects();

	// Pulse enemy hitbox overlays
	updateEnemyHitboxPulse(delta);

	// Update floating damage numbers
	updateDamageNumbers();

	// Update collecting-loot animations
	updateCollectingLoot();

	renderer.render(scene, camera);
}

// ── Expose ENEMY_GEOMETRY for external access ──
export { ENEMY_GEOMETRY };
