import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useAuth } from '../../auth/AuthProvider';
import { track } from '../../lib/analytics';
import { createNextSession } from '../../lib/api';
import { useFitStage } from '../../lib/fitStage';
import { formatPoints, ordinal } from '../../lib/gameUi';
import { Sheet } from '../Sheet';
import { Button, Card, ErrorNotice, Eyebrow, Field, Input, LinkButton, Muted, Row, SegmentedControl, Stack } from '../ui';
import { Confetti } from './Confetti';
import { BigScreenToggle, Body, Dock, GameFrame, LogoTile, TopBar, hiddenAt, stageQuery, useStage } from './GameShell';
import { FitLeaderboard, Leaderboard } from './Leaderboard';
import { Podium } from './Podium';

// ----------------------------------------------------------------- play again

function PlayAgainPanel({ session, seat, demoQuizzes, aiAvailable }) {
  const { user, accessToken, refreshUsage } = useAuth();
  const canUseAi = Boolean(user && aiAvailable);
  const [source, setSource] = useState(canUseAi ? 'ai' : 'demo');
  const [topic, setTopic] = useState('');
  const [topicError, setTopicError] = useState('');
  const topicRef = useRef(null);
  const [demoId, setDemoId] = useState(demoQuizzes.find((quiz) => quiz.id !== session.demoId)?.id || demoQuizzes[0]?.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    // The button stays enabled: a short topic is explained on press (brief 5.1).
    if (source === 'ai' && topic.trim().length < 2) {
      setTopicError('Topic must be at least 2 characters.');
      topicRef.current?.focus();
      return;
    }
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
    <form onSubmit={submit} noValidate>
      <Stack $gap={14}>
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
          <Field label="Topic" hint="Like “Famous bridges” or “1990s pop music”" error={topicError}>
            <Input
              ref={topicRef}
              value={topic}
              onChange={(event) => {
                setTopic(event.target.value);
                if (topicError && event.target.value.trim().length >= 2) setTopicError('');
              }}
              required
              minLength={2}
              maxLength={80}
              disabled={busy}
            />
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
          <Button type="submit" busy={busy} disabled={busy}>
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
  );
}

// ----------------------------------------------------------------- the role table

// Which actions the final screen offers, by viewer (brief 8.9):
//   demo-owner  owner-host of a demo, signed out: "Create your own quiz" first (the conversion moment)
//   owner       owner-host signed in, or after an AI quiz: "Play another" / "Play again with this group" first
//   player      everyone else: "Create your own quiz", plus the auto-move caption
export function finalActionsFor({ isOwnerHost, isDemo, signedIn }) {
  if (!isOwnerHost) return 'player';
  if (isDemo && !signedIn) return 'demo-owner';
  return 'owner';
}

const Panel = styled.section`
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 1.4cqh, 14px);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: clamp(10px, 2cqh, 20px);
  min-width: 0;
  .about {
    display: none;
    flex-direction: column;
    gap: 6px;
  }
  .about h2 {
    font-size: clamp(1.15rem, 2.6cqh, calc(1.6rem * var(--cap, 1)));
  }
  .about p {
    color: var(--ink-2);
    font-size: clamp(0.95rem, 1.9cqh, 1.15rem);
    line-height: 1.4;
  }
  ${stageQuery.PT} {
    .about {
      display: flex;
    }
  }
  ${stageQuery.W} {
    .about {
      display: flex;
    }
  }
  .buttons {
    display: flex;
    gap: 10px;
    min-width: 0;
  }
  .buttons > * {
    min-height: clamp(calc(48px * var(--floor)), 8cqh, 64px);
    white-space: normal;
    text-align: center;
    line-height: 1.15;
    padding: 4px 10px;
    font-size: clamp(calc(0.95rem * var(--floor)), 2.3cqh, calc(1.2rem * var(--cap, 1)));
  }
  .buttons > .primary {
    flex: 1.4 1 0;
  }
  .buttons > .secondary {
    flex: 1 1 0;
  }
  /* Narrow stages stack the buttons, so "Play again with this group" stays on one or
     two lines. */
  @container game (max-width: 419px) {
    .buttons {
      flex-direction: column;
    }
  }
  .caption {
    font-size: clamp(calc(13px * var(--floor)), 1.8cqh, 1rem);
    line-height: 1.35;
    color: var(--ink-2);
  }
  /* Short stages: only the buttons, no card around them. */
  ${stageQuery.short} {
    padding: 0;
    border: 0;
    background: none;
  }
  ${stageQuery.L} {
    padding: 0;
    border: 0;
    background: none;
    .buttons {
      flex-direction: row;
      gap: 8px;
    }
    .buttons > * {
      min-height: 48px;
      padding: 2px 8px;
      font-size: 0.85rem;
    }
    .caption {
      ${hiddenAt(stageQuery.L)}
    }
  }
`;

