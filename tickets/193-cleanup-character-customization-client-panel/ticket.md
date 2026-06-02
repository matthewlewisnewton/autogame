# Cleanup nits from 183-character-customization-client-panel

> **Staleness note.** This follow-up ticket was written against commit
> `35db889` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `183-character-customization-client-panel`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Cosmetic save: handle network/fetch rejection

The cosmetic Save handler `await patchProfile(...)` and keys off
`result.error`, but `patchProfile` does not wrap its `fetch` in try/catch — a
network failure (fetch rejects) would reject the click handler, leaving
`#cosmetic-save-btn` permanently disabled with no error shown. This mirrors the
pre-existing account-save handler, so it is not a new regression, but both
would benefit from a guard. Low priority.

### Acceptance Criteria
- A network/fetch failure during cosmetic save shows a visible
  `#cosmetic-error` message and re-enables `#cosmetic-save-btn`.
- The same guard is applied consistently to the existing account-save handler.

## Smoke capture never opens the customization panel

The fallback capture plan (auth → lobby → ready → movement) never opens the
Account overlay, so the customization panel and live preview get no visual QA
proof. Adding a capture step that opens the panel would give future rounds a
screenshot of the swatches/preview actually rendering.

### Acceptance Criteria
- A capture scenario (or fallback step) opens the Account overlay and captures
  the Character section with the live preview rendered.
