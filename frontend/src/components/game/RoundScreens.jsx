import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { describeMyAnswer, formatPoints, ordinal } from '../../lib/gameUi';
import { Button, Card, Eyebrow, Muted, Notice, Row, Stack } from '../ui';
import { AnswerGrid } from './AnswerGrid';
import { Countdown, useCountdown } from './Countdown';
import { Leaderboard } from './Leaderboard';

const QuestionText = styled.h1`
  font-size: clamp(1.5rem, 3.6vw, 2.7rem);
  line-height: 1.15;
`;

const TopLine = styled(Row)`
  justify-content: space-between;
  color: var(--ink-3);
  font-weight: 700;
`;

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
  const status = describeMyAnswer(selected, question.revealTiming);
  const canAnswer = !timeUp && (!selected || selected.status === 'failed');
  const headingRef = useFocusOnChange(question.roundId);

  return (
    <Stack $gap={18}>
      <TopLine>
        <span>
          Question {question.questionNumber} of {question.totalQuestions}
        </span>
        <span aria-live="polite">
          {progress?.answeredCount ?? 0} of {session.connectedPlayerCount} answered
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
      {status ? (
        <Notice $tone={status.tone}>{status.text}</Notice>
      ) : timeUp ? (
        <Notice $tone="info">Time’s up. Revealing the answer…</Notice>
      ) : null}
    </Stack>
  );
}

const ResultsLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 20px;
  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

function MyRoundSummary({ roundResult }) {
  if (!roundResult) return null;
  if (roundResult.answerIndex === null) {
    return <Notice $tone="warning">No answer this round.</Notice>;
  }
  return roundResult.correct ? (
    <Notice $tone="success">
      <strong>Correct! +{formatPoints(roundResult.points)}</strong>
    </Notice>
  ) : (
    <Notice $tone="danger">Not this time.</Notice>
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

  return (
    <Stack $gap={18}>
      <TopLine>
        <span>
          Question {results.questionNumber} of {results.totalQuestions}
        </span>
        {myRank ? <span>You’re {ordinal(myRank)}</span> : null}
      </TopLine>
      <QuestionText ref={headingRef} tabIndex={-1}>
        {results.questionText}
      </QuestionText>
      <MyRoundSummary roundResult={roundResult} />
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
          </Button>
          {session.hostStatus !== 'present' ? <Muted $small>You’re standing in while the host is away.</Muted> : null}
        </Row>
      ) : (
        <Muted>
          {session.hostStatus === 'reconnecting'
            ? 'The host is reconnecting…'
            : session.hostStatus === 'away'
              ? 'The host is away. Waiting for them to come back.'
              : 'Waiting for the host to continue…'}
        </Muted>
      )}
    </Stack>
  );
}
