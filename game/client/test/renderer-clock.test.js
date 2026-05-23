import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('renderer animation loop clock', () => {
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
		document.body.innerHTML = '';
	});

	it('uses THREE.Clock.getDelta without requiring a clock.update method', async () => {
		const { initScene } = await import('../renderer.js');

		initScene(null, { x: 0, z: 0 });

		expect(rafCallbacks).toHaveLength(1);
		expect(() => rafCallbacks[0](16)).not.toThrow();
	});
});
