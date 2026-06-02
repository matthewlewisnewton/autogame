# Cleanup nits from 182-character-customization-client-render-avatar

> **Staleness note.** This follow-up ticket was written against commit
> `5c1a5aa` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `182-character-customization-client-render-avatar`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Remove or use the unused `isSelf` parameter in `createPlayerAvatar`
`createPlayerAvatar(cosmetic, isSelf)` (game/client/renderer.js:1165) accepts and documents
`isSelf`, but the body never reads it — body color is now cosmetic-driven for every player.
It's dead surface area that implies a self/remote distinction that no longer exists.
### Acceptance Criteria
- Either remove the `isSelf` parameter (and its JSDoc + call-site argument) or give it a
  real effect; no unused parameter remains on `createPlayerAvatar`.

## Dash ghost only clones the body mesh, dropping the accent/hat
`triggerDashVFX` (game/client/renderer.js:1302) builds the fade-out ghost from
`bodyMesh.geometry` only, so the trailing afterimage shows the bare body without the accent
band or hat. Minor visual polish — the squash on the full group is correct; only the ghost
is partial.
### Acceptance Criteria
- The dash ghost visually represents the whole avatar (body + accent + hat) rather than the
  body mesh alone, or this approximation is intentionally documented as acceptable.

## Default avatar colors duplicated from the server `DEFAULT_COSMETIC`
`DEFAULT_AVATAR_BODY_COLOR`/`DEFAULT_AVATAR_ACCENT_COLOR` (game/client/renderer.js) are
hand-copied numeric mirrors of the server's `DEFAULT_COSMETIC` hex strings. If the server
defaults change, the client silently drifts. Acceptable across the client/server boundary,
but worth a shared source or a comment-enforced sync check.
### Acceptance Criteria
- Default body/accent colors are sourced from (or verified against) the server's
  `DEFAULT_COSMETIC` so the two cannot silently diverge.
