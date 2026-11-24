import React, { lazy, Suspense, useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import { useFitStage, useItemsThatFit } from '../../lib/fitStage';
import { fetchReviewQuestions, saveReviewQuestions } from '../../lib/api';
import { formatRoomCode, getRoleLabel } from '../../lib/gameUi';
import { Icon } from '../Icon';
import { Sheet } from '../Sheet';
import { Badge, Button, ErrorNotice, Eyebrow, Field, Input, Muted, Row, Select, Stack } from '../ui';
import { ActionButton, BigScreenToggle, Body, Dock, GameFrame, LogoTile, StatusText, TopBar, hiddenAt, stageQuery, useStage } from './GameShell';

const QRCodeSVG = lazy(() => import('qrcode.react').then((module) => ({ default: module.QRCodeSVG })));

// ------------------------------------------------------------------------ pieces

const Topic = styled.h1`
  margin: 0;
  flex: 0 0 auto;
  font-family: var(--font-display);
  font-weight: 800;
  font-stretch: 88%;
  letter-spacing: -0.02em;
  line-height: 1.08;
  font-size: clamp(calc(1.25rem * var(--floor)), min(6cqw, 4cqh), calc(3rem * var(--cap, 1)));
  overflow: hidden;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  text-wrap: balance;
  [data-s1] & {
    -webkit-line-clamp: 1;
  }
  ${stageQuery.L} {
    -webkit-line-clamp: 1;
    font-size: clamp(1.1rem, 7cqh, 1.6rem);
  }
`;

const BadgeRow = styled.ul`
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  flex: 0 0 auto;
  min-width: 0;
  /* One row (two where there is height); useItemsThatFit hides what does not fit. */
  max-height: calc(1 * (1.2em + 8px) + 0px);
  overflow: hidden;
  font-size: max(calc(12px * var(--floor)), 0.82rem);
  li {
    display: flex;
  }
  ${stageQuery.PT} {
    max-height: calc(2 * (1.2em + 8px) + 6px);
  }
  ${stageQuery.W} {
    max-height: calc(2 * (1.2em + 8px) + 6px);
  }
  [data-s4] & {
    display: none;
  }
  ${stageQuery.L} {
    display: none;
  }
  > li > span {
    line-height: 1.2;
    font-size: 1em;
  }
`;

export function RoomBadges({ session }) {
  const ref = useRef(null);
  useItemsThatFit(ref, null, [session.reviewMode, session.hostReviewed, session.questionCount, session.language]);
  return (
    <BadgeRow ref={ref} aria-label="Room settings" className="badges">
      <li>
        {session.reviewMode ? (
          <Badge $tone="warning">{session.hostReviewed ? 'Host has seen the questions' : 'Review mode'}</Badge>
        ) : (
          <Badge $tone="success">Surprise: nobody has seen the questions</Badge>
        )}
      </li>
      <li>
        <Badge>{session.questionCount} questions</Badge>
      </li>
      <li>
        <Badge>{Math.round(session.questionTimeLimitMs / 1000)} s per question</Badge>
      </li>
      <li>
        <Badge>{session.language}</Badge>
      </li>
      <li>
        <Badge>{session.isDemo ? 'Demo quiz' : 'Fresh AI quiz'}</Badge>
      </li>
    </BadgeRow>
  );
}

const Code = styled.p`
  margin: 0;
  flex: 0 0 auto;
  font-family: var(--font-display);
  white-space: nowrap;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  text-align: center;
  font-size: clamp(calc(1.75rem * var(--floor)), 10cqw, calc(3.2rem * var(--cap, 1)));
  [data-s5] & {
    font-size: clamp(calc(1.5rem * var(--floor)), 8cqw, 2.4rem);
  }
  /* W: as large as the invite column allows (about 7.4 em wide for 10 characters). */
  ${stageQuery.W} {
    font-size: clamp(2.4rem, min(6.2cqw, 14cqh), calc(9rem * var(--cap, 1)));
    text-align: left;
  }
  ${stageQuery.L} {
    font-size: clamp(1.5rem, min(5cqw, 13cqh), 3rem);
  }
`;

const JoinGrid = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;
  min-width: 0;
  --qr: min(34cqw, 26cqh, 320px);
  [data-s3] & {
    --qr: min(28cqw, 20cqh);
  }
  [data-s5] & {
    --qr: min(22cqw, 15cqh);
  }
  [data-s6] & .qr {
    display: none;
  }
  ${stageQuery.L} {
    --qr: min(46cqh, 22cqw);
  }
  ${stageQuery.W} {
    grid-template-columns: auto;
    justify-items: start;
    --qr: min(34cqh, 28cqw, calc(420px * var(--cap, 1)));
  }
`;

const QrBox = styled.div`
  width: calc(var(--qr) + 16px);
  height: calc(var(--qr) + 16px);
  padding: 8px;
  border-radius: 12px;
  background: #fff;
  svg {
    width: 100%;
    height: 100%;
  }
`;

const JoinText = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  font-size: clamp(calc(13px * var(--floor)), 2.2cqh, calc(1.1rem * var(--cap, 1)));
  line-height: 1.35;
  color: var(--ink-2);
  .join-sentence {
    overflow-wrap: anywhere;
  }
  .join-address {
    display: none;
    font-weight: 700;
    color: var(--ink);
    overflow-wrap: anywhere;
  }
  ${stageQuery.short} {
    .join-sentence {
      display: none;
    }
    .join-address {
      display: block;
    }
  }
  [data-s2] & {
    .join-sentence {
      display: none;
    }
    .join-address {
      display: block;
    }
  }
`;

const BigAddress = styled.p`
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.25rem, 4cqh, calc(3rem * var(--cap, 1)));
  line-height: 1.1;
  overflow-wrap: anywhere;
`;

function useCopyLink(link) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return [copied, copy];
}

