# Cleanup nits from 306-restore-hp-healing-cards-keep-no-auto-level-heal

> **Staleness note.** This follow-up ticket was written against commit
> `020ab73f` (2026-06-07). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `306-restore-hp-healing-cards-keep-no-auto-level-heal`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Rename Stale Healing Metadata
`healing_font` and `divine_grace` now restore HP, but their shared `specialEffect` value is still `mana_restore`, and a client test asserts that stale value for Sanctum Pulse. Gameplay and rendering are already correct because dispatch keys by card id, but the metadata is misleading for future card work.
### Acceptance Criteria
- `game/shared/cardStats.json` uses HP-oriented `specialEffect` names for `healing_font` and `divine_grace`, or documents why the old token is intentionally retained.
- Client/server tests no longer describe HP healing cards with Magic Stone-oriented metadata.

## Refresh Field Medic Kit Debug Copy
The existing `medic-kit-ready` debug scenario comment still says it tests Field Medic Kit Magic Stone restore even though the key item now restores HP. This is harmless at runtime but confusing for QA and future scenario authors.
### Acceptance Criteria
- `game/server/debugScenarios.js` describes `medic-kit-ready` as an HP-heal scenario.
- Any test fixtures or comments that still describe Field Medic Kit as restoring Magic Stones are updated to HP wording.
