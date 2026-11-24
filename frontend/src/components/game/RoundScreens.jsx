import React, { useEffect, useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import { useFitStage } from '../../lib/fitStage';
import { answerColumns, questionTier, quizLang } from '../../lib/gameUi';
import { Icon } from '../Icon';
import { Button, Card, Eyebrow } from '../ui';
import { Sheet } from '../Sheet';
import { AnswerGrid } from './AnswerGrid';
import { Countdown, useCountdown } from './Countdown';
import { ActionButton, BigScreenToggle, Body, Dock, GameFrame, StatusText, TopBar, hiddenAt, stageQuery, useStage } from './GameShell';
import { FitLeaderboard } from './Leaderboard';
import { CorrectAnswerHero, OutcomeHero } from './OutcomeHero';

// ------------------------------------------------------------------ top bar parts

const ProgressBox = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  .p-short {
    font-family: var(--font-display);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--ink-2);
  }
  ${stageQuery.wideEnough} {
    .p-short {
      display: none;
    }
  }
  .p-long {
    ${hiddenAt(stageQuery.narrow)}
  }
  /* The step dots only where the top bar has room for them. */
  @container game (max-width: 899px) {
    .steps {
      display: none;
    }
  }
`;

const Steps = styled.ol`
  display: flex;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  li {
    width: clamp(8px, 1.4cqw, 22px);
    height: clamp(5px, 0.8cqh, 10px);
    border-radius: 3px;
    background: var(--line);
  }
  li[data-state='done'] {
    background: var(--ink-3);
  }
  li[data-state='current'] {
    background: var(--accent-text);
  }
`;

export function Progress({ number, total }) {
  return (
    <ProgressBox>
      <span className="p-short" aria-hidden="true">
        {number}/{total}
      </span>
      <span className="p-long">
        Question {number} of {total}
      </span>
      <Steps className="steps" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <li key={index} data-state={index + 1 < number ? 'done' : index + 1 === number ? 'current' : 'todo'} />
        ))}
      </Steps>
    </ProgressBox>
  );
}

const AnsweredBox = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  .a-short {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-display);
    font-variant-numeric: tabular-nums;
    color: var(--ink-2);
  }
  ${stageQuery.wideEnough} {
    .a-short {
      display: none;
    }
  }
  .a-long {
    ${hiddenAt(stageQuery.narrow)}
  }
`;

const SoloChip = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 8px;
  background: var(--surface-sunk);
  color: var(--ink-2);
  font-size: max(calc(12px * var(--floor)), 0.85em);
  white-space: nowrap;
`;

function AnsweredCount({ answered, connected }) {
  const { solo } = useStage();
  if (solo) return <SoloChip>Solo preview</SoloChip>;
  return (
    <AnsweredBox>
      <span className="a-long" aria-live="polite">
        {answered} of {connected} answered
      </span>
      <span className="a-short" aria-hidden="true">
        <Icon name="users" />
        {answered}/{connected}
      </span>
    </AnsweredBox>
  );
}

function FullTextButton({ onClick }) {
  return (
    <Button variant="secondary" size="sm" onStage onClick={onClick} style={{ flex: '0 0 auto' }}>
      Full text
    </Button>
  );
}

// -------------------------------------------------------------------- question type

const questionType = css`
  &[data-qlen='xs'] {
    --q-tier: min(7.4cqw, 6.2cqh);
  }
  &[data-qlen='s'] {
    --q-tier: min(6.2cqw, 5cqh);
  }
  &[data-qlen='m'] {
    --q-tier: min(5.3cqw, 4.2cqh);
  }
  &[data-qlen='l'] {
    --q-tier: min(4.7cqw, 3.6cqh);
  }
  ${stageQuery.L} {
    &[data-qlen='xs'] {
      --q-tier: min(3.6cqw, 9cqh);
    }
    &[data-qlen='s'] {
      --q-tier: min(3.1cqw, 7.6cqh);
    }
    &[data-qlen='m'] {
      --q-tier: min(2.7cqw, 6.6cqh);
    }
    &[data-qlen='l'] {
      --q-tier: min(2.4cqw, 5.8cqh);
    }
  }
`;

const QuestionText = styled.h1`
  ${questionType}
  margin: 0;
  min-height: 0;
  min-width: 0;
  max-height: 38cqh;
  overflow: hidden;
  font-family: var(--font-display);
  font-weight: 700;
  font-stretch: 90%;
  line-height: 1.12;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
  hyphens: auto;
  /* Room for the display font's ascent/descent outside the line boxes (not overflow). */
  padding-block: 0.08em;
  font-size: clamp(calc(15px * var(--floor)), calc(var(--q-tier) * var(--boost, 1) * var(--fit-q, 1)), calc(5.5rem * var(--cap, 1)));
  &[data-clamped] {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--lines, 3);
  }
  ${stageQuery.W} {
    max-height: 34cqh;
    max-width: 30em;
    justify-self: center;
    text-align: center;
  }
  ${stageQuery.L} {
    max-height: 100%;
    align-self: center;
  }
