1. Post-dodge harness probe shows no active cooldown (`keyItemCooldownRemaining: 0`, `keyItemIndicatorOnCooldown: false`) after 800 ms server cooldown was restored; fallback waits ~900 ms before probing.
   Files: `harness/screenshot.mjs` (`fallbackRecipe` `useKeyItem` / `wait` / post-dodge `probe` steps)
   Fix: Shorten post-dodge wait so probe runs while cooldown remains (e.g. `wait` 100–200 ms, or probe immediately after `useKeyItem`’s 400 ms settle) so `metrics.json` records `keyItemCooldownRemaining > 0` or `#key-item-indicator.cooldown` with `cooldownMs: 800`.
