# Guaranteed bonus drops for variant enemies

Wire the variant tag into the loot path so that a defeated enemy carrying a
`variant` always yields a bonus: a guaranteed card drop and a guaranteed magic
stone drop, on top of its normal drops. Non-variant enemies are unaffected.

## Acceptance Criteria

- When a defeated enemy has a truthy `enemy.variant`, `recordEnemyCardDrop`
  guarantees a card is recorded for the killer (the normal type→card mapping is
  still used; the variant just makes the drop guaranteed / adds the bonus).
- When a defeated enemy has a truthy `enemy.variant`, `spawnMagicStoneDrop`
  pushes an additional/guaranteed magic-stone loot entry beyond the normal one.
- A non-variant enemy's drops are unchanged from current behavior.
- Bonus-drop magnitude/behavior is driven from the variant registry definition
  (e.g. a `bonusDrop` flag/field on the def) rather than hard-coded per call site.
- A seeded/deterministic unit test proves a variant enemy yields the bonus
  card + magic stone drop and a non-variant enemy does not.
- Existing server + client tests pass; the game starts and loads cleanly.

## Technical Specs

- `game/server/progression.js`: `recordEnemyCardDrop` (~1410) and
  `spawnMagicStoneDrop` (~1438). Check `enemy.variant` and consult
  `VARIANT_DEFS` (imported from `game/server/enemyVariants.js`, created in
  sub-ticket 01) to determine the bonus.
- Keep the loot object shape (`{ id, x, z, value, kind, createdAt }`) consistent
  with existing magic-stone drops; the bonus stone is an extra entry in
  `_gameState.loot`.
- Add/extend a unit test under `game/server/test/` (e.g. reuse
  `enemy_variants.test.js` or `server.test.js`) covering the variant vs
  non-variant drop paths with a seeded enemy whose `variant` is set directly.

## Verification: code
