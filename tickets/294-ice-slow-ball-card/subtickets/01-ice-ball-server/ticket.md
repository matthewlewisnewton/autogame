# Ice Ball card: server definition, cast effect, and chance-to-slow

Add a new ICE spell that fires a slow-moving ice-ball projectile. On the server,
define the card, make it obtainable, and add an `ice_ball` effect in
`cardEffects.js` that deals modest impact damage and has a configurable chance
to apply the SLOW status (290) to each enemy the projectile hits via
`applySlow`. Cover cast, projectile hits, and probabilistic slow with server
tests.

## Acceptance Criteria

- A new card (`id: "ice_ball"`) exists in `game/shared/cardDefs.json` with
  `name` (ice-themed, e.g. "Glacial Orb"), `type: "spell"`, `charges: 1`,
  `acquisition: "reward"`, and a unique `rewardOrder` (next unused integer).
- `game/shared/cardStats.json` has a matching entry with: `magicStoneCost`
  (~30–35, aligned with other ice spells), modest `damage` (~10–14),
  `attackRange` (~8–10), `effect: "ice_ball"`, `specialEffect: "slow"`,
  `slowDurationMs`, `slowFactor` (optional; defaults via `applySlow`), and
  `slowChance` in `(0, 1]` (e.g. `0.5`). Include `projectileTravelMs` (e.g.
  `1200`) so the client can animate a slower projectile than the default weapon
  projectile.
- `game/shared/cardEconomy.json` `cardSellValues` has an entry for `ice_ball`.
- `game/server/cardEffects.js` spell branch handles `cardDef.effect ===
  "ice_ball"`: deducts MS cost, resolves aim with `resolveAttackRotation`,
  collects hits via `collectProjectileHits` (single-target / non-piercing, model
  on `chain_lightning` primary), applies impact damage, then for each struck
  enemy rolls against `slowChance` and calls `applySlow(enemy,
  slowDurationMs, slowFactor)` on success. Runs `cleanupAfterDamage`, applies
  cooldown/consumption like other spells.
- The `CARD_USED` payload includes `effect: "ice_ball"`, `origin`, `direction`,
  `attackRange`, `hits`, and `projectileTravelMs` so the client can render the
  traveling orb.
- After a successful slow roll, the enemy snapshot shows `slowedUntil > now`
  (and `isSlowed(enemy) === true`); impact damage is always applied on hit
  regardless of the slow roll.
- New server test(s) in `game/server/test/ice_ball_card.test.js` (or equivalent)
  verify: (a) card definition / acquisition sync, (b) cast emits `ice_ball`
  `CARD_USED` with hits and impact damage, (c) with `Math.random` mocked below
  `slowChance`, struck enemies become slowed, (d) with `Math.random` mocked
  above `slowChance`, struck enemies take damage but remain not slowed.
- Existing slow indicator on the client (290) requires no changes — when
  `applySlow` sets `slowedUntil` on an enemy, the broadcast state drives the
  existing indicator automatically.

## Technical Specs

- **`game/shared/cardDefs.json`** — add the `ice_ball` identity entry near other
  ice spells (`frost_nova`, `permafrost_lance`).
- **`game/shared/cardStats.json`** — add stats as above. Do not pierce
  (`collectProjectileHits` with `pierces: false`).
- **`game/shared/cardEconomy.json`** — add `cardSellValues.ice_ball`.
- **`game/server/cardEffects.js`** — add an `if (cardDef.effect === 'ice_ball')`
  block in the spell branch (near `chain_lightning`, ~814). Import `applySlow`
  and `isSlowed` from `./simulation.js` if not already present. After
  `collectProjectileHits`, iterate unique hit `enemyId`s, roll
  `Math.random() < (cardDef.slowChance ?? 1)`, and call `applySlow` on success
  using the card's `slowDurationMs` / `slowFactor`. Emit `CARD_USED` with the
  same projectile fields weapons use (`origin`, `direction`, `attackRange`,
  `hits`) plus `projectileTravelMs`.
- **`game/server/debugScenarios.js`** + **`game/server/index.js`** — add an
  `ice-ball-ready` debug scenario (player in dungeon with `ice_ball` in hand,
  one or more grunts lined up along cast direction) modeled on `fireball-ready`.
- **`game/server/test/ice_ball_card.test.js`** — definition + integration tests
  modeled on `fireball_card.test.js`; use `vi.spyOn(Math, 'random')` for
  deterministic slow/no-slow cases.
- Do **not** change client rendering files in this sub-ticket.

## Verification: code
