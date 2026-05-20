# Audit Client/Server

Audit the entire client and server architecture. Ensure that too much work is not being left to the client. The server must be the one managing game state and validating all actions to securely keep state across users and prevent cheating or desyncs.

## Difficulty: hard

## Acceptance Criteria
- Audit all WebSocket messages currently sent from the client to ensure they only convey "intents" (e.g., `attack_attempt`, `move_request`) rather than outcomes (e.g., `damage_dealt`, `position_updated`).
- The server must validate all movement requests against collision geometry and player speed limits.
- The server must exclusively calculate combat outcomes (hit, miss, damage, crits, effects) using its own state, and then broadcast these outcomes to clients.
- The client should employ client-side prediction and server reconciliation to hide latency, while strictly respecting the server's authoritative state corrections.

## Potential Solutions

### Solution 1: Strict Server Authority (Lockstep / Wait for Server)
*   **Description:** The client sends an input and waits for the server to acknowledge and send back the new state before rendering the change.
*   **Pros:** Impossible to cheat; perfectly synchronized across all clients; simple to implement.
*   **Cons:** Feels very sluggish to the player due to network round-trip time (latency is directly felt as input delay).

### Solution 2: Server Authority with Client-Side Prediction (Recommended)
*   **Description:** The client immediately plays the animation and moves the character locally, sending the input to the server. If the server disagrees, the client's state is forcefully snapped back to the server's truth.
*   **Pros:** Highly responsive gameplay; still completely secure against spoofing and cheating.
*   **Cons:** More complex to implement. Requires maintaining a history of inputs on the client and potentially rewinding/replaying state when a correction arrives.

## Technical Specs
- **Files to modify**: `game/server/` and `game/client/` logic files (combat, movement, etc.).
