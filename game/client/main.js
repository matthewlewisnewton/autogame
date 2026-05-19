import * as THREE from 'three';
import { io } from 'socket.io-client';
import { CARD_DEFS, CARD_TYPE_STYLE, weaponCardIds, summonCardIds, monsterCardIds } from './cards.js';
import { drawCard, initHand as initHandFromModule, initHandFromDeck, hand, slotCooldowns, canUseSlot } from './hand.js';
import {
	buildDungeon,
	clearDungeon,
	buildWallColliders,
	resolveWallCollision as resolveWallCollisionFromDungeon,
	WALL_HEIGHT,
	WALL_THICKNESS,
	FLOOR_Y,
	PASSAGE_WALL_HEIGHT,
	PASSAGE_WALL_THICKNESS,
	floorMaterial,
	wallMaterial,
	passageFloorMaterial,
	groundMaterial,
} from './dungeon.js';

// v8 ignore start
// All code below is UI/Three.js/Socket-dependent and cannot be unit tested.
// Testable logic is extracted to cards.js, collision.js, and hand.js.

const statusEl = document.getElementById('status');
const lobbyPlayerList = document.getElementById('lobby-player-list');
const readyBtn = document.getElementById('ready-btn');
const lobbyEl = document.getElementById('lobby');
const uiEl = document.getElementById('ui');
const cardHandEl = document.getElementById('card-hand');
const hpBarFill = document.getElementById('hp-bar-fill');
const hpText = document.getElementById('hp-text');
const hpLabel = document.getElementById('hp-label');
const msBarFill = document.getElementById('ms-bar-fill');
const msText = document.getElementById('ms-text');
const msLabel = document.getElementById('ms-label');
const objectiveHudEl = document.getElementById('objective-hud');
const runSummaryOverlay = document.getElementById('run-summary-overlay');
const summaryStatusEl = document.getElementById('summary-status');
const summaryDurationEl = document.getElementById('summary-duration');
const summaryEnemiesEl = document.getElementById('summary-enemies');
const summaryCurrencyEl = document.getElementById('summary-currency');
const summaryRewardsCurrencyEl = document.getElementById('summary-rewards-currency');
const summaryRewardsCardsEl = document.getElementById('summary-rewards-cards');
const returnToLobbyBtn = document.getElementById('return-to-lobby-btn');
const cardSlots = document.querySelectorAll('.card-slot');
const debugScenario = new URLSearchParams(window.location.search).get('debugScenario');
const debugScenarioAllowed = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
let debugScenarioRequested = false;
let debugScenarioResult = null;
let lastUsedSlot = -1; // tracks the most recently clicked/pressed slot index for cardError targeting

// Socket setup
const socket = io();
let myId = null;
let isReady = false;
let gameState = null;
let connectionState = 'connecting';
let heartbeatTimer = null;
let latency = null;
let sceneInitialized = false;
let currentLayoutSeed = null; // tracks the layout seed we last built from
let currentLayout = null; // persisted layout from init; stateUpdate omits it

// Deck editor state
let mySelectedDeck = [];
let myOwnedCards = {};
const DECK_MIN_SIZE = 4;
const DECK_MAX_SIZE = 12;
const ENEMY_ATTACK_RANGE = 4; // units — matches server constant for attack range / warning circle radius

// ── Audio system ──

let soundEnabled = true;
let audioCtx = null;

const SOUND_CONFIG = {
  card:           { freq: 600, duration: 0.1 },
  enemyHit:       { freq: 300, duration: 0.15 },
  playerDamage:   { freq: 200, duration: 0.2 },
  loot:           { freq: 800, duration: 0.08 },
  victory:        { notes: [{ freq: 500, duration: 0.15 }, { freq: 700, duration: 0.15 }] },
  failure:        { notes: [{ freq: 400, duration: 0.2 }, { freq: 250, duration: 0.2 }] }
};

/**
 * Play a short oscillator-based sound effect via the Web Audio API.
 * Never throws — catches errors silently if AudioContext is unavailable or blocked.
 * @param {string} type - one of 'card', 'enemyHit', 'playerDamage', 'loot', 'victory', 'failure'
 */
function playSound(type) {
  try {
    if (!soundEnabled) return;

    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = Ctx ? new Ctx() : null;
    }
    if (!audioCtx) return;

    const config = SOUND_CONFIG[type];
    if (!config) return;

    const now = audioCtx.currentTime;

    if (config.notes) {
      // Multi-note sound (victory / failure)
      let offset = 0;
      for (const note of config.notes) {
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = note.freq;
        osc.connect(audioCtx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + note.duration);
        offset += note.duration;
      }
    } else {
      // Single-note sound
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = config.freq;
      osc.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + config.duration);
    }
  } catch (e) {
    // Silent — AudioContext may be unavailable or blocked by the browser
  }
}

// Three.js references (initialized by initScene)
let scene, camera, renderer, clock;
const playersMeshes = {};
const enemiesMeshes = {};
const enemyHealthBars = {}; // enemy id → health bar mesh
const telegraphMeshes = {}; // enemy id → warning ring mesh (ground circle during windup)
const windupFlashing = new Set(); // enemy ids currently showing windup emissive
const minionsMeshes = {};
const lootMeshes = {};
const activeEffects = []; // { mesh, origin, direction, createdAt, duration }
let myX = 0;
let myZ = 0;
let velocityX = 0;
let velocityZ = 0;
let playerRotation = 0; // facing angle in radians, derived from movement velocity
let wasDead = false; // tracks previous-frame dead state for respawn detection
let _lastCurrency = undefined; // tracks previous currency value for flash-on-increase
let spawnPosition = { x: 0, z: 0 }; // center of first room, set by buildDungeon
let wallColliders = []; // flat array of wall AABBs: { minX, maxX, minZ, maxZ }
let dungeonMeshes = []; // meshes created by buildDungeon(), managed by clearDungeon()

function requestDebugScenario() {
  if (!debugScenario || !debugScenarioAllowed || debugScenarioRequested) return;
  debugScenarioRequested = true;
  socket.emit('debugScenario', { name: debugScenario });
}

function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    socket.emit('heartbeat', { type: 'heartbeat', timestamp: Date.now() });
  }, 2000);
}

