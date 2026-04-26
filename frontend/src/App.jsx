import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ThemeProvider } from 'styled-components';
import { motion } from 'framer-motion';
import { fetchDemoTopics, createSession as requestCreateSession } from './lib/api';
import { loadPlayerSession } from './lib/storage';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { AccountStatusBar } from './components/AccountStatusBar';
import { GameProvider, useGame } from './providers/GameProvider';
import { GlobalStyle } from './styles/GlobalStyle';
import { theme } from './styles/theme';
import {
  Banner,
  Button,
  ButtonRow,
  Card,
  ChoiceCard,
  CenteredContent,
  Cluster,
  EmptyState,
  Eyebrow,
  FormGrid,
  GlassPanel,
  Grid,
  HeaderRow,
  HelperText,
  HeroCard,
  Input,
  Label,
  PageShell,
  PanelBody,
  PanelTitleHeader,
  Pill,
  AnswerButton,
  AnswerLetter,
  AnswerText,
  ResultOptionCard,
  SectionTitle,
  Select,
  Spinner,
  Stack,
  StatChip,
  Subtitle,
  Title,
} from './components/ui';

const AccountPage = lazy(() => import('./pages/AccountPage'));

function Shell({ children, dense = false, accountBarMode = 'default' }) {
  return (
    <PageShell $dense={dense}>
      <CenteredContent>
        <AccountStatusBar dense={dense} mode={accountBarMode} />
        {children}
      </CenteredContent>
    </PageShell>
  );
}

