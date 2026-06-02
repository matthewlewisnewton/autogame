/**
 * One-shot maintainer: add six proportion morph targets to player.glb body primitive.
 * Run from game/: node client/scripts/inject-player-morph-targets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLB_PATH = path.join(__dirname, '../public/models/player.glb');

const MORPH_NAMES = [
	'height',
	'headSize',
	'torsoWidth',
	'armLength',
	'legLength',
	'shoulderWidth',
];

const BODY_PRIMITIVE_INDEX = 0;

function parseGlb(buffer) {
	const jsonLen = buffer.readUInt32LE(12);
	const json = JSON.parse(buffer.slice(20, 20 + jsonLen).toString('utf8'));
	const jsonChunkEnd = 20 + jsonLen;
	const binLen = buffer.readUInt32LE(jsonChunkEnd);
	const binOffset = jsonChunkEnd + 8;
	const bin = Buffer.from(buffer.slice(binOffset, binOffset + binLen));
	return { json, bin, jsonLen };
}

function pad4(n) {
	return (4 - (n % 4)) % 4;
}

function writeGlb(json, bin) {
	const jsonStr = JSON.stringify(json);
	const jsonBuf = Buffer.alloc(jsonStr.length + pad4(jsonStr.length), 0x20);
	jsonBuf.write(jsonStr, 0, 'utf8');
	const binPad = pad4(bin.length);
	const binPadded = Buffer.concat([bin, Buffer.alloc(binPad)]);
	const totalLen = 12 + 8 + jsonBuf.length + 8 + binPadded.length;
	const out = Buffer.alloc(totalLen);
	out.writeUInt32LE(0x46546c67, 0);
	out.writeUInt32LE(2, 4);
	out.writeUInt32LE(totalLen, 8);
	let o = 12;
	out.writeUInt32LE(jsonBuf.length, o);
	o += 4;
	out.writeUInt32LE(0x4e4f534a, o);
	o += 4;
	jsonBuf.copy(out, o);
	o += jsonBuf.length;
	out.writeUInt32LE(binPadded.length, o);
	o += 4;
	out.writeUInt32LE(0x004e4942, o);
	o += 4;
	binPadded.copy(out, o);
	return out;
}

function readVec3(bin, accessorIndex, json) {
	const acc = json.accessors[accessorIndex];
	const bv = json.bufferViews[acc.bufferView];
	const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
	const count = acc.count;
	const positions = [];
	for (let i = 0; i < count; i++) {
		const off = start + i * 12;
		positions.push([
			bin.readFloatLE(off),
			bin.readFloatLE(off + 4),
			bin.readFloatLE(off + 8),
		]);
	}
	return positions;
}

function computeMorphDeltas(positions) {
	const footY = Math.min(...positions.map((p) => p[1]));
	const hipY = 0.92;
	const shoulderY0 = 1.28;
	const shoulderY1 = 1.52;
	const headY0 = 1.45;
	const torsoY0 = 0.85;
	const torsoY1 = 1.42;

	const deltas = MORPH_NAMES.map(() =>
		positions.map(() => [0, 0, 0]),
	);

	for (let i = 0; i < positions.length; i++) {
		const [x, y, z] = positions[i];
		const ax = Math.abs(x);

		// Height: scale Y about feet anchor (root translate, not per-toe shear).
		const heightScale = 0.12;
		deltas[0][i][1] = Math.max(0, y - footY) * heightScale;

		// Head size: radial inflate in head band.
		if (y >= headY0) {
			const headCenterY = 1.72;
			const dy = y - headCenterY;
			const radial = Math.hypot(x, dy, z * 2) || 1;
			const push = 0.08;
			deltas[1][i][0] = (x / radial) * push;
			deltas[1][i][1] = (dy / radial) * push;
			deltas[1][i][2] = (z / radial) * push * 0.5;
		}

		// Torso width: X expand in torso band.
		if (y >= torsoY0 && y <= torsoY1 && ax < 0.45) {
			const sign = x === 0 ? 0 : Math.sign(x);
			deltas[2][i][0] = sign * 0.1;
		}

		// Arm length: extend along ±X in arm regions.
		if (y >= 0.75 && y <= 1.35 && ax >= 0.38) {
			const sign = Math.sign(x) || 1;
			deltas[3][i][0] = sign * 0.14;
		}

		// Leg length: extend downward from hip downward.
		if (y <= hipY) {
			const t = (hipY - y) / (hipY - footY + 1e-6);
			deltas[4][i][1] = -0.12 * t;
		}

		// Shoulder width: X widen in shoulder band.
		if (y >= shoulderY0 && y <= shoulderY1 && ax >= 0.25) {
			const sign = Math.sign(x) || 1;
			deltas[5][i][0] = sign * 0.11;
		}
	}

	return deltas;
}

function appendMorphTargets(json, bin) {
	const mesh = json.meshes[0];
	const prim = mesh.primitives[BODY_PRIMITIVE_INDEX];
	const posIdx = prim.attributes.POSITION;
	const positions = readVec3(bin, posIdx, json);
	const morphDeltas = computeMorphDeltas(positions);

	let binLen = bin.length;
	const targetEntries = [];

	for (let m = 0; m < MORPH_NAMES.length; m++) {
		const floats = new Float32Array(positions.length * 3);
		for (let i = 0; i < positions.length; i++) {
			floats[i * 3] = morphDeltas[m][i][0];
			floats[i * 3 + 1] = morphDeltas[m][i][1];
			floats[i * 3 + 2] = morphDeltas[m][i][2];
		}
		const byteLength = floats.byteLength;
		const byteOffset = binLen;
		const chunk = Buffer.from(floats.buffer);
		bin = Buffer.concat([bin, chunk]);
		binLen += byteLength;

		const bufferViewIndex = json.bufferViews.length;
		json.bufferViews.push({
			buffer: 0,
			byteOffset,
			byteLength,
			target: 34962,
		});

		const accessorIndex = json.accessors.length;
		json.accessors.push({
			bufferView: bufferViewIndex,
			componentType: 5126,
			count: positions.length,
			type: 'VEC3',
		});
		targetEntries.push({ POSITION: accessorIndex });
	}

	prim.targets = targetEntries;
	mesh.extras = mesh.extras || {};
	mesh.extras.targetNames = [...MORPH_NAMES];

	return writeGlb(json, bin);
}

function main() {
	const input = fs.readFileSync(GLB_PATH);
	const { json, bin } = parseGlb(input);
	const mesh = json.meshes[0];
	const prim = mesh.primitives[BODY_PRIMITIVE_INDEX];
	if (prim.targets?.length === MORPH_NAMES.length) {
		const names = mesh.extras?.targetNames;
		if (names && MORPH_NAMES.every((n, i) => names[i] === n)) {
			console.log('player.glb already has morph targets; skipping.');
			return;
		}
	}
	const out = appendMorphTargets(json, bin);
	fs.writeFileSync(GLB_PATH, out);
	console.log(`Wrote ${GLB_PATH} (${out.length} bytes) with ${MORPH_NAMES.length} morph targets.`);
}

main();
