import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CAMERA_HEIGHT, CAMERA_FAR } from '../config.js';
import { DEFAULT_FLOOR_Y, sampleFloorY } from '../../shared/floorSampling.esm.js';

describe('renderer camera orbit (spire ascent)', () => {
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

	function spireBaseLayout() {
		return {
			profile: 'spire-ascent',
			rooms: [
				{
					x: 0, z: 0, width: 12, depth: 12, role: 'start', walls: [],
					floorCorners: { yNW: DEFAULT_FLOOR_Y, yNE: DEFAULT_FLOOR_Y, ySE: DEFAULT_FLOOR_Y, ySW: DEFAULT_FLOOR_Y },
				},
			],
			passages: [],
		};
	}

	it('initScene lookAt uses sampleFloorY at spawn (spire base)', async () => {
		const layout = spireBaseLayout();
		const { initScene, getCamera } = await import('../renderer.js');
		initScene(layout, { x: 0, z: 0 });
		const camera = getCamera();
		const spawnFloorY = sampleFloorY(layout, 0, 0) ?? DEFAULT_FLOOR_Y;
		expect(camera._lookAt).toEqual({ x: 0, y: spawnFloorY, z: 0 });
	});

	it('updateCameraOrbit raises target and lookAt Y with elevated playerY', async () => {
		const { initScene, getCamera, updateCameraOrbit } = await import('../renderer.js');
		initScene(null, { x: 0, z: 0 });
		const camera = getCamera();

		updateCameraOrbit(4, 12.5, -8, 0.2);
		expect(camera.position.y).toBeCloseTo(12.5 + CAMERA_HEIGHT, 4);
		expect(camera._lookAt).toEqual({ x: 4, y: 12.5, z: -8 });
	});

	it('CAMERA_FAR exceeds max spire tier Y plus orbit margin', async () => {
		const { generateLayout } = await import('../../server/dungeon.js');
		const layout = generateLayout(42, 'spire-ascent');
		const tiers = layout.rooms.filter(r => r.band === 'tier');
		const top = tiers.reduce((best, tier) => {
			const y = sampleFloorY(layout, tier.x, tier.z) ?? DEFAULT_FLOOR_Y;
			return y > best ? y : best;
		}, DEFAULT_FLOOR_Y);
		const margin = CAMERA_HEIGHT + 20;
		expect(CAMERA_FAR).toBeGreaterThan(top + margin);
	});
});
