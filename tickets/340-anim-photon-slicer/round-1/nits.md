## Deduplicate the returning-disc range constant
`RETURNING_DISC_RANGE = 6` (cardRenderers.js:611) is an exact duplicate of `INFINITE_DISK_RANGE = 6` (cardRenderers.js:541). Both are the "payload omitted attackRange" fallback for the same disc family. Consolidating to one shared constant removes the drift risk if the default reach is ever retuned.
### Acceptance Criteria
- The returning-disc and triple-returning renderers share a single named fallback-range constant.
- Behavior is unchanged (fallback range stays 6); client tests still pass.

## Redundant cyan accent fallback in renderReturningDisc
`color = getAccentHex(data.cardId) ?? 0x22d3ee` (cardRenderers.js:626) always resolves via the accent map for photon_slicer (`#22d3ee`), so the literal fallback never triggers for the only card routed here. It is harmless and arguably defensive, but worth a brief comment noting why the literal mirrors the accent, so a future reader does not assume the two can diverge.
### Acceptance Criteria
- The fallback color either references a shared cyan constant or carries a one-line comment explaining it intentionally mirrors the photon_slicer accent.
