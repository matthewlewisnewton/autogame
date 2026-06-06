1. Chain Lightning can damage enemies without a primary full-damage hit when no primary target is found.
   Files: game/server/simulation.js, game/server/test/chain_lightning.test.js
   Fix: Return no hits when `collectChainLightningHits()` finds no primary target before the chain loop, and add a regression test with an enemy near the caster but outside the primary ray.
