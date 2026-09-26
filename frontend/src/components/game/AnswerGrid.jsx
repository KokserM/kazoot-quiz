import React from 'react';
import styled, { css } from 'styled-components';
import { ANSWER_LETTERS } from '../../lib/gameUi';

const COLORS = ['var(--answer-a)', 'var(--answer-b)', 'var(--answer-c)', 'var(--answer-d)'];

// Sized by its own width (container queries), so the same grid works on a
// phone, in the landing-page preview and on a projector.
const Wrap = styled.div`
  container-type: inline-size;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  font-size: clamp(1rem, 4.2cqi, 1.25rem);
  @container (min-width: 460px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    font-size: clamp(1rem, 2.6cqi, 1.6rem);
    gap: clamp(10px, 1.5cqi, 16px);
  }
`;

const choiceStyles = css`
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: clamp(60px, 10vh, 110px);
  padding: 12px 14px;
  border-radius: var(--radius-lg);
  border: 3px solid transparent;
  background: ${({ $color }) => $color};
  color: #fff;
  text-align: left;
  font-weight: 700;
  font-size: inherit;
  line-height: 1.25;
  transition: opacity 150ms ease, transform 80ms ease, filter 150ms ease;

  ${({ $state, $color }) =>
    ({
      // Not chosen / not correct: neutral tile, full-contrast text, colour kept as a border.
      dimmed: css`
        background: var(--surface-sunk);
        color: var(--ink-2);
        border-color: ${$color};
      `,
      chosen: css`
        border-color: var(--ink);
        box-shadow: 0 0 0 3px var(--paper) inset;
      `,
      correct: css`
        box-shadow: 0 0 0 4px var(--success);
      `,
      wrong: css`
        background: var(--surface-sunk);
        color: var(--ink-2);
        border-color: ${$color};
      `,
    })[$state] || ''}
`;

const ChoiceButton = styled.button`
  ${choiceStyles}
  cursor: pointer;
  &:active:not(:disabled) {
    transform: scale(0.99);
  }
  &:disabled {
    cursor: default;
  }
  &:focus-visible {
    outline: 4px solid var(--focus);
    outline-offset: 3px;
  }
`;

const ChoiceItem = styled.li`
  ${choiceStyles}
  list-style: none;
`;

const Letter = styled.span`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 2em;
  height: 2em;
  border-radius: 10px;
  color: #fff;
  background: ${({ $color }) => $color};
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.45);
  font-family: var(--font-display);
`;

const Text = styled.span`
  flex: 1;
  min-width: 0;
  overflow-wrap: break-word;
  hyphens: auto;
`;

const Tag = styled.span`
  position: absolute;
  top: -10px;
  right: 10px;
  padding: 2px 10px;
  font-family: var(--font-body);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  color: #1c1a17;
  font-size: 0.8rem;
`;

// mode 'answer': clickable choices. mode 'reveal': correct answer, your pick and counts.
export function AnswerGrid({
  choices,
  mode = 'answer',
  selectedIndex = null,
  selectionStatus = null,
  correctIndex = null,
  counts = null,
  disabled = false,
  onSelect,
}) {
  const total = counts ? counts.reduce((sum, count) => sum + count, 0) : 0;

  if (mode === 'reveal') {
    return (
      <Wrap>
      <Grid as="ul" aria-label="Answers" style={{ margin: 0, padding: 0 }}>
        {choices.map((choice, index) => {
          const isCorrect = index === correctIndex;
          const isMine = index === selectedIndex;
          const tag = isCorrect && isMine ? 'Correct · yours' : isCorrect ? 'Correct' : isMine ? 'Your answer' : null;
          return (
            <ChoiceItem key={index} $color={COLORS[index]} $state={isCorrect ? 'correct' : 'wrong'}>
              <Letter aria-hidden="true" $color={COLORS[index]}>{ANSWER_LETTERS[index]}</Letter>
              <Text>
                <span className="visually-hidden">Answer {ANSWER_LETTERS[index]}: </span>
                {choice}
                {counts ? (
                  <span style={{ display: 'block', fontSize: '0.8em', fontWeight: 400 }}>
                    {counts[index]} {counts[index] === 1 ? 'player' : 'players'}
                    {total ? ` · ${Math.round((counts[index] / total) * 100)}%` : ''}
                  </span>
                ) : null}
              </Text>
              {tag ? <Tag>{tag}</Tag> : null}
            </ChoiceItem>
          );
        })}
      </Grid>
      </Wrap>
    );
  }

  return (
    <Wrap>
    <Grid role="group" aria-label="Answers">
      {choices.map((choice, index) => {
        const isSelected = selectedIndex === index;
        const state = selectedIndex === null ? null : isSelected ? 'chosen' : 'dimmed';
        const tag = isSelected ? (selectionStatus === 'sending' ? 'Sending…' : selectionStatus === 'locked' ? 'Locked in' : null) : null;
        return (
          <ChoiceButton
            key={index}
            type="button"
            $color={COLORS[index]}
            $state={state}
            disabled={disabled}
            aria-pressed={isSelected}
            onClick={() => onSelect(index)}
          >
            <Letter aria-hidden="true" $color={COLORS[index]}>{ANSWER_LETTERS[index]}</Letter>
            <Text>
              <span className="visually-hidden">Answer {ANSWER_LETTERS[index]}: </span>
              {choice}
            </Text>
            {tag ? <Tag>{tag}</Tag> : null}
          </ChoiceButton>
        );
      })}
    </Grid>
    </Wrap>
  );
}
