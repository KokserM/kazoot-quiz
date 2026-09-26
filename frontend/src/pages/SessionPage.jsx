import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Toast } from '../components/SiteChrome';
import { ConnectionBanner } from '../components/game/ConnectionBanner';
import { FinalScreen } from '../components/game/FinalScreen';
import { Lobby } from '../components/game/Lobby';
import { QuestionScreen, ResultsScreen } from '../components/game/RoundScreens';
import { Button, Card, Container, ErrorNotice, Field, Input, LinkButton, Muted, Notice, PageMain, PageTitle, Row, Spinner, Stack } from '../components/ui';
import { normalizeRoomCode, formatRoomCode } from '../lib/gameUi';
import { loadPlayerSession } from '../lib/storage';
import { useConfig } from '../lib/useConfig';
import { useGame } from '../providers/GameProvider';

function NameForm({ code, saved, onJoin }) {
  const [name, setName] = useState('');
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
            onSubmit={(event) => {
              event.preventDefault();
              onJoin(name.trim(), true);
            }}
          >
            <Stack $gap={16}>
              <Field label={saved?.username ? 'Or join as someone new' : 'Your name'} hint="Shown on the scoreboard. Up to 24 characters.">
                <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} autoComplete="nickname" required autoFocus={!saved} />
              </Field>
              <div>
                <Button type="submit" size="lg" disabled={!name.trim()}>
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
    setJoinRequested(true);
    game.join({ sessionId: code, username, fresh });
  };

  const leave = async () => {
    await game.leave();
    navigate('/');
  };

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
    const phase = session.gameState;
    let screen;
    if (phase === 'waiting') {
      screen = <Lobby session={session} seat={seat} isHost={game.isHost} solo={isSolo} onStart={game.startGame} onLeave={leave} />;
    } else if (phase === 'question' && game.question) {
      screen = <QuestionScreen question={game.question} myAnswer={game.myAnswer} progress={game.progress} session={session} onAnswer={game.submitAnswer} />;
    } else if (phase === 'results' && game.results) {
      screen = <ResultsScreen results={game.results} roundResult={game.roundResult} session={session} seat={seat} isHost={game.isHost} onNext={game.nextQuestion} />;
    } else if (phase === 'ended' && game.leaderboard) {
      screen = <FinalScreen leaderboard={game.leaderboard} session={session} seat={seat} isHost={game.isHost} config={config} onLeave={leave} />;
    } else {
      screen = (
        <Row>
          <Spinner aria-hidden="true" />
          <span role="status">Loading…</span>
        </Row>
      );
    }
    content = (
      <Container>
        <Stack $gap={16}>
          {isSolo && phase !== 'ended' ? (
            <Notice $tone="info">
              <span>
                <strong>Solo preview</strong> — just you, no other players. Invite people any time by hosting the demo for a group.
              </span>
            </Notice>
          ) : null}
          {screen}
        </Stack>
      </Container>
    );
  }

  return (
    <PageMain>
      <Container style={{ marginBottom: 12 }}>
        <ConnectionBanner connection={connection} restarting={game.restarting} onRetry={game.retryJoin} />
      </Container>
      {content}
      <Toast toast={game.toast} />
    </PageMain>
  );
}
