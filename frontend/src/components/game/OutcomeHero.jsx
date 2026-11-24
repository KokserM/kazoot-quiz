import React, { forwardRef, useEffect, useRef } from 'react';
import styled, { css } from 'styled-components';
import { ANSWER_LETTERS, formatPoints, ordinal } from '../../lib/gameUi';
import { Icon } from '../Icon';
import { stageQuery } from './GameShell';

// "How did I do" at the top of the reveal (brief 8.8): verdict, points, rank. It is the
// h1 of the screen and takes focus when the results arrive.

const TONES = {
  correct: css`
    background: var(--success-soft);
    border-color: color-mix(in srgb, var(--success) 35%, transparent);
    --tone: var(--success);
  `,
  wrong: css`
    background: var(--danger-soft);
    border-color: color-mix(in srgb, var(--danger) 35%, transparent);
    --tone: var(--danger);
  `,
  none: css`
    background: var(--surface-sunk);
    border-color: color-mix(in srgb, var(--ink-3) 35%, transparent);
    --tone: var(--ink-2);
  `,
};

const Box = styled.h1`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: clamp(8px, 1.6cqh, 20px) clamp(12px, 3cqw, 28px);
  border-radius: 16px;
  border: 1px solid transparent;
  min-height: clamp(60px, 13cqh, 150px);
  font-family: var(--font-body);
  letter-spacing: 0;
  line-height: 1.1;
  text-wrap: initial;
  flex: 0 0 auto;
  ${({ $tone }) => TONES[$tone]}

  @media (prefers-reduced-motion: no-preference) {
    animation: pop var(--dur-base) var(--ease-spring) backwards;
    --pop-from: 0.96;
  }

  .verdict {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    min-width: 0;
  }
  .label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
    font-size: clamp(0.875rem, 2.3cqh, calc(1.5rem * var(--cap, 1)));
    color: var(--tone);
  }
  .value,
  .ordinal {
    font-family: var(--font-display);
    font-weight: 800;
    font-stretch: 88%;
    letter-spacing: -0.02em;
    font-size: clamp(1.6rem, min(9cqw, 6.2cqh), calc(5rem * var(--cap, 1)));
    color: var(--ink);
    font-variant-numeric: tabular-nums;
    line-height: 1;
    white-space: nowrap;
  }
  .big-verdict {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    font-family: var(--font-display);
    font-weight: 800;
    font-stretch: 88%;
    letter-spacing: -0.02em;
    font-size: clamp(1.25rem, min(6.5cqw, 4.6cqh), calc(3.5rem * var(--cap, 1)));
    color: var(--tone);
    line-height: 1.05;
  }
  .big-verdict svg {
    width: 0.8em;
    height: 0.8em;
  }
  .rank {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }
  .youre {
    font-weight: 700;
    font-size: clamp(0.8rem, 1.9cqh, calc(1.1rem * var(--cap, 1)));
    color: var(--ink-2);
  }

  /* Squeezed (very short stages): less padding, smaller numerals … */
  [data-s2] & {
    min-height: 0;
    padding-block: 6px;
    .value,
    .ordinal {
      font-size: clamp(1.35rem, min(8cqw, 5cqh), 2rem);
    }
  }
  /* … then one line: verdict · points · rank (portrait only; in mode L the block sits
     in a narrow column). */
  ${stageQuery.P} {
    [data-s3] & {
    padding-block: 4px;
    .verdict,
    .rank {
      flex-direction: row;
      align-items: baseline;
      gap: 8px;
    }
    .value,
    .ordinal,
    .big-verdict {
      font-size: 1.25rem;
    }
    }
  }

  /* Mode L: a compact block at the top of the right-hand column. */
  ${stageQuery.L} {
    min-height: 44px;
    padding: 4px 12px;
    gap: 8px;
    .label,
    .youre {
      font-size: 0.8rem;
    }
    .value,
    .ordinal {
      font-size: clamp(1.1rem, 7.5cqh, 1.75rem);
    }
    .big-verdict {
      font-size: clamp(1rem, 6cqh, 1.4rem);
    }
  }
`;

// Points count up from 0 (E10) in an aria-hidden span; the real value is in the
// visually hidden sentence from the start.
function CountUp({ value, duration = 600 }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const final = `+${formatPoints(value)}`;
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !value || typeof requestAnimationFrame === 'undefined') {
      element.textContent = final;
      return undefined;
    }
    let frame = 0;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      element.textContent = `+${formatPoints(Math.round(value * eased))}`;
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return (
    <span ref={ref} aria-hidden="true">
      +{formatPoints(value)}
    </span>
  );
}

