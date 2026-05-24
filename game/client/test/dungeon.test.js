import { describe, it, expect } from 'vitest';
import { buildDungeon, buildWallColliders, buildPassageFloorSpec } from '../dungeon.js';
import { generateLayout } from '../../server/dungeon.js';

/** Minimal mock scene that `buildDungeon` only needs `.add()` on. */
function mockScene() {
	return { add: function () {} };
}

/** Build a minimal room object suitable for `buildDungeon`. */
function room(x, z, opts = {}) {
	return {
		x,
		z,
		width: opts.width ?? 8,
		depth: opts.depth ?? 8,
		role: opts.role ?? null,
		walls: opts.walls ?? [],
	};
}

describe('buildDungeon() spawn position', () => {
	it('selects spawn position from the room with role "start" even at non-zero index', () => {
		const layout = {
			rooms: [
				room(10, 10, { role: 'combat' }),
				room(20, 20, { role: 'combat' }),
				room(30, 30, { role: 'start' }),  // start at index 2
				room(40, 40, { role: 'treasure' }),
			],
			passages: [],
		};

		const result = buildDungeon(mockScene(), layout);

		expect(result.spawnPosition.x).toBe(30);
		expect(result.spawnPosition.z).toBe(30);
	});

	it('falls back to rooms[0] center when no room has role "start"', () => {
		const layout = {
			rooms: [
				room(5, 15, { role: 'combat' }),
				room(25, 35, { role: 'treasure' }),
			],
			passages: [],
		};

		const result = buildDungeon(mockScene(), layout);

		expect(result.spawnPosition.x).toBe(5);
		expect(result.spawnPosition.z).toBe(15);
	});
});

describe('buildWallColliders()', () => {
	it('uses passage wall.length for colliders so they match rendered geometry', () => {
		const layout = {
			rooms: [],
			passages: [{
				x1: 0, z1: 0, x2: 20, z2: 0,
				corridorLength: 4,
				walls: [{ x: 10, z: -2, length: 20, axis: 'x' }],
			}],
		};

		const [collider] = buildWallColliders(layout);
		expect(collider.maxX - collider.minX).toBeCloseTo(20 + 0.3);
	});
});

describe('buildPassageFloorSpec()', () => {
	it('spans only the corridor gap between room edges, not full center-to-center distance', () => {
		const layout = generateLayout(42, 'crowded');
		const passage = layout.passages.find(p => p.x1 !== p.x2);
		expect(passage).toBeDefined();

		const spec = buildPassageFloorSpec(passage, layout);
		const centerDist = Math.hypot(passage.x2 - passage.x1, passage.z2 - passage.z1);
		expect(spec.width).toBeCloseTo(passage.corridorLength, 5);
		expect(spec.width).toBeLessThan(centerDist);
	});
});
