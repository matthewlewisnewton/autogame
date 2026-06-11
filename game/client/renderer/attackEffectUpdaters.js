// ── Attack-effect updater registry ──
// Shared primitives and column/ring updaters dispatch on fx.kind; unmigrated
// effects still use boolean flags in updateAttackEffects until later sub-tickets.

import { HIT_SPARK_DURATION, SUMMON_EXPAND_MS } from '../config.js';
import { getScene } from './rendererState.js';

export const ATTACK_EFFECT_KINDS = {
	particleBurst: 'particleBurst',
	projectileTrail: 'projectileTrail',
	impactDecal: 'impactDecal',
	telegraphRing: 'telegraphRing',
	hitSpark: 'hitSpark',
	lightningArc: 'lightningArc',
	passageUnlockGate: 'passageUnlockGate',
	expandFadeRing: 'expandFadeRing',
	spikeTrapRing: 'spikeTrapRing',
	dragonsBreathScorch: 'dragonsBreathScorch',
	lightColumn: 'lightColumn',
	thermalColumn: 'thermalColumn',
	etherSiphonColumn: 'etherSiphonColumn',
	legionMarshalColumn: 'legionMarshalColumn',
	batteryAutomatonColumn: 'batteryAutomatonColumn',
	chronoTriggerColumn: 'chronoTriggerColumn',
	etherSiphonRing: 'etherSiphonRing',
	batteryAutomatonRing: 'batteryAutomatonRing',
	chronoTriggerRipple: 'chronoTriggerRipple',
	glacierRuptureRing: 'glacierRuptureRing',
	spikeTrapSpike: 'spikeTrapSpike',
};

// Default shaft dims for lightColumn (Divine Grace / telepipe / cleanse); per-effect
// overrides live on fx.columnHeight, fx.columnBaseY, fx.columnOpacity.
const DIVINE_GRACE_COLUMN_HEIGHT = 4.5;
const DIVINE_GRACE_COLUMN_BASE_Y = 0.1;
const DIVINE_GRACE_COLUMN_OPACITY = 0.7;

const THERMAL_COLUMN_HEIGHT = 4.5;
const THERMAL_COLUMN_BASE_Y = 0.1;
const THERMAL_COLUMN_OPACITY = 0.75;
const THERMAL_COLUMN_EMISSIVE_INTENSITY = 1.4;

const ETHER_SIPHON_COLUMN_HEIGHT = 4.5;
const ETHER_SIPHON_COLUMN_BASE_Y = 0.1;
const ETHER_SIPHON_COLUMN_OPACITY = 0.7;
const ETHER_SIPHON_EMISSIVE_INTENSITY = 1.4;
const ETHER_SIPHON_RING_CONTRACT_MIN = 0.35;

const LEGION_MARSHAL_COLUMN_HEIGHT = 4.5;
const LEGION_MARSHAL_COLUMN_BASE_Y = 0.1;
const LEGION_MARSHAL_COLUMN_OPACITY = 0.7;
const LEGION_MARSHAL_EMISSIVE_INTENSITY = 1.4;

const BATTERY_AUTOMATON_COLUMN_HEIGHT = 2.5;
const BATTERY_AUTOMATON_COLUMN_BASE_Y = 0.1;
const BATTERY_AUTOMATON_COLUMN_OPACITY = 0.75;
const BATTERY_AUTOMATON_EMISSIVE_INTENSITY = 1.5;

const CHRONO_TRIGGER_COLUMN_HEIGHT = 1.4;
const CHRONO_TRIGGER_COLUMN_BASE_Y = 0.1;
const CHRONO_TRIGGER_COLUMN_OPACITY = 0.72;
const CHRONO_TRIGGER_EMISSIVE_INTENSITY = 1.5;
const CHRONO_TRIGGER_TICK_MS = 55;

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

