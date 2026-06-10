# 378-introduce-few-flying-enemies

## Difficulty: medium

## Goal

Introduce a FEW FLYING ENEMIES, used SPARINGLY (small number of fliers overall). Add 2-3 flying enemy types using airborne support (376): hover at altitude, move in 3D, attack across heights via spherical AoE (374) + height-aware projectiles (375). Give display metadata + lock-on panel entries (251/252) and RARE/sparse spawn weights in thematically appropriate levels. DEPENDS ON 374 + 375 + 376. SCOPE: game/server/simulation.js (enemy types + flying AI) + game/server (spawn weights + metadata) + game/client + test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
