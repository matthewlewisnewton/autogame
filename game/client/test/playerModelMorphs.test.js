import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLAYER_GLB = join(__dirname, '..', 'public', 'models', 'player.glb');

const MORPH_KEYS = [
	'height',
	'headSize',
	'torsoWidth',
	'armLength',
	'legLength',
	'shoulderWidth',
];

function readGltfJson(glbPath) {
	const buf = readFileSync(glbPath);
	const jsonLength = buf.readUInt32LE(12);
	return JSON.parse(buf.toString('utf8', 20, 20 + jsonLength));
}

function morphTargetNamesFromGltf(json) {
	const names = new Set();
	for (const mesh of json.meshes || []) {
		const morphCount = mesh.primitives?.[0]?.targets?.length ?? 0;
		if (morphCount === 0) continue;
		const targetNames = mesh.extras?.targetNames;
		expect(targetNames, `mesh ${mesh.name || '(unnamed)'} missing extras.targetNames`).toBeDefined();
		expect(targetNames.length).toBe(morphCount);
		for (const name of targetNames) names.add(name);
	}
	return names;
}

describe('player.glb proportion morph targets', () => {
	it('includes exactly the six canonical morph names on skinned meshes', () => {
		const json = readGltfJson(PLAYER_GLB);
		const names = morphTargetNamesFromGltf(json);
		expect([...names].sort()).toEqual([...MORPH_KEYS].sort());
	});

	it('binds six morph targets on the body mesh primitive', () => {
		const json = readGltfJson(PLAYER_GLB);
		const body = json.meshes.find((m) => (m.name || '').includes('Retopology'));
		expect(body).toBeDefined();
		expect(body.primitives[0].targets).toHaveLength(6);
		expect(body.extras.targetNames).toEqual(MORPH_KEYS);
	});
});
