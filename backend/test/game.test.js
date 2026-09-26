// Multiplayer behaviour over real Socket.IO connections against a real server.
const test = require('node:test');
const assert = require('node:assert/strict');
const { api, createDemoRoom, delay, emit, hostRoom, joinAs, once, startTestServer } = require('./helpers/testServer');

function findKeysDeep(value, pattern, path = '') {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, entry]) => [
    ...(pattern.test(key) ? [`${path}${key}`] : []),
    ...findKeysDeep(entry, pattern, `${path}${key}.`),
  ]);
}

test('players never receive the correct answer before the reveal', async () => {
  const runtime = await startTestServer();
  try {
    const { room, host } = await hostRoom(runtime);
    assert.deepEqual(findKeysDeep(room, /correct|^questions$|^choices$/i), [], 'create response must not contain answers');
    const guest = await joinAs(runtime, room, 'Guest');

    const questionStart = once(guest.socket, 'question-start');
    await emit(host.socket, 'start-game');
    const question = await questionStart;
    await emit(guest.socket, 'submit-answer', { answerIndex: 0, roundId: question.roundId });
    await emit(guest.socket, 'sync-state');
    await delay(50);

    const beforeReveal = guest.socket.received.filter(({ eventName }) => eventName !== 'question-results' && eventName !== 'round-result');
    assert.deepEqual(findKeysDeep(beforeReveal, /correct/i), [], JSON.stringify(findKeysDeep(beforeReveal, /correct/i)));

    const results = once(guest.socket, 'question-results', 25_000);
    runtime.gameService.finishQuestion(room.sessionId, question.roundId);
    const revealed = await results;
    assert.equal(typeof revealed.correctAnswer, 'number');
  } finally {
    await runtime.close();
  }
});

test('manual room codes are 10 characters and joinable', async () => {
  const runtime = await startTestServer();
  try {
    const room = await createDemoRoom(runtime.baseUrl);
    assert.match(room.sessionId, /^[A-Z0-9]{10}$/);
    const guest = await joinAs(runtime, { sessionId: room.sessionId.toLowerCase() }, 'Guest');
    assert.equal(guest.session.sessionId, room.sessionId);
  } finally {
    await runtime.close();
  }
});

test('rapid duplicate answer taps score once and every ack reports the same answer', async () => {
  const runtime = await startTestServer();
  try {
    const { host } = await hostRoom(runtime);
    const questionStart = once(host.socket, 'question-start');
    await emit(host.socket, 'start-game');
    const question = await questionStart;

    const acks = await Promise.all(
      [1, 2, 1, 3, 0].map((answerIndex) => emit(host.socket, 'submit-answer', { answerIndex, roundId: question.roundId }))
    );
    assert.ok(acks.every((ack) => ack.ok && ack.accepted));
    assert.equal(acks.filter((ack) => !ack.alreadySubmitted).length, 1);
    assert.ok(acks.every((ack) => ack.answerIndex === 1), 'later taps cannot change the locked answer');

    const session = runtime.store.getSession(host.session.sessionId);
    const player = session.players.get(host.playerId);
    assert.equal(Object.keys(player.answers).length, 1);
    const expected = player.answers[0].isCorrect ? player.answers[0].points : 0;
    assert.equal(player.score, expected);
  } finally {
    await runtime.close();
  }
});

test('answers after the round closes are explicitly rejected, not silently accepted', async () => {
  const runtime = await startTestServer({ config: { answerGraceMs: 0 } });
  try {
    const { room, host } = await hostRoom(runtime, { revealTiming: 'timer' });
    const questionStart = once(host.socket, 'question-start');
    await emit(host.socket, 'start-game');
    const question = await questionStart;
    runtime.gameService.finishQuestion(room.sessionId, question.roundId);

    const ack = await emit(host.socket, 'submit-answer', { answerIndex: 0, roundId: question.roundId });
    assert.equal(ack.ok, false);
    assert.equal(ack.code, 'round_closed');

    const staleRound = await emit(host.socket, 'submit-answer', { answerIndex: 0, roundId: 'old-round' });
    assert.equal(staleRound.ok, false);
  } finally {
    await runtime.close();
  }
});

