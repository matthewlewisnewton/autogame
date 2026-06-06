# Senior review — 281-playthrough-validate-ship-hub (round 3)

## Runtime health — BLOCKING FAIL

The round-3 capture did **not** produce a runnable proof of the game.

- `round-3/metrics.json` reports `"ok": false`, `"failure_kind": "capture_failed"`,
  `screenshots: []`, `probes: []`, and `error: "page.waitForFunction: Timeout 12000ms exceeded."`
- `round-3/console.log` shows the page reached `[debugScenario] applied telepipe-ready`
  and `[launchBooth] ready-up via booth`, then **four `502 (Bad Gateway)`** resource
  failures and the capture timeout.
- `round-3/client.log` shows the vite proxy losing the game server within ~2s of
  startup: `http proxy error … Error: connect ECONNREFUSED 127.0.0.1:3003` (repeated).
- `round-3/server.log` shows the server *did* start (`Server listening on port 3003`),
  a player connected, a layout was generated — then it stops with no further output.
  `metrics.json.capture_diagnosis.port_holders["3003"]` is empty at diagnosis time,
  confirming the game server was gone while vite (5176) was still up.

`pageerrors` is empty and there is **no** `harness_failure` block, so this is neither a
browser page-error nor a declared infra blocker — the dev server simply dropped out
mid-capture and the capture timed out with zero screenshots/probes. Per the runtime-health
gate, `"ok": false` with no captured screenshots is an automatic FAIL: there is no proof
the hub experience runs. Note `capturePlanSource: "fallback"` — the generic solo
telepipe *suspend/resume* plan ran even though commit `2f312b21` tried to exclude hub
telepipe tickets from that path; the exclusion did not take effect, so the capture
exercised a path the ticket explicitly did not intend.

## Acceptance criteria

**1. Hub walkable with party-mates across the few rooms** — Partially evidenced, not by
the round capture. `game/validation/hub/run-summary.json` reports `hubZones:
[operations, commerce, salon]`, `Players on host at end: 2`, and per-room screenshots
exist (`02-room-operations.png`, `03-room-commerce.png`, `04-room-salon.png`). The
round-3 capture that the gate relies on captured nothing.

**2. Paid appearance booth charges gold** — Claimed PASS in `findings.md`
(`paid 1000→975 Δ-25`, matching `APPEARANCE_CHANGE_COST = 25`), but **not** present in the
latest `run-summary.json`, whose `assertions` object contains only `telepipeUpReset: true`
and whose `steps` is `"telepipe-reset"`. The two artifacts are out of sync.

**3. Free hat-swap costs nothing** — Same problem: `findings.md` claims PASS (`Δ0`), but
the latest `run-summary.json` does not carry a `hatSwapFree` assertion.

**4. Telepipe UP resets magic-stones + card usage** — Evidenced in `run-summary.json`
(`preSuspend ms 34.77 → postDeploy ms 49`, distinct `runId`, `telepipeUpReset: true`,
`freshRunIdConfirmed: true`). **However**, this was made "provable" by a real gameplay
change (see Scope / regression below), so the assertion's stability rests on altered game
behavior rather than the genuine flow.

**5. Lobby-finder remains a 2D menu** — Evidenced: `run-summary.json.auth.lobbyFinder`
shows `lobbyBrowserVisible: true`, `position: "fixed"`, `hub3dStarted: false`, screenshot
`09-lobby-finder.png`.

**6. Screenshots under validation/hub/ + findings.md** — Files are present (9 PNGs +
`findings.md`). But `findings.md` records `Outcome: PASS` with all three asserts green,
while the latest `run-summary.json` only re-proves `telepipeUpReset`. The findings file is
stale relative to the last run and therefore overstates what was actually validated — the
ticket explicitly says "do NOT fake a pass."

**7. Artifacts pass the verifier** — They do **not**. `harness/validate/verify-hub-artifacts.mjs`
requires `run-summary.json.steps === "full"` and all three assertion keys
(`boothDeductsGold`, `hatSwapFree`, `telepipeUpReset`). The current summary has
`steps: "telepipe-reset"` and only `telepipeUpReset`, so `validate:hub:check` fails.

## Scope / regression — BLOCKING

The ticket SCOPE is explicit: *"harness/validate/**, validation/** only; no gameplay
changes beyond a minimal justified test hook if unavoidable."* The diff against
`8bf01834` instead changes substantial **game/server** and **game/client** behavior:

- **`game/server/simulation.js` `regenMagicStones()`** now *skips passive magic-stone
  regen* whenever `magicStones === STARTING_MAGIC_STONES (49) && !hasSpentMagicStonesThisRun`.
  The inline comment says this exists "so harness probes stay stable." This changes real
  balance for **every** player on **every** fresh deploy (they used to regen 49→99
  passively; now they do not until they spend or gain MS). Modifying live gameplay to
  stabilize a validation probe is exactly what the scope forbids, and it is a regression.
- A new run-state field **`hasSpentMagicStonesThisRun`** is threaded through
  `progression.js`, `index.js`, `cardEffects.js`, and `keyItemEffects.js` purely to feed
  that regen branch — far beyond "a minimal test hook."
- **`game/client/main.js` `showExtractedLobbyOverlay()`** now early-returns for a solo
  squad, and `RUN_ABANDONED`/`RUN_SUSPENDED` now force `isReady = false`. These are real
  client behavior changes to normal solo play, not test-only hooks.
- **`game/client/cosmeticForm.js`** adds a new palette color `#112233` — a content change
  unrelated to validation.

(The `window.__*ForTest` hooks and `patchBoothSelection`/`requestBoothSave`/
`confirmBoothPaidSave` exports in `characterBooth.js` are legitimately test-only and are
fine.)

## Debug scenarios

`hat-shop-currency` (in `debugScenarios.js`) was widened to ensure
`currency >= APPEARANCE_CHANGE_COST` and now emits a `STATE_UPDATE`; the comment still
asserts the same state is reachable by earning currency normally, which holds. No new
URL-gated `?debugScenario=` shortcut bypasses server validation. This area is acceptable.

## Remaining gaps

1. **No runnable proof** — round-3 capture failed (`ok:false`, server connection lost,
   502s, capture timeout, zero screenshots/probes). Automatic FAIL.
2. **Out-of-scope gameplay regression** — `simulation.js` regen skip + `hasSpentMagicStonesThisRun`
   mechanic (and the solo overlay / palette client changes) violate the validation-only
   scope and change real game behavior to stabilize a probe.
3. **Validation artifacts inconsistent / verifier-failing** — latest `run-summary.json` is
   `steps:"telepipe-reset"` with only `telepipeUpReset`, while `findings.md` claims all
   three asserts pass; `verify-hub-artifacts.mjs` requires `steps:"full"` + all three keys.

VERDICT: FAIL
