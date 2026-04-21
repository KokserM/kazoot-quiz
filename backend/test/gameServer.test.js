const test = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const { io: createClient } = require('socket.io-client');
const { createServer } = require('../src/createServer');

async function startTestServer() {
  const runtime = createServer();

  await new Promise((resolve) => {
    runtime.server.listen(0, '127.0.0.1', resolve);
  });

  const address = runtime.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    ...runtime,
    baseUrl,
    async close() {
      await new Promise((resolve) => runtime.io.close(resolve));
      await new Promise((resolve) => runtime.server.close(resolve));
    },
  };
}

function onceEvent(socket, eventName) {
  return new Promise((resolve) => {
    socket.once(eventName, resolve);
  });
}

async function createSession(baseUrl, topic = '90s Movies') {
  const response = await fetch(`${baseUrl}/api/create-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, language: 'English' }),
  });

  assert.equal(response.status, 200);
  return response.json();
}

function connectClient(baseUrl) {
  return createClient(baseUrl, {
    transports: ['websocket'],
    forceNew: true,
  });
}

test('duplicate answer submissions do not inflate the score', async () => {
  const runtime = await startTestServer();

  try {
    const session = await createSession(runtime.baseUrl);
    const host = connectClient(runtime.baseUrl);
    const guest = connectClient(runtime.baseUrl);

    const hostJoined = onceEvent(host, 'joined-game');
    host.emit('join-game', {
      sessionId: session.sessionId,
      username: 'Host',
      isCreator: true,
    });

    const hostState = await hostJoined;
    assert.equal(hostState.isAdmin, true);

    const guestJoined = onceEvent(guest, 'joined-game');
    guest.emit('join-game', {
      sessionId: session.sessionId,
      username: 'Guest',
    });
    await guestJoined;

    const questionStarted = onceEvent(host, 'question-start');
    host.emit('start-game');
    const question = await questionStarted;

    const storedSession = runtime.store.getSession(session.sessionId);
    storedSession.questionTimeLimitMs = 2000;

    const player = storedSession.getPlayerByToken(hostState.playerToken);
    assert.ok(player);

    const firstAck = onceEvent(host, 'answer-submitted');
    host.emit('submit-answer', {
      answerIndex: 0,
      roundId: question.roundId,
    });
    await firstAck;

    const scoreAfterFirstSubmit = player.score;
    assert.equal(typeof scoreAfterFirstSubmit, 'number');

    const secondAck = onceEvent(host, 'answer-submitted');
    host.emit('submit-answer', {
      answerIndex: 0,
      roundId: question.roundId,
    });
    const secondPayload = await secondAck;

    assert.equal(secondPayload.alreadySubmitted, true);
    assert.equal(player.score, scoreAfterFirstSubmit);

    host.disconnect();
    guest.disconnect();
  } finally {
    await runtime.close();
  }
});

test('player tokens allow reconnecting to the same seat', async () => {
  const runtime = await startTestServer();

  try {
    const session = await createSession(runtime.baseUrl, 'Video Games');
    const firstSocket = connectClient(runtime.baseUrl);
    const firstJoin = onceEvent(firstSocket, 'joined-game');

    firstSocket.emit('join-game', {
      sessionId: session.sessionId,
      username: 'PlayerOne',
    });

    const joinedPayload = await firstJoin;
    const originalPlayerId = joinedPayload.playerId;
    firstSocket.disconnect();
    await delay(50);

    const secondSocket = connectClient(runtime.baseUrl);
    const secondJoin = onceEvent(secondSocket, 'joined-game');
    secondSocket.emit('join-game', {
      sessionId: session.sessionId,
      username: 'PlayerOne',
      playerToken: joinedPayload.playerToken,
    });

    const rejoinedPayload = await secondJoin;
    assert.equal(rejoinedPayload.reconnected, true);
    assert.equal(rejoinedPayload.playerId, originalPlayerId);

    secondSocket.disconnect();
  } finally {
    await runtime.close();
  }
});

test('host keeps host identity in session updates', async () => {
  const runtime = await startTestServer();

  try {
    const session = await createSession(runtime.baseUrl, '90s Movies');
    const host = connectClient(runtime.baseUrl);

    const joinedPromise = onceEvent(host, 'joined-game');
    const sessionUpdatedPromise = onceEvent(host, 'session-updated');

    host.emit('join-game', {
      sessionId: session.sessionId,
      username: 'Host',
      isCreator: true,
    });

    const joinedPayload = await joinedPromise;
    const updatedPayload = await sessionUpdatedPromise;

    assert.equal(joinedPayload.you?.isHost, true);
    assert.equal(updatedPayload.you?.isHost, true);
    assert.equal(updatedPayload.playerId, joinedPayload.playerId);

    host.disconnect();
  } finally {
    await runtime.close();
  }
});

test('host cannot start a game alone', async () => {
  const runtime = await startTestServer();

  try {
    const session = await createSession(runtime.baseUrl, '90s Movies');
    const host = connectClient(runtime.baseUrl);

    const joinedPromise = onceEvent(host, 'joined-game');
    const errorPromise = onceEvent(host, 'error');

    host.emit('join-game', {
      sessionId: session.sessionId,
      username: 'Host',
      isCreator: true,
    });

    await joinedPromise;
    host.emit('start-game');

    const errorPayload = await errorPromise;
    assert.equal(errorPayload.message, 'At least two connected players are required to start');

    host.disconnect();
  } finally {
    await runtime.close();
  }
});

test('starting a new round clears the previous timer', async () => {
  const runtime = await startTestServer();

  try {
    const sessionDetails = await createSession(runtime.baseUrl, 'Space & Astronomy');
    const session = runtime.store.getSession(sessionDetails.sessionId);
    session.questionTimeLimitMs = 50;

    runtime.gameService.startQuestion(session, 0);
    const firstRoundId = session.currentRoundId;

    await delay(10);
    runtime.gameService.startQuestion(session, 1);
    const secondRoundId = session.currentRoundId;

    assert.notEqual(firstRoundId, secondRoundId);

    await delay(45);

    assert.equal(session.currentRoundId, secondRoundId);
    assert.equal(session.currentQuestionIndex, 1);
    assert.equal(session.gameState, 'question');
  } finally {
    await runtime.close();
  }
});
