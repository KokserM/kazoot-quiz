import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import styled, { createGlobalStyle, css } from 'styled-components';
import { formatRoomCode, heightClass, stageMode } from '../../lib/gameUi';
import { useRegisterGameShell } from '../../lib/useGameShell';
import { useWakeLock } from '../../lib/useWakeLock';
import { Icon } from '../Icon';
import { Button } from '../ui';

// The game stage (brief 8.1). One fixed, viewport-filling box that never scrolls and is
// the size reference (container `game`) for everything inside it.
//
//   <GameShell phase="lobby|question|reveal|final" role="host|player" banner={…}
//              solo={bool} sessionId="…" canBigScreen={isHost} preview={bool}>
//     <GameFrame>            grid: top / body / dock (mode L: top + dock share row 1)
//       <TopBar left middle right />   status row + the connection banner (from context)
//       <Body>…</Body>
//       <Dock>…</Dock>
//     </GameFrame>
//   </GameShell>
//
// Modes are container queries on `game` (stageQuery below), so they work on a phone, a
// resized laptop window, a projector and inside the hero miniatures. The same thresholds
// are available to components as `useStage().mode` for decisions CSS cannot make.
//
// Preview (`preview`, home hero device frames): position relative and 100 % of its
// parent, type floors scaled by --floor: 0.55, the whole subtree inert and aria-hidden,
// and no document side effects (no data-game-shell, wake lock, toasts, focus moves or
// sheets).

export const stageQuery = {
  L: '@container game (max-height: 420px) and (min-aspect-ratio: 5/4)',
  W: '@container game (min-height: 421px) and (min-aspect-ratio: 5/4)',
  P: '@container game not (min-aspect-ratio: 5/4)',
  // P-small and L together: every stage under 500 px high.
  short: '@container game (max-height: 499px)',
  PS: '@container game (max-height: 499px) and (not (min-aspect-ratio: 5/4))',
  PT: '@container game (min-height: 700px) and (not (min-aspect-ratio: 5/4))',
  narrow: '@container game (max-width: 599px)',
  wideEnough: '@container game (min-width: 600px)',
};

const StageContext = createContext({
  preview: false,
  phase: null,
  role: 'player',
  width: 0,
  height: 0,
  mode: 'P',
  hclass: 'tall',
  big: false,
  setBig: () => {},
  canBigScreen: false,
  banner: null,
  solo: false,
  sessionId: '',
});

export function useStage() {
  return useContext(StageContext);
}

// While the shell is mounted the page behind it has no height of its own.
const ShellDocumentStyle = createGlobalStyle`
  @supports (container-type: size) {
    html[data-game-shell='true'] #root { min-height: 0; }
  }
  /* G10: without container size queries the game is a normal scrolling page. */
  @supports not (container-type: size) {
    html[data-game-shell='true'], html[data-game-shell='true'] body { height: auto; overflow: visible; }
  }
`;

const ShellRoot = styled.div`
  background: var(--paper);
  color: var(--ink);
  position: relative;
  isolation: isolate;
  --floor: 1;

  @supports (container-type: size) {
    position: fixed;
    inset: 0;
    container: game / size;
    overflow: hidden;
    overscroll-behavior: none;
    touch-action: manipulation;

    &[data-preview] {
      position: relative;
      inset: auto;
      width: 100%;
      height: 100%;
    }
  }
  &[data-preview] {
    --floor: 0.55;
  }
  &[data-display='big'] {
    --cap: 1.6;
    --boost: 1.2;
  }

  /* E1: one static spotlight on the lobby and the final screen. */
  &[data-phase='lobby']::before,
  &[data-phase='final']::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background: radial-gradient(60% 40% at 50% 0%, var(--glow-a), transparent 70%);
  }

  button,
  a {
    user-select: none;
    -webkit-user-select: none;
  }

  /* Only explicit transitions. The reduced-motion rule gives every element a 0.01 ms
     transition, and with the default transition-property (all) a font-size written by
     the fit hook would then only apply a frame later, after it has measured. Zero
     specificity, so components that declare a transition keep it. */
  :where(&) *,
  :where(&) *::before,
  :where(&) *::after {
    transition-property: none;
  }
`;