function updateExpandFadeRing(fx, elapsed) {
	const expandT = Math.min(elapsed / SUMMON_EXPAND_MS, 1.0);
	const scale = fx.radius * expandT * 2;
	fx.mesh.scale.setScalar(Math.max(0.001, scale));

	if (elapsed > SUMMON_EXPAND_MS) {
		const fadeRatio = 1.0 - (elapsed - SUMMON_EXPAND_MS) / (fx.duration - SUMMON_EXPAND_MS);
		fx.mesh.material.opacity = Math.max(0.01, fadeRatio);
	}
}

function updateLightColumn(fx, elapsed) {
	const t = Math.min(elapsed / fx.duration, 1.0);
	const riseT = Math.min(t / 0.35, 1.0);
	const s = Math.max(0.001, riseT);
	fx.mesh.scale.y = s;
	const colHeight = fx.columnHeight ?? DIVINE_GRACE_COLUMN_HEIGHT;
	const colBaseY = fx.columnBaseY ?? DIVINE_GRACE_COLUMN_BASE_Y;
	const colOpacity = fx.columnOpacity ?? DIVINE_GRACE_COLUMN_OPACITY;
	fx.mesh.position.y = colBaseY + (colHeight * s) / 2;
	fx.mesh.material.opacity = Math.max(0.01, colOpacity * (1.0 - t));
}

function updateThermalColumn(fx, elapsed) {
	const t = Math.min(elapsed / fx.duration, 1.0);
	const riseT = Math.min(t / 0.35, 1.0);
	const s = Math.max(0.001, riseT);
	fx.mesh.scale.y = s;
	fx.mesh.position.y = THERMAL_COLUMN_BASE_Y + (THERMAL_COLUMN_HEIGHT * s) / 2;
	const fade = Math.max(0.01, THERMAL_COLUMN_OPACITY * (1.0 - t));
	fx.mesh.material.opacity = fade;
	const baseIntensity = fx._baseEmissiveIntensity ?? THERMAL_COLUMN_EMISSIVE_INTENSITY;
	const flicker = 1.0 + 0.25 * Math.sin(elapsed * 0.02);
	fx.mesh.material.emissiveIntensity = baseIntensity * flicker * fade;
}

function updateEtherSiphonColumn(fx, elapsed) {
	const t = Math.min(elapsed / fx.duration, 1.0);
	const riseT = Math.min(t / 0.35, 1.0);
	const s = Math.max(0.001, riseT);
	fx.mesh.scale.y = s;
	fx.mesh.position.y = ETHER_SIPHON_COLUMN_BASE_Y + (ETHER_SIPHON_COLUMN_HEIGHT * s) / 2;
	const fade = Math.max(0.01, ETHER_SIPHON_COLUMN_OPACITY * (1.0 - t));
	fx.mesh.material.opacity = fade;
	const baseIntensity = fx._baseEmissiveIntensity ?? ETHER_SIPHON_EMISSIVE_INTENSITY;
	const flicker = 1.0 + 0.25 * Math.sin(elapsed * 0.02);
	fx.mesh.material.emissiveIntensity = baseIntensity * flicker * fade;
}

function updateLegionMarshalColumn(fx, elapsed) {
	const t = Math.min(elapsed / fx.duration, 1.0);
	const riseT = Math.min(t / 0.35, 1.0);
	const s = Math.max(0.001, riseT);
	fx.mesh.scale.y = s;
	fx.mesh.position.y = LEGION_MARSHAL_COLUMN_BASE_Y + (LEGION_MARSHAL_COLUMN_HEIGHT * s) / 2;
	const fade = Math.max(0.01, LEGION_MARSHAL_COLUMN_OPACITY * (1.0 - t));
	fx.mesh.material.opacity = fade;
	const baseIntensity = fx._baseEmissiveIntensity ?? LEGION_MARSHAL_EMISSIVE_INTENSITY;
	const flicker = 1.0 + 0.25 * Math.sin(elapsed * 0.02);
	fx.mesh.material.emissiveIntensity = baseIntensity * flicker * fade;
}

