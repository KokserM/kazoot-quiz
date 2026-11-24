import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { usePointerTilt } from '../../lib/motion';
import { Icon } from '../Icon';

// The hero's device stage (brief 6.1, effects E3, E4, E8): a host screen and a phone
// showing the same question. Decorative: the devices are aria-hidden and inert; the
// figure keeps its label and caption.
//
// Seam for the live preview: the frames own size, shadow, tilt and the sweep; what is
// on each screen comes from `renderScreen(kind, timer)`, kind 'host' | 'phone',
// timer { remainingMs, timeLimitMs }. Each screen slot is a size container
// (container-type: size, no padding) that fills the frame, so a `<GameShell preview>` can be
// returned from renderScreen later. Until then the default renders the hand-built
// fallback below, in which only the timer moves.

const QUESTION = 'Which spice comes from the dried stigmas of a crocus flower?';
const ANSWERS = ['Turmeric', 'Saffron', 'Cardamom', 'Paprika'];
const LETTERS = ['A', 'B', 'C', 'D'];
const TILE = ['a', 'b', 'c', 'd'];

const TIME_LIMIT_MS = 20000;
const STATIC_MS = 13000; // reduced motion, Lite, or no IntersectionObserver
const LOOP_FROM_MS = 16000; // the timer runs 16 → 4 s, passing "soon" (10) and "urgent" (5)
const LOOP_TO_MS = 4000;
const TICK_MS = 250;

function prefersStatic() {
  if (typeof window === 'undefined') return true;
  const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reduced || document.documentElement.hasAttribute('data-lite') || !('IntersectionObserver' in window);
}

