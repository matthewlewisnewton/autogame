## Harden owner-registry liveness against publish-key lapses

`reconcileStaleLobbyOwners` treats an absent `lobbies:<instanceId>` publish key
(30s TTL) as proof the instance is dead and prunes its `lobby:owners` entries.
But `publishLocalLobbies` is only triggered by lobby-list changes
(`broadcastLobbyList`), with no periodic refresh. A live instance hosting a
stable, in-progress lobby with no list churn for 30s lets its publish key lapse;
a peer's sweep would then prune that live lobby's owner entry, breaking
Fly-Replay routing to it until the lobby is recreated. This matches the existing
lobby-browser staleness assumption (so it is not a new regression), but routing
correctness raises the stakes.

### Acceptance Criteria
- A live instance refreshes its `lobbies:<instanceId>` publish key on an interval
  shorter than `PUBLISH_TTL_SEC` (e.g. a heartbeat publish on the existing 5s
  cleanup timer), OR the reconcile re-registers/keeps owner entries for lobbies
  the local instance still holds rather than relying solely on publish-key
  presence.
- A test demonstrates a live remote lobby's owner entry survives a sweep that
  runs while no lobby-list change has occurred within the TTL window.
