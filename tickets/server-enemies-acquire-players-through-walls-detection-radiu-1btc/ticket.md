# Server: enemies acquire players through walls (DETECTION_RADIUS has no line-of-sight) — Frost Crossing spawn room gets swarmed in seconds

## Difficulty: medium

## Goal

Found while playtesting frost_crossing (2026-06-09). Two consecutive fresh-account runs died in ~10s (run durationMs 10718, 1/6 purged) with 2 grunts + a glacial_thrower converging on the 13x13 start room almost immediately.

CAUSE / MECHANISM
Enemy target acquisition is a pure 2D radius check with no line-of-sight or room test (game/server/simulation.js ~lines 2808-2823 at commit b4a5bb8): any player within DETECTION_RADIUS = 8 (game/server/config.js ~line 12) is acquired, walls ignored. The ice-cavern layout is small and linear (start room front edge z=-26, connectors z in [-26,-16]); enemies wandering the connectors are within 8 units of spawn THROUGH the wall, aggro instantly at run start, and funnel into the start room together. With grunt 10 dmg / glacial_thrower 12 dmg + 50% slow (2.5s), a fresh 100 HP player with the starter deck gets stun-chained from 100 to 0 in roughly 10 seconds.

(Start/connector rooms have spawnWeight 0, so this is aggro+wander convergence, not spawn placement.)

REPRO
1. Fresh account, deploy into frost_crossing (ice-cavern, seed is deterministic per quest).
2. Stand in the spawn room for ~10-20s without fighting.
3. Observe 2-3 enemies (incl. glacial_thrower) entering the start room and attacking; fresh player typically dies < 15s.
Also observable in isolation: place an enemy 6 units from a player with a wall between them — enemy enters 'chasing' though it cannot see the player.

FIXED WHEN
Either (a) target acquisition requires line-of-sight / same-room-or-doorway, or (b) frost_crossing's opening is rebalanced so a fresh starter-deck player isn't engaged by 3 enemies simultaneously within seconds of spawning. Verify by repro step above: spawn room should not be swarmed before the player leaves it.

NOTE: refs at commit b4a5bb8; lines may drift — search simulation.js for DETECTION_RADIUS.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
