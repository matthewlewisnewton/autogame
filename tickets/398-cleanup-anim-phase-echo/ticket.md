# Cleanup nits from 358-anim-phase-echo

> **Staleness note.** This follow-up ticket was written against commit
> `c45e91de` (2026-06-10). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `358-anim-phase-echo`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Phase Echo shockwave radius is never sent by the server

`renderEchoSlash` reads `data.shockwaveRadius` (`Number.isFinite(data.shockwaveRadius) ? data.shockwaveRadius : 6`), but the server's `CARD_USED` emit in `game/server/cardEffects.js` does not include `shockwaveRadius` in its payload. The branch therefore always falls back to the literal `6`, which happens to match echo_blade's real `shockwaveRadius`, so the visual is correct — but the dynamic branch is dead in production and would silently desync if a card's radius ever differed. Either broadcast `shockwaveRadius` (and `shockwaveDamage` if useful) from the server, or drop the unreachable branch and use the constant.

### Acceptance Criteria
- Either the server includes `shockwaveRadius` in the `CARD_USED` payload, or the client stops reading a field the server never sends.
- The ring size for echo_blade (and resonance_edge) still matches the card's configured `shockwaveRadius`.

## Phase Echo discharge VFX suppressed when the cadence beat hits no enemies

The shockwave layer is gated on `data.shockwaveHits.length > 0`. On the every-3rd-use beat, if no enemy is inside the radius the server returns an empty `shockwaveHits`, so the on-cadence discharge renders nothing. This is consistent with the sibling resonance_edge card and the server shockwave is a no-op without hits, so it is not a bug — but a "the discharge always fires on cadence" feel would require keying the visual off the broadcast `comboCount % shockwaveEvery` instead (or sending an explicit `shockwaveFired` flag).

### Acceptance Criteria
- Decide and document whether the discharge VFX should fire on every cadence beat or only when it connects.
- If "always," gate the ring/burst on a cadence signal that is independent of whether enemies were hit.
