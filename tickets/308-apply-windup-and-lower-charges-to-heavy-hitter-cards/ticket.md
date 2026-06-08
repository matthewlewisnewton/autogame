# 308-apply-windup-and-lower-charges-to-heavy-hitter-cards

## Difficulty: medium

## Goal

Apply the new card WIND-UP mechanic (307) + reduce charges to the hardest-hitting cards so they feel like big committed power hits (per owner direction). 

DO:
1. Give Solar Edge (flame_blade) and Corebreaker Greatsword (magma_greatsword) — and any other thematically-appropriate heaviest-hitting cards from the 303 balance report (game/validation/card-balance/report.md) — a WIND-UP window (windUpMs) sized to their power: bigger hit = longer commitment/lockout. These were flagged as power-spike outliers; the wind-up balances them WITHOUT gutting their damage.
2. LOWER the number of uses (charges) on these super-hard-hitting cards (owner: "for the super hard hitting cards, consider lowering the number of uses").
3. Update each cards description/render to convey the heavy wind-up.

NOTE: fast multi-swing weapons like Excalibur Photon are NOT wind-up candidates (not thematically a single big hit) — leave those for separate charge/cooldown tuning. Use the 303 report to pick the right big-hit cards.

ACCEPTANCE: the chosen heavy hitters have a wind-up lockout (committed animation) + reduced charges; they still hit hard but commit the player; tests for the wind-up + charge values; card text reflects it. DEPENDS ON 307. SCOPE: game/shared/card*.json (windUpMs + charges), game/server/cardEffects (if needed), game/client (anim/text), game/*/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
