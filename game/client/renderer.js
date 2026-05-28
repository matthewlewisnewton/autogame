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
	getLockedEnemyId,
	clearLockOn,
	handleLockOnPress,
	updateLockOn,
	getDirectionToTarget,
	resetLockOnCameraTracking,
	normalizeAngle,
} from './lockOn.js';
import { getLockOnRepeatAction, getGamepadConfig } from './settings.js';

// ── Three.js scene references ──
let scene, camera, renderer, clock;
const playersMeshes = {};
const enemiesMeshes = {};
const enemyHealthBars = {}; // enemy id → health bar mesh
const enemyHitboxMeshes = {}; // enemy id → pulsing hitbox group
const telegraphMeshes = {}; // enemy id → warning ring mesh (ground circle during windup)
const enemyLockOnRings = {}; // enemy id → lock-on reticle ring
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
	emissive: 0xffa500,
	emissiveIntensity: 0.4,
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
	color: 0xfbbf24,
	emissive: 0xf59e0b,
	emissiveIntensity: 1.1,
	roughness: 0.15,
	metalness: 0.85,
});
const collectingLoot = {}; // lootId → { mesh, value, createdAt }
const previousLootValues = {}; // lootId → { value, kind }

// ── Damage number tracking ──
const damageNumbers = []; // { element, createdAt, position3d, duration }

// ── Card hit tracking ──
const lastCardHitTime = {}; // enemyId → performance.now() of last card hit
const previousEnemyHp = {}; // enemyId → hp from previous frame
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
		resetLockOnCameraTracking();
		lockOnToTarget = getDirectionToTarget(simX, simZ, result.enemy);
		playerRotation = Math.atan2(lockOnToTarget.z, lockOnToTarget.x);
		lastEmittedRotation = playerRotation;
		if (result.cameraYaw != null) {
			cameraYaw = normalizeAngle(result.cameraYaw);
		}
	} else {
		lockOnToTarget = null;
		if (result.cameraYaw != null) {
			cameraYaw = normalizeAngle(result.cameraYaw);
		}
	}
}

