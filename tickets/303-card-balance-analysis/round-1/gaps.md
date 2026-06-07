1. The final card-balance report is stale relative to the committed metrics snapshot, so it does not identify every current outlier.
   Files: `game/validation/card-balance/report.md`, `game/validation/card-balance/metrics-snapshot.json`
   Fix: Refresh the per-card table, Outliers section, Snapshot reference, and recommendations against the final snapshot; include current flags such as `deck_sifter` and `frost_nova`, remove resolved flags such as `purifying_pulse`/`saber_of_light`, and report `rewardOrderCollisions: []`.
