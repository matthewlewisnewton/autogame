# Debug hook: open the hat-swap booth ready to swap

Add a single-step `?booth=hatswap` debug hook that opens the character booth (the
hat-swap UI) **and** unlocks a set of catalog hats, so the free unlocked-hat swap
can be exercised directly without manually chaining `?debugScenario=hats-unlocked`
and `?booth=character`. Free-equip, the unlock gate, and their tests already exist
(prior tickets 239/267/215) — this sub-ticket only adds the debug entry point.

## Acceptance Criteria

- Loading the client with `?booth=hatswap` on a localhost host (`debugScenarioAllowed`),
  after the lobby phase is entered, opens the character booth overlay (calls
  `openCharacterBooth`).
- The same hook requests the existing `hats-unlocked` debug scenario (emits
  `debugScenario` with `{ name: 'hats-unlocked' }`) so non-default catalog hats
  become owned/equippable, giving the tester an actual unlocked hat to swap to for free.
- When the `hats-unlocked` scenario result arrives while the character booth is
  open, the booth's hat list is rebuilt so the newly-unlocked hats appear as
  selectable (owned) entries (mirrors the `hatUnlocked` handler which already
  calls `rebuildBoothHatList`).
- The hook is gated to localhost and fires at most once, exactly like the existing
  `?booth=character` / `?booth=quest` hooks (reuses `debugScenarioAllowed` and the
  `boothDebugRequested` guard). On a non-localhost host, or with any other `booth`
  value, nothing new happens.
- Existing `?booth=character`, `?booth=quest`, and `?debugScenario=...` behavior is
  unchanged.

## Technical Specs

- `game/client/main.js`
  - Extend `requestBoothDebugOpen()` (around line 2071) to also accept
    `boothDebugParam === 'hatswap'`. Keep the existing early returns
    (`!debugScenarioAllowed || boothDebugRequested`, lobby-phase check, and setting
    `boothDebugRequested = true`). For the `hatswap` branch: when `socket` is
    connected, `socket.emit('debugScenario', { name: 'hats-unlocked' })`, then call
    `openCharacterBooth()`. The `quest` and `character` branches stay as-is.
  - In the `debugScenarioResult` socket handler (around line 1389, the
    `Array.isArray(data.unlockedHats)` branch), after `setUnlockedHats(...)`, also
    call `rebuildBoothHatList()` when the character booth is open, so the booth list
    reflects the newly-unlocked hats (the existing code only re-syncs the Account
    overlay via `syncCosmeticForm`). `rebuildBoothHatList` is already imported and
    used by the `hatUnlocked` handler.
- Optional focused test (only if added, put it here so it stays in scope):
  `game/client/test/debug-hatswap-hook.test.js` — drive `requestBoothDebugOpen`
  via the existing `window.__requestBoothDebugOpenForTest` hook with the `hatswap`
  param and assert the booth opens and the scenario emit fires.
- Do not touch server code, the free-equip logic, or the unlock-gate logic — those
  are already complete and tested.

## Verification: code
