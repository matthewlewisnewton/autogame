# Client: convert updateAttackEffects 330-line boolean-flag dispatch chain to per-effect updaters

## Difficulty: medium

## Goal

updateAttackEffects (game/client/renderer.js:5422-5753) dispatches sixteen effect kinds via ad-hoc flag checks (fx.isSpikeTrapSpike, fx.radius !== undefined, fx.isLightColumn, fx.returning, plus a legacy fall-through default), each duplicating the same elapsed/t/dispose-on-expiry boilerplate. The fx.radius check is positional — any future effect carrying radius gets mis-dispatched into the summon path. Fix: spawners attach fx.update(fx, elapsed, t) or a kind string keyed into an updater table; the loop becomes generic step-then-expire. Found in code review 2026-06-09.

## Acceptance Criteria

- Effect dispatch is table/closure driven (no positional flag chain); all existing VFX behave identically (renderer/vfx tests pass); adding a new effect requires only registering an updater

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
