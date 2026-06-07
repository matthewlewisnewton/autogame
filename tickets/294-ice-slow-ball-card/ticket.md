# 294-ice-slow-ball-card

## Difficulty: medium

## Goal

New ICE CARD: shoots a slow-moving ICE BALL projectile that, on hitting an enemy, has a CHANCE to apply the SLOW status (290) to that enemy (same slow mechanic as the ice enemy) plus modest damage. Register as a new cardDef + effect in game/server/cardEffects.js (model on the existing projectile effects + frost_nova/glacier_collapse), with cardDefs.json / cardStats.json / cardEconomy.json entries and client projectile render. DEPENDS ON 290 (slow).

ACCEPTANCE: card is obtainable + castable; fires an ice-ball projectile; on enemy hit, a chance roll applies slow (calls applySlow) + damage; client renders the projectile + slow indicator; server tests for the cast, projectile, and chance-to-slow. SCOPE: game/server/cardEffects.js + game/shared/card*.json + game/client (render) + game/*/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
