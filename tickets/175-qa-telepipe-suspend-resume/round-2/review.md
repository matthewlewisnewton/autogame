## Per-Criterion Findings

### Runtime health

PASS. The captured round-2 run started and loaded cleanly. `metrics.json` has `"ok": true`, no `harness_failure`, and an empty `pageerrors` array. `console.log` contains no `pageerror` or `[fatal]` lines from game code; the only error line is a non-fatal 409 resource response during auth/setup.

### Implements the Telepipe suspend/resume QA goal

FAIL. The capture successfully reaches the key phases: solo dungeon with Telepipe in hand, suspended lobby after extraction, and resumed dungeon after re-deploy. The suspended lobby probe also shows `runStatus: "suspended"` and a valid summary for `Initiate Vault` with `defeatedEnemies: 0`.

The evidence does not verify preserved enemy state. The pre-suspend probe records 5 enemies with IDs:

- `381a2f59-2d35-4d7f-8f26-0ecc597da193`
- `3d242ad4-8383-41ef-8a56-00f39675d25e`
- `4d8057d6-1fb1-4248-ab53-31e432274c6a`
- `c5ef03e8-a10d-4d21-b5de-c4177069aabd`
- `7d652342-137a-4e4f-a742-5a8fb51e5ccc`

The resumed probe records those same 5 enemies plus two new enemies, `33af6c8f-a9de-4f20-905e-459c39c3fc1e` and `4976164d-03f0-4690-a0bb-4252a3c8295e`, for 7 live enemies total. The objective text remains `Purged 0 / 5 hostiles`, so the resumed live enemy set is inconsistent with the captured objective and with the ticket's requirement to verify enemies are preserved across suspend/resume.

The added standalone smoke script in `game/client/scripts/test-telepipe-suspend-resume.mjs` has the right kind of assertions for layout, enemy count/IDs/HP, objective summary, and post-resume portal distance. However, the actual round-2 capture path in `harness/screenshot.mjs` only records probes; it does not fail the capture when the enemy set changes, and the delivered capture evidence shows such a change.

### Existing tests and clean load

PARTIAL. Clean load is satisfied by the captured runtime health check. The visible `coverage.log` did not execute tests for the changed-file coverage slice (`No test files found`), and I did not run `test:smoke:telepipe-suspend-resume` because that script writes walkthrough screenshots/snapshots under `game/docs/`, which would violate the review instruction to write only review artifacts.

### Design and foundation consistency

FAIL for this QA ticket because the captured evidence contradicts the design requirement that a suspended run restore preserved enemy state. `game/docs/design.md` says the checkpoint captures and restores the run, layout, enemies, minions, loot, hands, objective progress, and portal position. The capture proves layout seed/profile and suspended summary continuity, but not enemy continuity.

The foundational requirements are otherwise not regressed in the captured run: the 3D scene renders, the client connects, the player is represented, and the lobby/dungeon transition works.

### Debug scenario checks

PASS with caveat. The `telepipe-ready` shortcut is gated through the debug scenario path: the client only auto-requests `?debugScenario=telepipe-ready` on localhost, and the server scenario is used as a QA shortcut to inject a Telepipe-ready hand before readying up. Normal gameplay still uses the regular deploy, card-use, Telepipe proximity, suspend, and restore server paths; the scenario does not replace `tryEnterTelepipe`, `suspendRunToLobby`, or `restoreRunCheckpoint`.

The caveat is that the fallback capture should assert the same invariants as the smoke script so the debug shortcut cannot mask a real preserve-state regression.

## Remaining gaps

1. The round-2 Telepipe suspend/resume capture does not satisfy the enemy-preservation verification: it records 5 enemies before suspend and 7 after resume while the objective remains 0/5. This is a blocking gap for the top-level QA ticket because preserved enemy state is an explicit part of the goal.

VERDICT: FAIL
