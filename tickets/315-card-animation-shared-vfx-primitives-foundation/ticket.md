# 315-card-animation-shared-vfx-primitives-foundation

## Difficulty: medium

## Goal

Foundation for a card-animation POLISH pass. The client already has a per-card renderer registry in game/client/cardRenderers.js (resolveRenderers / renderCardUsed) with a ctx of helpers (spawnLightningArc, hit flashes, shockwave, scheduleAfter) and per-effect render fns. Add RICHER SHARED VFX PRIMITIVES to the ctx/helpers so the per-category passes (316-319) can compose better animations:
- particle burst / spark emitter, projectile TRAIL, lingering impact decal/flash, telegraph ring.
- a CHARGE-UP / WIND-UP telegraph animation primitive (a growing glow/charge that plays during a cards windUpMs lockout from 307) so heavy wind-up cards (Solar Edge, Corebreaker, Excalibur) read as charging a big hit.
- consistent accent-color theming per card (getAccentHex already exists) applied through the new primitives.
Upgrade 2-3 exemplar cards to use the new primitives as a reference. Keep it performant (reuse pools; no per-frame allocation spikes).
ACCEPTANCE: new shared primitives available + documented in cardRenderers; 2-3 exemplar cards visibly improved; a wind-up charge telegraph plays for windUpMs cards; client tests where feasible; no perf regression. SCOPE: game/client/cardRenderers.js + game/client (vfx helpers/main.js) + game/client/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
