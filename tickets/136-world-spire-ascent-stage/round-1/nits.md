## Capture should exercise the spire-ascent scenario
The round-1 capture fell back to the generic `sloped-dungeon` scenario
(`capturePlanSource: "fallback"`, `scenarios: ["sloped-dungeon"]`), so the QA
screenshots frame an unrelated sloped dungeon rather than the new stacked tiers
and ramps. The `spire-ascent` / `spire-ascent-stage` debug scenarios exist and
work; the capture plan just never selected them. Wiring the capture to drive one
of the spire scenarios would give real visual proof of the climb (tier stacking,
ramp slope, ascending camera) instead of relying on unit tests alone.
### Acceptance Criteria
- Round capture for a spire-ascent ticket drives `?debugScenario=spire-ascent`
  (or `spire-ascent-stage`) and captures at least one screenshot from a mid/upper
  tier showing visible height gain.
- `metrics.json.scenarios` includes a spire scenario for this stage.
