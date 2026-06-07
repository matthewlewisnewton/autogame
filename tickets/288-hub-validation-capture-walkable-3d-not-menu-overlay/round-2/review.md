# Senior review — 288-hub-validation-capture-walkable-3d-not-menu-overlay

## Runtime health (blocking pre-check) — PASS

The round-2 captured run starts and loads cleanly: `metrics.json` has
`"ok": true`, `pageerrors` is empty, no `harness_failure` block. `console.log`
has no `pageerror`/`[fatal]` lines. The hub-validation logs
(`game/validation/hub/console.log`, `server.log`) show only benign Vite
ws-connect debug and expected `[initScene]`/`[debugScenario]`/`[launchBooth]`
lines — no errors. `findings.md` records "Console / page errors: None
observed." The game is not broken.

## Ticket goal

281 captured every hub/room screenshot with the 2D "Lobby Connection" menu
open, so the walkable 3D hub and party-mate presence were never shown. This
ticket must fix the hub validation driver to dismiss the lobby menu and
capture the walkable 3D hub: a clean overview, the 3 rooms as walkable zones,
**and the 2 party-mates visible in-world** — the EVIDENCE explicitly states
"We cannot visually confirm the walkable hub *or party-mate presence* in 3D."
Scope: validation driver + `game/validation/hub/**`, no gameplay changes.

## Per-criterion findings

### Dismiss/close the lobby menu before hub captures — MET
`harness/validate/lib/multiPlayer.mjs` adds `dismissLobbyOverlay(page)`,
injecting `#lobby { display: none !important; }` and waiting (5s, descriptive
failure) for it to actually hide. `playthrough.mjs` calls it before the
overview and before each per-zone shot. Validation-only; production behavior
untouched by the dismiss path. The CSS-hide mirrors the visual end-state a
real player sees when the lobby menu is closed, so it does not bypass any
gameplay invariant.

### Walkable 3D hub overview — MET
`01-hub-overview.png` shows the 3D ship interior with no menu overlay: floor,
walls, the player avatar, and zone labels (Quest Board, Launch Bay, Shop).
PSO-style walkable presentation, exactly the fix for 281's menu-dominated
captures. `run-summary.json` confirms `layoutProfile: "hub"`,
`layoutRoomCount: 3`.

### 3 rooms (operations / commerce / salon) as walkable zones, menu closed — MET
`02-room-operations.png` (Quest Board / Launch Bay), `03-room-commerce.png`
(Shop / Deck Editor), `04-room-salon.png` (Character / Hats) are distinct 3D
zone captures with the menu dismissed. Driver walks the host to each zone
before capture; `run-summary.json` maps zones to the correct files.

### Booth / telepipe regression coverage — MET (unchanged, green)
boothDeductsGold (1000→975), hatSwapFree (975→975), telepipeUpReset (fresh
runId, MS reset) all PASS with refreshed screenshots 05–08. No regression.

### The 2 party-mates visible in-world — NOT MET (blocking)
This is the failing criterion. `run-summary.json` reports `playersOnHost: 2`
and the driver asserts the remote squadmate's position propagates to the host,
so a genuine **2-player party** (host + 1 joiner) does walk the hub. However,
the *deliverable of this ticket is the screenshots*, and across every hub
capture (01-04) **only the host avatar is ever visible** — the cyan-diamond
host marker with its nameplate. I zoomed the full mid-band of
`01-hub-overview.png` (taken right after both players spawn, when they should
be a few units apart and both in frame): no second avatar/nameplate appears.
The remaining hub shots are framed on the host walking to far zones, with the
joiner out of frame.

For a validation ticket whose sole purpose is *visual* confirmation, this
means the second of the two explicitly-stated subjects — "party-mate presence
in 3D" — is still not visually confirmed. The walkable-hub half is fixed; the
party-mate half is not.

NOTE on interpretation: a previous review failed this on the theory that "2
party-mates" requires two *remote* joiners (3 players total) and that the
driver should create a second joiner. That reading is wrong and should not be
acted on — the game's squad in this validation is a 2-player party, and "the 2
party-mates" means the two members of that party. The real gap is **framing**:
the captures never show both party members' avatars together, not the party
size.

### Land corrected screenshots — PARTIAL
The corrected, menu-free 3D screenshots are landed under
`game/validation/hub/`, but the overview (or a dedicated shot) must be
re-captured so both party members' avatars are visible in-world before this is
complete.

## Design / requirements consistency

Consistent with the PSO-style squad-hub design; no regression to 3D rendering,
networking, or movement sync. The only `game/` source edit is two defensive
`if (lobbyEl)` null guards in `main.js` (~lines 808, 1771) — see nits; harmless
and behavior-neutral, not a blocker.

## Remaining gaps

1. **Party-mate presence is not visually confirmed.** Every hub screenshot
   shows only the host avatar; the second party member never appears in frame,
   so the explicit "2 party-mates visible in-world" goal is unmet. The fix is
   framing/positioning in the validation driver, NOT adding a third player.
   See `gaps.md`.

Non-blocking nits (out-of-scope leftover null guards in `main.js`; party-mate
framing already folded into the gap above) are recorded in `nits.md`.

VERDICT: FAIL
