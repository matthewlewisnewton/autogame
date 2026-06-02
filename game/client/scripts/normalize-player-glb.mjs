#!/usr/bin/env node
/**
 * Dev helper: normalize Quaternius Universal Base Characters glTF → player.glb contract.
 * Usage (from game/client):
 *   node scripts/normalize-player-glb.mjs <source.gltf|glb> [output.glb]
 *
 * Requires local Quaternius Standard pack extract (not committed). See SPIKE_DECISION.md.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mat4, vec3 } from 'gl-matrix';
import { NodeIO } from '@gltf-transform/core';
import { getBounds, transformPrimitive } from '@gltf-transform/functions';

const TARGET_HEIGHT = 1.8;
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultOut = resolve(__dirname, '../public/models/player.glb');

const sourcePath = resolve(process.argv[2] || '');
const outPath = resolve(process.argv[3] || defaultOut);

if (!sourcePath) {
	console.error('Usage: node scripts/normalize-player-glb.mjs <source.gltf|glb> [output.glb]');
	process.exit(1);
}

// Quaternius Godot exports reference *_png.png aliases; symlink if missing.
const srcDir = dirname(sourcePath);
for (const [alias, target] of [
	['T_Hair_1_Normal_png.png', 'T_Hair_1_Normal.png'],
	['T_Eye_Normal_png.png', 'T_Eye_Normal.png'],
]) {
	const aliasPath = join(srcDir, alias);
	const targetPath = join(srcDir, target);
	if (!existsSync(aliasPath) && existsSync(targetPath)) {
		writeFileSync(aliasPath, readFileSync(targetPath));
	}
}

const io = new NodeIO();
const doc = await io.read(sourcePath);
const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
const bounds = getBounds(scene);
const height = bounds.max[1] - bounds.min[1];
const scale = TARGET_HEIGHT / height;
const foot = vec3.fromValues(
	(bounds.min[0] + bounds.max[0]) / 2,
	bounds.min[1],
	(bounds.min[2] + bounds.max[2]) / 2,
);

const matrix = mat4.create();
mat4.translate(matrix, matrix, [-foot[0], -foot[1], -foot[2]]);
mat4.scale(matrix, matrix, [scale, scale, scale]);

for (const node of doc.getRoot().listNodes()) {
	const mesh = node.getMesh();
	if (!mesh) continue;
	for (const prim of mesh.listPrimitives()) {
		transformPrimitive(prim, matrix);
	}
}

for (const skin of doc.getRoot().listSkins()) {
	for (const joint of skin.listJoints()) {
		const t = joint.getTranslation();
		const out = vec3.create();
		vec3.transformMat4(out, t, matrix);
		joint.setTranslation(out);
	}
	skin.setInverseBindMatrices(null);
}

const after = getBounds(scene);
const shiftY = -after.min[1];
if (Math.abs(shiftY) > 1e-6) {
	const yMatrix = mat4.fromTranslation(mat4.create(), [0, shiftY, 0]);
	for (const node of doc.getRoot().listNodes()) {
		const mesh = node.getMesh();
		if (!mesh) continue;
		for (const prim of mesh.listPrimitives()) {
			transformPrimitive(prim, yMatrix);
		}
	}
	for (const skin of doc.getRoot().listSkins()) {
		for (const joint of skin.listJoints()) {
			const t = joint.getTranslation();
			const out = vec3.create();
			vec3.transformMat4(out, t, yMatrix);
			joint.setTranslation(out);
		}
		skin.setInverseBindMatrices(null);
	}
}

await io.write(outPath, doc);

const finalBounds = getBounds(scene);
const finalHeight = finalBounds.max[1] - finalBounds.min[1];
const headJoint = doc
	.getRoot()
	.listNodes()
	.find((n) => n.getName() === 'Head');

let tris = 0;
for (const mesh of doc.getRoot().listMeshes()) {
	for (const prim of mesh.listPrimitives()) {
		const idx = prim.getIndices();
		const pos = prim.getAttribute('POSITION');
		tris += (idx ? idx.getCount() : pos.getCount()) / 3;
	}
}

console.log('Wrote', outPath);
console.log('  height:', finalHeight.toFixed(4), '(target', TARGET_HEIGHT + ')');
console.log('  feet y:', finalBounds.min[1].toFixed(4));
console.log(
	'  xz extent:',
	`±${Math.max(Math.abs(finalBounds.min[0]), Math.abs(finalBounds.max[0])).toFixed(3)}`,
	`/ ±${Math.max(Math.abs(finalBounds.min[2]), Math.abs(finalBounds.max[2])).toFixed(3)}`,
);
console.log('  Head bone:', headJoint ? 'Head' : '(missing)');
console.log('  tris:', Math.round(tris));
