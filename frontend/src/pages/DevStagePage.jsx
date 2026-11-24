import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { ConnectionBanner } from '../components/game/ConnectionBanner';
import { FIXTURE_IDS, PLAYER_COUNTS, buildStage } from '../components/game/fixtures';
import { FinalScreen } from '../components/game/FinalScreen';
import { GameShell } from '../components/game/GameShell';
import { Lobby } from '../components/game/Lobby';
import { QuestionScreen, ResultsScreen } from '../components/game/RoundScreens';

// Dev-only gallery (registered in App.jsx only when import.meta.env.DEV): renders any
// game phase × role × fixture × sub-state from URL query parameters, so every state can
// be checked against the viewport matrix (brief 2.2) and screenshotted headlessly
// (scripts/fit-check.mjs). Example:
//   /dev/stage?phase=reveal&role=host&fixture=long&players=9&banner=offline&big=1
//
// phase    lobby | question | reveal | final            role     host | player
// fixture  short | typical | long | word                players  1 | 2 | 3 | 9 | 150
// sub      unanswered | sending | locked | timeup | failed   (question)
// outcome  correct | wrong | none                       (reveal)
// banner   offline | reconnecting | restarting          big      1 (host)
// review   1 (lobby host)      host  present | away | reconnecting
// solo 1 · standin 1 · last 1 · demo 0 (AI quiz) · signed 1 (final, signed-in host)
// t        seconds left (default 14) · lang et · topic short · bare 1 (no picker)
// preview  WxH: render the stage in preview mode inside a WxH box (home hero frames),
//          e.g. preview=980x612 (16:10 host screen) or preview=200x356 (9:16 phone)

const OPTIONS = {
  phase: ['lobby', 'question', 'reveal', 'final'],
  role: ['host', 'player'],
  fixture: FIXTURE_IDS,
  players: PLAYER_COUNTS.map(String),
  sub: ['unanswered', 'sending', 'locked', 'timeup', 'failed'],
  outcome: ['correct', 'wrong', 'none'],
  banner: ['none', 'offline', 'reconnecting', 'restarting'],
  host: ['present', 'away', 'reconnecting'],
};
const FLAGS = ['big', 'review', 'solo', 'standin', 'last', 'signed'];

const PreviewBox = styled.div`
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 0 0 1px var(--ring);
`;

const Picker = styled.details`
  position: fixed;
  left: 8px;
  bottom: 8px;
  z-index: 100;
  max-width: calc(100vw - 16px);
  padding: 6px 10px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--line-strong);
  font-size: 13px;
  color: var(--ink);
  summary {
    cursor: pointer;
    font-weight: 700;
  }
  form {
    display: grid;
    grid-template-columns: auto auto;
    gap: 4px 8px;
    margin-top: 6px;
  }
  select {
    font-size: 13px;
    background: var(--surface-sunk);
  }
`;

export default function DevStagePage() {
  const [search, setSearch] = useSearchParams();
  const params = Object.fromEntries(search.entries());
  const key = search.toString();
  const stage = useMemo(() => buildStage({ ...params, review: params.review === '1', solo: params.solo === '1', standin: params.standin === '1', last: params.last === '1' }), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const phase = stage.phase;
  const noop = async () => {};

  const banner =
    params.banner && params.banner !== 'none' ? (
      <ConnectionBanner
        connection={params.banner === 'restarting' ? 'online' : params.banner}
        restarting={params.banner === 'restarting' ? 'Kazoot is restarting for an update. Please try again in a minute.' : null}
        onRetry={() => {}}
      />
    ) : null;

  let screen;
  if (phase === 'lobby') {
    screen = <Lobby session={stage.session} seat={stage.seat} isHost={stage.isHost} solo={params.solo === '1'} onStart={noop} onLeave={() => {}} />;
  } else if (phase === 'reveal') {
    screen = <ResultsScreen results={stage.results} roundResult={stage.roundResult} session={stage.session} seat={stage.seat} isHost={stage.isHost} onNext={noop} />;
  } else if (phase === 'final') {
    screen = (
      <FinalScreen
        leaderboard={stage.leaderboard}
        session={stage.session}
        seat={stage.seat}
        isHost={stage.isHost}
        config={stage.config}
        onLeave={() => {}}
        signedIn={params.signed === '1'}
      />
    );
  } else {
    screen = (
      <QuestionScreen
        question={stage.question}
        myAnswer={stage.myAnswer}
        progress={stage.progress}
        session={stage.session}
        onAnswer={() => {}}
        remainingMs={stage.remainingMs}
      />
    );
  }

  const set = (name, value) => {
    const next = new URLSearchParams(search);
    if (value === '' || value === undefined) next.delete(name);
    else next.set(name, value);
    setSearch(next, { replace: true });
  };

  const previewSize = /^(\d+)x(\d+)$/.exec(params.preview || '');
  if (previewSize) {
    return (
      <PreviewBox style={{ width: Number(previewSize[1]), height: Number(previewSize[2]) }}>
        <GameShell key={key} preview phase={{ lobby: 'lobby', question: 'question', reveal: 'reveal', final: 'final' }[phase]} role={stage.role}>
          {screen}
        </GameShell>
      </PreviewBox>
    );
  }

  return (
    <>
      <GameShell
        key={key}
        phase={{ lobby: 'lobby', question: 'question', reveal: 'reveal', final: 'final' }[phase]}
        role={stage.role}
        banner={banner}
        solo={params.solo === '1'}
        sessionId={stage.session.sessionId}
        canBigScreen={stage.isHost}
        defaultBig={params.big === '1'}
      >
        {screen}
      </GameShell>
      {params.bare === '1' ? null : (
        <Picker>
          <summary>Stage</summary>
          <form onSubmit={(event) => event.preventDefault()}>
            {Object.entries(OPTIONS).map(([name, values]) => (
              <label key={name} style={{ display: 'contents' }}>
                <span>{name}</span>
                <select value={params[name] || ''} onChange={(event) => set(name, event.target.value)}>
                  <option value="">default</option>
                  {values.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {FLAGS.map((name) => (
              <label key={name} style={{ display: 'contents' }}>
                <span>{name}</span>
                <input type="checkbox" checked={params[name] === '1'} onChange={(event) => set(name, event.target.checked ? '1' : '')} />
              </label>
            ))}
          </form>
        </Picker>
      )}
    </>
  );
}
