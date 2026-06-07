# Revert excalibur_photon incidental damage buff

Sub-ticket 04 raised `excalibur_photon` damage from 14 to 18 only to preserve a +50% evolution ratio after buffing `saber_of_light`. The balance report classifies `excalibur_photon` as `over` / `operator-triage`, so this incidental buff must be undone. Revert the stat, relax the ratio-locking test, and correct the `## Applied tunings` notes so operator-triage items stay unchanged.

## Acceptance Criteria

- `game/shared/cardStats.json` sets `excalibur_photon.damage` back to **14** (not 18).
- `saber_of_light` remains at `damage: 12` (the intended `apply-now` tuning is untouched).
- `game/server/test/card_evolution.test.js` and `game/server/test/new_card_pack.test.js` no longer require `excalibur_photon.damage === Math.round(saber_of_light.damage * 1.5)`; they assert the live reverted value (14) and still verify evolution identity, charges, cooldown, and `swingsPerUse: 2`.
- `game/validation/card-balance/report.md` `## Applied tunings` removes the excalibur bump from the `saber_of_light` row and adds an explicit note that `excalibur_photon` was **not** tuned (reverted incidental change; remains `operator-triage`).
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/shared/cardStats.json`**: change `excalibur_photon.damage` from `18` to `14`.
- **`game/server/test/card_evolution.test.js`**: update `toMatchObject({ damage: … })` on `CARD_DEFS.excalibur_photon` to expect `14`.
- **`game/server/test/new_card_pack.test.js`**: replace the "+50% damage" ratio assertion with checks that `excalibur_photon.damage` is `14`, exceeds `saber_of_light.damage`, and that double-swing cone damage still uses the reverted per-swing value.
- **`game/validation/card-balance/report.md`**: edit only `## Applied tunings` (and a one-line cross-reference in `## Recommendations` if the saber row still mentions excalibur); do **not** regenerate full per-card tables here — that is sub-ticket 06.
- Do **not** change `game/server/cardEffects.js`, `game/server/simulation.js`, or client render code.

## Verification: code
