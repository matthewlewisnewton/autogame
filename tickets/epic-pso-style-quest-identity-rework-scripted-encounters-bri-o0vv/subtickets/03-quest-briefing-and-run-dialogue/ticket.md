# 03 — Quest briefing and mid-run dialogue beacons

Give each quest a PSO-style counter briefing (named client NPC, stated reward, mission text) on the lobby quest board, and mid-run dialogue lines fired by authored beacons when scripted progress happens (wave clear, item collected, room entered).

## Acceptance Criteria

- Quest tier fields supported: `clientNpc` (display name), `briefing` (multi-sentence text), optional `briefingRewardLine` (overrides default currency-only reward line when a signature card is added in sub-ticket 04).
- Selecting a quest on the quest board shows a briefing panel with NPC name, briefing body, objective summary, and reward line (`game/client/questBoard.js` + styles).
- `buildQuestUpdatePayload` / `listQuestVariants` in `game/server/quests.js` include briefing fields for the client; server-side `formatBriefingSummary(quest)` helper exists.
- New socket event `questDialogue` (add to `game/shared/events.json` and wire in `game/server/index.js`) broadcasts `{ questId, tier, beaconId, speaker, line }` to the lobby room.
- Quest config `dialogueBeacons[]` supports triggers: `onWaveCleared`, `onCrystalCollected`, `onRoomEntered` (landmark or `roomIndex`), each with `beaconId`, `speaker`, `line`; duplicate `beaconId` lines fire once per run.
- Client handler in `game/client/main.js` displays dialogue via a short-lived toast/banner (reuse or generalize `showCardErrorToast` styling with distinct quest-dialogue class).
- Scripted wave clear (sub-ticket 01) and crystal collection (`collect_items` objective hook) invoke beacon evaluation.
- `cd game && pnpm test:quick` passes, including `game/server/test/quest_dialogue.test.js` and `game/client/test/questBoard.test.js` updates for briefing DOM.

## Technical Specs

- **Edit:** `game/server/quests.js` — briefing fields on tier defs; `formatBriefingSummary`, extend `buildQuestUpdatePayload` / `listQuestVariants`.
- **Add:** `game/server/questDialogue.js` — `evaluateDialogueBeacons(run, trigger, ctx)`, `emitQuestDialogue(io, lobby, payload)`; beacon dedupe set on `run.dialogueFired`.
- **Edit:** `game/server/scriptedEncounters.js` — call dialogue evaluator on wave clear with `onWaveCleared` context.
- **Edit:** `game/server/objectives.js` — `collect_items.onCrystalCollected` triggers `onCrystalCollected` beacons; optional room-enter check from movement tick or room-transition helper.
- **Edit:** `game/shared/events.json` — `QUEST_DIALOGUE: "questDialogue"` under server→client.
- **Edit:** `game/client/questBoard.js`, `game/client/style.css`, `game/client/index.html` — `#quest-briefing` panel bound to selected quest.
- **Edit:** `game/client/main.js` — socket listener + `showQuestDialogueToast(line, speaker)`.
- **Add:** `game/server/test/quest_dialogue.test.js`; extend `game/client/test/questBoard.test.js`.

## Verification: code
