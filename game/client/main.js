import * as THREE from 'three';
import { io } from 'socket.io-client';
import { CARD_DEFS, CARD_TYPE_STYLE, weaponCardIds, summonCardIds, monsterCardIds } from './cards.js';
import { drawCard, initHand as initHandFromModule, hand, slotCooldowns, canUseSlot } from './hand.js';
import { clampDelta } from './delta.js';
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
import {
	DECK_MIN_SIZE,
	DECK_MAX_SIZE,
	ENEMY_ATTACK_RANGE,
	MAX_HP,
	MAX_MS,
	CARD_HIT_GRACE_MS,
	ATTACK_EFFECT_DURATION,
	ATTACK_EFFECT_SPEED,
	SUMMON_EFFECT_DURATION,
	SUMMON_EXPAND_MS,
	HIT_SPARK_DURATION,
	LOOT_COLLECT_DURATION,
	DAMAGE_NUMBER_DURATION,
	CAMERA_FOV,
	CAMERA_NEAR,
	CAMERA_FAR,
	MOVE_SPEED,
	MAX_ELAPSED_MS,
	CAMERA_OFFSET as CAMERA_OFFSET_CONFIG,
	SOUND_CONFIG,
} from './config.js';

// v8 ignore start
// All code below is UI/Three.js/Socket-dependent and cannot be unit tested.
// Testable logic is extracted to cards.js, collision.js, and hand.js.

const statusEl = document.getElementById('status');
const lobbyPlayerList = document.getElementById('lobby-player-list');
const readyBtn = document.getElementById('ready-btn');
const lobbyEl = document.getElementById('lobby');
const uiEl = document.getElementById('ui');
const logoutBtn = document.getElementById('logout-btn');
const cardHandEl = document.getElementById('card-hand');

// ── Auth overlay elements ──
const authOverlayEl = document.getElementById('auth-overlay');
const registerFormEl = document.getElementById('register-form');
const loginFormEl = document.getElementById('login-form');
const registerBtnEl = document.getElementById('register-btn');
const loginBtnEl = document.getElementById('login-btn');
const registerErrorEl = document.getElementById('register-error');
const loginErrorEl = document.getElementById('login-error');
const showLoginLinkEl = document.getElementById('show-login-link');
const showRegisterLinkEl = document.getElementById('show-register-link');

const TOKEN_KEY = 'autogame_token';

/**
 * Show the auth overlay and hide the lobby.
 */
function showAuthOverlay() {
  if (authOverlayEl) authOverlayEl.classList.remove('hidden');
  if (lobbyEl) lobbyEl.classList.add('hidden');
}

/**
 * Hide the auth overlay and show the lobby.
 */
function hideAuthOverlay() {
  if (authOverlayEl) authOverlayEl.classList.add('hidden');
  if (lobbyEl) lobbyEl.classList.remove('hidden');
}

/**
 * Show the registration form and hide the login form.
 */
function showRegisterForm() {
  if (registerFormEl) registerFormEl.classList.remove('hidden');
  if (loginFormEl) loginFormEl.classList.add('hidden');
  if (registerErrorEl) registerErrorEl.textContent = '';
}

/**
 * Show the login form and hide the registration form.
 */
function showLoginForm() {
  if (loginFormEl) loginFormEl.classList.remove('hidden');
  if (registerFormEl) registerFormEl.classList.add('hidden');
  if (loginErrorEl) loginErrorEl.textContent = '';
}

/**
 * Clear form inputs and error messages.
 */
function clearAuthForms() {
  const inputs = authOverlayEl ? authOverlayEl.querySelectorAll('input') : [];
  inputs.forEach(i => (i.value = ''));
  if (registerErrorEl) registerErrorEl.textContent = '';
  if (loginErrorEl) loginErrorEl.textContent = '';
}

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

