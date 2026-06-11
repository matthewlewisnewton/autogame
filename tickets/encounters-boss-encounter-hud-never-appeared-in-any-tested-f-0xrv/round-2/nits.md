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
