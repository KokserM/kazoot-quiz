#!/usr/bin/env node
// Bounded load test against a local or staging server. Never point this at production.
//
//   node scripts/loadtest.js --url http://127.0.0.1:5055 --rooms 5 --players 40 --questions 3
//
// Each room: create a demo game, connect players over WebSocket, play N questions
// with every player answering at a random time. Reports join time, answer
// acknowledgement latency, missed reveals, and server-side errors.
const { io } = require('socket.io-client');

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const url = arg('url', 'http://127.0.0.1:5055');
const rooms = Number(arg('rooms', 3));
const playersPerRoom = Number(arg('players', 20));
const questions = Number(arg('questions', 3));
const timeLimitMs = Number(arg('time', 10000));

if (/kazoot\.app/.test(url)) {
  console.error('Refusing to load-test production.');
  process.exit(1);
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function connect() {
  return io(url, { transports: ['websocket'], forceNew: true, reconnection: false });
}

async function runRoom(roomIndex, stats) {
  const response = await fetch(`${url}/api/create-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.0.${roomIndex}.1` },
    body: JSON.stringify({ demoId: 'warm-up', questionTimeLimitMs: timeLimitMs, revealTiming: 'all_answered' }),
  });
  const room = await response.json();
  if (!room.sessionId) throw new Error(`create failed: ${JSON.stringify(room)}`);

  const sockets = [];
  const joinStarted = Date.now();
  for (let index = 0; index < playersPerRoom; index += 1) {
    const socket = connect();
    sockets.push(socket);
    socket.reveals = 0;
    socket.on('question-results', () => {
      socket.reveals += 1;
    });
    socket.on('question-start', (question) => {
      const wait = Math.random() * Math.min(3000, timeLimitMs * 0.5);
      setTimeout(async () => {
        const sent = Date.now();
        try {
          const ack = await socket.timeout(10_000).emitWithAck('submit-answer', {
            answerIndex: Math.floor(Math.random() * 4),
            roundId: question.roundId,
          });
          stats.ackMs.push(Date.now() - sent);
          if (!ack.ok) stats.rejected[ack.code] = (stats.rejected[ack.code] || 0) + 1;
        } catch (error) {
          stats.timeouts += 1;
        }
      }, wait);
    });
  }

  await Promise.all(
    sockets.map(async (socket, index) => {
      const started = Date.now();
      const ack = await socket.timeout(15_000).emitWithAck('join-game', {
        sessionId: room.sessionId,
        username: `P${index}`,
        ...(index === 0 ? { hostToken: room.hostToken } : {}),
      });
      if (!ack.ok) throw new Error(`join failed: ${ack.code}`);
      stats.joinMs.push(Date.now() - started);
    })
  );
  stats.roomJoinAllMs.push(Date.now() - joinStarted);

  const host = sockets[0];
  await host.timeout(5000).emitWithAck('start-game', {});
  for (let q = 0; q < questions; q += 1) {
    await new Promise((resolve) => host.once('question-results', resolve));
    if (q < questions - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await host.timeout(5000).emitWithAck('next-question', { fromQuestionIndex: q });
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  stats.missedReveals += sockets.filter((socket) => socket.reveals < questions).length;
  sockets.forEach((socket) => socket.close());
}

async function main() {
  const stats = { joinMs: [], roomJoinAllMs: [], ackMs: [], timeouts: 0, rejected: {}, missedReveals: 0 };
  const started = Date.now();
  const results = await Promise.allSettled(Array.from({ length: rooms }, (_, index) => runRoom(index, stats)));
  const failures = results.filter((result) => result.status === 'rejected').map((result) => result.reason.message);
  const health = await fetch(`${url}/health`).then((r) => r.json()).catch(() => null);

  console.log(
    JSON.stringify(
      {
        config: { rooms, playersPerRoom, totalPlayers: rooms * playersPerRoom, questions, timeLimitMs },
        durationMs: Date.now() - started,
        roomFailures: failures,
        joinMs: { p50: percentile(stats.joinMs, 50), p95: percentile(stats.joinMs, 95), max: Math.max(0, ...stats.joinMs) },
        answerAckMs: { p50: percentile(stats.ackMs, 50), p95: percentile(stats.ackMs, 95), p99: percentile(stats.ackMs, 99), count: stats.ackMs.length },
        ackTimeouts: stats.timeouts,
        rejectedAnswers: stats.rejected,
        playersMissingAReveal: stats.missedReveals,
        server: health && { heapUsedMb: health.process?.memory?.heapUsedMb, rssMb: health.process?.memory?.rssMb, eventLoopDelayMs: health.process?.eventLoopDelayMs },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
