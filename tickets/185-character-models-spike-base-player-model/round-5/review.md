# Senior review — 185 character-models-spike-base-player-model (round 5)

The top-level `ticket.md` is not committed to the worktree; the canonical
acceptance criteria come from beads **autogame-0yf**:

> One base humanoid .glb committed under game/client public/models with documented
> license; morph targets/shape keys defined for the proportion dimensions; short
> decision note (source vs authored, license, poly budget, anchor/scale
> conventions) written to the ticket dir.

This is a **research/authoring spike**: it produces an asset + contract docs +
a contract test, with no in-game wiring (the avatar render lands downstream in
ticket 187). Verification is therefore code/asset-level, not visual gameplay.

## Runtime health — PASS

`round-5/metrics.json`: `"ok": true`, `"pageerrors": []`. `console.log` contains
only a benign 409 (lobby re-create conflict on the two-client smoke), THREE.Clock
deprecation warnings, and Vite `ws proxy` EPIPE on socket close — all ignorable
environment noise. The probe shows a fully healthy run: `phase: "playing"`,
`sceneInitialized: true`, two connected players, enemies present, HP/MS HUD
correct, movement after W/D registered (player x/z changed, hp 100→94). The game
starts and loads cleanly with the ticket applied. The round-2 blocker (harness
`playwright` unresolvable, `"ok": false`) is resolved — sub-ticket 09 added the
Playwright dependency and the capture now succeeds.

## Acceptance criteria

**1. Base humanoid `.glb` committed under `game/client/public/models` with documented
license — PASS.**
`game/client/public/models/player.glb` is committed (15.7KB → 1.06MB; the larger
size reflects the real skinned body + six morph targets). License is documented
in two places: the `player.glb` row in `CREDITS.md` (Quaternius "Universal Base
Characters", **CC0**, source URL, status) and `README.md` / `SPIKE_DECISION.md`.
The model-credits policy (redistributable licenses only, no ripped assets) is
satisfied — CC0, source recorded.

**2. Morph targets / shape keys for the proportion dimensions — PASS.**
The committed asset exposes the six required morph targets on the `SuperHero_Male`
skinned mesh: `height`, `headSize`, `torsoWidth`, `armLength`, `legLength`,
`shoulderWidth` — exact, case-sensitive, no aliases, shared by server field / UI
slider / asset per `SPIKE_DECISION.md` and `README.md`. The contract test
`client/test/playerModel.test.js` asserts all six are present on the named mesh
and fails if any drift; I re-ran `vitest run --project client-glb` and got **5/5
passing**. `scripts/build-player-morphs.mjs` defines the same six `MORPH_NAMES`
and authors them programmatically onto the rest mesh.

**3. Short decision note (source vs authored, license, poly budget, anchor/scale)
— PASS (substance complete; location is a nit).**
`game/docs/SPIKE_DECISION.md` records source-vs-authored (candidate comparison
table: Quaternius vs KayKit/Kenney vs custom Blender vs Sketchfab), CC0 license,
poly budget (≤ 18k tris, ~12.6k committed), and anchor/scale conventions (feet at
y=0, faces −Z, height ≈ 1.8, footprint within `PLAYER_RADIUS = 0.5`).
`MODEL_SPIKE.md` holds the durable technical contract (clamps 0.75–1.25, default
1.0, export checklist). The beads AC phrases this as "written to the ticket dir";
the note instead lives in `game/docs/`, which is the more durable, discoverable
home that downstream tickets 186–188 already reference. I judge the criterion
satisfied in substance — the location wording is a non-blocking nit.

## Design / requirements consistency — PASS

`git diff 3b3ad3e..HEAD` shows **zero** changes to `client/models.js`,
`client/renderer.js`, `client/main.js`, `server/`, or `shared/`.
`MODEL_REGISTRY.player` remains `null`, so the procedural player render path is
untouched and no gameplay path consumes the new asset yet — exactly right for a
spike that lands the asset ahead of the ticket-187 render wiring. No
`?debugScenario=` shortcuts were added or changed (the diff touches no client
state code; the probe reports `debugScenario: null`). No regression to
`requirements.md`.

## Tests & coverage — PASS

`round-5/coverage.log` and my re-run both show the isolated `client-glb` vitest
project running `playerModel.test.js`: **5 tests passed**. The test is well
constructed — it parses the real `.glb` via `GLTFLoader`, exercises the
production `loadModel` path, and asserts morph names, rest-pose height (1.7–1.9),
feet at/above ground (min.y ≥ −0.05), and the ≤ 18k triangle budget.
`vitest.config.js` isolates this real-Three.js test into a node project so it
does not collide with the jsdom-mocked client suite. The 0% line in the coverage
table reflects that the asset/test touch no instrumented `game/` source modules
(coverage is visibility-only; thresholds disabled) — expected for a spike.

## Remaining gaps

None blocking. Two documentation nits noted in `nits.md`:
- `MODEL_SPIKE.md` names the base mesh `Regular_Male`, while `SPIKE_DECISION.md`,
  the committed asset, and the passing test all use `SuperHero_Male` — an internal
  inconsistency to reconcile.
- The decision note lives in `game/docs/` rather than the ticket dir named by the
  beads AC; harmless, but worth a one-line pointer if strict location matters.

VERDICT: PASS
