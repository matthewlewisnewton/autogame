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
	buildPassageGateMesh,
	getPassageGateWorldPosition,
	buildWallColliders,
	computeWalkableAABBs,
	computeDungeonBounds,
	tryPlayerMove,
	getProfileMaterials,
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
	MINION_SUMMON_IN_MS,
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
	pollGamepadSnapshot,
	invalidateGamepadSnapshot,
	resetGamepadState,
} from './gamepad.js';
import { pollInput, getMovementDirection, resetInputState } from './input.js';
import { clientMoveSpeedScale, tickMovementPrediction } from './movementPrediction.js';
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
	cameraYawBehindFacing,
	resolveLockOnLookAtY,
} from './lockOn.js';
import { syncLockOnInfoPanel } from './lock-on-info-panel.js';
import { getEntityWorldY } from './entityWorldY.js';
import { getLockOnRepeatAction, getGamepadConfig, areParticlesEnabled, getAccountProfile } from './settings.js';
import { MODEL_REGISTRY, loadModel, modelPathFor, disposeMeshTreeSafe } from './models.js';
import { getCardDef } from './cards.js';
import { getAccentHex } from './cardRenderers.js';
import eventsCatalog from '../shared/events.json' with { type: 'json' };
import { syncMeshMap, disposeStaleMeshes, disposeOne, disposeMeshMap } from './renderer/meshSync.js';
import {
	getScene,
	setScene,
	playersMeshes,
	playerShadows,
	playerNameplates,
	enemyNameplates,
	enemiesMeshes,
	enemyHealthBars,
	enemyShieldBars,
	enemyHitboxMeshes,
	enemyShadows,
	telegraphMeshes,
	minionTelegraphMeshes,
	enemyLockOnRings,
	variantMarkerMeshes,
	frenziedTelegraphMeshes,
	enemySlowMarkers,
	playerSlowMarkers,
	enemyBurnMarkers,
	playerBurnMarkers,
	minionsMeshes,
	minionShadows,
	escortHealthBars,
	spikeTrapMeshes,
	lootMeshes,
	iceBallMeshes,
} from './renderer/rendererState.js';
import {
	syncEnemyMeshes,
	enemyMeshHalfHeight,
	getEnemyRenderScaleForTest,
	createEnemyMesh,
	healthBarColor,
	createHealthBarMesh,
	updateHealthBarMesh,
	createEnemyShieldBarMesh,
	updateEnemyShieldBarMesh,
	applyWindupFlash,
	applyRevealHighlight,
	WARDED_TINT,
	FRENZIED_TINT,
	VARIANT_MARKER_COLORS,
	variantMarkerColor,
	applyEnemyVariantTint,
	applyVariantMarker,
	applyVariantEmissiveTint,
	applyFrenziedTelegraphRing,
	parseNamedRareTintHex,
	applyNamedRareTint,
	applyNamedRareScale,
	applyEnemyNameplate,
	resolveEnemyEmissive,
} from './renderer/enemySync.js';

// Re-export the relocated helpers + scene accessor so existing importers that
// reference them from './renderer.js' keep working unchanged.
export { syncMeshMap, disposeStaleMeshes, disposeOne, disposeMeshMap, getScene };
// Enemy-domain helpers now live in ./renderer/enemySync.js; re-exported so main.js
// and tests that import them from './renderer.js' keep working unchanged.
export {
	syncEnemyMeshes,
	enemyMeshHalfHeight,
	getEnemyRenderScaleForTest,
	createEnemyMesh,
	healthBarColor,
	createHealthBarMesh,
	updateHealthBarMesh,
	createEnemyShieldBarMesh,
	updateEnemyShieldBarMesh,
	applyWindupFlash,
	applyRevealHighlight,
	WARDED_TINT,
	FRENZIED_TINT,
	VARIANT_MARKER_COLORS,
	variantMarkerColor,
	applyEnemyVariantTint,
	applyVariantMarker,
	applyVariantEmissiveTint,
	applyFrenziedTelegraphRing,
	parseNamedRareTintHex,
	applyNamedRareTint,
	applyNamedRareScale,
	applyEnemyNameplate,
	resolveEnemyEmissive,
};
import {
	syncMinionMeshes,
	syncSpikeTrapMeshes,
	getMinionSpawnTimes,
	createSpikeTrapHazardMesh,
	shouldHaveEscortHealthBar,
	escortHealthBarFillScale,
	ESCORT_HEALTH_BAR_OFFSET_Y,
} from './renderer/minionSync.js';

// Minion-domain + spike-trap-hazard sync now lives in ./renderer/minionSync.js;
// re-exported so main.js and tests that import them from './renderer.js' keep
// working unchanged.
export {
	syncMinionMeshes,
	syncSpikeTrapMeshes,
	getMinionSpawnTimes,
	createSpikeTrapHazardMesh,
	shouldHaveEscortHealthBar,
	escortHealthBarFillScale,
	ESCORT_HEALTH_BAR_OFFSET_Y,
};
import {
	syncLootMeshes,
	animateLootMeshes,
	markLootCollected,
	updateCollectingLoot,
	syncIceBallMeshes,
	syncTelepipeMesh,
	animateTelepipePortal,
	disposeLootMeshMaterials,
} from './renderer/lootSync.js';

// Loot-domain + ice-ball + telepipe-portal sync now lives in
// ./renderer/lootSync.js; re-exported so main.js and tests that import them from
// './renderer.js' keep working unchanged.
export {
	syncLootMeshes,
	animateLootMeshes,
	markLootCollected,
	updateCollectingLoot,
	syncIceBallMeshes,
	syncTelepipeMesh,
	animateTelepipePortal,
};
import { syncPlayerMeshes } from './renderer/playerSync.js';
import {
	ATTACK_EFFECT_KINDS,
	runAttackEffectUpdater,
	shouldExpireAttackEffect,
	disposeAttackEffect,
} from './renderer/attackEffectUpdaters.js';

// Player-domain sync now lives in ./renderer/playerSync.js; re-exported so main.js
// and tests that import it from './renderer.js' keep working unchanged.
export { syncPlayerMeshes };

const { clientToServer: CLIENT_TO_SERVER } = eventsCatalog;

// ── Three.js scene references ──
// Shared keyed mesh-map stores + the scene accessor now live in
// ./renderer/rendererState.js so the per-domain sync modules read/mutate the
// same references; they are imported above. Scene-local rendering state that is
// not shared (camera/renderer/clock, nameplate offsets, card-windup markers,
// phase-step targeting, etc.) stays here.
let scene, camera, renderer, clock;
// NAMEPLATE_OFFSET_Y + the card-windup marker/flashing stores are read by
// ./renderer/playerSync.js (call-time only); exported so it shares the live
// references rather than re-declaring them.
export const NAMEPLATE_OFFSET_Y = 1.0; // Units above avatar group Y position
export const playerCardWindupMarkers = {}; // player id → ground ring during card wind-up
export const playerCardWindupFlashing = new Set(); // player ids showing card-windup emissive

// phase_step ally targeting: nearest in-range ally id (or null) recomputed each
// frame, plus the ground ring that highlights it. Read by main.js via
// getPhaseStepTargetId() so the useKeyItem payload can carry targetPlayerId.
const PHASE_STEP_RANGE = 6; // metres — must match server KEY_ITEM_DEFS.phase_step.range
let phaseStepTargetId = null;
let phaseStepAllyRing = null;
export const windupFlashing = new Set(); // enemy ids currently showing windup emissive (read by enemySync.js)
/** @type {Map<string, { until: number, color: number }>} enemy damage-flash slots for emissive resolver */
export const enemyDamageFlash = new Map();
// Minion summon-in scale state (seenMinionIds / minionSpawnTimes /
// minionBaseScales) now lives in ./renderer/minionSync.js.
// Telepipe portal state (telepipeMesh / telepipeParticles / telepipeShimmerPhase)
// now lives in ./renderer/lootSync.js alongside syncTelepipeMesh.
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
let activeLayout = null;
let activePassageLocksKey = '';
let activePassageGateLocksKey = '';
/** @type {Record<number, THREE.Group>} */
const passageGateMeshes = {};

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
let moveStopPending = false;
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

// Loot state (geometry/material palette, LOOT_FLOAT_COLOR_*, collectingLoot,
// previousLootValues) now lives in ./renderer/lootSync.js alongside the loot sync
// + collection animation it drives.

// ── Damage number tracking ──
const damageNumbers = []; // { element, createdAt, position3d, duration }

// ── Card hit tracking ──
export const lastCardHitTime = {}; // enemyId → performance.now() of last card hit (read/pruned by enemySync.js)

/** Record cardUsed hits so minion-damage fallbacks skip duplicate VFX. */
export function markCardHitEnemies(hits) {
	const now = performance.now();
	for (const hit of hits || []) {
		if (hit?.enemyId) lastCardHitTime[hit.enemyId] = now;
	}
}
// previousMinionHp (minion damage-flash state) now lives in ./renderer/minionSync.js.
// previousPlayerHp (player damage-flash state) now lives in ./renderer/playerSync.js.
// lootId → last emit timestamp (ms). Exported so ./renderer/lootSync.js can clear
// an entry when its loot is collected; the pickup-emission side (tryEmitLootPickup
// / findClosestLootInRange) and pruning stay here in renderer.js.
export const lootPickupAttempts = new Map();

// ── Scene init flag ──
let sceneInitialized = false;
let animateActive = false;
/** @type {(() => void) | null} */
let resizeHandler = null;

function onWebGLContextLost(event) {
	event.preventDefault();
	console.warn('[renderer] WebGL context lost — recoverable; awaiting contextrestore');
}

/**
 * Tear down the main WebGL renderer and stop the render loop. Idempotent.
 * Called before re-init and when replacing the renderer on reconnect paths.
 */
export function disposeRenderer() {
	animateActive = false;
	if (resizeHandler) {
		window.removeEventListener('resize', resizeHandler);
		resizeHandler = null;
	}
	if (renderer) {
		const canvas = renderer.domElement;
		canvas?.removeEventListener('webglcontextlost', onWebGLContextLost);
		renderer.dispose();
		if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
		renderer = null;
	}
	sceneInitialized = false;
}

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
	const rim = (layout?.rooms ?? []).find((r) => r.role === 'start' || r.band === 'rim');
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
export const ENEMY_GEOMETRY = {
	grunt:      { type: 'cone', radius: 0.5, height: 1, segments: 8, color: 0xdc2626 },
	skirmisher: { type: 'cone', radius: 0.3, height: 0.6, segments: 8, color: 0xff6600 },
	miniboss:   { type: 'cone', radius: 1.0, height: 2.2, segments: 12, color: 0x8800cc, emissive: 0x6600aa, emissiveIntensity: 0.3 },
	annex_overseer: { type: 'cone', radius: 1.1, height: 2.4, segments: 14, color: 0x0d9488, emissive: 0x14b8a6, emissiveIntensity: 0.3 },
	arena_champion: { type: 'cone', radius: 1.4, height: 3.0, segments: 16, color: 0xffaa00, emissive: 0xcc3300, emissiveIntensity: 0.45 },
	crucible_sovereign: { type: 'cone', radius: 1.3, height: 2.8, segments: 14, color: 0xd97706, emissive: 0xb45309, emissiveIntensity: 0.42 },
	spire_warden: { type: 'cone', radius: 1.1, height: 2.4, segments: 12, color: 0x3388cc, emissive: 0x2266aa, emissiveIntensity: 0.3 },
	cinder_warden: { type: 'cone', radius: 1.2, height: 2.6, segments: 12, color: 0xff5522, emissive: 0xff2200, emissiveIntensity: 0.45 },
	magma_colossus: { type: 'cone', radius: 1.35, height: 2.9, segments: 14, color: 0xff7711, emissive: 0xff5500, emissiveIntensity: 0.52 },
	spawner:    { type: 'octahedron', radius: 0.6, color: 0x00ccaa, emissive: 0x00ccaa, emissiveIntensity: 0.4 },
	field_medic: { type: 'octahedron', radius: 0.4, color: 0x10b981, emissive: 0x2dd4bf, emissiveIntensity: 0.55 },
	glacial_thrower: { type: 'cone', radius: 1.0, height: 2.2, segments: 12, color: 0x7dd3fc, emissive: 0x38bdf8, emissiveIntensity: 0.35 },
	permafrost_warden: { type: 'cone', radius: 1.15, height: 2.5, segments: 14, color: 0x0e7490, emissive: 0x22d3ee, emissiveIntensity: 0.42 },
	glacial_tyrant: { type: 'cone', radius: 1.3, height: 2.8, segments: 14, color: 0x0c4a6e, emissive: 0x38bdf8, emissiveIntensity: 0.45 },
	// Largest stage-boss silhouette in the catalog; ice/fire two-tone — deep
	// ice-blue body with an ember-orange glow for the rift convergence tyrant.
	riftbound_colossus: { type: 'cone', radius: 1.45, height: 3.2, segments: 16, color: 0x164e63, emissive: 0xf97316, emissiveIntensity: 0.5 },
	// Capstone sovereign: the only cylinder silhouette in the catalog — a tall
	// crowned tower (radiusTop flares past the base) in deep violet with a gold glow.
	citadel_sovereign: { type: 'cylinder', radius: 1.1, radiusTop: 1.35, height: 3.4, segments: 16, color: 0x312e81, emissive: 0xfacc15, emissiveIntensity: 0.5 },
	ember_wraith: { type: 'octahedron', radius: 0.35, color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.6 },
	// Flying types — hovering octahedron bodies (cf. ember_wraith); flying/altitude
	// arrive per-instance from the server so flyingRenderOffset lifts the body.
	void_seraph: { type: 'octahedron', radius: 0.4, color: 0x7c3aed, emissive: 0xa855f7, emissiveIntensity: 0.6 },
	rime_drifter: { type: 'octahedron', radius: 0.35, color: 0xbae6fd, emissive: 0x60a5fa, emissiveIntensity: 0.55 },
};

/** Windup telegraph shape per enemy type — mirrors server ENEMY_DEFS attackStyle */
export const ENEMY_ATTACK_VISUAL = {
	grunt:      { style: 'radial' },
	skirmisher: { style: 'cone', coneAngle: Math.PI / 3, color: 0xff6600, emissive: 0xff3300 },
	miniboss:   { style: 'cone', coneAngle: Math.PI / 2, range: 5, color: 0xaa44ff, emissive: 0x8800cc },
	annex_overseer: { style: 'radial', range: 3.5, color: 0x2dd4bf, emissive: 0x0d9488 },
	arena_champion: { style: 'cone', coneAngle: (2 * Math.PI) / 3, range: 6.5, color: 0xffcc44, emissive: 0xcc3300 },
	crucible_sovereign: { style: 'radial', range: 4.5, color: 0xfbbf24, emissive: 0xd97706 },
	spire_warden: { style: 'cone', coneAngle: Math.PI / 2, range: 6, color: 0x55aaff, emissive: 0x3388cc },
	cinder_warden: { style: 'cone', coneAngle: (2 * Math.PI) / 3, range: 5.5, color: 0xff7733, emissive: 0xff2200 },
	magma_colossus: { style: 'radial', range: 5, color: 0xffaa33, emissive: 0xff5500 },
	spawner:    { style: 'radial' },
	field_medic: { style: 'projectile', range: 8, color: 0x2dd4bf, emissive: 0x14b8a6, hitWidth: 0.5 },
	glacial_thrower: { style: 'projectile', range: 7, color: 0x7dd3fc, emissive: 0x38bdf8, hitWidth: 0.9 },
	permafrost_warden: { style: 'radial', range: 4.5, color: 0x67e8f9, emissive: 0x0891b2 },
	glacial_tyrant: { style: 'projectile', range: 9, color: 0x7dd3fc, emissive: 0x0ea5e9, hitWidth: 1.2 },
	// Riftbound Colossus: igniting rift shockwave telegraphed as an ember-orange radial ring (server attackStyle 'radial', range 5.5).
	riftbound_colossus: { style: 'radial', range: 5.5, color: 0xfb923c, emissive: 0xea580c },
	// Citadel Sovereign: capstone shockwave telegraphed as a gold radial ring (server attackStyle 'radial', range 6).
	citadel_sovereign: { style: 'radial', range: 6, color: 0xfde047, emissive: 0xca8a04 },
	ember_wraith: { style: 'cone', coneAngle: Math.PI / 3, color: 0xff4400, emissive: 0xff2200 },
	// Void Seraph: spherical void burst telegraphed as a radial ring (server attackStyle 'radial').
	void_seraph: { style: 'radial', range: 4.5, color: 0xa855f7, emissive: 0x7c3aed },
	// Rime Drifter: height-aware ice ball telegraphed like glacial_thrower's projectile (server attackStyle 'ice_ball').
	rime_drifter: { style: 'projectile', range: 8, color: 0xbae6fd, emissive: 0x60a5fa, hitWidth: 0.9 },
};

