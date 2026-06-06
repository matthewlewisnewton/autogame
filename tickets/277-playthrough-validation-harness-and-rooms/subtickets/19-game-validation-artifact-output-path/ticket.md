# Relocate rooms validation artifacts under game/

Round-8 remediation for failed sub-ticket 18. Sub-tickets **10**, **15**, and **17** added `validation/**` safe-path and mid-ticket `importlib.reload`, but the live ticket log still never prints `[scope] validation writes allowed` and every execute iteration reverts artifact writes — the long-running `ticket()` interpreter keeps stale harness imports, so `allow_validation` never reaches `scope_audit`. Move the default playthrough output directory to `game/validation/rooms/`, which is always inside the implementer `game/**` allow scope, so execute sub-tickets can land artifacts without depending on harness reload.

## Acceptance Criteria

- `harness/validate/playthrough.mjs` default `--out` is `game/validation/rooms/` (not repo-root `validation/rooms/`).
- `game/package.json` `validate:rooms` passes `--out game/validation/rooms` explicitly so `pnpm validate:rooms` writes under `game/validation/rooms/`.
- `harness/validate/verify-rooms-artifacts.mjs` reads from `game/validation/rooms/` and still enforces full-run `run-summary.json`, PNGs `06-boss-defeated.png` / `07-victory.png`, non-empty `findings.md`, `probes.json`, and `console.log`.
- `cd game && pnpm validate:rooms:check` fails fast with a clear stderr message when `game/validation/rooms/run-summary.json` is missing (expected until sub-ticket 20).
- `cd game && pnpm test:quick` still passes.
- Do **not** run `pnpm validate:rooms` or populate `game/validation/rooms/` with real screenshots in this sub-ticket.

## Technical Specs

- `harness/validate/playthrough.mjs`: change default `opts.out` from `validation/rooms/` to `game/validation/rooms/`; update file-header usage comment.
- `harness/validate/verify-rooms-artifacts.mjs`: set `ROOMS_DIR` to `path.join(REPO_ROOT, 'game', 'validation', 'rooms')`; update module docstring.
- `game/package.json`: update `validate:rooms` to `node ../harness/validate/playthrough.mjs --preset rooms --steps full --out game/validation/rooms`.
- If any harness test hard-codes repo-root `validation/rooms/`, update it to `game/validation/rooms/`.
- Depends on passed sub-tickets **01–11**, **13**, **08**, **10**, **15**, and **17**. No gameplay logic changes under `game/server/` or `game/client/`.

## Verification: code
