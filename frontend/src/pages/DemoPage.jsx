import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../auth/AuthProvider';
import { Button, Card, Container, ErrorNotice, Eyebrow, Field, Input, Muted, PageMain, PageTitle, Spinner, Stack } from '../components/ui';
import { track } from '../lib/analytics';
import { createSession } from '../lib/api';
import { loadLastName, saveLastName } from '../lib/storage';
import { useConfig } from '../lib/useConfig';

// Default scoreboard name for a one-tap solo demo when no name is known (brief 13, string 8).
export const SOLO_DEFAULT_NAME = 'Player';

// The name a one-tap solo demo plays under: the last name used in this browser, else the
// signed-in host's first name (as on /create), else "Player".
export function soloName(user) {
  const last = loadLastName();
  if (last) return last;
  const first = (user?.user_metadata?.full_name || user?.user_metadata?.name || '').trim().split(' ')[0];
  return first ? first.slice(0, 24) : SOLO_DEFAULT_NAME;
}

// Compact quiz picker: 2 × 2 radio cards (one column below 360); descriptions are hidden
// on phones so the solo button stays above the fold.
const Picker = styled.fieldset`
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
  legend {
    padding: 0;
    margin-bottom: 8px;
    font-weight: 700;
  }
  .options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    @media (max-width: 359px) {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  label {
    position: relative;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    min-height: 56px;
    padding: 10px 14px;
    border-radius: 14px;
    border: 2px solid var(--line);
    cursor: pointer;
    line-height: 1.3;
  }
  label:has(input:checked) {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  label:has(input:focus-visible) {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }
  input {
    margin: 3px 0 0;
    flex: 0 0 auto;
  }
  .lang {
    color: var(--ink-3);
  }
  @media (max-width: 560px) {
    label { align-items: center; }
    input { margin-top: 0; }
  }
  .description {
    display: block;
    margin-top: 2px;
    color: var(--ink-2);
    font-size: 0.9rem;
    @media (max-width: 560px) {
      display: none;
    }
  }
`;

const Panels = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: stretch;
  @media (max-width: 700px) {
    grid-template-columns: minmax(0, 1fr);
  }
  form {
    height: 100%;
  }
  .panel {
    height: 100%;
  }
  .panel > div {
    height: 100%;
  }
  h2 {
    font-size: 1.3rem;
  }
  .hint {
    margin-top: 2px;
    color: var(--ink-3);
    font-size: 0.92rem;
  }
  .push {
    margin-top: auto;
  }
  /* Phones: the solo button stays above the fold (the page intro already says what solo is). */
  @media (max-width: 560px) {
    .solo-text {
      display: none;
    }
  }
`;

// Tighter vertical rhythm on phones so one tap starts a game without scrolling.
const Page = styled(Stack)`
  @media (max-width: 560px) {
    gap: 16px;
  }
`;

// The solo panel comes first and carries the gradient border of the preferred plan card.
const SoloCard = styled(Card)`
  border: 1.5px solid transparent;
  background: linear-gradient(var(--surface), var(--surface)) padding-box, var(--brand-gradient) border-box;
  box-shadow: var(--shadow-raised);
