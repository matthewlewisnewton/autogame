## Harness capture never exercises spire-ascent
Round-1 capture used the `sloped-dungeon` fallback on the default training-caverns quest, so screenshots do not show the new stacked spire geometry or `spire_ascent` deploy flow.
### Acceptance Criteria
- Top-level capture plan includes `?debugScenario=spire-ascent-stage` or deploy with `spire_ascent` selected.
- At least one screenshot shows multiple elevated tier platforms and a connecting ramp.

## 3-platform spire seeds cluster all enemies on one combat tier
When `generateSpireAscent` rolls `numTiers === 3`, there is only one `combat` room (`tierIndex === 1`); all `spire_ascent` enemies spawn there (~9/30 seeds in 1–30). Multi-tier pacing is weaker than for 4–5 tier layouts.
### Acceptance Criteria
- Either enforce `numTiers >= 4` in `generateSpireAscent`, or when only one combat tier exists, place a subset of enemies on the top `treasure` tier (or add a second combat tier).
- Add a seed sweep test (e.g. seeds 1–30) asserting at least two distinct `tierIndex` values among enemy spawn rooms whenever `enemyCount >= 3`.
