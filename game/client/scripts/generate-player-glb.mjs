/**
 * Maintainer script: build game/client/public/models/player.glb
 * Original low-poly humanoid for ticket 185 (not wired in renderer).
 * Sub-ticket 02: six proportion morph targets on PlayerBody only.
 *
 * Run from game/client: node scripts/generate-player-glb.mjs
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../public/models/player.glb');

/** Must match README proportion table and future server `proportions.<key>`. */
const MORPH_TARGET_NAMES = [
	'height',
	'headSize',
	'torsoWidth',
	'armLength',
	'legLength',
	'shoulderWidth',
];

const MORPH_STRENGTH = 0.12;

function footBox(w, h, d, x, yBottom, z) {
	const g = new THREE.BoxGeometry(w, h, d);
	g.translate(x, yBottom + h / 2, z);
	return g;
}

function scaleAbout([x, y, z], pivot, s) {
	return [
		pivot[0] + (x - pivot[0]) * s,
		pivot[1] + (y - pivot[1]) * s,
		pivot[2] + (z - pivot[2]) * s,
	];
}

function morphVertexAtPlusOne(name, x, y, z) {
	switch (name) {
		case 'height':
			return [x, y * (1 + MORPH_STRENGTH), z];
		case 'headSize':
			if (y < 1.2) return [x, y, z];
			return scaleAbout([x, y, z], [0, 1.35, 0], 1 + MORPH_STRENGTH);
		case 'torsoWidth':
			if (y < 0.5 || y > 1.35) return [x, y, z];
			return [x * (1 + MORPH_STRENGTH), y, z];
		case 'armLength':
			if (Math.abs(x) < 0.3 || y < 0.7 || y > 1.4) return [x, y, z];
			return [x, y + (y - 0.86) * MORPH_STRENGTH, z];
		case 'legLength':
			if (y > 0.55) return [x, y, z];
			return [x, y * (1 + MORPH_STRENGTH), z];
		case 'shoulderWidth':
			if (y < 0.95 || y > 1.38 || Math.abs(x) < 0.22) return [x, y, z];
			return [x * (1 + MORPH_STRENGTH), y, z];
		default:
			throw new Error(`unknown morph: ${name}`);
	}
}

function computeMorphDeltas(positions) {
	return MORPH_TARGET_NAMES.map((name) => {
		const deltas = new Float32Array(positions.length);
		for (let i = 0; i < positions.length; i += 3) {
			const x = positions[i];
			const y = positions[i + 1];
			const z = positions[i + 2];
			const [mx, my, mz] = morphVertexAtPlusOne(name, x, y, z);
			deltas[i] = mx - x;
			deltas[i + 1] = my - y;
			deltas[i + 2] = mz - z;
		}
		return deltas;
	});
}

const bodyParts = [
	footBox(0.26, 0.44, 0.22, -0.17, 0, -0.01),
	footBox(0.26, 0.44, 0.22, 0.17, 0, -0.01),
	footBox(0.52, 0.52, 0.3, 0, 0.44, -0.01),
	footBox(0.2, 0.4, 0.18, -0.4, 0.86, -0.01),
	footBox(0.2, 0.4, 0.18, 0.4, 0.86, -0.01),
	footBox(0.3, 0.34, 0.26, 0, 1.46, -0.01),
];

const bodyGeo = mergeGeometries(bodyParts);
bodyGeo.computeVertexNormals();

const visorGeo = new THREE.BoxGeometry(0.22, 0.07, 0.05);
visorGeo.translate(0, 1.58, -0.14);

const bodyMesh = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0x8a9aaa }));
bodyMesh.name = 'PlayerBody';
const visorMesh = new THREE.Mesh(visorGeo, new THREE.MeshStandardMaterial({ color: 0x3eb8ff }));
visorMesh.name = 'PlayerVisor';

const root = new THREE.Group();
root.name = 'Player';
root.add(bodyMesh);
root.add(visorMesh);

root.updateMatrixWorld(true);
const bounds = new THREE.Box3().setFromObject(root);
const height = bounds.max.y - bounds.min.y;
if (Math.abs(bounds.min.y) > 0.001) {
	throw new Error(`feet anchor: min.y=${bounds.min.y}, expected 0`);
}
if (height < 1.6 || height > 2.0) {
	throw new Error(`height ${height} outside 1.6–2.0`);
}

function meshToGltfPrimitive(geometry, materialIndex, morphDeltas = null) {
	const pos = geometry.getAttribute('position');
	const norm = geometry.getAttribute('normal');
	const index = geometry.getIndex();
	const positions = new Float32Array(pos.array);
	const normals = new Float32Array(norm.array);
	const indices = index
		? new Uint16Array(index.array)
		: (() => {
			const arr = new Uint16Array(pos.count);
			for (let i = 0; i < pos.count; i++) arr[i] = i;
			return arr;
		})();

	return { positions, normals, indices, materialIndex, morphDeltas };
}

const bodyMorphDeltas = computeMorphDeltas(
	meshToGltfPrimitive(bodyGeo, 0).positions,
);

const primitives = [
	meshToGltfPrimitive(bodyGeo, 0, bodyMorphDeltas),
	meshToGltfPrimitive(visorGeo, 1),
];

