import React, { useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { BRAND } from '../lib/brand';
import { usePointerTilt } from '../lib/motion';

// The logo is a raster app icon, so it is animated as one piece: never redrawn or
// split into parts. CSS only: a spring entrance, one light sweep masked to the icon's
// own shape, then it settles. After that, a shallow tilt follows deliberate pointer
// movement over the hero (fine pointers only). Reduced motion: shown settled, no tilt.

export const MARK_SRC = '/brand/kazoot-mark.webp';

const enter = keyframes`
  0%   { opacity: 0; transform: translateY(16px) rotate(-10deg) scale(0.8); }
  55%  { opacity: 1; transform: translateY(-3px) rotate(2deg) scale(1.03); }
  100% { opacity: 1; transform: none; }
`;

const sweep = keyframes`
  0%   { opacity: 0; background-position: 130% 0; }
  20%  { opacity: 1; }
  80%  { opacity: 1; }
  100% { opacity: 0; background-position: -30% 0; }
`;

const Wrap = styled.span`
  --size: ${({ $size }) => $size};
  position: relative;
  display: block;
  flex: 0 0 auto;
  width: var(--size);
  height: var(--size); /* reserved before the image loads: no layout shift */
  perspective: 520px;

  .enter {
    display: block;
    width: 100%;
    height: 100%;
    opacity: 0;
  }
  &[data-ready='true'] .enter {
    animation: ${enter} 780ms var(--ease-out) 120ms both;
  }

  .tilt {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    transform: rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg));
    transform-style: preserve-3d;
    will-change: transform;
  }

  img {
    width: 100%;
    height: 100%;
    /* Depth: a violet shadow that shifts against the tilt, like a lifted tile. */
    filter: drop-shadow(calc(var(--tilt-u, 0) * -6px) calc(10px + var(--tilt-v, 0) * -6px) 14px rgba(91, 33, 182, 0.38));
  }

  /* One sweep of light along the K's diagonal, clipped to the icon by its own alpha. */
  .sheen {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(135deg, transparent 38%, rgba(255, 255, 255, 0.5) 50%, transparent 62%) no-repeat;
    background-size: 260% 100%;
    background-position: 130% 0;
    mix-blend-mode: soft-light;
    opacity: 0;
    -webkit-mask: url(${MARK_SRC}) center / contain no-repeat;
    mask: url(${MARK_SRC}) center / contain no-repeat;
  }
  &[data-ready='true'] .sheen {
    animation: ${sweep} 1000ms ease-in-out 720ms both;
  }

  @media (prefers-reduced-motion: reduce) {
    .enter { opacity: 1; animation: none !important; }
    .sheen { display: none; }
  }
`;

export function HeroMark({ areaRef, size = 'clamp(64px, 7vw, 92px)' }) {
  const wrapRef = useRef(null);
  const imgRef = useRef(null);
  usePointerTilt(wrapRef, { areaRef, max: 9, smoothing: 0.14 });

  // Start the entrance once the image is decoded, so it never animates an empty box.
  useEffect(() => {
    const img = imgRef.current;
    const wrap = wrapRef.current;
    if (!img || !wrap) return undefined;
    const ready = () => wrap.setAttribute('data-ready', 'true');
    if (img.complete) {
      ready();
      return undefined;
    }
    img.addEventListener('load', ready);
    img.addEventListener('error', ready);
    return () => {
      img.removeEventListener('load', ready);
      img.removeEventListener('error', ready);
    };
  }, []);

  return (
    <Wrap ref={wrapRef} $size={size}>
      <span className="enter">
        <span className="tilt">
          <img ref={imgRef} src={MARK_SRC} alt={`${BRAND.name} logo`} width="92" height="92" decoding="async" fetchPriority="high" />
          <span className="sheen" aria-hidden="true" />
        </span>
      </span>
    </Wrap>
  );
}
