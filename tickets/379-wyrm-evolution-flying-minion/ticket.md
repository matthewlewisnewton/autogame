# 379-wyrm-evolution-flying-minion

## Difficulty: medium

## Goal

Make the WYRM EVOLUTION minion FLY. The Archive Wyrm (ancient_wyrm) evolution is a flying creature - make its summoned minion AIRBORNE using airborne support (376): hovers/flies above ground, moves in 3D, attacks from the air (height-aware, 375). Apply flying only to the evolved minion. DEPENDS ON 376 + 375. SCOPE: game/server (ancient_wyrm minion flying state + attack) + game/client + game/shared/card json if needed + test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
