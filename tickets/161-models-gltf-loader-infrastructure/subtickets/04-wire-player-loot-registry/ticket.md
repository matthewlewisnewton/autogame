# Wire player and loot mesh creation to the model registry

Extend the registry consult pattern to local/remote player boxes and loot drops so every entity type named in the parent ticket uses the same glTF-or-procedural fallback path, with zero visual change while all registry paths remain `null`.

## Acceptance Criteria

- Player mesh creation in the `animate()` player-sync loop consults the `player` registry entry before building the blue/red box primitive.
- `createLootMesh(item)` consults registry keys `currency`, `crystal`, or `magic_stone` based on `item.kind` (default `currency`) before building procedural loot geometry/groups.
- With all registry paths still `null` and no `.glb` files present, the game renders **identically** to pre-ticket behavior (box players, cone/octahedron enemies, cylinder minions, bobbing loot).
- When a registry path is set but the asset is missing/broken, gameplay continues with procedural meshes; only a console warning appears.
- `cd game && pnpm test:quick` passes (full client + server suite).

## Technical Specs

- **Edit** `game/client/renderer.js`:
  - Reuse the async attach helper from sub-ticket 03 for player meshes (`playersMeshes[id]` creation block ~line 2693) and in `createLootMesh`.
  - **Player:** registry key `player`; fallback remains `BoxGeometry(1,1,1)` with blue (local) / red (remote) `MeshStandardMaterial`; preserve dead-state grey tinting and squash-and-stretch VFX compatibility on the placeholder/material hooks.
  - **Loot:** registry keys per kind; fallback keeps existing `currency` cylinder, `crystal` octahedron, and `magic_stone` group (gem + ring); preserve `userData` flags (`isCrystal`, `isMagicStone`, `lootKind`, `gemMesh`) on the fallback path so bob/collect animations still work.
  - Do not add `.glb` files or set non-null registry paths (that is ticket 162).

## Verification: code
