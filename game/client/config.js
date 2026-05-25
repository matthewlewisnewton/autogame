// ── Client configuration constants ──
// All magic numbers and tunable values extracted from main.js / dungeon.js.
// Import from here instead of defining inline.

import sharedConstants from '../shared/constants.json' with { type: 'json' };

// ── Deck ──

/** Minimum number of cards required in a deck to ready up */
export const DECK_MIN_SIZE = 4;

/** Maximum number of cards allowed in a deck */
export const DECK_MAX_SIZE = 12;

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

/** Maximum player Magic Stones — synced via shared/constants.json */
export const MAX_MS = sharedConstants.MAX_MAGIC_STONES;

/** Walk-over pickup radius — slightly below server LOOT_PICKUP_RADIUS so the
 *  client emits lootPickup only when the player is clearly in range server-side
 *  (avoids rejected pickups from round-trip latency). */
export const LOOT_PICKUP_RADIUS = 3.25;

/** Minimum ms between lootPickup emits while standing on the same drop */
export const LOOT_PICKUP_RETRY_MS = 200;

/** Window (ms) after a cardUsed hit during which we skip minion-damage effects */
export const CARD_HIT_GRACE_MS = 500;

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

/** Default gamepad button index for lock-on (L trigger) */
export const LOCK_ON_GAMEPAD_BUTTON = 6;

// ── Movement ──

/** Player movement speed (units/s) — matches server constant exactly */
export const MOVE_SPEED = 12;

/** Maximum ms of movement per frame — matches server constant to prevent drift */
export const MAX_ELAPSED_MS = 200;

/** Simulation tick rate (Hz) — must match server TICK_RATE */
export const TICK_RATE = 20;

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
	card:           { freq: 600, duration: 0.1, gain: 0.35 },
	enemyHit:       { freq: 300, duration: 0.15, gain: 0.3 },
	playerDamage:   { freq: 200, duration: 0.2, gain: 0.35 },
	loot:           { freq: 800, duration: 0.08, gain: 0.25 },
	victory:        { notes: [{ freq: 500, duration: 0.15, gain: 0.3 }, { freq: 700, duration: 0.15, gain: 0.3 }] },
	failure:        { notes: [{ freq: 400, duration: 0.2, gain: 0.3 }, { freq: 250, duration: 0.2, gain: 0.3 }] },
};