function FinalActions({ kind, session, onPlayAgain, signedInHost }) {
  const createLink = (variant) => (
    <LinkButton
      to="/create"
      variant={variant}
      className={variant}
      onClick={() => track('end_cta_clicked', { kind: session.isDemo ? 'demo' : 'ai', role: kind === 'player' ? 'player' : 'host' })}
    >
      Create your own quiz
    </LinkButton>
  );
  const again = (variant) => (
    <Button variant={variant} className={variant} onClick={onPlayAgain}>
      {session.players.length > 1 ? 'Play again with this group' : 'Play another'}
    </Button>
  );
  const title = session.isDemo ? 'Create a quiz on your own topic' : 'Host your own quiz';
  const text = session.isDemo
    ? 'That was a hand-written demo. Pick a topic you like and Kazoot writes fresh questions — then you play along with everyone else.'
    : 'Pick a topic, share a code, and play along. The first 3 quizzes each month are free.';

  return (
    <Panel aria-label={kind === 'player' ? 'Your turn to host?' : title} data-actions={kind} data-signed-in={signedInHost ? 'true' : undefined}>
      <div className="about">
        {kind === 'player' ? <Eyebrow>Your turn to host?</Eyebrow> : null}
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <div className="buttons">
        {kind === 'demo-owner' ? (
          <>
            {createLink('primary')}
            {again('secondary')}
          </>
        ) : kind === 'owner' ? (
          <>
            {again('primary')}
            {createLink('secondary')}
          </>
        ) : (
          createLink('primary')
        )}
      </div>
      {kind === 'player' ? <p className="caption">If the host starts another game, you’ll move to it automatically — just keep this page open.</p> : null}
    </Panel>
  );
}

// ----------------------------------------------------------------------- layout

const Headline = styled.div`
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 800;
    font-stretch: 84%;
    letter-spacing: -0.03em;
    line-height: 1;
    font-size: clamp(1.6rem, min(9cqw, 6cqh), calc(5rem * var(--cap, 1)));
  }
  [data-s2] & h1 {
    font-size: clamp(1.35rem, min(7cqw, 5cqh), 2.4rem);
  }
  .stats {
    color: var(--ink-2);
    font-size: clamp(0.875rem, 2.2cqh, calc(1.4rem * var(--cap, 1)));
    line-height: 1.3;
    font-variant-numeric: tabular-nums;
  }
  [data-s1] & .stats {
    display: none;
  }
`;

const FinalBody = styled(Body)`
  display: flex;
  flex-direction: column;
  gap: var(--gap);
  .col {
    display: contents;
  }
  .podium {
    flex: 1.4 1 0;
    min-height: clamp(calc(96px * var(--floor)), 22cqh, 220px);
    min-width: 0;
    display: flex;
    align-items: flex-end;
  }
  .standings {
    flex: 1 1 0;
    min-height: 44px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .standings > button {
    flex: 0 0 auto;
    align-self: center;
  }
  ${stageQuery.L} {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    column-gap: clamp(12px, 3cqw, 32px);
    .col {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 0;
      min-width: 0;
    }
    .col.side {
      justify-content: center;
    }
    .podium {
      flex: 1 1 0;
      min-height: 0;
    }
    .standings {
      flex: 1 1 0;
    }
  }
  ${stageQuery.W} {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    column-gap: 3cqw;
    .col {
      display: flex;
      flex-direction: column;
      gap: var(--gap);
      min-height: 0;
      min-width: 0;
    }
    /* Headline and podium as one centred group; the podium stops at 58 % of the stage. */
    .col:first-child {
      justify-content: center;
    }
    .podium {
      flex: 0 1 58cqh;
    }
    .standings-card {
      flex: 1 1 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: clamp(12px, 2cqh, 24px);
    }
    .standings {
      flex: 1 1 0;
    }
    .col.side > section:only-child,
    .col.side > [data-actions] {
      margin-top: auto;
    }
  }
`;

const TopTitle = styled.span`
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: max(calc(12px * var(--floor)), 0.8em);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-2);
`;

