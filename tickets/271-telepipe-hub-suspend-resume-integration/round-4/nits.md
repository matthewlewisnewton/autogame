## Reduce Duplicate Resume Controls

The suspended hub currently shows a dedicated `#resume-run-btn` while also keeping `#ready-btn` visible and re-labeled as a secondary resume control for harness compatibility. This passes the ticket because the new-mission deploy affordance is not active while suspended, but the player-facing UI would be cleaner with one obvious resume action.

### Acceptance Criteria
- While a run is suspended, the lobby presents one primary resume affordance to players, and any compatibility path for automated tests does not visually compete with it.
