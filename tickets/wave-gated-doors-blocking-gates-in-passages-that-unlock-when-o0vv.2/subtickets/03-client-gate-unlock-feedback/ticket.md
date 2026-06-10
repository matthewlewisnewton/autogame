# 03 — Client gate unlock feedback and dialogue toast

When a passage gate unlocks, play a brief visual cue at the doorway and surface the paired quest radio/toast line so players connect "wave cleared" with "door opened."

## Acceptance Criteria

- Detecting a passage lock transition `locked: true` → `locked: false` triggers a short unlock effect at that passage (e.g. emissive flash + scale/fade on the gate mesh, or a small particle burst) before the mesh is removed.
- The effect is triggered once per passage unlock (no repeat on unrelated `STATE_UPDATE` ticks).
- A quest `dialogueBeacons` entry with `trigger: 'onWaveCleared'` for the unlocking wave fires `QUEST_DIALOGUE` and the client shows the existing `showQuestDialogueToast` (speaker + line) at unlock time — add a gate-unlock line to the passage-lock fixture quest if none exists.
- Unlock feedback does not block movement or input; it is cosmetic only.
- `cd game && pnpm test:quick` passes, including a test that simulates `passageLocks` key change and asserts the unlock-effect helper runs exactly once.

## Technical Specs

- **Edit:** `game/client/renderer.js` — in `syncPassageLockGates` (or a dedicated `playPassageUnlockEffect(passageIndex, layout)`), compare previous vs. next `passageLocksCacheKey` / per-index `locked` flags; spawn brief VFX (reuse existing particle/scene helpers used for combat feedback where possible).
- **Edit:** `game/client/main.js` — optional: if unlock VFX is easier to drive from socket layer, diff `state.run.passageLocks` against a module-level cache in the `STATE_UPDATE` handler and call the renderer effect helper; `QUEST_DIALOGUE` handler already calls `showQuestDialogueToast` — no new toast UI needed.
- **Edit:** `game/server/quests.js` — add/extend `dialogueBeacons` on `SCRIPTED_ENCOUNTER_FIXTURE_DEF` tier 1 (and/or `training_caverns` tier 1) with an `onWaveCleared` line that explicitly mentions the passage opening (e.g. "Bulkhead released — move up.").
- **Add:** `game/client/test/passage-gate-unlock-feedback.test.js` — mock renderer unlock helper; feed two `passageLocks` snapshots (locked then unlocked) and assert effect invoked once.

## Verification: code
