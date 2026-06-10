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
import { disposeOne, disposeMeshMap, disposeStaleMeshes } from './renderer/disposeMesh.js';
import { syncMeshMap } from './renderer/syncMeshMap.js';
import { createLootSync } from './renderer/lootSync.js';
import {
	createPlayerSync,
	computeWindupChargeRatio,
	resolveWindupAccentHex,
} from './renderer/playerSync.js';
import {
	createEnemySync,
	ENEMY_GEOMETRY,
	WARDED_TINT,
	FRENZIED_TINT,
	VARIANT_MARKER_COLORS,
} from './renderer/enemySync.js';
import { createEffectsSync } from './renderer/effectsSync.js';
import {
	createAvatarSync,
	attachGltfHat,
	attachGltfKeyItemProp,
	createPlayerAvatar as avatarSyncCreatePlayerAvatar,
	disposeAvatar,
	applyAvatarProportions,
	__testOnly,
	resolveBodyMeshForVfx,
} from './renderer/avatarSync.js';

export { disposeAvatar, applyAvatarProportions, __testOnly };
export { computeWindupChargeRatio, resolveWindupAccentHex };

export function createPlayerAvatar(...args) {
	getAvatarSync();
	return avatarSyncCreatePlayerAvatar(...args);
}

export { disposeOne, disposeMeshMap, disposeStaleMeshes };
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
	ATTACK_RANGE,
	ATTACK_CONE_ANGLE,
	PROJECTILE_HIT_WIDTH,
	ATTACK_EFFECT_DURATION,
	RUSTY_SHIV_EFFECT_DURATION,
	ATTACK_EFFECT_SPEED,
	SUMMON_EXPAND_MS,
	SUMMON_EFFECT_DURATION,
	MINION_SUMMON_IN_MS,
	HIT_SPARK_DURATION,
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
	MAX_HP,
	MAX_MS,
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
	cameraYawBehindFacing,
} from './lockOn.js';
import { syncLockOnInfoPanel } from './lock-on-info-panel.js';
import { getLockOnRepeatAction, getGamepadConfig, areParticlesEnabled, getAccountProfile } from './settings.js';
import { MODEL_REGISTRY, loadModel, modelPathFor } from './models.js';
import eventsCatalog from '../shared/events.json' with { type: 'json' };

const { clientToServer: CLIENT_TO_SERVER } = eventsCatalog;

// ── Three.js scene references ──
let scene, camera, renderer, clock;
const playersMeshes = {};
/** Persistent ground-hazard meshes for armed spike_trap enchantments, keyed by enc.id. */
const spikeTrapMeshes = {};
const iceBallMeshes = {}; // ice-ball projectile id → giant icy sphere mesh (glacial thrower)
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

// ── Damage number tracking ──
const damageNumbers = []; // { element, createdAt, position3d, duration }


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
		...getEffectsSync().getEffectsMeshMaps(),
		spikeTrapMeshes,
		lootMeshes: getLootSync().getLootMeshes(),
		iceBallMeshes,
		...getEnemySync().getEnemyMeshMaps(),
		...getPlayerSync().getPlayerMeshMaps(),
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

/**
 * Get the active effects array.
 * @returns {object[]}
 */
export function getActiveEffects() {
	return activeEffects;
}

