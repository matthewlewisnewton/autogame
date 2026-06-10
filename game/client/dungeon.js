import * as THREE from 'three';
import dungeonTheme from '../shared/dungeonTheme.json' with { type: 'json' };
import {
	wallAABB,
	resolveWallCollision as resolveWallCollisionPure,
	checkSweptCollision as checkSweptCollisionPure,
	isInsideDungeon as isInsideDungeonPure,
	clampToDungeon as clampToDungeonPure,
	tryPlayerMove as tryPlayerMovePure,
	isPositionBlocked as isPositionBlockedPure,
	sampleFloorY,
	DEFAULT_FLOOR_Y,
	resolveFloorY,
} from './collision.js';
import { PASSAGE_WIDTH, BOUNDS_MARGIN } from './config.js';
import { buildHubBoothSigns } from './boothSigns.js';

// ── Visual constants ──

export const WALL_HEIGHT = 2.5;
export const WALL_THICKNESS = 0.4;
export const FLOOR_Y = 0.05; // slightly above background to avoid z-fighting
export const GROUND_Y = -0.02; // background plane sits below room floor bottoms (y=0)
export const PASSAGE_WALL_HEIGHT = 1.5;
export const PASSAGE_WALL_THICKNESS = 0.3;
export const LARGE_ROOM_MIN_SIZE = 16;

// ── Profile-keyed dungeon materials ──

/** @type {Map<string, ReturnType<typeof buildProfileMaterialSet>>} */
const profileMaterialCache = new Map();

function parseHex(hex) {
	return parseInt(String(hex).replace('#', ''), 16);
}

function tintHex(baseHex, tintHexStr, mix) {
	const base = parseHex(baseHex);
	const tint = parseHex(tintHexStr);
	const br = (base >> 16) & 0xff;
	const bg = (base >> 8) & 0xff;
	const bb = base & 0xff;
	const tr = (tint >> 16) & 0xff;
	const tg = (tint >> 8) & 0xff;
	const tb = tint & 0xff;
	const r = Math.round(br + (tr - br) * mix);
	const g = Math.round(bg + (tg - bg) * mix);
	const b = Math.round(bb + (tb - bb) * mix);
	return (r << 16) | (g << 8) | b;
}

function darkenHex(hex, factor = 0.62) {
	const c = parseHex(hex);
	const r = Math.round(((c >> 16) & 0xff) * factor);
	const g = Math.round(((c >> 8) & 0xff) * factor);
	const b = Math.round((c & 0xff) * factor);
	return (r << 16) | (g << 8) | b;
}

function materialColorHex(material) {
	if (typeof material.color === 'number') return material.color;
	if (material.color && typeof material.color.getHex === 'function') {
		return material.color.getHex();
	}
	return material.color?._value ?? 0;
}

function buildProfileMaterialSet(themeEntry) {
	const floorRoughness = themeEntry.floorRoughness ?? 0.8;
	const wallRoughness = themeEntry.wallRoughness ?? 0.7;
	const floor = new THREE.MeshStandardMaterial({
		color: parseHex(themeEntry.floor),
		roughness: floorRoughness,
	});
	const wall = new THREE.MeshStandardMaterial({
		color: parseHex(themeEntry.wall),
		roughness: wallRoughness,
	});
	const passageFloor = new THREE.MeshStandardMaterial({
		color: parseHex(themeEntry.passageFloor),
		roughness: floorRoughness,
	});
	const passageWall = new THREE.MeshStandardMaterial({
		color: parseHex(themeEntry.passageWall),
		roughness: wallRoughness,
	});

	const { start: startTint, treasure: treasureTint } = dungeonTheme.roleTints;
	const roleFloors = {
		start: new THREE.MeshStandardMaterial({
			color: tintHex(themeEntry.floor, startTint.color, startTint.mix),
			roughness: floorRoughness,
		}),
		combat: floor,
		treasure: new THREE.MeshStandardMaterial({
			color: tintHex(themeEntry.floor, treasureTint.color, treasureTint.mix),
			roughness: floorRoughness,
		}),
	};

	const accentHex = parseHex(themeEntry.accent ?? themeEntry.passageFloor);
	const accent = new THREE.MeshStandardMaterial({
		color: accentHex,
		emissive: accentHex,
		emissiveIntensity: 0.55,
		roughness: 0.45,
	});

	return { floor, wall, passageFloor, passageWall, roleFloors, accent };
}

function resolveProfileKey(profile) {
	const key = profile ?? 'crowded';
	return dungeonTheme.profiles[key] ? key : 'default';
}

/**
 * Lazily build and cache MeshStandardMaterial sets per layout profile.
 * Unknown profiles fall back to the legacy default palette.
 *
 * @param {string} [profile]
 */
export function getProfileMaterials(profile) {
	const key = resolveProfileKey(profile);
	if (!profileMaterialCache.has(key)) {
		const themeEntry = dungeonTheme.profiles[key];
		profileMaterialCache.set(key, buildProfileMaterialSet(themeEntry));
	}
	return profileMaterialCache.get(key);
}

/** Hex colors for a profile palette (for tests). */
export function getProfileMaterialColors(profile) {
	const { floor, wall, passageFloor, passageWall, roleFloors } = getProfileMaterials(profile);
	return {
		floor: materialColorHex(floor),
		wall: materialColorHex(wall),
		passageFloor: materialColorHex(passageFloor),
		passageWall: materialColorHex(passageWall),
		startFloor: materialColorHex(roleFloors.start),
		treasureFloor: materialColorHex(roleFloors.treasure),
	};
}

// ── Per-profile entry room materials (start spawn rooms) ──

const ENTRY_PALETTE_PROFILES = new Set(['ice-cavern', 'fire-cavern', 'crowded']);

/** @type {Map<string, { floor: THREE.MeshStandardMaterial, wall: THREE.MeshStandardMaterial }>} */
const entryRoomMaterialsCache = new Map();

function hasEntryPalette(profile) {
	const key = resolveProfileKey(profile);
	return ENTRY_PALETTE_PROFILES.has(key)
		&& dungeonTheme.profiles[key]?.entryFloor
		&& dungeonTheme.profiles[key]?.entryWall;
}

/**
 * Cached floor/wall materials for biome entry (start) rooms.
 *
 * @param {string} [profile]
 * @returns {{ floor: THREE.MeshStandardMaterial, wall: THREE.MeshStandardMaterial } | null}
 */
export function getEntryRoomMaterials(profile) {
	const key = resolveProfileKey(profile);
	if (!hasEntryPalette(key)) return null;
	if (!entryRoomMaterialsCache.has(key)) {
		const themeEntry = dungeonTheme.profiles[key];
		const floorRoughness = themeEntry.floorRoughness ?? 0.8;
		const wallRoughness = themeEntry.wallRoughness ?? 0.7;
		entryRoomMaterialsCache.set(key, {
			floor: new THREE.MeshStandardMaterial({
				color: parseHex(themeEntry.entryFloor),
				roughness: floorRoughness,
			}),
			wall: new THREE.MeshStandardMaterial({
				color: parseHex(themeEntry.entryWall),
				roughness: wallRoughness,
			}),
		});
	}
	return entryRoomMaterialsCache.get(key);
}

/** Hex colors for entry-room materials (for tests). */
export function getEntryRoomMaterialColors(profile) {
	const mats = getEntryRoomMaterials(profile);
	if (!mats) return null;
	return {
		floor: materialColorHex(mats.floor),
		wall: materialColorHex(mats.wall),
	};
}

const defaultMaterials = getProfileMaterials('default');

// Backward-compatible exports (legacy default palette)
export const floorMaterial = defaultMaterials.floor;
export const wallMaterial = defaultMaterials.wall;
export const passageFloorMaterial = defaultMaterials.passageFloor;
export const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 1.0 });

// Spire-ascent summit tints — lighter/cooler slate derived from the base dungeon palette
const SPIRE_SUMMIT_FLOOR_HEX = 0x64748b;
const SPIRE_SUMMIT_WALL_HEX = 0x7c8fa3;

const spireTierMaterialsCache = new Map();
const spireRampMaterialsCache = new Map();

function lerpColorHex(fromHex, toHex, t) {
	const fr = (fromHex >> 16) & 0xff;
	const fg = (fromHex >> 8) & 0xff;
	const fb = fromHex & 0xff;
	const tr = (toHex >> 16) & 0xff;
	const tg = (toHex >> 8) & 0xff;
	const tb = toHex & 0xff;
	const r = Math.round(fr + (tr - fr) * t);
	const g = Math.round(fg + (tg - fg) * t);
	const b = Math.round(fb + (tb - fb) * t);
	return (r << 16) | (g << 8) | b;
}

/**
 * Cached floor/wall materials for a spire-ascent tier. Tier 0 matches the base
 * dungeon slate; the highest tier lerps toward the summit palette.
 */
export function getSpireAscentTierMaterials(tierIndex, tierCount) {
	const key = `t-${tierCount}-${tierIndex}`;
	if (!spireTierMaterialsCache.has(key)) {
		const t = tierCount <= 1 ? 0 : tierIndex / (tierCount - 1);
		const floorHex = lerpColorHex(materialColorHex(floorMaterial), SPIRE_SUMMIT_FLOOR_HEX, t);
		const wallHex = lerpColorHex(materialColorHex(wallMaterial), SPIRE_SUMMIT_WALL_HEX, t);
		spireTierMaterialsCache.set(key, {
			floor: new THREE.MeshStandardMaterial({ color: floorHex, roughness: 0.8 }),
			wall: new THREE.MeshStandardMaterial({ color: wallHex, roughness: 0.7 }),
		});
	}
	return spireTierMaterialsCache.get(key);
}

