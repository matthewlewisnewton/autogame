# Senior Review — 357-anim-event-horizon

## Runtime health (gate)
- `metrics.json`: `ok: true`, no `failure_kind`, no `harness_failure` block.
- `pageerrors.json` / `metrics.pageerrors`: empty `[]`.
- `console.log`: clean — only `[vite] connecting/connected`, `initScene`, and
  `launchBooth ready-up`. The two `409 (Conflict)` resource lines appear
  identically for both clients (A and B) and are the pre-existing booth/ready-up
  artifact, not from this ticket's code (no game-code stack, not tagged
  `pageerror`/`[fatal]`). Capture is the deterministic fallback smoke flow
  (`capturePlanSource: "fallback"`), so the screenshots show lobby/movement, not
  the card cast — visual confirmation of the VFX was done at sub-ticket QA.
- Client suites pass: `cardRenderers.test.js` (176) + `vfx-primitives.test.js`
  (19) = 195 passed.

Game starts and loads cleanly → runtime gate satisfied.

## Acceptance criteria

### "Animation visibly matches its name/theme"
PASS. The new `spawnEventHorizonEffect` (renderer.js) builds a singularity:
near-black void core sphere (`0x1a0a2e`), a violet accretion ring (`0x581c87` /
emissive `0x7c3aed`) at `centerRadius`, an outer pull halo scaled to `pullRadius`
that **contracts inward** over the effect, and 12 edge particles that **spiral
toward the core**. This reads unmistakably as an event horizon / black hole and
is clearly distinct from Gravity Well's plain telegraph ring — a dedicated test
(`event_horizon is visually distinct from gravity_well`) asserts that distinction
(EH uses the singularity primitive + crush ring at 2.5; GW uses a bare 12-radius
telegraph). Palette is a coherent dark-violet/void theme appropriate to an
evolved spell card.

### "Timing synced to the server effect resolution"
PASS. Server `applyEventHorizon` (simulation.js) resolves pull + radial crush at
cast and the `CARD_USED` payload carries `radius` (pullRadius 12), `centerRadius`
(2.5), `crushed`, and `hits: crushed`. The renderer:
- spawns the pull field immediately at cast;
- defers the central crush impact (decal + crush telegraph ring at `centerRadius`
  + burst) by `EVENT_HORIZON_CRUSH_DELAY_MS` (375 ms) via `scheduleAfter`, giving
  the pull→crush beat while the halo is still contracting (contraction runs to
  0.75·duration);
- spawns per-hit sparks/bursts at each crushed enemy's mesh position, keyed off
  `hit.enemyId` which matches the server's `collectRadialHits` entry shape
  (`{ enemyId, hp, ... }`).
`event_horizon` has no `windUpMs`, so the 307 charge telegraph correctly does not
apply — explicitly asserted by a test. Field names line up exactly with the
server payload.

### "No perf regression"
PASS. One Group with ~15 child meshes per cast, fixed 1000 ms lifetime, disposed
via `disposeEffectObject` on expiry (asserted by a `dispose` spy test). No
per-frame allocation in `updateAttackEffects`; particle/halo updates are simple
trig. Negligible cost, comparable to existing effects.

### "Client test where feasible"
PASS. Substantial coverage added: synchronous singularity invocation with
radii/palette, scheduled crush via the named delay constant, GW-vs-EH visual
distinction, per-hit bursts at enemy meshes (including a missing-mesh skip),
no-windUp assertion, radius-absent early return, graceful degradation when
optional ctx primitives are absent, plus two primitive-level tests covering group
structure, palette, style overrides, and cleanup. All green.

## Scope & integration
Within ticket scope: `cardRenderers.js` (this card's render fn), `renderer.js`
(new VFX primitive + update branch), `config.js` (delay constant), and the
standard plumbing to thread `spawnEventHorizonEffect` through `main.js` /
`socketHandlerCtx.js` / `cardHandlers.js` — the same wiring pattern every other
spawn effect uses. Renderer is already registered (`event_horizon:
renderEventHorizon`). No server changes, no debug-scenario changes, no
design.md/requirements.md regression. `IcosahedronGeometry` has a `typeof`-free
truthiness guard with a `SphereGeometry` fallback, and `___test_scene` is honored
so tests exercise the real primitive.

## Remaining gaps
None blocking. One minor cosmetic timing inconsistency noted as a nit (per-hit
sparks fire at cast while the central crush ring fires at +375 ms).

VERDICT: PASS
