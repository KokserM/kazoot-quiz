import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button, Card, Container, ErrorNotice, Eyebrow, Field, Input, LinkButton, Muted, Notice, PageMain, PageTitle, Row, SegmentedControl, Select, Spinner, Stack } from '../components/ui';
import { track } from '../lib/analytics';
import { createSession } from '../lib/api';
import { DEFAULT_HOST_PREFERENCES, loadHostPreferences, saveHostPreferences } from '../lib/hostPreferences';
import { useConfig } from '../lib/useConfig';

const EXAMPLES = ['Famous bridges', 'Nordic mythology', '1990s pop music', 'Volcanoes', 'Football World Cups', 'Estonian history'];

const PROGRESS_MESSAGES = ['Writing questions…', 'Checking answers and wrong options…', 'Mixing up the answer order…', 'Almost there…'];

export function describeAllowance(usage) {
  if (!usage) return null;
  const free = usage.freeRemainingThisMonth ?? 0;
  const paid = usage.credits ?? 0;
  if (free + paid === 0) return { empty: true, text: 'You have no AI games left this month.' };
  const parts = [];
  if (free) parts.push(`${free} free this month`);
  if (paid) parts.push(`${paid} purchased`);
  return { empty: false, text: `AI games left: ${parts.join(' + ')}. Free games are used first.` };
}

function GeneratingState({ topic }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <Card>
      <Stack $gap={12} role="status" aria-live="polite">
        <Row>
          <Spinner aria-hidden="true" />
          <strong>{PROGRESS_MESSAGES[Math.min(PROGRESS_MESSAGES.length - 1, Math.floor(seconds / 8))]}</strong>
        </Row>
        <Muted>
          Creating 10 questions about “{topic}”. This can take up to a minute. You won’t see the questions — you’re playing too.
        </Muted>
        <Muted $small>{seconds}s</Muted>
      </Stack>
    </Card>
  );
}

