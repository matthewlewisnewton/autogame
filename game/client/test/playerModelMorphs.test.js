import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLAYER_GLB = join(__dirname, '../public/models/player.glb');

const REQUIRED_MORPH_NAMES = [
	'height',
	'headSize',
	'torsoWidth',
	'armLength',
	'legLength',
	'shoulderWidth',
];

/**
 * @param {Uint8Array} bytes
 * @returns {object}
 */
function readGlbJsonChunk(bytes) {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const magic = view.getUint32(0, true);
	expect(magic).toBe(0x46546c67);

	const jsonChunkLength = view.getUint32(12, true);
	const jsonChunkType = view.getUint32(16, true);
	expect(jsonChunkType).toBe(0x4e4f534a);

	const jsonBytes = bytes.subarray(20, 20 + jsonChunkLength);
	return JSON.parse(new TextDecoder().decode(jsonBytes));
}

/**
 * @param {object} gltf
 * @returns {Set<string>}
 */
function collectMorphTargetNames(gltf) {
	const names = new Set();
	for (const mesh of gltf.meshes || []) {
		const targetNames = mesh.extras?.targetNames;
		if (Array.isArray(targetNames)) {
			for (const name of targetNames) {
				names.add(name);
			}
		}
	}
	return names;
}

describe('player.glb proportion morph targets', () => {
	it('includes exactly the six canonical morph target names', () => {
		const bytes = readFileSync(PLAYER_GLB);
		const gltf = readGlbJsonChunk(bytes);
		const found = collectMorphTargetNames(gltf);

		for (const name of REQUIRED_MORPH_NAMES) {
			expect(found.has(name), `missing morph target "${name}"`).toBe(true);
		}

		for (const name of found) {
			expect(
				REQUIRED_MORPH_NAMES.includes(name),
				`unexpected morph target "${name}"`,
			).toBe(true);
		}

		expect(found.size).toBe(REQUIRED_MORPH_NAMES.length);
	});

	it('defines morph targets on every mesh primitive', () => {
		const bytes = readFileSync(PLAYER_GLB);
		const gltf = readGlbJsonChunk(bytes);

		for (const mesh of gltf.meshes || []) {
			expect(mesh.extras?.targetNames).toEqual(REQUIRED_MORPH_NAMES);
			for (const prim of mesh.primitives || []) {
				expect(prim.targets?.length).toBe(REQUIRED_MORPH_NAMES.length);
			}
		}
	});
});