function stopHeartbeat() {
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function updateStatus(text, state) {
  connectionState = state;
  statusEl.innerText = text;
  statusEl.className = state;
}

const MAX_HP = 100;
const MAX_MS = 100;

function updateHpBar(hp) {
  const clamped = Math.max(0, Math.min(MAX_HP, hp));
  const pct = (clamped / MAX_HP) * 100;
  hpBarFill.style.width = `${pct}%`;
  hpText.textContent = `${clamped}/${MAX_HP}`;
  hpLabel.textContent = myId ? `${myId.slice(0, 5)} HP` : 'HP';

  // Color shift: green → yellow → red as HP drops
  if (pct > 50) {
    hpBarFill.style.background = '#22c55e';
  } else if (pct > 25) {
    hpBarFill.style.background = '#eab308';
  } else {
    hpBarFill.style.background = '#ef4444';
  }
}

function updateMsBar(ms) {
  const clamped = Math.max(0, Math.min(MAX_MS, ms));
  const pct = (clamped / MAX_MS) * 100;
  msBarFill.style.width = `${pct}%`;
  msText.textContent = `${Math.floor(clamped)}/${MAX_MS}`;
  msLabel.textContent = myId ? `${myId.slice(0, 5)} MS` : 'MS';
}

function updateObjectiveHud() {
  if (!objectiveHudEl) return;

  const run = (gameState && gameState.run) || null;

  if (gameState && gameState.gamePhase === 'playing' && run && run.objective) {
    const obj = run.objective;
    objectiveHudEl.textContent = `${obj.label}\nDefeated ${obj.defeatedEnemies} / ${obj.totalEnemies}`;
    objectiveHudEl.style.display = 'block';
  } else {
    objectiveHudEl.style.display = 'none';
  }
}

function renderHand() {
	const playerMs = (gameState && myId && gameState.players[myId])
		? gameState.players[myId].magicStones
		: 0;

	for (let i = 0; i < 4; i++) {
		const slot = cardSlots[i];
		const card = hand[i];

		if (card) {
			const style = CARD_TYPE_STYLE[card.type] || CARD_TYPE_STYLE.weapon;
			slot.style.setProperty('--slot-color', style.color);
			slot.innerHTML = `
				<span class="card-icon">${style.icon}</span>
				<span class="card-name">${card.name}</span>
				<span class="card-charges">${card.remainingCharges}/${card.charges}</span>
			`;
			slot.classList.remove('empty');

			// Sync .no-ms: keep if summon card and player can't afford it; otherwise remove
			if (summonCardIds.has(card.id) && card.magicStoneCost != null && playerMs < card.magicStoneCost) {
				slot.classList.add('no-ms');
			} else {
				slot.classList.remove('no-ms');
			}
		} else {
			slot.style.removeProperty('--slot-color');
			slot.innerHTML = '<span class="card-name">&mdash;</span>';
			slot.classList.add('empty');
			slot.classList.remove('no-ms');
		}
	}
}

function initHand() {
	const serverDeck = (gameState && gameState.players && gameState.players[myId])
		? gameState.players[myId].deck
		: null;
	initHandFromDeck(serverDeck, renderHand);
}

function refillSlot(index) {
  if (index < 0 || index > 3) return null;
  if (hand[index] != null) return hand[index]; // slot already has a card

  const card = drawCard();
  if (card) {
    hand[index] = card;
    renderHand();
  }
  return card;
}

// ── Deck Editor ──

const ownedCardsListEl = document.getElementById('owned-cards-list');
const selectedDeckListEl = document.getElementById('selected-deck-list');
const deckSizeDisplayEl = document.getElementById('deck-size-display');
const deckErrorEl = document.getElementById('deck-error');

function renderDeckEditor() {
  // ── Owned Cards list ──
  ownedCardsListEl.innerHTML = '';
  for (const [cardId, count] of Object.entries(myOwnedCards)) {
    const def = CARD_DEFS[cardId];
    if (!def) continue;
    const style = CARD_TYPE_STYLE[def.type] || CARD_TYPE_STYLE.weapon;
    const inDeckCount = mySelectedDeck.filter(id => id === cardId).length;
    const canAdd = inDeckCount < count && mySelectedDeck.length < DECK_MAX_SIZE;

    const entry = document.createElement('div');
    entry.className = 'owned-card-entry';
    entry.innerHTML = `
      <span class="card-icon">${style.icon}</span>
      <span class="card-label">${def.name}</span>
      <span class="card-count">${count}</span>
      <button class="deck-add-btn" ${canAdd ? '' : 'disabled'}>+${inDeckCount > 0 ? ` (${inDeckCount})` : ''}</button>
    `;
    const addBtn = entry.querySelector('.deck-add-btn');
    addBtn.addEventListener('click', () => {
      socket.emit('deckAddCard', { cardId });
    });
    ownedCardsListEl.appendChild(entry);
  }

  // ── Selected Deck list ──
  selectedDeckListEl.innerHTML = '';
  for (let i = 0; i < mySelectedDeck.length; i++) {
    const cardId = mySelectedDeck[i];
    const def = CARD_DEFS[cardId];
    if (!def) continue;
    const style = CARD_TYPE_STYLE[def.type] || CARD_TYPE_STYLE.weapon;

    const entry = document.createElement('div');
    entry.className = 'deck-entry';
    entry.innerHTML = `
      <span class="card-icon">${style.icon}</span>
      <span class="card-label">${def.name}</span>
      <button class="deck-remove-btn">✕</button>
    `;
    const removeBtn = entry.querySelector('.deck-remove-btn');
    removeBtn.addEventListener('click', () => {
      socket.emit('deckRemoveCard', { cardId });
    });
    selectedDeckListEl.appendChild(entry);
  }

  // ── Deck size counter ──
  deckSizeDisplayEl.textContent = `${mySelectedDeck.length}/${DECK_MAX_SIZE}`;

  // ── Ready button validity ──
  if (mySelectedDeck.length < DECK_MIN_SIZE) {
    readyBtn.classList.add('deck-invalid');
    readyBtn.disabled = true;
  } else {
    readyBtn.classList.remove('deck-invalid');
    readyBtn.disabled = false;
  }

  // ── Hide error ──
  deckErrorEl.style.display = 'none';
  deckErrorEl.textContent = '';
}

function showDeckError(message) {
  deckErrorEl.textContent = message;
  deckErrorEl.style.display = 'block';
}

// ── Card input handling ──

function playActivationEffect(slotIndex) {
  const slot = cardSlots[slotIndex];
  if (!slot) return;

  // Flash: add .activating, remove after 200ms
  slot.classList.add('activating');
  setTimeout(() => {
    slot.classList.remove('activating');
    slot.classList.add('cooldown');
  }, 200);

  // Cooldown: ~1000ms of dimmed state after the flash ends (1200ms from activation)
  setTimeout(() => {
    slot.classList.remove('cooldown');
    slotCooldowns[slotIndex] = false;
  }, 1200);
}

function useCard(slotIndex) {
  if (slotIndex < 0 || slotIndex > 3) return;
  const card = hand[slotIndex];
  if (!card) return; // empty slot — no-op

  // Cooldown gate: block everything (emit, charge drain, monster consume)
  // when the slot is still cooling down.
  if (!canUseSlot(slotIndex)) return;

  // Track which slot was used so cardError can target the right slot
  lastUsedSlot = slotIndex;

  // (1) Emit useCard — only fires when cooldown has cleared
  socket.emit('useCard', { slotIndex, cardId: card.id });

  // (1b) For monster cards: single-use, consumed optimistically (like weapons)
  if (monsterCardIds.has(card.id)) {
    hand[slotIndex] = null;
    const newCard = drawCard();
    if (newCard) hand[slotIndex] = newCard;
    renderHand();
    slotCooldowns[slotIndex] = true;
    playActivationEffect(slotIndex);
    return;
  }

  // (2) For summon cards: skip optimistic consumption — wait for server
  //     confirmation (cardUsed) before removing the card. This way, if the
  //     server rejects (e.g. not enough Magic Stones), the card stays in hand.
  if (summonCardIds.has(card.id)) {
    slotCooldowns[slotIndex] = true;
    playActivationEffect(slotIndex);
    return;
  }

  // (3) Decrement charges + exhaust/redraw — non-summon cards only
  card.remainingCharges -= 1;

  if (card.remainingCharges <= 0) {
    // Card exhausted — remove and draw replacement
    hand[slotIndex] = null;
    const newCard = drawCard();
    if (newCard) {
      hand[slotIndex] = newCard;
    }
    // else: deck is exhausted, hand[slotIndex] stays null
  }

  // Refresh the slot display with updated charge count or new card
  renderHand();

  // (4) Visual flash + cooldown flag
  slotCooldowns[slotIndex] = true;
  playActivationEffect(slotIndex);
}

// Keyboard: keys 1-4 map to hand slots 0-3
window.addEventListener('keydown', (e) => {
  const slotMap = { '1': 0, '2': 1, '3': 2, '4': 3 };
  if (e.key in slotMap) {
    if (e.repeat) return;
    useCard(slotMap[e.key]);
  }
});

// Click: delegate on #card-hand, read data-slot-index from .card-slot target
cardHandEl.addEventListener('click', (e) => {
  const slot = e.target.closest('.card-slot');
  if (!slot) return;
  useCard(parseInt(slot.dataset.slotIndex, 10));
});

socket.on('connect', () => {
  updateStatus('Connected', 'connected');
  startHeartbeat();
});

socket.on('disconnect', () => {
  stopHeartbeat();
  updateStatus('Disconnected', 'disconnected');
  disposeAllLootMeshes();
});

socket.io.on('reconnect_attempt', () => {
  updateStatus('Reconnecting...', 'reconnecting');
});

socket.io.on('reconnect', () => {
  updateStatus('Connected', 'connected');
  startHeartbeat();
});

socket.on('init', (data) => {
  myId = data.id;
  gameState = data.state;
  currentLayout = data.layout || (data.state && data.state.layout) || currentLayout;
  if (gameState && currentLayout) gameState.layout = currentLayout;

  // Initialize deck editor state from server
  mySelectedDeck = data.selectedDeck || [];
  myOwnedCards = data.ownedCards || {};
  renderDeckEditor();

  // ── Layout consistency check ──
  const receivedSeed = data.layoutSeed;

  if (sceneInitialized && receivedSeed !== undefined) {
    // Reconnect path: the server should keep one layout seed for the session.
    if (receivedSeed !== currentLayoutSeed) {
      console.warn(`[layout] Seed changed from ${currentLayoutSeed} to ${receivedSeed}; keeping existing geometry`);
      currentLayoutSeed = receivedSeed;
    }
    // Same seed — dungeon geometry already exists, skip redundant rebuild.
    // Reset local player position to spawn
    myX = spawnPosition.x;
    myZ = spawnPosition.z;
    velocityX = 0;
    velocityZ = 0;
    requestDebugScenario();
    return;
  }

  // Fresh connect path
  currentLayoutSeed = receivedSeed;
  requestDebugScenario();

  // If the server is already in 'playing' phase, skip the lobby entirely
  if (data.state && data.state.gamePhase === 'playing') {
    if (sceneInitialized) return;
    lobbyEl.classList.add('hidden');
    uiEl.style.display = 'block';
    cardHandEl.style.display = 'flex';
    initHand();
    initScene();
    updateObjectiveHud();
    return;
  }

  updateObjectiveHud();
});

socket.on('stateUpdate', (state) => {
  // Verify layout seed consistency on every state update
  if (currentLayoutSeed !== null && state.layoutSeed !== undefined && state.layoutSeed !== currentLayoutSeed) {
    console.warn(`[layout] Seed mismatch: local=${currentLayoutSeed} server=${state.layoutSeed}`);
    currentLayoutSeed = state.layoutSeed;
  }
  gameState = state;
  if (gameState && currentLayout) gameState.layout = currentLayout;

  // Return to lobby: switch UI back to lobby view
  if (state.gamePhase === 'lobby') {
    if (runSummaryOverlay) runSummaryOverlay.style.display = 'none';
    if (uiEl) uiEl.style.display = 'none';
    if (cardHandEl) cardHandEl.style.display = 'none';
    if (lobbyEl) lobbyEl.classList.remove('hidden');
    renderDeckEditor();
  }

  // Entering gameplay: ensure HUD is visible (symmetric with lobby branch above)
  if (state.gamePhase === 'playing') {
    if (uiEl) uiEl.style.display = 'block';
    if (cardHandEl) cardHandEl.style.display = 'flex';
    if (lobbyEl) lobbyEl.classList.add('hidden');
  }

  // Update currency HUD
  if (myId && gameState.players[myId]) {
    const currencyEl = document.getElementById('currency-display');
    if (currencyEl) {
      const newCurrency = gameState.players[myId].currency;
      const oldCurrency = _lastCurrency;
      _lastCurrency = newCurrency;

      currencyEl.textContent = `GOLD ${newCurrency}`;

      // Flash the currency display when it increases
      if (oldCurrency !== undefined && newCurrency > oldCurrency) {
        currencyEl.style.transition = 'none';
        currencyEl.style.color = '#ffd700';
        currencyEl.style.transform = 'scale(1.2)';
        requestAnimationFrame(() => {
          currencyEl.style.transition = 'color 0.4s, transform 0.4s';
          currencyEl.style.color = '';
          currencyEl.style.transform = 'scale(1)';
        });
        playSound('loot');
      }
    }

    // Sync ownedCards from server state if present
    if (gameState.players[myId].ownedCards) {
      myOwnedCards = gameState.players[myId].ownedCards;
    }
  }

  // Update objective HUD
  updateObjectiveHud();

  // Re-render hand to sync .no-ms / .empty classes with current Magic Stones
  if (state.gamePhase === 'playing') {
    renderHand();
  }
});

socket.on('heartbeat_ack', (data) => {
  if (connectionState === 'connected') {
    latency = data.latency;
    statusEl.innerText = `Latency: ${latency}ms`;
  }
});

socket.on('debugScenarioResult', (data) => {
  debugScenarioResult = data || null;
  if (data && data.ok) {
    console.log(`[debugScenario] applied ${data.scenario}`);
  } else if (data && data.reason) {
    console.warn(`[debugScenario] ${data.reason}`);
  }
});

socket.on('playerDisconnected', (id) => {
  if (playersMeshes[id]) {
    if (scene) {
      scene.remove(playersMeshes[id]);
    }
    delete playersMeshes[id];
  }
  delete previousPlayerHp[id];
});

// ── Hit flash helper ──

/**
 * Flash a mesh by setting its material emissive to a bright color,
 * then restoring the original emissive/intensity after `durationMs`.
 * @param {THREE.Mesh} mesh
 * @param {number} color - hex color (e.g. 0xffffff)
 * @param {number} durationMs - how long the flash lasts
 */
function flashMesh(mesh, color, durationMs) {
	if (!mesh || !mesh.material) return;

	// Save original emissive state
	const mat = mesh.material;
	const origEmissive = mat.emissive ? mat.emissive.get ? mat.emissive.get() : 0x000000 : 0x000000;
	const origIntensity = mat.emissiveIntensity || 0;

	// Apply flash
	if (mat.emissive && mat.emissive.set) {
		mat.emissive.set(color);
	} else {
		mat.emissive = color;
	}
	mat.emissiveIntensity = 1.5;

	// Restore after duration
	setTimeout(() => {
		if (mat.emissive && mat.emissive.set) {
			mat.emissive.set(origEmissive);
		} else {
			mat.emissive = origEmissive;
		}
		mat.emissiveIntensity = origIntensity;
	}, durationMs);
}

// Track the timestamp (performance.now) of the last cardUsed hit per enemy ID,
// so we can skip minion-damage sparks when HP drops are caused by a card attack.
const lastCardHitTime = {};
const CARD_HIT_GRACE_MS = 500; // window after cardUsed during which we skip minion-damage effects

// Track per-enemy HP from the previous frame, for detecting minion tick damage
const previousEnemyHp = {};

// Track per-player HP from the previous frame, for detecting damage taken between state updates
const previousPlayerHp = {};

// ── Floating damage numbers ──

const damageNumbers = []; // { element, createdAt, position3d }

/**
 * Spawn a floating number above a 3D position.
 * Creates an HTML div, projects the 3D coordinate to screen space each frame,
 * and auto-removes after ~1 second.
 * @param {number} x - 3D X coordinate
 * @param {number} y - 3D Y coordinate (height above ground)
 * @param {number} z - 3D Z coordinate
 * @param {number} amount - amount to display (shown as negative by default, e.g. "-10")
 * @param {string} color - CSS color string (e.g. '#ff0000')
 * @param {boolean} positive - if true, show as "+N" instead of "-N"
 */
function spawnDamageNumber(x, y, z, amount, color, positive) {
	if (!document.body) return;

	const rounded = Math.abs(Math.round(amount));
	const prefix = positive ? '+' : '-';
	const el = document.createElement('div');
	el.textContent = `${prefix}${rounded}`;
	el.style.cssText = `
		position: fixed;
		left: 0;
		top: 0;
		font-size: 22px;
		font-weight: 800;
		color: ${color || '#ff0000'};
		text-shadow: 0 0 6px rgba(0,0,0,0.8), 0 2px 4px rgba(0,0,0,0.6);
		pointer-events: none;
		z-index: 1000;
		transform: translate(-50%, -50%);
		opacity: 1;
		transition: none;
	`;
	document.body.appendChild(el);

	damageNumbers.push({
		element: el,
		createdAt: performance.now(),
		position3d: { x, y, z },
		duration: 1000 // ms
	});
}

/**
 * Update floating damage number positions and remove expired ones.
 * Called each frame from the animate loop.
 */
function updateDamageNumbers() {
	if (!camera || !renderer) return;

	const now = performance.now();
	const vec = new THREE.Vector3();

	for (let i = damageNumbers.length - 1; i >= 0; i--) {
		const dn = damageNumbers[i];
		const elapsed = now - dn.createdAt;

		if (elapsed >= dn.duration) {
			dn.element.remove();
			damageNumbers.splice(i, 1);
			continue;
		}

		// Float upward over time
		const floatOffset = (elapsed / dn.duration) * 1.5;
		vec.set(dn.position3d.x, dn.position3d.y + floatOffset, dn.position3d.z);
		vec.project(camera);

		// Convert to screen coordinates
		const sx = (vec.x * 0.5 + 0.5) * window.innerWidth;
		const sy = (-vec.y * 0.5 + 0.5) * window.innerHeight;

		// Fade out in the last half of the lifetime
		const opacity = elapsed > dn.duration * 0.5
			? 1.0 - (elapsed - dn.duration * 0.5) / (dn.duration * 0.5)
			: 1.0;

		dn.element.style.left = `${sx}px`;
		dn.element.style.top = `${sy}px`;
		dn.element.style.opacity = String(Math.max(0, opacity));
	}
}

// ── Enemy health bar helpers ──

const ENEMY_MAX_HP = 50;

/**
 * Return a hex color for an enemy health bar based on HP percentage.
 * Green (full) → yellow (50 %) → red (empty).
 */
function healthBarColor(hp) {
	const pct = hp / ENEMY_MAX_HP;
	if (pct > 0.5) return 0x22c55e;       // green
	if (pct > 0.25) return 0xeab308;      // yellow
	return 0xef4444;                       // red
}

/**
 * Apply or remove the windup emissive flash on an enemy mesh.
 * When `isWindup` is true and the enemy is not already flashing, sets emissive
 * to 0xff3333 and adds the id to `windupFlashing`.
 * When `isWindup` is false and the enemy is in `windupFlashing`, restores
 * emissive to 0x000000 and removes the id.
 * @param {string} enemyId
 * @param {boolean} isWindup
 */
function applyWindupFlash(enemyId, isWindup) {
	const mesh = enemiesMeshes[enemyId];
	if (!mesh || !mesh.material || !mesh.material.emissive) return;

	if (isWindup) {
		if (!windupFlashing.has(enemyId)) {
			mesh.material.emissive.set(0xff3333);
			mesh.material.emissiveIntensity = 1.5;
			windupFlashing.add(enemyId);
		}
	} else {
		if (windupFlashing.has(enemyId)) {
			mesh.material.emissive.set(0x000000);
			mesh.material.emissiveIntensity = 0;
			windupFlashing.delete(enemyId);
		}
	}
}

/**
 * Create a health-bar mesh positioned above an enemy.
 */
function createHealthBarMesh(enemyId, x, z) {
	const geo = new THREE.BoxGeometry(1.2, 0.1, 0.1);
	const mat = new THREE.MeshStandardMaterial({ color: 0x22c55e });
	const mesh = new THREE.Mesh(geo, mat);
	mesh.position.set(x, 1.5, z);
	scene.add(mesh);
	return mesh;
}

/**
 * Update a health bar's scale and color to reflect current HP.
 */
function updateHealthBarMesh(enemyId, enemy) {
	const mesh = enemyHealthBars[enemyId];
	if (!mesh) return;

	const ratio = Math.max(0, enemy.hp / ENEMY_MAX_HP);
	mesh.scale.x = ratio;
	mesh.material.color.setHex(healthBarColor(enemy.hp));
}

// ── Attack visual effects ──

const ATTACK_EFFECT_DURATION = 600; // ms before auto-removal
const ATTACK_EFFECT_SPEED = 8;     // units per second

const SUMMON_EFFECT_DURATION = 1000;  // total lifetime: expand + fade
const SUMMON_EXPAND_MS = 700;         // time to reach full radius

const HIT_SPARK_DURATION = 400; // ms before auto-removal

function spawnAttackEffect(origin, direction) {
  // Bright yellow sphere projectile
  const geometry = new THREE.SphereGeometry(0.3, 8, 8);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffdd44,
    emissive: 0xffaa00,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 1.0
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(origin.x, 1.0, origin.z);
  scene.add(mesh);

  activeEffects.push({
    mesh,
    origin: { x: origin.x, z: origin.z },
    direction: { x: direction.x, z: direction.z },
    createdAt: performance.now(),
    duration: ATTACK_EFFECT_DURATION
  });
}

// ── Summon AoE visual effect ──

function spawnSummonEffect(origin, radius) {
  // Expanding ring on the ground plane (y = 0.1 to avoid z-fighting with floor at y = 0)
  const geometry = new THREE.RingGeometry(0.1, 0.5, 32);
  const material = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.0,
    transparent: true,
    opacity: 1.0,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(origin.x, 0.1, origin.z);
  mesh.rotation.x = -Math.PI / 2; // lie flat on ground
  mesh.scale.setScalar(0.001); // start invisible, grows in updateAttackEffects
  scene.add(mesh);

  activeEffects.push({
    mesh,
    origin: { x: origin.x, z: origin.z },
    radius,
    createdAt: performance.now(),
    duration: SUMMON_EFFECT_DURATION
  });
}

// ── Hit spark effect (minion attack feedback) ──

function spawnHitSpark(position) {
  // Use test-scene override if available (set via window.__setScene in tests)
  const targetScene = window.___test_scene || scene;
  if (!targetScene) return;

  // Small icosahedron spark at the enemy's position, scales up and fades out
  const geometry = new THREE.IcosahedronGeometry ? new THREE.IcosahedronGeometry(0.15, 0) : new THREE.SphereGeometry(0.15, 6, 6);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffee44,
    emissive: 0xffaa00,
    emissiveIntensity: 1.2,
    transparent: true,
    opacity: 1.0
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position.x, position.y || 1.0, position.z);
  targetScene.add(mesh);

  activeEffects.push({
    mesh,
    origin: { x: position.x, y: position.y || 1.0, z: position.z },
    direction: null, // no direction — distinguishes hit sparks from projectiles
    isHitSpark: true,
    createdAt: performance.now(),
    duration: HIT_SPARK_DURATION
  });
}