export default function CreatePage() {
  const navigate = useNavigate();
  const { user, isAuthLoading, isConfigured, signIn, usage, accessToken, refreshUsage, authError } = useAuth();
  const { config } = useConfig();
  const [topic, setTopic] = useState('');
  const [name, setName] = useState('');
  const [prefs, setPrefs] = useState(DEFAULT_HOST_PREFERENCES);
  const [difficulty, setDifficulty] = useState('mixed');
  const [reviewMode, setReviewMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => track('create_opened', {}, { oncePerSession: true }), []);
  useEffect(() => {
    if (isAuthLoading) return;
    loadHostPreferences(user?.id).then(setPrefs);
    if (user && !name) {
      setName((user.user_metadata?.full_name || user.user_metadata?.name || '').split(' ')[0] || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, user?.id]);

  const updatePrefs = (patch) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveHostPreferences(user?.id, next);
  };

  const allowance = describeAllowance(usage);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const room = await createSession(
        {
          topic: topic.trim(),
          language: prefs.language,
          difficulty,
          questionTimeLimitMs: Number(prefs.questionTimeLimitMs),
          revealTiming: prefs.revealTiming,
          reviewMode,
        },
        accessToken
      );
      refreshUsage().catch(() => {});
      navigate(`/session/${room.sessionId}`, { state: { username: name.trim(), hostToken: room.hostToken } });
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
      refreshUsage().catch(() => {});
    }
  };

  let body;
  if (isAuthLoading) {
    body = (
      <p role="status">
        <Spinner aria-hidden="true" /> Checking your sign-in…
      </p>
    );
  } else if (!user) {
    body = (
      <Card>
        <Stack $gap={14}>
          <h2 style={{ fontSize: '1.5rem' }}>Sign in to create a quiz on a topic you choose</h2>
          <Muted>
            Creating a quiz uses AI, so it needs an account. Sign in with Google and get {config?.freeAiGamesPerMonth ?? 3} free quizzes every month.
            Players never need an account.
          </Muted>
          <ErrorNotice error={authError} />
          <Row>
            <Button size="lg" onClick={signIn} disabled={!isConfigured}>
              Continue with Google
            </Button>
            <LinkButton to="/demo" variant="secondary" size="lg">
              Try the free demo first
            </LinkButton>
          </Row>
          {!isConfigured ? <Notice $tone="warning">Sign-in isn’t configured on this server.</Notice> : null}
        </Stack>
      </Card>
    );
  } else if (busy) {
    body = <GeneratingState topic={topic} />;
  } else {
    body = (
      <form onSubmit={submit}>
        <Stack $gap={20}>
          {allowance ? (
            <Notice $tone={allowance.empty ? 'warning' : 'info'}>
              <span>{allowance.text}</span>
              <Link to="/account">{allowance.empty ? 'Get more AI games' : 'Account'}</Link>
            </Notice>
          ) : null}
          {config && !config.aiAvailable ? (
            <Notice $tone="warning">Creating new quizzes is unavailable right now. The demo quizzes still work.</Notice>
          ) : null}
          <Card>
            <Stack $gap={18}>
              <Field label="Topic" hint="Broad, well-known topics work best. Kazoot can’t know private details like your team’s inside jokes.">
                <Input value={topic} onChange={(event) => setTopic(event.target.value)} minLength={2} maxLength={80} required autoFocus />
              </Field>
              <Row $gap={8}>
                <Muted $small>Ideas:</Muted>
                {EXAMPLES.map((example) => (
                  <Button key={example} variant="secondary" size="sm" onClick={() => setTopic(example)}>
                    {example}
                  </Button>
                ))}
              </Row>
              <Row $gap={16} $align="flex-start">
                <div style={{ flex: '1 1 200px' }}>
                  <Field label="Your name" hint="Shown on the scoreboard">
                    <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} required />
                  </Field>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <Field label="Question language">
                    <Select value={prefs.language} onChange={(event) => updatePrefs({ language: event.target.value })}>
                      <option value="English">English</option>
                      <option value="Estonian">Eesti keel (Estonian)</option>
                    </Select>
                  </Field>
                </div>
              </Row>
            </Stack>
          </Card>

          <Card>
            <Stack $gap={18}>
              <SegmentedControl
                legend="Difficulty"
                name="difficulty"
                value={difficulty}
                onChange={setDifficulty}
                options={[
                  { value: 'mixed', label: 'Mixed' },
                  { value: 'easy', label: 'Easy' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'hard', label: 'Hard' },
                ]}
              />
              <SegmentedControl
                legend="Time per question"
                name="timer"
                value={prefs.questionTimeLimitMs}
                onChange={(value) => updatePrefs({ questionTimeLimitMs: value })}
                options={[
                  { value: '10000', label: '10 s' },
                  { value: '15000', label: '15 s' },
                  { value: '20000', label: '20 s' },
                  { value: '30000', label: '30 s' },
                ]}
              />
              <SegmentedControl
                legend="Show the answer"
                name="reveal"
                value={prefs.revealTiming}
                onChange={(value) => updatePrefs({ revealTiming: value })}
                options={[
                  { value: 'timer', label: 'When time is up' },
                  { value: 'all_answered', label: 'When everyone has answered' },
                ]}
              />
              <SegmentedControl
                legend="Questions"
                name="review"
                value={reviewMode ? 'review' : 'surprise'}
                onChange={(value) => setReviewMode(value === 'review')}
                options={[
                  { value: 'surprise', label: 'Surprise me', hint: 'Hidden until play — you play too' },
                  { value: 'review', label: 'Let me check first', hint: 'For teachers: review and edit' },
                ]}
              />
            </Stack>
          </Card>

          <ErrorNotice error={error} />
          <Row>
            <Button type="submit" size="lg" disabled={!topic.trim() || !name.trim() || allowance?.empty || (config && !config.aiAvailable)}>
              Create quiz
            </Button>
            <Muted $small>Uses 1 AI game. If creation fails, you’re not charged.</Muted>
          </Row>
        </Stack>
      </form>
    );
  }

  return (
    <PageMain>
      <Container $narrow>
        <Stack $gap={20}>
          <Stack $gap={8}>
            <Eyebrow>New quiz</Eyebrow>
            <PageTitle>What should the quiz be about?</PageTitle>
          </Stack>
          {body}
        </Stack>
      </Container>
    </PageMain>
  );
}
