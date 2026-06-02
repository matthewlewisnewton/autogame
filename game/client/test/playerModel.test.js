import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLB_PATH = path.join(__dirname, '../public/models/player.glb');

const PROPORTION_KEYS = [
	'height',
	'headSize',
	'torsoWidth',
	'armLength',
	'legLength',
	'shoulderWidth',
];

function parseGlbJson(glbBuffer) {
	const view = new DataView(glbBuffer.buffer, glbBuffer.byteOffset, glbBuffer.byteLength);
	expect(view.getUint32(0, true)).toBe(0x46546c67);
	expect(view.getUint32(4, true)).toBe(2);

	const totalLength = view.getUint32(8, true);
	let offset = 12;
	let json = null;

	while (offset < totalLength) {
		const chunkLength = view.getUint32(offset, true);
		const chunkType = view.getUint32(offset + 4, true);
		const chunkStart = offset + 8;
		const chunk = glbBuffer.subarray(chunkStart, chunkStart + chunkLength);
		if (chunkType === 0x4e4f534a) {
			const text = chunk.toString('utf8').replace(/\0+$/, '').trimEnd();
			json = JSON.parse(text);
		}
		offset = chunkStart + chunkLength;
	}

	if (!json) throw new Error('GLB missing JSON chunk');
	return json;
}

function findBodyMesh(gltf) {
	const bodyNode = gltf.nodes?.find((n) => n.name === 'PlayerBody');
	expect(bodyNode).toBeDefined();
	return gltf.meshes[bodyNode.mesh];
}

describe('player.glb proportion morph targets', () => {
	it('includes all six README proportion keys on PlayerBody', () => {
		const glb = fs.readFileSync(GLB_PATH);
		const gltf = parseGlbJson(glb);
		const bodyMesh = findBodyMesh(gltf);

		expect(bodyMesh.extras?.targetNames).toEqual(PROPORTION_KEYS);
		expect(bodyMesh.weights).toEqual([0, 0, 0, 0, 0, 0]);

		const targets = bodyMesh.primitives[0].targets;
		expect(targets).toHaveLength(PROPORTION_KEYS.length);
		for (const target of targets) {
			expect(target.POSITION).toBeTypeOf('number');
		}
	});

	it('leaves PlayerVisor without morph targets', () => {
		const glb = fs.readFileSync(GLB_PATH);
		const gltf = parseGlbJson(glb);
		const visorNode = gltf.nodes.find((n) => n.name === 'PlayerVisor');
		const visorMesh = gltf.meshes[visorNode.mesh];
		expect(visorMesh.primitives[0].targets).toBeUndefined();
		expect(visorMesh.extras?.targetNames).toBeUndefined();
	});
});
