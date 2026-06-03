## Harness slope-ticket detection matches ticket prose

`fallbackRecipe()` sets `isSlopeTicket` when ticket markdown matches `/sloped[-_]dungeon/`. Ticket 149 mentions “sloped-dungeon geometry” in the *problem description*, so dodge-roll captures incorrectly append `emitScenario sloped-dungeon` and a ramp screenshot unrelated to this ticket.

### Acceptance Criteria
- `isSlopeTicket` does not trigger on incidental mentions in nit/problem text (e.g. require ticket title, `## Difficulty`, or an explicit harness tag).
- Fallback capture for non-slope tickets ends after dodge steps without `emitScenario` unless the ticket is actually about slopes/ramps.
