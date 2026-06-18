# playability/ux: hub deck HUD always shows 'Deck: 0/0' (never updates in lobby), implying player has no deck and cannot deploy

## Difficulty: easy

## Goal

REPRO: register a fresh account -> login -> Open Channel (create lobby) -> land in the 3D hub. The top-left HUD permanently reads 'Deck: 0/0' even though the account has a valid 8-card starter deck and deploy works.

ROOT CAUSE: in game/client/main.js, updateDeckStats(me.deck, me.hand, me.inventory) is only called when gamePhase==='playing' (syncVanguardHud at ~line 2191-2193; updateDeckStats at line 2270). In the 'lobby' phase the deck-count element (#deck-count) is never refreshed, so it keeps its initial markup value 'Deck: 0/0'. Once a level loads the same HUD correctly shows e.g. 'Deck: 8/12'.

IMPACT: A new player standing in the hub sees 'Deck: 0/0' and reasonably concludes they have no cards / cannot deploy. This is misleading and contributes to the 'I can't figure out how to play' friction. The deck IS valid and Launch Bay ready-up succeeds, but the HUD actively tells the player otherwise.

EXPECTED: hub HUD should reflect the player's actual selectedDeck size (and weapon/spell/creature breakdown) while in the lobby. ACTUAL: stuck at 0/0 until in-level.

Verified via Playwright (chromium headless, vs http://localhost:5320). Screenshots: harness/tmp/playqa3/30-hub.png (hub deck unknown), 50-deployed.png (in-level shows Deck: 6/12).

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
