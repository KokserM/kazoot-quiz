import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
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

const Wrap = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 14px;
`;

const Seconds = styled.div`
  min-width: 2.2ch;
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 4vw, 2.6rem);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: ${({ $urgent }) => ($urgent ? 'var(--coral)' : 'var(--ink)')};
`;

const Track = styled.div`
  height: 10px;
  border-radius: 999px;
  background: var(--surface-sunk);
  overflow: hidden;
`;

const Fill = styled.div`
  height: 100%;
  border-radius: 999px;
  background: ${({ $urgent }) => ($urgent ? 'var(--coral)' : 'var(--accent)')};
  transition: width 200ms linear;
`;

export function Countdown({ question, remainingMs }) {
  const seconds = Math.ceil(remainingMs / 1000);
  const urgent = remainingMs <= 5000;
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
    <Wrap>
      <Seconds $urgent={urgent} aria-hidden="true">
        {seconds}
      </Seconds>
      <Track
        role="progressbar"
        aria-label="Time left in seconds"
        aria-valuemin={0}
        aria-valuemax={Math.round((question?.timeLimit || 0) / 1000)}
        aria-valuenow={seconds}
      >
        <Fill $urgent={urgent} style={{ width: `${ratio * 100}%` }} />
      </Track>
      <span className="visually-hidden" aria-live="polite">
        {announcement}
      </span>
    </Wrap>
  );
}
