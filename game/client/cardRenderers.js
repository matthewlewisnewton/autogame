// ── Card Renderer Dispatch ──
//
// Per-card rendering for the `cardUsed` socket event lives here instead of
// in main.js. Adding a new card means writing one small renderer (or none,
// for the common cases) and registering it in CARD_RENDERERS.
//
// A renderer is a function `(data, ctx) => void`. It receives the cardUsed
// payload and a context bundle with the renderer/audio helpers it can call.
// Renderers should describe the card's *unique* visuals only — enemy-hit
// flashes, hit/shockwave sounds, and the trigger ring for enchantments are
// applied uniformly by `renderCardUsed` and are not the renderer's job.
//
// ctx interface (provided by main.js):
//   spawnAttackEffect(origin, direction, style?)
//   spawnSummonEffect(origin, radius, styleOrColor?)
//   spawnMinionSummonInEffect(origin, style?) — creature minion summon flourish
//   spawnDivineGraceEffect(origin, radius)
//   spawnPurifyingPulseHealRing(origin, radius)
//   spawnCleanseBurstEffect(origin)
//   spawnPurifyingPulseEffect(origin, radius)
//   spawnInfernoPillarEffect(origin, radius)
//   spawnChainLightningEffect(origin, direction)
//   spawnLightningArc(from, to, style?)
//   spawnParticleBurst(position, style?)       — multi-particle spark/ember burst
//   spawnProjectileTrail(origin, direction, style?) — fading streak along a path
//   spawnImpactDecal(origin, style?)           — lingering ground flash/decal ring
//   spawnTelegraphRing(origin, radius, style?) — expanding/pulsing AoE telegraph ring
//   flashMesh(mesh, color, durationMs)
//   enemyMeshes()      → { [enemyId]: Three.js mesh }
//   playSound(name)
//   myId               → local player id (string|null)
//   scheduleAfter(ms, fn) — wrapper around setTimeout used for delayed swings

import { CARD_ACCENT_STYLE, CARD_DEFS } from './cards.js';
import { MINION_SUMMON_IN_MS } from './config.js';

const NULL_CRAWLER_SUMMON_COLOR = 0x22d3ee;
const NULL_CRAWLER_SUMMON_EMISSIVE = 0x67e8f9;
const UNDEAD_COMMANDER_COLOR = 0xe4e4e7;
const UNDEAD_COMMANDER_EMISSIVE = 0xa855f7;

// ── Accent helpers ──────────────────────────────────────────────────────

/**
 * Return the accent color of a card as a hex integer, or undefined if no
 * accent style is defined. Used both as a fallback flash color for hit
 * enemies and as the AoE tint for generic spell renderers.
 */
export function getAccentHex(cardId) {
	const accent = CARD_ACCENT_STYLE[cardId];
	if (!accent || !accent.color) return undefined;
	return parseInt(accent.color.slice(1), 16);
}

function accentSummonStyle(cardId) {
	const hex = getAccentHex(cardId);
	if (hex === undefined) return {};
	return { color: hex, emissive: hex };
}

function originOf(data) {
	return data.origin || { x: 0, z: 0 };
}

function directionOf(data) {
	return data.direction || { x: 1, z: 0 };
}

/** Point `distance` units from `origin` along (normalized) `direction`. */
function pointAlong(origin, direction, distance) {
	const len = Math.hypot(direction.x, direction.z) || 1;
	return {
		x: origin.x + (direction.x / len) * distance,
		z: origin.z + (direction.z / len) * distance,
	};
}

// ── Card-specific renderers ─────────────────────────────────────────────

/**
 * Standard melee weapon: one or more cone-swing flashes pointed in the
 * player's facing direction. Supports `swingCount` and the photon-barrage
 * stagger delay (80ms per swing).
 */
function renderConeSwings(data, ctx) {
	const origin = originOf(data);
	const direction = directionOf(data);
	const swingCount = data.swingCount || 1;
	const delayPerSwing = data.specialEffect === 'photon_barrage' ? 80 : 0;

	for (let i = 0; i < swingCount; i++) {
		const delay = delayPerSwing * i;
		if (delay > 0) {
			ctx.scheduleAfter(delay, () => ctx.spawnAttackEffect(origin, direction));
		} else {
			ctx.spawnAttackEffect(origin, direction);
		}
	}
}

/**
 * Per-weapon slash styling for standard melee blades. Keyed by cardId; each
 * entry gives the shared `renderWeaponSwing` helper a distinct accent and arc
 * shape so weapons read differently without bespoke renderers. Weapons listed
 * here have no `CARD_ACCENT_STYLE` entry, so their `color` is authoritative;
 * any weapon that later gains an accent has it honored via `getAccentHex`.
 * Optional flags (`trail`, `decal`, `sparkCount`) opt the swing into extra
 * composed primitives.
 */
const WEAPON_SLASH_STYLES = {
	// Rust-Forged Saber: a tight, steely arc — a quick clean cut with a few sparks.
	iron_sword: {
		color: 0x94a3b8,
		emissive: 0x64748b,
		coneAngle: Math.PI / 5,
		range: 4,
		fillOpacity: 0.42,
		edgeOpacity: 0.85,
		sparkCount: 6,
		sparkSpread: 0.7,
	},
	// Solar Edge: a warm fiery arc with a trailing flame streak and ember burst.
	flame_blade: {
		color: 0xff7a18,
		emissive: 0xff3b00,
		coneAngle: Math.PI / 4,
		range: 5,
		fillOpacity: 0.4,
		edgeOpacity: 0.8,
		trail: true,
		sparkCount: 10,
		sparkSpread: 1.3,
	},
	// Ether Scythe: a wide ghostly sweeping arc with a lingering spectral decal.
	harvesting_scythe: {
		color: 0x86efac,
		emissive: 0x8b5cf6,
		coneAngle: (Math.PI * 2) / 3,
		range: 6,
		fillOpacity: 0.3,
		edgeOpacity: 0.65,
		decal: true,
		sparkCount: 8,
		sparkSpread: 1.6,
	},
	// Saber of Light: a broad, radiant pale-gold arc haloed in bright sparks.
	saber_of_light: {
		color: 0xfef08a,
		emissive: 0xfde047,
		coneAngle: Math.PI / 3,
		range: 5.5,
		fillOpacity: 0.46,
		edgeOpacity: 0.95,
		sparkCount: 12,
		sparkSpread: 1.8,
	},
	// Photon Slicer: a near-full cyan spin slice trailing light around the arc.
	photon_slicer: {
		color: 0x22d3ee,
		emissive: 0x06b6d4,
		coneAngle: Math.PI,
		range: 4.5,
		fillOpacity: 0.34,
		edgeOpacity: 0.8,
		trail: true,
		sparkCount: 9,
		sparkSpread: 1.4,
	},
	// Arcane Bolt: a tight violet energy lance stabbing far forward with a beam streak.
	arcane_bolt: {
		color: 0xa78bfa,
		emissive: 0x7c3aed,
		coneAngle: Math.PI / 9,
		range: 7.5,
		fillOpacity: 0.5,
		edgeOpacity: 0.92,
		trail: true,
		sparkCount: 7,
		sparkSpread: 0.8,
	},
};

