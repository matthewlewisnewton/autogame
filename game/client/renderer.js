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
import { sampleFloorY, DEFAULT_FLOOR_Y, resolveFloorY } from './collision.js';
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
	CAMERA_DISTANCE,
	CAMERA_HEIGHT,
	CAMERA_YAW_SENSITIVITY,
	ENEMY_ATTACK_RANGE,
	MAX_HP,
	MAX_MS,
	LOOT_PICKUP_RADIUS,
	LOOT_PICKUP_RETRY_MS,
} from './config.js';
import {
	initGamepadListeners,
	pollGamepadMovement,
	pollGamepadLook,
	pollGamepadButtons,
	resetGamepadState,
	isGamepadMoving,
	mergeMovementVectors,
} from './gamepad.js';
import { pollInput } from './input.js';
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
	updateLockOn,
	targetRelativeDirection,
	getDirectionToTarget,
	resetLockOnTracking,
	normalizeAngle,
	cameraYawFromToTarget,
} from './lockOn.js';
import { getLockOnRepeatAction, getGamepadConfig, areParticlesEnabled } from './settings.js';
import { MODEL_REGISTRY, loadModel, modelPathFor } from './models.js';

// ── Three.js scene references ──
let scene, camera, renderer, clock;
const playersMeshes = {};
const enemiesMeshes = {};
const enemyHealthBars = {}; // enemy id → health bar mesh
const enemyHitboxMeshes = {}; // enemy id → pulsing hitbox group
const telegraphMeshes = {}; // enemy id → warning ring mesh (ground circle during windup)
const minionTelegraphMeshes = {}; // minion id → beam telegraph during windup
const enemyLockOnRings = {}; // enemy id → lock-on reticle ring

// phase_step ally targeting: nearest in-range ally id (or null) recomputed each
// frame, plus the ground ring that highlights it. Read by main.js via
// getPhaseStepTargetId() so the useKeyItem payload can carry targetPlayerId.
const PHASE_STEP_RANGE = 6; // metres — must match server KEY_ITEM_DEFS.phase_step.range
let phaseStepTargetId = null;
let phaseStepAllyRing = null;
const windupFlashing = new Set(); // enemy ids currently showing windup emissive
const minionsMeshes = {};
const lootMeshes = {};
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

// ── Input state ──
const keys = { w: false, a: false, s: false, d: false };
let inputListenersAdded = false;
let gamepadInputHandler = null;
const TICK_DT = 1 / TICK_RATE;
let moveAccumulator = 0;
let moveEmitAccumulator = 0;
let moveSequence = 0;
let enemyHitboxPhase = 0;
/** Fixed-tick simulation position; myX/myZ interpolate between prevSim and sim for smooth rendering. */
let simX = 0;
let simZ = 0;
let prevSimX = 0;
let prevSimZ = 0;
let lastEmittedRotation = null;
const ROTATION_SYNC_EPS = 0.02;

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

// ── Enemy geometry table ──
const ENEMY_GEOMETRY = {
	grunt:      { type: 'cone', radius: 0.5, height: 1, segments: 8, color: 0xdc2626 },
	skirmisher: { type: 'cone', radius: 0.3, height: 0.6, segments: 8, color: 0xff6600 },
	miniboss:   { type: 'cone', radius: 0.8, height: 1.8, segments: 12, color: 0x8800cc },
	spawner:    { type: 'octahedron', radius: 0.6, color: 0x00ccaa, emissive: 0x00ccaa, emissiveIntensity: 0.4 },
};

