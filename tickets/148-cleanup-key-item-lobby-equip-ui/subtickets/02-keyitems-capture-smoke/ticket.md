# Scripted capture that opens the Key Items tab

Round-1 verification fell back to the generic lobby→deploy→movement smoke, which
never opens the Key Items tab. Add a dedicated Playwright capture script that
logs in, opens the lobby Key Items tab, confirms an equipped row, and saves a
screenshot — giving QA a deterministic Key Items capture step.

## Acceptance Criteria
- A new Playwright smoke script logs in (register/login via the API like the
  existing browser smoke), reaches the lobby, and calls/clicks into the Key
  Items tab so `#key-item-loadout` is visible and `#lobby-tab-keyitems` is
  active.
- The script asserts that `#key-item-list` contains at least one entry rendered
  with the `equipped` class (the default loadout equips `dodge_roll`, so its
  row carries `key-item-entry equipped`); it exits non-zero if no equipped row
  is found.
- The script saves a PNG screenshot of the Key Items panel to a file (e.g.
  under the repo or a tmp/artifacts path) and logs the saved path.
- A `test:smoke:keyitems` script is added to `game/package.json` that runs the
  new script, mirroring the other `test:smoke:*` entries.

## Technical Specs
- New file `game/client/scripts/test-keyitems-capture.mjs` — model it on
  `game/client/scripts/test-lobby-browser.mjs`: reuse the `register` +
  `loginWithToken` pattern (register a unique user, set `autogame_token` in
  localStorage, reload, wait for `#lobby-browser` visible / `#auth-overlay`
  hidden). Create + enter a lobby (click `#create-lobby-btn`, wait for `#lobby`
  visible), then activate the Key Items tab via
  `page.evaluate(() => window.setLobbyTab('keyitems'))` (exposed at
  `game/client/main.js:3646`) or by clicking `#lobby-tab-keyitems`.
- Assert visibility/active state and the equipped row by reading the DOM:
  `#key-item-loadout` not `.hidden`, `#lobby-tab-keyitems` has `.active`, and
  `#key-item-list .key-item-entry.equipped` exists. Use
  `page.screenshot({ path, ... })` scoped to the `#key-item-loadout` element (or
  full page) for the saved PNG. Follow the existing scripts' `main().catch(...
  process.exit(1))` failure convention so a missing equipped row fails the run.
- `game/package.json` — add `"test:smoke:keyitems": "node
  client/scripts/test-keyitems-capture.mjs"` alongside the existing
  `test:smoke:*` entries (lines 12–19).
- Key item rendering is already implemented (`renderKeyItemList` at
  `game/client/main.js:2388`; default equip `dodge_roll` set server-side at
  `game/server/progression.js:1225` / `game/server/index.js:1132`). No game
  feature code changes — this sub-ticket adds the capture script + script entry.

## Verification: code