`;

const QuestionBody = styled(Body)`
  @supports (container-type: size) {
    display: grid;
    grid-template-rows: minmax(0, auto) minmax(var(--tiles-min), 1fr);
    grid-template-columns: minmax(0, 1fr);
    gap: var(--gap);
  }
  --tile-gap: clamp(6px, 1.3cqh, 18px);
  --tiles-min: calc(4 * 44px * var(--floor) + 3 * var(--tile-gap) + 8px);
  &[data-cols='2'] {
    --tiles-min: calc(2 * 44px * var(--floor) + var(--tile-gap) + 8px);
  }
  .answers {
    min-height: 0;
    min-width: 0;
    /* Room for the corner badge above the first row. */
    padding-top: 8px;
  }
  ${stageQuery.L} {
    @supports (container-type: size) {
      grid-template-rows: minmax(0, 1fr);
      grid-template-columns: minmax(0, 0.42fr) minmax(0, 0.58fr);
      column-gap: 2.4cqw;
    }
  }
  @supports not (container-type: size) {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
`;

const StatusSlot = styled.div`
  min-height: clamp(calc(34px * var(--floor)), 5.5cqh, 56px);
  display: flex;
  align-items: center;
  min-width: 0;
  ${stageQuery.L} {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    min-height: 0;
  }
  ${stageQuery.W} {
    flex: 1 1 auto;
  }
`;

const DangerLine = styled.p`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 10px;
  background: var(--danger-soft);
  border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
  color: var(--ink);
  font-weight: 700;
  font-size: clamp(calc(13px * var(--floor)), 2cqh, calc(1.1rem * var(--cap, 1)));
  line-height: 1.25;
  min-width: 0;
  svg {
    color: var(--danger);
    flex: 0 0 auto;
  }
`;

// --------------------------------------------------------------------- Full text

const SheetQuestion = styled.p`
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.25rem;
  line-height: 1.2;
  overflow-wrap: anywhere;
  hyphens: auto;
  user-select: text;
  margin: 4px 0 14px;
`;

const SheetTimer = styled.div`
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--surface);
  padding: 0 0 10px;
  display: flex;
`;

const SheetAnswers = styled(AnswerGrid)`
  && {
    font-size: 1.0625rem;
    height: auto;
    grid-template-columns: minmax(0, 1fr);
    grid-auto-rows: auto;
    gap: 10px;
    padding-top: 10px;
  }
  && > * {
    min-height: 56px;
    height: auto;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: auto;
    padding: 10px 14px;
    border-radius: 14px;
    animation: none;
  }
  && [data-fit] {
    max-height: none;
    overflow: visible;
    user-select: text;
  }
