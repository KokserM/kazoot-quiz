import React, { useEffect, useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import { Icon } from '../Icon';
import { getRemainingMs } from '../../lib/gameUi';

export function useCountdown(question, override) {
  const [remainingMs, setRemainingMs] = useState(() => (override ?? getRemainingMs(question)));
  useEffect(() => {
    if (!question || override !== undefined) return undefined;
    const tick = () => setRemainingMs(getRemainingMs(question));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [question, override]);
  return override ?? remainingMs;
}

// Urgency escalates in colour, border and motion (motion is removed for reduced-motion users).
const LEVEL_COLOR = { calm: 'var(--accent-text)', soon: 'var(--warning)', urgent: 'var(--danger)' };

const Wrap = styled.div`
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.6cqw, 20px);
  flex: 1 1 0;
  min-width: 0;
  --level: ${({ $level }) => LEVEL_COLOR[$level]};
`;

const Seconds = styled.div`
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25em;
  min-width: 2.4ch;
  padding: 0.12em 0.45em;
  border-radius: clamp(10px, 1.8cqh, 16px);
  border: 2px solid var(--level);
  color: var(--level);
  font-family: var(--font-display);
  font-size: clamp(calc(1.15rem * var(--floor, 1)), min(4.6cqh, 4.2cqw), 4rem);
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  svg {
    width: 0.6em;
    height: 0.6em;
  }
  /* The clock icon only where there is room for it. */
  @container game (max-width: 599px) {
    svg {
      display: none !important;
    }
  }
  ${({ $compact }) =>
    $compact &&
    css`
      font-size: 1.4rem;
      border-radius: 10px;
    `}
  ${({ $level }) =>
    $level === 'urgent' &&
    css`
      @media (prefers-reduced-motion: no-preference) {
        animation: bump 1s ease-in-out infinite;
        --bump-to: 1.06;
      }
    `}
`;

// Sized by its own width only to drop the bar when less than 32 px are left; its
// height still comes from the game stage (cqh).
const TrackBox = styled.div`
  flex: 1 1 0;
  min-width: 0;
  container-type: inline-size;
`;

const Track = styled.div`
  height: ${({ $compact }) => ($compact ? '8px' : 'clamp(6px, 1.2cqh, 18px)')};
  border-radius: 999px;
  background: var(--surface-sunk);
  overflow: hidden;
  @container (max-width: 31px) {
    display: none;
  }
`;

const Fill = styled.div`
  height: 100%;
  border-radius: inherit;
  background: var(--level);
  transform-origin: left center;
  transition: transform 200ms linear, background-color 300ms ease;
`;

export function Countdown({ question, remainingMs, compact = false, announce = true }) {
  const seconds = Math.ceil(remainingMs / 1000);
  const level = remainingMs <= 5000 ? 'urgent' : remainingMs <= 10000 ? 'soon' : 'calm';
  const ratio = question ? Math.max(0, Math.min(1, remainingMs / question.timeLimit)) : 0;

  // Announce a few moments to screen readers, not every second.
  const [announcement, setAnnouncement] = useState('');
  const lastAnnounced = useRef(null);
  useEffect(() => {
    const marks = { 10: '10 seconds left', 5: '5 seconds left', 0: 'Time is up' };
    if (marks[seconds] && lastAnnounced.current !== seconds) {
      lastAnnounced.current = seconds;
      setAnnouncement(marks[seconds]);
    }
  }, [seconds]);

  return (
    <Wrap $level={level} data-countdown="">
      <Seconds $level={level} $compact={compact} aria-hidden="true">
        <Icon name="clock" />
        {seconds}
      </Seconds>
      <TrackBox>
        <Track
          $compact={compact}
          role="progressbar"
          aria-label="Time left in seconds"
          aria-valuemin={0}
          aria-valuemax={Math.round((question?.timeLimit || 0) / 1000)}
          aria-valuenow={seconds}
        >
          <Fill style={{ transform: `scaleX(${ratio})` }} />
        </Track>
      </TrackBox>
      {announce ? (
        <span className="visually-hidden" aria-live="polite">
          {announcement}
        </span>
      ) : null}
    </Wrap>
  );
}