`;

export default function DemoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { config, error: configError } = useConfig();
  const [demoId, setDemoId] = useState('');
  const [name, setName] = useState(loadLastName);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
  const nameRef = useRef(null);

  useEffect(() => track('demo_opened', {}, { oncePerSession: true }), []);

  const quizzes = config?.demoQuizzes || [];
  const selectedId = quizzes.some((quiz) => quiz.id === demoId) ? demoId : quizzes[0]?.id;

  const startRoom = async (mode, username) => {
    setBusy(mode);
    setError('');
    try {
      const quiz = quizzes.find((item) => item.id === selectedId);
      const room = await createSession({
        demoId: selectedId,
        language: quiz?.language || 'English',
        questionTimeLimitMs: 20000,
        revealTiming: mode === 'solo' ? 'all_answered' : 'timer',
      });
      navigate(`/session/${room.sessionId}`, {
        state: { username, hostToken: room.hostToken, solo: mode === 'solo' },
      });
    } catch (requestError) {
      setError(requestError.message);
      setBusy('');
    }
  };

  // One tap: no name is asked for a solo preview.
  const startSolo = (event) => {
    event.preventDefault();
    if (busy) return;
    startRoom('solo', soloName(user));
  };

  // The button stays enabled: a missing name is explained on press (validation pattern).
  const startGroup = (event) => {
    event.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      setNameError('Enter a name.');
      nameRef.current?.focus();
      return;
    }
    saveLastName(name);
    startRoom('group', name.trim());
  };

  return (
    <PageMain>
      <Container $narrow>
        <Page $gap={22}>
          <Stack $gap={10}>
            <Eyebrow>Free demo · no account needed</Eyebrow>
            <PageTitle>Try a real game</PageTitle>
            <Muted>
              This is the real game with a hand-written quiz. Your own quizzes work the same way, except Kazoot writes fresh questions for the topic
              you choose.
            </Muted>
          </Stack>

          {configError ? <ErrorNotice error="Couldn’t load the demo quizzes. Check your connection and refresh." /> : null}
          {!config && !configError ? (
            <p role="status">
              <Spinner aria-hidden="true" /> Loading…
            </p>
          ) : null}

          {config ? (
            <>
              <Picker>
                <legend>Pick a quiz</legend>
                <div className="options">
                  {quizzes.map((quiz) => (
                    <label key={quiz.id}>
                      <input type="radio" name="demo-quiz" value={quiz.id} checked={selectedId === quiz.id} onChange={() => setDemoId(quiz.id)} />
                      <span>
                        <strong>{quiz.title}</strong>
                        {quiz.language !== 'English' ? <span className="lang"> · {quiz.language}</span> : null}
                        <span className="description">{quiz.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </Picker>

              <ErrorNotice error={error} />

              <Panels>
                <form onSubmit={startSolo} noValidate aria-labelledby="demo-solo-title">
                  <SoloCard className="panel">
                    <Stack $gap={14}>
                      <div>
                        <h2 id="demo-solo-title">Solo preview</h2>
                        <p className="hint">Just you, right now</p>
                      </div>
                      <Muted $small className="solo-text">Play through the quiz on your own to see how it works. There are no computer players — it’s just you and the clock.</Muted>
                      <div className="push">
                        <Button type="submit" size="lg" block busy={busy === 'solo'} disabled={Boolean(busy)}>
                          Start solo preview
                        </Button>
                      </div>
                    </Stack>
                  </SoloCard>
                </form>

                <form onSubmit={startGroup} noValidate aria-labelledby="demo-group-title">
                  <Card className="panel">
                    <Stack $gap={14}>
                      <div>
                        <h2 id="demo-group-title">With others</h2>
                        <p className="hint">They join on their phones</p>
                      </div>
                      <Muted $small>{`You get a room code and QR code to share. You play too — the questions are new to you as well. Up to ${config.maxDemoPlayers} players.`}</Muted>
                      <Field label="Your name" hint="Shown on the scoreboard" error={nameError}>
                        <Input
                          ref={nameRef}
                          value={name}
                          onChange={(event) => {
                            setName(event.target.value);
                            if (nameError && event.target.value.trim()) setNameError('');
                          }}
                          maxLength={24}
                          autoComplete="nickname"
                          required
                        />
                      </Field>
                      <div className="push">
                        <Button type="submit" variant="secondary" size="lg" block busy={busy === 'group'} disabled={Boolean(busy)}>
                          Create demo room
                        </Button>
                      </div>
                    </Stack>
                  </Card>
                </form>
              </Panels>
            </>
          ) : null}
        </Page>
      </Container>
    </PageMain>
  );
}
