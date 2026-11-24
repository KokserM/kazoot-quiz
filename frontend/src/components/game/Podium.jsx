import React, { useLayoutEffect, useRef } from 'react';
import styled from 'styled-components';
import { formatPoints } from '../../lib/gameUi';
import { Icon } from '../Icon';
import { stageQuery } from './GameShell';

// The podium for 1, 2 and 3+ players (brief 8.9). DOM order is 1st, 2nd, 3rd; with three
// the visual order is 2nd · 1st · 3rd (CSS order). Names share one row (subgrid) so the
// pedestals stand on one floor and their heights compare: 100 % / 72 % / 52 % of the
// track that remains under the tallest name.
const List = styled.ol`
  list-style: none;
  margin: 0 auto;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
  grid-template-rows: auto minmax(0, 1fr);
  column-gap: 2cqw;
  width: min(100%, 720px);
  height: 100%;
  /* A podium, not a set of towers: on tall stages the pedestals stop growing. */
  max-height: 58cqh;
  min-height: 0;
  --numeral: clamp(calc(1.5rem * var(--floor, 1)), 5cqh, calc(4.5rem * var(--cap, 1)));
  --pedestal-pad: clamp(4px, 1.2cqh, 14px);
  &[data-count='2'] {
    width: min(100%, 480px);
  }
  &[data-count='1'] {
    width: min(56cqw, 320px);
    max-height: 44cqh;
  }

  li {
    grid-row: span 2;
    display: grid;
    grid-template-rows: subgrid;
    min-width: 0;
    min-height: 0;
  }
  li[data-place='1'] {
    order: 2;
  }
  li[data-place='2'] {
    order: 1;
  }
  li[data-place='3'] {
    order: 3;
  }
  &[data-count='2'] li[data-place='1'] {
    order: 1;
  }
  &[data-count='2'] li[data-place='2'] {
    order: 2;
  }

  .who {
    align-self: end;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding-bottom: 6px;
    min-width: 0;
    text-align: center;
  }
  .crown {
    color: var(--podium-1);
    width: 1.4em;
    height: 1.4em;
  }
  .name {
    max-width: 100%;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: clamp(calc(0.95rem * var(--floor, 1)), 2.6cqh, calc(2rem * var(--cap, 1)));
    line-height: 1.15;
    overflow: hidden;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
  .you {
    font-family: var(--font-body);
    font-weight: 400;
    font-size: clamp(calc(13px * var(--floor, 1)), 2cqh, calc(1.25rem * var(--cap, 1)));
    line-height: 1.2;
    color: var(--ink-2);
  }
  [data-s3] & .name,
  &[data-oneline] .name {
    -webkit-line-clamp: 1;
  }
  ${stageQuery.L} {
    .name {
      -webkit-line-clamp: 1;
    }
  }

  .pedestal {
    align-self: end;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 2px;
    /* Always tall enough for its numeral (3rd place is 52 % of the track). */
    min-height: max(calc(44px * var(--floor, 1)), calc(var(--numeral) + var(--pedestal-pad) + 6px));
    padding-top: var(--pedestal-pad);
    border-radius: 14px 14px 0 0;
    color: var(--answer-ink);
    overflow: hidden;
    transform-origin: 50% 100%;
  }
  li[data-place='1'] .pedestal {
    height: 100%;
    background: var(--podium-1);
  }
  li[data-place='2'] .pedestal {
    height: 72%;
    background: var(--podium-2);
  }
  li[data-place='3'] .pedestal {
    height: 52%;
    background: var(--podium-3);
  }
  .numeral {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: var(--numeral);
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .score,
  .correct {
    font-weight: 700;
    font-size: clamp(calc(0.8125rem * var(--floor, 1)), 2cqh, calc(1.25rem * var(--cap, 1)));
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .correct {
    font-weight: 400;
  }
  &[data-low] li:not([data-place='1']) .score,
  &[data-tiny] .score,
  &[data-tiny] .correct,
  li[data-noscore] .score,
  li[data-noscore] .correct {
    display: none;
  }
  &[data-tiny] .pedestal {
    padding-top: 3px;
  }

  /* E11: pedestals rise 3rd, 2nd, 1st; names and contents fade in as each lands. */
  @media (prefers-reduced-motion: no-preference) {
    .pedestal {
      animation: rise 520ms var(--ease-spring) backwards;
      animation-delay: var(--rise-delay);
    }
    .pedestal > *,
    .who {
      animation: fade-in 200ms ease-out backwards;
      animation-delay: calc(var(--rise-delay) + 420ms);
    }
  }
  li[data-place='3'] {
    --rise-delay: 0ms;
  }
  li[data-place='2'] {
    --rise-delay: 180ms;
  }
  li[data-place='1'] {
    --rise-delay: 360ms;
  }
  &[data-count='2'] li[data-place='2'] {
    --rise-delay: 0ms;
  }
  &[data-count='2'] li[data-place='1'] {
    --rise-delay: 180ms;
  }
  &[data-count='1'] li[data-place='1'] {
    --rise-delay: 0ms;
  }
`;

export function Podium({ entries, myPlayerId, className }) {
  const ref = useRef(null);
  const top = entries.slice(0, 3);

  // Under 85 px of track the score line is dropped on 2nd and 3rd.
  useLayoutEffect(() => {
    const list = ref.current;
    if (!list) return undefined;
    const measure = () => {
      const first = list.querySelector('li[data-place="1"] .pedestal');
      if (!first) return;
      const height = first.offsetHeight;
      if (height < 85) list.setAttribute('data-low', '');
      else list.removeAttribute('data-low');
      // Too short for a score line under the numeral even on the first pedestal.
      if (height < 64) list.setAttribute('data-tiny', '');
      else list.removeAttribute('data-tiny');
      // Any pedestal too short for its score line (3rd place at 52 %).
      for (const item of list.querySelectorAll('li')) {
        const pedestal = item.querySelector('.pedestal');
        if (!pedestal) continue;
        item.removeAttribute('data-noscore');
        if (pedestal.scrollHeight > pedestal.clientHeight + 1) item.setAttribute('data-noscore', '');
      }
    };
    measure();
    // Fonts arriving change the numerals' height without resizing any box.
    document.fonts?.ready?.then(measure);
    document.fonts?.addEventListener?.('loadingdone', measure);
    const timers = [250, 1000].map((delay) => setTimeout(measure, delay));
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(list);
    list.querySelectorAll('.pedestal').forEach((pedestal) => observer?.observe(pedestal));
    return () => {
      observer?.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', measure);
      timers.forEach(clearTimeout);
    };
  }, [top.length]);

  return (
    <List ref={ref} aria-label="Top three" data-count={top.length} style={{ '--cols': top.length }} className={className}>
      {top.map((entry, index) => (
        <li key={entry.playerId} data-place={index + 1}>
          <span className="who">
            {index === 0 ? <Icon name="crown" className="crown" /> : null}
            <span className="name" data-truncate="">
              {entry.username}
            </span>
            {entry.playerId === myPlayerId ? <span className="you">(you)</span> : null}
          </span>
          <span className="pedestal">
            <span className="numeral">
              <span className="visually-hidden">Rank </span>
              {entry.rank}
            </span>
            <span className="score">{formatPoints(entry.score)}</span>
            {top.length === 1 ? (
              <span className="correct">
                {entry.correctAnswerCount} of {entry.totalQuestions} correct
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </List>
  );
}
