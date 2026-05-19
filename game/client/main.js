import * as THREE from 'three';
import { io } from 'socket.io-client';
import { CARD_DEFS, CARD_TYPE_STYLE, weaponCardIds, summonCardIds, monsterCardIds } from './cards.js';
import { wallAABB, resolveWallCollision as resolveWallCollisionPure } from './collision.js';
import { drawCard, initHand as initHandFromModule, initHandFromDeck, hand, slotCooldowns } from './hand.js';

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

// Three.js references (initialized by initScene)
let scene, camera, renderer, clock;
const playersMeshes = {};
const enemiesMeshes = {};
const enemyHealthBars = {}; // enemy id → health bar mesh
const minionsMeshes = {};
const lootMeshes = {};
const activeEffects = []; // { mesh, origin, direction, createdAt, duration }
let myX = 0;
let myZ = 0;
let velocityX = 0;
let velocityZ = 0;
let playerRotation = 0; // facing angle in radians, derived from movement velocity
let wasDead = false; // tracks previous-frame dead state for respawn detection
let spawnPosition = { x: 0, z: 0 }; // center of first room, set by buildDungeon
let wallColliders = []; // flat array of wall AABBs: { minX, maxX, minZ, maxZ }

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
    } else {
      slot.style.removeProperty('--slot-color');
      slot.innerHTML = '<span class="card-name">&mdash;</span>';
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

  // (1) Emit useCard — fires on every call, including during cooldown
  socket.emit('useCard', { slotIndex, cardId: card.id });

  // (1b) For monster cards: single-use, consumed optimistically (like weapons)
  if (monsterCardIds.has(card.id)) {
    hand[slotIndex] = null;
    const newCard = drawCard();
    if (newCard) hand[slotIndex] = newCard;
    renderHand();
    if (slotCooldowns[slotIndex]) return;
    slotCooldowns[slotIndex] = true;
    playActivationEffect(slotIndex);
    return;
  }

  // (2) For summon cards: skip optimistic consumption — wait for server
  //     confirmation (cardUsed) before removing the card. This way, if the
  //     server rejects (e.g. not enough Magic Stones), the card stays in hand.
  if (summonCardIds.has(card.id)) {
    // Still fire the activation/cooldown visual
    if (!slotCooldowns[slotIndex]) {
      slotCooldowns[slotIndex] = true;
      playActivationEffect(slotIndex);
    }
    return;
  }

  // (2) Decrement charges + exhaust/redraw — non-summon cards only
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

  // (3) Visual flash + cooldown flag — only when NOT already in cooldown
  if (slotCooldowns[slotIndex]) return;

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
      currencyEl.textContent = `GOLD ${gameState.players[myId].currency}`;
    }

    // Sync ownedCards from server state if present
    if (gameState.players[myId].ownedCards) {
      myOwnedCards = gameState.players[myId].ownedCards;
    }
  }

  // Update objective HUD
  updateObjectiveHud();
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

// Track which enemy IDs were just hit by a cardUsed event (so we don't double-flash on the next stateUpdate)
const hitFlashedThisFrame = new Set();

// Track per-enemy HP from the previous frame, for detecting minion tick damage
const previousEnemyHp = {};

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

function syncLootMeshes() {
  if (!gameState || !gameState.loot) return;

  const currentLootIds = new Set(gameState.loot.map(l => l.id));

  // Add / update new loot
  for (const item of gameState.loot) {
    if (!lootMeshes[item.id]) {
      const mesh = new THREE.Mesh(lootGeometry, lootMaterial);
      mesh.position.set(item.x, 0.5, item.z);
      scene.add(mesh);
      lootMeshes[item.id] = mesh;
    }
  }

  // Remove stale loot
  for (const id of Object.keys(lootMeshes)) {
    if (!currentLootIds.has(id)) {
      scene.remove(lootMeshes[id]);
      // Do NOT dispose geometry or material — both are shared
      delete lootMeshes[id];
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
    for (const hit of data.hits) {
      const mesh = enemiesMeshes[hit.enemyId];
      if (mesh) {
        flashMesh(mesh, 0xffffff, 200);
        hitFlashedThisFrame.add(hit.enemyId);
      }
    }
  }
});

socket.on('cardError', (data) => {
  if (!data || !data.reason) return;
  showCardErrorToast(data.reason);
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

// ── Dungeon geometry builder ──

const WALL_HEIGHT = 2.5;
const WALL_THICKNESS = 0.4;
const FLOOR_Y = 0.05; // slightly above background to avoid z-fighting
const PASSAGE_WIDTH = 4; // matches server constant
const PASSAGE_WALL_HEIGHT = 1.5;
const PASSAGE_WALL_THICKNESS = 0.3;

const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
const passageFloorMaterial = new THREE.MeshStandardMaterial({ color: 0x2d3a4a, roughness: 0.8 });
const passageWallMaterial = new THREE.MeshStandardMaterial({ color: 0x3d4f63, roughness: 0.7 });

// Background ground plane (replaces the old 50x50 floor)
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 1.0 });

// Shared gold material for loot coins
const lootMaterial = new THREE.MeshStandardMaterial({
  color: 0xffd700,
  emissive: 0xffa500,
  emissiveIntensity: 0.4,
  roughness: 0.3,
  metalness: 0.8
});