`;

function FullTextSheet({ open, onClose, title, closeKey, question, choices, lang, countdown, grid }) {
  return (
    <Sheet open={open} onClose={onClose} title={title} closeOnChange={closeKey}>
      {countdown ? <SheetTimer>{countdown}</SheetTimer> : null}
      <SheetQuestion lang={lang}>{question}</SheetQuestion>
      {grid(choices)}
    </Sheet>
  );
}

function useFocusOnChange(key, enabled = true) {
  const ref = useRef(null);
  useEffect(() => {
    if (enabled) ref.current?.focus({ preventScroll: true });
  }, [key, enabled]);
  return ref;
}

// ---------------------------------------------------------------------- question

export function QuestionScreen({ question, myAnswer, progress, session, onAnswer, remainingMs: remainingOverride }) {
  const stage = useStage();
  const { mode, width, preview, big, role } = stage;
  const remainingMs = useCountdown(question, remainingOverride);
  const timeUp = remainingMs === 0;
  const selected = myAnswer?.roundId === question.roundId ? myAnswer : null;
  const canAnswer = !timeUp && (!selected || selected.status === 'failed');
  const headingRef = useFocusOnChange(question.roundId, !preview);
  const bodyRef = useRef(null);
  const [fullOpen, setFullOpen] = useState(false);
  const lang = quizLang(session);
  const qlen = questionTier(question.question);
  const cols = answerColumns({ mode, width, choices: question.choices });
  const hidePick = big && role === 'host';
  const clamped = useFitStage(bodyRef, [question.roundId, question.question, cols, mode, Boolean(stage.banner)]);

  let status = null;
  let failed = null;
  if (selected?.status === 'failed') {
    failed = (
      <DangerLine role="alert">
        <Icon name="alert" />
        <span>{selected.message || 'Your answer didn’t reach the game.'} Tap an answer to try again.</span>
      </DangerLine>
    );
  } else if (selected?.status === 'locked') {
    status = (
      <StatusText as="span">
        <Icon name="lock" />
        <span>
          {question.revealTiming === 'all_answered' ? 'Locked in. The answer appears when everyone has answered.' : 'Locked in. The answer appears when time is up.'}
        </span>
      </StatusText>
    );
  } else if (timeUp) {
    status = (
      <StatusText as="span">
        <Icon name="clock" />
        <span>Time’s up — revealing the answer…</span>
      </StatusText>
    );
  }

  const submit = (index) => {
    setFullOpen(false);
    onAnswer?.(index);
  };

  return (
    <GameFrame>
      <TopBar
        left={<Progress number={question.questionNumber} total={question.totalQuestions} />}
        middle={<Countdown question={question} remainingMs={remainingMs} />}
        right={
          <>
            <AnsweredCount answered={progress?.answeredCount ?? 0} connected={session.connectedPlayerCount} />
            {clamped && !preview ? <FullTextButton onClick={() => setFullOpen(true)} /> : null}
            <BigScreenToggle />
          </>
        }
        notice={mode === 'L' ? failed : null}
      />
      <QuestionBody ref={bodyRef} data-qlen={qlen} data-cols={cols}>
        <QuestionText ref={headingRef} tabIndex={-1} data-fit="question" data-qlen={qlen} lang={lang}>
          {question.question}
        </QuestionText>
        <div className="answers">
          <AnswerGrid
            choices={question.choices}
            selectedIndex={selected && selected.status !== 'failed' ? selected.index : null}
            selectionStatus={selected?.status}
            disabled={!canAnswer}
            onSelect={submit}
            columns={cols}
            hidePick={hidePick}
            lang={lang}
            settleKey={question.roundId}
          />
        </div>
      </QuestionBody>
      <Dock>
        <StatusSlot role="status">{mode === 'L' ? (failed ? null : status) : failed || status}</StatusSlot>
      </Dock>
      {preview ? null : (
        <FullTextSheet
          open={fullOpen}
          onClose={() => setFullOpen(false)}
          title={`Question ${question.questionNumber} of ${question.totalQuestions}`}
          closeKey={`${question.roundId}:${timeUp}`}
          question={question.question}
          choices={question.choices}
          lang={lang}
          countdown={<Countdown question={question} remainingMs={remainingMs} compact announce={false} />}
          grid={(choices) => (
            <SheetAnswers
              choices={choices}
              selectedIndex={selected && selected.status !== 'failed' ? selected.index : null}
              selectionStatus={selected?.status}
              disabled={!canAnswer}
              onSelect={submit}
              hidePick={hidePick}
              lang={lang}
            />
          )}
        />
      )}
    </GameFrame>
  );
}

// ------------------------------------------------------------------------ reveal

const Recap = styled.p`
  margin: 0;
  flex: 0 0 auto;
  font-weight: 700;
  font-size: clamp(0.875rem, 2.2cqh, calc(1.5rem * var(--cap, 1)));
  line-height: 1.3;
  color: var(--ink-2);
  overflow: hidden;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  ${stageQuery.PT} {
    -webkit-line-clamp: 2;
  }
  ${stageQuery.W} {
    -webkit-line-clamp: 3;
  }
  ${hiddenAt(stageQuery.short)}
  [data-s1] & {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }
