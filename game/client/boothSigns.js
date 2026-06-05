// ── Hub Booth Signage ──
// Always-visible kiosk structures + floating name signs for the six hub booth
// anchors. Without this, booths are invisible proximity zones (buildDungeon
// draws no geometry at layout.boothAnchors) and players cannot tell what or
// where a booth is until the proximity prompt fires. This module fills that gap
// for the shared hub; the proximity prompt (boothPrompt.js) and other-player
// nameplates (renderer.js) are separate features and are untouched here.

import * as THREE from 'three';
import { BOOTH_DISPLAY_NAMES } from './boothPrompt.js';
import { DEFAULT_FLOOR_Y } from './collision.js';

// ── Visual constants ──

/** Counter/post footprint and height (world units). */
const KIOSK_WIDTH = 1.4;
const KIOSK_HEIGHT = 1.1;
const KIOSK_DEPTH = 0.7;

/** Height of the sign sprite's centre above the floor. */
const SIGN_HEIGHT = KIOSK_HEIGHT + 0.85;

/** On-screen sprite size (world units) — wide, short label, like nameplates. */
const SIGN_SCALE_X = 1.8;
const SIGN_SCALE_Y = 0.45;

/** Warm wooden kiosk colour so booths read as friendly hub furniture. */
const KIOSK_COLOR = 0x6b4f33;

// Shared kiosk material, reused across every booth and every hub rebuild.
// dungeon.js's clearDungeon disposes per-build geometry but intentionally leaves
// materials alone (they are module-level constants), so keeping this shared
// avoids a material leak when the hub is re-rendered.
const kioskMaterial = new THREE.MeshStandardMaterial({
	color: KIOSK_COLOR,
	roughness: 0.85,
	metalness: 0.05,
});

// Cache of sign sprite materials (each owning one CanvasTexture) keyed by booth
// id. The label text is fixed per booth, so the texture is rasterised once and
// reused across hub rebuilds — again avoiding a texture leak, since clearDungeon
// never disposes these.
const signMaterialCache = new Map();

/**
 * Rasterise a booth's label onto an offscreen canvas and wrap it in a cached
 * SpriteMaterial, mirroring the nameplate pattern in renderer.js (rounded-rect
 * background, centred bold text, CanvasTexture). Self-contained so it is
 * unit-testable: the 2D context is guarded because jsdom has no canvas backend.
 *
 * @param {string} boothId
 * @param {string} label - display text, e.g. "Quest Board"
 * @returns {THREE.SpriteMaterial}
 */
function getSignMaterial(boothId, label) {
	const cached = signMaterialCache.get(boothId);
	if (cached) return cached;

	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = 128;

	let ctx = null;
	try {
		ctx = canvas.getContext('2d');
	} catch (_) {
		ctx = null; // no canvas backend (e.g. jsdom test env) — skip drawing
	}

	if (ctx) {
		// Semi-transparent rounded-rect background
		ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
		const radius = 20;
		const w = canvas.width;
		const h = canvas.height;
		ctx.beginPath();
		ctx.moveTo(radius, 0);
		ctx.lineTo(w - radius, 0);
		ctx.quadraticCurveTo(w, 0, w, radius);
		ctx.lineTo(w, h - radius);
		ctx.quadraticCurveTo(w, h, w - radius, h);
		ctx.lineTo(radius, h);
		ctx.quadraticCurveTo(0, h, 0, h - radius);
		ctx.lineTo(0, radius);
		ctx.quadraticCurveTo(0, 0, radius, 0);
		ctx.closePath();
		ctx.fill();

		// Centred bold label
		ctx.fillStyle = '#ffffff';
		ctx.font = 'bold 56px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
		ctx.shadowBlur = 6;
		ctx.fillText(label, w / 2, h / 2);
	}

	const texture = new THREE.CanvasTexture(canvas);
	if (THREE.LinearFilter !== undefined) texture.minFilter = THREE.LinearFilter;

	const material = new THREE.SpriteMaterial({
		map: texture,
		transparent: true,
		depthTest: false,
	});
	signMaterialCache.set(boothId, material);
	return material;
}

/**
 * Build a floating text-sign sprite for a booth. The expensive texture/material
 * is cached per booth (see getSignMaterial); only the lightweight Sprite wrapper
 * is created per build, so clearDungeon can drop it from the scene with nothing
 * left to dispose.
 *
 * @param {string} boothId
 * @param {string} label
 * @returns {THREE.Sprite}
 */
function buildSignSprite(boothId, label) {
	const sprite = new THREE.Sprite(getSignMaterial(boothId, label));
	sprite.scale.set(SIGN_SCALE_X, SIGN_SCALE_Y, 1);
	sprite.userData.boothId = boothId;
	sprite.userData.label = label;
	return sprite;
}

/**
 * Build a solid kiosk counter mesh for a booth. Geometry is fresh per build (so
 * clearDungeon disposes it); the material is shared.
 *
 * @param {string} boothId
 * @returns {THREE.Mesh}
 */
function buildKiosk(boothId) {
	const geometry = new THREE.BoxGeometry(KIOSK_WIDTH, KIOSK_HEIGHT, KIOSK_DEPTH);
	const mesh = new THREE.Mesh(geometry, kioskMaterial);
	mesh.userData.boothId = boothId;
	return mesh;
}

/**
 * Build the visible signage (kiosk mesh + floating sign sprite) for every known
 * hub booth anchor. Anchors whose id is not in BOOTH_DISPLAY_NAMES, or with a
 * non-finite x/z, are skipped. A missing/empty/null `boothAnchors` yields [].
 *
 * @param {Record<string, { x: number, z: number }>|null|undefined} boothAnchors
 * @param {number} [floorY] - hub floor height the kiosk rests on
 * @returns {THREE.Object3D[]} flat array of created objects (kiosk + sprite per booth)
 */
export function buildHubBoothSigns(boothAnchors, floorY = DEFAULT_FLOOR_Y) {
	if (!boothAnchors) return [];

	const objects = [];
	for (const [boothId, anchor] of Object.entries(boothAnchors)) {
		const label = BOOTH_DISPLAY_NAMES[boothId];
		if (!label) continue; // unknown booth id — no sign
		if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.z)) continue;

		const kiosk = buildKiosk(boothId);
		kiosk.position.set(anchor.x, floorY + KIOSK_HEIGHT / 2, anchor.z);
		objects.push(kiosk);

		const sign = buildSignSprite(boothId, label);
		sign.position.set(anchor.x, floorY + SIGN_HEIGHT, anchor.z);
		objects.push(sign);
	}
	return objects;
}
