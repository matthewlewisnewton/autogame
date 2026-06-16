# escort: NPC freezes (no follow, no retreat) while ANY enemy is within DETECTION_RADIUS — softlocks if that enemy is unreachable

## Difficulty: medium

## Goal

REPRO (debug scenario 'escort-near-destination', escort_objective_fixture):
1. Deploy. Escort 'Archivist Vale' (attackDamage 0, hp 60) spawns at (8.5,0); destination dais ~(0,0); one wave-0 grunt at ~(3,0).
2. Enable godmode so the player cannot kill the grunt (simulates an enemy the player can't currently reach/hit — e.g. behind a wall with no LoS in a crowded layout).
3. Walk the player onto the dais (0,0) and wait.

OBSERVED: The escort NEVER moves from (8.5,0) for the entire run. Player stands on the dais 8 units away; escort stays frozen at 8.5; grunt (hp 100, untouched) sits at ~(3,0). runStatus stays 'playing' indefinitely — no progress, no fail timeout => soft-lock. Escort distToDest stays 8.5 (radius 4) so arrival never fires.

ROOT CAUSE: game/server/simulation.js escort-follow branch (~L3487-3524): for isEscort minions it computes 'underAttack = nearestEnemy && nearestDist < DETECTION_RADIUS' (DETECTION_RADIUS=8) and, when underAttack, does NOTHING — no movement at all (the escort also has attackDamage 0, so it cannot defend). The escort will not advance toward the player NOR retreat from the threat while any enemy is within 8 units, even when that enemy is busy attacking the (godmode/invulnerable) player and not the escort.

EXPECTED: Either (a) the escort should still path toward the player when its current threat is not actually attacking it / when the player has moved well past it, or (b) there should be a stall/fail safeguard so the escort objective cannot soft-lock when an enemy is parked in detection range but unreachable. At minimum the freeze should not be total.

CONFIRMED COUNTERFACTUAL: with godmode OFF, killing the grunt frees the escort, it follows the player to the dais, and the run completes to victory with reward (verified end-to-end via harness/tmp/escort-qa/escort-clear-then-escort.mjs -> reachedDestination:true, status:victory). So the freeze is strictly tied to a lingering in-detection enemy.

SEVERITY: Normally recoverable (clear the ambush), but becomes a hard soft-lock when an enemy lingers within 8u of the escort yet is unreachable/unhittable by the player (plausible in the 10-room 'crowded' annex_escort layout behind walls). No timeout fail exists.

EVIDENCE: harness/tmp/escort-qa/escort-escort-near-destination-state.json (escort frozen at 8.5, grunt hp 100 at (3,0), player at dais, runStatus playing).

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
