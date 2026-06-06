# 05 — Integration tests: telepipe-up preserves vitals; med booth heals

Add and update automated tests that prove the full owner decision: partial `hp` and `magicStones` survive telepipe-up → hub → redeploy, and the med booth is the path to full health.

## Acceptance Criteria

- New or updated integration test: player deploys, takes damage and spends magic stones, telepipes up to hub, readies, redeploys → `hp` and `magicStones` match pre-telepipe values (within passive regen tolerance for MS only).
- Redeploy after telepipe-up produces a **new** `run.id` (fresh dungeon) — vitals persist even though the run does not.
- Integration test or unit test: partial-HP player in hub lobby uses `MEDIC_HEAL` → `hp === MAX_HP`.
- Tests that required checkpoint dungeon restoration (`suspendedCheckpoint.telepipe`, objective progress resume, card-charge checkpoint round-trip) are removed or rewritten to assert **vitals-only** persistence (card charges out of scope per parent ticket).
- `pnpm test:quick` (or targeted server test files) passes for the changed tests.

## Technical Specs

- **`game/server/test/integration.test.js`** — Replace `two-player suspend then resume preserves magic stones, card charges, and objective progress` (and similar checkpoint tests) with telepipe-up → hub → redeploy vitals test; keep/adjust portal extraction smoke if still valid.
- **`game/server/test/server.test.js`** — Update `fresh deploy after telepipe suspend and abandon resets magicStones` to expect **preserved** MS instead of `STARTING_MAGIC_STONES`; remove checkpoint restore expectations from telepipe describe blocks.
- **`game/validation/hub/`** — Not required in this ticket; harness validation will pick up fixes on merge.

## Verification: code
