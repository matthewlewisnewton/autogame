# Senior Review — death-spiral post-death recovery

## Runtime health (gate)

- `metrics.json`: `ok: true`, no `failure_kind`, no `harness_failure` block.
- `pageerrors.json` / `metrics.pageerrors`: `[]` — no browser page errors.
- `console.log`: clean. The two `409 (Conflict)` resource lines are the known
  benign lobby-create-conflict on the deterministic two-client smoke flow (both
  clients race to create the same lobby; one joins instead) — not a code defect.
  `[initScene]` and `[launchBooth] ready-up via booth` confirm scene init and
  the ready transition both worked.
- `server.log` / `client.log`: server boots, both players connect, loot spawns,
  clean SIGTERM shutdown. Only noise is THREE.Clock deprecation + Vite ws-proxy
  EPIPE on socket close — both explicitly benign.

The captured run is a `fallback` full-flow smoke capture (auth → lobby →
ready → movement → dodge); it does not itself drive the death/respawn loop, but
it proves the game starts and loads cleanly with the ticket applied. The
death-spiral behaviour is proven instead by the dedicated server regression test
(below), which exercises the real `returnToLobby` → revive → charity-medic →
redeploy path end-to-end.

## Acceptance criterion

> A player with 0 money who died on the previous run can realistically survive
> the next run start: respawn HP raised, free/over-time hub healing exists, or
> equivalent mitigation; design decision documented and covered by a test.

**Met — robustly, on three independent fronts.**

1. **Respawn HP raised.** `LOBBY_REVIVE_HP` 10 → 50 in `game/server/config.js`
   (50% of `MAX_HP`). `revivePlayerInLobby()` (`progression.js:510`) sets dead
   players to this on hub return. A grunt's `attackDamage` is 10, so 50 HP
   survives ≥2 hits instead of 1 — directly answering the spawn-camp repro.

2. **Free hub healing (charity medic).** `healAtMedic()` (`progression.js:518`)
   now charges the normal 10 only when the player can afford it; if currency
   < 10 the cost drops to 0 and HP is fully restored without deducting (or
   requiring) money. A broke player is no longer hard-stuck at low HP.

3. **Mitigation is layered**, not either/or — a 0-money player respawns at 50%
   *and* can free-heal to full before redeploying. This fully breaks the death
   spiral described in the ticket.

**Documented:** `game/docs/design.md` gains a "Post-death recovery" section
spelling out the 50% revive, the 10-money paid medic, and the 0-cost charity
medic. Consistent with the doc; no regression to `requirements.md`.

**Covered by tests (all passing — verified 55/55):**
- `server/test/death_spiral_recovery.test.js`: (a) invariant that
  `LOBBY_REVIVE_HP >= 2 * grunt.attackDamage`; (b) full integration path —
  0-currency player starts a run, dies (`run-failed` debug), `returnToLobby`
  revives at 50 HP with currency still 0, `medicHeal` returns
  `{hp:100, currency:0, cost:0}`, then successfully redeploys into a new run.
- `server/test/server.test.js`: updated unit — sub-10 currency now yields a
  `cost:0` charity heal that preserves currency, instead of `insufficient_gold`.
- `client/test/medicHud.test.js`: HUD shows "Free triage restore" copy + an
  *enabled* heal button when injured & broke, paid copy when affordable, and
  stays disabled at full HP.

## Client integration

`renderGuildMedic()` (`main.js:2959`) now enables the heal button whenever the
player is injured (previously disabled when `currency < MEDIC_HEAL_COST`), and
swaps in free-triage copy for the broke case. The button emits `MEDIC_HEAL`
unconditionally; the server is the source of truth for free-vs-paid, so there is
no client/server divergence. The server no longer returns `insufficient_gold`
for the medic, and no client code branches on that string, so nothing is left
dangling.

## Debug scenario review — `post-death-broke-lobby`

`debugScenarios.js:setupPostDeathBrokeLobbyDebug` adds a
`?debugScenario=post-death-broke-lobby` shortcut (registered in
`DEBUG_SCENARIO_REGISTRY` and the `DEBUG_SCENARIOS` allow-set in `index.js`).
- **Debug-gated:** reachable only through the debug scenario dispatch path; no
  normal gameplay code calls it.
- **Normal path still reachable & exercised:** it reproduces the exact state
  (lobby phase, `run` cleared, `hp = LOBBY_REVIVE_HP`, `currency = 0`,
  `dead = false`) that the real `runFailed → returnToLobby` flow produces — and
  that real flow is what `death_spiral_recovery.test.js` drives, so the shortcut
  is a faithful QA mirror, not a substitute.
- **No invariants short-circuited:** it only sets hub-side state; it does not
  skip server validation, persistence, or replication that normal play uses.

## Code quality

No bugs found. The charity-medic branch is small and correct; currency is only
deducted on the paid path; `savePlayerData` runs in both cases. No dead code, no
console errors.

## Remaining gaps

None blocking. One non-blocking observation captured in `nits.md` (the charity
heal is keyed purely on `currency < 10`, so any low-funds player — not strictly
a post-death one — gets free heals; harmless and within the ticket's "equivalent
mitigation" latitude, but worth a deliberate design note later).

VERDICT: PASS
