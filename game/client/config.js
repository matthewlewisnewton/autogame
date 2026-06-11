// ── Client configuration constants ──
// All magic numbers and tunable values extracted from main.js / dungeon.js.
// Import from here instead of defining inline.

import sharedConstants from '../shared/constants.json' with { type: 'json' };

// ── Deck ──

/** Minimum number of cards required in a deck to ready up */
export const DECK_MIN_SIZE = 4;

/** Maximum number of cards allowed in a deck */
export const DECK_MAX_SIZE = 24;

// ── Combat ──

/** Attack range in world units — matches server constant for attack range / warning circle radius */
export const ENEMY_ATTACK_RANGE = 4;

/** Player weapon reach — matches server ATTACK_RANGE */
export const ATTACK_RANGE = 5;

/** Enemy/player entity collision radius — matches server ENTITY_RADIUS */
export const ENTITY_RADIUS = 0.45;

/** Default forward cone width — matches server ATTACK_CONE_ANGLE */
export const ATTACK_CONE_ANGLE = Math.PI / 2;

/** Returning projectile hit radius — matches server PROJECTILE_HIT_WIDTH */
export const PROJECTILE_HIT_WIDTH = 1.2;

/** Maximum player HP */
export const MAX_HP = 100;

/** Guild medic full-heal cost */
export const MEDIC_HEAL_COST = 10;

/** Character-booth paid appearance edit cost */
export const APPEARANCE_CHANGE_COST = 25;

/** Maximum player Magic Stones — synced via shared/constants.json */
export const MAX_MS = sharedConstants.MAX_MAGIC_STONES;
export const STARTING_MS = sharedConstants.STARTING_MAGIC_STONES;

/** Walk-over pickup radius — slightly below server LOOT_PICKUP_RADIUS so the
 *  client emits lootPickup only when the player is clearly in range server-side
 *  (avoids rejected pickups from round-trip latency). */
export const LOOT_PICKUP_RADIUS = 3.25;

/** Minimum ms between lootPickup emits while standing on the same drop */
export const LOOT_PICKUP_RETRY_MS = 200;

/** Window (ms) after a cardUsed hit during which we skip minion-damage effects */
export const CARD_HIT_GRACE_MS = 500;

/** Delay between photon_barrage swings — matches server swing stagger (ms) */
export const PHOTON_BARRAGE_SWING_DELAY_MS = 80;

/** Event Horizon crush impact delay after pull VFX — visual pull→crush beat (ms) */
export const EVENT_HORIZON_CRUSH_DELAY_MS = 375;

// ── Visual effect durations ──

/** Weapon projectile: ms before auto-removal */
export const ATTACK_EFFECT_DURATION = 600;

/** Rusty Shiv close-range stab: ms before auto-removal */
export const RUSTY_SHIV_EFFECT_DURATION = 320;

/** Weapon projectile: units per second */
export const ATTACK_EFFECT_SPEED = 8;

/** Summon AoE: total lifetime (expand + fade) in ms */
export const SUMMON_EFFECT_DURATION = 1000;

/** Summon AoE: time to reach full radius in ms */
export const SUMMON_EXPAND_MS = 700;

/** Minion mesh scale-in and summon-in ground VFX duration in ms */
export const MINION_SUMMON_IN_MS = 750;

/** Hit spark: ms before auto-removal */
export const HIT_SPARK_DURATION = 400;

/** Loot collection animation: ms for scale-up + fade */
export const LOOT_COLLECT_DURATION = 600;

/** Floating damage number: ms before auto-removal */
export const DAMAGE_NUMBER_DURATION = 1000;

// ── Camera ──

/** Camera field of view (degrees) */
export const CAMERA_FOV = 75;

/** Camera near clipping plane */
export const CAMERA_NEAR = 0.1;

/** Camera far clipping plane */
export const CAMERA_FAR = 1000;

/** Camera offset relative to player position {x, y, z} — used when yaw is zero */
export const CAMERA_OFFSET = { x: 0, y: 5, z: 10 };

/** Orbit camera distance behind the player */
export const CAMERA_DISTANCE = 10;

/** Orbit camera height above the player */
export const CAMERA_HEIGHT = 5;

/** Lower orbit follow height for sunken-canyon layouts only (dramatic vertical drop). */
export const SUNKEN_CANYON_CAMERA_HEIGHT = 3.5;

/**
 * Orbit camera Y offset above the player for a dungeon layout profile.
 * @param {string|undefined|null} profile
 * @returns {number}
 */
export function getCameraFollowHeight(profile) {
	return profile === 'sunken-canyon' ? SUNKEN_CANYON_CAMERA_HEIGHT : CAMERA_HEIGHT;
}

/** Horizontal camera rotation speed while right-dragging (rad/px) */
export const CAMERA_YAW_SENSITIVITY = 0.005;

/** Gamepad stick deadzone (0–1) */
export const GAMEPAD_DEADZONE = 0.15;

/** Gamepad right-stick camera turn speed at full deflection (rad/s) */
export const GAMEPAD_LOOK_SENSITIVITY = 2.5;

