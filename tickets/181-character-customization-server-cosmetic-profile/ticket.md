# 181 — Character Customization: Server Cosmetic Profile

Foundation for the character customization feature. Add a persistent per-account
cosmetic profile and surface it to all clients. Today every player renders as a
hardcoded 1x1x1 box and the account record (`data/users.json` via
`server/users.js`) has no cosmetic fields, so chosen looks cannot persist or be
seen by peers.

## Design
Reuse the existing profile route (`PATCH /api/me/profile`) and the `users.json`
atomic write. Validation: `bodyShape` enum (`box|cylinder|cone|capsule`); colors
validated against a server-side `#RRGGBB` hex allowlist/regex.

## Acceptance Criteria
- Account record gains `cosmetic { bodyColor, accentColor, bodyShape }` with sane
  defaults backfilled for existing accounts.
- `PATCH /api/me/profile` accepts and validates cosmetic fields (hex colors /
  enum shape), rejecting invalid input with a 400.
- Cosmetic is added to player runtime state when a player record is built.
- `stateUpdate` snapshot carries `cosmetic` for every player.
- Cosmetic round-trips through the API and persists across a server restart.
