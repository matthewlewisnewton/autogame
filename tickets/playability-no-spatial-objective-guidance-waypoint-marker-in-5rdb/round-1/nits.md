## Compass uses server position, not client-predicted position

`updateObjectiveNavIndicator()` reads the local player's position from `gameState.players[myId].x/z` (the server snapshot) and only falls back to the renderer's predicted `getPlayerPosition()` when those are non-finite. Because the rAF loop redraws the arrow every frame but the server position only refreshes per tick, the bearing/distance can feel slightly stale during fast movement. Preferring the predicted position would make the arrow track more smoothly.

### Acceptance Criteria
- During continuous movement, the compass bearing and distance readout update against the client-predicted local position rather than only the last server snapshot.
- Behavior is unchanged when no predicted position is available (still falls back gracefully).

## Extend objective guidance beyond collect_items prisms

The ticket's EXPECTED also mentioned "next room" / find-or-reach objectives. The current compass only handles `collect_items` quest-critical crystals (the explicit minimum bar). A follow-up could point toward the next unexplored/objective room for `find_room`/reach-style objectives so those quests also get spatial guidance.

### Acceptance Criteria
- For at least one non-`collect_items` objective that requires reaching a location, an on-screen directional cue points the player toward the target.
- The cue reuses the existing `objectiveNav` bearing helpers and hides once the objective is satisfied.

## "screen-edge compass" naming vs. fixed bottom-center placement

The sub-ticket 02 commit message describes a "screen-edge compass", but the implementation is a fixed bottom-center pill (`#objective-nav-indicator { position:fixed; bottom:118px; left:50% }`). Consider either renaming for accuracy or, if a true screen-edge clamp was intended, clamping the indicator toward the edge in the direction of the target.

### Acceptance Criteria
- The indicator's documented description matches its actual on-screen placement/behavior.
