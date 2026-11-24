import React, { useEffect, useRef } from 'react';
import styled, { css } from 'styled-components';
import { useRowsThatFit } from '../../lib/fitStage';
import { formatPoints, pickRows } from '../../lib/gameUi';
import { Icon } from '../Icon';

const List = styled.ol`
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
`;

// In the stage rows scale with it (brief 8.4); in a sheet they use page sizes.
const stageRow = css`
  height: clamp(calc(30px * var(--floor, 1)), 5cqh, calc(60px * var(--cap, 1)));
  font-size: clamp(calc(13px * var(--floor, 1)), 2.3cqh, calc(1.4rem * var(--cap, 1)));
  padding: 0 clamp(8px, 1.6cqw, 16px) 0 clamp(3px, 0.6cqh, 8px);
  gap: clamp(8px, 1.6cqw, 14px);
  .name .meta {
    font-size: max(calc(13px * var(--floor, 1)), 0.85em);
  }
`;

const pageRow = css`
  padding: 8px 12px 8px 8px;
  gap: 12px;
  .name .meta {
    font-size: 0.88rem;
  }
`;

const Item = styled.li`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  border-radius: 12px;
  line-height: 1.2;
  background: ${({ $me }) => ($me ? 'var(--accent-soft)' : 'var(--surface-sunk)')};
  box-shadow: ${({ $me }) => ($me ? 'inset 0 0 0 2px var(--accent-text)' : 'none')};
  ${({ $stage }) => ($stage ? stageRow : pageRow)}

  /* Measuring sample: above the list, where it adds no scrollable overflow. */
  &[data-probe] {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 100%;
    visibility: hidden;
    pointer-events: none;
  }
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
  }
  .detail {
    display: block;
    white-space: normal;
  }
  .score {
    font-family: var(--font-display);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
`;

const Rank = styled.span`
  display: grid;
  place-items: center;
  width: ${({ $stage }) => ($stage ? '1.9em' : '2.1em')};
  height: ${({ $stage }) => ($stage ? '1.9em' : '2.1em')};
  border-radius: 9px;
  font-family: var(--font-display);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  background: ${({ $rank }) => ($rank === 1 ? 'var(--answer-c)' : 'var(--surface)')};
  color: ${({ $rank }) => ($rank === 1 ? 'var(--answer-ink)' : 'var(--ink-2)')};
  border: 1px solid ${({ $rank }) => ($rank === 1 ? 'transparent' : 'var(--line)')};
`;

function Entry({ entry, myPlayerId, showCorrect, stage, probe, itemRef }) {
  return (
    <Item ref={itemRef} $me={entry.playerId === myPlayerId} $stage={stage} data-probe={probe || undefined} aria-hidden={probe || undefined}>
      <Rank $rank={entry.rank} $stage={stage} aria-label={probe ? undefined : `Rank ${entry.rank}`}>
        {entry.rank}
      </Rank>
      <span className="name" data-truncate="">
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
}

// The complete list (sheets): the top `limit` plus the viewer's row when further down.
export function Leaderboard({ entries, myPlayerId, limit = 10, showCorrect = false }) {
  const top = entries.slice(0, limit);
  const me = entries.find((entry) => entry.playerId === myPlayerId);
  const showMeSeparately = me && !top.includes(me);
  return (
    <List aria-label="Leaderboard">
      {top.map((entry) => (
        <Entry key={entry.playerId} entry={entry} myPlayerId={myPlayerId} showCorrect={showCorrect} />
      ))}
      {showMeSeparately ? <Entry entry={me} myPlayerId={myPlayerId} showCorrect={showCorrect} /> : null}
    </List>
  );
}

const FitBox = styled.div`
  flex: 1 1 0;
  &[data-align='end'] {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  min-height: calc(var(--min-rows, 0) * clamp(calc(30px * var(--floor, 1)), 5cqh, calc(60px * var(--cap, 1))) + max(0, var(--min-rows, 0) - 1) * 6px);
  min-width: 0;
  overflow: hidden;
  /* No container queries (G10): a plain list of the top rows. */
  @supports not (container-type: size) {
    flex: none;
    min-height: 0;
    overflow: visible;
  }
`;

// As many rows as fit in the space it is given (useRowsThatFit), at most `max`:
// the top rows, with the viewer's own row guaranteed (brief 8.8).
// minRows reserves room for that many rows before anything else is laid out.
export function FitLeaderboard({ entries, myPlayerId, max = 5, minRows = 0, label = 'Leaderboard', className, onShownChange, align }) {
  const boxRef = useRef(null);
  const probeRef = useRef(null);
  const slots = useRowsThatFit(boxRef, probeRef, { max, deps: [entries.length] });
  const rows = pickRows(entries, myPlayerId, Math.min(slots, entries.length));
  const sample = entries[0] || { playerId: '-', rank: 1, username: 'A', score: 0, connected: true };
  const shown = rows.length;
  useEffect(() => {
    onShownChange?.(shown);
  }, [shown, onShownChange]);
  return (
    <FitBox ref={boxRef} className={className} data-align={align} style={{ '--min-rows': Math.min(minRows, entries.length) }}>
      <List aria-label={label}>
        <Entry entry={sample} myPlayerId={null} stage probe itemRef={probeRef} />
        {rows.map((entry) => (
          <Entry key={entry.playerId} entry={entry} myPlayerId={myPlayerId} stage />
        ))}
      </List>
    </FitBox>
  );
}
