// Server configuration constants

const TICK_RATE = 20; // times per second
const MOVE_SPEED = 12; // units per second — maximum player movement speed (matches client terminal velocity)
const MAX_ELAPSED_MS = 200; // maximum milliseconds of movement granted per request (prevents teleport via large time delta)
const DETECTION_RADIUS = 8; // units
const ENEMY_ATTACK_RANGE = 4; // units — must be this close to strike
const ENEMY_ATTACK_RECOVERY_MS = 1200; // cooldown after attack (hit or cancel)
const MAX_MAGIC_STONES = 100;
const MAGIC_STONES_REGEN_PER_TICK = 0.5;
const SUMMON_RADIUS = 10; // units — radial AoE
const ATTACK_RANGE = 5; // units — max distance to hit
const ATTACK_CONE_ANGLE = Math.PI / 2; // 90-degree forward cone
const STALE_THRESHOLD = 10000; // 10 seconds
const COOLDOWN_MS = 800; // server-side cooldown between uses of the same slot (milliseconds)
const BOUNDS_MARGIN = 2;
const SPAWN_PADDING = 2;
const DECK_MIN_SIZE = 4;
const DECK_MAX_SIZE = 12;
const MAX_HP = 100;
const RESPAWN_DELAY_MS = 3000;
const LOOT_LIFETIME_MS = 120000;
const LOOT_SPAWN_CHANCE = 0.5;
const STALE_CLEANUP_INTERVAL_MS = 5000;
const PERIODIC_SAVE_INTERVAL_MS = 30000;

const VICTORY_REWARD_ROTATION = [
  'flame_blade',
  'battle_familiar',
  'dungeon_drake',
];

module.exports = {
  TICK_RATE,
  MOVE_SPEED,
  MAX_ELAPSED_MS,
  DETECTION_RADIUS,
  ENEMY_ATTACK_RANGE,
  ENEMY_ATTACK_RECOVERY_MS,
  MAX_MAGIC_STONES,
  MAGIC_STONES_REGEN_PER_TICK,
  SUMMON_RADIUS,
  ATTACK_RANGE,
  ATTACK_CONE_ANGLE,
  STALE_THRESHOLD,
  COOLDOWN_MS,
  BOUNDS_MARGIN,
  SPAWN_PADDING,
  DECK_MIN_SIZE,
  DECK_MAX_SIZE,
  MAX_HP,
  RESPAWN_DELAY_MS,
  LOOT_LIFETIME_MS,
  LOOT_SPAWN_CHANCE,
  STALE_CLEANUP_INTERVAL_MS,
  PERIODIC_SAVE_INTERVAL_MS,
  VICTORY_REWARD_ROTATION
};
