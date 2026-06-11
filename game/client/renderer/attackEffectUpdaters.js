// ── Attack-effect updater registry ──
// Shared primitives dispatch on fx.kind; unmigrated effects still use boolean
// flags in updateAttackEffects until later sub-tickets register them here.

import { HIT_SPARK_DURATION } from '../config.js';
import { getScene } from './rendererState.js';

export const ATTACK_EFFECT_KINDS = {
	particleBurst: 'particleBurst',
	projectileTrail: 'projectileTrail',
	impactDecal: 'impactDecal',
	telegraphRing: 'telegraphRing',
	hitSpark: 'hitSpark',
	lightningArc: 'lightningArc',
	passageUnlockGate: 'passageUnlockGate',
};

function disposeEffectObject(mesh, targetScene) {
	const sc = targetScene || getScene();
	if (!mesh || !sc) return;
	sc.remove(mesh);
	mesh.traverse?.((child) => {
		if (child.geometry) child.geometry.dispose();
		if (child.material) child.material.dispose();
	});
	if (mesh.geometry) mesh.geometry.dispose();
	if (mesh.material) mesh.material.dispose();
}

function disposeLineEffect(fx) {
	const sc = fx._scene || getScene();
	if (!sc) return;
	sc.remove(fx.mesh);
	fx.mesh.geometry.dispose();
	fx.mesh.material.dispose();
}

export function shouldExpireAttackEffect(fx, elapsed) {
	return elapsed >= fx.duration;
}

export function disposeAttackEffect(fx, activeEffects, index) {
	if (fx.kind === ATTACK_EFFECT_KINDS.lightningArc || fx.kind === ATTACK_EFFECT_KINDS.hitSpark) {
		disposeLineEffect(fx);
	} else {
		disposeEffectObject(fx.mesh, fx._scene || getScene());
	}
	activeEffects.splice(index, 1);
}

function updateParticleBurst(fx, elapsed) {
	const t = Math.min(elapsed / fx.duration, 1.0);
	const opacity = Math.max(0.01, 1.0 - t);
	for (let c = 0; c < fx.mesh.children.length; c += 1) {
		const particle = fx.mesh.children[c];
		const v = particle.userData.velocity;
		particle.position.set(v.x * t, v.y * t - t * t * 0.8, v.z * t);
		particle.material.opacity = opacity;
	}
}

function updateProjectileTrail(fx, elapsed) {
	const t = Math.min(elapsed / fx.duration, 1.0);
	const travel = fx.range * t;
	fx.mesh.position.x = fx.origin.x + fx.direction.x * travel;
	fx.mesh.position.z = fx.origin.z + fx.direction.z * travel;
	fx.mesh.material.opacity = Math.max(0.01, 1.0 - t);
}

function updateImpactDecal(fx, elapsed) {
	const t = Math.min(elapsed / fx.duration, 1.0);
	const scale = t < 0.2 ? 0.6 + (t / 0.2) * 0.4 : 1.0;
	fx.mesh.scale.setScalar(scale);
	fx.mesh.material.opacity = Math.max(0.01, 1.0 - t);
}

function updateTelegraphRing(fx, elapsed) {
	const t = Math.min(elapsed / fx.duration, 1.0);
	const expandT = Math.min(t / 0.4, 1.0);
	fx.mesh.scale.setScalar(Math.max(0.001, fx.telegraphRadius * expandT));
	const pulse = 0.55 + 0.35 * Math.abs(Math.sin(elapsed / 120));
	fx.mesh.material.opacity = Math.max(0.01, pulse * (1.0 - t));
}

function updateHitSpark(fx, elapsed) {
	const sparkT = Math.min(elapsed / HIT_SPARK_DURATION, 1.0);
	const scalePhase = sparkT < 0.2 ? sparkT / 0.2 : 1.0 - (sparkT - 0.2) / 0.8;
	fx.mesh.scale.setScalar(Math.max(0.01, 1.0 + scalePhase * 2.0));
	fx.mesh.position.y = fx.origin.y + sparkT * 0.5;
	fx.mesh.material.opacity = Math.max(0.01, 1.0 - sparkT);
}

function updateLightningArc(fx, elapsed) {
	const lifeRatio = 1.0 - (elapsed / fx.duration);
	fx.mesh.material.opacity = Math.max(0.01, lifeRatio);
}

function updatePassageUnlockGate(fx, elapsed) {
	const t = Math.min(elapsed / fx.duration, 1.0);
	const scale = 1.0 + t * 0.35;
	fx.mesh.scale.setScalar(scale);
	fx.mesh.traverse((child) => {
		if (!child.material) return;
		child.material.opacity = Math.max(0.01, 1.0 - t);
		child.material.emissiveIntensity = Math.max(0.01, 1.8 * (1.0 - t));
	});
}

export const ATTACK_EFFECT_UPDATERS = {
	[ATTACK_EFFECT_KINDS.particleBurst]: updateParticleBurst,
	[ATTACK_EFFECT_KINDS.projectileTrail]: updateProjectileTrail,
	[ATTACK_EFFECT_KINDS.impactDecal]: updateImpactDecal,
	[ATTACK_EFFECT_KINDS.telegraphRing]: updateTelegraphRing,
	[ATTACK_EFFECT_KINDS.hitSpark]: updateHitSpark,
	[ATTACK_EFFECT_KINDS.lightningArc]: updateLightningArc,
	[ATTACK_EFFECT_KINDS.passageUnlockGate]: updatePassageUnlockGate,
};

/**
 * Run the registered updater for fx.kind. Returns true when a handler ran.
 * @param {object} fx
 * @param {number} elapsed
 * @returns {boolean}
 */
export function runAttackEffectUpdater(fx, elapsed) {
	const updater = ATTACK_EFFECT_UPDATERS[fx.kind];
	if (!updater) return false;
	updater(fx, elapsed);
	return true;
}
