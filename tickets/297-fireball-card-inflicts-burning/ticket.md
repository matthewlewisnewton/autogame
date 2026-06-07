# 297-fireball-card-inflicts-burning

## Difficulty: medium

## Goal

New FIRE CARD: shoots a FIREBALL projectile that, on hitting an enemy, inflicts the BURNING status (291) on that enemy (per-tick + extra fire damage) plus impact damage. New cardDef + effect in cardEffects.js (model on projectile effects), with card*.json entries and a fireball client render. DEPENDS ON 291 (burning).

ACCEPTANCE: card obtainable + castable; fires a fireball; on enemy hit, applies burning (calls applyBurning) + impact damage; client renders fireball + burning on the enemy; server tests for cast + burning-on-hit. SCOPE: game/server/cardEffects.js + game/shared/card*.json + game/client + game/*/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
