# Fireball card: server definition, cast effect, and burning-on-hit

Add a new FIRE card that shoots a fireball projectile. On the server, define
the card, make it obtainable, and add a new `fireball` effect in
`cardEffects.js` that deals impact damage and applies the BURNING status (291)
to each enemy the projectile hits. Cover the new behavior with server tests.

## Acceptance Criteria
- A new card (e.g. id `fireball`) exists in `shared/cardDefs.json` with a stable
  `id`, `name`, `type`, `charges`, `acquisition: "reward"`, and a unique
  `rewardOrder`. Because `VICTORY_REWARD_ROTATION` is auto-derived from
  `acquisition === "reward"`, this alone makes the card obtainable — no
  `config.js` edit is needed.
- `shared/cardStats.json` has a matching entry giving the card `damage`,
  `attackRange`, `effect: "fireball"`, and a burning duration field (e.g.
  `burningDurationMs`) used when igniting hit enemies.
- `shared/cardEconomy.json` `cardSellValues` has an entry for the new card id.
- `server/cardEffects.js` handles `cardDef.effect === "fireball"`: it collects
  projectile hits (model on the existing `"projectile"` branch using
  `collectProjectileHits`) for impact damage, and for every enemy hit it calls
  `applyBurning(enemyEntity, burningDurationMs)` so the enemy gains
  `burningUntil` in the future.
- The `CARD_USED` payload emitted for this card carries `effect: "fireball"`
  plus the existing `origin`/`direction`/`attackRange`/`hits` fields so the
  client can render the projectile.
- New server test(s) verify: (a) the card can be cast and emits a `fireball`
  `CARD_USED` with hits/impact damage applied, and (b) an enemy struck by the
  fireball becomes burning (`isBurning(enemy) === true` / `burningUntil > now`)
  in addition to taking impact damage.
- `card_acquisition.test.js` still passes (card is reachable; `CARD_DEFS` and
  `cardDefsJson` key sets stay in sync; stats/economy entries present).

## Technical Specs
- `game/shared/cardDefs.json` — add the identity entry (`acquisition: "reward"`,
  next free `rewardOrder`).
- `game/shared/cardStats.json` — add `{ damage, attackRange, effect: "fireball",
  burningDurationMs }`. Model the projectile shape on `arcane_bolt`.
- `game/shared/cardEconomy.json` — add a `cardSellValues` entry.
- `game/server/cardEffects.js` — add the `fireball` effect handling in the
  weapon branch alongside the `throw_rock`/`projectile` case (~line 249). Use
  `collectProjectileHits(...)` for hits, then iterate the struck enemies and
  call `applyBurning(enemy, cardDef.burningDurationMs)`. `applyBurning` and
  `isBurning` are exported from `server/simulation.js` (see ~line 1154); import
  `applyBurning` into `cardEffects.js` from `./simulation` if not already
  present, and resolve each `hit.enemyId` to its enemy entity from game state.
- `game/server/test/` — add a test file (e.g. `fireball_card.test.js`) modeled
  on `burning_status.test.js` / `new_card_pack.test.js` covering cast +
  burning-on-hit + impact damage.
- Do NOT change client files in this sub-ticket.

## Verification: code
