import React from 'react';
import styled from 'styled-components';
import { formatPoints } from '../../lib/gameUi';

const List = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Item = styled.li`
  display: grid;
  grid-template-columns: 2.2em 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--radius);
  background: ${({ $me }) => ($me ? 'var(--accent-soft)' : 'var(--surface-sunk)')};
  outline: ${({ $me }) => ($me ? '2px solid var(--accent)' : 'none')};
  font-weight: 700;

  .rank {
    font-family: var(--font-display);
    color: var(--ink-3);
    font-variant-numeric: tabular-nums;
  }
  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    font-weight: 400;
    color: var(--ink-3);
    font-size: 0.88rem;
  }
  .detail {
    display: block;
  }
  .score {
    font-variant-numeric: tabular-nums;
  }
`;

export function Leaderboard({ entries, myPlayerId, limit = 10, showCorrect = false }) {
  const top = entries.slice(0, limit);
  const me = entries.find((entry) => entry.playerId === myPlayerId);
  const showMeSeparately = me && !top.includes(me);

  const renderEntry = (entry) => (
    <Item key={entry.playerId} $me={entry.playerId === myPlayerId}>
      <span className="rank">{entry.rank}</span>
      <span className="name">
        {entry.username}
        {entry.playerId === myPlayerId ? <span className="meta"> (you)</span> : null}
        {!entry.connected ? <span className="meta"> · offline</span> : null}
        {showCorrect ? (
          <span className="meta detail">
            {entry.correctAnswerCount} of {entry.totalQuestions} correct
          </span>
        ) : null}
      </span>
      <span className="score">{formatPoints(entry.score)}</span>
    </Item>
  );

  return (
    <List aria-label="Leaderboard">
      {top.map(renderEntry)}
      {showMeSeparately ? renderEntry(me) : null}
    </List>
  );
}
