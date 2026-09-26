import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useAuth } from '../../auth/AuthProvider';
import { track } from '../../lib/analytics';
import { createNextSession } from '../../lib/api';
import { formatPoints, ordinal } from '../../lib/gameUi';
import { Button, Card, ErrorNotice, Eyebrow, Field, Input, LinkButton, Muted, Row, SegmentedControl, Stack } from '../ui';
import { Leaderboard } from './Leaderboard';

const Podium = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
  li {
    padding: 18px;
    border-radius: var(--radius-lg);
    background: var(--surface);
    border: 1px solid var(--line);
    text-align: center;
  }
  li:first-child {
    border: 2px solid var(--accent-text);
    background: var(--accent-soft);
  }
  .place {
    font-family: var(--font-display);
    font-size: 1.1rem;
    color: var(--ink-3);
  }
  .who {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 700;
    overflow-wrap: anywhere;
  }
`;

const Columns = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

function PlayAgainPanel({ session, seat, demoQuizzes, aiAvailable }) {
  const { user, accessToken, refreshUsage } = useAuth();
  const canUseAi = Boolean(user && aiAvailable);
  const [source, setSource] = useState(canUseAi ? 'ai' : 'demo');
  const [topic, setTopic] = useState('');
  const [demoId, setDemoId] = useState(demoQuizzes.find((quiz) => quiz.id !== session.demoId)?.id || demoQuizzes[0]?.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const options = {
        language: source === 'demo' ? demoQuizzes.find((quiz) => quiz.id === demoId)?.language || 'English' : session.language,
        questionTimeLimitMs: session.questionTimeLimitMs,
        revealTiming: session.revealTiming,
        reviewMode: session.reviewMode,
      };
      await createNextSession(
        session.sessionId,
        { ...options, hostToken: seat.hostToken, ...(source === 'demo' ? { demoId } : { topic }) },
        source === 'demo' ? null : accessToken
      );
      if (source !== 'demo') refreshUsage();
      // Everyone (including us) receives next-game-ready and moves automatically.
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  };

  return (
    <Card>
      <form onSubmit={submit}>
        <Stack $gap={14}>
          <Eyebrow>{session.players.length > 1 ? 'Play again with this group' : 'Play another'}</Eyebrow>
          {session.players.length > 1 ? <Muted $small>Everyone still connected moves to the new game automatically.</Muted> : null}
          {canUseAi ? (
            <SegmentedControl
              legend="Next quiz"
              name="next-source"
              value={source}
              onChange={setSource}
              options={[
                { value: 'ai', label: 'New topic', hint: 'Uses 1 AI game' },
                { value: 'demo', label: 'Demo quiz', hint: 'Free' },
              ]}
            />
          ) : null}
          {source === 'ai' ? (
            <Field label="Topic" hint="Like “Famous bridges” or “1990s pop music”">
              <Input value={topic} onChange={(event) => setTopic(event.target.value)} required minLength={2} maxLength={80} disabled={busy} />
            </Field>
          ) : (
            <SegmentedControl
              legend="Demo quiz"
              name="next-demo"
              value={demoId}
              onChange={setDemoId}
              options={demoQuizzes.map((quiz) => ({ value: quiz.id, label: quiz.title }))}
            />
          )}
          <ErrorNotice error={error} />
          <Row>
            <Button type="submit" busy={busy} disabled={busy || (source === 'ai' && topic.trim().length < 2)}>
              {busy ? (source === 'ai' ? 'Writing questions…' : 'Setting up…') : 'Start next game'}
            </Button>
          </Row>
          {!user ? (
            <Muted $small>
              Want your own topic next time? <a href="/create">Sign in and create a quiz</a> — 3 free each month.
            </Muted>
          ) : null}
        </Stack>
      </form>
    </Card>
  );
}

export function FinalScreen({ leaderboard, session, seat, isHost, config, onLeave }) {
  const headingRef = useRef(null);
  useEffect(() => headingRef.current?.focus(), []);
  const me = leaderboard.find((entry) => entry.playerId === seat.playerId);
  const podium = leaderboard.slice(0, 3);
  const isOwner = Boolean(seat.hostToken);

  return (
    <Stack $gap={22}>
      <Stack $gap={8}>
        <Eyebrow>Final results · {session.topic}</Eyebrow>
        <h1 ref={headingRef} tabIndex={-1} style={{ fontSize: 'clamp(1.9rem, 5vw, 3rem)' }}>
          {!me ? 'Game over' : leaderboard.length === 1 ? 'Quiz complete' : me.rank === 1 ? 'You won!' : `You finished ${ordinal(me.rank)}`}
        </h1>
        {me ? (
          <Muted>
            {formatPoints(me.score)} · {me.correctAnswerCount} of {me.totalQuestions} correct
          </Muted>
        ) : null}
      </Stack>

      <Podium aria-label="Top three">
        {podium.map((entry) => (
          <li key={entry.playerId}>
            <div className="place">{ordinal(entry.rank)}</div>
            <div className="who">{entry.username}</div>
            <div>{formatPoints(entry.score)}</div>
          </li>
        ))}
      </Podium>

      <Columns>
        <Card>
          <Stack $gap={12}>
            <Eyebrow>Full standings</Eyebrow>
            <Leaderboard entries={leaderboard} myPlayerId={seat.playerId} limit={50} showCorrect />
          </Stack>
        </Card>

        <Stack $gap={16}>
          {isOwner && isHost ? (
            <PlayAgainPanel session={session} seat={seat} demoQuizzes={config?.demoQuizzes || []} aiAvailable={config?.aiAvailable} />
          ) : null}

          <Card>
            <Stack $gap={12}>
              <Eyebrow>{isOwner ? 'Something new' : 'Your turn to host?'}</Eyebrow>
              <h2 style={{ fontSize: '1.5rem' }}>{session.isDemo ? 'Create a quiz on your own topic' : 'Host your own quiz'}</h2>
              <Muted>
                {session.isDemo
                  ? 'That was a hand-written demo. Pick a topic you like and Kazoot writes fresh questions — then you play along with everyone else.'
                  : 'Pick a topic, share a code, and play along. The first 3 quizzes each month are free.'}
              </Muted>
              <Row>
                {/* The host's main action is "Start next game" above; keep one primary per screen. */}
                <LinkButton to="/create" variant={isOwner && isHost ? 'secondary' : 'primary'} onClick={() => track('end_cta_clicked', { kind: session.isDemo ? 'demo' : 'ai', role: isOwner ? 'host' : 'player' })}>
                  Create your own quiz
                </LinkButton>
                <Button variant="ghost" onClick={onLeave}>
                  Back to home
                </Button>
              </Row>
              {!isOwner ? <Muted $small>If the host starts another game, you’ll move to it automatically — just keep this page open.</Muted> : null}
            </Stack>
          </Card>
        </Stack>
      </Columns>
    </Stack>
  );
}
