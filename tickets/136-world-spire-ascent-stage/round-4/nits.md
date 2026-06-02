## Round-4 capture should exercise spire_ascent
Round-4 metrics used the `sloped-dungeon` fallback on the default training quest, so screenshots and probes never showed the vertical spire layout or `spire_ascent` objective text. A future capture plan should select `spire_ascent` in lobby or use `?debugScenario=spire-ramp-passage` / `spire-summit-combat` for ticket-specific visuals.

### Acceptance Criteria
- `metrics.json` `scenarios` includes a spire-specific scenario and probe data shows `layout.stage === 'spire-ascent'`.
- At least one screenshot shows stacked tiers or a ramp between tiers from the spire generator.

## sloped-dungeon emitScenario timeout in round-4
`screenshot.log` records `[emitScenario] sloped-dungeon failed: timeout waiting for debugScenarioResult` while `debugScenarioResult` remained null in probes. Gameplay continued, but harness scenario wiring may need a longer wait or an earlier `debugScenario` emit after lobby ready.

### Acceptance Criteria
- `emitScenario` for `sloped-dungeon` (or spire scenarios) resolves with `debugScenarioResult.ok === true` within harness timeout.
- `metrics.json` probes record non-null `debugScenarioResult` when a scenario is requested.

## Call validateSpireLayout after spire generation
`validateSpireLayout` exists and is tested but is not invoked at the end of `generateSpireAscentLayout`, so a future generator regression could slip through until tests run.

### Acceptance Criteria
- `generateSpireAscentLayout` calls `validateSpireLayout` on its return value before returning (or in `generateLayout` when stage is spire-ascent).