/**
 * Cached floor/wall materials for a spire-ascent ramp between two tier indices.
 */
export function getSpireAscentRampMaterials(fromTierIndex, toTierIndex, tierCount) {
	const lo = Math.min(fromTierIndex, toTierIndex);
	const hi = Math.max(fromTierIndex, toTierIndex);
	const key = `r-${tierCount}-${lo}-${hi}`;
	if (!spireRampMaterialsCache.has(key)) {
		const fromMats = getSpireAscentTierMaterials(lo, tierCount);
		const toMats = getSpireAscentTierMaterials(hi, tierCount);
		const floorHex = lerpColorHex(materialColorHex(fromMats.floor), materialColorHex(toMats.floor), 0.5);
		const wallHex = lerpColorHex(materialColorHex(fromMats.wall), materialColorHex(toMats.wall), 0.5);
		spireRampMaterialsCache.set(key, {
			floor: new THREE.MeshStandardMaterial({ color: floorHex, roughness: 0.8 }),
			wall: new THREE.MeshStandardMaterial({ color: wallHex, roughness: 0.7 }),
		});
	}
	return spireRampMaterialsCache.get(key);
}

function getSpireTierCount(layout) {
	const tiers = layout.rooms.filter(r => r.band === 'tier');
	if (tiers.length === 0) return 1;
	return Math.max(...tiers.map(r => r.tierIndex ?? 0)) + 1;
}

function inferSpireRampTierIndices(room, layout) {
	const fc = room.floorCorners;
	if (!fc) return { from: 0, to: 1 };

	const yLow = Math.min(fc.yNW, fc.yNE, fc.ySE, fc.ySW);
	const yHigh = Math.max(fc.yNW, fc.yNE, fc.ySE, fc.ySW);
	const tierRooms = layout.rooms.filter(r => r.band === 'tier' && r.tierIndex != null);

	function yToTier(y) {
		for (const t of tierRooms) {
			const ty = t.floorCorners?.yNW ?? DEFAULT_FLOOR_Y;
			if (Math.abs(ty - y) < 0.001) return t.tierIndex;
		}
		const sorted = [...tierRooms].sort(
			(a, b) => (a.floorCorners?.yNW ?? DEFAULT_FLOOR_Y) - (b.floorCorners?.yNW ?? DEFAULT_FLOOR_Y)
		);
		for (const t of sorted) {
			const ty = t.floorCorners?.yNW ?? DEFAULT_FLOOR_Y;
			if (Math.abs(ty - y) < 0.001) return t.tierIndex;
		}
		return 0;
	}

	return { from: yToTier(yLow), to: yToTier(yHigh) };
}

function resolveSpireRoomMaterials(room, layout, tierCount) {
	if (room.band === 'tier' && room.tierIndex != null) {
		return getSpireAscentTierMaterials(room.tierIndex, tierCount);
	}
	if (room.band === 'ramp') {
		const { from, to } = inferSpireRampTierIndices(room, layout);
		return getSpireAscentRampMaterials(from, to, tierCount);
	}
	return null;
}

// ── Sunken-canyon band floor materials (plateau / ramp / canyon) ──

const sunkenCanyonBandMaterialsCache = new Map();
const sunkenCanyonRoleFloorCache = new Map();

function sunkenCanyonThemeEntry() {
	return dungeonTheme.profiles['sunken-canyon'];
}

function sunkenCanyonPlateauFloorHex() {
	const entry = sunkenCanyonThemeEntry();
	return parseHex(entry.plateauFloor ?? entry.floor);
}

function sunkenCanyonCanyonFloorHex() {
	const entry = sunkenCanyonThemeEntry();
	return parseHex(entry.canyonFloor ?? entry.floor);
}

/**
 * Hex color for a sunken-canyon vertical band floor (tests).
 *
 * @param {'plateau'|'canyon'|'ramp'|string} band
 * @param {number} [yT] - 0 = plateau hue, 1 = canyon hue (ramps)
 */
export function getSunkenCanyonBandFloorHex(band, yT = 0.5) {
	const plateauHex = sunkenCanyonPlateauFloorHex();
	const canyonHex = sunkenCanyonCanyonFloorHex();
	if (band === 'plateau') return plateauHex;
	if (band === 'canyon') return canyonHex;
	const t = band === 'ramp' ? yT : 0.5;
	return lerpColorHex(plateauHex, canyonHex, t);
}

/**
 * Cached floor material for a sunken-canyon vertical band.
 *
 * @param {'plateau'|'canyon'|'ramp'|string} band
 * @param {number} [yT] - ramp lerp factor (0 = plateau, 1 = canyon)
 */
export function getSunkenCanyonBandMaterials(band, yT = 0.5) {
	const cacheKey = band === 'ramp' ? `ramp-${Math.round(yT * 100)}` : (band || 'canyon');
	if (!sunkenCanyonBandMaterialsCache.has(cacheKey)) {
		const entry = sunkenCanyonThemeEntry();
		const floorRoughness = entry.floorRoughness ?? 0.85;
		const floorHex = getSunkenCanyonBandFloorHex(band, yT);
		sunkenCanyonBandMaterialsCache.set(cacheKey, {
			floor: new THREE.MeshStandardMaterial({ color: floorHex, roughness: floorRoughness }),
		});
	}
	return sunkenCanyonBandMaterialsCache.get(cacheKey);
}

function inferSunkenCanyonRampYT(room, layout) {
	const fc = room.floorCorners;
	if (!fc) return 0.5;

	const avgY = (fc.yNW + fc.yNE + fc.ySE + fc.ySW) / 4;
	const plateauRoom = layout.rooms.find(r => r.band === 'plateau');
	const canyonRoom = layout.rooms.find(r => r.band === 'canyon');
	const yHigh = plateauRoom?.floorCorners?.yNW ?? DEFAULT_FLOOR_Y;
	const yLow = canyonRoom?.floorCorners?.yNW ?? DEFAULT_FLOOR_Y;
	if (Math.abs(yHigh - yLow) < 0.001) return 0.5;
	return (avgY - yHigh) / (yLow - yHigh);
}

function getSunkenCanyonRoleFloorMaterial(band, yT, role) {
	const cacheKey = `role-${band}-${role}-${band === 'ramp' ? Math.round(yT * 100) : ''}`;
	if (!sunkenCanyonRoleFloorCache.has(cacheKey)) {
		const entry = sunkenCanyonThemeEntry();
		const floorRoughness = entry.floorRoughness ?? 0.85;
		const baseHex = getSunkenCanyonBandFloorHex(band, yT);
		const tint = dungeonTheme.roleTints[role];
		const color = tint ? tintHex(baseHex, tint.color, tint.mix) : baseHex;
		sunkenCanyonRoleFloorCache.set(cacheKey, new THREE.MeshStandardMaterial({
			color,
			roughness: floorRoughness,
		}));
	}
	return sunkenCanyonRoleFloorCache.get(cacheKey);
}

function resolveSunkenCanyonRoomFloorMaterial(room, layout) {
	const band = room.band ?? 'canyon';
	const yT = band === 'ramp' ? inferSunkenCanyonRampYT(room, layout) : 0.5;
	if (room.role === 'start' || room.role === 'treasure') {
		return getSunkenCanyonRoleFloorMaterial(band, yT, room.role);
	}
	return getSunkenCanyonBandMaterials(band, yT).floor;
}

// ── Ice-cavern band floor materials (stone / ramp / ice) ──

const iceCavernBandMaterialsCache = new Map();
const iceCavernRoleFloorCache = new Map();

function iceCavernThemeEntry() {
	return dungeonTheme.profiles['ice-cavern'];
}

function iceCavernStoneFloorHex() {
	const entry = iceCavernThemeEntry();
	return parseHex(entry.stoneFloor ?? entry.floor);
}

function iceCavernIceFloorHex() {
	const entry = iceCavernThemeEntry();
	return parseHex(entry.iceFloor ?? entry.floor);
}

/**
 * Hex color for an ice-cavern vertical band floor (tests).
 *
 * @param {'stone'|'ice'|'ramp'|string} band
 * @param {number} [yT] - 0 = stone hue, 1 = ice hue (ramps)
 */
export function getIceCavernBandFloorHex(band, yT = 0.5) {
	const stoneHex = iceCavernStoneFloorHex();
	const iceHex = iceCavernIceFloorHex();
	if (band === 'entry') {
		const entryHex = getEntryRoomMaterialColors('ice-cavern')?.floor;
		if (entryHex != null) return entryHex;
	}
	if (band === 'stone') return stoneHex;
	if (band === 'ice') return iceHex;
	const t = band === 'ramp' ? yT : 0.5;
	return lerpColorHex(stoneHex, iceHex, t);
}

/**
 * Cached floor material for an ice-cavern vertical band.
 *
 * @param {'stone'|'ice'|'ramp'|string} band
 * @param {number} [yT] - ramp lerp factor (0 = stone, 1 = ice)
 */
