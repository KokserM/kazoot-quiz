import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Toast } from '../components/SiteChrome';
import { ConnectionBanner } from '../components/game/ConnectionBanner';
import { FinalScreen } from '../components/game/FinalScreen';
import { Body, GameFrame, GameShell, LogoTile, TopBar } from '../components/game/GameShell';
import { Lobby } from '../components/game/Lobby';
import { QuestionScreen, ResultsScreen } from '../components/game/RoundScreens';
import { Button, Card, Container, ErrorNotice, Field, Input, LinkButton, Muted, PageMain, PageTitle, Row, Spinner, Stack } from '../components/ui';
import { normalizeRoomCode, formatRoomCode } from '../lib/gameUi';
import { loadPlayerSession, saveLastName } from '../lib/storage';
import { useConfig } from '../lib/useConfig';
import { useGame } from '../providers/GameProvider';

// Exported for tests.
export function NameForm({ code, saved, onJoin }) {
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const nameRef = useRef(null);
  return (
    <Container $narrow>
      <Stack $gap={20}>
        <PageTitle>Join room {formatRoomCode(code)}</PageTitle>
        {saved?.username ? (
          <Card>
            <Stack $gap={12}>
              <Muted>
                You were playing here as <strong>{saved.username}</strong>.
              </Muted>
              <div>
                <Button onClick={() => onJoin(saved.username, false)}>Continue as {saved.username}</Button>
              </div>
            </Stack>
          </Card>
        ) : null}
        <Card>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              // The button stays enabled: an empty name is explained on press.
              if (!name.trim()) {
                setNameError('Enter a name.');
                nameRef.current?.focus();
                return;
              }
              onJoin(name.trim(), true);
            }}
          >
            <Stack $gap={16}>
              <Field label={saved?.username ? 'Or join as someone new' : 'Your name'} hint="Shown on the scoreboard. Up to 24 characters." error={nameError}>
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
                  autoFocus={!saved}
                />
              </Field>
              <div>
                <Button type="submit" size="lg">
                  Join game
                </Button>
              </div>
            </Stack>
          </form>
        </Card>
      </Stack>
    </Container>
  );
}

