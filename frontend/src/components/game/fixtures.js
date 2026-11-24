// Content fixtures for the game screens (brief 2.2 and 12 / A2): used by /dev/stage,
// the fit-check script (scripts/fit-check.mjs) and component tests. Payload shapes
// follow backend/src/game (buildQuestionPayload, buildResultsPayload, toSummary).

export const QUESTIONS = {
  // 28 chars, answers 4–10.
  short: {
    question: 'Which planet is the largest?',
    choices: ['Jupiter', 'Saturn', 'Neptune', 'Earth'],
    correct: 0,
  },
  // 90 chars, answers 20–40.
  typical: {
    question: 'Which composer wrote the opera The Magic Flute, first staged in Vienna in September, 1791?',
    choices: ['Wolfgang Amadeus Mozart', 'Ludwig van Beethoven', 'Joseph Haydn of Esterháza', 'Antonio Salieri, court composer'],
    correct: 0,
  },
  // Schema maximum: 240-char question, four 120-char answers.
  long: {
    question:
      'In the early years of the twentieth century, which Antarctic expedition, led by a British naval officer who later became a national hero, reached the South Pole only to find that a rival Norwegian team had got there five weeks earlier then?',
    choices: [
      'The Terra Nova Expedition of 1910 to 1913, led by Robert Falcon Scott, whose party died on the march back across the ice',
      'The Nimrod Expedition of 1907 to 1909, led by Ernest Shackleton, which turned back 97 miles short of the geographic pole',
      'The Discovery Expedition of 1901 to 1904, the first official British survey of the area, with Scott and Shackleton on it',
      'The Endurance Expedition of 1914 to 1917, whose ship was crushed by the pack ice before the planned crossing could begin',
    ],
    correct: 0,
  },
  // 60 chars with one 28-letter word; one answer is a single 24-letter word.
  word: {
    question: 'Is antidisestablishmentarianism a real word in dictionaries?',
    choices: ['Yes, it is', 'Pneumonoultramicroscopic', 'Only in English', 'No'],
    correct: 0,
  },
};

export const FIXTURE_IDS = Object.keys(QUESTIONS);
export const PLAYER_COUNTS = [1, 2, 3, 9, 150];

export const TOPIC_80 = 'Famous bridges, tunnels and harbour works along the Baltic Sea coasts since 1850';

const FIRST = ['Alexandra', 'Christopher', 'Maximilian', 'Kristiina', 'Johannes', 'Elisabeth', 'Sebastian', 'Annabella', 'Gabriella', 'Valentina', 'Frederick', 'Henrietta', 'Bartholomew', 'Evangeline', 'Jacqueline', 'Konstantin', 'Margareta', 'Theodora', 'Nathaniel', 'Wilhelmina'];
const LAST = ['Montgomery', 'Tammekivi', 'Vanderbilt', 'Fitzgerald', 'Rosenberg', 'Kowalczyk', 'Hargreaves', 'Delacroix', 'Abernathy', 'Lindqvist', 'Oyelaran'];
const EXTRA = ['Saarinen', 'Rasmussen', 'Pemberton', 'Kuusksalu', 'Okonkwo'];

// Names of exactly 24 characters.
export function playerName(index) {
  const first = FIRST[index % FIRST.length];
  const last = LAST[Math.floor(index / FIRST.length) % LAST.length];
  const extra = EXTRA[index % EXTRA.length];
  return `${first} ${last}-${extra}${'abcdefghij'}`.slice(0, 24);
}

// The viewer's position in the room (so "my row" is sometimes outside the top rows).
function viewerIndex(count) {
  if (count >= 150) return 120;
  if (count >= 9) return 6;
  return count - 1;
}

export function buildPlayers(count, { offline = [] } = {}) {
  return Array.from({ length: count }, (_, index) => ({
    playerId: `p${index + 1}`,
    username: playerName(index),
    score: Math.max(0, 4200 - index * 23 - (index % 3) * 7),
    connected: !offline.includes(index),
    role: index === 0 ? 'owner' : 'player',
  }));
}

export function buildLeaderboard(players, totalQuestions = 10) {
  return [...players]
    .sort((left, right) => right.score - left.score)
    .map((player, index) => ({
      rank: index + 1,
      playerId: player.playerId,
      username: player.username,
      score: player.score,
      answeredCount: totalQuestions,
      correctAnswerCount: Math.max(0, 9 - Math.floor(index / 12)),
      totalQuestions,
      connected: player.connected,
    }));
}