function updateAttackEffects() {
  const now = performance.now();
  for (let i = activeEffects.length - 1; i >= 0; i--) {
    const fx = activeEffects[i];
    const elapsed = now - fx.createdAt;

    // ── Summon AoE effect (has a radius field) ──
    if (fx.radius !== undefined) {
      const expandT = Math.min(elapsed / SUMMON_EXPAND_MS, 1.0);
      const scale = fx.radius * expandT * 2; // RingGeometry inner+outer = visual radius
      fx.mesh.scale.setScalar(Math.max(0.001, scale));

      // Fade opacity during the fade phase (after expansion finishes)
      if (elapsed > SUMMON_EXPAND_MS) {
        const fadeRatio = 1.0 - (elapsed - SUMMON_EXPAND_MS) / (fx.duration - SUMMON_EXPAND_MS);
        fx.mesh.material.opacity = Math.max(0.01, fadeRatio);
      }

      // Remove when expired
      if (elapsed >= fx.duration) {
        scene.remove(fx.mesh);
        fx.mesh.geometry.dispose();
        fx.mesh.material.dispose();
        activeEffects.splice(i, 1);
      }
      continue;
    }

    // ── Hit spark effect (minion attack feedback) ──
    if (fx.isHitSpark) {
      const sparkT = Math.min(elapsed / HIT_SPARK_DURATION, 1.0);

      // Scale up quickly then shrink, float upward slightly
      const scalePhase = sparkT < 0.2 ? sparkT / 0.2 : 1.0 - (sparkT - 0.2) / 0.8;
      fx.mesh.scale.setScalar(Math.max(0.01, 1.0 + scalePhase * 2.0));

      // Float upward
      fx.mesh.position.y = fx.origin.y + sparkT * 0.5;

      // Fade opacity
      fx.mesh.material.opacity = Math.max(0.01, 1.0 - sparkT);

      // Remove when expired
      if (elapsed >= fx.duration) {
        scene.remove(fx.mesh);
        fx.mesh.geometry.dispose();
        fx.mesh.material.dispose();
        activeEffects.splice(i, 1);
      }
      continue;
    }

    // ── Weapon projectile effect (has direction field) ──
    const t = Math.min(elapsed / 1000, 1.0); // 0→1 over real time

    // Move forward along direction
    const travel = ATTACK_EFFECT_SPEED * t;
    fx.mesh.position.x = fx.origin.x + fx.direction.x * travel;
    fx.mesh.position.z = fx.origin.z + fx.direction.z * travel;

    // Fade: scale down and reduce opacity as effect ages
    const lifeRatio = 1.0 - (elapsed / fx.duration);
    const weaponScale = Math.max(0.01, lifeRatio);
    fx.mesh.scale.setScalar(weaponScale);
    fx.mesh.material.opacity = Math.max(0.01, lifeRatio);

    // Remove when expired
    if (elapsed >= fx.duration) {
      scene.remove(fx.mesh);
      fx.mesh.geometry.dispose();
      fx.mesh.material.dispose();
      activeEffects.splice(i, 1);
    }
  }
}

