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
	resolveWallCollision as resolveWallCollisionFromDungeon,
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
	ATTACK_EFFECT_DURATION,
	ATTACK_EFFECT_SPEED,
	SUMMON_EFFECT_DURATION,
	SUMMON_EXPAND_MS,
	HIT_SPARK_DURATION,
	LOOT_COLLECT_DURATION,
	DAMAGE_NUMBER_DURATION,
	CAMERA_FOV,
	CAMERA_NEAR,
	CAMERA_FAR,
	MOVE_SPEED,
	MAX_ELAPSED_MS,
	CAMERA_OFFSET as CAMERA_OFFSET_CONFIG,
	ENEMY_ATTACK_RANGE,
	MAX_HP,
	MAX_MS,
} from './config.js';

// ── Three.js scene references ──
let scene, camera, renderer, clock;
const playersMeshes = {};
const enemiesMeshes = {};
const enemyHealthBars = {}; // enemy id → health bar mesh
const telegraphMeshes = {}; // enemy id → warning ring mesh (ground circle during windup)
const windupFlashing = new Set(); // enemy ids currently showing windup emissive
const minionsMeshes = {};
const lootMeshes = {};
const activeEffects = []; // { mesh, origin, direction, createdAt, duration }

// ── Player local state ──
let myX = 0;
let myZ = 0;
let playerRotation = 0; // facing angle in radians
let wasDead = false; // tracks previous-frame dead state for respawn detection
let spawnPosition = { x: 0, z: 0 };
let wallColliders = []; // flat array of wall AABBs
let dungeonMeshes = []; // meshes created by buildDungeon()

// ── Shared state references (set by main.js) ──
let gameStateRef = null; // reference to gameState object set by main.js
let myIdRef = null; // current player id string
let socketRef = null; // socket instance for emitting 'move'

// ── Input state ──
const keys = { w: false, a: false, s: false, d: false };
let inputListenersAdded = false;

// ── Loot state ──
const lootGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
const lootMaterial = new THREE.MeshStandardMaterial({
	color: 0xffd700,
	emissive: 0xffa500,
	emissiveIntensity: 0.4,
	roughness: 0.3,
	metalness: 0.8,
});
const collectingLoot = {}; // lootId → { mesh, value, createdAt }
const previousLootValues = {}; // lootId → value — persists value after loot is removed

// ── Damage number tracking ──
const damageNumbers = []; // { element, createdAt, position3d, duration }

// ── Card hit tracking ──
const lastCardHitTime = {}; // enemyId → performance.now() of last card hit
const previousEnemyHp = {}; // enemyId → hp from previous frame
const previousPlayerHp = {}; // playerId → hp from previous frame
const pickedUpLootIds = new Set(); // throttle: loot IDs already emitted for pickup

// ── Scene init flag ──
let sceneInitialized = false;

// ── Enemy geometry table ──
const ENEMY_GEOMETRY = {
	grunt:      { type: 'cone', radius: 0.5, height: 1, segments: 8, color: 0xdc2626 },
	skirmisher: { type: 'cone', radius: 0.3, height: 0.6, segments: 8, color: 0xff6600 },
	miniboss:   { type: 'cone', radius: 0.8, height: 1.8, segments: 12, color: 0x8800cc },
	spawner:    { type: 'octahedron', radius: 0.6, color: 0x00ccaa, emissive: 0x00ccaa, emissiveIntensity: 0.4 },
};

const CAMERA_OFFSET = new THREE.Vector3(CAMERA_OFFSET_CONFIG.x, CAMERA_OFFSET_CONFIG.y, CAMERA_OFFSET_CONFIG.z);

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
 * Set the internal player position (used for snapping to spawn on reconnect).
 * @param {number} x
 * @param {number} z
 */
export function setPlayerPosition(x, z) {
	myX = x;
	myZ = z;
}

/**
 * Get the player rotation.
 * @returns {number}
 */
