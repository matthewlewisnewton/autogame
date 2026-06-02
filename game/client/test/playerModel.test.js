import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLB_PATH = path.join(__dirname, '../public/models/player.glb');
const README_PATH = path.join(__dirname, '../public/models/README.md');

/** Proportion keys from README.md — must match glTF morph target names exactly. */
const EXPECTED_MORPH_NAMES = [
	'height',
	'headSize',
	'torsoWidth',
	'armLength',
	'legLength',
	'shoulderWidth',
];

function parseGlbJson(buffer) {
	const magic = buffer.readUInt32LE(0);
	expect(magic).toBe(0x46546c67); // glTF
	const jsonLen = buffer.readUInt32LE(12);
	const jsonType = buffer.readUInt32LE(16);
	expect(jsonType).toBe(0x4e4f534a); // JSON
	return JSON.parse(buffer.slice(20, 20 + jsonLen).toString('utf8'));
}

function morphNamesFromGltf(json) {
	const mesh = json.meshes?.[0];
	if (!mesh) return { names: [], bodyTargetCount: 0 };
	const bodyPrim = mesh.primitives?.[0];
	const fromExtras = mesh.extras?.targetNames;
	const names = Array.isArray(fromExtras) ? [...fromExtras] : [];
	return {
		names,
		bodyTargetCount: bodyPrim?.targets?.length ?? 0,
	};
}

describe('player.glb morph targets', () => {
	it('README lists the same six proportion morph names', () => {
		const readme = fs.readFileSync(README_PATH, 'utf8');
		for (const name of EXPECTED_MORPH_NAMES) {
			expect(readme).toContain(`| \`${name}\` | \`${name}\` |`);
		}
	});

	it('committed player.glb exposes all expected morph targets on the body mesh', () => {
		const buffer = fs.readFileSync(GLB_PATH);
		const json = parseGlbJson(buffer);
		const { names, bodyTargetCount } = morphNamesFromGltf(json);

		expect(bodyTargetCount).toBe(EXPECTED_MORPH_NAMES.length);
		expect(names).toEqual(EXPECTED_MORPH_NAMES);

		for (const name of EXPECTED_MORPH_NAMES) {
			expect(names).toContain(name);
		}
	});

	it('visor primitive has no morph targets (body-only proportions)', () => {
		const buffer = fs.readFileSync(GLB_PATH);
		const json = parseGlbJson(buffer);
		const visorPrim = json.meshes[0].primitives[1];
		expect(visorPrim.targets).toBeUndefined();
	});
});
