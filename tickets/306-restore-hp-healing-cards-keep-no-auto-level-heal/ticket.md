# 306-restore-hp-healing-cards-keep-no-auto-level-heal

## Difficulty: medium

## Goal

287 OVER-APPLIED its design. Owner clarification: 287 was meant to replace AUTOMATIC start-of-level healing (auto-heal on deploy) with the med booth as the PRIMARY heal path — it was NOT meant to remove healing cards from the game. But sub-ticket 287/11 converted the healing cards (healing_font, divine_grace, soul_drain, Field Medic Kit) from HP restore to MAGIC-STONE restore. 

FIX: REVERT that conversion — healing_font / divine_grace / soul_drain / Field Medic Kit should restore HP again (as before 287). KEEP 287s removal of automatic start-of-level / on-deploy healing (durable health + the med booth are the primary intended heal path; players no longer auto-heal at level start). The 299 AoE heal+cleanse card (purifying_pulse) stays healing HP (already correct).

END STATE: HP is healed by the med booth + the healing cards (healing_font, divine_grace, soul_drain, Field Medic Kit, purifying_pulse); there is NO automatic free heal at level start; health persists between sorties (287). Also correct the 287 design note to say: "the med booth replaces AUTOMATIC start-of-level healing as the primary heal; healing cards remain in the game."

ACCEPTANCE: the listed healing cards restore HP again (server tests); no automatic heal at level start (health carries over per 287); med booth still heals; design note corrected. SCOPE: game/server/cardEffects.js + game/server (restore healPlayer on those cards) + game/client (card text/render) + game/*/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
