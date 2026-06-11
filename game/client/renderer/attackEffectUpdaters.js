// ── Attack-effect updater registry ──
// Shared primitives, column/ring, and group-child updaters dispatch on fx.kind;
// unmigrated effects still use boolean flags in updateAttackEffects until later
// sub-tickets.

import { HIT_SPARK_DURATION, SUMMON_EXPAND_MS } from '../config.js';
import { FLOOR_Y } from '../dungeon.js';
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
	aegisSentinelShield: 'aegisSentinelShield',
	aegisSentinelDeploy: 'aegisSentinelDeploy',
	glacierRuptureShards: 'glacierRuptureShards',
	solarEdgeImpact: 'solarEdgeImpact',
	manaPrismEffect: 'manaPrismEffect',
	eventHorizonEffect: 'eventHorizonEffect',
	gravityWellPull: 'gravityWellPull',
	mirrorWardShell: 'mirrorWardShell',
	dragonsBreathCone: 'dragonsBreathCone',
	fireTrail: 'fireTrail',
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

const GROUND_OVERLAY_Y = FLOOR_Y + 0.07;
const AEGIS_SENTINEL_DOME_OPACITY = 0.58;
const AEGIS_SENTINEL_WALL_OPACITY = 0.72;
const AEGIS_SENTINEL_EMISSIVE_INTENSITY = 1.35;
const GLACIER_RUPTURE_SHARD_HEIGHT = 0.85;
const SOLAR_EDGE_DEFAULT_RING_RADIUS = 2.0;
const MANA_PRISM_CORE_BASE_Y = 0.5;
const MANA_PRISM_CORE_RISE = 1.1;
const MANA_PRISM_SHARD_SPREAD = 1.6;
const WYRMFLARE_BREATH_OPACITY = 0.72;
const WYRMFLARE_BREATH_EMISSIVE_INTENSITY = 1.5;
const WYRMFLARE_BREATH_LIFT_Y = 0.55;
const GRAVITY_WELL_PULL_RING_MIN_SCALE = 0.3;
const GRAVITY_WELL_VOID_EMISSIVE_INTENSITY = 1.65;
const HITBOX_FILL_OPACITY = 0.32;

function fadeHitboxOpacity(root, lifeRatio) {
	root.traverse((child) => {
		if (child.material && child.material.opacity != null) {
			const base = child.userData.hitboxOpacity ?? HITBOX_FILL_OPACITY;
			child.material.opacity = Math.max(0.01, lifeRatio * base);
		}
	});
}

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

