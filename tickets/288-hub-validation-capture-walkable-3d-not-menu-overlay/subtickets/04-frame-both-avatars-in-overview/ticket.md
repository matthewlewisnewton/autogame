# 04-frame-both-avatars-in-overview

Ensure both party members' avatars (host + joiner) appear together in the `01-hub-overview.png` screenshot. Previous attempts used keyboard-based host-approach movement which was unreliable across multiple QA iterations. Switch to a deterministic strategy: keep both players near spawn and assert proximity via harness state before capture.

## Acceptance Criteria

- The joiner's initial nudge in `runHubWalkStep()` is reduced from 4 units to **2 units** (still triggers the squadmate-position-change assertion which checks `> 0.05`)
- The inline host-approach keyboard movement block (between the squadmate-position assertion and `dismissLobbyOverlay`) is **removed** — it was unreliable and produced inconsistent framing
- A harness-based proximity assertion is added **before** the overview screenshot: read both host and joiner harness state, compute `Math.hypot(host.x - joiner.x, host.z - joiner.z)`, and throw if distance exceeds **4 units**
- The overview screenshot (`01-hub-overview.png`) is regenerated with both avatars visible (confirmed by the proximity assertion passing at capture time)
- The lobby overlay remains dismissed (`display: none`) at capture time
- Zone-walk screenshots (02–04), booth, and telepipe steps are unchanged

## Technical Specs

- **File to change:** `harness/validate/playthrough.mjs` — modify `runHubWalkStep()`

**Change 1 — Reduce joiner nudge distance.** In the call to `nudgeJoinerForPresence`, change the target offset from `+4` to `+2`:
```js
// Before:
await nudgeJoinerForPresence(joinerPage, joinerPlayer.x + 4, joinerPlayer.z);
// After:
await nudgeJoinerForPresence(joinerPage, joinerPlayer.x + 2, joinerPlayer.z);
```

**Change 2 — Remove unreliable host-approach block.** Delete the entire inline block between the squadmate-position `waitForFunction` and `dismissLobbyOverlay(hostPage)` that reads `latestJoinerHarness`, computes `dx`/`dz`/`dist`, and does keyboard nudges on `hostPage`. This block (approximately 30 lines starting with `// Move the host toward the joiner`) was added by the previous (failed) sub-ticket 04 and consistently produced unreliable framing.

**Change 3 — Add proximity assertion before capture.** Insert right before `dismissLobbyOverlay(hostPage)`:
```js
// Assert both players are close enough for both avatars to fit in the overview frame.
const hState = await readHarness(hostPage);
const jState = await readHarness(joinerPage);
const hostP = hState?.player;
const joinerP = jState?.player;
if (hostP && joinerP && Number.isFinite(hostP.x) && Number.isFinite(joinerP.x)) {
  const dist = Math.hypot(hostP.x - joinerP.x, hostP.z - joinerP.z);
  if (dist > 4) {
    await failWithHarnessPair(hostPage, joinerPage,
      `Host-joiner distance ${dist.toFixed(1)} exceeds 4 units for overview frame`);
  }
}
```

The 2-unit nudge places the joiner only 2 units from spawn; the host stays at spawn. Both should be within the camera frustum for the overview shot. The proximity assertion catches any regression where the positions drift apart.

## Verification: code
