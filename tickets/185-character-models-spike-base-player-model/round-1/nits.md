## Make proportion morph targets orthogonal (re-author player.glb shape keys)

The six morph targets in `player.glb` are not independent. The committed base
geometry is the *combined-minimum* silhouette (all six DEFORM factors applied in
the shrink direction), and each shape key's delta is `per-key-max − combined-min`.
As a result every morph delta moves all 7283 vertices (verified by decoding the
accessors): driving a single key from 0→1 not only changes that proportion but
also un-shrinks the other five axes. This contradicts the contract in
`game/docs/MODEL_SPIKE.md`, which states `0.5` per key ≈ the rest silhouette and
implies keys are independent — setting all six to 0.5 does **not** reproduce the
original Quaternius neutral mesh, and tickets 186–188 (server clamp + UI sliders)
will get cross-talk between sliders. The script's own `0.5 blend error` check is
also misleading because it validates one key at 0.5 with the others at 0, which is
not how the keys combine in practice. Worth re-authoring before the avatar is wired
in ticket 187 so each slider reads as a clean single-axis change.

### Acceptance Criteria
- Each shape key in `player.glb` deforms only the vertices anatomically associated
  with that proportion (e.g. `headSize` leaves leg/arm verts within a small epsilon
  of the basis); driving one key from 0→1 with the others at neutral changes only
  that axis's silhouette.
- The committed basis mesh equals the neutral Quaternius rest pose (not the
  combined-min), so all six keys at the documented neutral influence reproduce the
  original silhouette within tolerance.
- `game/docs/MODEL_SPIKE.md` and `blender-add-proportion-morphs.py` are updated to
  match whichever neutral/basis convention is chosen, and the validation check in
  the script reflects how the keys are actually combined.
- `game/client/test/playerModelMorphs.test.js` still passes (six names present).