// ── Loot mesh sync & animation ──

const lootGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
const collectingLoot = {}; // lootId → { mesh, value, createdAt } — meshes mid-collection animation
const previousLootValues = {}; // lootId → value — persists value after loot is removed from gameState

const LOOT_COLLECT_DURATION = 600; // ms for scale-up + fade animation

/**
 * Play a "collected" animation on a loot mesh: scale-up + fade, then remove.
 * Also spawns a floating "+N" number at the loot's position.
 * @param {string} lootId - the ID of the collected loot
 * @param {number} value - gold amount (for the floating "+N" text)
 */
function markLootCollected(lootId, value) {
	const mesh = lootMeshes[lootId];
	if (!mesh || !scene) return;

	// Record position before removing from lootMeshes (so animateLootMeshes skips it)
	const px = mesh.position.x;
	const pz = mesh.position.z;

	// Remove from active loot meshes so it's no longer bobbed/rotated
	delete lootMeshes[lootId];

	// Store in collectingLoot for the animation loop
	collectingLoot[lootId] = { mesh, value, createdAt: performance.now() };

	// Spawn floating "+N" number
	spawnDamageNumber(px, 1.0, pz, value, '#ffd700', true);
}

/**
 * Update collecting-loot animations: scale up, fade out, then dispose.
 * Called each frame from the animate loop.
 */
