import { describe, it, expect, beforeEach } from 'vitest';
import { wallAABB, resolveWallCollision, tryPlayerMove, isPositionBlocked, checkSweptCollision } from '../collision.js';
import { drawCard, initHand, initHandFromDeck, resetHandState, canUseSlot, hand, deck, slotCooldowns } from '../hand.js';

// ── wallAABB ──

describe('wallAABB()', () => {
	it('returns correct bounds for an x-axis wall', () => {
		const wall = { axis: 'x', x: 0, z: 0, length: 10 };
		const aabb = wallAABB(wall, 0.2);

		expect(aabb).toEqual({
			minX: -5.2,
			maxX: 5.2,
			minZ: -0.2,
			maxZ: 0.2,
		});
	});

	it('returns correct bounds for a z-axis wall', () => {
		const wall = { axis: 'z', x: 0, z: 0, length: 8 };
		const aabb = wallAABB(wall, 0.2);

		expect(aabb).toEqual({
			minX: -0.2,
			maxX: 0.2,
			minZ: -4.2,
			maxZ: 4.2,
		});
	});

	it('handles offset positions for x-axis wall', () => {
		const wall = { axis: 'x', x: 5, z: 3, length: 6 };
		const aabb = wallAABB(wall, 0.3);

		expect(aabb).toEqual({
			minX: 5 - 3 - 0.3,
			maxX: 5 + 3 + 0.3,
			minZ: 3 - 0.3,
			maxZ: 3 + 0.3,
		});
	});

	it('handles offset positions for z-axis wall', () => {
		const wall = { axis: 'z', x: 5, z: 3, length: 6 };
		const aabb = wallAABB(wall, 0.3);

		expect(aabb).toEqual({
			minX: 5 - 0.3,
			maxX: 5 + 0.3,
			minZ: 3 - 3 - 0.3,
			maxZ: 3 + 3 + 0.3,
		});
	});
});

// ── resolveWallCollision ──

describe('resolveWallCollision()', () => {
	it('returns unchanged position when there is no collision', () => {
		const colliders = [
			{ minX: 10, maxX: 12, minZ: 10, maxZ: 12 },
		];
		const result = resolveWallCollision(0, 0, colliders);

		expect(result).toEqual({ x: 0, z: 0 });
	});

	it('pushes player back along X axis when overlapping a wall from the left', () => {
		// Wall at x=[0, 2], z=[-1, 1]; player at x=0.3, z=0 (inside wall)
		const colliders = [
			{ minX: 0, maxX: 2, minZ: -1, maxZ: 1 },
		];
		const result = resolveWallCollision(0.3, 0, colliders);

		// Player center 0.3, radius 0.5 → pMinX = -0.2, pMaxX = 0.8
		// overlapX = min(0.8-0, 2-(-0.2)) = min(0.8, 2.2) = 0.8
		// overlapZ = min(0.5-(-1), 1-(-0.5)) = min(1.5, 1.5) = 1.5
		// overlapX < overlapZ, so push on X
		// centerX = 0.3, wallCX = 1, centerX < wallCX → resolvedX = 0.3 - 0.8 = -0.5
		expect(result.x).toBeCloseTo(-0.5);
		expect(result.z).toBe(0);
	});

	it('pushes player back along Z axis when Z penetration is smaller', () => {
		// Thin wall along Z; player barely inside from the top
		const colliders = [
			{ minX: -1, maxX: 1, minZ: 0, maxZ: 2 },
		];
		// Player at (0, 0.3) — player box Z: [-0.2, 0.8], wall Z: [0, 2]
		const result = resolveWallCollision(0, 0.3, colliders);

		// overlapX = min(0.5-(-1), 1-(-0.5)) = min(1.5, 1.5) = 1.5
		// overlapZ = min(0.8-0, 2-(-0.2)) = min(0.8, 2.2) = 0.8
		// overlapZ < overlapX, push on Z
		// centerZ = 0.3, wallCZ = 1, centerZ < wallCZ → resolvedZ = 0.3 - 0.8 = -0.5
		expect(result.x).toBe(0);
		expect(result.z).toBeCloseTo(-0.5);
	});

	it('handles multiple colliders and picks the one with least penetration', () => {
		const colliders = [
			{ minX: -1, maxX: 1, minZ: -1, maxZ: 1 }, // big wall centered at origin
		];
		// Player at (0.6, 0) — barely inside the right edge
		const result = resolveWallCollision(0.6, 0, colliders);

		// pMinX = 0.1, pMaxX = 1.1, wall maxX = 1 → overlapX = min(1.1-(-1), 1-0.1) = min(2.1, 0.9) = 0.9
		// pMinZ = -0.5, pMaxZ = 0.5, wall Z = [-1,1] → overlapZ = min(0.5-(-1), 1-(-0.5)) = min(1.5, 1.5) = 1.5
		// overlapX < overlapZ, push on X
		// centerX = 0.6, wallCX = 0, centerX > wallCX → resolvedX = 0.6 + 0.9 = 1.5
		expect(result.x).toBeCloseTo(1.5);
		expect(result.z).toBe(0);
	});

	it('player exactly on wall edge is not pushed', () => {
		const colliders = [
			{ minX: 0, maxX: 2, minZ: -1, maxZ: 1 },
		];
		// Player at x = -0.5 (right edge of player box touches x=0)
		const result = resolveWallCollision(-0.5, 0, colliders);

		// pMaxX = 0, wall minX = 0 → no overlap (pMaxX <= w.minX)
		expect(result).toEqual({ x: -0.5, z: 0 });
	});

	it('performs a secondary push-out when the first wall resolution overlaps another wall', () => {
		const colliders = [
			{ minX: 0, maxX: 2, minZ: -1, maxZ: 1 },
			{ minX: -1, maxX: 1, minZ: 0, maxZ: 2 },
		];

		const result = resolveWallCollision(0.3, 0, colliders);

		expect(result.x).toBeCloseTo(-0.5);
		expect(result.z).toBeCloseTo(-0.5);
	});
});

