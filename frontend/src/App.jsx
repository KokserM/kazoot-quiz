import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { motion } from 'framer-motion';
import { fetchDemoTopics, createSession as requestCreateSession } from './lib/api';
import { loadPlayerSession } from './lib/storage';
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

function Shell({ children }) {
  return (
    <PageShell>
      <CenteredContent>{children}</CenteredContent>
    </PageShell>
  );
}

function MarketingHome() {
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
        <ButtonRow style={{ marginTop: 28 }}>
          <Button as={Link} to="/create">
            Host a game
          </Button>
          <Button as={Link} to="/join" variant="secondary">
            Join by code
          </Button>
        </ButtonRow>
        <Grid gap="18px" style={{ marginTop: 34 }}>
          {[
            ['Authoritative realtime', 'Server-timed rounds prevent drift, duplicate scoring, and stale timer bugs.'],
            ['Rejoin without chaos', 'Players reconnect with stored tokens instead of losing their seat mid-game.'],
            ['Better AI prompts', 'GPT-5.4 uses structured output plus duplicate filtering to keep sets fresh.'],
          ].map(([headline, copy]) => (
            <Card key={headline} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <SectionTitle style={{ fontSize: '1.15rem', marginBottom: 10 }}>{headline}</SectionTitle>
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
  const [username, setUsername] = useState('');
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('English');
  const [topics, setTopics] = useState([]);
  const [hasOpenAI, setHasOpenAI] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
      const session = await requestCreateSession({ topic, language });
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

        <form onSubmit={handleSubmit}>
          <Grid columns="repeat(auto-fit, minmax(260px, 1fr))">
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

          {topics.length ? (
            <Grid gap="10px" columns="repeat(auto-fit, minmax(150px, 1fr))" style={{ marginTop: 18 }}>
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
              disabled={!username.trim() || !topic.trim() || isLoading}
              whileTap={{ scale: 0.98 }}
            >
              {isLoading ? 'Creating session...' : 'Create game'}
            </Button>
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
  const [sessionId, setSessionId] = useState(initialCode.toUpperCase().slice(0, 6));

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
                Enter your name and the 6-character code, or open a direct session link from your
                host to reconnect automatically.
              </Subtitle>
            </div>
          </div>
          <Button as={Link} to="/" variant="ghost" compact>
            Back home
          </Button>
        </HeaderRow>

        <form onSubmit={handleSubmit}>
          <Grid columns="repeat(auto-fit, minmax(260px, 1fr))">
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
                  setSessionId(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
                }
                placeholder="ABC123"
                required
              />
            </div>
          </Grid>

          <ButtonRow style={{ marginTop: 28 }}>
            <Button
              type="submit"
              disabled={!username.trim() || sessionId.trim().length !== 6}
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
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <StatChip>{session.connectedPlayerCount} connected</StatChip>
          <Pill $tone={connectionStatus === 'connected' ? 'success' : 'warning'}>
            {connectionStatus === 'connected' ? 'Live connection' : 'Reconnecting...'}
          </Pill>
          {session.you?.isHost ? <Pill $tone="success">You are host</Pill> : null}
        </div>
      </HeaderRow>
    </Card>
  );
}

function LobbyView({ session, onStartGame, onLeave, onForgetAndRetry }) {
  const shareLink = `${window.location.origin}/session/${session.sessionId}`;

  async function copyLink() {
    await navigator.clipboard.writeText(shareLink);
  }

  return (
    <Grid columns="1.3fr 1fr">
      <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <SectionTitle>Lobby</SectionTitle>
        <Subtitle style={{ marginTop: 8 }}>
          Share the code or link, wait for everyone to connect, then launch the first question when
          you are ready.
        </Subtitle>

        <Grid gap="12px" style={{ marginTop: 20 }}>
          <StatChip>Code: {session.sessionId}</StatChip>
          <StatChip>Questions: {session.questionCount}</StatChip>
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
            <Button type="button" onClick={onStartGame} whileTap={{ scale: 0.98 }}>
              Start game
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onLeave} whileTap={{ scale: 0.98 }}>
            Leave
          </Button>
        </ButtonRow>
      </Card>

      <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <SectionTitle>Players</SectionTitle>
        <Grid gap="12px" style={{ marginTop: 18 }}>
          {session.players.map((player) => (
            <Card key={player.playerId} style={{ padding: 16 }}>
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
    if (!question) {
      return 0;
    }
    const offset = (question.serverTime || Date.now()) - Date.now();
    return Math.max(0, question.questionEndsAt - (Date.now() + offset));
  });

  useEffect(() => {
    if (!question) {
      setRemainingMs(0);
      return;
    }

    const offset = (question.serverTime || Date.now()) - Date.now();
    const tick = () => {
      setRemainingMs(Math.max(0, question.questionEndsAt - (Date.now() + offset)));
    };

    tick();
    const intervalId = setInterval(tick, 250);
    return () => clearInterval(intervalId);
  }, [question]);

  return remainingMs;
}

function QuestionView({ question, onSubmitAnswer }) {
  const remainingMs = useSyncedCountdown(question);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const progress = question ? Math.max(0, Math.min(1, remainingMs / question.timeLimit)) : 0;
  const locked = question?.submittedAnswerIndex !== null || question?.pendingAnswerIndex !== null || remainingMs === 0;

  const options = useMemo(
    () => [
      ['A', theme.colors.optionA],
      ['B', theme.colors.optionB],
      ['C', theme.colors.optionC],
      ['D', theme.colors.optionD],
    ],
    []
  );

  return (
    <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <HeaderRow>
        <div>
          <Eyebrow>
            Question {question.questionNumber} of {question.totalQuestions}
          </Eyebrow>
          <div style={{ marginTop: 14 }}>
            <SectionTitle>{question.question}</SectionTitle>
          </div>
        </div>
        <div style={{ minWidth: 160 }}>
          <div style={{ fontWeight: 700, fontSize: '1.5rem', textAlign: 'right' }}>{remainingSeconds}s</div>
          <div
            aria-hidden="true"
            style={{
              marginTop: 10,
              height: 10,
              borderRadius: 999,
              overflow: 'hidden',
              background: 'rgba(148, 163, 184, 0.16)',
            }}
          >
            <motion.div
              style={{
                height: '100%',
                borderRadius: 999,
                background: remainingSeconds <= 5 ? theme.colors.danger : theme.colors.primaryBright,
              }}
              animate={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </HeaderRow>

      <Grid gap="14px" columns="repeat(auto-fit, minmax(240px, 1fr))">
        {question.choices.map((choice, index) => {
          const isChosen =
            question.submittedAnswerIndex === index || question.pendingAnswerIndex === index;
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
                padding: '20px',
                minHeight: 94,
                background: isChosen ? `${options[index][1]}` : `${options[index][1]}cc`,
              }}
            >
              <span style={{ marginRight: 12, opacity: 0.9 }}>{options[index][0]}</span>
              <span style={{ textAlign: 'left' }}>{choice}</span>
            </Button>
          );
        })}
      </Grid>

      {question.submittedAnswerIndex !== null || question.pendingAnswerIndex !== null ? (
        <Banner style={{ marginTop: 18 }}>Answer locked in. Waiting for the server to reveal the result.</Banner>
      ) : null}
    </Card>
  );
}

function ResultsView({ results, session, onNextQuestion }) {
  const totalAnswers = results.answerStats.reduce((sum, count) => sum + count, 0);

  return (
    <Grid columns="1.15fr 0.85fr">
      <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Eyebrow>Round recap</Eyebrow>
        <div style={{ marginTop: 16 }}>
          <SectionTitle>
            Correct answer: {String.fromCharCode(65 + results.correctAnswer)}. {results.correctAnswerText}
          </SectionTitle>
        </div>

        <Grid gap="12px" style={{ marginTop: 20 }}>
          {results.answerStats.map((count, index) => {
            const isCorrect = index === results.correctAnswer;
            const playerChoice = results.playerAnswer === index;
            return (
              <Card key={index} style={{ padding: 18 }}>
                <HeaderRow style={{ marginBottom: 10 }}>
                  <strong>
                    {String.fromCharCode(65 + index)}. {results.allChoices[index]}
                  </strong>
                  <Pill $tone={isCorrect ? 'success' : playerChoice ? 'danger' : undefined}>
                    {isCorrect ? 'Correct' : playerChoice ? 'Your answer' : `${count} picks`}
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
        <Grid gap="12px" style={{ marginTop: 18 }}>
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

        <Grid gap="14px" columns="repeat(auto-fit, minmax(220px, 1fr))" style={{ marginTop: 22 }}>
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
          <Grid gap="12px" style={{ marginTop: 18 }}>
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
      <SectionTitle>Join room {sessionId}</SectionTitle>
      <Subtitle style={{ marginTop: 8 }}>
        If you played in this browser before, Kazoot will try to reconnect you automatically. You can
        also join as a new player below.
      </Subtitle>
      <form
        style={{ width: '100%', maxWidth: 420, margin: '24px auto 0' }}
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

  return (
    <Shell>
      <Grid gap="16px">
        {notice ? <Banner>{notice}</Banner> : null}
        {error ? <Banner $tone="danger">{error}</Banner> : null}

        {activeSession ? (
          <>
            <SessionHeader session={activeSession} connectionStatus={connectionStatus} />

            {activeSession.gameState === 'waiting' ? (
              <LobbyView
                session={activeSession}
                onStartGame={startGame}
                onLeave={handleGoHome}
                onForgetAndRetry={handleJoinAsDifferentPlayer}
              />
            ) : null}

            {question ? <QuestionView question={question} onSubmitAnswer={submitAnswer} /> : null}
            {results ? (
              <ResultsView results={results} session={activeSession} onNextQuestion={nextQuestion} />
            ) : null}
            {gameEnd ? (
              <GameEndView leaderboard={gameEnd.leaderboard} onLeave={handleGoHome} />
            ) : null}
          </>
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
      <Route path="/join" element={<JoinPage />} />
      <Route path="/session/:sessionId" element={<SessionPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <GameProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </GameProvider>
    </ThemeProvider>
  );
}