`;

const RevealBody = styled(Body)`
  display: flex;
  flex-direction: column;
  gap: var(--gap);
  .reveal-main {
    display: contents;
  }
  .answers {
    flex: 0 0 auto;
    min-width: 0;
  }
  .board-eyebrow {
    display: none;
    flex: 0 0 auto;
  }
  ${stageQuery.PT} {
    .board-eyebrow {
      display: block;
    }
  }
  /* Mode L: the answers take the full height on the left (four rows of two lines fit
     even at 568×270); the outcome sits above the leaderboard on the right. */
  ${stageQuery.L} {
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas: 'answers outcome' 'answers board';
    gap: 8px clamp(12px, 2.4cqw, 28px);
    .reveal-main > h1 {
      grid-area: outcome;
    }
    .answers {
      grid-area: answers;
      min-height: 0;
      padding-top: 10px;
    }
    .board {
      grid-area: board;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
  }
  ${stageQuery.W} {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    column-gap: 3cqw;
    .reveal-main {
      display: flex;
      flex-direction: column;
      gap: var(--gap);
      min-height: 0;
      min-width: 0;
    }
    .answers {
      flex: 1 1 0;
      min-height: calc(2 * 44px + 18px);
      padding-top: 10px;
    }
    .board {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 0;
      padding: clamp(12px, 2cqh, 24px);
    }
    .board-eyebrow {
      display: block;
    }
  }
`;

const BoardCard = styled(Card)`
  min-width: 0;
`;

const Board = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
`;

export function ResultsScreen({ results, roundResult, session, seat, isHost, onNext }) {
  const stage = useStage();
  const { mode, preview, big, hclass } = stage;
  const myRank = results.leaderboard.find((entry) => entry.playerId === seat.playerId)?.rank;
  const headingRef = useFocusOnChange(results.roundId, !preview);
  const bodyRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const lang = quizLang(session);
  const showBig = big && isHost;
  // Portrait: compact rows. L and W: a 2×2 of tiles (in L the rows would be too short
  // for two lines of text next to their tags).
  const compact = mode === 'P';
  const clamped = useFitStage(bodyRef, [results.roundId, mode, hclass, showBig, Boolean(stage.banner)], { levels: 3 });

  const next = async () => {
    setBusy(true);
    await onNext?.();
    setBusy(false);
  };

  const hostLine =
    session.hostStatus === 'reconnecting'
      ? 'The host is reconnecting…'
      : session.hostStatus === 'away'
        ? 'The host is away. Waiting for them to come back.'
        : 'Waiting for the host to continue…';

  const maxRows = showBig ? 10 : mode === 'W' ? 8 : mode === 'L' ? 6 : 5;
  // At least the leader and the viewer; with the connection banner on the smallest
  // phones only the viewer's row is guaranteed.
  const minRows = stage.banner && hclass === 'small' ? 1 : 2;
  const board = (
    <FitLeaderboard entries={results.leaderboard} myPlayerId={seat.playerId} max={maxRows} minRows={mode === 'W' ? 1 : minRows} />
  );

  return (
    <GameFrame>
      <TopBar
        left={<Progress number={results.questionNumber} total={results.totalQuestions} />}
        right={
          <>
            {clamped && !preview ? <FullTextButton onClick={() => setFullOpen(true)} /> : null}
            <BigScreenToggle />
          </>
        }
      />
      <RevealBody ref={bodyRef}>
        <div className="reveal-main">
          {showBig ? (
            <CorrectAnswerHero ref={headingRef} choices={results.choices} correctIndex={results.correctAnswer} lang={lang} />
          ) : (
            <OutcomeHero ref={headingRef} roundResult={roundResult} rank={myRank} />
          )}
          <Recap lang={lang} data-truncate="">
            {results.questionText}
          </Recap>
          <div className="answers">
            <AnswerGrid
              mode="reveal"
              compact={compact}
              columns={2}
              choices={results.choices}
              correctIndex={results.correctAnswer}
              selectedIndex={roundResult?.answerIndex ?? null}
              counts={results.answerStats}
              playerCount={results.leaderboard.length}
              hidePick={showBig}
              lang={lang}
            />
          </div>
        </div>
        {mode === 'W' ? (
          <BoardCard className="board" $pad="0">
            <Eyebrow className="board-eyebrow">Leaderboard</Eyebrow>
            {board}
          </BoardCard>
        ) : (
          <Board className="board">
            <Eyebrow className="board-eyebrow">Leaderboard</Eyebrow>
            {board}
          </Board>
        )}
      </RevealBody>
      <Dock>
        {isHost ? (
          <>
            {session.hostStatus !== 'present' ? (
              <StatusText as="p" style={{ minHeight: 0 }}>
                <span>You’re standing in while the host is away.</span>
              </StatusText>
            ) : null}
            <ActionButton size="lg" onClick={next} busy={busy} disabled={busy}>
              {results.isLastQuestion ? 'Show final results' : 'Next question'}
              {busy ? null : <Icon name="arrowRight" />}
            </ActionButton>
          </>
        ) : (
          <StatusText role="status">
            <Icon name="clock" />
            <span>{hostLine}</span>
          </StatusText>
        )}
      </Dock>
      {preview ? null : (
        <FullTextSheet
          open={fullOpen}
          onClose={() => setFullOpen(false)}
          title={`Question ${results.questionNumber} of ${results.totalQuestions}`}
          closeKey={results.roundId}
          question={results.questionText}
          choices={results.choices}
          lang={lang}
          grid={(choices) => (
            <SheetAnswers
              mode="reveal"
              choices={choices}
              correctIndex={results.correctAnswer}
              selectedIndex={roundResult?.answerIndex ?? null}
              counts={results.answerStats}
              playerCount={results.leaderboard.length}
              hidePick={showBig}
              lang={lang}
            />
          )}
        />
      )}
    </GameFrame>
  );
}
