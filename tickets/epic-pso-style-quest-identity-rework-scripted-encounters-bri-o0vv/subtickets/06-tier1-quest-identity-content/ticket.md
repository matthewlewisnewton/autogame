# 06 — Tier-1 quest identity content (training caverns, crystal rescue, frost crossing)

Rework the three tier-1 quests called out in the epic so they use the new foundation and play observably differently from each other — distinct scripted beats, briefings, named rares, signature rewards, and (for one quest) the escort objective.

## Acceptance Criteria

- **`training_caverns` tier 1** — converted from bulk `defeat_enemies` to scripted multi-room waves with at least one passage lock; briefing names a client NPC; includes a named rare spawn; `rewardCardId` differs from the other two quests; mid-run dialogue fires on first wave clear.
- **`crystal_rescue` tier 1** — keeps `collect_items` but adds scripted guard waves per room (not bulk `enemyCount` pool), dialogue beacons on each prism collected, briefing + signature card reward; collection and combat beats are both required to finish.
- **`frost_crossing` tier 1** — scripted ice-field waves featuring a quest-named glacial rare (`namedRare` on a wave spawn); briefing + signature reward; at least one `onRoomEntered` dialogue beacon when entering the ice band room.
- **Escort showcase** — either add `training_caverns` tier 1 alternate beat, a new tier-1 quest id, or a clearly documented debug scenario quest entry using `objectiveType: 'escort'` so the escort path is exercised in content (not only unit tests).
- All three primary quests show different objective summaries, briefing text, reward cards, and mid-run dialogue `beaconId` sets on the quest board / server payload.
- Existing tier-2 quests and unrelated quests remain unchanged in behavior.
- `cd game && pnpm test:quick` passes; add `game/server/test/tier1_quest_identity.test.js` asserting per-quest config wiring (objective types, `scriptedEncounters`, `rewardCardId`, dialogue beacon counts).

## Technical Specs

- **Edit:** `game/server/quests.js` — rewrite tier-1 defs for `training_caverns`, `crystal_rescue`, `frost_crossing` with `scriptedEncounters`, `passageLocks`, `dialogueBeacons`, `clientNpc`, `briefing`, `rewardCardId`, and named-rare spawn entries; add escort quest tier or extend one quest per acceptance criteria.
- **Edit:** `game/shared/cardDefs.json` — only if new signature reward cards are required (prefer reusing existing `acquisition: 'reward'` cards with distinct picks per quest).
- **Edit:** `game/server/debugScenarios.js` — optional deploy shortcuts for each reworked quest to speed QA.
- **Edit:** `game/docs/design.md` — brief note under a "Quest identity" subsection listing the three distinct tier-1 identities (optional, one paragraph).
- **Reuse:** sub-tickets 01–05 modules (`scriptedEncounters.js`, `questDialogue.js`, `escort.js`, passage locks, named rare + signature reward plumbing).
- **Do not** change global `VICTORY_REWARD_ROTATION` composition except via per-quest `rewardCardId` overrides.

## Verification: code
