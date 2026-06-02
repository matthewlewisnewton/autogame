# Cleanup nits from 128-key-item-smoke-bomb

> **Staleness note.** This follow-up ticket was written against commit
> `d141d7b` (2026-06-02). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `128-key-item-smoke-bomb`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Smoke VFX is caster-local only

The Smoke Veil fog disc is spawned from the local caster's `keyItemUsed` event in
`game/client/main.js`; the renderer never reads `snapshot.smokeZones`. In multiplayer, a teammate
standing inside an ally's smoke zone sees no fog even though the server-side accuracy debuff protects
them. Rendering active zones from the broadcast snapshot would make the visual match the mechanic for
all players.

### Acceptance Criteria
- Active `smokeZones` from `stateUpdate` snapshots render a fog disc for every player in the lobby,
  not just the caster.
- A non-caster standing in an ally's zone sees the fog for the zone's remaining duration.
- No duplicate/orphaned smoke discs when the caster also receives the snapshot (avoid double-spawning).
