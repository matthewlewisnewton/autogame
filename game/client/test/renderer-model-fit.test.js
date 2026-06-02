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

const ENEMY_GROUND_OFFSET = {
	grunt: 0.5,
	skirmisher: 0.3,
	miniboss: 0.9,
	spawner: 0.6,
};

function makeTestModel() {
	return new THREE.Mesh(
		new THREE.BoxGeometry(2, 4, 2),
		new THREE.MeshStandardMaterial({ color: 0xffffff }),
	);
}

describe('renderer model fit', () => {
	it('MODEL_FIT covers all seven enemy and minion registry keys', async () => {
		const { MODEL_FIT } = await import('../renderer.js');
		for (const key of ENTITY_KEYS) {
			expect(MODEL_FIT[key], `missing MODEL_FIT for ${key}`).toBeDefined();
			const { targetHeight, targetFootprint, groundOffset } = MODEL_FIT[key];
			expect(
				(targetHeight ?? 0) > 0 || (targetFootprint ?? 0) > 0,
				`${key} needs a positive fit target`,
			).toBe(true);
			expect(groundOffset, `${key} missing groundOffset`).toBeGreaterThan(0);
		}
	});

	it('MODEL_FIT groundOffset matches render-loop host Y lift', async () => {
		const { MODEL_FIT } = await import('../renderer.js');
		for (const [key, offset] of Object.entries(ENEMY_GROUND_OFFSET)) {
			expect(MODEL_FIT[key].groundOffset).toBeCloseTo(offset, 5);
		}
		for (const key of ['ancient_wyrm', 'null_crawler', 'bulkhead_mauler']) {
			expect(MODEL_FIT[key].groundOffset).toBeCloseTo(0.5, 5);
		}
	});

	it('normalizeLoadedModel scales to target height and offsets local feet for host lift', async () => {
		const { normalizeLoadedModel, MODEL_FIT } = await import('../renderer.js');
		const key = 'grunt';
		const { targetHeight, groundOffset } = MODEL_FIT[key];
		const model = makeTestModel();

		normalizeLoadedModel(model, key);

		const box = new THREE.Box3().setFromObject(model);
		expect(box.max.y - box.min.y).toBeCloseTo(targetHeight, 4);
		expect(box.min.y).toBeCloseTo(-groundOffset, 5);
	});

	it('normalizeLoadedModel grounds feet at world y=0 on lifted host', async () => {
		const { normalizeLoadedModel, MODEL_FIT } = await import('../renderer.js');

		for (const key of ENTITY_KEYS) {
			const { groundOffset } = MODEL_FIT[key];
			const host = new THREE.Group();
			host.position.y = groundOffset;

			const model = makeTestModel();
			normalizeLoadedModel(model, key);
			host.add(model);

			// Test stub walks host→child positions; real runtime uses updateMatrixWorld + setFromObject(model).
			const worldBox = new THREE.Box3().setFromObject(host);
			expect(worldBox.min.y, `world feet for ${key}`).toBeCloseTo(0, 4);
		}
	});

});
