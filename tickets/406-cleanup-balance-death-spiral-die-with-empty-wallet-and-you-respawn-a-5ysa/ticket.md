# Cleanup nits from balance-death-spiral-die-with-empty-wallet-and-you-respawn-a-5ysa

> **Staleness note.** This follow-up ticket was written against commit
> `002ef3f9` (2026-06-11). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `balance-death-spiral-die-with-empty-wallet-and-you-respawn-a-5ysa`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Charity medic triggers on any low-funds player, not just post-death

The free "charity" heal in `healAtMedic()` (`game/server/progression.js`) keys
purely on `currency < MEDIC_HEAL_COST` (10). That means *any* player whose
wallet happens to sit under 10 gets unlimited free full-restores in the hub —
not strictly the post-death-with-forfeited-money case the ticket targets. This
is harmless today (you can't gain money from healing, and it's within the
ticket's "equivalent mitigation" latitude) but it slightly blurs the paid-medic
economy for chronically low-money players. Worth a deliberate design decision:
keep it simple as-is, or gate the free heal to genuinely post-death / zero-wallet
situations.

### Acceptance Criteria
- Design intent for the free-heal trigger condition is documented in
  `game/docs/design.md` (either "free whenever wallet < medic cost" is
  intentional, or it is narrowed to post-death / zero-currency).
- Behaviour and the doc agree, and the existing death-spiral tests still pass.
