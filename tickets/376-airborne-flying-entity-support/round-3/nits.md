## Align Player Default Hover Fallback

The server `resolveEntityY()` supports `flying` entities with no explicit `altitude` by using `DEFAULT_FLY_ALTITUDE`, but the player snapshot normalizes missing player altitude to `0` and the local player render path uses that snapshot altitude fallback. This is not blocking because a future player fly card can set an explicit altitude, but aligning the client/player snapshot fallback with the server default would make the general airborne contract tighter.

### Acceptance Criteria
- A flying player with no explicit altitude renders locally at the same default hover height that `resolveEntityY()` applies on the server.