/** Test harness: pending minion scale-in start times keyed by minion id. */
export function getMinionSpawnTimes() {
	return getEffectsSync().getMinionSpawnTimes();
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

/**
 * Get the windupFlashing set.
 * @returns {Set}
 */
export function getWindupFlashing() {
	return getEnemySync().getWindupFlashing();
}

/**
 * Player ids currently showing card-windup emissive (weapon charge telegraph).
 * @returns {Set<string>}
 */
export function getPlayerCardWindupFlashing() {
	return getPlayerSync().getPlayerCardWindupFlashing();
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

// Standing height (world units) the glTF player avatar is normalized to. Matches
// the spike contract in game/docs/MODEL_SPIKE.md (1.8, feet at y=0).
const PLAYER_MODEL_HEIGHT = 1.8;

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

// ── Avatar sync (extracted module; thin re-exports at top of file) ──

let _avatarSync = null;

function getAvatarSync() {
	if (!_avatarSync) {
		_avatarSync = createAvatarSync({
			getScene: () => scene,
			getPlayersMeshes: () => playersMeshes,
			attachRegistryModel,
			buildKeyItemProp,
		});
	}
	return _avatarSync;
}

function resolveBodyMesh(obj) {
	return resolveBodyMeshForVfx(obj);
}

// ── Nameplate sprite helpers (playerSync; thin re-exports) ──

/** @param {string} username @returns {THREE.Sprite} */
export function createNameplate(username) {
	return getPlayerSync().createNameplate(username);
}

/** @param {string} playerId */
export function disposeNameplate(playerId) {
	return getPlayerSync().disposeNameplate(playerId);
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

// ── Loot sync (extracted module; thin re-exports for tests / main.js) ──

let _lootSync = null;

function getLootSync() {
	if (!_lootSync) {
		_lootSync = createLootSync({
			getScene: () => scene,
			getSocket: () => socketRef,
			attachRegistryModel,
			spawnDamageNumber,
		});
	}
	return _lootSync;
}

/** @returns {Set} */
export function getPickedUpLootIds() {
	return getLootSync().getPickedUpLootIds();
}

/** @param {Set<string>} currentLootIds */
export function pruneLootPickupAttempts(currentLootIds) {
	return getLootSync().pruneLootPickupAttempts(currentLootIds);
}

export function markLootCollected(lootId, value, kind = 'currency') {
	return getLootSync().markLootCollected(lootId, value, kind);
}

export function updateCollectingLoot() {
	return getLootSync().updateCollectingLoot();
}

export function syncLootMeshes() {
	return getLootSync().syncMeshes(gameStateRef);
}

export function animateLootMeshes() {
	return getLootSync().animateMeshes();
}

export function disposeAllLootMeshes() {
	return getLootSync().disposeAllLootMeshes();
}

// ── Player sync (extracted module; thin re-exports for tests / main.js) ──

let _playerSync = null;

function getPlayerSync() {
	if (!_playerSync) {
		_playerSync = createPlayerSync({
			getScene: () => scene,
			getPlayersMeshes: () => playersMeshes,
			getAccountProfile,
			getGamePhase: () => currentGamePhase,
			flashMesh,
			spawnDamageNumber,
			triggerShieldVFX,
			getShieldVFX: (id) => shieldVFX[id],
			hasSmokeVFX: (id) => !!smokeVFX[id],
			triggerSmokeVFX,
			getShieldOffsetDist: () => SHIELD_OFFSET_DIST,
			applySlowIndicator,
			applyBurnIndicator,
			getWasDead: () => wasDead,
			setWasDead: (v) => { wasDead = v; },
			getSpawnPosition: () => spawnPosition,
			resetLocalPlayerOnRespawn: () => {
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
			},
			clearLockOnOnDeath: () => {
				clearAllLockOnState();
				lockOnToTarget = null;
				lockOnReleaseLookAt = null;
			},
			getMyX: () => myX,
			getMyZ: () => myZ,
			getPlayerRotation: () => playerRotation,
		});
	}
	return _playerSync;
}

// ── Effects sync (minions, telepipe, per-frame atmosphere) ──

let _effectsSync = null;

function getEffectsSync() {
	if (!_effectsSync) {
		_effectsSync = createEffectsSync({
			getScene,
			getGameStateRef: () => gameStateRef,
			createMinionMesh,
			createNullCrawlerTelegraph,
			updateNullCrawlerTelegraph,
			spawnTelegraphRing,
			flashMesh,
			spawnDamageNumber,
			getCurrentLayoutProfile: () => currentLayoutProfile,
			getPlayersMeshes: () => playersMeshes,
			getCamera: () => camera,
			updateSpireAscentAtmosphere,
			updateFireCavernAtmosphere,
			resetAtmosphere,
		});
	}
	return _effectsSync;
}

export function syncTelepipeMesh() {
	return getEffectsSync().syncTelepipeMesh();
}

export function animateTelepipePortal(delta) {
	return getEffectsSync().animateTelepipePortal(delta);
}

// ── Enemy sync (extracted module; thin re-exports for tests / main.js) ──

let _enemySync = null;

function getEnemySync() {
	if (!_enemySync) {
		_enemySync = createEnemySync({
			getScene,
			getMinionsMeshes: () => getEffectsSync().getMinionsMeshes(),
			flashMesh,
			spawnHitSpark,
			spawnChainLightningEffect,
			spawnLightningArc,
			spawnAttackEffect,
			spawnParticleBurst,
			applySlowIndicator,
			applyBurnIndicator,
			attachRegistryModel,
			createConeHitboxGroup,
			makeHitboxMaterial,
		});
	}
	return _enemySync;
}

/** Record cardUsed hits so minion-damage fallbacks skip duplicate VFX. */
export function markCardHitEnemies(hits) {
	return getEnemySync().markCardHitEnemies(hits);
}

export function enemyMeshHalfHeight(type) {
	return getEnemySync().enemyMeshHalfHeight(type);
}

export function getEnemyRenderScaleForTest(enemyId, enemyType) {
	return getEnemySync().getEnemyRenderScaleForTest(enemyId, enemyType);
}

export function createEnemyMesh(type) {
	return getEnemySync().createEnemyMesh(type);
}

export function healthBarColor(hp, maxHp) {
	return getEnemySync().healthBarColor(hp, maxHp);
}

export function createHealthBarMesh(enemyId, x, z, type) {
	return getEnemySync().createHealthBarMesh(enemyId, x, z, type);
}

export function updateHealthBarMesh(enemyId, enemy) {
	return getEnemySync().updateHealthBarMesh(enemyId, enemy);
}

export function createEnemyShieldBarMesh(enemyId, x, z, type) {
	return getEnemySync().createEnemyShieldBarMesh(enemyId, x, z, type);
}

export function updateEnemyShieldBarMesh(enemyId, enemy) {
	return getEnemySync().updateEnemyShieldBarMesh(enemyId, enemy);
}

export function applyWindupFlash(enemyId, isWindup) {
	return getEnemySync().applyWindupFlash(enemyId, isWindup);
}

export function applyRevealHighlight(enemyId, enemy) {
	return getEnemySync().applyRevealHighlight(enemyId, enemy);
}

export function variantMarkerColor(variant) {
	return getEnemySync().variantMarkerColor(variant);
}

export function applyEnemyVariantTint(enemyId, enemy) {
	return getEnemySync().applyEnemyVariantTint(enemyId, enemy);
}

export function applyVariantMarker(enemyId, enemy) {
	return getEnemySync().applyVariantMarker(enemyId, enemy);
}

export function applyVariantEmissiveTint(enemyId, enemy) {
	return getEnemySync().applyVariantEmissiveTint(enemyId, enemy);
}

export function applyFrenziedTelegraphRing(enemyId, enemy) {
	return getEnemySync().applyFrenziedTelegraphRing(enemyId, enemy);
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

/** Id of the ally currently highlighted for phase_step, or null when none in range. */
export function getPhaseStepTargetId() {
	return getPlayerSync().getPhaseStepTargetId();
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

export function applyPlayerCardWindupIndicator(id, player, x, z, now = Date.now()) {
	return getPlayerSync().applyPlayerCardWindupIndicator(id, player, x, z, now);
}

function updateEnemyHitboxPulse(delta) {
	const enemyHitboxMeshes = getEnemySync().getEnemyHitboxMeshes();
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
	// Windup corridor reads ghostlier than the resolved beam (brighter emissive, lower opacity).
	const group = createBeamTelegraphGroup(direction, range, hitWidth, {
		color: 0x67e8f9,
		emissive: 0xa5f3fc,
		opacity: 0.38,
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

const THERMAL_COLUMN_COLOR = 0xef4444;
const THERMAL_COLUMN_EMISSIVE = 0xdc2626;
const THERMAL_COLUMN_HEIGHT = 4.5;
const THERMAL_COLUMN_OPACITY = 0.75;
const THERMAL_COLUMN_BASE_Y = 0.1;
const THERMAL_COLUMN_DEFAULT_DOT_TICKS = 4;
const THERMAL_COLUMN_DEFAULT_DOT_INTERVAL_MS = 500;
const THERMAL_COLUMN_EMISSIVE_INTENSITY = 1.4;

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
		createdAt: performance.now(),
		duration,
		_scene: targetScene,
	});
}

// Spike Trap palette: a hostile steel-spike hazard, coherent with the card's red
// accent (#f87171) yet clearly distinct from cinder_snare's fiery inferno burst —
// brushed-steel spikes lit by a blood-red emissive glow rather than orange fire.
const SPIKE_TRAP_SPIKE_COLOR = 0x9ca3af; // brushed steel grey
const SPIKE_TRAP_EMISSIVE = 0xdc2626; // blood-red hazard glow on the iron
const SPIKE_TRAP_RING_COLOR = 0xb91c1c; // dark blood-red hazard ring
const SPIKE_TRAP_RING_EMISSIVE = 0xef4444; // red ring glow
const SPIKE_TRAP_SPIKE_COUNT = 6; // spikes erupting in a ring around the trap
const SPIKE_TRAP_SPIKE_HEIGHT = 0.75; // height of each iron spike
const SPIKE_TRAP_SPIKE_RADIUS = 0.13; // base radius of each cone spike

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
		createdAt: performance.now(),
		duration: SUMMON_EFFECT_DURATION,
		spikeTrapRing: true,
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
			createdAt: performance.now(),
			duration: SUMMON_EFFECT_DURATION,
			isSpikeTrapSpike: true,
			spikeHeight: SPIKE_TRAP_SPIKE_HEIGHT,
			_scene: targetScene,
		});
	}
}

/**
 * Build the persistent ground-hazard mesh for an armed spike_trap enchantment:
 * a hostile blood-red ring sized to `enc.radius` plus a small cluster of static
 * upward steel spikes. Reuses the SPIKE_TRAP_* palette so it reads as an armed
 * spike trap and stays distinct from cinder_snare's orange fire look. Geometry
 * and materials are owned by the returned group (like enemy meshes), so
 * disposeStaleMeshes / disposeMeshMap fully release them; they are allocated once
 * per trap on first sight and never per frame.
 * @param {object} enc - { x, z, radius }
 * @returns {THREE.Group}
 */
export function createSpikeTrapHazardMesh(enc) {
	const radius = Number.isFinite(enc?.radius) ? enc.radius : 2.5;
	const group = new THREE.Group();

	// Hostile ground ring marking the armed hazard footprint.
	const ringGeometry = new THREE.RingGeometry(radius * 0.78, radius, 48);
	const ringMaterial = new THREE.MeshStandardMaterial({
		color: SPIKE_TRAP_RING_COLOR,
		emissive: SPIKE_TRAP_RING_EMISSIVE,
		emissiveIntensity: 0.85,
		transparent: true,
		opacity: 0.6,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const ring = new THREE.Mesh(ringGeometry, ringMaterial);
	ring.position.y = 0.06;
	ring.rotation.x = -Math.PI / 2;
	group.add(ring);

	// Static cluster of short upward steel spikes signalling the primed trap —
	// shorter than the eruption VFX cones so the firing burst still reads as a hit.
	const spikeHeight = SPIKE_TRAP_SPIKE_HEIGHT * 0.5;
	const spikeOffset = radius * 0.45;
	for (let s = 0; s < SPIKE_TRAP_SPIKE_COUNT; s++) {
		const angle = (s / SPIKE_TRAP_SPIKE_COUNT) * Math.PI * 2;
		const geometry = new THREE.ConeGeometry(SPIKE_TRAP_SPIKE_RADIUS, spikeHeight, 6);
		const material = new THREE.MeshStandardMaterial({
			color: SPIKE_TRAP_SPIKE_COLOR,
			emissive: SPIKE_TRAP_EMISSIVE,
			emissiveIntensity: 0.6,
		});
		const spike = new THREE.Mesh(geometry, material);
		spike.position.set(
			Math.cos(angle) * spikeOffset,
			spikeHeight / 2,
			Math.sin(angle) * spikeOffset,
		);
		group.add(spike);
	}

	group.position.set(enc.x, 0, enc.z);
	return group;
}

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

const MIRROR_WARD_COLOR = 0x5eead4;
const MIRROR_WARD_EMISSIVE = 0x2dd4bf;
const MIRROR_WARD_SILVER = 0xe2e8f0;
const mirrorWardShellsByPlayer = new Map();

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
		isImpactDecal: true,
		createdAt: performance.now(),
		duration: style.duration ?? HIT_SPARK_DURATION,
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
	mesh.position.set(origin.x, GROUND_OVERLAY_Y, origin.z);
	mesh.rotation.x = -Math.PI / 2;
	mesh.scale.setScalar(0.001);
	targetScene.add(mesh);

	activeEffects.push({
		mesh,
		_scene: targetScene,
		telegraphRadius: r,
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
				disposeEffectObject(fx.mesh, fx._scene || scene);
				activeEffects.splice(i, 1);
			}
			continue;
		}

		// ── Erupting spike (Spike Trap) ──
		if (fx.isSpikeTrapSpike) {
			const t = Math.min(elapsed / fx.duration, 1.0);
			const riseT = Math.min(t / 0.3, 1.0); // burst upward over the first 30%
			const s = Math.max(0.001, riseT);
			fx.mesh.scale.y = s;
			// Cone is centered on its local origin, so raise position.y in lockstep
			// with scale.y to keep the spike's base pinned to the ground as it grows.
			fx.mesh.position.y = (fx.spikeHeight * s) / 2;
			fx.mesh.material.opacity = Math.max(0.01, 1.0 - t);

			if (elapsed >= fx.duration) {
				disposeEffectObject(fx.mesh, fx._scene || scene);
				activeEffects.splice(i, 1);
			}
			continue;
		}

		// ── Ascending holy light column (Sanctum Pulse) ──
		if (fx.isLightColumn) {
			const t = Math.min(elapsed / fx.duration, 1.0);
			const riseT = Math.min(t / 0.35, 1.0); // grow upward over first 35%
			const s = Math.max(0.001, riseT);
			fx.mesh.scale.y = s;
			// Keep the base on the ground as the centered cylinder scales up.
			fx.mesh.position.y = DIVINE_GRACE_COLUMN_BASE_Y + (DIVINE_GRACE_COLUMN_HEIGHT * s) / 2;
			fx.mesh.material.opacity = Math.max(0.01, DIVINE_GRACE_COLUMN_OPACITY * (1.0 - t));

			if (elapsed >= fx.duration) {
				disposeEffectObject(fx.mesh, fx._scene || scene);
				activeEffects.splice(i, 1);
			}
			continue;
		}

		// ── Rising thermal fire column (Thermal Column) ──
		if (fx.isThermalColumn) {
			const t = Math.min(elapsed / fx.duration, 1.0);
			const riseT = Math.min(t / 0.35, 1.0);
			const s = Math.max(0.001, riseT);
			fx.mesh.scale.y = s;
			fx.mesh.position.y = THERMAL_COLUMN_BASE_Y + (THERMAL_COLUMN_HEIGHT * s) / 2;
			const fade = Math.max(0.01, THERMAL_COLUMN_OPACITY * (1.0 - t));
			fx.mesh.material.opacity = fade;
			const baseIntensity = fx._baseEmissiveIntensity ?? THERMAL_COLUMN_EMISSIVE_INTENSITY;
			const flicker = 1.0 + 0.25 * Math.sin(elapsed * 0.02);
			fx.mesh.material.emissiveIntensity = baseIntensity * flicker * fade;

			if (elapsed >= fx.duration) {
				disposeEffectObject(fx.mesh, fx._scene || scene);
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

		// ── Mirror Ward protective shell (ring + mirror facets) ──
		if (fx.isMirrorWardShell) {
			const t = Math.min(elapsed / fx.duration, 1.0);
			const expandT = Math.min(t / 0.35, 1.0);
			const pulse = 0.5 + 0.32 * Math.abs(Math.sin(elapsed / 280));
			for (let c = 0; c < fx.mesh.children.length; c += 1) {
				const child = fx.mesh.children[c];
				if (child.userData.isMirrorWardRing) {
					child.scale.setScalar(Math.max(0.001, fx.wardRadius * expandT));
					child.material.opacity = Math.max(0.01, pulse * (1.0 - t * 0.85));
				} else if (child.userData.isMirrorWardFacet) {
					const facetPulse = 0.55 + 0.25 * Math.abs(Math.sin(elapsed / 320));
					child.material.opacity = Math.max(0.01, facetPulse * (1.0 - t));
				}
			}
			if (elapsed >= fx.duration) {
				disposeEffectObject(fx.mesh, fx._scene || scene);
				activeEffects.splice(i, 1);
				if (fx.playerId) {
					mirrorWardShellsByPlayer.delete(fx.playerId);
				}
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

	syncMeshMap(
		iceBallMeshes,
		balls,
		(ball) => ball.id,
		(ball) => createIceBallMesh(ball),
		(mesh, ball) => mesh.position.set(ball.x, ICE_BALL_HEIGHT, ball.z),
		scene,
	);
}

/**
 * Sync persistent ground-hazard meshes for armed spike_trap enchantments.
 * Only spike_trap is handled here; other effects (e.g. cinder_snare) are left
 * to their own handling.
 */
export function syncSpikeTrapMeshes() {
	const gs = gameStateRef;
	if (!gs || !scene) return;

	const traps = (gs.enchantments || []).filter(
		(enc) => enc && enc.effect === 'spike_trap' && enc.armed,
	);

	syncMeshMap(
		spikeTrapMeshes,
		traps,
		(enc) => enc.id,
		(enc) => createSpikeTrapHazardMesh(enc),
		(mesh, enc) => mesh.position.set(enc.x, 0, enc.z),
		scene,
	);
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

	getLootSync().syncFrame({ gs, myId, myX, myZ, now: performance.now() });

	if (gs) {
		for (const [id, pData] of Object.entries(gs.players)) {
			getAvatarSync().syncPlayerAvatar(id, pData, { isLocal: id === myId });
		}
		getPlayerSync().syncPlayersFrame({ gs, myId });
		getEnemySync().syncEnemiesFrame({ gs });
		getEffectsSync().syncMeshesFrame(gs);
		syncSpikeTrapMeshes();
		getLootSync().syncMeshes(gs);
		syncIceBallMeshes();
	}

	getLootSync().animateMeshes();
	getEffectsSync().animateTelepipePortal(delta);

	if (myId != null && playersMeshes[myId]) {
		const playerPos = playersMeshes[myId].position;
		updateCameraOrbit(playerPos.x, playerPos.y, playerPos.z, delta);
	}

	getEffectsSync().syncAtmosphereFrame({ gs, myId });

	// Animate attack visual effects
	updateAttackEffects();

	// Pulse enemy hitbox overlays
	updateEnemyHitboxPulse(delta);

	// Update floating damage numbers
	updateDamageNumbers();

	getLootSync().updateCollectingLoot();

	renderer.render(scene, camera);
}

export { ENEMY_GEOMETRY, WARDED_TINT, FRENZIED_TINT, VARIANT_MARKER_COLORS };
