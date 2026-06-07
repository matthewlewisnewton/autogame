1. Balance report tables are stale after applied stat tunings, so the delivered report does not accurately describe the live card roster.
   Files: game/validation/card-balance/report.md, game/shared/cardStats.json
   Fix: Regenerate or manually reconcile all affected per-card metrics, verdicts, peer bands, summaries, and recommendations after the current `cardStats.json` values.

2. `excalibur_photon` was buffed from 14 to 18 damage despite being identified as an overpowered `operator-triage` card.
   Files: game/shared/cardStats.json, game/validation/card-balance/report.md, game/server/test/card_evolution.test.js
   Fix: Revert the incidental `excalibur_photon` damage increase, or replace it with an explicit evolved-weapon rebalance backed by updated analysis and tests.
