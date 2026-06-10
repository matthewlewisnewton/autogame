# 377-lock-on-and-aim-across-heights

## Difficulty: medium

## Goal

Make LOCK-ON + aiming work across HEIGHTS. lockOn.js / applyLockOnPress / lock-on-info-panel + the aim reticle must select and track entities at different ALTITUDES (flying enemies) and feed target height to the height-aware projectile aiming. Camera/reticle correct for elevated targets. DEPENDS ON 375 + 376. SCOPE: game/client (lockOn, reticle, camera) + game/server (target resolution) + test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