export const GameFrame = styled.div`
  --pad-x: clamp(10px, 3.2cqw, 48px);
  --gap: clamp(6px, 1.6cqh, 20px);
  min-width: 0;

  @supports (container-type: size) {
    height: 100%;
    display: grid;
    grid-template: 'top' auto 'body' minmax(0, 1fr) 'dock' auto / minmax(0, 1fr);
    gap: var(--gap);
    padding: max(6px, env(safe-area-inset-top)) max(var(--pad-x), env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom))
      max(var(--pad-x), env(safe-area-inset-left));

    [data-preview] > & {
      padding: 6px var(--pad-x) 8px;
    }
    &[data-dock='none'] {
      grid-template: 'top' auto 'body' minmax(0, 1fr) / minmax(0, 1fr);
    }
    /* Connection banner / failed answer: a full-width row under the status row. */
    &:has(> [data-notices]) {
      grid-template: 'top' auto 'notice' auto 'body' minmax(0, 1fr) 'dock' auto / minmax(0, 1fr);
    }
    &[data-dock='none']:has(> [data-notices]) {
      grid-template: 'top' auto 'notice' auto 'body' minmax(0, 1fr) / minmax(0, 1fr);
    }
    ${stageQuery.L} {
      grid-template: 'top dock' auto 'body body' minmax(0, 1fr) / minmax(0, 1fr) auto;
      &:has(> [data-notices]) {
        grid-template: 'top dock' auto 'notice notice' auto 'body body' minmax(0, 1fr) / minmax(0, 1fr) auto;
      }
      &[data-dock='none'] {
        grid-template: 'top' auto 'body' minmax(0, 1fr) / minmax(0, 1fr);
      }
      &[data-dock='none']:has(> [data-notices]) {
        grid-template: 'top' auto 'notice' auto 'body' minmax(0, 1fr) / minmax(0, 1fr);
      }
    }
  }

  /* G10: no container size queries -> the normal scrolling page of before. */
  @supports not (container-type: size) {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: var(--max);
    margin: 0 auto;
    padding: 12px var(--gutter) 32px;
  }
`;

const Top = styled.header`
  grid-area: top;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Notices = styled.div`
  grid-area: notice;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

export const TopRow = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(8px, 2cqw, 24px);
  min-width: 0;
  min-height: max(calc(44px * var(--floor)), clamp(36px, 6.5cqh, 76px));
  font-family: var(--font-body);
  font-weight: 700;
  font-size: clamp(calc(13px * var(--floor)), 2.1cqh, calc(1.4rem * var(--cap, 1)));
  line-height: 1.2;
  color: var(--ink-3);
  white-space: nowrap;

  > .middle {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    align-items: center;
  }
  > .right {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: clamp(6px, 1.4cqw, 16px);
  }
  > .left {
    flex: 0 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  /* Big screen: the join strip and the right-hand items move to a second line when the
     countdown would otherwise be squeezed below a readable width. */
  [data-display='big'] & {
    flex-wrap: wrap;
    row-gap: 8px;
    > .middle {
      min-width: min(40cqw, 320px);
    }
  }
`;

export const Body = styled.div.attrs({ 'data-part': 'body' })`
  grid-area: body;
  min-height: 0;
  min-width: 0;
  position: relative;
  @supports (container-type: size) {
    overflow: hidden;
  }
`;

export const Dock = styled.div.attrs({ 'data-part': 'dock' })`
  grid-area: dock;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;

  ${stageQuery.W} {
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
    gap: clamp(12px, 2cqw, 28px);
  }
  ${stageQuery.L} {
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
    min-height: max(calc(44px * var(--floor)), clamp(36px, 6.5cqh, 76px));
  }
`;

// The host's main action (Next question, Show final results, Start game).
export const ActionButton = styled(Button)`
  && {
    width: 100%;
    min-height: clamp(calc(48px * var(--floor)), 8cqh, 76px);
    font-size: clamp(calc(1rem * var(--floor)), 2.6cqh, calc(1.6rem * var(--cap, 1)));
    border-radius: 14px;
    white-space: normal;
    text-align: center;
    flex: 0 0 auto;
  }
  ${stageQuery.W} {
    && {
      width: auto;
      min-width: min(100%, 320px);
    }
  }
  ${stageQuery.L} {
    && {
      width: auto;
      min-height: 48px;
      padding: 0 18px;
      font-size: 1rem;
      white-space: nowrap;
    }
  }
`;

// A short line of status (role=status) in the dock: waiting for the host, locked in …
export const StatusText = styled.p`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: clamp(calc(34px * var(--floor)), 5.5cqh, 56px);
  font-family: var(--font-body);
  font-weight: 700;
  font-size: clamp(calc(13px * var(--floor)), 2.2cqh, calc(1.25rem * var(--cap, 1)));
  line-height: 1.25;
  color: var(--ink-2);
  > svg {
    flex: 0 0 auto;
  }
  > span {
    min-width: 0;
  }
  ${stageQuery.L} {
    max-width: 60cqw;
    min-height: 0;
    justify-content: flex-end;
    text-align: right;
  }
  ${stageQuery.W} {
    flex: 1 1 auto;
  }
`;

// Visually hidden at the given container query, still read by screen readers.
export const hiddenAt = (query) => css`
  ${query} {
    position: absolute !important;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
    min-height: 0;
  }
`;

const LogoImage = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 30%;
  box-shadow: var(--glow-logo);
  img {
    width: 28px;
    height: 28px;
    border-radius: 30%;
  }
`;

export function LogoTile() {
  return (
    <LogoImage aria-hidden="true">
      <img src="/favicon-192.png" alt="" width="28" height="28" />
    </LogoImage>
  );
}

const JoinStripBox = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.5em;
  min-width: 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1rem, 3.2cqh, 2.5rem);
  letter-spacing: 0.04em;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
  .code {
    background: var(--surface-sunk);
    color: var(--ink);
    padding: 0.15em 0.6em;
    border-radius: 10px;
    letter-spacing: 0.06em;
  }
