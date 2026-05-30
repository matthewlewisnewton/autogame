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
//   spawnDivineGraceEffect(origin, radius)
//   spawnInfernoPillarEffect(origin, radius)
//   spawnChainLightningEffect(origin, direction)
//   flashMesh(mesh, color, durationMs)
//   enemyMeshes()      → { [enemyId]: Three.js mesh }
//   playSound(name)
//   myId               → local player id (string|null)
//   scheduleAfter(ms, fn) — wrapper around setTimeout used for delayed swings

import { CARD_ACCENT_STYLE, CARD_DEFS } from './cards.js';

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
 * Infinite Disk and any card flagged with `triple_returning_projectile`:
 * spawn three projectile flashes offset along the perpendicular axis so the
 * player can see the three disks fan out.
 */
function renderTripleReturning(data, ctx) {
	const origin = originOf(data);
	const direction = directionOf(data);
	const perpX = -direction.z;
	const perpZ = direction.x;
	const style = { color: 0xa5f3fc, emissive: 0x22d3ee };
	for (const offset of [-0.6, 0, 0.6]) {
		ctx.spawnAttackEffect(
			{ x: origin.x + perpX * offset, z: origin.z + perpZ * offset },
			direction,
			style,
		);
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

/**
 * Glacier Collapse uses a fixed icy palette rather than the accent color
 * so the freeze visual reads the same regardless of upgrade styling.
 */
function renderGlacierCollapse(data, ctx) {
	if (data.radius === undefined) return;
	ctx.spawnSummonEffect(originOf(data), data.radius, { color: 0x38bdf8, emissive: 0x0ea5e9 });
}

/**
 * Divine Grace: heal ring + loot sound when the caster gained Magic Stones.
 */
function renderDivineGrace(data, ctx) {
	if (data.radius === undefined) return;
	ctx.spawnDivineGraceEffect(originOf(data), data.radius);
	if (data.magicStonesGained > 0) ctx.playSound('loot');
}

/**
 * Event Horizon: outer pull ring (handled by renderGenericSpellBurst) plus
 * a tighter inner crush ring keyed off `data.centerRadius`.
 */
function renderEventHorizon(data, ctx) {
	renderGenericSpellBurst(data, ctx);
	if (data.centerRadius) {
		ctx.spawnSummonEffect(originOf(data), data.centerRadius, accentSummonStyle(data.cardId));
	}
}

/**
 * Inferno Pillar: tall fiery pillar effect plus the standard accent AoE
 * preview ring underneath.
 */
function renderInfernoPillar(data, ctx) {
	if (data.radius === undefined) return;
	ctx.spawnInfernoPillarEffect(originOf(data), data.radius);
}

/**
 * Undead Commander: caster summon ring plus a small ring for each spawned
 * skeleton minion.
 */
function renderUndeadCommander(data, ctx) {
	ctx.spawnSummonEffect(originOf(data), 2);
	for (const spawn of (data.summonedMinions || [])) {
		ctx.spawnSummonEffect({ x: spawn.x, z: spawn.z }, 1.2);
	}
}

/**
 * Thunderbird (chain_lightning): zap effect on origin, an enemy-hit cue, and
 * a follow-up attack flash. Triggered by specialEffect rather than cardId so
 * future cards reusing the chain_lightning effect inherit the visual.
 */
function renderChainLightning(data, ctx) {
	if (!data.origin) return;
	ctx.spawnChainLightningEffect(data.origin, { x: 1, z: 0 });
	ctx.playSound('enemyHit');
	ctx.spawnAttackEffect(data.origin, directionOf(data));
}

/**
 * Vault Wyrm / Archive Wyrm minion attacks: ground cone matching server
 * collectConeHits geometry (melee swipe or fire breath).
 */
function renderWyrmAttack(data, ctx) {
	if (!data.origin) return;

	const isFireBreath = data.specialEffect === 'fire_breath';
	const accentHex = getAccentHex(data.cardId);
	const color = isFireBreath ? 0xef4444 : (accentHex ?? 0x22c55e);
	const emissive = isFireBreath ? (accentHex ?? 0x9333ea) : 0x16a34a;

	if (data.breathPhase !== 'tick') {
		ctx.spawnAttackEffect(originOf(data), directionOf(data), {
			range: data.attackRange,
			coneAngle: data.attackConeAngle,
			color,
			emissive,
			duration: data.breathDurationMs,
			fillOpacity: isFireBreath ? 0.38 : 0.48,
			edgeOpacity: isFireBreath ? 0.72 : 0.85,
		});
	}

	if (!data.hits?.length || !ctx.spawnHitSpark || !ctx.enemyMeshes) return;

	const meshes = ctx.enemyMeshes();
	for (const hit of data.hits) {
		const mesh = meshes[hit.enemyId];
		if (!mesh) continue;
		ctx.spawnHitSpark(
			{ x: mesh.position.x, y: mesh.position.y + 0.6, z: mesh.position.z },
			{ color, emissive, count: 5, spread: 0.55 },
		);
	}
}

/**
 * Phase Stalker: narrow cyan beam corridor along the projectile path.
 */
function renderPhaseBeam(data, ctx) {
	if (!data.origin) return;
	const accentHex = getAccentHex(data.cardId);
	ctx.spawnAttackEffect(originOf(data), directionOf(data), {
		effect: 'returning_projectile',
		returnPasses: 0,
		range: data.attackRange,
		projectileHitWidth: data.hitWidth ?? 0.8,
		color: accentHex ?? 0x22d3ee,
		emissive: 0x06b6d4,
	});
}

/**
 * Bulkhead Mauler: short wide shockwave cone in front of the construct.
 */
function renderShockwaveSweep(data, ctx) {
	if (!data.origin) return;
	const accentHex = getAccentHex(data.cardId);
	ctx.spawnAttackEffect(originOf(data), directionOf(data), {
		range: data.attackRange,
		coneAngle: data.attackConeAngle,
		color: accentHex ?? 0x78716c,
		emissive: 0xf59e0b,
	});
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

// ── Registry ────────────────────────────────────────────────────────────
//
// Override the per-type default for any card that needs a bespoke effect.
// Entries may be a single function or an array of functions; arrays compose
// so a single card can stack multiple visuals (e.g. pillar + AoE ring).

const CARD_RENDERERS = {
	// Weapons
	infinite_disk: renderTripleReturning,

	// Spells
	glacier_collapse: renderGlacierCollapse,
	divine_grace: renderDivineGrace,
	event_horizon: renderEventHorizon,
	inferno_pillar: [renderInfernoPillar, renderGenericSpellBurst],
	telepipe: renderTelepipe,

	// Creatures
	undead_commander: renderUndeadCommander,
	thunderbird: renderChainLightning,
	dungeon_drake: renderWyrmAttack,
	ancient_wyrm: renderWyrmAttack,
	null_crawler: renderPhaseBeam,
	bulkhead_mauler: renderShockwaveSweep,

	// Enchantments
	spike_trap: renderGroundEnchantment,
	mirror_ward: renderSelfEnchantment,
};

// Type-level defaults — used when no card-specific renderer is registered.
// `creature` and `enchantment` have no default ring of their own; specific
// cards opt-in via the registry above.
const TYPE_DEFAULT_RENDERERS = {
	weapon: renderConeSwings,
	spell: renderGenericSpellBurst,
};

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

	if (data.hpHealed > 0 && data.playerId === ctx.myId) {
		ctx.playSound('loot');
	}

	const accentHex = getAccentHex(data.cardId);
	applyShockwave(data, ctx, accentHex);
	applyHitFlashes(data, ctx, accentHex);
}