test('an answer arriving just after the deadline is accepted within the grace window', async () => {
  const runtime = await startTestServer({ config: { answerGraceMs: 300 } });
  try {
    const { room, host } = await hostRoom(runtime, { questionTimeLimitMs: 5000 });
    const questionStart = once(host.socket, 'question-start');
    await emit(host.socket, 'start-game');
    const question = await questionStart;
    const session = runtime.store.getSession(room.sessionId);
    session.currentQuestionEndsAt = Date.now() - 100; // deadline just passed

    const ack = await emit(host.socket, 'submit-answer', { answerIndex: 2, roundId: question.roundId });
    assert.equal(ack.ok, true);
    const answer = session.players.get(host.playerId).answers[0];
    assert.ok(answer.points === 0 || answer.points === 500, 'late correct answers get the minimum score');
  } finally {
    await runtime.close();
  }
});

test('start and next are idempotent: double clicks and delayed duplicates never skip a question', async () => {
  const runtime = await startTestServer();
  try {
    const { room, host } = await hostRoom(runtime, { revealTiming: 'all_answered' });
    const starts = await Promise.all([emit(host.socket, 'start-game'), emit(host.socket, 'start-game')]);
    assert.ok(starts.every((ack) => ack.ok));
    assert.equal(starts.filter((ack) => ack.alreadyStarted).length, 1);

    const session = runtime.store.getSession(room.sessionId);
    const results = once(host.socket, 'question-results');
    await emit(host.socket, 'submit-answer', { answerIndex: 0, roundId: session.currentRoundId });
    await results;

    const [first, second] = await Promise.all([
      emit(host.socket, 'next-question', { fromQuestionIndex: 0 }),
      emit(host.socket, 'next-question', { fromQuestionIndex: 0 }),
    ]);
    assert.ok(first.ok && second.ok);
    assert.equal(session.currentQuestionIndex, 1, 'second click must not skip to question 3');
    assert.equal([first, second].filter((ack) => ack.stale).length, 1);

    // A "next" queued while offline and delivered later is ignored too.
    const late = await emit(host.socket, 'next-question', { fromQuestionIndex: 0 });
    assert.equal(late.stale, true);
    assert.equal(session.currentQuestionIndex, 1);
  } finally {
    await runtime.close();
  }
});

test('only the host can start or advance', async () => {
  const runtime = await startTestServer();
  try {
    const { room } = await hostRoom(runtime);
    const guest = await joinAs(runtime, room, 'Guest');
    const ack = await emit(guest.socket, 'start-game');
    assert.equal(ack.ok, false);
    assert.equal(ack.code, 'not_host');
    assert.equal(runtime.store.getSession(room.sessionId).gameState, 'waiting');
  } finally {
    await runtime.close();
  }
});

test('a player who drops mid-question reconnects to the same seat with their answer and score', async () => {
  const runtime = await startTestServer();
  try {
    const { room, host } = await hostRoom(runtime);
    const guest = await joinAs(runtime, room, 'Guest');
    const questionStart = once(guest.socket, 'question-start');
    await emit(host.socket, 'start-game');
    const question = await questionStart;
    await emit(guest.socket, 'submit-answer', { answerIndex: 3, roundId: question.roundId });
    guest.socket.close();
    await delay(50);

    const session = runtime.store.getSession(room.sessionId);
    assert.equal(session.players.get(guest.playerId).connected, false);

    const reconnectedNotice = once(host.socket, 'player-reconnected');
    const back = runtime.connect();
    const snapshot = once(back, 'state-snapshot');
    const ack = await emit(back, 'join-game', { sessionId: room.sessionId, username: 'Guest', playerToken: guest.playerToken });
    assert.equal(ack.ok, true);
    assert.equal(ack.reconnected, true);
    const state = await snapshot;
    await reconnectedNotice;
    assert.equal(state.phase, 'question');
    assert.equal(state.question.roundId, question.roundId);
    assert.equal(state.yourAnswerIndex, 3);
    assert.equal(session.players.size, 2, 'reconnect must not create a duplicate player');
  } finally {
    await runtime.close();
  }
});

