## Harness slope-ticket detection matches ticket prose

`fallbackRecipe()` sets `isSlopeTicket` when ticket markdown matches `/sloped[-_]dungeon/`. Ticket 149’s harness-capture problem statement mentions “sloped-dungeon geometry,” so dodge-roll captures still append `emitScenario sloped-dungeon` and `04-sloped-ramp.png` even though this ticket is about dodge cleanup, not floor geometry.

### Acceptance Criteria
- Fallback capture for non-slope tickets ends after dodge steps without `emitScenario` unless the ticket is actually about slopes/ramps (e.g. narrow the regex or exclude “problem description” boilerplate).

## Slope-mode fallback summary omits dodge exercise

When `isSlopeTicket` is true, `fallbackRecipe()` returns a summary string that only mentions “ramp screenshot” and not dodge/key-item capture, even though `baseSteps` still run `useKeyItem` and the post-dodge probe.

### Acceptance Criteria
- `capturePlanSummary` for slope-appended fallback recipes mentions dodge/key-item capture when those steps are present, or use a neutral summary that lists all exercised actions.
