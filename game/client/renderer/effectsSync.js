import * as THREE from 'three';
import { disposeOne, disposeStaleMeshes } from './disposeMesh.js';
import { MINION_SUMMON_IN_MS } from '../config.js';

/** @type {object | null} */
let ctx = null;

function requireCtx() {
	if (!ctx) throw new Error('effectsSync: call createEffectsSync before using effects sync helpers');
	return ctx;
}

/**
 * @param {object} context
 * @param {() => THREE.Scene|null} context.getScene
 * @param {() => object|null} context.getGameStateRef
 * @param {(minionType: string) => THREE.Object3D} context.createMinionMesh
 * @param {(minion: object) => THREE.Object3D} context.createNullCrawlerTelegraph
 * @param {(minion: object, telegraph: THREE.Object3D) => void} context.updateNullCrawlerTelegraph
 * @param {(origin: object, radius: number, style?: object) => void} context.spawnTelegraphRing
 * @param {(mesh: THREE.Object3D, color: number, durationMs: number) => void} context.flashMesh
 * @param {(x: number, y: number, z: number, amount: number, color: string) => void} context.spawnDamageNumber
 * @param {() => string|null} context.getCurrentLayoutProfile
 * @param {() => Record<string, THREE.Object3D>} context.getPlayersMeshes
 * @param {() => THREE.PerspectiveCamera|null} context.getCamera
 * @param {(playerY: number, layout: object) => void} context.updateSpireAscentAtmosphere
 * @param {(playerY: number, layout: object) => void} context.updateFireCavernAtmosphere
 * @param {() => void} context.resetAtmosphere
 */
export function createEffectsSync(context) {
	ctx = context;

	const minionsMeshes = {};
	const minionTelegraphMeshes = {};
	const seenMinionIds = new Set();
	const minionSpawnTimes = {};
	const minionBaseScales = {};
	const previousMinionHp = {};

	let telepipeMesh = null;
	const telepipeParticles = [];
	let telepipeShimmerPhase = 0;

	function disposeTelepipeMesh() {
		const scene = requireCtx().getScene();
		if (scene && telepipeMesh) scene.remove(telepipeMesh);
		if (!telepipeMesh) return;

		telepipeMesh.traverse((child) => {
			if (child.geometry) child.geometry.dispose();
			if (child.material) child.material.dispose();
		});
		telepipeMesh.children.length = 0;
	}

	function resetTelepipeParticle(p, halfH) {
		const angle = Math.random() * Math.PI * 2;
		const r = Math.random() * 0.6;
		p.position.set(Math.cos(angle) * r, -halfH + Math.random() * 0.5, Math.sin(angle) * r);
		p.material.opacity = 0.5 + Math.random() * 0.5;
	}

	function syncTelepipeMesh() {
		const scene = requireCtx().getScene();
		if (!scene) return;

		const telepipe = requireCtx().getGameStateRef()?.telepipe;
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
				resetTelepipeParticle(p, 3);
				telepipeMesh.add(p);
				telepipeParticles.push(p);
			}

			scene.add(telepipeMesh);
		}

		telepipeMesh.position.set(telepipe.x, 3, telepipe.z);
	}

	function animateTelepipePortal(delta) {
		if (!telepipeMesh) return;

		telepipeShimmerPhase += delta * 2 * Math.PI;
		const cylinder = telepipeMesh.children.find((c) => c.userData?.isTelepipeCylinder);
		if (cylinder && cylinder.material) {
			cylinder.material.emissiveIntensity = 0.55 + 0.5 * Math.sin(telepipeShimmerPhase);
		}

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

		const halfH = 3;
		for (const p of telepipeParticles) {
			p.position.y += delta * 2.5;
			if (p.position.y > halfH) {
				resetTelepipeParticle(p, halfH);
			}
			p.material.opacity = Math.max(0, 0.8 * (1 - (p.position.y + halfH) / (halfH * 2)));
		}
	}

	function syncMinionsFrame(gs) {
		const scene = requireCtx().getScene();
		if (!scene) return;

		const {
			createMinionMesh,
			createNullCrawlerTelegraph,
			updateNullCrawlerTelegraph,
			spawnTelegraphRing,
			flashMesh,
			spawnDamageNumber,
		} = requireCtx();

		const currentMinionIds = new Set(gs.minions ? gs.minions.map((m) => m.id) : []);

		for (const minion of (gs.minions || [])) {
			if (!minionsMeshes[minion.id]) {
				const mesh = createMinionMesh(minion.type);
				scene.add(mesh);
				minionsMeshes[minion.id] = mesh;
				if (!seenMinionIds.has(minion.id)) {
					seenMinionIds.add(minion.id);
					minionSpawnTimes[minion.id] = performance.now();
					minionBaseScales[minion.id] = mesh.scale.x;
					mesh.scale.setScalar(0.001);
				} else if (minionSpawnTimes[minion.id] === undefined) {
					const settledScale = minionBaseScales[minion.id] ?? mesh.scale.x;
					mesh.scale.setScalar(settledScale);
				}
			}
			const minionMesh = minionsMeshes[minion.id];
			minionMesh.position.set(minion.x, 0.5, minion.z);

			const spawnAt = minionSpawnTimes[minion.id];
			if (spawnAt !== undefined) {
				const rawT = Math.min((performance.now() - spawnAt) / MINION_SUMMON_IN_MS, 1);
				const eased = rawT * (2 - rawT);
				const baseScale = minionBaseScales[minion.id] ?? 1;
				minionMesh.scale.setScalar(Math.max(0.001, baseScale * eased));
				if (rawT >= 1) {
					minionMesh.scale.setScalar(baseScale);
					delete minionSpawnTimes[minion.id];
					delete minionBaseScales[minion.id];
				}
			}

			if (minion.type === 'null_crawler' && minion.attackState === 'windup') {
				if (!minionTelegraphMeshes[minion.id]) {
					const telegraph = createNullCrawlerTelegraph(minion);
					scene.add(telegraph);
					minionTelegraphMeshes[minion.id] = telegraph;
					const windupMs = minion.attackWindupMs ?? 1000;
					const beamRange = minion.attackRange ?? 14;
					spawnTelegraphRing(
						{ x: minion.x, z: minion.z },
						Math.min(beamRange * 0.32, 3.2),
						{
							color: 0x67e8f9,
							emissive: 0xa5f3fc,
							duration: windupMs,
						},
					);
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
		for (const id of [...seenMinionIds]) {
			if (!currentMinionIds.has(id)) {
				seenMinionIds.delete(id);
				delete minionSpawnTimes[id];
				delete minionBaseScales[id];
			}
		}
	}

	function syncMeshesFrame(gs) {
		if (!gs) return;
		syncMinionsFrame(gs);
		syncTelepipeMesh();
	}

	function syncAtmosphereFrame({ gs, myId }) {
		const {
			getCurrentLayoutProfile,
			getPlayersMeshes,
			getCamera,
			updateSpireAscentAtmosphere,
			updateFireCavernAtmosphere,
			resetAtmosphere,
		} = requireCtx();
		const currentLayoutProfile = getCurrentLayoutProfile();
		const playersMeshes = getPlayersMeshes();
		const camera = getCamera();

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
	}

	return {
		syncMeshesFrame,
		syncAtmosphereFrame,
		syncTelepipeMesh,
		animateTelepipePortal,
		getMinionSpawnTimes: () => minionSpawnTimes,
		getMinionsMeshes: () => minionsMeshes,
		getEffectsMeshMaps: () => ({
			minionsMeshes,
			minionTelegraphMeshes,
		}),
	};
}
