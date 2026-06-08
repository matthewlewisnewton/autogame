# Probe slow/burn mutual exclusivity (301) and heal/cleanse card (299)

Extend the spire-ascent validation driver to grant and play a slow card
(`cinder_snare`), a burn card (a `burning` fireball-type card), and a
heal/cleanse card (`purifying_pulse` / `heal_and_cleanse`) during the spire run,
then probe that slow and burn each apply, that they are mutually exclusive, and
that heal/cleanse restores HP and clears the active status. Driver + read-only
instrumentation only.

## Acceptance Criteria

- A probe grants the slow card and applies it to a live enemy (boss or add) and
  records that `slowedUntil` is in the future and `burningUntil` is cleared.
- The probe then applies the burn card to the same enemy and records that
  `burningUntil` is in the future and `slowedUntil` is cleared — demonstrating
  the two statuses are MUTUALLY EXCLUSIVE (per ticket 301). The probe asserts
  this exclusivity and fails the run if both are simultaneously active.
- A `statusCards` section in `run-summary.json` captures the before/after
  `slowedUntil`/`burningUntil`/`slowFactor` and the enemy id used.
- A probe grants and plays the heal/cleanse card on a status-afflicted, damaged
  target (player or ally) and records HP increasing AND the active status
  (`slowedUntil`/`burningUntil`) being cleared to 0; a `healCleanse` section
  captures pre/post HP and status.
- A screenshot `05b-status-cards.png` is captured during this phase and listed
  in `run-summary.json`.
- Probes are gated behind preset flags; other presets unaffected.

## Technical Specs

- `harness/validate/presets/spire-ascent.mjs` — add flags (e.g.
  `probeStatusCards: true`, naming the slow/burn/heal card-grant scenarios).
- `harness/validate/lib/statusCardsProbe.mjs` (new) — export probes that use the
  driver's `requestScenario` (or import the helper) to grant the cards, play the
  relevant hand slot, poll `readHarness` for the target enemy/player status, and
  assert the criteria. Reuse existing card-grant debug scenarios where they
  inject into the live run (`cinder-snare-ready`, a fireball/burn scenario,
  `purifying-pulse-ready`).
- `game/client/main.js` `__AUTOGAME_HARNESS_STATE__()` — expose read-only
  `slowedUntil`, `burningUntil`, `slowFactor` on `enemyHp` entries (and on the
  `player` object) so the probe can observe status state. Additive instrumentation
  only — `applySlow`/`applyBurn`/`clearStatuses` logic in
  `game/server/simulation.js` is NOT changed.
- `game/server/debugScenarios.js` — ONLY if no existing scenario can grant the
  needed card into a live `spire_ascent` Tier-2 run without resetting it, add a
  minimal additive `spire-ascent-status-cards` scenario that injects the
  slow/burn/heal cards into the current run's hand (mirror the existing
  `cinder-snare-ready`/`purifying-pulse-ready` hand-injection pattern).
- `harness/validate/playthrough.mjs` — call the probe in the spire combat phase
  (while adds/boss are alive) when the preset flag is set; fold results +
  screenshot into `run-summary.json`.

## Verification: code
