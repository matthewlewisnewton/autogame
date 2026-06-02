#!/usr/bin/env node
/**
 * Dev-only: add six proportion morph targets to normalized player.glb.
 *
 * Usage:
 *   node scripts/add-player-proportion-morphs.mjs [input.glb] [output.glb]
 *
 * Morph deltas are authored so runtime influence maps as:
 *   position = base + (influence - 0.5) * 2 * delta
 * with influence in [0, 1] and neutral at 0.5 (see MODEL_SPIKE.md).
 * Stored glTF deltas are (highExtreme - neutralBase).
 */
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = join(__dirname, '..');

export const PROPORTION_MORPH_KEYS = [
	'height',
	'headSize',
	'torsoWidth',
	'armLength',
	'legLength',
	'shoulderWidth',
];

const inputPath = resolve(
	process.argv[2] || join(CLIENT_ROOT, 'public/models/player.glb'),
);
const outputPath = resolve(
	process.argv[3] || inputPath,
);

function smoothstep(edge0, edge1, x) {
	const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

function bandWeight(y, y0, y1) {
	return smoothstep(y0, y0 + 0.08, y) * (1 - smoothstep(y1 - 0.08, y1, y));
}

function scaleAround(p, pivot, scale) {
	return [
		pivot[0] + (p[0] - pivot[0]) * scale[0],
		pivot[1] + (p[1] - pivot[1]) * scale[1],
		pivot[2] + (p[2] - pivot[2]) * scale[2],
	];
}

/** @typedef {(p: number[], amount: number) => number[]} MorphFn */

/** @type {Record<string, MorphFn>} */
export const MORPH_FNS = {
	height(p, amount) {
		const sy = 1 + amount * 0.07;
		const sxz = 1 + amount * 0.015;
		return [p[0] * sxz, p[1] * sy, p[2] * sxz];
	},
	headSize(p, amount) {
		const headMinY = 1.4;
		if (p[1] < headMinY) return p.slice();
		const t = smoothstep(headMinY, 1.78, p[1]);
		const s = 1 + amount * 0.12 * t;
		return scaleAround(p, [0, 1.62, 0], [s, s, s]);
	},
	torsoWidth(p, amount) {
		if (p[1] < 0.7 || p[1] > 1.4) return p.slice();
		const w = bandWeight(p[1], 0.78, 1.32);
		if (w <= 0) return p.slice();
		const sx = 1 + amount * 0.14 * w;
		const sz = 1 + amount * 0.08 * w;
		return scaleAround(p, [0, p[1], 0], [sx, 1, sz]);
	},
	armLength(p, amount) {
		if (p[1] < 0.86 || p[1] > 1.5) return p.slice();
		if (Math.abs(p[0]) < 0.3) return p.slice();
		const shoulderX = Math.sign(p[0] || 1) * 0.4;
		const shoulder = [shoulderX, 1.36, 0];
		const extend = 1 + amount * 0.11;
		return [
			shoulder[0] + (p[0] - shoulder[0]) * extend,
			shoulder[1] + (p[1] - shoulder[1]) * extend,
			p[2],
		];
	},
	legLength(p, amount) {
		if (p[1] > 0.94) return p.slice();
		const hip = [0, 0.92, 0];
		const legScale = 1 + amount * 0.1;
		const xz = 1 + amount * 0.02;
		return [
			hip[0] + (p[0] - hip[0]) * xz,
			hip[1] + (p[1] - hip[1]) * legScale,
			hip[2] + (p[2] - hip[2]) * xz,
		];
	},
	shoulderWidth(p, amount) {
		if (p[1] < 1.12 || p[1] > 1.52) return p.slice();
		if (Math.abs(p[0]) < 0.2) return p.slice();
		const w = bandWeight(p[1], 1.18, 1.45);
		const sx = 1 + amount * 0.14 * w;
		return [p[0] * sx, p[1], p[2]];
	},
};

/**
 * @param {number[]} neutral
 * @param {MorphFn} fn
 * @returns {number[]}
 */
export function morphDeltaFromNeutral(neutral, fn) {
	const high = fn(neutral, 1);
	return [high[0] - neutral[0], high[1] - neutral[1], high[2] - neutral[2]];
}

/**
 * @param {import('@gltf-transform/core').Primitive} prim
 * @param {import('@gltf-transform/core').Document} doc
 */
function addMorphTargetsToPrimitive(prim, doc) {
	const posAttr = prim.getAttribute('POSITION');
	if (!posAttr) return;

	const posArray = posAttr.getArray();
	const vertexCount = posAttr.getCount();
	const buffer =
		posAttr.getBuffer() || doc.getRoot().listBuffers()[0] || doc.createBuffer();

	for (const key of PROPORTION_MORPH_KEYS) {
		const fn = MORPH_FNS[key];
		const deltaArray = new Float32Array(vertexCount * 3);

		for (let i = 0; i < vertexCount; i++) {
			const neutral = [
				posArray[i * 3],
				posArray[i * 3 + 1],
				posArray[i * 3 + 2],
			];
			const [dx, dy, dz] = morphDeltaFromNeutral(neutral, fn);
			deltaArray[i * 3] = dx;
			deltaArray[i * 3 + 1] = dy;
			deltaArray[i * 3 + 2] = dz;
		}

		const deltaAccessor = doc
			.createAccessor(`${key}_POSITION`)
			.setType('VEC3')
			.setArray(deltaArray)
			.setBuffer(buffer);

		const target = doc.createPrimitiveTarget(key).setAttribute('POSITION', deltaAccessor);
		prim.addTarget(target);
	}
}

export async function addProportionMorphsToDocument(doc) {
	const root = doc.getRoot();
	for (const mesh of root.listMeshes()) {
		for (const prim of mesh.listPrimitives()) {
			if (prim.listTargets().length > 0) {
				for (const target of [...prim.listTargets()]) {
					prim.removeTarget(target);
				}
			}
			addMorphTargetsToPrimitive(prim, doc);
		}
		const weights = PROPORTION_MORPH_KEYS.map(() => 0.5);
		mesh.setWeights(weights);
	}
}

const isMain =
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
	const io = new NodeIO();
	const doc = await io.read(inputPath);
	await addProportionMorphsToDocument(doc);
	await mkdir(dirname(outputPath), { recursive: true });
	await io.write(outputPath, doc);

	console.log('[add-player-proportion-morphs] wrote', outputPath);
	console.log('  morph keys:', PROPORTION_MORPH_KEYS.join(', '));
}
