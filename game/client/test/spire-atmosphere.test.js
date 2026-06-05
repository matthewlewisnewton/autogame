import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { generateHub, generateLayout } from '../../server/dungeon.js';

function channelLuminance(hex) {
	const c = new THREE.Color(hex);
	return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
}

describe('spire-ascent atmosphere', () => {
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

	it('lerpSpireAtmosphere(0) is darker than lerpSpireAtmosphere(1) for background and fog', async () => {
		const { lerpSpireAtmosphere } = await import('../renderer.js');
		const base = lerpSpireAtmosphere(0);
		const summit = lerpSpireAtmosphere(1);

		expect(channelLuminance(base.background)).toBeLessThan(channelLuminance(summit.background));
		expect(channelLuminance(base.fogColor)).toBeLessThan(channelLuminance(summit.fogColor));
		expect(base.fogFar).toBeLessThan(summit.fogFar);
	});

	it('computeSpireAtmosphereBounds uses bottom and top tier floor Y', async () => {
		const { computeSpireAtmosphereBounds } = await import('../renderer.js');
		const layout = generateLayout(42, 'spire-ascent');
		const bounds = computeSpireAtmosphereBounds(layout);
		const tiers = layout.rooms
			.filter((r) => r.band === 'tier')
			.sort((a, b) => a.tierIndex - b.tierIndex);

		expect(bounds).not.toBeNull();
		expect(bounds.bottomY).toBe(tiers[0].floorCorners.yNW);
		expect(bounds.topY).toBe(tiers[tiers.length - 1].floorCorners.yNW);
		expect(bounds.topY).toBeGreaterThan(bounds.bottomY);
	});

	it('resetAtmosphere restores default background and removes fog', async () => {
		const { initScene, resetAtmosphere, getScene } = await import('../renderer.js');
		const layout = generateLayout(7, 'spire-ascent');
		initScene(layout, { x: 0, z: 0 });

		const scene = getScene();
		expect(scene.fog).toBeTruthy();

		resetAtmosphere();
		expect(scene.background.getHex()).toBe(0x0f172a);
		expect(scene.fog).toBeNull();
	});

	it('rebuildDungeonLayout re-inits spire atmosphere when swapping layouts', async () => {
		const {
			initScene,
			rebuildDungeonLayout,
			updateSpireAscentAtmosphere,
			lerpSpireAtmosphere,
			computeSpireAtmosphereBounds,
			getScene,
		} = await import('../renderer.js');
		const hub = generateHub(0);
		const spire = generateLayout(99, 'spire-ascent');

		initScene(hub, { x: 0, z: 0 });
		expect(getScene().fog).toBeNull();

		rebuildDungeonLayout(spire);
		const scene = getScene();
		expect(scene.fog).toBeTruthy();
		expect(scene.background.getHex()).toBe(lerpSpireAtmosphere(0).background);

		const bounds = computeSpireAtmosphereBounds(spire);
		updateSpireAscentAtmosphere(bounds.topY, spire);
		expect(channelLuminance(scene.background.getHex())).toBeGreaterThan(
			channelLuminance(lerpSpireAtmosphere(0).background),
		);
		expect(scene.background.getHex()).toBe(lerpSpireAtmosphere(1).background);

		rebuildDungeonLayout(hub);
		expect(getScene().fog).toBeNull();
		expect(getScene().background.getHex()).toBe(0x0f172a);

		rebuildDungeonLayout(spire);
		expect(computeSpireAtmosphereBounds(spire)).toEqual(bounds);
	});
});
