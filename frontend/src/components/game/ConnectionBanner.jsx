import React from 'react';
import { Button, Notice } from '../ui';

// Honest connection state with a way out.
export function ConnectionBanner({ connection, restarting, onRetry }) {
  if (restarting) {
    return (
      <Notice $tone="warning">
        <span>{restarting}</span>
      </Notice>
    );
  }
  if (connection === 'offline') {
    return (
      <Notice $tone="warning">
        <span>You’re offline. Your seat is saved, and we’ll reconnect as soon as your network is back.</span>
      </Notice>
    );
  }
  if (connection === 'reconnecting') {
    return (
      <Notice $tone="warning">
        <span>Connection lost. Reconnecting… Your seat and score are saved.</span>
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Retry now
        </Button>
      </Notice>
    );
  }
  return null;
}
