# Senior review: 185-character-models-spike-base-player-model

This is an **asset/contract spike** (`Verification: code`). The top-level `ticket.md`
is not in the worktree; the acceptance criteria come from beads **`autogame-0yf`**:

> One base humanoid `.glb` committed under `game/client/public/models` with documented
> license; morph targets/shape keys defined for the proportion dimensions; short decision
> note (source vs authored, license, poly budget, anchor/scale conventions) written to the
> ticket dir.

## Runtime health — FAIL (harness infra, not game code)

`round-2/metrics.json` reports `"ok": false` with `failure_kind: "capture_failed"`, so
there is no clean captured run. Per the runtime-health rule, a missing/failed capture is an
automatic FAIL. **However, this is a harness infrastructure failure, not a defect in the
ticket's code** — see `## Harness blockers` below. Both dev servers started cleanly and there
are no `pageerrors`:

```text
VITE v8.0.13  ready in 94 ms   ➜  Local:   http://localhost:5176/
Server listening on port 3003
```

The failure occurred in the harness screenshot tooling, before any browser validation:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'playwright' imported from .../harness/screenshot.mjs
```

This ticket does **not** change any runtime code path. `MODEL_REGISTRY.player` is still
`null` and neither `game/client/models.js` nor `game/client/renderer.js` was modified by the
diff, so the player model is not yet loaded in-game (that is downstream ticket 187). There is
nothing in this ticket's diff that the capture could have exercised or broken.

## Harness blockers

```text
Cannot find package 'playwright' imported from
  /home/matt/workspace/.autogame-worktrees/185-character-models-spike-base-player-model/harness/screenshot.mjs
metrics.json: { "ok": false, "failure_kind": "capture_failed", "capture_diagnosis.detected": [] }
client.log: VITE v8.0.13 ready ... Local: http://localhost:5176/
server.log: Server listening on port 3003
```

Signature: the screenshot harness cannot resolve `playwright`. No game code appears in the
trace; both servers came up. Fix is to install/resolve Playwright for the harness and re-run
the capture. Do **not** edit `game/` to chase this — code edits will not change the outcome
until the harness can run a capture.

## Acceptance criteria findings

**Base humanoid `.glb` committed with documented license — PASS.**
`game/client/public/models/player.glb` is committed (~1.0 MB, was a 15 KB placeholder).
License/source are documented in `CREDITS.md`, `public/models/README.md`,
`game/docs/MODEL_SPIKE.md`, and `game/docs/SPIKE_DECISION.md`: Quaternius Universal Base
Characters (`SuperHero_Male`), CC0.

**Morph targets for proportion dimensions — PASS.**
The committed asset exposes the six required morph targets on the `SuperHero_Male` skinned
mesh: `height`, `headSize`, `torsoWidth`, `armLength`, `legLength`, `shoulderWidth`. Names are
exact/case-sensitive and shared across server field / UI slider / asset, per
`SPIKE_DECISION.md`. The contract test asserts all six are present.

**Short decision note (source/license/poly budget/anchor-scale) — PASS (content complete).**
`game/docs/SPIKE_DECISION.md` records source vs authored (candidate comparison table), CC0
license, poly budget (≤ 18k tris, ~12.6k committed), and anchor/scale conventions (feet at
y=0, faces −Z, height ≈ 1.8, footprint within `PLAYER_RADIUS = 0.5`). The beads AC phrases
this as "written to the ticket dir"; the note instead lives in `game/docs/`, which is the more
durable and discoverable home for a record that downstream tickets 186–188 reference. I judge
the criterion satisfied in substance; the location wording is a non-blocking nit (see
`nits.md`).

## Design / requirements consistency

Consistent with `game/docs/design.md` and does not regress `game/docs/requirements.md`. The
spike keeps `MODEL_REGISTRY.player = null` and leaves the procedural player render path intact;
no gameplay wiring before the downstream avatar-render ticket. No `?debugScenario=` shortcuts
were added or changed.

## Tests and coverage

`round-2/coverage.log` shows the dedicated `client-glb` vitest project running
`client/test/playerModel.test.js`: **5 tests passed**. The test is well constructed — it parses
the real `.glb` via `GLTFLoader`, exercises the production `loadModel` path, and asserts morph
names, rest-pose height (1.7–1.9), feet at/above ground, and the ≤ 18k triangle budget.
`vitest.config.js` correctly isolates this real-Three.js test into a node project so it does
not collide with the jsdom-mocked client suite.

## Remaining gaps

1. The captured run did not complete (`metrics.json` `"ok": false`), so there is no runnable
   proof. The cause is harness infrastructure — `playwright` is not resolvable in
   `harness/screenshot.mjs`. This is the only blocker; the ticket's code would otherwise pass.
   No `game/` change can clear it.

VERDICT: FAIL
