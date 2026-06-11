# 348-anim-glacier-rupture

## Difficulty: medium

## Goal

Polish the Glacier Rupture (glacier_collapse, spell) card animation so its VISUAL clearly matches its NAME/theme and its TIMING is correct. Build on the merged animation foundation (315 shared VFX primitives + per-card registration) and the category pass (316-319). The cast/projectile/effect should read unmistakably as "Glacier Rupture" — thematically appropriate shape/model/color/element for a spell card. The animation TIMING must line up with the server-side effect: cast/wind-up, projectile travel speed, impact/hit sync, any DoT or lingering effect, and the 307 wind-up charge telegraph if this card has windUpMs. Use the 315 primitives; touch only this card's renderer + its registration to avoid conflicts with the other per-card animation beads. ACCEPTANCE: Glacier Rupture's animation visibly matches its name/theme and its timing is synced to the server effect resolution; no perf regression; client test where feasible. SCOPE: game/client/cardRenderers.js (this card's render fn + registration) + game/client (vfx) + game/client/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
