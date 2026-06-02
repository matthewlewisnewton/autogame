/**
 * One-shot pipeline: add six proportion morph targets to player.glb.
 * Run from game/: node scripts/add-player-morph-targets.mjs
 */
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { NodeIO } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = join(__dirname, '..');
const GLB_PATH = join(GAME_ROOT, 'client/public/models/player.glb');

/** Exact glTF / server / slider ids (case-sensitive). */
export const MORPH_NAMES = [
	'height',
	'headSize',
	'torsoWidth',
	'armLength',
	'legLength',
	'shoulderWidth',
];

const HIP_Y = 0.95;
const HEAD_Y_MIN = 1.42;
const TORSO_Y_MIN = 0.95;
const TORSO_Y_MAX = 1.38;
const SHOULDER_Y_MIN = 1.32;
const SHOULDER_Y_MAX = 1.52;
const HEAD_PIVOT_Y = 1.55;
const ARM_X_MIN = 0.22;
const ARM_Y_MIN = 1.0;
const ARM_Y_MAX = 1.48;

function smoothstep(edge0, edge1, x) {
	const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

function signOrZero(v) {
	if (v > 1e-5) return 1;
	if (v < -1e-5) return -1;
	return 0;
}

/**
 * @param {'body'|'face'} profile
 * @returns {Record<string, (x: number, y: number, z: number) => [number, number, number]>}
 */
function deltaFns(profile) {
	const zero = () => [0, 0, 0];

	if (profile === 'face') {
		return {
			height: zero,
			headSize: (x, y, z) => {
				const w = smoothstep(HEAD_Y_MIN - 0.08, HEAD_Y_MIN + 0.05, y);
				const fx = 0.18 * w;
				return [x * fx, (y - HEAD_PIVOT_Y) * fx, z * fx];
			},
			torsoWidth: zero,
			armLength: zero,
			legLength: zero,
			shoulderWidth: zero,
		};
	}

	return {
		height: (_x, y, _z) => [0, y * 0.12, 0],
		headSize: (x, y, z) => {
			const w = smoothstep(HEAD_Y_MIN - 0.05, HEAD_Y_MIN + 0.08, y);
			const fx = 0.18 * w;
			return [x * fx, (y - HEAD_PIVOT_Y) * fx, z * fx];
		},
		torsoWidth: (x, y, z) => {
			const wy = smoothstep(TORSO_Y_MIN, TORSO_Y_MIN + 0.06, y)
				* (1 - smoothstep(TORSO_Y_MAX - 0.06, TORSO_Y_MAX, y));
			const wx = 1 - smoothstep(0, 0.12, Math.abs(x));
			const w = wy * wx;
			return [signOrZero(x) * Math.abs(x) * 0.18 * w, 0, z * 0.06 * w];
		},
		armLength: (x, y, _z) => {
			const wx = smoothstep(ARM_X_MIN, ARM_X_MIN + 0.08, Math.abs(x));
			const wy = smoothstep(ARM_Y_MIN, ARM_Y_MIN + 0.08, y)
				* (1 - smoothstep(ARM_Y_MAX - 0.08, ARM_Y_MAX, y));
			const w = wx * wy;
			return [signOrZero(x) * 0.14 * w, 0, 0];
		},
		legLength: (x, y, z) => {
			if (y >= HIP_Y) return [0, 0, 0];
			const w = 1 - smoothstep(HIP_Y - 0.15, HIP_Y, y);
			const relY = y - HIP_Y;
			return [x * 0.04 * w, relY * 0.14 * w, z * 0.04 * w];
		},
		shoulderWidth: (x, y, _z) => {
			const wy = smoothstep(SHOULDER_Y_MIN, SHOULDER_Y_MIN + 0.05, y)
				* (1 - smoothstep(SHOULDER_Y_MAX - 0.05, SHOULDER_Y_MAX, y));
			const wx = smoothstep(ARM_X_MIN, ARM_X_MIN + 0.1, Math.abs(x));
			const w = wy * wx;
			return [signOrZero(x) * 0.12 * w, 0, 0];
		},
	};
}

function meshProfile(meshName) {
	if (meshName.startsWith('Face')) return 'face';
	return 'body';
}

function buildTargetDeltas(positions, fns, morphName) {
	const fn = fns[morphName];
	const delta = new Float32Array(positions.length);
	for (let i = 0; i < positions.length; i += 3) {
		const [dx, dy, dz] = fn(positions[i], positions[i + 1], positions[i + 2]);
		delta[i] = dx;
		delta[i + 1] = dy;
		delta[i + 2] = dz;
	}
	return delta;
}

function assertBaseBounds(scene) {
	const { min, max } = getBounds(scene);
	const height = max[1] - min[1];
	const halfX = Math.max(Math.abs(min[0]), Math.abs(max[0]));
	const halfZ = Math.max(Math.abs(min[2]), Math.abs(max[2]));
	const horiz = Math.max(halfX, halfZ);
	if (Math.abs(min[1]) > 1e-3) throw new Error(`feet y expected 0, got min.y=${min[1]}`);
	if (Math.abs(height - 1.8) > 0.02) throw new Error(`height expected 1.8, got ${height}`);
	if (horiz > 0.501) throw new Error(`footprint expected <=0.5, got ${horiz}`);
}

function ensureMorphTargets(document, mesh) {
	const profile = meshProfile(mesh.getName() ?? '');
	const fns = deltaFns(profile);

	for (const prim of mesh.listPrimitives()) {
		const position = prim.getAttribute('POSITION');
		if (!position) continue;

		const existing = prim.listTargets();
		if (existing.length === MORPH_NAMES.length) {
			MORPH_NAMES.forEach((name, index) => existing[index].setName(name));
			continue;
		}
		if (existing.length > 0) {
			throw new Error(
				`${mesh.getName()}: expected 0 or ${MORPH_NAMES.length} targets, got ${existing.length}`,
			);
		}

		const positions = position.getArray();
		for (const morphName of MORPH_NAMES) {
			const deltaArray = buildTargetDeltas(positions, fns, morphName);
			const deltaAccessor = document
				.createAccessor(`${mesh.getName()}_${morphName}`)
				.setType('VEC3')
				.setArray(deltaArray);
			const target = document
				.createPrimitiveTarget(morphName)
				.setAttribute('POSITION', deltaAccessor);
			prim.addTarget(target);
		}
	}

	mesh.setWeights(new Array(MORPH_NAMES.length).fill(0));
}

export async function addPlayerMorphTargets(io = new NodeIO()) {
	const document = await io.read(GLB_PATH);
	const root = document.getRoot();

	for (const mesh of root.listMeshes()) {
		ensureMorphTargets(document, mesh);
	}

	const scene = root.listScenes()[0];
	assertBaseBounds(scene);

	await io.write(GLB_PATH, document);
	return document;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	await addPlayerMorphTargets();
	console.log(`Wrote morph targets to ${GLB_PATH}`);
}
