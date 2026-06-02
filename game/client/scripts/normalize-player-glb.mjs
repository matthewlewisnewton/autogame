#!/usr/bin/env node
/**
 * Dev-only: normalize Quaternius Universal Base Characters glTF → player.glb contract.
 * Usage:
 *   node scripts/normalize-player-glb.mjs <source.gltf|source.glb> [output.glb]
 *
 * Default output: public/models/player.glb
 */
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { center, getBounds, prune } from '@gltf-transform/functions';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = join(__dirname, '..');
const TARGET_HEIGHT = 1.8;
const MID_TORSO_Y = 0.9;
const MID_TORSO_BAND = 0.08;
const MAX_TORSO_RADIUS = 0.5;

const sourcePath = resolve(process.argv[2] || '');
const outputPath = resolve(
	process.argv[3] || join(CLIENT_ROOT, 'public/models/player.glb'),
);

if (!sourcePath) {
	console.error('Usage: node scripts/normalize-player-glb.mjs <source.gltf|glb> [output.glb]');
	process.exit(1);
}

const io = new NodeIO();
const doc = await io.read(sourcePath);
const root = doc.getRoot();

// Spike: no separate hair/eyebrow accessories (hats are separate glTF later).
const eyebrows = root.listNodes().find((n) => n.getName() === 'Eyebrows');
if (eyebrows) eyebrows.dispose();

await doc.transform(
	prune({
		keepAttributes: true,
		keepIndices: true,
		keepLeaves: false,
	}),
);

const scene = root.listScenes()[0];
if (!scene) throw new Error('No scene in source glTF');

function midTorsoRadius(bounds) {
	const yTarget = bounds.min[1] + MID_TORSO_Y;
	let minX = Infinity;
	let maxX = -Infinity;
	let minZ = Infinity;
	let maxZ = -Infinity;
	for (const node of root.listNodes()) {
		const mesh = node.getMesh();
		if (!mesh) continue;
		for (const prim of mesh.listPrimitives()) {
			const pos = prim.getAttribute('POSITION');
			if (!pos) continue;
			const arr = pos.getArray();
			for (let i = 0; i < arr.length; i += 3) {
				const y = arr[i + 1];
				if (Math.abs(y - yTarget) > MID_TORSO_BAND) continue;
				minX = Math.min(minX, arr[i]);
				maxX = Math.max(maxX, arr[i]);
				minZ = Math.min(minZ, arr[i + 2]);
				maxZ = Math.max(maxZ, arr[i + 2]);
			}
		}
	}
	return Math.max((maxX - minX) / 2, (maxZ - minZ) / 2);
}

let bounds = getBounds(scene);
const height = bounds.max[1] - bounds.min[1];
const uniformScale = TARGET_HEIGHT / height;

await doc.transform(center({ pivot: 'below' }));
bounds = getBounds(scene);

const pivot =
	root.listNodes().find((n) => n.getName() === 'root') ||
	root.listNodes().find((n) => n.getName() === 'Armature') ||
	scene.listChildren()[0];
if (pivot) {
	const [sx, sy, sz] = pivot.getScale();
	pivot.setScale([sx * uniformScale, sy * uniformScale, sz * uniformScale]);
}
bounds = getBounds(scene);

const torsoR = midTorsoRadius(bounds);
if (torsoR > MAX_TORSO_RADIUS) {
	console.warn(
		`[normalize-player-glb] mid-torso radius ${torsoR.toFixed(3)} > ${MAX_TORSO_RADIUS}; document T-pose overhang in README`,
	);
}

await mkdir(dirname(outputPath), { recursive: true });
await io.write(outputPath, doc);

const head = root.listNodes().find((n) => n.getName() === 'Head');
const headPos = head?.getTranslation() || [0, 0, 0];

console.log('[normalize-player-glb] wrote', outputPath);
console.log('  bounds min', bounds.min.map((v) => +v.toFixed(4)));
console.log('  bounds max', bounds.max.map((v) => +v.toFixed(4)));
console.log('  height', (bounds.max[1] - bounds.min[1]).toFixed(4));
console.log('  mid-torso radius', torsoR.toFixed(4));
console.log('  head bone translation (model space)', headPos.map((v) => +v.toFixed(4)));
