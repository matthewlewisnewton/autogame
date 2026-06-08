# Excalibur Photon wind-up gameplay and double-swing resolution

Verify that Excalibur Photon uses the merged 307 wind-up path end-to-end: commit on `useCard`, input lock during `windUpMs`, deferred resolution, and unchanged double-swing cone damage at **14 per swing**. No new server mechanics — only a debug scenario and focused integration tests patterned on `magma-windup-ready`.

## Acceptance Criteria

- A new debug scenario `excalibur-windup-ready` (registered in `DEBUG_SCENARIOS`) places the player in `playing` phase with `excalibur_photon` in hand and a grunt in melee cone range.
- On `useCard` for `excalibur_photon`, the player enters `cardUseState: 'windup'` with `pendingCardUse.cardId === 'excalibur_photon'` and **no** immediate `cardUsed` event or enemy damage.
- After `windUpMs` elapses and `processPendingCardWindups` runs, the enemy takes **28** total HP loss (`14 × swingsPerUse`) and a `cardUsed` / `CARD_USED` path fires.
- During wind-up (including after wall-clock `windUpMs` but before resolution), movement and a second `useCard` remain blocked (`isPlayerCardCommitted` true).
- `excalibur_photon.damage` is still **14** in all assertions; no cooldown or charge regression vs pre-ticket values.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/server/debugScenarios.js`**: add `excalibur-windup-ready` branch mirroring `magma-windup-ready` — swap hand slot to `excalibur_photon` (6 charges, `remainingCharges: 6`), spawn a grunt at `player.x + 2.5` with high HP for multi-hit observation.
- **`game/server/index.js`**: add `'excalibur-windup-ready'` to the `DEBUG_SCENARIOS` set.
- **`game/server/test/card_windup_resolution.test.js`** (preferred) or new `game/server/test/excalibur_photon_windup.test.js`: integration tests using `connectClient`, `debugScenario`, timer advance (`cardWindupStartTime = Date.now() - windUpMs - 50`), and `processPendingCardWindups` — assert double-swing damage total **28**, deferred `CARD_USED`, and per-swing damage **14**.
- **`game/server/test/card_windup_lock.test.js`** (optional second file): one test that `excalibur-windup-ready` blocks movement/`useCard` until resolution, following the magma pattern.
- Do **not** change `game/shared/cardStats.json` (sub-ticket 01 owns the stat) unless `windUpMs` is still missing — in that case add it per 01 before testing.
- Do **not** modify `cardEffects.js` wind-up branching unless a test proves `excalibur_photon` bypasses `tryBeginCardWindup` (unexpected; fix only if required).

## Verification: code
