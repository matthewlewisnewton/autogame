## Stray server.log committed under validation output

`game/validation/hub/server.log` (and a worktree-root `server.log`) is a captured
process log left in the tree. Validation runs should not leave raw server logs as
tracked artifacts — they add churn and can leak local paths.

### Acceptance Criteria
- `game/validation/hub/server.log` is removed from the tracked artifact set (or
  gitignored under `game/validation/`).
- The hub validation run no longer writes a stray `server.log` into the repo root.

## Growing surface of `window.__*ForTest` hooks in client main.js

`game/client/main.js` now exposes a large and growing set of global test hooks
(`__patchCharacterBoothForTest`, `__requestBoothSaveForTest`, `__confirmBoothPaidSaveForTest`,
`__applyAppearanceChangeForTest`, `__saveCharacterBoothForTest`, `__abandonSuspendedRunForTest`, …).
This is fine functionally but is accumulating untyped global state in the production bundle.

### Acceptance Criteria
- The booth/appearance/abandon test hooks are grouped behind a single namespaced object
  (e.g. `window.__harness.booth.*`) or gated so they are only attached under the dev/debug flag.
- No duplicate `socket.once(APPEARANCE_CHANGED/APPEARANCE_ERROR)` wiring across the two
  near-identical `__applyAppearanceChangeForTest` / `__saveCharacterBoothForTest` helpers.
