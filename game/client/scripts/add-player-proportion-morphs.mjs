#!/usr/bin/env node
/**
 * Dev helper: add six proportion morph targets to normalized player.glb (sub-ticket 03).
 * Usage (from game/client):
 *   node scripts/add-player-proportion-morphs.mjs [input.glb] [output.glb]
 *
 * Rest pose = 0.0 extreme; morph delta = max − min; influence 0.5 reproduces the input neutral mesh.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';

/** gltf-transform rewrites extras.targetNames to indices; patch the JSON chunk after write. */
function patchGlbTargetNames(filePath, targetNames) {
	const src = readFileSync(filePath);
	const jsonChunkLength = src.readUInt32LE(12);
	const jsonStart = 20;
	const jsonEnd = jsonStart + jsonChunkLength;
	const json = JSON.parse(src.toString('utf8', jsonStart, jsonEnd));

	for (const mesh of json.meshes || []) {
		const morphCount = mesh.primitives?.[0]?.targets?.length ?? 0;
		if (morphCount === targetNames.length) {
			mesh.extras = { ...(mesh.extras || {}), targetNames: [...targetNames] };
		}
	}

	const jsonBuf = Buffer.from(JSON.stringify(json));
	const paddedLen = Math.ceil(jsonBuf.length / 4) * 4;
	const jsonPadded = Buffer.alloc(paddedLen, 0x20);
	jsonBuf.copy(jsonPadded);

	const binStart = jsonEnd;
	const binChunk = src.subarray(binStart);
	const totalLength = 12 + 8 + paddedLen + binChunk.length;
	const out = Buffer.alloc(totalLength);

	out.writeUInt32LE(0x46546c67, 0);
	out.writeUInt32LE(2, 4);
	out.writeUInt32LE(totalLength, 8);
	out.writeUInt32LE(paddedLen, 12);
	out.writeUInt32LE(0x4e4f534a, 16);
	jsonPadded.copy(out, 20);
	binChunk.copy(out, 20 + paddedLen);

	writeFileSync(filePath, out);
}

const MORPH_KEYS = [
	'height',
	'headSize',
	'torsoWidth',
	'armLength',
	'legLength',
	'shoulderWidth',
];

