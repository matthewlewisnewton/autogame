# Auto-dismiss the attack/cast hint with persisted seen-before memory

The center attack/cast hint currently shows on every run start and only hides with the card hand — no fade, no memory. Add a dismissal policy: the hint line fades after ~10s or after the player has performed BOTH a successful basic attack AND a card cast in the run, whichever comes first, and a persisted flag keeps it dismissed across runs for the same profile while fresh profiles still see it.

## Acceptance Criteria

- On run start, the hint line (`#attack-hint`) is shown ONLY when the current profile has not yet been marked "hint seen"; if already seen, it does not appear.
- When shown, the hint auto-dismisses (fades out, then hidden) on the earlier of: (a) ~10 seconds elapsed, or (b) the player has completed at least one successful basic attack AND at least one card cast during the run.
- On dismissal, a persisted "seen" flag is written to `localStorage` keyed by the local player id (e.g. `attackHintSeen:<playerId>`), so subsequent runs for that same profile do not re-show the hint.
- A different/new profile (different stored player id, or no flag) shows the hint again.
- The attack reticle (`#attack-reticle`) is unaffected by this dismissal — only the hint **text line** fades; the reticle keeps its existing show/hide-with-hand behavior.
- Dismissal logic is implemented in testable functions (not inline-only), and `localStorage`/timer access is guarded so it cannot throw.
- Client tests cover: the timeout dismissal path, the attack+cast dismissal path (neither alone dismisses early), the persisted flag suppressing the hint on a second run for the same profile, and a new/empty profile re-showing the hint.

## Technical Specs

- `game/client/main.js`:
  - Add a small dismissal module/helpers near `setAttackAffordanceVisible` (main.js:253–295), e.g. `isAttackHintSeen(playerId)`, `markAttackHintSeen(playerId)`, `startAttackHintDismissTimer()`, `noteAttackHintProgress({ attacked, casted })`, and a CSS fade applied via a class toggle on `attackHintEl`.
  - Gate the hint's initial visibility in `showCardHand` / `setAttackAffordanceVisible(true)` (main.js:254–289) on `!isAttackHintSeen(currentPlayerId)`; keep showing the reticle regardless.
  - Use the stored player id (`STORAGE_KEY_PLAYER_ID` / `getStoredPlayerId()` at main.js:1027) as the profile key for the `localStorage` flag.
  - Track a per-run "did basic attack" signal at the basic-attack site (the `pointerdown` → `useCard` path at main.js:4079–4086 and any gamepad attack path) and a "did cast" signal at the card-cast site; when both are true, dismiss and mark seen. Reset these per-run flags when the hand is shown for a new run.
  - On `hideCardHand` (main.js:291–295) clear any pending dismiss timer.
- `game/client/index.html` / `game/client/style.css` (whichever holds `#attack-hint` styling): add a fade transition / `.attack-hint-dismissed` (or similar) class with an opacity transition, then `hidden`.
- Add a client test file under `game/client/test/` (e.g. `attack-hint-dismiss.test.js`) using fake timers and a mocked `localStorage` to cover the timeout path, the attack+cast path, persistence across a second run, and the fresh-profile re-show.
- Build on the text produced by sub-ticket 01 (`applyAttackHintText`); do not change WHAT the text says here, only WHEN it is shown/hidden.

## Verification: code
