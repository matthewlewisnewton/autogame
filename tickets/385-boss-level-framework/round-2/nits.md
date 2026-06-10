## Add A Dedicated Boss-Arena Player Spawn

Dedicated boss arenas currently use the single room center as both the player run spawn and the `arena_dais` boss landmark. The encounter still works, but a small player-spawn landmark or offset would make boss-level starts feel cleaner and avoid spawning players directly on the boss.

### Acceptance Criteria
- Boss-arena layouts expose a deterministic player start position distinct from the `arena_dais`.
- Normal boss-level deploy places players at that start position while keeping the boss on the dais.
