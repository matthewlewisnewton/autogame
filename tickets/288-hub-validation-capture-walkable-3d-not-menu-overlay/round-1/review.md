# Senior review — 288-hub-validation-capture-walkable-3d-not-menu-overlay

## Runtime health (gate)

- `round-1/metrics.json`: `"ok": true`, `pageerrors: []`, servers started, scene
  initialized, two clients connected. No `harness_failure` block.
- `round-1/console.log`: only `[vite] connecting/connected`, `initScene`,
  `launchBooth ready-up`, plus one `[A:error] Failed to load resource: 409
  (Conflict)`. The 409 is a benign auth register-then-login retry (username
  already exists), not a game-code page error — `pageerrors.json` is `[]`.
- `game/validation/hub/console.log`: clean — only vite/initScene/debugScenario
  lines, `findings.md` reports "Console / page errors: None observed."

The game starts and loads cleanly. Runtime gate passes.

## Per-criterion findings

Derived from the Goal/FIX (the ticket has no explicit `## Acceptance Criteria`):

1. **Dismiss the lobby menu before hub capture** — MET (mechanism works).
   `harness/validate/lib/multiPlayer.mjs` adds `dismissLobbyOverlay(page)` which
   hides `#lobby` and waits for `display:none`; `playthrough.mjs` calls it before
   the overview and each zone screenshot.

2. **Clean overview of the walkable 3D hub** — MET.
   `01-hub-overview.png` shows the 3D ship floor with Quest Board / Shop /
   Launch Bay zone labels and a player nameplate, NO 2D "Lobby Connection" menu
   overlay. Contrast the old 233 KB menu-dominated capture vs the new 41 KB 3D
   capture.

3. **Each of the 3 rooms (operations / commerce / salon) as walkable zones with
   the menu closed** — MET.
   - `02-room-operations.png`: Quest Board zone, menu dismissed.
   - `03-room-commerce.png`: Shop / Deck Editor zone, menu dismissed.
   - `04-room-salon.png`: Character / Hats zone, menu dismissed.

4. **Both party-mates visible in-world** — MET.
   `03-room-commerce.png` shows two nameplates side by side (`hub-host-…` and
   `hub-joiner-…`); `run-summary.json` reports `playersOnHost: 2`.

5. **Re-run and land corrected screenshots under game/validation/hub/** — MET.
   Screenshots 01–09 regenerated; `findings.md`/`run-summary.json` updated;
   booth/telepipe assertions still PASS. Consistent with design.md (lobby is a
   3D multiplayer space before deployment); no baseline regression.

6. **"No gameplay changes" / scope = validation driver + outputs only** — NOT MET.
   The implementation modifies production client code `game/client/main.js`
   (~40 lines): a `MutationObserver` on `#lobby` that sets a sticky global
   `window.__testKeepLobbyDismissed`, a `withLobbyGuard()` wrapper applied to
   seven `lobbyEl.classList.add('hidden')` sites, and a new guard in
   `showGameLobby()` (`if (lobbyEl && !window.__testKeepLobbyDismissed)`).

   This exists solely so the harness's external `.hidden` survives the ~20Hz
   STATE_UPDATE re-show. It is a test-only affordance baked into the production
   client, which the ticket explicitly excluded ("No gameplay changes"; scope is
   the validation driver + outputs). A harness-only solution exists and is
   cleaner: inject `#lobby { display: none !important }` (via `page.addStyleTag`
   / init script) on the throwaway capture pages — `!important` beats the class
   toggle, so no production code needs to change.

   I traced every lobby show/hide site: all game-side hides are wrapped in
   `withLobbyGuard` and the only `remove('hidden')` is the gated `showGameLobby`,
   so the path is *inert during normal play today*. But it is fragile: the global
   is unnamespaced, the observer runs on every page load, and if any future code
   ever adds `.hidden` to `#lobby` outside `withLobbyGuard` (or anything sets the
   global), the lobby would silently never re-show — a latent regression planted
   in production for a screenshot. It is also not gated by a URL parameter or a
   localhost/dev path; the only thing preventing it from firing is that nothing
   external hides `#lobby` in normal play. Combined with the explicit scope ban
   and the project norm that out-of-scope diffs block, this is a blocking gap.

## Debug scenarios

No new `?debugScenario=NAME` shortcut was added or changed by this ticket. The
existing debug scenarios used by the hub validation run remain test/localhost
helpers and are unaffected.

## Remaining gaps

- **Blocking:** production gameplay code (`game/client/main.js`) was modified to
  serve the validation capture, violating the ticket's explicit "No gameplay
  changes" scope. The dismissal must be owned entirely by the harness. See
  `gaps.md`.

The visual deliverable itself is excellent and fully satisfies the hub-capture
goal; the failure is purely the out-of-scope production-code change, which must
move into the harness before this lands.

VERDICT: FAIL
