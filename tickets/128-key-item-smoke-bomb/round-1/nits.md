## Align smoke VFX radius with server zone radius

Client `SMOKE_BOMB_RADIUS` is `3` in `renderer.js` while the server def uses `radius: 4`, so the fog mesh reads smaller than the actual suppression disk.

### Acceptance Criteria

- `triggerSmokeBombVFX` uses the same radius constant as `KEY_ITEM_DEFS.smoke_bomb.radius` (or a shared documented value of `4`).
- Visual extent roughly matches `isInSmokeZone` gameplay radius in a manual cast.

## Update smoke_bomb key-item description text

`progression.js` still describes smoke bomb as "Become temporarily invisible"; behavior is a fixed ground fog zone that suppresses enemy targeting, not per-player invisibility.

### Acceptance Criteria

- `smoke_bomb.description` mentions a short-lived smoke zone and enemy detection loss (or similar accurate wording).
- No change to cooldown, duration, or radius numbers unless intentionally retuned.
