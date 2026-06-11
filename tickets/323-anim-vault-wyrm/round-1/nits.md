## Correct the inaccurate "no specialEffect" comment in renderWyrmAttack
The comment in `game/client/cardRenderers.js` (renderWyrmAttack) states the
server "emits NO `specialEffect` for the Vault Wyrm breath events." That is
inaccurate: the server emits `specialEffect: "burning_breath"` (see
`game/shared/cardStats.json` and `game/server/simulation.js` queueWyrmBreathCardUsed).
The real reason the old code fell back to the dim palette is that it only matched
`=== 'fire_breath'`, which never equals `"burning_breath"`. The fix is correct;
only the explanatory comment is wrong and could mislead a future reader.

### Acceptance Criteria
- The comment accurately describes that the server emits
  `specialEffect: "burning_breath"` (not none), and that the previous bug was the
  `'fire_breath'` mismatch.
- No behavior change.
