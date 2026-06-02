# Senior Review — 183 Character Customization: Client Panel

## Runtime health
- `metrics.json`: `"ok": true`, `pageerrors: []`, servers reached `phase: "playing"`,
  scene initialized, canvas present for both players. No `harness_failure`.
- `console.log`: only `[vite] connecting/connected`, an expected `409 Conflict`
  from the registration/auth probe flow (a duplicate-username/email guard during
  capture, not game code), and `[initScene]` logs. No `pageerror`/`[fatal]` lines.
- Screenshot `01-initial.png` shows the Vanguard HUD with the `#character-frame`
  portrait rendering with the cosmetic accent border. Game starts and loads cleanly.
- `npx vitest run` on the changed test files: **186 passed (186)**.

## Per-criterion findings

### Panel offers body color palette, accent color picker, body shape picker (box/cylinder/cone/capsule)
PASS. `index.html` adds an "Appearance" `settings-section` with 7 preset body-color
swatches (`.cosmetic-swatch`), an `<input type="color" id="cosmetic-accent-color">`,
and four `.cosmetic-shape-btn` buttons for `box`/`cylinder`/`cone`/`capsule`.
`BODY_SHAPES` in `cosmetic-form.js` mirrors `game/server/cosmetic.js`.

### Live preview reflects current control selection before save
PASS. `#cosmetic-preview` is updated via `refreshCosmeticPreview()` →
`applyCosmeticToPreviewElement()` on every swatch click, shape click, and accent
`input` event, reading the in-form state (`readCosmeticFormState`) rather than the
saved profile — so it reflects unsaved selections. Shape drives `borderRadius`/`clipPath`.

### Save persists via PATCH /api/me/profile with server validation; errors surface
PASS. `cosmetic-save-btn` calls `patchProfile({ cosmetic: buildCosmeticPatchPayload(...) })`,
which PATCHes `/api/me/profile`. Server (`game/server/account.js:73`) routes through
`updateProfile` → `validateCosmetic` (hex-color + shape allowlist), returns 400 on
invalid input. Client surfaces `result.error` via `showCosmeticError()`. The
account.test.js cases for valid update (200 echo) and invalid input (400) pass.
Save button is disabled during the in-flight request and a no-op short-circuit
avoids a needless PATCH when unchanged.

### Selection survives reload (GET /api/me) and reflects on HUD portrait (#character-frame)
PASS. `GET /api/me` returns `cosmetic` (`account.js:51`). On load, `restoreSession`
→ `loadAccountSettings` caches `cosmetic`, then `updateVanguardPortraitCosmetic()`
applies it to `#character-frame` (accent border + CSS vars) and the `#character-portrait`
span (body color + shape). Login and stored-token bootstrap both flow through
`restoreSession`, so the portrait reflects the saved cosmetic after reload.

### Local player's gameState.cosmetic matches saved profile after save (ready for 182)
PASS. `syncLocalPlayerCosmetic()` sets `gameState.players[myId].cosmetic = { ...getCosmetic() }`
after a successful save (guarded on `myId` and an existing player record).

### Panel lives in the existing Account overlay alongside username/Settings
PASS. The Appearance section is a `settings-section` inside `#account-overlay`,
following the username controls and preceding the logout action; the separate
Settings overlay is untouched. `settings-layout.test.js` asserts the layout.

## Consistency / regressions
- Matches the ticket Design notes: reuses `patchProfile`/`loadAccountSettings`,
  mirrors server `BODY_SHAPES`/defaults, DOM-only preview (no Three.js).
- No changes to server runtime, gameplay, or unrelated subsystems; diff is confined
  to client UI + the cosmetic cache plumbing in `settings.js`. No regressions observed.
- No debug scenarios added by this ticket.

## Remaining gaps
None blocking. Minor non-blocking nits recorded in `nits.md`.

VERDICT: PASS
