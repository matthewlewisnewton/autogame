# Cleanup nits from 120-key-item-lobby-equip-ui

> **Staleness note.** This follow-up ticket was written against commit
> `4eb4810` (2026-05-31). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `120-key-item-lobby-equip-ui`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Lobby tab test omits Key Items panel

The existing `setLobbyTab` integration test in `main.test.js` covers shop, forge, economy, and deck but not `keyitems`. Adding Key Items would lock in panel visibility wiring alongside the other lobby tabs.
### Acceptance Criteria
- `setLobbyTab('keyitems')` shows `#key-item-loadout`, hides `#deck-editor` and other tab panels, and marks `#lobby-tab-keyitems` active.

## Harness capture did not screenshot Key Items tab

Round-1 used fallback smoke (lobby → deploy → movement). Ticket verification asked for a lobby screenshot with a selected key item; no capture step opened the Key Items tab.
### Acceptance Criteria
- Agent-guided or scripted capture opens the Key Items tab and saves a screenshot with an equipped row visible (e.g. dodge_roll highlighted).
