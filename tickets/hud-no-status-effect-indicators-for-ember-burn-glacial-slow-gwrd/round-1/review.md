# Senior Review — HUD status-effect indicators (ember burn / glacial slow)

## Runtime health (gate)

- `metrics.json`: `"ok": true`, `"pageerrors": []`, no `harness_failure` block, dev
  servers started (URL `http://localhost:5174/`). Capture is a full-flow smoke
  (auth → lobby → ready → movement → dodge w/ cooldown probe).
- `console.log`: clean — only `[vite] connecting/connected`, `[initScene]`, and
  `[launchBooth] ready-up via booth`. No `pageerror` / `[fatal]` lines.
- **The game starts and loads cleanly.** Gate passes.

## Acceptance criteria

**AC: While player.burningUntil or a glacial slow is active, a visible status
indicator appears on the HUD and clears when the effect expires; covered by a
client test or capture; works for at least burn + slow.** — MET.

- `computeActiveStatusEffects(player, now)` (`game/client/vanguard-hud.js:111`) is a
  pure derivation over `STATUS_EFFECT_DEFS` — one entry each for `burning`
  (`burningUntil`, 🔥) and `slowed` (`slowedUntil`, 🐌). It emits an effect only
  when the expiry is a number strictly greater than `now`, so effects correctly
  disappear at/after expiry. Robust against missing/null/zero/expired fields and a
  null player.
- `updateStatusEffectStrip(me)` (`game/client/main.js:2113`) rebuilds
  `#status-effect-strip` each HUD sync: clears children, adds `.has-effects` (which
  flips `display:none`→`flex` per `style.css:1338`) only when ≥1 effect, and renders
  a `.status-badge--<id>` per effect with icon + `"<label> <ceil(remainingMs/1000)>s"`.
  Called from `syncVanguardHud` only while `gamePhase === 'playing'`
  (`main.js:2063`); strip is also force-hidden in lobby (`style.css:2031`). Because it
  recomputes with `Date.now()` on every sync, the badge clears on its own as the
  timer lapses — satisfies "appears … and clears when the effect expires".
- Data is real, not faked: the server serializes `slowedUntil` and `burningUntil`
  onto every player snapshot (`game/server/progression.js:3502,3504`), and the
  simulation sets them via the slow/burn application paths
  (`game/server/simulation.js:1530,1565`). The capture probe confirms `me.player`
  carries `burningUntil` / `slowedUntil` fields. So both burn and glacial slow feed
  the same strip.
- Coverage: `client/test/status-effects.test.js` (5 tests, all passing) exercises
  burn-only, slow-only, both (stable order), and the expired/zero/missing/null and
  null-player cases — covering the "appears / clears / works for burn + slow" claim.
  The AC explicitly allows "client test **or** capture"; the unit test discharges it.

No new debug scenario was added by this ticket (diff touches only
`game/client/*`), so the debug-scenario review section does not apply.

## Design / regression consistency

- The strip lives inside the existing vitals block beside the HP/MS bars
  (`index.html:56`), matching the ticket's "small status-effect strip near the
  HP/MS bars". `pointer-events:none` keeps it from intercepting input. `aria-live`
  is a reasonable accessibility touch.
- No existing HUD elements, server fields, or DoT/slow mechanics were changed —
  purely additive client rendering of already-broadcast fields. No regression to
  the requirements foundation.

## Remaining gaps

None blocking. The capture's smoke flow never burns/slows the player, so no
screenshot shows a live badge — but this is a capture-plan limitation, not a code
defect, and the appear/clear logic is covered by the passing unit tests. Filed as a
nit (DOM render not directly tested; no live-effect capture).

VERDICT: PASS
