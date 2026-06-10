# 390-fix-slippery-floor-no-momentum

## Difficulty: medium

## Goal

Found by the ICE playthrough (372). The slippery/ice floor physics (292) is NON-FUNCTIONAL: releasing movement input on ice produces ZERO momentum (validation: momentumAfterRelease FAIL, ice=0.000 normal=0.000), i.e. the player stops instantly on ice exactly like a normal floor. directionChangeWhileSliding and surfaceTransition also FAIL. The slippery-floor low-friction/momentum behavior the ice level was built for does not actually happen at runtime. FIX so ice floor carries momentum after input release (slide/decelerate slowly), with direction-change-while-sliding and normal<->ice transitions working; add a server test asserting non-zero momentum on ice vs zero on normal floor. SCOPE: game/server/simulation.js (movement/floor physics) + test. Evidence: game/validation/ice/findings.md (Slippery floor section). NOTE: the 372 ice playthrough may be attempting an in-bead fix; reconcile if already fixed.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
