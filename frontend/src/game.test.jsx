import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AuthProvider } from './auth/AuthProvider';
import { AnswerGrid } from './components/game/AnswerGrid';
import { FinalScreen, finalActionsFor } from './components/game/FinalScreen';
import { buildStage, QUESTIONS } from './components/game/fixtures';
import { GameShell } from './components/game/GameShell';
import { Lobby } from './components/game/Lobby';
import { QuestionScreen, ResultsScreen } from './components/game/RoundScreens';
import { answerColumns, answerTier, longestWord, pickRows, questionTier, stageMode, visibleAnswerCounts } from './lib/gameUi';

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
  navigator.sendBeacon = vi.fn(() => true);
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

function onStage(element, { phase = 'question', role = 'host' } = {}) {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <GameShell phase={phase} role={role} sessionId="ABCDE23456" canBigScreen={role === 'host'}>
          {element}
        </GameShell>
      </MemoryRouter>
    </AuthProvider>
  );
}

// ------------------------------------------------------------------ tiers (brief 8.5)

describe('length tiers', () => {
  test('question tier by length', () => {
    expect(questionTier('x'.repeat(28))).toBe('xs');
    expect(questionTier('x'.repeat(60))).toBe('xs');
    expect(questionTier('x'.repeat(61))).toBe('s');
    expect(questionTier('x'.repeat(120))).toBe('s');
    expect(questionTier('x'.repeat(121))).toBe('m');
    expect(questionTier('x'.repeat(180))).toBe('m');
    expect(questionTier('x'.repeat(181))).toBe('l');
    expect(questionTier('x'.repeat(240))).toBe('l');
    expect(questionTier('  short  ')).toBe('xs');
    expect(questionTier(undefined)).toBe('xs');
  });

  test('answer tier by the longest answer', () => {
    expect(answerTier(['a', 'b', 'c', 'd'])).toBe('s');
    expect(answerTier(['a', 'x'.repeat(24), 'c', 'd'])).toBe('s');
    expect(answerTier(['a', 'x'.repeat(25), 'c', 'd'])).toBe('m');
    expect(answerTier(['x'.repeat(60), 'b', 'c', 'd'])).toBe('m');
    expect(answerTier(['x'.repeat(61), 'b', 'c', 'd'])).toBe('l');
    expect(answerTier(QUESTIONS.long.choices)).toBe('l');
    expect(answerTier([])).toBe('s');
  });

  test('longest word', () => {
    expect(longestWord(QUESTIONS.word.choices)).toBe(24);
    expect(longestWord('Is antidisestablishmentarianism a word')).toBe(28);
    expect(longestWord(['Ludwig van Beethoven', 'Mozart'])).toBe(9);
    expect(longestWord(['well-known', 'a/b'])).toBe(5);
    expect(longestWord([])).toBe(0);
  });

  test('fixtures have the lengths the brief asks for', () => {
    expect(QUESTIONS.short.question).toHaveLength(28);
    expect(QUESTIONS.typical.question).toHaveLength(90);
    expect(QUESTIONS.long.question).toHaveLength(240);
    QUESTIONS.long.choices.forEach((choice) => expect(choice).toHaveLength(120));
    expect(QUESTIONS.word.question).toHaveLength(60);
    expect(buildStage({ players: 150 }).session.players.every((player) => player.username.length === 24)).toBe(true);
    expect(buildStage({}).session.topic).toHaveLength(80);
  });

  test('stage modes and the answer grid shape', () => {
    expect(stageMode(360, 560)).toBe('P');
    expect(stageMode(768, 1024)).toBe('P');
    expect(stageMode(568, 270)).toBe('L');
    expect(stageMode(932, 380)).toBe('L');
    expect(stageMode(1024, 768)).toBe('W');
    expect(stageMode(1920, 1080)).toBe('W');
    expect(answerColumns({ mode: 'P', width: 360, choices: QUESTIONS.short.choices })).toBe(2);
    expect(answerColumns({ mode: 'P', width: 360, choices: QUESTIONS.typical.choices })).toBe(1);
    expect(answerColumns({ mode: 'P', width: 360, choices: QUESTIONS.word.choices })).toBe(1);
    expect(answerColumns({ mode: 'P', width: 768, choices: QUESTIONS.typical.choices })).toBe(2);
    expect(answerColumns({ mode: 'P', width: 768, choices: QUESTIONS.long.choices })).toBe(1);
    expect(answerColumns({ mode: 'L', width: 568, choices: QUESTIONS.long.choices })).toBe(2);
    expect(answerColumns({ mode: 'W', width: 1280, choices: QUESTIONS.long.choices })).toBe(2);
  });

  test('rows that fit keep the viewer', () => {
    const entries = Array.from({ length: 9 }, (_, index) => ({ playerId: `p${index + 1}`, rank: index + 1 }));
    expect(pickRows(entries, 'p7', 4).map((entry) => entry.rank)).toEqual([1, 2, 3, 7]);
    expect(pickRows(entries, 'p2', 4).map((entry) => entry.rank)).toEqual([1, 2, 3, 4]);
    expect(pickRows(entries, 'p7', 1).map((entry) => entry.rank)).toEqual([7]);
    expect(pickRows(entries, null, 1).map((entry) => entry.rank)).toEqual([1]);
    expect(pickRows(entries, 'p7', 0)).toEqual([]);
  });
});

