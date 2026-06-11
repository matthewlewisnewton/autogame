// ── Enemy-Domain Mesh Sync ──
// Owns the per-frame enemy reconcile (`syncEnemyMeshes`) plus the enemy-only
// helper cluster it drives: enemy mesh/geometry creation, health + shield bars,
// windup/telegraph visuals, reveal glow, variant body tints/badges, the frenzied
// enrage ring, the enemy hitbox group, and the minion-attribution hit-VFX table.
//
// Scene + keyed mesh-map stores come from ./rendererState.js so this module
// mutates the same references renderer.js does; generic reconcile/dispose helpers
// come from ./meshSync.js. Cross-cutting helpers shared with other domains
// (flashMesh, syncFlyingShadow, applySlowIndicator/applyBurnIndicator,
// syncLockOnRing, the hitbox/registry builders, the VFX spawners, and a few
// shared data tables/constants) are imported back from ../renderer.js and only
// ever invoked at call time (per-frame), which is safe under ES-module live
// bindings even though renderer.js also imports from this module.

import * as THREE from 'three';
import {
	ENTITY_RADIUS,
	ENEMY_ATTACK_RANGE,
	ATTACK_CONE_ANGLE,
	CARD_HIT_GRACE_MS,
} from '../config.js';
import { disposeOne, disposeStaleMeshes } from './meshSync.js';
import {
	getScene,
	enemiesMeshes,
	enemyHealthBars,
	enemyShieldBars,
	enemyHitboxMeshes,
	enemyShadows,
	telegraphMeshes,
	enemyLockOnRings,
	variantMarkerMeshes,
	frenziedTelegraphMeshes,
	enemySlowMarkers,
	enemyBurnMarkers,
	enemyNameplates,
	minionsMeshes,
} from './rendererState.js';
import {
	ENEMY_GEOMETRY,
	ENEMY_ATTACK_VISUAL,
	GROUND_OVERLAY_Y,
	attachRegistryModel,
	makeHitboxMaterial,
	createConeHitboxGroup,
	flyingRenderOffset,
	flashMesh,
	syncFlyingShadow,
	syncLockOnRing,
	applySlowIndicator,
	applyBurnIndicator,
	spawnAttackEffect,
	spawnFireTrailEffect,
	spawnParticleBurst,
	spawnHitSpark,
	spawnLightningArc,
	spawnChainLightningEffect,
	windupFlashing,
	enemyDamageFlash,
	lastCardHitTime,
	createEnemyNameplate,
	disposeEnemyNameplate,
	NAMEPLATE_OFFSET_Y,
	resolveBodyMesh,
} from '../renderer.js';

const WINDUP_EMISSIVE_COLOR = 0xff3333;
const WINDUP_EMISSIVE_INTENSITY = 1.5;

/** Last per-enemy snapshot used when the resolver runs outside syncEnemyMeshes. */
const lastEnemyEmissiveContext = {};

/** Read `_orig*` bookkeeping from the body mesh when retargeted, else the host. */
function enemyOrigBookkeeping(host) {
	const body = resolveBodyMesh(host);
	const source = body && body !== host ? body : host;
	return {
		color: source._origColor ?? host._origColor,
		emissive: source._origEmissive ?? host._origEmissive ?? 0x000000,
		emissiveIntensity:
			source._origEmissiveIntensity != null
				? source._origEmissiveIntensity
				: (host._origEmissiveIntensity != null ? host._origEmissiveIntensity : 0),
	};
}

/** enemyId → hp from previous frame (private enemy-sync state). */
const previousEnemyHp = {};

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
 * Harness-safe read of an enemy's rendered world height (or geometry preset when
 * the mesh has not synced yet). Used by playthrough visual-identity probes.
 * @param {string} enemyId
 * @param {string} [enemyType]
 * @returns {{ scale: number } | null}
 */
