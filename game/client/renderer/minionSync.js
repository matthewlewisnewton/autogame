// ── Minion-Domain + Spike-Trap-Hazard Mesh Sync ──
// Owns the per-frame minion reconcile (`syncMinionMeshes`) and the armed
// spike_trap ground-hazard reconcile (`syncSpikeTrapMeshes`), plus the
// minion-only helper cluster they drive: minion mesh creation, the null-crawler
// windup telegraph create/update helpers, the summon-in scale state
// (seenMinionIds / minionSpawnTimes / minionBaseScales), the per-minion
// previous-HP table for damage flashes, the escort NPC's persistent floating
// HP bar (escortHealthBars, color via enemySync's healthBarColor), and the
// spike-trap hazard mesh builder.
//
// Scene + keyed mesh-map stores come from ./rendererState.js so this module
// mutates the same references renderer.js does; generic reconcile/dispose
// helpers come from ./meshSync.js. Cross-cutting helpers shared with other
// domains (flashMesh, syncFlyingShadow, spawnDamageNumber, flyingRenderOffset,
// spawnTelegraphRing, attachRegistryModel, createBeamTelegraphGroup) plus the
// shared MINION_VISUAL table, GROUND_OVERLAY_Y, and the SPIKE_TRAP_* palette are
// imported back from ../renderer.js and only ever invoked/read at call time
// (per-frame), which is safe under ES-module live bindings even though
// renderer.js also imports from this module.

import * as THREE from 'three';
import { MINION_SUMMON_IN_MS } from '../config.js';
import { disposeOne, disposeStaleMeshes, syncMeshMap } from './meshSync.js';
import { healthBarColor } from './enemySync.js';
import {
	getScene,
	escortHealthBars,
	minionsMeshes,
	minionShadows,
	minionTelegraphMeshes,
	spikeTrapMeshes,
} from './rendererState.js';
import {
	MINION_VISUAL,
	attachRegistryModel,
	createBeamTelegraphGroup,
	GROUND_OVERLAY_Y,
	flyingRenderOffset,
	syncFlyingShadow,
	spawnTelegraphRing,
	flashMesh,
	spawnDamageNumber,
	SPIKE_TRAP_SPIKE_COLOR,
	SPIKE_TRAP_EMISSIVE,
	SPIKE_TRAP_RING_COLOR,
	SPIKE_TRAP_RING_EMISSIVE,
	SPIKE_TRAP_SPIKE_COUNT,
	SPIKE_TRAP_SPIKE_HEIGHT,
	SPIKE_TRAP_SPIKE_RADIUS,
} from '../renderer.js';

// ── Minion summon-in + damage-flash state (private to this module) ──
/** First-seen minion ids — avoids re-playing spawn scale-in after resync/reconnect. */
const seenMinionIds = new Set();
/** Minion id → performance.now() when scale-in began (cleared once settled). */
const minionSpawnTimes = {};
/** Minion id → target uniform scale while scale-in is active. */
const minionBaseScales = {};
/** minionId → hp from previous frame (drives the damage flash + number). */
const previousMinionHp = {};

/** Test harness: pending minion scale-in start times keyed by minion id. */
export function getMinionSpawnTimes() {
	return minionSpawnTimes;
}

/**
 * Create a Three.js mesh for a minion based on its type.
 * @param {string} minionType
 * @returns {THREE.Mesh}
 */
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

// ── Escort HP bar helpers ──
// The escort minion is the only minion with a persistent floating HP bar
// (ordinary minions keep damage flashes/numbers only). Bar look + color reuse
// the enemy health-bar pattern: 1.2-wide box scaled by hp fraction, color via
// enemySync's healthBarColor.

/** Vertical offset above the minion render Y — clears the escort_npc cylinder top. */
export const ESCORT_HEALTH_BAR_OFFSET_Y = 0.85;

/**
 * Should-have-bar predicate: only escort minions get a persistent HP bar.
 * @param {object} minion
 * @returns {boolean}
 */
export function shouldHaveEscortHealthBar(minion) {
	return Boolean(minion?.isEscort);
}

/**
 * Clamped hp/maxHp fill fraction for the escort HP bar.
 * @param {number} hp
 * @param {number} maxHp
 * @returns {number} 0..1 (0 when maxHp is missing/invalid)
 */
export function escortHealthBarFillScale(hp, maxHp) {
	if (!(maxHp > 0)) return 0;
	return Math.max(0, Math.min(1, hp / maxHp));
}

