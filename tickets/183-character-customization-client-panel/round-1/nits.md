## Deduplicate body-shape styling for the HUD portrait
`applyCosmeticToPreviewElement()` sets `borderRadius`/`clipPath` inline on
`#character-portrait`, while `style.css` also defines per-`data-body-shape`
rules for the same element. Both express the same shape; the inline styles win,
making the CSS rules dead for the portrait. Pick one source of truth to avoid
future drift.
### Acceptance Criteria
- Portrait shape is driven by exactly one mechanism (inline JS *or* the
  `#character-frame[data-body-shape=...] #character-portrait` CSS rules), not both.
- Behavior is unchanged (portrait still reflects the saved/selected body shape).

## `buildCosmeticPatchPayload` is a thin alias
`buildCosmeticPatchPayload(root)` only returns `readCosmeticFormState(root)` with
no added behavior. If no divergence is planned, inline the call at the one save
site and drop the wrapper to reduce surface area.
### Acceptance Criteria
- Either `buildCosmeticPatchPayload` gains distinct behavior, or it is removed and
  its single caller uses `readCosmeticFormState` directly.
