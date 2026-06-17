## Add a lobby-booth visual capture scenario

The round-1 capture fell back to the generic full-flow gameplay smoke, so there is no
screenshot proof of a hub booth actually opening on interact — the booth-interact chain is
only verified by unit/integration tests. A dedicated capture scenario (or agent-guided plan)
that walks the player to a booth in the lobby and presses interact would give visual QA
direct evidence for this class of fix in future.

### Acceptance Criteria
- A capture plan/scenario exists that positions the player near a hub booth in the lobby and
  triggers interact (keyboard F or gamepad), producing a screenshot of the opened booth UI.
- The scenario is gated to capture/QA tooling and does not affect normal gameplay.
