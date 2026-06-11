# Phase Echo: render the every-3rd-use shockwave and sync echo timing

Polish `renderEchoSlash` (Phase Echo / `echo_blade`) so its animation reads
unmistakably as a phasing twin-slash AND its timing matches the server effect.
The current renderer draws a pink twin-slash but never renders the card's
signature radial **shockwave** — the server discharges it on every 3rd use
(`shockwaveEvery: 3`) and reports it via a non-empty `data.shockwaveHits`. Add a
distinct shockwave burst keyed off `data.shockwaveHits`, synced to the server's
immediate resolution (the card has no `windUpMs`, so no wind-up telegraph), while
keeping the existing pink twin-slash after-image.

## Acceptance Criteria
- The lead swing still renders pink (`color: 0xf472b6`, `coneAngle: Math.PI/4`)
  with a fainter delayed echo after-image swing, preserving the existing
  twin-slash read (lead opacity > echo opacity).
- On the server's every-3rd-use cadence — signalled by a **non-empty
  `data.shockwaveHits`** array — the renderer layers a distinct radial shockwave
  (expanding ring + heavier particle burst) at the cast origin, sized to the
  shockwave radius (`data.shockwaveRadius` when finite, else fall back to ~6).
- The shockwave is keyed ONLY off `data.shockwaveHits` length — never off
  `comboCount` arithmetic — so it fires exactly when the server discharged it.
- When `data.shockwaveHits` is empty/absent, only the twin-slash renders (no
  shockwave ring or heavy burst).
- The shockwave burst originates at the cast origin and is visibly larger/heavier
  than the base twin-slash effect (it must not be mistaken for the normal swing).
- No `windUpMs` telegraph is added for this card (echo_blade has none); the
  shockwave fires immediately on the use, matching the server's synchronous
  resolution.
- All optional `ctx` primitives are guarded so the renderer never throws when a
  primitive is absent (graceful degradation, matching sibling renderers).
- `game/client/test/cardRenderers.test.js` covers: (a) the existing twin-slash
  behavior, and (b) a new case asserting the shockwave layer fires when
  `shockwaveHits` is non-empty and does NOT fire when it is empty.
- Full vitest suite (server + client) passes; no perf regression.

## Technical Specs
- `game/client/cardRenderers.js`: rewrite the body of `renderEchoSlash` (the
  `echo_blade` render fn, registered at the `echo_blade: renderEchoSlash` entry —
  keep the registration). Keep the existing twin-slash (`spawnAttackEffect` +
  `spawnProjectileTrail`, lead swing then `scheduleAfter` echo). Add a
  shockwave block guarded by `if (data.shockwaveHits && data.shockwaveHits.length > 0)`
  that uses `spawnTelegraphRing` (sized to `data.shockwaveRadius` ?? 6) and a
  heavier `spawnParticleBurst` (count clearly above the base, e.g. >= 20) at
  `originOf(data)`. Mirror the proven pattern in `renderResonantDoublePulse`
  (the evolved `resonance_edge` sibling) for structure/guards, but keep Phase
  Echo's pink palette (`0xf472b6` / emissive `0xdb2777`) and twin-slash identity
  distinct from the evolved form.
- Reuse only the 315 shared VFX primitives already used in this file
  (`spawnAttackEffect`, `spawnProjectileTrail`, `spawnTelegraphRing`,
  `spawnParticleBurst`, `scheduleAfter`); guard each with `ctx.<fn> &&`.
- `game/client/test/cardRenderers.test.js`: extend the existing Phase Echo test
  block (around the `'Phase Echo swings pink…'` case) with shockwave-cadence
  assertions, firing `echo_blade` once with `shockwaveHits: []` and once with a
  non-empty `shockwaveHits` (and a `shockwaveRadius`).
- Do NOT touch server files, card stats, or any other card's renderer.

## Verification: code
