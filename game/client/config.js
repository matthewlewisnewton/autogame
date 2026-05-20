// ── Client configuration constants ──
// All magic numbers and tunable values extracted from main.js / dungeon.js.
// Import from here instead of defining inline.

// ── Deck ──

/** Minimum number of cards required in a deck to ready up */
export const DECK_MIN_SIZE = 4;

/** Maximum number of cards allowed in a deck */
export const DECK_MAX_SIZE = 12;

// ── Combat ──

/** Attack range in world units — matches server constant for attack range / warning circle radius */
export const ENEMY_ATTACK_RANGE = 4;

/** Maximum player HP */
export const MAX_HP = 100;

/** Maximum player Magic Stones */
export const MAX_MS = 100;

/** Window (ms) after a cardUsed hit during which we skip minion-damage effects */
export const CARD_HIT_GRACE_MS = 500;

// ── Visual effect durations ──

/** Weapon projectile: ms before auto-removal */
export const ATTACK_EFFECT_DURATION = 600;

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

// ── Movement ──

/** Player acceleration (units/s²) */
export const acceleration = 15.0;

/** Player friction factor (raised to delta*60 power each frame) */
export const friction = 0.88;

// ── Camera ──

/** Camera offset relative to player position {x, y, z} */
export const CAMERA_OFFSET = { x: 0, y: 5, z: 10 };

// ── Dungeon ──

/** Width of passage corridors (matches server constant) */
export const PASSAGE_WIDTH = 4;

// ── Audio ──

/** Sound effect parameters per event type */
export const SOUND_CONFIG = {
	card:           { freq: 600, duration: 0.1 },
	enemyHit:       { freq: 300, duration: 0.15 },
	playerDamage:   { freq: 200, duration: 0.2 },
	loot:           { freq: 800, duration: 0.08 },
	victory:        { notes: [{ freq: 500, duration: 0.15 }, { freq: 700, duration: 0.15 }] },
	failure:        { notes: [{ freq: 400, duration: 0.2 }, { freq: 250, duration: 0.2 }] },
};
