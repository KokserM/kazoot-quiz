const { setTimeout: delay } = require('node:timers/promises');
const { io: createClient } = require('socket.io-client');
const { createServer } = require('../../src/createServer');

const TEST_USER = { id: '00000000-0000-4000-8000-000000000001', email: 'host@example.com', displayName: 'Host' };

function fakeAuthService(users = { 'Bearer good': TEST_USER }) {
  return {
    isConfigured: () => true,
    async getUserFromRequest(req) {
      return users[req.get('authorization')] || null;
    },
    deleted: [],
    async deleteUser(id) {
      this.deleted.push(id);
    },
  };
}

async function startTestServer(overrides = {}) {
  const runtime = createServer({
    ...overrides,
    config: {
      nodeEnv: 'test',
      openAiApiKey: '',
      supabaseUrl: '',
      supabaseServiceRoleKey: '',
      stripeSecretKey: '',
      hostGraceMs: 0,
      answerGraceMs: 150,
      ...(overrides.config || {}),
    },
  });
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${runtime.server.address().port}`;
  const sockets = [];

  return {
    ...runtime,
    baseUrl,
    connect() {
      const socket = createClient(baseUrl, { transports: ['websocket'], forceNew: true, reconnection: false });
      sockets.push(socket);
      recordEvents(socket);
      return socket;
    },
    async close() {
      sockets.forEach((socket) => socket.close());
      runtime.store.sessions.forEach((session) => session.clearAllTimers());
      await new Promise((resolve) => runtime.io.close(resolve));
    },
  };
}

// Keeps every received event so tests can inspect exactly what a client saw.
function recordEvents(socket) {
  socket.received = [];
  socket.onAny((eventName, payload) => socket.received.push({ eventName, payload }));
}

async function api(baseUrl, path, { method = 'POST', body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

function once(socket, eventName, timeoutMs = 3000) {
  return Promise.race([
    new Promise((resolve) => socket.once(eventName, resolve)),
    delay(timeoutMs).then(() => {
      throw new Error(`Timed out waiting for ${eventName}`);
    }),
  ]);
}

function emit(socket, eventName, payload = {}, timeoutMs = 3000) {
  return socket.timeout(timeoutMs).emitWithAck(eventName, payload);
}

async function createDemoRoom(baseUrl, options = {}) {
  const { status, body } = await api(baseUrl, '/api/create-session', { body: { demoId: 'warm-up', ...options } });
  if (status !== 200) {
    throw new Error(`create failed: ${status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function joinAs(runtime, room, username, extra = {}) {
  const socket = runtime.connect();
  const joined = once(socket, 'joined-game');
  joined.catch(() => {});
  const ack = await emit(socket, 'join-game', { sessionId: room.sessionId, username, ...extra });
  if (!ack.ok) {
    socket.close();
    const error = new Error(ack.message);
    error.code = ack.code;
    throw error;
  }
  const payload = await joined;
  return { socket, ...payload };
}

async function hostRoom(runtime, options = {}) {
  const room = await createDemoRoom(runtime.baseUrl, options);
  const host = await joinAs(runtime, room, 'Host', { hostToken: room.hostToken });
  return { room, host };
}

module.exports = {
  TEST_USER,
  api,
  createDemoRoom,
  delay,
  emit,
  fakeAuthService,
  hostRoom,
  joinAs,
  once,
  startTestServer,
};
