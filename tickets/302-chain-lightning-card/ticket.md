# 302-chain-lightning-card

## Difficulty: medium

## Goal

New CHAIN LIGHTNING card: strikes a primary enemy for FULL damage, then the bolt CHAINS to the nearest not-yet-hit enemy for HALF damage, then chains a second time for half again — 1 full hit + 2 half-damage chains (up to 3 enemies). Chains pick nearest un-hit enemy in range; hits as many as available if fewer. New cardDef + effect in game/server/cardEffects.js (model existing projectile/targeting effects), card*.json entries, client lightning-arc render. ACCEPTANCE: primary full + up to two further distinct enemies at half each; never same enemy twice; client arcs; server tests for target selection + full/half/half + <3-enemies case. SCOPE: game/server/cardEffects.js + game/shared/card*.json + game/client + game/*/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
