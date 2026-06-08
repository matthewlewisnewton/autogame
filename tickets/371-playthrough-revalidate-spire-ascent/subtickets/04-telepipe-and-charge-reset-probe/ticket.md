# Probe telepipe-up vitals persistence (287) and card-charge reset on new sortie (289)

Extend the spire-ascent validation driver with two lifecycle probes: returning to
the hub via Telepipe preserves the player's vitals (HP/magic stones — ticket 287),
and starting a NEW sortie resets card charges to full (ticket 289). Driver +
read-only instrumentation only.

## Acceptance Criteria

- A `telepipePersistence` section in `run-summary.json` captures the player's
  vitals (HP, magic stones) and remaining card charges immediately before a
  Telepipe-up, and again after the player is back in the hub, and asserts the
  vitals are preserved within tolerance (re-using the existing telepipe vitals
  comparison helper). The probe fails the run if vitals are reset/lost across the
  Telepipe-up.
- A `cardChargeReset` section captures each hand card's `remainingCharges`/
  `charges` at the end of one sortie (after cards were spent) and again after a
  fresh sortie is started, and asserts that on the new sortie every granted
  card's `remainingCharges` equals its `charges` (full reset per ticket 289).
- Screenshots `08-telepipe-hub.png` (back in hub with vitals) and
  `09-new-sortie-charges.png` (fresh sortie hand) are captured and listed in
  `run-summary.json`.
- Probes are gated behind preset flags; other presets unaffected.

## Technical Specs

- `harness/validate/presets/spire-ascent.mjs` — add flags (e.g.
  `probeTelepipePersistence: true`, `probeCardChargeReset: true`).
- `harness/validate/lib/lifecycleProbe.mjs` (new) — export the two probes.
  Reuse existing telepipe helpers in `harness/validate/lib/telepipe.mjs`
  (`suspendViaTelepipe`, `probeHandAndMs`, `probesMatchVitalsPreserved`,
  `deployViaLaunchBooth`) for the telepipe-up + vitals comparison and for
  re-deploying a fresh sortie; read card charges via `readHarness().hand`.
- `harness/validate/playthrough.mjs` — call these probes after the main spire
  combat phase (telepipe-up before victory, or as a dedicated post-victory
  re-deploy) when the flags are set; fold results + screenshots into
  `run-summary.json`.
- No gameplay changes: vitals persistence and charge-reset logic in
  `game/server/` are observed, not modified. If a fresh-sortie deploy needs a
  card-granting scenario already present (e.g. a spire deploy scenario), reuse it.

## Verification: code