export function getIceCavernBandMaterials(band, yT = 0.5) {
	if (band === 'entry') {
		const entryMats = getEntryRoomMaterials('ice-cavern');
		if (entryMats) return { floor: entryMats.floor };
	}
	const cacheKey = band === 'ramp' ? `ramp-${Math.round(yT * 100)}` : (band || 'ice');
	if (!iceCavernBandMaterialsCache.has(cacheKey)) {
		const entry = iceCavernThemeEntry();
		const floorRoughness = entry.floorRoughness ?? 0.45;
		const floorHex = getIceCavernBandFloorHex(band, yT);
		iceCavernBandMaterialsCache.set(cacheKey, {
			floor: new THREE.MeshStandardMaterial({ color: floorHex, roughness: floorRoughness }),
		});
	}
	return iceCavernBandMaterialsCache.get(cacheKey);
}

function getIceCavernRoleFloorMaterial(band, yT, role) {
	const cacheKey = `role-${band}-${role}-${band === 'ramp' ? Math.round(yT * 100) : ''}`;
	if (!iceCavernRoleFloorCache.has(cacheKey)) {
		const entry = iceCavernThemeEntry();
		const floorRoughness = entry.floorRoughness ?? 0.45;
		const baseHex = getIceCavernBandFloorHex(band, yT);
		const tint = dungeonTheme.roleTints[role];
		const color = tint ? tintHex(baseHex, tint.color, tint.mix) : baseHex;
		iceCavernRoleFloorCache.set(cacheKey, new THREE.MeshStandardMaterial({
			color,
			roughness: floorRoughness,
		}));
	}
	return iceCavernRoleFloorCache.get(cacheKey);
}

function resolveIceCavernRoomMaterials(room) {
	if (room.role === 'start' || room.band === 'entry') {
		const entryMats = getEntryRoomMaterials('ice-cavern');
		if (entryMats) return entryMats;
	}
	const band = room.band ?? 'ice';
	const yT = 0.5;
	if (room.role === 'treasure') {
		return { floor: getIceCavernRoleFloorMaterial(band, yT, room.role) };
	}
	return { floor: getIceCavernBandMaterials(band, yT).floor };
}

// ── Fire-cavern band floor materials (rim / ramp / basin) ──

const fireCavernBandMaterialsCache = new Map();
const fireCavernRoleFloorCache = new Map();

function fireCavernThemeEntry() {
	return dungeonTheme.profiles['fire-cavern'];
}

function fireCavernRimFloorHex() {
	const entry = fireCavernThemeEntry();
	return parseHex(entry.rimFloor ?? entry.floor);
}

function fireCavernBasinFloorHex() {
	const entry = fireCavernThemeEntry();
	return parseHex(entry.basinFloor ?? entry.floor);
}

/**
 * Hex color for a fire-cavern vertical band floor (tests).
 *
 * @param {'rim'|'basin'|'ramp'|string} band
 * @param {number} [yT] - 0 = rim hue, 1 = basin hue (ramps)
 */
export function getFireCavernBandFloorHex(band, yT = 0.5) {
	const rimHex = fireCavernRimFloorHex();
	const basinHex = fireCavernBasinFloorHex();
	if (band === 'entry') {
		const entryHex = getEntryRoomMaterialColors('fire-cavern')?.floor;
		if (entryHex != null) return entryHex;
	}
	if (band === 'rim') return rimHex;
	if (band === 'basin') return basinHex;
	const t = band === 'ramp' ? yT : 0.5;
	return lerpColorHex(rimHex, basinHex, t);
}

/**
 * Cached floor material for a fire-cavern vertical band.
 *
 * @param {'rim'|'basin'|'ramp'|string} band
 * @param {number} [yT] - ramp lerp factor (0 = rim, 1 = basin)
 */
export function getFireCavernBandMaterials(band, yT = 0.5) {
	if (band === 'entry') {
		const entryMats = getEntryRoomMaterials('fire-cavern');
		if (entryMats) return { floor: entryMats.floor };
	}
	const cacheKey = band === 'ramp' ? `ramp-${Math.round(yT * 100)}` : (band || 'basin');
	if (!fireCavernBandMaterialsCache.has(cacheKey)) {
		const entry = fireCavernThemeEntry();
		const floorRoughness = entry.floorRoughness ?? 0.85;
		const floorHex = getFireCavernBandFloorHex(band, yT);
		fireCavernBandMaterialsCache.set(cacheKey, {
			floor: new THREE.MeshStandardMaterial({ color: floorHex, roughness: floorRoughness }),
		});
	}
	return fireCavernBandMaterialsCache.get(cacheKey);
}

function inferFireCavernRampYT(room, layout) {
	const fc = room.floorCorners;
	if (!fc) return 0.5;

	const avgY = (fc.yNW + fc.yNE + fc.ySE + fc.ySW) / 4;
	const rimRoom = layout.rooms.find(r => r.role === 'start' || r.band === 'rim');
	const basinRoom = layout.rooms.find(r => r.band === 'basin');
	const yHigh = rimRoom?.floorCorners?.yNW ?? DEFAULT_FLOOR_Y;
	const yLow = basinRoom?.floorCorners?.yNW ?? DEFAULT_FLOOR_Y;
	if (Math.abs(yHigh - yLow) < 0.001) return 0.5;
	return (avgY - yHigh) / (yLow - yHigh);
}

function getFireCavernRoleFloorMaterial(band, yT, role) {
	const cacheKey = `role-${band}-${role}-${band === 'ramp' ? Math.round(yT * 100) : ''}`;
	if (!fireCavernRoleFloorCache.has(cacheKey)) {
		const entry = fireCavernThemeEntry();
		const floorRoughness = entry.floorRoughness ?? 0.85;
		const baseHex = getFireCavernBandFloorHex(band, yT);
		const tint = dungeonTheme.roleTints[role];
		const color = tint ? tintHex(baseHex, tint.color, tint.mix) : baseHex;
		fireCavernRoleFloorCache.set(cacheKey, new THREE.MeshStandardMaterial({
			color,
			roughness: floorRoughness,
		}));
	}
	return fireCavernRoleFloorCache.get(cacheKey);
}

function resolveFireCavernRoomMaterials(room, layout) {
	if (room.role === 'start' || room.band === 'entry') {
		const entryMats = getEntryRoomMaterials('fire-cavern');
		if (entryMats) return entryMats;
	}
	const band = room.band ?? 'basin';
	const yT = band === 'ramp' ? inferFireCavernRampYT(room, layout) : 0.5;
	let floor;
	if (room.role === 'treasure') {
		floor = getFireCavernRoleFloorMaterial(band, yT, room.role);
	} else {
		floor = getFireCavernBandMaterials(band, yT).floor;
	}
	return { floor };
}

// ── Slippery floor override (profile-independent icy sheen) ──

/** @type {THREE.MeshStandardMaterial | null} */
let slipperyFloorMaterialCache = null;

/**
 * Cached singleton material for `floorSurface: 'slippery'` rooms and platforms.
 * Low roughness and emissive ice-blue tint distinguish slippery surfaces from normal floors.
 *
 * @param {THREE.MeshStandardMaterial} [_baseFloorMaterial] - reserved; slippery look is uniform
 */
export function getSlipperyFloorMaterial(_baseFloorMaterial) {
	if (!slipperyFloorMaterialCache) {
		slipperyFloorMaterialCache = new THREE.MeshStandardMaterial({
			color: 0xb8e4f8,
			emissive: 0x4db8e8,
			emissiveIntensity: 0.4,
			roughness: 0.12,
			metalness: 0.08,
		});
	}
	return slipperyFloorMaterialCache;
}

function applySlipperyFloorOverride(floorMat, surface) {
	return surface === 'slippery' ? getSlipperyFloorMaterial(floorMat) : floorMat;
}

// Treasure room marker material (emissive gold pillar)
const treasureMarkerMaterial = new THREE.MeshStandardMaterial({
	color: 0xffd700,
	emissive: 0xaa8800,
	emissiveIntensity: 0.6,
	roughness: 0.4,
});

/** userData.dungeonTag on spire-ascent summit beacon meshes (client tests). */
export const SPIRE_SUMMIT_BEACON_TAG = 'spireSummitBeacon';

/** userData.dungeonTag on spire-ascent exterior edge hazard warning strips. */
export const SPIRE_EDGE_HAZARD_TAG = 'spireEdgeHazard';

/** userData.dungeonTag on sunken-canyon plateau cliff-edge lip strips at ramp mouths. */
export const CANYON_CLIFF_LIP_TAG = 'canyonCliffLip';

const canyonCliffLipMaterial = (() => {
	const entry = sunkenCanyonThemeEntry();
	const accentHex = parseHex(entry.accent ?? entry.passageFloor);
	const warningHex = parseHex(dungeonTheme.roleTints.treasure.color);
	return new THREE.MeshStandardMaterial({
		color: accentHex,
		emissive: warningHex,
		emissiveIntensity: 1.1,
		roughness: 0.35,
		metalness: 0.2,
	});
})();

/**
 * Low emissive warning strip on a sunken-canyon cliff-lip AABB at a ramp mouth.
 */
export function buildCanyonCliffLipMesh(lip) {
	const width = lip.maxX - lip.minX;
	const depth = lip.maxZ - lip.minZ;
	const stripHeight = 0.14;
	const geo = new THREE.BoxGeometry(width, stripHeight, depth);
	const mesh = new THREE.Mesh(geo, canyonCliffLipMaterial);
	const floorY = resolveFloorY(lip.y);
	mesh.position.set(
		(lip.minX + lip.maxX) / 2,
		floorY + stripHeight / 2,
		(lip.minZ + lip.maxZ) / 2,
	);
	mesh.userData.dungeonTag = CANYON_CLIFF_LIP_TAG;
	return mesh;
}

