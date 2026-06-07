# Vault Wyrm card stats and description

Retune the shared `dungeon_drake` ("Vault Wyrm") creature card data so its
summoned minion deals modestly less direct breath damage and carries a burn
duration stat the server will consume in the next sub-ticket. Update the card's
player-facing effect label to mention burning breath.

## Acceptance Criteria

- `game/shared/cardStats.json` entry for `dungeon_drake` has `attackDamage`
  reduced from **3** to **2** (the value `applyWyrmMinionBreathStats` uses as
  the base breath tick damage via `cardDef.breathDamage ?? cardDef.attackDamage`).
- The same entry adds `burnDurationMs: 2000` (milliseconds of BURNING status
  applied per breath hit — aligns with the 291 burn tick cadence).
- The same entry adds `specialEffect: "burning_breath"` so merged `CARD_DEFS`
  and the client hand UI show a burn-themed effect label instead of the generic
  creature description.
- Merged server `CARD_DEFS.dungeon_drake` and client `CARD_DEFS.dungeon_drake`
  both expose the new fields with no drift (shared JSON merge only).
- `ancient_wyrm` stats are **unchanged** — this rebalance targets base Vault
  Wyrm only.
- Existing card sync / definition tests remain green (`cards.test.js`,
  `card_sync` if present).

## Technical Specs

- **`game/shared/cardStats.json`**: edit the `dungeon_drake` object (~lines
  5–13). Keep existing breath timing fields (`breathRange`, `breathHoldDistance`,
  `breathDurationMs`, `breathTickMs`, `breathIntervalMs`, `minionTtl`) as-is;
  only lower `attackDamage`, and add `burnDurationMs` + `specialEffect`.
- **`game/shared/cardDefs.json`**: no change expected (identity already correct).
- Do **not** modify `game/server/simulation.js`, `game/server/progression.js`,
  or minion AI in this sub-ticket — burn application and test expectation updates
  land in sub-ticket 02.

## Verification: code
