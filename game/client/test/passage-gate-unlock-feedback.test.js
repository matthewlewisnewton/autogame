import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('passage gate unlock feedback', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function minimalLayout() {
		return {
			profile: 'default',
			passageWidth: 4,
			rooms: [],
			passages: [
				{ x1: 0, z1: 0, x2: 12, z2: 0, walls: [] },
			],
		};
	}

	it('plays unlock feedback exactly once when a passage transitions locked to unlocked', async () => {
		const { initScene, syncPassageLockGates, getActiveEffects } = await import('../renderer.js');

		const layout = minimalLayout();
		initScene(layout, { x: 0, z: 0 });

		const locked = [{ passageIndex: 0, locked: true }];
		const unlocked = [{ passageIndex: 0, locked: false }];

		syncPassageLockGates(locked, layout);
		const baselineEffects = getActiveEffects().length;

		syncPassageLockGates(unlocked, layout);
		const afterUnlockEffects = getActiveEffects().length;
		expect(afterUnlockEffects).toBeGreaterThan(baselineEffects);

		syncPassageLockGates(unlocked, layout);
		expect(getActiveEffects().length).toBe(afterUnlockEffects);
	});

	it('spawns unlock VFX without leaving the gate mesh in the scene map', async () => {
		const { initScene, syncPassageLockGates, getMeshMaps, getActiveEffects } =
			await import('../renderer.js');

		const layout = minimalLayout();
		initScene(layout, { x: 0, z: 0 });

		syncPassageLockGates([{ passageIndex: 0, locked: true }], layout);
		expect(Object.keys(getMeshMaps().passageGateMeshes)).toHaveLength(1);

		syncPassageLockGates([{ passageIndex: 0, locked: false }], layout);
		expect(Object.keys(getMeshMaps().passageGateMeshes)).toHaveLength(0);
		expect(getActiveEffects().length).toBeGreaterThan(0);
	});
});
