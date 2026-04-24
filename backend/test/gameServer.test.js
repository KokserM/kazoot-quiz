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

async function expectNoEvent(socket, eventName, timeoutMs = 300) {
  await Promise.race([
    onceEvent(socket, eventName).then(() => {
      throw new Error(`Unexpected ${eventName}`);
    }),
    delay(timeoutMs),
  ]);
}

async function createSession(baseUrl, topic = '90s Movies', overrides = {}) {
  const response = await fetch(`${baseUrl}/api/create-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, language: 'English', ...overrides }),
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

test('session uses the host-selected timer length', async () => {
  const runtime = await startTestServer();

  try {
    const session = await createSession(runtime.baseUrl, '90s Movies', {
      questionTimeLimitMs: 5000,
    });
    const storedSession = runtime.store.getSession(session.sessionId);

    assert.equal(session.questionTimeLimitMs, 5000);
    assert.equal(storedSession.questionTimeLimitMs, 5000);

    const host = connectClient(runtime.baseUrl);
    const joinedPromise = onceEventWithTimeout(host, 'joined-game');
    host.emit('join-game', {
      sessionId: session.sessionId,
      username: 'Host',
      isCreator: true,
    });
    await joinedPromise;

    const questionPromise = onceEventWithTimeout(host, 'question-start');
    host.emit('start-game');
    const questionPayload = await questionPromise;

    assert.equal(questionPayload.timeLimit, 5000);

    host.disconnect();
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

test('concurrent sessions stay isolated when different hosts start games', async () => {
  const runtime = await startTestServer();

  try {
    const sessionOne = await createSession(runtime.baseUrl, 'Space & Astronomy');
    const sessionTwo = await createSession(runtime.baseUrl, 'Video Games');

    const hostOne = connectClient(runtime.baseUrl);
    const guestOne = connectClient(runtime.baseUrl);
    const hostTwo = connectClient(runtime.baseUrl);
    const guestTwo = connectClient(runtime.baseUrl);

    await Promise.all([
      (() => {
        const joined = onceEventWithTimeout(hostOne, 'joined-game');
        hostOne.emit('join-game', { sessionId: sessionOne.sessionId, username: 'HostOne', isCreator: true });
        return joined;
      })(),
      (() => {
        const joined = onceEventWithTimeout(guestOne, 'joined-game');
        guestOne.emit('join-game', { sessionId: sessionOne.sessionId, username: 'GuestOne' });
        return joined;
      })(),
      (() => {
        const joined = onceEventWithTimeout(hostTwo, 'joined-game');
        hostTwo.emit('join-game', { sessionId: sessionTwo.sessionId, username: 'HostTwo', isCreator: true });
        return joined;
      })(),
      (() => {
        const joined = onceEventWithTimeout(guestTwo, 'joined-game');
        guestTwo.emit('join-game', { sessionId: sessionTwo.sessionId, username: 'GuestTwo' });
        return joined;
      })(),
    ]);

    const sessionOneQuestion = onceEventWithTimeout(guestOne, 'question-start');
    hostOne.emit('start-game');
    await sessionOneQuestion;
    await expectNoEvent(guestTwo, 'question-start');

    const sessionTwoQuestion = onceEventWithTimeout(guestTwo, 'question-start');
    hostTwo.emit('start-game');
    await sessionTwoQuestion;

    hostOne.disconnect();
    guestOne.disconnect();
    hostTwo.disconnect();
    guestTwo.disconnect();
  } finally {
    await runtime.close();
  }
});

test('multiple hosts can start separate sessions at the same time', async () => {
  const runtime = await startTestServer();

  try {
    const sessions = await Promise.all([
      createSession(runtime.baseUrl, 'Space & Astronomy'),
      createSession(runtime.baseUrl, 'Video Games'),
      createSession(runtime.baseUrl, '90s Movies'),
    ]);

    const hosts = sessions.map(() => connectClient(runtime.baseUrl));

    await Promise.all(
      hosts.map((host, index) => {
        const joined = onceEventWithTimeout(host, 'joined-game');
        host.emit('join-game', {
          sessionId: sessions[index].sessionId,
          username: `Host${index + 1}`,
          isCreator: true,
        });
        return joined;
      })
    );

    const questions = hosts.map((host) => onceEventWithTimeout(host, 'question-start'));
    hosts.forEach((host) => host.emit('start-game'));
    const payloads = await Promise.all(questions);

    payloads.forEach((payload) => {
      assert.equal(payload.questionNumber, 1);
    });

    hosts.forEach((host) => host.disconnect());
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

test('results payload counts submitted answers across players', async () => {
  const runtime = await startTestServer();

  try {
    const sessionDetails = await createSession(runtime.baseUrl, 'Space & Astronomy');
    const session = runtime.store.getSession(sessionDetails.sessionId);
    session.questionTimeLimitMs = 2000;

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

    const hostQuestion = onceEventWithTimeout(host, 'question-start');
    host.emit('start-game');
    const questionPayload = await hostQuestion;

    const hostAck = onceEventWithTimeout(host, 'answer-submitted');
    host.emit('submit-answer', {
      answerIndex: 0,
      roundId: questionPayload.roundId,
    });
    await hostAck;

    const guestAck = onceEventWithTimeout(guest, 'answer-submitted');
    guest.emit('submit-answer', {
      answerIndex: 1,
      roundId: questionPayload.roundId,
    });
    await guestAck;

    runtime.gameService.finishQuestion(sessionDetails.sessionId, questionPayload.roundId);
    const results = await onceEventWithTimeout(host, 'question-results');

    assert.deepEqual(results.answerStats, [1, 1, 0, 0]);

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

test('rejoining an in-progress game receives only that session snapshot', async () => {
  const runtime = await startTestServer();

  try {
    const sessionOne = await createSession(runtime.baseUrl, 'Space & Astronomy');
    const sessionTwo = await createSession(runtime.baseUrl, 'Video Games');

    const hostOne = connectClient(runtime.baseUrl);
    const guestOne = connectClient(runtime.baseUrl);
    const hostTwo = connectClient(runtime.baseUrl);

    await Promise.all([
      (() => {
        const joined = onceEventWithTimeout(hostOne, 'joined-game');
        hostOne.emit('join-game', { sessionId: sessionOne.sessionId, username: 'HostOne', isCreator: true });
        return joined;
      })(),
      (() => {
        const joined = onceEventWithTimeout(guestOne, 'joined-game');
        guestOne.emit('join-game', { sessionId: sessionOne.sessionId, username: 'GuestOne' });
        return joined;
      })(),
      (() => {
        const joined = onceEventWithTimeout(hostTwo, 'joined-game');
        hostTwo.emit('join-game', { sessionId: sessionTwo.sessionId, username: 'HostTwo', isCreator: true });
        return joined;
      })(),
    ]);

    const sessionOneQuestion = onceEventWithTimeout(guestOne, 'question-start');
    hostOne.emit('start-game');
    const questionOnePayload = await sessionOneQuestion;

    const originalGuestRecord = runtime.store.getSession(sessionOne.sessionId).getPlayerBySocketId(guestOne.id);
    const guestToken = originalGuestRecord.playerToken;
    guestOne.disconnect();
    await delay(50);

    const sessionTwoQuestion = onceEventWithTimeout(hostTwo, 'question-start');
    hostTwo.emit('start-game');
    await sessionTwoQuestion;

    const rejoinedGuest = connectClient(runtime.baseUrl);
    const joinedAgain = onceEventWithTimeout(rejoinedGuest, 'joined-game');
    const questionAgain = onceEventWithTimeout(rejoinedGuest, 'question-start');
    rejoinedGuest.emit('join-game', {
      sessionId: sessionOne.sessionId,
      username: 'GuestOne',
      playerToken: guestToken,
    });

    const rejoinedPayload = await joinedAgain;
    const rejoinedQuestion = await questionAgain;

    assert.equal(rejoinedPayload.sessionId, sessionOne.sessionId);
    assert.equal(rejoinedQuestion.roundId, questionOnePayload.roundId);

    hostOne.disconnect();
    hostTwo.disconnect();
    rejoinedGuest.disconnect();
  } finally {
    await runtime.close();
  }
});

test('deleting a session cleans stale socket index entries', async () => {
  const runtime = await startTestServer();

  try {
    const session = await createSession(runtime.baseUrl, '90s Movies');
    const host = connectClient(runtime.baseUrl);

    const joined = onceEventWithTimeout(host, 'joined-game');
    host.emit('join-game', {
      sessionId: session.sessionId,
      username: 'Host',
      isCreator: true,
    });
    await joined;

    assert.equal(runtime.store.getSocketIndexSize(), 1);
    runtime.store.deleteSession(session.sessionId, { reason: 'test_cleanup' });

    assert.equal(runtime.store.getSocketIndexSize(), 0);
    assert.deepEqual(runtime.store.auditIntegrity(), []);

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