const edgeHazardStripMaterial = new THREE.MeshStandardMaterial({
	color: 0x22d3ee,
	emissive: 0xff00ff,
	emissiveIntensity: 1.1,
	roughness: 0.35,
	metalness: 0.2,
});

/**
 * Low emissive warning strip on a spire-ascent tier lip hazard AABB.
 */
export function buildSpireEdgeHazardMesh(hazard) {
	const width = hazard.maxX - hazard.minX;
	const depth = hazard.maxZ - hazard.minZ;
	const stripHeight = 0.14;
	const geo = new THREE.BoxGeometry(width, stripHeight, depth);
	const mesh = new THREE.Mesh(geo, edgeHazardStripMaterial);
	const floorY = resolveFloorY(hazard.y);
	mesh.position.set(
		(hazard.minX + hazard.maxX) / 2,
		floorY + stripHeight / 2,
		(hazard.minZ + hazard.maxZ) / 2,
	);
	mesh.userData.dungeonTag = SPIRE_EDGE_HAZARD_TAG;
	return mesh;
}

const summitBeaconShaftMaterial = new THREE.MeshStandardMaterial({
	color: 0xe0f2fe,
	emissive: 0x38bdf8,
	emissiveIntensity: 1.2,
	roughness: 0.35,
	metalness: 0.15,
});

const summitBeaconCapMaterial = new THREE.MeshStandardMaterial({
	color: 0xfef9c3,
	emissive: 0xfacc15,
	emissiveIntensity: 1.5,
	roughness: 0.25,
	metalness: 0.1,
});

/**
 * Taller emissive summit beacon for spire-ascent treasure tiers — visible goal
 * from lower tiers. Returns shaft + cap meshes; shaft carries an optional glow light.
 */
export function buildSpireSummitBeacon(room, layout) {
	const floorY = resolveFloorY(sampleFloorY(layout, room.x, room.z));
	const shaftHeight = 3.2;
	const capHeight = 0.55;

	const shaftGeo = new THREE.CylinderGeometry(0.35, 0.48, shaftHeight, 10);
	const shaft = new THREE.Mesh(shaftGeo, summitBeaconShaftMaterial);
	shaft.position.set(room.x, floorY + shaftHeight / 2, room.z);
	shaft.userData.dungeonTag = SPIRE_SUMMIT_BEACON_TAG;
	shaft.userData.beaconPart = 'shaft';

	const glow = new THREE.PointLight(0x7dd3fc, 1.4, 20, 1.6);
	glow.position.set(0, shaftHeight / 2 + 0.4, 0);
	shaft.add(glow);

	const capGeo = new THREE.CylinderGeometry(0.18, 0.42, capHeight, 10);
	const cap = new THREE.Mesh(capGeo, summitBeaconCapMaterial);
	cap.position.set(room.x, floorY + shaftHeight + capHeight / 2, room.z);
	cap.userData.dungeonTag = SPIRE_SUMMIT_BEACON_TAG;
	cap.userData.beaconPart = 'cap';

	return [shaft, cap];
}

/**
 * Check whether a room's floorCorners are uniform (flat floor).
 * Returns true if floorCorners is absent or all four values are equal.
 */
export function isUniformFloor(room) {
	const fc = room.floorCorners;
	if (!fc) return true;
	const v = fc.yNW;
	return fc.yNE === v && fc.ySE === v && fc.ySW === v;
}

/**
 * Visual Y for a uniform (flat) room floor mesh.
 * Legacy/default-band rooms use FLOOR_Y; elevated bands (e.g. sunken-canyon plateau)
 * use their uniform corner height.
 */
export function uniformFloorMeshY(room) {
	if (!isUniformFloor(room)) return FLOOR_Y;
	const fc = room.floorCorners;
	if (!fc) return FLOOR_Y;
	if (fc.yNW === DEFAULT_FLOOR_Y) return FLOOR_Y;
	return fc.yNW;
}

/**
 * Build a sloped floor mesh for a room with non-uniform floorCorners.
 * Determines the dominant slope axis (Z or X) by comparing edge averages,
 * then returns a rotated BoxGeometry mesh positioned at the average height.
 *
 * The rotated BoxGeometry is a visual approximation of the bilinear surface
 * defined by `sampleFloorY()`. Minor gaps may appear at room edges for
 * non-axis-aligned corner patterns (e.g. diagonal ramps). This is intentional —
 * a four-corner BufferGeometry match is deferred to a future art pass.
 */
export function buildSlopedFloor(room, floorMat) {
	const fc = room.floorCorners;
	const yNW = fc.yNW;
	const yNE = fc.yNE;
	const ySE = fc.ySE;
	const ySW = fc.ySW;

	// Edge averages to determine dominant slope axis
	const zSlopeDelta = Math.abs((ySW + ySE) / 2 - (yNW + yNE) / 2);
	const xSlopeDelta = Math.abs((yNE + ySE) / 2 - (yNW + ySW) / 2);

	let geo;
	let mesh;

	if (zSlopeDelta >= xSlopeDelta) {
		// Z-slope: ramp along Z axis
		const yDelta = (ySW + ySE) / 2 - (yNW + yNE) / 2;
		const slopeLen = Math.hypot(room.depth, yDelta);
		const angle = Math.atan2(yDelta, room.depth);
		const avgY = (Math.min(yNW, yNE, ySE, ySW) + Math.max(yNW, yNE, ySE, ySW)) / 2;

		geo = new THREE.BoxGeometry(room.width, 0.1, slopeLen);
		mesh = new THREE.Mesh(geo, floorMat);
		mesh.position.set(room.x, avgY, room.z);
		mesh.rotation.x = angle;
	} else {
		// X-slope: ramp along X axis
		const yDelta = (yNE + ySE) / 2 - (yNW + ySW) / 2;
		const slopeLen = Math.hypot(room.width, yDelta);
		const angle = Math.atan2(yDelta, room.width);
		const avgY = (Math.min(yNW, yNE, ySE, ySW) + Math.max(yNW, yNE, ySE, ySW)) / 2;

		geo = new THREE.BoxGeometry(slopeLen, 0.1, room.depth);
		mesh = new THREE.Mesh(geo, floorMat);
		mesh.position.set(room.x, avgY, room.z);
		mesh.rotation.z = -angle;
	}

	return { mesh, geometry: geo };
}

/**
 * Remove all dungeon meshes from the scene and dispose geometries.
 * Shared materials are NOT disposed (they are reused across builds).
 *
 * @param {THREE.Scene} scene
 * @param {THREE.Mesh[]} dungeonMeshes - array to clear
 */
export function clearDungeon(scene, dungeonMeshes) {
	for (const mesh of dungeonMeshes) {
		if (scene) scene.remove(mesh);
		if (mesh.geometry) mesh.geometry.dispose();
		// Do NOT dispose materials — they are shared module-level constants
	}
	dungeonMeshes.length = 0;
}

function findRoomAt(layout, x, z) {
	return layout.rooms.find(r => r.x === x && r.z === z);
}

function roomPassages(layout, room) {
	return (layout.passages || []).filter(p =>
		(p.x1 === room.x && p.z1 === room.z) || (p.x2 === room.x && p.z2 === room.z)
	);
}

function passageUsesEdge(room, passage, edge) {
	const fromThisRoom = passage.x1 === room.x && passage.z1 === room.z;
	const otherX = fromThisRoom ? passage.x2 : passage.x1;
	const otherZ = fromThisRoom ? passage.z2 : passage.z1;
	if (edge === 'north') return otherZ < room.z;
	if (edge === 'south') return otherZ > room.z;
	if (edge === 'west') return otherX < room.x;
	if (edge === 'east') return otherX > room.x;
	return false;
}

function hasGapOnEdge(walls, coordKey, edgeVal) {
	return walls.filter(w => Math.abs(w[coordKey] - edgeVal) < 0.01).length >= 2;
}

/**
 * Build emissive floor-stripe markers at passage doorway gaps on large rooms.
 *
 * @param {object} room
 * @param {object} layout
 * @param {{ accent: THREE.MeshStandardMaterial }} materials
 * @returns {THREE.Mesh[]}
 */
