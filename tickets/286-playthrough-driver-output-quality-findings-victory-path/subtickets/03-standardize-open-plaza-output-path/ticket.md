# Standardize Open Plaza validation output under game/validation/

Open Plaza artifacts landed at repo-root `validation/open-plaza/` while rooms and sunken-canyon use `game/validation/<level>/`. Align the driver default, npm scripts, and artifact verifier with the `game/validation/<preset>/` convention established in ticket 277 sub-ticket 19.

## Acceptance Criteria

- When `--out` is omitted, `harness/validate/playthrough.mjs` defaults to `game/validation/<preset>/` (e.g. `--preset open-plaza` → `game/validation/open-plaza/`; `--preset rooms` → `game/validation/rooms/`).
- `game/package.json` adds:
  - `"validate:open-plaza": "node ../harness/validate/playthrough.mjs --preset open-plaza --steps full --out game/validation/open-plaza"`
  - `"validate:open-plaza:check": "node ../harness/validate/verify-open-plaza-artifacts.mjs"`
- **New:** `harness/validate/verify-open-plaza-artifacts.mjs` validates `game/validation/open-plaza/` the same way the rooms verifier works: full-run `run-summary.json` (`steps: "full"`, four assertion booleans, `victory` section), required PNGs including `06-boss-defeated.png` / `07-victory.png`, non-empty `findings.md`, `probes.json`, `console.log`, and the distinct-PNG check from sub-ticket 02.
- `cd game && pnpm validate:open-plaza:check` fails fast with a clear stderr message when `game/validation/open-plaza/run-summary.json` is missing (expected until sub-ticket 04).
- File-header usage comment in `playthrough.mjs` documents the preset-aware default out path.
- `cd game && pnpm test:quick` still passes.
- Do **not** run `pnpm validate:open-plaza` or populate real open-plaza screenshots in this sub-ticket.

## Technical Specs

- **Edit:** `harness/validate/playthrough.mjs` — after parsing args, set `opts.out` to `game/validation/${opts.preset}/` when `--out` was not provided (preserve explicit `--out` overrides); update module docstring example.
- **New:** `harness/validate/verify-open-plaza-artifacts.mjs` — clone `verify-rooms-artifacts.mjs` with `OPEN_PLAZA_DIR = path.join(REPO_ROOT, 'game', 'validation', 'open-plaza')`; include distinct-PNG validation from sub-ticket 02.
- **Edit:** `game/package.json` — add `validate:open-plaza` and `validate:open-plaza:check` scripts.
- **Scope:** `harness/validate/**` and `game/package.json` only. Depends on sub-ticket **02** for the PNG-distinctness check in the verifier.

## Verification: code
