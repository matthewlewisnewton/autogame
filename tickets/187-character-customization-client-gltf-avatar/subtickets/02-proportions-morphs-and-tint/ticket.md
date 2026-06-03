# Apply proportion morph influences and body/accent tint to the glTF avatar

With the glTF player model loading and seated (sub-ticket 01), drive its six
proportion morph-target influences from the player's `cosmetic.proportions{}`
(1:1 by identical name, no rename layer) and tint its materials from
`bodyColor` / `accentColor`. Updates apply live when a player's broadcast
cosmetic changes, and degrade safely to the procedural primitive fallback.

## Acceptance Criteria
- Each of the six proportion keys maps 1:1 by IDENTICAL string name onto the
  loaded model's morph targets:
  `height`, `headSize`, `torsoWidth`, `armLength`, `legLength`, `shoulderWidth`.
  The code uses `proportions[key]` →
  `skinnedMesh.morphTargetInfluences[skinnedMesh.morphTargetDictionary[key]]`
  with no alias/translation table (per `game/docs/MODEL_SPIKE.md`).
- A missing or partial `proportions` object is handled gracefully: absent keys
  leave that target at the rest influence (effectively the 1.0 default) rather
  than throwing or applying `undefined`.
- The loaded model's body material is tinted from `cosmetic.bodyColor` and its
  accent material from `cosmetic.accentColor` (falling back to the existing
  `DEFAULT_AVATAR_BODY_COLOR` / `DEFAULT_AVATAR_ACCENT_COLOR` when invalid), so
  the in-world glTF avatar shows the same colors as the procedural primitive
  did. The dead/flash/invuln recolor paths from sub-ticket 01 still win when
  active (apply tint to the same material those paths target).
- Proportion and color changes take effect when a player's broadcast cosmetic
  changes WITHOUT requiring a page reload — influences/tint are (re)applied on
  cosmetic change in the per-frame player update loop, not only at first build.
  Because `cosmeticSignature` does not currently include `proportions`, either
  add `proportions` to the signature (rebuild) or re-apply morph influences each
  update on the existing mesh; pick one and apply it for both local and remote
  players.
- Fallback safety: when the glTF model is absent (procedural primitive in use),
  morph/tint application is a no-op that does not throw (guard on the presence
  of `morphTargetDictionary` / the loaded mesh).
- Existing tests still pass (`pnpm test:quick` from `game/`).

## Technical Specs
- `game/client/renderer.js`:
  - Add a helper (e.g. `applyProportionMorphs(skinnedMesh, proportions)`) that
    iterates the six keys from `MODEL_SPIKE.md`, looks each up in
    `morphTargetDictionary`, and writes `morphTargetInfluences[idx]` when the
    key is present and the value is a finite number; skips unknown keys.
  - Add color tint application against the loaded skinned mesh's material(s),
    reusing `avatarColorHex` / `HEX_COLOR_RE` and the existing default color
    constants. If the model exposes a single material, tint body from
    `bodyColor`; map the accent color to the accent material/submesh if one is
    distinguishable, else document that accent maps to the available accent
    material (do not invent a second mesh).
  - Wire both into the player update path around the existing block that builds
    avatars and recolors for `dead`/`baseColor` (the `for (const [id, pData] of
    Object.entries(gs.players))` loop and the local-player branch), so morph +
    tint are (re)applied from `pData.cosmetic` for local and remote players each
    relevant frame/cosmetic change.
  - Read proportion key names from a single shared list (mirror the spike
    contract; keep it case-sensitive and rename-free).
- Server already sanitizes/persists/broadcasts `cosmetic.proportions{}` (ticket
  186) — do not change server schema here.
- This builds on sub-ticket 01; it must remain a safe no-op when the procedural
  fallback is active.

## Verification: code
