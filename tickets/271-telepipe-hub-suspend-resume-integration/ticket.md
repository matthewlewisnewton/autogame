# 271-telepipe-hub-suspend-resume-integration

## Difficulty: medium

## Goal

Make telepipe suspend->ship->resume work with the walkable hub: telepiping up lands the party in the hub (not the old 2D lobby); resume re-enters the in-progress run from the hub (a portal/booth distinct from the new-mission launch).

## Acceptance Criteria

- Telepipe up -> walkable hub; resume re-enters the suspended run from the hub. TEST: magic stones + card remainingCharges + objective are preserved across the suspend/resume round-trip (not reset to STARTING).

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
