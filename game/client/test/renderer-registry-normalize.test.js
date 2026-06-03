import { describe, it, expect } from 'vitest';
import { Mesh, BoxGeometry, Group, Box3, MeshStandardMaterial } from 'three';
import {
	getRegistryTargetFootprint,
	normalizeLoadedRegistryModel,
	ENEMY_GEOMETRY,
} from '../renderer.js';

describe('getRegistryTargetFootprint()', () => {
	it('uses max(height, diameter) for cone enemies', () => {
		expect(getRegistryTargetFootprint('grunt')).toEqual({ targetHeight: 1 });
		expect(getRegistryTargetFootprint('skirmisher')).toEqual({ targetHeight: 0.6 });
		expect(getRegistryTargetFootprint('miniboss')).toEqual({ targetHeight: 1.8 });
	});

	it('uses diameter for octahedron enemies', () => {
		expect(getRegistryTargetFootprint('spawner')).toEqual({ targetHeight: 1.2 });
	});

	it('applies minion height and scale multiplier', () => {
		expect(getRegistryTargetFootprint('ancient_wyrm')).toEqual({ targetHeight: 2.25 });
		expect(getRegistryTargetFootprint('bulkhead_mauler')).toEqual({ targetHeight: 1.2 });
		expect(getRegistryTargetFootprint('null_crawler')).toEqual({ targetHeight: 0.7 });
	});

	it('returns null for keys without geometry tables', () => {
		expect(getRegistryTargetFootprint('player')).toBeNull();
		expect(getRegistryTargetFootprint('magic_stone')).toBeNull();
	});
});

describe('normalizeLoadedRegistryModel()', () => {
	it('scales to target height and grounds bbox min.y at zero', () => {
		const mesh = new Mesh(new BoxGeometry(1, 2, 1), new MeshStandardMaterial({ color: 0xffffff }));
		const model = new Group();
		model.add(mesh);

		normalizeLoadedRegistryModel(model, { targetHeight: 1 });

		const box = new Box3().setFromObject(model);
		expect(box.max.y - box.min.y).toBeCloseTo(1, 5);
		expect(box.min.y).toBeCloseTo(0, 5);
	});
});

describe('ENEMY_GEOMETRY export', () => {
	it('exposes the enemy geometry table for tests', () => {
		expect(ENEMY_GEOMETRY.grunt.height).toBe(1);
	});
});
