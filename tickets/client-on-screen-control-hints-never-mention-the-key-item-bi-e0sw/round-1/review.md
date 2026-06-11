# Senior Review: Client on-screen control hints — key item binding

**Ticket:** `client-on-screen-control-hints-never-mention-the-key-item-bi-e0sw`  
**Baseline:** `2a7a7486b299bff33a627d2f7771b533c04c8f60`  
**Commits:** `6877fb50` — `client-on-screen-control-hints-never-mention-the-key-item-bi-e0sw/01-key-item-binding-in-attack-hint`

## Runtime health

| Check | Result |
| --- | --- |
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | `true` |
| `pageerrors` | `[]` (empty) |
| `harness_failure` | absent |
| `console.log` `pageerror` / `[fatal]` | none |

Capture reached in-run gameplay (`phase: "playing"`, canvas present, dodge-roll key item equipped). Console shows only benign Vite connect noise and a 409 on auth registration retry — no uncaught game exceptions.

**Probe evidence (player A, in-run):** body text includes  
`Click to attack · press 1–6 to cast cards · E for key item` with `equippedKeyItemId: "dodge_roll"`. Screenshot `02-after-w.png` shows the same hint line on screen.

## Acceptance criteria

### 1. Gameplay hint includes use-key-item binding resolved from current settings

**PASS.** `getAttackCastHint(equippedKeyItemId)` in `game/client/input.js` calls `getUseKeyItemBinding()` when a key item is equipped:

- Keyboard/mouse mode appends `· {KEY} for key item` using the uppercase resolved keyboard key from settings (default `E`).
- Gamepad mode appends the resolved gamepad label (`DPad Down` on standard profile, profile-aware on 8BitDo 64).

`applyAttackHintText()` in `game/client/main.js` reads `gameState?.players?.[myId]?.equippedKeyItemId` and writes the result to `#attack-hint`.

### 2. Binding updates when rebound

**PASS.** `getUseKeyItemBinding()` reads live settings (`getKeyboardBindings()`, `getGamepadConfig()`). `onSettingsChange` → `renderHand()` → `applyAttackHintText()` refreshes the hint after keyboard or gamepad rebinding. Gamepad connect/disconnect handlers also call `applyAttackHintText()`.

Unit test `appends rebound keyboard binding when useKeyItem is remapped` asserts `Q for key item` after `patchSettings({ keyboard: { bindings: { useKeyItem: 'q' } } })`.

### 3. Shown only when a key item is equipped

**PASS.** The key-item fragment is gated on truthy `equippedKeyItemId`; without it the hint text is unchanged (`Click to attack · press 1–6 to cast cards`). Test `no key item fragment when equippedKeyItemId is falsy` covers this. Live capture only showed the fragment while `dodge_roll` was equipped.

### 4. Client test covers resolved-binding text

**PASS.** `game/client/test/attack-cast-hint.test.js` adds four focused cases: default `E`, rebound `Q`, standard gamepad `DPad Down`, and 8BitDo 64 label (no raw `Btn 13`). Full suite: **549/549 tests passed** (`coverage.log`).

## Design & integration

- **Scope:** Single sub-ticket; changes limited to `input.js`, `main.js`, and tests. No server or persistence changes — appropriate for a client HUD hint.
- **Consistency with `design.md`:** No combat-loop or progression regressions; improves discoverability of a core combat tool already documented in controls/settings.
- **Existing HUD:** The persistent key-item slot (`Dodge Roll` / `E`) was already present; this ticket correctly fills the gap in the center attack/cast hint line noted in the ticket goal.
- **Debug scenarios:** None added or modified — N/A.

## Code quality

- Reuses existing `getUseKeyItemBinding()` rather than duplicating resolution logic.
- `renderHand()` already refreshed attack/cast hint text for hand-slot binding changes; extending the same path for key-item state keeps behavior consistent.
- No dead code, no new console errors, no pageerrors in capture.

## Remaining gaps

None. All acceptance criteria are met; the captured run proves the game loads and displays the new hint correctly.

VERDICT: PASS

