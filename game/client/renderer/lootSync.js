// ── Loot-Domain + Ice-Ball + Telepipe-Portal Mesh Sync ──
// Owns the loot pickup/animation domain (per-frame loot reconcile, the collected
// scale-up/fade animation, the floating value number, and the idle bob/spin),
// the glacial-thrower ice-ball projectile reconcile, and the shared telepipe
// portal mesh (build, sync, dispose, and the per-frame shimmer/orbit/particle
// animation). The loot-only helper + state cluster these drive lives here too:
// the shared loot geometry/material palette, cloneLootMaterial / createLootMesh /
// getLootBaseY / disposeLootMeshMaterials, the collectingLoot + previousLootValues
// tables, the LOOT_FLOAT_COLOR_* constants, createIceBallMesh + ICE_BALL_HEIGHT,
// and the telepipe build/dispose/particle helpers.
//
// Scene + keyed mesh-map stores (lootMeshes, iceBallMeshes) come from
// ./rendererState.js so this module mutates the same references renderer.js does;
// generic reconcile via ./meshSync.js. Cross-cutting helpers shared with the rest
// of renderer.js (spawnDamageNumber, attachRegistryModel, the live gameState
// reference, and the lootPickupAttempts retry map) are imported back from
// ../renderer.js and only ever invoked/read at call time (per-frame), which is
// safe under ES-module live bindings even though renderer.js also imports from
// this module. playSound comes straight from ../audio.js.

import * as THREE from 'three';
import { LOOT_COLLECT_DURATION } from '../config.js';
import { playSound } from '../audio.js';
import { syncMeshMap } from './meshSync.js';
import { getScene, lootMeshes, iceBallMeshes } from './rendererState.js';
import {
	spawnDamageNumber,
	attachRegistryModel,
	getGameStateRef,
	lootPickupAttempts,
} from '../renderer.js';

// ── Loot geometry/material palette (shared across loot meshes) ──
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

// ── Loot animation state (private to this module) ──
const collectingLoot = {}; // lootId → { mesh, value, kind, createdAt }
const previousLootValues = {}; // lootId → { value, kind }

// ── Telepipe portal state (private to this module) ──
let telepipeMesh = null; // Group: cylinder + 2 torus rings + particle children
const telepipeParticles = []; // pool of rising particle spheres for the portal column
let telepipeShimmerPhase = 0; // accumulated phase for emissive oscillation

// Height of an ice ball's centre above the floor. The server simulates the ball
// on the (x, z) plane only; lift it to roughly the thrower's chest so it reads as
// a lobbed projectile rather than rolling along the ground.
const ICE_BALL_HEIGHT = 1.0;

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
export function disposeLootMeshMaterials(mesh) {
	if (mesh.traverse) {
		mesh.traverse((child) => {
			if (child.material) child.material.dispose();
		});
	} else if (mesh.material) {
		mesh.material.dispose();
	}
}

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

/** Dispose all geometry/material on the telepipe portal group. */
function disposeTelepipeMesh() {
	const scene = getScene();
	if (scene && telepipeMesh) scene.remove(telepipeMesh);
	if (!telepipeMesh) return;

	telepipeMesh.traverse((child) => {
		if (child.geometry) child.geometry.dispose();
		if (child.material) child.material.dispose();
	});
	telepipeMesh.children.length = 0;
}

/** Reset a particle to the bottom of the portal with random offset. */
function resetTelepipeParticle(p, halfH) {
	const angle = Math.random() * Math.PI * 2;
	const r = Math.random() * 0.6;
	p.position.set(Math.cos(angle) * r, -halfH + Math.random() * 0.5, Math.sin(angle) * r);
	p.material.opacity = 0.5 + Math.random() * 0.5;
}

// ── Loot mesh sync & animation ──

/**
 * Play a "collected" animation on a loot mesh: scale-up + fade, then remove.
 * @param {string} lootId
 * @param {number} value - gold amount
 */
