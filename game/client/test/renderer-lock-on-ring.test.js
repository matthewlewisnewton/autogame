import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEFAULT_FLOOR_Y } from '../../shared/floorSampling.esm.js';

describe('syncLockOnRing', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('positions the ring at the supplied render height for the locked flying enemy', async () => {
		const lockOn = await import('../lockOn.js');
		const {
			initScene,
			syncLockOnRing,
			flyingRenderOffset,
			enemyMeshHalfHeight,
			getMeshMaps,
		} = await import('../renderer.js');

		lockOn.clearAllLockOnState();
		initScene(null, { x: 0, z: 0 });

		const enemy = {
			id: 'flyer',
			type: 'ember_wraith',
			x: 4,
			z: 2,
			flying: true,
			altitude: 3,
			hp: 50,
		};
		const renderY = enemyMeshHalfHeight(enemy.type) + flyingRenderOffset(enemy, null);
		expect(renderY).toBeGreaterThan(DEFAULT_FLOOR_Y);

		lockOn.handleLockOnPress([enemy], 0, DEFAULT_FLOOR_Y, 0, 'unlock', 0, null);
		syncLockOnRing(enemy.id, enemy.x, renderY, enemy.z);

		const ring = getMeshMaps().enemyLockOnRings[enemy.id];
		expect(ring).toBeDefined();
		expect(ring.visible).toBe(true);
		expect(ring.position.x).toBe(enemy.x);
		expect(ring.position.y).toBe(renderY);
		expect(ring.position.z).toBe(enemy.z);
	});

	it('hides the ring when lock-on cycles away from that enemy', async () => {
		const lockOn = await import('../lockOn.js');
		const { initScene, syncLockOnRing, getMeshMaps } = await import('../renderer.js');

		lockOn.clearAllLockOnState();
		initScene(null, { x: 0, z: 0 });

		const first = { id: 'a', x: 1, z: 0, hp: 50 };
		const second = { id: 'b', x: 2, z: 0, hp: 50 };
		const pool = [first, second];
		lockOn.handleLockOnPress(pool, 0, DEFAULT_FLOOR_Y, 0, 'unlock', 0, null);
		syncLockOnRing(first.id, first.x, 1, first.z);
		expect(getMeshMaps().enemyLockOnRings[first.id]?.visible).toBe(true);

		lockOn.handleLockOnPress(pool, 0, DEFAULT_FLOOR_Y, 0, 'cycle', 0, null);
		syncLockOnRing(first.id, first.x, 1, first.z);
		expect(getMeshMaps().enemyLockOnRings[first.id]?.visible).toBe(false);
	});
});
