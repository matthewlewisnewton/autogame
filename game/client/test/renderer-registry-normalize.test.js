import { describe, it, expect } from 'vitest';
import { Mesh, BoxGeometry, Group, Box3, MeshStandardMaterial } from 'three';
import {
	getRegistryTargetFootprint,
	getRegistryHostVerticalOffset,
	normalizeLoadedRegistryModel,
	enemyMeshHalfHeight,
	ENEMY_GEOMETRY,
} from '../renderer.js';

describe('getRegistryTargetFootprint()', () => {
	it('uses max(height, diameter) for cone enemies', () => {
		expect(getRegistryTargetFootprint('grunt')).toEqual({ targetHeight: 1 });
		expect(getRegistryTargetFootprint('skirmisher')).toEqual({ targetHeight: 0.6 });
		expect(getRegistryTargetFootprint('miniboss')).toEqual({ targetHeight: 1.8 });
		expect(getRegistryTargetFootprint('annex_overseer')).toEqual({ targetHeight: 2 });
	});

	it('uses diameter for octahedron enemies', () => {
		expect(getRegistryTargetFootprint('spawner')).toEqual({ targetHeight: 1.2 });
	});

	it('applies minion height and scale multiplier', () => {
		expect(getRegistryTargetFootprint('ancient_wyrm')).toEqual({ targetHeight: 2.25 });
		expect(getRegistryTargetFootprint('bulkhead_mauler')).toEqual({ targetHeight: 1.2 });
		expect(getRegistryTargetFootprint('null_crawler')).toEqual({ targetHeight: 0.7 });
	});

	it('normalizes the player avatar to the ~1.8 spike-contract height', () => {
		expect(getRegistryTargetFootprint('player')).toEqual({ targetHeight: 1.8 });
	});

	it('returns null for keys without geometry tables', () => {
		expect(getRegistryTargetFootprint('magic_stone')).toBeNull();
	});
});

describe('getRegistryHostVerticalOffset()', () => {
	it('matches enemyMeshHalfHeight for enemy registry keys', () => {
		expect(getRegistryHostVerticalOffset('grunt')).toBe(enemyMeshHalfHeight('grunt'));
		expect(getRegistryHostVerticalOffset('skirmisher')).toBe(enemyMeshHalfHeight('skirmisher'));
		expect(getRegistryHostVerticalOffset('miniboss')).toBe(enemyMeshHalfHeight('miniboss'));
		expect(getRegistryHostVerticalOffset('annex_overseer')).toBe(enemyMeshHalfHeight('annex_overseer'));
		expect(getRegistryHostVerticalOffset('spawner')).toBe(enemyMeshHalfHeight('spawner'));
	});

	it('returns 0.5 for minion registry keys', () => {
		expect(getRegistryHostVerticalOffset('ancient_wyrm')).toBe(0.5);
		expect(getRegistryHostVerticalOffset('null_crawler')).toBe(0.5);
		expect(getRegistryHostVerticalOffset('bulkhead_mauler')).toBe(0.5);
	});

	it('returns 0 for keys without a raised host', () => {
		expect(getRegistryHostVerticalOffset('player')).toBe(0);
		expect(getRegistryHostVerticalOffset('magic_stone')).toBe(0);
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

function attachNormalizedRegistryModel(key, host, stubModel) {
	const footprint = getRegistryTargetFootprint(key);
	if (!footprint) return;
	normalizeLoadedRegistryModel(stubModel, footprint);
	stubModel.position.y -= getRegistryHostVerticalOffset(key);
	host.add(stubModel);
}

/** World-space bbox min.y (host y + local min.y; mock Three has no updateMatrixWorld). */
function worldBoxMinY(host, model) {
	const localBox = new Box3().setFromObject(model);
	return host.position.y + localBox.min.y;
}

describe('registry model world grounding', () => {
	it('places enemy model feet at world y=0 when host is at enemyMeshHalfHeight', () => {
		const key = 'grunt';
		const host = new Group();
		host.position.y = enemyMeshHalfHeight(key);

		const stub = new Group();
		stub.add(new Mesh(new BoxGeometry(1, 2, 1), new MeshStandardMaterial({ color: 0xffffff })));
		attachNormalizedRegistryModel(key, host, stub);

		expect(worldBoxMinY(host, stub)).toBeCloseTo(0, 5);
	});

	it('places minion model feet at world y=0 when host is at y=0.5', () => {
		const key = 'ancient_wyrm';
		const host = new Group();
		host.position.y = 0.5;

		const stub = new Group();
		stub.add(new Mesh(new BoxGeometry(1, 2, 1), new MeshStandardMaterial({ color: 0xffffff })));
		attachNormalizedRegistryModel(key, host, stub);

		expect(worldBoxMinY(host, stub)).toBeCloseTo(0, 5);
	});
});

describe('ENEMY_GEOMETRY export', () => {
	it('exposes the enemy geometry table for tests', () => {
		expect(ENEMY_GEOMETRY.grunt.height).toBe(1);
	});
});
