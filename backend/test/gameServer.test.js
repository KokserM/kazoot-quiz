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

function onceEventWithTimeout(socket, eventName, timeoutMs = 5000) {
  return Promise.race([
    onceEvent(socket, eventName),
    delay(timeoutMs).then(() => {
      throw new Error(`Timed out waiting for ${eventName}`);
    }),
  ]);
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

    const hostJoined = onceEventWithTimeout(host, 'joined-game');
    host.emit('join-game', {
      sessionId: session.sessionId,
      username: 'Host',
      isCreator: true,
    });

    const hostState = await hostJoined;
    assert.equal(hostState.isAdmin, true);

    const guestJoined = onceEventWithTimeout(guest, 'joined-game');
    guest.emit('join-game', {
      sessionId: session.sessionId,
      username: 'Guest',
    });
    await guestJoined;

    const questionStarted = onceEventWithTimeout(host, 'question-start');
    host.emit('start-game');
    const question = await questionStarted;

    const storedSession = runtime.store.getSession(session.sessionId);
    storedSession.questionTimeLimitMs = 2000;

    const player = storedSession.getPlayerByToken(hostState.playerToken);
    assert.ok(player);

    const firstAck = onceEventWithTimeout(host, 'answer-submitted');
    host.emit('submit-answer', {
      answerIndex: 0,
      roundId: question.roundId,
    });
    await firstAck;

    const scoreAfterFirstSubmit = player.score;
    assert.equal(typeof scoreAfterFirstSubmit, 'number');

    const secondAck = onceEventWithTimeout(host, 'answer-submitted');
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
    const firstJoin = onceEventWithTimeout(firstSocket, 'joined-game');

    firstSocket.emit('join-game', {
      sessionId: session.sessionId,
      username: 'PlayerOne',
    });

    const joinedPayload = await firstJoin;
    const originalPlayerId = joinedPayload.playerId;
    firstSocket.disconnect();
    await delay(50);

    const secondSocket = connectClient(runtime.baseUrl);
    const secondJoin = onceEventWithTimeout(secondSocket, 'joined-game');
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

    const joinedPromise = onceEventWithTimeout(host, 'joined-game');
    const sessionUpdatedPromise = onceEventWithTimeout(host, 'session-updated');

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

test('host can start a game alone', async () => {
  const runtime = await startTestServer();

  try {
    const session = await createSession(runtime.baseUrl, '90s Movies');
    const host = connectClient(runtime.baseUrl);

    const joinedPromise = onceEventWithTimeout(host, 'joined-game');
    const questionPromise = onceEventWithTimeout(host, 'question-start');

    host.emit('join-game', {
      sessionId: session.sessionId,
      username: 'Host',
      isCreator: true,
    });

    await joinedPromise;
    host.emit('start-game');

    const questionPayload = await questionPromise;
    assert.equal(questionPayload.questionNumber, 1);
    assert.equal(questionPayload.totalQuestions, 10);

    host.disconnect();
  } finally {
    await runtime.close();
  }
});

test('timer expiry reveals results even when nobody answers', async () => {
  const runtime = await startTestServer();

  try {
    const sessionDetails = await createSession(runtime.baseUrl, 'Space & Astronomy');
    const session = runtime.store.getSession(sessionDetails.sessionId);
    session.questionTimeLimitMs = 40;

    const host = connectClient(runtime.baseUrl);
    const guest = connectClient(runtime.baseUrl);

    const hostJoined = onceEventWithTimeout(host, 'joined-game');
    host.emit('join-game', {
      sessionId: sessionDetails.sessionId,
      username: 'Host',
      isCreator: true,
    });
    await hostJoined;

    const guestJoined = onceEventWithTimeout(guest, 'joined-game');
    guest.emit('join-game', {
      sessionId: sessionDetails.sessionId,
      username: 'Guest',
    });
    await guestJoined;

    const resultsPromise = onceEventWithTimeout(host, 'question-results', 4000);
    host.emit('start-game');
    const results = await resultsPromise;

    assert.equal(typeof results.correctAnswer, 'number');
    assert.equal(Array.isArray(results.answerStats), true);
    assert.equal(results.playerAnswer, null);

    host.disconnect();
    guest.disconnect();
  } finally {
    await runtime.close();
  }
});

test('rejoining after timeout receives the results snapshot', async () => {
  const runtime = await startTestServer();

  try {
    const sessionDetails = await createSession(runtime.baseUrl, 'Video Games');
    const session = runtime.store.getSession(sessionDetails.sessionId);
    session.questionTimeLimitMs = 50;

    const host = connectClient(runtime.baseUrl);
    const guest = connectClient(runtime.baseUrl);

    const hostJoined = onceEventWithTimeout(host, 'joined-game');
    host.emit('join-game', {
      sessionId: sessionDetails.sessionId,
      username: 'Host',
      isCreator: true,
    });
    await hostJoined;

    const guestJoined = onceEventWithTimeout(guest, 'joined-game');
    guest.emit('join-game', {
      sessionId: sessionDetails.sessionId,
      username: 'Guest',
    });
    const guestPayload = await guestJoined;
    const guestToken = guestPayload.playerToken;
    const questionStarted = onceEventWithTimeout(guest, 'question-start', 4000);
    host.emit('start-game');
    await questionStarted;

    guest.disconnect();
    await delay(120);

    const rejoinedGuest = connectClient(runtime.baseUrl);
    const rejoinPromise = onceEventWithTimeout(rejoinedGuest, 'joined-game', 4000);
    const resultsPromise = onceEventWithTimeout(rejoinedGuest, 'question-results', 4000);

    rejoinedGuest.emit('join-game', {
      sessionId: sessionDetails.sessionId,
      username: 'Guest',
      playerToken: guestToken,
    });

    const rejoinedPayload = await rejoinPromise;
    const results = await resultsPromise;

    assert.equal(rejoinedPayload.reconnected, true);
    assert.equal(typeof results.correctAnswer, 'number');

    host.disconnect();
    rejoinedGuest.disconnect();
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