export function FinalScreen({ leaderboard, session, seat, isHost, config, onLeave, signedIn }) {
  const stage = useStage();
  const { mode, preview, hclass } = stage;
  const { user } = useAuth();
  const headingRef = useRef(null);
  useEffect(() => {
    if (!preview) headingRef.current?.focus({ preventScroll: true });
  }, [preview]);
  const me = leaderboard.find((entry) => entry.playerId === seat.playerId);
  const isOwnerHost = Boolean(seat.hostToken) && isHost;
  const kind = finalActionsFor({ isOwnerHost, isDemo: session.isDemo, signedIn: signedIn ?? Boolean(user) });
  const [againOpen, setAgainOpen] = useState(false);
  const [standingsOpen, setStandingsOpen] = useState(false);
  const [shownRows, setShownRows] = useState(null);
  const bodyRef = useRef(null);
  const many = leaderboard.length >= 4;
  const rest = leaderboard.slice(3);
  useFitStage(bodyRef, [mode, hclass, leaderboard.length, kind, Boolean(stage.banner)], { levels: 3, text: false });

  const headlineText = !me ? 'Game over' : leaderboard.length === 1 ? 'Quiz complete' : me.rank === 1 ? 'You won!' : `You finished ${ordinal(me.rank)}`;
  const headline = (
    <Headline>
      <h1 ref={headingRef} tabIndex={-1}>
        {headlineText}
      </h1>
      {me && leaderboard.length > 1 ? (
        <p className="stats">
          {formatPoints(me.score)} · {me.correctAnswerCount} of {me.totalQuestions} correct
        </p>
      ) : null}
    </Headline>
  );

  const podium = (
    <div className="podium">
      <Podium entries={leaderboard} myPlayerId={seat.playerId} />
    </div>
  );

  const allShown = shownRows !== null && shownRows >= rest.length;
  const standings = many ? (
    <div className="standings">
      <FitLeaderboard entries={rest} myPlayerId={seat.playerId} max={mode === 'W' ? 8 : 6} label="Full standings" onShownChange={setShownRows} align={mode === 'W' ? undefined : 'end'} />
      {!allShown && !preview ? (
        <Button variant="ghost" size="sm" onClick={() => setStandingsOpen(true)}>
          Full standings
        </Button>
      ) : null}
    </div>
  ) : null;

  const actions = <FinalActions kind={kind} session={session} onPlayAgain={() => setAgainOpen(true)} signedInHost={kind === 'owner'} />;

  let body;
  if (mode === 'W') {
    body = (
      <>
        <div className="col">
          {headline}
          {podium}
        </div>
        <div className="col side">
          {many ? <Card className="standings-card">{standings}</Card> : null}
          {actions}
        </div>
      </>
    );
  } else if (mode === 'L') {
    // The top row of a landscape phone has no room for two more buttons next to "Back to
    // home"; the right-hand column has.
    body = (
      <>
        <div className="col">{podium}</div>
        <div className="col side">
          {headline}
          {standings}
          {actions}
        </div>
      </>
    );
  } else {
    body = (
      <div className="col">
        {headline}
        {podium}
        {standings}
      </div>
    );
  }

  return (
    <GameFrame data-dock={mode === 'W' || mode === 'L' ? 'none' : undefined}>
      <TopBar
        left={
          <>
            <LogoTile />
            <TopTitle data-truncate="">Final results · {session.topic}</TopTitle>
          </>
        }
        right={
          <>
            <BigScreenToggle />
            <Button variant="ghost" size="sm" onClick={onLeave}>
              Back to home
            </Button>
          </>
        }
      />
      <FinalBody ref={bodyRef}>{body}</FinalBody>
      {mode === 'W' || mode === 'L' ? null : <Dock>{actions}</Dock>}
      <Confetti roomId={session.sessionId} />
      {preview ? null : (
        <>
          <Sheet open={standingsOpen} onClose={() => setStandingsOpen(false)} title="Full standings" closeOnChange={session.sessionId}>
            <Leaderboard entries={leaderboard} myPlayerId={seat.playerId} limit={50} showCorrect />
          </Sheet>
          {isOwnerHost ? (
            <Sheet
              open={againOpen}
              onClose={() => setAgainOpen(false)}
              title={session.players.length > 1 ? 'Play again with this group' : 'Play another'}
              closeOnChange={session.sessionId}
            >
              <PlayAgainPanel session={session} seat={seat} demoQuizzes={config?.demoQuizzes || []} aiAvailable={config?.aiAvailable} />
            </Sheet>
          ) : null}
        </>
      )}
    </GameFrame>
  );
}