export function buildDoorwayMarkers(room, layout, materials) {
	if (Math.min(room.width, room.depth) < LARGE_ROOM_MIN_SIZE) return [];

	const halfW = room.width / 2;
	const halfD = room.depth / 2;
	const northZ = room.z - halfD;
	const southZ = room.z + halfD;
	const westX = room.x - halfW;
	const eastX = room.x + halfW;

	const xWalls = room.walls.filter(w => w.axis === 'x');
	const zWalls = room.walls.filter(w => w.axis === 'z');
	const connected = roomPassages(layout, room);
	const passageWidth = layout.passageWidth ?? PASSAGE_WIDTH;
	const markerSpan = passageWidth * 0.8;
	const markerHeight = 0.15;
	const markerDepth = 0.4;

	const gapEdges = [];
	if (hasGapOnEdge(xWalls, 'z', northZ)) gapEdges.push({ edge: 'north', x: room.x, z: northZ });
	if (hasGapOnEdge(xWalls, 'z', southZ)) gapEdges.push({ edge: 'south', x: room.x, z: southZ });
	if (hasGapOnEdge(zWalls, 'x', westX)) gapEdges.push({ edge: 'west', x: westX, z: room.z });
	if (hasGapOnEdge(zWalls, 'x', eastX)) gapEdges.push({ edge: 'east', x: eastX, z: room.z });

	const meshes = [];
	for (const gap of gapEdges) {
		if (!connected.some(p => passageUsesEdge(room, p, gap.edge))) continue;

		let geo;
		let posX = gap.x;
		let posZ = gap.z;
		if (gap.edge === 'north' || gap.edge === 'south') {
			geo = new THREE.BoxGeometry(markerSpan, markerHeight, markerDepth);
			posZ += gap.edge === 'north' ? markerDepth / 2 : -markerDepth / 2;
		} else {
			geo = new THREE.BoxGeometry(markerDepth, markerHeight, markerSpan);
			posX += gap.edge === 'west' ? markerDepth / 2 : -markerDepth / 2;
		}

		const floorY = resolveFloorY(sampleFloorY(layout, posX, posZ));
		const mesh = new THREE.Mesh(geo, materials.accent);
		mesh.position.set(posX, floorY + markerHeight / 2, posZ);
		mesh.userData.doorwayMarker = true;
		meshes.push(mesh);
	}

	return meshes;
}

/**
 * Build a composed landmark prop (visual only — no collision).
 *
 * @param {string} type - reactor_coil | pipe_stack | sand_spire | sun_arch | canyon_monolith | arena_dais | vault_dais
 * @param {{ wall: THREE.Material, accent: THREE.Material }} materials
 * @returns {THREE.Group}
 */
export function buildLandmarkMesh(type, materials) {
	const group = new THREE.Group();
	group.userData.landmarkType = type;
	const { wall, accent } = materials;

	const addMesh = (geo, mat, x, y, z, rotY = 0) => {
		const mesh = new THREE.Mesh(geo, mat);
		mesh.position.set(x, y, z);
		if (rotY) mesh.rotation.y = rotY;
		group.add(mesh);
	};

	switch (type) {
		case 'reactor_coil': {
			addMesh(new THREE.CylinderGeometry(0.9, 1.1, 0.35, 12), wall, 0, 0.175, 0);
			addMesh(new THREE.CylinderGeometry(0.55, 0.7, 1.4, 10), wall, 0, 1.05, 0);
			addMesh(new THREE.TorusGeometry(0.85, 0.12, 8, 20), accent, 0, 1.55, 0, Math.PI / 2);
			addMesh(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 8), accent, 0, 2.15, 0);
			break;
		}
		case 'pipe_stack': {
			addMesh(new THREE.BoxGeometry(1.6, 0.25, 1.6), wall, 0, 0.125, 0);
			addMesh(new THREE.CylinderGeometry(0.35, 0.35, 2.2, 8), wall, -0.45, 1.35, -0.35);
			addMesh(new THREE.CylinderGeometry(0.28, 0.28, 1.7, 8), wall, 0.5, 1.1, 0.4);
			addMesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), accent, 0.5, 2.0, 0.4);
			addMesh(new THREE.TorusGeometry(0.4, 0.08, 6, 16), accent, -0.45, 2.5, -0.35, Math.PI / 2);
			break;
		}
		case 'sand_spire': {
			addMesh(new THREE.CylinderGeometry(1.0, 1.3, 0.4, 10), wall, 0, 0.2, 0);
			addMesh(new THREE.CylinderGeometry(0.75, 1.0, 1.2, 10), wall, 0, 0.9, 0);
			addMesh(new THREE.CylinderGeometry(0.45, 0.75, 1.5, 10), wall, 0, 2.0, 0);
			addMesh(new THREE.ConeGeometry(0.35, 0.8, 8), accent, 0, 3.0, 0);
			break;
		}
		case 'sun_arch': {
			addMesh(new THREE.BoxGeometry(0.5, 2.4, 0.5), wall, -1.2, 1.2, 0);
			addMesh(new THREE.BoxGeometry(0.5, 2.4, 0.5), wall, 1.2, 1.2, 0);
			addMesh(new THREE.TorusGeometry(1.1, 0.18, 8, 24, Math.PI), accent, 0, 2.2, 0);
			addMesh(new THREE.BoxGeometry(2.8, 0.2, 0.6), accent, 0, 0.1, 0);
			break;
		}
		case 'canyon_monolith': {
			addMesh(new THREE.BoxGeometry(1.8, 0.35, 1.8), wall, 0, 0.175, 0);
			addMesh(new THREE.CylinderGeometry(0.85, 1.0, 1.2, 8), wall, 0, 0.95, 0);
			addMesh(new THREE.BoxGeometry(1.1, 1.0, 1.1), wall, 0, 2.05, 0);
			addMesh(new THREE.CylinderGeometry(0.45, 0.65, 0.9, 6), wall, 0, 3.0, 0);
			addMesh(new THREE.BoxGeometry(0.5, 0.25, 0.5), accent, 0, 3.58, 0);
			break;
		}
		case 'arena_dais': {
			addMesh(new THREE.CylinderGeometry(2.2, 2.4, 0.28, 6), wall, 0, 0.14, 0);
			addMesh(new THREE.CylinderGeometry(1.65, 1.85, 0.42, 6), wall, 0, 0.44, 0);
			addMesh(new THREE.CylinderGeometry(1.15, 1.15, 0.12, 6), accent, 0, 0.71, 0);
			addMesh(new THREE.TorusGeometry(1.3, 0.07, 6, 24), accent, 0, 0.8, 0, Math.PI / 2);
			addMesh(new THREE.CylinderGeometry(0.3, 0.2, 0.18, 6), accent, 0, 0.92, 0);
			break;
		}
		case 'vault_dais': {
			addMesh(new THREE.CylinderGeometry(2.05, 2.25, 0.2, 6), wall, 0, 0.1, 0);
			addMesh(new THREE.CylinderGeometry(1.55, 1.75, 0.16, 6), wall, 0, 0.28, 0);
			addMesh(new THREE.CylinderGeometry(0.75, 0.95, 0.55, 8), wall, 0, 0.64, 0);
			addMesh(new THREE.TorusGeometry(1.0, 0.11, 8, 18), accent, 0, 1.02, 0, Math.PI / 2);
			addMesh(new THREE.CylinderGeometry(0.28, 0.18, 0.4, 6), accent, 0, 1.32, 0);
			addMesh(new THREE.OctahedronGeometry(0.22), accent, 0, 1.62, 0);
			break;
		}
		default:
			break;
	}

	return group;
}

/** Collision footprint for open-plaza cover (matches server layout fields). */
const OPEN_PLAZA_COVER_TYPES = new Set(['pillar', 'broken_wall', 'barricade', 'crate_stack']);

/**
 * Build cover obstacle mesh(es) for open-plaza. Each type uses distinct proportions;
 * the returned group's origin sits at the footprint centre with base on local Y = 0.
 *
 * @param {{ width: number, depth: number, height: number, type: string }} cover
 * @param {THREE.Material} material
 * @returns {THREE.Group}
 */
export function buildCoverMesh(cover, material) {
	const group = new THREE.Group();
	group.userData.coverType = cover.type;

	const addBox = (w, h, d, y = h / 2) => {
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
		mesh.position.y = y;
		group.add(mesh);
	};

	switch (cover.type) {
		case 'pillar':
			addBox(cover.width, cover.height, cover.depth);
			break;
		case 'broken_wall':
			addBox(cover.width, cover.height, cover.depth);
			break;
		case 'barricade': {
			const railH = cover.height * 0.25;
			const plankH = cover.height - railH;
			addBox(cover.width, plankH, cover.depth, plankH / 2);
			const rail = new THREE.Mesh(
				new THREE.BoxGeometry(cover.width * 0.92, railH, cover.depth * 0.35),
				material,
			);
			rail.position.y = plankH + railH / 2;
			group.add(rail);
			break;
		}
		case 'crate_stack': {
			const tierH = cover.height / 3;
			const shrink = 0.88;
			let w = cover.width;
			let d = cover.depth;
			let y = 0;
			for (let i = 0; i < 3; i++) {
				const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, tierH, d), material);
				mesh.position.y = y + tierH / 2;
				group.add(mesh);
				y += tierH;
				w *= shrink;
				d *= shrink;
			}
			break;
		}
		default:
			if (OPEN_PLAZA_COVER_TYPES.has(cover.type)) {
				addBox(cover.width, cover.height, cover.depth);
			}
			break;
	}

	return group;
}

/**
 * Build visual-only perimeter decor for the open-plaza arena (banner pole or tiered seats).
 *
 * @param {'arena_banner' | 'arena_tier'} type
 * @param {{ wall: THREE.Material, accent: THREE.Material }} materials
 * @returns {THREE.Group}
 */
