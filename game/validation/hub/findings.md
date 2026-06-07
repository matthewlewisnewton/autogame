# Hub validation findings

**Outcome:** PASS
**Preset:** hub

## Assertions

- **boothDeductsGold**: PASS — paid 1000→975 (Δ-25), hat 975→975 (Δ0)
- **hatSwapFree**: PASS — paid 1000→975 (Δ-25), hat 975→975 (Δ0)
- **telepipeVitalsPreserved**: PASS — preSuspend hp=100, ms=3.1250000000017346; postDeploy hp=100, ms=3.3650000000017295; runId e0ea56dc-05b5-4298-ba46-79a00656e6c3→9ef2fd1d-040e-4094-910f-15e4a314768e (changed); checkpoint restored in log: no

## Walkable presentation

- **overview**: lobbyHidden=true, lobbyMenuDismissed=true, hubCanvasActive=true, playersOnHost=2 remoteSquadmateCount=1
- **operations**: lobbyHidden=true, lobbyMenuDismissed=true, hubCanvasActive=true, playersOnHost=2 remoteSquadmateCount=1
- **commerce**: lobbyHidden=true, lobbyMenuDismissed=true, hubCanvasActive=true, playersOnHost=2 remoteSquadmateCount=1
- **salon**: lobbyHidden=true, lobbyMenuDismissed=true, hubCanvasActive=true, playersOnHost=2 remoteSquadmateCount=1
- **3D hub visible with menu closed**: Yes — lobby hidden, menu dismissed, and canvas active on overview and all zone walk captures.
- **Menu dominance on walk captures**: None observed.
- **Party-mates in-world**: Yes — 2 players on host and 1 remote squadmate(s) in harness.

## Hub walk notes

- Lobby: Hub Walk 1780793663705
- Players on host at end: 2
- Layout profile: hub
- Hub room count: 3
- operations: `game/validation/hub/02-room-operations.png`
- commerce: `game/validation/hub/03-room-commerce.png`
- salon: `game/validation/hub/04-room-salon.png`

## Console / page errors

None observed.

## Screenshots

- `game/validation/hub/01-hub-overview.png`
- `game/validation/hub/02-room-operations.png`
- `game/validation/hub/03-room-commerce.png`
- `game/validation/hub/04-room-salon.png`
- `game/validation/hub/05-booth-paid.png`
- `game/validation/hub/06-hat-swap.png`
- `game/validation/hub/07-telepipe-before.png`
- `game/validation/hub/08-telepipe-after.png`
- `game/validation/hub/09-lobby-finder.png`

## Follow-ups

None — green run.