/**
 * Shared melee-blade slash. Looks up the firing card's style in
 * `WEAPON_SLASH_STYLES` and composes the 315 VFX primitives — the cone swing
 * plus optional flame trail, spark burst, and impact decal — into one
 * accent-themed arc. Adds nothing to renderer.js; it only reuses existing ctx
 * helpers, each guarded so the swing degrades gracefully when a primitive is
 * absent. Falls back to the plain cone swing for any unstyled weapon.
 */
function renderWeaponSwing(data, ctx) {
	const style = WEAPON_SLASH_STYLES[data.cardId];
	if (!style) {
		renderConeSwings(data, ctx);
		return;
	}
	const origin = originOf(data);
	const direction = directionOf(data);
	const color = getAccentHex(data.cardId) ?? style.color;
	const emissive = style.emissive;

	ctx.spawnAttackEffect(origin, direction, {
		color,
		emissive,
		coneAngle: style.coneAngle,
		range: style.range,
		fillOpacity: style.fillOpacity,
		edgeOpacity: style.edgeOpacity,
	});

	// Optional flame streak chasing the blade's leading edge.
	if (style.trail && ctx.spawnProjectileTrail) {
		ctx.spawnProjectileTrail(origin, direction, {
			range: style.range,
			color,
			emissive,
		});
	}

	// Spark/ember burst out along the blade's mid-arc reach.
	if (style.sparkCount && ctx.spawnParticleBurst) {
		const sparkAt = pointAlong(origin, direction, style.range * 0.6);
		ctx.spawnParticleBurst(sparkAt, {
			color,
			emissive,
			count: style.sparkCount,
			spread: style.sparkSpread,
		});
	}

	// Lingering ground decal traced by a wide sweep.
	if (style.decal && ctx.spawnImpactDecal) {
		const decalAt = pointAlong(origin, direction, style.range * 0.6);
		ctx.spawnImpactDecal(decalAt, { color, emissive });
	}
}

/**
 * Per-weapon styling for the heavy wind-up greatswords (`steel_claymore`,
 * `magma_greatsword`, `excalibur_photon`). These carry a `windUpMs` lockout, so
 * the 315 charge telegraph already plays during the wind-up; the entries here
 * make the *resulting* hit feel proportionally heavy: a wider/larger cone arc
 * plus a pronounced impact — a larger-radius decal and a high-`count` debris/
 * spark burst — so the blow reads as a big committed swing. Each differs from
 * the others (color + shape/impact params) and hits harder than the lighter
 * blades in sub-tickets 01/02 (bigger decal radius, higher particle count).
 */
const HEAVY_GREATSWORD_STYLES = {
	// Alloy Greatblade: a heavy slate cleave that shatters the ground on impact.
	steel_claymore: {
		color: 0x94a3b8,
		emissive: 0x64748b,
		coneAngle: Math.PI / 2.2,
		range: 7,
		fillOpacity: 0.5,
		edgeOpacity: 0.92,
		decalRadius: 3.2,
		debrisCount: 18,
		debrisSpread: 2.4,
	},
	// Corebreaker Greatsword: a wide magma swing that erupts molten debris.
	magma_greatsword: {
		color: 0xf97316,
		emissive: 0xff3b00,
		coneAngle: Math.PI / 1.8,
		range: 7,
		fillOpacity: 0.46,
		edgeOpacity: 0.88,
		decalRadius: 3.8,
		debrisCount: 24,
		debrisSpread: 2.8,
	},
	// Excalibur Photon: a magenta photon greatslash bursting with light shards.
	excalibur_photon: {
		color: 0xe879f9,
		emissive: 0xc026d3,
		coneAngle: Math.PI / 2.5,
		range: 6,
		fillOpacity: 0.48,
		edgeOpacity: 0.95,
		decalRadius: 3.0,
		debrisCount: 20,
		debrisSpread: 2.2,
	},
};

/**
 * Heavy wind-up greatsword swing. Composes the 315 primitives — a wide cone
 * swing plus a larger-radius `spawnImpactDecal` and a high-`count`
 * `spawnParticleBurst` at the impact point — into one weighty, committed blow.
 * Honors `swingCount` and the `photon_barrage` stagger like `renderConeSwings`
 * so the multi-swing greatswords still read correctly, then lays the heavy
 * impact down once at the strike point. Each ctx call is guarded so the swing
 * degrades gracefully when a primitive is absent.
 */
function renderHeavyGreatsword(data, ctx) {
	const style = HEAVY_GREATSWORD_STYLES[data.cardId];
	if (!style) {
		renderConeSwings(data, ctx);
		return;
	}
	const origin = originOf(data);
	const direction = directionOf(data);
	const color = getAccentHex(data.cardId) ?? style.color;
	const emissive = style.emissive;
	const swingCount = data.swingCount || 1;
	const delayPerSwing = data.specialEffect === 'photon_barrage' ? 80 : 0;

	const swing = () => ctx.spawnAttackEffect(origin, direction, {
		color,
		emissive,
		coneAngle: style.coneAngle,
		range: style.range,
		fillOpacity: style.fillOpacity,
		edgeOpacity: style.edgeOpacity,
	});
	for (let i = 0; i < swingCount; i++) {
		const delay = delayPerSwing * i;
		if (delay > 0) ctx.scheduleAfter(delay, swing);
		else swing();
	}

	// Pronounced impact at the blade's strike point — a wide ground decal plus a
	// heavy debris/spark shower, both far larger than the lighter blades.
	const impactAt = pointAlong(origin, direction, style.range);
	if (ctx.spawnImpactDecal) {
		ctx.spawnImpactDecal(impactAt, { color, emissive, radius: style.decalRadius });
	}
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(impactAt, {
			color,
			emissive,
			count: style.debrisCount,
			spread: style.debrisSpread,
		});
	}
}

/**
 * Resonance Edge: a magenta slash that "rings" twice. The cut lands, then a
 * resonant double pulse — two expanding telegraph rings (the second delayed via
 * scheduleAfter) with a magenta spark burst — radiates out from the arc. Reuses
 * the same 315 primitives as the styled blades, each guarded so the swing
 * degrades gracefully when a primitive is absent.
 */
