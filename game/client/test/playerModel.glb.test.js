import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { NodeIO } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GLB_PATH = join(__dirname, '../public/models/player.glb');

const REQUIRED_MORPHS = [
	'height',
	'headSize',
	'torsoWidth',
	'armLength',
	'legLength',
	'shoulderWidth',
];

function collectMorphNames(document) {
	const names = new Set();
	for (const mesh of document.getRoot().listMeshes()) {
		const targetNames = mesh.getExtras()?.targetNames;
		if (Array.isArray(targetNames)) {
			for (const name of targetNames) names.add(name);
		}
	}
	return names;
}

describe('player.glb asset contract', () => {
	/** @type {import('@gltf-transform/core').Document} */
	let document;

	beforeAll(async () => {
		const io = new NodeIO();
		document = await io.readBinary(readFileSync(GLB_PATH));
	}, 30000);

	it('includes all six proportion morph target names', () => {
		const names = collectMorphNames(document);
		for (const key of REQUIRED_MORPHS) {
			expect(names.has(key), `missing morph "${key}"`).toBe(true);
		}
		expect(names.size).toBe(REQUIRED_MORPHS.length);
	});

	it('binds six morph targets on every skinned mesh primitive', () => {
		for (const mesh of document.getRoot().listMeshes()) {
			const extras = mesh.getExtras()?.targetNames ?? [];
			expect(extras).toEqual(REQUIRED_MORPHS);
			for (const prim of mesh.listPrimitives()) {
				expect(prim.listTargets().length).toBe(6);
				for (const target of prim.listTargets()) {
					expect(target.getAttribute('POSITION')).not.toBeNull();
				}
			}
		}
	});

	it('keeps normalized standing bounds (height ~1.8, footprint <= 0.5, feet at y=0)', () => {
		const scene = document.getRoot().listScenes()[0];
		const { min, max } = getBounds(scene);
		const height = max[1] - min[1];
		const halfX = Math.max(Math.abs(min[0]), Math.abs(max[0]));
		const halfZ = Math.max(Math.abs(min[2]), Math.abs(max[2]));
		const horiz = Math.max(halfX, halfZ);

		expect(min[1]).toBeCloseTo(0, 2);
		expect(height).toBeCloseTo(1.8, 1);
		expect(horiz).toBeLessThanOrEqual(0.5);
	});
});