function updatePlayerFacing() {
	if (isLockOnActive() && lockOnToTarget) {
		playerRotation = Math.atan2(lockOnToTarget.z, lockOnToTarget.x);
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

function updateCameraOrbit(playerX, playerY, playerZ, delta) {
	if (!camera) return;

	const targetX = playerX + Math.sin(cameraYaw) * CAMERA_DISTANCE;
	const targetY = playerY + CAMERA_HEIGHT;
	const targetZ = playerZ + Math.cos(cameraYaw) * CAMERA_DISTANCE;
	if (isLockOnActive()) {
		camera.position.set(targetX, targetY, targetZ);
	} else {
		const target = new THREE.Vector3(targetX, targetY, targetZ);
		camera.position.lerp(target, 5.0 * delta);
	}
	camera.lookAt(playerX, playerY, playerZ);
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
				color: 0xf59e0b,
				transparent: true,
				opacity: 0.45,
				side: THREE.DoubleSide,
			}),
		);
		ring.rotation.x = -Math.PI / 2;
		ring.position.y = 0.04;
		group.add(ring);

		group.position.set(item.x, 0, item.z);
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
	camera.lookAt(spawnPosition.x, 0, spawnPosition.z);

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
		clearLockOn();
		lockOnToTarget = null;
		return;
	}

	const lockState = updateLockOn(
		gameStateRef?.enemies,
		simX,
		simZ,
		delta,
		cameraYaw,
	);

	if (lockState.locked) {
		playerRotation = lockState.playerRotation;
		cameraYaw = lockState.cameraYaw;
		lockOnToTarget = lockState.toTarget;
	} else {
		lockOnToTarget = null;
		cameraYaw += pollGamepadLook(delta, getGamepadRuntimeOptions().deadzone);
	}

	const movement = getMovementInput();

	if (movement) {
		moveAccumulator += delta;
		moveEmitAccumulator += delta;
		// Camera-relative movement even while locked — stick/keys match the view.
		// Character facing and attacks still track the locked target separately.
		const dir = cameraRelativeDirection(movement.x, movement.z);
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

// ── Flash mesh helper ──

/**
 * Flash a mesh by setting its material emissive to a bright color,
 * then restoring the original emissive/intensity after `durationMs`.
 * @param {THREE.Mesh} mesh
 * @param {number} color - hex color (e.g. 0xffffff)
 * @param {number} durationMs - how long the flash lasts
 */
export function flashMesh(mesh, color, durationMs) {
	if (!mesh || !mesh.material) return;

	// Save original emissive state
	const mat = mesh.material;
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

// ── Floating damage numbers ──

/**
 * Spawn a floating number above a 3D position.
 * @param {number} x - 3D X coordinate
 * @param {number} y - 3D Y coordinate (height above ground)
 * @param {number} z - 3D Z coordinate
 * @param {number} amount - amount to display
 * @param {string} color - CSS color string
 * @param {boolean} positive - if true, show as "+N" instead of "-N"
 */
export function spawnDamageNumber(x, y, z, amount, color, positive) {
	if (!document.body) return;

	const rounded = Math.abs(Math.round(amount));
	const prefix = positive ? '+' : '-';
	const el = document.createElement('div');
	el.textContent = `${prefix}${rounded}`;
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
	return new THREE.Mesh(geo, mat);
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

function createEnemyAttackTelegraph(enemy, targetPlayer) {
	const visual = ENEMY_ATTACK_VISUAL[enemy.type] || ENEMY_ATTACK_VISUAL.grunt;
	const range = visual.range ?? ENEMY_ATTACK_RANGE;

	if (visual.style === 'cone') {
		const direction = getEnemyWindupDirection(enemy, targetPlayer);
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
	const tx = targetPlayer ? targetPlayer.x : enemy.x;
	const tz = targetPlayer ? targetPlayer.z : enemy.z;
	mesh.position.set(tx, GROUND_OVERLAY_Y, tz);
	return mesh;
}

function updateEnemyAttackTelegraph(enemy, telegraph, targetPlayer) {
	const visual = ENEMY_ATTACK_VISUAL[enemy.type] || ENEMY_ATTACK_VISUAL.grunt;
	if (visual.style === 'cone') {
		telegraph.position.set(enemy.x, GROUND_OVERLAY_Y, enemy.z);
	} else if (targetPlayer) {
		telegraph.position.set(targetPlayer.x, GROUND_OVERLAY_Y, targetPlayer.z);
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

function createConeHitboxGroup(direction, range, coneAngle, style) {
	const dirAngle = Math.atan2(direction.z, direction.x);
	const group = new THREE.Group();
	const color = style.color ?? 0xffdd44;
	const emissive = style.emissive ?? 0xffaa00;
	const fillMat = makeHitboxMaterial(color, emissive, HITBOX_FILL_OPACITY);
	const edgeMat = makeHitboxMaterial(color, emissive, HITBOX_EDGE_OPACITY);

	const fill = new THREE.Mesh(
		new THREE.RingGeometry(0.05, range, 48, dirAngle - coneAngle / 2, coneAngle),
		fillMat,
	);
	fill.rotation.x = -Math.PI / 2;
	fill.userData.hitboxOpacity = HITBOX_FILL_OPACITY;
	group.add(fill);

	const edgeWidth = Math.min(0.12, range * 0.04);
	const edge = new THREE.Mesh(
		new THREE.RingGeometry(
			Math.max(0.05, range - edgeWidth),
			range,
			48,
			dirAngle - coneAngle / 2,
			coneAngle,
		),
		edgeMat,
	);
	edge.rotation.x = -Math.PI / 2;
	edge.userData.hitboxOpacity = HITBOX_EDGE_OPACITY;
	group.add(edge);

	const boundaryPoints = [
		new THREE.Vector3(0, 0, 0),
		new THREE.Vector3(Math.cos(dirAngle - coneAngle / 2) * range, 0, Math.sin(dirAngle - coneAngle / 2) * range),
		new THREE.Vector3(0, 0, 0),
		new THREE.Vector3(Math.cos(dirAngle + coneAngle / 2) * range, 0, Math.sin(dirAngle + coneAngle / 2) * range),
	];
	const boundaryGeo = new THREE.BufferGeometry().setFromPoints(boundaryPoints);
	const boundary = new THREE.LineSegments(
		boundaryGeo,
		new THREE.LineBasicMaterial({ color, transparent: true, opacity: HITBOX_EDGE_OPACITY }),
	);
	boundary.userData.hitboxOpacity = HITBOX_EDGE_OPACITY;
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
	const group = createConeHitboxGroup(direction, range, coneAngle, { color, emissive });
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
		duration: ATTACK_EFFECT_DURATION,
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
 */
export function spawnHitSpark(position) {
	// Use test-scene override if available (set via window.__setScene in tests)
	const targetScene = window.___test_scene || scene;
	if (!targetScene) return;

	const geometry = new THREE.IcosahedronGeometry
		? new THREE.IcosahedronGeometry(0.15, 0)
		: new THREE.SphereGeometry(0.15, 6, 6);
	const material = new THREE.MeshStandardMaterial({
		color: 0xffee44,
		emissive: 0xffaa00,
		emissiveIntensity: 1.2,
		transparent: true,
		opacity: 1.0,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.position.set(position.x, position.y || 1.0, position.z);
	targetScene.add(mesh);

	activeEffects.push({
		mesh,
		_scene: targetScene,
		origin: { x: position.x, y: position.y || 1.0, z: position.z },
		direction: null,
		isHitSpark: true,
		createdAt: performance.now(),
		duration: HIT_SPARK_DURATION,
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
		isMagicStone ? `+${value} MS` : value,
		isMagicStone ? '#fbbf24' : '#ffd700',
		true,
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
			if (!playersMeshes[id]) {
				const geo = new THREE.BoxGeometry(1, 1, 1);
				const mat = new THREE.MeshStandardMaterial({ color: id === myId ? 0x3b82f6 : 0xf43f5e });
				const mesh = new THREE.Mesh(geo, mat);
				scene.add(mesh);
				playersMeshes[id] = mesh;
			}

			if (id === myId) continue;

			playersMeshes[id].position.set(pData.x, pData.y || 0.5, pData.z);
			if (Number.isFinite(pData.rotation)) {
				playersMeshes[id].rotation.y = pData.rotation - Math.PI / 2;
			}

			if (pData.dead) {
				playersMeshes[id].material.color.setHex(0x808080);
			} else {
				playersMeshes[id].material.color.setHex(0xf43f5e);
			}

			// Detect remote player HP drop — flash red
			if (previousPlayerHp[id] !== undefined && pData.hp < previousPlayerHp[id]) {
				flashMesh(playersMeshes[id], 0xff0000, 200);
			}
			previousPlayerHp[id] = pData.hp;
		}

		if (myId != null && playersMeshes[myId]) {
			playersMeshes[myId].position.set(myX, 0.5, myZ);
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
				clearLockOn();
				lockOnToTarget = null;
			}
			if (isDead) {
				clearLockOn();
				lockOnToTarget = null;
			}
			wasDead = isDead;

			if (isDead) {
				playersMeshes[myId].material.color.setHex(0x808080);
			} else {
				playersMeshes[myId].material.color.setHex(0x3b82f6);
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

		// ── Enemy mesh sync ──
		const currentEnemyIds = new Set(gs.enemies.map((e) => e.id));

		for (const enemy of gs.enemies) {
			if (!enemiesMeshes[enemy.id]) {
				const mesh = createEnemyMesh(enemy.type);
				scene.add(mesh);
				enemiesMeshes[enemy.id] = mesh;

				enemyHealthBars[enemy.id] = createHealthBarMesh(enemy.id, enemy.x, enemy.z, enemy.type);
				enemyHitboxMeshes[enemy.id] = createEnemyHitboxGroup(ENTITY_RADIUS);
				scene.add(enemyHitboxMeshes[enemy.id]);
			}
			const halfHeight = enemyMeshHalfHeight(enemy.type);
			enemiesMeshes[enemy.id].position.set(enemy.x, halfHeight, enemy.z);

			enemyHealthBars[enemy.id].position.set(enemy.x, halfHeight + 0.5, enemy.z);
			if (enemyHitboxMeshes[enemy.id]) {
				enemyHitboxMeshes[enemy.id].position.set(enemy.x, GROUND_OVERLAY_Y, enemy.z);
			}
			updateHealthBarMesh(enemy.id, enemy);
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
					flashMesh(enemiesMeshes[enemy.id], fromThunderbird ? 0x38bdf8 : (fromAncientWyrm ? 0xfb923c : 0xff4444), 150);
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
					} else {
						spawnHitSpark({ x: enemy.x, y: halfHeight, z: enemy.z });
					}

					if (nearestMinion && minionsMeshes[nearestMinion.id]) {
						flashMesh(
							minionsMeshes[nearestMinion.id],
							fromThunderbird ? 0x7dd3fc : (fromAncientWyrm ? 0xfb923c : 0x88ff88),
							200
						);
					}
				}
			}
			previousEnemyHp[enemy.id] = enemy.hp;

			// ── Telegraph visuals (windup state) ──
			if (enemy.attackState === 'windup') {
				applyWindupFlash(enemy.id, true);

				const targetPlayer = enemy.windupTargetId ? gs.players[enemy.windupTargetId] : null;
				if (!telegraphMeshes[enemy.id]) {
					const telegraph = createEnemyAttackTelegraph(enemy, targetPlayer);
					scene.add(telegraph);
					telegraphMeshes[enemy.id] = telegraph;
				} else {
					updateEnemyAttackTelegraph(enemy, telegraphMeshes[enemy.id], targetPlayer);
				}
			} else {
				disposeOne(telegraphMeshes, enemy.id, scene);
				applyWindupFlash(enemy.id, false);
			}
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
				const isWyrm = minion.type === 'ancient_wyrm';
				const radius = isWyrm ? 0.6 : 0.4;
				const height = isWyrm ? 1.5 : 1;
				const geo = new THREE.CylinderGeometry(radius, radius, height, 8);
				const mat = new THREE.MeshStandardMaterial({
					color: isWyrm ? 0x9333ea : 0x22c55e,
					emissive: isWyrm ? 0xef4444 : 0x000000,
					emissiveIntensity: isWyrm ? 0.35 : 0,
				});
				const mesh = new THREE.Mesh(geo, mat);
				if (isWyrm) {
					mesh.scale.set(1.5, 1.5, 1.5);
				}
				scene.add(mesh);
				minionsMeshes[minion.id] = mesh;
			}
			minionsMeshes[minion.id].position.set(minion.x, 0.5, minion.z);
		}

		disposeStaleMeshes(minionsMeshes, currentMinionIds, scene);

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