function updateCollectingLoot() {
	const now = performance.now();
	for (const id of Object.keys(collectingLoot)) {
		const entry = collectingLoot[id];
		const elapsed = now - entry.createdAt;
		const t = Math.min(elapsed / LOOT_COLLECT_DURATION, 1.0);

		// Scale up from 1.0 to 2.0, then shrink
		const scale = t < 0.3 ? 1.0 + (t / 0.3) * 1.0 : 2.0 - (t - 0.3) / 0.7 * 1.9;
		entry.mesh.scale.setScalar(Math.max(0.01, scale));

		// Fade opacity in the second half
		if (t > 0.5) {
			entry.mesh.material.opacity = Math.max(0.01, 1.0 - (t - 0.5) / 0.5);
		}

		// Float upward
		entry.mesh.position.y = 0.5 + t * 1.5;

		// Remove when expired
		if (elapsed >= LOOT_COLLECT_DURATION) {
			scene.remove(entry.mesh);
			// Do NOT dispose geometry or material — shared
			delete collectingLoot[id];
		}
	}
}

function syncLootMeshes() {
  if (!gameState || !gameState.loot) return;

  const currentLootIds = new Set(gameState.loot.map(l => l.id));

  // Track current loot values so we can display them on collection
  for (const item of gameState.loot) {
    previousLootValues[item.id] = item.value || 1;
  }

  // Add / update new loot
  for (const item of gameState.loot) {
    if (!lootMeshes[item.id]) {
      const mesh = new THREE.Mesh(lootGeometry, lootMaterial);
      mesh.position.set(item.x, 0.5, item.z);
      scene.add(mesh);
      lootMeshes[item.id] = mesh;
    }
  }

  // Remove stale loot — play collection animation instead of immediate removal
  for (const id of Object.keys(lootMeshes)) {
    if (!currentLootIds.has(id)) {
      const lootValue = previousLootValues[id] || 1;
      markLootCollected(id, lootValue);
    }
  }
}

function animateLootMeshes() {
  const t = performance.now();
  for (const mesh of Object.values(lootMeshes)) {
    // Bob up and down
    mesh.position.y = 0.5 + Math.sin(t / 300) * 0.15;
    // Slow Y-axis rotation
    mesh.rotation.y += 0.02;
  }
}

function disposeAllLootMeshes() {
  for (const id of Object.keys(lootMeshes)) {
    if (scene) scene.remove(lootMeshes[id]);
    // Do NOT dispose geometry or material — both are shared
    delete lootMeshes[id];
  }
}

socket.on('cardUsed', (data) => {
  if (!data || !scene) return;

  // Audio cue: playing any card
  playSound('card');

  // Handle confirmed summon play for the local player: consume the card
  if (data.playerId === myId && summonCardIds.has(data.cardId)) {
    const idx = data.slotIndex;
    if (idx >= 0 && idx < hand.length) {
      hand[idx] = null;
      const newCard = drawCard();
      if (newCard) {
        hand[idx] = newCard;
      }
      renderHand();
    }
  }

  // Spawn visual for weapon attacks
  if (weaponCardIds.has(data.cardId)) {
    const origin = data.origin || { x: 0, z: 0 };
    const direction = data.direction || { x: 1, z: 0 };
    spawnAttackEffect(origin, direction);
  }

  // Spawn visual for summon AoE
  if (summonCardIds.has(data.cardId) && data.radius !== undefined) {
    const origin = data.origin || { x: 0, z: 0 };
    spawnSummonEffect(origin, data.radius);
  }

  // Flash hit enemies (weapon, summon, or any card that reports hits)
  if (data.hits && Array.isArray(data.hits)) {
    const now = performance.now();
    for (const hit of data.hits) {
      // Audio cue: enemy takes damage
      playSound('enemyHit');

      const mesh = enemiesMeshes[hit.enemyId];
      if (mesh) {
        flashMesh(mesh, 0xffffff, 200);
        lastCardHitTime[hit.enemyId] = now;
      }
    }
  }
});

