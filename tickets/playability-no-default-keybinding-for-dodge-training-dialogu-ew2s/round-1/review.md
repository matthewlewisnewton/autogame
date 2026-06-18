# Senior Review: playability — no default keybinding for Dodge

**Ticket:** `playability-no-default-keybinding-for-dodge-training-dialogu-ew2s`  
**Baseline:** `99007f0d`  
**Commits:** `6fb4decd` (default Space binding + `onDodge`), `a7a8534e` (Settings rebind + server schema)  
**Capture:** `round-1/metrics.json` — `ok: true`, `pageerrors: []`, no `harness_failure`

## Runtime health

The captured run is clean:

- `metrics.json` reports `"ok": true` with both dev servers up (`http://localhost:5176/`).
- `pageerrors` is empty; `pageerrors.json` is `[]`.
- `console.log` shows only benign auth/WebSocket noise (401 on unauthenticated REST, socket close during connect). No `pageerror` or `[fatal]` lines from game code.
- Probes confirm dodge executed in live play: player moved (`z: 27 → 19`), `keyItemCooldownRemaining` spiked to `403` ms after dodge, HUD showed `Dodge Roll / SPACE` with cooldown `0.4`, and screenshot `04-after-dodge.png` shows the equipped dodge badge labeled **SPACE** during Initiate Vault (`training_caverns`).

Vitest: **700/700 passed** (`coverage.log`).

## Per-criterion findings

### 1. Fresh players can dodge-roll with a sensible default key

**Met.** `DEFAULT_KEYBOARD.dodge` is now `[' ']` in `game/client/input.js`. `onKeyDown` routes Space through a dedicated `dodge` branch (after the `canUseGameActions` gate) to `callbacks.onDodge()`, not `onUseKeyItem`. `main.js` wires `onDodge` to `socket.emit(USE_KEY_ITEM, { keyItemId: 'dodge_roll' })` with the same socket and card-commitment guards as the generic key-item path.

Capture proof: harness pressed dodge during gameplay; cooldown HUD activated and player position changed.

### 2. Dodge is rebindable in Settings

**Met.** Settings overlay (`index.html`) adds a **Dodge roll** row with `#dodge-key-input`, hint text, and key-capture handlers in `main.js` mirroring the existing key-item rebind UX (reserved-key toast, blur restore). `syncDodgeBindingUI()` keeps the input and in-run HUD in sync via `getDodgeBinding()`.

Server persistence: `KEYBOARD_BINDING_ACTIONS` in `game/server/settings.js` now includes `'dodge'`; `validateSettings` / `updateSettings` accept and persist lowercase bindings (tested in `settings.test.js`).

Client override: `onKeyDown` checks `getKeyboardBindings().dodge` before falling back to the Space default. `getDodgeBinding()` resolves stored override or default with `SPACE` display label.

### 3. HUD and docs reflect the dodge binding

**Met.** When `equippedKeyItemId === 'dodge_roll'` in keyboard mode, `renderKeyItemHud` shows `getDodgeBinding().display` (`SPACE`) instead of the generic key-item `E` label. Screenshot and probe `keyItemIndicatorText` confirm this in the live capture.

`game/docs/controls.md` documents Space as the default dodge keyboard binding and notes Settings remapping.

### 4. Training dialogue / playability goal

**Met.** The ticket's core playability gap — coaching tells players to dodge but no key was bound — is closed. Capture ran Initiate Vault (`training_caverns` tier 1, seed `352369970`), the default starter quest where dodge_roll is equipped and coaching references combat movement. Dodge is now reachable on first deploy without visiting Settings.

### 5. Consistency with design docs and no foundation regression

**Met.** Change is localized to input routing, settings schema/UI, and HUD label resolution. No changes to server simulation, dungeon generation, or net replication paths beyond accepting a new persisted settings key. `game/docs/requirements.md` foundations (3D render, WebSocket connect, movement sync) remain exercised by the clean capture run.

No new debug scenarios were added; nothing to gate-check under the debug-scenario rules.

### 6. Code quality and test coverage

**Solid.** Implementation follows existing `useKeyItem` rebind patterns. Unit tests cover:

- Default Space → `onDodge` and `canUseGameActions` gate (`input.test.js`)
- Custom dodge override (`input.test.js`)
- `getDodgeBinding()` defaults and override display
- Settings layout row (`settings-layout.test.js`)
- Dodge key capture accept/reject (`main.test.js`)
- Server schema accept/reject for `keyboard.bindings.dodge` (`settings.test.js`)
- HUD label for dodge_roll (`key-item-dodge.test.js`)

`getReservedKeys()` intentionally excludes `dodge` (like `useKeyItem`) so remapped dodge keys are not double-reserved — consistent with sub-ticket 02 and covered by an updated test expectation.

## Integration notes (non-blocking)

- **Dual activation paths:** With `dodge_roll` equipped, both **Space** (`onDodge`) and **E** (`onUseKeyItem` → equipped item) can trigger dodge. This is reasonable — Space is the dedicated dodge binding; E remains the generic key-item action.
- **`onDodge` always emits `dodge_roll`:** Space triggers dodge even if another key item were equipped later. That matches a dedicated dodge binding and is outside this ticket's training-caverns scope.
- **Gamepad:** Dodge on gamepad still routes through the existing `useKeyItem` gamepad binding (D-pad Down). Keyboard was the reported gap; gamepad was already wired.

## Remaining gaps

None. All acceptance criteria from both sub-tickets and the top-level playability goal are satisfied with live capture proof and passing tests.

VERDICT: PASS
