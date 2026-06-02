import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLAYER_GLB = join(__dirname, '../public/models/player.glb');

const REQUIRED_MORPHS = [
	'height',
	'headSize',
	'torsoWidth',
	'armLength',
	'legLength',
	'shoulderWidth',
];

/** Read the JSON chunk from a binary .glb without loading Three.js (avoids test mocks). */
function readGlbJson(path) {
	const buf = readFileSync(path);
	const jsonLength = buf.readUInt32LE(12);
	const jsonStart = 20;
	return JSON.parse(buf.toString('utf8', jsonStart, jsonStart + jsonLength));
}

function morphTargetNamesFromGltf(json) {
	const names = new Set();
	for (const mesh of json.meshes ?? []) {
		const targetNames = mesh.extras?.targetNames;
		if (!targetNames) continue;
		for (const name of targetNames) {
			names.add(name);
		}
	}
	return names;
}

describe('player.glb proportion morph targets', () => {
	it('includes exactly the six canonical morph target names', () => {
		const json = readGlbJson(PLAYER_GLB);
		const found = morphTargetNamesFromGltf(json);

		expect(found.size).toBe(REQUIRED_MORPHS.length);
		for (const name of REQUIRED_MORPHS) {
			expect(found.has(name)).toBe(true);
		}
		for (const name of found) {
			expect(REQUIRED_MORPHS).toContain(name);
		}
	});
});