let binLength = 0;
const bufferViews = [];
const accessors = [];
const meshes = [];
let byteOffset = 0;

function align4(n) {
	return (n + 3) & ~3;
}

const binChunks = [];

function appendBuffer(data) {
	const offset = align4(byteOffset);
	byteOffset = offset + data.byteLength;
	binChunks.push({ offset, data: Buffer.from(data.buffer, data.byteOffset, data.byteLength) });
	return offset;
}

for (let primIndex = 0; primIndex < primitives.length; primIndex++) {
	const prim = primitives[primIndex];
	const posOffset = appendBuffer(prim.positions);
	const normOffset = appendBuffer(prim.normals);
	const idxOffset = appendBuffer(prim.indices);

	const vertexCount = prim.positions.length / 3;
	const min = [Infinity, Infinity, Infinity];
	const max = [-Infinity, -Infinity, -Infinity];
	for (let i = 0; i < prim.positions.length; i += 3) {
		for (let j = 0; j < 3; j++) {
			const v = prim.positions[i + j];
			min[j] = Math.min(min[j], v);
			max[j] = Math.max(max[j], v);
		}
	}

	const posViewIndex = bufferViews.length;
	bufferViews.push({
		buffer: 0,
		byteOffset: posOffset,
		byteLength: prim.positions.byteLength,
		target: 34962,
	});
	const normViewIndex = bufferViews.length;
	bufferViews.push({
		buffer: 0,
		byteOffset: normOffset,
		byteLength: prim.normals.byteLength,
		target: 34962,
	});
	const idxViewIndex = bufferViews.length;
	bufferViews.push({
		buffer: 0,
		byteOffset: idxOffset,
		byteLength: prim.indices.byteLength,
		target: 34963,
	});

	const posAccessor = accessors.length;
	accessors.push({
		bufferView: posViewIndex,
		componentType: 5126,
		count: vertexCount,
		type: 'VEC3',
		min,
		max,
	});
	const normAccessor = accessors.length;
	accessors.push({
		bufferView: normViewIndex,
		componentType: 5126,
		count: vertexCount,
		type: 'VEC3',
	});
	const idxAccessor = accessors.length;
	accessors.push({
		bufferView: idxViewIndex,
		componentType: 5123,
		count: prim.indices.length,
		type: 'SCALAR',
	});

	const primitive = {
		attributes: { POSITION: posAccessor, NORMAL: normAccessor },
		indices: idxAccessor,
		material: prim.materialIndex,
	};

	const meshEntry = { primitives: [primitive] };

	if (prim.morphDeltas) {
		const targetAccessors = [];
		for (const deltas of prim.morphDeltas) {
			const morphOffset = appendBuffer(deltas);
			const morphViewIndex = bufferViews.length;
			bufferViews.push({
				buffer: 0,
				byteOffset: morphOffset,
				byteLength: deltas.byteLength,
				target: 34962,
			});
			targetAccessors.push({
				POSITION: accessors.length,
			});
			accessors.push({
				bufferView: morphViewIndex,
				componentType: 5126,
				count: vertexCount,
				type: 'VEC3',
			});
		}
		primitive.targets = targetAccessors;
		meshEntry.weights = MORPH_TARGET_NAMES.map(() => 0);
		meshEntry.extras = { targetNames: [...MORPH_TARGET_NAMES] };
		if (primIndex === 0) {
			meshEntry.name = 'PlayerBody';
		}
	}

	meshes.push(meshEntry);
}

binLength = align4(byteOffset);
const bin = Buffer.alloc(binLength);
for (const chunk of binChunks) {
	chunk.data.copy(bin, chunk.offset);
}

const gltf = {
	asset: { version: '2.0', generator: 'generate-player-glb.mjs' },
	scene: 0,
	scenes: [{ nodes: [0] }],
	nodes: [
		{ name: 'Player', children: [1, 2] },
		{ name: 'PlayerBody', mesh: 0 },
		{ name: 'PlayerVisor', mesh: 1 },
	],
	meshes,
	materials: [
		{
			name: 'Body',
			pbrMetallicRoughness: {
				baseColorFactor: [0.54, 0.6, 0.67, 1],
				metallicFactor: 0.15,
				roughnessFactor: 0.75,
			},
		},
		{
			name: 'Visor',
			pbrMetallicRoughness: {
				baseColorFactor: [0.24, 0.72, 1, 1],
				metallicFactor: 0.35,
				roughnessFactor: 0.45,
			},
		},
	],
	bufferViews,
	accessors,
	buffers: [{ byteLength: binLength }],
};

const json = JSON.stringify(gltf);
const jsonPad = (4 - (json.length % 4)) % 4;
const jsonChunk = Buffer.concat([Buffer.from(json), Buffer.alloc(jsonPad, 0x20)]);

const binPad = (4 - (bin.length % 4)) % 4;
const binChunk = Buffer.concat([bin, Buffer.alloc(binPad)]);

const totalLength = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(totalLength, 8);

const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(jsonChunk.length, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4);

const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(binChunk.length, 0);
binHeader.writeUInt32LE(0x004e4942, 4);

const glb = Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, glb);
console.log(
	`Wrote ${OUT} (${glb.length} bytes, height≈${height.toFixed(3)}, morphs=${MORPH_TARGET_NAMES.join(',')})`,
);
