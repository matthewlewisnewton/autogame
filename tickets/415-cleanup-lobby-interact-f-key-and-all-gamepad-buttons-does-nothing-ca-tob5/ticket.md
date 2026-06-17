# Cleanup nits from lobby-interact-f-key-and-all-gamepad-buttons-does-nothing-ca-tob5

> **Staleness note.** This follow-up ticket was written against commit
> `2d92b30a` (2026-06-16). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `lobby-interact-f-key-and-all-gamepad-buttons-does-nothing-ca-tob5`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

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
