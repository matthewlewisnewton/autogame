# Escort speaks when the ambush springs ("They found us!")

The design calls for dialogue lines from the escort NPC at ambush points. The `annex_escort` quest already has scripted ambush waves in rooms 0 and 1 and one briefing beacon from the liaison; add an ambush-reaction line spoken by the escort NPC herself at the ambush room.

## Acceptance Criteria

- The `annex_escort` tier-1 quest definition contains an additional dialogue beacon at the ambush room (`roomIndex: 1`) with `speaker: 'Archivist Vale'` and the line `They found us!`, using the same `onRoomEntered`-trigger beacon mechanism as the existing `escort_start` beacon.
- A test asserts the `annex_escort` tier-1 quest def includes the new beacon (id, trigger, roomIndex, speaker, line), and the existing dialogue-beacon plumbing tests still pass.
- `cd game && npx vitest run server/test/escort_objective.test.js` (plus any quest-dialogue test file touched) passes.

## Technical Specs

Files to change (only these):
- `game/server/quests.js` — in `QUEST_DEFS.annex_escort.tiers[1].dialogueBeacons` (~line 873): append a second beacon, e.g. `{ beaconId: 'escort_ambush', trigger: 'onRoomEntered', roomIndex: 1, speaker: 'Archivist Vale', line: 'They found us!' }`. Match the existing beacon's exact field shape — copy the `escort_start` entry's structure. No engine changes: the beacon system from the quest-dialogue ticket already fires these.
- `game/server/test/escort_objective.test.js` (or the existing quest-dialogue test file if beacons are asserted there) — add an assertion that `getQuest('annex_escort', 1).dialogueBeacons` includes the `escort_ambush` beacon with the speaker and line above.

## Verification: code
