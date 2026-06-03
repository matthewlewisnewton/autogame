## Stale comment in attachRegistryModel claims all registry paths are null
The doc comment on `attachRegistryModel` (game/client/renderer.js ~line 346-347)
still says "In this sub-ticket every registry path is null, so the early return
always fires and visuals are byte-identical to before." That was true in ticket
187's first pass but is now false — `player` maps to `/models/player.glb` and the
load branch (model swap, body retarget, hat attach) is the live path. The stale
comment is misleading to the next reader.
### Acceptance Criteria
- The `attachRegistryModel` doc comment accurately describes that at least the
  `player` key now resolves to a real model and runs the swap/attach branch.

## Pending load callback can attach a hat to an already-disposed avatar
On a rapid equip change the old avatar is disposed and removed from the scene,
but its in-flight `loadModel(...).then` may still run `attachGltfHat` on the
detached model. It is harmless today (the group is no longer in the scene and is
GC'd), but it does a little wasted work and could mask future bugs.
### Acceptance Criteria
- The load callback no-ops (or is cancelled) when its host avatar has already been
  disposed/removed, so no hat is built for a dead avatar.
