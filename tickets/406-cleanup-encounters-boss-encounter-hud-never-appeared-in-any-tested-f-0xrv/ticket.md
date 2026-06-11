# Cleanup nits from encounters-boss-encounter-hud-never-appeared-in-any-tested-f-0xrv

> **Staleness note.** This follow-up ticket was written against commit
> `6b903e22` (2026-06-11). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `encounters-boss-encounter-hud-never-appeared-in-any-tested-f-0xrv`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Boss-active validation screenshot shows a near-empty HP bar

The `06-boss-active.png` boss-HUD proof is captured with the warden pinned to
1 HP (`frost-crossing-boss-low-hp`), so the HP fill reads `hpFillWidthPct: 0`
— the bar is present but visually empty, which under-sells the "draining HP
bar" the ticket describes. A still captured while the boss still has a healthy
fraction of HP (or an additional mid-drain frame) would make the HUD proof more
convincing. HP tracking itself is already covered by the client wiring tests,
so this is cosmetic.

### Acceptance Criteria
- The ice-preset boss-active screenshot (or an added mid-fight frame) shows the
  `#boss-encounter-hp-fill` bar at a visibly non-zero, partial width.
- The validation findings/probes record a `hpFillWidthPct` greater than 0 for
  at least one boss-encounter HUD capture.
