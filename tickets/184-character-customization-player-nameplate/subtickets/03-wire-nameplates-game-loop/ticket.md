# Wire nameplates into the game loop

Integrate nameplate creation, positioning, and cleanup into the per-frame player update loop so every visible player has a nameplate floating above their avatar.

## Acceptance Criteria
- Every non-self player in `gs.players` who has a `playersMeshes[id]` avatar also has a nameplate sprite created and positioned above the avatar's head.
- The local player (`myId`) also gets a nameplate showing their own username.
- Nameplates are positioned at the avatar group's Y position plus a vertical offset (~1.0 unit above avatar top), keeping the sprite centered on the player's X/Z.
- When a player leaves (no longer in `gs.players`), their nameplate is disposed and removed from the scene.
- Nameplate text is updated when a player's `username` changes between snapshots (re-creates the sprite with new text).
- Nameplates use `depthTest: false` or are rendered in front so they remain visible through walls/obstacles at typical camera angles.
- Tests pass (`pnpm test` from `game/`).

## Technical Specs
- `game/client/renderer.js`:
  - In the game-loop player update section (~line 3780–3840 where `playersMeshes` are iterated), after the avatar is ensured to exist, ensure a nameplate exists:
    - If `playerNameplates[id]` is absent but `pData.username` is truthy, call `createNameplate(pData.username)`, add to scene, store in `playerNameplates[id]`.
    - If `playerNameplates[id]` exists but `pData.username` differs from the sprite's stored username (track in `sprite.userData.username`), dispose old and create new.
    - Position: `sprite.position.set(avatarGroup.position.x, avatarGroup.position.y + NAMEPLATE_OFFSET_Y, avatarGroup.position.z)` where `NAMEPLATE_OFFSET_Y ≈ 1.0` (adjustable constant).
  - After the player iteration loop, clean up nameplates for any player IDs in `playerNameplates` that are no longer in `gs.players` (call `disposeNameplate(id)`).
  - For the self-player (`myId`), use `cachedProfile.username` from `settings.js` as the nameplate text (available via the existing `getAccountProfile()`).

## Verification: code
