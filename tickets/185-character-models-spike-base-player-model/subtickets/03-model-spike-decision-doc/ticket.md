# Docs: MODEL_SPIKE decision note (game/docs)

Record the spike outcome for downstream tickets (161 loader, 186 server fields,
187 glTF avatar, 188 sliders): which asset path was taken, license, poly budget,
and anchor/scale conventions — at an implementer-writable path under `game/docs/`,
not under `tickets/` (scope audit denies `tickets/**` for implementers).

## Acceptance Criteria

- `game/docs/MODEL_SPIKE.md` exists and documents, in prose sections:
  - **Source vs authored** — which path was taken and why (e.g. in-repo Blender
    original vs downloaded CC0 pack); name the actual asset in `player.glb` and point
    to `player.glb.license.md`.
  - **License** — SPDX or URL matching the committed `player.glb` license file.
  - **Poly budget** — target triangle budget for the spike and the measured count
    for the committed mesh (from README or GLB inspection).
  - **Anchor/scale conventions** — feet at y ≈ 0, forward **−Z**, expected height
    (~1.6–2.0 world units vs legacy `BoxGeometry(1,1,1)`), consistent with
    `game/client/public/models/README.md` and `renderer.js` player rotation
    (`rotation.y = playerRotation − π/2`).
- `game/client/public/models/README.md` includes a markdown link to
  `game/docs/MODEL_SPIKE.md` in the base-model or intro section (no rewrite of the
  morph table from sub-ticket 02).
- No changes to `player.glb`, morph-target data, renderer code, or tests in this
  sub-ticket.

## Technical Specs

- `game/docs/MODEL_SPIKE.md` — NEW decision note. Summarize candidates considered
  (e.g. Quaternius CC0 packs, Mixamo, scratch Blender) and record the **final**
  choice matching sub-tickets 01–02. Include measured stats (tri count, material
  slots, bbox height, sole Y, −Z forward). Add a **Downstream** pointer: tickets
  186–188 consume `proportions.<key>` → morph names from `public/models/README.md`.
- `game/client/public/models/README.md` — add relative link
  `../../../docs/MODEL_SPIKE.md` near **Base player mesh**.

Do **not** create `tickets/**/MODEL_SPIKE.md` or other files outside `game/**`.

## Verification: code