export function buildPerimeterDecorMesh(type, materials) {
	const group = new THREE.Group();
	group.userData.decorType = type;
	const { wall, accent } = materials;

	const addMesh = (geo, mat, x, y, z, rotY = 0) => {
		const mesh = new THREE.Mesh(geo, mat);
		mesh.position.set(x, y, z);
		if (rotY) mesh.rotation.y = rotY;
		group.add(mesh);
	};

	switch (type) {
		case 'arena_banner': {
			addMesh(new THREE.CylinderGeometry(0.09, 0.11, 3.6, 8), wall, 0, 1.8, 0);
			const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), accent);
			flag.position.set(0.7, 2.9, 0);
			flag.userData.decorAccent = true;
			group.add(flag);
			break;
		}
		case 'arena_tier': {
			addMesh(new THREE.BoxGeometry(2.6, 0.32, 1.1), wall, 0, 0.16, -0.35);
			addMesh(new THREE.BoxGeometry(2.6, 0.32, 0.95), wall, 0, 0.48, -0.12);
			addMesh(new THREE.BoxGeometry(2.6, 0.32, 0.8), wall, 0, 0.8, 0.1);
			break;
		}
		default:
			break;
	}

	return group;
}

/**
 * Build visual-only entry-room decor (icicles, ember vents, vault rubble).
 *
 * @param {'icicle_cluster' | 'ember_vent' | 'vault_rubble'} type
 * @param {{ floor: THREE.Material, wall: THREE.Material, accent: THREE.Material }} materials
 * @returns {THREE.Group}
 */
export function buildEntryDecorMesh(type, materials) {
	const group = new THREE.Group();
	group.userData.decorType = type;
	const { floor, wall, accent } = materials;

	const addMesh = (geo, mat, x, y, z, rotX = 0, rotY = 0) => {
		const mesh = new THREE.Mesh(geo, mat);
		mesh.position.set(x, y, z);
		if (rotX) mesh.rotation.x = rotX;
		if (rotY) mesh.rotation.y = rotY;
		group.add(mesh);
	};

	switch (type) {
		case 'icicle_cluster': {
			addMesh(new THREE.ConeGeometry(0.14, 0.9, 6), wall, -0.35, 1.1, 0, Math.PI);
			addMesh(new THREE.ConeGeometry(0.18, 1.2, 6), wall, 0.1, 1.35, 0.15, Math.PI);
			addMesh(new THREE.ConeGeometry(0.12, 0.7, 6), accent, 0.4, 0.95, -0.1, Math.PI);
			break;
		}
		case 'ember_vent': {
			addMesh(new THREE.BoxGeometry(1.4, 0.06, 0.35), floor, 0, 0.03, 0);
			addMesh(new THREE.BoxGeometry(0.7, 0.1, 0.18), accent, 0, 0.08, 0);
			addMesh(new THREE.BoxGeometry(0.25, 0.14, 0.25), accent, 0.35, 0.1, 0.12);
			break;
		}
		case 'vault_rubble': {
			addMesh(new THREE.BoxGeometry(0.9, 0.35, 0.7), wall, -0.25, 0.18, 0.1, 0, 0.4);
			addMesh(new THREE.BoxGeometry(0.6, 0.28, 0.55), floor, 0.3, 0.14, -0.2, 0.1, -0.3);
			addMesh(new THREE.BoxGeometry(0.45, 0.22, 0.4), wall, 0.05, 0.32, 0.35, 0.2, 0.8);
			break;
		}
		default:
			break;
	}

	return group;
}

/**
 * Build a visual-only floor marking mesh (no collision).
 *
 * @param {{ type: string, innerRadius?: number, outerRadius?: number }} marking
 * @param {{ accent: THREE.Material }} materials
 * @returns {THREE.Mesh | null}
 */
export function buildFloorMarkingMesh(marking, materials) {
	if (marking.type !== 'center_ring') return null;
	const geo = new THREE.RingGeometry(marking.innerRadius, marking.outerRadius, 64);
	const mesh = new THREE.Mesh(geo, materials.accent);
	mesh.rotation.x = -Math.PI / 2;
	mesh.userData.floorMarking = true;
	mesh.userData.floorMarkingType = 'center_ring';
	return mesh;
}

/**
 * Passage floor geometry should cover only the corridor gap between room edges.
 * Full center-to-center strips overlap room floors and z-fight at doorways.
 */
export function buildPassageFloorSpec(passage, layout) {
	const passageWidth = layout.passageWidth ?? PASSAGE_WIDTH;
	const corridorLength = passage.corridorLength;
	const fromRoom = findRoomAt(layout, passage.x1, passage.z1);
	const toRoom = findRoomAt(layout, passage.x2, passage.z2);

	if (!fromRoom || !toRoom || !Number.isFinite(corridorLength) || corridorLength <= 0) {
		const dx = passage.x2 - passage.x1;
		const dz = passage.z2 - passage.z1;
		const dist = Math.hypot(dx, dz);
		return {
			width: dist,
			height: 0.1,
			depth: passageWidth,
			x: (passage.x1 + passage.x2) / 2,
			z: (passage.z1 + passage.z2) / 2,
			rotationY: Math.atan2(dz, dx),
		};
	}

	if (passage.x1 !== passage.x2) {
		const sign = Math.sign(passage.x2 - passage.x1) || 1;
		const xStart = fromRoom.x + sign * (fromRoom.width / 2);
		const xEnd = toRoom.x - sign * (toRoom.width / 2);
		return {
			width: corridorLength,
			height: 0.1,
			depth: passageWidth,
			x: (xStart + xEnd) / 2,
			z: passage.z1,
			rotationY: 0,
		};
	}

	const sign = Math.sign(passage.z2 - passage.z1) || 1;
	const zStart = fromRoom.z + sign * (fromRoom.depth / 2);
	const zEnd = toRoom.z - sign * (toRoom.depth / 2);
	return {
		width: passageWidth,
		height: 0.1,
		depth: corridorLength,
		x: passage.x1,
		z: (zStart + zEnd) / 2,
		rotationY: 0,
	};
}

/**
 * Build all dungeon geometry (rooms, passages, ground) from a server layout.
 *
 * @param {THREE.Scene} scene
 * @param {object} layout - { rooms, passages } from server
 * @returns {{ meshes: THREE.Mesh[], spawnPosition: {x: number, z: number} }}
 */
