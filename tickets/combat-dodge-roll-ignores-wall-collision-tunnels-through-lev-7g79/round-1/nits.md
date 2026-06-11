## Add an end-to-end dodge-into-wall test through handleUseKeyItem

The new `dodge_roll.test.js` coverage validates wall collision by calling
`tryPlayerMove`/`buildWallColliders` directly with the dodge distance formula.
That is a faithful proxy, but it does not exercise the actual `dodge_roll` branch
in `keyItemEffects.js` (`handleUseKeyItem`), so a future regression that bypasses
`tryPlayerMove` in the handler (e.g. a direct `player.x += ...` shortcut) would
not be caught. A thin integration test driving the handler would close that gap.

### Acceptance Criteria
- A server test invokes the dodge_roll path through `handleUseKeyItem` (or the
  `useKeyItem` socket handler) with a player pinned against a wall.
- The test asserts the player's committed `x/z` does not cross the wall and that
  cooldown/invulnerability are set, proving the handler itself runs the collision sweep.

## Redundant "simulated logic" unit tests in dodge_roll.test.js

Two tests reimplement handler logic inline rather than calling production code:
the cooldown-gate test (`useKeyItem returns on_cooldown ...`) recomputes the
`now < cooldownUntil` check locally, and the cooldown-set test only asserts
`now + def.cooldownMs` arithmetic. These pass regardless of handler behavior and
add little regression value.

### Acceptance Criteria
- Either drop the two reimplemented-logic tests or rewrite them to assert against
  the real `handleUseKeyItem` output (emitted `KEY_ITEM_USED` payload / mutated
  `player.keyItemCooldownUntil`).
