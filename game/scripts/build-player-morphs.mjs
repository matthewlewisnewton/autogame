#!/usr/bin/env node
/**
 * One-shot builder: adds six proportion morph targets to SuperHero_Male in player.glb.
 * Run from repo: node game/scripts/build-player-morphs.mjs
 *
 * Rest pose (all influences 0) is unchanged from sub-ticket 03. Deltas are tuned so
 * influence 1.0 on a single target is clearly visible for QA / ticket 187.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const THREE_ROOT = join(__dirname, '../client/node_modules/three');
const { Box3, BufferAttribute, Vector3 } = await import(
	pathToFileURL(join(THREE_ROOT, 'build/three.module.js')).href
);
const { GLTFLoader } = await import(
	pathToFileURL(join(THREE_ROOT, 'examples/jsm/loaders/GLTFLoader.js')).href
);
const { GLTFExporter } = await import(
	pathToFileURL(join(THREE_ROOT, 'examples/jsm/exporters/GLTFExporter.js')).href
);
const GLB_PATH = join(__dirname, '../client/public/models/player.glb');

const MORPH_NAMES = [
	'height',
	'headSize',
	'torsoWidth',
	'armLength',
	'legLength',
	'shoulderWidth',
];

const BODY_MESH_NAME = 'SuperHero_Male';

function smoothstep(edge0, edge1, x) {
	const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

function sign(v) {
	return v < 0 ? -1 : v > 0 ? 1 : 0;
}

/** Copy positions to a tight xyz buffer (handles InterleavedBufferAttribute). */
function readPositions(geometry) {
	const attr = geometry.attributes.position;
	const count = attr.count;
	const pos = new Float32Array(count * 3);
	for (let i = 0; i < count; i++) {
		const ix = i * 3;
		pos[ix] = attr.getX(i);
		pos[ix + 1] = attr.getY(i);
		pos[ix + 2] = attr.getZ(i);
	}
	return { pos, count };
}

function buildMorphDeltas(pos, count) {
	const height = new Float32Array(count * 3);
	const headSize = new Float32Array(count * 3);
	const torsoWidth = new Float32Array(count * 3);
	const armLength = new Float32Array(count * 3);
	const legLength = new Float32Array(count * 3);
	const shoulderWidth = new Float32Array(count * 3);

	const headCenter = new Vector3(0, 1.62, 0.04);

	for (let i = 0; i < count; i++) {
		const ix = i * 3;
		const x = pos[ix];
		const y = pos[ix + 1];
		const z = pos[ix + 2];
		const ax = Math.abs(x);

		// Feet-anchored vertical scale (~14% taller at weight 1.0).
		height[ix + 1] = y * 0.14;

		// Head volume from ~neck to crown.
		const headW =
			smoothstep(1.42, 1.58, y) * (1 - smoothstep(1.76, 1.82, y));
		if (headW > 0) {
			const hx = x - headCenter.x;
			const hy = y - headCenter.y;
			const hz = z - headCenter.z;
			headSize[ix] = hx * 0.2 * headW;
			headSize[ix + 1] = hy * 0.2 * headW;
			headSize[ix + 2] = hz * 0.18 * headW;
		}

		// Mid torso width (hips to upper chest).
		const torsoW =
			smoothstep(0.88, 1.02, y) * (1 - smoothstep(1.38, 1.52, y));
		if (torsoW > 0) {
			torsoWidth[ix] = x * 0.14 * torsoW;
		}

		// Arms: lateral extent + upper limb band.
		const armW =
			smoothstep(0.32, 0.48, ax) *
			smoothstep(0.98, 1.12, y) *
			(1 - smoothstep(1.52, 1.64, y));
		if (armW > 0) {
			armLength[ix] = x * 0.06 * armW;
			armLength[ix + 1] = 0.08 * armW;
			armLength[ix + 2] = sign(z) * -0.1 * armW;
		}

		// Legs: fade below hip, lock near soles.
		const legW =
			(1 - smoothstep(0.92, 1.04, y)) * smoothstep(0.02, 0.14, y);
		if (legW > 0) {
			legLength[ix + 1] = y * 0.16 * legW;
		}

		// Shoulder span.
		const shoulderW =
			smoothstep(1.28, 1.4, y) *
			(1 - smoothstep(1.54, 1.64, y)) *
			smoothstep(0.18, 0.34, ax);
		if (shoulderW > 0) {
			shoulderWidth[ix] = x * 0.18 * shoulderW;
		}
	}

	return {
		height,
		headSize,
		torsoWidth,
		armLength,
		legLength,
		shoulderWidth,
	};
}

