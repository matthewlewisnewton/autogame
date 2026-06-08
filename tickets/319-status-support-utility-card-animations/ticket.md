# 319-status-support-utility-card-animations

## Difficulty: medium

## Goal

Per-card STATUS/SUPPORT/UTILITY animations (polish). Distinct VFX using 315 primitives for: slow/cold application (ice_ball slow), burning (fire DoT flames on target), AoE heal+cleanse (purifying_pulse), enchantments/buffs (ground + self enchantment), telepipe portal, draw/charge-economy cards (deck_sifter, chrono_trigger, mana_prism). Status effects on entities (slowed shimmer, burning flames) should be clearly readable. DEPENDS ON 315. ACCEPTANCE: status application + support/utility cards have clear distinct VFX; slowed/burning entities visually readable; no perf regression; tests where feasible. SCOPE: game/client (cardRenderers.js + status VFX) + game/client/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
