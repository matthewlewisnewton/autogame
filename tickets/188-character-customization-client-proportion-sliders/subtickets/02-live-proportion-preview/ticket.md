# Live proportion preview on the customization avatar

Make the Account-overlay avatar preview reflect proportion changes live: as a
proportion slider moves, the previewed glTF model's morph-target influences
update immediately (no save, no reopen), driven by the same selection the
sliders write.

## Acceptance Criteria
- The preview avatar's morph-target influences are set from the current
  proportion selection, mapping `proportions[key]` →
  `morphTargetInfluences[morphTargetDictionary[key]]` using the **identical**
  six key strings (`height`, `headSize`, `torsoWidth`, `armLength`, `legLength`,
  `shoulderWidth`) with no alias/translation table.
- Moving a proportion slider updates the previewed avatar live (the preview
  applies the current proportions on every preview update).
- Because the glTF body mesh loads asynchronously, the preview re-applies the
  current proportions after the model finishes loading (e.g. applied each render
  frame from the stored current cosmetic), so a change made before the model is
  ready still takes effect once it loads.
- Applying proportions is a safe no-op when the resolved body mesh has no morph
  targets / has not loaded yet (procedural fallback), with no thrown errors.
- The preview is driven by the same `cosmeticSelection.proportions` that the
  Save payload uses, so the previewed shape matches what will be saved.

## Technical Specs
- `game/client/renderer.js`: export a small helper that applies proportion morph
  influences to a preview avatar group — either export the existing
  `applyProportionMorphs`/`applyLoadedModelCosmetic`, or add an exported
  `applyAvatarProportions(host, proportions)` that resolves the body mesh
  (`resolveBodyMesh` / `userData.bodyMesh`) and reuses `applyProportionMorphs`.
  Keep the 1:1 identical-name mapping and the existing no-op guards (no
  morph dictionary → return).
- `game/client/cosmetic-preview.js`:
  - Store the latest cosmetic (including `proportions`) passed to `openPreview`
    and `updatePreview`.
  - Apply the stored proportions to the mounted avatar via the renderer helper —
    on each `updatePreview()` and, because the model loads async, on each
    `renderFrame()` tick (cheap; the helper is a no-op until the morph mesh
    exists).
  - Update the JSDoc `cosmetic` typedefs in this file to include `proportions`.
- Depends on sub-ticket 01 supplying `proportions` inside the cosmetic object
  passed to `openCosmeticPreview` / `updateCosmeticPreview`; no `main.js`
  changes should be required beyond what 01 already spreads
  (`{ ...cosmeticSelection }`).

## Verification: code
