import { describe, it, expect } from 'vitest';
import { buildHubBoothSigns } from '../boothSigns.js';
import { BOOTH_DISPLAY_NAMES } from '../boothPrompt.js';
import { generateHub } from '../../server/dungeon.js';

// Unit-tests the hub booth signage builder. Each known anchor yields a kiosk
// mesh + a floating text-sign sprite; unknown ids and bad anchors are skipped.
// Runs under jsdom + the shared three mock (see test/__mocks__/three.js); the
// no-op 2D canvas context comes from test/setup.js.
describe('hub booth signage', () => {
	const FLOOR_Y = 0.05;

	/** Pull the sign sprites (carry userData.label) out of the flat result. */
	function signsOf(objects) {
		return objects.filter(o => o.userData && o.userData.label !== undefined);
	}
	/** Pull the kiosk meshes out of the flat result. */
	function kiosksOf(objects) {
		return objects.filter(o => o.isMesh);
	}

	it('builds one kiosk + one sign per known anchor from generateHub', () => {
		const { boothAnchors } = generateHub();
		const objects = buildHubBoothSigns(boothAnchors, FLOOR_Y);

		const knownCount = Object.keys(boothAnchors).filter(
			id => BOOTH_DISPLAY_NAMES[id]
		).length;
		expect(knownCount).toBe(6);

		expect(signsOf(objects)).toHaveLength(knownCount);
		expect(kiosksOf(objects)).toHaveLength(knownCount);
		// Flat array: a kiosk + a sprite for each booth.
		expect(objects).toHaveLength(knownCount * 2);
	});

	it('sets each sign text to the BOOTH_DISPLAY_NAMES value', () => {
		const { boothAnchors } = generateHub();
		const objects = buildHubBoothSigns(boothAnchors, FLOOR_Y);

		for (const sign of signsOf(objects)) {
			const expected = BOOTH_DISPLAY_NAMES[sign.userData.boothId];
			expect(expected).toBeTruthy();
			expect(sign.userData.label).toBe(expected);
		}
		// Spot-check a couple of the human-readable names.
		const byId = Object.fromEntries(
			signsOf(objects).map(s => [s.userData.boothId, s.userData.label])
		);
		expect(byId.quest).toBe('Quest Board');
		expect(byId.deck).toBe('Deck Editor');
	});

	it('positions kiosk + sign at the anchor x/z with the sign above the kiosk', () => {
		const anchors = { quest: { x: 4, z: -7 } };
		const objects = buildHubBoothSigns(anchors, FLOOR_Y);
		const [kiosk, sign] = objects;

		expect(kiosk.position.x).toBe(4);
		expect(kiosk.position.z).toBe(-7);
		expect(sign.position.x).toBe(4);
		expect(sign.position.z).toBe(-7);
		// Both rest on the supplied floor; sign floats above the kiosk.
		expect(kiosk.position.y).toBeGreaterThan(FLOOR_Y);
		expect(sign.position.y).toBeGreaterThan(kiosk.position.y);
	});

	it('skips anchor ids not present in BOOTH_DISPLAY_NAMES', () => {
		const anchors = {
			quest: { x: 1, z: 1 },
			mystery: { x: 2, z: 2 },
			vendor: { x: 3, z: 3 },
		};
		const objects = buildHubBoothSigns(anchors, FLOOR_Y);
		const ids = signsOf(objects).map(s => s.userData.boothId);
		expect(ids).toEqual(['quest']);
	});

	it('skips anchors with non-finite x/z', () => {
		const anchors = {
			quest: { x: NaN, z: 0 },
			shop: { x: 0, z: Infinity },
			deck: { x: 5, z: 5 },
		};
		const objects = buildHubBoothSigns(anchors, FLOOR_Y);
		const ids = signsOf(objects).map(s => s.userData.boothId);
		expect(ids).toEqual(['deck']);
	});

	it('returns an empty array for missing/empty/null anchors', () => {
		expect(buildHubBoothSigns(null, FLOOR_Y)).toEqual([]);
		expect(buildHubBoothSigns(undefined, FLOOR_Y)).toEqual([]);
		expect(buildHubBoothSigns({}, FLOOR_Y)).toEqual([]);
	});

	it('defaults floorY when omitted (no throw)', () => {
		const objects = buildHubBoothSigns({ shop: { x: 0, z: 0 } });
		expect(signsOf(objects)).toHaveLength(1);
		expect(kiosksOf(objects)).toHaveLength(1);
	});
});
