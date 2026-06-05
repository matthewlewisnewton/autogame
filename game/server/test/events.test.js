import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { SERVER_TO_CLIENT, CLIENT_TO_SERVER } = require('../../shared/events.js');

function assertUniqueStringValues(map, label) {
  const values = Object.values(map);
  expect(values.length).toBeGreaterThan(0);
  for (const value of values) {
    expect(typeof value).toBe('string');
    expect(value.length).toBeGreaterThan(0);
  }
  expect(new Set(values).size).toBe(values.length);
  for (const key of Object.keys(map)) {
    expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
  }
}

describe('shared socket event registry', () => {
  it('exports non-empty maps with unique wire strings', () => {
    assertUniqueStringValues(SERVER_TO_CLIENT, 'serverToClient');
    assertUniqueStringValues(CLIENT_TO_SERVER, 'clientToServer');
  });

  it('spot-checks critical server→client and client→server pairs', () => {
    expect(SERVER_TO_CLIENT.RUN_COMPLETE).toBe('runComplete');
    expect(SERVER_TO_CLIENT.STATE_UPDATE).toBe('stateUpdate');
    expect(CLIENT_TO_SERVER.MOVE).toBe('move');
  });
});
