import React from 'react';
import styled from 'styled-components';
import { formatPoints } from '../../lib/gameUi';
import { Icon } from '../Icon';

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
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 8px 12px 8px 8px;
  border-radius: 12px;
  background: ${({ $me }) => ($me ? 'var(--accent-soft)' : 'var(--surface-sunk)')};
  box-shadow: ${({ $me }) => ($me ? 'inset 0 0 0 2px var(--accent-text)' : 'none')};

  .name {
    min-width: 0;
    font-weight: 700;
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
    white-space: normal;
  }
  .score {
    font-family: var(--font-display);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
`;

const Rank = styled.span`
  display: grid;
  place-items: center;
  width: 2.1em;
  height: 2.1em;
  border-radius: 9px;
  font-family: var(--font-display);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  background: ${({ $rank }) => ($rank === 1 ? 'var(--answer-c)' : 'var(--surface)')};
  color: ${({ $rank }) => ($rank === 1 ? 'var(--answer-ink)' : 'var(--ink-2)')};
  border: 1px solid ${({ $rank }) => ($rank === 1 ? 'transparent' : 'var(--line)')};
`;

export function Leaderboard({ entries, myPlayerId, limit = 10, showCorrect = false }) {
  const top = entries.slice(0, limit);
  const me = entries.find((entry) => entry.playerId === myPlayerId);
  const showMeSeparately = me && !top.includes(me);

  const renderEntry = (entry) => (
    <Item key={entry.playerId} $me={entry.playerId === myPlayerId}>
      <Rank $rank={entry.rank} aria-label={`Rank ${entry.rank}`}>
        {entry.rank}
      </Rank>
      <span className="name">
        {entry.username}
        {entry.playerId === myPlayerId ? <span className="meta"> (you)</span> : null}
        {!entry.connected ? (
          <span className="meta">
            {' '}
            · <Icon name="wifiOff" /> offline
          </span>
        ) : null}
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