// Socket setup — lazy-created so we can attach JWT auth after login
const STORAGE_KEY_PLAYER_ID = 'autogame_playerId';
const storedPlayerId = (() => {
  try { return localStorage.getItem(STORAGE_KEY_PLAYER_ID); } catch (_) { return null; }
})();
const storedToken = (() => {
  try { return localStorage.getItem(TOKEN_KEY); } catch (_) { return null; }
})();

let socket = null;

/**
 * Create (or recreate) the Socket.IO connection with a JWT auth token.
 * A valid token is required — anonymous connections are no longer supported.
 * @param {string} token - JWT token to send in auth payload
 */
function createSocket(token) {
  if (socket) {
    socket.disconnect();
  }
  socket = io({ auth: { token } });
  bindSocketHandlers(socket);
}

/**
 * Bind all Socket.IO event listeners to the given socket instance.
 * Called from createSocket() so handlers are wired after each (re)connection.
 * This ensures that after login (which replaces the socket), the authenticated
 * connection receives all game events.
 * @param {Object} s - the socket instance to bind handlers on
 */
function bindSocketHandlers(s) {
  if (!s) return;

  s.on('connect', () => {
    updateStatus('Connected', 'connected');
    startHeartbeat();
  });

  s.on('disconnect', () => {
    stopHeartbeat();
    updateStatus('Disconnected', 'disconnected');
    disposeAllLootMeshes();
  });

  s.io.on('reconnect_attempt', () => {
    updateStatus('Reconnecting...', 'reconnecting');
  });

  s.io.on('reconnect', () => {
    updateStatus('Connected', 'connected');
    startHeartbeat();
  });

  s.on('connect_error', (reason) => {
    // Server disconnected because of an invalid/expired JWT.
    // Clear the bad token, destroy the socket (prevents auto-reconnect),
    // and return the user to the auth overlay.
    try { localStorage.removeItem(TOKEN_KEY); } catch (_) {}
    stopHeartbeat();
    s.io.disconnect(); // destroy socket — prevents Socket.IO auto-reconnect with bad token
    if (uiEl) uiEl.style.display = 'none';
    if (cardHandEl) cardHandEl.style.display = 'none';
    if (lobbyEl) lobbyEl.classList.add('hidden');
    if (runSummaryOverlay) runSummaryOverlay.style.display = 'none';
    showAuthOverlay();
    showLoginForm();
    updateStatus('Session expired — please log in again', 'disconnected');
  });

  s.on('init', (data) => {
    myId = data.id;
    // Store stable playerId for reconnect sessions
    if (data.playerId) {
      try { localStorage.setItem(STORAGE_KEY_PLAYER_ID, data.playerId); } catch (_) {}
    }
    gameState = data.state;
    currentLayout = data.layout || (data.state && data.state.layout) || currentLayout;
    if (gameState && currentLayout) gameState.layout = currentLayout;

    // Initialize deck editor state from server
    mySelectedDeck = data.selectedDeck || [];
    myOwnedCards = data.ownedCards || {};
    renderDeckEditor();

    // ── Auth: display username and show logout button if logged in ──
    if (data.accountId) {
      const username = data.username || data.accountId;
      if (statusEl) statusEl.textContent = `Logged in as ${username}`;
      if (logoutBtn) logoutBtn.classList.remove('hidden');
      if (lobbyEl) lobbyEl.classList.remove('hidden');
    }

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

  s.on('stateUpdate', (state) => {
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

    // Reconcile hand with server authority + re-render for .no-ms / .empty classes
    if (state.gamePhase === 'playing' && myId && state.players[myId] && state.players[myId].hand) {
      const serverHand = state.players[myId].hand;
      let changed = false;
      for (let i = 0; i < 4; i++) {
        const serverCard = serverHand[i];
        const localCard = hand[i];
        if (!serverCard && !localCard) continue;
        if (!serverCard || !localCard || localCard.id !== serverCard.id ||
            localCard.remainingCharges !== serverCard.remainingCharges ||
            localCard.charges !== serverCard.charges) {
          hand[i] = serverCard ? { ...serverCard } : null;
          changed = true;
        }
      }
      if (changed) renderHand();
    } else if (state.gamePhase === 'playing') {
      renderHand();
    }

    // Prune pickedUpLootIds: remove any IDs no longer present in gameState.loot
    // so that a respawned item reusing the same ID can be picked up again.
    if (state.loot && Array.isArray(state.loot)) {
      const currentLootIds = new Set(state.loot.map(l => l.id));
      for (const id of pickedUpLootIds) {
        if (!currentLootIds.has(id)) {
          pickedUpLootIds.delete(id);
        }
      }
    }

    // ── Client prediction reconciliation ──
    // After each stateUpdate, compare the client's predicted position against
    // the server's authoritative position. If the drift exceeds a threshold,
    // snap back to the server truth to correct for network lag or desync.
    if (state.gamePhase === 'playing' && myId && gameState.players[myId]) {
      const serverPlayer = gameState.players[myId];
      if (!serverPlayer.dead) {
        const dx = serverPlayer.x - myX;
        const dz = serverPlayer.z - myZ;
        const drift = Math.hypot(dx, dz);
        if (drift > 0.5) {
          myX = serverPlayer.x;
          myZ = serverPlayer.z;
        }
      }
    }
  });

  s.on('heartbeat_ack', (data) => {
    if (connectionState === 'connected') {
      latency = data.latency;
      statusEl.innerText = `Latency: ${latency}ms`;
    }
  });

  s.on('debugScenarioResult', (data) => {
    debugScenarioResult = data || null;
    if (data && data.ok) {
      console.log(`[debugScenario] applied ${data.scenario}`);
    } else if (data && data.reason) {
      console.warn(`[debugScenario] ${data.reason}`);
    }
  });

  s.on('playerDisconnected', (id) => {
    if (playersMeshes[id]) {
      if (scene) {
        scene.remove(playersMeshes[id]);
      }
      delete playersMeshes[id];
    }
    delete previousPlayerHp[id];
  });

  s.on('cardUsed', (data) => {
    if (!data || !scene) return;
    playSound('card');
    if (weaponCardIds.has(data.cardId)) {
      const origin = data.origin || { x: 0, z: 0 };
      const direction = data.direction || { x: 1, z: 0 };
      spawnAttackEffect(origin, direction);
    }
    if (summonCardIds.has(data.cardId) && data.radius !== undefined) {
      const origin = data.origin || { x: 0, z: 0 };
      spawnSummonEffect(origin, data.radius);
    }
    if (data.hits && data.hits.length > 0) {
      playSound('enemyHit');
      const now = performance.now();
      for (const hit of data.hits) {
        const mesh = enemiesMeshes[hit.enemyId];
        if (mesh) {
          flashMesh(mesh, 0xffffff, 200);
          lastCardHitTime[hit.enemyId] = now;
        }
      }
    }
  });

  s.on('cardError', (data) => {
    if (!data || !data.reason) return;
    showCardErrorToast(data.reason);
    if (data.reason === 'Not enough Magic Stones' && lastUsedSlot >= 0) {
      const slot = cardSlots[lastUsedSlot];
      if (slot) slot.classList.add('no-ms');
    }
    lastUsedSlot = -1;
  });

  s.on('deckUpdate', (data) => {
    if (!data) return;
    if (data.selectedDeck) mySelectedDeck = data.selectedDeck;
    if (data.ownedCards) myOwnedCards = data.ownedCards;
    renderDeckEditor();
  });

  s.on('deckError', (data) => {
    if (!data || !data.reason) return;
    showDeckError(data.reason);
  });

  s.on('lobbyUpdate', (data) => {
    renderPlayerList(data.players);
    if (data.players && myId) {
      const me = data.players.find(p => p.id === myId);
      if (me) {
        isReady = me.ready;
        readyBtn.textContent = isReady ? 'Ready!' : 'Ready';
      }
    }
  });

  s.on('startGame', () => {
    lobbyEl.classList.add('hidden');
    uiEl.style.display = 'block';
    cardHandEl.style.display = 'flex';
    updateObjectiveHud();
    if (!sceneInitialized) {
      initHand();
      initScene();
      return;
    }
    initHand();
    myX = spawnPosition.x;
    myZ = spawnPosition.z;
    playerRotation = 0;
    wasDead = false;
    disposeMeshMap(enemiesMeshes, scene);
    disposeMeshMap(enemyHealthBars, scene);
    disposeMeshMap(telegraphMeshes, scene);
    disposeMeshMap(minionsMeshes, scene);
    disposeMeshMap(lootMeshes, scene, true);
    windupFlashing.clear();
  });

  s.on('runComplete', showRunSummary);
  s.on('runFailed', showRunSummary);
}

// On page load: only connect if we have a stored token; otherwise show auth overlay.
if (storedToken) {
  createSocket(storedToken);
  hideAuthOverlay();
} else {
  showAuthOverlay();
  showRegisterForm();
}

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

// ── Audio system ──

let soundEnabled = true;
let audioCtx = null;

/**
 * Play a short oscillator-based sound effect via the Web Audio API.
 * Never throws — catches errors silently if AudioContext is unavailable or blocked.
 * @param {string} type - one of 'card', 'enemyHit', 'playerDamage', 'loot', 'victory', 'failure'
 */
const _playSoundCallLog = []; // test-only: tracks playSound(type) calls
const _soundLogEnabled = typeof window !== 'undefined' && !!window.__soundLogEnabled; // test-only flag — disabled in production
function playSound(type) {
  if (_soundLogEnabled) _playSoundCallLog.push(type);
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
let playerRotation = 0; // facing angle in radians, derived from movement direction
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

function updateHpBar(hp) {
  const clamped = Math.max(0, Math.min(MAX_HP, hp));
  const pct = (clamped / MAX_HP) * 100;
  hpBarFill.style.width = `${pct}%`;
  hpText.textContent = `${clamped}/${MAX_HP}`;
  hpLabel.textContent = myId ? `${myId.slice(0, 8)} HP` : 'HP';

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
			slot.dataset.cardType = card.type;

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
			delete slot.dataset.cardType;
		}
	}
}

function initHand() {
	const serverHand = (gameState && gameState.players && gameState.players[myId])
		? gameState.players[myId].hand
		: null;

	if (Array.isArray(serverHand) && serverHand.length > 0) {
		// Use server-authoritative hand
		for (let i = 0; i < 4; i++) {
			hand[i] = serverHand[i] ? { ...serverHand[i] } : null;
		}
		renderHand();
		return;
	}

	// Fallback: init before run starts — use module's default starting deck
	initHandFromModule(renderHand);
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

  // (1b) For monster cards: skip optimistic consumption — wait for server
  //     confirmation (stateUpdate reconciliation) before removing/redrawing.
  if (monsterCardIds.has(card.id)) {
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

// ── Auth form event handlers ──

// Toggle: show login form
if (showLoginLinkEl) {
  showLoginLinkEl.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
  });
}

// Toggle: show register form
if (showRegisterLinkEl) {
  showRegisterLinkEl.addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterForm();
  });
}

