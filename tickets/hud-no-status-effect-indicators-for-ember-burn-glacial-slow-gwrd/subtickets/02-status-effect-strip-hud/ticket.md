# Status-effect strip on the HUD (burning / slowed)

Render a small status-effect strip near the HP/MS bars that shows active effects (Burning, Slowed) with their remaining duration, driven by `computeActiveStatusEffects` from sub-ticket 01. The strip appears while `player.burningUntil` or a glacial slow is active and clears when the effect expires.

## Acceptance Criteria

- A `#status-effect-strip` container exists in the HUD markup, positioned with the HP/MS bars (inside `#vanguard-hud` / `#vanguard-bars`).
- While the local player is burning (`burningUntil` in the future) a "Burning" badge appears in the strip with a remaining-duration readout; while glacially slowed (`slowedUntil` in the future) a "Slowed" badge appears. Both show together when both are active.
- Each badge clears from the strip when its effect expires; the strip is empty (and visually unobtrusive/hidden) when no effects are active.
- Burning and Slowed badges are visually distinguishable (e.g. fire/ember styling vs. ice/chill styling).
- The strip updates on each state update from the snapshot fields already broadcast (`burningUntil`, `slowedUntil`); no server changes are required.

## Technical Specs

- `game/client/index.html`: add `<div id="status-effect-strip" aria-live="polite"></div>` within `#vanguard-hud` (near `#vanguard-bars`, e.g. just after it) so it sits beside the HP/MS bars.
- `game/client/main.js`: import `computeActiveStatusEffects` from `./vanguard-hud.js` (alongside the existing `getHpBarTier`/`getMsBarTier` imports). Cache the `#status-effect-strip` element. Add an `updateStatusEffectStrip(me)` function that calls `computeActiveStatusEffects(me, Date.now())`, then rebuilds the strip's badge DOM (one element per active effect with its label + remaining seconds, plus a per-effect CSS class such as `status-badge--burning` / `status-badge--slowed`), and clears/hides the strip when the array is empty. Call it from `syncVanguardHud` for the local player during the `playing` phase (next to `updateMsBar`/`updateDeckStats`).
- `game/client/style.css`: style `#status-effect-strip` and `.status-badge` (layout near the bars, hidden/empty state) with distinct ember vs. chill treatments for `.status-badge--burning` and `.status-badge--slowed`.
- Reuse the helper and snapshot fields from sub-ticket 01; do not duplicate the effect-derivation logic in `main.js`.

## Verification: code
