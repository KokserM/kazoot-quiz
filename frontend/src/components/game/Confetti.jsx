import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useStage } from './GameShell';

// E12: one CSS-only confetti burst on the final screen, 900 ms in. Once per final
// screen per room (sessionStorage), never under reduced motion, fewer pieces on narrow
// stages and in Lite. The layer leaves the DOM after the last piece lands.

// Fixed table (no randomness, so a reload looks the same): start x %, drift (cqw),
// rotation, delay, duration, shape.
const PIECES = [
  [4, 6, 540, 0, 2200, 0],
  [96, -8, -720, 60, 2300, 1],
  [50, 4, 360, 20, 1900, 0],
  [22, -10, 900, 140, 2400, 0],
  [76, 10, -540, 90, 2100, 1],
  [36, 8, 720, 200, 2000, 0],
  [64, -6, -360, 40, 2250, 0],
  [12, 12, 480, 260, 1850, 1],
  [88, -12, -900, 180, 2350, 0],
  [44, -4, 600, 320, 2050, 0],
  [58, 6, -600, 110, 1950, 1],
  [28, 2, 840, 380, 2200, 0],
  [70, -10, 420, 240, 2400, 0],
  [8, 8, -480, 300, 2100, 0],
  [92, 4, 660, 160, 1800, 1],
  [40, 12, -780, 220, 2300, 0],
  [82, -2, 300, 360, 2000, 0],
  [18, -8, -660, 80, 2150, 1],
  [54, 10, 960, 280, 1900, 0],
  [32, -12, -300, 400, 2250, 0],
  [66, 2, 720, 30, 2350, 1],
  [48, -6, -840, 340, 2050, 0],
  [14, 4, 540, 190, 2400, 0],
  [86, 8, -420, 120, 1850, 0],
];
const COLORS = ['var(--answer-a)', 'var(--answer-b)', 'var(--answer-c)', 'var(--answer-d)', 'var(--ink)'];

const Layer = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: var(--z-confetti);
  i {
    position: absolute;
    top: 0;
    left: var(--x);
    width: 8px;
    height: 14px;
    border-radius: 2px;
    background: var(--c);
    opacity: 0;
    will-change: transform, opacity;
    animation: fall var(--t) cubic-bezier(0.25, 0.6, 0.45, 1) calc(900ms + var(--d)) 1 both;
  }
  i[data-round] {
    height: 8px;
    border-radius: 50%;
  }
`;

const reducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function alreadyShown(key) {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function Confetti({ roomId }) {
  const { width, preview } = useStage();
  const key = `kazoot:confetti:${roomId}`;
  const [active] = useState(() => Boolean(roomId) && !preview && !reducedMotion() && !alreadyShown(key));
  const [done, setDone] = useState(false);
  const ended = useRef(0);

  useEffect(() => {
    if (!active) return;
    try {
      sessionStorage.setItem(key, '1');
    } catch {
      // Storage blocked: it may replay after a reconnect, nothing worse.
    }
  }, [active, key]);

  if (!active || done) return null;
  const lite = typeof document !== 'undefined' && document.documentElement.hasAttribute('data-lite');
  const count = lite ? 10 : width && width < 600 ? 14 : 24;
  const pieces = PIECES.slice(0, count);
  return (
    <Layer
      aria-hidden="true"
      data-confetti=""
      onAnimationEnd={() => {
        ended.current += 1;
        if (ended.current >= pieces.length) setDone(true);
      }}
    >
      {pieces.map(([x, dx, r, d, t, round], index) => (
        <i
          key={index}
          data-round={round ? '' : undefined}
          style={{ '--x': `${x}%`, '--dx': `${dx}cqw`, '--r': `${r}deg`, '--d': `${d}ms`, '--t': `${t}ms`, '--c': COLORS[index % COLORS.length] }}
        />
      ))}
    </Layer>
  );
}