// Register button
if (registerBtnEl) {
  registerBtnEl.addEventListener('click', async () => {
    const usernameInput = document.getElementById('register-username');
    const passwordInput = document.getElementById('register-password');
    if (!usernameInput || !passwordInput) return;

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (registerErrorEl) registerErrorEl.textContent = '';

    if (!username || !password) {
      if (registerErrorEl) registerErrorEl.textContent = 'Username and password are required';
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        // Registration succeeded — switch to login form
        if (registerErrorEl) {
          registerErrorEl.textContent = 'Account created — please login';
          registerErrorEl.style.color = '#4ade80';
        }
        showLoginForm();
      } else {
        if (registerErrorEl) registerErrorEl.textContent = data.error || 'Registration failed';
      }
    } catch (err) {
      if (registerErrorEl) registerErrorEl.textContent = 'Network error — check connection';
    }
  });
}

// Login button
if (loginBtnEl) {
  loginBtnEl.addEventListener('click', async () => {
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    if (!usernameInput || !passwordInput) return;

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (loginErrorEl) loginErrorEl.textContent = '';

    if (!username || !password) {
      if (loginErrorEl) loginErrorEl.textContent = 'Username and password are required';
      return;
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        // Store token and connect
        try { localStorage.setItem(TOKEN_KEY, data.token); } catch (_) {}
        createSocket(data.token);
        hideAuthOverlay();
        clearAuthForms();
      } else {
        if (loginErrorEl) loginErrorEl.textContent = data.error || 'Login failed';
      }
    } catch (err) {
      if (loginErrorEl) loginErrorEl.textContent = 'Network error — check connection';
    }
  });
}

