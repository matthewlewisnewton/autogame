/**
 * Bake six proportion morph targets into client/public/models/player.glb.
 * Run from game/: node scripts/bake-player-morph-targets.mjs
 *
 * Neutral silhouette stays at morph influence 0.5 (runtime maps to weight 0).
 * Max extreme is influence 1.0 (weight +1); min is 0.0 (weight -1).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLB_PATH = path.join(__dirname, '../client/public/models/player.glb');

export const MORPH_TARGET_NAMES = [
	'height',
	'headSize',
	'torsoWidth',
	'armLength',
	'legLength',
	'shoulderWidth',
];

const COMPONENT_FLOAT = 5126;
const TYPE_VEC3 = 'VEC3';

function parseGlb(buffer) {
	const jsonChunkLength = buffer.readUInt32LE(12);
	const jsonChunkType = buffer.readUInt32LE(16);
	if (jsonChunkType !== 0x4e4f534a) throw new Error('Expected JSON chunk');
	const jsonStart = 20;
	const json = JSON.parse(buffer.slice(jsonStart, jsonStart + jsonChunkLength).toString('utf8'));
	const jsonPadding = (4 - (jsonChunkLength % 4)) % 4;
	const binChunkOffset = jsonStart + jsonChunkLength + jsonPadding;
	const binChunkLength = buffer.readUInt32LE(binChunkOffset);
	const binChunkType = buffer.readUInt32LE(binChunkOffset + 4);
	if (binChunkType !== 0x004e4942) throw new Error('Expected BIN chunk');
	const bin = Buffer.from(buffer.slice(binChunkOffset + 8, binChunkOffset + 8 + binChunkLength));
	return { json, bin };
}

function readAccessor(json, bin, accIndex) {
	const acc = json.accessors[accIndex];
	const bv = json.bufferViews[acc.bufferView];
	const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
	const comps = { SCALAR: 1, VEC3: 3, VEC4: 4 }[acc.type];
	const elBytes = acc.componentType === COMPONENT_FLOAT ? 4 : acc.componentType === 5123 ? 2 : 1;
	const stride = bv.byteStride || elBytes * comps;
	const out = [];
	for (let i = 0; i < acc.count; i++) {
		const off = start + i * stride;
		const v = [];
		for (let c = 0; c < comps; c++) {
			if (acc.componentType === COMPONENT_FLOAT) v.push(bin.readFloatLE(off + c * 4));
			else if (acc.componentType === 5121) v.push(bin.readUInt8(off + c));
			else if (acc.componentType === 5123) v.push(bin.readUInt16LE(off + c * 2));
		}
		out.push(comps === 1 ? v[0] : v);
	}
	return out;
}

function smoothstep(edge0, edge1, x) {
	const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

function scaleFromPivot(p, pivot, s, w) {
	if (w <= 1e-5) return [0, 0, 0];
	const f = w * s;
	return [
		(p[0] - pivot[0]) * f,
		(p[1] - pivot[1]) * f,
		(p[2] - pivot[2]) * f,
	];
}

function buildMorphDeltas(positions, joints, weights, jointNames) {
	const nameToIndex = new Map(jointNames.map((n, i) => [n, i]));

	function jointInfluence(vertexJoints, vertexWeights, patterns) {
		let sum = 0;
		for (let k = 0; k < 4; k++) {
			const ji = vertexJoints[k];
			const jn = jointNames[ji];
			if (!jn) continue;
			for (const re of patterns) {
				if (re.test(jn)) {
					sum += vertexWeights[k];
					break;
				}
			}
		}
		return Math.min(1, sum);
	}

	const deltas = {
		height: [],
		headSize: [],
		torsoWidth: [],
		armLength: [],
		legLength: [],
		shoulderWidth: [],
	};

	const headPivot = [0, 1.55, 0];
	const pelvisY = 0.95;

	for (let i = 0; i < positions.length; i++) {
		const p = positions[i];
		const j = joints ? joints[i] : [0, 0, 0, 0];
		const w = weights ? weights[i] : [1, 0, 0, 0];

		const wHead = joints
			? jointInfluence(j, w, [/^Head$/, /^neck_01$/])
			: smoothstep(1.62, 1.78, p[1]);
		const wTorso = joints
			? jointInfluence(j, w, [/^spine_/, /^pelvis$/])
			: smoothstep(0.85, 1.45, p[1]) * (1 - smoothstep(1.55, 1.72, p[1]));
		const wArm = joints
			? jointInfluence(j, w, [/^upperarm_/, /^lowerarm_/, /^hand_/])
			: smoothstep(1.05, 1.55, p[1]) * Math.min(1, Math.abs(p[0]) / 0.35);
		const wLeg = joints
			? jointInfluence(j, w, [/^thigh_/, /^calf_/, /^foot_/, /^ball/])
			: (1 - smoothstep(0.95, 1.1, p[1])) * smoothstep(0, 0.85, p[1]);
		const wShoulder = joints
			? jointInfluence(j, w, [/^clavicle_/, /^upperarm_/])
			: smoothstep(1.35, 1.58, p[1]) * Math.min(1, Math.abs(p[0]) / 0.3);

		const hFactor = smoothstep(0.08, 1.15, p[1]);
		deltas.height.push([0, p[1] * 0.13 * hFactor, 0]);

		const headDelta = scaleFromPivot(p, headPivot, 0.16, wHead);
		deltas.headSize.push(headDelta);

		const torsoX = (p[0] === 0 ? 0 : Math.sign(p[0])) * Math.abs(p[0]) * 0.14 * wTorso;
		deltas.torsoWidth.push([torsoX, 0, 0]);

		const armSign = p[0] === 0 ? 0 : Math.sign(p[0]);
		const armReach = p[1] < pelvisY ? 0 : smoothstep(pelvisY, 1.45, p[1]);
		deltas.armLength.push([
			armSign * 0.06 * wArm * armReach,
			-0.1 * wArm * armReach,
			0,
		]);

		const legFactor = 1 - smoothstep(0.9, 1.05, p[1]);
		deltas.legLength.push([0, -p[1] * 0.11 * wLeg * legFactor, 0]);

		const shoulderX = (p[0] === 0 ? 0 : Math.sign(p[0])) * 0.1 * wShoulder;
		deltas.shoulderWidth.push([shoulderX, 0, 0]);
	}

	return deltas;
}

function align4(n) {
	return (n + 3) & ~3;
}

function writeGlb(json, bin) {
	const jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
	const jsonPaddedLen = align4(jsonBuf.length);
	const jsonPadding = jsonPaddedLen - jsonBuf.length;
	const binPaddedLen = align4(bin.length);
	const binPadding = binPaddedLen - bin.length;
	const totalLength = 12 + 8 + jsonPaddedLen + 8 + binPaddedLen;
	const out = Buffer.alloc(totalLength);
	let o = 0;
	out.writeUInt32LE(0x46546c67, o); o += 4; // glTF
	out.writeUInt32LE(2, o); o += 4;
	out.writeUInt32LE(totalLength, o); o += 4;
	out.writeUInt32LE(jsonPaddedLen, o); o += 4;
	out.writeUInt32LE(0x4e4f534a, o); o += 4;
	jsonBuf.copy(out, o); o += jsonBuf.length;
	for (let i = 0; i < jsonPadding; i++) out[o++] = 0x20;
	out.writeUInt32LE(binPaddedLen, o); o += 4;
	out.writeUInt32LE(0x004e4942, o); o += 4;
	bin.copy(out, o); o += bin.length;
	for (let i = 0; i < binPadding; i++) out[o++] = 0;
	return out;
}

function stripMorphTargets(json, bin) {
	const morphAccessorIndices = new Set();
	for (const mesh of json.meshes ?? []) {
		delete mesh.extras?.targetNames;
		for (const prim of mesh.primitives ?? []) {
			for (const target of prim.targets ?? []) {
				for (const accIdx of Object.values(target)) {
					if (typeof accIdx === 'number') morphAccessorIndices.add(accIdx);
				}
			}
			delete prim.targets;
		}
	}

	const morphBufferViews = new Set();
	for (const accIdx of morphAccessorIndices) {
		const bv = json.accessors[accIdx]?.bufferView;
		if (bv !== undefined) morphBufferViews.add(bv);
	}

	function remapIndex(oldIdx, removedSet) {
		if (oldIdx === undefined) return oldIdx;
		let drop = 0;
		for (const r of removedSet) {
			if (r < oldIdx) drop++;
		}
		return oldIdx - drop;
	}

	json.accessors = json.accessors.filter((_, i) => !morphAccessorIndices.has(i));
	json.bufferViews = json.bufferViews.filter((_, i) => !morphBufferViews.has(i));

	for (const acc of json.accessors) {
		if (acc.bufferView !== undefined) {
			acc.bufferView = remapIndex(acc.bufferView, morphBufferViews);
		}
	}

	for (const mesh of json.meshes ?? []) {
		for (const prim of mesh.primitives ?? []) {
			for (const [key, idx] of Object.entries(prim.attributes ?? {})) {
				prim.attributes[key] = remapIndex(idx, morphAccessorIndices);
			}
		}
	}

	let maxBinUsed = 0;
	for (const bv of json.bufferViews) {
		maxBinUsed = Math.max(maxBinUsed, (bv.byteOffset || 0) + (bv.byteLength || 0));
	}
	const trimmedBin = bin.subarray(0, maxBinUsed);
	json.buffers[0].byteLength = trimmedBin.length;
	return { json, bin: trimmedBin };
}

export function bakePlayerMorphTargets(glbPath = GLB_PATH) {
	const buffer = fs.readFileSync(glbPath);
	let { json, bin } = parseGlb(buffer);
	const jointNames = json.skins?.[0]?.joints?.map((j) => json.nodes[j].name) ?? [];

	const alreadyBaked = json.meshes?.some((m) =>
		Array.isArray(m.extras?.targetNames)
		&& m.extras.targetNames.length === MORPH_TARGET_NAMES.length
		&& m.extras.targetNames.every((n, i) => n === MORPH_TARGET_NAMES[i])
	);
	if (alreadyBaked) {
		({ json, bin } = stripMorphTargets(json, bin));
	}

	const binChunks = [Buffer.from(bin)];
	let binCursor = bin.length;

	if (!json.bufferViews) json.bufferViews = [];
	if (!json.accessors) json.accessors = [];

	for (let meshIndex = 0; meshIndex < json.meshes.length; meshIndex++) {
		const mesh = json.meshes[meshIndex];
		for (const prim of mesh.primitives) {
			if (prim.attributes.POSITION === undefined) continue;

			const positions = readAccessor(json, bin, prim.attributes.POSITION);
			const joints = prim.attributes.JOINTS_0 !== undefined
				? readAccessor(json, bin, prim.attributes.JOINTS_0)
				: null;
			const weights = prim.attributes.WEIGHTS_0 !== undefined
				? readAccessor(json, bin, prim.attributes.WEIGHTS_0)
				: null;

			const deltas = buildMorphDeltas(positions, joints, weights, jointNames);
			const targets = [];

			for (const name of MORPH_TARGET_NAMES) {
				const flat = deltas[name].flat();
				const { byteOffset, byteLength, count } = (() => {
					const byteLen = flat.length * 4;
					const start = align4(binCursor);
					const pad = start - binCursor;
					const chunk = Buffer.alloc(pad + byteLen);
					let o = pad;
					for (const f of flat) {
						chunk.writeFloatLE(f, o);
						o += 4;
					}
					binChunks.push(chunk);
					binCursor = start + byteLen;
					return { byteOffset: start, byteLength: pad + byteLen, count: positions.length };
				})();

				const bvIdx = json.bufferViews.length;
				json.bufferViews.push({
					buffer: 0,
					byteOffset,
					byteLength,
					target: 34962,
				});

				const accIdx = json.accessors.length;
				json.accessors.push({
					bufferView: bvIdx,
					componentType: COMPONENT_FLOAT,
					count,
					type: TYPE_VEC3,
				});
				targets.push({ POSITION: accIdx });
			}

			prim.targets = targets;
			mesh.extras = mesh.extras || {};
			mesh.extras.targetNames = [...MORPH_TARGET_NAMES];
		}
	}

	const finalBin = Buffer.concat(binChunks);
	json.buffers[0].byteLength = finalBin.length;

	const outBuffer = writeGlb(json, finalBin);
	fs.writeFileSync(glbPath, outBuffer);
	return { meshCount: json.meshes.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
	bakePlayerMorphTargets();
	console.log('Baked morph targets into', GLB_PATH);
}