/** Per-key [minFactor, maxFactor] applied in morph regions (symmetric around 1.0 neutral). */
const MORPH_FACTORS = {
	height: [0.9, 1.1],
	headSize: [0.82, 1.18],
	torsoWidth: [0.86, 1.14],
	armLength: [0.88, 1.12],
	legLength: [0.88, 1.12],
	shoulderWidth: [0.84, 1.16],
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultPath = resolve(__dirname, '../public/models/player.glb');
const inPath = resolve(process.argv[2] || defaultPath);
const outPath = resolve(process.argv[3] || inPath);

const io = new NodeIO();
const doc = await io.read(inPath);
const root = doc.getRoot();
const skin = root.listSkins()[0];
const jointNames = skin.listJoints().map((j) => j.getName());
const HEAD_Y = 1.65;
const HIP_Y = 0.95;

function dominantJoint(joints, weights) {
	let best = 0;
	let bestW = 0;
	for (let i = 0; i < 4; i++) {
		const w = weights[i];
		if (w > bestW) {
			bestW = w;
			best = joints[i];
		}
	}
	return best;
}

function morphMask(key, jointIdx, y, x) {
	const jn = jointNames[jointIdx] || '';
	switch (key) {
		case 'height':
			return y > 0.02;
		case 'headSize':
			return (
				y > 1.42 ||
				jn === 'Head' ||
				jn === 'neck_01' ||
				jn.startsWith('index_') ||
				jn.startsWith('middle_') ||
				jn.startsWith('pinky_') ||
				jn.startsWith('ring_') ||
				jn.startsWith('thumb_')
			);
		case 'torsoWidth':
			return (
				(y >= HIP_Y && y <= 1.42 && Math.abs(x) < 0.42) ||
				jn.startsWith('spine_') ||
				jn === 'pelvis'
			);
		case 'armLength':
			return (
				jn.includes('arm') ||
				jn.includes('hand') ||
				jn.startsWith('clavicle') ||
				(y > 1.05 && y < 1.55 && Math.abs(x) > 0.28)
			);
		case 'legLength':
			return y < HIP_Y + 0.05 || jn.includes('thigh') || jn.includes('calf') || jn.includes('foot') || jn.includes('ball');
		case 'shoulderWidth':
			return (
				jn.startsWith('clavicle') ||
				jn.startsWith('upperarm') ||
				(y > 1.28 && y < 1.52 && Math.abs(x) > 0.22)
			);
		default:
			return false;
	}
}

function applyMorph(neutral, key, joints, weights) {
	const [minF, maxF] = MORPH_FACTORS[key];
	const min = new Float32Array(neutral.length);
	const max = new Float32Array(neutral.length);
	const vertCount = neutral.length / 3;

	for (let v = 0; v < vertCount; v++) {
		const i = v * 3;
		const x = neutral[i];
		const y = neutral[i + 1];
		const z = neutral[i + 2];
		const jBase = v * 4;
		const ji = dominantJoint(
			[joints[jBase], joints[jBase + 1], joints[jBase + 2], joints[jBase + 3]],
			[weights[jBase], weights[jBase + 1], weights[jBase + 2], weights[jBase + 3]],
		);

		if (!morphMask(key, ji, y, x)) {
			min[i] = max[i] = x;
			min[i + 1] = max[i + 1] = y;
			min[i + 2] = max[i + 2] = z;
			continue;
		}

		switch (key) {
			case 'height':
				min[i] = x;
				min[i + 1] = y * minF;
				min[i + 2] = z;
				max[i] = x;
				max[i + 1] = y * maxF;
				max[i + 2] = z;
				break;
			case 'headSize': {
				const cx = 0;
				const cy = HEAD_Y;
				const cz = 0;
				const dx = x - cx;
				const dy = y - cy;
				const dz = z - cz;
				min[i] = cx + dx * minF;
				min[i + 1] = cy + dy * minF;
				min[i + 2] = cz + dz * minF;
				max[i] = cx + dx * maxF;
				max[i + 1] = cy + dy * maxF;
				max[i + 2] = cz + dz * maxF;
				break;
			}
			case 'torsoWidth':
				min[i] = x * minF;
				min[i + 1] = y;
				min[i + 2] = z;
				max[i] = x * maxF;
				max[i + 1] = y;
				max[i + 2] = z;
				break;
			case 'armLength': {
				const side = x >= 0 ? 1 : -1;
				const shoulderX = side * 0.38;
				const shoulderY = 1.38;
				const ax = x - shoulderX;
				const ay = y - shoulderY;
				const az = z;
				min[i] = shoulderX + ax * minF;
				min[i + 1] = shoulderY + ay * minF;
				min[i + 2] = shoulderZ(shoulderX, shoulderY, az, minF);
				max[i] = shoulderX + ax * maxF;
				max[i + 1] = shoulderY + ay * maxF;
				max[i + 2] = shoulderZ(shoulderX, shoulderY, az, maxF);
				break;
			}
			case 'legLength': {
				const hipY = HIP_Y;
				const ly = y - hipY;
				min[i] = x;
				min[i + 1] = hipY + ly * minF;
				min[i + 2] = z;
				max[i] = x;
				max[i + 1] = hipY + ly * maxF;
				max[i + 2] = z;
				break;
			}
			case 'shoulderWidth':
				min[i] = x * minF;
				min[i + 1] = y;
				min[i + 2] = z;
				max[i] = x * maxF;
				max[i + 1] = y;
				max[i + 2] = z;
				break;
			default:
				min[i] = max[i] = x;
				min[i + 1] = max[i + 1] = y;
				min[i + 2] = max[i + 2] = z;
		}
	}

	return { min, max };
}

function shoulderZ(sx, sy, az, f) {
	return az * f;
}

function setAccessor(doc, array) {
	return doc.createAccessor().setType('VEC3').setArray(array);
}

for (const mesh of root.listMeshes()) {
	for (const prim of mesh.listPrimitives()) {
		const posAttr = prim.getAttribute('POSITION');
		if (!posAttr) continue;

		const neutral = posAttr.getArray().slice();
		const jointsAttr = prim.getAttribute('JOINTS_0');
		const weightsAttr = prim.getAttribute('WEIGHTS_0');
		const joints = jointsAttr ? jointsAttr.getArray() : null;
		const weights = weightsAttr ? weightsAttr.getArray() : null;

		if (!joints || !weights) {
			console.warn('Skipping primitive without skin weights on mesh', mesh.getName());
			continue;
		}

		const deltas = {};
		const rest = neutral.slice();

		for (const key of MORPH_KEYS) {
			const { min, max } = applyMorph(neutral, key, joints, weights);
			const delta = new Float32Array(neutral.length);
			for (let i = 0; i < neutral.length; i++) {
				delta[i] = max[i] - min[i];
				rest[i] -= 0.5 * delta[i];
			}
			deltas[key] = delta;
		}

		posAttr.setArray(rest);

		for (const target of prim.listTargets()) {
			prim.removeTarget(target);
		}

		for (const key of MORPH_KEYS) {
			const target = doc.createPrimitiveTarget();
			target.setAttribute('POSITION', setAccessor(doc, deltas[key]));
			prim.addTarget(target);
		}
	}

	mesh.setExtras({ ...(mesh.getExtras() || {}), targetNames: [...MORPH_KEYS] });
}

await io.write(outPath, doc);
patchGlbTargetNames(outPath, MORPH_KEYS);

const scene = root.getDefaultScene() || root.listScenes()[0];
const bounds = getBounds(scene);
const height = bounds.max[1] - bounds.min[1];

const bodyMesh = root.listMeshes().find((m) => m.getName().includes('Retopology'));
const bodyTargets = bodyMesh?.listPrimitives()[0]?.listTargets().length ?? 0;

console.log('Wrote', outPath);
console.log('  morph targets on body:', bodyTargets, MORPH_KEYS.join(', '));
console.log('  height:', height.toFixed(4), 'feet y:', bounds.min[1].toFixed(4));
console.log('  targetNames:', bodyMesh?.getExtras()?.targetNames);
