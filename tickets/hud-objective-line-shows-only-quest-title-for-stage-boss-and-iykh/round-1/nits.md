## Generic stage-boss completion copy
`THEME.objectives.stageBossDefeated` is hardcoded to "Warden defeated" for every `stage_boss` completion, including non-warden bosses (e.g. Annex Overseer, Plaza Sovereign). Use boss-specific or parameterized completion text.
### Acceptance Criteria
- When any `stage_boss` is defeated, the HUD second line shows a completion phrase that matches the boss identity (or a neutral "Boss defeated"), not always "Warden defeated".

## Survive progress strings outside THEME
`buildSurviveProgressSuffix` in `objectiveHud.js` hardcodes `Wave X / Y spawned` and `Purged X / Y hostiles` instead of using `THEME.objectives` keys like the escort and stage-boss branches.
### Acceptance Criteria
- Survive HUD progress copy is driven from `theme.json` (or shared helpers) so wording can be tuned without editing formatter logic.

## Harness capture plan for objective-type tickets
Round-1 fallback capture exercised Initiate Vault (`defeat_enemies`) only; it did not deploy Frost Crossing, Annex Evacuation, or Endless Siege to visually verify the ticket's primary objective types in-browser.
### Acceptance Criteria
- For tickets touching `#objective-hud`, the harness capture plan (or agent-guided scenarios) includes at least one in-browser run per newly wired objective type, with probe assertions on HUD `bodyText`.

## Collect HUD shows progress only, not goal text
`collect_items` renders `{collected}/{total} prisms` on line 2 but omits the quest-board goal ("Recover N prisms") that other types now embed in the combined second line. Behavior is unchanged and acceptable, but inconsistent with stage_boss/escort/survive formatting.
### Acceptance Criteria
- During a `collect_items` run, `#objective-hud` second line includes both the recover goal and live collection count (e.g. `Recover 5 prisms — 2/5 collected`), matching the pattern used for other objective types.
