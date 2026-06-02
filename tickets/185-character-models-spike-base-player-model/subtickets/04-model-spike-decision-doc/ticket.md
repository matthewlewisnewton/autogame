# Docs: MODEL_SPIKE decision note (game/docs)

Round 1 sub-ticket 01 failed because it required
`tickets/185-character-models-spike-base-player-model/MODEL_SPIKE.md`, which
implementers cannot write (`harness/roles.yaml` denies `tickets/**` for the
implementer role). Sub-tickets 02 and 03 already delivered `player.glb`, the
license file, the morph schema in `public/models/README.md`, and
`playerModel.test.js`. This sub-ticket adds only the missing **decision note**
at an implementer-writable path, aligned with what is already committed.

## Acceptance Criteria

- `game/docs/MODEL_SPIKE.md` exists and documents, in prose sections:
  - **Source vs authored** — which path was taken and why (e.g. in-repo Blender
    original vs downloaded CC0 pack); name the actual asset used for
    `player.glb` and point to `player.glb.license.md`.
  - **License** — SPDX or URL matching the committed `player.glb` license file.
  - **Poly budget** — target triangle budget for the spike and the measured
    count for the committed mesh (from README or GLB inspection).
  - **Anchor/scale conventions** — feet at y ≈ 0, forward **−Z**, expected height
    (~1.8 world units vs legacy `BoxGeometry(1,1,1)`), consistent with
    `game/client/public/models/README.md` and `renderer.js` player rotation.
- `game/client/public/models/README.md` includes a one-line link to
  `game/docs/MODEL_SPIKE.md` in the base-model or intro section (no table
  rewrites; morph schema already complete from sub-ticket 03).
- No changes to `player.glb`, renderer code, or morph-target data in this
  sub-ticket.

## Technical Specs

- `game/docs/MODEL_SPIKE.md` — NEW decision note. Summarize candidates considered
  (e.g. Quaternius CC0 packs, Mixamo, scratch Blender) and record the **final**
  choice matching sub-tickets 02–03: project-authored mesh from `assets/models`
  branch (`fdbcccc`), CC0-1.0, ~740 tris, ~1.84 u tall, feet y ≈ 0.08, −Z
  forward. Include a short “downstream” pointer that tickets 186–188 consume
  `proportions.<key>` → morph names from `public/models/README.md`.
- `game/client/public/models/README.md` — add a relative markdown link to
  `../../docs/MODEL_SPIKE.md` near the top or under “Base player mesh”.

Do **not** create files under `tickets/` — scope audit will revert them.

## Verification: code
