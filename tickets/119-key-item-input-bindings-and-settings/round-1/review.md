# Senior review: 119 — Key Item Input Bindings and Settings

**Baseline:** `f7cf91fc6071278017c69d3063f22a561ca535e0`  
**Commits:** 5 (`01-input-action-useKeyItem` … `05-tests-and-docs`)  
**Capture:** `round-1/metrics.json`, screenshots, probes

## Runtime health

| Check | Result |
|-------|--------|
| `metrics.json` present, `"ok": true` | Pass |
| `pageerrors` empty, no `failure_kind` | Pass |
| `console.log` — no `pageerror` / `[fatal]` | Pass (Vite connect, 409 on duplicate register, `[initScene]` only) |
| Game reached lobby + playing (probes) | Pass (`phase: playing`, canvas, enemies) |

The captured run is valid proof the game starts and loads cleanly.

## Per-criterion findings

### `useKeyItem` action in `input.js` with defaults

- `ACTIONS.useKeyItem`, keyboard default `e`, gamepad fallback index **13** in `DEFAULT_GAMEPAD_BUTTONS`.
- `STANDARD_PROFILE` and `EIGHTBITDO_64_PROFILE` both bind `useKeyItem` to `{ type: 'button', index: 13 }` (D-pad Down on standard; SDL index 13 on 8BitDo, labeled “Stick click” in profile `buttonLabels` — same index alignment the ticket asked for).
- Custom keyboard binding read from settings overrides defaults; gamepad uses `getBindingForAction` (custom → profile).

**Met.**

### Settings schema (server defaults + PATCH merge)

- `game/server/settings.js`: `keyboard.bindings.useKeyItem: 'e'`, `gamepad.bindings: {}` with existing `deepMerge`.
- `game/client/settings.js` mirrors client defaults.
- `server/test/settings.test.js`: default + deep-merge tests for keyboard and gamepad `useKeyItem`.

**Met.**

### Settings UI remapping row

- `index.html`: “Key item / utility” row with `#use-key-item-key-input` and `#use-key-item-gamepad-label` under **Controls**.
- `main.js`: focus-to-capture keyboard, click-to-capture gamepad (RAF edge-detect), `patchSettings` on assign, `syncUseKeyItemBindingUI` on open/settings change.
- `style.css`: `.settings-binding-row`, `.binding-key-input`, `.binding-gamepad-label`.
- Capture screenshot `01-lobby-settings.png` + layout test confirm DOM.

**Met.**

### `initInput` — once per press, dungeon-only

- Keyboard: `if (e.repeat) return` at top of `onKeyDown`; `useKeyItem` branch calls `onUseKeyItem` once.
- Gamepad: edge trigger in `pollInput` (`pressed && !wasPressed`).
- `canUseGameActions`: `gameState.gamePhase === 'playing'` in `main.js` init — lobby/settings do not fire the action.

**Met.**

### Client socket emit during active run

- `onUseKeyItem` → `socket.emit('useKeyItem')` when `gamePhase === 'playing'`.
- Server handler (118) expects `{ keyItemId }`; bare emit gets `missing_key_item_id` — ticket **Verification** explicitly allows “server may no-op until 121”. Emit wiring for this ticket is satisfied.

**Met** (scope per ticket verification note).

### HUD-ready hook

- `getUseKeyItemBinding()` exported from `input.js` → `{ keyboard, gamepad, gamepadHint }` for tickets 120/121.
- No in-run HUD glyph yet (deferred to follow-ups); hook is present.

**Met.**

### Tests

- `input.test.js`: default `e`, patched key, gamepad btn 13, 8BitDo profile, overrides, repeat guard, `canUseGameActions`, `getUseKeyItemBinding`.
- `settings-layout.test.js`: remap row in Controls.
- `settings.test.js`: server merge.
- Round-1 coverage run: **231/231** passed.

**Met.**

### `controls.md`

- New **Key Item** section: keyboard E, gamepad D-pad Down, 8BitDo stick-click index 13, remapping note.

**Met.**

## Design & regression

- Aligns with `design.md` combat/input model; no lobby-only key-item use.
- Foundation requirements (3D, sockets, movement) unchanged.
- D-pad Down (btn 13) still drives movement via `gamepad.js` `readDpadMovement`; key item fires on the same press edge — matches ticket note on tap-to-use / remapping if conflicting.

## Debug scenarios

No new `?debugScenario=` added for this ticket. Existing debug path remains localhost-gated only.

## Code quality

- Focused diff across input, settings, profiles, main wiring, docs, tests.
- No dead code observed; binding capture cleans up on settings close.
- Minor follow-ups are nits only (see `nits.md`).

## Capture / visual QA

- Settings row present in planned screenshot.
- Gameplay screenshot shows normal dungeon HUD; binding glyph is a later ticket.
- Probes reached `playing` with enemies; no browser defects.

## Remaining gaps

None blocking. Runtime is clean and all acceptance criteria are met for ticket 119 scope.

VERDICT: PASS
