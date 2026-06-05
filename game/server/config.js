// Server configuration constants
const { MAX_MAGIC_STONES: SHARED_MAX_MAGIC_STONES, STARTING_MAGIC_STONES: SHARED_STARTING_MAGIC_STONES, HAND_SLOT_FILL_ORDER: SHARED_HAND_SLOT_FILL_ORDER } = require('../shared/constants.json');
const CARD_DEFS = require('../shared/cardDefs.json');

const TICK_RATE = 20; // times per second
const MOVE_SPEED = 12; // units per second — maximum player movement speed (matches client terminal velocity)
const MAX_ELAPSED_MS = 200; // maximum milliseconds of movement granted per request (prevents teleport via large time delta)
const INPUT_STALE_MS = 150; // stop applying stored input if no fresh move packet arrives
const DETECTION_RADIUS = 8; // units
const ENEMY_ATTACK_RANGE = 4; // units — must be this close to strike
const ENEMY_ATTACK_RECOVERY_MS = 1200; // cooldown after attack (hit or cancel)
const MAX_MAGIC_STONES = SHARED_MAX_MAGIC_STONES;
const STARTING_MAGIC_STONES = SHARED_STARTING_MAGIC_STONES;
const MAGIC_STONES_REGEN_PER_TICK = 0.005;
const SUMMON_RADIUS = 10; // units — radial AoE
const ATTACK_RANGE = 5; // units — max distance to hit
const ATTACK_CONE_ANGLE = Math.PI / 2; // 90-degree forward cone
const PROJECTILE_HIT_WIDTH = 1.2; // units — radius around sampled projectile path
const MINION_FOLLOW_DISTANCE = 3;
const MINION_FOLLOW_SPEED = 2.5;
const MINION_CHASE_SPEED_GRUNT = 2.5;
const MINION_CHASE_SPEED_SKIRMISHER = 4.5;
const STALE_THRESHOLD = 10000; // 10 seconds
const DISCONNECT_GRACE_MS = 60000; // keep disconnected players in lobby for reconnection
const COOLDOWN_MS = 800; // server-side cooldown between uses of the same slot (milliseconds)
const BOUNDS_MARGIN = 2;
const SPAWN_PADDING = 2;
const DECK_MIN_SIZE = 4;
const DECK_MAX_SIZE = 24;
const MAX_HP = 100;
const SPIRE_EDGE_HAZARD_DAMAGE = 3;
const SPIRE_EDGE_HAZARD_COOLDOWN_MS = 500;
const MEDIC_HEAL_COST = 10;
const APPEARANCE_CHANGE_COST = 25;
const LOBBY_REVIVE_HP = 10;
const RESPAWN_DELAY_MS = 3000;
const LOOT_LIFETIME_MS = 120000;
// Slightly wider than the client walk-over radius (3.25) so pickups succeed after
// network latency; trade-off is a modest anti-cheat gap vs. snappier feel.
const LOOT_PICKUP_RADIUS = 3.5;
const LOOT_SPAWN_CHANCE = 0.5;
const STALE_CLEANUP_INTERVAL_MS = 5000;
const PERIODIC_SAVE_INTERVAL_MS = 30000;

const VICTORY_REWARD_ROTATION = Object.values(CARD_DEFS)
  .filter((def) => def.acquisition === 'reward')
  .sort((a, b) => a.rewardOrder - b.rewardOrder)
  .map((def) => def.id);

const shopOnlyIds = Object.values(CARD_DEFS)
  .filter((def) => def.acquisition === 'shop')
  .map((def) => def.id);

// Deterministic enemy-type → card drop mapping (Lost Kingdoms-style acquisition).
const ENEMY_CARD_DROPS = {
  goblin: 'iron_sword',
  grunt: 'iron_sword',
  skirmisher: 'flame_blade',
  drake: 'dungeon_drake',
  miniboss: 'dungeon_drake',
  spawner: 'battle_familiar',
};

// Magic Stone pickups dropped at enemy death positions (Lost Kingdoms-style).
const ENEMY_MS_DROPS = {
  grunt: 20,
  goblin: 18,
  skirmisher: 15,
  drake: 30,
  miniboss: 50,
  spawner: 25,
};

// Money pickups dropped alongside magic stones at enemy death positions.
// Roll against ENEMY_CURRENCY_DROP_CHANCE; on success, amount is a random %
// of that enemy's magic stone drop (inclusive range).
const ENEMY_CURRENCY_DROP_CHANCE = 0.5;
const ENEMY_CURRENCY_DROP_PCT_MIN = 40;
const ENEMY_CURRENCY_DROP_PCT_MAX = 100;

const LOOT_DROP_OFFSET_MS = { x: -0.6, z: 0.5 };
const LOOT_DROP_OFFSET_CURRENCY = { x: 0.6, z: -0.5 };

const MAX_CARD_CHOICES = 3;

const SHOP_CARD_POOL = [...VICTORY_REWARD_ROTATION, ...shopOnlyIds];
const SHOP_PRICE_MULTIPLIER = 2;
const PORTAL_RADIUS = 2.5;
const PORTAL_ENTER_COOLDOWN_MS = 1000;
const PORTAL_PLACEMENT_GRACE_MS = 2000;
const MAX_GROUND_ENCHANTMENTS_PER_PLAYER = 3;

const MAX_HAND_SLOTS = 6;
const OPENING_HAND_SIZE = 4;
const HAND_SLOT_FILL_ORDER = SHARED_HAND_SLOT_FILL_ORDER;
const PASSIVE_DRAW_INTERVAL_MS = Number(process.env.PASSIVE_DRAW_INTERVAL_MS) || 5000;
const MAX_PLAYERS = 16;

