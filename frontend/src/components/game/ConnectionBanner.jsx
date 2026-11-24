import React from 'react';
import styled from 'styled-components';
import { Icon } from '../Icon';
import { Button } from '../ui';

// Honest connection state with a way out. Inside the game shell it is the second line of
// the top bar (compact: it takes height from the body, and the fit hooks re-run);
// elsewhere (joining) a normal notice.
const Box = styled.div`
  display: flex;
  align-items: center;
  gap: 8px 10px;
  padding: 6px 10px;
  border-radius: 10px;
  background: var(--warning-soft);
  border: 1px solid color-mix(in srgb, var(--warning) 35%, transparent);
  color: var(--ink);
  font-weight: 700;
  font-size: clamp(calc(13px * var(--floor, 1)), 2cqh, 1rem);
  line-height: 1.3;
  min-width: 0;
  > svg {
    color: var(--warning);
    flex: 0 0 auto;
  }
  .text {
    flex: 1 1 auto;
    min-width: 0;
  }
  .retry {
    flex: 0 0 auto;
  }
`;

export function ConnectionBanner({ connection, restarting, onRetry }) {
  let text = null;
  if (restarting) text = restarting;
  else if (connection === 'offline') text = 'You’re offline. Your seat is saved, and we’ll reconnect as soon as your network is back.';
  else if (connection === 'reconnecting') text = 'Connection lost. Reconnecting… Your seat and score are saved.';
  if (!text) return null;
  return (
    <Box role="status" data-banner="">
      <Icon name="alert" size="1.1em" />
      <span className="text">{text}</span>
      {!restarting && connection === 'reconnecting' ? (
        <Button size="sm" variant="secondary" className="retry" onClick={onRetry}>
          Retry now
        </Button>
      ) : null}
    </Box>
  );
}