// Logout button
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch (_) {}
    if (socket) {
      socket.disconnect();
    }
    // Reset UI state
    myId = null;
    if (logoutBtn) logoutBtn.classList.add('hidden');
    if (uiEl) uiEl.style.display = 'none';
    if (cardHandEl) cardHandEl.style.display = 'none';
    if (lobbyEl) lobbyEl.classList.add('hidden');
    updateStatus('Disconnected', 'disconnected');
    showAuthOverlay();
    showRegisterForm();
    clearAuthForms();
  });
}

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
	const origEmissive = mat.emissive ? (mat.emissive.getHex ? mat.emissive.getHex() : 0x000000) : 0x000000;
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

// Track per-enemy HP from the previous frame, for detecting minion tick damage
const previousEnemyHp = {};

// Track per-player HP from the previous frame, for detecting damage taken between state updates
const previousPlayerHp = {};

// Throttle: track loot IDs already emitted for pickup; pruned on each stateUpdate to drop IDs no longer present in state.loot
const pickedUpLootIds = new Set();

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
		duration: DAMAGE_NUMBER_DURATION
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

		// Hide if behind camera (vec.z > 1)
		if (vec.z > 1) {
			dn.element.style.display = 'none';
		} else {
			dn.element.style.display = 'block';
			dn.element.style.left = `${sx}px`;
			dn.element.style.top = `${sy}px`;
			dn.element.style.opacity = String(Math.max(0, opacity));
		}
	}
}

