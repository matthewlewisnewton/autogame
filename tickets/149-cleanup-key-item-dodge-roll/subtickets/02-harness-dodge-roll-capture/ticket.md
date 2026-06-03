# Add dodge-roll action to harness fallback capture

Round-1 fallback capture (`CAPTURE_PLAN_AGENT=fallback`) never presses the key-item binding (E / D-pad Down), so dodge VFX, i-frame shimmer, and cooldown HUD are never exercised in screenshots or probes. Extend the harness capture recipe so gameplay fallback includes at least one dodge/useKeyItem step with a verifiable cooldown signal.

## Acceptance Criteria

- `harness/screenshot.mjs` defines a allowlisted `useKeyItem` action that presses the default key-item key (`e`) on a connected player page during `playing` phase.
- `fallbackRecipe()` appends post-gameplay steps: `useKeyItem` → short `wait` → `probe` (and optionally `screenshot`) that capture dodge cooldown state.
- After a successful fallback capture run, `metrics.json` `probes[]` (or final probe) shows either `keyItemCooldownRemaining > 0` from harness state **or** `keyItemIndicatorOnCooldown: true` from DOM inspection.
- `harness/prompts/capture-plan.md` documents the new `useKeyItem` action for LLM-generated plans.
- Non-dodge tickets still pass generic fallback capture (auth, lobby, movement steps unchanged).

## Technical Specs

- **File**: `harness/screenshot.mjs`
  - Add `'useKeyItem'` to the `ACTIONS` set.
  - Implement in `executeRecipe`: `page.keyboard.press('e')` (or `step.key || 'e'`), then `waitForTimeout` (~300–500 ms) so server round-trip and HUD update can settle.
  - Extend `collectProbe()` to report dodge HUD metrics, e.g.:
    - `keyItemIndicatorOnCooldown`: `#key-item-indicator` has class `cooldown`
    - `keyItemIndicatorText`: indicator text content
    - Optionally read `harnessState.player.keyItemCooldownRemaining` if exposed (see below).
  - Extend `fallbackRecipe()` `baseSteps` after `waitForGame` / initial `probe` (before or after movement screenshots): insert `{ action: 'useKeyItem', player: 'A' }`, `{ action: 'wait', player: 'A', ms: 500 }`, `{ action: 'probe', player: 'A', description: 'After dodge roll — cooldown HUD should be active.' }`, and `{ action: 'screenshot', player: 'A', name: '04-after-dodge', description: 'Gameplay after dodge roll with cooldown HUD.' }`.
  - Update fallback `summary` string to mention dodge/key-item exercise.
- **File**: `harness/prompts/capture-plan.md` — add `useKeyItem` to the allowlisted actions list with fields `{ player, key? }`.
- **Optional (game/)**: `game/client/main.js` — extend `window.__AUTOGAME_HARNESS_STATE__()` `player` object with `keyItemCooldownRemaining` and `equippedKeyItemId` so probes can assert server-synced cooldown without relying solely on DOM. Skip if DOM probe fields suffice.
- **No server changes required** — dodge_roll is already implemented; capture only triggers existing client input → `useKeyItem` socket flow.

## Verification: code