export function getPlayerRotation() {
	return playerRotation;
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
 * Get the pickedUpLootIds set.
 * @returns {Set}
 */
export function getPickedUpLootIds() {
	return pickedUpLootIds;
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
	camera.position.set(spawnPosition.x, 5, spawnPosition.z + 10);
	camera.lookAt(spawnPosition.x, 0, spawnPosition.z);

	// Renderer
	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);

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
	}

	// Place player at spawn position
	myX = spawnPosition.x;
	myZ = spawnPosition.z;

	// Input tracking
	if (!inputListenersAdded) {
		window.addEventListener('keydown', (e) => {
			if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;
		});
		window.addEventListener('keyup', (e) => {
			if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false;
		});
		inputListenersAdded = true;
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

// ── Game phase ──

let currentGamePhase = 'lobby';

/**
 * Tell the renderer the current game phase (for visibility toggles).
 * @param {string} phase
 */
export function setGamePhase(phase) {
	currentGamePhase = phase;
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
	if (me && me.dead) return;

	// Compute movement direction from active keys, normalize to unit vector
	let dirX = 0, dirZ = 0;
	if (keys.w) dirZ -= 1;
	if (keys.s) dirZ += 1;
	if (keys.a) dirX -= 1;
	if (keys.d) dirX += 1;
	const mag = Math.hypot(dirX, dirZ);
	if (mag > 0) {
		dirX /= mag;
		dirZ /= mag;
	}

	if (mag > 0) {
		// Cap delta to prevent over-correction after input stalls
		const cappedDelta = Math.min(delta, MAX_ELAPSED_MS / 1000);

		// Apply fixed speed matching server's MOVE_SPEED
		myX += dirX * MOVE_SPEED * cappedDelta;
		myZ += dirZ * MOVE_SPEED * cappedDelta;

		// Resolve wall collision before applying position
		const resolved = resolveWallCollisionFromDungeon(myX, myZ, wallColliders);
		myX = resolved.x;
		myZ = resolved.z;

		// Derive facing angle from movement direction
		playerRotation = Math.atan2(dirZ, dirX);

		// Emit move intent using normalized direction
		if (socketRef) {
			socketRef.emit('move', { dx: dirX, dz: dirZ, rotation: playerRotation });
		}
	}
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

/**
 * Spawn a yellow sphere projectile at origin moving in direction.
 * @param {object} origin - { x, z }
 * @param {object} direction - { x, z }
 */
export function spawnAttackEffect(origin, direction, style = {}) {
	const geometry = new THREE.SphereGeometry(0.3, 8, 8);
	const material = new THREE.MeshStandardMaterial({
		color: style.color ?? 0xffdd44,
		emissive: style.emissive ?? 0xffaa00,
		emissiveIntensity: 0.8,
		transparent: true,
		opacity: 1.0,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.position.set(origin.x, 1.0, origin.z);
	const targetScene = (typeof window !== 'undefined' && window.___test_scene) || scene;
	if (targetScene) targetScene.add(mesh);

	activeEffects.push({
		mesh,
		origin: { x: origin.x, z: origin.z },
		direction: { x: direction.x, z: direction.z },
		createdAt: performance.now(),
		duration: ATTACK_EFFECT_DURATION,
	});
}

/**
 * Spawn an expanding ring AoE effect on the ground.
 * @param {object} origin - { x, z }
 * @param {number} radius
 */
export function spawnSummonEffect(origin, radius, style = {}) {
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

		// ── Weapon projectile effect ──
		const t = Math.min(elapsed / 1000, 1.0);
		const travel = ATTACK_EFFECT_SPEED * t;
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
		if (mesh.geometry) mesh.geometry.dispose();
		if (mesh.material) mesh.material.dispose();
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
export function markLootCollected(lootId, value) {
	const mesh = lootMeshes[lootId];
	if (!mesh || !scene) return;

	const px = mesh.position.x;
	const pz = mesh.position.z;

	delete lootMeshes[lootId];
	collectingLoot[lootId] = { mesh, value, createdAt: performance.now() };

	spawnDamageNumber(px, 1.0, pz, value, '#ffd700', true);
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
			entry.mesh.material.opacity = Math.max(0.01, 1.0 - (t - 0.5) / 0.5);
		}

		entry.mesh.position.y = 0.5 + t * 1.5;

		if (elapsed >= LOOT_COLLECT_DURATION) {
			scene.remove(entry.mesh);
			delete collectingLoot[id];
		}
	}
}

/**
 * Sync loot meshes with current gameState.loot.
 */
export function syncLootMeshes() {
	if (!gameStateRef || !gameStateRef.loot) return;

	const currentLootIds = new Set(gameStateRef.loot.map((l) => l.id));

	for (const item of gameStateRef.loot) {
		previousLootValues[item.id] = item.value || 1;
	}

	// Add / update new loot
	for (const item of gameStateRef.loot) {
		if (!lootMeshes[item.id]) {
			const mesh = new THREE.Mesh(lootGeometry, lootMaterial);
			mesh.position.set(item.x, 0.5, item.z);
			scene.add(mesh);
			lootMeshes[item.id] = mesh;
		}
	}

	// Remove stale loot — play collection animation
	for (const id of Object.keys(lootMeshes)) {
		if (!currentLootIds.has(id)) {
			const lootValue = previousLootValues[id] || 1;
			delete previousLootValues[id];
			markLootCollected(id, lootValue);
		}
	}
}

/**
 * Bob and rotate loot meshes each frame.
 */
export function animateLootMeshes() {
	const t = performance.now();
	for (const mesh of Object.values(lootMeshes)) {
		mesh.position.y = 0.5 + Math.sin(t / 300) * 0.15;
		mesh.rotation.y += 0.02;
	}
}

/**
 * Dispose all loot meshes (shared geometry/material — skip disposal).
 */
export function disposeAllLootMeshes() {
	disposeMeshMap(lootMeshes, scene, true);
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

	clock.update(timestamp);
	const delta = clampDelta(clock.getDelta());
	updateMyPlayer(delta);

	const gs = gameStateRef;
	const myId = myIdRef;

	// ── Loot proximity check ──
	if (gs && gs.loot && gs.loot.length > 0) {
		const localPlayer = gs.players[myId];
		if (localPlayer && !localPlayer.dead) {
			for (const loot of gs.loot) {
				if (Math.hypot(myX - loot.x, myZ - loot.z) <= 2) {
					if (!pickedUpLootIds.has(loot.id)) {
						pickedUpLootIds.add(loot.id);
						if (socketRef) {
							socketRef.emit('lootPickup', { lootId: loot.id });
						}
					}
					break; // one pickup per frame
				}
			}
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

			const me = gs.players[myId];
			const isDead = me && me.dead;

			// Respawn detection: dead → alive resets local position to spawn
			if (wasDead && !isDead) {
				myX = spawnPosition.x;
				myZ = spawnPosition.z;
				playerRotation = 0;
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
			}
			const halfHeight = enemyMeshHalfHeight(enemy.type);
			enemiesMeshes[enemy.id].position.set(enemy.x, halfHeight, enemy.z);

			enemyHealthBars[enemy.id].position.set(enemy.x, halfHeight + 0.5, enemy.z);
			updateHealthBarMesh(enemy.id, enemy);

			// Detect HP drop (minion tick damage) — skip if caused by a recent cardUsed hit
			if (previousEnemyHp[enemy.id] !== undefined && enemy.hp < previousEnemyHp[enemy.id]) {
				const cardHit = lastCardHitTime[enemy.id];
				const withinGrace = cardHit !== undefined && (performance.now() - cardHit) < CARD_HIT_GRACE_MS;
				if (!withinGrace) {
					flashMesh(enemiesMeshes[enemy.id], 0xff4444, 150);
					spawnHitSpark({ x: enemy.x, y: halfHeight, z: enemy.z });

					// Flash the nearest living minion
					let nearestMinion = null;
					let nearestMinionDist = Infinity;
					for (const m of (gs.minions || [])) {
						const mdist = Math.hypot(m.x - enemy.x, m.z - enemy.z);
						if (mdist < nearestMinionDist && minionsMeshes[m.id]) {
							nearestMinionDist = mdist;
							nearestMinion = m;
						}
					}
					if (nearestMinion && minionsMeshes[nearestMinion.id]) {
						flashMesh(minionsMeshes[nearestMinion.id], 0x88ff88, 200);
					}
				}
			}
			previousEnemyHp[enemy.id] = enemy.hp;

			// ── Telegraph visuals (windup state) ──
			if (enemy.attackState === 'windup') {
				applyWindupFlash(enemy.id, true);

				if (!telegraphMeshes[enemy.id]) {
					const targetPlayer = enemy.windupTargetId ? gs.players[enemy.windupTargetId] : null;
					const tx = targetPlayer ? targetPlayer.x : enemy.x;
					const tz = targetPlayer ? targetPlayer.z : enemy.z;

					const geo = new THREE.RingGeometry(ENEMY_ATTACK_RANGE * 0.9, ENEMY_ATTACK_RANGE, 32);
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
					mesh.position.set(tx, 0.05, tz);
					mesh.rotation.x = -Math.PI / 2;
					scene.add(mesh);
					telegraphMeshes[enemy.id] = mesh;
				} else {
					const targetPlayer = enemy.windupTargetId ? gs.players[enemy.windupTargetId] : null;
					if (targetPlayer) {
						telegraphMeshes[enemy.id].position.set(targetPlayer.x, 0.05, targetPlayer.z);
					}
				}
			} else {
				disposeOne(telegraphMeshes, enemy.id, scene);
				applyWindupFlash(enemy.id, false);
			}
		}

		// Clean up removed enemies
		disposeStaleMeshes(enemiesMeshes, currentEnemyIds, scene);
		disposeStaleMeshes(enemyHealthBars, currentEnemyIds, scene);
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
				const geo = new THREE.CylinderGeometry(0.4, 0.4, 1, 8);
				const mat = new THREE.MeshStandardMaterial({ color: 0x22c55e });
				const mesh = new THREE.Mesh(geo, mat);
				scene.add(mesh);
				minionsMeshes[minion.id] = mesh;
			}
			minionsMeshes[minion.id].position.set(minion.x, 0.5, minion.z);
		}

		disposeStaleMeshes(minionsMeshes, currentMinionIds, scene);

		// ── Loot mesh sync ──
		syncLootMeshes();
	}

	// Animate loot coins (outside gameState guard)
	animateLootMeshes();

	if (myId != null && playersMeshes[myId]) {
		const target = playersMeshes[myId].position.clone().add(CAMERA_OFFSET);
		camera.position.lerp(target, 5.0 * clampDelta(clock.getDelta()));
		camera.lookAt(playersMeshes[myId].position);
	}

	// Animate attack visual effects
	updateAttackEffects();

	// Update floating damage numbers
	updateDamageNumbers();

	// Update collecting-loot animations
	updateCollectingLoot();

	renderer.render(scene, camera);
}

// ── Expose ENEMY_GEOMETRY for external access ──
export { ENEMY_GEOMETRY };
