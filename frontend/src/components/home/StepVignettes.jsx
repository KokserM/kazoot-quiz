import React, { lazy, Suspense } from 'react';
import styled from 'styled-components';
import { CREATE_EXAMPLES } from '../../lib/copy';

// Small, real pieces of the UI on top of each "Ready in about a minute" step (brief 6.1).
// Decorative (aria-hidden), stage palette in both themes, existing strings only.

const QRCodeSVG = lazy(() => import('qrcode.react').then((module) => ({ default: module.QRCodeSVG })));

const JOIN_URL = 'https://www.kazoot.app/join';

const Vignette = styled.div`
  min-height: 190px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  background: var(--surface-sunk);
  color: var(--ink);
  box-shadow: inset 0 4px 0 var(--accent-line);

  .eyebrow {
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.12em;
    line-height: 1.2;
    text-transform: uppercase;
    color: var(--ink-3);
  }
`;

const TopicField = styled.div`
  display: grid;
  gap: 6px;
  font-weight: 700;
  font-size: 0.85rem;
  .input {
    padding: 11px 13px;
    border-radius: var(--radius);
    border: 2px solid var(--line-strong);
    background: var(--paper);
    font-size: 1rem;
    font-weight: 400;
  }
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  color: var(--ink-2);
  .chip {
    padding: 5px 10px;
    border-radius: 9px;
    border: 1.5px solid var(--line-strong);
    color: var(--ink);
    font-weight: 700;
  }
`;

const InviteRow = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  .qr {
    flex: 0 0 auto;
    width: 76px;
    height: 76px;
    padding: 8px;
    border-radius: 10px;
    background: #fff;
  }
  .qr svg { width: 100%; height: 100%; }
  .code {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: clamp(1.25rem, 2vw, 1.6rem);
    letter-spacing: 0.05em;
    line-height: 1;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
`;

const Board = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
  li {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 7px 10px 7px 7px;
    border-radius: 11px;
    background: var(--paper);
  }
  li.me {
    background: var(--accent-soft);
    box-shadow: inset 0 0 0 2px var(--accent-text);
  }
  b {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    background: var(--surface-sunk);
    color: var(--ink);
    font-family: var(--font-display);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }
  li:first-child b { background: var(--answer-c); color: var(--answer-ink); }
  .bar {
    height: 9px;
    border-radius: 5px;
    background: var(--line-strong);
    opacity: 0.7;
  }
  .bar.score { width: 38px; }
`;

function Frame({ accent, children }) {
  return (
    <Vignette className="vignette" aria-hidden="true" data-stage-scope="" style={{ '--accent-line': `var(--answer-${accent})` }}>
      {children}
    </Vignette>
  );
}

export function TopicVignette() {
  const ideas = [CREATE_EXAMPLES[0], CREATE_EXAMPLES[2], CREATE_EXAMPLES[3]];
  return (
    <Frame accent="a">
      <TopicField>
        <span>Topic</span>
        <span className="input">{CREATE_EXAMPLES[1]}</span>
      </TopicField>
      <Chips>
        Ideas:
        {ideas.map((idea) => (
          <span key={idea} className="chip">
            {idea}
          </span>
        ))}
      </Chips>
    </Frame>
  );
}

export function InviteVignette() {
  return (
    <Frame accent="b">
      <span className="eyebrow">Invite players</span>
      <InviteRow>
        <span className="qr">
          <Suspense fallback={null}>
            <QRCodeSVG value={JOIN_URL} size={60} level="M" fgColor="#140E22" />
          </Suspense>
        </span>
        <span className="code">ABCDE 23456</span>
      </InviteRow>
    </Frame>
  );
}

export function LeaderboardVignette() {
  return (
    <Frame accent="c">
      <span className="eyebrow">Leaderboard</span>
      <Board>
        {[62, 48, 70].map((width, index) => (
          <li key={width} className={index === 0 ? 'me' : undefined}>
            <b>{index + 1}</b>
            <span className="bar" style={{ width: `${width}%` }} />
            <span className="bar score" />
          </li>
        ))}
      </Board>
    </Frame>
  );
}
