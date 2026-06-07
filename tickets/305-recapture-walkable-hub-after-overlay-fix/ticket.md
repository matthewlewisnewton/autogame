# 305-recapture-walkable-hub-after-overlay-fix

## Difficulty: medium

## Goal

Now that 304 fixed the lobby-menu-overlay re-show (the 2D menu stays dismissed while walking the hub), RE-RUN the hub playthrough-validation to capture the ACTUAL walkable 3D ship hub (not the menu). Boot off current main (includes 304). This SUPERSEDES the stalled 288, which ran on pre-304 code and could not produce a clean walkable capture.

CAPTURE (menu closed): hub overview as a 3D walkable space; each of the 3 rooms (operations / commerce / salon) as walkable zones; party-mate avatars visible in-world (2 players); plus booth (paid appearance), hat-swap, telepipe before/after, lobby-finder. Land under game/validation/hub/. Write game/validation/hub/findings.md with walkable-presentation observations (is the 3D hub now clearly visible and navigable; any remaining menu-dominance; party-mate visibility).

ACCEPTANCE: hub screenshots show the walkable 3D hub with the menu CLOSED and party-mates visible; committed under game/validation/hub/; findings.md covers the walkable presentation. SCOPE: hub validation driver (game/validate) + game/validation/hub/** outputs. No gameplay changes (304 already fixed the overlay).

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
