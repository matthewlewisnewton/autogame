1. Field Medic energy beads damage the firing medic, and can damage allied enemies, because `collectPhaseBeamHits` checks enemies starting at the ray origin.
   Files: game/server/simulation.js, game/server/test/field_medic.test.js
   Fix: make the medic bead use a player-only/enemy-fired projectile path or add exclusion options so the firing medic and allies are not damaged; add tests that medic/ally HP stays unchanged while the player is hit.

2. The recorded vitest coverage run is red in the modified magic-stone pickup integration test; passive Magic Stone regen adds ~0.005 during the awaited pickup sleep, failing the new close-to assertion.
   Files: game/server/test/integration.test.js
   Fix: adjust the assertion to account for passive regen without hiding pickup failure, for example by checking the loot is removed and Magic Stones increase by at least the drop value within a suitable tolerance.