function renderResonantDoublePulse(data, ctx) {
	const origin = originOf(data);
	const direction = directionOf(data);
	const color = getAccentHex(data.cardId) ?? 0xe879f9;
	const emissive = 0xc026d3;
	const range = 5;

	ctx.spawnAttackEffect(origin, direction, {
		color,
		emissive,
		coneAngle: Math.PI / 3.5,
		range,
		fillOpacity: 0.4,
		edgeOpacity: 0.88,
	});

	const pulseAt = pointAlong(origin, direction, range * 0.55);
	const pulse = (radius) => {
		if (ctx.spawnTelegraphRing) ctx.spawnTelegraphRing(pulseAt, radius, { color, emissive });
		if (ctx.spawnParticleBurst) {
			ctx.spawnParticleBurst(pulseAt, { color, emissive, count: 8, spread: 1.2 });
		}
	};
	pulse(1.6);
	ctx.scheduleAfter(130, () => pulse(2.6));
}

/**
 * Phase Echo: a pink twin-slash. The blade swings once, then a fainter echo
 * swing replays a beat later via scheduleAfter so it reads as a phasing
 * after-image. A pink light streak trails both passes.
 */
function renderEchoSlash(data, ctx) {
	const origin = originOf(data);
	const direction = directionOf(data);
	const color = getAccentHex(data.cardId) ?? 0xf472b6;
	const emissive = 0xdb2777;
	const coneAngle = Math.PI / 4;
	const range = 5;

	const swing = (fillOpacity, edgeOpacity) => {
		ctx.spawnAttackEffect(origin, direction, {
			color,
			emissive,
			coneAngle,
			range,
			fillOpacity,
			edgeOpacity,
		});
		if (ctx.spawnProjectileTrail) {
			ctx.spawnProjectileTrail(origin, direction, { range, color, emissive });
		}
	};

	swing(0.42, 0.9);
	// The echo: a fainter after-image swing a beat later.
	ctx.scheduleAfter(150, () => swing(0.22, 0.55));
}

/**
 * Infinite Disk and any card flagged with `triple_returning_projectile`:
 * spawn three projectile flashes offset along the perpendicular axis so the
 * player can see the three disks fan out, plus a cyan trail/spark polish pass
 * along the disk path so the fan reads richer than three flat flashes.
 */
function renderTripleReturning(data, ctx) {
	const origin = originOf(data);
	const direction = directionOf(data);
	const perpX = -direction.z;
	const perpZ = direction.x;
	const color = getAccentHex(data.cardId) ?? 0xa5f3fc;
	const emissive = 0x22d3ee;
	const style = { color, emissive };
	for (const offset of [-0.6, 0, 0.6]) {
		ctx.spawnAttackEffect(
			{ x: origin.x + perpX * offset, z: origin.z + perpZ * offset },
			direction,
			style,
		);
	}
	// Spinning-light polish: a cyan streak chasing the lead disk plus a spark
	// shower out along its path.
	if (ctx.spawnProjectileTrail) {
		ctx.spawnProjectileTrail(origin, direction, { range: 6, color, emissive });
	}
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(pointAlong(origin, direction, 3.5), {
			color,
			emissive,
			count: 10,
			spread: 1.6,
		});
	}
}

/**
 * Generic radial AoE preview, tinted with the card's accent color. This is
 * the default renderer for `type: 'spell'` cards that report a `radius`.
 */
function renderGenericSpellBurst(data, ctx) {
	if (data.radius === undefined) return;
	ctx.spawnSummonEffect(originOf(data), data.radius, accentSummonStyle(data.cardId));
}

const ICE_ACCENT_COLOR = 0x67e8f9;
const ICE_ACCENT_EMISSIVE = 0x38bdf8;
const GLACIER_COLOR = 0x38bdf8;
const GLACIER_EMISSIVE = 0x0ea5e9;

/**
 * Cryo Burst: expanding icy telegraph plus a radial frost particle burst at
 * the cast origin. Replaces the generic accent summon ring.
 */
function renderFrostNova(data, ctx) {
	if (data.radius === undefined) return;
	const origin = originOf(data);
	const color = getAccentHex(data.cardId) ?? ICE_ACCENT_COLOR;
	const emissive = ICE_ACCENT_EMISSIVE;
	if (ctx.spawnTelegraphRing) {
		ctx.spawnTelegraphRing(origin, data.radius, { color, emissive });
	}
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(origin, { color, emissive, count: 14, spread: 2.0 });
	}
}

/**
 * Permafrost Lance: narrower telegraph, a directional frost shard trail, and a
 * secondary burst at the lance tip so it reads distinctly from Cryo Burst.
 */
function renderPermafrostLance(data, ctx) {
	if (data.radius === undefined) return;
	const origin = originOf(data);
	const direction = directionOf(data);
	const color = getAccentHex(data.cardId) ?? ICE_ACCENT_COLOR;
	const emissive = ICE_ACCENT_EMISSIVE;
	const narrowRadius = data.radius * 0.55;
	if (ctx.spawnTelegraphRing) {
		ctx.spawnTelegraphRing(origin, narrowRadius, { color, emissive });
	}
	if (ctx.spawnProjectileTrail) {
		ctx.spawnProjectileTrail(origin, direction, {
			range: data.radius,
			color,
			emissive,
		});
	}
	const tip = pointAlong(origin, direction, data.radius);
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(tip, { color, emissive, count: 10, spread: 1.2 });
	}
}

/**
 * Glacier Collapse uses a fixed icy palette rather than the accent color
 * so the freeze visual reads the same regardless of upgrade styling.
 */
function renderGlacierCollapse(data, ctx) {
	if (data.radius === undefined) return;
	const origin = originOf(data);
	ctx.spawnSummonEffect(origin, data.radius, { color: GLACIER_COLOR, emissive: GLACIER_EMISSIVE });
	if (ctx.spawnTelegraphRing) {
		ctx.spawnTelegraphRing(origin, data.radius, { color: GLACIER_COLOR, emissive: GLACIER_EMISSIVE });
	}
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(origin, { color: GLACIER_COLOR, emissive: GLACIER_EMISSIVE, count: 12, spread: 2.4 });
	}
}

const HEALING_FONT_COLOR = 0x86efac;
const HEALING_FONT_EMISSIVE = 0x4ade80;
const DIVINE_GRACE_COLOR = 0xfde68a;
const DIVINE_GRACE_EMISSIVE = 0xfbbf24;

/**
 * Restoration Beacon: green telegraph ring plus radial heal spark burst at
 * the cast origin. Distinct from Sanctum Pulse's golden sanctum signature.
 */
function renderHealingFont(data, ctx) {
	if (data.radius === undefined) return;
	const origin = originOf(data);
	const color = getAccentHex(data.cardId) ?? HEALING_FONT_COLOR;
	const emissive = HEALING_FONT_EMISSIVE;
	if (ctx.spawnTelegraphRing) {
		ctx.spawnTelegraphRing(origin, data.radius, { color, emissive });
	}
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(origin, { color, emissive, count: 14, spread: 2.0 });
	}
	if (data.hpGained > 0 && data.playerId === ctx.myId) ctx.playSound('heal');
}

/**
 * Sanctum Pulse: golden sanctum heal ring plus a secondary gold ember burst
 * so its primitive mix differs from Restoration Beacon.
 */