test('opening the same seat in a second tab moves the seat; the old tab can no longer act', async () => {
  const runtime = await startTestServer();
  try {
    const { room, host } = await hostRoom(runtime);
    const guest = await joinAs(runtime, room, 'Guest');
    const secondTab = await joinAs(runtime, room, 'Guest', { playerToken: guest.playerToken });
    assert.equal(secondTab.playerId, guest.playerId);

    await emit(host.socket, 'start-game');
    const session = runtime.store.getSession(room.sessionId);
    const oldTab = await emit(guest.socket, 'submit-answer', { answerIndex: 0, roundId: session.currentRoundId });
    assert.equal(oldTab.ok, false);
    assert.equal(oldTab.code, 'not_joined');
    const newTab = await emit(secondTab.socket, 'submit-answer', { answerIndex: 0, roundId: session.currentRoundId });
    assert.equal(newTab.ok, true);
    assert.equal(session.players.size, 2);
  } finally {
    await runtime.close();
  }
});

test('late joiners can enter a game in progress and get the current question', async () => {
  const runtime = await startTestServer();
  try {
    const { room, host } = await hostRoom(runtime);
    await emit(host.socket, 'start-game');
    const lateSocket = runtime.connect();
    const snapshot = once(lateSocket, 'state-snapshot');
    const ack = await emit(lateSocket, 'join-game', { sessionId: room.sessionId, username: 'Late' });
    assert.equal(ack.ok, true);
    const state = await snapshot;
    assert.equal(state.phase, 'question');
    assert.equal(state.yourAnswerIndex, null);
  } finally {
    await runtime.close();
  }
});

test('host drop: grace period first, then a temporary host, and the owner reclaims control', async () => {
  const runtime = await startTestServer({ config: { hostGraceMs: 400 } });
  try {
    const { room, host } = await hostRoom(runtime);
    const guest = await joinAs(runtime, room, 'Guest');
    const session = runtime.store.getSession(room.sessionId);

    host.socket.close();
    await delay(80);
    assert.equal(session.getHostStatus(), 'reconnecting');
    const blocked = await emit(guest.socket, 'start-game');
    assert.equal(blocked.ok, false);
    assert.match(blocked.message, /reconnecting/);

    const hostChanged = once(guest.socket, 'host-changed', 2000);
    const promoted = await hostChanged;
    assert.equal(promoted.playerId, guest.playerId);
    assert.equal(promoted.role, 'temporary');
    assert.equal((await emit(guest.socket, 'start-game')).ok, true);

    const hostBack = await joinAs(runtime, room, 'Host', { playerToken: host.playerToken, hostToken: room.hostToken });
    assert.equal(hostBack.playerId, host.playerId);
    assert.equal(session.getHostPlayer().playerId, host.playerId);
    const guestNow = await emit(guest.socket, 'next-question', {});
    assert.equal(guestNow.ok, false, 'temporary host loses control when the owner returns');
  } finally {
    await runtime.close();
  }
});

test('reveal-when-all-answered reveals early and ignores disconnected players; timer mode waits', async () => {
  const runtime = await startTestServer();
  try {
    const { room, host } = await hostRoom(runtime, { revealTiming: 'all_answered' });
    const guest = await joinAs(runtime, room, 'Guest');
    const dropped = await joinAs(runtime, room, 'Dropped');
    await emit(host.socket, 'start-game');
    dropped.socket.close();
    await delay(50);
    const session = runtime.store.getSession(room.sessionId);
    const results = once(host.socket, 'question-results', 2000);
    await emit(host.socket, 'submit-answer', { answerIndex: 0, roundId: session.currentRoundId });
    await emit(guest.socket, 'submit-answer', { answerIndex: 1, roundId: session.currentRoundId });
    const payload = await results;
    assert.equal(payload.answerStats.reduce((a, b) => a + b, 0), 2);

    const timerRoom = await hostRoom(runtime, { revealTiming: 'timer' });
    await emit(timerRoom.host.socket, 'start-game');
    const timerSession = runtime.store.getSession(timerRoom.room.sessionId);
    await emit(timerRoom.host.socket, 'submit-answer', { answerIndex: 0, roundId: timerSession.currentRoundId });
    await delay(200);
    assert.equal(timerSession.gameState, 'question');
  } finally {
    await runtime.close();
  }
});

