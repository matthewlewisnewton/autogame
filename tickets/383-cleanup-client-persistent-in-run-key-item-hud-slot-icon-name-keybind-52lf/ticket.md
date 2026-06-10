# Cleanup nits from client-persistent-in-run-key-item-hud-slot-icon-name-keybind-52lf

> **Staleness note.** This follow-up ticket was written against commit
> `23071250` (2026-06-10). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `client-persistent-in-run-key-item-hud-slot-icon-name-keybind-52lf`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Move Key Item HUD Away From Toolbar
The key item HUD currently anchors near the upper-right app toolbar. It is still functional and visible in the captured run, but the slot shares visual space with account/settings buttons and would be easier to read if it had its own clear HUD position.

### Acceptance Criteria
- The key item HUD no longer overlaps or visually competes with the upper-right app toolbar at the default 1024x640 capture size.
- Ready and cooldown states remain visible with the key item name, icon, keybind, and countdown.
