import React, { useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { usePointerTilt } from '../../lib/motion';
import { useDemoLoop } from '../../lib/useDemoLoop';
import { HeroHostScreen, HeroPhoneScreen } from './HeroScreens';

// The hero's device stage (brief 6.1, effects E3, E4, E8): a host screen and a phone
// showing the same question. Decorative: the devices are aria-hidden and inert; the
// figure keeps its label and caption.
//
// The frames own size, shadow, tilt and the sweep; what is on each screen comes from
// `renderScreen(kind, frame)`, kind 'host' | 'phone', frame from useDemoLoop. Each
// screen slot is a size container that fills the frame; by default it holds the real
// game screens in preview mode (HeroScreens.jsx), driven by one shared 16 s loop.

// Virtual screen widths: a laptop and a typical phone.
const HOST_WIDTH = 1280;
const PHONE_WIDTH = 390;

// ------------------------------------------------------------------ styles

const Figure = styled.figure`
  .screen-scale {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

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

  @media (max-width: 560px) {
    aspect-ratio: 4 / 3;
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
// Renders a screen at a real device size and scales it down to fit its frame, so the
// miniature shows the same layout a real laptop or phone would (a 4:3 frame on a phone
// would otherwise be laid out as a cramped landscape phone).
function Scaled({ width: virtualWidth, children }) {
  const ref = useRef(null);
  const [box, setBox] = useState(null);
  useLayoutEffect(() => {
    const slot = ref.current;
    if (!slot) return undefined;
    const measure = () => {
      // Layout size, not getBoundingClientRect: the phone frame is rotated.
      const width = slot.offsetWidth;
      const height = slot.offsetHeight;
      if (width && height) setBox((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    return () => observer.disconnect();
  }, []);
  const scale = box ? box.width / virtualWidth : 1;
  return (
    <div ref={ref} className="screen-scale">
      {box ? (
        <div style={{ width: virtualWidth, height: box.height / scale, transform: `scale(${scale})`, transformOrigin: '0 0' }}>{children}</div>
      ) : null}
    </div>
  );
}

const defaultRenderScreen = (kind, frame) => (kind === 'host' ? <HeroHostScreen frame={frame} /> : <HeroPhoneScreen frame={frame} />);

export function DeviceStage({ renderScreen = defaultRenderScreen }) {
  const figureRef = useRef(null);
  const phoneRef = useRef(null);
  const frame = useDemoLoop(figureRef);
  usePointerTilt(phoneRef, { areaRef: figureRef, max: 2, smoothing: 0.14 });

  return (
    <Figure ref={figureRef} aria-label="Preview of the question screen">
      <Devices aria-hidden="true" inert data-stage-scope="">
        <HostScreen>
          <div className="screen-slot">
            <Scaled width={HOST_WIDTH}>{renderScreen('host', frame)}</Scaled>
          </div>
        </HostScreen>
        <ScreenFoot />
        <Phone ref={phoneRef}>
          <div className="screen-slot">
            <Scaled width={PHONE_WIDTH}>{renderScreen('phone', frame)}</Scaled>
          </div>
        </Phone>
      </Devices>
      <figcaption>The real question screen, shown with a question from the free demo.</figcaption>
    </Figure>
  );
}
