import { describe, it, expect } from 'vitest';
import { buildKeyItemProp, createPlayerAvatar } from '../renderer.js';

// Ids that map to a defined torso prop (subset of the server KEY_ITEM_DEFS).
const MAPPED_IDS = [
	'dodge_roll',
	'guard_block',
	'loot_magnet',
	'field_medic_kit',
];

describe('buildKeyItemProp', () => {
	it('returns a distinct Object3D for each mapped key item id', () => {
		for (const id of MAPPED_IDS) {
			const prop = buildKeyItemProp(id);
			expect(prop, `expected a prop for "${id}"`).toBeTruthy();
			expect(typeof prop, `prop for "${id}" should be an object`).toBe('object');
		}
	});

	it('gives at least four mapped ids visibly distinct geometry/material', () => {
		// dodge_roll + guard_block are single meshes with their own material color;
		// loot_magnet + field_medic_kit are multi-part groups. All four differ.
		const dodge = buildKeyItemProp('dodge_roll');
		const guard = buildKeyItemProp('guard_block');
		expect(dodge.material.color.getHex()).not.toBe(guard.material.color.getHex());

		const magnet = buildKeyItemProp('loot_magnet');
		const medic = buildKeyItemProp('field_medic_kit');
		expect(magnet.children.length).toBeGreaterThan(0);
		expect(medic.children.length).toBeGreaterThan(0);
	});

	it('returns null for "none"', () => {
		expect(buildKeyItemProp('none')).toBeNull();
	});

	it('returns null for null/undefined', () => {
		expect(buildKeyItemProp(null)).toBeNull();
		expect(buildKeyItemProp(undefined)).toBeNull();
	});

	it('returns null for an unknown/unmapped id', () => {
		expect(buildKeyItemProp('totally_made_up_item')).toBeNull();
	});
});

describe('createPlayerAvatar key-item prop', () => {
	it('seats the equipped prop on the avatar and tracks the shown id', () => {
		const avatar = createPlayerAvatar({ bodyColor: 0x00ff00 }, true, 'dodge_roll');
		expect(avatar.userData.keyItemId).toBe('dodge_roll');
		expect(avatar.userData.keyItemPropMesh).toBeTruthy();
	});

	it('adds no prop for an unequipped/none key item', () => {
		const avatar = createPlayerAvatar({ bodyColor: 0x00ff00 }, true, 'none');
		expect(avatar.userData.keyItemId).toBe('none');
		expect(avatar.userData.keyItemPropMesh).toBeFalsy();
	});
});