socket.on('cardError', (data) => {
  if (!data || !data.reason) return;
  showCardErrorToast(data.reason);

  // Apply .no-ms visual to the slot that was just used
  if (data.reason === 'Not enough Magic Stones' && lastUsedSlot >= 0) {
    const slot = cardSlots[lastUsedSlot];
    if (slot) {
      slot.classList.add('no-ms');
    }
  }
  lastUsedSlot = -1;
});

socket.on('deckUpdate', (data) => {
  if (!data) return;
  if (data.selectedDeck) mySelectedDeck = data.selectedDeck;
  if (data.ownedCards) myOwnedCards = data.ownedCards;
  renderDeckEditor();
});

socket.on('deckError', (data) => {
  if (!data || !data.reason) return;
  showDeckError(data.reason);
});

function showCardErrorToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #dc2626;
    color: #fff;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-family: sans-serif;
    z-index: 9999;
    pointer-events: none;
    opacity: 1;
    transition: opacity 0.3s;
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// ── Lobby event wiring ──

function renderPlayerList(players) {
  lobbyPlayerList.innerHTML = '';
  if (!players || players.length === 0) {
    lobbyPlayerList.innerHTML = '<li class="empty-hint">No players yet</li>';
    return;
  }
  for (const p of players) {
    const li = document.createElement('li');
    li.textContent = `${p.id} — ${p.ready ? 'Ready' : 'Not Ready'}`;
    lobbyPlayerList.appendChild(li);
  }
}

socket.on('lobbyUpdate', (data) => {
  renderPlayerList(data.players);

  // Sync local ready state from server truth so the button never desyncs
  if (data.players && myId) {
    const me = data.players.find(p => p.id === myId);
    if (me) {
      isReady = me.ready;
      readyBtn.textContent = isReady ? 'Ready!' : 'Ready';
    }
  }
});

readyBtn.addEventListener('click', () => {
  isReady = !isReady;
  socket.emit('playerReady', isReady);
  readyBtn.textContent = isReady ? 'Ready!' : 'Ready';
});

// ── Mute toggle ──

function updateMuteButton() {
  const btn = document.getElementById('mute-btn');
  if (btn) btn.textContent = soundEnabled ? '🔊' : '🔇';
}

// Use event delegation so the handler works even if #mute-btn is added after import
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'mute-btn') {
    soundEnabled = !soundEnabled;
    updateMuteButton();
  }
});

// Initialize button text if it already exists at import time
updateMuteButton();

socket.on('startGame', () => {
  // Always transition UI to gameplay view (needed for subsequent runs after lobby return)
  lobbyEl.classList.add('hidden');
  uiEl.style.display = 'block';
  cardHandEl.style.display = 'flex';
  updateObjectiveHud();

  if (!sceneInitialized) {
    initHand();
    initScene();
    return;
  }

  // Subsequent run: re-init hand with a fresh draw, reset local position to spawn
  // Also clean up meshes from the previous run
  initHand();
  myX = spawnPosition.x;
  myZ = spawnPosition.z;
  velocityX = 0;
  velocityZ = 0;
  playerRotation = 0;
  wasDead = false;

  // Dispose previous run's enemy meshes
  for (const id of Object.keys(enemiesMeshes)) {
    if (scene) scene.remove(enemiesMeshes[id]);
    enemiesMeshes[id].geometry.dispose();
    enemiesMeshes[id].material.dispose();
    delete enemiesMeshes[id];
  }
  // Dispose previous run's enemy health bars
  for (const id of Object.keys(enemyHealthBars)) {
    if (scene) scene.remove(enemyHealthBars[id]);
    enemyHealthBars[id].geometry.dispose();
    enemyHealthBars[id].material.dispose();
    delete enemyHealthBars[id];
  }
  // Dispose previous run's telegraph meshes
  for (const id of Object.keys(telegraphMeshes)) {
    if (scene) scene.remove(telegraphMeshes[id]);
    telegraphMeshes[id].geometry.dispose();
    telegraphMeshes[id].material.dispose();
    delete telegraphMeshes[id];
  }
  // Clear windup flashing tracking for new run
  windupFlashing.clear();
  // Dispose previous run's minion meshes
  for (const id of Object.keys(minionsMeshes)) {
    if (scene) scene.remove(minionsMeshes[id]);
    minionsMeshes[id].geometry.dispose();
    minionsMeshes[id].material.dispose();
    delete minionsMeshes[id];
  }
  // Dispose previous run's loot meshes
  disposeAllLootMeshes();
});

// ── Run Summary Overlay ──

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function showRunSummary(data) {
  if (!data) return;

  // Audio cue for run completion
  if (data.status === 'victory') {
    playSound('victory');
  } else {
    playSound('failure');
  }

  const statusText = data.status === 'victory' ? 'Victory!' : 'Run Failed';
  summaryStatusEl.textContent = statusText;
  summaryDurationEl.textContent = `Duration: ${formatDuration(data.durationMs || 0)}`;
  summaryEnemiesEl.textContent = `Enemies defeated: ${data.defeatedEnemies || 0}`;
  summaryCurrencyEl.textContent = `Currency collected: ${data.currencyCollected || 0}`;

  // Extract per-player rewards from the payload
  const me = data.players && data.players.find(p => p.id === myId);
  const rewards = me && me.rewards;

  if (rewards) {
    const currencyBonus = rewards.currency || 0;
    summaryRewardsCurrencyEl.textContent = `+${currencyBonus} gold earned`;

    if (rewards.cards && rewards.cards.length > 0) {
      const cardLines = rewards.cards.map(c => {
        const count = c.count > 1 ? ` ×${c.count}` : '';
        return `${c.name}${count}`;
      });
      summaryRewardsCardsEl.textContent = cardLines.join('\n');
    } else {
      summaryRewardsCardsEl.textContent = 'No card rewards';
    }
  } else {
    summaryRewardsCurrencyEl.textContent = '';
    summaryRewardsCardsEl.textContent = '';
  }

  runSummaryOverlay.style.display = 'flex';
}

socket.on('runComplete', showRunSummary);
socket.on('runFailed', showRunSummary);

returnToLobbyBtn.addEventListener('click', () => {
  socket.emit('returnToLobby');
});

// ── Dungeon geometry is in dungeon.js ──
// buildDungeon, clearDungeon, buildWallColliders, resolveWallCollision are imported from './dungeon.js'

// Shared gold material for loot coins
const lootMaterial = new THREE.MeshStandardMaterial({
  color: 0xffd700,
  emissive: 0xffa500,
  emissiveIntensity: 0.4,
  roughness: 0.3,
  metalness: 0.8
});

// ── Scene initialization (deferred) ──

const CAMERA_OFFSET = new THREE.Vector3(0, 5, 10);
const acceleration = 15.0;
const friction = 0.88;

const keys = { w: false, a: false, s: false, d: false };

