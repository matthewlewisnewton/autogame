# 380-ice-l1-miniboss-permafrost-warden

## Difficulty: medium

## Goal

Add a MINIBOSS (in-level stage-boss encounter) to the ICE level-1 (Frost Crossing, frost_crossing/ice-cavern), which currently has none. Add the Permafrost Warden as the stage-boss encounter, wired via the existing encounter framework (258) like the other levels' minibosses (annex_overseer etc.). Display metadata + lock-on panel (251/252) + defeat objective. SCOPE: game/server (enemy + encounter wiring + quest objective) + game/client (render) + test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
