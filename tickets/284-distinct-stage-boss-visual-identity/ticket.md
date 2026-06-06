# 284-distinct-stage-boss-visual-identity

## Difficulty: medium

## Goal

Found by the Rooms playthrough-validation (277). The stage boss is not visually distinct from trash enemies — in the boss-active screenshot the boss renders as the same flat placeholder primitive as regular adds, so the 320-HP Annex Overseer is indistinguishable from a skirmisher.

EVIDENCE (committed on main): game/validation/rooms/05-boss-active.png and 02-level-entry.png (enemies render as small flat red/zigzag billboards + a plain capsule; nothing reads as a "boss").

Give each per-level stage boss a clearly distinct in-world visual: noticeably larger scale and/or a distinct model/color/emissive so a player instantly identifies the boss vs adds. Applies to all four stage bosses (Annex Overseer, Trial Warden, Canyon Warden, Summit Warden). Keep consistent with the existing low-poly render style. This is boss VISUAL IDENTITY only — a broader enemy-art overhaul is out of scope here.

SCOPE: game/client (enemy/boss rendering) + any minimal server boss-flag/metadata needed to mark the encounter boss; game/client/test.

## Verification

merge rejected: post-rebase verification failed