export function markLootCollected(lootId, value, kind = 'currency') {
	const scene = getScene();
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
	const scene = getScene();
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
 * Reset the loot bookkeeping tables on bulk teardown (disconnect / run-clear).
 * Clears `previousLootValues` and disposes + clears any in-flight collecting-loot
 * meshes/materials so the loot domain leaves no stale state behind once the mesh
 * maps themselves are torn down by disposeAllLootMeshes.
 */
export function resetLootSyncState() {
	const scene = getScene();
	for (const id of Object.keys(collectingLoot)) {
		const entry = collectingLoot[id];
		if (scene && entry.mesh) scene.remove(entry.mesh);
		if (entry.mesh) disposeLootMeshMaterials(entry.mesh);
		delete collectingLoot[id];
	}
	for (const id of Object.keys(previousLootValues)) {
		delete previousLootValues[id];
	}
}

/**
 * Drop loot-domain bookkeeping after the scene graph has already been abandoned
 * (no per-mesh dispose — the root teardown owns GPU cleanup).
 */
export function forgetLootSyncState() {
	for (const id of Object.keys(collectingLoot)) delete collectingLoot[id];
	for (const id of Object.keys(previousLootValues)) delete previousLootValues[id];
}

/**
 * Tear down the telepipe portal mesh immediately (hub return / scene reset).
 * syncTelepipeMesh() only disposes when gameState.telepipe is absent; hub
 * transitions must clear the portal even while a mid-run snapshot still
 * carries telepipe data.
 */
export function clearTelepipePortal() {
	if (!telepipeMesh) return;
	disposeTelepipeMesh();
	telepipeMesh = null;
	telepipeParticles.length = 0;
	telepipeShimmerPhase = 0;
}

/**
 * Forget telepipe module state after the scene graph has already been abandoned.
 */
export function forgetTelepipePortal() {
	telepipeMesh = null;
	telepipeParticles.length = 0;
	telepipeShimmerPhase = 0;
}

/**
 * Sync the shared telepipe portal mesh with gameState.telepipe.
 * Creates an animated group: shimmer cylinder, two orbiting torus rings,
 * and a rising particle column.
 */
export function syncTelepipeMesh() {
	const scene = getScene();
	if (!scene) return;

	const gameStateRef = getGameStateRef();
	const telepipe = gameStateRef && gameStateRef.telepipe;
	if (!telepipe) {
		if (telepipeMesh) {
			disposeTelepipeMesh();
			telepipeMesh = null;
			telepipeParticles.length = 0;
			telepipeShimmerPhase = 0;
		}
		return;
	}

	if (!telepipeMesh) {
		telepipeMesh = new THREE.Group();

		// --- Cylinder (shimmer body) ---
		const cylGeo = new THREE.CylinderGeometry(0.9, 1.2, 6, 16, 1, true);
		const cylMat = new THREE.MeshStandardMaterial({
			color: 0x67e8f9,
			emissive: 0x22d3ee,
			emissiveIntensity: 0.85,
			transparent: true,
			opacity: 0.55,
			side: THREE.DoubleSide,
		});
		const cylinder = new THREE.Mesh(cylGeo, cylMat);
		cylinder.userData.isTelepipeCylinder = true;
		telepipeMesh.add(cylinder);

		// --- Two orbiting torus rings at different speeds ---
		const ringConfigs = [
			{ radius: 1.3, tube: 0.08, y: 0.05, speed: 1.2, color: 0xa5f3fc, emissive: 0x06b6d4 },
			{ radius: 1.5, tube: 0.06, y: -0.4, speed: -0.9, color: 0x67e8f9, emissive: 0x22d3ee },
		];
		for (const rc of ringConfigs) {
			const rGeo = new THREE.TorusGeometry(rc.radius, rc.tube, 8, 24);
			const rMat = new THREE.MeshStandardMaterial({
				color: rc.color,
				emissive: rc.emissive,
				emissiveIntensity: 1,
			});
			const ring = new THREE.Mesh(rGeo, rMat);
			ring.rotation.x = Math.PI / 2;
			ring.position.y = rc.y;
			ring.userData.isTelepipeRing = true;
			ring.userData.orbitSpeed = rc.speed;
			ring.userData.orbitAngle = Math.random() * Math.PI * 2;
			telepipeMesh.add(ring);
		}

		// --- Rising particle column (persistent pool) ---
		const particleCount = 12;
		const pGeo = new THREE.SphereGeometry(0.06, 4, 4);
		for (let i = 0; i < particleCount; i += 1) {
			const pMat = new THREE.MeshStandardMaterial({
				color: 0xa5f3fc,
				emissive: 0x22d3ee,
				emissiveIntensity: 1.2,
				transparent: true,
				opacity: 0.8,
			});
			const p = new THREE.Mesh(pGeo, pMat);
			p.userData.isTelepipeParticle = true;
			resetTelepipeParticle(p, 3); // half cylinder height
			telepipeMesh.add(p);
			telepipeParticles.push(p);
		}

		scene.add(telepipeMesh);
	}

	telepipeMesh.position.set(telepipe.x, 3, telepipe.z);
}

/**
 * Animate the telepipe portal: shimmer cylinder emissive, orbit rings,
 * and rising particles. Driven each frame from the main render loop.
 */
export function animateTelepipePortal(delta) {
	if (!telepipeMesh) return;

	// Shimmer: ~1 Hz emissive oscillation on the cylinder
	telepipeShimmerPhase += delta * 2 * Math.PI; // 1 full cycle per second
	const cylinder = telepipeMesh.children.find((c) => c.userData?.isTelepipeCylinder);
	if (cylinder && cylinder.material) {
		cylinder.material.emissiveIntensity = 0.55 + 0.5 * Math.sin(telepipeShimmerPhase);
	}

	// Orbiting rings: rotate around Y axis at different speeds
	for (const child of telepipeMesh.children) {
		if (child.userData?.isTelepipeRing) {
			child.userData.orbitAngle += child.userData.orbitSpeed * delta;
			const a = child.userData.orbitAngle;
			const radius = child.geometry?.parameters?.radius ?? 1.3;
			child.position.x = Math.cos(a) * radius * 0.15;
			child.position.z = Math.sin(a) * radius * 0.15;
			child.rotation.z = a;
		}
	}

	// Rising particles: drift upward, recycle when they exit the top
	const halfH = 3; // half cylinder height
	for (const p of telepipeParticles) {
		p.position.y += delta * 2.5; // rise speed
		if (p.position.y > halfH) {
			resetTelepipeParticle(p, halfH);
		}
		// Fade out near top
		p.material.opacity = Math.max(0, 0.8 * (1 - (p.position.y + halfH) / (halfH * 2)));
	}
}

/**
 * Sync loot meshes with current gameState.loot.
 */
export function syncLootMeshes() {
	const gameStateRef = getGameStateRef();
	if (!gameStateRef || !gameStateRef.loot) return;
	const scene = getScene();

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

/**
 * Sync ice-ball projectile meshes with gameState.iceBalls: create a mesh for each
 * new projectile id, move existing meshes to follow their server (x, z), and dispose
 * meshes whose projectile has left the state array. Mirrors the enemy/minion/loot
 * keyed-mesh-map pattern so projectiles never leak.
 */
export function syncIceBallMeshes() {
	const gs = getGameStateRef();
	const scene = getScene();
	if (!gs || !scene) return;

	const balls = Array.isArray(gs.iceBalls) ? gs.iceBalls : [];

	// Reconcile via the generic helper; meshes whose projectile has left the
	// broadcast state (hit, expired, run ended) are disposed by syncMeshMap.
	syncMeshMap(iceBallMeshes, balls, {
		create: createIceBallMesh,
		update: (mesh, ball) => mesh.position.set(ball.x, ICE_BALL_HEIGHT, ball.z),
	});
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
