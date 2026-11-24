import React from 'react';
import { GameShell } from '../game/GameShell';
import { QuestionScreen, ResultsScreen } from '../game/RoundScreens';

// The real game screens, in preview mode, for the hero's device stage. Content is the
// free demo's question; the shell is inert and hidden from assistive tech.

const QUESTION = 'Which spice comes from the dried stigmas of a crocus flower?';
const CHOICES = ['Turmeric', 'Saffron', 'Cardamom', 'Paprika'];
const CORRECT = 1;
const TIME_LIMIT_MS = 20000;
const PLAYERS = 9;

const session = {
  sessionId: 'ABCDE23456',
  language: 'English',
  connectedPlayerCount: PLAYERS,
  hostStatus: 'present',
  revealTiming: 'timer',
  isDemo: true,
};

const seat = { playerId: 'me' };
const noop = () => {};

function questionProps(frame) {
  const roundId = `hero-${frame.loop}`;
  return {
    question: {
      roundId,
      questionNumber: 3,
      totalQuestions: 10,
      question: QUESTION,
      choices: CHOICES,
      timeLimit: TIME_LIMIT_MS,
      revealTiming: 'timer',
    },
    session,
    progress: { answeredCount: frame.answered },
    remainingMs: frame.remainingMs,
    onAnswer: noop,
  };
}

function resultsProps(frame) {
  return {
    results: {
      roundId: `hero-${frame.loop}-reveal`,
      questionNumber: 3,
      totalQuestions: 10,
      questionText: QUESTION,
      choices: CHOICES,
      correctAnswer: CORRECT,
      answerStats: [1, 7, 1, 0],
      // No invented names: the only row is the viewer's own.
      leaderboard: [{ rank: 1, playerId: 'me', username: 'Player', score: 2318, answeredCount: 3, correctAnswerCount: 3, totalQuestions: 10, connected: true }],
      isLastQuestion: false,
    },
    roundResult: { roundId: `hero-${frame.loop}-reveal`, answerIndex: CORRECT, points: 776, correct: true },
    session,
    seat,
    onNext: noop,
  };
}

// The host screen is shown in the Big screen layout: the shared screen never shows the
// host's own pick or result, and the join address and room code stay visible.
export function HeroHostScreen({ frame }) {
  return (
    <GameShell preview defaultBig sessionId={session.sessionId} phase={frame.phase === 'reveal' ? 'reveal' : 'question'} role="host">
      {frame.phase === 'reveal' ? (
        <ResultsScreen {...resultsProps(frame)} isHost />
      ) : (
        <QuestionScreen {...questionProps(frame)} myAnswer={null} />
      )}
    </GameShell>
  );
}

export function HeroPhoneScreen({ frame }) {
  const props = questionProps(frame);
  const myAnswer = frame.phoneAnswer ? { roundId: props.question.roundId, index: CORRECT, status: frame.phoneAnswer } : null;
  return (
    <GameShell preview phase={frame.phase === 'reveal' ? 'reveal' : 'question'} role="player">
      {frame.phase === 'reveal' ? (
        <ResultsScreen {...resultsProps(frame)} isHost={false} />
      ) : (
        <QuestionScreen {...props} myAnswer={myAnswer} />
      )}
    </GameShell>
  );
}