// Everything a game screen needs for one dev-stage / test state.
// params: phase, role, fixture, players, sub, outcome, review, host, solo, standin,
//         last, demo, signed, t, lang, topic
export function buildStage(params = {}) {
  const phase = params.phase || 'question';
  const role = params.role === 'player' ? 'player' : 'host';
  const fixture = QUESTIONS[params.fixture] || QUESTIONS.typical;
  const count = Number(params.players) || (params.solo ? 1 : 9);
  const players = buildPlayers(count, { offline: count > 3 ? [4] : [] });
  const me = role === 'host' ? 0 : viewerIndex(count);
  // The host is the first player; as a stand-in host the viewer holds the temporary role.
  if (params.standin && role === 'host') players[0].role = 'player';
  const viewer = players[role === 'host' && !params.standin ? 0 : me];
  if (params.standin && role === 'host') viewer.role = 'temporary';
  const now = Date.now();
  const remaining = params.sub === 'timeup' ? 0 : Number(params.t ?? 14) * 1000;
  const roundId = `round-${params.fixture || 'typical'}-${phase}`;
  const isDemo = params.demo !== '0' && params.demo !== false;
  const gameState = { lobby: 'waiting', question: 'question', reveal: 'results', final: 'ended' }[phase] || 'question';

  const session = {
    sessionId: 'ABCDE23456',
    topic: params.topic === 'short' ? 'World capitals' : TOPIC_80,
    language: params.lang === 'et' ? 'Estonian' : 'English',
    questionCount: 10,
    questionTimeLimitMs: 20000,
    revealTiming: 'timer',
    questionSource: isDemo ? 'demo' : 'ai',
    isDemo,
    demoId: isDemo ? 'warm-up' : null,
    reviewMode: Boolean(params.review),
    hostReviewed: false,
    maxPlayers: isDemo ? 30 : 150,
    gameState,
    currentQuestionIndex: 2,
    currentRoundId: roundId,
    hostStatus: params.host || (params.standin ? 'away' : 'present'),
    hostPlayerId: viewer && role === 'host' ? viewer.playerId : players[0].playerId,
    connectedPlayerCount: players.filter((player) => player.connected).length,
    players,
  };

  const seat = {
    sessionId: session.sessionId,
    playerId: viewer.playerId,
    playerToken: 'fixture-player-token',
    hostToken: role === 'host' && !params.standin ? 'fixture-host-token' : null,
    username: viewer.username,
  };

  const question = {
    roundId,
    questionIndex: 2,
    questionNumber: params.last ? 10 : 3,
    totalQuestions: 10,
    question: fixture.question,
    choices: fixture.choices,
    timeLimit: 20000,
    revealTiming: 'timer',
    questionStartedAt: now - (20000 - remaining),
    questionEndsAt: now + remaining,
    serverTime: now,
    clientReceivedAt: now,
  };

  const subStatus = { sending: 'sending', locked: 'locked', failed: 'failed' }[params.sub];
  const myAnswer = subStatus
    ? { roundId, index: 1, status: subStatus, message: subStatus === 'failed' ? 'That question has already closed.' : undefined }
    : null;
  const answered = Math.max(0, Math.round(session.connectedPlayerCount * 0.7));

  const leaderboard = buildLeaderboard(players);
  const outcome = params.outcome || 'correct';
  const answerStats = count === 1 ? [outcome === 'correct' ? 1 : 0, outcome === 'wrong' ? 1 : 0, 0, 0] : spreadStats(count, fixture.correct);
  const results = {
    roundId,
    questionIndex: 2,
    questionNumber: params.last ? 10 : 3,
    totalQuestions: 10,
    questionText: fixture.question,
    choices: fixture.choices,
    correctAnswer: fixture.correct,
    answerStats,
    leaderboard,
    isLastQuestion: Boolean(params.last),
  };
  const roundResult =
    outcome === 'none'
      ? { roundId, answerIndex: null, points: 0, correct: false }
      : outcome === 'wrong'
        ? { roundId, answerIndex: (fixture.correct + 2) % 4, points: 0, correct: false }
        : { roundId, answerIndex: fixture.correct, points: 776, correct: true };

  return {
    phase,
    role,
    session,
    seat,
    isHost: role === 'host',
    question,
    myAnswer,
    progress: { roundId, answeredCount: answered },
    results,
    roundResult,
    leaderboard,
    remainingMs: remaining,
    config: { aiAvailable: true, demoQuizzes: [{ id: 'warm-up', title: 'Quick warm-up', language: 'English' }, { id: 'world', title: 'Around the world', language: 'English' }] },
  };
}

// Answer counts with one empty answer (zero counts must not be shown).
function spreadStats(count, correct) {
  const stats = [0, 0, 0, 0];
  const answered = Math.max(1, Math.round(count * 0.85));
  stats[correct] = Math.ceil(answered * 0.55);
  const wrong = [0, 1, 2, 3].filter((index) => index !== correct);
  stats[wrong[0]] = Math.floor((answered - stats[correct]) * 0.7);
  stats[wrong[1]] = answered - stats[correct] - stats[wrong[0]];
  stats[wrong[2]] = 0;
  return stats;
}