function renderDivineGrace(data, ctx) {
	if (data.radius === undefined) return;
	const origin = originOf(data);
	const color = getAccentHex(data.cardId) ?? DIVINE_GRACE_COLOR;
	const emissive = DIVINE_GRACE_EMISSIVE;
	ctx.spawnDivineGraceEffect(origin, data.radius);
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(origin, { color, emissive, count: 12, spread: 2.2 });
	}
	if (data.hpGained > 0 && data.playerId === ctx.myId) ctx.playSound('heal');
}

/**
 * Purifying Pulse: mint AoE heal ring plus a white/teal cleanse sparkle burst.
 */
function renderPurifyingPulse(data, ctx) {
	if (data.radius === undefined) return;
	const origin = originOf(data);
	ctx.spawnPurifyingPulseHealRing(origin, data.radius);
	ctx.spawnCleanseBurstEffect(origin);
	ctx.playSound('heal');
}

const GRAVITY_WELL_COLOR = 0xc084fc;
const GRAVITY_WELL_EMISSIVE = 0xa855f7;
const EVENT_HORIZON_COLOR = 0x581c87;
const EVENT_HORIZON_EMISSIVE = 0x7c3aed;

/**
 * Gravity Well: purple pull telegraph at pull radius, inward-styled particle
 * burst at the origin, and an optional center impact decal.
 */
function renderGravityWell(data, ctx) {
	if (data.radius === undefined) return;
	const origin = originOf(data);
	const color = getAccentHex(data.cardId) ?? GRAVITY_WELL_COLOR;
	const emissive = GRAVITY_WELL_EMISSIVE;
	if (ctx.spawnTelegraphRing) {
		ctx.spawnTelegraphRing(origin, data.radius, { color, emissive });
	}
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(origin, { color, emissive, count: 18, spread: 2.8 });
	}
	if (ctx.spawnImpactDecal) {
		ctx.spawnImpactDecal(origin, { color, emissive });
	}
}

/**
 * Event Horizon: dark-purple outer pull telegraph + burst, plus a tighter inner
 * crush ring keyed off `data.centerRadius` (distinct helper mix from Gravity Well).
 */
function renderEventHorizon(data, ctx) {
	if (data.radius === undefined) return;
	const origin = originOf(data);
	const color = getAccentHex(data.cardId) ?? EVENT_HORIZON_COLOR;
	const emissive = EVENT_HORIZON_EMISSIVE;
	if (ctx.spawnTelegraphRing) {
		ctx.spawnTelegraphRing(origin, data.radius, { color, emissive });
	}
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(origin, { color, emissive, count: 12, spread: 2.4 });
	}
	if (data.centerRadius) {
		ctx.spawnSummonEffect(origin, data.centerRadius, { color, emissive });
	}
}

const FIRE_ACCENT_COLOR = 0xfb923c;
const FIRE_ACCENT_EMISSIVE = 0xff3b00;

/**
 * Wyrmflare: forward fire breath cone with ember trail and impact flourish at
 * the cone tip. Replaces the generic accent summon ring.
 */
function renderDragonsBreath(data, ctx) {
	if (data.radius === undefined) return;
	const origin = originOf(data);
	const direction = directionOf(data);
	const color = getAccentHex(data.cardId) ?? FIRE_ACCENT_COLOR;
	const emissive = FIRE_ACCENT_EMISSIVE;
	ctx.spawnAttackEffect(origin, direction, {
		range: data.radius,
		coneAngle: data.attackConeAngle ?? Math.PI / 3,
		color,
		emissive,
		fillOpacity: 0.38,
		edgeOpacity: 0.72,
	});
	if (ctx.spawnProjectileTrail) {
		ctx.spawnProjectileTrail(origin, direction, {
			range: data.radius,
			color,
			emissive,
		});
	}
	const tip = pointAlong(origin, direction, data.radius);
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(tip, { color, emissive, count: 10, spread: 1.2 });
	}
	if (ctx.spawnImpactDecal) {
		ctx.spawnImpactDecal(tip, { color, emissive });
	}
}

/**
 * Inferno Pillar: tall fiery pillar effect plus accent telegraph ring and
 * ember burst at the eruption point.
 */
function renderInfernoPillar(data, ctx) {
	if (data.radius === undefined) return;
	const origin = originOf(data);
	ctx.spawnInfernoPillarEffect(origin, data.radius);
	// Accent-themed AoE telegraph ring + ember burst at the eruption point.
	const color = getAccentHex(data.cardId) ?? 0xff7a18;
	const emissive = 0xff3b00;
	if (ctx.spawnTelegraphRing) {
		ctx.spawnTelegraphRing(origin, data.radius, { color, emissive });
	}
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(origin, { color, emissive, count: 14, spread: 2.2 });
	}
}

/**
 * Default creature deploy: accent summon-in flourish when the server reports a
 * new minion id (initial summon, not minion attacks).
 */
function renderCreatureSummon(data, ctx) {
	if (!data.minionId || !ctx.spawnMinionSummonInEffect) return;
	ctx.spawnMinionSummonInEffect(originOf(data), accentSummonStyle(data.cardId));
}

/**
 * Undead Commander: bone-white/purple caster ring plus a smaller summon-in
 * flourish and rising ground burst for each spawned skeleton minion.
 */
function renderUndeadCommander(data, ctx) {
	const commanderStyle = { color: UNDEAD_COMMANDER_COLOR, emissive: UNDEAD_COMMANDER_EMISSIVE };
	ctx.spawnSummonEffect(originOf(data), 2, commanderStyle);
	const skeletonStyle = {
		color: UNDEAD_COMMANDER_COLOR,
		emissive: UNDEAD_COMMANDER_EMISSIVE,
		radius: 0.85,
		burstCount: 8,
		burstSpread: 1.4,
	};
	for (const spawn of (data.summonedMinions || [])) {
		const origin = { x: spawn.x, z: spawn.z };
		if (ctx.spawnMinionSummonInEffect) {
			ctx.spawnMinionSummonInEffect(origin, skeletonStyle);
		} else {
			ctx.spawnSummonEffect(origin, 1.0, commanderStyle);
		}
		if (ctx.spawnParticleBurst) {
			ctx.spawnParticleBurst(
				{ x: origin.x, y: 0.35, z: origin.z },
				{
					color: UNDEAD_COMMANDER_COLOR,
					emissive: UNDEAD_COMMANDER_EMISSIVE,
					count: 10,
					spread: 1.2,
				},
			);
		}
	}
}

const CHAIN_LIGHTNING_ARC_STYLE = { color: 0x38bdf8, emissive: 0x0ea5e9 };
const STORM_EAGLE_ARC_STYLE = { color: 0x67e8f9, emissive: 0x22d3ee };
const ARCANE_FAMILIAR_COLOR = 0x818cf8;
const ARCANE_FAMILIAR_EMISSIVE = 0x6366f1;
const MANA_LEACH_COLOR = 0xa855f7;
const MANA_LEACH_EMISSIVE = 0x9333ea;
const SOUL_DRAIN_COLOR = 0xe879f9;
const SOUL_DRAIN_EMISSIVE = 0xd946ef;

