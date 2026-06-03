# Variant registry + applyVariant seam wired into spawnEnemy

Introduce the data + seam for enemy variants (affixes): a variant registry
containing one trivial no-op test variant, and an `applyVariant(enemy, tier, rng)`
function wired into the enemy spawn path. Variant probability is gated on the
spawn room's currently-unused `room.encounterTier`. A tagged enemy gets a
`variant` field that flows out through the existing state snapshot to the client.
No specific gameplay effects yet — this is plumbing only.

## Acceptance Criteria

- A variant registry exists mapping variant id → definition, with at least one
  trivial **test** variant (e.g. id `'test'`) whose behavioral effect is a no-op
  (it does not change enemy stats/AI in this ticket).
- A function `applyVariant(enemy, tier, rng)` exists and is exported. It uses
  `rng` and a probability scaled by `tier` (the room's `encounterTier`, 0–1) to
  decide whether to tag `enemy`. When chosen, it sets `enemy.variant` to a
  variant id from the registry; when not chosen, `enemy.variant` is left
  unset/`null`.
- `applyVariant` is invoked from the enemy spawn flow so that combat-spawned
  enemies can receive a variant, with `tier` resolved from the spawn room's
  `encounterTier` (0 for start/treasure rooms, so they effectively never roll a
  variant).
- The `variant` field is present on the enemy object and therefore included in
  the object emitted by `stateSnapshot()` (enemies are serialized whole).
- A seeded/deterministic unit test proves: (a) at `tier = 0` an enemy is never
  tagged, and (b) at a high tier with a seeded rng, an enemy is tagged with a
  registry variant id.
- Existing server + client tests pass; the game starts and loads cleanly.

## Technical Specs

- New file `game/server/enemyVariants.js`: export `VARIANT_DEFS` (object keyed by
  variant id; each def has at least `id`, a human `name`, and a placeholder for
  future behavior) and `applyVariant(enemy, tier, rng)`. Keep the base
  per-variant chance and the tier scaling as named constants so follow-up
  tickets 170–173 can extend the registry without touching the seam.
- `game/server/progression.js` (`spawnEnemy` ~2486, `spawnCombatEnemies` ~2750):
  import and call `applyVariant`. Resolve the room `encounterTier` for the chosen
  spawn position (find the containing room, or thread the tier through
  `pickEnemySpawnPosition`) and pass it plus the run `rng` into `applyVariant`.
  Spawns without a known room/tier should pass `tier = 0`.
- Do NOT change `stateSnapshot()` enemy serialization beyond confirming the whole
  enemy object (now carrying `variant`) is emitted — it already sends
  `enemies: _gameState.enemies`.
- Add the unit test under `game/server/test/` (new file e.g.
  `enemy_variants.test.js`).

## Verification: code
