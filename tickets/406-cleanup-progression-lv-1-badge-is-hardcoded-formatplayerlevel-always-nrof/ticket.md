# Cleanup nits from progression-lv-1-badge-is-hardcoded-formatplayerlevel-always-nrof

> **Staleness note.** This follow-up ticket was written against commit
> `3932d590` (2026-06-11). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `progression-lv-1-badge-is-hardcoded-formatplayerlevel-always-nrof`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Player level should gate something meaningful

The level is now real, tracked, and displayed, but it is purely cosmetic — it
does not yet gate or influence any gameplay. The original ticket Goal suggested
levels could pace something (e.g. tier-2 unlock pacing or a small per-level
benefit), which would make the badge feel like genuine progression rather than
a counter. This is optional polish, not required by the acceptance criteria.

### Acceptance Criteria
- Player level influences at least one meaningful gameplay element (e.g. an
  unlock threshold, a stat nudge, or content pacing), wired server-side.
- The relationship is covered by a server test.

## Surface XP progress, not just the level number

The HUD shows only the integer level (`LV n`); the underlying `xp` is sent in
the snapshot but never visualized. A small XP-to-next-level indicator (bar or
tooltip) would make the badge readable as progression rather than a static
number between level-ups.

### Acceptance Criteria
- The portrait area conveys progress toward the next level (e.g. a thin bar or
  `xp / next` text) using the already-available snapshot `xp`/`level`.
- No regression to the existing `LV n` display.