function spawnChainSegmentArcs(data, ctx) {
	const segments = data.chainSegments;
	if (!segments || segments.length === 0) return false;
	for (const seg of segments) {
		ctx.spawnLightningArc(seg.from, seg.to, CHAIN_LIGHTNING_ARC_STYLE);
	}
	return true;
}

/**
 * Voltaic Chain spell: one cyan arc per server chain segment with cast
 * telegraph and endpoint impacts, or a legacy directional bolt when segments
 * are absent.
 */
function renderChainLightningArcs(data, ctx) {
	if (spawnChainSegmentArcs(data, ctx)) {
		const origin = originOf(data);
		if (ctx.spawnTelegraphRing) {
			ctx.spawnTelegraphRing(origin, data.chainRadius ?? 2, CHAIN_LIGHTNING_ARC_STYLE);
		}
		for (const seg of data.chainSegments) {
			if (ctx.spawnParticleBurst) {
				ctx.spawnParticleBurst(seg.to, {
					...CHAIN_LIGHTNING_ARC_STYLE,
					count: 8,
					spread: 1.0,
				});
			} else if (ctx.spawnImpactDecal) {
				ctx.spawnImpactDecal(seg.to, CHAIN_LIGHTNING_ARC_STYLE);
			}
		}
		return;
	}
	if (!data.origin) return;
	ctx.spawnChainLightningEffect(data.origin, directionOf(data));
}

/**
 * Signal Familiar: indigo arcane telegraph and spark burst at the cast origin.
 */
function renderBattleFamiliar(data, ctx) {
	if (data.radius === undefined) return;
	const origin = originOf(data);
	const color = getAccentHex(data.cardId) ?? ARCANE_FAMILIAR_COLOR;
	const emissive = ARCANE_FAMILIAR_EMISSIVE;
	if (ctx.spawnTelegraphRing) {
		ctx.spawnTelegraphRing(origin, data.radius, { color, emissive });
	}
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(origin, { color, emissive, count: 14, spread: 2.0 });
	}
}

/**
 * Ether Siphon: purple drain telegraph at AoE radius plus a siphon burst.
 */
function renderManaLeach(data, ctx) {
	if (data.radius === undefined) return;
	const origin = originOf(data);
	const color = getAccentHex(data.cardId) ?? MANA_LEACH_COLOR;
	const emissive = MANA_LEACH_EMISSIVE;
	if (ctx.spawnTelegraphRing) {
		ctx.spawnTelegraphRing(origin, data.radius, { color, emissive });
	}
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(origin, { color, emissive, count: 16, spread: 2.2 });
	}
}

/**
 * Soul Drain: pink evolved drain telegraph, primary burst, and a smaller
 * heal-adjacent flourish at the origin. No extra sounds — heal audio stays in
 * common post-effects when applicable.
 */
function renderSoulDrain(data, ctx) {
	if (data.radius === undefined) return;
	const origin = originOf(data);
	const color = getAccentHex(data.cardId) ?? SOUL_DRAIN_COLOR;
	const emissive = SOUL_DRAIN_EMISSIVE;
	if (ctx.spawnTelegraphRing) {
		ctx.spawnTelegraphRing(origin, data.radius, { color, emissive });
	}
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(origin, { color, emissive, count: 14, spread: 2.4 });
	}
	if (ctx.spawnImpactDecal) {
		ctx.spawnImpactDecal(origin, { color: SOUL_DRAIN_EMISSIVE, emissive: 0xf0abfc });
	} else if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(origin, {
			color: SOUL_DRAIN_EMISSIVE,
			emissive: 0xf0abfc,
			count: 6,
			spread: 1.0,
		});
	}
}

/**
 * Thunderbird (chain_lightning): zap effect on origin, an enemy-hit cue, and
 * a follow-up attack flash. Triggered by specialEffect rather than cardId so
 * future cards reusing the chain_lightning effect inherit the visual.
 */
function renderChainLightning(data, ctx) {
	if (!data.origin || !data.hits?.length) return;
	if (!spawnChainSegmentArcs(data, ctx)) {
		ctx.spawnChainLightningEffect(data.origin, directionOf(data));
	}
	ctx.playSound('enemyHit');
	ctx.spawnAttackEffect(data.origin, directionOf(data));
}

/**
 * Stormwing Drone deploy: soft cyan summon flourish (lighter than Thunderbird).
 */
function renderStormEagleSummon(data, ctx) {
	if (!data.minionId || data.hits?.length) return;
	if (!ctx.spawnMinionSummonInEffect) return;
	ctx.spawnMinionSummonInEffect(originOf(data), {
		color: 0x93c5fd,
		emissive: 0x7dd3fc,
		burstCount: 10,
		burstSpread: 1.2,
	});
}

/**
 * Stormwing Drone ranged strike: single cyan arc to the primary target plus
 * an impact spark burst at the enemy.
 */
function renderStormEagleStrike(data, ctx) {
	if (!data.origin || !data.hits?.length) return;
	const target = data.strikeTarget
		|| pointAlong(originOf(data), directionOf(data), data.attackRange || 7);
	ctx.spawnLightningArc(originOf(data), target, STORM_EAGLE_ARC_STYLE);
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(target, {
			color: 0x67e8f9,
			emissive: 0x22d3ee,
			count: 8,
			spread: 0.85,
		});
	}
}

/**
 * Thunderbird deploy: vivid sky-blue summon ring distinct from Stormwing Drone.
 */
function renderThunderbirdSummon(data, ctx) {
	if (!data.minionId || data.hits?.length) return;
	if (!ctx.spawnMinionSummonInEffect) return;
	ctx.spawnMinionSummonInEffect(originOf(data), {
		color: 0x38bdf8,
		emissive: 0x0ea5e9,
		radius: 1.2,
		burstCount: 14,
		burstSpread: 1.8,
	});
}

const WYRM_SUMMON_STYLES = {
	dungeon_drake: { radius: 1.0, burstCount: 8, burstSpread: 1.2 },
	ancient_wyrm: { radius: 1.85, burstCount: 18, burstSpread: 2.5 },
};

/**
 * Vault Wyrm / Archive Wyrm deploy: per-card summon-in palettes on top of the
 * shared minion flourish (tight burst vs wide ring + embers).
 */
function renderWyrmSummon(data, ctx) {
	if (!data.minionId || data.breathPhase || !ctx.spawnMinionSummonInEffect) return;
	const preset = WYRM_SUMMON_STYLES[data.cardId] ?? {};
	ctx.spawnMinionSummonInEffect(originOf(data), {
		...accentSummonStyle(data.cardId),
		...preset,
	});
}

