import React, { useEffect, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { Icon } from '../Icon';
import { getRemainingMs } from '../../lib/gameUi';

export function useCountdown(question) {
  const [remainingMs, setRemainingMs] = useState(() => getRemainingMs(question));
  useEffect(() => {
    if (!question) return undefined;
    const tick = () => setRemainingMs(getRemainingMs(question));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [question]);
  return remainingMs;
}

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
`;

// Urgency escalates in colour, border and motion (motion is removed for reduced-motion users).
const LEVEL_COLOR = { calm: 'var(--accent-text)', soon: 'var(--warning)', urgent: 'var(--danger)' };

const Wrap = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 16px;
  --level: ${({ $level }) => LEVEL_COLOR[$level]};
`;

const Seconds = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 4.4ch;
  padding: 6px 14px;
  border-radius: 14px;
  border: 2px solid var(--level);
  color: var(--level);
  font-family: var(--font-display);
  font-size: clamp(1.7rem, 4.5vw, 2.8rem);
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  svg {
    width: 0.6em;
    height: 0.6em;
  }
  ${({ $level }) =>
    $level === 'urgent' &&
    css`
      animation: ${pulse} 1s ease-in-out infinite;
    `}
`;

const Track = styled.div`
  height: 12px;
  border-radius: 6px;
  background: var(--surface-sunk);
  overflow: hidden;
`;

const Fill = styled.div`
  height: 100%;
  border-radius: 6px;
  background: var(--level);
  transition: width 200ms linear, background-color 300ms ease;
`;

export function Countdown({ question, remainingMs }) {
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
    <Wrap $level={level}>
      <Seconds $level={level} aria-hidden="true">
        <Icon name="clock" />
        {seconds}
      </Seconds>
      <Track
        role="progressbar"
        aria-label="Time left in seconds"
        aria-valuemin={0}
        aria-valuemax={Math.round((question?.timeLimit || 0) / 1000)}
        aria-valuenow={seconds}
      >
        <Fill style={{ width: `${ratio * 100}%` }} />
      </Track>
      <span className="visually-hidden" aria-live="polite">
        {announcement}
      </span>
    </Wrap>
  );
}
