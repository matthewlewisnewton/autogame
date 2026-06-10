# 391-fix-glacial-thrower-slow-not-applied

## Difficulty: medium

## Goal

Found by the ICE playthrough (372). The ice enemy / glacial thrower (293) lobs ice balls but the SLOW status is NOT applied to the player on hit (validation: glacialThrowerSlowApplied FAIL). Slow is a movement effect (not damage) so god-mode does not mask it - this is a real bug. FIX so a glacial-thrower ice-ball hit applies the slow status (290) to the player; add a server test asserting slow is applied on hit. SCOPE: game/server/simulation.js (ice enemy projectile -> applySlow) + test. Evidence: game/validation/ice/findings.md. NOTE: 372 may be attempting an in-bead fix; reconcile if already fixed.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
