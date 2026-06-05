import { describe, it, expect } from 'vitest';
import { generateHub } from '../dungeon.js';
import { computeWalkableAABBs } from '../simulation.js';
// HUB_LAYOUT is the exact instance the server delivers to lobby clients in the
// lobbyJoined payload (see emitLobbyJoined in index.js).
import { HUB_LAYOUT } from '../index.js';

const ZONE_NAMES = ['operations', 'commerce', 'salon'];
const BOOTH_ANCHOR_KEYS = ['quest', 'launch', 'shop', 'deck', 'character', 'hats'];

/** Shared shape assertions for any hub layout (generated or delivered). */
function assertHubShape(hub) {
  expect(hub).toBeTruthy();
  expect(hub.profile).toBe('hub');

  // Named zone rooms.
  expect(Array.isArray(hub.rooms)).toBe(true);
  const zones = hub.rooms.map((r) => r.hubZone);
  for (const name of ZONE_NAMES) {
    expect(zones).toContain(name);
  }

  // Each room carries wall definitions (collision geometry).
  for (const room of hub.rooms) {
    expect(Array.isArray(room.walls)).toBe(true);
    expect(room.walls.length).toBeGreaterThan(0);
  }

  // Connecting passages.
  expect(Array.isArray(hub.passages)).toBe(true);
  expect(hub.passages.length).toBe(2);

  // Named booth anchors.
  expect(hub.boothAnchors).toBeTruthy();
  for (const key of BOOTH_ANCHOR_KEYS) {
    expect(hub.boothAnchors[key]).toBeTruthy();
    expect(typeof hub.boothAnchors[key].x).toBe('number');
    expect(typeof hub.boothAnchors[key].z).toBe('number');
  }
}

describe('hub client payload', () => {
  it('generateHub produces a profile:hub layout with zones, passages, and booth anchors', () => {
    assertHubShape(generateHub(0));
  });

  it('generated hub layout has non-empty walkable collision geometry', () => {
    const hub = generateHub(0);
    const aabbs = computeWalkableAABBs(hub);
    expect(Array.isArray(aabbs)).toBe(true);
    expect(aabbs.length).toBeGreaterThan(0);
  });

  it('exposes a start room so the client can derive the hub spawn', () => {
    const hub = generateHub(0);
    const startRoom = hub.rooms.find((r) => r.role === 'start');
    expect(startRoom).toBeTruthy();
    expect(startRoom.hubZone).toBe('operations');
  });

  it('the HUB_LAYOUT the server delivers to lobby clients matches the hub shape', () => {
    // This is the exact object emitLobbyJoined attaches as `hubLayout`.
    assertHubShape(HUB_LAYOUT);
    expect(computeWalkableAABBs(HUB_LAYOUT).length).toBeGreaterThan(0);
  });
});