/**
 * Vault Wyrm / Archive Wyrm minion attacks: ground cone matching server
 * collectConeHits geometry (melee swipe or fire breath).
 */
function renderWyrmAttack(data, ctx) {
	if (!data.origin) return;
	if (data.minionId && !data.breathPhase) return;

	const isFireBreath = data.specialEffect === 'fire_breath';
	const accentHex = getAccentHex(data.cardId);
	const color = isFireBreath ? 0xef4444 : (accentHex ?? 0x22c55e);
	const emissive = isFireBreath ? (accentHex ?? 0x9333ea) : 0x16a34a;

	if (data.breathPhase !== 'tick') {
		const origin = originOf(data);
		const direction = directionOf(data);
		ctx.spawnAttackEffect(origin, direction, {
			range: data.attackRange,
			coneAngle: data.attackConeAngle,
			color,
			emissive,
			duration: data.breathDurationMs,
			fillOpacity: isFireBreath ? 0.38 : 0.48,
			edgeOpacity: isFireBreath ? 0.72 : 0.85,
		});
		const breathRange = data.attackRange ?? 6;
		if (ctx.spawnTelegraphRing) {
			ctx.spawnTelegraphRing(origin, breathRange * 0.55, { color, emissive });
		}
		if (ctx.spawnParticleBurst) {
			const along = pointAlong(origin, direction, breathRange * 0.45);
			ctx.spawnParticleBurst(
				{ x: along.x, y: 0.8, z: along.z },
				{
					color,
					emissive,
					count: isFireBreath ? 14 : 10,
					spread: isFireBreath ? 2.0 : 1.5,
				},
			);
		}
	}

	if (!data.hits?.length) return;

	const meshes = ctx.enemyMeshes ? ctx.enemyMeshes() : {};
	for (const hit of data.hits) {
		const mesh = meshes[hit.enemyId];
		if (!mesh) continue;
		const pos = { x: mesh.position.x, y: mesh.position.y + 0.6, z: mesh.position.z };
		if (ctx.spawnHitSpark) {
			ctx.spawnHitSpark(pos, { color, emissive, count: 5, spread: 0.55 });
		}
		if (ctx.spawnParticleBurst) {
			ctx.spawnParticleBurst(pos, { color, emissive, count: 6, spread: 0.7 });
		}
	}
}

/**
 * Fireball: a fiery sphere projectile that travels from the caster along the
 * cast direction. Distinct from the plain `projectile` visual via the warm
 * fire palette in the renderer's `fireball` branch. On impact, an enhanced
 * ember shower and scorch decal mark the burn application — distinct from a
 * plain damage hit. Ongoing burn visuals (flames around the enemy) are driven
 * separately by the broadcast `burningUntil` state, not here.
 */
function renderFireball(data, ctx) {
	if (!data.origin) return;
	const origin = originOf(data);
	const direction = directionOf(data);
	const color = getAccentHex(data.cardId) ?? 0xff7a18;
	const emissive = 0xff3b00;
	ctx.spawnAttackEffect(origin, direction, {
		effect: 'fireball',
		range: data.attackRange,
		color,
		emissive,
	});
	// Fiery streak chasing the projectile, plus a scorch flourish where it lands.
	if (ctx.spawnProjectileTrail) {
		ctx.spawnProjectileTrail(origin, direction, {
			range: data.attackRange,
			color,
			emissive,
		});
	}
	const impact = pointAlong(origin, direction, data.attackRange ?? 8);
	if (ctx.spawnImpactDecal) {
		ctx.spawnImpactDecal(impact, { color, emissive });
	}
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(impact, { color, emissive, count: 16, spread: 2.0 });
	}
}

/**
 * Ice Ball: a slow-moving icy sphere projectile. On impact, a freeze-crystal
 * particle burst and frost decal mark the slow application at the hit point —
 * distinct from a plain damage hit. Ongoing slow visuals (ring around the
 * enemy) are driven separately by the broadcast `slowedUntil` state.
 */
function renderIceBall(data, ctx) {
	if (!data.origin) return;
	const origin = originOf(data);
	const direction = directionOf(data);
	const color = getAccentHex(data.cardId) ?? ICE_ACCENT_COLOR;
	const emissive = ICE_ACCENT_EMISSIVE;
	ctx.spawnAttackEffect(origin, direction, {
		effect: 'ice_ball',
		range: data.attackRange,
		projectileTravelMs: data.projectileTravelMs,
		color,
		emissive,
	});
	if (ctx.spawnProjectileTrail) {
		ctx.spawnProjectileTrail(origin, direction, {
			range: data.attackRange,
			color,
			emissive,
		});
	}
	// Freeze-crystal burst + frost scorch where the projectile lands.
	const impact = pointAlong(origin, direction, data.attackRange ?? 8);
	if (ctx.spawnImpactDecal) {
		ctx.spawnImpactDecal(impact, { color, emissive });
	}
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(impact, { color, emissive, count: 14, spread: 1.8 });
	}
}

/**
 * Phase Stalker deploy: tight cyan telegraph ring and ground swirl distinct
 * from the generic creature summon flourish.
 */
function renderNullCrawlerSummon(data, ctx) {
	if (!data.minionId || data.specialEffect === 'phase_beam') return;
	const origin = originOf(data);
	ctx.spawnSummonEffect(origin, 0.95, {
		color: NULL_CRAWLER_SUMMON_COLOR,
		emissive: NULL_CRAWLER_SUMMON_EMISSIVE,
	});
	if (ctx.spawnTelegraphRing) {
		ctx.spawnTelegraphRing(origin, 0.72, {
			color: NULL_CRAWLER_SUMMON_EMISSIVE,
			emissive: 0xa5f3fc,
			duration: MINION_SUMMON_IN_MS,
		});
	}
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(
			{ x: origin.x, y: 0.4, z: origin.z },
			{
				color: NULL_CRAWLER_SUMMON_COLOR,
				emissive: NULL_CRAWLER_SUMMON_EMISSIVE,
				count: 16,
				spread: 2.4,
				duration: MINION_SUMMON_IN_MS,
			},
		);
	}
}

/**
 * Phase Stalker: narrow cyan beam corridor along the projectile path.
 */
function renderPhaseBeam(data, ctx) {
	if (!data.origin) return;
	const origin = originOf(data);
	const direction = directionOf(data);
	const accentHex = getAccentHex(data.cardId);
	const color = accentHex ?? 0x22d3ee;
	const emissive = 0x06b6d4;
	const range = data.attackRange;
	ctx.spawnAttackEffect(origin, direction, {
		effect: 'returning_projectile',
		returnPasses: 0,
		range,
		projectileHitWidth: data.hitWidth ?? 0.8,
		color,
		emissive,
	});
	if (ctx.spawnProjectileTrail) {
		ctx.spawnProjectileTrail(origin, direction, { range, color, emissive });
	}
	const terminus = pointAlong(origin, direction, range ?? 14);
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(terminus, { color, emissive, count: 10, spread: 1.2 });
	}
	if (!data.hits?.length) return;
	const meshes = ctx.enemyMeshes ? ctx.enemyMeshes() : {};
	for (const hit of data.hits) {
		const mesh = meshes[hit.enemyId];
		if (!mesh) continue;
		const pos = { x: mesh.position.x, y: mesh.position.y + 0.6, z: mesh.position.z };
		if (ctx.spawnHitSpark) {
			ctx.spawnHitSpark(pos, { color, emissive, count: 5, spread: 0.55 });
		}
	}
}

