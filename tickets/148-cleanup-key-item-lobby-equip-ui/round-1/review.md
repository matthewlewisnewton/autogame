# Senior Review — 148-cleanup-key-item-lobby-equip-ui

This is a small cleanup ticket capturing two non-blocking nits left over from
`120-key-item-lobby-equip-ui`: (1) extend the `setLobbyTab` integration test to
cover the Key Items panel, and (2) add a capture that opens the Key Items tab
and screenshots an equipped row.

## Runtime health — PASS

- `round-1/metrics.json`: `"ok": true`, `"pageerrors": []`, no `harness_failure`
  block, servers started, scene initialized (`sceneInitialized: true`,
  `hasCanvas: true`, `phase: "playing"`).
- `round-1/console.log` / `pageerrors.json`: only benign lines — `[vite]
  connecting/connected` and `[initScene] Initializing Three.js scene...`. No
  `pageerror` / `[fatal]` lines from game code.
- `coverage.log`: `Test Files 1 passed (1)`, `Tests 141 passed (141)`. The
  `Failed to parse URL from /models/grunt.glb` lines are jsdom test-environment
  noise (relative model URLs in a non-browser fetch), not game runtime errors.

The game starts and loads cleanly. The diff is test/tooling only
(`game/client/test/main.test.js`, `game/client/scripts/test-keyitems-capture.mjs`,
`game/package.json` script entry, plus sub-ticket docs) — no production game
code changed, so no gameplay regression risk.

## Acceptance Criteria

### AC1 — `setLobbyTab('keyitems')` shows `#key-item-loadout`, hides other panels, marks `#lobby-tab-keyitems` active — MET

`game/client/test/main.test.js` now drives `window.setLobbyTab('keyitems')` and
asserts `#key-item-loadout` is visible, `#deck-editor`, `#card-shop`,
`#photon-forge`, `#card-economy` are hidden, and `#lobby-tab-keyitems` is
`active`. It also adds a complementary assertion that switching back to `deck`
re-hides `#key-item-loadout`, locking in the toggle in both directions. The
required IDs (`key-item-loadout`, `lobby-tab-keyitems`, `key-item-list`) were
added to the `requiredIds` smoke list.

Verified against live code: `setLobbyTab` (main.js:2451) maps `keyitems`,
toggles `#key-item-loadout` hidden on `activeLobbyTab !== 'keyitems'`
(main.js:2475), marks the tab active (main.js:2481), and calls
`renderKeyItemList()` (main.js:2486). The full suite passes (141/141), so this
test is green, not aspirational.

### AC2 — scripted capture opens the Key Items tab and saves a screenshot with an equipped row — MET

`game/client/scripts/test-keyitems-capture.mjs` (new) registers/logs in via the
API, creates and enters a lobby, calls `window.setLobbyTab('keyitems')`, then
waits for `#key-item-loadout` visible + `#lobby-tab-keyitems` active +
`#key-item-list .key-item-entry.equipped` present before screenshotting the
`#key-item-loadout` panel to `docs/walkthroughs/keyitems-capture/`. Wired as
`test:smoke:keyitems` in `game/package.json`.

The equipped-row assertion is sound: `renderKeyItemList` (main.js:2388) adds the
`equipped` class to the entry matching `me.equippedKeyItemId`
(main.js:2409), and the default loadout equips `dodge_roll` (confirmed by the
metrics probe: `"equippedKeyItemId": "dodge_roll"`). The script has a graceful
diagnostic fallback that dumps panel state on timeout.

Note: round-1's own verification capture used the deterministic fallback smoke
(lobby → movement → dodge), not this new script, so the round-1 screenshots are
gameplay rather than the Key Items panel. That does not fail AC2 — the AC asks
for a *scripted capture* deliverable, which is present, correct, and wired in.

## Remaining gaps

None. Both acceptance criteria are met, the game runs cleanly, and the full unit
suite passes. Production game code is untouched.

VERDICT: PASS