function MobileOnlyHint({ children }) {
  return (
    <div
      style={{
        color: theme.colors.textSoft,
        fontSize: '0.92rem',
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

function hasAnswerSelection(value) {
  return typeof value === 'number';
}

function getConnectionTone(connectionStatus) {
  return connectionStatus === 'connected' ? 'success' : 'warning';
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized
        .split('')
        .map((part) => `${part}${part}`)
        .join('')
    : normalized;

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function mixCountdownColor(startHex, endHex, progress) {
  const start = hexToRgb(startHex);
  const end = hexToRgb(endHex);
  const clampedProgress = Math.max(0, Math.min(1, progress));

  const channel = (from, to) => Math.round(from + (to - from) * clampedProgress);

  return `rgb(${channel(start.r, end.r)}, ${channel(start.g, end.g)}, ${channel(start.b, end.b)})`;
}

function getCountdownBarColor(question, remainingMs) {
  if (!question) {
    return theme.colors.secondarySoft;
  }

  if (remainingMs <= 3000) {
    return theme.colors.danger;
  }

  const elapsedRatio = 1 - Math.max(0, Math.min(1, remainingMs / question.timeLimit));
  const colorStops = [
    { stop: 0, color: '#4ade80' },
    { stop: 0.28, color: '#84cc16' },
    { stop: 0.55, color: '#eab308' },
    { stop: 0.78, color: '#f97316' },
    { stop: 1, color: theme.colors.danger },
  ];

  for (let index = 0; index < colorStops.length - 1; index += 1) {
    const current = colorStops[index];
    const next = colorStops[index + 1];

    if (elapsedRatio <= next.stop) {
      const segmentProgress = (elapsedRatio - current.stop) / (next.stop - current.stop);
      return mixCountdownColor(current.color, next.color, segmentProgress);
    }
  }

  return theme.colors.danger;
}

export function getQuestionClockOffset(question, now = Date.now()) {
  if (!question) {
    return 0;
  }

  return (question.serverTime || now) - (question.clientReceivedAt || now);
}

export function getRemainingQuestionMs(question, now = Date.now()) {
  if (!question) {
    return 0;
  }

  return Math.max(0, question.questionEndsAt - (now + getQuestionClockOffset(question, now)));
}

export function getSessionPhase({ activeSession, question, results, gameEnd }) {
  if (gameEnd) {
    return 'ended';
  }

  if (results) {
    return 'results';
  }

  if (question) {
    return 'question';
  }

  if (activeSession?.gameState === 'waiting') {
    return 'waiting';
  }

  return 'idle';
}

export function shouldShowSessionJoinLoading({ activeSession, joinAttempted, hasKnownUsername, error }) {
  return !activeSession && joinAttempted && hasKnownUsername && !error;
}

export function shouldAttemptQuestionResync({ remainingMs, connectionStatus, hasResyncHandler }) {
  return remainingMs === 0 && hasResyncHandler && connectionStatus !== 'connected';
}

export function getRevealTimingLabel(revealTiming) {
  return revealTiming === 'all_answered' ? 'Reveal: when all answer' : 'Reveal: timer ends';
}

export function getSubmittedAnswerMessage(revealTiming) {
  return revealTiming === 'all_answered'
    ? '✓ Answer submitted. Waiting for the other players to lock in.'
    : '✓ Answer submitted. Waiting for the timer to finish.';
}

export function getHostAuthorityLabel(player) {
  if (player?.hostAuthority === 'temporary' || player?.isTemporaryHost) {
    return 'Temporary host';
  }

  return player?.isHost ? 'Host' : 'Player';
}

export function getCreateButtonLabel({ isLoading, isSignedInAiBlocked, user, hasOpenAI }) {
  if (isLoading) {
    return user && hasOpenAI ? 'Generating questions...' : 'Creating demo room...';
  }

  if (isSignedInAiBlocked) {
    return 'Add AI games to create AI game';
  }

  return user && hasOpenAI ? 'Create AI game' : 'Create demo game';
}

export function getCreateLoadingMessage({ user, hasOpenAI }) {
  return getCreateLoadingMessages({ user, hasOpenAI })[0];
}

export function getCreateLoadingMessages({ user, hasOpenAI }) {
  return user && hasOpenAI
    ? [
        'Generating fresh questions...',
        'Thinking hard to provide a challenge...',
        'Checking the answers make sense...',
        'Almost ready to launch...',
      ]
    : [
        'Preparing your demo room...',
        'Loading built-in questions...',
        'Almost ready to launch...',
      ];
}

function MarketingHome() {
  const stats = [
    ['10-question rounds', 'Balanced pacing that fits short sessions and party play.'],
    ['Reconnect aware', 'Players can refresh and still keep their seat while the server stays alive.'],
    ['Host-led control', 'Only the host launches the game and advances the room.'],
  ];

  return (
    <Shell>
      <HeroCard initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <PanelTitleHeader $hero>
          <Title>Kazoot brings reliable multiplayer quiz nights back to life.</Title>
        </PanelTitleHeader>
        <PanelBody>
          <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Stack gap="18px">
              <Eyebrow>Fast, live, Railway-ready quiz battles</Eyebrow>
              <Subtitle>
                Create a game in seconds, share a direct join link, and keep every round synchronized
                with server-authoritative timing, live scoring, and GPT-5.4 generated question sets.
              </Subtitle>
              <Cluster>
                <StatChip>GPT-5.4 question sets</StatChip>
                <StatChip>Single-room host controls</StatChip>
                <StatChip>Realtime synchronized rounds</StatChip>
              </Cluster>
              <ButtonRow>
                <Button as={Link} to="/create">
                  Host a game
                </Button>
                <Button as={Link} to="/join" variant="secondary">
                  Join by code
                </Button>
              </ButtonRow>
            </Stack>
          </Card>
          <Grid gap="18px" $mobileColumns="1fr" style={{ marginTop: 18 }}>
            {[
              ['Authoritative realtime', 'Server-timed rounds prevent drift, duplicate scoring, and stale timer bugs.'],
              ['Rejoin without chaos', 'Players reconnect with stored tokens instead of losing their seat mid-game.'],
              ['Better AI prompts', 'GPT-5.4 uses structured output plus duplicate filtering to keep sets fresh.'],
            ].map(([headline, copy], index) => (
              <Card key={headline} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div style={{ color: theme.colors.gold, fontSize: '0.82rem', marginBottom: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  0{index + 1}
                </div>
                <SectionTitle style={{ fontSize: '1.15rem', marginBottom: 10 }}>{headline}</SectionTitle>
                <Subtitle>{copy}</Subtitle>
              </Card>
            ))}
          </Grid>
          <Grid
            gap="16px"
            columns="repeat(auto-fit, minmax(220px, 1fr))"
            $mobileColumns="1fr"
            style={{ marginTop: 18 }}
          >
            {stats.map(([headline, copy]) => (
              <Card key={headline} initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: theme.gradients.success }}>
                <SectionTitle style={{ fontSize: '1.02rem', marginBottom: 8 }}>{headline}</SectionTitle>
                <Subtitle>{copy}</Subtitle>
              </Card>
            ))}
          </Grid>
        </PanelBody>
      </HeroCard>
    </Shell>
  );
}

function CreatePage() {
  const navigate = useNavigate();
  const { accessToken, authError, isConfigured, refreshUsage, signIn, usage, user } = useAuth();
  const [hostMode, setHostMode] = useState(null);
  const [username, setUsername] = useState('');
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('English');
  const [questionTimeLimitMs, setQuestionTimeLimitMs] = useState('20000');
  const [revealTiming, setRevealTiming] = useState('timer');
  const [topics, setTopics] = useState([]);
  const [hasOpenAI, setHasOpenAI] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const timerOptions = [
    ['5000', '5 seconds'],
    ['10000', '10 seconds'],
    ['15000', '15 seconds'],
    ['20000', '20 seconds'],
  ];
  const revealTimingOptions = [
    ['timer', 'Wait for timer', 'Keeps suspense and gives everyone the full round.'],
    ['all_answered', 'Reveal when all answer', 'Moves faster when every connected player has locked in.'],
  ];
  const freeRemainingThisMonth = usage?.freeRemainingThisMonth ?? usage?.freeRemainingToday ?? 0;
  const paidCredits = usage?.credits ?? 0;
  const hasAiBalance = freeRemainingThisMonth > 0 || paidCredits > 0;
  const isSignedInAiBlocked = Boolean(hasOpenAI && user && usage && !hasAiBalance);
  const createButtonLabel = getCreateButtonLabel({
    isLoading,
    isSignedInAiBlocked,
    user,
    hasOpenAI,
  });
  const createLoadingMessages = getCreateLoadingMessages({ user, hasOpenAI });
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const createLoadingMessage = createLoadingMessages[loadingMessageIndex % createLoadingMessages.length];
  const shouldShowHostGate = !user && !hostMode;

  useEffect(() => {
    fetchDemoTopics()
      .then((data) => {
        setTopics(data.topics || []);
        setHasOpenAI(Boolean(data.hasOpenAI));
      })
      .catch(() => {
        setTopics([]);
      });
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setLoadingMessageIndex(0);
      return undefined;
    }

    const intervalId = setInterval(() => {
      setLoadingMessageIndex((currentIndex) => currentIndex + 1);
    }, 1800);

    return () => clearInterval(intervalId);
  }, [isLoading]);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const session = await requestCreateSession({
        topic,
        language,
        questionTimeLimitMs: Number(questionTimeLimitMs),
        revealTiming,
      }, accessToken);
      await refreshUsage();
      navigate(`/session/${session.sessionId}`, {
        state: {
          username: username.trim(),
          isCreator: true,
          hostToken: session.hostToken,
        },
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  if (shouldShowHostGate) {
    return (
      <Shell>
        <GlassPanel initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
          <PanelTitleHeader>
            <SectionTitle>Host with AI questions or start a demo room.</SectionTitle>
          </PanelTitleHeader>
          <PanelBody>
            <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 18 }}>
              <Eyebrow>Choose how you want to host</Eyebrow>
              <Subtitle style={{ marginTop: 12 }}>
                Sign in with Google to generate unique GPT-5.4 games and get 3 free AI games per month.
                You can also continue without login and host with built-in demo questions.
              </Subtitle>
              <ButtonRow style={{ marginTop: 18 }}>
                <Button as={Link} to="/" variant="ghost" compact>
                  Back home
                </Button>
              </ButtonRow>
            </Card>

          {authError ? <Banner $tone="danger">{authError}</Banner> : null}

          <Grid gap="18px" columns="repeat(auto-fit, minmax(280px, 1fr))" $mobileColumns="1fr">
            <ChoiceCard $featured initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Stack gap="14px">
                <Eyebrow>Recommended for hosts</Eyebrow>
                <SectionTitle style={{ fontSize: '1.35rem' }}>Generate unique AI games</SectionTitle>
                <Subtitle>
                  Use Google login to unlock GPT-5.4 question generation, track your AI games left, and get 3 free
                  AI games every month before paid AI games are used.
                </Subtitle>
                <Button type="button" disabled={!isConfigured} onClick={signIn} whileTap={{ scale: 0.98 }}>
                  Continue with Google
                </Button>
              </Stack>
            </ChoiceCard>

            <ChoiceCard initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Stack gap="14px">
                <Eyebrow>No login needed</Eyebrow>
                <SectionTitle style={{ fontSize: '1.35rem' }}>Host a demo game</SectionTitle>
                <Subtitle>
                  Start quickly with built-in demo questions. This is great for testing the room flow, but it
                  will not generate fresh AI question sets.
                </Subtitle>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setHostMode('demo')}
                  whileTap={{ scale: 0.98 }}
                >
                  Continue with demo game
                </Button>
              </Stack>
            </ChoiceCard>
          </Grid>
          </PanelBody>
        </GlassPanel>
      </Shell>
    );
  }

  return (
    <Shell>
      <GlassPanel initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <PanelTitleHeader>
          <SectionTitle>Create a new session</SectionTitle>
        </PanelTitleHeader>
        <PanelBody>
        <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 18 }}>
            <Eyebrow>Host a polished game room</Eyebrow>
            <Subtitle style={{ marginTop: 12 }}>
              Pick a topic, choose a language, and Kazoot will prepare a 10-question set with
              stable realtime multiplayer.
            </Subtitle>
          <ButtonRow style={{ marginTop: 18 }}>
            <Button as={Link} to="/" variant="ghost" compact>
              Back home
            </Button>
          </ButtonRow>
        </Card>

        {error ? <Banner $tone="danger">{error}</Banner> : null}
        {authError ? <Banner $tone="danger">{authError}</Banner> : null}

        <form onSubmit={handleSubmit}>
          <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 18, background: user ? theme.gradients.success : theme.gradients.accent }}>
            <HeaderRow style={{ marginBottom: 0 }}>
              <div>
                <Label>{user ? 'AI hosting balance' : 'Demo hosting mode'}</Label>
                <HelperText>
                  {user
                    ? isSignedInAiBlocked
                      ? 'You are out of free AI games and paid AI games left. Subscribe or buy a pack before creating another AI-generated game.'
                      : `${freeRemainingThisMonth} free AI games left this month. ${paidCredits} paid AI games left. Free games are used first.`
                    : 'You are creating a demo room with built-in questions. Sign in if you want unique GPT-5.4 questions and 3 free AI games per month.'}
                </HelperText>
              </div>
              {user ? (
                <ButtonRow>
                  <Button as={Link} to="/account" type="button" variant={isSignedInAiBlocked ? 'primary' : 'secondary'} compact>
                    {isSignedInAiBlocked ? 'Add AI games' : 'Account & AI games'}
                  </Button>
                </ButtonRow>
              ) : (
                <ButtonRow>
                  <Button
                    type="button"
                    variant="secondary"
                    compact
                    disabled={!isConfigured}
                    onClick={signIn}
                    whileTap={{ scale: 0.98 }}
                  >
                    Sign in for AI questions
                  </Button>
                </ButtonRow>
              )}
            </HeaderRow>
          </Card>

          <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <FormGrid columns="repeat(auto-fit, minmax(260px, 1fr))" $mobileColumns="1fr">
              <div>
                <Label htmlFor="host-name">Host name</Label>
                <Input
                  id="host-name"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Martin"
                  disabled={isLoading}
                  required
                />
              </div>
              <div>
                <Label htmlFor="language">Question language</Label>
                <Select
                  id="language"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  disabled={isLoading}
                >
                  <option value="English">English</option>
                  <option value="Estonian">Eesti keel</option>
                </Select>
                <HelperText>
                  {hasOpenAI
                    ? 'GPT-5.4 is available for live question generation.'
                    : 'OpenAI is unavailable, so Kazoot will fall back to demo question banks.'}
                </HelperText>
              </div>
            </FormGrid>

            <div style={{ marginTop: 18 }}>
              <Label htmlFor="topic">Topic</Label>
              <Input
                id="topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Indie games, Formula 1, space history..."
                disabled={isLoading}
                required
              />
            </div>
          </Card>

          <Card
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              marginTop: 18,
              background: theme.gradients.accent,
            }}
          >
            <Label>Question timer</Label>
            <HelperText>
              Choose how long players get to answer each question. Shorter timers feel sharper; 20 seconds is the
              most forgiving default.
            </HelperText>
            <Cluster style={{ marginTop: 14 }}>
              {timerOptions.map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant={questionTimeLimitMs === value ? 'primary' : 'secondary'}
                  compact
                  disabled={isLoading}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setQuestionTimeLimitMs(value)}
                  aria-pressed={questionTimeLimitMs === value}
                  style={{
                    minWidth: 110,
                  }}
                >
                  {label}
                </Button>
              ))}
            </Cluster>
          </Card>

          <Card
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              marginTop: 18,
              background: theme.gradients.success,
            }}
          >
            <Label>Reveal results</Label>
            <HelperText>
              Choose whether rounds resolve as soon as every connected player answers, or always wait for the timer.
            </HelperText>
            <Grid gap="12px" columns="repeat(auto-fit, minmax(220px, 1fr))" $mobileColumns="1fr" style={{ marginTop: 14 }}>
              {revealTimingOptions.map(([value, label, description]) => (
                <Button
                  key={value}
                  type="button"
                  variant={revealTiming === value ? 'primary' : 'secondary'}
                  compact
                  disabled={isLoading}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setRevealTiming(value)}
                  aria-pressed={revealTiming === value}
                  style={{
                    alignItems: 'flex-start',
                    flexDirection: 'column',
                    minHeight: 92,
                    textAlign: 'left',
                  }}
                >
                  <span>{label}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, opacity: 0.74 }}>
                    {description}
                  </span>
                </Button>
              ))}
            </Grid>
          </Card>

          {topics.length ? (
            <Grid
              gap="10px"
              columns="repeat(auto-fit, minmax(150px, 1fr))"
              $mobileColumns="1fr"
              style={{ marginTop: 18 }}
            >
              {topics.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="secondary"
                  compact
                  disabled={isLoading}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setTopic(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </Grid>
          ) : null}

          <Cluster style={{ marginTop: 28 }}>
            <Button
              type="submit"
              disabled={!username.trim() || !topic.trim() || isLoading || isSignedInAiBlocked}
              whileTap={{ scale: 0.98 }}
            >
              {isLoading ? <Spinner aria-hidden="true" /> : null}
              <span style={{ marginLeft: isLoading ? 8 : 0 }}>{createButtonLabel}</span>
            </Button>
            {isSignedInAiBlocked ? (
              <Button as={Link} to="/account" variant="secondary">
                View plans
              </Button>
            ) : null}
            {isLoading ? (
              <HelperText
                aria-live="polite"
                style={{
                  alignSelf: 'center',
                  flex: '1 1 220px',
                  margin: 0,
                  minHeight: 24,
                  overflow: 'hidden',
                }}
              >
                <motion.span
                  key={createLoadingMessage}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22 }}
                  style={{ display: 'inline-block' }}
                >
                  {createLoadingMessage}
                </motion.span>
              </HelperText>
            ) : null}
          </Cluster>
        </form>
        </PanelBody>
      </GlassPanel>
    </Shell>
  );
}

function JoinPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const initialCode = params.get('code') || '';
  const [username, setUsername] = useState('');
  const [sessionId, setSessionId] = useState(initialCode.toUpperCase().slice(0, 8));

  function handleSubmit(event) {
    event.preventDefault();
    navigate(`/session/${sessionId.toUpperCase()}`, {
      state: {
        username: username.trim(),
        isCreator: false,
      },
    });
  }

  return (
    <Shell>
      <GlassPanel initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <PanelTitleHeader>
          <SectionTitle>Join a live session</SectionTitle>
        </PanelTitleHeader>
        <PanelBody>
        <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 18 }}>
            <Eyebrow>Jump straight into a room</Eyebrow>
            <Subtitle style={{ marginTop: 12 }}>
              Enter your name and the room code, or open a direct session link from your
              host to reconnect automatically.
            </Subtitle>
          <ButtonRow style={{ marginTop: 18 }}>
            <Button as={Link} to="/" variant="ghost" compact>
              Back home
            </Button>
          </ButtonRow>
        </Card>

        <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <form onSubmit={handleSubmit}>
          <FormGrid columns="repeat(auto-fit, minmax(260px, 1fr))" $mobileColumns="1fr">
            <div>
              <Label htmlFor="join-name">Player name</Label>
              <Input
                id="join-name"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Quiz wizard"
                required
              />
            </div>
            <div>
              <Label htmlFor="join-code">Session code</Label>
              <Input
                id="join-code"
                value={sessionId}
                onChange={(event) =>
                  setSessionId(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))
                }
                placeholder="ABCD1234"
                required
              />
            </div>
          </FormGrid>

          <Cluster style={{ marginTop: 28 }}>
            <Button
              type="submit"
              disabled={!username.trim() || ![6, 8].includes(sessionId.trim().length)}
              whileTap={{ scale: 0.98 }}
            >
              Join session
            </Button>
          </Cluster>
        </form>
        </Card>
        </PanelBody>
      </GlassPanel>
    </Shell>
  );
}

