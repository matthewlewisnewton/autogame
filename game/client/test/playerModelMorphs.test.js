import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAYER_GLB = path.join(__dirname, '../public/models/player.glb');

const REQUIRED_MORPH_NAMES = [
	'height',
	'headSize',
	'torsoWidth',
	'armLength',
	'legLength',
	'shoulderWidth',
];

function parseGlbJson(buffer) {
	const jsonChunkLength = buffer.readUInt32LE(12);
	const jsonStart = 20;
	return JSON.parse(buffer.slice(jsonStart, jsonStart + jsonChunkLength).toString('utf8'));
}

function collectTargetNames(json) {
	const names = new Set();
	for (const mesh of json.meshes ?? []) {
		const meshNames = mesh.extras?.targetNames;
		if (Array.isArray(meshNames)) {
			for (const n of meshNames) names.add(n);
		}
		for (const prim of mesh.primitives ?? []) {
			const primNames = prim.extras?.targetNames;
			if (Array.isArray(primNames)) {
				for (const n of primNames) names.add(n);
			}
			const count = prim.targets?.length ?? 0;
			if (count > 0 && Array.isArray(meshNames) && meshNames.length === count) {
				for (const n of meshNames) names.add(n);
			}
		}
	}
	return names;
}

function meshesWithMorphTargets(json) {
	return (json.meshes ?? []).filter((mesh) =>
		(mesh.primitives ?? []).some((p) => (p.targets?.length ?? 0) > 0)
	);
}

describe('player.glb proportion morph targets', () => {
	it('exists on disk', () => {
		expect(fs.existsSync(PLAYER_GLB)).toBe(true);
	});

	it('includes exactly the six canonical morph target names', () => {
		const buffer = fs.readFileSync(PLAYER_GLB);
		const json = parseGlbJson(buffer);
		const found = collectTargetNames(json);

		for (const name of REQUIRED_MORPH_NAMES) {
			expect(found.has(name), `missing morph target "${name}"`).toBe(true);
		}
		expect(found.size, `expected 6 names, found: ${[...found].join(', ')}`).toBe(6);
	});

	it('binds six POSITION targets on every skinned mesh primitive', () => {
		const buffer = fs.readFileSync(PLAYER_GLB);
		const json = parseGlbJson(buffer);
		const morphed = meshesWithMorphTargets(json);
		expect(morphed.length).toBeGreaterThan(0);

		for (const mesh of morphed) {
			expect(mesh.extras?.targetNames).toEqual(REQUIRED_MORPH_NAMES);
			for (const prim of mesh.primitives) {
				expect(prim.targets?.length).toBe(6);
				for (const target of prim.targets) {
					expect(target.POSITION).toBeDefined();
				}
			}
		}
	});
});