function updateMyPlayer(delta) {
  if (!myId) return;

  // Block movement when dead
  const me = gameState && gameState.players[myId];
  if (me && me.dead) return;

  if (keys.w) velocityZ -= acceleration * delta;
  if (keys.s) velocityZ += acceleration * delta;
  if (keys.a) velocityX -= acceleration * delta;
  if (keys.d) velocityX += acceleration * delta;

  myX += velocityX * delta;
  myZ += velocityZ * delta;

  // Resolve wall collision before applying position
  const resolved = resolveWallCollisionFromDungeon(myX, myZ, wallColliders);
  myX = resolved.x;
  myZ = resolved.z;

  const f = Math.pow(friction, delta * 60);
  velocityX *= f;
  velocityZ *= f;

  // Update facing angle whenever there is meaningful movement
  if (Math.abs(velocityX) > 0.01 || Math.abs(velocityZ) > 0.01) {
    playerRotation = Math.atan2(velocityZ, velocityX);
  }

  // Always emit move while moving (preserves last non-zero rotation when stationary)
  if (Math.abs(velocityX) > 0.001 || Math.abs(velocityZ) > 0.001) {
    socket.emit('move', { x: myX, y: 0.5, z: myZ, rotation: playerRotation });
  }
}

function animate(timestamp) {
  requestAnimationFrame(animate);

  clock.update(timestamp);
  const delta = clock.getDelta();
  updateMyPlayer(delta);

  // ── Loot proximity check ──
  if (gameState && gameState.loot && gameState.loot.length > 0) {
    for (const loot of gameState.loot) {
      if (Math.hypot(myX - loot.x, myZ - loot.z) <= 2) {
        socket.emit('lootPickup', { lootId: loot.id });
        break; // one pickup per frame
      }
    }
  }

  // Update local player HP bar each frame
  if (gameState && myId && gameState.players[myId] != null) {
    updateHpBar(gameState.players[myId].hp);
    updateMsBar(gameState.players[myId].magicStones);
  }

  if (gameState) {
    for (const [id, pData] of Object.entries(gameState.players)) {
      if (!playersMeshes[id]) {
        const geo = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshStandardMaterial({ color: id === myId ? 0x3b82f6 : 0xf43f5e });
        const mesh = new THREE.Mesh(geo, mat);
        scene.add(mesh);
        playersMeshes[id] = mesh;
      }

      if (id === myId) continue;

      playersMeshes[id].position.set(pData.x, pData.y || 0.5, pData.z);

      // Visual feedback: grey when dead, red when alive
      if (pData.dead) {
        playersMeshes[id].material.color.setHex(0x808080);
      } else {
        playersMeshes[id].material.color.setHex(0xf43f5e);
      }

      // Detect remote player HP drop — flash red
      if (previousPlayerHp[id] !== undefined && pData.hp < previousPlayerHp[id]) {
        flashMesh(playersMeshes[id], 0xff0000, 200);
      }
      previousPlayerHp[id] = pData.hp;
    }

    if (myId != null && playersMeshes[myId]) {
      playersMeshes[myId].position.set(myX, 0.5, myZ);

      const me = gameState.players[myId];
      const isDead = me && me.dead;

      // Respawn detection: dead → alive resets local position to spawn
      if (wasDead && !isDead) {
        myX = spawnPosition.x;
        myZ = spawnPosition.z;
        velocityX = 0;
        velocityZ = 0;
        playerRotation = 0;
      }
      wasDead = isDead;

      // Visual feedback: grey when dead, blue when alive
      if (isDead) {
        playersMeshes[myId].material.color.setHex(0x808080);
      } else {
        playersMeshes[myId].material.color.setHex(0x3b82f6);
      }

      // Detect local player HP drop — flash red + spawn damage number
      if (me && previousPlayerHp[myId] !== undefined && me.hp < previousPlayerHp[myId]) {
        const damageAmount = previousPlayerHp[myId] - me.hp;
        flashMesh(playersMeshes[myId], 0xff0000, 200);
        spawnDamageNumber(myX, 1.5, myZ, damageAmount, '#ff0000');
        playSound('playerDamage');
      }
      if (me) {
        previousPlayerHp[myId] = me.hp;
      }
    }

    // ── Enemy mesh sync ──
    const currentEnemyIds = new Set(gameState.enemies.map(e => e.id));

    for (const enemy of gameState.enemies) {
      if (!enemiesMeshes[enemy.id]) {
        const geo = new THREE.ConeGeometry(0.5, 1, 8);
        const mat = new THREE.MeshStandardMaterial({ color: 0xdc2626 });
        const mesh = new THREE.Mesh(geo, mat);
        scene.add(mesh);
        enemiesMeshes[enemy.id] = mesh;

        // Create health bar for new enemy
        enemyHealthBars[enemy.id] = createHealthBarMesh(enemy.id, enemy.x, enemy.z);
      }
      enemiesMeshes[enemy.id].position.set(enemy.x, 0.5, enemy.z);

      // Update health bar position, scale, and color
      enemyHealthBars[enemy.id].position.set(enemy.x, 1.5, enemy.z);
      updateHealthBarMesh(enemy.id, enemy);

      // Detect HP drop (minion tick damage) — skip if caused by a recent cardUsed hit
      if (previousEnemyHp[enemy.id] !== undefined && enemy.hp < previousEnemyHp[enemy.id]) {
        const cardHit = lastCardHitTime[enemy.id];
        const withinGrace = cardHit !== undefined && (performance.now() - cardHit) < CARD_HIT_GRACE_MS;
        if (!withinGrace) {
          flashMesh(enemiesMeshes[enemy.id], 0xff4444, 150);

          // Spawn hit spark at enemy position
          spawnHitSpark({ x: enemy.x, y: 1.0, z: enemy.z });

          // Flash the nearest living minion (to show which minion attacked)
          let nearestMinion = null;
          let nearestMinionDist = Infinity;
          for (const m of (gameState.minions || [])) {
            const mdist = Math.hypot(m.x - enemy.x, m.z - enemy.z);
            if (mdist < nearestMinionDist && minionsMeshes[m.id]) {
              nearestMinionDist = mdist;
              nearestMinion = m;
            }
          }
          if (nearestMinion && minionsMeshes[nearestMinion.id]) {
            flashMesh(minionsMeshes[nearestMinion.id], 0x88ff88, 200);
          }
        }
      }
      previousEnemyHp[enemy.id] = enemy.hp;

      // ── Telegraph visuals (windup state) ──
      if (enemy.attackState === 'windup') {
        // Set windup emissive exactly once on entering windup
        applyWindupFlash(enemy.id, true);

        // Create or update warning circle at the target player's position
        if (!telegraphMeshes[enemy.id]) {
          const targetPlayer = enemy.windupTargetId ? gameState.players[enemy.windupTargetId] : null;
          const tx = targetPlayer ? targetPlayer.x : enemy.x;
          const tz = targetPlayer ? targetPlayer.z : enemy.z;

          const geo = new THREE.RingGeometry(ENEMY_ATTACK_RANGE * 0.9, ENEMY_ATTACK_RANGE, 32);
          const mat = new THREE.MeshStandardMaterial({
            color: 0xff3333,
            emissive: 0xff3333,
            emissiveIntensity: 1.0,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthWrite: false
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(tx, 0.05, tz);
          mesh.rotation.x = -Math.PI / 2; // lie flat on ground
          scene.add(mesh);
          telegraphMeshes[enemy.id] = mesh;
        } else {
          // Update position in case target player moved
          const targetPlayer = enemy.windupTargetId ? gameState.players[enemy.windupTargetId] : null;
          if (targetPlayer) {
            telegraphMeshes[enemy.id].position.set(targetPlayer.x, 0.05, targetPlayer.z);
          }
        }
      } else {
        // Remove telegraph if it exists and enemy is no longer in windup
        if (telegraphMeshes[enemy.id]) {
          scene.remove(telegraphMeshes[enemy.id]);
          telegraphMeshes[enemy.id].geometry.dispose();
          telegraphMeshes[enemy.id].material.dispose();
          delete telegraphMeshes[enemy.id];
        }

        // Restore original emissive when leaving windup
        applyWindupFlash(enemy.id, false);
      }
    }

    // Clean up removed enemies (also clean up health bars and previous HP tracking)
    for (const id of Object.keys(enemiesMeshes)) {
      if (!currentEnemyIds.has(id)) {
        scene.remove(enemiesMeshes[id]);
        delete enemiesMeshes[id];
      }
    }
    for (const id of Object.keys(enemyHealthBars)) {
      if (!currentEnemyIds.has(id)) {
        scene.remove(enemyHealthBars[id]);
        enemyHealthBars[id].geometry.dispose();
        enemyHealthBars[id].material.dispose();
        delete enemyHealthBars[id];
      }
    }
    for (const id of Object.keys(previousEnemyHp)) {
      if (!currentEnemyIds.has(id)) {
        delete previousEnemyHp[id];
      }
    }
    // Clean up telegraph meshes for removed enemies
    for (const id of Object.keys(telegraphMeshes)) {
      if (!currentEnemyIds.has(id)) {
        scene.remove(telegraphMeshes[id]);
        telegraphMeshes[id].geometry.dispose();
        telegraphMeshes[id].material.dispose();
        delete telegraphMeshes[id];
      }
    }
    // Clean up windupFlashing entries for removed enemies
    for (const id of [...windupFlashing]) {
      if (!currentEnemyIds.has(id)) {
        windupFlashing.delete(id);
      }
    }

    // ── Minion mesh sync ──
    const currentMinionIds = new Set(gameState.minions ? gameState.minions.map(m => m.id) : []);

    for (const minion of (gameState.minions || [])) {
      if (!minionsMeshes[minion.id]) {
        const geo = new THREE.CylinderGeometry(0.4, 0.4, 1, 8);
        const mat = new THREE.MeshStandardMaterial({ color: 0x22c55e });
        const mesh = new THREE.Mesh(geo, mat);
        scene.add(mesh);
        minionsMeshes[minion.id] = mesh;
      }
      minionsMeshes[minion.id].position.set(minion.x, 0.5, minion.z);
    }

    // Clean up removed minions
    for (const id of Object.keys(minionsMeshes)) {
      if (!currentMinionIds.has(id)) {
        scene.remove(minionsMeshes[id]);
        minionsMeshes[id].geometry.dispose();
        minionsMeshes[id].material.dispose();
        delete minionsMeshes[id];
      }
    }

    // ── Loot mesh sync ──
    syncLootMeshes();
  }

  // Animate loot coins (outside gameState guard so coins animate even when gameState is null)
  animateLootMeshes();

  if (myId != null && playersMeshes[myId]) {
    const target = playersMeshes[myId].position.clone().add(CAMERA_OFFSET);
    camera.position.lerp(target, 5.0 * delta);
    camera.lookAt(playersMeshes[myId].position);
  }

  // Animate attack visual effects
  updateAttackEffects();

  // Update floating damage numbers
  updateDamageNumbers();

  // Update collecting-loot animations
  updateCollectingLoot();

  renderer.render(scene, camera);
}

function initScene() {
  console.log('[initScene] Initializing Three.js scene...');

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f172a);

  // Camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(spawnPosition.x, 5, spawnPosition.z + 10);
  camera.lookAt(spawnPosition.x, 0, spawnPosition.z);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 20, 10);
  scene.add(directionalLight);

  // Build dungeon geometry from server layout (replaces old 50x50 floor)
  if (currentLayout) {
    clearDungeon(scene, dungeonMeshes);
    const { meshes, spawnPosition: spawn } = buildDungeon(scene, currentLayout);
    dungeonMeshes.length = 0;
    dungeonMeshes.push(...meshes);
    spawnPosition.x = spawn.x;
    spawnPosition.z = spawn.z;
    wallColliders = buildWallColliders(currentLayout);
  }

  // Place player at spawn position (center of first room)
  myX = spawnPosition.x;
  myZ = spawnPosition.z;

  // Input tracking
  window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;
  });
  window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false;
  });

  // Frame timer & render loop
  clock = new THREE.Timer();
  requestAnimationFrame(animate);

  // Resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  sceneInitialized = true;
}