export function disposeAttackEffect(fx, activeEffects, index, ctx) {
	if (fx.kind === ATTACK_EFFECT_KINDS.mirrorWardShell && fx.playerId && ctx?.mirrorWardShellsByPlayer) {
		ctx.mirrorWardShellsByPlayer.delete(fx.playerId);
	}
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

function updateAegisSentinelShield(fx, elapsed) {
	const t = Math.min(elapsed / fx.duration, 1.0);
	const expandT = Math.min(t / 0.4, 1.0);
	const pulse = 0.5 + 0.35 * Math.abs(Math.sin(elapsed / 250));
	for (let c = 0; c < fx.mesh.children.length; c += 1) {
		const child = fx.mesh.children[c];
		if (child.userData.isAegisSentinelRing) {
			child.scale.setScalar(Math.max(0.001, fx.radius * expandT));
			child.material.opacity = Math.max(0.01, pulse * (1.0 - t * 0.9));
		} else if (child.userData.isAegisSentinelDome) {
			const riseT = Math.min(t / 0.45, 1.0);
			const s = Math.max(0.001, riseT);
			child.scale.y = s;
			child.position.y = (fx.domeHeight * s) / 2;
			child.material.opacity = Math.max(0.01, AEGIS_SENTINEL_DOME_OPACITY * (1.0 - t));
		} else if (child.userData.isAegisSentinelFacet) {
			const riseT = Math.min(t / 0.42, 1.0);
			child.scale.y = Math.max(0.001, riseT);
			child.material.opacity = Math.max(0.01, 0.5 * (1.0 - t));
		}
	}
}

function updateAegisSentinelDeploy(fx, elapsed) {
	const t = Math.min(elapsed / fx.duration, 1.0);
	const expandMs = Math.min(SUMMON_EXPAND_MS, fx.duration * 0.55);
	const expandT = Math.min(elapsed / expandMs, 1.0);
	const fade = Math.max(0.01, 1.0 - t);
	for (let c = 0; c < fx.mesh.children.length; c += 1) {
		const child = fx.mesh.children[c];
		if (child.userData.isAegisSentinelRing) {
			const scale = fx.radius * expandT * 2;
			child.scale.setScalar(Math.max(0.001, scale));
			if (elapsed > expandMs) {
				const fadeRatio = 1.0 - (elapsed - expandMs) / (fx.duration - expandMs);
				child.material.opacity = Math.max(0.01, fadeRatio);
			}
			const flicker = 1.0 + 0.28 * Math.sin(elapsed * 0.026);
			child.material.emissiveIntensity = 1.2 * flicker;
		} else if (child.userData.isAegisSentinelWall) {
			const riseT = Math.min(t / 0.35, 1.0);
			const s = Math.max(0.001, riseT);
			child.scale.y = s;
			child.position.y = (fx.wallHeight * s) / 2;
			child.material.opacity = Math.max(0.01, AEGIS_SENTINEL_WALL_OPACITY * fade);
			const baseIntensity = fx._baseEmissiveIntensity ?? AEGIS_SENTINEL_EMISSIVE_INTENSITY;
			child.material.emissiveIntensity = baseIntensity * fade;
		} else if (child.userData.isAegisSentinelWallTrim) {
			const riseT = Math.min(t / 0.35, 1.0);
			const s = Math.max(0.001, riseT);
			child.scale.y = s;
			child.position.y = (fx.wallHeight * s) / 2;
			child.material.opacity = Math.max(0.01, 0.85 * fade);
		}
	}
}

function updateGlacierRuptureShards(fx, elapsed) {
	const t = Math.min(elapsed / fx.duration, 1.0);
	const riseT = Math.min(t / 0.28, 1.0);
	const scatterT = Math.min(t / 0.32, 1.0);
	const fade = Math.max(0.01, 1.0 - t);
	const scatterDist = (fx.radius ?? 1) * 0.55 * scatterT;

	for (let c = 0; c < fx.mesh.children.length; c += 1) {
		const shard = fx.mesh.children[c];
		const dir = shard.userData.scatterDir;
		const riseH = shard.userData.shardHeight ?? GLACIER_RUPTURE_SHARD_HEIGHT;
		const s = Math.max(0.001, riseT);
		shard.scale.y = s;
		shard.position.y = (riseH * s) / 2;
		shard.position.x = shard.userData.baseX + dir.x * scatterDist;
		shard.position.z = shard.userData.baseZ + dir.z * scatterDist;
		shard.rotation.z = dir.x * scatterT * 0.4;
		shard.rotation.x = -dir.z * scatterT * 0.4;
		if (shard.material) shard.material.opacity = fade;
	}
}

function updateSolarEdgeImpact(fx, elapsed) {
	const t = Math.min(elapsed / fx.duration, 1.0);
	const expandMs = Math.min(fx.duration * 0.45, 280);
	const expandT = Math.min(elapsed / expandMs, 1.0);
	const fade = Math.max(0.01, 1.0 - t);
	const coronaScale = (fx.ringRadius ?? SOLAR_EDGE_DEFAULT_RING_RADIUS) * expandT * 2;

	for (let c = 0; c < fx.mesh.children.length; c += 1) {
		const child = fx.mesh.children[c];
		if (child.userData.isSolarEdgeDisc) {
			const popT = Math.min(t / 0.22, 1.0);
			child.scale.setScalar(Math.max(0.001, popT * 1.15));
			child.material.opacity = Math.max(0.01, fade);
			child.material.emissiveIntensity = 1.5 * fade;
		} else if (child.userData.isSolarEdgeCorona) {
			child.scale.setScalar(Math.max(0.001, coronaScale));
			const pulse = 0.82 + 0.18 * Math.abs(Math.sin(elapsed / 70));
			child.material.opacity = Math.max(0.01, fade * (1.0 - expandT * 0.25));
			child.material.emissiveIntensity = 1.35 * pulse * fade;
		} else if (child.userData.isSolarEdgeEmber) {
			const v = child.userData.velocity;
			child.position.set(
				v.x * t,
				GROUND_OVERLAY_Y + 0.12 + v.y * t - t * t * 0.55,
				v.z * t,
			);
			child.material.opacity = Math.max(0.01, fade);
		}
	}
}

function updateManaPrismEffect(fx, elapsed) {
	const t = Math.min(elapsed / fx.duration, 1.0);
	const riseT = Math.min(t / 0.35, 1.0);
	const scatterT = Math.min(t / 0.45, 1.0);
	const fade = t < 0.55 ? 1.0 : Math.max(0.01, 1.0 - (t - 0.55) / 0.45);
	const scatterDist = MANA_PRISM_SHARD_SPREAD * scatterT;
	for (let c = 0; c < fx.mesh.children.length; c += 1) {
		const child = fx.mesh.children[c];
		if (child.userData.isPrismCore) {
			child.scale.setScalar(Math.max(0.001, riseT));
			child.position.y = MANA_PRISM_CORE_BASE_Y + MANA_PRISM_CORE_RISE * riseT;
			child.rotation.y = elapsed * 0.006;
			child.rotation.x = elapsed * 0.003;
		} else {
			const dir = child.userData.scatterDir;
			child.position.x = dir.x * scatterDist;
			child.position.z = dir.z * scatterDist;
			child.position.y = MANA_PRISM_CORE_BASE_Y + MANA_PRISM_CORE_RISE * riseT * 0.7;
			child.rotation.y = child.userData.angle + elapsed * 0.004;
			child.rotation.z = elapsed * 0.005;
		}
		if (child.material) child.material.opacity = fade;
	}
}

function updateDragonsBreathCone(fx, elapsed) {
	const t = Math.min(elapsed / fx.duration, 1.0);
	const expandT = Math.min(t / 0.28, 1.0);
	const s = Math.max(0.001, expandT);
	fx.mesh.scale.set(s, s, s);
	const dir = fx.direction || { x: 1, z: 0 };
	const reach = (fx.range ?? 7) * s;
	fx.mesh.position.set(
		fx.origin.x + dir.x * reach / 2,
		WYRMFLARE_BREATH_LIFT_Y,
		fx.origin.z + dir.z * reach / 2,
	);
	const sustainFade = t < 0.72
		? 1.0
		: Math.max(0.01, 1.0 - (t - 0.72) / 0.28);
	const fade = Math.max(0.01, WYRMFLARE_BREATH_OPACITY * sustainFade);
	fx.mesh.material.opacity = fade;
	const baseIntensity = fx._baseEmissiveIntensity ?? WYRMFLARE_BREATH_EMISSIVE_INTENSITY;
	const flicker = 1.0 + 0.25 * Math.sin(elapsed * 0.02);
	fx.mesh.material.emissiveIntensity = baseIntensity * flicker * sustainFade;
}

function updateEventHorizonEffect(fx, elapsed) {
	const t = Math.min(elapsed / fx.duration, 1.0);
	const fade = Math.max(0.01, 1.0 - t);
	const contractT = Math.min(t / 0.75, 1.0);
	const haloRadius = fx.pullRadius * (1.0 - contractT * 0.92) + fx.centerRadius * contractT * 0.15;
	const corePulse = 0.88 + 0.14 * Math.abs(Math.sin(elapsed / 95));
	const accretionPulse = 0.72 + 0.28 * Math.abs(Math.sin(elapsed / 140));

	for (let c = 0; c < fx.mesh.children.length; c += 1) {
		const child = fx.mesh.children[c];
		if (child.userData.isEventHorizonCore) {
			child.scale.setScalar(corePulse);
			child.material.opacity = Math.max(0.01, 0.95 * fade);
		} else if (child.userData.isEventHorizonAccretion) {
			child.scale.setScalar(accretionPulse);
			child.material.opacity = Math.max(0.01, 0.88 * fade);
			child.material.emissiveIntensity = 1.35 * accretionPulse * fade;
		} else if (child.userData.isEventHorizonHalo) {
			child.scale.setScalar(Math.max(0.001, haloRadius));
			child.material.opacity = Math.max(0.01, 0.72 * fade * (1.0 - contractT * 0.35));
		} else if (child.userData.isEventHorizonParticle) {
			const spiral = child.userData.startAngle + elapsed * 0.0045;
			const radius = child.userData.startRadius * (1.0 - contractT);
			child.position.x = Math.cos(spiral) * radius;
			child.position.z = Math.sin(spiral) * radius;
			child.material.opacity = Math.max(0.01, 0.9 * fade);
		}
	}
}

function updateGravityWellPull(fx, elapsed) {
	const t = Math.min(elapsed / fx.duration, 1.0);
	const fade = Math.max(0.01, 1.0 - t);

	if (fx.isGravityWellRing) {
		const contractT = Math.min(t / 0.4, 1.0);
		const startScale = fx.pullRadius ?? GRAVITY_WELL_PULL_RING_MIN_SCALE;
		const endScale = GRAVITY_WELL_PULL_RING_MIN_SCALE;
		const scale = startScale + (endScale - startScale) * contractT;
		fx.mesh.scale.setScalar(Math.max(0.001, scale));
		const pulse = 0.6 + 0.3 * Math.abs(Math.sin(elapsed / 95));
		fx.mesh.material.opacity = Math.max(0.01, pulse * fade);
	} else if (fx.isGravityWellVoid) {
		const pulseT = Math.min(t / 0.12, 1.0);
		const pulse = 1.0 + (1.0 - pulseT) * 0.9;
		const baseIntensity = fx._baseEmissiveIntensity ?? GRAVITY_WELL_VOID_EMISSIVE_INTENSITY;
		fx.mesh.material.emissiveIntensity = baseIntensity * pulse * fade;
		fx.mesh.material.opacity = Math.max(0.01, 0.92 * fade);
		const coreScale = 0.85 + 0.2 * (1.0 - pulseT);
		fx.mesh.scale.setScalar(coreScale);
	} else if (fx.isGravityWellInflow) {
		for (let c = 0; c < fx.mesh.children.length; c += 1) {
			const particle = fx.mesh.children[c];
			const v = particle.userData.velocity;
			particle.position.set(v.x * t, v.y * t, v.z * t);
			particle.material.opacity = fade;
		}
	}
}

function updateMirrorWardShell(fx, elapsed) {
	const t = Math.min(elapsed / fx.duration, 1.0);
	const expandT = Math.min(t / 0.35, 1.0);
	const pulse = 0.5 + 0.32 * Math.abs(Math.sin(elapsed / 280));
	for (let c = 0; c < fx.mesh.children.length; c += 1) {
		const child = fx.mesh.children[c];
		if (child.userData.isMirrorWardRing) {
			child.scale.setScalar(Math.max(0.001, fx.wardRadius * expandT));
			child.material.opacity = Math.max(0.01, pulse * (1.0 - t * 0.85));
		} else if (child.userData.isMirrorWardFacet) {
			const facetPulse = 0.55 + 0.25 * Math.abs(Math.sin(elapsed / 320));
			child.material.opacity = Math.max(0.01, facetPulse * (1.0 - t));
		}
	}
}

function updateFireTrail(fx, elapsed) {
	const lifeRatio = 1.0 - (elapsed / fx.duration);
	fadeHitboxOpacity(fx.mesh, lifeRatio);
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
	[ATTACK_EFFECT_KINDS.aegisSentinelShield]: updateAegisSentinelShield,
	[ATTACK_EFFECT_KINDS.aegisSentinelDeploy]: updateAegisSentinelDeploy,
	[ATTACK_EFFECT_KINDS.glacierRuptureShards]: updateGlacierRuptureShards,
	[ATTACK_EFFECT_KINDS.solarEdgeImpact]: updateSolarEdgeImpact,
	[ATTACK_EFFECT_KINDS.manaPrismEffect]: updateManaPrismEffect,
	[ATTACK_EFFECT_KINDS.eventHorizonEffect]: updateEventHorizonEffect,
	[ATTACK_EFFECT_KINDS.gravityWellPull]: updateGravityWellPull,
	[ATTACK_EFFECT_KINDS.mirrorWardShell]: updateMirrorWardShell,
	[ATTACK_EFFECT_KINDS.dragonsBreathCone]: updateDragonsBreathCone,
	[ATTACK_EFFECT_KINDS.fireTrail]: updateFireTrail,
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
