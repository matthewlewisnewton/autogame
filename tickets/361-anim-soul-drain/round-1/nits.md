## Soul Drain QA capture used fallback smoke plan, not the new scenario
The capture ran the deterministic full-flow smoke plan (`capturePlanSource: "fallback"`), so
the screenshots show lobby/move/dodge rather than the `soul-drain-heal-ready` scenario the
ticket added. The drain tethers + life-absorb flourish were never visually captured (they are
verified only by unit tests). Worth a follow-up capture that drives the scenario so the effect
is visually confirmed.
### Acceptance Criteria
- A capture run drives `?debugScenario=soul-drain-heal-ready`, casts Soul Drain, and produces
  a screenshot showing the per-hit drain tethers and the caster-side heal flourish.

## Debug scenario lives outside the ticket's stated client-only scope
`soul-drain-heal-ready` was added in `game/server/debugScenarios.js` + `game/server/index.js`,
while the ticket SCOPE line names only `game/client/...`. The addition is additive, gated, and
justified as a QA enabler, but the scope drift is worth recording so future scope audits don't
flag it as unexplained.
### Acceptance Criteria
- Either the ticket scope is understood to permit a QA-enabling debug scenario, or the scenario
  is relocated/documented so the server-side change is clearly accounted for.