// ── Difficulty scaling by live player count ──────────────────────────────────
// 1–4 players are baseline (factor 1.0). Each additional player from 5 up to the
// MAX_PLAYERS cap adds a small marginal increment to spawn rate, enemy damage, and
// miniboss HP. These are the shared tuning knobs; later sub-tickets read them from
// objectives.js / simulation.js / progression.js via the helpers below.
const DIFFICULTY_SCALE_MIN_PLAYERS = 4; // players at or below this stay at factor 1.0
const DIFFICULTY_SPAWN_RATE_PER_PLAYER = 0.08; // +8% spawn rate per extra player (tunable)
const DIFFICULTY_ENEMY_DAMAGE_PER_PLAYER = 0.05; // +5% enemy damage per extra player (tunable)
const DIFFICULTY_MINIBOSS_HP_PER_PLAYER = 0.1; // +10% miniboss HP per extra player (tunable)

// Number of players above the baseline threshold, capped at the MAX_PLAYERS span.
// 0 for any count in 0..4, 1 at 5, +1 per player, clamped to MAX_PLAYERS - threshold
// (12) for any count >= 16. Never negative.
function difficultyExtraPlayers(count) {
  const n = Number(count);
  if (!Number.isFinite(n)) return 0;
  const extra = Math.floor(n) - DIFFICULTY_SCALE_MIN_PLAYERS;
  const cap = MAX_PLAYERS - DIFFICULTY_SCALE_MIN_PLAYERS;
  return Math.max(0, Math.min(cap, extra));
}

// Multiplicative scale factor for a given per-player increment: exactly 1.0 for
// count 1..4, larger for 5..16, and clamped at the 16-player value beyond that.
function difficultyScaleFactor(count, perPlayerIncrement) {
  return 1 + difficultyExtraPlayers(count) * perPlayerIncrement;
}

// Live player count the scaling reads. Drop-in JOIN raises it, LEAVE lowers it.
// Clamped to [0, MAX_PLAYERS]; 0 when there is no gameState/players map.
function runPlayerCount(gameState) {
  if (!gameState || !gameState.players) return 0;
  const n = Object.keys(gameState.players).length;
  return Math.max(0, Math.min(MAX_PLAYERS, n));
}

module.exports = {
  TICK_RATE,
  MOVE_SPEED,
  MAX_ELAPSED_MS,
  INPUT_STALE_MS,
  DETECTION_RADIUS,
  ENEMY_ATTACK_RANGE,
  ENEMY_ATTACK_RECOVERY_MS,
  MAX_MAGIC_STONES,
  STARTING_MAGIC_STONES,
  MAGIC_STONES_REGEN_PER_TICK,
  SUMMON_RADIUS,
  ATTACK_RANGE,
  ATTACK_CONE_ANGLE,
  PROJECTILE_HIT_WIDTH,
  MINION_FOLLOW_DISTANCE,
  MINION_FOLLOW_SPEED,
  MINION_CHASE_SPEED_GRUNT,
  MINION_CHASE_SPEED_SKIRMISHER,
  STALE_THRESHOLD,
  DISCONNECT_GRACE_MS,
  COOLDOWN_MS,
  BOUNDS_MARGIN,
  SPAWN_PADDING,
  DECK_MIN_SIZE,
  DECK_MAX_SIZE,
  MAX_HP,
  SPIRE_EDGE_HAZARD_DAMAGE,
  SPIRE_EDGE_HAZARD_COOLDOWN_MS,
  MEDIC_HEAL_COST,
  APPEARANCE_CHANGE_COST,
  LOBBY_REVIVE_HP,
  RESPAWN_DELAY_MS,
  LOOT_LIFETIME_MS,
  LOOT_PICKUP_RADIUS,
  LOOT_SPAWN_CHANCE,
  STALE_CLEANUP_INTERVAL_MS,
  PERIODIC_SAVE_INTERVAL_MS,
  VICTORY_REWARD_ROTATION,
  ENEMY_CARD_DROPS,
  ENEMY_MS_DROPS,
  ENEMY_CURRENCY_DROP_CHANCE,
  ENEMY_CURRENCY_DROP_PCT_MIN,
  ENEMY_CURRENCY_DROP_PCT_MAX,
  LOOT_DROP_OFFSET_MS,
  LOOT_DROP_OFFSET_CURRENCY,
  MAX_CARD_CHOICES,
  SHOP_CARD_POOL,
  SHOP_PRICE_MULTIPLIER,
  PORTAL_RADIUS,
  PORTAL_ENTER_COOLDOWN_MS,
  PORTAL_PLACEMENT_GRACE_MS,
  MAX_GROUND_ENCHANTMENTS_PER_PLAYER,
  MAX_HAND_SLOTS,
  OPENING_HAND_SIZE,
  HAND_SLOT_FILL_ORDER,
  PASSIVE_DRAW_INTERVAL_MS,
  MAX_PLAYERS,
  DIFFICULTY_SCALE_MIN_PLAYERS,
  DIFFICULTY_SPAWN_RATE_PER_PLAYER,
  DIFFICULTY_ENEMY_DAMAGE_PER_PLAYER,
  DIFFICULTY_MINIBOSS_HP_PER_PLAYER,
  difficultyExtraPlayers,
  difficultyScaleFactor,
  runPlayerCount,
};
