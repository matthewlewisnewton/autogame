import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { generateHub, generateLayout } from '../../server/dungeon.js';

function warmChannelSum(hex) {
	const r = (hex >> 16) & 0xff;
	const g = (hex >> 8) & 0xff;
	return r + g;
}

describe('fire-cavern atmosphere', () => {
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

	it('lerpFireCavernAtmosphere(1) has higher red/orange channel sum than lerpFireCavernAtmosphere(0)', async () => {
		const { lerpFireCavernAtmosphere } = await import('../renderer.js');
		const rim = lerpFireCavernAtmosphere(0);
		const basin = lerpFireCavernAtmosphere(1);

		expect(warmChannelSum(basin.background)).toBeGreaterThan(warmChannelSum(rim.background));
		expect(warmChannelSum(basin.fogColor)).toBeGreaterThan(warmChannelSum(rim.fogColor));
	});

	it('computeFireCavernAtmosphereBounds returns rim Y > basin Y', async () => {
		const { computeFireCavernAtmosphereBounds } = await import('../renderer.js');
		const layout = generateLayout(42, 'fire-cavern');
		const bounds = computeFireCavernAtmosphereBounds(layout);
		const rim = layout.rooms.find((r) => r.role === 'start');
		const basin = layout.rooms.find((r) => r.band === 'basin');

		expect(bounds).not.toBeNull();
		expect(bounds.rimY).toBe(rim.floorCorners.yNW);
		expect(bounds.basinY).toBe(basin.floorCorners.yNW);
		expect(bounds.rimY).toBeGreaterThan(bounds.basinY);
	});

	it('resetAtmosphere restores default background and removes fog', async () => {
		const { initScene, resetAtmosphere, getScene } = await import('../renderer.js');
		const layout = generateLayout(7, 'fire-cavern');
		initScene(layout, { x: 0, z: 0 });

		const scene = getScene();
		expect(scene.fog).toBeTruthy();

		resetAtmosphere();
		expect(scene.background.getHex()).toBe(0x0f172a);
		expect(scene.fog).toBeNull();
	});

	it('rebuildDungeonLayout re-inits fire atmosphere when swapping layouts', async () => {
		const {
			initScene,
			rebuildDungeonLayout,
			updateFireCavernAtmosphere,
			lerpFireCavernAtmosphere,
			computeFireCavernAtmosphereBounds,
			getScene,
		} = await import('../renderer.js');
		const hub = generateHub(0);
		const fire = generateLayout(99, 'fire-cavern');

		initScene(hub, { x: 0, z: 0 });
		expect(getScene().fog).toBeNull();

		rebuildDungeonLayout(fire);
		const scene = getScene();
		expect(scene.fog).toBeTruthy();
		expect(scene.background.getHex()).toBe(lerpFireCavernAtmosphere(0).background);

		const bounds = computeFireCavernAtmosphereBounds(fire);
		updateFireCavernAtmosphere(bounds.basinY, fire);
		expect(warmChannelSum(scene.background.getHex())).toBeGreaterThan(
			warmChannelSum(lerpFireCavernAtmosphere(0).background),
		);
		expect(scene.background.getHex()).toBe(lerpFireCavernAtmosphere(1).background);

		rebuildDungeonLayout(hub);
		expect(getScene().fog).toBeNull();
		expect(getScene().background.getHex()).toBe(0x0f172a);

		rebuildDungeonLayout(fire);
		expect(computeFireCavernAtmosphereBounds(fire)).toEqual(bounds);
	});
});