function SessionHeader({ session, connectionStatus }) {
  const stageLabel = session.gameState === 'waiting'
    ? 'Lobby open'
    : session.gameState === 'question'
      ? 'Question live'
      : session.gameState === 'results'
        ? 'Results'
        : 'Finished';

  return (
    <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <HeaderRow style={{ marginBottom: 0 }}>
        <div>
          <Eyebrow>
            Room {session.sessionId}
            <span aria-hidden="true">•</span>
            {session.questionSource === 'openai' ? 'GPT-5.4 set' : 'Demo fallback'}
          </Eyebrow>
          <div style={{ marginTop: 14 }}>
            <SectionTitle>{session.topic}</SectionTitle>
            <Subtitle>{session.language} questions, 10 rounds, live server-authoritative scoring.</Subtitle>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          }}
        >
          <StatChip>{session.connectedPlayerCount} connected</StatChip>
          <StatChip>{stageLabel}</StatChip>
          <Pill $tone={connectionStatus === 'connected' ? 'success' : 'warning'}>
            {connectionStatus === 'connected' ? 'Live connection' : 'Reconnecting...'}
          </Pill>
          {session.you?.isHost ? (
            <Pill $tone="success">
              {session.you?.hostAuthority === 'temporary' || session.you?.isTemporaryHost
                ? 'You are temporary host'
                : 'You are host'}
            </Pill>
          ) : null}
        </div>
      </HeaderRow>
    </Card>
  );
}

