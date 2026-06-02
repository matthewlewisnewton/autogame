import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('smoke bomb VFX', () => {
	let rafCallbacks;

	beforeEach(() => {
		vi.resetModules();
		rafCallbacks = [];
		vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		}));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('triggerSmokeBombVFX is exported and adds a fog mesh to the scene/registry', async () => {
		const { initScene, getScene, triggerSmokeBombVFX, getSmokeBombVFXIds } = await import('../renderer.js');
		initScene(null, { x: 0, z: 0 });

		expect(typeof triggerSmokeBombVFX).toBe('function');

		const before = getScene().children.length;
		triggerSmokeBombVFX('p1', { x: 5, z: -3 }, 4);

		expect(getScene().children.length).toBe(before + 1);
		expect(getSmokeBombVFXIds()).toContain('p1');

		const mesh = getScene().children[getScene().children.length - 1];
		// Positioned at the zone center, sitting on the floor.
		expect(mesh.position.x).toBe(5);
		expect(mesh.position.z).toBe(-3);
		// Sized to the zone radius.
		expect(mesh.geometry.parameters.radiusTop).toBe(4);
		// Semi-transparent.
		expect(mesh.material.transparent).toBe(true);
		expect(mesh.material.opacity).toBeGreaterThan(0);
		expect(mesh.material.opacity).toBeLessThan(1);
	});

	it('is idempotent — does not stack duplicate VFX for the same zone owner', async () => {
		const { initScene, getScene, triggerSmokeBombVFX, getSmokeBombVFXIds } = await import('../renderer.js');
		initScene(null, { x: 0, z: 0 });

		triggerSmokeBombVFX('p1', { x: 0, z: 0 }, 4);
		const afterFirst = getScene().children.length;
		triggerSmokeBombVFX('p1', { x: 0, z: 0 }, 4);

		expect(getScene().children.length).toBe(afterFirst);
		expect(getSmokeBombVFXIds()).toEqual(['p1']);
	});

	it('removeSmokeBombVFX drops the registry entry and disposes on fade-out', async () => {
		let now = 1000;
		vi.spyOn(performance, 'now').mockImplementation(() => now);

		const { initScene, getScene, triggerSmokeBombVFX, removeSmokeBombVFX, getSmokeBombVFXIds } = await import('../renderer.js');
		initScene(null, { x: 0, z: 0 });

		triggerSmokeBombVFX('p1', { x: 0, z: 0 }, 4);
		const mesh = getScene().children[getScene().children.length - 1];
		const geoDispose = vi.spyOn(mesh.geometry, 'dispose');
		const matDispose = vi.spyOn(mesh.material, 'dispose');

		removeSmokeBombVFX('p1');

		// Registry entry is dropped immediately so it can't re-remove or block a retrigger.
		expect(getSmokeBombVFXIds()).not.toContain('p1');

		// Advance past the fade window and run the queued fade callback (the most
		// recently scheduled rAF) to completion.
		now += 1000;
		expect(rafCallbacks.length).toBeGreaterThan(0);
		rafCallbacks[rafCallbacks.length - 1]();

		expect(geoDispose).toHaveBeenCalled();
		expect(matDispose).toHaveBeenCalled();
	});

	it('removeSmokeBombVFX is a no-op when no VFX exists for the player', async () => {
		const { initScene, removeSmokeBombVFX, getSmokeBombVFXIds } = await import('../renderer.js');
		initScene(null, { x: 0, z: 0 });

		expect(() => removeSmokeBombVFX('ghost')).not.toThrow();
		expect(getSmokeBombVFXIds()).toEqual([]);
	});
});