// Track all meshes created by buildDungeon() so they can be cleared on rebuild
const dungeonMeshes = [];

/**
 * Remove all dungeon geometry from the scene and dispose geometries.
 * Shared materials are NOT disposed (they are reused across builds).
 */
function clearDungeon() {
  for (const mesh of dungeonMeshes) {
    if (scene) scene.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    // Do NOT dispose materials — they are shared module-level constants
  }
  dungeonMeshes.length = 0;
}

function buildDungeon(layout) {
  if (!layout || !layout.rooms || !layout.passages) return;

  // Clear any previous dungeon geometry before rebuilding
  clearDungeon();
  wallColliders.length = 0;

  // Background ground (large flat plane behind everything)
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const ground = new THREE.Mesh(groundGeo, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);
  dungeonMeshes.push(ground);

  // Set spawn position to center of first room
  if (layout.rooms.length > 0) {
    spawnPosition.x = layout.rooms[0].x;
    spawnPosition.z = layout.rooms[0].z;
  }

  // ── Build rooms ──
  for (const room of layout.rooms) {
    // Room floor tile (raised slightly)
    const floorGeo = new THREE.BoxGeometry(room.width, 0.1, room.depth);
    const floorMesh = new THREE.Mesh(floorGeo, floorMaterial);
    floorMesh.position.set(room.x, FLOOR_Y, room.z);
    scene.add(floorMesh);
    dungeonMeshes.push(floorMesh);

    // Room walls
    for (const wall of room.walls) {
      let wallGeo;
      let wallX, wallZ;

      if (wall.axis === 'x') {
        // Wall runs along x-axis
        wallGeo = new THREE.BoxGeometry(wall.length, WALL_HEIGHT, WALL_THICKNESS);
        wallX = wall.x;
        wallZ = wall.z;
      } else {
        // Wall runs along z-axis
        wallGeo = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, wall.length);
        wallX = wall.x;
        wallZ = wall.z;
      }

      const wallMesh = new THREE.Mesh(wallGeo, wallMaterial);
      wallMesh.position.set(wallX, WALL_HEIGHT / 2 + FLOOR_Y, wallZ);
      scene.add(wallMesh);
      dungeonMeshes.push(wallMesh);
    }
  }

  // ── Build passages ──
  for (const passage of layout.passages) {
    const dx = passage.x2 - passage.x1;
    const dz = passage.z2 - passage.z1;
    const dist = Math.hypot(dx, dz);

    // Passage floor strip
    const passageFloorGeo = new THREE.BoxGeometry(dist, 0.1, PASSAGE_WIDTH);
    const passageFloor = new THREE.Mesh(passageFloorGeo, passageFloorMaterial);
    const midX = (passage.x1 + passage.x2) / 2;
    const midZ = (passage.z1 + passage.z2) / 2;
    passageFloor.position.set(midX, FLOOR_Y, midZ);
    passageFloor.rotation.y = Math.atan2(dz, dx);
    scene.add(passageFloor);
    dungeonMeshes.push(passageFloor);

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

      const wallMesh = new THREE.Mesh(wallGeo, passageWallMaterial);
      wallMesh.position.set(wallX, PASSAGE_WALL_HEIGHT / 2 + FLOOR_Y, wallZ);
      scene.add(wallMesh);
      dungeonMeshes.push(wallMesh);
    }
  }
}

// ── Wall collision helpers ──
// wallAABB and resolveWallCollision are imported from collision.js

function buildWallColliders(layout) {
  wallColliders = [];
  if (!layout || !layout.rooms || !layout.passages) return;

  for (const room of layout.rooms) {
    for (const wall of room.walls) {
      wallColliders.push(wallAABB(wall, WALL_THICKNESS / 2));
    }
  }
  for (const passage of layout.passages) {
    for (const wall of passage.walls) {
      wallColliders.push(wallAABB(wall, PASSAGE_WALL_THICKNESS / 2));
    }
  }
}

function resolveWallCollision(newX, newZ) {
  // Delegate to the pure helper, passing the current wall colliders
  return resolveWallCollisionPure(newX, newZ, wallColliders);
}

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
  const resolved = resolveWallCollision(myX, myZ);
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

  // Clear per-frame flash dedup set at the start of each frame
  hitFlashedThisFrame.clear();

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

      // Detect HP drop (minion tick damage) — skip if already flashed by cardUsed
      if (previousEnemyHp[enemy.id] !== undefined && enemy.hp < previousEnemyHp[enemy.id]) {
        if (!hitFlashedThisFrame.has(enemy.id)) {
          flashMesh(enemiesMeshes[enemy.id], 0xff4444, 150);
        }
      }
      previousEnemyHp[enemy.id] = enemy.hp;
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
    buildDungeon(currentLayout);
    buildWallColliders(currentLayout);
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
window.renderDeckEditor = renderDeckEditor;
window.flashMesh = flashMesh;
window.enemyHealthBars = enemyHealthBars;
window.healthBarColor = healthBarColor;
window.__mySelectedDeck = () => mySelectedDeck;
window.__setDeckState = (deck, owned) => { mySelectedDeck = deck || mySelectedDeck; myOwnedCards = owned || myOwnedCards; };
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
