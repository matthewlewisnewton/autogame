/**
 * Mock for socket.io-client
 *
 * Usage in main.js: `import { io } from 'socket.io-client';`
 * This mock returns a fake socket with `.on()`, `.emit()`, and `.io.on()` stubs.
 */

const handlers = {};
const ioHandlers = {};

function FakeSocket() {
	return {
		id: 'mock-socket-id',
		on: function(event, cb) {
			if (!handlers[event]) handlers[event] = [];
			handlers[event].push(cb);
			return this;
		},
		emit: function(event, data) {
			return this;
		},
		io: {
			on: function(event, cb) {
				if (!ioHandlers[event]) ioHandlers[event] = [];
				ioHandlers[event].push(cb);
				return this;
			}
		}
	};
}

export function io() {
	return FakeSocket();
}

export const handlers = handlers;
export const ioHandlers = ioHandlers;
