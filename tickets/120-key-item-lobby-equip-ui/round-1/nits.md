## Lobby tab test omits Key Items panel

The existing `setLobbyTab` integration test in `main.test.js` covers shop, forge, economy, and deck but not `keyitems`. Adding Key Items would lock in panel visibility wiring alongside the other lobby tabs.
### Acceptance Criteria
- `setLobbyTab('keyitems')` shows `#key-item-loadout`, hides `#deck-editor` and other tab panels, and marks `#lobby-tab-keyitems` active.

## Harness capture did not screenshot Key Items tab

Round-1 used fallback smoke (lobby → deploy → movement). Ticket verification asked for a lobby screenshot with a selected key item; no capture step opened the Key Items tab.
### Acceptance Criteria
- Agent-guided or scripted capture opens the Key Items tab and saves a screenshot with an equipped row visible (e.g. dodge_roll highlighted).
