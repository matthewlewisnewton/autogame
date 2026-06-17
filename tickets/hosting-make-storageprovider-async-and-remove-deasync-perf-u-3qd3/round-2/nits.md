## Guard async socket-handler callbacks against unhandled rejections

The `joinPlayerToLobby` / `joinLobbyWithPhasePolicy` socket handlers in
`lobbyHandlers.js` now wrap their async calls in `void …catch(err => console.error(...))`.
The other async socket-handler callbacks added by this ticket do not have the
same guard: `runHandlers.js` `RETURN_TO_LOBBY` (`await returnPlayersToLobby`) and
the `lobbyHandlers.js` `UNLOCK_HAT` / appearance-change callbacks return promises
to `withLobbyContext`/`withLobbyPlayer` that nothing awaits or `.catch`es. In
practice these don't reject today (the underlying `savePlayerData` swallows its
own errors), but a future throw in those paths would surface as an unhandled
promise rejection rather than a logged error.

### Acceptance Criteria
- Async callbacks passed to `withLobbyFromSocket`/`withLobbyPlayer`/`withLobbyContext`
  in socket handlers either have their returned promise `.catch`-guarded (logging
  the error) or are awaited inside a try/catch, matching the join-path pattern.
- No behavior change to the happy path; existing server tests still pass.

## Investigate flaky `training_caverns_spawn_camp` test

`server/test/training_caverns_spawn_camp.test.js` ("entry aggro grace window")
failed once in the full coverage run (`expect(gruntEngaged).toBe(true)`) but
passes 3/3 in isolation. It is order/timing sensitive and unrelated to this
ticket, but the intermittent failure adds noise to the suite gate.

### Acceptance Criteria
- The test is made deterministic (e.g. fixed seed / explicit tick advancement)
  so it passes reliably both in isolation and within the full suite.
