# Wind-up charge telegraph primitive

Replace the current static wind-up indicator (a fixed emissive flash + fixed
ground ring) with a growing CHARGE-UP telegraph that animates over the card's
`windUpMs` lockout window, so heavy wind-up cards (Solar Edge / `flame_blade`,
Corebreaker / `magma_greatsword`, Excalibur / `excalibur_photon`) visibly
"charge a big hit". The charge grows toward the wind-up end time and is tinted
with the casting card's accent color.

## Acceptance Criteria
- While a player is in `cardUseState === 'windup'`, a growing charge telegraph
  is shown beneath/around that player: it animates from a small/dim state to a
  large/bright state as time progresses from the wind-up start toward
  `cardWindupUntil` (a normalized `0→1` charge ratio drives scale and/or
  emissive intensity).
- The charge progress is derived from the broadcast snapshot fields
  `cardWindupUntil` and the wind-up duration (not hard-coded), so the animation
  completes exactly when the lockout ends regardless of the card's `windUpMs`.
- The charge telegraph is tinted using the casting card's accent color via
  `cardWindupCardId` + `getAccentHex` (with a sensible default when the card
  has no accent), so different wind-up cards read with different charge colors.
- When the player leaves the wind-up state (state clears or player leaves), the
  charge telegraph mesh and any emissive override are torn down — no leaked
  meshes and no stuck emissive (extend the existing
  `playerCardWindupMarkers` / `playerCardWindupFlashing` cleanup).
- The animation updates in the existing per-frame player update path and
  allocates no new meshes/materials per frame (mesh created once on entry,
  reused while charging).
- Vitest unit tests assert: the charge ratio is computed correctly from
  `cardWindupUntil` + duration at representative elapsed times (e.g. ~0%, ~50%,
  ~100%), the accent color is applied from `cardWindupCardId`, and the
  telegraph is removed when the wind-up state ends.

## Technical Specs
- `game/client/renderer.js`:
  - Extend `applyPlayerCardWindupIndicator` (~line 3729) and
    `applyPlayerCardWindupFlash` (~line 3711) / `createPlayerCardWindupTelegraph`
    (~line 3700) so the marker scales/brightens by a charge ratio each frame
    instead of being set once. Pull `player.cardWindupUntil` and
    `player.cardWindupCardId` from the player snapshot (already provided by the
    server in `progression.js`) to compute the ratio and accent color.
  - Factor the charge-ratio math into a small exported pure helper (e.g.
    `computeWindupChargeRatio(now, windupUntil, windUpMs)`) so it is unit
    testable without a scene.
  - Use `getAccentHex` from `cards.js` (or mirror the existing accent lookup)
    for the tint; keep a default color (e.g. the current `0x38bdf8`) fallback.
- The per-frame caller is `applyPlayerCardWindupIndicator` invoked from the
  players update loop (~line 5112); ensure it passes `now`/ratio through.
- `game/client/test/`: add `windup-charge.test.js` (or extend an existing
  renderer test) covering the charge-ratio helper, accent tint selection, and
  teardown on state exit.

## Verification: code