// ── Enemy mesh creation ──

/**
 * Single source of truth for per-enemy-type geometry parameters and visual style.
 * Both `createEnemyMesh()` and `enemyMeshHalfHeight()` derive from this map.
 */
const ENEMY_GEOMETRY = {
	grunt:      { type: 'cone', radius: 0.5, height: 1, segments: 8, color: 0xdc2626 },
	skirmisher: { type: 'cone', radius: 0.3, height: 0.6, segments: 8, color: 0xff6600 },
	miniboss:   { type: 'cone', radius: 0.8, height: 1.8, segments: 12, color: 0x8800cc },
	spawner:    { type: 'octahedron', radius: 0.6, color: 0x00ccaa, emissive: 0x00ccaa, emissiveIntensity: 0.4 },
};

/**
 * Return the half-height for an enemy type (used to position mesh on ground).
 * Derives from geometry: `height / 2` for cones, `radius` for octahedra.
 */
function enemyMeshHalfHeight(type) {
	const def = ENEMY_GEOMETRY[type] || ENEMY_GEOMETRY.grunt;
	return def.type === 'octahedron' ? def.radius : def.height / 2;
}

/**
 * Create a Three.js mesh for an enemy based on its type.
 * @param {string} type - 'grunt', 'skirmisher', 'miniboss', or 'spawner'
 * @returns {THREE.Mesh}
 */
