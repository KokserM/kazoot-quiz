import React, { useEffect, useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import { formatPoints, ordinal } from '../../lib/gameUi';
import { Icon } from '../Icon';
import { Button, Card, Eyebrow, Muted, Notice, Row, Stack } from '../ui';
import { AnswerGrid } from './AnswerGrid';
import { Countdown, useCountdown } from './Countdown';
import { Leaderboard } from './Leaderboard';

const QuestionText = styled.h1`
  font-size: ${({ $small }) => ($small ? 'clamp(1.35rem, 3vw, 2.1rem)' : 'clamp(1.6rem, 4vw, 3rem)')};
  line-height: 1.15;
  max-width: 34ch;
  overflow-wrap: break-word;
`;

const TopLine = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  color: var(--ink-3);
  font-weight: 700;
  font-size: 0.95rem;
`;

const Steps = styled.ol`
  display: flex;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  li {
    width: clamp(10px, 2.2vw, 22px);
    height: 6px;
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

const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.95rem;
  ${({ $tone }) =>
    ({
      success: css`
        background: var(--success-soft);
        color: var(--success);
      `,
      danger: css`
        background: var(--danger-soft);
        color: var(--danger);
      `,
      neutral: css`
        background: var(--surface-sunk);
        color: var(--ink-2);
      `,
    })[$tone]}
`;

const StatusLine = styled.p`
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ink-2);
  font-weight: 700;
  min-height: 1.6em;
`;

function Progress({ number, total }) {
  return (
    <Row $gap={12}>
      <span>
        Question {number} of {total}
      </span>
      <Steps aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <li key={index} data-state={index + 1 < number ? 'done' : index + 1 === number ? 'current' : 'todo'} />
        ))}
      </Steps>
    </Row>
  );
}

function useFocusOnChange(key) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
  }, [key]);
  return ref;
}

export function QuestionScreen({ question, myAnswer, progress, session, onAnswer }) {
  const remainingMs = useCountdown(question);
  const timeUp = remainingMs === 0;
  const selected = myAnswer?.roundId === question.roundId ? myAnswer : null;
  const canAnswer = !timeUp && (!selected || selected.status === 'failed');
  const headingRef = useFocusOnChange(question.roundId);

  let status = null;
  if (selected?.status === 'failed') {
    status = (
      <Notice $tone="danger">
        <span>{selected.message || 'Your answer didn’t reach the game.'} Tap an answer to try again.</span>
      </Notice>
    );
  } else if (selected?.status === 'locked') {
    status = (
      <StatusLine role="status">
        <Icon name="lock" />
        {question.revealTiming === 'all_answered' ? 'Locked in. The answer appears when everyone has answered.' : 'Locked in. The answer appears when time is up.'}
      </StatusLine>
    );
  } else if (timeUp) {
    status = (
      <StatusLine role="status">
        <Icon name="clock" />
        Time’s up — revealing the answer…
      </StatusLine>
    );
  }

  return (
    <Stack $gap={20}>
      <TopLine>
        <Progress number={question.questionNumber} total={question.totalQuestions} />
        <span aria-live="polite">
          <Icon name="users" /> {progress?.answeredCount ?? 0} of {session.connectedPlayerCount} answered
        </span>
      </TopLine>
      <QuestionText ref={headingRef} tabIndex={-1}>
        {question.question}
      </QuestionText>
      <Countdown question={question} remainingMs={remainingMs} />
      <AnswerGrid
        choices={question.choices}
        selectedIndex={selected && selected.status !== 'failed' ? selected.index : null}
        selectionStatus={selected?.status}
        disabled={!canAnswer}
        onSelect={onAnswer}
      />
      {status}
    </Stack>
  );
}

const ResultsLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

export function RoundOutcome({ roundResult }) {
  if (!roundResult) return null;
  if (roundResult.answerIndex === null) {
    return (
      <Chip $tone="neutral">
        <Icon name="dash" />
        No answer this round
      </Chip>
    );
  }
  return roundResult.correct ? (
    <Chip $tone="success">
      <Icon name="check" />
      Correct · +{formatPoints(roundResult.points)}
    </Chip>
  ) : (
    <Chip $tone="danger">
      <Icon name="x" />
      Not this time
    </Chip>
  );
}

export function ResultsScreen({ results, roundResult, session, seat, isHost, onNext }) {
  const headingRef = useFocusOnChange(results.roundId);
  const [busy, setBusy] = useState(false);
  const myRank = results.leaderboard.find((entry) => entry.playerId === seat.playerId)?.rank;

  const next = async () => {
    setBusy(true);
    await onNext();
    setBusy(false);
  };

  const hostLine =
    session.hostStatus === 'reconnecting'
      ? 'The host is reconnecting…'
      : session.hostStatus === 'away'
        ? 'The host is away. Waiting for them to come back.'
        : 'Waiting for the host to continue…';

  return (
    <Stack $gap={20}>
      <TopLine>
        <Progress number={results.questionNumber} total={results.totalQuestions} />
        {myRank ? <span>You’re {ordinal(myRank)}</span> : null}
      </TopLine>
      <Stack $gap={12}>
        <QuestionText ref={headingRef} tabIndex={-1} $small>
          {results.questionText}
        </QuestionText>
        <div>
          <RoundOutcome roundResult={roundResult} />
        </div>
      </Stack>
      <ResultsLayout>
        <AnswerGrid
          mode="reveal"
          choices={results.choices}
          correctIndex={results.correctAnswer}
          selectedIndex={roundResult?.answerIndex ?? null}
          counts={results.answerStats}
        />
        <Card>
          <Stack $gap={12}>
            <Eyebrow>Leaderboard</Eyebrow>
            <Leaderboard entries={results.leaderboard} myPlayerId={seat.playerId} limit={5} />
          </Stack>
        </Card>
      </ResultsLayout>
      {isHost ? (
        <Row>
          <Button size="lg" onClick={next} busy={busy} disabled={busy}>
            {results.isLastQuestion ? 'Show final results' : 'Next question'}
            {busy ? null : <Icon name="arrowRight" />}
          </Button>
          {session.hostStatus !== 'present' ? <Muted $small>You’re standing in while the host is away.</Muted> : null}
        </Row>
      ) : (
        <StatusLine role="status">
          <Icon name="clock" />
          {hostLine}
        </StatusLine>
      )}
    </Stack>
  );
}
