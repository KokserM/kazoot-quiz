import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Container, ErrorNotice, Eyebrow, Field, Input, Muted, PageMain, PageTitle, SegmentedControl, Spinner, Stack } from '../components/ui';
import { track } from '../lib/analytics';
import { createSession } from '../lib/api';
import { useConfig } from '../lib/useConfig';

export default function DemoPage() {
  const navigate = useNavigate();
  const { config, error: configError } = useConfig();
  const [demoId, setDemoId] = useState('warm-up');
  const [mode, setMode] = useState('group');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => track('demo_opened', {}, { oncePerSession: true }), []);

  const start = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const quiz = config.demoQuizzes.find((item) => item.id === demoId);
      const room = await createSession({
        demoId,
        language: quiz?.language || 'English',
        questionTimeLimitMs: 20000,
        revealTiming: mode === 'solo' ? 'all_answered' : 'timer',
      });
      navigate(`/session/${room.sessionId}`, {
        state: { username: name.trim(), hostToken: room.hostToken, solo: mode === 'solo' },
      });
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  };

  return (
    <PageMain>
      <Container $narrow>
        <Stack $gap={22}>
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
            <Card>
              <form onSubmit={start}>
                <Stack $gap={22}>
                  <SegmentedControl
                    legend="How do you want to play?"
                    name="demo-mode"
                    value={mode}
                    onChange={setMode}
                    options={[
                      { value: 'group', label: 'With others', hint: 'They join on their phones' },
                      { value: 'solo', label: 'Solo preview', hint: 'Just you, right now' },
                    ]}
                  />
                  <Muted $small>
                    {mode === 'group'
                      ? `You get a room code and QR code to share. You play too — the questions are new to you as well. Up to ${config.maxDemoPlayers} players.`
                      : 'Play through the quiz on your own to see how it works. There are no computer players — it’s just you and the clock.'}
                  </Muted>

                  <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend style={{ fontWeight: 700, marginBottom: 8 }}>Pick a quiz</legend>
                    <Stack $gap={8}>
                      {config.demoQuizzes.map((quiz) => (
                        <label
                          key={quiz.id}
                          style={{
                            display: 'flex',
                            gap: 12,
                            alignItems: 'flex-start',
                            padding: '12px 14px',
                            borderRadius: 14,
                            cursor: 'pointer',
                            border: `2px solid ${demoId === quiz.id ? 'var(--ink)' : 'var(--line)'}`,
                            background: demoId === quiz.id ? 'var(--surface)' : 'transparent',
                          }}
                        >
                          <input type="radio" name="demo-quiz" value={quiz.id} checked={demoId === quiz.id} onChange={() => setDemoId(quiz.id)} style={{ marginTop: 5 }} />
                          <span>
                            <strong>{quiz.title}</strong>
                            {quiz.language !== 'English' ? <span style={{ color: 'var(--ink-3)' }}> · {quiz.language}</span> : null}
                            <br />
                            <span style={{ color: 'var(--ink-2)', fontSize: '0.95rem' }}>{quiz.description}</span>
                          </span>
                        </label>
                      ))}
                    </Stack>
                  </fieldset>

                  <Field label="Your name" hint="Shown on the scoreboard">
                    <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} autoComplete="nickname" required />
                  </Field>

                  <ErrorNotice error={error} />
                  <div>
                    <Button type="submit" size="lg" busy={busy} disabled={busy || !name.trim()}>
                      {mode === 'group' ? 'Create demo room' : 'Start solo preview'}
                    </Button>
                  </div>
                </Stack>
              </form>
            </Card>
          ) : null}
        </Stack>
      </Container>
    </PageMain>
  );
}