function CopyButton({ link }) {
  const [copied, copy] = useCopyLink(link);
  return (
    <>
      <Button variant="secondary" size="sm" onStage onClick={copy} style={{ flex: '0 0 auto', whiteSpace: 'normal', textAlign: 'center', lineHeight: 1.15, maxWidth: '100%' }}>
        {copied ? 'Link copied' : 'Copy invite link'}
      </Button>
      <span aria-live="polite" className="visually-hidden">
        {copied ? 'Invite link copied' : ''}
      </span>
    </>
  );
}

function Qr({ session, link }) {
  return (
    <Suspense fallback={<QrBox className="qr" aria-hidden="true" />}>
      <QrBox className="qr">
        <QRCodeSVG value={link} size={256} level="M" title={`QR code to join room ${session.sessionId}`} />
      </QrBox>
    </Suspense>
  );
}

function RoomCode({ session }) {
  return (
    <Code className="code" aria-label={`Room code ${session.sessionId.split('').join(' ')}`}>
      {formatRoomCode(session.sessionId)}
    </Code>
  );
}

// Invite block for modes P and L: code, then QR + how to join.
function InviteCompact({ session, host, link }) {
  return (
    <>
      <RoomCode session={session} />
      <JoinGrid>
        <Qr session={session} link={link} />
        <JoinText>
          <p className="join-sentence">
            Players go to <strong>{host}/join</strong> and enter this code, or scan the QR code.
          </p>
          <p className="join-address" aria-hidden="true">
            {host}/join
          </p>
          <CopyButton link={link} />
        </JoinText>
      </JoinGrid>
    </>
  );
}

// Mode W: the invite column.
function InviteWide({ session, host, link }) {
  return (
    <>
      <Eyebrow>Invite players</Eyebrow>
      <BigAddress>{host}/join</BigAddress>
      <RoomCode session={session} />
      <JoinGrid>
        <Qr session={session} link={link} />
        <CopyButton link={link} />
      </JoinGrid>
      <p className="visually-hidden">
        Players go to <strong>{host}/join</strong> and enter this code, or scan the QR code.
      </p>
    </>
  );
}

// ------------------------------------------------------------------------ players

const chip = css`
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 6px 12px;
  border-radius: 10px;
  background: var(--surface-sunk);
  font-weight: 700;
  font-size: clamp(calc(13px * var(--floor)), 2.2cqh, calc(1.15rem * var(--cap, 1)));
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Chips = styled.ul`
  position: relative;
  list-style: none;
  margin: 0;
  padding: 2px;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 8px;
  min-width: 0;
  li {
    ${chip}
  }
  li[data-me='true'] {
    box-shadow: inset 0 0 0 2px var(--accent-text);
    background: var(--accent-soft);
  }
  li[data-offline='true'] {
    color: var(--ink-3);
    font-weight: 400;
  }
  li[data-more] {
    font-family: var(--font-display);
    font-variant-numeric: tabular-nums;
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--line-strong);
    color: var(--ink-2);
  }
  small {
    font-size: 1em;
    font-weight: 400;
    color: var(--ink-3);
  }
  @media (prefers-reduced-motion: no-preference) {
    li[data-new] {
      animation: pop 200ms var(--ease-spring) backwards;
      --pop-from: 0.9;
    }
  }
  &[data-fill] {
    flex: 1 1 0;
    /* Keeps the 44 px header button (it overhangs its 24 px row) inside the stage. */
    min-height: 12px;
    overflow: hidden;
    @supports not (container-type: size) {
      flex: none;
      overflow: visible;
    }
  }