export function buildDungeon(scene, layout) {
	if (!layout || !layout.rooms || !layout.passages) {
		return { meshes: [], spawnPosition: { x: 0, z: 0 } };
	}

	const meshes = [];
	const profileMaterials = getProfileMaterials(layout.profile);
	const {
		floor: profileFloorMaterial,
		wall: profileWallMaterial,
		passageFloor: profilePassageFloorMaterial,
		passageWall: profilePassageWallMaterial,
		roleFloors,
	} = profileMaterials;

	// Background ground (large flat plane behind everything)
	const groundGeo = new THREE.PlaneGeometry(200, 200);
	const ground = new THREE.Mesh(groundGeo, groundMaterial);
	ground.rotation.x = -Math.PI / 2;
	ground.position.y = GROUND_Y;
	scene.add(ground);
	meshes.push(ground);

	// Spawn position: center of the room with role 'start' (designated by server),
	// falling back to the first room, or { x: 0, z: 0 } if the layout is empty.
	const startRoom = layout.rooms.find(r => r.role === 'start');
	const spawnRoom = startRoom || (layout.rooms.length > 0 ? layout.rooms[0] : null);
	const spawnPosition = spawnRoom ? { x: spawnRoom.x, z: spawnRoom.z } : { x: 0, z: 0 };

	// ── Build rooms ──
	const isSpireAscent = layout.profile === 'spire-ascent';
	const isSunkenCanyon = layout.profile === 'sunken-canyon';
	const isIceCavern = layout.profile === 'ice-cavern';
	const isFireCavern = layout.profile === 'fire-cavern';
	const spireTierCount = isSpireAscent ? getSpireTierCount(layout) : 0;

	for (const room of layout.rooms) {
		const spireMats = isSpireAscent ? resolveSpireRoomMaterials(room, layout, spireTierCount) : null;
		const iceCavernMats = isIceCavern ? resolveIceCavernRoomMaterials(room) : null;
		const fireCavernMats = isFireCavern ? resolveFireCavernRoomMaterials(room, layout) : null;
		const entryMats = room.role === 'start' ? getEntryRoomMaterials(layout.profile) : null;
		// Pick floor material: spire tier/ramp, sunken-canyon/ice/fire band tints, else profile role fallback
		let floorMat;
		if (spireMats) {
			floorMat = spireMats.floor;
		} else if (isSunkenCanyon) {
			floorMat = resolveSunkenCanyonRoomFloorMaterial(room, layout);
		} else if (iceCavernMats) {
			floorMat = iceCavernMats.floor;
		} else if (fireCavernMats) {
			floorMat = fireCavernMats.floor;
		} else if (entryMats) {
			floorMat = entryMats.floor;
		} else {
			floorMat = roleFloors[room.role] || profileFloorMaterial;
		}
		floorMat = applySlipperyFloorOverride(floorMat, room.floorSurface);
		const roomWallMat = spireMats?.wall
			?? iceCavernMats?.wall
			?? fireCavernMats?.wall
			?? entryMats?.wall
			?? profileWallMaterial;

		// Room floor: flat (legacy or uniform corners) or sloped
		let floorMesh;
		if (isUniformFloor(room)) {
			const floorGeo = new THREE.BoxGeometry(room.width, 0.1, room.depth);
			floorMesh = new THREE.Mesh(floorGeo, floorMat);
			floorMesh.position.set(room.x, uniformFloorMeshY(room), room.z);
		} else {
			const { mesh } = buildSlopedFloor(room, floorMat);
			floorMesh = mesh;
		}
		scene.add(floorMesh);
		meshes.push(floorMesh);

		// Treasure room marker: summit beacon on spire-ascent, gold pillar elsewhere
		if (room.role === 'treasure') {
			if (layout.profile === 'spire-ascent') {
				for (const beaconMesh of buildSpireSummitBeacon(room, layout)) {
					scene.add(beaconMesh);
					meshes.push(beaconMesh);
				}
			} else {
				const treasureFloorY = resolveFloorY(sampleFloorY(layout, room.x, room.z));
				const markerGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 8);
				const marker = new THREE.Mesh(markerGeo, treasureMarkerMaterial);
				marker.position.set(room.x, 0.75 + treasureFloorY, room.z);
				scene.add(marker);
				meshes.push(marker);
			}
		}

		// Room walls
		for (const wall of room.walls) {
			let wallGeo;
			let wallX, wallZ;

			if (wall.axis === 'x') {
				wallGeo = new THREE.BoxGeometry(wall.length, WALL_HEIGHT, WALL_THICKNESS);
				wallX = wall.x;
				wallZ = wall.z;
			} else {
				wallGeo = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, wall.length);
				wallX = wall.x;
				wallZ = wall.z;
			}

			const wallBaseY = resolveFloorY(sampleFloorY(layout, wallX, wallZ));
			const wallMesh = new THREE.Mesh(wallGeo, roomWallMat);
			wallMesh.position.set(wallX, wallBaseY + WALL_HEIGHT / 2, wallZ);
			scene.add(wallMesh);
			meshes.push(wallMesh);
		}

		// Doorway markers on large rooms (after walls, before cover/landmarks)
		for (const marker of buildDoorwayMarkers(room, layout, profileMaterials)) {
			scene.add(marker);
			meshes.push(marker);
		}
	}

	// ── Entry-room decor (visual only; after room walls) ──
	const entryDecorMaterials = (() => {
		const entryMats = getEntryRoomMaterials(layout.profile);
		return {
			floor: entryMats?.floor ?? profileFloorMaterial,
			wall: entryMats?.wall ?? profileWallMaterial,
			accent: profileMaterials.accent,
		};
	})();
	for (const d of layout.entryDecor || []) {
		const decorGroup = buildEntryDecorMesh(d.type, entryDecorMaterials);
		const floorY = resolveFloorY(sampleFloorY(layout, d.x, d.z));
		decorGroup.position.set(d.x, floorY, d.z);
		if (d.yaw != null) decorGroup.rotation.y = d.yaw;
		scene.add(decorGroup);
		for (const child of decorGroup.children) {
			meshes.push(child);
		}
	}

	// ── Open-plaza perimeter decor (visual only; after perimeter walls) ──
	for (const d of layout.perimeterDecor || []) {
		const decorGroup = buildPerimeterDecorMesh(d.type, profileMaterials);
		const floorY = resolveFloorY(sampleFloorY(layout, d.x, d.z));
		decorGroup.position.set(d.x, floorY, d.z);
		if (d.yaw != null) decorGroup.rotation.y = d.yaw;
		scene.add(decorGroup);
		for (const child of decorGroup.children) {
			meshes.push(child);
		}
	}

	for (const hazard of layout.edgeHazards || []) {
		const hazardMesh = buildSpireEdgeHazardMesh(hazard);
		scene.add(hazardMesh);
		meshes.push(hazardMesh);
	}

	for (const lip of layout.cliffLips || []) {
		const lipMesh = buildCanyonCliffLipMesh(lip);
		scene.add(lipMesh);
		meshes.push(lipMesh);
	}

	// ── Build open-plaza platforms ──
	// Each platform is a gently sloped raised floor patch. It carries the same
	// { width, depth, floorCorners } fields a room needs, so reuse the room
	// sloped-floor builder. A distinguishable existing material keeps the raised
	// surface readable. Guarded by `|| []` so non-plaza layouts are unaffected.
	for (const platform of layout.platforms || []) {
		let platformMat = profilePassageFloorMaterial;
		if (isIceCavern && platform.band) {
			platformMat = getIceCavernBandMaterials(platform.band).floor;
		}
		platformMat = applySlipperyFloorOverride(platformMat, platform.floorSurface);
		const { mesh } = buildSlopedFloor(platform, platformMat);
		scene.add(mesh);
		meshes.push(mesh);
	}

	// ── Build floor markings (visual-only duel focal ring, etc.) ──
	for (const marking of layout.floorMarkings || []) {
		const markingMesh = buildFloorMarkingMesh(marking, profileMaterials);
		if (!markingMesh) continue;
		const floorY = resolveFloorY(sampleFloorY(layout, marking.x, marking.z));
		markingMesh.position.set(marking.x, floorY + 0.02, marking.z);
		scene.add(markingMesh);
		meshes.push(markingMesh);
	}

	// ── Build cover pieces (open-plaza: distinct mesh per type; others: single box) ──
	for (const c of layout.cover || []) {
		const floorY = resolveFloorY(sampleFloorY(layout, c.x, c.z));
		if (resolveProfileKey(layout.profile) === 'open-plaza') {
			const coverGroup = buildCoverMesh(c, profileWallMaterial);
			coverGroup.position.set(c.x, floorY, c.z);
			scene.add(coverGroup);
			for (const child of coverGroup.children) {
				meshes.push(child);
			}
		} else {
			const coverGeo = new THREE.BoxGeometry(c.width, c.height, c.depth);
			const coverMesh = new THREE.Mesh(coverGeo, profileWallMaterial);
			coverMesh.position.set(c.x, floorY + c.height / 2, c.z);
			scene.add(coverMesh);
			meshes.push(coverMesh);
		}
	}

	// ── Build hazard pits (visual recess only; no collision) ──
	const themeEntry = dungeonTheme.profiles[resolveProfileKey(layout.profile)]
		|| dungeonTheme.profiles.default;
	const hazardMaterial = new THREE.MeshStandardMaterial({
		color: darkenHex(themeEntry.floor),
		roughness: themeEntry.floorRoughness ?? 0.85,
	});
	for (const h of layout.hazards || []) {
		if (h.type !== 'pit') continue;
		const recess = h.pitDepth ?? 0.12;
		const floorY = resolveFloorY(sampleFloorY(layout, h.x, h.z));
		const hazardGeo = new THREE.BoxGeometry(h.width, recess, h.depth);
		const hazardMesh = new THREE.Mesh(hazardGeo, hazardMaterial);
		hazardMesh.position.set(h.x, floorY - recess / 2, h.z);
		scene.add(hazardMesh);
		meshes.push(hazardMesh);
	}

	// ── Build profile landmarks (visual identity only; no collision) ──
	for (const lm of layout.landmarks || []) {
		const landmarkGroup = buildLandmarkMesh(lm.type, profileMaterials);
		const floorY = resolveFloorY(sampleFloorY(layout, lm.x, lm.z));
		landmarkGroup.position.set(lm.x, floorY, lm.z);
		if (lm.yaw != null) landmarkGroup.rotation.y = lm.yaw;
		scene.add(landmarkGroup);
		for (const child of landmarkGroup.children) {
			meshes.push(child);
		}
	}

	// ── Build passages ──
	for (const passage of layout.passages) {
		const floorSpec = buildPassageFloorSpec(passage, layout);
		const passageFloorGeo = new THREE.BoxGeometry(floorSpec.width, floorSpec.height, floorSpec.depth);
		const passageFloor = new THREE.Mesh(passageFloorGeo, profilePassageFloorMaterial);
		passageFloor.position.set(floorSpec.x, FLOOR_Y, floorSpec.z);
		passageFloor.rotation.y = floorSpec.rotationY;
		scene.add(passageFloor);
		meshes.push(passageFloor);

		// Passage side walls
		for (const wall of passage.walls) {
			let wallGeo;
			let wallX, wallZ;

			if (wall.axis === 'x') {
				wallGeo = new THREE.BoxGeometry(wall.length, PASSAGE_WALL_HEIGHT, PASSAGE_WALL_THICKNESS);
				wallX = wall.x;
				wallZ = wall.z;
			} else {
				wallGeo = new THREE.BoxGeometry(PASSAGE_WALL_THICKNESS, PASSAGE_WALL_HEIGHT, wall.length);
				wallX = wall.x;
				wallZ = wall.z;
			}

			const wallBaseY = resolveFloorY(sampleFloorY(layout, wallX, wallZ));
			const wallMesh = new THREE.Mesh(wallGeo, profilePassageWallMaterial);
			wallMesh.position.set(wallX, wallBaseY + PASSAGE_WALL_HEIGHT / 2, wallZ);
			scene.add(wallMesh);
			meshes.push(wallMesh);
		}
	}

	// ── Build hub booth signage (kiosk + floating name sign per anchor) ──
	if (layout.profile === 'hub' && layout.boothAnchors) {
		for (const obj of buildHubBoothSigns(layout.boothAnchors, FLOOR_Y)) {
			scene.add(obj);
			meshes.push(obj);
		}
	}

	return { meshes, spawnPosition };
}

const PASSAGE_LOCK_BARRIER_DEPTH = 1.0;

/**
 * Build a themed energy gate spanning a locked passage doorway gap.
 * Position and footprint match {@link computePassageBarrierAABBs} collider math.
 *
 * @param {object} layout
 * @param {number} passageIndex
 * @param {{ accent: THREE.MeshStandardMaterial, passageWall: THREE.MeshStandardMaterial }} materials
 * @returns {THREE.Group|null}
 */
