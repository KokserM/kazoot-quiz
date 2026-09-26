import React from 'react';
import styled, { css } from 'styled-components';
import { ANSWER_LETTERS } from '../../lib/gameUi';
import { Icon } from '../Icon';
import { Spinner } from '../ui';

// Answer states, each distinct in shape, label and icon — never colour alone:
//   available   bright fill, dark text                     (tap me)
//   chosen      bright fill + thick ring, "Sending…"/"Locked in"   (neutral: not a verdict)
//   other       outline only, full-contrast text           (after you chose)
//   correct     fill + green ring + "✓ Correct"            (only after the reveal)
//   incorrect   outline only; your pick adds "✕ Your answer"
const COLORS = ['var(--answer-a)', 'var(--answer-b)', 'var(--answer-c)', 'var(--answer-d)'];

// Sized by its own width (container queries): phone, landing preview, projector.
const Wrap = styled.div`
  container-type: inline-size;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: clamp(1.05rem, 4.4cqi, 1.3rem);
  @container (min-width: 520px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: clamp(10px, 1.6cqi, 18px);
    font-size: clamp(1.05rem, 2.6cqi, 1.75rem);
    --tile-min: clamp(76px, 14vh, 150px);
  }
`;

const filled = css`
  background: ${({ $color }) => $color};
  color: var(--answer-ink);
  border-color: transparent;
`;

const outlined = css`
  background: var(--surface-sunk);
  color: var(--ink);
  border-color: ${({ $color }) => `color-mix(in srgb, ${$color} 55%, transparent)`};
`;

const tileStyles = css`
  position: relative;
  display: grid;
  /* Letter | text; tags and counts get their own rows so text is never squeezed. */
  grid-template-columns: auto 1fr;
  align-items: center;
  column-gap: 14px;
  row-gap: 8px;
  width: 100%;
  min-height: var(--tile-min, clamp(60px, 9vh, 84px));
  padding: 12px 14px;
  border-radius: 16px;
  border: 2px solid transparent;
  text-align: left;
  font-family: var(--font-body);
  font-weight: 700;
  font-size: inherit;
  line-height: 1.25;
  transition: transform 90ms ease, box-shadow 120ms ease, background-color 150ms ease, border-color 150ms ease;

  ${({ $state }) =>
    ({
      available: filled,
      chosen: css`
        ${filled}
        box-shadow: 0 0 0 3px var(--paper), 0 0 0 6px var(--ink);
      `,
      other: outlined,
      correct: css`
        ${filled}
        box-shadow: 0 0 0 3px var(--paper), 0 0 0 6px var(--correct-ring);
      `,
      incorrect: outlined,
    })[$state]}
`;

const ChoiceButton = styled.button`
  ${tileStyles}
  cursor: pointer;
  @media (hover: hover) {
    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 10px 22px -12px rgba(0, 0, 0, 0.6);
    }
  }
  &:active:not(:disabled) {
    transform: scale(0.985);
  }
  &:disabled {
    cursor: default;
  }
  /* Dashed so keyboard focus is never mistaken for the solid chosen/correct rings. */
  &:focus-visible {
    outline: 3px dashed var(--focus);
    outline-offset: 5px;
  }
`;

const ChoiceItem = styled.li`
  ${tileStyles}
`;

const Letter = styled.span`
  display: grid;
  place-items: center;
  width: 2em;
  height: 2em;
  border-radius: 10px;
  font-family: var(--font-display);
  font-weight: 700;
  /* Filled tile: navy chip with the tile colour as the letter. Outlined tile: the reverse. */
  color: ${({ $solid, $color }) => ($solid ? 'var(--answer-ink)' : $color)};
  background: ${({ $solid, $color }) => ($solid ? $color : 'var(--answer-ink)')};
`;

const Text = styled.span`
  min-width: 0;
  overflow-wrap: break-word;
`;

const Tag = styled.span`
  grid-column: 2;
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
  ${({ $tone }) =>
    ({
      neutral: css`
        background: var(--answer-ink);
        color: #ffffff;
      `,
      correct: css`
        background: var(--correct-ring);
        color: var(--answer-ink);
      `,
      yours: css`
        background: var(--danger-soft);
        color: var(--danger);
      `,
    })[$tone]}
`;

const Count = styled.span`
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 10px;
  font-size: 0.8em;
  font-weight: 700;
`;

const Bar = styled.span`
  height: 6px;
  border-radius: 3px;
  background: color-mix(in srgb, currentColor 18%, transparent);
  overflow: hidden;
  > span {
    display: block;
    height: 100%;
    background: currentColor;
    border-radius: 3px;
  }
`;

function RevealTag({ isCorrect, isMine }) {
  if (isCorrect) {
    return (
      <Tag $tone="correct">
        <Icon name="check" />
        {isMine ? 'Correct · yours' : 'Correct'}
      </Tag>
    );
  }
  if (isMine) {
    return (
      <Tag $tone="yours">
        <Icon name="x" />
        Your answer
      </Tag>
    );
  }
  return null;
}

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
        <Grid as="ul" aria-label="Answers">
          {choices.map((choice, index) => {
            const isCorrect = index === correctIndex;
            const isMine = index === selectedIndex;
            const percent = total ? Math.round((counts[index] / total) * 100) : 0;
            return (
              <ChoiceItem key={index} $color={COLORS[index]} $state={isCorrect ? 'correct' : 'incorrect'}>
                <Letter aria-hidden="true" $solid={!isCorrect} $color={COLORS[index]}>
                  {ANSWER_LETTERS[index]}
                </Letter>
                <Text>
                  <span className="visually-hidden">Answer {ANSWER_LETTERS[index]}: </span>
                  {choice}
                </Text>
                <RevealTag isCorrect={isCorrect} isMine={isMine} />
                {counts ? (
                  <Count>
                    <Bar aria-hidden="true">
                      <span style={{ width: `${percent}%` }} />
                    </Bar>
                    <span>
                      {counts[index]} {counts[index] === 1 ? 'player' : 'players'} · {percent}%
                    </span>
                  </Count>
                ) : null}
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
          const hasChoice = selectedIndex !== null;
          const isSelected = selectedIndex === index;
          const state = !hasChoice ? 'available' : isSelected ? 'chosen' : 'other';
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
              <Letter aria-hidden="true" $solid={state === 'other'} $color={COLORS[index]}>
                {ANSWER_LETTERS[index]}
              </Letter>
              <Text>
                <span className="visually-hidden">Answer {ANSWER_LETTERS[index]}: </span>
                {choice}
              </Text>
              {isSelected && selectionStatus === 'sending' ? (
                <Tag $tone="neutral">
                  <Spinner aria-hidden="true" style={{ marginRight: 0 }} />
                  Sending…
                </Tag>
              ) : isSelected && selectionStatus === 'locked' ? (
                <Tag $tone="neutral">
                  <Icon name="lock" />
                  Locked in
                </Tag>
              ) : null}
            </ChoiceButton>
          );
        })}
      </Grid>
    </Wrap>
  );
}
