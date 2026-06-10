# Named rare enemy variants per quest (PSO 'The Fake in Yellow' style) with unique drops

## Difficulty: hard

## Goal

PSO model: specific quests featured named/rare variants of normal enemies (recolored, stronger, unique drop), giving each quest a hunt-worthy pull and a memorable beat.

DESIGN
- Server: variant mechanism on top of ENEMY_DEFS (game/server/simulation.js ENEMY_DEFS @ b4a5bb8): a scripted spawn entry may declare { type, variant: { name: 'Frostmaw', hpMult, damageMult, tint, drop: { cardId | currency } } }. Spawn through the scripted wave system (autogame-o0vv.1) so each named rare belongs to a specific quest/room.
- Client: render variant tint/scale + a nameplate so it reads as a named foe; kill feed/radio line on defeat (pairs with autogame-o0vv.3).
- Content: one named rare each for frost_crossing (glacial_thrower variant), training_caverns tier 1, and ember_descent (ember_wraith variant), each with a guaranteed unique drop.

ACCEPTANCE
- Named rare spawns at its authored spot in its quest only, visibly distinct with nameplate.
- Killing it drops its unique reward 100% (first kill per run).
- Stats scale per variant config; regular spawns unaffected.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
