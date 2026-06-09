1. Fire-enemy burn validation passes without proving ticking burn damage or the player burn animation.
   Files: harness/validate/lib/cardMechanics.mjs, harness/validate/lib/findings.mjs, harness/validate/verify-fire-artifacts.mjs, game/validation/fire/*
   Fix: In the Ember Wraith burn step, wait for `player.hp` to decrease after `burningUntil` is set, fail when `hpDelta >= 0`, and capture an in-combat screenshot before victory/summary UI obscures the burn visual.

2. The Purifying Pulse debug scenario seeds simultaneous burn and slow even though burn/slow are mutually exclusive.
   Files: game/server/debugScenarios.js, harness/validate/presets/fire.mjs, harness/validate/lib/cardMechanics.mjs
   Fix: Change the cleanse probe to use a normally reachable state, such as low HP with either burning or slowed active, or split the validation into separate burn-cleanse and slow-cleanse probes without ever setting both statuses at once.
