import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

const ENTITY_KEYS = [
	'grunt',
	'skirmisher',
	'miniboss',
	'spawner',
	'ancient_wyrm',
	'null_crawler',
	'bulkhead_mauler',
];

describe('renderer model fit', () => {
	it('MODEL_FIT covers all seven enemy and minion registry keys', async () => {
		const { MODEL_FIT } = await import('../renderer.js');
		for (const key of ENTITY_KEYS) {
			expect(MODEL_FIT[key], `missing MODEL_FIT for ${key}`).toBeDefined();
			const { targetHeight, targetFootprint } = MODEL_FIT[key];
			expect(
				(targetHeight ?? 0) > 0 || (targetFootprint ?? 0) > 0,
				`${key} needs a positive fit target`,
			).toBe(true);
		}
	});

	it('normalizeLoadedModel scales to target height and grounds feet at y=0', async () => {
		const { normalizeLoadedModel, MODEL_FIT } = await import('../renderer.js');
		const key = 'grunt';
		const targetHeight = MODEL_FIT[key].targetHeight;

		const model = new THREE.Mesh(
			new THREE.BoxGeometry(2, 4, 2),
			new THREE.MeshStandardMaterial({ color: 0xffffff }),
		);

		normalizeLoadedModel(model, key);

		const box = new THREE.Box3().setFromObject(model);
		expect(box.max.y - box.min.y).toBeCloseTo(targetHeight, 4);
		expect(box.min.y).toBeCloseTo(0, 5);
	});
});
