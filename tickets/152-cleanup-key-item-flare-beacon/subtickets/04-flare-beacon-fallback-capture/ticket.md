# Add flare_beacon reveal to harness fallback capture

Sub-task capture always runs `harness/screenshot.mjs` with `CAPTURE_PLAN_AGENT=fallback`, so a committed `capture-plan-gemini.txt` is never loaded during QA. Round-1 capture therefore never exercised `flare-beacon-ready` or `useKeyItem`. Extend `fallbackRecipe()` (same pattern as ticket 142’s sloped-dungeon append) and expose `revealedUntil` on harness probes so `metrics.json` proves the reveal flow ran.

## Acceptance Criteria

- `game/client/main.js` — `__AUTOGAME_HARNESS_STATE__().enemyHp[]` entries include `revealedUntil` when present on server enemy data.
- `harness/screenshot.mjs` — when the inferred ticket or output path matches this flare-beacon cleanup ticket (`flare_beacon`, `flare-beacon`, or `152-cleanup-key-item-flare-beacon`), `fallbackRecipe()` appends after the base lobby/movement steps: `emitScenario` `flare-beacon-ready` → `pressKey` `e` → short `wait` → screenshot whose description mentions amber reveal highlight → `probe` whose description notes checking `enemyHp[].revealedUntil`.
- Non–flare-beacon tickets keep the existing generic fallback (no extra key-item steps).
- After a sub-ticket capture run, `artifacts/iter-*/metrics.json` has `"capturePlanSource": "fallback"`, `"scenarios"` includes `"flare-beacon-ready"`, a screenshot entry for the flare-beacon reveal step, and at least one `enemyHp[]` probe entry with `revealedUntil` greater than the probe timestamp.

## Technical Specs

- **File**: `game/client/main.js` — in the `enemyHp` mapping inside `__AUTOGAME_HARNESS_STATE__` (~lines 3731–3735), add `revealedUntil: enemy.revealedUntil ?? undefined`.
- **File**: `harness/screenshot.mjs` — in `fallbackRecipe()` (~lines 306–354), add `isFlareBeaconTicket` detection parallel to `isSlopeTicket`, e.g. `/flare[-_]?beacon|revealedUntil|152-cleanup-key-item-flare-beacon/i` on ticket text and `/flare|152-cleanup-key-item-flare-beacon/i` on `outDirAbs`. When true, append steps after `03-after-d`:
  - `{ action: 'emitScenario', player: 'A', scenario: 'flare-beacon-ready' }`
  - `{ action: 'pressKey', player: 'A', key: 'e', ms: 400 }`
  - `{ action: 'wait', player: 'A', ms: 800 }`
  - `{ action: 'screenshot', player: 'A', name: '04-flare-beacon-reveal', description: '...amber reveal highlight on nearby enemies after flare_beacon useKeyItem...' }`
  - `{ action: 'probe', player: 'A', description: '...revealedUntil in the future on nearby enemies in harnessState.enemyHp...' }`
  - Update `summary` when the flare append is active.
- **Read-only**: `game/server/index.js` — `flare-beacon-ready` debug scenario (~lines 979–988); `pressKey` action handler already exists in the working tree diff for `screenshot.mjs`.
- Do **not** add `tickets/.../capture-plan-gemini.txt` — sub-task capture cannot load it while `CAPTURE_PLAN_AGENT=fallback` is set in `harness/steps/screenshot.py`.

## Verification: code
