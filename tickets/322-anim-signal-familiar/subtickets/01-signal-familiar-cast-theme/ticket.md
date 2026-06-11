# Signal Familiar — thematic cast: broadcast pings + familiar wisp

Rework the Signal Familiar (`battle_familiar`) cast VFX so it reads unmistakably
as its name: a small arcane **familiar wisp** materializes at the cast origin and
emits concentric expanding **"signal" broadcast ping rings** (radar/sonar feel)
out to the AoE radius, replacing the single generic telegraph ring. The card is a
`spell` and the server emits a pure radial-AoE payload (`origin`, `radius`,
`hits`, `magicStonesGained`, `hpHealed`) with **no `minionId`** and **no
`windUpMs`** — the cast is instant, so all cast VFX must fire immediately at the
origin (per-hit delivery is handled in sub-ticket 02).

## Acceptance Criteria

- `renderBattleFamiliar(data, ctx)` still early-returns when `data.radius === undefined`.
- On a normal cast (`data.radius` defined, `data.origin` present), the renderer
  emits **multiple concentric signal ping rings** keyed to `data.radius` (e.g. a
  staggered sequence / inner+outer rings via `spawnTelegraphRing`), not a single
  ring — visibly reading as an outward broadcast.
- A short-lived **familiar wisp** flourish is spawned at the cast origin (a
  transient summon-style burst, e.g. `spawnMinionSummonInEffect` or an upward
  `spawnParticleBurst`/`spawnImpactDecal` accent at origin) — distinct from the
  generic spark burst, so the cast reads as "a familiar answering a signal."
- Palette stays indigo/arcane: uses `getAccentHex(data.cardId)` when present,
  falling back to the existing `ARCANE_FAMILIAR_COLOR` / `ARCANE_FAMILIAR_EMISSIVE`.
- All cast VFX fire at cast time (instant) — there is no projectile-travel or
  wind-up delay, matching the server's instant resolution.
- The renderer only guards calls to helpers it uses (`if (ctx.spawnX)`), so a ctx
  missing any optional helper does not throw.
- `battle_familiar: renderBattleFamiliar` registration in `CARD_RENDERERS` is
  unchanged; no other card's renderer is touched.
- `pnpm test:quick` (client + server vitest) passes; no perf regression
  (no per-frame work added; VFX are one-shot spawns).

## Technical Specs

- `game/client/cardRenderers.js`:
  - Rewrite the body of `renderBattleFamiliar` (around line 1707). Keep the
    `data.radius === undefined` early return and the accent/fallback color logic
    (`ARCANE_FAMILIAR_COLOR` ~1615, `ARCANE_FAMILIAR_EMISSIVE` ~1616).
  - Emit ≥2 concentric `spawnTelegraphRing(origin, r, { color, emissive })` calls
    at staggered radii (and/or via `ctx.scheduleAfter` for a ping cadence) to give
    the broadcast feel; add the familiar-wisp flourish at `origin`
    (`spawnMinionSummonInEffect` with accent style, or an origin
    `spawnParticleBurst` + `spawnImpactDecal`).
  - Keep the existing `spawnParticleBurst` cast spark. Reuse `originOf(data)`.
  - If a small timing/stagger constant is needed, add it as a local `const` in
    this file (do NOT add server constants).
- Do not modify the server, `cardStats.json`, or any other renderer.

## Verification: code