// One 250 ms interval, only while the figure is on screen and the tab is visible.
function useHeroTimer(figureRef) {
  const [remainingMs, setRemainingMs] = useState(STATIC_MS);
  useEffect(() => {
    const figure = figureRef.current;
    if (!figure || prefersStatic()) return undefined;
    let id = 0;
    let inView = false;
    const tick = () => setRemainingMs((ms) => (ms - TICK_MS < LOOP_TO_MS ? LOOP_FROM_MS : ms - TICK_MS));
    const sync = () => {
      const run = inView && document.visibilityState !== 'hidden';
      if (run && !id) id = window.setInterval(tick, TICK_MS);
      if (!run && id) {
        window.clearInterval(id);
        id = 0;
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    observer.observe(figure);
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      window.clearInterval(id);
    };
  }, [figureRef]);
  return remainingMs;
}

function timerLevel(remainingMs) {
  return remainingMs <= 5000 ? 'urgent' : remainingMs <= 10000 ? 'soon' : 'calm';
}

function Timer({ remainingMs, timeLimitMs }) {
  const ratio = Math.max(0, Math.min(1, remainingMs / timeLimitMs));
  return (
    <div className="timer" data-level={timerLevel(remainingMs)}>
      <span className="sec">{Math.ceil(remainingMs / 1000)}</span>
      <span className="track">
        <i style={{ transform: `scaleX(${ratio})` }} />
      </span>
    </div>
  );
}

// Hand-built question screen, host view: the shared screen never shows a chosen tile.
export function StaticHostScreen({ timer }) {
  return (
    <div className="screen-content host-content">
      <div className="q-top">
        <span>Question 3 of 10</span>
        <span>
          <Icon name="users" /> 7 of 9 answered
        </span>
      </div>
      <p className="q-title">{QUESTION}</p>
      <Timer {...timer} />
      <div className="tiles">
        {ANSWERS.map((answer, index) => (
          <div key={answer} className={`tile ${TILE[index]}`}>
            <b>{LETTERS[index]}</b>
            <span>{answer}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Hand-built question screen, player view: locked on B.
export function StaticPhoneScreen({ timer }) {
  return (
    <div className="screen-content phone-content">
      <div className="q-top">
        <span>Question 3 of 10</span>
      </div>
      <p className="q-title">{QUESTION}</p>
      <Timer {...timer} />
      <div className="tiles">
        {ANSWERS.map((answer, index) => (
          <div key={answer} className={`tile ${TILE[index]} ${index === 1 ? 'chosen' : 'out'}`}>
            <b>{LETTERS[index]}</b>
            <span>
              {answer}
              {index === 1 ? (
                <>
                  <br />
                  <span className="tag">Locked in</span>
                </>
              ) : null}
            </span>
          </div>
        ))}
      </div>
      <p className="status">Locked in. The answer appears when time is up.</p>
    </div>
  );
}

const defaultRenderScreen = (kind, timer) => (kind === 'host' ? <StaticHostScreen timer={timer} /> : <StaticPhoneScreen timer={timer} />);

// ------------------------------------------------------------------ styles

// Shared look of the hand-built screens. Sizes are container units of each screen slot,
// with vw fallbacks first for browsers without container queries.
const screenContent = `
  .screen-content {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
    color: var(--ink);
    text-align: left;
  }
  .q-top {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    color: var(--ink-3);
    font-weight: 700;
    line-height: 1.3;
    white-space: nowrap;
  }
  .q-top svg { margin-right: 0.2em; }
  .q-title {
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.12;
    text-wrap: balance;
  }
  .timer {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    --level: var(--accent-text);
  }
  .timer[data-level='soon'] { --level: var(--warning); }
  .timer[data-level='urgent'] { --level: var(--danger); }
  .sec {
    display: inline-grid;
    place-items: center;
    min-width: 3.2ch;
    padding: 0.18em 0.5em;
    border: 2px solid var(--level);
    color: var(--level);
    font-family: var(--font-display);
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .track {
    display: block;
    overflow: hidden;
    background: var(--surface-sunk);
  }
  .track i {
    display: block;
    height: 100%;
    background: var(--level);
    transform-origin: left center;
    transition: transform ${TICK_MS}ms linear;
  }
  .tiles {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    grid-auto-rows: minmax(0, 1fr);
  }
  .tile {
    display: flex;
    align-items: center;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border: 2px solid transparent;
    font-weight: 700;
    line-height: 1.2;
    color: var(--answer-ink);
  }
  .tile b {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 2em;
    height: 2em;
    background: var(--answer-ink);
    font-family: var(--font-display);
  }
  .tile.a { background: var(--answer-a); --tile: var(--answer-a); }
  .tile.b { background: var(--answer-b); --tile: var(--answer-b); }
  .tile.c { background: var(--answer-c); --tile: var(--answer-c); }
  .tile.d { background: var(--answer-d); --tile: var(--answer-d); }
  .tile b { color: var(--tile); }
  .tile.out {
    background: var(--surface-sunk);
    color: var(--ink);
    border-color: color-mix(in srgb, var(--tile) 55%, transparent);
  }
  .tile.out b { background: var(--tile); color: var(--answer-ink); }
  .tile.chosen { box-shadow: 0 0 0 2px var(--paper), 0 0 0 4px var(--ink); }
  .tag {
    display: inline-block;
    margin-top: 0.3em;
    padding: 0.15em 0.55em;
    border-radius: 0.5em;
    background: var(--answer-ink);
    color: #fff;
    font-size: 0.78em;
  }
  .status {
    color: var(--ink-2);
    font-weight: 700;
    line-height: 1.35;
  }
  @media (prefers-reduced-motion: reduce) {
    .track i { transition: none; }
  }
`;

const Figure = styled.figure`
  margin: clamp(32px, 4vw, 44px) auto 0;
  max-width: var(--max-stage);
  width: 100%;

  figcaption {
    margin-top: 16px;
    font-size: 0.88rem;
    line-height: 1.4;
    color: var(--ink-3);
    text-align: center;
  }
  @media (max-width: 560px) {
    figcaption { text-align: left; }
  }
`;

const Devices = styled.div`
  position: relative;
  padding-bottom: clamp(24px, 5vw, 56px);
  text-align: left;
  ${screenContent}
  @media (max-width: 560px) {
    padding-bottom: 0;
  }
`;

const HostScreen = styled.div`
  position: relative;
  isolation: isolate;
  width: 100%;
  aspect-ratio: 16 / 10;
  border-radius: 22px 22px 6px 6px;
  border: 1px solid var(--line);
  background: linear-gradient(180deg, #191128, #120b1f);
  box-shadow: var(--shadow-device);
  overflow: hidden;

  .screen-slot {
    position: absolute;
    inset: 0;
    container-type: size;
  }

  /* Hand-built host screen. */
  .screen-content { padding: 3vw; padding: 3.4cqw; }
  .q-top { font-size: max(10px, 1.5vw); font-size: max(10px, 1.6cqw); }
  .q-title {
    max-width: 24ch;
    margin: 0.45em 0 0.5em;
    font-size: 3.6vw;
    font-size: 4.1cqw;
  }
  .timer { gap: 1.4cqw; }
  .sec { font-size: 3vw; font-size: 3.4cqw; border-radius: 0.4em; }
  .track { height: max(6px, 1cqw); border-radius: 999px; }
  .tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.4vw;
    gap: 1.6cqw;
    margin-top: 2.2cqw;
  }
  .tile {
    gap: 0.7em;
    padding: 0.5em 0.8em;
    border-radius: 1.6cqw;
    font-size: 2.2vw;
    font-size: 2.5cqw;
  }
  .tile b { border-radius: 0.45em; }

  @media (max-width: 560px) {
    aspect-ratio: 4 / 3;
    .q-top { font-size: 3.2cqw; }
    .q-title { max-width: none; font-size: 5.2cqw; }
    .sec { font-size: 4.8cqw; }
    .track { height: 1.8cqw; }
    .tiles { gap: 2cqw; }
    .tile { font-size: 4.2cqw; border-radius: 2.6cqw; padding: 0.35em 0.6em; }
  }

  /* E8: one spotlight sweep across the screen, 600 ms after load. Not in light, Lite or
     with reduced motion. */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background: linear-gradient(100deg, transparent 35%, rgba(255, 255, 255, 0.07) 50%, transparent 65%);
    transform: translateX(-130%);
  }
  @media (prefers-reduced-motion: no-preference) {
    &::after { animation: sweep var(--dur-sweep) var(--ease-in-out) 600ms 1 forwards; }
  }
  @media (prefers-reduced-motion: reduce) {
    &::after { content: none; }
  }
  :root[data-lite] &::after,
  :root[data-theme='light'] &::after {
    content: none;
  }
`;

const ScreenFoot = styled.div`
  height: 14px;
  margin: 0 8%;
  border-radius: 0 0 18px 18px;
  background: linear-gradient(180deg, #2b2140, #1a1229);
  @media (max-width: 560px) {
    height: 10px;
  }
`;

const Phone = styled.div`
  position: absolute;
  right: 0;
  bottom: 0;
  z-index: var(--z-raised);
  width: clamp(150px, 26vw, 250px);
  aspect-ratio: 9 / 17;
  padding: 10px 8px;
  border-radius: 28px;
  border: 1px solid var(--device-line);
  background: var(--device-body);
  box-shadow: var(--shadow-phone);
  /* E4: rotated 3°, and on fine pointers it follows the pointer by up to 2° (usePointerTilt). */
  transform: rotate(3deg) perspective(900px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg));
  transition: transform 200ms var(--ease-out);
  &[data-tilt='on'] { transition: none; }
  :root[data-lite] & { transform: rotate(3deg); }
  display: grid;
  grid-template-rows: minmax(0, 1fr);

  .screen-slot {
    position: relative;
    min-height: 0;
    border-radius: 20px;
    overflow: hidden;
    background: var(--paper);
    container-type: size;
  }

  /* Hand-built phone screen. */
  .screen-content { padding: 7cqw 6cqw; }
  .q-top { font-size: 5.4cqw; }
  .q-title { margin: 0.4em 0 0.5em; font-size: 7.4cqw; line-height: 1.15; }
  .timer { gap: 3cqw; }
  .sec { font-size: 6.2cqw; border-radius: 0.35em; padding: 0.15em 0.4em; }
  .track { height: 2.6cqw; border-radius: 999px; }
  .tiles {
    grid-template-columns: minmax(0, 1fr);
    gap: 3cqw;
    margin-top: 4cqw;
  }
  .tile {
    gap: 0.55em;
    padding: 0.3em 0.5em;
    border-radius: 4.5cqw;
    font-size: 6cqw;
  }
  .tile b { width: 1.8em; height: 1.8em; border-radius: 0.4em; }
  .status { margin-top: 4cqw; font-size: 4.6cqw; }

  @media (max-width: 560px) {
    position: relative;
    right: auto;
    bottom: auto;
    width: min(56%, 210px);
    aspect-ratio: 9 / 16;
    margin: -34px 8px 0 auto;
  }
`;

// figure: aria-label + caption; the devices themselves are hidden from assistive tech
// and not focusable. data-stage-scope keeps them on the stage palette in light theme.
export function DeviceStage({ renderScreen = defaultRenderScreen }) {
  const figureRef = useRef(null);
  const phoneRef = useRef(null);
  const remainingMs = useHeroTimer(figureRef);
  usePointerTilt(phoneRef, { areaRef: figureRef, max: 2, smoothing: 0.14 });
  const timer = { remainingMs, timeLimitMs: TIME_LIMIT_MS };

  return (
    <Figure ref={figureRef} aria-label="Preview of the question screen">
      <Devices aria-hidden="true" inert data-stage-scope="">
        <HostScreen>
          <div className="screen-slot">{renderScreen('host', timer)}</div>
        </HostScreen>
        <ScreenFoot />
        <Phone ref={phoneRef}>
          <div className="screen-slot">{renderScreen('phone', timer)}</div>
        </Phone>
      </Devices>
      <figcaption>The real question screen, shown with a question from the free demo.</figcaption>
    </Figure>
  );
}
