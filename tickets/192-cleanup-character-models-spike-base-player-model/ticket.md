# Cleanup nits from 185-character-models-spike-base-player-model

> **Staleness note.** This follow-up ticket was written against commit
> `44386e0` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `185-character-models-spike-base-player-model`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Correct the `player.glb` XZ-footprint documentation vs the T-pose arm span

`game/client/public/models/README.md` lists "max XZ half-extent 0.5" as an
export rule the committed asset satisfies, but the committed mesh is a T-pose
whose outstretched arms reach half-X ≈ 0.93 at shoulder height. The body proper
(waist/torso/legs/head) fits the 0.5-radius cylinder; only the arms exceed it,
which is standard for a base rigged mesh. The doc claim is misleading and ticket
187 will want the arms posed down before the avatar is rendered standing.

### Acceptance Criteria
- README/MODEL_SPIKE wording distinguishes the **body footprint** (must fit 0.5
  radius — it does) from **T-pose limb span** (exceeds it by design), instead of
  claiming a flat "max XZ half-extent 0.5".
- A note for ticket 187 to A-pose / pose-down the arms (or otherwise account for
  the ~0.93 arm reach) before swapping the glTF avatar in.

## Strengthen the weakest proportion morphs (`torsoWidth`, `headSize`)

The six morphs all produce distinct, non-degenerate deltas, but `torsoWidth`
(max |Δ| ≈ 0.027) and `headSize` (≈ 0.042 on the body mesh) are markedly subtler
than the others (height 0.235, armLength 0.117). At full 0.0↔1.0 slider travel
they may read as barely-there in the customization UI (tickets 186–188).

### Acceptance Criteria
- Re-bake (`game/scripts/bake-player-morph-targets.mjs`) so `torsoWidth` and
  `headSize` give a clearly visible silhouette change across the full influence
  range, comparable in legibility to the limb-length morphs.
- `game/client/test/playerModelMorphs.test.js` still passes (six exact names,
  six POSITION targets per morphed primitive).
