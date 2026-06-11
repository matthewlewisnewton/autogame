# Cleanup nits from client-convert-updateattackeffects-330-line-boolean-flag-dis-dfyk

> **Staleness note.** This follow-up ticket was written against commit
> `518021a5` (2026-06-11). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `client-convert-updateattackeffects-330-line-boolean-flag-dis-dfyk`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Stale "branch in updateAttackEffects" comments after registry refactor

Several spawner helpers in `game/client/renderer.js` still document their meshes
in terms of the old boolean-flag dispatch (e.g. "the shared `isLightColumn`
branch in updateAttackEffects", "its own flagged branch", `isThermalColumn`,
`isEtherSiphonColumn`, `isChronoTriggerColumn`, `isSpikeTrapSpike`). Those
branches no longer exist — dispatch is now keyed off `fx.kind` into
`ATTACK_EFFECT_UPDATERS`. The comments are now misleading for the next reader.

### Acceptance Criteria
- Update the comments at renderer.js:5055, 5193, 5318, 5513, 5851, 6203, 6801 (and
  any siblings) to reference the per-kind updater (e.g. "consumed by
  `updateLightColumn` keyed on `ATTACK_EFFECT_KINDS.lightColumn`") instead of the
  removed `is*` branch.
- No code/behavior change; comments only.