describe('tryPlayerMove()', () => {
	const wall = { minX: 0, maxX: 2, minZ: -1, maxZ: 1 };
	const colliders = [wall];
	const walkable = [{ minX: -5, maxX: 5, minZ: -5, maxZ: 5 }];
	const bounds = { minX: -5, maxX: 5, minZ: -5, maxZ: 5 };

	it('slides along a wall when direct movement is blocked', () => {
		const invSqrt2 = 1 / Math.SQRT2;
		const distance = 0.5;
		const result = tryPlayerMove(-0.5, 0, invSqrt2, invSqrt2, distance, colliders, walkable, bounds);
		expect(result.moved).toBe(true);
		expect(result.x).toBeCloseTo(-0.5);
		expect(result.z).toBeCloseTo(invSqrt2 * distance);
		expect(result.x).not.toBeCloseTo(-0.5 + invSqrt2 * distance);
	});

	it('stops at a wall when moving directly into it', () => {
		const result = tryPlayerMove(-1.5, 0, 1, 0, 1, colliders, walkable, bounds);
		expect(result.moved).toBe(true);
		expect(result.x).toBeCloseTo(-0.5);
		expect(result.z).toBe(0);
	});

	it('returns unchanged position when blocked at a wall edge', () => {
		const result = tryPlayerMove(-0.5, 0, 1, 0, 1, colliders, walkable, bounds);
		expect(result.moved).toBe(false);
		expect(result.x).toBeCloseTo(-0.5);
		expect(result.z).toBe(0);
	});

	it('depenetrates and stays put when already inside a wall and moving deeper into it', () => {
		const result = tryPlayerMove(0.3, 0, 1, 0, 1, colliders, walkable, bounds);
		expect(result.moved).toBe(false);
		expect(result.x).toBeCloseTo(-0.5);
		expect(result.z).toBe(0);
	});
});

describe('isPositionBlocked()', () => {
	it('detects overlap with a wall collider', () => {
		const colliders = [{ minX: 0, maxX: 2, minZ: -1, maxZ: 1 }];
		expect(isPositionBlocked(0.3, 0, colliders)).toBe(true);
		expect(isPositionBlocked(-0.5, 0, colliders)).toBe(false);
	});
});

