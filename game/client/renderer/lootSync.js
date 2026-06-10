import * as THREE from 'three';
import { playSound } from '../audio.js';
import {
	LOOT_COLLECT_DURATION,
	LOOT_PICKUP_RADIUS,
	LOOT_PICKUP_RETRY_MS,
} from '../config.js';
import eventsCatalog from '../../shared/events.json' with { type: 'json' };

const { clientToServer: CLIENT_TO_SERVER } = eventsCatalog;

const LOOT_FLOAT_COLOR_MONEY = '#ffd700';
const LOOT_FLOAT_COLOR_MAGIC_STONE = '#a78bfa';

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

/**
 * @param {object} ctx
 * @param {() => THREE.Scene|null} ctx.getScene
 * @param {() => object|null} ctx.getSocket
 * @param {(key: string, host: THREE.Object3D) => void} ctx.attachRegistryModel
 * @param {(x: number, y: number, z: number, amount: number, color: string, positive: boolean, suffix?: string) => void} ctx.spawnDamageNumber
 */
export function createLootSync(ctx) {
	const lootMeshes = {};
	const collectingLoot = {};
	const previousLootValues = {};
	const lootPickupAttempts = new Map();

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
			ctx.attachRegistryModel(kind, group);
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
		ctx.attachRegistryModel(kind, mesh);
		return mesh;
	}

	function getLootBaseY(mesh) {
		if (mesh.userData?.isMagicStone) return 0.6;
		if (mesh.userData?.isCrystal) return 0.65;
		return 0.5;
	}

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
		const socket = ctx.getSocket();
		if (!socket || !loot) return;
		const last = lootPickupAttempts.get(loot.id) || 0;
		if (now - last < LOOT_PICKUP_RETRY_MS) return;
		lootPickupAttempts.set(loot.id, now);
		socket.emit(CLIENT_TO_SERVER.LOOT_PICKUP, { lootId: loot.id });
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

	function markLootCollected(lootId, value, kind = 'currency') {
		const scene = ctx.getScene();
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

		ctx.spawnDamageNumber(
			px,
			1.0,
			pz,
			value,
			isMagicStone ? LOOT_FLOAT_COLOR_MAGIC_STONE : LOOT_FLOAT_COLOR_MONEY,
			true,
			isMagicStone ? ' MS' : '',
		);
	}

	function updateCollectingLoot() {
		const scene = ctx.getScene();
		if (!scene) return;

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

	function syncMeshes(gs) {
		const scene = ctx.getScene();
		if (!gs || !gs.loot || !scene) return;

		const currentLootIds = new Set(gs.loot.map((l) => l.id));

		for (const item of gs.loot) {
			previousLootValues[item.id] = { value: item.value || 1, kind: item.kind || 'currency' };
		}

		for (const item of gs.loot) {
			if (!lootMeshes[item.id]) {
				const mesh = createLootMesh(item);
				scene.add(mesh);
				lootMeshes[item.id] = mesh;
			} else {
				lootMeshes[item.id].position.x = item.x;
				lootMeshes[item.id].position.z = item.z;
			}
		}

		for (const id of Object.keys(lootMeshes)) {
			if (!currentLootIds.has(id)) {
				const lootMeta = previousLootValues[id] || { value: 1, kind: 'currency' };
				delete previousLootValues[id];
				markLootCollected(id, lootMeta.value, lootMeta.kind);
			}
		}
	}

	function animateMeshes() {
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

	function disposeAllLootMeshes() {
		const scene = ctx.getScene();
		for (const id of Object.keys(lootMeshes)) {
			const mesh = lootMeshes[id];
			if (scene) scene.remove(mesh);
			disposeLootMeshMaterials(mesh);
			delete lootMeshes[id];
		}
		lootPickupAttempts.clear();
	}

	function getPickedUpLootIds() {
		return new Set(lootPickupAttempts.keys());
	}

	function pruneLootPickupAttempts(currentLootIds) {
		for (const id of lootPickupAttempts.keys()) {
			if (!currentLootIds.has(id)) {
				lootPickupAttempts.delete(id);
			}
		}
	}

	function syncFrame({ gs, myId, myX, myZ, now = performance.now() }) {
		if (gs && gs.loot && gs.loot.length > 0) {
			const localPlayer = gs.players[myId];
			if (localPlayer && !localPlayer.dead) {
				const closest = findClosestLootInRange(gs.loot, myX, myZ, LOOT_PICKUP_RADIUS);
				if (closest) tryEmitLootPickup(closest, now);
			}
		}
	}

	return {
		syncFrame,
		syncMeshes,
		animateMeshes,
		markLootCollected,
		updateCollectingLoot,
		disposeAllLootMeshes,
		getPickedUpLootIds,
		pruneLootPickupAttempts,
		getLootMeshes: () => lootMeshes,
	};
}