// --------------------------------------------------------------- reveal counts (A6)

describe('reveal counts', () => {
  test('zero counts are never shown and solo rooms show none', () => {
    expect(visibleAnswerCounts([3, 0, 1, 0], 4)).toEqual([3, 0, 1, 0]);
    expect(visibleAnswerCounts([1, 0, 0, 0], 1)).toBeNull();
    expect(visibleAnswerCounts([0, 0, 0, 0], 5)).toBeNull();
  });

  test('compact rows: counts only above zero, with full accessible labels', () => {
    render(<AnswerGrid mode="reveal" compact choices={['A1', 'B1', 'C1', 'D1']} correctIndex={0} selectedIndex={2} counts={[3, 0, 1, 0]} playerCount={6} />);
    const rows = within(screen.getByRole('list', { name: 'Answers' })).getAllByRole('listitem');
    expect(within(rows[0]).getByText('3 players')).toBeInTheDocument();
    expect(within(rows[2]).getByText('1 player')).toBeInTheDocument();
    expect(rows[1].textContent).not.toMatch(/player/);
    expect(rows[3].textContent).not.toMatch(/player/);
    expect(within(rows[0]).getByText('Correct')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Your answer')).toBeInTheDocument();
  });

  test('tiles: no "0 players" line, and nothing at all in a solo room', () => {
    const { unmount } = render(<AnswerGrid mode="reveal" choices={['A1', 'B1', 'C1', 'D1']} correctIndex={1} counts={[0, 2, 0, 0]} playerCount={3} />);
    expect(screen.getByText('2 players · 100%')).toBeInTheDocument();
    expect(screen.queryByText(/0 players/)).toBeNull();
    unmount();
    render(<AnswerGrid mode="reveal" choices={['A1', 'B1', 'C1', 'D1']} correctIndex={1} selectedIndex={1} counts={[0, 1, 0, 0]} playerCount={1} />);
    expect(screen.queryByText(/player/)).toBeNull();
    expect(screen.getByText('Correct · yours')).toBeInTheDocument();
  });

  test('a solo reveal screen shows no counts', () => {
    const stage = buildStage({ phase: 'reveal', players: 1, solo: true });
    onStage(<ResultsScreen results={stage.results} roundResult={stage.roundResult} session={stage.session} seat={stage.seat} isHost onNext={() => {}} />, { phase: 'reveal' });
    expect(screen.queryByText(/^\d+ players?( ·.*)?$/)).toBeNull();
  });
});

// --------------------------------------------------------------------- the dock

describe('host action in the dock', () => {
  test('reveal: "Next question" is in the dock, after the content', () => {
    const stage = buildStage({ phase: 'reveal', players: 9 });
    const { container } = onStage(<ResultsScreen results={stage.results} roundResult={stage.roundResult} session={stage.session} seat={stage.seat} isHost onNext={() => {}} />, { phase: 'reveal' });
    const button = screen.getByRole('button', { name: /Next question/ });
    expect(button.closest('[data-part="dock"]')).not.toBeNull();
    const buttons = [...container.querySelectorAll('#game-stage button')].filter((element) => !element.closest('dialog'));
    expect(buttons[buttons.length - 1]).toBe(button);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Correct · +776 pts. You’re 1st.');
  });

  test('reveal: the last question offers "Show final results"; players see a status instead', () => {
    const stage = buildStage({ phase: 'reveal', players: 9, last: true });
    const { unmount } = onStage(<ResultsScreen results={stage.results} roundResult={stage.roundResult} session={stage.session} seat={stage.seat} isHost onNext={() => {}} />, { phase: 'reveal' });
    expect(screen.getByRole('button', { name: /Show final results/ }).closest('[data-part="dock"]')).not.toBeNull();
    unmount();
    const player = buildStage({ phase: 'reveal', players: 9, role: 'player' });
    onStage(<ResultsScreen results={player.results} roundResult={player.roundResult} session={player.session} seat={player.seat} isHost={false} onNext={() => {}} />, { phase: 'reveal', role: 'player' });
    expect(screen.queryByRole('button', { name: /Next question/ })).toBeNull();
    expect(screen.getByText('Waiting for the host to continue…').closest('[data-part="dock"]')).not.toBeNull();
  });

  test('lobby: "Start game" is in the dock', () => {
    const stage = buildStage({ phase: 'lobby', players: 9 });
    onStage(<Lobby session={stage.session} seat={stage.seat} isHost onStart={() => {}} onLeave={() => {}} />, { phase: 'lobby' });
    expect(screen.getByRole('button', { name: 'Start game' }).closest('[data-part="dock"]')).not.toBeNull();
    expect(screen.getByLabelText('Room code A B C D E 2 3 4 5 6')).toBeInTheDocument();
  });

  test('question: tiles stay operable and the locked status is in the dock', () => {
    const stage = buildStage({ phase: 'question', sub: 'locked' });
    onStage(<QuestionScreen question={stage.question} myAnswer={stage.myAnswer} progress={stage.progress} session={stage.session} onAnswer={() => {}} remainingMs={14000} />);
    expect(within(screen.getByRole('group', { name: 'Answers' })).getAllByRole('button')).toHaveLength(4);
    expect(screen.getByText('Locked in. The answer appears when time is up.').closest('[data-part="dock"]')).not.toBeNull();
    expect(screen.getByText('6 of 8 answered')).toBeInTheDocument();
    expect(screen.getAllByText('Question 3 of 10').length).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------ final role table (8.9)

function renderFinal(params, signedIn) {
  const stage = buildStage({ phase: 'final', ...params });
  return onStage(
    <FinalScreen leaderboard={stage.leaderboard} session={stage.session} seat={stage.seat} isHost={stage.isHost} config={stage.config} onLeave={() => {}} signedIn={signedIn} />,
    { phase: 'final', role: stage.role }
  );
}

function actionLabels() {
  const panel = document.querySelector('[data-actions]');
  return [...panel.querySelectorAll('.buttons > *')].map((element) => [element.textContent, element.classList.contains('primary') ? 'primary' : 'secondary']);
}

describe('final actions follow the role table', () => {
  test('finalActionsFor', () => {
    expect(finalActionsFor({ isOwnerHost: true, isDemo: true, signedIn: false })).toBe('demo-owner');
    expect(finalActionsFor({ isOwnerHost: true, isDemo: true, signedIn: true })).toBe('owner');
    expect(finalActionsFor({ isOwnerHost: true, isDemo: false, signedIn: true })).toBe('owner');
    expect(finalActionsFor({ isOwnerHost: false, isDemo: true, signedIn: false })).toBe('player');
  });

  test('demo owner-host, signed out: "Create your own quiz" first and primary', () => {
    renderFinal({ role: 'host', players: 1 }, false);
    expect(actionLabels()).toEqual([
      ['Create your own quiz', 'primary'],
      ['Play another', 'secondary'],
    ]);
    expect(screen.getByRole('link', { name: 'Create your own quiz' })).toHaveAttribute('href', '/create');
    expect(screen.getByRole('heading', { level: 1, name: 'Quiz complete' })).toBeInTheDocument();
  });

  test('signed-in owner-host: play again first', () => {
    renderFinal({ role: 'host', players: 9 }, true);
    expect(actionLabels()).toEqual([
      ['Play again with this group', 'primary'],
      ['Create your own quiz', 'secondary'],
    ]);
    expect(screen.getByRole('heading', { level: 1, name: 'You won!' })).toBeInTheDocument();
  });

  test('player: "Create your own quiz" and the auto-move caption, no play-again', () => {
    renderFinal({ role: 'player', players: 9 }, false);
    expect(actionLabels()).toEqual([['Create your own quiz', 'primary']]);
    expect(screen.getByText('If the host starts another game, you’ll move to it automatically — just keep this page open.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Play again|Play another/ })).toBeNull();
    expect(screen.getByRole('list', { name: 'Top three' })).toBeInTheDocument();
  });
});

describe('game shell', () => {
  test('marks the document while mounted and restores it after', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', '#F8F7FC');
    document.head.appendChild(meta);
    const stage = buildStage({ phase: 'lobby' });
    const { unmount } = onStage(<Lobby session={stage.session} seat={stage.seat} isHost onStart={() => {}} onLeave={() => {}} />, { phase: 'lobby' });
    expect(document.documentElement.getAttribute('data-game-shell')).toBe('true');
    expect(meta.getAttribute('content')).toBe('#100A1C');
    unmount();
    expect(document.documentElement.hasAttribute('data-game-shell')).toBe(false);
    expect(meta.getAttribute('content')).toBe('#F8F7FC');
    meta.remove();
  });

  test('preview mode is inert and leaves the document alone', () => {
    const stage = buildStage({ phase: 'question' });
    const { container } = render(
      <GameShell preview phase="question">
        <QuestionScreen question={stage.question} myAnswer={null} progress={stage.progress} session={stage.session} remainingMs={13000} />
      </GameShell>
    );
    const shell = container.firstChild;
    expect(shell).toHaveAttribute('data-preview');
    expect(shell).toHaveAttribute('aria-hidden', 'true');
    expect(shell).toHaveAttribute('inert');
    expect(document.documentElement.hasAttribute('data-game-shell')).toBe(false);
  });
});
