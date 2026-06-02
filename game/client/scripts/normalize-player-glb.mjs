/**
 * One-off authoring helper: normalize Quaternius male base → player.glb contract.
 * Run from game/client/: node scripts/normalize-player-glb.mjs <source.glb> [output.glb]
 */
import { readFileSync, writeFileSync } from 'node:fs';

// GLTFExporter expects browser globals in Node.
if (typeof globalThis.self === 'undefined') {
	globalThis.self = globalThis;
}
if (typeof globalThis.FileReader === 'undefined') {
	globalThis.FileReader = class FileReader {
		readAsArrayBuffer(blob) {
			Promise.resolve(blob.arrayBuffer?.() ?? blob)
				.then((buf) => {
					this.result = buf;
					this.onloadend?.();
				})
				.catch((err) => this.onerror?.(err));
		}

		readAsDataURL(blob) {
			Promise.resolve(blob.arrayBuffer?.() ?? blob)
				.then((buf) => {
					const b64 = Buffer.from(buf).toString('base64');
					this.result = `data:application/octet-stream;base64,${b64}`;
					this.onloadend?.();
				})
				.catch((err) => this.onerror?.(err));
		}
	};
}
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Box3, Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const TARGET_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.5;
const MID_TORSO_Y = 0.9;

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultOut = join(__dirname, '../public/models/player.glb');

const sourcePath = resolve(process.argv[2] || '');
const outPath = resolve(process.argv[3] || defaultOut);

if (!sourcePath) {
	console.error('Usage: node scripts/normalize-player-glb.mjs <source.glb> [output.glb]');
	process.exit(1);
}

function loadGltf(path) {
	const buf = readFileSync(path);
	const loader = new GLTFLoader();
	return new Promise((resolve, reject) => {
		loader.parse(
			buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
			'',
			(gltf) => resolve(gltf),
			reject,
		);
	});
}

function worldBox(object) {
	object.updateMatrixWorld(true);
	return new Box3().setFromObject(object);
}

/** Max XZ distance from origin for vertices with y in [yMin, yMax]. */
function xzRadiusInBand(root, yMin, yMax) {
	let r = 0;
	root.traverse((o) => {
		if (!o.isMesh || !o.geometry?.attributes?.position) return;
		const pos = o.geometry.attributes.position;
		const v = new Vector3();
		for (let i = 0; i < pos.count; i++) {
			v.fromBufferAttribute(pos, i);
			o.localToWorld(v);
			if (v.y >= yMin && v.y <= yMax) {
				r = Math.max(r, Math.hypot(v.x, v.z));
			}
		}
	});
	return r;
}

function exportGlb(root) {
	const exporter = new GLTFExporter();
	return new Promise((resolve, reject) => {
		exporter.parse(
			root,
			(result) => {
				if (result instanceof ArrayBuffer) {
					resolve(Buffer.from(result));
					return;
				}
				reject(new Error('GLTFExporter did not return ArrayBuffer'));
			},
			{ binary: true, onlyVisible: false, truncateDrawRange: false },
			reject,
		);
	});
}

const gltf = await loadGltf(sourcePath);
// Drop textures for Node export; materials are not required for the spike mesh contract.
gltf.scene.traverse((o) => {
	if (o.isMesh && o.material) {
		const mats = Array.isArray(o.material) ? o.material : [o.material];
		for (const m of mats) {
			if (!m) continue;
			for (const key of Object.keys(m)) {
				if (m[key]?.isTexture) m[key] = null;
			}
		}
	}
});
const root = new Group();
root.add(gltf.scene);

// Quaternius Standard export: character faces +Z; game contract is −Z.
root.rotation.y = Math.PI;

let box = worldBox(root);
const height = box.max.y - box.min.y;
const scale = TARGET_HEIGHT / height;
root.scale.setScalar(scale);
root.updateMatrixWorld(true);

box = worldBox(root);
root.position.x -= (box.min.x + box.max.x) / 2;
root.position.z -= (box.min.z + box.max.z) / 2;
root.position.y -= box.min.y;
root.updateMatrixWorld(true);

box = worldBox(root);
const midR = xzRadiusInBand(root, MID_TORSO_Y - 0.35, MID_TORSO_Y + 0.35);
const footR = xzRadiusInBand(root, 0, 0.15);

let bones = [];
root.traverse((o) => {
	if (o.isBone) bones.push(o.name);
});

const h = box.max.y - box.min.y;
const report = {
	height: h,
	feetY: box.min.y,
	headY: box.max.y,
	midTorsoXZ: midR,
	footXZ: footR,
	boneCount: bones.length,
	hasHeadBone: bones.includes('Head'),
};

if (midR > PLAYER_RADIUS + 0.02) {
	console.warn(
		`WARN: mid-torso XZ radius ${midR.toFixed(3)} exceeds PLAYER_RADIUS ${PLAYER_RADIUS}`,
	);
}

const bytes = await exportGlb(root);
writeFileSync(outPath, bytes);

console.log('Wrote', outPath, `(${bytes.length} bytes)`);
console.log(JSON.stringify(report, null, 2));

if (Math.abs(h - TARGET_HEIGHT) > 0.05) {
	console.error(`FAIL: height ${h.toFixed(3)} outside 1.8 ± 0.05`);
	process.exit(1);
}
if (box.min.y < -0.02 || box.min.y > 0.02) {
	console.error(`FAIL: feet y=${box.min.y.toFixed(3)} expected ~0`);
	process.exit(1);
}
if (midR > PLAYER_RADIUS + 0.02) {
	console.error(`FAIL: mid-torso radius ${midR.toFixed(3)} > ${PLAYER_RADIUS}`);
	process.exit(1);
}
