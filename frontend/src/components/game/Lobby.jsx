import React, { lazy, Suspense, useState } from 'react';
import styled from 'styled-components';
import { fetchReviewQuestions, saveReviewQuestions } from '../../lib/api';
import { formatRoomCode, getRoleLabel } from '../../lib/gameUi';
import { Badge, Button, Card, ErrorNotice, Eyebrow, Field, Input, Muted, Notice, Row, Select, Stack } from '../ui';

const QRCodeSVG = lazy(() => import('qrcode.react').then((module) => ({ default: module.QRCodeSVG })));

const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 20px;
  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

const Code = styled.p`
  font-family: var(--font-display);
  font-size: clamp(1.9rem, 5.5vw, 3.2rem);
  white-space: nowrap;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
`;

const QrBox = styled.div`
  width: fit-content;
  padding: 14px;
  border-radius: var(--radius);
  background: #fff;
  border: 1px solid var(--line);
`;

const Players = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  li {
    padding: 8px 14px;
    border-radius: 10px;
    background: var(--surface-sunk);
    font-weight: 700;
  }
  li[data-me='true'] {
    box-shadow: inset 0 0 0 2px var(--accent-text);
    background: var(--accent-soft);
  }
  li[data-offline='true'] {
    color: var(--ink-3);
    font-weight: 400;
  }
  small {
    font-weight: 400;
    color: var(--ink-3);
  }
`;

export function RoomBadges({ session }) {
  return (
    <Row $gap={8}>
      <Badge>{session.isDemo ? 'Demo quiz' : 'Fresh AI quiz'}</Badge>
      <Badge>{session.language}</Badge>
      <Badge>{session.questionCount} questions</Badge>
      <Badge>{Math.round(session.questionTimeLimitMs / 1000)} s per question</Badge>
      {session.reviewMode ? (
        <Badge $tone="warning">{session.hostReviewed ? 'Host has seen the questions' : 'Review mode'}</Badge>
      ) : (
        <Badge $tone="success">Surprise: nobody has seen the questions</Badge>
      )}
    </Row>
  );
}

function InvitePanel({ session }) {
  const link = `${window.location.origin}/join/${session.sessionId}`;
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
  return (
    <Card>
      <Stack $gap={14}>
        <Eyebrow>Invite players</Eyebrow>
        <Muted>
          Players go to <strong>{window.location.host}/join</strong> and enter this code, or scan the QR code.
        </Muted>
        <Code aria-label={`Room code ${session.sessionId.split('').join(' ')}`}>{formatRoomCode(session.sessionId)}</Code>
        <Suspense fallback={<div style={{ width: 208, height: 208 }} />}>
          <QrBox>
            <QRCodeSVG value={link} size={180} level="M" title={`QR code to join room ${session.sessionId}`} />
          </QrBox>
        </Suspense>
        <Row>
          <Button variant="secondary" size="sm" onClick={copy}>
            {copied ? 'Link copied' : 'Copy invite link'}
          </Button>
          <span aria-live="polite" className="visually-hidden">
            {copied ? 'Invite link copied' : ''}
          </span>
        </Row>
      </Stack>
    </Card>
  );
}

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
      <Card>
        <Stack $gap={12}>
          <Eyebrow>Review mode</Eyebrow>
          <Muted>
            You chose to check the questions before playing. Opening them shows you every answer, so you won’t be playing blind — players will see
            that you’ve reviewed them.
          </Muted>
          <ErrorNotice error={error} />
          <div>
            <Button variant="secondary" onClick={load}>
              Review questions and answers
            </Button>
          </div>
        </Stack>
      </Card>
    );
  }

  return (
    <Card>
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
                    onChange={(event) =>
                      update(index, { choices: question.choices.map((c, i) => (i === choiceIndex ? event.target.value : c)) })
                    }
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
    </Card>
  );
}

export function Lobby({ session, seat, isHost, onStart, onLeave, solo }) {
  const me = session.players.find((player) => player.playerId === seat.playerId);
  const connected = session.players.filter((player) => player.connected);
  const [starting, setStarting] = useState(false);

  const start = async () => {
    setStarting(true);
    await onStart();
    setStarting(false);
  };

  return (
    <Stack $gap={20}>
      <Stack $gap={10}>
        <Eyebrow>{isHost ? 'Your room is ready' : 'You’re in'}</Eyebrow>
        <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)' }}>{session.topic}</h1>
        <RoomBadges session={session} />
      </Stack>

      {session.hostStatus === 'reconnecting' && !isHost ? (
        <Notice $tone="warning">The host lost connection and is reconnecting. Hang on — the game will continue.</Notice>
      ) : null}
      {session.hostStatus === 'away' && !isHost ? (
        <Notice $tone="warning">The host is away. The game will continue when they come back.</Notice>
      ) : null}

      <Layout>
        {isHost && !solo ? <InvitePanel session={session} /> : null}
        <Card>
          <Stack $gap={14}>
            <Row $justify="space-between">
              <Eyebrow>
                {connected.length} {connected.length === 1 ? 'player' : 'players'} connected
              </Eyebrow>
              <Muted $small>Up to {session.maxPlayers}</Muted>
            </Row>
            <Players aria-live="polite">
              {session.players.map((player) => (
                <li key={player.playerId} data-me={player.playerId === seat.playerId} data-offline={!player.connected}>
                  {player.username}
                  {getRoleLabel(player.role) ? <small> · {getRoleLabel(player.role)}</small> : null}
                  {!player.connected ? <small> · offline</small> : null}
                </li>
              ))}
            </Players>
            {isHost ? (
              <Stack $gap={10}>
                <Muted $small>
                  {connected.length <= 1
                    ? 'Waiting for players to join. You can also start now and play on your own.'
                    : 'Start when everyone’s in. People can still join after you start.'}
                </Muted>
                <Row>
                  <Button size="lg" onClick={start} busy={starting} disabled={starting}>
                    Start game
                  </Button>
                  <Button variant="ghost" onClick={onLeave}>
                    Leave
                  </Button>
                </Row>
              </Stack>
            ) : (
              <Stack $gap={10}>
                <Muted>
                  Playing as <strong>{me?.username}</strong>. The first question appears here when the host starts. Keep this page open.
                </Muted>
                <div>
                  <Button variant="ghost" onClick={onLeave}>
                    Leave room
                  </Button>
                </div>
              </Stack>
            )}
          </Stack>
        </Card>
      </Layout>

      {isHost && session.reviewMode && seat.hostToken ? <ReviewPanel session={session} hostToken={seat.hostToken} /> : null}
    </Stack>
  );
}