/** Minion mesh presets keyed by minion.type */
// Exported so ./renderer/minionSync.js (createMinionMesh) reads the same table;
// also consumed by the registry-model footprint/offset helpers in this file.
export const MINION_VISUAL = {
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
	escort_npc: {
		shape: 'cylinder',
		radius: 0.45,
		height: 1.1,
		color: 0xfbbf24,
		emissive: 0x38bdf8,
		emissiveIntensity: 0.45,
	},
	battery_automaton: {
		shape: 'box',
		width: 0.55,
		height: 0.7,
		depth: 0.45,
		color: 0xfbbf24,
		emissive: 0x38bdf8,
		emissiveIntensity: 0.4,
	},
	aegis_sentinel: {
		shape: 'box',
		width: 1.85,
		height: 2.6,
		depth: 0.35,
		color: 0x4ade80,
		emissive: 0x22c55e,
		emissiveIntensity: 0.45,
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
export function attachRegistryModel(key, host) {
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
			} else if (ENEMY_GEOMETRY[key]) {
				retargetEnemyBodyMesh(host, model);
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

/**
 * Locate the body mesh inside a loaded enemy glTF — preferring `SkinnedMesh`,
 * else the first mesh with a material — so runtime tint/flash land on the
 * visible model surface.
 * @param {THREE.Object3D} model
 * @returns {THREE.Mesh|null}
 */
function findEnemyBodyMesh(model) {
	let skinned = null;
	let anyMesh = null;
	model.traverse((node) => {
		if (!node.isMesh || !node.material) return;
		if (!anyMesh) anyMesh = node;
		if (node.isSkinnedMesh && !skinned) skinned = node;
	});
	return skinned || anyMesh;
}

/**
 * Point an enemy host's `userData.bodyMesh` at the loaded glTF body mesh so
 * tint/flash VFX act on the visible model instead of the hidden procedural
 * primitive. The body material is cloned per instance. `_orig*` bookkeeping is
 * taken from the loaded material when present, otherwise from the procedural
 * snapshot (type palette emissive defaults).
 * @param {THREE.Object3D} host
 * @param {THREE.Object3D} model
 */
function retargetEnemyBodyMesh(host, model) {
	const bodyMesh = findEnemyBodyMesh(model);
	if (!bodyMesh) return;

	const paletteColor = host._origColor;
	const paletteEmissive = host._origEmissive != null ? host._origEmissive : 0x000000;
	const paletteEmissiveIntensity =
		host._origEmissiveIntensity != null ? host._origEmissiveIntensity : 0;

	if (bodyMesh.material) {
		bodyMesh.material = Array.isArray(bodyMesh.material)
			? bodyMesh.material.map((m) => m.clone())
			: bodyMesh.material.clone();
	}

	host.userData.bodyMesh = bodyMesh;

	const mat = Array.isArray(bodyMesh.material) ? bodyMesh.material[0] : bodyMesh.material;
	if (!mat) return;

	if (mat.color && mat.color.getHex) {
		bodyMesh._origColor = mat.color.getHex();
	} else if (paletteColor != null) {
		bodyMesh._origColor = paletteColor;
	}

	const loadedEmissive =
		mat.emissive && mat.emissive.getHex ? mat.emissive.getHex() : 0x000000;
	const loadedIntensity = mat.emissiveIntensity ?? 0;
	const hasLoadedEmissive =
		mat.emissive != null && (loadedEmissive !== 0x000000 || loadedIntensity > 0);

	if (hasLoadedEmissive) {
		bodyMesh._origEmissive = loadedEmissive;
		bodyMesh._origEmissiveIntensity = loadedIntensity;
	} else {
		bodyMesh._origEmissive = paletteEmissive;
		bodyMesh._origEmissiveIntensity = paletteEmissiveIntensity;
		if (mat.emissive && mat.emissive.set) {
			mat.emissive.set(paletteEmissive);
		}
		mat.emissiveIntensity = paletteEmissiveIntensity;
	}

	// Keep host-level bookkeeping in sync for restore paths that still read the host.
	host._origColor = bodyMesh._origColor;
	host._origEmissive = bodyMesh._origEmissive;
	host._origEmissiveIntensity = bodyMesh._origEmissiveIntensity;
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
export function updateKeyItemProp(host, equippedKeyItemId) {
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

// createMinionMesh() now lives in ./renderer/minionSync.js.

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
	const layout = gameStateRef?.layout ?? null;
	const me = myIdRef && gameStateRef?.players?.[myIdRef];
	if (me && Number.isFinite(me.x) && Number.isFinite(me.z)) {
		return {
			x: me.x,
			y: getEntityWorldY(me, layout),
			z: me.z,
		};
	}
	const fallbackEntity = { x: simX, z: simZ, y: me?.y, flying: me?.flying, altitude: me?.altitude };
	return {
		x: simX,
		y: getEntityWorldY(fallbackEntity, layout),
		z: simZ,
	};
}

export function applyLockOnPress() {
	if (currentGamePhase !== 'playing') return;
	const gs = gameStateRef;
	if (!gs?.enemies) return;

	const anchor = lockOnAnchorCoords();
	const layout = gameStateRef?.layout ?? null;
	const result = handleLockOnPress(
		lockOnEnemyPool(),
		anchor.x,
		anchor.y,
		anchor.z,
		getLockOnRepeatAction(),
		playerRotation,
		layout,
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
		const layout = gameStateRef?.layout ?? null;
		camera.lookAt(
			lockedEnemy.x,
			resolveLockOnLookAtY(lockedEnemy, layout),
			lockedEnemy.z,
		);
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
 * Get the shared gameState reference. Used by per-domain sync modules
 * (e.g. ./renderer/lootSync.js) that read the live snapshot at call time.
 * @returns {object|null}
 */
export function getGameStateRef() {
	return gameStateRef;
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

// getScene() moved to ./renderer/rendererState.js (imported + re-exported above).

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
		enemyNameplates,
		telegraphMeshes,
		minionTelegraphMeshes,
		minionsMeshes,
		escortHealthBars,
		spikeTrapMeshes,
		passageGateMeshes,
		lootMeshes,
		iceBallMeshes,
		playerCardWindupMarkers,
		enemyLockOnRings,
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

/** Align local attack facing and orbit camera behind a server rotation (debug QA). */
export function alignAttackFacing(rotation) {
	if (!Number.isFinite(rotation)) return;
	setPlayerRotation(rotation);
	cameraYaw = normalizeAngle(cameraYawBehindFacing(rotation));
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

function passageLocksCacheKey(passageLocks = []) {
	if (!Array.isArray(passageLocks) || passageLocks.length === 0) return '';
	return passageLocks
		.map((lock) => `${lock.passageIndex}:${lock.locked ? 1 : 0}`)
		.join('|');
}

function parsePassageLocksKey(key = '') {
	const lockedByIndex = new Map();
	if (!key) return lockedByIndex;
	for (const part of key.split('|')) {
		const [idx, locked] = part.split(':');
		if (idx === undefined || locked === undefined) continue;
		lockedByIndex.set(Number(idx), locked === '1');
	}
	return lockedByIndex;
}

function collectNewlyUnlockedPassages(prevKey, locks) {
	const prevLockedByIndex = parsePassageLocksKey(prevKey);
	const newlyUnlocked = new Set();
	for (const lock of locks) {
		if (!lock?.locked && prevLockedByIndex.get(lock.passageIndex) === true) {
			newlyUnlocked.add(lock.passageIndex);
		}
	}
	for (const [passageIndex, wasLocked] of prevLockedByIndex) {
		if (!wasLocked) continue;
		if (!locks.some((lock) => lock.passageIndex === passageIndex && lock.locked)) {
			newlyUnlocked.add(passageIndex);
		}
	}
	return newlyUnlocked;
}

const PASSAGE_UNLOCK_EFFECT_DURATION = 650;
const PASSAGE_UNLOCK_RING_COLOR = 0x5eead4;
const PASSAGE_UNLOCK_RING_EMISSIVE = 0x14b8a6;
const PASSAGE_UNLOCK_BURST_COLOR = 0xa7f3d0;
const PASSAGE_UNLOCK_BURST_EMISSIVE = 0x2dd4bf;

function resolvePassageLocks(passageLocks) {
	if (Array.isArray(passageLocks)) return passageLocks;
	return gameStateRef?.run?.passageLocks || [];
}

/**
 * Rebuild client wall colliders when run.passageLocks changes.
 * @param {object[]} [passageLocks]
 */
export function syncPassageLockColliders(passageLocks) {
	if (!activeLayout) return;
	const locks = resolvePassageLocks(passageLocks);
	const nextKey = passageLocksCacheKey(locks);
	if (nextKey === activePassageLocksKey) return;
	activePassageLocksKey = nextKey;
	wallColliders = buildWallColliders(activeLayout, locks);
}

function disposePassageGateMesh(mesh) {
	if (!mesh) return;
	if (scene) scene.remove(mesh);
	mesh.traverse((child) => {
		if (child.geometry) child.geometry.dispose();
		if (child.material) child.material.dispose();
	});
}

function clearPassageGateMeshes() {
	for (const key of Object.keys(passageGateMeshes)) {
		disposePassageGateMesh(passageGateMeshes[key]);
		delete passageGateMeshes[key];
	}
	activePassageGateLocksKey = '';
}

/**
 * Brief cosmetic unlock feedback at a passage gate: emissive flash on the gate
 * mesh plus a small particle burst. Does not block movement or input.
 * @param {number} passageIndex
 * @param {object} [layout]
 * @param {THREE.Group|null} [gateMesh]
 */
export function playPassageUnlockEffect(passageIndex, layout, gateMesh = null) {
	const targetLayout = layout || activeLayout;
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (!targetScene) return;

	let origin = gateMesh
		? { x: gateMesh.position.x, y: gateMesh.position.y, z: gateMesh.position.z }
		: getPassageGateWorldPosition(targetLayout, passageIndex);
	if (!origin) return;

	if (gateMesh) {
		targetScene.remove(gateMesh);
		gateMesh.traverse((child) => {
			if (!child.material) return;
			child.material = child.material.clone();
			if (child.material.emissive?.setHex) {
				child.material.emissive.setHex(PASSAGE_UNLOCK_BURST_EMISSIVE);
			} else if (child.material.emissive?.set) {
				child.material.emissive.set(PASSAGE_UNLOCK_BURST_EMISSIVE);
			} else {
				child.material.emissive = PASSAGE_UNLOCK_BURST_EMISSIVE;
			}
			child.material.emissiveIntensity = 1.8;
			child.material.transparent = true;
		});
		activeEffects.push({
			mesh: gateMesh,
			_scene: targetScene,
			kind: ATTACK_EFFECT_KINDS.passageUnlockGate,
			isPassageUnlockGate: true,
			createdAt: performance.now(),
			duration: PASSAGE_UNLOCK_EFFECT_DURATION,
		});
	}

	const ringGeometry = new THREE.RingGeometry(0.1, 0.45, 32);
	const ringMaterial = new THREE.MeshStandardMaterial({
		color: PASSAGE_UNLOCK_RING_COLOR,
		emissive: PASSAGE_UNLOCK_RING_EMISSIVE,
		emissiveIntensity: 1.4,
		transparent: true,
		opacity: 1.0,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
	ringMesh.position.set(origin.x, FLOOR_Y + 0.12, origin.z);
	ringMesh.rotation.x = -Math.PI / 2;
	ringMesh.scale.setScalar(0.001);
	targetScene.add(ringMesh);
	activeEffects.push({
		mesh: ringMesh,
		_scene: targetScene,
		origin: { x: origin.x, z: origin.z },
		radius: 2.2,
		kind: ATTACK_EFFECT_KINDS.expandFadeRing,
		createdAt: performance.now(),
		duration: PASSAGE_UNLOCK_EFFECT_DURATION,
	});

	spawnParticleBurst(
		{ x: origin.x, y: origin.y * 0.55, z: origin.z },
		{
			color: PASSAGE_UNLOCK_BURST_COLOR,
			emissive: PASSAGE_UNLOCK_BURST_EMISSIVE,
			count: 10,
			spread: 1.6,
			duration: PASSAGE_UNLOCK_EFFECT_DURATION,
		},
	);
}

/**
 * Reconcile visible passage gate meshes when run.passageLocks changes.
 * @param {object[]} [passageLocks]
 * @param {object} [layout]
 */
export function syncPassageLockGates(passageLocks, layout) {
	const targetLayout = layout || activeLayout;
	if (!scene || !targetLayout) return;

	const locks = resolvePassageLocks(passageLocks);
	const nextKey = passageLocksCacheKey(locks);
	if (nextKey === activePassageGateLocksKey) return;

	const newlyUnlocked = collectNewlyUnlockedPassages(activePassageGateLocksKey, locks);
	const lockedIndices = new Set(
		locks.filter((lock) => lock?.locked).map((lock) => lock.passageIndex),
	);

	for (const key of Object.keys(passageGateMeshes)) {
		const passageIndex = Number(key);
		if (!lockedIndices.has(passageIndex)) {
			const mesh = passageGateMeshes[key];
			if (mesh && newlyUnlocked.has(passageIndex)) {
				playPassageUnlockEffect(passageIndex, targetLayout, mesh);
			} else {
				disposePassageGateMesh(mesh);
			}
			delete passageGateMeshes[key];
		}
	}

	const materials = getProfileMaterials(targetLayout.profile);
	for (const passageIndex of lockedIndices) {
		if (passageGateMeshes[passageIndex]) continue;
		const gate = buildPassageGateMesh(targetLayout, passageIndex, materials);
		if (!gate) continue;
		scene.add(gate);
		passageGateMeshes[passageIndex] = gate;
	}

	activePassageGateLocksKey = nextKey;
}

/**
 * Get the active effects array.
 * @returns {object[]}
 */
export function getActiveEffects() {
	return activeEffects;
}

// getMinionSpawnTimes() now lives in ./renderer/minionSync.js (re-exported above).

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

// Loot mesh builders + per-mesh disposal (cloneLootMaterial, createLootMesh,
// getLootBaseY, disposeLootMeshMaterials) now live in ./renderer/lootSync.js.
// disposeLootMeshMaterials is imported back below for disposeAllLootMeshes.

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

/**
 * Enemy ids with an active damage-flash emissive slot (read by tests / harness).
 * @returns {Map<string, { until: number, color: number }>}
 */
export function getEnemyDamageFlash() {
	return enemyDamageFlash;
}

/**
 * Player ids currently showing card-windup emissive (weapon charge telegraph).
 * @returns {Set<string>}
 */
export function getPlayerCardWindupFlashing() {
	return playerCardWindupFlashing;
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
	disposeRenderer();

	// Scene
	scene = new THREE.Scene();
	setScene(scene); // share the live scene with rendererState.js (getScene() consumers)
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

	// Renderer — low-power + no perf caveat so headless Chromium survives startup
	renderer = new THREE.WebGLRenderer({
		antialias: true,
		powerPreference: 'low-power',
		failIfMajorPerformanceCaveat: false,
	});
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);
	renderer.domElement.style.pointerEvents = currentGamePhase === 'playing' ? 'auto' : 'none';
	renderer.domElement.addEventListener('webglcontextlost', onWebGLContextLost, false);

	// Lighting
	const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
	scene.add(ambientLight);
	const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
	directionalLight.position.set(10, 20, 10);
	scene.add(directionalLight);

	// Build dungeon geometry from server layout
	if (layout) {
		activeLayout = layout;
		clearPassageGateMeshes();
		clearDungeon(scene, dungeonMeshes);
		const { meshes, spawnPosition: spawn } = buildDungeon(scene, layout);
		dungeonMeshes.push(...meshes);
		spawnPosition.x = spawn.x;
		spawnPosition.z = spawn.z;
		const passageLocks = resolvePassageLocks();
		activePassageLocksKey = passageLocksCacheKey(passageLocks);
		wallColliders = buildWallColliders(layout, passageLocks);
		syncPassageLockGates(passageLocks, layout);
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
	animateActive = true;
	requestAnimationFrame(animate);

	// Resize handler (single listener per renderer lifetime)
	resizeHandler = () => {
		if (!camera || !renderer) return;
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);
	};
	window.addEventListener('resize', resizeHandler);

	sceneInitialized = true;
}

/**
 * Rebuild dungeon geometry from a new server layout without recreating the scene.
 * Used when the player selects a different quest in the lobby.
 *
 * @param {object} layout - { rooms, passages } from server
 */
export function rebuildDungeonLayout(layout, passageLocks) {
	if (!scene || !layout) return;

	activeLayout = layout;
	clearPassageGateMeshes();
	clearDungeon(scene, dungeonMeshes);
	const { meshes, spawnPosition: spawn } = buildDungeon(scene, layout);
	dungeonMeshes.push(...meshes);
	spawnPosition.x = spawn.x;
	spawnPosition.z = spawn.z;
	const locks = resolvePassageLocks(passageLocks);
	activePassageLocksKey = passageLocksCacheKey(locks);
	wallColliders = buildWallColliders(layout, locks);
	syncPassageLockGates(locks, layout);
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

	const lockAnchor = lockOnAnchorCoords();
	const lockState = updateLockOn(
		lockOnEnemyPool(),
		simX,
		lockAnchor.y,
		simZ,
		delta,
		cameraYaw,
		playerRotation,
		gameStateRef?.layout ?? null,
	);

	refreshLockOnInfoPanel();

	if (lockState.locked) {
		playerRotation = lockState.playerRotation;
		cameraYaw = lockState.cameraYaw;
		lockOnToTarget = lockState.liveToTarget ?? lockState.toTarget;
		lockOnReleaseLookAt = null;
	} else if (isLockOnCameraReleasing()) {
		lockOnToTarget = null;
		const release = updateLockOnCameraRelease(delta, simX, lockAnchor.y, simZ);
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
		if (moveStopPending && socketRef) {
			// Tell the server we stopped; otherwise it keeps applying the last
			// input until INPUT_STALE_MS and the idle reconciler snaps us back.
			moveStopPending = false;
			moveSequence += 1;
			socketRef.emit(CLIENT_TO_SERVER.MOVE, {
				dx: 0,
				dz: 0,
				rotation: lastEmittedRotation ?? playerRotation,
				sequence: moveSequence,
			});
		}
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
			moveStopPending = true;
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
export const DEAD_AVATAR_COLOR = 0x808080;

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
export function cosmeticSignature(cosmetic) {
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
export function applyLoadedModelCosmetic(host, cosmetic) {
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
export function resolveBodyMesh(obj) {
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
	disposeMeshTreeSafe(obj);
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

/**
 * Create a canvas-texture sprite that displays a named-rare enemy label.
 * Callers store the sprite in `enemyNameplates` and call `disposeEnemyNameplate()`
 * on removal.
 *
 * @param {string} displayName
 * @returns {THREE.Sprite}
 */
export function createEnemyNameplate(displayName) {
	const sprite = createNameplate(displayName);
	sprite.userData.namedRareName = displayName;
	return sprite;
}

/**
 * Remove and dispose the nameplate sprite for a named-rare enemy.
 *
 * @param {string} enemyId
 */
export function disposeEnemyNameplate(enemyId) {
	const sprite = enemyNameplates[enemyId];
	if (!sprite) return;

	if (sprite.parent) {
		sprite.parent.remove(sprite);
	}
	if (sprite.material) {
		if (sprite.material.map) sprite.material.map.dispose();
		sprite.material.dispose();
	}
	delete enemyNameplates[enemyId];
}

// ── Flash mesh helper ──

/**
 * Resolve an enemy id from a host mesh reference (for damage-flash routing).
 * @param {THREE.Object3D} mesh
 * @returns {string | null}
 */
function findEnemyIdForMesh(mesh) {
	if (!mesh) return null;
	for (const [id, host] of Object.entries(enemiesMeshes)) {
		if (host === mesh || resolveBodyMesh(host) === mesh) return id;
	}
	return null;
}

/**
 * Flash a mesh by setting its material emissive to a bright color,
 * then restoring the original emissive/intensity after `durationMs`.
 * Enemy meshes route through the per-enemy emissive resolver instead of
 * capturing/restoring emissive directly (avoids racing windup/reveal).
 * @param {THREE.Mesh} mesh
 * @param {number} color - hex color (e.g. 0xffffff)
 * @param {number} durationMs - how long the flash lasts
 * @param {string} [enemyId] - when flashing an enemy, registers damage-flash priority
 */
export function flashMesh(mesh, color, durationMs, enemyId) {
	// Accept either an avatar group (flash its body mesh) or a bare mesh.
	const target = resolveBodyMesh(mesh);
	if (!target || !target.material) return;

	const resolvedEnemyId = enemyId ?? findEnemyIdForMesh(mesh);
	if (resolvedEnemyId != null) {
		const until = performance.now() + durationMs;
		enemyDamageFlash.set(resolvedEnemyId, { until, color });
		resolveEnemyEmissive(resolvedEnemyId, null);
		setTimeout(() => {
			const slot = enemyDamageFlash.get(resolvedEnemyId);
			if (slot && performance.now() >= slot.until) {
				enemyDamageFlash.delete(resolvedEnemyId);
			}
			resolveEnemyEmissive(resolvedEnemyId, null);
		}, durationMs);
		return;
	}

	// Non-enemy meshes: legacy direct flash + restore
	const mat = target.material;
	const origEmissive = mat.emissive ? (mat.emissive.getHex ? mat.emissive.getHex() : 0x000000) : 0x000000;
	const origIntensity = mat.emissiveIntensity || 0;

	if (mat.emissive && mat.emissive.set) {
		mat.emissive.set(color);
	} else {
		mat.emissive = color;
	}
	mat.emissiveIntensity = 1.5;

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
// SHIELD_OFFSET_DIST + the shieldVFX store are read by ./renderer/playerSync.js
// (call-time only); exported so it shares the live references.
export const SHIELD_OFFSET_DIST = 0.7; // distance in front of player
export const shieldVFX = {}; // playerId → { mesh, startTime }

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
const MEDIC_HEAL_COLOR = 0x34d399;
const MEDIC_HEAL_DEFAULT_RADIUS = 6;

/**
 * Ally-heal pulse at the medic position — mint/teal telegraph ring and burst
 * distinct from the bright-green Field Medic Kit pulse and null_crawler cyan.
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
	const origin = { x: position.x, z: position.z };
	spawnTelegraphRing(origin, radius, {
		color: MEDIC_HEAL_COLOR,
		emissive: MEDIC_BEAD_COLOR,
		duration: HEAL_PULSE_DURATION,
	});
	spawnParticleBurst(
		{ x: position.x, y: position.y ?? 0.5, z: position.z },
		{
			color: MEDIC_HEAL_COLOR,
			emissive: MEDIC_BEAD_EMISSIVE,
			count: 12,
			spread: 1.6,
			duration: HEAL_PULSE_DURATION,
		},
	);
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

	const range = Number.isFinite(beadRange) ? beadRange : 8;
	const dirLen = Math.hypot(direction.x, direction.z) || 1;
	const nx = direction.x / dirLen;
	const nz = direction.z / dirLen;

	spawnAttackEffect(
		{ x: origin.x, z: origin.z },
		{ x: direction.x, z: direction.z },
		{
			effect: 'returning_projectile',
			returnPasses: 0,
			range,
			projectileHitWidth: Number.isFinite(hitWidth) ? hitWidth : 0.5,
			color: MEDIC_BEAD_COLOR,
			emissive: MEDIC_BEAD_EMISSIVE,
		},
	);

	spawnProjectileTrail(
		{ x: origin.x, z: origin.z },
		{ x: nx, z: nz },
		{ range, color: MEDIC_BEAD_COLOR, emissive: MEDIC_BEAD_EMISSIVE, y: 0.85 },
	);

	const terminus = { x: origin.x + nx * range, z: origin.z + nz * range };
	spawnImpactDecal(terminus, {
		color: MEDIC_BEAD_COLOR,
		emissive: MEDIC_BEAD_EMISSIVE,
		radius: 0.65,
	});
	spawnParticleBurst(
		{ x: terminus.x, y: 0.5, z: terminus.z },
		{ color: MEDIC_BEAD_COLOR, emissive: MEDIC_BEAD_EMISSIVE, count: 8, spread: 1.0 },
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
// smokeVFX store is read by ./renderer/playerSync.js (call-time only); exported
// so it shares the live reference.
export const smokeVFX = {}; // playerId → { group, geometries, materials, startTime }

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
export function applySlowIndicator(markerMap, id, entity) {
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
export function applyBurnIndicator(markerMap, id, entity) {
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
export const GROUND_OVERLAY_Y = FLOOR_Y + 0.07;

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

export function syncLockOnRing(enemyId, enemyX, ringY, enemyZ) {
	const lockedId = getLockedEnemyId();
	if (lockedId === enemyId) {
		if (!enemyLockOnRings[enemyId]) {
			enemyLockOnRings[enemyId] = createLockOnRing();
			scene.add(enemyLockOnRings[enemyId]);
		}
		enemyLockOnRings[enemyId].position.set(enemyX, ringY, enemyZ);
		enemyLockOnRings[enemyId].visible = true;
	} else if (enemyLockOnRings[enemyId]) {
		enemyLockOnRings[enemyId].visible = false;
	}
}

// ── Airborne render helpers ──
// Floor-aware render offset (world units the flier sits above its grounded
// render base) for a flying entity. The offset is expressed relative to
// `DEFAULT_FLOOR_Y` so that on the default floor it equals the plain altitude
// (render Y unchanged from the prior fixed-plane behavior), while on a
// non-default floor it carries the floor delta so the flier rises/falls with
// the surface beneath it. Prefer the server-authoritative world Y (`entity.y`),
// which already encodes `sampleFloorY(layout, x, z) + altitude`; otherwise fall
// back to combining the bare `entity.altitude` with the sampled floor surface so
// the fallback is floor-aware too. Grounded entities (no `flying` flag) always
// return 0, so grounded placement is byte-for-byte unchanged. Symmetric across
// flying enemies and flying minions.
export function flyingRenderOffset(entity, layout) {
	if (!entity || !entity.flying) return 0;
	if (Number.isFinite(entity.y)) return entity.y - DEFAULT_FLOOR_Y;
	const floorY = layout ? resolveFloorY(sampleFloorY(layout, entity.x, entity.z)) : DEFAULT_FLOOR_Y;
	if (Number.isFinite(entity.altitude)) return (floorY - DEFAULT_FLOOR_Y) + entity.altitude;
	return 0;
}

// Y position for a flier's ground shadow: the sampled floor surface directly
// under the flier plus the same small overlay offset `GROUND_OVERLAY_Y` adds to
// `FLOOR_Y`, so the shadow sits on the actual floor (not a fixed default plane).
export function flyingShadowY(layout, x, z) {
	const floorY = layout ? resolveFloorY(sampleFloorY(layout, x, z)) : DEFAULT_FLOOR_Y;
	return floorY + (GROUND_OVERLAY_Y - FLOOR_Y);
}

// Flat dark disc lying in the XZ plane, used as a ground shadow beneath a flier
// so its floor position stays readable while the body renders at altitude.
function createFlyingShadow() {
	const geo = new THREE.CircleGeometry(0.55, 24);
	const mat = new THREE.MeshBasicMaterial({
		color: 0x000000,
		transparent: true,
		opacity: 0.32,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.rotation.x = -Math.PI / 2;
	return mesh;
}

// Create/update a ground shadow beneath a flying entity, or dispose it if the
// entity is grounded. `shadowMap` is keyed by entity id (separate maps for
// enemies vs minions so each disposes with its own mesh-cleanup path). Shadows
// sit on the sampled floor surface beneath the flier (floor-aware) and only
// exist for fliers.
export function syncFlyingShadow(shadowMap, entity, layout) {
	if (entity.flying) {
		if (!shadowMap[entity.id]) {
			shadowMap[entity.id] = createFlyingShadow();
			scene.add(shadowMap[entity.id]);
		}
		shadowMap[entity.id].position.set(entity.x, flyingShadowY(layout, entity.x, entity.z), entity.z);
	} else if (shadowMap[entity.id]) {
		disposeOne(shadowMap, entity.id, scene);
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

export function makeHitboxMaterial(color, emissive, opacity) {
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

// ── Card wind-up charge telegraph tuning ──
// The telegraph grows from a small/dim state to a large/bright state as the
// wind-up charge ratio climbs 0→1, so heavy wind-up cards visibly "charge a
// big hit". Defaults match the previous static look at full charge.
const WINDUP_DEFAULT_ACCENT = 0x38bdf8; // sky-blue, used when the card has no accent
const WINDUP_RING_MIN_SCALE = 0.55;
const WINDUP_RING_MAX_SCALE = 1.5;
const WINDUP_RING_MIN_EMISSIVE = 0.4;
const WINDUP_RING_MAX_EMISSIVE = 2.0;
const WINDUP_RING_MIN_OPACITY = 0.3;
const WINDUP_RING_MAX_OPACITY = 0.7;
const WINDUP_FLASH_MIN_EMISSIVE = 0.35;
const WINDUP_FLASH_MAX_EMISSIVE = 1.6;

function lerp(a, b, t) {
	return a + (b - a) * t;
}

/**
 * Normalized 0→1 charge ratio for a card wind-up, derived from the broadcast
 * `cardWindupUntil` timestamp and the card's wind-up duration (`windUpMs`). The
 * ratio is 0 at the start of the wind-up and reaches 1 exactly when the lockout
 * ends, regardless of the card's individual `windUpMs`. Pure + sceneless so it
 * can be unit tested directly.
 */
export function computeWindupChargeRatio(now, windupUntil, windUpMs) {
	if (!Number.isFinite(windUpMs) || windUpMs <= 0) return 1;
	if (!Number.isFinite(windupUntil) || windupUntil <= 0) return 0;
	const remaining = windupUntil - now;
	const ratio = 1 - remaining / windUpMs;
	if (ratio <= 0) return 0;
	if (ratio >= 1) return 1;
	return ratio;
}

/** Accent tint (hex int) for a wind-up card, falling back to the default blue. */
export function resolveWindupAccentHex(cardId) {
	const hex = getAccentHex(cardId);
	return hex === undefined ? WINDUP_DEFAULT_ACCENT : hex;
}

/** Ring for player card wind-up — distinct from enemy attack telegraphs. */
function createPlayerCardWindupTelegraph(accentHex = WINDUP_DEFAULT_ACCENT) {
	const geo = new THREE.RingGeometry(0.38, 0.58, 32);
	const mat = new THREE.MeshStandardMaterial({
		color: accentHex,
		emissive: accentHex,
		emissiveIntensity: WINDUP_RING_MIN_EMISSIVE,
		transparent: true,
		opacity: WINDUP_RING_MIN_OPACITY,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.rotation.x = -Math.PI / 2;
	return mesh;
}

function applyPlayerCardWindupFlash(playerId, isWindup, accentHex = WINDUP_DEFAULT_ACCENT, ratio = 0) {
	const avatar = playersMeshes[playerId];
	const body = avatar?.userData?.bodyMesh;
	if (!body?.material?.emissive) return;

	if (isWindup) {
		if (!playerCardWindupFlashing.has(playerId)) {
			body.material.emissive.set(accentHex);
			playerCardWindupFlashing.add(playerId);
		}
		// Brighten the avatar as the charge builds toward the hit.
		body.material.emissiveIntensity = lerp(WINDUP_FLASH_MIN_EMISSIVE, WINDUP_FLASH_MAX_EMISSIVE, ratio);
	} else if (playerCardWindupFlashing.has(playerId)) {
		body.material.emissive.set(0x000000);
		body.material.emissiveIntensity = 0;
		playerCardWindupFlashing.delete(playerId);
	}
}

export function applyPlayerCardWindupIndicator(id, player, x, z, now = Date.now()) {
	const windup = isPlayerCardWindup(player);
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (windup) {
		const accentHex = resolveWindupAccentHex(player.cardWindupCardId);
		const windUpMs = getCardDef(player.cardWindupCardId)?.windUpMs;
		const ratio = computeWindupChargeRatio(now, player.cardWindupUntil, windUpMs);

		applyPlayerCardWindupFlash(id, true, accentHex, ratio);
		if (!playerCardWindupMarkers[id]) {
			const ring = createPlayerCardWindupTelegraph(accentHex);
			targetScene.add(ring);
			playerCardWindupMarkers[id] = ring;
		}
		const ring = playerCardWindupMarkers[id];
		ring.position.set(x, GROUND_OVERLAY_Y + 0.02, z);
		// Grow + brighten the existing mesh each frame — no per-frame allocation.
		ring.scale.setScalar(lerp(WINDUP_RING_MIN_SCALE, WINDUP_RING_MAX_SCALE, ratio));
		if (ring.material) {
			ring.material.emissiveIntensity = lerp(WINDUP_RING_MIN_EMISSIVE, WINDUP_RING_MAX_EMISSIVE, ratio);
			ring.material.opacity = lerp(WINDUP_RING_MIN_OPACITY, WINDUP_RING_MAX_OPACITY, ratio);
		}
	} else {
		disposeOne(playerCardWindupMarkers, id, targetScene);
		applyPlayerCardWindupFlash(id, false);
	}
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

export function createConeHitboxGroup(direction, range, coneAngle, style) {
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

// Exported so ./renderer/minionSync.js (createNullCrawlerTelegraph) can build the
// same beam telegraph corridor without duplicating the geometry.
export function createBeamTelegraphGroup(direction, range, hitWidth, style) {
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

// getMinionWindupDirection() + the null-crawler telegraph create/update helpers
// now live in ./renderer/minionSync.js.

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
		// Fiery orb: ember core + outer flame shell — visually distinct from
		// generic `projectile`/`throw_rock` and cool-toned `ice_ball`.
		const fireColor = style.color ?? 0xff7a18;
		const fireEmissive = style.emissive ?? 0xff3b00;
		const group = new THREE.Group();

		const coreMat = new THREE.MeshStandardMaterial({
			color: fireColor,
			emissive: fireEmissive,
			emissiveIntensity: 2.2,
			roughness: 0.4,
			metalness: 0.0,
			transparent: true,
			opacity: 0.95,
		});
		const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), coreMat);
		coreMesh.position.y = 1.0;
		group.add(coreMesh);

		const haloMat = new THREE.MeshStandardMaterial({
			color: fireColor,
			emissive: fireEmissive,
			emissiveIntensity: 1.4,
			roughness: 0.6,
			metalness: 0.0,
			transparent: true,
			opacity: 0.48,
			depthWrite: false,
		});
		const haloMesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 10), haloMat);
		haloMesh.position.y = 1.0;
		group.add(haloMesh);

		group.position.set(origin.x, 0, origin.z);
		targetScene.add(group);

		activeEffects.push({
			mesh: group,
			coreMesh,
			haloMesh,
			origin: { x: origin.x, z: origin.z },
			direction: { x: direction.x, z: direction.z },
			range,
			createdAt: performance.now(),
			duration: style.projectileTravelMs ?? ATTACK_EFFECT_DURATION,
			isFireballProjectile: true,
		});
		return;
	}

	if (effect === 'ice_ball') {
		// Glacial Orb: faceted crystalline core + outer frost halo — cool cyan
		// palette and layered silhouette distinct from generic `projectile`,
		// warm `fireball`, and elongated `permafrost_lance`.
		const iceColor = style.color ?? 0x67e8f9;
		const iceEmissive = style.emissive ?? 0x38bdf8;
		const group = new THREE.Group();

		const coreMat = new THREE.MeshStandardMaterial({
			color: iceColor,
			emissive: iceEmissive,
			emissiveIntensity: 2.4,
			roughness: 0.2,
			metalness: 0.25,
			transparent: true,
			opacity: 0.92,
		});
		const coreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), coreMat);
		coreMesh.position.y = 1.0;
		group.add(coreMesh);

		const haloMat = new THREE.MeshStandardMaterial({
			color: iceColor,
			emissive: iceEmissive,
			emissiveIntensity: 1.6,
			roughness: 0.45,
			metalness: 0.1,
			transparent: true,
			opacity: 0.38,
			depthWrite: false,
		});
		const haloMesh = new THREE.Mesh(new THREE.SphereGeometry(0.48, 10, 10), haloMat);
		haloMesh.position.y = 1.0;
		group.add(haloMesh);

		group.position.set(origin.x, 0, origin.z);
		targetScene.add(group);

		activeEffects.push({
			mesh: group,
			coreMesh,
			haloMesh,
			origin: { x: origin.x, z: origin.z },
			direction: { x: direction.x, z: direction.z },
			range,
			createdAt: performance.now(),
			duration: style.projectileTravelMs ?? 1200,
			isGlacialOrbProjectile: true,
		});
		return;
	}

	if (effect === 'arcane_bolt') {
		// Violet arcane energy lance — elongated bolt core + trailing glow, visually
		// distinct from generic `projectile` spheres and ground cone wedges.
		const boltColor = style.color ?? 0xa78bfa;
		const boltEmissive = style.emissive ?? 0x7c3aed;
		const dir = direction || { x: 1, z: 0 };
		const len = Math.hypot(dir.x, dir.z) || 1;
		const nx = dir.x / len;
		const nz = dir.z / len;
		const heading = Math.atan2(nx, nz);
		const group = new THREE.Group();

		const coreMat = new THREE.MeshStandardMaterial({
			color: boltColor,
			emissive: boltEmissive,
			emissiveIntensity: 1.8,
			roughness: 0.28,
			metalness: 0.12,
			transparent: true,
			opacity: 0.95,
		});
		const coreMesh = new THREE.Mesh(new THREE.ConeGeometry(0.08, 1.45, 8), coreMat);
		coreMesh.position.y = 1.0;
		coreMesh.rotation.x = Math.PI / 2;
		coreMesh.rotation.y = heading;
		group.add(coreMesh);

		const glowMat = new THREE.MeshStandardMaterial({
			color: boltColor,
			emissive: boltEmissive,
			emissiveIntensity: 1.15,
			roughness: 0.45,
			metalness: 0.0,
			transparent: true,
			opacity: 0.42,
			depthWrite: false,
		});
		const glowMesh = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.85, 8), glowMat);
		glowMesh.position.set(-nx * 0.32, 1.0, -nz * 0.32);
		glowMesh.rotation.x = Math.PI / 2;
		glowMesh.rotation.y = heading;
		group.add(glowMesh);

		group.position.set(origin.x, 0, origin.z);
		targetScene.add(group);

		activeEffects.push({
			mesh: group,
			coreMesh,
			glowMesh,
			_scene: targetScene,
			origin: { x: origin.x, z: origin.z },
			direction: { x: nx, z: nz },
			range,
			createdAt: performance.now(),
			duration: style.projectileTravelMs ?? ATTACK_EFFECT_DURATION,
			isArcaneBoltProjectile: true,
		});
		return;
	}

	if (effect === 'permafrost_lance') {
		// Elongated crystalline ice spear — travels like `fireball` / `ice_ball` but
		// reads as a forward-thrusting lance rather than a sphere or ground cone.
		const dir = direction || { x: 1, z: 0 };
		const len = Math.hypot(dir.x, dir.z) || 1;
		const nx = dir.x / len;
		const nz = dir.z / len;
		const lanceColor = style.color ?? 0x67e8f9;
		const lanceEmissive = style.emissive ?? 0x38bdf8;
		const geometry = new THREE.ConeGeometry(0.12, 1.5, 8);
		const material = new THREE.MeshStandardMaterial({
			color: lanceColor,
			emissive: lanceEmissive,
			emissiveIntensity: 1.1,
			roughness: 0.25,
			metalness: 0.15,
			transparent: true,
			opacity: 1.0,
		});
		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.set(origin.x, 1.0, origin.z);
		mesh.rotation.x = Math.PI / 2;
		mesh.rotation.y = Math.atan2(nx, nz);
		targetScene.add(mesh);

		activeEffects.push({
			mesh,
			_scene: targetScene,
			origin: { x: origin.x, z: origin.z },
			direction: { x: nx, z: nz },
			range,
			effect: 'permafrost_lance',
			createdAt: performance.now(),
			duration: style.duration ?? ATTACK_EFFECT_DURATION,
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
			// Default to the standard travel window, but honor a caller-supplied
			// short `travelMs`/`duration` so a hitscan-style beam (Phase Stalker's
			// phase_beam) can resolve near-instantly to match the server hit.
			duration: style.travelMs ?? style.duration ?? ATTACK_EFFECT_DURATION,
		});
		return;
	}

	// Forward cone wedge on the ground — exact server collectConeHits footprint.
	// When origin.y is set (airborne breath), lift the cone to that height.
	const coneY = Number.isFinite(origin.y) ? origin.y : GROUND_OVERLAY_Y;
	const group = createConeHitboxGroup(direction, range, coneAngle, coneStyle);
	group.position.set(origin.x, coneY, origin.z);
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
		kind: ATTACK_EFFECT_KINDS.expandFadeRing,
		createdAt: performance.now(),
		duration: SUMMON_EFFECT_DURATION,
	});
}

/**
 * Shared minion summon-in flourish: accent ground ring, telegraph pulse, and
 * particle burst at the spawn point. Composes existing 315 VFX primitives.
 * @param {object} origin - { x, z }
 * @param {object} [style] - optional { color, emissive, radius }
 */
export function spawnMinionSummonInEffect(origin, style = {}) {
	const color = style.color ?? 0x22c55e;
	const emissive = style.emissive ?? color;
	const radius = style.radius ?? 1.4;
	const burstCount = style.burstCount ?? 12;
	const burstSpread = style.burstSpread ?? 1.8;
	const summonStyle = { color, emissive };

	spawnSummonEffect(origin, radius, summonStyle);
	spawnTelegraphRing(origin, radius * 0.85, {
		color,
		emissive,
		duration: MINION_SUMMON_IN_MS,
	});
	spawnParticleBurst(
		{ x: origin.x, y: 1.0, z: origin.z },
		{ color, emissive, count: burstCount, spread: burstSpread, duration: MINION_SUMMON_IN_MS },
	);
}

// Legion Marshal rally palette — bone-white / necrotic purple (undead_commander accent).
export const LEGION_MARSHAL_COLOR = 0xe4e4e7;
export const LEGION_MARSHAL_EMISSIVE = 0xa855f7;
const LEGION_MARSHAL_COLUMN_HEIGHT = 4.5;
const LEGION_MARSHAL_COLUMN_OPACITY = 0.7;
const LEGION_MARSHAL_COLUMN_BASE_Y = 0.1;
const LEGION_MARSHAL_EMISSIVE_INTENSITY = 1.4;
const LEGION_MARSHAL_DEFAULT_RADIUS = 2;
const LEGION_MARSHAL_BURST_COUNT = 8;
const LEGION_MARSHAL_BURST_SPREAD = 1.4;

/**
 * Undead commander rally: expanding bone-white/purple ground ring plus a short
 * vertical rising bone-shard / necrotic wisp column. Pure additive VFX; no
 * network traffic or state beyond activeEffects.
 * @param {object} origin - { x, z }
 * @param {number} [radius]
 * @param {object} [style] - optional { color, emissive, duration }
 */
export function spawnLegionMarshalRallyEffect(origin, radius, style = {}) {
	const color = style.color ?? LEGION_MARSHAL_COLOR;
	const emissive = style.emissive ?? LEGION_MARSHAL_EMISSIVE;
	const duration = style.duration ?? SUMMON_EFFECT_DURATION;
	const r = radius ?? LEGION_MARSHAL_DEFAULT_RADIUS;
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (!targetScene) return;

	const ringGeometry = new THREE.RingGeometry(0.1, 0.5, 32);
	const ringMaterial = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: 1.0,
		transparent: true,
		opacity: 1.0,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
	ringMesh.position.set(origin.x, 0.1, origin.z);
	ringMesh.rotation.x = -Math.PI / 2;
	ringMesh.scale.setScalar(0.001);
	targetScene.add(ringMesh);

	activeEffects.push({
		mesh: ringMesh,
		origin: { x: origin.x, z: origin.z },
		radius: r,
		kind: ATTACK_EFFECT_KINDS.expandFadeRing,
		createdAt: performance.now(),
		duration,
		_scene: targetScene,
	});

	const columnGeometry = new THREE.CylinderGeometry(0.3, 0.55, LEGION_MARSHAL_COLUMN_HEIGHT, 16, 1, true);
	const columnMaterial = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: LEGION_MARSHAL_EMISSIVE_INTENSITY,
		transparent: true,
		opacity: LEGION_MARSHAL_COLUMN_OPACITY,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const columnMesh = new THREE.Mesh(columnGeometry, columnMaterial);
	columnMesh.scale.y = 0.001;
	columnMesh.position.set(origin.x, LEGION_MARSHAL_COLUMN_BASE_Y, origin.z);
	targetScene.add(columnMesh);

	activeEffects.push({
		mesh: columnMesh,
		origin: { x: origin.x, z: origin.z },
		kind: ATTACK_EFFECT_KINDS.legionMarshalColumn,
		createdAt: performance.now(),
		duration,
		isLegionMarshalColumn: true,
		_baseEmissiveIntensity: LEGION_MARSHAL_EMISSIVE_INTENSITY,
		_scene: targetScene,
	});

	spawnParticleBurst(
		{ x: origin.x, y: 0.5, z: origin.z },
		{
			color,
			emissive,
			count: LEGION_MARSHAL_BURST_COUNT,
			spread: LEGION_MARSHAL_BURST_SPREAD,
			duration,
		},
	);
}

// Battery Automaton palette — amber/gold chassis with electric cyan sparks.
export const BATTERY_AUTOMATON_COLOR = 0xfbbf24;
export const BATTERY_AUTOMATON_EMISSIVE = 0x38bdf8;
const BATTERY_AUTOMATON_COLUMN_HEIGHT = 2.5;
const BATTERY_AUTOMATON_COLUMN_OPACITY = 0.75;
const BATTERY_AUTOMATON_COLUMN_BASE_Y = 0.1;
const BATTERY_AUTOMATON_EMISSIVE_INTENSITY = 1.5;
const BATTERY_AUTOMATON_DEFAULT_RADIUS = 1.4;
const BATTERY_AUTOMATON_CHARGE_PULSE_DURATION = 700;
const BATTERY_AUTOMATON_CHARGE_BURST_COUNT = 10;
const BATTERY_AUTOMATON_CHARGE_BURST_SPREAD = 1.6;

/**
 * Mechanical deploy flourish: expanding amber/gold assembly ring plus a short
 * rising electric column. Pure additive VFX; no network traffic or state
 * beyond activeEffects.
 * @param {object} origin - { x, z }
 * @param {object} [style] - optional { color, emissive, duration, radius }
 */
export function spawnBatteryAutomatonDeployEffect(origin, style = {}) {
	const color = style.color ?? BATTERY_AUTOMATON_COLOR;
	const emissive = style.emissive ?? BATTERY_AUTOMATON_EMISSIVE;
	const duration = style.duration ?? MINION_SUMMON_IN_MS;
	const radius = style.radius ?? BATTERY_AUTOMATON_DEFAULT_RADIUS;
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (!targetScene) return;

	const ringGeometry = new THREE.RingGeometry(0.1, 0.5, 32);
	const ringMaterial = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: 1.2,
		transparent: true,
		opacity: 1.0,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
	ringMesh.position.set(origin.x, 0.1, origin.z);
	ringMesh.rotation.x = -Math.PI / 2;
	ringMesh.scale.setScalar(0.001);
	targetScene.add(ringMesh);

	activeEffects.push({
		mesh: ringMesh,
		origin: { x: origin.x, z: origin.z },
		radius,
		kind: ATTACK_EFFECT_KINDS.batteryAutomatonRing,
		createdAt: performance.now(),
		duration,
		isBatteryAutomatonRing: true,
		_baseEmissiveIntensity: 1.2,
		_scene: targetScene,
	});

	const columnGeometry = new THREE.CylinderGeometry(0.22, 0.42, BATTERY_AUTOMATON_COLUMN_HEIGHT, 16, 1, true);
	const columnMaterial = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: BATTERY_AUTOMATON_EMISSIVE_INTENSITY,
		transparent: true,
		opacity: BATTERY_AUTOMATON_COLUMN_OPACITY,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const columnMesh = new THREE.Mesh(columnGeometry, columnMaterial);
	columnMesh.scale.y = 0.001;
	columnMesh.position.set(origin.x, BATTERY_AUTOMATON_COLUMN_BASE_Y, origin.z);
	targetScene.add(columnMesh);

	activeEffects.push({
		mesh: columnMesh,
		origin: { x: origin.x, z: origin.z },
		kind: ATTACK_EFFECT_KINDS.batteryAutomatonColumn,
		createdAt: performance.now(),
		duration,
		isBatteryAutomatonColumn: true,
		_baseEmissiveIntensity: BATTERY_AUTOMATON_EMISSIVE_INTENSITY,
		_scene: targetScene,
	});
}

/**
 * Brief charge-delivery pulse: quick expanding cyan/amber ring plus an upward
 * electric spark burst. Pure additive VFX; no network traffic or state beyond
 * activeEffects.
 * @param {object} origin - { x, z }
 * @param {object} [style] - optional { color, emissive, duration, radius }
 */
export function spawnBatteryChargePulseEffect(origin, style = {}) {
	const color = style.color ?? BATTERY_AUTOMATON_COLOR;
	const emissive = style.emissive ?? BATTERY_AUTOMATON_EMISSIVE;
	const duration = style.duration ?? BATTERY_AUTOMATON_CHARGE_PULSE_DURATION;
	const radius = style.radius ?? 1.0;
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (!targetScene) return;

	const ringGeometry = new THREE.RingGeometry(0.1, 0.5, 32);
	const ringMaterial = new THREE.MeshStandardMaterial({
		color: emissive,
		emissive,
		emissiveIntensity: 1.35,
		transparent: true,
		opacity: 1.0,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
	ringMesh.position.set(origin.x, 0.12, origin.z);
	ringMesh.rotation.x = -Math.PI / 2;
	ringMesh.scale.setScalar(0.001);
	targetScene.add(ringMesh);

	activeEffects.push({
		mesh: ringMesh,
		origin: { x: origin.x, z: origin.z },
		radius,
		kind: ATTACK_EFFECT_KINDS.batteryAutomatonRing,
		createdAt: performance.now(),
		duration,
		isBatteryAutomatonRing: true,
		_baseEmissiveIntensity: 1.35,
		_scene: targetScene,
	});

	spawnParticleBurst(
		{ x: origin.x, y: 0.6, z: origin.z },
		{
			color,
			emissive,
			count: BATTERY_AUTOMATON_CHARGE_BURST_COUNT,
			spread: BATTERY_AUTOMATON_CHARGE_BURST_SPREAD,
			duration,
		},
	);
}

// Aegis Sentinel palette — protective green ward with optional gold trim.
export const AEGIS_SENTINEL_COLOR = 0x4ade80;
export const AEGIS_SENTINEL_EMISSIVE = 0x22c55e;
export const AEGIS_SENTINEL_GOLD = 0xfbbf24;
const AEGIS_SENTINEL_SHIELD_DEFAULT_RADIUS = 1.5;
const AEGIS_SENTINEL_DEPLOY_DEFAULT_RADIUS = 2.0;
const AEGIS_SENTINEL_DOME_HEIGHT = 2.1;
const AEGIS_SENTINEL_DOME_OPACITY = 0.58;
const AEGIS_SENTINEL_WALL_HEIGHT = 2.6;
const AEGIS_SENTINEL_WALL_WIDTH = 1.85;
const AEGIS_SENTINEL_WALL_DEPTH = 0.18;
const AEGIS_SENTINEL_WALL_OPACITY = 0.72;
const AEGIS_SENTINEL_EMISSIVE_INTENSITY = 1.35;

/**
 * Brief caster shield wrap at cast time: pulsing green ground ring plus a short
 * translucent shield facet/dome rising around the origin. Pure additive VFX.
 * @param {object} origin - { x, z }
 * @param {object} [style] - optional { color, emissive, duration, radius }
 */
export function spawnAegisSentinelShieldFlourish(origin, style = {}) {
	const color = style.color ?? AEGIS_SENTINEL_COLOR;
	const emissive = style.emissive ?? AEGIS_SENTINEL_EMISSIVE;
	const highlight = style.highlight ?? AEGIS_SENTINEL_GOLD;
	const duration = style.duration ?? MINION_SUMMON_IN_MS;
	const radius = style.radius ?? AEGIS_SENTINEL_SHIELD_DEFAULT_RADIUS;
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (!targetScene) return;

	const group = new THREE.Group();
	group.position.set(origin.x, 0, origin.z);

	const ringGeometry = new THREE.RingGeometry(0.78, 1.0, 40);
	const ringMaterial = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: 1.15,
		transparent: true,
		opacity: 0.88,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
	ringMesh.position.y = GROUND_OVERLAY_Y;
	ringMesh.rotation.x = -Math.PI / 2;
	ringMesh.scale.setScalar(0.001);
	ringMesh.userData.isAegisSentinelRing = true;
	group.add(ringMesh);

	const domeHeight = Math.min(radius * 1.25, AEGIS_SENTINEL_DOME_HEIGHT);
	const domeRadius = Math.min(radius * 0.72, 1.15);
	const domeGeometry = new THREE.CylinderGeometry(domeRadius, domeRadius * 1.08, domeHeight, 20, 1, true);
	const domeMaterial = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: AEGIS_SENTINEL_EMISSIVE_INTENSITY,
		transparent: true,
		opacity: AEGIS_SENTINEL_DOME_OPACITY,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const domeMesh = new THREE.Mesh(domeGeometry, domeMaterial);
	domeMesh.scale.y = 0.001;
	domeMesh.position.y = domeHeight * 0.5;
	domeMesh.userData.isAegisSentinelDome = true;
	group.add(domeMesh);

	const facetWidth = Math.min(radius * 0.55, 1.1);
	const facetHeight = domeHeight * 0.92;
	const facetAngles = [Math.PI * 0.25, -Math.PI * 0.25];
	for (let i = 0; i < facetAngles.length; i += 1) {
		const facetPalette = i === 0
			? { color, emissive }
			: { color: highlight, emissive: highlight };
		const facetGeometry = new THREE.PlaneGeometry(facetWidth, facetHeight);
		const facetMaterial = new THREE.MeshStandardMaterial({
			color: facetPalette.color,
			emissive: facetPalette.emissive,
			emissiveIntensity: 1.2,
			transparent: true,
			opacity: 0.5,
			side: THREE.DoubleSide,
			depthWrite: false,
		});
		const facetMesh = new THREE.Mesh(facetGeometry, facetMaterial);
		facetMesh.position.y = facetHeight * 0.5;
		facetMesh.rotation.y = facetAngles[i];
		facetMesh.userData.isAegisSentinelFacet = true;
		group.add(facetMesh);
	}

	targetScene.add(group);

	activeEffects.push({
		mesh: group,
		_scene: targetScene,
		origin: { x: origin.x, z: origin.z },
		radius,
		domeHeight,
		kind: ATTACK_EFFECT_KINDS.aegisSentinelShield,
		createdAt: performance.now(),
		duration,
		isAegisSentinelShield: true,
	});
}

/**
 * Minion-deploy flourish: expanding green ward ring plus a rising shield-wall
 * silhouette so the sentinel materialization reads as a taunt wall. Pure
 * additive VFX.
 * @param {object} origin - { x, z }
 * @param {object} [style] - optional { color, emissive, duration, radius }
 */
export function spawnAegisSentinelDeployEffect(origin, style = {}) {
	const color = style.color ?? AEGIS_SENTINEL_COLOR;
	const emissive = style.emissive ?? AEGIS_SENTINEL_EMISSIVE;
	const highlight = style.highlight ?? AEGIS_SENTINEL_GOLD;
	const duration = style.duration ?? MINION_SUMMON_IN_MS;
	const radius = style.radius ?? AEGIS_SENTINEL_DEPLOY_DEFAULT_RADIUS;
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (!targetScene) return;

	const group = new THREE.Group();
	group.position.set(origin.x, 0, origin.z);

	const ringGeometry = new THREE.RingGeometry(0.1, 0.5, 32);
	const ringMaterial = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: 1.2,
		transparent: true,
		opacity: 1.0,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
	ringMesh.position.y = GROUND_OVERLAY_Y;
	ringMesh.rotation.x = -Math.PI / 2;
	ringMesh.scale.setScalar(0.001);
	ringMesh.userData.isAegisSentinelRing = true;
	group.add(ringMesh);

	const wallWidth = Math.min(radius * 0.95, AEGIS_SENTINEL_WALL_WIDTH);
	const wallHeight = AEGIS_SENTINEL_WALL_HEIGHT;
	const wallGeometry = new THREE.BoxGeometry(wallWidth, wallHeight, AEGIS_SENTINEL_WALL_DEPTH);
	const wallMaterial = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: AEGIS_SENTINEL_EMISSIVE_INTENSITY,
		transparent: true,
		opacity: AEGIS_SENTINEL_WALL_OPACITY,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
	wallMesh.scale.y = 0.001;
	wallMesh.position.y = wallHeight * 0.5;
	wallMesh.userData.isAegisSentinelWall = true;
	group.add(wallMesh);

	const trimGeometry = new THREE.BoxGeometry(wallWidth * 1.04, 0.12, AEGIS_SENTINEL_WALL_DEPTH * 1.6);
	const trimMaterial = new THREE.MeshStandardMaterial({
		color: highlight,
		emissive: highlight,
		emissiveIntensity: 1.25,
		transparent: true,
		opacity: 0.85,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const trimMesh = new THREE.Mesh(trimGeometry, trimMaterial);
	trimMesh.scale.y = 0.001;
	trimMesh.position.y = wallHeight * 0.5;
	trimMesh.userData.isAegisSentinelWallTrim = true;
	group.add(trimMesh);

	targetScene.add(group);

	activeEffects.push({
		mesh: group,
		_scene: targetScene,
		origin: { x: origin.x, z: origin.z },
		radius,
		wallHeight,
		kind: ATTACK_EFFECT_KINDS.aegisSentinelDeploy,
		createdAt: performance.now(),
		duration,
		isAegisSentinelDeploy: true,
		_baseEmissiveIntensity: AEGIS_SENTINEL_EMISSIVE_INTENSITY,
	});
}

// Sanctum Pulse palette: a coherent holy-gold so the divine "pulse" reads as
// radiant sacred light, not the accidental green the ring emissive used to be.
const DIVINE_GRACE_RING_COLOR = 0xfde68a; // warm gold ground ring
const DIVINE_GRACE_EMISSIVE = 0xf59e0b; // amber/gold glow (replaces green 0x86efac)
const DIVINE_GRACE_COLUMN_COLOR = 0xfef3c7; // pale radiant column body
const DIVINE_GRACE_COLUMN_EMISSIVE = 0xfbbf24; // bright gold column glow
const DIVINE_GRACE_COLUMN_HEIGHT = 4.5; // ascending shaft height
const DIVINE_GRACE_COLUMN_OPACITY = 0.7; // peak opacity of the light shaft
const DIVINE_GRACE_COLUMN_BASE_Y = 0.1; // ground offset of the shaft's base

/**
 * Expanding holy-gold ground pulse ring (heal half of Sanctum Pulse).
 * Radius-based, so it rides the shared expand→fade lifecycle in
 * updateAttackEffects exactly like the other heal-card pulse rings.
 * @param {object} origin - { x, z }
 * @param {number} radius
 */
export function spawnDivineGracePulseRing(origin, radius) {
	const geometry = new THREE.RingGeometry(0.1, 0.5, 32);
	const material = new THREE.MeshStandardMaterial({
		color: DIVINE_GRACE_RING_COLOR,
		emissive: DIVINE_GRACE_EMISSIVE,
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
		kind: ATTACK_EFFECT_KINDS.expandFadeRing,
		createdAt: performance.now(),
		duration: SUMMON_EFFECT_DURATION,
	});
}

/**
 * Vertical ascending holy light column rising from the origin, giving Sanctum
 * Pulse a sacred upward-burst silhouette instead of a flat ring. Modeled on the
 * open-ended cylinder shaft used by the telepipe portal; rises and fades via the
 * `isLightColumn` branch in updateAttackEffects (no per-frame allocation).
 * @param {object} origin - { x, z }
 */
export function spawnDivineGraceColumn(origin) {
	// Open-ended cone-tapered shaft. The cylinder is centered on its own origin,
	// so updateAttackEffects raises position.y in lockstep with scale.y to keep
	// the base pinned to the ground while the column grows upward.
	const geometry = new THREE.CylinderGeometry(0.3, 0.55, DIVINE_GRACE_COLUMN_HEIGHT, 16, 1, true);
	const material = new THREE.MeshStandardMaterial({
		color: DIVINE_GRACE_COLUMN_COLOR,
		emissive: DIVINE_GRACE_COLUMN_EMISSIVE,
		emissiveIntensity: 1.4,
		transparent: true,
		opacity: DIVINE_GRACE_COLUMN_OPACITY,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.scale.y = 0.001;
	mesh.position.set(origin.x, DIVINE_GRACE_COLUMN_BASE_Y, origin.z);
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (targetScene) targetScene.add(mesh);

	activeEffects.push({
		mesh,
		origin: { x: origin.x, z: origin.z },
		kind: ATTACK_EFFECT_KINDS.lightColumn,
		createdAt: performance.now(),
		duration: SUMMON_EFFECT_DURATION,
		isLightColumn: true,
		_scene: targetScene,
	});
}

/**
 * Sanctum Pulse: a holy-gold heal that reads as a divine pulse — an expanding
 * golden ground ring plus a vertical ascending light column from the origin.
 * Pure additive VFX; no network traffic or state beyond activeEffects.
 * @param {object} origin - { x, z }
 * @param {number} radius
 */
export function spawnDivineGraceEffect(origin, radius) {
	spawnDivineGracePulseRing(origin, radius);
	spawnDivineGraceColumn(origin);
}

// Restoration Beacon palette — emerald restorative light. Aligns with the
// healing_font accent (#86efac / emissive 0x4ade80). Deliberately green and a
// taller/narrower shaft than Sanctum Pulse's broad gold column, so the two heal
// signatures never read alike. Never reuse the DIVINE_GRACE_* gold constants here.
const RESTORATION_BEACON_RING_COLOR = 0x86efac; // soft emerald ground heal ring
const RESTORATION_BEACON_RING_EMISSIVE = 0x4ade80; // bright green ring glow
const RESTORATION_BEACON_COLUMN_COLOR = 0xbbf7d0; // pale mint shaft body
const RESTORATION_BEACON_COLUMN_EMISSIVE = 0x4ade80; // emerald column glow
const RESTORATION_BEACON_COLUMN_HEIGHT = 5.6; // taller than the gold column (4.5)
const RESTORATION_BEACON_COLUMN_OPACITY = 0.78; // brighter peak than the gold shaft
const RESTORATION_BEACON_COLUMN_BASE_Y = 0.1; // ground offset of the shaft base
const RESTORATION_BEACON_COLUMN_RADIUS_TOP = 0.12; // narrow tip (vs grace 0.3)
const RESTORATION_BEACON_COLUMN_RADIUS_BASE = 0.26; // narrow base (vs grace 0.55)
const RESTORATION_BEACON_MOTE_COLOR = 0x86efac; // emerald heal motes
const RESTORATION_BEACON_MOTE_EMISSIVE = 0x22c55e; // deeper green mote core
const RESTORATION_BEACON_MOTE_COUNT = 14; // ascending mote count
const RESTORATION_BEACON_MOTE_RISE = 2.2; // upward velocity scale of the motes
const RESTORATION_BEACON_MOTE_DRIFT = 0.5; // lateral drift of the motes

/**
 * Expanding emerald ground heal ring (the flat base of the Restoration Beacon).
 * Radius-based, so it rides the shared expand→fade lifecycle in
 * updateAttackEffects exactly like the other heal-card pulse rings.
 * @param {object} origin - { x, z }
 * @param {number} radius
 */
export function spawnRestorationBeaconRing(origin, radius) {
	const geometry = new THREE.RingGeometry(0.1, 0.5, 32);
	const material = new THREE.MeshStandardMaterial({
		color: RESTORATION_BEACON_RING_COLOR,
		emissive: RESTORATION_BEACON_RING_EMISSIVE,
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
		kind: ATTACK_EFFECT_KINDS.expandFadeRing,
		createdAt: performance.now(),
		duration: SUMMON_EFFECT_DURATION,
	});
}

/**
 * Tall, narrow emerald light beacon rising from the cast origin — the headline
 * silhouette of Restoration Beacon. Rides the shared `isLightColumn` lifecycle
 * (same base-pinned grow→fade shaft Sanctum Pulse uses) but in the emerald
 * palette and a taller/narrower geometry, carrying its own height/opacity via
 * the fx fields so it never touches the gold column constants. No per-frame
 * allocation.
 * @param {object} origin - { x, z }
 */
export function spawnRestorationBeaconColumn(origin) {
	const geometry = new THREE.CylinderGeometry(
		RESTORATION_BEACON_COLUMN_RADIUS_TOP,
		RESTORATION_BEACON_COLUMN_RADIUS_BASE,
		RESTORATION_BEACON_COLUMN_HEIGHT,
		16,
		1,
		true,
	);
	const material = new THREE.MeshStandardMaterial({
		color: RESTORATION_BEACON_COLUMN_COLOR,
		emissive: RESTORATION_BEACON_COLUMN_EMISSIVE,
		emissiveIntensity: 1.6,
		transparent: true,
		opacity: RESTORATION_BEACON_COLUMN_OPACITY,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.scale.y = 0.001;
	mesh.position.set(origin.x, RESTORATION_BEACON_COLUMN_BASE_Y, origin.z);
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (targetScene) targetScene.add(mesh);

	activeEffects.push({
		mesh,
		origin: { x: origin.x, z: origin.z },
		kind: ATTACK_EFFECT_KINDS.lightColumn,
		createdAt: performance.now(),
		duration: SUMMON_EFFECT_DURATION,
		isLightColumn: true,
		// Per-effect shaft dims so the shared isLightColumn branch keeps the base
		// pinned for the taller/brighter green beacon without gold constants.
		columnHeight: RESTORATION_BEACON_COLUMN_HEIGHT,
		columnBaseY: RESTORATION_BEACON_COLUMN_BASE_Y,
		columnOpacity: RESTORATION_BEACON_COLUMN_OPACITY,
		_scene: targetScene,
	});
}

/**
 * Upward-streaming emerald heal motes lifting off the beacon base. Builds a
 * single Group of particles with strongly upward velocities and rides the
 * shared `isParticleBurst` update branch (no new per-frame allocation).
 * @param {object} origin - { x, z }
 */
export function spawnRestorationBeaconMotes(origin) {
	if (!areParticlesEnabled()) return;
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (!targetScene) return;

	const group = new THREE.Group();
	group.position.set(origin.x, RESTORATION_BEACON_COLUMN_BASE_Y, origin.z);

	for (let i = 0; i < RESTORATION_BEACON_MOTE_COUNT; i += 1) {
		const geometry = THREE.IcosahedronGeometry
			? new THREE.IcosahedronGeometry(0.07, 0)
			: new THREE.SphereGeometry(0.07, 6, 6);
		const material = new THREE.MeshStandardMaterial({
			color: RESTORATION_BEACON_MOTE_COLOR,
			emissive: RESTORATION_BEACON_MOTE_EMISSIVE,
			emissiveIntensity: 1.5,
			transparent: true,
			opacity: 1.0,
		});
		const particle = new THREE.Mesh(geometry, material);
		const angle = Math.random() * Math.PI * 2;
		const drift = RESTORATION_BEACON_MOTE_DRIFT * Math.random();
		// Strong upward bias so the motes visibly ascend the beacon shaft.
		particle.userData.velocity = {
			x: Math.cos(angle) * drift,
			y: RESTORATION_BEACON_MOTE_RISE * (0.7 + Math.random() * 0.6),
			z: Math.sin(angle) * drift,
		};
		group.add(particle);
	}
	targetScene.add(group);

	activeEffects.push({
		mesh: group,
		_scene: targetScene,
		isParticleBurst: true,
		createdAt: performance.now(),
		duration: SUMMON_EFFECT_DURATION,
	});
}

/**
 * Restoration Beacon: an emerald restorative beacon — a tall narrow green light
 * pillar rising from the origin, an expanding ground heal ring, and ascending
 * heal motes. Pure additive VFX; every primitive fires synchronously (the server
 * resolves the heal instantly in one `cardUsed`). Visually distinct from Sanctum
 * Pulse's broad gold column — never reuses the divine-grace effect or palette.
 * @param {object} origin - { x, z }
 * @param {number} radius
 */
export function spawnRestorationBeaconEffect(origin, radius) {
	if (!origin) return;
	spawnRestorationBeaconColumn(origin);
	spawnRestorationBeaconRing(origin, radius);
	spawnRestorationBeaconMotes(origin);
}

// Ether Siphon palette — violet ethereal mana-drain (matches cards.js mana_leach accent).
export const ETHER_SIPHON_COLOR = 0xa855f7;
export const ETHER_SIPHON_EMISSIVE = 0x9333ea;
const ETHER_SIPHON_COLUMN_HEIGHT = 4.5;
const ETHER_SIPHON_COLUMN_OPACITY = 0.7;
const ETHER_SIPHON_COLUMN_BASE_Y = 0.1;
const ETHER_SIPHON_EMISSIVE_INTENSITY = 1.4;
const ETHER_SIPHON_RING_CONTRACT_MIN = 0.35; // final scale factor vs full radius

/**
 * Contracting ground ether ring — inward siphon pull (inverse of spawnTelegraphRing).
 * Unit-radius ring mesh scaled to `radius`; shrinks toward the origin over duration.
 * @param {object} origin - { x, z }
 * @param {number} radius
 * @param {object} [style] - optional { color, emissive, duration }
 */
function spawnEtherSiphonRing(origin, radius, style = {}) {
	const color = style.color ?? ETHER_SIPHON_COLOR;
	const emissive = style.emissive ?? ETHER_SIPHON_EMISSIVE;
	const duration = style.duration ?? SUMMON_EFFECT_DURATION;
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (!targetScene) return;

	const geometry = new THREE.RingGeometry(0.82, 1.0, 48);
	const material = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: 1.2,
		transparent: true,
		opacity: 0.9,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geometry, material);
	const ringY = Number.isFinite(origin.y) ? origin.y : GROUND_OVERLAY_Y;
	mesh.position.set(origin.x, ringY, origin.z);
	mesh.rotation.x = -Math.PI / 2;
	mesh.scale.setScalar(radius);
	targetScene.add(mesh);

	activeEffects.push({
		mesh,
		origin: { x: origin.x, z: origin.z },
		radius,
		kind: ATTACK_EFFECT_KINDS.etherSiphonRing,
		createdAt: performance.now(),
		duration,
		isEtherSiphonRing: true,
		_scene: targetScene,
	});
}

/**
 * Short vertical violet ether wisp column rising from the origin. Rises and fades via
 * the `isEtherSiphonColumn` branch in updateAttackEffects (no per-frame allocation).
 * @param {object} origin - { x, z }
 * @param {object} [style] - optional { color, emissive, duration }
 */
function spawnEtherSiphonColumn(origin, style = {}) {
	const color = style.color ?? ETHER_SIPHON_COLOR;
	const emissive = style.emissive ?? ETHER_SIPHON_EMISSIVE;
	const duration = style.duration ?? SUMMON_EFFECT_DURATION;
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (!targetScene) return;

	const geometry = new THREE.CylinderGeometry(0.3, 0.55, ETHER_SIPHON_COLUMN_HEIGHT, 16, 1, true);
	const material = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: ETHER_SIPHON_EMISSIVE_INTENSITY,
		transparent: true,
		opacity: ETHER_SIPHON_COLUMN_OPACITY,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.scale.y = 0.001;
	mesh.position.set(origin.x, ETHER_SIPHON_COLUMN_BASE_Y, origin.z);
	targetScene.add(mesh);

	activeEffects.push({
		mesh,
		origin: { x: origin.x, z: origin.z },
		kind: ATTACK_EFFECT_KINDS.etherSiphonColumn,
		createdAt: performance.now(),
		duration,
		isEtherSiphonColumn: true,
		_baseEmissiveIntensity: ETHER_SIPHON_EMISSIVE_INTENSITY,
		_scene: targetScene,
	});
}

/**
 * Ether Siphon: contracting inward-pull ground ring plus a rising violet ether column.
 * Pure additive VFX; no network traffic or state beyond activeEffects.
 * @param {object} origin - { x, z }
 * @param {number} radius
 * @param {object} [style] - optional { color, emissive, duration }
 */
export function spawnEtherSiphonEffect(origin, radius, style = {}) {
	spawnEtherSiphonRing(origin, radius, style);
	spawnEtherSiphonColumn(origin, style);
}

// Telepipe cast palette — matches cards.js accent and syncTelepipeMesh portal cyan.
export const TELEPIPE_CAST_COLOR = 0x67e8f9;
export const TELEPIPE_CAST_EMISSIVE = 0x22d3ee;
const TELEPIPE_CAST_DEFAULT_RADIUS = 2.5;
const TELEPIPE_CAST_COLUMN_OPACITY = 0.55;
const TELEPIPE_CAST_BURST_COUNT = 10;
const TELEPIPE_CAST_BURST_SPREAD = 1.6;

/**
 * Brief portal-opening flourish when the Telepipe spell is cast: an expanding
 * cyan ground ring, a rising open-ended warp-tube cylinder shaft, and an upward
 * particle burst. Pure additive VFX; no network traffic or persistent portal mesh.
 * @param {object} origin - { x, z }
 * @param {number} [radius]
 * @param {object} [style] - optional { color, emissive, burstCount, burstSpread }
 */
export function spawnTelepipeCastEffect(origin, radius, style = {}) {
	const color = style.color ?? TELEPIPE_CAST_COLOR;
	const emissive = style.emissive ?? TELEPIPE_CAST_EMISSIVE;
	const r = radius ?? TELEPIPE_CAST_DEFAULT_RADIUS;
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;

	const ringGeometry = new THREE.RingGeometry(0.1, 0.5, 32);
	const ringMaterial = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: 1.0,
		transparent: true,
		opacity: 1.0,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const ring = new THREE.Mesh(ringGeometry, ringMaterial);
	ring.position.set(origin.x, 0.1, origin.z);
	ring.rotation.x = -Math.PI / 2;
	ring.scale.setScalar(0.001);
	if (targetScene) targetScene.add(ring);

	activeEffects.push({
		mesh: ring,
		origin: { x: origin.x, z: origin.z },
		radius: r,
		kind: ATTACK_EFFECT_KINDS.expandFadeRing,
		createdAt: performance.now(),
		duration: SUMMON_EFFECT_DURATION,
		_scene: targetScene,
	});

	const geometry = new THREE.CylinderGeometry(0.35, 0.65, DIVINE_GRACE_COLUMN_HEIGHT, 16, 1, true);
	const material = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: 1.2,
		transparent: true,
		opacity: TELEPIPE_CAST_COLUMN_OPACITY,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.scale.y = 0.001;
	mesh.position.set(origin.x, DIVINE_GRACE_COLUMN_BASE_Y, origin.z);
	if (targetScene) targetScene.add(mesh);

	activeEffects.push({
		mesh,
		origin: { x: origin.x, z: origin.z },
		kind: ATTACK_EFFECT_KINDS.lightColumn,
		createdAt: performance.now(),
		duration: SUMMON_EFFECT_DURATION,
		isLightColumn: true,
		_scene: targetScene,
	});

	spawnParticleBurst(
		{ x: origin.x, y: 1.0, z: origin.z },
		{
			color,
			emissive,
			count: style.burstCount ?? TELEPIPE_CAST_BURST_COUNT,
			spread: style.burstSpread ?? TELEPIPE_CAST_BURST_SPREAD,
			duration: SUMMON_EFFECT_DURATION,
		},
	);
}

// Chrono Trigger palette — amber temporal charge-reset with cyan glow (cards.js #f59e0b).
export const CHRONO_TRIGGER_COLOR = 0xf59e0b;
export const CHRONO_TRIGGER_EMISSIVE = 0x67e8f9;
const CHRONO_TRIGGER_COLUMN_HEIGHT = 1.4;
const CHRONO_TRIGGER_COLUMN_OPACITY = 0.72;
const CHRONO_TRIGGER_COLUMN_BASE_Y = 0.1;
const CHRONO_TRIGGER_EMISSIVE_INTENSITY = 1.5;
const CHRONO_TRIGGER_DEFAULT_RADIUS = 2;
const CHRONO_TRIGGER_WAVE_COUNT = 2;
const CHRONO_TRIGGER_WAVE_STAGGER_MS = 80; // faster cadence than purifying heal waves
const CHRONO_TRIGGER_TICK_MS = 55; // clock-tick emissive pulse period

/**
 * One staggered cyan/amber time-ripple ground ring for Chrono Trigger. Pass
 * `style.wave` (0-based) to offset this ring's start via `createdAt` so waves
 * expand in sequence without setTimeout.
 * @param {object} origin - { x, z }
 * @param {number} radius
 * @param {object} [style] - optional { color, emissive, duration, wave, waveCount, staggerMs }
 */
export function spawnChronoTriggerRipple(origin, radius, style = {}) {
	const color = style.color ?? CHRONO_TRIGGER_COLOR;
	const emissive = style.emissive ?? CHRONO_TRIGGER_EMISSIVE;
	const duration = style.duration ?? SUMMON_EFFECT_DURATION;
	const r = radius ?? CHRONO_TRIGGER_DEFAULT_RADIUS;
	const wave = style.wave ?? 0;
	const waveCount = style.waveCount ?? CHRONO_TRIGGER_WAVE_COUNT;
	const staggerMs = style.staggerMs ?? CHRONO_TRIGGER_WAVE_STAGGER_MS;
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (!targetScene) return;

	const geometry = new THREE.RingGeometry(0.1, 0.5, 32);
	const material = new THREE.MeshStandardMaterial({
		color,
		emissive,
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
	targetScene.add(mesh);

	activeEffects.push({
		mesh,
		origin: { x: origin.x, z: origin.z },
		radius: r,
		kind: ATTACK_EFFECT_KINDS.chronoTriggerRipple,
		createdAt: performance.now() + wave * staggerMs,
		duration,
		isChronoTriggerRipple: true,
		wave,
		waveCount,
		_scene: targetScene,
	});
}

/**
 * Brief temporal column/wisp rising from the cast origin. Rises and fades via the
 * `isChronoTriggerColumn` branch in updateAttackEffects (no per-frame allocation).
 * @param {object} origin - { x, z }
 * @param {object} [style] - optional { color, emissive, duration }
 */
export function spawnChronoTriggerColumn(origin, style = {}) {
	const color = style.color ?? CHRONO_TRIGGER_COLOR;
	const emissive = style.emissive ?? CHRONO_TRIGGER_EMISSIVE;
	const duration = style.duration ?? SUMMON_EFFECT_DURATION;
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (!targetScene) return;

	const geometry = new THREE.CylinderGeometry(0.18, 0.42, CHRONO_TRIGGER_COLUMN_HEIGHT, 16, 1, true);
	const material = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: CHRONO_TRIGGER_EMISSIVE_INTENSITY,
		transparent: true,
		opacity: CHRONO_TRIGGER_COLUMN_OPACITY,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.scale.y = 0.001;
	mesh.position.set(origin.x, CHRONO_TRIGGER_COLUMN_BASE_Y, origin.z);
	targetScene.add(mesh);

	activeEffects.push({
		mesh,
		origin: { x: origin.x, z: origin.z },
		kind: ATTACK_EFFECT_KINDS.chronoTriggerColumn,
		createdAt: performance.now(),
		duration,
		isChronoTriggerColumn: true,
		_baseEmissiveIntensity: CHRONO_TRIGGER_EMISSIVE_INTENSITY,
		_scene: targetScene,
	});
}

/**
 * Chrono Trigger: dual-phase staggered time ripples plus a brief ascending temporal
 * column. Pure additive VFX; no network traffic or state beyond activeEffects.
 * @param {object} origin - { x, z }
 * @param {number} [radius]
 * @param {object} [style] - optional { color, emissive, duration }
 */
export function spawnChronoTriggerEffect(origin, radius, style = {}) {
	const r = radius ?? CHRONO_TRIGGER_DEFAULT_RADIUS;
	const duration = style.duration ?? SUMMON_EFFECT_DURATION;
	const rippleStyle = { ...style, duration };
	for (let wave = 0; wave < CHRONO_TRIGGER_WAVE_COUNT; wave += 1) {
		spawnChronoTriggerRipple(origin, r, {
			...rippleStyle,
			wave,
			waveCount: CHRONO_TRIGGER_WAVE_COUNT,
		});
	}
	spawnChronoTriggerColumn(origin, { ...style, duration });
}

const PURIFYING_HEAL_COLOR = 0x6ee7b7;
const PURIFYING_HEAL_EMISSIVE = 0x34d399;
const PURIFYING_HEAL_WAVE_COUNT = 3; // concentric heal waves emitted per cast
const PURIFYING_HEAL_WAVE_STAGGER_MS = 130; // fixed offset between successive waves
const CLEANSE_BURST_COLOR = 0xffffff;
const CLEANSE_BURST_EMISSIVE = 0x5eead4;
const CLEANSE_BURST_SPARK_COUNT = 10;
const CLEANSE_BURST_SPARK_SPREAD = 1.2;
const CLEANSE_BURST_SPARK_DURATION = 450;
const CLEANSE_RISE_COLOR = 0xffffff; // white core of the purifying rise
const CLEANSE_RISE_EMISSIVE = 0x6ee7b7; // mint glow (white→mint, never gold)
const CLEANSE_RISE_OPACITY = 0.6;

/**
 * One mint-green expanding heal ring for Purifying Pulse (distinct from Divine
 * Grace gold). Rides the shared radius-AoE expand→fade lifecycle in
 * updateAttackEffects. Pass `options.wave` (0-based) to stagger this ring after
 * earlier waves: the delay is baked into the effect's `createdAt` so the wave
 * sequence plays out without any `setTimeout` or extra animation loop, and each
 * wave still expands out to the full `radius`.
 * @param {object} origin - { x, z }
 * @param {number} radius
 * @param {object} [options] - { wave, waveCount, staggerMs }
 */
export function spawnPurifyingPulseHealRing(origin, radius, options = {}) {
	const wave = options.wave ?? 0;
	const staggerMs = options.staggerMs ?? PURIFYING_HEAL_WAVE_STAGGER_MS;
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
		kind: ATTACK_EFFECT_KINDS.expandFadeRing,
		// Push later waves' start into the future. The expand-fade ring updater holds
		// the ring at ~zero scale until its createdAt arrives, so waves expand in
		// sequence (a visible outward pulse) with no timer and a bounded lifetime.
		createdAt: performance.now() + wave * staggerMs,
		duration: SUMMON_EFFECT_DURATION,
	});
}

/**
 * Upward white→mint "purifying rise" for Purifying Pulse: an ascending cleanse
 * column (corruption lifted away) plus a few white/teal sparkle motes lifting
 * off it. The column rides the shared `isLightColumn` lifecycle (same shaft
 * primitive Sanctum Pulse and the telepipe use) but in the purifying mint/white
 * palette — never gold. Distinct from, and separate from, the flat ground rings.
 * @param {object} origin - { x, z }
 */
export function spawnCleanseBurstEffect(origin) {
	if (!origin) return;
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	// Ascending cleanse column. Geometry height matches the shared column height
	// so updateAttackEffects' base-pinning keeps the shaft rooted as it grows.
	const columnGeo = new THREE.CylinderGeometry(0.18, 0.4, DIVINE_GRACE_COLUMN_HEIGHT, 16, 1, true);
	const columnMat = new THREE.MeshStandardMaterial({
		color: CLEANSE_RISE_COLOR,
		emissive: CLEANSE_RISE_EMISSIVE,
		emissiveIntensity: 1.3,
		transparent: true,
		opacity: CLEANSE_RISE_OPACITY,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const columnMesh = new THREE.Mesh(columnGeo, columnMat);
	columnMesh.scale.y = 0.001;
	columnMesh.position.set(origin.x, DIVINE_GRACE_COLUMN_BASE_Y, origin.z);
	if (targetScene) targetScene.add(columnMesh);
	activeEffects.push({
		mesh: columnMesh,
		origin: { x: origin.x, z: origin.z },
		kind: ATTACK_EFFECT_KINDS.lightColumn,
		createdAt: performance.now(),
		duration: SUMMON_EFFECT_DURATION,
		isLightColumn: true,
		_scene: targetScene,
	});

	// White/teal sparkle motes rising with the column.
	spawnHitSpark(
		{ x: origin.x, y: 0.5, z: origin.z },
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
 * Purifying Pulse: staggered concentric mint heal waves that pulse outward to
 * `radius` plus an upward white→mint cleanse rise.
 * @param {object} origin - { x, z }
 * @param {number} radius
 */
export function spawnPurifyingPulseEffect(origin, radius) {
	for (let wave = 0; wave < PURIFYING_HEAL_WAVE_COUNT; wave += 1) {
		spawnPurifyingPulseHealRing(origin, radius, { wave, waveCount: PURIFYING_HEAL_WAVE_COUNT });
	}
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
		_scene: targetScene,
		origin: { x: origin.x, z: origin.z },
		direction: { x: direction.x, z: direction.z },
		range,
		coneAngle,
		kind: ATTACK_EFFECT_KINDS.fireTrail,
		isFireTrail: true,
		createdAt: performance.now(),
		duration: dotTicks * dotIntervalMs,
	});
}

const THERMAL_COLUMN_COLOR = 0xef4444;
const THERMAL_COLUMN_EMISSIVE = 0xdc2626;
const THERMAL_COLUMN_HEIGHT = 4.5;
const THERMAL_COLUMN_OPACITY = 0.75;
const THERMAL_COLUMN_BASE_Y = 0.1;
const THERMAL_COLUMN_DEFAULT_DOT_TICKS = 4;
const THERMAL_COLUMN_DEFAULT_DOT_INTERVAL_MS = 500;
const THERMAL_COLUMN_EMISSIVE_INTENSITY = 1.4;

export const WYRMFLARE_BREATH_COLOR = 0xfb923c;
export const WYRMFLARE_BREATH_EMISSIVE = 0xff3b00;
const WYRMFLARE_BREATH_OPACITY = 0.72;
const WYRMFLARE_BREATH_EMISSIVE_INTENSITY = 1.5;
const WYRMFLARE_BREATH_LIFT_Y = 0.55;

export const GRAVITY_WELL_VFX_COLOR = 0xc084fc;
export const GRAVITY_WELL_VFX_EMISSIVE = 0xa855f7;
export const GRAVITY_WELL_VOID_CORE = 0x581c87;
const GRAVITY_WELL_VOID_CORE_RADIUS = 0.32;
const GRAVITY_WELL_PULL_RING_MIN_SCALE = 0.3;
const GRAVITY_WELL_VOID_EMISSIVE_INTENSITY = 1.65;
const GRAVITY_WELL_INFLOW_PARTICLE_COUNT = 10;

function thermalColumnDuration(style = {}) {
	if (style.duration !== undefined) return style.duration;
	const dotTicks = style.dotTicks ?? THERMAL_COLUMN_DEFAULT_DOT_TICKS;
	const dotIntervalMs = style.dotIntervalMs ?? THERMAL_COLUMN_DEFAULT_DOT_INTERVAL_MS;
	return dotTicks * dotIntervalMs + 250;
}

/**
 * Expanding ground scorch ring for Thermal Column (attack-range AoE footprint).
 * @param {object} origin - { x, z }
 * @param {number} radius
 * @param {object} style
 */
function spawnThermalColumnScorchRing(origin, radius, style = {}) {
	const color = style.color ?? THERMAL_COLUMN_COLOR;
	const emissive = style.emissive ?? THERMAL_COLUMN_EMISSIVE;
	const duration = thermalColumnDuration(style);

	const geometry = new THREE.RingGeometry(0.1, 0.5, 48);
	const material = new THREE.MeshStandardMaterial({
		color,
		emissive,
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
		kind: ATTACK_EFFECT_KINDS.expandFadeRing,
		createdAt: performance.now(),
		duration,
		_scene: targetScene,
	});
}

// Spike Trap palette: a hostile steel-spike hazard, coherent with the card's red
// accent (#f87171) yet clearly distinct from cinder_snare's fiery inferno burst —
// brushed-steel spikes lit by a blood-red emissive glow rather than orange fire.
// Spike-trap palette — shared between the eruption VFX here and the persistent
// hazard mesh builder (createSpikeTrapHazardMesh) in ./renderer/minionSync.js, so
// these are exported rather than moved.
export const SPIKE_TRAP_SPIKE_COLOR = 0x9ca3af; // brushed steel grey
export const SPIKE_TRAP_EMISSIVE = 0xdc2626; // blood-red hazard glow on the iron
export const SPIKE_TRAP_RING_COLOR = 0xb91c1c; // dark blood-red hazard ring
export const SPIKE_TRAP_RING_EMISSIVE = 0xef4444; // red ring glow
export const SPIKE_TRAP_SPIKE_COUNT = 6; // spikes erupting in a ring around the trap
export const SPIKE_TRAP_SPIKE_HEIGHT = 0.75; // height of each iron spike
export const SPIKE_TRAP_SPIKE_RADIUS = 0.13; // base radius of each cone spike

// Glacier Rupture palette — fixed icy cyan for the shatter/collapse primitive.
export const GLACIER_RUPTURE_COLOR = 0x38bdf8;
export const GLACIER_RUPTURE_EMISSIVE = 0x0ea5e9;
export const GLACIER_RUPTURE_SHARD_HEIGHT = 0.85;
export const GLACIER_RUPTURE_SHARD_RADIUS = 0.11;
export const GLACIER_RUPTURE_SHARD_COUNT = 6;

/**
 * Spawn the erupting-spikes VFX for a Spike Trap: a cluster of vertical
 * iron/steel cones bursting up out of the ground inside a blood-red hazard ring.
 * Modeled on spawnInfernoPillarEffect's ring lifecycle, but the upward elements
 * are vertical spike geometry (apex-up ConeGeometry) instead of a fire column, and
 * the palette is hostile steel + blood-red rather than orange fire. Pure additive
 * VFX: no network traffic, no state beyond activeEffects.
 * @param {object} origin - { x, z }
 * @param {number} radius
 */
export function spawnSpikeTrapEffect(origin, radius) {
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;

	// Ground hazard ring — rides the shared radius-based expand→fade lifecycle in
	// updateAttackEffects, exactly like spawnInfernoPillarEffect's ring.
	const ringGeometry = new THREE.RingGeometry(0.1, 0.5, 48);
	const ringMaterial = new THREE.MeshStandardMaterial({
		color: SPIKE_TRAP_RING_COLOR,
		emissive: SPIKE_TRAP_RING_EMISSIVE,
		emissiveIntensity: 1.2,
		transparent: true,
		opacity: 1.0,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const ring = new THREE.Mesh(ringGeometry, ringMaterial);
	ring.position.set(origin.x, 0.15, origin.z);
	ring.rotation.x = -Math.PI / 2;
	ring.scale.setScalar(0.001);
	if (targetScene) targetScene.add(ring);

	activeEffects.push({
		mesh: ring,
		origin: { x: origin.x, z: origin.z },
		radius,
		kind: ATTACK_EFFECT_KINDS.spikeTrapRing,
		spikeTrapRing: true,
		createdAt: performance.now(),
		duration: SUMMON_EFFECT_DURATION,
		_scene: targetScene,
	});

	// Erupting spikes — vertical apex-up cones clustered around the trap point,
	// within `radius`. Each starts flattened (scale.y ≈ 0) so the dedicated
	// isSpikeTrapSpike branch in updateAttackEffects lifts/scales it out of the
	// ground while the base stays pinned to the floor.
	const spikeOffset = radius * 0.55; // how far out the spikes erupt from center
	for (let s = 0; s < SPIKE_TRAP_SPIKE_COUNT; s++) {
		const angle = (s / SPIKE_TRAP_SPIKE_COUNT) * Math.PI * 2;
		const geometry = new THREE.ConeGeometry(SPIKE_TRAP_SPIKE_RADIUS, SPIKE_TRAP_SPIKE_HEIGHT, 6);
		const material = new THREE.MeshStandardMaterial({
			color: SPIKE_TRAP_SPIKE_COLOR,
			emissive: SPIKE_TRAP_EMISSIVE,
			emissiveIntensity: 0.9,
			transparent: true,
			opacity: 1.0,
		});
		const spike = new THREE.Mesh(geometry, material);
		// ConeGeometry's apex already points up (+Y); rotation.x = 0 keeps it
		// standing vertically out of the ground rather than lying flat.
		spike.rotation.x = 0;
		const sx = origin.x + Math.cos(angle) * spikeOffset;
		const sz = origin.z + Math.sin(angle) * spikeOffset;
		spike.position.set(sx, 0, sz);
		spike.scale.y = 0.001;
		if (targetScene) targetScene.add(spike);

		activeEffects.push({
			mesh: spike,
			origin: { x: sx, z: sz },
			kind: ATTACK_EFFECT_KINDS.spikeTrapSpike,
			createdAt: performance.now(),
			duration: SUMMON_EFFECT_DURATION,
			isSpikeTrapSpike: true,
			spikeHeight: SPIKE_TRAP_SPIKE_HEIGHT,
			_scene: targetScene,
		});
	}
}

/**
 * Expanding ground ice-fracture ring for Glacier Rupture. Segmented thin ring
 * geometry reads as cracking ice (distinct from spawnSummonEffect / telegraph).
 * @param {object} origin - { x, z }
 * @param {number} radius
 * @param {object} [style]
 */
export function spawnGlacierRuptureRing(origin, radius, style = {}) {
	const color = style.color ?? GLACIER_RUPTURE_COLOR;
	const emissive = style.emissive ?? GLACIER_RUPTURE_EMISSIVE;
	const duration = style.duration ?? SUMMON_EFFECT_DURATION;
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;

	// Eight theta segments + a thin band evoke a shattering ice fracture ring.
	const geometry = new THREE.RingGeometry(0.18, 0.46, 32, 8);
	const material = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: 1.15,
		transparent: true,
		opacity: 1.0,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const ring = new THREE.Mesh(geometry, material);
	ring.position.set(origin.x, 0.14, origin.z);
	ring.rotation.x = -Math.PI / 2;
	ring.scale.setScalar(0.001);
	if (targetScene) targetScene.add(ring);

	activeEffects.push({
		mesh: ring,
		origin: { x: origin.x, z: origin.z },
		radius,
		kind: ATTACK_EFFECT_KINDS.glacierRuptureRing,
		createdAt: performance.now(),
		duration,
		isGlacierRuptureRing: true,
		_scene: targetScene,
	});
}

/**
 * Upward/outward ice-shard burst for Glacier Rupture. A single group of tapered
 * cones rises and scatters from the rupture point.
 * @param {object} origin - { x, z }
 * @param {number} radius
 * @param {object} [style]
 */
export function spawnGlacierRuptureShards(origin, radius, style = {}) {
	const color = style.color ?? GLACIER_RUPTURE_COLOR;
	const emissive = style.emissive ?? GLACIER_RUPTURE_EMISSIVE;
	const duration = style.duration ?? SUMMON_EFFECT_DURATION;
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;

	const group = new THREE.Group();
	group.position.set(origin.x, 0, origin.z);
	const innerOffset = radius * 0.18;

	for (let s = 0; s < GLACIER_RUPTURE_SHARD_COUNT; s += 1) {
		const angle = (s / GLACIER_RUPTURE_SHARD_COUNT) * Math.PI * 2;
		const geometry = new THREE.ConeGeometry(
			GLACIER_RUPTURE_SHARD_RADIUS,
			GLACIER_RUPTURE_SHARD_HEIGHT,
			5,
		);
		const material = new THREE.MeshStandardMaterial({
			color,
			emissive,
			emissiveIntensity: 1.0,
			transparent: true,
			opacity: 1.0,
		});
		const shard = new THREE.Mesh(geometry, material);
		const baseX = Math.cos(angle) * innerOffset;
		const baseZ = Math.sin(angle) * innerOffset;
		shard.userData.scatterDir = { x: Math.cos(angle), z: Math.sin(angle) };
		shard.userData.baseX = baseX;
		shard.userData.baseZ = baseZ;
		shard.userData.shardHeight = GLACIER_RUPTURE_SHARD_HEIGHT;
		shard.position.set(baseX, 0, baseZ);
		shard.scale.y = 0.001;
		group.add(shard);
	}

	if (targetScene) targetScene.add(group);

	activeEffects.push({
		mesh: group,
		origin: { x: origin.x, z: origin.z },
		radius,
		kind: ATTACK_EFFECT_KINDS.glacierRuptureShards,
		createdAt: performance.now(),
		duration,
		isGlacierRuptureShards: true,
		_scene: targetScene,
	});
}

/**
 * Glacier Rupture shatter VFX: expanding ice-fracture ground ring plus a brief
 * upward/outward ice-shard burst. Composes ring + shard group primitives.
 * @param {object} origin - { x, z }
 * @param {number} radius
 * @param {object} [style]
 */
export function spawnGlacierRuptureEffect(origin, radius, style = {}) {
	spawnGlacierRuptureRing(origin, radius, style);
	spawnGlacierRuptureShards(origin, radius, style);
}

// Solar Edge impact palette — radiant gold-white core with orange corona.
export const SOLAR_EDGE_CORE_COLOR = 0xfef08a;
export const SOLAR_EDGE_CORE_EMISSIVE = 0xfbbf24;
export const SOLAR_EDGE_CORONA_COLOR = 0xff7a18;
export const SOLAR_EDGE_CORONA_EMISSIVE = 0xff3b00;
const SOLAR_EDGE_DEFAULT_RING_RADIUS = 2.0;
const SOLAR_EDGE_EMBER_COUNT = 12;
const SOLAR_EDGE_EMBER_SPREAD = 1.15;

function pointAlongXZ(origin, direction, distance) {
	const len = Math.hypot(direction.x, direction.z) || 1;
	return {
		x: origin.x + (direction.x / len) * distance,
		z: origin.z + (direction.z / len) * distance,
	};
}

/**
 * Solar Edge strike flourish: gold-white solar disc burst, expanding orange
 * corona ring, and a short scatter of solar embers at the blade impact point.
 * Pure additive VFX; no network traffic or state beyond activeEffects.
 * @param {object} origin - { x, z }
 * @param {object} direction - { x, z }
 * @param {object} [style]
 */
export function spawnSolarEdgeImpactFlourish(origin, direction, style = {}) {
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (!targetScene) return;

	const dir = direction || { x: 1, z: 0 };
	const range = style.range ?? ATTACK_RANGE;
	const impact = pointAlongXZ(origin, dir, range);
	const duration = style.duration ?? ATTACK_EFFECT_DURATION;
	const ringRadius = style.ringRadius ?? SOLAR_EDGE_DEFAULT_RING_RADIUS;
	const coreColor = style.color ?? SOLAR_EDGE_CORE_COLOR;
	const coreEmissive = style.emissive ?? SOLAR_EDGE_CORE_EMISSIVE;
	const coronaColor = style.coronaColor ?? SOLAR_EDGE_CORONA_COLOR;
	const coronaEmissive = style.coronaEmissive ?? SOLAR_EDGE_CORONA_EMISSIVE;
	const emberCount = style.count ?? SOLAR_EDGE_EMBER_COUNT;

	const group = new THREE.Group();
	group.position.set(impact.x, 0, impact.z);

	const discGeometry = new THREE.CircleGeometry(0.42, 28);
	const discMaterial = new THREE.MeshStandardMaterial({
		color: coreColor,
		emissive: coreEmissive,
		emissiveIntensity: 1.5,
		transparent: true,
		opacity: 1.0,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const discMesh = new THREE.Mesh(discGeometry, discMaterial);
	discMesh.position.y = GROUND_OVERLAY_Y + 0.1;
	discMesh.rotation.x = -Math.PI / 2;
	discMesh.scale.setScalar(0.001);
	discMesh.userData.isSolarEdgeDisc = true;
	group.add(discMesh);

	const coronaGeometry = new THREE.RingGeometry(0.18, 0.36, 40);
	const coronaMaterial = new THREE.MeshStandardMaterial({
		color: coronaColor,
		emissive: coronaEmissive,
		emissiveIntensity: 1.35,
		transparent: true,
		opacity: 1.0,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const coronaMesh = new THREE.Mesh(coronaGeometry, coronaMaterial);
	coronaMesh.position.y = GROUND_OVERLAY_Y + 0.08;
	coronaMesh.rotation.x = -Math.PI / 2;
	coronaMesh.scale.setScalar(0.001);
	coronaMesh.userData.isSolarEdgeCorona = true;
	group.add(coronaMesh);

	for (let i = 0; i < emberCount; i += 1) {
		const geometry = new THREE.IcosahedronGeometry
			? new THREE.IcosahedronGeometry(0.07, 0)
			: new THREE.SphereGeometry(0.07, 6, 6);
		const material = new THREE.MeshStandardMaterial({
			color: coreColor,
			emissive: coronaEmissive,
			emissiveIntensity: 1.4,
			transparent: true,
			opacity: 1.0,
		});
		const ember = new THREE.Mesh(geometry, material);
		const angle = (i / emberCount) * Math.PI * 2 + Math.random() * 0.4;
		const elevation = 0.25 + Math.random() * 0.55;
		const speed = SOLAR_EDGE_EMBER_SPREAD * (0.45 + Math.random() * 0.55);
		ember.userData.isSolarEdgeEmber = true;
		ember.userData.velocity = {
			x: Math.cos(angle) * speed,
			y: elevation * speed,
			z: Math.sin(angle) * speed,
		};
		ember.position.y = GROUND_OVERLAY_Y + 0.12;
		group.add(ember);
	}

	targetScene.add(group);

	activeEffects.push({
		mesh: group,
		_scene: targetScene,
		origin: { x: impact.x, z: impact.z },
		ringRadius,
		kind: ATTACK_EFFECT_KINDS.solarEdgeImpact,
		createdAt: performance.now(),
		duration,
		isSolarEdgeImpact: true,
	});
}

// ── Mana Prism: signature refracting-crystal cast VFX ──
// A rising, spinning octahedral prism core that throws rainbow dispersion
// shards outward across the violet→cyan refraction range so the cast reads as
// light refraction, not a generic summon ring. Bounded one-shot: the whole
// group tears down through disposeEffectObject when the lifetime ends, so no
// geometry/material leaks. Animated by the `isManaPrismEffect` branch in
// updateAttackEffects (no per-frame allocation).
export const MANA_PRISM_VFX_COLOR = 0xa855f7;
export const MANA_PRISM_VFX_EMISSIVE = 0x22d3ee;
export const MANA_PRISM_EFFECT_DURATION = 1000;
export const MANA_PRISM_SHARD_COUNT = 7;
const MANA_PRISM_CORE_BASE_Y = 0.5;
const MANA_PRISM_CORE_RISE = 1.1; // how high the crystal core floats
const MANA_PRISM_SHARD_SPREAD = 1.6; // how far refracted shards radiate

/**
 * Spawn the Mana Prism refracting-crystal cast VFX: a bipyramidal (octahedral)
 * crystal core that rises and spins while N elongated light shards — each tinted
 * at a different point along the violet→cyan dispersion — radiate outward. Pure
 * additive VFX: no network traffic, no state beyond activeEffects.
 * @param {object} origin - { x, z }
 * @param {object} [style] - { color, emissive, duration }
 */
export function spawnManaPrismEffect(origin, style = {}) {
	const color = style.color ?? MANA_PRISM_VFX_COLOR;
	const emissive = style.emissive ?? MANA_PRISM_VFX_EMISSIVE;
	const duration = style.duration ?? MANA_PRISM_EFFECT_DURATION;
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;

	const group = new THREE.Group();
	group.position.set(origin.x, 0, origin.z);

	// Bipyramidal crystal core — an octahedron reads as a cut prism, distinct
	// from the flat summon ring. Starts collapsed; the update branch scales it up.
	const coreGeometry = new THREE.OctahedronGeometry(0.42, 0);
	const coreMaterial = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: 1.3,
		transparent: true,
		opacity: 1.0,
		flatShading: true,
	});
	const core = new THREE.Mesh(coreGeometry, coreMaterial);
	core.position.y = MANA_PRISM_CORE_BASE_Y;
	core.scale.setScalar(0.001);
	core.userData.isPrismCore = true;
	group.add(core);

	// Refracted light shards — thin elongated crystals radiating outward, each
	// tinted at a different point along the violet→cyan dispersion so the burst
	// reads as multi-colored light rather than a single flat tint.
	const violet = new THREE.Color(color);
	const cyan = new THREE.Color(emissive);
	for (let s = 0; s < MANA_PRISM_SHARD_COUNT; s += 1) {
		const angle = (s / MANA_PRISM_SHARD_COUNT) * Math.PI * 2;
		const hueT = MANA_PRISM_SHARD_COUNT > 1 ? s / (MANA_PRISM_SHARD_COUNT - 1) : 0;
		const shardColor = violet.clone().lerp(cyan, hueT);
		const shardEmissive = cyan.clone().lerp(violet, hueT);
		const geometry = new THREE.OctahedronGeometry(0.12, 0);
		const material = new THREE.MeshStandardMaterial({
			color: shardColor,
			emissive: shardEmissive,
			emissiveIntensity: 1.1,
			transparent: true,
			opacity: 1.0,
			flatShading: true,
		});
		const shard = new THREE.Mesh(geometry, material);
		shard.scale.set(0.5, 2.4, 0.5); // elongate the octahedron into a light shard
		shard.userData.scatterDir = { x: Math.cos(angle), z: Math.sin(angle) };
		shard.userData.angle = angle;
		shard.position.set(0, MANA_PRISM_CORE_BASE_Y, 0);
		group.add(shard);
	}

	if (targetScene) targetScene.add(group);

	activeEffects.push({
		mesh: group,
		origin: { x: origin.x, z: origin.z },
		kind: ATTACK_EFFECT_KINDS.manaPrismEffect,
		createdAt: performance.now(),
		duration,
		isManaPrismEffect: true,
		_scene: targetScene,
	});
}

// createSpikeTrapHazardMesh() now lives in ./renderer/minionSync.js (re-exported
// above); the SPIKE_TRAP_* palette it reuses stays exported from here.

/**
 * Vertical rising fire shaft for Thermal Column. Rises and fades via the
 * `isThermalColumn` branch in updateAttackEffects (no per-frame allocation).
 * @param {object} origin - { x, z }
 * @param {object} style
 */
export function spawnThermalColumnShaft(origin, style = {}) {
	const color = style.color ?? THERMAL_COLUMN_COLOR;
	const emissive = style.emissive ?? THERMAL_COLUMN_EMISSIVE;
	const duration = thermalColumnDuration(style);

	const geometry = new THREE.CylinderGeometry(0.3, 0.55, THERMAL_COLUMN_HEIGHT, 16, 1, true);
	const material = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: THERMAL_COLUMN_EMISSIVE_INTENSITY,
		transparent: true,
		opacity: THERMAL_COLUMN_OPACITY,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.scale.y = 0.001;
	mesh.position.set(origin.x, THERMAL_COLUMN_BASE_Y, origin.z);
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (targetScene) targetScene.add(mesh);

	activeEffects.push({
		mesh,
		origin: { x: origin.x, z: origin.z },
		kind: ATTACK_EFFECT_KINDS.thermalColumn,
		createdAt: performance.now(),
		duration,
		isThermalColumn: true,
		_baseEmissiveIntensity: THERMAL_COLUMN_EMISSIVE_INTENSITY,
		_scene: targetScene,
	});
}

/**
 * Thermal Column: a rising vertical fire shaft plus an expanding ground scorch
 * ring scaled to attack range (Inferno Pillar / evolved Dragons Breath).
 * @param {object} origin - { x, z }
 * @param {number} radius
 * @param {object} [style]
 */
export function spawnInfernoPillarEffect(origin, radius, style = {}) {
	spawnThermalColumnScorchRing(origin, radius, style);
	spawnThermalColumnShaft(origin, style);
}

function spawnDragonsBreathScorchFan(origin, direction, range, coneAngle, style) {
	const dirAngle = Math.atan2(direction.z, direction.x);
	const thetaStart = dirAngle - coneAngle / 2;
	const geometry = new THREE.CircleGeometry(0.5, 32, thetaStart, coneAngle);
	const material = new THREE.MeshStandardMaterial({
		color: style.color,
		emissive: style.emissive,
		emissiveIntensity: 1.2,
		transparent: true,
		opacity: 1.0,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.position.set(origin.x, 0.12, origin.z);
	mesh.rotation.x = -Math.PI / 2;
	mesh.scale.setScalar(0.001);
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (targetScene) targetScene.add(mesh);

	activeEffects.push({
		mesh,
		origin: { x: origin.x, z: origin.z },
		radius: range,
		coneAngle,
		kind: ATTACK_EFFECT_KINDS.dragonsBreathScorch,
		isDragonsBreathScorch: true,
		createdAt: performance.now(),
		duration: style.duration,
		_scene: targetScene,
	});
}

function spawnDragonsBreathConeSector(origin, direction, range, coneAngle, style) {
	const baseRadius = range * Math.tan(coneAngle / 2);
	const geometry = new THREE.CylinderGeometry(
		0.02,
		baseRadius,
		range,
		24,
		1,
		true,
		Math.PI / 2 - coneAngle / 2,
		coneAngle,
	);
	const material = new THREE.MeshStandardMaterial({
		color: style.color,
		emissive: style.emissive,
		emissiveIntensity: WYRMFLARE_BREATH_EMISSIVE_INTENSITY,
		transparent: true,
		opacity: WYRMFLARE_BREATH_OPACITY,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geometry, material);
	const dirAngle = Math.atan2(direction.x, direction.z);
	mesh.rotation.order = 'YXZ';
	mesh.rotation.y = dirAngle;
	mesh.rotation.z = -Math.PI / 2;
	mesh.scale.setScalar(0.001);
	mesh.position.set(
		origin.x + direction.x * range / 2,
		WYRMFLARE_BREATH_LIFT_Y,
		origin.z + direction.z * range / 2,
	);
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (targetScene) targetScene.add(mesh);

	activeEffects.push({
		mesh,
		origin: { x: origin.x, z: origin.z },
		direction: { x: direction.x, z: direction.z },
		range,
		coneAngle,
		kind: ATTACK_EFFECT_KINDS.dragonsBreathCone,
		createdAt: performance.now(),
		duration: style.duration,
		isDragonsBreathCone: true,
		_baseEmissiveIntensity: WYRMFLARE_BREATH_EMISSIVE_INTENSITY,
		_scene: targetScene,
	});
}

/**
 * Wyrmflare lingering breath cone: a forward fire sector plus ground scorch fan
 * scaled to attack range, lasting through the server's DoT window.
 * @param {object} origin - { x, z }
 * @param {object} direction - { x, z }
 * @param {object} [style]
 */
export function spawnDragonsBreathEffect(origin, direction, style = {}) {
	const dir = direction || { x: 1, z: 0 };
	const dirLen = Math.hypot(dir.x, dir.z) || 1;
	const nx = dir.x / dirLen;
	const nz = dir.z / dirLen;
	const range = style.range ?? 7;
	const coneAngle = style.coneAngle ?? Math.PI / 3;
	const color = style.color ?? WYRMFLARE_BREATH_COLOR;
	const emissive = style.emissive ?? WYRMFLARE_BREATH_EMISSIVE;
	const duration = thermalColumnDuration(style);
	const palette = { color, emissive, duration };

	spawnDragonsBreathScorchFan(origin, { x: nx, z: nz }, range, coneAngle, palette);
	spawnDragonsBreathConeSector(origin, { x: nx, z: nz }, range, coneAngle, palette);
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
		kind: ATTACK_EFFECT_KINDS.expandFadeRing,
		volatileBurst: true,
		createdAt: performance.now(),
		duration: SUMMON_EFFECT_DURATION,
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
			kind: ATTACK_EFFECT_KINDS.hitSpark,
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
		kind: ATTACK_EFFECT_KINDS.lightningArc,
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

const MIRROR_WARD_COLOR = 0x5eead4;
const MIRROR_WARD_EMISSIVE = 0x2dd4bf;
const MIRROR_WARD_SILVER = 0xe2e8f0;
const mirrorWardShellsByPlayer = new Map();

const EVENT_HORIZON_CORE_COLOR = 0x1a0a2e;
const EVENT_HORIZON_RING_COLOR = 0x581c87;
const EVENT_HORIZON_EMISSIVE = 0x7c3aed;
const EVENT_HORIZON_EFFECT_DURATION = SUMMON_EFFECT_DURATION;
const EVENT_HORIZON_PARTICLE_COUNT = 12;

/**
 * Immediately dispose a tracked Mirror Ward shell for `playerId`.
 * @param {string} playerId
 */
export function dismissMirrorWardShellEffect(playerId) {
	if (!playerId) return;
	const fx = mirrorWardShellsByPlayer.get(playerId);
	if (!fx) return;

	const idx = activeEffects.indexOf(fx);
	if (idx !== -1) {
		disposeEffectObject(fx.mesh, fx._scene || scene);
		activeEffects.splice(idx, 1);
	} else {
		disposeEffectObject(fx.mesh, fx._scene || scene);
	}
	mirrorWardShellsByPlayer.delete(playerId);
}

/**
 * Mirror Ward protective shell: pulsing ground ring at `radius` plus vertical
 * mirror-like facets in the teal/silver palette.
 * @param {object} origin - { x, z }
 * @param {number} radius
 * @param {object} [style]
 */
export function spawnMirrorWardShellEffect(origin, radius, style = {}) {
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (!targetScene) return;

	if (style.playerId) {
		dismissMirrorWardShellEffect(style.playerId);
	}

	const r = radius ?? 1.5;
	const color = style.color ?? MIRROR_WARD_COLOR;
	const emissive = style.emissive ?? MIRROR_WARD_EMISSIVE;
	const duration = style.duration ?? SUMMON_EFFECT_DURATION;
	const group = new THREE.Group();
	group.position.set(origin.x, 0, origin.z);

	const ringGeometry = new THREE.RingGeometry(0.82, 1.0, 48);
	const ringMaterial = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: 1.1,
		transparent: true,
		opacity: 0.85,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
	ringMesh.position.y = GROUND_OVERLAY_Y;
	ringMesh.rotation.x = -Math.PI / 2;
	ringMesh.scale.setScalar(0.001);
	ringMesh.userData.isMirrorWardRing = true;
	group.add(ringMesh);

	const facetHeight = Math.min(r * 1.15, 2.6);
	const facetWidth = Math.min(r * 0.75, 1.6);
	const facetAngles = [Math.PI * 0.22, -Math.PI * 0.22];
	const facetPalette = [
		{ color, emissive },
		{ color: MIRROR_WARD_SILVER, emissive: MIRROR_WARD_SILVER },
	];
	for (let i = 0; i < facetAngles.length; i += 1) {
		const palette = facetPalette[i];
		const facetGeometry = new THREE.PlaneGeometry(facetWidth, facetHeight);
		const facetMaterial = new THREE.MeshStandardMaterial({
			color: palette.color,
			emissive: palette.emissive,
			emissiveIntensity: 1.25,
			transparent: true,
			opacity: 0.62,
			side: THREE.DoubleSide,
			depthWrite: false,
		});
		const facetMesh = new THREE.Mesh(facetGeometry, facetMaterial);
		facetMesh.position.y = facetHeight * 0.5;
		facetMesh.rotation.y = facetAngles[i];
		facetMesh.userData.isMirrorWardFacet = true;
		group.add(facetMesh);
	}

	targetScene.add(group);

	const effect = {
		mesh: group,
		_scene: targetScene,
		origin: { x: origin.x, z: origin.z },
		wardRadius: r,
		kind: ATTACK_EFFECT_KINDS.mirrorWardShell,
		isMirrorWardShell: true,
		playerId: style.playerId,
		createdAt: performance.now(),
		duration,
	};
	activeEffects.push(effect);
	if (style.playerId) {
		mirrorWardShellsByPlayer.set(style.playerId, effect);
	}
}

/**
 * Mirror Ward reflect impact: projectile streak, ground decal, and sparkle burst
 * along `direction` using the mirror palette.
 * @param {object} origin - { x, z }
 * @param {object} direction - { x, z }
 * @param {object} [style]
 */
export function spawnMirrorWardReflectBurst(origin, direction, style = {}) {
	const duration = style.duration ?? ATTACK_EFFECT_DURATION;
	const travelMs = style.travelMs ?? duration;
	const range = style.range ?? ATTACK_RANGE;
	const color = style.color ?? MIRROR_WARD_COLOR;
	const emissive = style.emissive ?? MIRROR_WARD_EMISSIVE;

	const dir = direction || { x: 1, z: 0 };
	const len = Math.hypot(dir.x, dir.z) || 1;
	const nx = dir.x / len;
	const nz = dir.z / len;
	const terminus = { x: origin.x + nx * range, z: origin.z + nz * range };

	const before = activeEffects.length;
	spawnProjectileTrail(
		{ x: origin.x, z: origin.z },
		{ x: nx, z: nz },
		{ range, travelMs, duration: travelMs, color, emissive, y: 0.9 },
	);
	spawnImpactDecal(terminus, {
		color,
		emissive,
		radius: style.impactRadius ?? 0.75,
		duration,
	});
	spawnParticleBurst(
		{ x: terminus.x, y: 0.55, z: terminus.z },
		{
			color: MIRROR_WARD_SILVER,
			emissive,
			count: style.count ?? 8,
			spread: style.spread ?? 1.1,
			duration,
		},
	);
	for (let i = before; i < activeEffects.length; i += 1) {
		activeEffects[i].isMirrorWardReflect = true;
	}
}

/**
 * Event Horizon singularity: near-black void core, violet accretion ring at
 * `centerRadius`, and an outer pull halo at `pullRadius` that contracts inward.
 * Edge particles spiral toward the core to reinforce the pull field.
 * @param {object} origin - { x, z }
 * @param {number} pullRadius
 * @param {number} centerRadius
 * @param {object} [style]
 */
export function spawnEventHorizonEffect(origin, pullRadius, centerRadius, style = {}) {
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (!targetScene) return;

	const pull = pullRadius ?? 12;
	const center = centerRadius ?? 2.5;
	const color = style.color ?? EVENT_HORIZON_RING_COLOR;
	const emissive = style.emissive ?? EVENT_HORIZON_EMISSIVE;
	const duration = style.duration ?? EVENT_HORIZON_EFFECT_DURATION;

	const group = new THREE.Group();
	group.position.set(origin.x, 0, origin.z);

	const coreRadius = Math.min(center * 0.45, 1.1);
	const coreGeometry = new THREE.SphereGeometry(coreRadius, 16, 12);
	const coreMaterial = new THREE.MeshStandardMaterial({
		color: EVENT_HORIZON_CORE_COLOR,
		emissive: EVENT_HORIZON_CORE_COLOR,
		emissiveIntensity: 0.35,
		transparent: true,
		opacity: 0.95,
	});
	const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
	coreMesh.position.y = GROUND_OVERLAY_Y + coreRadius * 0.55;
	coreMesh.userData.isEventHorizonCore = true;
	group.add(coreMesh);

	const accretionGeometry = new THREE.RingGeometry(center * 0.72, center, 48);
	const accretionMaterial = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: 1.35,
		transparent: true,
		opacity: 0.88,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const accretionMesh = new THREE.Mesh(accretionGeometry, accretionMaterial);
	accretionMesh.position.y = GROUND_OVERLAY_Y;
	accretionMesh.rotation.x = -Math.PI / 2;
	accretionMesh.userData.isEventHorizonAccretion = true;
	group.add(accretionMesh);

	const haloGeometry = new THREE.RingGeometry(0.86, 1.0, 48);
	const haloMaterial = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: 1.05,
		transparent: true,
		opacity: 0.72,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const haloMesh = new THREE.Mesh(haloGeometry, haloMaterial);
	haloMesh.position.y = GROUND_OVERLAY_Y + 0.02;
	haloMesh.rotation.x = -Math.PI / 2;
	haloMesh.scale.setScalar(pull);
	haloMesh.userData.isEventHorizonHalo = true;
	group.add(haloMesh);

	const particleCount = style.particleCount ?? EVENT_HORIZON_PARTICLE_COUNT;
	for (let i = 0; i < particleCount; i += 1) {
		const particleGeometry = new THREE.IcosahedronGeometry
			? new THREE.IcosahedronGeometry(0.07, 0)
			: new THREE.SphereGeometry(0.07, 6, 6);
		const particleMaterial = new THREE.MeshStandardMaterial({
			color,
			emissive,
			emissiveIntensity: 1.3,
			transparent: true,
			opacity: 0.9,
		});
		const particle = new THREE.Mesh(particleGeometry, particleMaterial);
		const startAngle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.35;
		particle.position.set(
			Math.cos(startAngle) * pull,
			GROUND_OVERLAY_Y + 0.12 + Math.random() * 0.18,
			Math.sin(startAngle) * pull,
		);
		particle.userData.isEventHorizonParticle = true;
		particle.userData.startAngle = startAngle;
		particle.userData.startRadius = pull;
		group.add(particle);
	}

	targetScene.add(group);

	activeEffects.push({
		mesh: group,
		_scene: targetScene,
		origin: { x: origin.x, z: origin.z },
		pullRadius: pull,
		centerRadius: center,
		kind: ATTACK_EFFECT_KINDS.eventHorizonEffect,
		isEventHorizonEffect: true,
		createdAt: performance.now(),
		duration,
	});
}

// ── Shared accent-themeable VFX primitives ──
//
// The four helpers below are reusable building blocks for per-card renderers.
// Each accepts a trailing `style = {}` bundle that honors a `color` and
// `emissive` override (used for accent theming), pushes onto `activeEffects`,
// and is advanced + disposed by its own flagged branch in updateAttackEffects()
// so it leaves no leaked meshes. They follow the existing
// geometry/material/disposeEffectObject conventions and allocate nothing per
// frame in the update loop.

/**
 * Spawn a multi-particle spark/ember burst — a richer sibling of spawnHitSpark.
 * Each particle flies outward along a random direction and fades. Honors
 * `count`, `spread`, `color`, `emissive`, `duration`.
 * @param {object} position - { x, y, z }
 * @param {object} [style]
 */
export function spawnParticleBurst(position, style = {}) {
	if (!areParticlesEnabled()) return;
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (!targetScene) return;

	const color = style.color ?? 0xffd166;
	const emissive = style.emissive ?? 0xf97316;
	const count = style.count ?? 8;
	const spread = style.spread ?? 1.4;
	const py = position.y ?? 1.0;

	const group = new THREE.Group();
	group.position.set(position.x, py, position.z);

	for (let i = 0; i < count; i += 1) {
		const geometry = new THREE.IcosahedronGeometry
			? new THREE.IcosahedronGeometry(0.08, 0)
			: new THREE.SphereGeometry(0.08, 6, 6);
		const material = new THREE.MeshStandardMaterial({
			color,
			emissive,
			emissiveIntensity: 1.4,
			transparent: true,
			opacity: 1.0,
		});
		const particle = new THREE.Mesh(geometry, material);
		const angle = Math.random() * Math.PI * 2;
		const elevation = 0.2 + Math.random() * 0.6;
		const speed = spread * (0.5 + Math.random() * 0.5);
		particle.userData.velocity = {
			x: Math.cos(angle) * speed,
			y: elevation * speed,
			z: Math.sin(angle) * speed,
		};
		group.add(particle);
	}
	targetScene.add(group);

	activeEffects.push({
		mesh: group,
		_scene: targetScene,
		kind: ATTACK_EFFECT_KINDS.particleBurst,
		isParticleBurst: true,
		createdAt: performance.now(),
		duration: style.duration ?? HIT_SPARK_DURATION,
	});
}

/**
 * Spawn a fading streak that follows a projectile path along `direction`.
 * Travels `range` units over `travelMs` and fades out. Honors `color`,
 * `emissive`, `range`, `travelMs`, `y`.
 * @param {object} origin - { x, z }
 * @param {object} direction - { x, z }
 * @param {object} [style]
 */
export function spawnProjectileTrail(origin, direction, style = {}) {
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (!targetScene) return;

	const dir = direction || { x: 1, z: 0 };
	const len = Math.hypot(dir.x, dir.z) || 1;
	const nx = dir.x / len;
	const nz = dir.z / len;
	const range = style.range ?? ATTACK_RANGE;
	const color = style.color ?? 0x93c5fd;
	const emissive = style.emissive ?? 0x3b82f6;
	const y = style.y ?? 1.0;

	// An elongated box oriented along the travel direction reads as a streak.
	const geometry = new THREE.BoxGeometry(0.1, 0.1, 1.0);
	const material = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: 1.2,
		transparent: true,
		opacity: 1.0,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.position.set(origin.x, y, origin.z);
	mesh.rotation.y = Math.atan2(nx, nz);
	targetScene.add(mesh);

	activeEffects.push({
		mesh,
		_scene: targetScene,
		origin: { x: origin.x, z: origin.z },
		direction: { x: nx, z: nz },
		range,
		kind: ATTACK_EFFECT_KINDS.projectileTrail,
		isProjectileTrail: true,
		createdAt: performance.now(),
		duration: style.travelMs ?? style.duration ?? ATTACK_EFFECT_DURATION,
	});
}

/**
 * Spawn a short-lived lingering ground flash/decal ring at an impact point
 * that pops in then fades out. Honors `color`, `emissive`, `radius`, `duration`.
 * @param {object} origin - { x, z }
 * @param {object} [style]
 */
export function spawnImpactDecal(origin, style = {}) {
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (!targetScene) return;

	const color = style.color ?? 0xfca5a5;
	const emissive = style.emissive ?? 0xef4444;
	const radius = style.radius ?? 0.8;

	const geometry = new THREE.RingGeometry(radius * 0.25, radius, 32);
	const material = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: 1.1,
		transparent: true,
		opacity: 1.0,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.position.set(origin.x, GROUND_OVERLAY_Y, origin.z);
	mesh.rotation.x = -Math.PI / 2;
	mesh.scale.setScalar(0.6);
	targetScene.add(mesh);

	activeEffects.push({
		mesh,
		_scene: targetScene,
		kind: ATTACK_EFFECT_KINDS.impactDecal,
		isImpactDecal: true,
		createdAt: performance.now(),
		duration: style.duration ?? HIT_SPARK_DURATION,
	});
}

/**
 * Gravity Well pull VFX: a contracting purple ground ring, a dark void core at
 * the origin, and optional inward-flowing particle streaks. Honors `color`,
 * `emissive`, `duration`.
 * @param {object} origin - { x, z }
 * @param {number} radius
 * @param {object} [style]
 */
export function spawnGravityWellEffect(origin, radius, style = {}) {
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (!targetScene) return;

	const pullRadius = radius ?? 12;
	const color = style.color ?? GRAVITY_WELL_VFX_COLOR;
	const emissive = style.emissive ?? GRAVITY_WELL_VFX_EMISSIVE;
	const duration = style.duration ?? ATTACK_EFFECT_DURATION;
	const originXZ = { x: origin.x, z: origin.z };
	const createdAt = performance.now();

	const ringGeometry = new THREE.RingGeometry(0.82, 1.0, 48);
	const ringMaterial = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: 1.1,
		transparent: true,
		opacity: 0.88,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
	const ringY = Number.isFinite(origin.y) ? origin.y : GROUND_OVERLAY_Y;
	ringMesh.position.set(origin.x, ringY, origin.z);
	ringMesh.rotation.x = -Math.PI / 2;
	ringMesh.scale.setScalar(pullRadius);
	targetScene.add(ringMesh);

	activeEffects.push({
		mesh: ringMesh,
		origin: originXZ,
		pullRadius,
		kind: ATTACK_EFFECT_KINDS.gravityWellPull,
		isGravityWellPull: true,
		isGravityWellRing: true,
		createdAt,
		duration,
		_scene: targetScene,
	});

	const coreGeometry = new THREE.SphereGeometry(GRAVITY_WELL_VOID_CORE_RADIUS, 14, 12);
	const coreMaterial = new THREE.MeshStandardMaterial({
		color: GRAVITY_WELL_VOID_CORE,
		emissive: GRAVITY_WELL_VOID_CORE,
		emissiveIntensity: GRAVITY_WELL_VOID_EMISSIVE_INTENSITY,
		transparent: true,
		opacity: 0.92,
		depthWrite: false,
	});
	const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
	coreMesh.position.set(origin.x, ringY + 0.22, origin.z);
	targetScene.add(coreMesh);

	activeEffects.push({
		mesh: coreMesh,
		origin: originXZ,
		kind: ATTACK_EFFECT_KINDS.gravityWellPull,
		isGravityWellPull: true,
		isGravityWellVoid: true,
		_baseEmissiveIntensity: GRAVITY_WELL_VOID_EMISSIVE_INTENSITY,
		createdAt,
		duration,
		_scene: targetScene,
	});

	if (!areParticlesEnabled()) return;

	const inflowGroup = new THREE.Group();
	inflowGroup.position.set(origin.x, 0, origin.z);
	for (let i = 0; i < GRAVITY_WELL_INFLOW_PARTICLE_COUNT; i += 1) {
		const geometry = new THREE.IcosahedronGeometry
			? new THREE.IcosahedronGeometry(0.07, 0)
			: new THREE.SphereGeometry(0.07, 6, 6);
		const material = new THREE.MeshStandardMaterial({
			color,
			emissive,
			emissiveIntensity: 1.35,
			transparent: true,
			opacity: 1.0,
		});
		const particle = new THREE.Mesh(geometry, material);
		const angle = (i / GRAVITY_WELL_INFLOW_PARTICLE_COUNT) * Math.PI * 2
			+ (Math.random() - 0.5) * 0.35;
		const outerDist = pullRadius * (0.72 + Math.random() * 0.28);
		const px = Math.cos(angle) * outerDist;
		const pz = Math.sin(angle) * outerDist;
		const py = 0.14 + Math.random() * 0.42;
		particle.position.set(px, py, pz);
		const inwardSpeed = outerDist * 1.05;
		particle.userData.velocity = {
			x: -(px / outerDist) * inwardSpeed,
			y: -py * 0.35,
			z: -(pz / outerDist) * inwardSpeed,
		};
		inflowGroup.add(particle);
	}
	targetScene.add(inflowGroup);

	activeEffects.push({
		mesh: inflowGroup,
		origin: originXZ,
		pullRadius,
		kind: ATTACK_EFFECT_KINDS.gravityWellPull,
		isGravityWellPull: true,
		isGravityWellInflow: true,
		createdAt,
		duration,
		_scene: targetScene,
	});
}

/**
 * Spawn an expanding/pulsing ground ring used to telegraph an incoming AoE.
 * Expands out to `radius`, pulses, and fades. Honors `color`, `emissive`,
 * `duration`.
 * @param {object} origin - { x, z }
 * @param {number} radius
 * @param {object} [style]
 */
export function spawnTelegraphRing(origin, radius, style = {}) {
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (!targetScene) return;

	const r = radius ?? 1.5;
	const color = style.color ?? 0xfacc15;
	const emissive = style.emissive ?? 0xf59e0b;

	// Unit-radius ring (outer 1.0); scaled up to `r` in the update branch.
	const geometry = new THREE.RingGeometry(0.82, 1.0, 48);
	const material = new THREE.MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: 1.0,
		transparent: true,
		opacity: 0.85,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(geometry, material);
	const ringY = Number.isFinite(origin.y) ? origin.y : GROUND_OVERLAY_Y;
	mesh.position.set(origin.x, ringY, origin.z);
	mesh.rotation.x = -Math.PI / 2;
	mesh.scale.setScalar(0.001);
	targetScene.add(mesh);

	activeEffects.push({
		mesh,
		_scene: targetScene,
		telegraphRadius: r,
		kind: ATTACK_EFFECT_KINDS.telegraphRing,
		isTelegraphRing: true,
		createdAt: performance.now(),
		duration: style.duration ?? SUMMON_EFFECT_DURATION,
	});
}

/**
 * Per-frame update for attack effects: move projectiles, expand/fade summon rings,
 * scale/fade sparks, dispose expired.
 */
export function updateAttackEffects() {
	const now = performance.now();
	const attackEffectCtx = { mirrorWardShellsByPlayer };
	for (let i = activeEffects.length - 1; i >= 0; i--) {
		const fx = activeEffects[i];
		const elapsed = now - fx.createdAt;

		if (fx.kind && runAttackEffectUpdater(fx, elapsed)) {
			if (shouldExpireAttackEffect(fx, elapsed)) {
				disposeAttackEffect(fx, activeEffects, i, attackEffectCtx);
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

		// ── Passage gate unlock flash (scale + emissive fade) ──
		if (fx.isPassageUnlockGate) {
			const t = Math.min(elapsed / fx.duration, 1.0);
			const scale = 1.0 + t * 0.35;
			fx.mesh.scale.setScalar(scale);
			fx.mesh.traverse((child) => {
				if (!child.material) return;
				child.material.opacity = Math.max(0.01, 1.0 - t);
				child.material.emissiveIntensity = Math.max(0.01, 1.8 * (1.0 - t));
			});

			if (elapsed >= fx.duration) {
				disposeEffectObject(fx.mesh, fx._scene || scene);
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

		// ── Shared primitive: multi-particle burst ──
		if (fx.isParticleBurst) {
			const t = Math.min(elapsed / fx.duration, 1.0);
			const opacity = Math.max(0.01, 1.0 - t);
			for (let c = 0; c < fx.mesh.children.length; c++) {
				const particle = fx.mesh.children[c];
				const v = particle.userData.velocity;
				particle.position.set(v.x * t, v.y * t - t * t * 0.8, v.z * t);
				particle.material.opacity = opacity;
			}
			if (elapsed >= fx.duration) {
				disposeEffectObject(fx.mesh, fx._scene || scene);
				activeEffects.splice(i, 1);
			}
			continue;
		}

		// ── Shared primitive: projectile trail streak ──
		if (fx.isProjectileTrail) {
			const t = Math.min(elapsed / fx.duration, 1.0);
			const travel = fx.range * t;
			fx.mesh.position.x = fx.origin.x + fx.direction.x * travel;
			fx.mesh.position.z = fx.origin.z + fx.direction.z * travel;
			fx.mesh.material.opacity = Math.max(0.01, 1.0 - t);
			if (elapsed >= fx.duration) {
				disposeEffectObject(fx.mesh, fx._scene || scene);
				activeEffects.splice(i, 1);
			}
			continue;
		}

		// ── Shared primitive: lingering impact decal ──
		if (fx.isImpactDecal) {
			const t = Math.min(elapsed / fx.duration, 1.0);
			const scale = t < 0.2 ? 0.6 + (t / 0.2) * 0.4 : 1.0;
			fx.mesh.scale.setScalar(scale);
			fx.mesh.material.opacity = Math.max(0.01, 1.0 - t);
			if (elapsed >= fx.duration) {
				disposeEffectObject(fx.mesh, fx._scene || scene);
				activeEffects.splice(i, 1);
			}
			continue;
		}

		// ── Shared primitive: expanding/pulsing telegraph ring ──
		if (fx.isTelegraphRing) {
			const t = Math.min(elapsed / fx.duration, 1.0);
			const expandT = Math.min(t / 0.4, 1.0);
			fx.mesh.scale.setScalar(Math.max(0.001, fx.telegraphRadius * expandT));
			const pulse = 0.55 + 0.35 * Math.abs(Math.sin(elapsed / 120));
			fx.mesh.material.opacity = Math.max(0.01, pulse * (1.0 - t));
			if (elapsed >= fx.duration) {
				disposeEffectObject(fx.mesh, fx._scene || scene);
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

		// ── Fireball projectile (grouped core + flame halo) ──
		if (fx.isFireballProjectile) {
			const travelRange = fx.range ?? ATTACK_RANGE;
			const t = Math.min(elapsed / fx.duration, 1.0);
			const travel = travelRange * t;
			fx.mesh.position.x = fx.origin.x + fx.direction.x * travel;
			fx.mesh.position.z = fx.origin.z + fx.direction.z * travel;

			const pulse = 0.9 + 0.14 * Math.sin(elapsed / 45);
			const flicker = 1.0 + 0.28 * Math.sin(elapsed / 28 + 1.3);
			if (fx.coreMesh) {
				fx.coreMesh.scale.setScalar(pulse);
				fx.coreMesh.material.emissiveIntensity = 2.0 * flicker;
			}
			if (fx.haloMesh) {
				const haloPulse = 1.0 + 0.2 * Math.sin(elapsed / 60 + 0.7);
				fx.haloMesh.scale.setScalar(haloPulse);
				fx.haloMesh.material.emissiveIntensity = 1.3 * flicker;
				fx.haloMesh.material.opacity = Math.max(0.2, 0.48 + 0.14 * Math.sin(elapsed / 35));
			}

			const lifeRatio = 1.0 - t;
			if (fx.coreMesh?.material) {
				fx.coreMesh.material.opacity = Math.max(0.01, 0.95 * lifeRatio);
			}

			if (elapsed >= fx.duration) {
				disposeEffectObject(fx.mesh, scene);
				activeEffects.splice(i, 1);
			}
			continue;
		}

		// ── Glacial Orb projectile (crystalline core + frost halo) ──
		if (fx.isGlacialOrbProjectile) {
			const travelRange = fx.range ?? ATTACK_RANGE;
			const t = Math.min(elapsed / fx.duration, 1.0);
			const travel = travelRange * t;
			fx.mesh.position.x = fx.origin.x + fx.direction.x * travel;
			fx.mesh.position.z = fx.origin.z + fx.direction.z * travel;

			const pulse = 0.88 + 0.12 * Math.sin(elapsed / 80);
			const shimmer = 1.0 + 0.22 * Math.sin(elapsed / 55 + 0.5);
			if (fx.coreMesh) {
				fx.coreMesh.rotation.y = elapsed * 0.002;
				fx.coreMesh.rotation.x = Math.sin(elapsed / 200) * 0.15;
				fx.coreMesh.scale.setScalar(pulse);
				fx.coreMesh.material.emissiveIntensity = 2.2 * shimmer;
			}
			if (fx.haloMesh) {
				const haloPulse = 1.0 + 0.18 * Math.sin(elapsed / 90 + 1.1);
				fx.haloMesh.scale.setScalar(haloPulse);
				fx.haloMesh.material.emissiveIntensity = 1.5 * shimmer;
				fx.haloMesh.material.opacity = Math.max(0.15, 0.38 + 0.12 * Math.sin(elapsed / 70));
			}

			const lifeRatio = 1.0 - t;
			if (fx.coreMesh?.material) {
				fx.coreMesh.material.opacity = Math.max(0.01, 0.92 * lifeRatio);
			}

			if (elapsed >= fx.duration) {
				disposeEffectObject(fx.mesh, scene);
				activeEffects.splice(i, 1);
			}
			continue;
		}

		// ── Arcane bolt projectile (elongated violet lance + trailing glow) ──
		if (fx.isArcaneBoltProjectile) {
			const travelRange = fx.range ?? ATTACK_RANGE;
			const t = Math.min(elapsed / fx.duration, 1.0);
			const travel = travelRange * t;
			fx.mesh.position.x = fx.origin.x + fx.direction.x * travel;
			fx.mesh.position.z = fx.origin.z + fx.direction.z * travel;

			const pulse = 0.92 + 0.12 * Math.sin(elapsed / 38);
			const lengthPulse = 0.95 + 0.08 * Math.sin(elapsed / 52);
			const flicker = 1.0 + 0.32 * Math.sin(elapsed / 24 + 0.5);
			if (fx.coreMesh) {
				fx.coreMesh.scale.set(pulse, pulse * lengthPulse, pulse);
				fx.coreMesh.material.emissiveIntensity = 1.7 * flicker;
			}
			if (fx.glowMesh) {
				const glowPulse = 1.0 + 0.18 * Math.sin(elapsed / 48 + 1.1);
				fx.glowMesh.scale.setScalar(glowPulse);
				fx.glowMesh.material.emissiveIntensity = 1.1 * flicker;
				fx.glowMesh.material.opacity = Math.max(0.15, 0.42 + 0.12 * Math.sin(elapsed / 30));
			}

			const lifeRatio = 1.0 - t;
			if (fx.coreMesh?.material) {
				fx.coreMesh.material.opacity = Math.max(0.01, 0.95 * lifeRatio);
			}

			if (elapsed >= fx.duration) {
				disposeEffectObject(fx.mesh, fx._scene || scene);
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
			(fx._scene || scene).remove(fx.mesh);
			fx.mesh.geometry.dispose();
			fx.mesh.material.dispose();
			activeEffects.splice(i, 1);
		}
	}
}

// ── Mesh disposal + sync helpers ──
// disposeOne / disposeMeshMap / disposeStaleMeshes / syncMeshMap moved verbatim
// to ./renderer/meshSync.js (imported + re-exported near the top of this file).

// ── Loot mesh sync & animation ──
// markLootCollected / updateCollectingLoot / syncLootMeshes / animateLootMeshes,
// the telepipe portal (syncTelepipeMesh / animateTelepipePortal + build/dispose
// helpers), and the ice-ball projectile sync (syncIceBallMeshes / createIceBallMesh
// / ICE_BALL_HEIGHT) now live in ./renderer/lootSync.js (imported + re-exported
// near the top of this file).

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
 * Local-player respawn / dead-state reset. Owns the writes to renderer.js's
 * kinematic `let`s (myX/myZ/simX/simZ/prevSimX/prevSimZ/moveAccumulator/
 * playerRotation/lastEmittedRotation) and the lock-on clears — kept here, NOT in
 * ./renderer/playerSync.js, so those module-scoped bindings are never reassigned
 * cross-module. Invoked from animate() right after syncPlayerMeshes(): on a
 * dead→alive transition it snaps the local player back to spawn; while dead it
 * keeps lock-on state cleared. Preserves the order/effect of the reset that
 * previously lived inline inside syncPlayerMeshes (the hp-drop flash never
 * coincides with a respawn, since respawn raises hp rather than dropping it).
 */
function applyLocalPlayerRespawnReset(gs, myId) {
	if (myId == null || !playersMeshes[myId]) return;
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
}

// syncMinionMeshes() + syncSpikeTrapMeshes() now live in
// ./renderer/minionSync.js (imported + re-exported near the top of this file).

/**
 * The per-frame game loop: delta clamping, player movement input, mesh sync
 * (players, enemies, minions, loot), camera follow, effect updates, render.
 *
 * Reads gameState from the shared reference set by setGameStateRef().
 */
export function animate(timestamp) {
	if (!animateActive) return;
	requestAnimationFrame(animate);
	if (!renderer || !scene || !camera || !clock) return;

	const delta = clampDelta(clock.getDelta());

	// Poll the gamepad once per frame into a shared snapshot so the movement,
	// look, and button readers below all consume the same navigator.getGamepads()
	// read instead of each re-polling the pad/profile/config.
	pollGamepadSnapshot();

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
		// Build the local kinematics snapshot for the player sync (the predicted
		// myX/myZ + facing). playerSync.js reads these via the argument instead of
		// the module-scoped `let`s, which stay owned here.
		syncPlayerMeshes(gs, myId, { myX, myZ, playerRotation });
		// Respawn/dead-state reset that reassigns those kinematic `let`s stays here,
		// applied right after the sync (matching the previous inline order).
		applyLocalPlayerRespawnReset(gs, myId);

		// ── phase_step ally highlight: recompute nearest in-range ally each frame ──
		syncPhaseStepAllyHighlight(gs, myId);

		syncEnemyMeshes(gs);

		syncMinionMeshes(gs);

		syncSpikeTrapMeshes(gs);

		// ── Loot mesh sync ──
		syncLootMeshes();
		// ── Ice-ball projectile sync ──
		syncIceBallMeshes();
		syncTelepipeMesh();
	}

	// Animate loot coins (outside gameState guard)
	animateLootMeshes();

	// Animate telepipe portal (outside gameState guard — mesh may outlive snapshot)
	animateTelepipePortal(delta);

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

	// Release the frame snapshot so any out-of-loop reader (e.g. socket-handler
	// movement checks) re-polls the live pad rather than reusing this frame's.
	invalidateGamepadSnapshot();
}
