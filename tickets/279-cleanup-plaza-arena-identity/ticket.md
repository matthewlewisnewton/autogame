# Cleanup nits from 247-plaza-arena-identity

> **Staleness note.** This follow-up ticket was written against commit
> `0bc8b8a9` (2026-06-05). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `247-plaza-arena-identity`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Add Arena-Specific Visual Capture For Open-Plaza Tickets

The round-1 fallback capture proved the game starts and plays, but it used the default `training_caverns` crowded layout instead of selecting an `open-plaza` quest such as `arena_trials`. A ticket-specific capture would make future holistic reviews faster and provide direct visual evidence of the dais, center ring, perimeter decor, platforms, hazards, and varied cover in one run.

### Acceptance Criteria
- The capture path selects an `open-plaza` quest through normal quest selection or a debug-only QA scenario before readying up.
- The saved metrics/screenshots include at least one gameplay screenshot where the plaza dais, center ring, perimeter decor, raised platforms, hazards, and varied cover are visible.