`;

const PlayersHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: 0 0 auto;
  min-width: 0;
  min-height: 24px;
  font-size: clamp(calc(13px * var(--floor)), 2cqh, calc(1rem * var(--cap, 1)));
  .count {
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-2);
    font-size: max(calc(12px * var(--floor)), 0.85em);
  }
  .max {
    color: var(--ink-2);
    white-space: nowrap;
  }
  button.count {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    margin: -10px 0;
    padding: 0 10px 0 0;
    background: none;
    border: 0;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-color: var(--line-strong);
    text-underline-offset: 0.25em;
  }
`;

function PlayerChip({ player, seat, isNew }) {
  return (
    <li data-me={player.playerId === seat.playerId} data-offline={!player.connected} data-new={isNew || undefined}>
      {player.username}
      {getRoleLabel(player.role) ? <small>&nbsp;· {getRoleLabel(player.role)}</small> : null}
      {!player.connected ? <small>&nbsp;· offline</small> : null}
    </li>
  );
}

function PlayersBlock({ session, seat }) {
  const { preview } = useStage();
  const connected = session.players.filter((player) => player.connected);
  const label = `${connected.length} ${connected.length === 1 ? 'player' : 'players'} connected`;
  const listRef = useRef(null);
  const moreRef = useRef(null);
  const initial = useRef(null);
  if (!initial.current) initial.current = new Set(session.players.map((player) => player.playerId));
  const hidden = useItemsThatFit(listRef, moreRef, [session.players]);
  const [open, setOpen] = useState(false);

  return (
    <>
      <PlayersHead>
        {hidden > 0 && !preview ? (
          <button type="button" className="count" onClick={() => setOpen(true)}>
            {label}
            <Icon name="arrowRight" />
          </button>
        ) : (
          <p className="count">{label}</p>
        )}
        <span className="max">Up to {session.maxPlayers}</span>
      </PlayersHead>
      <Chips ref={listRef} data-fill="" aria-live="polite" aria-label={label}>
        {session.players.map((player) => (
          <PlayerChip key={player.playerId} player={player} seat={seat} isNew={!initial.current.has(player.playerId)} />
        ))}
        <li data-more="" ref={moreRef} aria-hidden="true" style={{ display: 'none' }} />
      </Chips>
      {preview ? null : (
        <Sheet open={open} onClose={() => setOpen(false)} title={label} closeOnChange={session.gameState}>
          <Chips aria-label={label}>
            {session.players.map((player) => (
              <PlayerChip key={player.playerId} player={player} seat={seat} />
            ))}
          </Chips>
        </Sheet>
      )}
    </>
  );
}

const Dots = styled.p`
  display: flex;
  gap: 8px;
  flex: 0 0 auto;
  padding: 4px 0;
  span {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--answer-a);
  }
  span:nth-child(2) {
    background: var(--answer-b);
  }
  span:nth-child(3) {
    background: var(--answer-c);
  }
  @media (prefers-reduced-motion: no-preference) {
    span {
      animation: pulse-dot 1.2s ease-in-out infinite;
    }
    span:nth-child(2) {
      animation-delay: 200ms;
    }
    span:nth-child(3) {
      animation-delay: 400ms;
    }
  }
  [data-s3] & {
    display: none;
  }
`;

const HostNotice = styled.p`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  padding: 6px 10px;
  border-radius: 10px;
  background: var(--warning-soft);
  border: 1px solid color-mix(in srgb, var(--warning) 35%, transparent);
  font-weight: 700;
  font-size: clamp(calc(13px * var(--floor)), 2cqh, 1.05rem);
  line-height: 1.3;
  svg {
    color: var(--warning);
    flex: 0 0 auto;
  }
`;

// ------------------------------------------------------------------------ review

