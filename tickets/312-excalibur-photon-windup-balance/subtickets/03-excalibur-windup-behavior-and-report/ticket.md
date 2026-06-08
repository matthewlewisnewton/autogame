# Excalibur Photon wind-up behavior tests and balance report

Prove the tuned `excalibur_photon` uses the 307 commitment pipeline correctly (deferred resolution, input lock, unchanged per-hit burst) and reconcile the balance report so the card is no longer flagged as an unaddressed DPM outlier.

## Acceptance Criteria

- A server integration test (extend `game/server/test/card_windup_resolution.test.js` or add `game/server/test/excalibur_photon_windup.test.js`) shows that `useCard` with `excalibur_photon`:
  - commits wind-up (`cardUseState === 'windup'`, `pendingCardUse` set) and deals **no** damage before `windUpMs` elapses;
  - after wind-up resolves, applies **two** cone hits at **14** damage each (total 28 off a full-HP grunt), matching pre-tune per-hit feel;
  - clears commitment fields after resolution.
- Existing instant-card regression (`iron_sword` in `card_windup_resolution.test.js` or `card_windup_regression.test.js`) still passes unchanged.
- `game/validation/card-balance/report.md` updates `## Applied tunings` with the `excalibur_photon` `windUpMs` change (before → after, effective DPM note) and marks the card **done** / no longer `operator-triage` for raw cooldown-only DPM dominance in recommendations cross-references.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/server/test/card_windup_resolution.test.js`** (preferred) or **`game/server/test/excalibur_photon_windup.test.js`**: set up a playing-phase scenario with `excalibur_photon` in hand and a cone-range grunt (mirror `magma_greatsword` wind-up test patterns: `processPendingCardWindups`, pin/advance `cardWindupStartTime`, assert HP deltas). Use `collectConeHits` / live `useCard` path — do not mock damage away from 14.
- Optional: add a `debugScenarios.js` entry (e.g. `excalibur-windup-ready`) only if hand setup is awkward inline; not required if tests seed `player.hand` directly.
- **`game/validation/card-balance/report.md`**: edit `## Applied tunings`, the weapons outlier table row for `excalibur_photon`, and the `operator-triage` backlog bullets — document wind-up-based DPM correction; do **not** change `damage`, `cooldownMs`, or `swingsPerUse` in JSON here (owned by sub-ticket 02).
- Do **not** change client render code; 307 client wind-up UX is already generic for `windUpMs` cards.

## Verification: code
