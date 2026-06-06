# 299-aoe-heal-and-cleanse-card

## Difficulty: medium

## Goal

New SUPPORT CARD: restores a SMALL amount of health to ALL allies/players within a RADIUS of the cast point AND clears (cleanses) negative status effects on them — slow (290), burning (291), and existing negative statuses (e.g. frozen). Model on the existing heal cards healing_font / divine_grace in cardEffects.js; add a radius heal + a cleanse step. card*.json entries + client AoE/cleanse VFX. DEPENDS ON 290 (slow) + 291 (burning) so it can clear both.

ACCEPTANCE: casting heals every player in radius for a small amount AND removes their slow/burning (and other negative statuses); client shows an AoE heal + cleanse effect; server tests for radius heal + status clear. SCOPE: game/server/cardEffects.js + game/shared/card*.json + game/client + game/*/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