/** Lock-on acquisition range — matches server DETECTION_RADIUS */
export const LOCK_ON_RANGE = 8;

/** Auto-unlock when target exceeds this distance */
export const LOCK_ON_BREAK_RANGE = 10;

/** Camera yaw smoothing speed while locked on (rad/s) */
export const LOCK_ON_CAMERA_LERP = 8;

/** Below this distance, hold the last stable bearing instead of recomputing */
export const LOCK_ON_MIN_BEARING_DIST = 0.85;

/** Maximum camera yaw turn speed while locked on (rad/s) */
export const LOCK_ON_MAX_YAW_SPEED = 5;

/** Maximum player facing turn speed while locked on (rad/s) */
export const LOCK_ON_MAX_FACING_SPEED = 10;

/** Seconds to ease the camera back after a locked target dies */
export const LOCK_ON_DEATH_RELEASE_DURATION = 1.25;

/** Default gamepad button index for lock-on (L trigger / LT) */
export const LOCK_ON_GAMEPAD_BUTTON = 6;

/** Gamepad button index for the secondary hand palette modifier (R trigger / RT).
 *  When held, face buttons can map to additional hand slots (PSO-style) without
 *  a keyboard modifier layer. Only used once MAX_HAND_SLOTS exceeds six. */
export const HAND_MODIFIER_GAMEPAD_BUTTON = 7;

// ── Movement ──

/** Player movement speed (units/s) — matches server constant exactly */
export const MOVE_SPEED = 12;

/** Maximum ms of movement per frame — matches server constant to prevent drift */
export const MAX_ELAPSED_MS = 200;

/** Simulation tick rate (Hz) — must match server TICK_RATE */
export const TICK_RATE = 20;

/** Slippery-floor input acceleration (units/s²) — matches server SLIPPERY_ACCEL */
export const SLIPPERY_ACCEL = 30;

/** Slippery-floor coasting retention per tick — matches server SLIPPERY_FRICTION */
export const SLIPPERY_FRICTION = 0.92;

/** Normal-floor velocity retention per tick — matches server NORMAL_STOP_FRICTION */
export const NORMAL_STOP_FRICTION = 0;

// ── Dungeon ──

/** Width of passage corridors (matches server constant) */
export const PASSAGE_WIDTH = 4;

/** Extra margin around dungeon bounds (matches server constant) */
export const BOUNDS_MARGIN = 2;

// ── Audio ──

/** Master volume multiplier for all synthesized SFX (0–1) */
export const MASTER_VOLUME = 0.18;

/** Sound effect parameters per event type */
export const SOUND_CONFIG = {
	card:             { freq: 600, duration: 0.1, gain: 0.35 },
	enemyHit:         { freq: 300, duration: 0.15, gain: 0.3 },
	playerDamage:     { freq: 200, duration: 0.2, gain: 0.35 },
	loot:             { freq: 800, duration: 0.08, gain: 0.25 },
	victory:          { notes: [{ freq: 500, duration: 0.15, gain: 0.3 }, { freq: 700, duration: 0.15, gain: 0.3 }] },
	failure:          { notes: [{ freq: 400, duration: 0.2, gain: 0.3 }, { freq: 250, duration: 0.2, gain: 0.3 }] },
	volatileExplosion: { freq: 80, duration: 0.5, gain: 0.25 },
	leechHeal:        { freq: 900, duration: 0.2, gain: 0.2 },
	heal:             { notes: [{ freq: 520, duration: 0.12, gain: 0.25 }, { freq: 780, duration: 0.15, gain: 0.22 }] },
	shieldBreak:      { freq: 150, duration: 0.15, gain: 0.35 },
};

// ── Hand ──

/** Fixed playable hand slots — matches server MAX_HAND_SLOTS */
export const MAX_HAND_SLOTS = 6;

/** Cards dealt at run start — matches server OPENING_HAND_SIZE */
export const OPENING_HAND_SIZE = 4;

/** Slot fill priority: B, A, C←, C↓, C↑, C→ — matches server */
export const HAND_SLOT_FILL_ORDER = sharedConstants.HAND_SLOT_FILL_ORDER;

/** Passive draw interval (display only; server is authoritative) */
export const PASSIVE_DRAW_INTERVAL_MS = 5000;

// ── Enemy Variant Codex ──

/** Data for the variant codex HUD overlay (press C to toggle). */
export const VARIANT_CODEX_DATA = [
	{
		id: 'volatile',
		name: 'Volatile',
		color: '#f97316', // hot orange — matches renderer VARIANT_BADGE_COLORS
		description: 'Explodes on death, dealing radial damage',
	},
	{
		id: 'warded',
		name: 'Warded',
		color: '#22d3ee', // cyan — matches WARDED_TINT
		description: 'Protected by a shield that absorbs damage',
	},
	{
		id: 'leeching',
		name: 'Leeching',
		color: '#14b8a6', // teal — distinct from warded cyan
		description: 'Heals for a fraction of damage dealt',
	},
	{
		id: 'frenzied',
		name: 'Frenzied',
		color: '#dc2626', // red — distinct from volatile orange
		description: 'Enrages below 50% HP, gaining speed and attack',
	},
];
