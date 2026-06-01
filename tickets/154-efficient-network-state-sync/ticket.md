# EPIC: Efficient Network State Sync

## Type: epic (tracking only — not directly executable; see child tickets 154-01…154-11)

## Goal

Cut multiplayer state-sync bandwidth dramatically by sending only what changed
each tick (delta updates against a baseline) plus two cheap multipliers
(WebSocket compression, positional quantization) — with no gameplay regression
and clean late-joiner / reconnect handling. Target: **≥70% reduction** in
`stateUpdate` bytes/sec in a many-entity, 4-player scenario.

## Problem

The server broadcasts the ENTIRE game state as plain JSON every tick at 20 Hz
(`game/server/index.js` ~1170, `game/server/progression.js` `stateSnapshot()`):
every player (~25 fields), enemy (dozens–100), minion, and loot entry — no
delta, no compression, no quantization (~2–10 KB × 20/sec, scaling with total
entity count regardless of what moved).

## Approach & rationale (delta-first, not binary-first)

Three research passes concluded the biggest, lowest-risk win is **delta encoding
+ deflate + quantization** (encoding-agnostic), and that a binary wire format
(msgpack/protobuf) yields diminishing returns once those land — so binary is a
**profiling-gated follow-up**, not part of this epic.

**Keyframe rationale (important):** socket.io runs over TCP (reliable + ordered),
so deltas applied to a baseline reproduce authoritative state EXACTLY — there is
no transport-loss drift like UDP netcode. Therefore periodic whole-state
keyframes here are a **safety net** (bounds the impact of any delta-logic bug)
and a **late-joiner/reconnect mechanism**, NOT a transport-drift fix. So keep
keyframes INFREQUENT (every several seconds) + keyframe-on-join, and use a
monotonic `seq`/`baselineSeq` so a client that detects a gap can request an
on-demand keyframe. (Full state-hash drift detection is a later refinement.)

## Dependency convention (new)

Child tickets declare prerequisites with a `## Depends on:` section listing
blocker ticket directory names (comma-separated; absent/`none` = no blockers).
The beads migration maps each entry to `bd dep add <this> <blocker>`, so the
parallel dispatcher's blocker-aware `bd ready` runs independent children
concurrently and hides blocked ones until ready. (The serial TASKS.md loop has
no dep support; there the order is the only signal — list blockers first.)

## Decomposition (DAG — maximize concurrency)

```
Wave 0 (no deps, all concurrent):
  154-01 permessage-deflate
  154-02 quantization-codec (pure util)
  154-03 bandwidth-instrumentation + many-entity debug scenario
  154-04 delta-envelope (shared {seq, baselineSeq, keyframe, changed, removed} contract)
Wave 1 (after 04, concurrent):
  154-05 server-build-delta (pure buildStateDelta)      ← 04
  154-06 client-apply-delta (pure apply/merge/remove)   ← 04
Wave 2:
  154-07 server-broadcast-wiring (keyframes + seq + cadence + on-join) ← 05
Wave 3:
  154-08 client-receive-integration (live handler uses keyframe/delta) ← 06, 07
Wave 4:
  154-09 resync-handshake (seq-gap → request keyframe)  ← 08
  154-10 quantize-on-wire (use codec in emit + apply)   ← 02, 07, 08
Wave 5:
  154-11 bandwidth-validation (≥70% gate)               ← 01, 03, 08, 10
```

Wave 0 is 4-wide (great for the agent pool); the critical path is
04→05→07→08→(09/10)→11.

## Acceptance (epic-level, satisfied when all children close)

- Delta `stateUpdate` with infrequent keyframes + keyframe-on-join/reconnect +
  seq-gap resync; client renders identically to today.
- `perMessageDeflate` on; positional floats quantized.
- ≥70% measured bandwidth reduction in the many-entity scenario; no regression
  to `game/docs/requirements.md`; `pnpm test:quick` green.

## Out of scope (separate, profiling-gated)

Binary wire encoding (`msgpackr`/`protobuf-es`); area-of-interest / spatial-hash
interest management.
