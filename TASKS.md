# Tasks

Top-level tickets, processed top-to-bottom by `harness/run_backlog.sh`. Each is
decomposed by qwen into sub-tickets, built and QA'd by the qwen+gemini loop,
then reviewed as a whole by claude. Order roughly respects dependencies.

## Backlog — Server Foundation
- [x] [001-server-heartbeat](tickets/001-server-heartbeat/)
- [x] [002-input-validation](tickets/002-input-validation/)
- [x] [005-vite-socket-proxy](tickets/005-vite-socket-proxy/)

## Backlog — Client Foundation
- [x] [003-move-delta-time](tickets/003-move-delta-time/)
- [x] [004-client-reconnect-ui](tickets/004-client-reconnect-ui/)
- [x] [007-camera-follow](tickets/007-camera-follow/)

## Backlog — Lobby & HUD
- [x] [006-card-deck-ui](tickets/006-card-deck-ui/)
- [x] [008-lobby-screen](tickets/008-lobby-screen/)

## Backlog — Combat
- [x] [009-player-health-system](tickets/009-player-health-system/)
- [x] [010-enemy-entities-ai](tickets/010-enemy-entities-ai/)
- [x] [011-card-hand-system](tickets/011-card-hand-system/)
- [x] [012-weapon-card-attacks](tickets/012-weapon-card-attacks/)
- [x] [013-summon-cards](tickets/013-summon-cards/)
- [x] [014-monster-summon-cards](tickets/014-monster-summon-cards/)

## Backlog — World & Economy
- [x] [016-loot-and-currency](tickets/016-loot-and-currency/)

## Backlog — Testing
- [x] [017-test-coverage](tickets/017-test-coverage/)

## Backlog — Playability
- [x] [025-dungeon-run-objectives](tickets/025-dungeon-run-objectives/)
- [x] [027-run-summary-return-to-lobby](tickets/027-run-summary-return-to-lobby/)
- [x] [026-card-rewards-deckbuilding](tickets/026-card-rewards-deckbuilding/)
- [x] [028-lobby-deck-editor](tickets/028-lobby-deck-editor/)
- [x] [029-combat-feedback-readability](tickets/029-combat-feedback-readability/)
- [x] [015-dungeon-room-generation](tickets/015-dungeon-room-generation/)
- [x] [037-fix-return-to-lobby-active-run-guard](tickets/037-fix-return-to-lobby-active-run-guard/)
- [x] [038-fix-card-cooldown-enforcement](tickets/038-fix-card-cooldown-enforcement/)
- [x] [030-encounter-telegraphs-audio](tickets/030-encounter-telegraphs-audio/)

## Backlog — Housekeeping & Planning
- [ ] [052-cleanup-cleanup-loot-and-currency](tickets/052-cleanup-cleanup-loot-and-currency/)
- [x] [051-cleanup-cleanup-public-state-and-shared-data-nits](tickets/051-cleanup-cleanup-public-state-and-shared-data-nits/)
- [x] [050-cleanup-cleanup-cleanup-encounter-telegraphs-audio](tickets/050-cleanup-cleanup-cleanup-encounter-telegraphs-audio/)
- [x] [049-cleanup-cleanup-encounter-telegraphs-audio](tickets/049-cleanup-cleanup-encounter-telegraphs-audio/)
- [x] [045-cleanup-dungeon-room-generation](tickets/045-cleanup-dungeon-room-generation/)
- [x] [044-cleanup-encounter-telegraphs-audio](tickets/044-cleanup-encounter-telegraphs-audio/)
- [x] [039-cleanup-public-state-and-shared-data-nits](tickets/039-cleanup-public-state-and-shared-data-nits/)
- [x] [036-cleanup-combat-feedback-readability](tickets/036-cleanup-combat-feedback-readability/)
- [x] [035-cleanup-lobby-deck-editor](tickets/035-cleanup-lobby-deck-editor/)
- [x] [034-cleanup-card-rewards-deckbuilding](tickets/034-cleanup-card-rewards-deckbuilding/)
- [x] [033-cleanup-run-summary-return-to-lobby](tickets/033-cleanup-run-summary-return-to-lobby/)
- [x] [032-cleanup-dungeon-run-objectives](tickets/032-cleanup-dungeon-run-objectives/)
- [x] [031-cleanup-test-coverage](tickets/031-cleanup-test-coverage/)
- [x] [023-cleanup-loot-and-currency](tickets/023-cleanup-loot-and-currency/)
- [ ] [018-pnpm-and-security](tickets/018-pnpm-and-security/)
- [ ] [019-codebase-cleanup](tickets/019-codebase-cleanup/)
- [ ] [020-audit-client-server](tickets/020-audit-client-server/)
- [ ] [021-persistence](tickets/021-persistence/)
- [ ] [022-user-accounts](tickets/022-user-accounts/)
- [ ] [023-advanced-map-generation](tickets/023-advanced-map-generation/)
- [ ] [024-entity-ai-improvements](tickets/024-entity-ai-improvements/)
- [ ] [046-cleanup-audio-autoplay-resume-and-mute-persistence](tickets/046-cleanup-audio-autoplay-resume-and-mute-persistence/)
- [ ] [047-cleanup-monolithic-gameplay-and-server-split](tickets/047-cleanup-monolithic-gameplay-and-server-split/)
- [ ] [048-cleanup-server-side-movement-and-collision-validation](tickets/048-cleanup-server-side-movement-and-collision-validation/)

## Backlog — Reference Game Loops
- [ ] [040-lobby-quest-board](tickets/040-lobby-quest-board/)
- [ ] [041-quest-scoped-party-runs](tickets/041-quest-scoped-party-runs/)
- [ ] [042-enemy-card-drops](tickets/042-enemy-card-drops/)
- [ ] [043-lobby-card-sell-and-trade](tickets/043-lobby-card-sell-and-trade/)

## Done
