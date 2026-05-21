# Tasks

Top-level tickets, processed top-to-bottom by `harness/run_backlog.sh`. Each is
decomposed by qwen into sub-tickets, built and QA'd by the qwen+gemini loop,
then reviewed as a whole by a difficulty-routed reviewer (easy: composer-2.5,
medium: gpt-5.5-medium-fast, hard: gpt-5.5-extra-high). Each ticket must declare
`## Difficulty: easy|medium|hard`. Order roughly respects dependencies.

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
- [x] [077-enemy-types-skirmisher-miniboss](tickets/077-enemy-types-skirmisher-miniboss/)
- [x] [078-enemy-type-spawner](tickets/078-enemy-type-spawner/)

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
- [x] [058-reset-state-on-last-disconnect](tickets/058-reset-state-on-last-disconnect/)

## Backlog — Housekeeping & Planning
- [ ] [096-cleanup-cleanup-cleanup-cleanup-cleanup-cleanup-audit-client-server](tickets/096-cleanup-cleanup-cleanup-cleanup-cleanup-cleanup-audit-client-server/)
- [x] [095-cleanup-cleanup-cleanup-cleanup-cleanup-audit-client-server](tickets/095-cleanup-cleanup-cleanup-cleanup-cleanup-audit-client-server/)
- [x] [094-cleanup-cleanup-cleanup-cleanup-audit-client-server](tickets/094-cleanup-cleanup-cleanup-cleanup-audit-client-server/)
- [x] [093-cleanup-cleanup-cleanup-audit-client-server](tickets/093-cleanup-cleanup-cleanup-audit-client-server/)
- [x] [092-cleanup-cleanup-audit-client-server](tickets/092-cleanup-cleanup-audit-client-server/)
- [x] [091-cleanup-audit-client-server](tickets/091-cleanup-audit-client-server/)
- [x] [090-cleanup-cleanup-cleanup-codebase-cleanup](tickets/090-cleanup-cleanup-cleanup-codebase-cleanup/)
- [x] [089-cleanup-cleanup-codebase-cleanup](tickets/089-cleanup-cleanup-codebase-cleanup/)
- [x] [088-cleanup-codebase-cleanup](tickets/088-cleanup-codebase-cleanup/)
- [x] [087-cleanup-cleanup-pnpm-and-security](tickets/087-cleanup-cleanup-pnpm-and-security/)
- [x] [086-cleanup-pnpm-and-security](tickets/086-cleanup-pnpm-and-security/)
- [x] [085-cleanup-cleanup-enemy-types-skirmisher-miniboss](tickets/085-cleanup-cleanup-enemy-types-skirmisher-miniboss/)
- [x] [084-cleanup-cleanup-cleanup-enemy-type-spawner](tickets/084-cleanup-cleanup-cleanup-enemy-type-spawner/)
- [x] [083-cleanup-cleanup-enemy-type-spawner](tickets/083-cleanup-cleanup-enemy-type-spawner/)
- [x] [082-cleanup-reset-state-on-last-disconnect](tickets/082-cleanup-reset-state-on-last-disconnect/)
- [x] [081-cleanup-enemy-type-spawner](tickets/081-cleanup-enemy-type-spawner/)
- [x] [080-cleanup-enemy-types-skirmisher-miniboss](tickets/080-cleanup-enemy-types-skirmisher-miniboss/)
- [x] [052-cleanup-cleanup-loot-and-currency](tickets/052-cleanup-cleanup-loot-and-currency/)
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
- [x] [018-pnpm-and-security](tickets/018-pnpm-and-security/)
- [x] [019-codebase-cleanup](tickets/019-codebase-cleanup/)
- [x] [020-audit-client-server](tickets/020-audit-client-server/)
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

## Backlog — Visual Fidelity & Polish
- [ ] [053-pso-vanguard-hud](tickets/053-pso-vanguard-hud/)
- [ ] [054-grimoire-deck-viewer](tickets/054-grimoire-deck-viewer/)

## Backlog — Validation & Logic
- [ ] [055-server-side-wall-collision-validation](tickets/055-server-side-wall-collision-validation/)
- [ ] [056-server-side-card-hand-tracking](tickets/056-server-side-card-hand-tracking/)
- [ ] [057-deck-depletion-fail-condition](tickets/057-deck-depletion-fail-condition/)

## Backlog — Progression & Content
- [ ] [058-inventory-system-refactor](tickets/058-inventory-system-refactor/)
- [ ] [059-lobby-photon-forge-ui](tickets/059-lobby-photon-forge-ui/)
- [ ] [060-card-grinding-system](tickets/060-card-grinding-system/)
- [ ] [061-new-card-pack](tickets/061-new-card-pack/)
- [ ] [062-card-evolution-system](tickets/062-card-evolution-system/)
- [ ] [079-synergistic-cards](tickets/079-synergistic-cards/)


## Backlog — Card Evolutions
- [ ] [063-evo-steel-claymore](tickets/063-evo-steel-claymore/)
- [ ] [064-evo-magma-greatsword](tickets/064-evo-magma-greatsword/)
- [ ] [065-evo-astral-guardian](tickets/065-evo-astral-guardian/)
- [ ] [066-evo-ancient-wyrm](tickets/066-evo-ancient-wyrm/)
- [ ] [067-evo-excalibur-photon](tickets/067-evo-excalibur-photon/)
- [ ] [068-evo-infinite-disk](tickets/068-evo-infinite-disk/)
- [ ] [069-evo-glacier-collapse](tickets/069-evo-glacier-collapse/)
- [ ] [070-evo-divine-grace](tickets/070-evo-divine-grace/)
- [ ] [071-evo-undead-commander](tickets/071-evo-undead-commander/)
- [ ] [072-evo-thunderbird](tickets/072-evo-thunderbird/)
- [ ] [073-evo-event-horizon](tickets/073-evo-event-horizon/)
- [ ] [074-evo-resonance-edge](tickets/074-evo-resonance-edge/)
- [ ] [075-evo-soul-drain](tickets/075-evo-soul-drain/)
- [ ] [076-evo-inferno-pillar](tickets/076-evo-inferno-pillar/)

## Done
