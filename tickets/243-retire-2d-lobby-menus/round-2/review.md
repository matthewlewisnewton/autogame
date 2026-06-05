# Review: 243-retire-2d-lobby-menus

## Runtime health

PASS. `round-2/metrics.json` is present with `"ok": true`, the captured game reached `phase: playing`, `connectionState: connected`, rendered canvases, and reported an empty `pageerrors` array. `round-2/console.log` has no `pageerror` or `[fatal]` lines from game code; the only notable browser lines are 409 resource responses during auth/setup and normal initialization logs.

## Acceptance criteria

1. Remove the 2D quest/shop/deck/character/launch panels.

PASS. The old persistent 2D entry points are retired:
- `game/client/index.html` removes `#lobby-tab-deck`, `#lobby-tab-shop`, and `#ready-btn`.
- The quest board wrapper is hidden by default and re-hidden whenever the lobby is shown.
- The account overlay now contains only account name/logout controls; character customization lives in the character booth overlay.
- The deck editor and card shop bodies remain as booth-owned surfaces, which matches the existing booth implementation and avoids duplicating UI.

2. Lobby-finder menu remains.

PASS. `#lobby-browser`, lobby creation, refresh, list rendering, join/drop-in handling, and leave-to-registry behavior remain intact. The round-2 capture created and joined a lobby with two players before deployment.

3. `?booth=` debug hooks remain functional.

PASS. Existing debug hooks are preserved and covered:
- `?booth=deck` and `?booth=shop` still route through `boothDeck.js` / `boothShop.js` and are localhost-gated.
- `?booth=character`, `?booth=quest`, and `?booth=hatswap` are localhost-gated, one-shot, and only open while `gamePhase === 'lobby'`.
- `?booth=launch` readies up on `lobbyJoined` only for lobby-phase joins, preserving the launch capture path without reintroducing a 2D ready button.

4. All booth flows work end-to-end.

PASS. Deck and shop booth actions open their booth-owned panels and continue to emit the underlying deck/shop socket events. The character booth opens only from the character booth action or debug hook. The quest booth reveals and scrolls the existing quest board without creating a second selection path. The launch booth and the capture/test hook both use the same `playerReady(true)` path as normal ready-up, so the round-2 full-flow capture reached gameplay, movement, and key-item use.

5. Tests green.

PASS. `round-2/coverage.log` reports 10 client test files passed, 227 tests passed. Coverage thresholds were disabled as expected.

## Design and requirements consistency

PASS. The implementation is consistent with `game/docs/design.md`: the lobby browser remains the first post-login menu, while squad lobby actions are now spatial booth interactions in the 3D hub. It also preserves the foundation requirements in `game/docs/requirements.md`: Three.js scene initialization, server-client Socket.IO connection, player representation, and movement synchronization are all exercised by the captured run.

## Debug scenarios

PASS. This ticket did not add a new `?debugScenario=NAME` shortcut. The changed `?booth=` shortcuts are gated to localhost and/or lobby phase as appropriate. The `?booth=hatswap` helper requests the existing `hats-unlocked` debug scenario, which remains a QA shortcut for a state normally reachable through hat unlock progression and does not bypass normal gameplay entry points.

## Code quality

PASS. The live code removes obsolete DOM lookups and tests around retired buttons/tabs, keeps launch ready-up idempotent, and uses existing booth dispatch/socket validation rather than adding parallel events. Server-side booth interaction is still lobby-phase and proximity validated. I found no dead entry point that lets normal gameplay open the retired 2D menus.

## Remaining gaps

None.

VERDICT: PASS
