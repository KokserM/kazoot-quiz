import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
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
  CenteredContent,
  EmptyState,
  Eyebrow,
  GlassPanel,
  Grid,
  HeaderRow,
  HelperText,
  HeroCard,
  Input,
  Label,
  PageShell,
  Pill,
  SectionTitle,
  Select,
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

function MarketingHome() {
  const stats = [
    ['10-question rounds', 'Balanced pacing that fits short sessions and party play.'],
    ['Reconnect aware', 'Players can refresh and still keep their seat while the server stays alive.'],
    ['Host-led control', 'Only the host launches the game and advances the room.'],
  ];

  return (
    <Shell>
      <HeroCard initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <Eyebrow>Fast, live, Railway-ready quiz battles</Eyebrow>
        <div style={{ marginTop: 20 }}>
          <Title>Kazoot brings reliable multiplayer quiz nights back to life.</Title>
          <Subtitle>
            Create a game in seconds, share a direct join link, and keep every round synchronized
            with server-authoritative timing, live scoring, and GPT-5.4 generated question sets.
          </Subtitle>
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            marginTop: 18,
          }}
        >
          <StatChip>GPT-5.4 question sets</StatChip>
          <StatChip>Single-room host controls</StatChip>
          <StatChip>Realtime synchronized rounds</StatChip>
        </div>
        <ButtonRow style={{ marginTop: 28 }}>
          <Button as={Link} to="/create">
            Host a game
          </Button>
          <Button as={Link} to="/join" variant="secondary">
            Join by code
          </Button>
        </ButtonRow>
        <Grid gap="18px" $mobileColumns="1fr" style={{ marginTop: 34 }}>
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
  const freeRemainingToday = usage?.freeRemainingToday ?? 0;
  const paidCredits = usage?.credits ?? 0;
  const hasAiBalance = freeRemainingToday > 0 || paidCredits > 0;
  const isSignedInAiBlocked = Boolean(hasOpenAI && user && usage && !hasAiBalance);
  const createButtonLabel = isLoading
    ? 'Creating session...'
    : isSignedInAiBlocked
      ? 'Add credits to create AI game'
      : user && hasOpenAI
        ? 'Create AI game'
        : 'Create demo game';
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
        <GlassPanel initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} style={{ padding: 32 }}>
          <HeaderRow>
            <div>
              <Eyebrow>Choose how you want to host</Eyebrow>
              <div style={{ marginTop: 16 }}>
                <SectionTitle>Host with AI questions or start a demo room.</SectionTitle>
                <Subtitle>
                  Sign in with Google to generate unique GPT-5.4 games and get 3 free AI games per day.
                  You can also continue without login and host with built-in demo questions.
                </Subtitle>
              </div>
            </div>
            <Button as={Link} to="/" variant="ghost" compact>
              Back home
            </Button>
          </HeaderRow>

          {authError ? <Banner $tone="danger">{authError}</Banner> : null}

          <Grid gap="18px" columns="repeat(auto-fit, minmax(260px, 1fr))" $mobileColumns="1fr">
            <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: theme.gradients.success }}>
              <Eyebrow>Recommended for hosts</Eyebrow>
              <SectionTitle style={{ fontSize: '1.35rem', marginTop: 14 }}>Generate unique AI games</SectionTitle>
              <Subtitle style={{ marginTop: 10 }}>
                Use Google login to unlock GPT-5.4 question generation, track your credits, and get 3 free
                AI games every day before paid credits are used.
              </Subtitle>
              <ButtonRow style={{ marginTop: 18 }}>
                <Button type="button" disabled={!isConfigured} onClick={signIn} whileTap={{ scale: 0.98 }}>
                  Continue with Google
                </Button>
              </ButtonRow>
            </Card>

            <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Eyebrow>No login needed</Eyebrow>
              <SectionTitle style={{ fontSize: '1.35rem', marginTop: 14 }}>Host a demo game</SectionTitle>
              <Subtitle style={{ marginTop: 10 }}>
                Start quickly with built-in demo questions. This is great for testing the room flow, but it
                will not generate fresh AI question sets.
              </Subtitle>
              <ButtonRow style={{ marginTop: 18 }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setHostMode('demo')}
                  whileTap={{ scale: 0.98 }}
                >
                  Continue with demo game
                </Button>
              </ButtonRow>
            </Card>
          </Grid>
        </GlassPanel>
      </Shell>
    );
  }

  return (
    <Shell>
      <GlassPanel initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} style={{ padding: 32 }}>
        <HeaderRow>
          <div>
            <Eyebrow>Host a polished game room</Eyebrow>
            <div style={{ marginTop: 16 }}>
              <SectionTitle>Create a new session</SectionTitle>
              <Subtitle>
                Pick a topic, choose a language, and Kazoot will prepare a 10-question set with
                stable realtime multiplayer.
              </Subtitle>
            </div>
          </div>
          <Button as={Link} to="/" variant="ghost" compact>
            Back home
          </Button>
        </HeaderRow>

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
                      ? 'You are out of free AI games and paid credits. Add credits or subscribe before creating another AI-generated game.'
                      : `${freeRemainingToday} free AI games left today. ${paidCredits} paid credits available. Free games are used before paid credits.`
                    : 'You are creating a demo room with built-in questions. Sign in if you want unique GPT-5.4 questions and 3 free AI games per day.'}
                </HelperText>
              </div>
              {user ? (
                <ButtonRow>
                  <Button as={Link} to="/account" type="button" variant={isSignedInAiBlocked ? 'primary' : 'secondary'} compact>
                    {isSignedInAiBlocked ? 'Add credits' : 'Account & credits'}
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

          <Grid columns="repeat(auto-fit, minmax(260px, 1fr))" $mobileColumns="1fr">
            <div>
              <Label htmlFor="host-name">Host name</Label>
              <Input
                id="host-name"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Martin"
                required
              />
            </div>
            <div>
              <Label htmlFor="language">Question language</Label>
              <Select
                id="language"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
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
          </Grid>

          <div style={{ marginTop: 18 }}>
            <Label htmlFor="topic">Topic</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Indie games, Formula 1, space history..."
              required
            />
          </div>

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
            <ButtonRow style={{ marginTop: 14 }}>
              {timerOptions.map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant={questionTimeLimitMs === value ? 'primary' : 'secondary'}
                  compact
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
            </ButtonRow>
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
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setTopic(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </Grid>
          ) : null}

          <ButtonRow style={{ marginTop: 28 }}>
            <Button
              type="submit"
              disabled={!username.trim() || !topic.trim() || isLoading || isSignedInAiBlocked}
              whileTap={{ scale: 0.98 }}
            >
              {createButtonLabel}
            </Button>
            {isSignedInAiBlocked ? (
              <Button as={Link} to="/account" variant="secondary">
                View plans
              </Button>
            ) : null}
          </ButtonRow>
        </form>
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
      <GlassPanel initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} style={{ padding: 32 }}>
        <HeaderRow>
          <div>
            <Eyebrow>Jump straight into a room</Eyebrow>
            <div style={{ marginTop: 16 }}>
              <SectionTitle>Join a live session</SectionTitle>
              <Subtitle>
                Enter your name and the room code, or open a direct session link from your
                host to reconnect automatically.
              </Subtitle>
            </div>
          </div>
          <Button as={Link} to="/" variant="ghost" compact>
            Back home
          </Button>
        </HeaderRow>

        <form onSubmit={handleSubmit}>
          <Grid columns="repeat(auto-fit, minmax(260px, 1fr))" $mobileColumns="1fr">
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
          </Grid>

          <ButtonRow style={{ marginTop: 28 }}>
            <Button
              type="submit"
              disabled={!username.trim() || ![6, 8].includes(sessionId.trim().length)}
              whileTap={{ scale: 0.98 }}
            >
              Join session
            </Button>
          </ButtonRow>
        </form>
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
          {session.you?.isHost ? <Pill $tone="success">You are host</Pill> : null}
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

        <div style={{ marginTop: 18 }}>
          <Label htmlFor="share-link">Direct join link</Label>
          <Input id="share-link" value={shareLink} readOnly onFocus={(event) => event.target.select()} />
        </div>

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
                ? 'Only the host can start the game. You can kick off immediately or wait for more players to join.'
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
                  <HelperText>{player.isHost ? 'Host' : 'Player'}</HelperText>
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
            <Button
              key={`${choice}-${index}`}
              type="button"
              disabled={locked}
              whileTap={{ scale: locked ? 1 : 0.98 }}
              onClick={() => onSubmitAnswer(index)}
              style={{
                justifyContent: 'flex-start',
                borderRadius: theme.radii.md,
                padding: '16px',
                minHeight: 76,
                background: isChosen ? `${options[index][1]}` : `${options[index][1]}bf`,
                fontSize: '0.96rem',
                border: isChosen ? '2px solid rgba(255, 255, 255, 0.55)' : '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: isChosen ? '0 0 0 2px rgba(255, 255, 255, 0.08)' : 'none',
                opacity: shouldDimOption ? 0.42 : 1,
                filter: shouldDimOption ? 'saturate(0.65) brightness(0.75)' : 'none',
              }}
            >
              <span style={{ marginRight: 10, opacity: 0.9, fontWeight: 800 }}>{options[index][0]}</span>
              <span style={{ textAlign: 'left', flex: 1 }}>{choice}</span>
              {selectionLabel ? (
                <span
                  style={{
                    marginLeft: 10,
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
            </Button>
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
              <Card
                key={index}
                style={{
                  padding: 18,
                  borderColor: isCorrect
                    ? 'rgba(34, 197, 94, 0.4)'
                    : playerChoice
                      ? 'rgba(245, 158, 11, 0.35)'
                      : undefined,
                }}
              >
                <HeaderRow style={{ marginBottom: 10 }}>
                  <strong>
                    {String.fromCharCode(65 + index)}. {results.allChoices[index]}
                  </strong>
                  <Pill $tone={optionTone}>
                    {optionLabel}
                  </Pill>
                </HeaderRow>
                <Subtitle>
                  {totalAnswers ? Math.round((count / totalAnswers) * 100) : 0}% of players selected this
                  option.
                </Subtitle>
              </Card>
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
                  <HelperText>{player.isHost ? 'Host' : 'Player'}</HelperText>
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

function JoinSessionCard({ sessionId, defaultUsername, onJoin }) {
  const [username, setUsername] = useState(defaultUsername || '');

  return (
    <EmptyState initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <Eyebrow>Player invite</Eyebrow>
      <SectionTitle>Join room {sessionId}</SectionTitle>
      <Subtitle style={{ marginTop: 8 }}>
        Your host has already created this game. Enter the name you want shown on the scoreboard,
        then join the lobby.
      </Subtitle>
      <form
        style={{ width: '100%', maxWidth: 420, margin: '24px auto 0', textAlign: 'left' }}
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
        <ButtonRow style={{ justifyContent: 'center', marginTop: 18 }}>
          <Button type="submit" disabled={!username.trim()} whileTap={{ scale: 0.98 }}>
            Join room
          </Button>
        </ButtonRow>
      </form>
    </EmptyState>
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

    const username = sessionState.username || savedSession?.username;
    if (!username) {
      return;
    }

    joinAttemptedRef.current = true;
    joinSession({
      sessionId: normalizedSessionId,
      username,
      isCreator: Boolean(sessionState.isCreator),
    });
  }, [joinSession, normalizedSessionId, savedSession?.username, session?.sessionId, sessionState.isCreator, sessionState.username]);

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
  const hasKnownUsername = Boolean(sessionState.username || savedSession?.username);
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
            defaultUsername={sessionState.username || savedSession?.username || ''}
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
                <GlassPanel style={{ padding: 32 }}>
                  <Subtitle>Loading account...</Subtitle>
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