export const OutcomeHero = forwardRef(function OutcomeHero({ roundResult, rank }, ref) {
  const tone = !roundResult || roundResult.answerIndex === null ? 'none' : roundResult.correct ? 'correct' : 'wrong';
  const sentence = [];
  if (roundResult) {
    if (roundResult.answerIndex === null) sentence.push('No answer this round.');
    else if (roundResult.correct) sentence.push(`Correct · +${formatPoints(roundResult.points)}.`);
    else sentence.push('Not this time.');
  }
  if (rank) sentence.push(`You’re ${ordinal(rank)}.`);

  return (
    <Box ref={ref} tabIndex={-1} $tone={tone} data-outcome={tone}>
      <span className="visually-hidden">{sentence.join(' ')}</span>
      <span className="verdict" aria-hidden="true">
        {!roundResult ? null : tone === 'correct' ? (
          <>
            <span className="label">
              <Icon name="check" />
              Correct
            </span>
            <span className="value">
              <CountUp value={roundResult.points} />
            </span>
          </>
        ) : tone === 'wrong' ? (
          <span className="big-verdict">
            <Icon name="x" />
            Not this time
          </span>
        ) : (
          <span className="big-verdict">
            <Icon name="dash" />
            No answer this round
          </span>
        )}
      </span>
      {rank ? (
        <span className="rank" aria-hidden="true">
          <span className="youre">You’re</span>
          <span className="ordinal">{ordinal(rank)}</span>
        </span>
      ) : null}
    </Box>
  );
});

const COLORS = ['var(--answer-a)', 'var(--answer-b)', 'var(--answer-c)', 'var(--answer-d)'];

const AnswerBox = styled.h1`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: clamp(10px, 2cqw, 24px);
  margin: 0;
  padding: clamp(8px, 1.8cqh, 24px) clamp(12px, 2.4cqw, 32px);
  border-radius: clamp(12px, 2.4cqh, 20px);
  background: ${({ $color }) => $color};
  color: var(--answer-ink);
  box-shadow: 0 0 0 3px var(--paper), 0 0 0 6px var(--correct-ring);
  margin: 6px;
  min-height: clamp(60px, 13cqh, 180px);
  max-height: 34cqh;
  font-family: var(--font-display);
  font-weight: 700;
  font-stretch: 90%;
  letter-spacing: -0.01em;
  line-height: 1.12;
  text-wrap: initial;
  flex: 0 0 auto;
  overflow: hidden;
  font-size: clamp(1.1rem, calc(min(4.4cqw, 5cqh) * var(--boost, 1) * var(--fit-a, 1)), calc(3.6rem * var(--cap, 1)));
  @media (prefers-reduced-motion: no-preference) {
    animation: pop var(--dur-base) var(--ease-spring) backwards;
    --pop-from: 0.96;
  }
  .letter {
    display: grid;
    place-items: center;
    width: 1.6em;
    height: 1.6em;
    border-radius: 0.3em;
    background: var(--answer-ink);
    color: ${({ $color }) => $color};
  }
  .text {
    min-width: 0;
    max-height: 100%;
    overflow: hidden;
    overflow-wrap: anywhere;
    hyphens: auto;
    &[data-clamped] {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: var(--lines, 2);
    }
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0.25em 0.6em;
    border-radius: 10px;
    font-family: var(--font-body);
    font-size: max(12px, 0.55em);
    background: var(--correct-ring);
    color: var(--answer-ink);
    white-space: nowrap;
  }
`;

// Big screen: the room wants the answer, not the host's personal outcome (brief 8.10).
export const CorrectAnswerHero = forwardRef(function CorrectAnswerHero({ choices, correctIndex, lang }, ref) {
  return (
    <AnswerBox ref={ref} tabIndex={-1} $color={COLORS[correctIndex] || COLORS[0]}>
      <span className="letter" aria-hidden="true">
        {ANSWER_LETTERS[correctIndex]}
      </span>
      <span className="text" data-fit="answer" lang={lang}>
        <span className="visually-hidden">Answer {ANSWER_LETTERS[correctIndex]}: </span>
        {choices[correctIndex]}
      </span>
      <span className="tag">
        <Icon name="check" />
        Correct
      </span>
    </AnswerBox>
  );
});
