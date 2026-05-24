import { vi } from 'vitest';
import { THREE } from './__mocks__/three.js';

// ── Mock socket.io-client ──
const emitLog = [];
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

const ioMock = function() { return createMockSocket(); };

// ── Set up localStorage with a fake JWT token ──
// main.js reads `autogame_token` from localStorage at module load time.
// Without it, createSocket() is never called and `socket` stays null.
if (typeof localStorage !== 'undefined') {
	try {
		localStorage.setItem('autogame_token', 'test-fake-jwt-token');
	} catch (_) { /* ignore */ }
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
		if (!document.getElementById('logout-btn')) {
			const logoutBtn = document.createElement('button');
			logoutBtn.id = 'logout-btn';
			logoutBtn.classList.add('hidden');
			document.body.appendChild(logoutBtn);
		}
	}
	ensureAuthElements();
}

// Expose emit log + reset helper for tests (only in jsdom environment)
if (typeof window !== 'undefined') {
	window.__socketEmitLog = () => emitLog;
	window.__clearSocketEmitLog = () => { emitLog.length = 0; };
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
