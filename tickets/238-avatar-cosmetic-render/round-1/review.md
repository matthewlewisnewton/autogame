# Review

## Runtime health

The captured game run starts and loads cleanly. `metrics.json` reports `"ok": true`, has no `harness_failure`, and `pageerrors` is empty. `console.log` has no `pageerror` or `[fatal]` entries from game code; the only error lines are 409 resource responses during the harness flow, and the server/client logs show normal startup, gameplay connection, and shutdown noise.

## Acceptance criteria

### Avatar shows the account cosmetic config and equipped hat in hub and in-run

Satisfied by the live code. Server player records now source `account.cosmetic`, `stateSnapshot()` exposes the complete cosmetic payload, and the renderer builds avatars from `gameState.players[*].cosmetic` in both lobby and playing phases. The renderer includes body shape, body color, accent color, hat id, and `modelId` in the avatar signature, resolves `modelId` through `MODEL_REGISTRY`, attaches the player glTF, and seats the hat on the glTF head when the model loads.

The implementation is consistent with the design/requirements foundation: it preserves the multiplayer 3D avatar representation, works with the existing lobby-to-dungeon loop, and does not change movement, networking, combat, or progression semantics.

### Updates when cosmetics change

Satisfied by the implementation path. `PATCH /api/me/profile` now syncs saved cosmetic changes into live singleton and lobby player records, while the client also immediately updates the local `gameState` after a successful cosmetic save. The renderer rebuilds avatars when shape/color/hat/model-signature fields change and reapplies glTF tint/proportion morphs every update, so proportion-only changes do not require a rebuild or page reload.

### Test

Blocking gap. The latest `coverage.log` is not green: 59 files passed but 3 test files failed, including the newly extended cosmetic runtime coverage. The most relevant failure is `server/test/cosmetic_runtime.test.js > PATCH profile cosmetic syncs an existing live player record and snapshot`, where registration returned 500 because user persistence tried to rename `game/data/users.json.tmp` and the tmp file was missing. The same run also reports `server/test/account.test.js > PATCH /api/me/profile > changes username and returns new token` returning 500, plus an unrelated `field_medic_kit` precision assertion failure. Even though the browser capture ran cleanly and the code path reads correctly, the ticket cannot pass with the latest validation artifact failing.

## Debug scenarios

No development debug scenario was added or changed by this ticket. The existing `debugScenario` URL path remains separate from normal gameplay, and the round-1 capture did not use a debug scenario.

## Remaining gaps

1. Full validation is not green. The latest coverage run reports 3 failed tests, including the ticket's cosmetic runtime profile-sync test failing during registration with `ENOENT: no such file or directory, rename '.../game/data/users.json.tmp' -> '.../game/data/users.json'`.

VERDICT: FAIL
