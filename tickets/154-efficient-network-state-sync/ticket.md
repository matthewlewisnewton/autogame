# Efficient Network State Sync (delta updates + compression + quantization)

## Difficulty: hard

## Goal

Cut multiplayer state-sync bandwidth dramatically by sending **only what
changed** each tick (delta updates against a baseline) instead of a full game
snapshot, plus two cheap multipliers (WebSocket compression and positional
quantization) — with **no gameplay regression** and clean handling of late
joiners / reconnects.

## Problem

The server broadcasts `stateUpdate` — the **entire** game state — every tick at
**20 Hz** (`game/server/config.js` tick rate; broadcast in
`game/server/index.js` ~line 1170; snapshot built fresh in
`game/server/progression.js` `stateSnapshot()`). Each snapshot carries every
player (~25 fields each), every enemy (dozens–100, ~12 fields), minions, and up
to hundreds of loot entries — all as **plain JSON over socket.io with no
compression, no delta tracking, and unquantized floats** (~2–10 KB × 20/sec per
client). Bandwidth scales with total entity count regardless of what actually
moved.

## Chosen approach (and why)

Three parallel research passes (current-netcode audit; binary formats —
protobuf/capnproto/flatbuffers/thrift/msgpack; delta/compression strategies)
concluded that the **highest-leverage, lowest-risk win is delta encoding, not a
new wire format**. socket.io's channel is reliable+ordered (TCP), so deltas are
safe without Quake-style acked-baseline machinery — we delta against the
last-sent tick and send periodic keyframes. A binary encoding (MessagePack via
`msgpackr`, or `protobuf-es`) is deliberately **deferred** to a follow-up: after
delta + deflate + quantization, generic compression already removes the
structural redundancy a binary format would, so its marginal gain shrinks —
adopt it later only if profiling shows residual size/parse cost is still the
bottleneck.

## Acceptance Criteria

1. **Delta `stateUpdate`**: the server sends only changed entities/fields since
   the last broadcast, plus explicit removed-entity IDs. A periodic **full
   keyframe** (e.g. every ~2–5 s) and a keyframe on join/reconnect let clients
   (re)sync; each message is tagged so a client that detects a missed baseline
   can request a fresh keyframe.
2. **Client apply**: the client maintains a local mirror, **merges** deltas,
   **replaces** on keyframe, and removes entities by ID — rendering identically
   to today (positions, HP, decks, cooldowns, loot, minions, enemies all
   correct).
3. **Compression**: socket.io `perMessageDeflate` enabled with context-takeover
   and a small-message threshold (skip tiny frames).
4. **Quantization**: positional/rotational floats sent at reduced precision
   (fixed decimals or fixed-point) with no perceptible movement error.
5. **Measured win**: instrument bytes-sent for `stateUpdate`; demonstrate
   **≥70% reduction** in a 4-player + many-entity scenario vs. the current full
   snapshot, with the game fully playable.
6. **No regression** to `game/docs/requirements.md` (rendering, connection,
   multiplayer visualization, movement sync) or existing multiplayer behavior;
   late joiners and reconnects converge to correct state within one keyframe.

## Technical Specs

- **Server** (`game/server/index.js`, `game/server/progression.js`): keep the
  last broadcast snapshot; add `buildStateDelta(prev, next)` producing changed
  entities (per-field where practical, else whole-entity) + `removed: [ids]` +
  `keyframe: bool` + monotonically increasing `seq`/`baselineSeq`; emit full
  snapshot every N ticks and on `playerReady`/reconnect. Enable
  `perMessageDeflate` in the socket.io server options. Quantize positions in the
  emitted payload (round/scale), keep authoritative float state internally.
- **Client** (`game/client/main.js`, `game/client/renderer.js`): apply
  keyframe-vs-delta on receipt; maintain the entity mirror the renderer reads;
  request a keyframe if `baselineSeq` doesn't match the last applied `seq`.
- **Keep JSON encoding** this ticket. Do NOT introduce protobuf/msgpack here —
  that is a separate, profiling-gated follow-up ticket.
- Add a debug scenario or test hook that spawns many entities so the bandwidth
  win is measurable/QA-able.

## Verification: code

- Unit/integration tests: `buildStateDelta` correctness (changed/removed/keyframe),
  client apply (merge vs replace vs remove) reproducing a full snapshot from a
  keyframe + deltas, and quantization round-trip within tolerance.
- A bandwidth check: log/sum `stateUpdate` bytes over a fixed window in a
  many-entity scenario before vs after; assert ≥70% reduction.
- `pnpm test:quick` (server + client vitest) green; no regression in existing
  movement-sync / multiplayer tests.

## Out of scope (follow-ups)

- Binary wire encoding (`msgpackr` or `protobuf-es`) — separate ticket, only if
  profiling after this one shows size/parse is still a bottleneck.
- Area-of-interest / spatial-hash interest management — separate ticket; only
  worthwhile if entity counts/map size grow beyond the co-op dungeon scale.