function updateBatteryAutomatonColumn(fx, elapsed) {
	const t = Math.min(elapsed / fx.duration, 1.0);
	const riseT = Math.min(t / 0.35, 1.0);
	const s = Math.max(0.001, riseT);
	fx.mesh.scale.y = s;
	fx.mesh.position.y = BATTERY_AUTOMATON_COLUMN_BASE_Y + (BATTERY_AUTOMATON_COLUMN_HEIGHT * s) / 2;
	const fade = Math.max(0.01, BATTERY_AUTOMATON_COLUMN_OPACITY * (1.0 - t));
	fx.mesh.material.opacity = fade;
	const baseIntensity = fx._baseEmissiveIntensity ?? BATTERY_AUTOMATON_EMISSIVE_INTENSITY;
	const flicker = 1.0 + 0.35 * Math.sin(elapsed * 0.03);
	fx.mesh.material.emissiveIntensity = baseIntensity * flicker * fade;
}

function updateChronoTriggerColumn(fx, elapsed) {
	const t = Math.min(elapsed / fx.duration, 1.0);
	const riseT = Math.min(t / 0.35, 1.0);
	const s = Math.max(0.001, riseT);
	fx.mesh.scale.y = s;
	fx.mesh.position.y = CHRONO_TRIGGER_COLUMN_BASE_Y + (CHRONO_TRIGGER_COLUMN_HEIGHT * s) / 2;
	const fade = Math.max(0.01, CHRONO_TRIGGER_COLUMN_OPACITY * (1.0 - t));
	fx.mesh.material.opacity = fade;
	const baseIntensity = fx._baseEmissiveIntensity ?? CHRONO_TRIGGER_EMISSIVE_INTENSITY;
	const tick = 1.0 + 0.3 * Math.sin(elapsed / CHRONO_TRIGGER_TICK_MS);
	fx.mesh.material.emissiveIntensity = baseIntensity * tick * fade;
}

function updateEtherSiphonRing(fx, elapsed) {
	const t = Math.min(elapsed / fx.duration, 1.0);
	const contractT = Math.min(t / 0.55, 1.0);
	const scaleFactor = 1.0 - contractT * (1.0 - ETHER_SIPHON_RING_CONTRACT_MIN);
	fx.mesh.scale.setScalar(Math.max(0.001, fx.radius * scaleFactor));
	const pulse = 0.55 + 0.35 * Math.abs(Math.sin(elapsed / 110));
	fx.mesh.material.opacity = Math.max(0.01, pulse * (1.0 - t * 0.6));
}

function updateBatteryAutomatonRing(fx, elapsed) {
	const expandMs = Math.min(SUMMON_EXPAND_MS, fx.duration * 0.55);
	const expandT = Math.min(elapsed / expandMs, 1.0);
	const scale = fx.radius * expandT * 2;
	fx.mesh.scale.setScalar(Math.max(0.001, scale));

	if (elapsed > expandMs) {
		const fadeRatio = 1.0 - (elapsed - expandMs) / (fx.duration - expandMs);
		fx.mesh.material.opacity = Math.max(0.01, fadeRatio);
	}
	const baseIntensity = fx._baseEmissiveIntensity ?? 1.2;
	const flicker = 1.0 + 0.3 * Math.sin(elapsed * 0.028);
	fx.mesh.material.emissiveIntensity = baseIntensity * flicker;
}