/**
 * Bulkhead Mauler: short wide shockwave cone in front of the construct.
 */
function renderShockwaveSweep(data, ctx) {
	if (!data.origin) return;
	const color = getAccentHex(data.cardId) ?? 0x78716c;
	const emissive = 0xf59e0b;
	ctx.spawnAttackEffect(originOf(data), directionOf(data), {
		range: data.attackRange,
		coneAngle: data.attackConeAngle,
		color,
		emissive,
	});
	// Debris spray kicked up at the construct's feet on impact.
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(originOf(data), { color, emissive, count: 10, spread: 1.6 });
	}
}

/**
 * Spike Trap (and any ground-targeted enchantment): show the trap radius
 * with a hostile-red AoE preview at the placement point.
 */
function renderGroundEnchantment(data, ctx) {
	if (data.radius === undefined) return;
	ctx.spawnSummonEffect(originOf(data), data.radius, { color: 0xf87171, emissive: 0xef4444 });
}

/**
 * Mirror Ward (and any self-targeted enchantment): teal ring around the
 * caster. Range is fixed since self-enchantments don't report a radius.
 */
function renderSelfEnchantment(data, ctx) {
	if (data.target !== 'self') return;
	ctx.spawnSummonEffect(originOf(data), 2, { color: 0x5eead4, emissive: 0x2dd4bf });
}

/**
 * Telepipe portal placement: blue field ring marking the shared evac point.
 */
function renderTelepipe(data, ctx) {
	ctx.spawnSummonEffect(originOf(data), data.radius || 2.5, { color: 0x22d3ee, emissive: 0x67e8f9 });
}

/**
 * Deck Sifter: fan of ghost card silhouettes rising from the caster using
 * a parchment/gold particle burst to signal a draw action.
 */
function renderDeckSifter(data, ctx) {
	if (!ctx.spawnParticleBurst) return;
	ctx.spawnParticleBurst(originOf(data), {
		color: 0xf5deb3,
		emissive: 0xdaa520,
		count: 10,
		spread: 1.8,
	});
}

const ASTRAL_GUARDIAN_COLOR = 0x818cf8;
const ASTRAL_GUARDIAN_EMISSIVE = 0x6366f1;
const MANA_PRISM_COLOR = 0xa855f7;
const MANA_PRISM_EMISSIVE = 0x22d3ee;
const SACRIFICIAL_ALTAR_COLOR = 0xfbbf24;
const SACRIFICIAL_ALTAR_EMISSIVE = 0xef4444;
const CHRONO_TRIGGER_COLOR = 0x67e8f9;
const CHRONO_TRIGGER_EMISSIVE = 0xfbbf24;
const CHRONO_TRIGGER_TELEGRAPH_RADIUS = 2;

/**
 * Astral Guardian: indigo shield/summon telegraph at cast radius, spark burst,
 * and a tight minion-spawn ring distinct from the generic accent burst.
 */
function renderAstralGuardian(data, ctx) {
	if (data.radius === undefined) return;
	const origin = originOf(data);
	const color = getAccentHex(data.cardId) ?? ASTRAL_GUARDIAN_COLOR;
	const emissive = ASTRAL_GUARDIAN_EMISSIVE;
	if (ctx.spawnTelegraphRing) {
		ctx.spawnTelegraphRing(origin, data.radius, { color, emissive });
	}
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(origin, { color, emissive, count: 14, spread: 2.0 });
	}
	ctx.spawnSummonEffect(origin, 1.2, { color, emissive });
}

/**
 * Mana Prism: utility cast telegraph when `radius` is present; otherwise a
 * summon ring plus crystal burst for the economy placement path.
 */
function renderManaPrism(data, ctx) {
	const origin = originOf(data);
	if (data.radius !== undefined) {
		const color = MANA_PRISM_COLOR;
		const emissive = MANA_PRISM_EMISSIVE;
		if (ctx.spawnTelegraphRing) {
			ctx.spawnTelegraphRing(origin, data.radius, { color, emissive });
		}
		if (ctx.spawnParticleBurst) {
			ctx.spawnParticleBurst(origin, { color, emissive, count: 12, spread: 1.6 });
		}
		return;
	}
	ctx.spawnSummonEffect(origin, 2, { color: 0xa78bfa, emissive: 0x8b5cf6 });
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(origin, {
			color: 0x22d3ee,
			emissive: 0xa78bfa,
			count: 12,
			spread: 1.2,
		});
	}
}

/**
 * Sacrificial Altar: large gold/red ritual telegraph at sacrifice radius and
 * an ember burst at the caster origin.
 */
function renderSacrificialAltar(data, ctx) {
	if (data.radius === undefined) return;
	const origin = originOf(data);
	const color = SACRIFICIAL_ALTAR_COLOR;
	const emissive = SACRIFICIAL_ALTAR_EMISSIVE;
	if (ctx.spawnTelegraphRing) {
		ctx.spawnTelegraphRing(origin, data.radius, { color, emissive });
	}
	if (ctx.spawnParticleBurst) {
		ctx.spawnParticleBurst(origin, { color, emissive, count: 16, spread: 2.4 });
	}
}

/**
 * Chrono Trigger: time-ripple utility cast when `restoredCharges` is present;
 * otherwise amber hand-slot bursts for the economy draw path.
 */
function renderChronoTrigger(data, ctx) {
	if (!data.origin) return;
	const origin = originOf(data);
	if (data.restoredCharges !== undefined) {
		const color = CHRONO_TRIGGER_COLOR;
		const emissive = CHRONO_TRIGGER_EMISSIVE;
		const radius = data.radius ?? CHRONO_TRIGGER_TELEGRAPH_RADIUS;
		if (ctx.spawnTelegraphRing) {
			ctx.spawnTelegraphRing(origin, radius, { color, emissive });
		}
		if (ctx.spawnParticleBurst) {
			ctx.spawnParticleBurst(origin, { color, emissive, count: 12, spread: 2.0 });
		}
		return;
	}
	const direction = directionOf(data);
	const perpX = -direction.z;
	const perpZ = direction.x;
	if (ctx.spawnTelegraphRing) {
		ctx.spawnTelegraphRing(origin, 3, { color: 0xfbbf24, emissive: 0xf59e0b });
	}
	if (ctx.spawnParticleBurst) {
		for (const offset of [-1.2, 1.2]) {
			ctx.spawnParticleBurst(
				{ x: origin.x + perpX * offset, z: origin.z + perpZ * offset },
				{ color: 0xfbbf24, emissive: 0xf59e0b, count: 8, spread: 1.0 },
			);
		}
	}
}

