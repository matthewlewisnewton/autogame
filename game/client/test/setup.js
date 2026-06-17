import { vi } from 'vitest';
import { THREE } from './__mocks__/three.js';

// ── Stub a 2D canvas context ──
// jsdom ships without a canvas backend, so HTMLCanvasElement.getContext('2d')
// throws "Not implemented". Code that draws to an offscreen canvas (nameplates,
// hub booth signs) only needs a context to call into — a browser always provides
// one — so hand back a no-op proxy whose every member is a callable stub.
if (typeof HTMLCanvasElement !== 'undefined') {
	HTMLCanvasElement.prototype.getContext = function() {
		return new Proxy({}, { get: () => () => {} });
	};
}

// ── Mock socket.io-client ──
const emitLog = [];
const ioCallLog = [];
const handlerLog = {}; // event -> array of callbacks (keyed by "socketId:event")
let socketConnected = true;
let socketCounter = 0; // tracks how many times io() was called
let ioDisconnected = false; // tracks whether socket.io.disconnect() was called

function createMockSocket() {
	socketCounter++;
	const id = `mock-socket-${socketCounter}`;
	const ioObj = {
		on: function() { return this; },
		disconnect: function() {
			ioDisconnected = true;
			return this;
		}
	};
	return {
		id,
		connected: true,
		on: function(event, callback) {
			const key = `${id}:${event}`;
			if (!handlerLog[key]) handlerLog[key] = [];
			handlerLog[key].push(callback);
			return this;
		},
		emit: function(event, data) {
			emitLog.push({ event, data, socketId: id });
			return this;
		},
		connect: function() {
			socketConnected = true;
			return this;
		},
		disconnect: function() {
			socketConnected = false;
			return this;
		},
		io: ioObj
	};
}

const ioMock = function(config) {
	ioCallLog.push(config || {});
	return createMockSocket();
};

// ── Mock fetch for /api/me (session-cookie auth) ──
// main.js calls restoreSession() at module load, which fetches /api/me via
// the httpOnly session cookie. Mock the response so tests start logged in.
if (typeof globalThis.fetch === "undefined") {
    globalThis.fetch = async (url) => {
        if (url === "/api/me") {
            return {
                ok: true,
                json: async () => ({
                    accountId: "test-account",
                    username: "testuser",
                    email: null,
                    settings: {},
                    cosmetic: { bodyColor: "#4f9dde", accentColor: "#f2c94c", bodyShape: "box", hat: "none" },
                    unlockedHats: ["none"],
                    hatCatalog: [],
                }),
            };
        }
        return { ok: false, json: async () => ({ error: "not found" }) };
    };
}

// ── Create auth overlay DOM elements at setup time ──
// main.js captures these references at module load time (top-level getElementById),
// so they must exist before any test imports main.js.
if (typeof document !== 'undefined') {
	function ensureAuthElements() {
		if (document.getElementById('auth-overlay')) return;

		const overlay = document.createElement('div');
		overlay.id = 'auth-overlay';
		overlay.classList.add('hidden');

		const modal = document.createElement('div');
		modal.id = 'auth-modal';

		const registerForm = document.createElement('div');
		registerForm.id = 'register-form';
		const regUser = document.createElement('input');
		regUser.type = 'text';
		regUser.id = 'register-username';
		const regPass = document.createElement('input');
		regPass.type = 'password';
		regPass.id = 'register-password';
		const regBtn = document.createElement('button');
		regBtn.id = 'register-btn';
		const regError = document.createElement('span');
		regError.id = 'register-error';
		registerForm.appendChild(regUser);
		registerForm.appendChild(regPass);
		registerForm.appendChild(regBtn);
		registerForm.appendChild(regError);

		const loginForm = document.createElement('div');
		loginForm.id = 'login-form';
		loginForm.classList.add('hidden');
		const logUser = document.createElement('input');
		logUser.type = 'text';
		logUser.id = 'login-username';
		const logPass = document.createElement('input');
		logPass.type = 'password';
		logPass.id = 'login-password';
		const logBtn = document.createElement('button');
		logBtn.id = 'login-btn';
		const logError = document.createElement('span');
		logError.id = 'login-error';
		loginForm.appendChild(logUser);
		loginForm.appendChild(logPass);
		loginForm.appendChild(logBtn);
		loginForm.appendChild(logError);

		modal.appendChild(registerForm);
		modal.appendChild(loginForm);
		overlay.appendChild(modal);
		document.body.appendChild(overlay);

		// Logout button
		if (!document.getElementById('account-btn')) {
			const accountBtn = document.createElement('button');
			accountBtn.id = 'account-btn';
			accountBtn.classList.add('hidden');
			document.body.appendChild(accountBtn);
		}
		if (!document.getElementById('account-overlay')) {
			const overlay = document.createElement('div');
			overlay.id = 'account-overlay';
			overlay.classList.add('hidden');
			const logoutBtn = document.createElement('button');
			logoutBtn.id = 'account-logout-btn';
			overlay.appendChild(logoutBtn);
			document.body.appendChild(overlay);
		}
	}
	ensureAuthElements();
}

// Expose emit log + reset helper for tests (only in jsdom environment)
if (typeof window !== 'undefined') {
	window.__socketEmitLog = () => emitLog;
	window.__clearSocketEmitLog = () => { emitLog.length = 0; };
	window.__resetSocketHandlersForTest = () => {
		for (const key of Object.keys(handlerLog)) delete handlerLog[key];
		emitLog.length = 0;
		ioCallLog.length = 0;
		socketCounter = 0;
		ioDisconnected = false;
	};
	window.__ioCallLog = () => ioCallLog;
	window.__clearIoCallLog = () => { ioCallLog.length = 0; };
	window.__triggerSocketEvent = function(event, data) {
		// handlerLog is keyed by "socketId:event" — find all matching handlers
		for (const key of Object.keys(handlerLog)) {
			if (key.endsWith(`:${event}`)) {
				for (const cb of handlerLog[key]) cb(data);
			}
		}
	};
	/** Return the set of events registered on a specific socket id. */
	window.__socketHandlerEvents = function(socketId) {
		const events = new Set();
		const prefix = `${socketId}:`;
		for (const key of Object.keys(handlerLog)) {
			if (key.startsWith(prefix)) {
				events.add(key.slice(prefix.length));
			}
		}
		return events;
	};
	/** Return the current socket counter (how many mock sockets have been created). */
	window.__socketCounter = () => socketCounter;
	window.__ioDisconnected = () => ioDisconnected;
	window.__clearIoDisconnected = () => { ioDisconnected = false; };
	window.__soundLogEnabled = true; // enable _playSoundCallLog in test environment
}

// Register mocks
vi.mock('three', () => {
	const exports = { THREE, ...THREE };
	return exports;
});

vi.mock('socket.io-client', () => ({
	io: ioMock
}));
