import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../auth/AuthProvider';
import { Button, Card, Container, ErrorNotice, Eyebrow, Field, Input, LinkButton, Muted, Notice, PageMain, PageTitle, Row, SegmentedControl, Select, Spinner, Stack } from '../components/ui';
import { track } from '../lib/analytics';
import { createSession } from '../lib/api';
import { CREATE_EXAMPLES } from '../lib/copy';
import { DEFAULT_HOST_PREFERENCES, loadHostPreferences, saveHostPreferences } from '../lib/hostPreferences';
import { saveLastName } from '../lib/storage';
import { useConfig } from '../lib/useConfig';

export const EXAMPLES = CREATE_EXAMPLES;

// The topic typed before signing in survives the Google round trip (sessionStorage:
// this tab only, gone when it closes).
export const CREATE_DRAFT_KEY = 'kazoot:create-draft';

function saveDraft(draft) {
  try {
    sessionStorage.setItem(CREATE_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage unavailable: they type the topic again after signing in.
  }
}

function takeDraft() {
  try {
    const raw = sessionStorage.getItem(CREATE_DRAFT_KEY);
    sessionStorage.removeItem(CREATE_DRAFT_KEY);
    const draft = raw ? JSON.parse(raw) : null;
    return draft && typeof draft.topic === 'string' ? { topic: draft.topic.slice(0, 80) } : null;
  } catch {
    return null;
  }
}

const TOPIC_HINT = 'Broad, well-known topics work best. Kazoot can’t know private details like your team’s inside jokes.';

const SignInBlock = styled.div`
  display: grid;
  gap: 14px;
  h2 {
    font-size: 1.2rem;
  }
`;

const Actions = styled(Row)`
  @media (max-width: 480px) {
    > * {
      flex: 1 1 100%;
    }
  }
`;

function TopicField({ topic, onTopic, error, inputRef, autoFocus = false }) {
  return (
    <>
      <Field label="Topic" hint={TOPIC_HINT} error={error}>
        <Input ref={inputRef} value={topic} onChange={(event) => onTopic(event.target.value)} minLength={2} maxLength={80} required autoFocus={autoFocus} />
      </Field>
      <Row $gap={8}>
        <Muted $small>Ideas:</Muted>
        {EXAMPLES.map((example) => (
          <Button key={example} variant="secondary" size="sm" onClick={() => onTopic(example)}>
            {example}
          </Button>
        ))}
      </Row>
    </>
  );
}

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
  const [topicError, setTopicError] = useState('');
  const [nameError, setNameError] = useState('');
  const [autoFocusTopic, setAutoFocusTopic] = useState(true);
  const topicRef = useRef(null);
  const nameRef = useRef(null);
  const restoredDraft = useRef(false);

  useEffect(() => track('create_opened', {}, { oncePerSession: true }), []);

  // Back from Google sign-in: restore the topic typed before, then focus what is missing.
  useEffect(() => {
    if (isAuthLoading || !user || restoredDraft.current) return;
    restoredDraft.current = true;
    const draft = takeDraft();
    if (!draft) return;
    setTopic(draft.topic);
    if (draft.topic.trim()) {
      setAutoFocusTopic(false);
      // After the name prefill below has rendered.
      requestAnimationFrame(() => nameRef.current?.focus());
    } else {
      topicRef.current?.focus();
    }
  }, [isAuthLoading, user]);

  const continueWithGoogle = () => {
    saveDraft({ topic });
    signIn();
  };
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
    if (busy) return;
    // The button stays enabled: missing input is explained on press (validation pattern).
    const topicMissing = topic.trim().length < 2;
    const nameMissing = !name.trim();
    setTopicError(topicMissing ? 'Topic must be at least 2 characters.' : '');
    setNameError(nameMissing ? 'Enter a name.' : '');
    if (topicMissing) {
      topicRef.current?.focus();
      return;
    }
    if (nameMissing) {
      nameRef.current?.focus();
      return;
    }
    saveLastName(name);
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
    // Signed out: the start of the real form, then the sign-in step. The topic is kept
    // through the Google round trip; the rest of the form appears after signing in.
    body = (
      <Stack $gap={22}>
        <Card>
          <Stack $gap={18}>
            <TopicField topic={topic} onTopic={setTopic} />
          </Stack>
        </Card>
        <SignInBlock>
          <h2>Sign in to create a quiz on a topic you choose</h2>
          <Muted>
            Creating a quiz uses AI, so it needs an account. Sign in with Google and get {config?.freeAiGamesPerMonth ?? 3} free quizzes every month.
            Players never need an account.
          </Muted>
          <ErrorNotice error={authError} />
          <Actions>
            <Button size="lg" onClick={continueWithGoogle} disabled={!isConfigured} aria-describedby={isConfigured ? undefined : 'create-sign-in-unavailable'}>
              Continue with Google
            </Button>
            <LinkButton to="/demo" variant="secondary" size="lg">
              Try the free demo first
            </LinkButton>
          </Actions>
          {!isConfigured ? (
            <Notice $tone="warning" id="create-sign-in-unavailable">
              Sign-in isn’t configured on this server.
            </Notice>
          ) : null}
        </SignInBlock>
      </Stack>
    );
  } else if (busy) {
    body = <GeneratingState topic={topic} />;
  } else {
    const noGamesLeft = Boolean(allowance?.empty);
    const aiUnavailable = Boolean(config && !config.aiAvailable);
    body = (
      <form onSubmit={submit} noValidate>
        <Stack $gap={20}>
          {allowance ? (
            <Notice $tone={allowance.empty ? 'warning' : 'info'} id="create-allowance">
              <span>{allowance.text}</span>
              <Link to="/account">{allowance.empty ? 'Get more AI games' : 'Account'}</Link>
            </Notice>
          ) : null}
          {aiUnavailable ? (
            <Notice $tone="warning" id="create-ai-unavailable">
              Creating new quizzes is unavailable right now. The demo quizzes still work.
            </Notice>
          ) : null}
          <Card>
            <Stack $gap={18}>
              <TopicField
                topic={topic}
                onTopic={(value) => {
                  setTopic(value);
                  if (topicError && value.trim().length >= 2) setTopicError('');
                }}
                error={topicError}
                inputRef={topicRef}
                autoFocus={autoFocusTopic}
              />
              <Row $gap={16} $align="flex-start">
                <div style={{ flex: '1 1 200px' }}>
                  <Field label="Your name" hint="Shown on the scoreboard" error={nameError}>
                    <Input
                      ref={nameRef}
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        if (nameError && event.target.value.trim()) setNameError('');
                      }}
                      maxLength={24}
                      required
                    />
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
            <Button
              type="submit"
              size="lg"
              disabled={noGamesLeft || aiUnavailable}
              aria-describedby={[noGamesLeft ? 'create-allowance' : null, aiUnavailable ? 'create-ai-unavailable' : null].filter(Boolean).join(' ') || undefined}
            >
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