// ── Registry ────────────────────────────────────────────────────────────
//
// Override the per-type default for any card that needs a bespoke effect.
// Entries may be a single function or an array of functions; arrays compose
// so a single card can stack multiple visuals (e.g. pillar + AoE ring).

const CARD_RENDERERS = {
	// Weapons
	iron_sword: renderWeaponSwing,
	flame_blade: renderWeaponSwing,
	harvesting_scythe: renderWeaponSwing,
	saber_of_light: renderWeaponSwing,
	photon_slicer: renderWeaponSwing,
	arcane_bolt: renderWeaponSwing,
	resonance_edge: renderResonantDoublePulse,
	echo_blade: renderEchoSlash,
	infinite_disk: renderTripleReturning,
	// Heavy wind-up greatswords — weighty committed-hit slash + impact.
	steel_claymore: renderHeavyGreatsword,
	magma_greatsword: renderHeavyGreatsword,
	excalibur_photon: renderHeavyGreatsword,
	fireball: renderFireball,
	deck_sifter: renderDeckSifter,

	// Spells
	chain_lightning: renderChainLightningArcs,
	battle_familiar: renderBattleFamiliar,
	mana_leach: renderManaLeach,
	soul_drain: renderSoulDrain,
	frost_nova: renderFrostNova,
	permafrost_lance: renderPermafrostLance,
	ice_ball: renderIceBall,
	glacier_collapse: renderGlacierCollapse,
	healing_font: renderHealingFont,
	divine_grace: renderDivineGrace,
	purifying_pulse: renderPurifyingPulse,
	gravity_well: renderGravityWell,
	event_horizon: renderEventHorizon,
	dragons_breath: renderDragonsBreath,
	inferno_pillar: renderInfernoPillar,
	telepipe: renderTelepipe,
	astral_guardian: renderAstralGuardian,
	mana_prism: renderManaPrism,
	sacrificial_altar: renderSacrificialAltar,
	chrono_trigger: renderChronoTrigger,

	// Creatures
	undead_commander: renderUndeadCommander,
	storm_eagle: [renderStormEagleSummon, renderStormEagleStrike],
	thunderbird: [renderThunderbirdSummon, renderChainLightning],
	dungeon_drake: [renderWyrmSummon, renderWyrmAttack],
	ancient_wyrm: [renderWyrmSummon, renderWyrmAttack],
	null_crawler: [renderNullCrawlerSummon, renderPhaseBeam],
	bulkhead_mauler: renderShockwaveSweep,

	// Enchantments
	spike_trap: renderGroundEnchantment,
	mirror_ward: renderSelfEnchantment,
	cinder_snare: renderGroundEnchantment,
};

// Type-level defaults — used when no card-specific renderer is registered.
// Enchantments have no type default; specific cards opt-in via the registry above.
const TYPE_DEFAULT_RENDERERS = {
	weapon: renderConeSwings,
	spell: renderGenericSpellBurst,
	creature: renderCreatureSummon,
};

/** Alias for coverage tests asserting no spell card still uses the generic burst. */
export const SPELL_TYPE_DEFAULT_RENDERER = TYPE_DEFAULT_RENDERERS.spell;

/**
 * Return the renderer(s) responsible for the given cardId, accounting for
 * both the per-card registry and per-type defaults. Always returns an array.
 *
 * Visible for testing.
 */
export function resolveRenderers(cardId) {
	const specific = CARD_RENDERERS[cardId];
	if (specific) return Array.isArray(specific) ? specific.slice() : [specific];
	const def = CARD_DEFS[cardId];
	if (!def) return [];
	const typeDefault = TYPE_DEFAULT_RENDERERS[def.type];
	return typeDefault ? [typeDefault] : [];
}

// ── Common post-effects ────────────────────────────────────────────────

/**
 * Render the trigger ring (gold) when a ground enchantment fires on the
 * server. This is independent of the card that triggered it (the source
 * enemy attack may not even have a cardId in the payload).
 */
function renderEnchantmentTrigger(data, ctx) {
	if (!data.enchantmentTriggered || data.radius === undefined) return;
	ctx.spawnSummonEffect(originOf(data), data.radius, { color: 0xfbbf24, emissive: 0xf59e0b });
}

/**
 * Flash every enemy that was hit (including shockwave hits), and emit one
 * throttled `enemyHit` sound regardless of hit count. Shockwave hits play
 * their own sound separately so we skip ours when only shockwave hits exist
 * to avoid doubling up.
 */
function applyHitFlashes(data, ctx, accentHex) {
	const directHits = data.hits || [];
	const shockwaveHits = data.shockwaveHits || [];
	const allHits = directHits.length + shockwaveHits.length;
	if (allHits === 0) return;

	if (shockwaveHits.length === 0) ctx.playSound('enemyHit');

	if (ctx.markCardHitEnemies) {
		ctx.markCardHitEnemies([...directHits, ...shockwaveHits]);
	}

	const meshes = ctx.enemyMeshes ? ctx.enemyMeshes() : {};
	for (const hit of [...directHits, ...shockwaveHits]) {
		const mesh = meshes[hit.enemyId];
		if (!mesh) continue;
		const flashColor = hit.frozenShatter ? 0x7dd3fc : (accentHex ?? 0xffffff);
		ctx.flashMesh(mesh, flashColor, hit.frozenShatter ? 350 : 200);
	}
}

/**
 * Shockwave AoE ring at origin + dedicated hit sound. Driven by the server
 * combo counter (`data.shockwaveHits`), so any weapon that opts into a
 * shockwave hit set gets the visual for free without a custom renderer.
 */
function applyShockwave(data, ctx, accentHex) {
	if (!data.shockwaveHits || data.shockwaveHits.length === 0) return;
	ctx.spawnSummonEffect(originOf(data), 6, accentHex);
	ctx.playSound('enemyHit');
}

// ── Entry point ────────────────────────────────────────────────────────

/**
 * Render every visual effect associated with a `cardUsed` event. Replaces
 * the giant if/else chain that used to live in main.js. Order of operations
 * matches the original handler so audio cues and emissive flashes resolve
 * in the same sequence players are used to.
 */
export function renderCardUsed(data, ctx) {
	if (!data) return;

	ctx.playSound('card');

	for (const renderer of resolveRenderers(data.cardId)) {
		renderer(data, ctx);
	}

	renderEnchantmentTrigger(data, ctx);

	const accentHex = getAccentHex(data.cardId);
	applyShockwave(data, ctx, accentHex);
	applyHitFlashes(data, ctx, accentHex);
}
