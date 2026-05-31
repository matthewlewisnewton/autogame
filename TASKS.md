# Tasks

Top-level tickets, processed top-to-bottom by `harness/run_backlog.sh`. Each is
decomposed by qwen into sub-tickets, built and QA'd by the qwen+gemini loop,
then reviewed as a whole by a difficulty-routed reviewer (easy: composer-2.5,
medium: gpt-5.5-medium-fast, hard: gpt-5.5-extra-high). Each ticket must declare
`## Difficulty: easy|medium|hard`. Order roughly respects dependencies.

Completed tickets are archived in [TASKS_ARCHIVE.md](TASKS_ARCHIVE.md).

## Backlog — Sloped Floors
- [ ] [142-cleanup-sloped-floor-layout-and-geometry](tickets/142-cleanup-sloped-floor-layout-and-geometry/)
- [ ] [139-harness-misclassifies-pageerror](tickets/139-harness-misclassifies-pageerror/)
- [ ] [117-sloped-movement-server-and-client](tickets/117-sloped-movement-server-and-client/)

## Backlog — Key Items (Foundation)
- [ ] [118-key-item-data-and-persistence](tickets/118-key-item-data-and-persistence/)
- [ ] [119-key-item-input-bindings-and-settings](tickets/119-key-item-input-bindings-and-settings/)
- [ ] [120-key-item-lobby-equip-ui](tickets/120-key-item-lobby-equip-ui/)

## Backlog — Key Items (Abilities)
- [ ] [121-key-item-dodge-roll](tickets/121-key-item-dodge-roll/)
- [ ] [122-key-item-summon-recall](tickets/122-key-item-summon-recall/)
- [ ] [123-key-item-field-medic-kit](tickets/123-key-item-field-medic-kit/)
- [ ] [124-key-item-guard-block](tickets/124-key-item-guard-block/)
- [ ] [125-key-item-flare-beacon](tickets/125-key-item-flare-beacon/)
- [ ] [126-key-item-loot-magnet](tickets/126-key-item-loot-magnet/)
- [ ] [127-key-item-overclock](tickets/127-key-item-overclock/)
- [ ] [128-key-item-smoke-bomb](tickets/128-key-item-smoke-bomb/)
- [ ] [129-key-item-ground-anchor](tickets/129-key-item-ground-anchor/)
- [ ] [130-key-item-phase-step](tickets/130-key-item-phase-step/)
- [ ] [131-key-item-purge-charm](tickets/131-key-item-purge-charm/)
- [ ] [132-key-item-echo-strike](tickets/132-key-item-echo-strike/)
- [ ] [133-key-item-barrier-dome](tickets/133-key-item-barrier-dome/)
- [ ] [134-key-item-rally-cry](tickets/134-key-item-rally-cry/)

## Backlog — World Stages
- [ ] [135-world-open-plaza-stage](tickets/135-world-open-plaza-stage/)
- [ ] [136-world-spire-ascent-stage](tickets/136-world-spire-ascent-stage/)
- [ ] [137-world-sunken-canyon-stage](tickets/137-world-sunken-canyon-stage/)