function createEscortHealthBarMesh(minion) {
	const geo = new THREE.BoxGeometry(1.2, 0.1, 0.1);
	const mat = new THREE.MeshStandardMaterial({ color: healthBarColor(minion.hp, minion.maxHp) });
	return new THREE.Mesh(geo, mat);
}

/**
 * Per-sync escort HP bar reconcile for one minion: create on first sight,
 * then follow position and rescale/recolor from current hp/maxHp.
 * @param {object} minion - snapshot minion ({ id, x, z, hp, maxHp, isEscort })
 * @param {number} renderY - the minion mesh's render Y this frame
 */
function syncEscortHealthBar(minion, renderY) {
	let bar = escortHealthBars[minion.id];
	if (!bar) {
		bar = createEscortHealthBarMesh(minion);
		getScene().add(bar);
		escortHealthBars[minion.id] = bar;
	}
	bar.position.set(minion.x, renderY + ESCORT_HEALTH_BAR_OFFSET_Y, minion.z);
	bar.scale.x = escortHealthBarFillScale(minion.hp, minion.maxHp);
	bar.material.color.setHex(healthBarColor(minion.hp, minion.maxHp));
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

/**
 * Per-frame minion reconcile: create/position minion meshes, drive the summon-in
 * scale-up, flying shadows, null-crawler windup telegraph + emissive, and
 * damage flashes/numbers, then dispose every parallel minion map for minions
 * that have left the snapshot.
 *
 * Reads scene/map stores shared via rendererState.js and invokes cross-cutting
 * renderer.js helpers at call time. Behavior is unchanged from the prior inline
 * implementation in renderer.js.
 * @param {object} gs - current game-state snapshot ({ minions, layout, ... })
 */
export function syncMinionMeshes(gs) {
	const scene = getScene();
	// ── Minion mesh sync ──
	const currentMinionIds = new Set(gs.minions ? gs.minions.map((m) => m.id) : []);

	for (const minion of (gs.minions || [])) {
		if (!minionsMeshes[minion.id]) {
			const visualKey = minion.isEscort ? 'escort_npc' : minion.type;
			const mesh = createMinionMesh(visualKey);
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
		// Flying minions (storm_eagle, thunderbird, ancient_wyrm) hover at the
		// floor-aware surface + altitude; grounded minions keep the fixed 0.5
		// (flyingRenderOffset → 0).
		const minionRenderY = 0.5 + flyingRenderOffset(minion, gs.layout);
		minionMesh.position.set(minion.x, minionRenderY, minion.z);
		syncFlyingShadow(minionShadows, minion, gs.layout);

		if (shouldHaveEscortHealthBar(minion)) {
			syncEscortHealthBar(minion, minionRenderY);
		} else {
			disposeOne(escortHealthBars, minion.id, scene);
		}

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
			spawnDamageNumber(minion.x, 1.2 + flyingRenderOffset(minion, gs.layout), minion.z, damageAmount, '#ff4444');
		}
		previousMinionHp[minion.id] = minion.hp;
	}

	disposeStaleMeshes(minionsMeshes, currentMinionIds, scene);
	disposeStaleMeshes(minionShadows, currentMinionIds, scene);
	disposeStaleMeshes(minionTelegraphMeshes, currentMinionIds, scene);
	disposeStaleMeshes(escortHealthBars, currentMinionIds, scene);
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

/**
 * Build the persistent ground-hazard mesh for an armed spike_trap: a hostile red
 * ground ring plus a static cluster of short upward steel spikes. Reuses the
 * SPIKE_TRAP_* palette so it reads as an armed spike trap and stays distinct from
 * cinder_snare's orange fire look. Geometry and materials are owned by the
 * returned group (like enemy meshes), so disposeStaleMeshes / disposeMeshMap
 * fully release them; they are allocated once per trap on first sight and never
 * per frame.
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
 * Per-frame spike-trap hazard reconcile: reconcile a persistent ground-hazard
 * mesh per armed spike_trap from the snapshot, mirroring the enemy/minion
 * pattern. Only spike_trap is handled here; other effects (e.g. cinder_snare)
 * are left to their own handling.
 * @param {object} gs - current game-state snapshot ({ enchantments, ... })
 */
export function syncSpikeTrapMeshes(gs) {
	const armedSpikeTraps = (gs.enchantments || []).filter(
		(enc) => enc && enc.effect === 'spike_trap' && enc.armed,
	);
	syncMeshMap(spikeTrapMeshes, armedSpikeTraps, {
		create: createSpikeTrapHazardMesh,
		update: (mesh, enc) => mesh.position.set(enc.x, 0, enc.z),
	});
}