// Expose for later invocation (sub-ticket 03)
window.initScene = initScene;
window.refillSlot = refillSlot;
window.renderHand = renderHand;
window.renderDeckEditor = renderDeckEditor;
window.flashMesh = flashMesh;
window.spawnDamageNumber = spawnDamageNumber;
window.spawnHitSpark = spawnHitSpark;
window.markLootCollected = markLootCollected;
window.playSound = playSound;
window.__soundEnabled = () => soundEnabled;
window.__updateMuteButton = updateMuteButton;
window.__setSoundEnabled = (v) => { soundEnabled = v; updateMuteButton(); };
window.activeEffects = () => activeEffects;
window.__setScene = (s) => { window.___test_scene = s; }; // test-only: override scene for spawnHitSpark
window.___test_scene = undefined;
window.__setGameState = (gs, id) => { gameState = gs; myId = id; }; // test-only: set gameState + myId
window.enemyHealthBars = enemyHealthBars;
window.healthBarColor = healthBarColor;
window.__mySelectedDeck = () => mySelectedDeck;
window.__setDeckState = (deck, owned) => { mySelectedDeck = deck || mySelectedDeck; myOwnedCards = owned || myOwnedCards; };
window.__windupFlashing = () => windupFlashing; // test-only: access windupFlashing Set
window.__enemiesMeshes = () => enemiesMeshes;     // test-only: access enemiesMeshes map
window.applyWindupFlash = applyWindupFlash;       // test-only: expose for unit testing
window.__useCardForTest = useCard;                // test-only: expose useCard for cooldown tests
window.__AUTOGAME_HARNESS_STATE__ = () => {
  const me = gameState && myId ? gameState.players[myId] : null;
  const lobbyVisible = !!lobbyEl && !lobbyEl.classList.contains('hidden');
  const cardHandVisible = !!cardHandEl && getComputedStyle(cardHandEl).display !== 'none';

  return {
    debugScenario,
    debugScenarioAllowed,
    debugScenarioResult,
    myId,
    phase: gameState ? gameState.gamePhase : 'unknown',
    connectionState,
    sceneInitialized,
    hasCanvas: !!document.querySelector('canvas'),
    lobbyVisible,
    cardHandVisible,
    status: statusEl ? statusEl.innerText : '',
    hpText: hpText ? hpText.textContent : '',
    msText: msText ? msText.textContent : '',
    currencyText: document.getElementById('currency-display') ? document.getElementById('currency-display').textContent : '',
    player: me ? {
      hp: me.hp,
      magicStones: me.magicStones,
      debugScenario: me.debugScenario,
      dead: me.dead,
      x: me.x,
      z: me.z,
    } : null,
    players: gameState ? Object.keys(gameState.players).length : 0,
    enemies: gameState ? gameState.enemies.length : 0,
    hand: hand.map(card => card ? {
      id: card.id,
      name: card.name,
      type: card.type,
      remainingCharges: card.remainingCharges,
      charges: card.charges,
    } : null),
  };
};

// v8 ignore end