function ReviewPanel({ session, hostToken }) {
  const [questions, setQuestions] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setError('');
    try {
      const data = await fetchReviewQuestions(session.sessionId, hostToken);
      setQuestions(data.questions);
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  const update = (index, patch) => {
    setSaved(false);
    setQuestions((current) => current.map((question, i) => (i === index ? { ...question, ...patch } : question)));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const data = await saveReviewQuestions(session.sessionId, hostToken, questions);
      setQuestions(data.questions);
      setSaved(true);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  if (!questions) {
    return (
      <Stack $gap={12}>
        <Muted>
          You chose to check the questions before playing. Opening them shows you every answer, so you won’t be playing blind — players will see that
          you’ve reviewed them.
        </Muted>
        <ErrorNotice error={error} />
        <div>
          <Button variant="secondary" onClick={load}>
            Review questions and answers
          </Button>
        </div>
      </Stack>
    );
  }

  return (
    <Stack $gap={16}>
      <Row $justify="space-between">
        <Eyebrow>Review {questions.length} questions</Eyebrow>
        <Muted $small>Fix wording, change the correct answer, or remove a question (minimum 5).</Muted>
      </Row>
      <ErrorNotice error={error} />
      {questions.map((question, index) => (
        <fieldset key={index} style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 14, margin: 0 }}>
          <legend style={{ fontWeight: 700, padding: '0 6px' }}>Question {index + 1}</legend>
          <Stack $gap={10}>
            <Field label="Question">
              <Input value={question.question} maxLength={240} onChange={(event) => update(index, { question: event.target.value })} />
            </Field>
            {question.choices.map((choice, choiceIndex) => (
              <Field key={choiceIndex} label={`Answer ${'ABCD'[choiceIndex]}`}>
                <Input
                  value={choice}
                  maxLength={120}
                  onChange={(event) => update(index, { choices: question.choices.map((c, i) => (i === choiceIndex ? event.target.value : c)) })}
                />
              </Field>
            ))}
            <Row $justify="space-between">
              <Field label="Correct answer">
                <Select value={question.correctAnswerIndex} onChange={(event) => update(index, { correctAnswerIndex: Number(event.target.value) })}>
                  {question.choices.map((choice, choiceIndex) => (
                    <option key={choiceIndex} value={choiceIndex}>
                      {'ABCD'[choiceIndex]}: {choice.slice(0, 40)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                variant="danger"
                size="sm"
                disabled={questions.length <= 5}
                onClick={() => {
                  setSaved(false);
                  setQuestions((current) => current.filter((_, i) => i !== index));
                }}
              >
                Remove question
              </Button>
            </Row>
          </Stack>
        </fieldset>
      ))}
      <Row>
        <Button onClick={save} busy={saving} disabled={saving}>
          Save changes
        </Button>
        {saved ? <span role="status">Saved. Players will get the updated questions.</span> : null}
      </Row>
    </Stack>
  );
}

const ReviewButton = styled(Button)`
  && {
    width: 100%;
    flex: 0 0 auto;
    justify-content: space-between;
  }
  ${stageQuery.W} {
    && {
      width: auto;
      gap: 12px;
    }
  }
`;

// ------------------------------------------------------------------------ layout

const LobbyBody = styled(Body)`
  display: flex;
  flex-direction: column;
  gap: var(--gap);
  .col {
    display: contents;
  }
  ${stageQuery.L} {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    column-gap: clamp(12px, 3cqw, 32px);
    .col {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 10px;
      min-height: 0;
      min-width: 0;
    }
    .col.people {
      justify-content: flex-start;
    }
  }
  ${stageQuery.W} {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    column-gap: 4cqw;
    .col {
      display: flex;
      flex-direction: column;
      gap: var(--gap);
      min-height: 0;
      min-width: 0;
    }
    .col.invite {
      justify-content: center;
    }
  }
  &[data-role='player'] {
    ${stageQuery.L} {
      grid-template-columns: minmax(0, 1fr);
    }
    ${stageQuery.W} {
      grid-template-columns: minmax(0, 1fr);
      max-width: 1100px;
      width: 100%;
      margin: 0 auto;
    }
  }
`;

const HostHint = styled.p`
  font-size: clamp(calc(13px * var(--floor)), 2cqh, calc(1.1rem * var(--cap, 1)));
  line-height: 1.3;
  color: var(--ink-2);
  min-width: 0;
  ${hiddenAt(stageQuery.short)}
  ${stageQuery.W} {
    flex: 1 1 auto;
  }
`;

const PlayerStatus = styled(StatusText)`
  .rest {
    ${hiddenAt(stageQuery.short)}
  }
`;

const TopLabel = styled.span`
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: max(calc(12px * var(--floor)), 0.8em);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-2);
`;

export function Lobby({ session, seat, isHost, onStart, onLeave, solo }) {
  const { mode, preview } = useStage();
  const me = session.players.find((player) => player.playerId === seat.playerId);
  const connected = session.players.filter((player) => player.connected);
  const [starting, setStarting] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const bodyRef = useRef(null);
  const host = typeof window !== 'undefined' ? window.location.host : '';
  const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${session.sessionId}`;
  const showInvite = isHost && !solo;
  const canReview = isHost && session.reviewMode && Boolean(seat.hostToken);
  useFitStage(bodyRef, [mode, showInvite, canReview, session.topic, session.hostStatus], { levels: isHost ? 6 : 3, text: false });

  const start = async () => {
    setStarting(true);
    await onStart?.();
    setStarting(false);
  };

  const hostNotice =
    !isHost && session.hostStatus === 'reconnecting' ? (
      <HostNotice role="status">
        <Icon name="alert" />
        The host lost connection and is reconnecting. Hang on — the game will continue.
      </HostNotice>
    ) : !isHost && session.hostStatus === 'away' ? (
      <HostNotice role="status">
        <Icon name="alert" />
        The host is away. The game will continue when they come back.
      </HostNotice>
    ) : null;

  const reviewButton = canReview ? (
    <ReviewButton variant="secondary" size="sm" onStage onClick={() => setReviewOpen(true)}>
      Review mode
      <Icon name="arrowRight" />
    </ReviewButton>
  ) : null;

  const topic = <Topic data-truncate="">{session.topic}</Topic>;
  const badges = <RoomBadges session={session} />;
  const players = <PlayersBlock session={session} seat={seat} />;

  let content;
  if (!showInvite) {
    content = (
      <div className="col people">
        {topic}
        {badges}
        {isHost ? null : (
          <Dots aria-hidden="true">
            <span />
            <span />
            <span />
          </Dots>
        )}
        {hostNotice}
        {reviewButton}
        {players}
      </div>
    );
  } else if (mode === 'W') {
    content = (
      <>
        <div className="col invite">
          <InviteWide session={session} host={host} link={link} />
        </div>
        <div className="col people">
          {topic}
          {badges}
          {reviewButton}
          {players}
        </div>
      </>
    );
  } else if (mode === 'L') {
    content = (
      <>
        <div className="col invite">
          <InviteCompact session={session} host={host} link={link} />
        </div>
        <div className="col people">
          {topic}
          {reviewButton}
          {players}
        </div>
      </>
    );
  } else {
    content = (
      <div className="col">
        {topic}
        {badges}
        <InviteCompact session={session} host={host} link={link} />
        {reviewButton}
        {players}
      </div>
    );
  }

  return (
    <GameFrame>
      <TopBar
        left={
          <>
            <LogoTile />
            <TopLabel data-truncate="">{isHost ? 'Your room is ready' : 'You’re in'}</TopLabel>
          </>
        }
        right={
          <>
            <BigScreenToggle />
            <Button variant="ghost" size="sm" onClick={onLeave}>
              {isHost ? 'Leave' : 'Leave room'}
            </Button>
          </>
        }
      />
      <LobbyBody ref={bodyRef} data-role={isHost ? 'host' : 'player'}>
        {content}
      </LobbyBody>
      <Dock>
        {isHost ? (
          <>
            <HostHint>
              {connected.length <= 1
                ? 'Waiting for players to join. You can also start now and play on your own.'
                : 'Start when everyone’s in. People can still join after you start.'}
            </HostHint>
            <ActionButton size="lg" onClick={start} busy={starting} disabled={starting}>
              Start game
            </ActionButton>
          </>
        ) : (
          <PlayerStatus role="status">
            <span>
              Playing as <strong>{me?.username}</strong>.<span className="rest"> The first question appears here when the host starts. Keep this page open.</span>
            </span>
          </PlayerStatus>
        )}
      </Dock>
      {canReview && !preview ? (
        <Sheet open={reviewOpen} onClose={() => setReviewOpen(false)} title="Review mode" wide closeOnChange={session.gameState}>
          <ReviewPanel session={session} hostToken={seat.hostToken} />
        </Sheet>
      ) : null}
    </GameFrame>
  );
}