test('each player gets their own round result; the shared reveal lists everyone once', async () => {
  const runtime = await startTestServer();
  try {
    const { room, host } = await hostRoom(runtime, { revealTiming: 'all_answered' });
    const guest = await joinAs(runtime, room, 'Guest');
    await emit(host.socket, 'start-game');
    const session = runtime.store.getSession(room.sessionId);
    const correct = session.questions[0].correctAnswerIndex;
    const guestResult = once(guest.socket, 'round-result');
    const reveal = once(guest.socket, 'question-results');
    await emit(host.socket, 'submit-answer', { answerIndex: (correct + 1) % 4, roundId: session.currentRoundId });
    await emit(guest.socket, 'submit-answer', { answerIndex: correct, roundId: session.currentRoundId });
    const [mine, shared] = await Promise.all([guestResult, reveal]);
    assert.equal(mine.correct, true);
    assert.ok(mine.points >= 500 && mine.points <= 1000);
    assert.equal(shared.leaderboard[0].playerId, guest.playerId);
    assert.equal(shared.leaderboard.length, 2);
  } finally {
    await runtime.close();
  }
});

test('room caps and room-code guessing limits return clear errors', async () => {
  const runtime = await startTestServer({ config: { maxDemoPlayers: 2, failedJoinRateLimitPer15Min: 3 } });
  try {
    const { room } = await hostRoom(runtime);
    await joinAs(runtime, room, 'Second');
    await assert.rejects(joinAs(runtime, room, 'Third'), (error) => error.code === 'room_full');

    const guesses = [];
    for (let index = 0; index < 5; index += 1) {
      guesses.push(await joinAs(runtime, { sessionId: `ZZZZZZZZ${index}Z` }, 'Guesser').catch((error) => error.code));
    }
    assert.deepEqual(guesses.slice(0, 3), ['room_not_found', 'room_not_found', 'room_not_found']);
    assert.equal(guesses[4], 'rate_limited');
  } finally {
    await runtime.close();
  }
});

test('leaving the lobby removes the player; leaving mid-game keeps their score', async () => {
  const runtime = await startTestServer();
  try {
    const { room, host } = await hostRoom(runtime);
    const guest = await joinAs(runtime, room, 'Guest');
    await emit(guest.socket, 'leave-game');
    const session = runtime.store.getSession(room.sessionId);
    assert.equal(session.players.size, 1);

    const guest2 = await joinAs(runtime, room, 'Guest2');
    await emit(host.socket, 'start-game');
    await emit(guest2.socket, 'leave-game');
    assert.equal(session.players.size, 2);
    assert.equal(session.players.get(guest2.playerId).connected, false);
  } finally {
    await runtime.close();
  }
});

test('host can start the next game with the same players', async () => {
  const runtime = await startTestServer();
  try {
    const { room, host } = await hostRoom(runtime, { revealTiming: 'all_answered' });
    const guest = await joinAs(runtime, room, 'Guest');
    const session = runtime.store.getSession(room.sessionId);
    runtime.gameService.endGame(session);

    const denied = await api(runtime.baseUrl, `/api/sessions/${room.sessionId}/next`, {
      body: { demoId: 'space', hostToken: 'not-the-host-token' },
    });
    assert.equal(denied.status, 403);

    const guestReady = once(guest.socket, 'next-game-ready');
    const next = await api(runtime.baseUrl, `/api/sessions/${room.sessionId}/next`, {
      body: { demoId: 'space', hostToken: room.hostToken },
    });
    assert.equal(next.status, 200);
    const ready = await guestReady;
    assert.equal(ready.session.sessionId, next.body.sessionId);
    assert.equal(ready.hostToken, null);
    const again = await api(runtime.baseUrl, `/api/sessions/${room.sessionId}/next`, {
      body: { demoId: 'space', hostToken: room.hostToken },
    });
    assert.equal(again.body.sessionId, next.body.sessionId, 'double submit reuses the successor');
    assert.equal(runtime.store.getSession(next.body.sessionId).players.size, 2);
    assert.equal((await emit(host.socket, 'start-game')).ok, true, 'host controls the new room');
  } finally {
    await runtime.close();
  }
});

