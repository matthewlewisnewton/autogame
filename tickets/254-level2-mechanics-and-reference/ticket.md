# 254-level2-mechanics-and-reference

## Difficulty: hard

## Goal

Foundation: per-tier variant-rate scaling (Tier-1 ~= 0 variant chance, Tier-2 high — rides applyVariant(enemy,tier,rng)) + a rigid/less-random layout-generation mode, implemented END-TO-END on open-plaza as the reference Tier-2. Establishes the one mechanism the per-level follow-ons reuse.

## Acceptance Criteria

- Tier-1 enemies almost never variants; Tier-2 frequently variants; Tier-2 layout is more deterministic; open-plaza Tier-2 fully playable. Tests for variant-rate-by-tier + rigid layout.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
