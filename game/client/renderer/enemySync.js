import * as THREE from 'three';
import { disposeOne, disposeStaleMeshes } from './disposeMesh.js';
import { FLOOR_Y } from '../dungeon.js';
import {
	CARD_HIT_GRACE_MS,
	ATTACK_CONE_ANGLE,
	ENTITY_RADIUS,
	ENEMY_ATTACK_RANGE,
} from '../config.js';
import { getLockedEnemyId } from '../lockOn.js';

// ── Enemy geometry table ──
export const ENEMY_GEOMETRY = {
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

const GROUND_OVERLAY_Y = FLOOR_Y + 0.07;
const ENEMY_SHIELD_BAR_COLOR = 0x22d3ee;
const REVEAL_GLOW_COLOR = 0xffaa00;
const REVEAL_GLOW_INTENSITY = 1.0;

/** Cool cyan body tint for warded enemies — distinct from grunt/skirmisher/miniboss palettes. */
export const WARDED_TINT = 0x22d3ee;

/** Red body tint for frenzied enemies — distinct from volatile hot-orange badge. */
export const FRENZIED_TINT = 0xb91c1c;

/** @type {Record<string, number>} */
const VARIANT_BADGE_COLORS = {
	default: 0xc026d3,
	leeching: 0x14b8a6,
	warded: 0x22d3ee,
	volatile: 0xf97316,
	frenzied: 0xdc2626,
};

/** @type {Record<string, { color: number, intensity: number }>} */
const VARIANT_MESH_TINTS = {
	leeching: { color: 0x0d9488, intensity: 0.45 },
};

/** Per-variant badge colors; unknown variants use the default badge color. */
export const VARIANT_MARKER_COLORS = {
	warded: VARIANT_BADGE_COLORS.warded,
	volatile: VARIANT_BADGE_COLORS.volatile,
	frenzied: VARIANT_BADGE_COLORS.frenzied,
};

const MINION_TICK_VFX_DEFAULT = {
	enemyFlash: 0xff4444,
	minionFlash: 0x88ff88,
};

/**
 * Minion-type HP-drop VFX: enemy/minion flash colors and effect spawners.
 * Unknown types fall back to MINION_TICK_VFX_DEFAULT + spawnHitSpark.
 */
export const MINION_TICK_VFX_BY_TYPE = {
	thunderbird: {
		enemyFlash: 0x38bdf8,
		minionFlash: 0x7dd3fc,
		spawnEffect({ enemy, minion, spawnChainLightningEffect }) {
			const sparkDir = minion
				? { x: enemy.x - minion.x, z: enemy.z - minion.z }
				: { x: 1, z: 0 };
			spawnChainLightningEffect(
				{ x: minion.x, z: minion.z },
				sparkDir,
			);
		},
	},
	storm_eagle: {
		enemyFlash: 0x67e8f9,
		minionFlash: 0x93c5fd,
		spawnEffect({ enemy, minion, spawnLightningArc }) {
			spawnLightningArc(
				{ x: minion.x, z: minion.z },
				{ x: enemy.x, z: enemy.z },
				{ color: 0x67e8f9, emissive: 0x22d3ee },
			);
		},
	},
	ancient_wyrm: {
		enemyFlash: 0xfb923c,
		minionFlash: 0xfb923c,
		spawnEffect({ enemy, minion, halfHeight, spawnAttackEffect, spawnParticleBurst }) {
			const breathDir = minion
				? { x: enemy.x - minion.x, z: enemy.z - minion.z }
				: { x: 1, z: 0 };
			spawnAttackEffect(
				{ x: minion.x, z: minion.z },
				breathDir,
				{
					range: 8,
					coneAngle: Math.PI / 2,
					color: 0xef4444,
					emissive: 0x9333ea,
				},
			);
			spawnParticleBurst(
				{ x: enemy.x, y: halfHeight, z: enemy.z },
				{ color: 0xef4444, emissive: 0xff3b00, count: 8, spread: 0.85 },
			);
		},
	},
	null_crawler: {
		enemyFlash: 0x22d3ee,
		minionFlash: 0x67e8f9,
		spawnEffect({ enemy, minion, spawnAttackEffect }) {
			const beamDir = minion
				? { x: enemy.x - minion.x, z: enemy.z - minion.z }
				: { x: 1, z: 0 };
			spawnAttackEffect(
				{ x: minion.x, z: minion.z },
				beamDir,
				{
					effect: 'returning_projectile',
					returnPasses: 0,
					range: minion.attackRange ?? 14,
					projectileHitWidth: minion.projectileHitWidth ?? 0.8,
					color: 0x22d3ee,
					emissive: 0x06b6d4,
				},
			);
		},
	},
	bulkhead_mauler: {
		enemyFlash: 0xf59e0b,
		minionFlash: 0xfbbf24,
		spawnEffect({ enemy, minion, spawnAttackEffect }) {
			const sweepDir = minion
				? { x: enemy.x - minion.x, z: enemy.z - minion.z }
				: { x: 1, z: 0 };
			spawnAttackEffect(
				{ x: minion.x, z: minion.z },
				sweepDir,
				{
					range: 4,
					coneAngle: (Math.PI * 2) / 3,
					color: 0x78716c,
					emissive: 0xf59e0b,
				},
			);
		},
	},
};

function variantBadgeColor(variant) {
	return VARIANT_BADGE_COLORS[variant] ?? VARIANT_BADGE_COLORS.default;
}

/**
 * @param {object} ctx
 * @param {() => THREE.Scene|null} ctx.getScene
 * @param {() => Record<string, THREE.Object3D>} ctx.getMinionsMeshes
 * @param {(mesh: THREE.Object3D, color: number, durationMs: number) => void} ctx.flashMesh
 * @param {(position: object, style?: object) => void} ctx.spawnHitSpark
 * @param {(origin: object, direction: object) => void} ctx.spawnChainLightningEffect
 * @param {(from: object, to: object, style?: object) => void} ctx.spawnLightningArc
 * @param {(origin: object, direction: object, style?: object) => void} ctx.spawnAttackEffect
 * @param {(position: object, style?: object) => void} ctx.spawnParticleBurst
 * @param {(markerMap: object, id: string, entity: object) => void} ctx.applySlowIndicator
 * @param {(markerMap: object, id: string, entity: object) => void} ctx.applyBurnIndicator
 * @param {(key: string, host: THREE.Object3D) => void} ctx.attachRegistryModel
 * @param {(direction: object, range: number, coneAngle: number, style: object) => THREE.Group} ctx.createConeHitboxGroup
 * @param {(color: number, emissive: number, opacity: number) => THREE.Material} ctx.makeHitboxMaterial
 */
export function createEnemySync(ctx) {
	const enemiesMeshes = {};
	const enemyHealthBars = {};
	const enemyShieldBars = {};
	const enemyHitboxMeshes = {};
	const telegraphMeshes = {};
	const enemyLockOnRings = {};
	const variantMarkerMeshes = {};
	const frenziedTelegraphMeshes = {};
	const enemySlowMarkers = {};
	const enemyBurnMarkers = {};
	const windupFlashing = new Set();
	const lastCardHitTime = {};
	const previousEnemyHp = {};

	function scene() {
		return ctx.getScene();
	}

	function enemyMeshHalfHeight(type) {
		const def = ENEMY_GEOMETRY[type] || ENEMY_GEOMETRY.grunt;
		return def.type === 'octahedron' ? def.radius : def.height / 2;
	}

	function createEnemyMesh(type) {
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
		ctx.attachRegistryModel(type, mesh);
		return mesh;
	}

	function healthBarColor(hp, maxHp) {
		const pct = maxHp > 0 ? hp / maxHp : 0;
		if (pct > 0.5) return 0x22c55e;
		if (pct > 0.25) return 0xeab308;
		return 0xef4444;
	}

	function createHealthBarMesh(enemyId, x, z, type) {
		const geo = new THREE.BoxGeometry(1.2, 0.1, 0.1);
		const mat = new THREE.MeshStandardMaterial({ color: 0x22c55e });
		const mesh = new THREE.Mesh(geo, mat);
		const halfHeight = enemyMeshHalfHeight(type);
		mesh.position.set(x, halfHeight + 0.5, z);
		scene()?.add(mesh);
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

	function updateHealthBarMesh(enemyId, enemy) {
		const mesh = enemyHealthBars[enemyId];
		if (!mesh) return;

		const maxHp = enemy.maxHp || enemy.hp;
		const ratio = Math.max(0, enemy.hp / maxHp);
		mesh.scale.x = ratio;
		mesh.material.color.setHex(healthBarColor(enemy.hp, maxHp));
	}

	function createEnemyShieldBarMesh(enemyId, x, z, type) {
		const geo = new THREE.BoxGeometry(1.2, 0.06, 0.1);
		const mat = new THREE.MeshStandardMaterial({ color: ENEMY_SHIELD_BAR_COLOR });
		const mesh = new THREE.Mesh(geo, mat);
		const halfHeight = enemyMeshHalfHeight(type);
		mesh.position.set(x, halfHeight + 0.65, z);
		scene()?.add(mesh);
		return mesh;
	}

	function ensureEnemyShieldBar(enemyId, enemy) {
		if ((enemy.shieldHp || 0) <= 0) {
			if (enemyShieldBars[enemyId]) {
				disposeOne(enemyShieldBars, enemyId, scene());
			}
			return;
		}
		if (!enemyShieldBars[enemyId]) {
			enemyShieldBars[enemyId] = createEnemyShieldBarMesh(enemyId, enemy.x, enemy.z, enemy.type);
		}
	}

	function updateEnemyShieldBarMesh(enemyId, enemy) {
		const mesh = enemyShieldBars[enemyId];
		if (!mesh) return;

		const maxShield = enemy.maxShieldHp || enemy.shieldHp || 1;
		const ratio = Math.max(0, (enemy.shieldHp || 0) / maxShield);
		mesh.scale.x = ratio;
	}

	function applyWindupFlash(enemyId, isWindup) {
		const mesh = enemiesMeshes[enemyId];
		if (!mesh || !mesh.material || !mesh.material.emissive) return;

		if (isWindup) {
			if (!windupFlashing.has(enemyId)) {
				mesh.material.emissive.set(0xff3333);
				mesh.material.emissiveIntensity = 1.5;
				windupFlashing.add(enemyId);
			}
		} else if (windupFlashing.has(enemyId)) {
			mesh.material.emissive.set(0x000000);
			mesh.material.emissiveIntensity = 0;
			windupFlashing.delete(enemyId);
		}
	}

	function applyRevealHighlight(enemyId, enemy) {
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

	function variantMarkerColor(variant) {
		return variantBadgeColor(variant);
	}

	function applyEnemyVariantTint(enemyId, enemy) {
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

	function createVariantMarker(badgeColor) {
		const geo = new THREE.OctahedronGeometry(0.22);
		const mat = new THREE.MeshStandardMaterial({
			color: badgeColor,
			emissive: badgeColor,
			emissiveIntensity: 0.9,
		});
		return new THREE.Mesh(geo, mat);
	}

	function applyVariantMarker(enemyId, enemy) {
		if (enemy && enemy.variant) {
			const badgeColor = variantBadgeColor(enemy.variant);
			if (!variantMarkerMeshes[enemyId]) {
				variantMarkerMeshes[enemyId] = createVariantMarker(badgeColor);
				scene()?.add(variantMarkerMeshes[enemyId]);
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
			marker.rotation.y = ((Date.now() % 4000) / 4000) * Math.PI * 2;
		} else if (variantMarkerMeshes[enemyId]) {
			disposeOne(variantMarkerMeshes, enemyId, scene());
		}
	}

	function applyVariantEmissiveTint(enemyId, enemy) {
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

	function applyFrenziedTelegraphRing(enemyId, enemy) {
		const now = Date.now();
		const telegraphActive = enemy && enemy.enrageTelegraphUntil && now < enemy.enrageTelegraphUntil;

		if (telegraphActive) {
			if (!frenziedTelegraphMeshes[enemyId]) {
				frenziedTelegraphMeshes[enemyId] = createFrenziedTelegraphRing();
				scene()?.add(frenziedTelegraphMeshes[enemyId]);
			}
			const ring = frenziedTelegraphMeshes[enemyId];
			ring.position.set(enemy.x, GROUND_OVERLAY_Y, enemy.z);
			const pulse = 0.5 + 0.5 * Math.sin((now % 1000) / 1000 * Math.PI * 4);
			ring.material.opacity = 0.25 + pulse * 0.6;
		} else if (frenziedTelegraphMeshes[enemyId]) {
			disposeOne(frenziedTelegraphMeshes, enemyId, scene());
		}
	}

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
				scene()?.add(enemyLockOnRings[enemyId]);
			}
			enemyLockOnRings[enemyId].position.set(enemyX, GROUND_OVERLAY_Y + 0.02, enemyZ);
			enemyLockOnRings[enemyId].visible = true;
		} else if (enemyLockOnRings[enemyId]) {
			enemyLockOnRings[enemyId].visible = false;
		}
	}

	function createEnemyHitboxGroup(radius) {
		const group = new THREE.Group();
		const color = 0xff4466;
		const emissive = 0xff2244;
		const fillMat = ctx.makeHitboxMaterial(color, emissive, 0.22);
		const edgeMat = ctx.makeHitboxMaterial(color, emissive, 0.55);

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
			const group = ctx.createConeHitboxGroup(
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

	function markCardHitEnemies(hits) {
		const now = performance.now();
		for (const hit of hits || []) {
			if (hit?.enemyId) lastCardHitTime[hit.enemyId] = now;
		}
	}

	function getEnemyRenderScaleForTest(enemyId, enemyType) {
		const mesh = enemiesMeshes[enemyId];
		if (mesh) {
			const box = new THREE.Box3().setFromObject(mesh);
			const size = new THREE.Vector3();
			box.getSize(size);
			const scale = Math.max(size.x, size.y, size.z);
			if (scale > 0) return { scale };
		}
		const def = ENEMY_GEOMETRY[enemyType] || null;
		if (!def) return null;
		const scale = def.type === 'octahedron' ? def.radius * 2 : def.height;
		return { scale };
	}

	function handleMinionTickVfx(enemy, halfHeight, gs) {
		const minionsMeshes = ctx.getMinionsMeshes();
		let nearestMinion = null;
		let nearestMinionDist = Infinity;
		for (const m of (gs.minions || [])) {
			const mdist = Math.hypot(m.x - enemy.x, m.z - enemy.z);
			if (mdist < nearestMinionDist && minionsMeshes[m.id]) {
				nearestMinionDist = mdist;
				nearestMinion = m;
			}
		}

		const vfx = nearestMinion?.type ? MINION_TICK_VFX_BY_TYPE[nearestMinion.type] : null;
		ctx.flashMesh(
			enemiesMeshes[enemy.id],
			vfx?.enemyFlash ?? MINION_TICK_VFX_DEFAULT.enemyFlash,
			150,
		);

		if (vfx) {
			vfx.spawnEffect({
				enemy,
				minion: nearestMinion,
				halfHeight,
				spawnChainLightningEffect: ctx.spawnChainLightningEffect,
				spawnLightningArc: ctx.spawnLightningArc,
				spawnAttackEffect: ctx.spawnAttackEffect,
				spawnParticleBurst: ctx.spawnParticleBurst,
			});
		} else {
			ctx.spawnHitSpark({ x: enemy.x, y: halfHeight, z: enemy.z });
		}

		if (nearestMinion && minionsMeshes[nearestMinion.id]) {
			ctx.flashMesh(
				minionsMeshes[nearestMinion.id],
				vfx?.minionFlash ?? MINION_TICK_VFX_DEFAULT.minionFlash,
				200,
			);
		}
	}

	function syncEnemiesFrame({ gs }) {
		if (!gs || !scene()) return;

		const sc = scene();
		const currentEnemyIds = new Set(gs.enemies.map((e) => e.id));

		for (const enemy of gs.enemies) {
			if (!enemiesMeshes[enemy.id]) {
				const mesh = createEnemyMesh(enemy.type);
				sc.add(mesh);
				enemiesMeshes[enemy.id] = mesh;

				enemyHitboxMeshes[enemy.id] = createEnemyHitboxGroup(ENTITY_RADIUS);
				sc.add(enemyHitboxMeshes[enemy.id]);
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

			if (previousEnemyHp[enemy.id] !== undefined && enemy.hp < previousEnemyHp[enemy.id]) {
				const cardHit = lastCardHitTime[enemy.id];
				const withinGrace = cardHit !== undefined && (performance.now() - cardHit) < CARD_HIT_GRACE_MS;
				if (!withinGrace) {
					handleMinionTickVfx(enemy, halfHeight, gs);
				}
			}
			previousEnemyHp[enemy.id] = enemy.hp;

			if (enemy.attackState === 'windup') {
				applyWindupFlash(enemy.id, true);

				const windupTarget = resolveEnemyWindupTarget(enemy, gs);
				if (!telegraphMeshes[enemy.id]) {
					const telegraph = createEnemyAttackTelegraph(enemy, windupTarget);
					sc.add(telegraph);
					telegraphMeshes[enemy.id] = telegraph;
				} else {
					updateEnemyAttackTelegraph(enemy, telegraphMeshes[enemy.id], windupTarget);
				}
			} else {
				disposeOne(telegraphMeshes, enemy.id, sc);
				applyWindupFlash(enemy.id, false);
			}

			applyRevealHighlight(enemy.id, enemy);
			applyEnemyVariantTint(enemy.id, enemy);
			applyVariantMarker(enemy.id, enemy);
			applyVariantEmissiveTint(enemy.id, enemy);
			applyFrenziedTelegraphRing(enemy.id, enemy);
			ctx.applySlowIndicator(enemySlowMarkers, enemy.id, enemy);
			ctx.applyBurnIndicator(enemyBurnMarkers, enemy.id, enemy);
		}

		disposeStaleMeshes(enemiesMeshes, currentEnemyIds, sc);
		disposeStaleMeshes(enemyHealthBars, currentEnemyIds, sc);
		disposeStaleMeshes(enemyShieldBars, currentEnemyIds, sc);
		disposeStaleMeshes(enemyHitboxMeshes, currentEnemyIds, sc);
		disposeStaleMeshes(enemyLockOnRings, currentEnemyIds, sc);
		disposeStaleMeshes(variantMarkerMeshes, currentEnemyIds, sc);
		disposeStaleMeshes(frenziedTelegraphMeshes, currentEnemyIds, sc);
		disposeStaleMeshes(enemySlowMarkers, currentEnemyIds, sc);
		disposeStaleMeshes(enemyBurnMarkers, currentEnemyIds, sc);
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
		disposeStaleMeshes(telegraphMeshes, currentEnemyIds, sc);
		for (const id of [...windupFlashing]) {
			if (!currentEnemyIds.has(id)) {
				windupFlashing.delete(id);
			}
		}
	}

	return {
		syncEnemiesFrame,
		markCardHitEnemies,
		getWindupFlashing: () => windupFlashing,
		getEnemyMeshMaps: () => ({
			enemiesMeshes,
			enemyHealthBars,
			enemyShieldBars,
			telegraphMeshes,
			enemyHitboxMeshes,
			enemyLockOnRings,
			variantMarkerMeshes,
			frenziedTelegraphMeshes,
			enemySlowMarkers,
			enemyBurnMarkers,
		}),
		getEnemyHitboxMeshes: () => enemyHitboxMeshes,
		enemyMeshHalfHeight,
		createEnemyMesh,
		getEnemyRenderScaleForTest,
		healthBarColor,
		createHealthBarMesh,
		updateHealthBarMesh,
		createEnemyShieldBarMesh,
		updateEnemyShieldBarMesh,
		applyWindupFlash,
		applyRevealHighlight,
		applyEnemyVariantTint,
		variantMarkerColor,
		applyVariantMarker,
		applyVariantEmissiveTint,
		applyFrenziedTelegraphRing,
	};
}