function GameplayTopBar({ session, connectionStatus, questionNumber, totalQuestions }) {
  return (
    <Card
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: '14px 16px',
      }}
    >
      <HeaderRow style={{ marginBottom: 0, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Eyebrow>Room {session.sessionId}</Eyebrow>
          <StatChip>
            Question {questionNumber} of {totalQuestions}
          </StatChip>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Pill $tone={getConnectionTone(connectionStatus)}>
            {connectionStatus === 'connected' ? 'Live connection' : 'Reconnecting...'}
          </Pill>
        </div>
      </HeaderRow>
    </Card>
  );
}

function LobbyView({ session, onStartGame, onLeave, onForgetAndRetry }) {
  const shareLink = `${window.location.origin}/session/${session.sessionId}`;
  const canStart = session.you?.isHost;
  const roundTimerLabel = `${Math.round(session.questionTimeLimitMs / 1000)}s timer`;
  const revealTimingLabel = getRevealTimingLabel(session.revealTiming);

  async function copyLink() {
    await navigator.clipboard.writeText(shareLink);
  }

  return (
    <Grid columns="1.3fr 1fr" $mobileColumns="1fr">
      <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <SectionTitle>Lobby</SectionTitle>
        <Subtitle style={{ marginTop: 8 }}>
          Share the code or link, wait for everyone to connect, then launch the first question when
          you are ready.
        </Subtitle>

        <Grid gap="12px" $mobileColumns="1fr" style={{ marginTop: 20 }}>
          <StatChip>Code: {session.sessionId}</StatChip>
          <StatChip>Questions: {session.questionCount}</StatChip>
          <StatChip>{roundTimerLabel}</StatChip>
          <StatChip>{revealTimingLabel}</StatChip>
        </Grid>

        <Grid gap="18px" columns="minmax(0, 1fr) auto" $mobileColumns="1fr" style={{ marginTop: 18, alignItems: 'end' }}>
          <div>
            <Label htmlFor="share-link">Direct join link</Label>
            <Input id="share-link" value={shareLink} readOnly onFocus={(event) => event.target.select()} />
            <HelperText style={{ marginTop: 8 }}>
              Share this link or let friends scan the QR code to join on their own phones.
            </HelperText>
          </div>
          <Stack gap="10px" style={{ alignItems: 'center' }}>
            <Label as="div" style={{ marginBottom: 0 }}>
              Scan to join
            </Label>
            <div
              aria-label={`QR code for joining room ${session.sessionId}`}
              role="img"
              style={{
                padding: 14,
                borderRadius: 18,
                background: '#ffffff',
                boxShadow: '0 18px 36px rgba(2, 6, 23, 0.28)',
              }}
            >
              <QRCodeSVG value={shareLink} size={196} bgColor="#ffffff" fgColor="#0f172a" level="M" />
            </div>
            <HelperText style={{ maxWidth: 220, textAlign: 'center' }}>
              Bright screen and steady phone make scanning easier.
            </HelperText>
          </Stack>
        </Grid>

        <ButtonRow style={{ marginTop: 16 }}>
          <Button type="button" variant="secondary" compact onClick={copyLink} whileTap={{ scale: 0.98 }}>
            Copy link
          </Button>
          {session.you?.isHost ? (
            <Button
              type="button"
              onClick={onStartGame}
              disabled={!canStart}
              whileTap={{ scale: canStart ? 0.98 : 1 }}
            >
              Start live game
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onLeave} whileTap={{ scale: 0.98 }}>
            Leave
          </Button>
        </ButtonRow>
        <div style={{ marginTop: 12 }}>
          <MobileOnlyHint>
            {session.you?.isHost
              ? canStart
                ? session.you?.hostAuthority === 'temporary' || session.you?.isTemporaryHost
                  ? 'The host is offline, so you can keep the room moving until they return.'
                  : 'Only the host can start the game. You can kick off immediately or wait for more players to join.'
                : 'Only the host can start the game.'
              : 'Only the host can start the game. You will move into the quiz as soon as the host begins.'}
          </MobileOnlyHint>
        </div>
      </Card>

      <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <SectionTitle>Players</SectionTitle>
        <Grid gap="12px" $mobileColumns="1fr" style={{ marginTop: 18 }}>
          {session.players.map((player) => (
            <Card
              key={player.playerId}
              style={{
                padding: 16,
                background: player.isHost ? theme.gradients.accent : undefined,
              }}
            >
              <HeaderRow style={{ marginBottom: 0 }}>
                <div>
                  <strong>{player.username}</strong>
                  <HelperText>{getHostAuthorityLabel(player)}</HelperText>
                </div>
                <Pill $tone={player.connected ? 'success' : 'warning'}>
                  {player.connected ? 'Connected' : 'Offline'}
                </Pill>
              </HeaderRow>
            </Card>
          ))}
        </Grid>
        <ButtonRow style={{ marginTop: 16 }}>
          <Button type="button" variant="secondary" compact onClick={onForgetAndRetry} whileTap={{ scale: 0.98 }}>
            Join as a different player
          </Button>
        </ButtonRow>
      </Card>
    </Grid>
  );
}

function useSyncedCountdown(question) {
  const [remainingMs, setRemainingMs] = useState(() => {
    return getRemainingQuestionMs(question);
  });

  useEffect(() => {
    if (!question) {
      setRemainingMs(0);
      return;
    }

    const tick = () => {
      setRemainingMs(getRemainingQuestionMs(question));
    };

    tick();
    const intervalId = setInterval(tick, 250);
    return () => clearInterval(intervalId);
  }, [question?.questionEndsAt, question?.serverTime, question?.clientReceivedAt]);

  return remainingMs;
}

function QuestionView({ question, revealTiming, onSubmitAnswer, onResyncSession, connectionStatus }) {
  const remainingMs = useSyncedCountdown(question);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const progress = question ? Math.max(0, Math.min(1, remainingMs / question.timeLimit)) : 0;
  const countdownBarColor = getCountdownBarColor(question, remainingMs);
  const hasSubmitted = hasAnswerSelection(question?.submittedAnswerIndex);
  const hasPendingSubmission = hasAnswerSelection(question?.pendingAnswerIndex);
  const locked = hasSubmitted || hasPendingSubmission || remainingMs === 0;

  const options = useMemo(
    () => [
      ['A', theme.colors.optionA],
      ['B', theme.colors.optionB],
      ['C', theme.colors.optionC],
      ['D', theme.colors.optionD],
    ],
    []
  );

  useEffect(() => {
    if (
      !shouldAttemptQuestionResync({
        remainingMs,
        connectionStatus,
        hasResyncHandler: Boolean(onResyncSession),
      })
    ) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      onResyncSession();
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [connectionStatus, onResyncSession, remainingMs]);

  return (
    <Card
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: '18px',
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <SectionTitle style={{ fontSize: 'clamp(1.45rem, 4vw, 2.5rem)', lineHeight: 1.08 }}>
          {question.question}
        </SectionTitle>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: '1.1rem',
            textAlign: 'right',
            marginBottom: 8,
          }}
        >
          {remainingSeconds}s
        </div>
        <div style={{ minWidth: 0, width: '100%' }}>
          <div
            aria-hidden="true"
            style={{
              height: 8,
              borderRadius: 999,
              overflow: 'hidden',
              background: 'rgba(148, 163, 184, 0.16)',
            }}
          >
            <motion.div
              style={{
                height: '100%',
                borderRadius: 999,
                background: countdownBarColor,
              }}
              animate={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>

      <Grid gap="12px" columns="repeat(2, minmax(0, 1fr))" $mobileColumns="1fr">
        {question.choices.map((choice, index) => {
          const isChosen = question.submittedAnswerIndex === index || question.pendingAnswerIndex === index;
          const shouldDimOption = locked && !isChosen;
          const selectionLabel = question.submittedAnswerIndex === index
            ? '✓'
            : question.pendingAnswerIndex === index
              ? 'Sending...'
              : null;
          return (
            <AnswerButton
              key={`${choice}-${index}`}
              type="button"
              disabled={locked}
              whileTap={{ scale: locked ? 1 : 0.98 }}
              onClick={() => onSubmitAnswer(index)}
              style={{
                background: isChosen ? `${options[index][1]}` : `${options[index][1]}bf`,
                fontSize: '0.96rem',
                border: isChosen ? '2px solid rgba(255, 255, 255, 0.55)' : '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: isChosen ? '0 0 0 2px rgba(255, 255, 255, 0.08)' : 'none',
                opacity: shouldDimOption ? 0.42 : 1,
                filter: shouldDimOption ? 'saturate(0.65) brightness(0.75)' : 'none',
              }}
            >
              <AnswerLetter>{options[index][0]}</AnswerLetter>
              <AnswerText>{choice}</AnswerText>
              {selectionLabel ? (
                <span
                  style={{
                    flex: '0 0 auto',
                    minWidth: selectionLabel === '✓' ? 28 : 'auto',
                    height: selectionLabel === '✓' ? 28 : 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: selectionLabel === '✓' ? '0' : '0',
                    borderRadius: selectionLabel === '✓' ? 999 : 0,
                    background: selectionLabel === '✓' ? 'rgba(255, 255, 255, 0.18)' : 'transparent',
                    fontSize: selectionLabel === '✓' ? '1rem' : '0.82rem',
                    fontWeight: 700,
                    opacity: 0.98,
                  }}
                >
                  {selectionLabel}
                </span>
              ) : null}
            </AnswerButton>
          );
        })}
      </Grid>

      {hasSubmitted || hasPendingSubmission ? (
        <Banner style={{ marginTop: 14, marginBottom: 0 }}>
          {hasSubmitted ? getSubmittedAnswerMessage(revealTiming) : 'Sending your answer...'}
        </Banner>
      ) : remainingMs === 0 ? (
        <Banner style={{ marginTop: 14, marginBottom: 0 }}>
          Time is up. Waiting for the round result from the server.
        </Banner>
      ) : null}
    </Card>
  );
}

function ResultsView({ results, session, onNextQuestion }) {
  const totalAnswers = results.answerStats.reduce((sum, count) => sum + count, 0);

  return (
    <Grid columns="1.15fr 0.85fr" $mobileColumns="1fr">
      <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Eyebrow>Round recap</Eyebrow>
        <div style={{ marginTop: 16 }}>
          <SectionTitle>
            Correct answer: {String.fromCharCode(65 + results.correctAnswer)}. {results.correctAnswerText}
          </SectionTitle>
        </div>
        {typeof results.playerAnswer === 'number' ? (
          <Banner $tone={results.answerWasCorrect ? 'success' : undefined} style={{ marginTop: 16 }}>
            {results.answerWasCorrect ? 'You got it right.' : 'Your answer is highlighted below.'}
            {' '}
            {typeof results.earnedPoints === 'number' ? `+${results.earnedPoints} pts this round.` : null}
          </Banner>
        ) : (
          <Banner style={{ marginTop: 16 }}>You did not lock in an answer before time ran out.</Banner>
        )}

        <Grid gap="12px" $mobileColumns="1fr" style={{ marginTop: 20 }}>
          {results.answerStats.map((count, index) => {
            const isCorrect = index === results.correctAnswer;
            const playerChoice = results.playerAnswer === index;
            const optionTone = isCorrect ? 'success' : playerChoice ? 'warning' : undefined;
            const optionLabel = isCorrect && playerChoice
              ? 'Correct answer • Your pick'
              : isCorrect
                ? 'Correct answer'
                : playerChoice
                  ? 'Your pick'
                  : `${count} picks`;
            return (
              <ResultOptionCard
                key={index}
                style={{
                  borderColor: isCorrect
                    ? 'rgba(34, 197, 94, 0.4)'
                    : playerChoice
                      ? 'rgba(245, 158, 11, 0.35)'
                      : undefined,
                }}
              >
                <Stack gap="10px">
                  <strong style={{ lineHeight: 1.35 }}>
                    {String.fromCharCode(65 + index)}. {results.allChoices[index]}
                  </strong>
                  <Pill $tone={optionTone}>
                    {optionLabel}
                  </Pill>
                  <Subtitle>
                    {totalAnswers ? Math.round((count / totalAnswers) * 100) : 0}% of players selected this
                    option.
                  </Subtitle>
                </Stack>
              </ResultOptionCard>
            );
          })}
        </Grid>

        <ButtonRow style={{ marginTop: 20 }}>
          {session.you?.isHost ? (
            <Button type="button" onClick={onNextQuestion} whileTap={{ scale: 0.98 }}>
              {results.isLastQuestion ? 'View final standings' : 'Next question'}
            </Button>
          ) : (
            <Banner>Waiting for the host to continue.</Banner>
          )}
        </ButtonRow>
      </Card>

      <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <SectionTitle>Leaderboard</SectionTitle>
        <Grid gap="12px" $mobileColumns="1fr" style={{ marginTop: 18 }}>
          {results.leaderboard.map((player) => (
            <Card key={player.playerId} style={{ padding: 16 }}>
              <HeaderRow style={{ marginBottom: 0 }}>
                <div>
                  <strong>
                    #{player.rank} {player.username}
                  </strong>
                  <HelperText>{getHostAuthorityLabel(player)}</HelperText>
                </div>
                <strong>{player.score.toLocaleString()} pts</strong>
              </HeaderRow>
            </Card>
          ))}
        </Grid>
      </Card>
    </Grid>
  );
}

function GameEndView({ leaderboard, onLeave }) {
  const podium = leaderboard.slice(0, 3);
  const everyoneElse = leaderboard.slice(3);

  return (
    <Grid gap="18px">
      <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Eyebrow>Game complete</Eyebrow>
        <div style={{ marginTop: 16 }}>
          <SectionTitle>Final standings</SectionTitle>
          <Subtitle>Multiplayer round-tripping complete. Everyone saw the same results and final scores.</Subtitle>
        </div>

        <Grid
          gap="14px"
          columns="repeat(auto-fit, minmax(220px, 1fr))"
          $mobileColumns="1fr"
          style={{ marginTop: 22 }}
        >
          {podium.map((player) => (
            <Card key={player.playerId} style={{ padding: 22 }}>
              <strong style={{ fontSize: '1.25rem' }}>
                #{player.rank} {player.username}
              </strong>
              <div style={{ marginTop: 8, color: theme.colors.textMuted }}>{player.score.toLocaleString()} pts</div>
            </Card>
          ))}
        </Grid>

        {everyoneElse.length ? (
          <Grid gap="12px" $mobileColumns="1fr" style={{ marginTop: 18 }}>
            {everyoneElse.map((player) => (
              <Card key={player.playerId} style={{ padding: 16 }}>
                <HeaderRow style={{ marginBottom: 0 }}>
                  <strong>
                    #{player.rank} {player.username}
                  </strong>
                  <strong>{player.score.toLocaleString()} pts</strong>
                </HeaderRow>
              </Card>
            ))}
          </Grid>
        ) : null}

        <ButtonRow style={{ marginTop: 24 }}>
          <Button as={Link} to="/create">
            Host another game
          </Button>
          <Button type="button" variant="secondary" onClick={onLeave} whileTap={{ scale: 0.98 }}>
            Back home
          </Button>
        </ButtonRow>
      </Card>
    </Grid>
  );
}

function JoinSessionCard({ sessionId, defaultUsername, savedSession, onJoin }) {
  const [username, setUsername] = useState(defaultUsername || '');

  return (
    <GlassPanel initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <PanelTitleHeader>
        <SectionTitle>Join room {sessionId}</SectionTitle>
      </PanelTitleHeader>
      <PanelBody>
        <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Stack style={{ alignItems: 'center', textAlign: 'center' }}>
            <Eyebrow>Player invite</Eyebrow>
            <Subtitle>
              Your host has already created this game. Enter the name you want shown on the scoreboard,
              then join the lobby.
            </Subtitle>
          </Stack>
          {savedSession?.username ? (
            <Card
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ width: 'min(420px, 100%)', margin: '24px auto 0', textAlign: 'center' }}
            >
              <Stack gap="12px" style={{ alignItems: 'center' }}>
                <Eyebrow>Saved seat found</Eyebrow>
                <Subtitle style={{ margin: 0 }}>
                  Reconnect to this room as {savedSession.username}, or join as someone else below.
                </Subtitle>
                <Button type="button" compact onClick={() => onJoin(savedSession.username, false)}>
                  Reconnect as {savedSession.username}
                </Button>
              </Stack>
            </Card>
          ) : null}
          <form
            style={{ width: 'min(420px, 100%)', margin: '24px auto 0', textAlign: 'left' }}
            onSubmit={(event) => {
              event.preventDefault();
              onJoin(username, true);
            }}
          >
            <Label htmlFor="session-player-name">Player name</Label>
            <Input
              id="session-player-name"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Player name"
              required
            />
            <Cluster justify="center" style={{ marginTop: 18 }}>
              <Button type="submit" disabled={!username.trim()} whileTap={{ scale: 0.98 }}>
                Join room
              </Button>
            </Cluster>
          </form>
        </Card>
      </PanelBody>
    </GlassPanel>
  );
}

