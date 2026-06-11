# Telepipe animation test coverage

Add client unit tests that lock in Telepipe's dedicated renderer registration, cast VFX composition, cyan accent palette, and instant-cast timing contract (no wind-up, no deferred scheduling). Depends on sub-tickets 01 and 02.

## Acceptance Criteria

- `resolveRenderers('telepipe')` returns a single non-empty renderer array containing `renderTelepipe`.
- Mock-context test: calling `renderTelepipe` with a valid `CARD_USED` payload invokes `spawnTelepipeCastEffect`, `spawnTelegraphRing`, and `spawnParticleBurst` at the cast origin with cyan accent colors (`0x67e8f9` / `0x22d3ee` or `getAccentHex('telepipe')` equivalents).
- Mock-context test: `renderTelepipe` no-ops when `data.origin` is absent (none of the spawn helpers called).
- Timing contract test: `CARD_DEFS.telepipe.windUpMs` is absent or `<= 0` (instant cast; no 307 charge telegraph expected).
- Timing contract test: the renderer implementation does **not** call `ctx.scheduleAfter` (instant synchronous cast matching server placement).
- Default portal radius test: renderer passes `radius` of `2.5` when `data.radius` is omitted (matches server `PORTAL_RADIUS`).
- `pnpm test:quick` passes with no regressions in existing `cardRenderers.test.js` suites.

## Technical Specs

- **`game/client/test/cardRenderers.test.js`**:
  - Add a `describe('telepipe', …)` block near other utility/spell renderer tests (e.g. after `deck_sifter` / `mana_prism` blocks).
  - Import `renderTelepipe` (directly or via `resolveRenderers`) and `getCardDef` / `CARD_DEFS` as needed.
  - Build a mock `ctx` with `vi.fn()` spies for `spawnTelepipeCastEffect`, `spawnTelegraphRing`, `spawnParticleBurst`, and `scheduleAfter`.
  - Sample payload: `{ cardId: 'telepipe', effect: 'telepipe', specialEffect: 'portal', origin: { x: 3, z: -5 } }`.
  - Assert spawn calls receive `origin` coordinates and style objects containing the Telepipe cyan palette.
  - Assert `scheduleAfter` spy was **not** called.
- Do **not** modify renderer implementations in this sub-ticket — only tests.
- Primitive-level coverage for `spawnTelepipeCastEffect` remains in sub-ticket 01 (`vfx-primitives.test.js`); this sub-ticket owns renderer-level tests only.

## Verification: code
