# 221-data-debrittle-model-tests

## Difficulty: easy

## Goal

Two test-churn generators that break on every new variant/card (the merge-conflict source we keep hitting). (a) variant selection is RNG-scaled array index (game/server/enemyVariants.js:98-100) and warded_variant.test.js:41-42 hard-codes 'index 2 of 5' (seqRng([0.01,0.5])->warded) — inserting any variant re-maps it. (b) new_card_pack.test.js:72 asserts Object.keys(CARD_DEFS).toHaveLength(42) — any new card fails it for no behavioral reason.

## Acceptance Criteria

- 1. Give applyVariant a pickVariant(rng,ids) seam OR have tests stub the selector / pass an explicit variant id, and assert membership+effect rather than the RNG->index mapping. 2. Make adding a variant data-only (never re-indexes existing). 3. Drop the global CARD_DEFS length assertion (or >= with a comment); split the per-card identity checks out of the 567-line combat-helper test so a new card touches one small file. 4. Suite green.

## Verification

CORRECTNESS-adjacent (kills test/merge churn). Easy. Low risk. This is the variant-robustness item we had on the radar — confirmed + generalized to new_card_pack.test.js.
