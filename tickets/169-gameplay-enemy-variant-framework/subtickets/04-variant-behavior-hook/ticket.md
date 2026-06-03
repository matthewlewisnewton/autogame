# Invoke the variant definition's behavior hook in applyVariant

When `applyVariant` tags an enemy with a registry variant id, it must also invoke
that variant definition's behavior hook so future affixes can modify the enemy's
stats/AI through the registry seam. Today it only stamps `enemy.variant` and never
calls the definition, leaving the seam half-wired. The existing `'test'` variant
stays a behavioral no-op.

## Acceptance Criteria

- When `applyVariant` selects a registry variant id and sets `enemy.variant`, it
  looks up the definition in `VARIANT_DEFS` and calls `def.apply(enemy)` when
  `def.apply` is a function. When `def.apply` is `null`/absent (as for the
  `'test'` variant) nothing extra happens and the enemy is unchanged beyond the
  `variant` tag.
- The behavior hook is only invoked for tagged enemies; an enemy that is not
  tagged (`enemy.variant` left `null`) never triggers any `apply` call.
- A deterministic regression test proves a registry variant whose `apply` is a
  function mutates the enemy when that variant is selected (e.g. a temporary test
  definition or a spy), while confirming the shipped `'test'` no-op variant leaves
  enemy stats unchanged when selected.
- Existing server + client tests pass; the game starts and loads cleanly.

## Technical Specs

- `game/server/enemyVariants.js`: inside `applyVariant`, after resolving `id` and
  setting `enemy.variant = id`, look up `const def = VARIANT_DEFS[id]` and call
  `def.apply(enemy)` guarded by `typeof def.apply === 'function'`. Do not call
  `apply` on the non-tagged branch. Keep the `'test'` def's `apply: null` so it
  remains a no-op.
- `game/server/test/enemy_variants.test.js`: add a regression test. Drive
  `applyVariant` with a seeded rng (and tier=1) so a tag is guaranteed, and assert
  the hook ran. Prefer exercising a registry definition with a function `apply`
  (you may temporarily register/restore a def, or assert via a verifiable mutation
  the hook would make); also assert the shipped `'test'` variant produces no stat
  change when selected.
- Do not introduce any real gameplay affix here — this only wires the call site so
  follow-up tickets 170–173 can attach behavior by setting `apply`.

## Verification: code