function JoiningSessionCard({ sessionId }) {
  return (
    <EmptyState initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <SectionTitle>Joining room {sessionId}</SectionTitle>
      <Subtitle style={{ marginTop: 8 }}>
        Syncing your seat and loading the live room state.
      </Subtitle>
      <Banner style={{ marginTop: 20, marginBottom: 0 }}>Loading the lobby...</Banner>
    </EmptyState>
  );
}

function SessionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId = '' } = useParams();
  const normalizedSessionId = sessionId.toUpperCase();
  const sessionState = location.state || {};
  const savedSession = useMemo(() => loadPlayerSession(normalizedSessionId), [normalizedSessionId]);
  const joinAttemptedRef = useRef(false);
  const {
    clearError,
    connectionStatus,
    error,
    gameEnd,
    joinSession,
    leaveSession,
    nextQuestion,
    notice,
    question,
    resyncSession,
    results,
    session,
    startGame,
    submitAnswer,
  } = useGame();

  useEffect(() => {
    if (session && session.sessionId !== normalizedSessionId) {
      leaveSession(session.sessionId);
      joinAttemptedRef.current = false;
    }
  }, [leaveSession, normalizedSessionId, session]);

  useEffect(() => {
    if (session?.sessionId === normalizedSessionId || joinAttemptedRef.current) {
      return;
    }

    const username = sessionState.username;
    if (!username) {
      return;
    }

    joinAttemptedRef.current = true;
    joinSession({
      sessionId: normalizedSessionId,
      username,
      isCreator: Boolean(sessionState.isCreator),
      hostToken: sessionState.hostToken || null,
      forceFresh:
        Boolean(savedSession?.username) &&
        savedSession.username.trim().toLowerCase() !== String(username).trim().toLowerCase(),
    });
  }, [joinSession, normalizedSessionId, savedSession?.username, session?.sessionId, sessionState.hostToken, sessionState.isCreator, sessionState.username]);

  function handleManualJoin(username, forceFresh = false) {
    clearError();
    joinAttemptedRef.current = true;
    joinSession({
      sessionId: normalizedSessionId,
      username,
      isCreator: false,
      forceFresh,
    });
  }

  function handleGoHome() {
    leaveSession(normalizedSessionId);
    navigate('/');
  }

  function handleJoinAsDifferentPlayer() {
    leaveSession(normalizedSessionId, { forgetPlayer: true });
    joinAttemptedRef.current = false;
  }

  const activeSession = session?.sessionId === normalizedSessionId ? session : null;
  const hasKnownUsername = Boolean(sessionState.username);
  const showJoinLoading = shouldShowSessionJoinLoading({
    activeSession,
    joinAttempted: joinAttemptedRef.current,
    hasKnownUsername,
    error,
  });
  const phase = getSessionPhase({
    activeSession,
    question,
    results,
    gameEnd,
  });
  const showLobbyShell = phase === 'waiting';
  const showGameplayShell = phase === 'question';
  const showResultsShell = phase === 'results';
  const showGameEndShell = phase === 'ended';

  return (
    <Shell
      dense={Boolean(activeSession && !showLobbyShell)}
      accountBarMode={!activeSession ? 'join' : 'default'}
    >
      <Grid gap="16px" columns="1fr" $mobileColumns="1fr">
        {notice ? <Banner>{notice}</Banner> : null}
        {error ? <Banner $tone="danger">{error}</Banner> : null}

        {activeSession ? (
          <>
            {showLobbyShell ? (
              <SessionHeader session={activeSession} connectionStatus={connectionStatus} />
            ) : null}

            {showGameplayShell ? (
              <GameplayTopBar
                session={activeSession}
                connectionStatus={connectionStatus}
                questionNumber={question.questionNumber}
                totalQuestions={question.totalQuestions}
              />
            ) : null}

            {showLobbyShell ? (
              <LobbyView
                session={activeSession}
                onStartGame={startGame}
                onLeave={handleGoHome}
                onForgetAndRetry={handleJoinAsDifferentPlayer}
              />
            ) : null}

            {showGameplayShell ? (
              <QuestionView
                question={question}
                revealTiming={activeSession.revealTiming || question.revealTiming}
                onSubmitAnswer={submitAnswer}
                onResyncSession={resyncSession}
                connectionStatus={connectionStatus}
              />
            ) : null}
            {showResultsShell ? (
              <ResultsView results={results} session={activeSession} onNextQuestion={nextQuestion} />
            ) : null}
            {showGameEndShell ? (
              <GameEndView leaderboard={gameEnd.leaderboard} onLeave={handleGoHome} />
            ) : null}
          </>
        ) : showJoinLoading ? (
          <JoiningSessionCard sessionId={normalizedSessionId} />
        ) : (
          <JoinSessionCard
            sessionId={normalizedSessionId}
            defaultUsername={sessionState.username || ''}
            savedSession={savedSession}
            onJoin={handleManualJoin}
          />
        )}
      </Grid>
    </Shell>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MarketingHome />} />
      <Route path="/create" element={<CreatePage />} />
      <Route
        path="/account"
        element={
          <Suspense
            fallback={
              <Shell>
                <GlassPanel>
                  <PanelTitleHeader>
                    <SectionTitle>Loading account</SectionTitle>
                  </PanelTitleHeader>
                  <PanelBody>
                    <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <Subtitle>Preparing your account and AI games left...</Subtitle>
                    </Card>
                  </PanelBody>
                </GlassPanel>
              </Shell>
            }
          >
            <AccountPage />
          </Suspense>
        }
      />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/session/:sessionId" element={<SessionPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <AuthProvider>
        <GameProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </GameProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
