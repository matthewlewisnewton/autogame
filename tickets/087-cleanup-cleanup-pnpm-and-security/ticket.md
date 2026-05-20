# Cleanup nits from 086-cleanup-pnpm-and-security

> **Staleness note.** This follow-up ticket was written against commit
> `791f3ed` (2026-05-20). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `086-cleanup-pnpm-and-security`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Fix inverted age wording in CONTEXT.md

`CONTEXT.md` says `check:deps` flags dependencies “older than the configured age cutoff,” but `check_package_age.js` fails packages **newer** than the cutoff (published within the last N days). The mismatch can confuse developers running or debugging the gate.

### Acceptance Criteria
- `CONTEXT.md` supply-chain section describes the check as flagging packages that are too **new** / younger than `min-age-days` (or equivalent accurate wording).
- Wording matches the script’s `publishTime > cutoff` behavior.

## Document dependency whitelist rationale

Sub-ticket `03-remove-dead-local` added a whitelist for `vite`, `rollup`, `@rollup/*`, `@vitejs/*`, `qs`, and `@types/node` so `check:deps` can pass while those toolchain packages are younger than seven days. The list is only in code comments today.

### Acceptance Criteria
- A short comment block or `CONTEXT.md` note explains why those packages bypass the age gate and when to extend the whitelist.
- New bypass entries require an explicit comment naming the package and reason.
