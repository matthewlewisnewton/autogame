# gameplay/telepipe-new-sortie: depleteRunResources fails — post-victory hand has only telepipe + empty slots

## Difficulty: medium

## Goal

PRESETS: sunken-canyon (canyon_descent Tier-2 stage_boss) and spire-ascent (Tier-2 stage_boss). Real infra, PostgresProvider confirmed in server.log.

REPRO (FLAKY/non-deterministic): `node ../harness/validate/playthrough.mjs --preset sunken-canyon --steps full` and `--preset spire-ascent --steps full`. spire-ascent PASSED run #1 but FAILED run #2 at this same step; sunken-canyon failed 1/1. So it is intermittent and depends on remaining card charges entering the telepipe-new-sortie depletion phase.

FAILURE: harness/validate/lib/telepipe.mjs:264 throws 'No usable card to deplete resources' because the player's hand at the depletion step is [telepipe, null, null, null, null, null] — every combat card already consumed, leaving only the non-attack Telepipe spell. depleteRunResources()/chooseDepletionAttack() then finds no usable attack to burn down magic-stones/charges and aborts.

EXPECTED: the depletion phase should always have at least one usable attack card available (or the hand should refill), so the telepipe new-sortie validation can deplete resources deterministically.

ACTUAL: hand can be exhausted down to only telepipe before depletion runs, hard-failing the step and blocking Tier-2 stage_boss end-to-end validation.

EVIDENCE: harness/tmp/e2e-boss-sunken/run-summary.json and e2e-boss-spire2/run-summary.json — both: error='No usable card to deplete resources: [{telepipe...},null,null,null,null,null]'. NOTE: spire-ascent run #1 (harness/tmp/e2e-boss-spire/) passed full end-to-end (rc=0, reached 12-telepipe-after.png), confirming flakiness, not a hard regression.

Could be harness-probe-side (telepipe.mjs depletion logic should refill/guard) or game-side (hand not replenished). Likely the former; flag for triage.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
