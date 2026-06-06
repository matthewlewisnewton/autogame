# 281-playthrough-validate-ship-hub

## Difficulty: hard

## Goal

Validate the shared ship HUB experience (not a combat level). Reuse the 277 driver auth + hub entry. Verify: hub is walkable with party-mates present across the few rooms; the paid appearance-change booth charges gold; the free hat-swap costs nothing; taking a telepipe UP from an in-progress level resets magic-stone + card-usage values; the lobby-finder remains a 2D menu. Capture screenshots under validation/hub/ (hub overview, each room, booth, hat-swap, telepipe-up reset before/after, lobby-finder) and write validation/hub/findings.md. ASSERT booth deducts gold, hat-swap is free, telepipe-up reset occurs. Asserts pass OR findings.md documents the real failure with screenshots (do NOT fake a pass). Workers cannot file beads - everything in findings.md. SCOPE: harness/validate/**, validation/** only; no gameplay changes beyond a minimal justified test hook if unavoidable.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