function createEnemyMesh(type) {
	const def = ENEMY_GEOMETRY[type] || ENEMY_GEOMETRY.grunt;
	let geo;
	if (def.type === 'octahedron') {
		geo = new THREE.OctahedronGeometry(def.radius);
	} else {
		geo = new THREE.ConeGeometry(def.radius, def.height, def.segments);
	}

	const matProps = { color: def.color };
	if (def.emissive != null) matProps.emissive = def.emissive;
	if (def.emissiveIntensity != null) matProps.emissiveIntensity = def.emissiveIntensity;

	const mat = new THREE.MeshStandardMaterial(matProps);
	return new THREE.Mesh(geo, mat);
}

// ── Enemy health bar helpers ──

/**
 * Return a hex color for an enemy health bar based on HP ratio.
 * Green (full) → yellow (50 %) → red (empty).
 * @param {number} hp - current HP
 * @param {number} maxHp - maximum HP
 */
function healthBarColor(hp, maxHp) {
	const pct = maxHp > 0 ? hp / maxHp : 0;
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
 * @param {string} enemyId
 * @param {number} x
 * @param {number} z
 * @param {string} [type] - enemy type for correct vertical placement
 */
function createHealthBarMesh(enemyId, x, z, type) {
	const geo = new THREE.BoxGeometry(1.2, 0.1, 0.1);
	const mat = new THREE.MeshStandardMaterial({ color: 0x22c55e });
	const mesh = new THREE.Mesh(geo, mat);
	const halfHeight = enemyMeshHalfHeight(type);
	mesh.position.set(x, halfHeight + 0.5, z);
	scene.add(mesh);
	return mesh;
}

/**
 * Update a health bar's scale and color to reflect current HP.
 * Uses enemy.maxHp (from server) for ratio calculation.
 */
function updateHealthBarMesh(enemyId, enemy) {
	const mesh = enemyHealthBars[enemyId];
	if (!mesh) return;

	const maxHp = enemy.maxHp || enemy.hp;
	const ratio = Math.max(0, enemy.hp / maxHp);
	mesh.scale.x = ratio;
	mesh.material.color.setHex(healthBarColor(enemy.hp, maxHp));
}

// ── Attack visual effects ──

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
    _scene: targetScene, // capture the scene so cleanup targets the same one
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

      // Remove when expired — target the same scene the spark was added to
      if (elapsed >= fx.duration) {
        (fx._scene || scene).remove(fx.mesh);
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

// ── Mesh disposal helper ──

/**
 * Remove and optionally dispose a single mesh from a mesh map.
 * @param {Object} map - object mapping ids to THREE.Mesh instances
 * @param {string} id - key of the mesh to remove
 * @param {THREE.Scene} targetScene - scene to remove mesh from
 * @param {boolean} [skipDispose] - if true, skip geometry/material disposal (for shared resources)
 */
function disposeOne(map, id, targetScene, skipDispose) {
	const mesh = map[id];
	if (!mesh) return;
	if (targetScene) targetScene.remove(mesh);
	if (!skipDispose) {
		if (mesh.geometry) mesh.geometry.dispose();
		if (mesh.material) mesh.material.dispose();
	}
	delete map[id];
}

/**
 * Iterate a mesh map, remove each mesh from the scene, optionally dispose
 * geometry and material, and clear the map.
 * @param {Object} map - object mapping ids to THREE.Mesh instances
 * @param {THREE.Scene} targetScene - scene to remove meshes from
 * @param {boolean} [skipDispose] - if true, skip geometry/material disposal (for shared resources)
 */
function disposeMeshMap(map, targetScene, skipDispose) {
	for (const id of Object.keys(map)) {
		disposeOne(map, id, targetScene, skipDispose);
	}
}

/**
 * Find and dispose meshes in a map whose ids are no longer present in currentIds.
 * Iterates, disposes, and deletes in a single pass — no temporary objects allocated.
 * @param {Object} map - object mapping ids to THREE.Mesh instances
 * @param {Set<string>} currentIds - set of ids that are still valid
 * @param {THREE.Scene} targetScene - scene to remove meshes from
 */
function disposeStaleMeshes(map, currentIds, targetScene) {
	for (const id of Object.keys(map)) {
		if (!currentIds.has(id)) {
			disposeOne(map, id, targetScene);
		}
	}
}

// ── Loot mesh sync & animation ──

const lootGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
const collectingLoot = {}; // lootId → { mesh, value, createdAt } — meshes mid-collection animation
const previousLootValues = {}; // lootId → value — persists value after loot is removed from gameState

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
      delete previousLootValues[id]; // no longer needed — value captured for animation
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
  // Loot meshes share geometry/material — skip disposal
  disposeMeshMap(lootMeshes, scene, true);
}

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

const CAMERA_OFFSET = new THREE.Vector3(CAMERA_OFFSET_CONFIG.x, CAMERA_OFFSET_CONFIG.y, CAMERA_OFFSET_CONFIG.z);

const keys = { w: false, a: false, s: false, d: false };

function updateMyPlayer(delta) {
  if (!myId) return;

  // Block movement when dead
  const me = gameState && gameState.players[myId];
  if (me && me.dead) return;

  // Compute movement direction from active keys, normalize to unit vector
  let dirX = 0, dirZ = 0;
  if (keys.w) dirZ -= 1;
  if (keys.s) dirZ += 1;
  if (keys.a) dirX -= 1;
  if (keys.d) dirX += 1;
  const mag = Math.hypot(dirX, dirZ);
  if (mag > 0) {
    dirX /= mag;
    dirZ /= mag;
  }

  if (mag > 0) {
    // Cap delta to prevent over-correction after input stalls
    const cappedDelta = Math.min(delta, MAX_ELAPSED_MS / 1000);

    // Apply fixed speed matching server's MOVE_SPEED
    myX += dirX * MOVE_SPEED * cappedDelta;
    myZ += dirZ * MOVE_SPEED * cappedDelta;

    // Resolve wall collision before applying position
    const resolved = resolveWallCollisionFromDungeon(myX, myZ, wallColliders);
    myX = resolved.x;
    myZ = resolved.z;

    // Derive facing angle from movement direction
    playerRotation = Math.atan2(dirZ, dirX);

    // Emit move intent using normalized direction
    socket.emit('move', { dx: dirX, dz: dirZ, rotation: playerRotation });
  }
}

function animate(timestamp) {
  requestAnimationFrame(animate);

  clock.update(timestamp);
  const delta = clampDelta(clock.getDelta());
  updateMyPlayer(delta);

  // ── Loot proximity check ──
  if (gameState && gameState.loot && gameState.loot.length > 0) {
    const localPlayer = gameState.players[myId];
    if (localPlayer && !localPlayer.dead) {
      for (const loot of gameState.loot) {
        if (Math.hypot(myX - loot.x, myZ - loot.z) <= 2) {
          if (!pickedUpLootIds.has(loot.id)) {
            pickedUpLootIds.add(loot.id);
            socket.emit('lootPickup', { lootId: loot.id });
          }
          break; // one pickup per frame
        }
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
        const mesh = createEnemyMesh(enemy.type);
        scene.add(mesh);
        enemiesMeshes[enemy.id] = mesh;

        // Create health bar for new enemy (pass type for correct y-position)
        enemyHealthBars[enemy.id] = createHealthBarMesh(enemy.id, enemy.x, enemy.z, enemy.type);
      }
      const halfHeight = enemyMeshHalfHeight(enemy.type);
      enemiesMeshes[enemy.id].position.set(enemy.x, halfHeight, enemy.z);

      // Update health bar position, scale, and color
      enemyHealthBars[enemy.id].position.set(enemy.x, halfHeight + 0.5, enemy.z);
      updateHealthBarMesh(enemy.id, enemy);

      // Detect HP drop (minion tick damage) — skip if caused by a recent cardUsed hit
      if (previousEnemyHp[enemy.id] !== undefined && enemy.hp < previousEnemyHp[enemy.id]) {
        const cardHit = lastCardHitTime[enemy.id];
        const withinGrace = cardHit !== undefined && (performance.now() - cardHit) < CARD_HIT_GRACE_MS;
        if (!withinGrace) {
          flashMesh(enemiesMeshes[enemy.id], 0xff4444, 150);

          // Spawn hit spark at enemy mesh center
          spawnHitSpark({ x: enemy.x, y: halfHeight, z: enemy.z });

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
        disposeOne(telegraphMeshes, enemy.id, scene);

        // Restore original emissive when leaving windup
        applyWindupFlash(enemy.id, false);
      }
    }

    // Clean up removed enemies (also clean up health bars and previous HP tracking)
    disposeStaleMeshes(enemiesMeshes, currentEnemyIds, scene);
    disposeStaleMeshes(enemyHealthBars, currentEnemyIds, scene);
    for (const id of Object.keys(previousEnemyHp)) {
      if (!currentEnemyIds.has(id)) {
        delete previousEnemyHp[id];
      }
    }
    for (const id of Object.keys(lastCardHitTime)) {
      if (!currentEnemyIds.has(id)) {
        delete lastCardHitTime[id];
      }
    }
    // Clean up telegraph meshes for removed enemies
    disposeStaleMeshes(telegraphMeshes, currentEnemyIds, scene);
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
    disposeStaleMeshes(minionsMeshes, currentMinionIds, scene);

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
  camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, CAMERA_NEAR, CAMERA_FAR);
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
window.__setScene = (s) => { window.___test_scene = s; scene = s; }; // test-only: override scene
window.___test_scene = undefined;
window.__playSoundCallLog = () => _playSoundCallLog; // test-only: get playSound call log
window.__clearPlaySoundLog = () => { _playSoundCallLog.length = 0; }; // test-only: clear log
window.__setGameState = (gs, id) => { gameState = gs; myId = id; }; // test-only: set gameState + myId
window.enemyHealthBars = enemyHealthBars;
window.createEnemyMesh = createEnemyMesh;
window.enemyMeshHalfHeight = enemyMeshHalfHeight;
window.healthBarColor = healthBarColor;
window.__mySelectedDeck = () => mySelectedDeck;
window.__setDeckState = (deck, owned) => { mySelectedDeck = deck || mySelectedDeck; myOwnedCards = owned || myOwnedCards; };
window.__windupFlashing = () => windupFlashing; // test-only: access windupFlashing Set
window.__pickedUpLootIds = () => pickedUpLootIds; // test-only: access pickedUpLootIds Set
window.__enemiesMeshes = () => enemiesMeshes;     // test-only: access enemiesMeshes map
window.applyWindupFlash = applyWindupFlash;       // test-only: expose for unit testing
window.__useCardForTest = useCard;                // test-only: expose useCard for cooldown tests
window.showAuthOverlay = showAuthOverlay;         // test-only: expose auth overlay functions
window.hideAuthOverlay = hideAuthOverlay;
window.showRegisterForm = showRegisterForm;
window.showLoginForm = showLoginForm;
window.clearAuthForms = clearAuthForms;
window.bindSocketHandlers = bindSocketHandlers;   // test-only: expose for handler-rebinding tests
window.createSocket = createSocket;               // test-only: expose for socket creation tests
window.__connectionState = () => connectionState; // test-only: read connectionState
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
    minions: gameState && gameState.minions ? gameState.minions.map(m => ({
      id: m.id,
      type: m.type,
      ownerId: m.ownerId,
      hp: m.hp,
      maxHp: m.maxHp,
      x: m.x,
      z: m.z,
    })) : [],
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
