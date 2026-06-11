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