export default function SessionPage() {
  const { sessionId: rawCode = '' } = useParams();
  const code = normalizeRoomCode(rawCode);
  const location = useLocation();
  const navigate = useNavigate();
  const game = useGame();
  const { config } = useConfig();
  const intent = location.state || {};
  const [saved] = useState(() => loadPlayerSession(code, { allowUsernameMismatch: true }));
  const [joinRequested, setJoinRequested] = useState(false);
  const autoStarted = useRef(false);
  const { session, seat, joinError, connection, detach } = game;

  // Join automatically when we know who this is (host from create/demo, or a saved seat).
  useEffect(() => {
    const username = intent.username || saved?.username;
    if (username && !joinRequested) {
      setJoinRequested(true);
      game.join({ sessionId: code, username, hostToken: intent.hostToken || null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Following the host into the next game changes the room code.
  useEffect(() => {
    if (session && session.sessionId !== code && seat?.sessionId === session.sessionId) {
      navigate(`/session/${session.sessionId}`, { replace: true, state: { username: seat.username } });
    }
  }, [session, seat, code, navigate]);

  useEffect(() => () => detach(), [detach]);

  const isSolo = Boolean(intent.solo);
  useEffect(() => {
    if (isSolo && !autoStarted.current && game.isHost && session?.gameState === 'waiting') {
      autoStarted.current = true;
      game.startGame();
    }
  }, [isSolo, game.isHost, session?.gameState, game]);

  const handleJoin = (username, fresh) => {
    saveLastName(username);
    setJoinRequested(true);
    game.join({ sessionId: code, username, fresh });
  };

  const leave = async () => {
    await game.leave();
    navigate('/');
  };

  const banner = <ConnectionBanner connection={connection} restarting={game.restarting} onRetry={game.retryJoin} />;
  const hasBanner = Boolean(game.restarting) || connection === 'offline' || connection === 'reconnecting';

  // Live phases render inside the fixed, non-scrolling game shell (brief 8.1).
  const phase = session && seat && session.sessionId === seat.sessionId && !joinError?.fatal && joinRequested ? session.gameState : null;
  let screen = null;
  let shellPhase = null;
  if (phase === 'waiting') {
    shellPhase = 'lobby';
    screen = <Lobby session={session} seat={seat} isHost={game.isHost} solo={isSolo} onStart={game.startGame} onLeave={leave} />;
  } else if (phase === 'question' && game.question) {
    shellPhase = 'question';
    screen = <QuestionScreen question={game.question} myAnswer={game.myAnswer} progress={game.progress} session={session} onAnswer={game.submitAnswer} />;
  } else if (phase === 'results' && game.results) {
    shellPhase = 'reveal';
    screen = <ResultsScreen results={game.results} roundResult={game.roundResult} session={session} seat={seat} isHost={game.isHost} onNext={game.nextQuestion} />;
  } else if (phase === 'ended' && game.leaderboard) {
    shellPhase = 'final';
    screen = <FinalScreen leaderboard={game.leaderboard} session={session} seat={seat} isHost={game.isHost} config={config} onLeave={leave} />;
  } else if (phase === 'question' || phase === 'results' || phase === 'ended') {
    // A live phase whose payload has not arrived yet: stay on the stage.
    shellPhase = { question: 'question', results: 'reveal', ended: 'final' }[phase];
    screen = (
      <GameFrame data-dock="none">
        <TopBar left={<LogoTile />} />
        <Body>
          <Row>
            <Spinner aria-hidden="true" />
            <span role="status">Loading…</span>
          </Row>
        </Body>
      </GameFrame>
    );
  }

  if (shellPhase) {
    return (
      <GameShell
        phase={shellPhase}
        role={game.isHost ? 'host' : 'player'}
        banner={hasBanner ? banner : null}
        solo={isSolo && shellPhase !== 'final'}
        sessionId={session.sessionId}
        canBigScreen={game.isHost}
      >
        {screen}
        <Toast toast={game.toast} placement="top" />
      </GameShell>
    );
  }

  let content;
  if (joinError?.fatal) {
    content = (
      <Container $narrow>
        <Stack $gap={16}>
          <PageTitle>{joinError.code === 'room_not_found' ? 'Room not found' : 'Can’t join this game'}</PageTitle>
          <Muted>{joinError.message}</Muted>
          {joinError.code === 'room_not_found' ? (
            <Muted $small>Rooms close after a game ends or after a period of inactivity, and when Kazoot restarts for an update.</Muted>
          ) : null}
          <Row>
            <LinkButton to="/join">Enter a different code</LinkButton>
            <LinkButton to="/" variant="secondary">
              Home
            </LinkButton>
          </Row>
        </Stack>
      </Container>
    );
  } else if (!joinRequested) {
    content = <NameForm code={code} saved={saved} onJoin={handleJoin} />;
  } else if (!session || !seat || session.sessionId !== seat.sessionId) {
    content = (
      <Container $narrow>
        <Stack $gap={16}>
          <Row>
            <Spinner aria-hidden="true" />
            <span role="status">{connection === 'reconnecting' || connection === 'offline' ? 'Trying to connect…' : 'Joining the room…'}</span>
          </Row>
          <ErrorNotice error={joinError?.message} onRetry={game.retryJoin} />
        </Stack>
      </Container>
    );
  } else {
    // A live phase without its payload yet (e.g. results before the round result).
    content = (
      <Container $narrow>
        <Row>
          <Spinner aria-hidden="true" />
          <span role="status">Loading…</span>
        </Row>
      </Container>
    );
  }

  return (
    <PageMain>
      {hasBanner ? <Container style={{ marginBottom: 12 }}>{banner}</Container> : null}
      {content}
      <Toast toast={game.toast} />
    </PageMain>
  );
}
