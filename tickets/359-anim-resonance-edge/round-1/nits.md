## Resonance discharge radius is effectively hardcoded to 6
`renderResonantDoublePulse` reads `data.shockwaveRadius` with a finite-check fallback to `6`, but the server's `CARD_USED` emit (`game/server/cardEffects.js:549-573`) never includes `shockwaveRadius`, so the value is always `undefined` and the code always uses the `6` fallback. It happens to match `resonance_edge`'s `shockwaveRadius: 6`, so the visual is correct today, but the dynamic-radius branch is dead. Either add `shockwaveRadius` to the emit so the ring tracks the card stat, or drop the branch and use the literal.
### Acceptance Criteria
- The discharge ring radius is driven by the actual card `shockwaveRadius`, OR the dead dynamic branch is removed in favor of an explicit constant with a comment.

## Discharge VFX only shows when the cadence shockwave actually hits an enemy
The resonance discharge layer is gated on `data.shockwaveHits.length > 0`. On the every-2nd-use cadence the server still "fires" the shockwave, but if no enemy is within radius, `shockwaveHits` is empty and no discharge plays. This is a slight fidelity gap: the visual peak tracks "hit something" rather than "shockwave fired." Consider keying the discharge off the cadence signal (e.g. a server flag indicating the shockwave fired) so the peak shows whenever the resonance discharges, independent of whether a target was in range.
### Acceptance Criteria
- The resonance discharge VFX plays on every shockwave-cadence use, regardless of whether an enemy was struck.
