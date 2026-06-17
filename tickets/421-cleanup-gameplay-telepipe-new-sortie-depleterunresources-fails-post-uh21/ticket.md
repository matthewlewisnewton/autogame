# Cleanup nits from gameplay-telepipe-new-sortie-depleterunresources-fails-post-uh21

> **Staleness note.** This follow-up ticket was written against commit
> `3252273a` (2026-06-17). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `gameplay-telepipe-new-sortie-depleterunresources-fails-post-uh21`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Extract telepipe-ready depleted-MS magic numbers into a named constant

The depleted starting magic-stone value (`20`) and the regen-grace window
(`20000` ms) are now duplicated as bare literals across four scenario setups in
`game/server/debugScenarios.js` (lines 725, 847, 905-906, 939-940). A shared
named constant (e.g. `TELEPIPE_PROBE_DEPLETED_MS` / `TELEPIPE_PROBE_GRACE_MS`)
would document intent and keep the canyon/spire/frost telepipe-ready scenarios in
sync if the depletion threshold ever changes.

### Acceptance Criteria
- The `20` MS value and `20000` ms grace window in the telepipe-ready scenario
  setups are sourced from named constants rather than repeated literals.
- All existing debug-scenarios tests still pass.

## Capture the changed canyon/spire telepipe-ready scenarios directly

The round-1 fallback capture exercised the generic `telepipe-ready` scenario, not
the `canyon-descent-telepipe-ready` / `spire-ascent-telepipe-ready` scenarios that
this ticket changed, so the depleted-MS deploy path got no visual/probe coverage
in capture (only unit-test coverage). A capture plan that deploys one of the
changed presets would give end-to-end proof that depletion lands deterministically.

### Acceptance Criteria
- A capture scenario deploys `canyon-descent-telepipe-ready` or
  `spire-ascent-telepipe-ready` and a probe records `magicStones === 20` at deploy.
