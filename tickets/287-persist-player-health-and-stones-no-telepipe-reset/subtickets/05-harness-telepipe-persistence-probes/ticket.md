# Hub harness: telepipe-up redeploy preserves player state

Update the hub playthrough validation slice so it asserts the **new** persistence contract (MS + HP survive telepipe-up → hub → redeploy) instead of the old `telepipeUpReset` / abandon+fresh-deploy reset behavior from ticket 281.

## Acceptance Criteria

- `harness/validate/lib/telepipe.mjs` telepipe slice: deploy → deplete MS (and optionally damage HP) → telepipe UP to hub → **redeploy without abandon** → `postDeploy.magicStones` matches `preSuspend.magicStones` (within regen tolerance) and `postDeploy.runId === preSuspend.runId`.
- Remove or invert assertions that required `magicStones === STARTING_MAGIC_STONES` (49), full card-charge refill, and a **new** `runId` after redeploy.
- `game/validation/hub/run-summary.json` field `telepipeReset.telepipeUpReset` is renamed or redefined (e.g. `telepipePreservesPlayerState: true`) and `assertions` updated accordingly.
- `harness/validate/playthrough.mjs`, `harness/validate/lib/findingsHub.mjs`, and `harness/validate/verify-hub-artifacts.mjs` accept the new assertion name/semantics.
- `game/package.json` script `validate:hub:telepipe-reset` (if present) is renamed or updated to match persistence probes; full `validate:hub` still exits 0 when persistence holds.
- Running `node harness/validate/playthrough.mjs --preset hub --steps telepipe-reset --out game/validation/hub` exits 0 with persistence assertions true.

## Technical Specs

- **`harness/validate/lib/telepipe.mjs`** — replace `probesMatchFreshDeploy`, `probesMatchDepletion` success pairing, and `abandonSuspendedRun` step with redeploy-resume flow; assert same `runId` and preserved MS/HP.
- **`harness/validate/playthrough.mjs`** — wire new assertion keys into `run-summary.json` and exit code.
- **`harness/validate/lib/findingsHub.mjs`** — update findings table for persistence assertion.
- **`harness/validate/verify-hub-artifacts.mjs`** — update runId consistency checks (same id is now success, not failure).
- **`game/package.json`** — update validate script name/command if renamed.

## Verification: code