test('review mode: questions are only visible to the host of a review-mode game, before start', async () => {
  const runtime = await startTestServer();
  try {
    const surprise = await hostRoom(runtime);
    const hidden = await api(runtime.baseUrl, `/api/sessions/${surprise.room.sessionId}/review`, {
      method: 'GET',
      headers: { 'x-host-token': surprise.room.hostToken },
    });
    assert.equal(hidden.status, 403);
    assert.equal(hidden.body.code, 'surprise_mode');

    const { room, host } = await hostRoom(runtime, { reviewMode: true });
    const guest = await joinAs(runtime, room, 'Guest');
    const wrongToken = await api(runtime.baseUrl, `/api/sessions/${room.sessionId}/review`, {
      method: 'GET',
      headers: { 'x-host-token': guest.playerToken },
    });
    assert.equal(wrongToken.status, 403);

    const summary = once(guest.socket, 'session-updated');
    const review = await api(runtime.baseUrl, `/api/sessions/${room.sessionId}/review`, {
      method: 'GET',
      headers: { 'x-host-token': room.hostToken },
    });
    assert.equal(review.status, 200);
    assert.equal(review.body.questions.length, 10);
    assert.equal((await summary).hostReviewed, true, 'players can see that the host has seen the questions');

    const edited = review.body.questions.slice(0, 6);
    edited[0] = { ...edited[0], question: 'Edited question text for the class?' };
    const saved = await api(runtime.baseUrl, `/api/sessions/${room.sessionId}/review`, {
      method: 'PUT',
      headers: { 'x-host-token': room.hostToken },
      body: { questions: edited },
    });
    assert.equal(saved.status, 200);
    assert.equal(runtime.store.getSession(room.sessionId).questions.length, 6);

    await emit(host.socket, 'start-game');
    const tooLate = await api(runtime.baseUrl, `/api/sessions/${room.sessionId}/review`, {
      method: 'PUT',
      headers: { 'x-host-token': room.hostToken },
      body: { questions: edited },
    });
    assert.equal(tooLate.status, 409);
  } finally {
    await runtime.close();
  }
});

test('clients are told before a restart and new games are refused while shutting down', async () => {
  const runtime = await startTestServer({ config: { shutdownGraceMs: 200 } });
  try {
    const { host } = await hostRoom(runtime);
    const notice = once(host.socket, 'server-restarting');
    const done = runtime.shutdown('test');
    assert.match((await notice).message, /restarting/);
    const refused = await api(runtime.baseUrl, '/api/create-session', { body: { demoId: 'space' } });
    assert.equal(refused.status, 503);
    const ready = await api(runtime.baseUrl, '/ready', { method: 'GET' });
    assert.equal(ready.status, 503);
    await done;
  } finally {
    await runtime.close().catch(() => {});
  }
});

test('abandoned rooms are reaped and their timers cleared', async () => {
  const runtime = await startTestServer({ config: { sessionRetentionMs: 10 } });
  try {
    const { room, host } = await hostRoom(runtime);
    await emit(host.socket, 'start-game');
    host.socket.close();
    await delay(60);
    const session = runtime.store.getSession(room.sessionId);
    runtime.store.reapExpiredSessions(Date.now() + 1000);
    assert.equal(runtime.store.getSession(room.sessionId), null);
    assert.equal(session.currentQuestionTimer, null);
    assert.equal(runtime.store.getSocketIndexSize(), 0);
  } finally {
    await runtime.close();
  }
});