/** Windup telegraph shape per enemy type — mirrors server ENEMY_DEFS attackStyle */
const ENEMY_ATTACK_VISUAL = {
	grunt:      { style: 'radial' },
	skirmisher: { style: 'cone', coneAngle: Math.PI / 3, color: 0xff6600, emissive: 0xff3300 },
	miniboss:   { style: 'cone', coneAngle: Math.PI / 2, range: 5, color: 0xaa44ff, emissive: 0x8800cc },
	spawner:    { style: 'radial' },
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
 * resolves. In this sub-ticket every registry path is null, so the early return
 * always fires and visuals are byte-identical to before.
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
			// glTF model instead of the now-hidden procedural primitive.
			if (key === 'player') retargetPlayerBodyMesh(host, model);
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

function isTypingTarget(target) {
	return target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target?.isContentEditable;
}

function resetMovementKeys() {
	for (const key of Object.keys(keys)) keys[key] = false;
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

function getKeyboardMovement() {
	let inputX = 0;
	let inputZ = 0;
	if (keys.w) inputZ += 1;
	if (keys.s) inputZ -= 1;
	if (keys.a) inputX -= 1;
	if (keys.d) inputX += 1;
	const mag = Math.hypot(inputX, inputZ);
	if (mag <= 0) return null;
	return { x: inputX / mag, z: inputZ / mag };
}

function getGamepadRuntimeOptions() {
	const gpCfg = getGamepadConfig();
	return {
		deadzone: typeof gpCfg.deadzone === 'number' ? gpCfg.deadzone : undefined,
		moveStick: gpCfg.moveStick === 'right' ? 'right' : 'left',
	};
}

function getMovementInput() {
	const { deadzone, moveStick } = getGamepadRuntimeOptions();
	return mergeMovementVectors(getKeyboardMovement(), pollGamepadMovement(deadzone, moveStick));
}

function getCameraForwardDirection() {
	return cameraRelativeDirection(0, 1);
}

function applyLockOnPress() {
	if (currentGamePhase !== 'playing') return;
	const gs = gameStateRef;
	if (!gs?.enemies) return;

	const result = handleLockOnPress(
		gs.enemies,
		simX,
		simZ,
		getLockOnRepeatAction(),
		playerRotation,
	);

	if (result.action === 'locked' && result.enemy) {
		clearLockOnCameraRelease();
		lockOnReleaseLookAt = null;
		resetLockOnTracking();
		const toTarget = getDirectionToTarget(simX, simZ, result.enemy);
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

function syncFacingToServer() {
	if (!socketRef || !myIdRef) return;
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
	socketRef.emit('move', { dx: 0, dz: 0, rotation: playerRotation });
}

// Orbit height/lookAt follow the local avatar Y (sampleFloorY on slopes; server
// applyPlayerMovement keeps player.y in sync). Spire-ascent and sunken-canyon
// need this — pinning to DEFAULT_FLOOR_Y would leave the camera behind on ramps.
function updateCameraOrbit(playerX, playerY, playerZ, delta) {
	if (!camera) return;

	const targetX = playerX + Math.sin(cameraYaw) * CAMERA_DISTANCE;
	const targetY = playerY + CAMERA_HEIGHT;
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
 * Register a callback for gamepad card/deck actions each frame.
 * @param {(actions: { slots: number[], toggleDeck: boolean, lockOn: boolean }) => void} handler
 */
export function setGamepadInputHandler(handler) {
	gamepadInputHandler = handler;
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
		telegraphMeshes,
		minionTelegraphMeshes,
		minionsMeshes,
		lootMeshes,
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
}

/**
 * Whether the local player is currently holding movement keys.
 * @returns {boolean}
 */
export function isPlayerMoving() {
	const { deadzone, moveStick } = getGamepadRuntimeOptions();
	return keys.w || keys.a || keys.s || keys.d || isGamepadMoving(deadzone, moveStick);
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
	socketRef.emit('lootPickup', { lootId: loot.id });
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
	scene.background = new THREE.Color(0x0f172a);

	// Camera
	camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, CAMERA_NEAR, CAMERA_FAR);
	spawnPosition.x = spawnPos ? spawnPos.x : 0;
	spawnPosition.z = spawnPos ? spawnPos.z : 0;
	cameraYaw = 0;
	camera.position.set(
		spawnPosition.x + Math.sin(cameraYaw) * CAMERA_DISTANCE,
		CAMERA_HEIGHT,
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

	// Place player at spawn position
	myX = spawnPosition.x;
	myZ = spawnPosition.z;
	simX = spawnPosition.x;
	simZ = spawnPosition.z;
	prevSimX = spawnPosition.x;
	prevSimZ = spawnPosition.z;
	moveAccumulator = 0;

	// Input tracking
	if (!inputListenersAdded) {
		window.addEventListener('keydown', (e) => {
			if (isTypingTarget(e.target)) return;
			if (e.key.toLowerCase() === 'z') {
				if (e.repeat || currentGamePhase !== 'playing') return;
				e.preventDefault();
				applyLockOnPress();
				return;
			}
			if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;
		});
		window.addEventListener('keyup', (e) => {
			if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false;
		});
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
}

// ── Player movement ──

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
		return;
	}

	const lockState = updateLockOn(
		gameStateRef?.enemies,
		simX,
		simZ,
		delta,
		cameraYaw,
		playerRotation,
	);

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

	const movement = getMovementInput();

	if (movement) {
		moveAccumulator += delta;
		moveEmitAccumulator += delta;
		// Target-relative while locked: stick up/down closes or opens distance,
		// left/right strafes. Uses live bearing so frozen close-range camera
		// aim does not swap or zero out forward/back input.
		const dir = lockState.locked && lockState.liveToTarget
			? targetRelativeDirection(movement.x, movement.z, lockState.liveToTarget)
			: cameraRelativeDirection(movement.x, movement.z);
		const dirX = dir.x;
		const dirZ = dir.z;
		const moveRotation = lockState.locked
			? playerRotation
			: Math.atan2(dirZ, dirX);

		while (moveAccumulator >= TICK_DT) {
			prevSimX = simX;
			prevSimZ = simZ;
			const result = tryPlayerMove(
				simX, simZ, dirX, dirZ, MOVE_SPEED * TICK_DT,
				wallColliders, walkableAABBs, dungeonBounds
			);
			simX = result.x;
			simZ = result.z;
			moveAccumulator -= TICK_DT;
		}

		while (moveEmitAccumulator >= TICK_DT && socketRef) {
			moveEmitAccumulator -= TICK_DT;
			moveSequence += 1;
			lastEmittedRotation = moveRotation;
			socketRef.emit('move', {
				dx: dirX,
				dz: dirZ,
				rotation: moveRotation,
				sequence: moveSequence,
			});
		}
	} else {
		moveEmitAccumulator = 0;
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

// Per-hat colors, distinct from one another and from the default body/accent.
const HAT_CAP_COLOR = 0x2e7d32; // forest green
const HAT_WIZARD_COLOR = 0x5b3a8a; // deep purple
const HAT_CROWN_COLOR = 0xffd700; // gold
const HAT_BANDANA_COLOR = 0xc62828; // crimson red
const HAT_BEANIE_COLOR = 0x00695c; // slate teal

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
	return `${shape}|${body}|${accent}|${hat}`;
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
 * @returns {THREE.Group}
 */
export function createPlayerAvatar(cosmetic, isSelf) {
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

	group.userData.isAvatar = true;
	group.userData.bodyMesh = bodyMesh;
	group.userData.accentMesh = accentMesh;
	group.userData.baseColor = bodyHex;
	group.userData.cosmeticKey = cosmeticSignature(c);

	attachRegistryModel('player', group);

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
	const gamepadActions = pollGamepadButtons();
	if (gamepadInputHandler) {
		gamepadInputHandler(gamepadActions);
	}
	if (currentGamePhase === 'playing' && gamepadActions.lockOn) {
		applyLockOnPress();
	}

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
				const avatar = createPlayerAvatar(pData.cosmetic, id === myId);
				scene.add(avatar);
				playersMeshes[id] = avatar;
			}

			// (Re)apply proportion morphs + body/accent tint from the broadcast
			// cosmetic every update (local + remote) so changes take effect without
			// a reload; safe no-op on the procedural fallback. Runs before either
			// recolor path below reads userData.baseColor.
			applyLoadedModelCosmetic(playersMeshes[id], pData.cosmetic);

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
		}

		// Clean up removed enemies
		disposeStaleMeshes(enemiesMeshes, currentEnemyIds, scene);
		disposeStaleMeshes(enemyHealthBars, currentEnemyIds, scene);
		disposeStaleMeshes(enemyHitboxMeshes, currentEnemyIds, scene);
		disposeStaleMeshes(enemyLockOnRings, currentEnemyIds, scene);
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
		syncTelepipeMesh();
	}

	// Animate loot coins (outside gameState guard)
	animateLootMeshes();

	if (myId != null && playersMeshes[myId]) {
		const playerPos = playersMeshes[myId].position;
		updateCameraOrbit(playerPos.x, playerPos.y, playerPos.z, delta);
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
