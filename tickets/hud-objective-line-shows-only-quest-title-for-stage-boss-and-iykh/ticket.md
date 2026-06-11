# hud: objective line shows only quest title for stage_boss and escort quests (no goal or progress)

## Difficulty: easy

## Goal

For defeat_enemies quests the objective HUD shows useful progress ('Initiate Vault — Purged 4 / 6 hostiles'), but for stage_boss quests it renders only the bare quest title ('Frost Crossing') and for escort quests only 'Annex Evacuation' — no 'defeat the Permafrost Warden', no escort status, no wave progress, for the entire run. The only goal explanation is a transient comms toast at level entry which is easy to miss (and is partially covered by the quest banner). Repro: launch Frost Crossing tier 1 or Annex Evacuation and look at #objective-hud. Expected: every objective type renders a goal line and live progress (e.g. 'Defeat the Permafrost Warden', 'Escort Archivist Vale — ambush 2/4 cleared').

## Acceptance Criteria

- objective-hud shows a non-empty goal/progress line for stage_boss, escort, collect, and survive objective types during a run; text updates as sub-progress changes.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
