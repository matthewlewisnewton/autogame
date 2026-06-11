## Drop unused `damage` field on debug familiar stub

`setupRunExhaustedDebug` builds a `battleFamiliar` stub in
`game/server/debugScenarios.js` that includes a `damage` property, but the
exhaustion path (`canPlayerCastHandCard`) only ever reads `magicStoneCost`,
`remainingCharges`, and `activeMinionId`. The `damage` field is dead weight and
slightly misleading about what the stub needs.

### Acceptance Criteria
- The debug familiar stub keeps only the fields the exhaustion/cast logic
  actually consumes, or a one-line comment explains why `damage` is retained.

## Clear `_combatExhaustedSince` on run reset/extraction for tidiness

`_combatExhaustedSince` is currently only cleared inside
`tickCombatExhaustionGrace` (and implicitly on next tick after recovery). It is
not blocking — a fresh run repopulates the hand so the next tick deletes it —
but explicitly clearing it in `resetTransientRunState` / on extraction would
remove any chance of a stale internal field lingering on a player object across
runs.

### Acceptance Criteria
- `_combatExhaustedSince` is deleted when transient run state is reset, with a
  test asserting it is absent after a reset.