function applyMorphTargets(mesh) {
	const { pos, count } = readPositions(mesh.geometry);
	const deltas = buildMorphDeltas(pos, count);

	mesh.geometry.morphAttributes.position = MORPH_NAMES.map(
		(name) => new BufferAttribute(deltas[name], 3),
	);
	mesh.morphTargetDictionary = Object.fromEntries(
		MORPH_NAMES.map((name, i) => [name, i]),
	);
	mesh.morphTargetInfluences = new Array(MORPH_NAMES.length).fill(0);
}

async function loadGlb(path) {
	const buf = readFileSync(path);
	const loader = new GLTFLoader();
	return new Promise((resolve, reject) => {
		loader.parse(
			buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
			'',
			resolve,
			reject,
		);
	});
}

function findBodyMesh(root) {
	let body = null;
	root.traverse((o) => {
		if (o.isSkinnedMesh && o.name === BODY_MESH_NAME) body = o;
	});
	if (!body) {
		throw new Error(`Skinned mesh "${BODY_MESH_NAME}" not found in player.glb`);
	}
	return body;
}

function assertRestContract(mesh) {
	const { pos, count } = readPositions(mesh.geometry);
	const box = new Box3();
	for (let i = 0; i < count; i++) {
		const ix = i * 3;
		box.expandByPoint(new Vector3(pos[ix], pos[ix + 1], pos[ix + 2]));
	}
	const size = box.getSize(new Vector3());

	let footRadius = 0;
	for (let i = 0; i < count; i++) {
		const ix = i * 3;
		const y = pos[ix + 1];
		if (y > 0.12) continue;
		footRadius = Math.max(footRadius, Math.hypot(pos[ix], pos[ix + 2]));
	}

	if (box.min.y < -0.02 || box.min.y > 0.02) {
		throw new Error(`Feet y out of range: min.y=${box.min.y}`);
	}
	if (size.y < 1.7 || size.y > 1.9) {
		throw new Error(`Height out of range: ${size.y}`);
	}
	if (footRadius > 0.5) {
		throw new Error(`Footprint radius ${footRadius} exceeds PLAYER_RADIUS 0.5`);
	}
}

function ensureFileReaderForNode() {
	if (typeof globalThis.FileReader !== 'undefined') return;
	globalThis.FileReader = class FileReader {
		readAsArrayBuffer(blob) {
			blob.arrayBuffer().then((result) => {
				this.result = result;
				this.onloadend?.();
			});
		}
	};
}

async function exportGlb(root) {
	ensureFileReaderForNode();
	const exporter = new GLTFExporter();
	const arrayBuffer = await exporter.parseAsync(root, { binary: true });
	return Buffer.from(arrayBuffer);
}

async function verifyExport(path) {
	const gltf = await loadGlb(path);
	const mesh = findBodyMesh(gltf.scene);
	const dict = mesh.morphTargetDictionary ?? {};
	const missing = MORPH_NAMES.filter((n) => dict[n] === undefined);
	if (missing.length) {
		throw new Error(`Missing morph targets after export: ${missing.join(', ')}`);
	}
	assertRestContract(mesh);

	let tris = 0;
	gltf.scene.traverse((o) => {
		if (o.isMesh || o.isSkinnedMesh) {
			const g = o.geometry;
			tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
		}
	});
	if (tris > 18000) {
		throw new Error(`Triangle count ${tris} exceeds MAX_PLAYER_TRIS 18000`);
	}

	console.log(
		`OK: ${MORPH_NAMES.length} morphs on ${BODY_MESH_NAME}, ${tris} tris, height ${mesh.geometry.boundingBox?.max.y ?? '?'}`,
	);
}

async function main() {
	const gltf = await loadGlb(GLB_PATH);
	const body = findBodyMesh(gltf.scene);
	body.geometry.computeBoundingBox();
	assertRestContract(body);
	applyMorphTargets(body);

	const out = await exportGlb(gltf.scene);
	writeFileSync(GLB_PATH, out);
	await verifyExport(GLB_PATH);
	console.log(`Wrote ${GLB_PATH} (${out.length} bytes)`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