function updateChronoTriggerRipple(fx, elapsed) {
	const expandT = Math.min(elapsed / SUMMON_EXPAND_MS, 1.0);
	const scale = fx.radius * expandT * 2;
	fx.mesh.scale.setScalar(Math.max(0.001, scale));
	const tick = 0.6 + 0.4 * Math.abs(Math.sin(elapsed / CHRONO_TRIGGER_TICK_MS));
	if (elapsed > SUMMON_EXPAND_MS) {
		const fadeRatio = 1.0 - (elapsed - SUMMON_EXPAND_MS) / (fx.duration - SUMMON_EXPAND_MS);
		fx.mesh.material.opacity = Math.max(0.01, fadeRatio * tick);
	} else {
		fx.mesh.material.opacity = Math.max(0.01, tick);
	}
	fx.mesh.material.emissiveIntensity = 1.2 * tick;
}

function updateGlacierRuptureRing(fx, elapsed) {
	const expandT = Math.min(elapsed / SUMMON_EXPAND_MS, 1.0);
	const scale = fx.radius * expandT * 2;
	fx.mesh.scale.setScalar(Math.max(0.001, scale));

	if (elapsed > SUMMON_EXPAND_MS) {
		const fadeRatio = 1.0 - (elapsed - SUMMON_EXPAND_MS) / (fx.duration - SUMMON_EXPAND_MS);
		fx.mesh.material.opacity = Math.max(0.01, fadeRatio);
	}
	const fracturePulse = 0.75 + 0.25 * Math.abs(Math.sin(elapsed / 85));
	fx.mesh.material.emissiveIntensity = 1.15 * fracturePulse;
}

function updateSpikeTrapSpike(fx, elapsed) {
	const t = Math.min(elapsed / fx.duration, 1.0);
	const riseT = Math.min(t / 0.3, 1.0);
	const s = Math.max(0.001, riseT);
	fx.mesh.scale.y = s;
	fx.mesh.position.y = (fx.spikeHeight * s) / 2;
	fx.mesh.material.opacity = Math.max(0.01, 1.0 - t);
}

export const ATTACK_EFFECT_UPDATERS = {
	[ATTACK_EFFECT_KINDS.particleBurst]: updateParticleBurst,
	[ATTACK_EFFECT_KINDS.projectileTrail]: updateProjectileTrail,
	[ATTACK_EFFECT_KINDS.impactDecal]: updateImpactDecal,
	[ATTACK_EFFECT_KINDS.telegraphRing]: updateTelegraphRing,
	[ATTACK_EFFECT_KINDS.hitSpark]: updateHitSpark,
	[ATTACK_EFFECT_KINDS.lightningArc]: updateLightningArc,
	[ATTACK_EFFECT_KINDS.passageUnlockGate]: updatePassageUnlockGate,
	[ATTACK_EFFECT_KINDS.expandFadeRing]: updateExpandFadeRing,
	[ATTACK_EFFECT_KINDS.spikeTrapRing]: updateExpandFadeRing,
	[ATTACK_EFFECT_KINDS.dragonsBreathScorch]: updateExpandFadeRing,
	[ATTACK_EFFECT_KINDS.lightColumn]: updateLightColumn,
	[ATTACK_EFFECT_KINDS.thermalColumn]: updateThermalColumn,
	[ATTACK_EFFECT_KINDS.etherSiphonColumn]: updateEtherSiphonColumn,
	[ATTACK_EFFECT_KINDS.legionMarshalColumn]: updateLegionMarshalColumn,
	[ATTACK_EFFECT_KINDS.batteryAutomatonColumn]: updateBatteryAutomatonColumn,
	[ATTACK_EFFECT_KINDS.chronoTriggerColumn]: updateChronoTriggerColumn,
	[ATTACK_EFFECT_KINDS.etherSiphonRing]: updateEtherSiphonRing,
	[ATTACK_EFFECT_KINDS.batteryAutomatonRing]: updateBatteryAutomatonRing,
	[ATTACK_EFFECT_KINDS.chronoTriggerRipple]: updateChronoTriggerRipple,
	[ATTACK_EFFECT_KINDS.glacierRuptureRing]: updateGlacierRuptureRing,
	[ATTACK_EFFECT_KINDS.spikeTrapSpike]: updateSpikeTrapSpike,
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