describe('checkSweptCollision()', () => {
	const collider = { minX: 1.5, maxX: 2.5, minZ: -0.5, maxZ: 0.5 };

	it('allows endpoint touches when allowEndpointTouch is false', () => {
		expect(checkSweptCollision(0, 0, 1, 0, [collider])).toBe(false);
	});

	it('allows endpoint touches when allowEndpointTouch is true', () => {
		expect(checkSweptCollision(0, 0, 1, 0, [collider], { allowEndpointTouch: true })).toBe(false);
	});

	it('blocks movement that penetrates the expanded wall shell', () => {
		expect(checkSweptCollision(0, 0, 1.01, 0, [collider], { allowEndpointTouch: true })).toBe(true);
	});
});

// ── drawCard ──

describe('drawCard()', () => {
	beforeEach(() => {
		resetHandState();
	});

	it('returns null when the deck is empty', () => {
		expect(drawCard()).toBeNull();
	});

	it('pops a card from the deck and sets charges to the def max', () => {
		// Manually seed the deck
		deck.push('iron_sword');
		const card = drawCard();

		expect(card).not.toBeNull();
		expect(card.id).toBe('iron_sword');
		expect(card.charges).toBe(5);
		expect(card.remainingCharges).toBe(5);
		expect(deck.length).toBe(0);
	});

	it('returns null for an unknown card id in the deck', () => {
		deck.push('nonexistent_card');
		expect(drawCard()).toBeNull();
	});

	it('draws cards in LIFO order (last pushed is first drawn)', () => {
		deck.push('iron_sword');
		deck.push('flame_blade');
		const first = drawCard();
		const second = drawCard();

		expect(first.id).toBe('flame_blade');
		expect(second.id).toBe('iron_sword');
	});

	it('sets remainingCharges equal to charges (full charge on draw)', () => {
		deck.push('battle_familiar');
		const card = drawCard();

		expect(card.remainingCharges).toBe(card.charges);
		expect(card.charges).toBe(1);
	});

	it('includes magicStoneCost on summon cards when defined in CARD_DEFS', () => {
		deck.push('battle_familiar');
		const card = drawCard();

		expect(card.magicStoneCost).toBe(50);
	});

	it('does not include magicStoneCost on non-summon cards', () => {
		deck.push('iron_sword');
		const card = drawCard();

		expect(card.magicStoneCost).toBeUndefined();
	});
});

// ── initHand ──

describe('initHand()', () => {
	beforeEach(() => {
		resetHandState();
	});

	it('builds a 4-card hand', () => {
		initHand();
		expect(hand).toHaveLength(4);
	});

	it('leaves the remaining 4 cards in the deck', () => {
		initHand();
		expect(deck).toHaveLength(4);
	});

	it('each hand card has remainingCharges equal to its def max', () => {
		initHand();
		for (const card of hand) {
			expect(card.remainingCharges).toBe(card.charges);
		}
	});

	it('hand + deck together account for all 8 starting cards', () => {
		initHand();
		expect(hand.length + deck.length).toBe(8);
	});

	it('resets slotCooldowns to all false', () => {
		// Mutate slotCooldowns first, then verify initHand resets them
		slotCooldowns[0] = true;
		slotCooldowns[2] = true;
		initHand();
		expect(slotCooldowns[0]).toBe(false);
		expect(slotCooldowns[1]).toBe(false);
		expect(slotCooldowns[2]).toBe(false);
		expect(slotCooldowns[3]).toBe(false);
	});

	it('invokes the onRender callback if provided', () => {
		resetHandState();
		let callbackCalled = false;
		initHand(() => { callbackCalled = true; });
		expect(callbackCalled).toBe(true);
	});

	it('does not invoke onRender if it is not a function', () => {
		resetHandState();
		// initHand with undefined should not throw
		expect(() => initHand(undefined)).not.toThrow();
	});
});

// ── initHandFromDeck ──

