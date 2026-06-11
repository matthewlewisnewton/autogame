# Consolidate shared booth debug hook in boothCommon

`launchBooth.js` owns `getBoothDebugHook` and `questBooth.js` re-exports it from there, while deck/shop booths parse the same `?booth=` query param via duplicated localhost gating in sub-ticket 01's factory. Move the URL parsing helper into `boothCommon.js` so all booth modules share one debug-hook primitive without cross-importing launch-specific launch-bay logic.

## Acceptance Criteria

- `getBoothDebugHook(search)` lives in `game/client/boothCommon.js` (moved from `launchBooth.js`); behavior unchanged: `new URLSearchParams(search || '').get('booth')`.
- `launchBooth.js` re-exports `getBoothDebugHook` from `boothCommon.js` (preserving the existing export for `main.js` and tests).
- `questBooth.js` re-exports `getBoothDebugHook` from `boothCommon.js` instead of `launchBooth.js`, breaking the quest→launch coupling noted in code review.
- Public exports from `launchBooth.js` and `questBooth.js` are unchanged (`LAUNCH_BOOTH_ID`, `isLaunchBoothAction`, `QUEST_BOOTH_ID`, `isQuestBoothAction`, `getBoothDebugHook`, etc.).
- `launchBooth.test.js` and `questBooth.test.js` pass without assertion changes.
- `pnpm test` passes.

## Technical Specs

**Edit: `game/client/boothCommon.js`**

- Add `getBoothDebugHook(search)` with the same implementation and JSDoc currently in `launchBooth.js` lines 37–44.

**Edit: `game/client/launchBooth.js`**

- Remove the local `getBoothDebugHook` function body.
- `export { getBoothDebugHook } from './boothCommon.js';` (or equivalent re-export keeping it in the module's public surface).

**Edit: `game/client/questBooth.js`**

- Change `export { getBoothDebugHook } from './launchBooth.js';` to `export { getBoothDebugHook } from './boothCommon.js';`.
- Update the comment on lines 9–10 to reference `boothCommon.js` instead of sub-ticket 02 placeholder text.

**Do not change:** `boothDeck.js`, `boothShop.js`, `main.js` import lines (they already import `getBoothDebugHook` from `launchBooth.js` / `questBooth.js` respectively via existing paths).

## Verification: code
