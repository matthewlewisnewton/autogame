# Cleanup nits from combat-balance-deck-exhaustion-soft-locks-a-run-no-cards-cas-asyx

> **Staleness note.** This follow-up ticket was written against commit
> `feeaaf18` (2026-06-11). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `combat-balance-deck-exhaustion-soft-locks-a-run-no-cards-cas-asyx`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

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
