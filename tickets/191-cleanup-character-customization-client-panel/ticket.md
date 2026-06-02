# Cleanup nits from 183-character-customization-client-panel

> **Staleness note.** This follow-up ticket was written against commit
> `621ab09` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `183-character-customization-client-panel`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

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