export function getEnemyRenderScaleForTest(enemyId, enemyType) {
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
	} else if (def.type === 'cylinder') {
		// Crowned tower (citadel_sovereign): radiusTop flares past the base radius.
		geo = new THREE.CylinderGeometry(def.radiusTop ?? def.radius, def.radius, def.height, def.segments);
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
	getScene().add(mesh);
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

const ENEMY_SHIELD_BAR_COLOR = 0x22d3ee;

/**
 * Create a slim shield-absorb bar above the HP bar.
 * @param {string} enemyId
 * @param {number} x
 * @param {number} z
 * @param {string} type
 * @returns {THREE.Mesh}
 */
export function createEnemyShieldBarMesh(enemyId, x, z, type) {
	const geo = new THREE.BoxGeometry(1.2, 0.06, 0.1);
	const mat = new THREE.MeshStandardMaterial({ color: ENEMY_SHIELD_BAR_COLOR });
	const mesh = new THREE.Mesh(geo, mat);
	const halfHeight = enemyMeshHalfHeight(type);
	mesh.position.set(x, halfHeight + 0.65, z);
	getScene().add(mesh);
	return mesh;
}

function ensureEnemyShieldBar(enemyId, enemy) {
	if ((enemy.shieldHp || 0) <= 0) {
		if (enemyShieldBars[enemyId]) {
			disposeOne(enemyShieldBars, enemyId, getScene());
		}
		return;
	}
	if (!enemyShieldBars[enemyId]) {
		enemyShieldBars[enemyId] = createEnemyShieldBarMesh(enemyId, enemy.x, enemy.z, enemy.type);
	}
}

/**
 * Update shield bar scale to reflect remaining absorb HP.
 * @param {string} enemyId
 * @param {object} enemy - { shieldHp, maxShieldHp }
 */
export function updateEnemyShieldBarMesh(enemyId, enemy) {
	const mesh = enemyShieldBars[enemyId];
	if (!mesh) return;

	const maxShield = enemy.maxShieldHp || enemy.shieldHp || 1;
	const ratio = Math.max(0, (enemy.shieldHp || 0) / maxShield);
	mesh.scale.x = ratio;
}

/**
 * Track windup emissive state for an enemy (actual emissive is applied by
 * `resolveEnemyEmissive` each frame).
 * @param {string} enemyId
 * @param {boolean} isWindup
 */
export function applyWindupFlash(enemyId, isWindup) {
	const host = enemiesMeshes[enemyId];
	const target = resolveBodyMesh(host);
	if (!target || !target.material || !target.material.emissive) return;

	if (isWindup) {
		if (!windupFlashing.has(enemyId)) {
			windupFlashing.add(enemyId);
		}
	} else if (windupFlashing.has(enemyId)) {
		windupFlashing.delete(enemyId);
	}
}

// ── Reveal highlight (Flare Beacon) ──

const REVEAL_GLOW_COLOR = 0xffaa00;
const REVEAL_GLOW_INTENSITY = 1.0;

/**
 * Record reveal eligibility for the emissive resolver (no direct material writes).
 * @param {string} enemyId
 * @param {object} enemy - { revealedUntil }
 */
export function applyRevealHighlight(enemyId, enemy) {
	if (enemy) {
		lastEnemyEmissiveContext[enemyId] = enemy;
	}
}

/**
 * Pick the highest-priority active emissive effect for an enemy mesh.
 * Priority: damage flash > windup > reveal > variant emissive tint > base.
 * @param {string} enemyId
 * @param {object | null} enemy - current enemy snapshot (optional outside sync)
 */
export function resolveEnemyEmissive(enemyId, enemy) {
	if (enemy) {
		lastEnemyEmissiveContext[enemyId] = enemy;
	} else {
		enemy = lastEnemyEmissiveContext[enemyId];
	}

	const host = enemiesMeshes[enemyId];
	const target = resolveBodyMesh(host);
	if (!target || !target.material || !target.material.emissive) return;

	const orig = enemyOrigBookkeeping(host);
	const now = performance.now();

	const damageSlot = enemyDamageFlash.get(enemyId);
	if (damageSlot && now < damageSlot.until) {
		target.material.emissive.set(damageSlot.color);
		target.material.emissiveIntensity = 1.5;
		return;
	}
	if (damageSlot && now >= damageSlot.until) {
		enemyDamageFlash.delete(enemyId);
	}

	const windup = windupFlashing.has(enemyId) || enemy?.attackState === 'windup';
	if (windup) {
		target.material.emissive.set(WINDUP_EMISSIVE_COLOR);
		target.material.emissiveIntensity = WINDUP_EMISSIVE_INTENSITY;
		return;
	}

	const revealed = enemy?.revealedUntil && Date.now() < enemy.revealedUntil;
	if (revealed) {
		target.material.emissive.set(REVEAL_GLOW_COLOR);
		target.material.emissiveIntensity = REVEAL_GLOW_INTENSITY;
		return;
	}

	const tint = enemy?.variant ? VARIANT_MESH_TINTS[enemy.variant] : null;
	if (tint) {
		target.material.emissive.set(tint.color);
		target.material.emissiveIntensity = tint.intensity;
		return;
	}

	target.material.emissive.set(orig.emissive);
	target.material.emissiveIntensity = orig.emissiveIntensity;
}

// ── Named-rare visuals (body tint, scale, floating nameplate) ──

/**
 * Parse a named-rare tint string (hex) to a Three.js color hex number.
 * @param {string} [tint]
 * @returns {number | null}
 */
export function parseNamedRareTintHex(tint) {
	if (!tint || typeof tint !== 'string') return null;
	let hex = tint.trim();
	if (hex.startsWith('#')) hex = hex.slice(1);
	if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
	return parseInt(hex, 16);
}

/**
 * Apply or restore the named-rare body tint on an enemy mesh.
 * @param {string} enemyId
 * @param {object} enemy - { namedRare }
 */
export function applyNamedRareTint(enemyId, enemy) {
	const host = enemiesMeshes[enemyId];
	const target = resolveBodyMesh(host);
	if (!target || !target.material || !target.material.color) return;

	const tintHex = enemy?.namedRare?.tint ? parseNamedRareTintHex(enemy.namedRare.tint) : null;
	if (tintHex != null) {
		target.material.color.setHex(tintHex);
	} else {
		const orig = enemyOrigBookkeeping(host);
		if (orig.color != null) {
			target.material.color.setHex(orig.color);
		}
	}
}

/**
 * Apply or restore named-rare scale multiplier on an enemy mesh.
 * @param {string} enemyId
 * @param {object} enemy - { namedRare }
 */
function setEnemyMeshUniformScale(mesh, scaled) {
	if (typeof mesh.scale.setScalar === 'function') {
		mesh.scale.setScalar(scaled);
	} else if (typeof mesh.scale.set === 'function') {
		mesh.scale.set(scaled, scaled, scaled);
	} else {
		mesh.scale.x = scaled;
		mesh.scale.y = scaled;
		mesh.scale.z = scaled;
	}
}

export function applyNamedRareScale(enemyId, enemy) {
	const mesh = enemiesMeshes[enemyId];
	if (!mesh || !mesh.scale) return;

	if (enemy?.namedRare) {
		if (mesh._origScale == null) {
			mesh._origScale = mesh.scale.x ?? 1;
		}
		const mult = enemy.namedRare.scaleMult ?? 1;
		setEnemyMeshUniformScale(mesh, mesh._origScale * mult);
		return;
	}

	if (mesh._origScale == null) return;
	setEnemyMeshUniformScale(mesh, mesh._origScale);
	delete mesh._origScale;
}

/**
 * Create, position, or dispose the named-rare nameplate sprite above an enemy.
 * @param {string} enemyId
 * @param {object} enemy - { namedRare, x, z }
 * @param {number} renderY - enemy mesh center Y
 */
export function applyEnemyNameplate(enemyId, enemy, renderY) {
	const scene = getScene();
	if (enemy?.namedRare?.name) {
		const label = enemy.namedRare.name;
		if (!enemyNameplates[enemyId] || enemyNameplates[enemyId].userData.namedRareName !== label) {
			if (enemyNameplates[enemyId]) disposeEnemyNameplate(enemyId);
			const np = createEnemyNameplate(label);
			scene.add(np);
			enemyNameplates[enemyId] = np;
		}
		enemyNameplates[enemyId].position.set(
			enemy.x,
			renderY + NAMEPLATE_OFFSET_Y,
			enemy.z,
		);
	} else if (enemyNameplates[enemyId]) {
		disposeEnemyNameplate(enemyId);
	}
}

// ── Variant visuals (body tint + floating badge) ──

/** Cool cyan body tint for warded enemies — distinct from grunt/skirmisher/miniboss palettes. */
export const WARDED_TINT = 0x22d3ee;

/** Red body tint for frenzied enemies — distinct from volatile hot-orange badge. */
export const FRENZIED_TINT = 0xb91c1c;

/** @type {Record<string, number>} */
const VARIANT_BADGE_COLORS = {
	default: 0xc026d3, // magenta — distinct from amber reveal/yellow lock-on
	leeching: 0x14b8a6, // teal — distinct from default variant badge
	warded: 0x22d3ee, // cyan — matches warded body tint / shield bar
	volatile: 0xf97316, // hot orange — distinct "will detonate" threat read
	frenzied: 0xdc2626, // red — distinct from volatile orange and other variant badges
};

/** @type {Record<string, { color: number, intensity: number }>} */
const VARIANT_MESH_TINTS = {
	leeching: { color: 0x0d9488, intensity: 0.45 },
};

function variantBadgeColor(variant) {
	return VARIANT_BADGE_COLORS[variant] ?? VARIANT_BADGE_COLORS.default;
}

/** Per-variant badge colors; unknown variants use the default badge color. */
export const VARIANT_MARKER_COLORS = {
	warded: VARIANT_BADGE_COLORS.warded,
	volatile: VARIANT_BADGE_COLORS.volatile,
	frenzied: VARIANT_BADGE_COLORS.frenzied,
};

/**
 * Resolve the floating variant badge color for a variant id.
 * @param {string} [variant]
 * @returns {number}
 */
export function variantMarkerColor(variant) {
	return variantBadgeColor(variant);
}

/**
 * Apply or clear per-variant body tints on an enemy mesh (color channel only;
 * windup/reveal flashes continue to use emissive on the same material).
 * @param {string} enemyId
 * @param {object} enemy - { variant }
 */
export function applyEnemyVariantTint(enemyId, enemy) {
	const host = enemiesMeshes[enemyId];
	const target = resolveBodyMesh(host);
	if (!target || !target.material || !target.material.color) return;

	if (enemy && enemy.variant === 'warded') {
		target.material.color.setHex(WARDED_TINT);
	} else if (enemy && enemy.variant === 'frenzied') {
		target.material.color.setHex(FRENZIED_TINT);
	} else {
		const orig = enemyOrigBookkeeping(host);
		if (orig.color != null) {
			target.material.color.setHex(orig.color);
		}
	}
}

/**
 * Build the floating badge shown above a variant ("elite") enemy: a small
 * emissive diamond, kept separate from the enemy mesh so it never collides with
 * the windup/reveal emissive bookkeeping on the enemy material.
 * @param {number} badgeColor
 * @returns {THREE.Mesh}
 */
function createVariantMarker(badgeColor) {
	const geo = new THREE.OctahedronGeometry(0.22);
	const mat = new THREE.MeshStandardMaterial({
		color: badgeColor,
		emissive: badgeColor,
		emissiveIntensity: 0.9,
	});
	return new THREE.Mesh(geo, mat);
}

/**
 * Add or remove a variant badge for an enemy, driven purely by `enemy.variant`
 * each update. A truthy variant gets a badge positioned above the mesh; a
 * falsy/absent variant has any existing badge disposed, so a reused enemy id
 * never keeps a stale marker. Safe when `variant` is undefined/null.
 * @param {string} enemyId
 * @param {object} enemy - { variant, x, z, type }
 */
export function applyVariantMarker(enemyId, enemy) {
	const scene = getScene();
	if (enemy && enemy.variant) {
		const badgeColor = variantBadgeColor(enemy.variant);
		if (!variantMarkerMeshes[enemyId]) {
			variantMarkerMeshes[enemyId] = createVariantMarker(badgeColor);
			scene.add(variantMarkerMeshes[enemyId]);
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
		// Slow spin so the badge reads as an active marker rather than scenery.
		marker.rotation.y = ((Date.now() % 4000) / 4000) * Math.PI * 2;
	} else if (variantMarkerMeshes[enemyId]) {
		disposeOne(variantMarkerMeshes, enemyId, scene);
	}
}

/**
 * Record variant emissive tint eligibility for the resolver (no direct writes).
 * @param {string} enemyId
 * @param {object} enemy - { variant, revealedUntil, attackState }
 */
export function applyVariantEmissiveTint(enemyId, enemy) {
	if (enemy) {
		lastEnemyEmissiveContext[enemyId] = enemy;
	}
}

// ── Frenzied enrage telegraph ring ──

/**
 * Create a pulsing red ring on the ground around a frenzied enemy during its
 * pre-enrage telegraph window.
 * @returns {THREE.Mesh}
 */
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

/**
 * Show or hide the frenzied enrage telegraph ring for an enemy. Driven by
 * `enemy.enrageTelegraphUntil` from the server snapshot: when the timestamp
 * is in the future, the ring is shown with pulsing opacity; otherwise it is
 * disposed.
 * @param {string} enemyId
 * @param {object} enemy - { enrageTelegraphUntil, x, z }
 */
export function applyFrenziedTelegraphRing(enemyId, enemy) {
	const scene = getScene();
	const now = Date.now();
	const telegraphActive = enemy && enemy.enrageTelegraphUntil && now < enemy.enrageTelegraphUntil;

	if (telegraphActive) {
		if (!frenziedTelegraphMeshes[enemyId]) {
			frenziedTelegraphMeshes[enemyId] = createFrenziedTelegraphRing();
			scene.add(frenziedTelegraphMeshes[enemyId]);
		}
		const ring = frenziedTelegraphMeshes[enemyId];
		ring.position.set(enemy.x, GROUND_OVERLAY_Y, enemy.z);
		// Pulse opacity: oscillate between 0.25 and 0.85 at ~2 Hz
		const pulse = 0.5 + 0.5 * Math.sin((now % 1000) / 1000 * Math.PI * 4);
		ring.material.opacity = 0.25 + pulse * 0.6;
	} else if (frenziedTelegraphMeshes[enemyId]) {
		disposeOne(frenziedTelegraphMeshes, enemyId, scene);
	}
}

// ── Enemy hitbox group + attack telegraph ──

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

/**
 * Per-minion-type VFX for enemy HP-drop (minion tick damage) attribution.
 * Keyed by minion `type`. Each entry carries the enemy flash color, the
 * attacking-minion flash color, and a `spawn(ctx)` that reproduces the exact
 * effect for that type. `ctx` is `{ minion, enemy, renderY, dir }` where `dir`
 * is the minion→enemy direction (falling back to `{ x: 1, z: 0 }`).
 *
 * The default (no attributable minion, or unknown type) lives in
 * `MINION_HIT_VFX_DEFAULT`: enemy flash `0xff4444`, minion flash `0x88ff88`,
 * and a plain hit spark at the enemy.
 */
const MINION_HIT_VFX = {
	thunderbird: {
		enemyFlash: 0x38bdf8,
		minionFlash: 0x7dd3fc,
		spawn: ({ minion, dir }) => {
			spawnChainLightningEffect({ x: minion.x, z: minion.z }, dir);
		},
	},
	storm_eagle: {
		enemyFlash: 0x67e8f9,
		minionFlash: 0x93c5fd,
		spawn: ({ minion, enemy }) => {
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
		spawn: ({ minion, enemy, renderY, dir }) => {
			const origin = { x: minion.x, z: minion.z };
			const breathStyle = {
				range: 8,
				coneAngle: Math.PI / 2,
				color: 0xef4444,
				emissive: 0x9333ea,
			};
			spawnAttackEffect(origin, dir, breathStyle);
			if (typeof spawnFireTrailEffect === 'function') {
				spawnFireTrailEffect(origin, dir, breathStyle);
			}
			if (typeof spawnParticleBurst === 'function') {
				spawnParticleBurst(
					{ x: enemy.x, y: renderY, z: enemy.z },
					{ color: 0xef4444, emissive: 0xff3b00, count: 8, spread: 0.85 },
				);
			}
		},
	},
	null_crawler: {
		enemyFlash: 0x22d3ee,
		minionFlash: 0x67e8f9,
		spawn: ({ minion, dir }) => {
			spawnAttackEffect(
				{ x: minion.x, z: minion.z },
				dir,
				{
					effect: 'returning_projectile',
					returnPasses: 0,
					range: minion.attackRange ?? 14,
					projectileHitWidth: minion.projectileHitWidth ?? 0.8,
					color: 0x22d3ee,
					emissive: 0x06b6d4,
				}
			);
		},
	},
	bulkhead_mauler: {
		enemyFlash: 0xf59e0b,
		minionFlash: 0xfbbf24,
		spawn: ({ minion, dir }) => {
			spawnAttackEffect(
				{ x: minion.x, z: minion.z },
				dir,
				{
					range: 4,
					coneAngle: (Math.PI * 2) / 3,
					color: 0x78716c,
					emissive: 0xf59e0b,
				}
			);
		},
	},
};

const MINION_HIT_VFX_DEFAULT = {
	enemyFlash: 0xff4444,
	minionFlash: 0x88ff88,
	spawn: ({ enemy, renderY }) => {
		spawnHitSpark({ x: enemy.x, y: renderY, z: enemy.z });
	},
};

/**
 * Per-frame enemy reconcile: create/position enemy meshes + hitbox groups,
 * health/shield bars, flying shadows, lock-on rings, minion-attribution hit VFX,
 * windup/reveal/variant/frenzied telegraph visuals, and slow/burn markers, then
 * dispose every parallel enemy map for enemies that have left the snapshot.
 *
 * Reads scene/map stores shared via rendererState.js and invokes cross-cutting
 * renderer.js helpers at call time. Behavior is unchanged from the prior inline
 * implementation in renderer.js.
 * @param {object} gs - current game-state snapshot ({ enemies, minions, layout, ... })
 */
export function syncEnemyMeshes(gs) {
	const scene = getScene();
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
		// Flying enemies render at the floor-aware surface + altitude; grounded
		// enemies keep their exact prior placement (flyingRenderOffset() → 0).
		const renderY = halfHeight + flyingRenderOffset(enemy, gs.layout);
		enemiesMeshes[enemy.id].position.set(enemy.x, renderY, enemy.z);
		syncFlyingShadow(enemyShadows, enemy, gs.layout);

		ensureEnemyHealthBar(enemy.id, enemy);
		const healthBar = enemyHealthBars[enemy.id];
		if (healthBar) {
			healthBar.position.set(enemy.x, renderY + 0.5, enemy.z);
			updateHealthBarMesh(enemy.id, enemy);
		}
		ensureEnemyShieldBar(enemy.id, enemy);
		const shieldBar = enemyShieldBars[enemy.id];
		if (shieldBar) {
			shieldBar.position.set(enemy.x, renderY + 0.65, enemy.z);
			updateEnemyShieldBarMesh(enemy.id, enemy);
		}
		if (enemyHitboxMeshes[enemy.id]) {
			enemyHitboxMeshes[enemy.id].position.set(enemy.x, GROUND_OVERLAY_Y, enemy.z);
		}
		syncLockOnRing(enemy.id, enemy.x, renderY, enemy.z);

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
				const vfx = MINION_HIT_VFX[nearestMinion?.type] ?? MINION_HIT_VFX_DEFAULT;
				const dir = nearestMinion
					? {
						x: enemy.x - nearestMinion.x,
						z: enemy.z - nearestMinion.z,
					}
					: { x: 1, z: 0 };
				flashMesh(enemiesMeshes[enemy.id], vfx.enemyFlash, 150, enemy.id);
				vfx.spawn({ minion: nearestMinion, enemy, renderY, dir });

				if (nearestMinion && minionsMeshes[nearestMinion.id]) {
					flashMesh(minionsMeshes[nearestMinion.id], vfx.minionFlash, 200);
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

		if (enemy.namedRare) {
			applyNamedRareTint(enemy.id, enemy);
			applyNamedRareScale(enemy.id, enemy);
			applyEnemyNameplate(enemy.id, enemy, renderY);
			// Named-rare enemies skip affix-variant badge/tint logic.
			applyEnemyVariantTint(enemy.id, {});
			applyVariantMarker(enemy.id, {});
			applyVariantEmissiveTint(enemy.id, {});
		} else {
			applyNamedRareTint(enemy.id, enemy);
			applyNamedRareScale(enemy.id, enemy);
			applyEnemyNameplate(enemy.id, enemy, renderY);

			// ── Variant body tint (warded cyan; others use type default) ──
			applyEnemyVariantTint(enemy.id, enemy);

			// ── Variant marker (elite enemy badge) ──
			applyVariantMarker(enemy.id, enemy);

			// ── Variant mesh tint (e.g. leeching) ──
			applyVariantEmissiveTint(enemy.id, enemy);
		}

		resolveEnemyEmissive(enemy.id, enemy);

		// ── Frenzied enrage telegraph ring ──
		applyFrenziedTelegraphRing(enemy.id, enemy);

		// ── Slow status ring (driven by the broadcast slowedUntil) ──
		applySlowIndicator(enemySlowMarkers, enemy.id, enemy);

		// ── Burning flame (driven by the broadcast burningUntil) ──
		applyBurnIndicator(enemyBurnMarkers, enemy.id, enemy);
	}

	// Clean up removed enemies
	disposeStaleMeshes(enemiesMeshes, currentEnemyIds, scene);
	disposeStaleMeshes(enemyHealthBars, currentEnemyIds, scene);
	disposeStaleMeshes(enemyShieldBars, currentEnemyIds, scene);
	disposeStaleMeshes(enemyHitboxMeshes, currentEnemyIds, scene);
	disposeStaleMeshes(enemyShadows, currentEnemyIds, scene);
	disposeStaleMeshes(enemyLockOnRings, currentEnemyIds, scene);
	disposeStaleMeshes(variantMarkerMeshes, currentEnemyIds, scene);
	for (const id of Object.keys(enemyNameplates)) {
		if (!currentEnemyIds.has(id)) {
			disposeEnemyNameplate(id);
		}
	}
	disposeStaleMeshes(frenziedTelegraphMeshes, currentEnemyIds, scene);
	disposeStaleMeshes(enemySlowMarkers, currentEnemyIds, scene);
	disposeStaleMeshes(enemyBurnMarkers, currentEnemyIds, scene);
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
	for (const id of enemyDamageFlash.keys()) {
		if (!currentEnemyIds.has(id)) {
			enemyDamageFlash.delete(id);
		}
	}
	for (const id of Object.keys(lastEnemyEmissiveContext)) {
		if (!currentEnemyIds.has(id)) {
			delete lastEnemyEmissiveContext[id];
		}
	}
}
