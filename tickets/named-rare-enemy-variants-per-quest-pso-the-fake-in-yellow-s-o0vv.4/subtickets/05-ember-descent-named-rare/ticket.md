# Ember Descent named rare: Cinderghast (ember_wraith)

Author the `ember_descent` tier 1 quest script with a hand-placed named rare — **Cinderghast**, a stronger `ember_wraith` variant — that spawns only on this quest and drops a guaranteed unique reward on first kill per run.

## Acceptance Criteria

- `ember_descent` tier 1 defines `script.waves`; bulk combat spawn is bypassed and `defeat_enemies` total equals scripted spawn count.
- Exactly one scripted spawn is an `ember_wraith` with inline `variant` naming it **Cinderghast** (fire-themed tint, `hpMult`/`damageMult` > 1, optional `scaleMult`); it spawns at an authored position on the volcanic rim / inner cavern, not via random pool spawn.
- Snapshot enemy has `namedRare.name === 'Cinderghast'`, retains `ember_wraith` airborne behavior (`flying`, `altitude`).
- Killing Cinderghast grants a configured unique fire-themed card drop (suggest `dragons_breath`) on first kill per run; repeat kills in the same run do not re-grant.
- Other quests do not spawn Cinderghast.
- Vitest deploys `ember_descent` tier 1 with the fire-cavern layout seed and asserts spawn, stats scaling, and drop behavior.

## Technical Specs

- **`game/server/quests.js`**: Add `script.waves` to `ember_descent.tiers[1]`. Use `enter_room` trigger on the inner fire-cavern band; place rim grunts on `run_start`. Cinderghast spawn example:
  `{ type: 'ember_wraith', x, z, variant: { name: 'Cinderghast', hpMult: 1.5, damageMult: 1.25, tint: 0xf97316, scaleMult: 1.1, drop: { cardId: 'dragons_breath' } } }`.
  Coordinates derived from `generateLayout(questLayoutSeed('ember_descent', 1), 'fire-cavern', …)`.
- **`game/server/test/ember_descent_named_rare.test.js`** (new): Integration test for this quest tier only.
- **`game/server/debugScenarios.js`** (optional): `ember-descent-cinderghast` shortcut scenario.

## Verification: code