export function buildPassageGateMesh(layout, passageIndex, materials) {
	if (!layout?.passages?.[passageIndex] || !materials) return null;

	const passage = layout.passages[passageIndex];
	const passageWidth = layout.passageWidth ?? PASSAGE_WIDTH;
	const gapW = passageWidth + 0.5;
	const dx = passage.x2 - passage.x1;
	const dz = passage.z2 - passage.z1;
	const alongX = Math.abs(dx) >= Math.abs(dz);

	const midX = alongX ? (passage.x1 + passage.x2) / 2 : passage.x1;
	const midZ = alongX ? passage.z1 : (passage.z1 + passage.z2) / 2;
	const gateHeight = PASSAGE_WALL_HEIGHT;

	const group = new THREE.Group();
	group.userData.isPassageGate = true;
	group.userData.passageIndex = passageIndex;

	const accentMat = materials.accent;
	const frameColor = materials.passageWall?.color ?? accentMat.color;
	const fieldMat = new THREE.MeshStandardMaterial({
		color: accentMat.color,
		emissive: accentMat.emissive,
		emissiveIntensity: 0.85,
		transparent: true,
		opacity: 0.55,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	const frameMat = new THREE.MeshStandardMaterial({
		color: frameColor,
		emissive: accentMat.emissive,
		emissiveIntensity: 0.35,
		roughness: 0.5,
	});

	let fieldGeo;
	let frameGeo;
	if (alongX) {
		fieldGeo = new THREE.BoxGeometry(PASSAGE_LOCK_BARRIER_DEPTH * 0.65, gateHeight * 0.92, gapW * 0.96);
		frameGeo = new THREE.BoxGeometry(PASSAGE_LOCK_BARRIER_DEPTH, gateHeight, gapW);
	} else {
		fieldGeo = new THREE.BoxGeometry(gapW * 0.96, gateHeight * 0.92, PASSAGE_LOCK_BARRIER_DEPTH * 0.65);
		frameGeo = new THREE.BoxGeometry(gapW, gateHeight, PASSAGE_LOCK_BARRIER_DEPTH);
	}

	const frame = new THREE.Mesh(frameGeo, frameMat);
	const field = new THREE.Mesh(fieldGeo, fieldMat);
	frame.userData.isPassageGatePart = true;
	field.userData.isPassageGatePart = true;
	group.add(frame);
	group.add(field);

	group.position.set(midX, FLOOR_Y + gateHeight / 2, midZ);
	return group;
}

/**
 * World-space center of a passage gate mesh (for unlock VFX when no live mesh).
 * @param {object} layout
 * @param {number} passageIndex
 * @returns {{ x: number, y: number, z: number }|null}
 */
export function getPassageGateWorldPosition(layout, passageIndex) {
	if (!layout?.passages?.[passageIndex]) return null;

	const passage = layout.passages[passageIndex];
	const dx = passage.x2 - passage.x1;
	const dz = passage.z2 - passage.z1;
	const alongX = Math.abs(dx) >= Math.abs(dz);
	const midX = alongX ? (passage.x1 + passage.x2) / 2 : passage.x1;
	const midZ = alongX ? passage.z1 : (passage.z1 + passage.z2) / 2;
	const gateHeight = PASSAGE_WALL_HEIGHT;

	return { x: midX, y: FLOOR_Y + gateHeight / 2, z: midZ };
}

function footprintToAABB(footprint) {
	return {
		minX: footprint.x - footprint.width / 2,
		maxX: footprint.x + footprint.width / 2,
		minZ: footprint.z - footprint.depth / 2,
		maxZ: footprint.z + footprint.depth / 2,
	};
}

/**
 * Compute a full-gap doorway barrier AABB for a locked passage index.
 * Mirrors server/simulation.js so client prediction matches authoritative movement.
 */
export function computePassageBarrierAABBs(layout, passageIndex) {
	if (!layout?.passages?.[passageIndex]) return [];

	const passage = layout.passages[passageIndex];
	const passageWidth = layout.passageWidth ?? 4;
	const gapW = passageWidth + 0.5;
	const dx = passage.x2 - passage.x1;
	const dz = passage.z2 - passage.z1;

	if (Math.abs(dx) >= Math.abs(dz)) {
		return [footprintToAABB({
			x: (passage.x1 + passage.x2) / 2,
			z: passage.z1,
			width: PASSAGE_LOCK_BARRIER_DEPTH,
			depth: gapW,
		})];
	}

	return [footprintToAABB({
		x: passage.x1,
		z: (passage.z1 + passage.z2) / 2,
		width: gapW,
		depth: PASSAGE_LOCK_BARRIER_DEPTH,
	})];
}

function collectLockedPassageBarrierAABBs(layout, passageLocks = []) {
	const colliders = [];
	if (!layout || !Array.isArray(passageLocks)) return colliders;

	for (const lock of passageLocks) {
		if (!lock?.locked) continue;
		colliders.push(...computePassageBarrierAABBs(layout, lock.passageIndex));
	}
	return colliders;
}

/**
 * Build an array of wall AABB colliders from a server layout.
 *
 * @param {object} layout - { rooms, passages } from server
 * @param {object[]} [passageLocks] - Optional run.passageLocks runtime state
 * @returns {{ minX: number, maxX: number, minZ: number, maxZ: number }[]}
 */
export function buildWallColliders(layout, passageLocks = []) {
	const colliders = [];
	if (!layout || !layout.rooms || !layout.passages) return colliders;

	for (const room of layout.rooms) {
		for (const wall of room.walls) {
			colliders.push(wallAABB(wall, WALL_THICKNESS / 2));
		}
	}
	for (const passage of layout.passages) {
		for (const wall of passage.walls) {
			colliders.push(wallAABB(wall, PASSAGE_WALL_THICKNESS / 2));
		}
	}

	// Open-plaza cover pieces are solid obstacles. Push an AABB for each footprint
	// matching the server's collider (see server simulation.js) so client-side
	// prediction stops the player at cover. Guarded by `|| []` for other layouts.
	for (const c of layout.cover || []) {
		colliders.push({
			minX: c.x - c.width / 2,
			maxX: c.x + c.width / 2,
			minZ: c.z - c.depth / 2,
			maxZ: c.z + c.depth / 2,
		});
	}

	colliders.push(...collectLockedPassageBarrierAABBs(layout, passageLocks));

	return colliders;
}

/**
 * Compute dungeon AABB bounds from layout rooms.
 * @param {object} layout
 */
export function computeDungeonBounds(layout) {
	let minX = Infinity;
	let maxX = -Infinity;
	let minZ = Infinity;
	let maxZ = -Infinity;

	if (!layout || !layout.rooms) {
		return { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
	}

	for (const room of layout.rooms) {
		const halfW = room.width / 2;
		const halfD = room.depth / 2;
		minX = Math.min(minX, room.x - halfW);
		maxX = Math.max(maxX, room.x + halfW);
		minZ = Math.min(minZ, room.z - halfD);
		maxZ = Math.max(maxZ, room.z + halfD);
	}

	return {
		minX: minX - BOUNDS_MARGIN,
		maxX: maxX + BOUNDS_MARGIN,
		minZ: minZ - BOUNDS_MARGIN,
		maxZ: maxZ + BOUNDS_MARGIN,
	};
}

/**
 * Compute walkable AABBs from the dungeon layout.
 * @param {object} layout
 */
export function computeWalkableAABBs(layout) {
	const aabbs = [];
	if (!layout) return aabbs;

	if (layout.rooms) {
		for (const room of layout.rooms) {
			const halfW = room.width / 2;
			const halfD = room.depth / 2;
			aabbs.push({
				minX: room.x - halfW,
				maxX: room.x + halfW,
				minZ: room.z - halfD,
				maxZ: room.z + halfD,
			});
		}
	}

	if (layout.passages) {
		const halfGap = (layout.passageWidth ?? PASSAGE_WIDTH) / 2;
		for (const p of layout.passages) {
			aabbs.push({
				minX: Math.min(p.x1, p.x2) - halfGap,
				maxX: Math.max(p.x1, p.x2) + halfGap,
				minZ: Math.min(p.z1, p.z2) - halfGap,
				maxZ: Math.max(p.z1, p.z2) + halfGap,
			});
		}
	}

	return aabbs;
}

/**
 * Resolve a proposed player position against a list of wall AABB colliders.
 */
export function resolveWallCollision(newX, newZ, collidersRef, fromX = newX, fromZ = newZ) {
	return resolveWallCollisionPure(newX, newZ, collidersRef, fromX, fromZ);
}

export function checkSweptCollision(fromX, fromZ, toX, toZ, collidersRef, options = {}) {
	return checkSweptCollisionPure(fromX, fromZ, toX, toZ, collidersRef, options);
}

export function tryPlayerMove(fromX, fromZ, dirX, dirZ, distance, collidersRef, walkableAABBsRef, bounds) {
	return tryPlayerMovePure(fromX, fromZ, dirX, dirZ, distance, collidersRef, walkableAABBsRef, bounds);
}

export function isPositionBlocked(x, z, collidersRef) {
	return isPositionBlockedPure(x, z, collidersRef);
}

export function isInsideDungeon(x, z, walkableAABBs) {
	return isInsideDungeonPure(x, z, walkableAABBs);
}

export function clampToDungeon(x, z, bounds) {
	return clampToDungeonPure(x, z, bounds);
}