`;

// Big screen: the join address and the room code stay on screen for latecomers.
export function JoinStrip() {
  const { big, sessionId, phase } = useStage();
  if (!big || !sessionId || phase === 'final') return null;
  return (
    <JoinStripBox>
      <span>{typeof window !== 'undefined' ? window.location.host : ''}/join</span>
      <span className="code" aria-label={`Room code ${sessionId.split('').join(' ')}`}>
        {formatRoomCode(sessionId)}
      </span>
    </JoinStripBox>
  );
}

const ToggleButton = styled(Button)`
  @container game (max-width: 699px) {
    display: none !important;
  }
`;

// Host-only "Big screen" toggle, shown when the stage is at least 700 px wide.
export function BigScreenToggle() {
  const { big, setBig, canBigScreen, preview } = useStage();
  if (!canBigScreen || preview) return null;
  return (
    <ToggleButton variant="secondary" size="sm" onStage aria-pressed={big} onClick={() => setBig(!big)}>
      <Icon name="expand" />
      Big screen
    </ToggleButton>
  );
}

// Status row, plus the connection banner (and in mode L a failed answer) as a full-width
// second line: it takes height from the body, and the fit hooks re-run.
export function TopBar({ left, middle, right, notice, className }) {
  const { banner } = useStage();
  return (
    <>
      <Top className={className}>
        <TopRow>
          {left ? <div className="left">{left}</div> : null}
          <div className="middle">{middle}</div>
          <JoinStrip />
          {right ? <div className="right">{right}</div> : null}
        </TopRow>
      </Top>
      {notice || banner ? (
        <Notices data-notices="">
          {notice}
          {banner}
        </Notices>
      ) : null}
    </>
  );
}

function readDisplay(sessionId) {
  try {
    return sessionId && sessionStorage.getItem(`kazoot:display:${sessionId}`) === 'big';
  } catch {
    return false;
  }
}

function writeDisplay(sessionId, big) {
  try {
    if (!sessionId) return;
    if (big) sessionStorage.setItem(`kazoot:display:${sessionId}`, 'big');
    else sessionStorage.removeItem(`kazoot:display:${sessionId}`);
  } catch {
    // Storage blocked: the setting lasts for this page view.
  }
}

function useBigScreen(sessionId, allowed, defaultBig) {
  const [big, setBigState] = useState(() => Boolean(allowed && (defaultBig ?? readDisplay(sessionId))));
  const enteredFullscreen = useRef(false);

  useEffect(() => {
    if (!allowed) setBigState(false);
  }, [allowed]);

  const setBig = useCallback(
    (on) => {
      setBigState(on);
      writeDisplay(sessionId, on);
      const root = document.documentElement;
      if (on) {
        if (!document.fullscreenElement && typeof root.requestFullscreen === 'function') {
          Promise.resolve()
            .then(() => root.requestFullscreen())
            .then(() => {
              enteredFullscreen.current = true;
            })
            .catch(() => {
              // No fullscreen (iPhone Safari, iframes): the layout already fills the window.
            });
        }
      } else if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
        enteredFullscreen.current = false;
        document.exitFullscreen().catch(() => {});
      }
    },
    [sessionId]
  );

  // Leaving fullscreen with Escape turns Big screen off.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && enteredFullscreen.current) {
        enteredFullscreen.current = false;
        setBigState(false);
        writeDisplay(sessionId, false);
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [sessionId]);

  return [big && allowed, setBig];
}

function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => {
      const width = Math.round(element.clientWidth);
      const height = Math.round(element.clientHeight);
      setSize((current) => (current.width === width && current.height === height ? current : { width, height }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

export function GameShell({ phase, role = 'player', preview = false, banner = null, solo = false, sessionId = '', canBigScreen = false, defaultBig, children, className }) {
  const ref = useRef(null);
  const { width, height } = useElementSize(ref);
  const [big, setBig] = useBigScreen(sessionId, canBigScreen && !preview, defaultBig);
  useRegisterGameShell(!preview);
  useWakeLock(!preview);

  const mode = stageMode(width, height);
  const value = useMemo(
    () => ({
      preview,
      phase,
      role,
      width,
      height,
      mode,
      hclass: heightClass(height),
      big,
      setBig,
      canBigScreen: canBigScreen && !preview,
      banner: preview ? null : banner,
      solo,
      sessionId,
    }),
    [preview, phase, role, width, height, mode, big, setBig, canBigScreen, banner, solo, sessionId]
  );

  return (
    <StageContext.Provider value={value}>
      {preview ? null : <ShellDocumentStyle />}
      <ShellRoot
        ref={ref}
        as={preview ? 'div' : 'main'}
        id={preview ? undefined : 'game-stage'}
        className={className}
        data-phase={phase}
        data-role={role}
        data-display={big ? 'big' : 'device'}
        data-mode={mode}
        data-preview={preview || undefined}
        aria-hidden={preview || undefined}
        inert={preview || undefined}
      >
        {children}
      </ShellRoot>
    </StageContext.Provider>
  );
}
