/**
 * Contract test for committed `player.glb` (MODEL_SPIKE.md / ticket 185).
 * Runs in the `client-glb` vitest project (real Three.js, no setup.js mock).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadModel, _clearModelCache } from '../models.js';

/** Hard cap from game/docs/MODEL_SPIKE.md — keep in sync with that doc. */
export const MAX_PLAYER_TRIS = 18_000;

/** URL path served by Vite (`public/models/player.glb`). */
export const PLAYER_MODEL_URL = '/models/player.glb';

/** Absolute URL for loadModel in Node (FileLoader requires a parseable URL). */
const PLAYER_MODEL_LOAD_URL = new URL(PLAYER_MODEL_URL, 'http://vitest.local').href;

const MORPH_TARGET_NAMES = [
	'height',
	'headSize',
	'torsoWidth',
	'armLength',
	'legLength',
	'shoulderWidth',
];

const HEIGHT_MIN = 1.7;
const HEIGHT_MAX = 1.9;
const FOOT_Y_MIN = -0.05;

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLAYER_GLB_PATH = join(__dirname, '../public/models/player.glb');

const MORPH_BODY_MESH_NAME = 'SuperHero_Male';

let originalFetch;

function readPlayerGlbBuffer() {
	return readFileSync(PLAYER_GLB_PATH);
}

function installPlayerGlbFetchMock() {
	originalFetch = globalThis.fetch;
	globalThis.fetch = async (input) => {
		const url = typeof input === 'string' ? input : input?.url ?? String(input);
		if (!url.includes(PLAYER_MODEL_URL)) {
			return originalFetch(input);
		}
		const buf = readPlayerGlbBuffer();
		const body = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
		return {
			ok: true,
			status: 200,
			arrayBuffer: async () => body,
		};
	};
}

async function parsePlayerGlb() {
	const buf = readPlayerGlbBuffer();
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

/** Rest-pose AABBs: geometry.boundingBox includes morph extremes; bind pose uses positions. */
function ensureBindPoseMeshBounds(root) {
	root.traverse((node) => {
		const pos = node.geometry?.attributes?.position;
		if (!pos || (!node.isMesh && !node.isSkinnedMesh)) return;
		node.boundingBox = new Box3().setFromBufferAttribute(pos);
	});
}

function findMorphBodyMesh(root) {
	let mesh = null;
	root.traverse((o) => {
		if (o.isSkinnedMesh && o.morphTargetDictionary) mesh = o;
	});
	return mesh;
}

function collectMorphNames(mesh) {
	const dict = mesh?.morphTargetDictionary ?? {};
	return Object.keys(dict);
}

function countTriangles(root) {
	let tris = 0;
	root.traverse((o) => {
		if (!o.isMesh && !o.isSkinnedMesh) return;
		const g = o.geometry;
		if (!g) return;
		tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
	});
	return tris;
}

function contractBounds(root) {
	ensureBindPoseMeshBounds(root);
	root.updateMatrixWorld(true);
	const box = new Box3().setFromObject(root);
	const size = new Vector3();
	box.getSize(size);
	return { box, size };
}

describe('player.glb spike contract', () => {
	beforeAll(() => {
		installPlayerGlbFetchMock();
	});

	afterAll(() => {
		globalThis.fetch = originalFetch;
		_clearModelCache();
	});

	it('loads via GLTFLoader.parse (committed public asset)', async () => {
		const gltf = await parsePlayerGlb();
		expect(gltf?.scene, 'player.glb failed to parse').toBeTruthy();
		expect(gltf.scene.children.length, 'player.glb scene is empty').toBeGreaterThan(0);
	});

	it('loads via loadModel (same path as Vite /models/player.glb)', async () => {
		_clearModelCache();
		const scene = await loadModel(PLAYER_MODEL_LOAD_URL);
		expect(
			scene,
			`loadModel("${PLAYER_MODEL_URL}") returned null`,
		).toBeTruthy();
	});

	it('exposes all six proportion morph targets on the body mesh', async () => {
		const gltf = await parsePlayerGlb();
		const mesh = findMorphBodyMesh(gltf.scene);
		expect(mesh, `no skinned mesh with morph targets in player.glb`).toBeTruthy();
		expect(
			mesh.name,
			`expected morph mesh "${MORPH_BODY_MESH_NAME}", got "${mesh?.name}"`,
		).toBe(MORPH_BODY_MESH_NAME);

		const present = collectMorphNames(mesh);
		const missing = MORPH_TARGET_NAMES.filter((name) => !present.includes(name));
		expect(
			missing,
			missing.length
				? `missing morph target(s): ${missing.join(', ')} (present: ${present.join(', ')})`
				: undefined,
		).toEqual([]);
	});

	it('rest-pose bounds: height 1.7–1.9, feet y ≥ −0.05', async () => {
		const gltf = await parsePlayerGlb();
		const { box, size } = contractBounds(gltf.scene);

		expect(
			size.y >= HEIGHT_MIN && size.y <= HEIGHT_MAX,
			`bounding box height ${size.y.toFixed(4)} outside ${HEIGHT_MIN}–${HEIGHT_MAX} (min.y=${box.min.y.toFixed(4)}, max.y=${box.max.y.toFixed(4)})`,
		).toBe(true);

		expect(
			box.min.y >= FOOT_Y_MIN,
			`feet below ground: axis-aligned min.y=${box.min.y.toFixed(4)} (expected ≥ ${FOOT_Y_MIN})`,
		).toBe(true);
	});

	it(`triangle count ≤ ${MAX_PLAYER_TRIS}`, async () => {
		const gltf = await parsePlayerGlb();
		const tris = countTriangles(gltf.scene);
		expect(
			tris <= MAX_PLAYER_TRIS,
			`triangle count ${tris} exceeds poly budget MAX_PLAYER_TRIS=${MAX_PLAYER_TRIS}`,
		).toBe(true);
	});
});
