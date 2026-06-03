# Tune fallback capture so post-dodge probe sees active cooldown

After dodge-roll cooldown was reverted to 800 ms, the fallback recipe still waits ~900 ms before probing (`useKeyItem`’s 400 ms settle + a 500 ms `wait`), so `keyItemCooldownRemaining` and `#key-item-indicator.cooldown` are already cleared. Shorten the post-dodge delay so the harness probe and screenshot run while the 800 ms cooldown is still active.

## Acceptance Criteria

- In `harness/screenshot.mjs` `fallbackRecipe()`, the elapsed time from the end of the `useKeyItem` step until the post-dodge `probe` step is **less than 800 ms** (e.g. remove the extra `wait`, or reduce it to ~100–200 ms, so total settle + gap stays well under the server cooldown).
- A fallback capture run (`CAPTURE_PLAN_AGENT=fallback`) produces `metrics.json` where the probe with description “After dodge roll — cooldown HUD should be active.” reports **either** `keyItemCooldownRemaining > 0` **or** `keyItemIndicatorOnCooldown: true` (non-empty cooldown text on the indicator is acceptable secondary evidence).
- Auth, lobby, ready, and movement steps in `fallbackRecipe()` are unchanged; only timing/steps between `useKeyItem` and the post-dodge `probe`/`screenshot` may change.
- No changes under `game/` (server cooldown stays 800 ms per subticket 04).

## Technical Specs

- **File**: `harness/screenshot.mjs`
  - **`fallbackRecipe()`** — locate the block after movement screenshots: `useKeyItem` → `wait` (500 ms) → `probe` → `04-after-dodge` screenshot.
  - **Timing fix (pick one approach, prefer minimal diff):**
    - **Option A:** Delete the `{ action: 'wait', player: 'A', ms: 500 }` step and rely on `useKeyItem`’s built-in `waitForTimeout(step.ms ?? 400)` (~400 ms after key press) before the probe (~400 ms < 800 ms cooldown).
    - **Option B:** Keep a short `wait` (100–200 ms) after `useKeyItem` if an extra frame is needed for HUD paint; ensure `400 + waitMs < 700` so client/server sync still leaves remaining cooldown > 0.
  - Optionally pass `{ action: 'useKeyItem', player: 'A', ms: 300 }` only if 400 ms settle still misses HUD sync; do not increase total pre-probe delay above ~600 ms.
  - Update the fallback `summary` string if it still implies only movement/slope capture and should mention dodge cooldown assertion.
- **Do not modify**: `game/server/progression.js`, `game/server/index.js`, `game/client/main.js`, or docs — cooldown is already 800 ms and harness state/DOM probes already exist from prior subtickets.
- **Reference**: round-2 `metrics.json` post-dodge probe showed `keyItemCooldownRemaining: 0` and `keyItemIndicatorOnCooldown: false` because probe ran ~900 ms after dodge; round-1 passed the same probe only while cooldown was temporarily 1200 ms.

## Verification: code
