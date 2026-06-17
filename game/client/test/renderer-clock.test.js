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

		// initGamepadActivation() registers a poll loop rAF; animate() registers the render loop.
		expect(rafCallbacks).toHaveLength(2);
		expect(() => rafCallbacks[1](16)).not.toThrow();
	});
});
