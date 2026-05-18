import * as THREE from 'three';
import { io } from 'socket.io-client';
import { CARD_DEFS, createStartingDeck, CARD_TYPE_STYLE, weaponCardIds, summonCardIds } from './cards.js';

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
const cardSlots = document.querySelectorAll('.card-slot');

// Socket setup
const socket = io();
let myId = null;
let isReady = false;
let gameState = null;
let connectionState = 'connecting';
let heartbeatTimer = null;
let latency = null;
let sceneInitialized = false;

// ── Hand state ──
let hand = [];       // array of 4 card objects: { id, name, type, charges, remainingCharges }
let deck = [];       // remaining card id strings to draw from
let slotCooldowns = [false, false, false, false];   // per-slot cooldown guard

// Three.js references (initialized by initScene)
let scene, camera, renderer, clock;
const playersMeshes = {};
const enemiesMeshes = {};
const activeEffects = []; // { mesh, origin, direction, createdAt, duration }
let myX = 0;
let myZ = 0;
let velocityX = 0;
let velocityZ = 0;
let playerRotation = 0; // facing angle in radians, derived from movement velocity
let wasDead = false; // tracks previous-frame dead state for respawn detection

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

function drawCard() {
  if (deck.length === 0) return null;
  const cardId = deck.pop();
  const def = CARD_DEFS[cardId];
  if (!def) return null;
  return {
    id: def.id,
    name: def.name,
    type: def.type,
    charges: def.charges,
    remainingCharges: def.charges,
  };
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
  const deckIds = createStartingDeck();
  hand = [];
  deck = [];
  slotCooldowns = [false, false, false, false];

  // Put all card IDs into deck, then pop 4 for the initial hand
  for (let i = deckIds.length - 1; i >= 0; i--) {
    deck.push(deckIds[i]);
  }

  // Deal first 4 cards from deck into hand
  for (let i = 0; i < 4; i++) {
    const card = drawCard();
    if (card) hand.push(card);
  }

  renderHand();
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

  // If the server is already in 'playing' phase, skip the lobby entirely
  if (data.state && data.state.gamePhase === 'playing') {
    if (sceneInitialized) return;
    lobbyEl.classList.add('hidden');
    uiEl.style.display = 'block';
    cardHandEl.style.display = 'flex';
    initHand();
    initScene();
    return;
  }
});

socket.on('stateUpdate', (state) => {
  gameState = state;
});

socket.on('heartbeat_ack', (data) => {
  if (connectionState === 'connected') {
    latency = data.latency;
    statusEl.innerText = `Latency: ${latency}ms`;
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

socket.on('cardUsed', (data) => {
  if (!data || !scene) return;

  // Handle confirmed summon play for the local player: consume the card
  if (data.playerId === myId && summonCardIds.has(data.cardId)) {
    // Find the slot holding this card and remove it, then draw replacement
    for (let i = 0; i < hand.length; i++) {
      if (hand[i] && hand[i].id === data.cardId) {
        hand[i] = null;
        const newCard = drawCard();
        if (newCard) {
          hand[i] = newCard;
        }
        renderHand();
        break;
      }
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
});

socket.on('cardError', (data) => {
  if (!data || !data.reason) return;
  showCardErrorToast(data.reason);
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
  if (sceneInitialized) return; // Guard: only init once
  lobbyEl.classList.add('hidden');
  uiEl.style.display = 'block';
  cardHandEl.style.display = 'flex';
  initHand();
  initScene();
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

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  updateMyPlayer(delta);

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

      // Respawn detection: dead → alive resets local position to origin
      if (wasDead && !isDead) {
        myX = 0;
        myZ = 0;
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
      }
      enemiesMeshes[enemy.id].position.set(enemy.x, 0.5, enemy.z);
    }

    // Clean up removed enemies
    for (const id of Object.keys(enemiesMeshes)) {
      if (!currentEnemyIds.has(id)) {
        scene.remove(enemiesMeshes[id]);
        delete enemiesMeshes[id];
      }
    }
  }

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
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);

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

  // Floor
  const floorGeometry = new THREE.PlaneGeometry(50, 50);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Input tracking
  window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;
  });
  window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false;
  });

  // Clock & render loop
  clock = new THREE.Clock();
  animate();

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
