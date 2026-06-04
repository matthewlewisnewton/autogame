# Shared card stat source + server spreads from it

Move the full per-card stat objects into one shared single-source module so the
server no longer hand-maintains them. Land the shared module and switch the
**server** consumer first (client stays untouched this pass). Server runtime
behavior must be byte-for-byte identical to today.

## Acceptance Criteria

- A new shared single source of full per-card stat objects exists (either an
  extended `game/shared/cardDefs.json` or a new `game/shared/cardStats.json` /
  `.js`) keyed by card id, holding every JSON-serializable stat field the server
  currently defines inline (e.g. `damage`, `magicStoneCost`, `effect`,
  `specialEffect`, `isEvolved`, `minionHp`, `minionTtl`, `attackRange`,
  `attackDamage`, `breathRange`, `healAmount`, `target`, `taunt`, etc.).
- `server/progression.js` `CARD_DEFS` is rebuilt by spreading the shared stat
  object for each card, plus a **thin server overlay** that supplies ONLY the
  fields that require runtime computation and cannot be JSON-encoded:
  `Math.PI`-based cone/breath angles (`dungeon_drake.breathConeAngle`,
  `bulkhead_mauler.attackConeAngle`, `ancient_wyrm.breathConeAngle`,
  `harvesting_scythe.attackConeAngle`, `dragons_breath.attackConeAngle`) and
  `astral_guardian.attackIntervalMs` (`Math.floor(1000 / TICK_RATE)`).
- Every card id and every field/value in the resulting server `CARD_DEFS` is
  identical to the pre-change definition (no stat added, dropped, or changed).
  The existing identity spread from `cardDefs.json` is preserved.
- `cd game && pnpm test` passes, including the existing
  `server/test/card_sync.test.js`.

## Technical Specs

- Files: `game/shared/cardDefs.json` (or a new shared stats file alongside it),
  `game/server/progression.js` (CARD_DEFS block L115-478).
- The current server `CARD_DEFS` already does `...CARD_IDENTITY.<id>` from
  `../shared/cardDefs.json`. Either extend that JSON to also carry the stat
  fields, or add a sibling stats source the server requires and spreads. The
  identity fields (`id/name/type/charges/acquisition/rewardOrder`) must remain
  intact.
- Keep `TICK_RATE` imported from `./config` for the overlay; do not inline its
  value.
- Do NOT touch `client/cards.js`, `CARD_SELL_VALUES`, or `EVOLUTION_TRANSFORMS`
  in this sub-ticket — those are later passes.

## Verification: code
