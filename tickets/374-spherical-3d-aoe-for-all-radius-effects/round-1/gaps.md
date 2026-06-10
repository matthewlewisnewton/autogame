1. Player key item effect radii still use XZ-only distance, so elevated XZ-inside targets/items can be healed, buffed, revealed, pulled, or collected while outside the intended sphere.
   Files: game/server/keyItemEffects.js, game/server/test/field_medic_kit.test.js, game/server/test/key-items.test.js, game/server/test/loot_magnet.test.js
   Fix: use resolved world Y plus a shared 3D/spherical distance helper for `field_medic_kit`, `rally_cry`, `flare_beacon`, and `loot_magnet` effect radii; add tests for elevated in-sphere and XZ-inside/out-of-sphere cases.

2. Ground enchantment card trigger radii remain flat 2D and traps do not store the cast origin Y.
   Files: game/server/simulation.js, game/server/cardEffects.js, game/server/test/enchantment.test.js
   Fix: record origin Y when spawning `spike_trap` and `cinder_snare`, trigger with 3D spherical distance, and add tests proving elevated enemies inside the sphere trigger while XZ-inside/out-of-sphere enemies do not.

3. Chain radius effects remain 2D for normal flat chain lightning and Thunderbird minion chains.
   Files: game/server/simulation.js, game/server/cardEffects.js, game/server/test/chain_lightning.test.js, game/server/test/new_card_pack.test.js
   Fix: compute chain hops with 3D distance from each hit target/minion regardless of `dirY`, then add tests that an elevated enemy inside `chainRadius` chains and an XZ-inside/out-of-sphere enemy does not.