describe('initHandFromDeck()', () => {
	beforeEach(() => {
		resetHandState();
	});

	it('produces a hand of 4 cards and a remaining deck from a known server deck', () => {
		const serverDeck = ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake', 'iron_sword'];
		initHandFromDeck(serverDeck, null);

		expect(hand).toHaveLength(4);
		expect(deck).toHaveLength(1);
		expect(deck[0]).toBe('iron_sword');
	});

	it('deals cards in server deck order (first 4 become the hand)', () => {
		const serverDeck = ['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake', 'iron_sword'];
		initHandFromDeck(serverDeck, null);

		expect(hand[0].id).toBe('iron_sword');
		expect(hand[1].id).toBe('flame_blade');
		expect(hand[2].id).toBe('battle_familiar');
		expect(hand[3].id).toBe('dungeon_drake');
	});

	it('falls back to createStartingDeck() when serverDeck is null', () => {
		initHandFromDeck(null, null);

		expect(hand).toHaveLength(4);
		expect(hand.length + deck.length).toBe(8);
	});

	it('falls back to createStartingDeck() when serverDeck is undefined', () => {
		initHandFromDeck(undefined, null);

		expect(hand).toHaveLength(4);
		expect(hand.length + deck.length).toBe(8);
	});

	it('falls back to createStartingDeck() when serverDeck is an empty array', () => {
		initHandFromDeck([], null);

		expect(hand).toHaveLength(4);
		expect(hand.length + deck.length).toBe(8);
	});

	it('resets slotCooldowns to all false', () => {
		slotCooldowns[0] = true;
		slotCooldowns[2] = true;
		initHandFromDeck(['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'], null);

		expect(slotCooldowns).toEqual([false, false, false, false]);
	});

	it('invokes the onRender callback if provided', () => {
		resetHandState();
		let callbackCalled = false;
		initHandFromDeck(['iron_sword', 'flame_blade', 'battle_familiar', 'dungeon_drake'], () => { callbackCalled = true; });
		expect(callbackCalled).toBe(true);
	});

	it('handles a deck with fewer than 4 cards gracefully', () => {
		initHandFromDeck(['iron_sword', 'flame_blade'], null);

		expect(hand).toHaveLength(2);
		expect(deck).toHaveLength(0);
	});
});

// ── canUseSlot ──

describe('canUseSlot()', () => {
	beforeEach(() => {
		resetHandState();
	});

	it('returns false for slot indices outside 0–3', () => {
		expect(canUseSlot(-1)).toBe(false);
		expect(canUseSlot(4)).toBe(false);
		expect(canUseSlot(100)).toBe(false);
	});

	it('returns false when hand slot is null', () => {
		hand[0] = null;
		expect(canUseSlot(0)).toBe(false);
	});

	it('returns false when hand slot is undefined', () => {
		// hand is empty after resetHandState
		expect(canUseSlot(0)).toBe(false);
	});

	it('returns false when slot is in cooldown', () => {
		deck.push('iron_sword');
		const card = drawCard();
		if (card) hand.push(card);
		slotCooldowns[0] = true;

		expect(canUseSlot(0)).toBe(false);
	});

	it('returns true when slot is in-range, has a card, and not cooling down', () => {
		deck.push('iron_sword');
		const card = drawCard();
		if (card) hand.push(card);

		expect(canUseSlot(0)).toBe(true);
	});

	it('returns true for all four valid slots after initHand', () => {
		initHand();

		expect(canUseSlot(0)).toBe(true);
		expect(canUseSlot(1)).toBe(true);
		expect(canUseSlot(2)).toBe(true);
		expect(canUseSlot(3)).toBe(true);
	});

	it('is pure — calling it does not mutate hand or slotCooldowns', () => {
		initHand();
		const handBefore = JSON.parse(JSON.stringify(hand));
		const cooldownsBefore = [...slotCooldowns];

		canUseSlot(0);
		canUseSlot(2);

		expect(hand).toEqual(handBefore);
		expect(slotCooldowns).toEqual(cooldownsBefore);
	});
});
