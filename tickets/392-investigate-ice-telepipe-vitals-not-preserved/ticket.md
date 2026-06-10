# 392-investigate-ice-telepipe-vitals-not-preserved

## Difficulty: medium

## Goal

Found by the ICE playthrough (372): telepipeVitalsPreserved FAILED on the ice level, while it PASSED on the fire level (373) and earlier (287). Investigate why telepipe-up vitals (HP + magic stones) persistence regresses specifically on the ice level (ice-cavern profile / frost_crossing). Could be ice-level-specific state handling or a test-setup difference. Confirm whether vitals truly fail to persist on ice (real bug) vs a validation artifact, and fix if real; add/adjust a test. SCOPE: game/server (telepipe/vitals persistence + ice level) + test. Evidence: game/validation/ice/findings.md (telepipeVitalsPreserved FAIL) vs game/validation/fire/findings.md (PASS).

## Verification

reconcile: orphaned in_progress on dispatcher startup
