import React from 'react';
import styled, { css } from 'styled-components';
import { ANSWER_LETTERS, answerTier, visibleAnswerCounts } from '../../lib/gameUi';
import { Icon } from '../Icon';
import { Spinner } from '../ui';
import { stageQuery } from './GameShell';

// Answer states, each distinct in shape, label and icon — never colour alone:
//   available   bright fill, dark text                     (tap me)
//   chosen      bright fill + thick ring, "Sending…"/"Locked in" corner badge (not a verdict)
//   other       outline only, full-contrast text           (after you chose)
//   correct     fill + green ring + "✓ Correct"            (only after the reveal)
//   incorrect   outline only; your pick adds "✕ Your answer"
//
// Sizes come from the game stage (cq units of container `game`, GameShell); the grid
// does not declare a container of its own. Inside the shell it fills the height it is
// given: tiles share it equally (grid-auto-rows: minmax(0, 1fr)).
const COLORS = ['var(--answer-a)', 'var(--answer-b)', 'var(--answer-c)', 'var(--answer-d)'];

// Answer type: by the longest answer (brief 8.4).
const answerType = css`
  &[data-alen='s'] {
    --a-tier: min(5.2cqw, 3.4cqh);
  }
  &[data-alen='m'] {
    --a-tier: min(4.8cqw, 3.1cqh);
  }
  &[data-alen='l'] {
    --a-tier: min(4.1cqw, 2.5cqh);
  }
  ${stageQuery.L} {
    &[data-alen='s'] {
      --a-tier: min(2.6cqw, 6.4cqh);
    }
    &[data-alen='m'] {
      --a-tier: min(2.3cqw, 5.4cqh);
    }
    &[data-alen='l'] {
      --a-tier: min(2cqw, 4.6cqh);
    }
  }
  font-size: clamp(calc(13px * var(--floor, 1)), calc(var(--a-tier, 1.1rem) * var(--boost, 1) * var(--fit-a, 1)), calc(2.6rem * var(--cap, 1)));
`;

const Grid = styled.div`
  ${answerType}
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-auto-rows: minmax(0, 1fr);
  gap: clamp(6px, 1.3cqh, 18px);
  margin: 0;
  padding: 0;
  list-style: none;
  min-height: 0;
  min-width: 0;
  @supports (container-type: size) {
    height: 100%;
  }
  &[data-cols='2'] {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  align-items: center;
  column-gap: clamp(8px, 1.6cqw, 18px);
  width: 100%;
  min-width: calc(44px * var(--floor, 1));
  min-height: 0;
  padding: clamp(6px, 1.3cqh, 20px) clamp(10px, 2.2cqw, 28px);
  border-radius: clamp(12px, 2.4cqh, 20px);
  border: 2px solid transparent;
  text-align: left;
  font-family: var(--font-body);
  font-weight: 700;
  font-size: inherit;
  line-height: 1.22;
  transition: transform var(--dur-press) ease, box-shadow 120ms ease, background-color 150ms ease, border-color 150ms ease;

  /* Portrait 2×2: the letter sits above the text so a tile keeps ~15 characters per line. */
  ${stageQuery.P} {
    [data-cols='2'] > & {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, auto);
      align-content: center;
      justify-items: start;
      row-gap: clamp(4px, 1cqh, 12px);
    }
  }

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

  /* E5: tiles settle in at the start of each question (tappable from the first frame). */
  @media (prefers-reduced-motion: no-preference) {
    &[data-settle] {
      animation: settle var(--dur-base) var(--ease-out) backwards;
      animation-delay: calc(var(--i, 0) * 50ms);
    }
  }
`;

const ChoiceButton = styled.button`
  ${tileStyles}
  cursor: pointer;
  min-height: calc(44px * var(--floor, 1));
  @media (hover: hover) {
    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 10px 22px -12px rgba(0, 0, 0, 0.6);
    }
    &[data-state='chosen']:hover:not(:disabled) {
      box-shadow: 0 0 0 3px var(--paper), 0 0 0 6px var(--ink);
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

const ChoiceTile = styled.li`
  ${tileStyles}
  .count-short {
    display: none;
    align-items: center;
    gap: 4px;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: max(calc(12px * var(--floor, 1)), 0.85em);
    font-variant-numeric: tabular-nums;
  }
  .inline-letter {
    display: none;
  }
  /* Mode L: the answer takes the whole tile and flows around the letter (left) and a
     compact count (right), so short landscape tiles keep two full lines. */
  ${stageQuery.L} {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    align-items: center;
    padding: 4px 8px;
    > .letter,
    > .tile-body > .count-full {
      display: none;
    }
    > .tile-body > .tile-text {
      max-height: 100%;
    }
    /* No taller than one line, so only the first line makes room for it. */
    .inline-letter {
      display: grid;
      float: left;
      margin: 0 0.4em 0 0;
      width: 1.3em;
      height: 1.2em;
      line-height: 1.2em;
      border-radius: 5px;
      font-size: max(calc(13px * var(--floor, 1)), 0.85em);
    }
    .count-short {
      display: inline-flex;
      float: right;
      height: 1.2em;
      line-height: 1.2em;
      margin: 0 0 0 0.5em;
      font-size: max(calc(13px * var(--floor, 1)), 0.85em);
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    &[data-state='correct'] {
      animation: bump var(--dur-base) var(--ease-out) 1;
    }
  }
`;

const Letter = styled.span`
  display: grid;
  place-items: center;
  align-self: center;
  width: clamp(calc(22px * var(--floor, 1)), 1.9em, 60px);
  height: clamp(calc(22px * var(--floor, 1)), 1.9em, 60px);
  border-radius: max(7px, 0.32em);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: max(calc(12px * var(--floor, 1)), 0.9em);
  line-height: 1;
  /* Filled tile: navy chip with the tile colour as the letter. Outlined tile: the reverse. */
  color: ${({ $solid, $color }) => ($solid ? 'var(--answer-ink)' : $color)};
  background: ${({ $solid, $color }) => ($solid ? $color : 'var(--answer-ink)')};
`;

const quizText = css`
  min-width: 0;
  /* Room for the font's ascent/descent below the last line box (not overflow). */
  padding-block: 0.06em;
  overflow-wrap: anywhere;
  hyphens: auto;
  overflow: hidden;
  &[data-clamped] {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--lines, 2);
  }
`;

const Text = styled.span`
  ${quizText}
  display: block;
  max-height: 100%;
`;

const TileBody = styled.span`
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.3em;
  min-width: 0;
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
  > [data-fit] {
    flex: 0 1 auto;
    min-height: 0;
    max-height: none;
  }
  > :not([data-fit]) {
    flex: 0 0 auto;
  }
`;

// Reveal tiles: the verdict tag sits on the top edge, like the "Locked in" badge.
const Corner = styled.span`
  position: absolute;
  top: -11px;
  right: 10px;
  display: flex;
  > span {
    box-shadow: 0 0 0 2px var(--paper);
    font-size: clamp(calc(12px * var(--floor, 1)), 1.7cqh, 1rem);
  }
`;

// Corner badge: the chosen state changes no tile's size.
const Badge = styled.span`
  position: absolute;
  top: -9px;
  right: 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  padding: 0 9px;
  border-radius: 8px;
  font-size: clamp(calc(12px * var(--floor, 1)), 1.7cqh, 0.9rem);
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  background: var(--answer-ink);
  color: #ffffff;
  box-shadow: 0 0 0 2px var(--paper);
  .spinner {
    margin: 0;
  }
`;

const Tag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 8px;
  font-size: max(calc(12px * var(--floor, 1)), 0.7em);
  font-weight: 700;
  line-height: 1.1;
  white-space: nowrap;
  flex: 0 0 auto;
  ${({ $tone }) =>
    ({
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

const CountLine = styled.span`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  font-size: max(calc(13px * var(--floor, 1)), 0.75em);
  font-weight: 700;
  line-height: 1.2;
`;

const CountBar = styled.span`
  height: 6px;
  border-radius: 3px;
  background: color-mix(in srgb, currentColor 18%, transparent);
  overflow: hidden;
  > span {
    display: block;
    height: 100%;
    background: currentColor;
    border-radius: 3px;
    transform-origin: left center;
  }
`;

// --------------------------------------------------------------- compact reveal rows

const Rows = styled.ul`
  ${answerType}
  /* Rows are smaller than tiles: their own formula (brief 8.8). */
  font-size: clamp(calc(13px * var(--floor, 1)), calc(min(4.2cqw, 2.4cqh) * var(--boost, 1) * var(--fit-a, 1)), calc(1.4rem * var(--cap, 1)));
  display: flex;
  flex-direction: column;
  gap: clamp(4px, 0.9cqh, 10px);
  margin: 0;
  /* Room for the correct row's ring inside the clipped stage body. */
  padding: 4px;
  /* Narrow lists keep the tags' icons and give the width to the answer text; the
     words stay for screen readers. */
  container-type: inline-size;
  @container (max-width: 379px) {
    .tag-word {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
    }
    .tag {
      padding: 3px 5px;
    }
  }
  list-style: none;
  min-width: 0;
  min-height: 0;
  ${stageQuery.L} {
    display: grid;
    grid-auto-rows: minmax(0, 1fr);
    height: 100%;
  }
`;

const Row = styled.li`
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  column-gap: clamp(8px, 2cqw, 14px);
  min-height: clamp(calc(26px * var(--floor, 1)), 5.2cqh, 64px);
  padding: 3px clamp(8px, 2.2cqw, 16px);
  border-radius: 12px;
  border: 2px solid ${({ $color }) => `color-mix(in srgb, ${$color} 55%, transparent)`};
  background: var(--surface-sunk);
  color: var(--ink-2);
  font-weight: 700;
  line-height: 1.22;
  overflow: hidden;
  min-width: 0;
  ${stageQuery.L} {
    min-height: 0;
  }
  &[data-state='correct'] {
    background: ${({ $color }) => $color};
    color: var(--answer-ink);
    border-color: transparent;
    box-shadow: 0 0 0 2px var(--paper), 0 0 0 4px var(--correct-ring);
    --max-lines: 3;
    @media (prefers-reduced-motion: no-preference) {
      animation: bump var(--dur-base) var(--ease-out) 1;
    }
  }
  &[data-state='mine'] {
    color: var(--ink);
  }
  .letter {
    width: 1.75em;
    height: 1.75em;
    border-radius: 7px;
    font-size: max(calc(12px * var(--floor, 1)), 0.85em);
  }
  .row-text {
    ${quizText}
    display: block;
    max-height: calc(var(--max-lines, 2) * 1.22em + 0.12em);
    box-sizing: border-box;
  }
  ${stageQuery.L} {
    grid-template-rows: minmax(0, 1fr);
    .row-text {
      max-height: min(calc(var(--max-lines, 2) * 1.22em + 0.12em), 100%);
    }
  }
  .trail {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .count {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: max(calc(12px * var(--floor, 1)), 0.85em);
    font-variant-numeric: tabular-nums;
  }
  .share {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    background: currentColor;
    opacity: 0.6;
    transform-origin: left center;
  }
`;

function RevealTag({ isCorrect, isMine, hidePick }) {
  if (isCorrect) {
    return (
      <Tag $tone="correct" className="tag">
        <Icon name="check" />
        <span className="tag-word">{isMine && !hidePick ? 'Correct · yours' : 'Correct'}</span>
      </Tag>
    );
  }
  if (isMine && !hidePick) {
    return (
      <Tag $tone="yours" className="tag">
        <Icon name="x" />
        <span className="tag-word">Your answer</span>
      </Tag>
    );
  }
  return null;
}

const playersLabel = (count) => `${count} ${count === 1 ? 'player' : 'players'}`;

export function AnswerGrid({
  choices,
  mode = 'answer',
  selectedIndex = null,
  selectionStatus = null,
  correctIndex = null,
  counts = null,
  playerCount,
  disabled = false,
  onSelect,
  columns = 1,
  compact = false,
  hidePick = false,
  lang,
  settleKey,
  className,
}) {
  const alen = answerTier(choices);
  // Counts only above 0 and only with more than one player in the room (never solo).
  const roomSize = playerCount ?? (counts ? counts.reduce((sum, count) => sum + count, 0) : 0);
  const shown = visibleAnswerCounts(counts, roomSize);
  const total = shown ? shown.reduce((sum, count) => sum + count, 0) : 0;

  if (mode === 'reveal' && compact) {
    return (
      <Rows aria-label="Answers" data-alen={alen} className={className}>
        {choices.map((choice, index) => {
          const isCorrect = index === correctIndex;
          const isMine = index === selectedIndex && !hidePick;
          const count = shown ? shown[index] : 0;
          const share = total ? count / total : 0;
          return (
            <Row key={index} $color={COLORS[index]} data-state={isCorrect ? 'correct' : isMine ? 'mine' : 'other'} data-fit-box="">
              <Letter className="letter" aria-hidden="true" $solid={!isCorrect} $color={COLORS[index]}>
                {ANSWER_LETTERS[index]}
              </Letter>
              <span className="row-text" data-fit="answer" lang={lang}>
                <span className="visually-hidden">Answer {ANSWER_LETTERS[index]}: </span>
                {choice}
              </span>
              <span className="trail">
                {count > 0 ? (
                  <span className="count">
                    <span className="visually-hidden">{playersLabel(count)}</span>
                    <Icon name="users" />
                    <span aria-hidden="true">{count}</span>
                  </span>
                ) : null}
                <RevealTag isCorrect={isCorrect} isMine={index === selectedIndex} hidePick={hidePick} />
              </span>
              {count > 0 ? <span className="share" aria-hidden="true" style={{ transform: `scaleX(${share})` }} /> : null}
            </Row>
          );
        })}
      </Rows>
    );
  }

  if (mode === 'reveal') {
    return (
      <Grid as="ul" aria-label="Answers" data-alen={alen} data-cols={columns} className={className}>
        {choices.map((choice, index) => {
          const isCorrect = index === correctIndex;
          const isMine = index === selectedIndex;
          const count = shown ? shown[index] : 0;
          const percent = total ? Math.round((count / total) * 100) : 0;
          return (
            <ChoiceTile key={index} $color={COLORS[index]} $state={isCorrect ? 'correct' : 'incorrect'} data-state={isCorrect ? 'correct' : 'incorrect'}>
              <Letter className="letter" aria-hidden="true" $solid={!isCorrect} $color={COLORS[index]}>
                {ANSWER_LETTERS[index]}
              </Letter>
              <TileBody className="tile-body">
                <Text className="tile-text" data-fit="answer" lang={lang}>
                  <Letter className="inline-letter" aria-hidden="true" $solid={!isCorrect} $color={COLORS[index]}>
                    {ANSWER_LETTERS[index]}
                  </Letter>
                  {count > 0 ? (
                    <span className="count-short">
                      <span className="visually-hidden">{playersLabel(count)}</span>
                      <Icon name="users" />
                      <span aria-hidden="true">{count}</span>
                    </span>
                  ) : null}
                  <span className="visually-hidden">Answer {ANSWER_LETTERS[index]}: </span>
                  {choice}
                </Text>
                {count > 0 ? (
                  <CountLine className="count-full">
                    <CountBar aria-hidden="true">
                      <span style={{ transform: `scaleX(${percent / 100})` }} />
                    </CountBar>
                    <span>
                      {playersLabel(count)} · {percent}%
                    </span>
                  </CountLine>
                ) : null}
              </TileBody>
              {isCorrect || (isMine && !hidePick) ? (
                <Corner>
                  <RevealTag isCorrect={isCorrect} isMine={isMine} hidePick={hidePick} />
                </Corner>
              ) : null}
            </ChoiceTile>
          );
        })}
      </Grid>
    );
  }

  return (
    <Grid role="group" aria-label="Answers" data-alen={alen} data-cols={columns} className={className} key={settleKey}>
      {choices.map((choice, index) => {
        const hasChoice = selectedIndex !== null;
        const isSelected = selectedIndex === index;
        // Big screen: the host's own pick stays private (all four outlined, no badge).
        const state = !hasChoice ? 'available' : isSelected && !hidePick ? 'chosen' : 'other';
        return (
          <ChoiceButton
            key={index}
            type="button"
            $color={COLORS[index]}
            $state={state}
            data-state={state}
            data-settle={settleKey !== undefined ? '' : undefined}
            style={{ '--i': index }}
            disabled={disabled}
            aria-pressed={isSelected}
            onClick={() => onSelect(index)}
          >
            <Letter aria-hidden="true" $solid={state === 'other'} $color={COLORS[index]}>
              {ANSWER_LETTERS[index]}
            </Letter>
            <Text data-fit="answer" lang={lang}>
              <span className="visually-hidden">Answer {ANSWER_LETTERS[index]}: </span>
              {choice}
            </Text>
            {isSelected && !hidePick && selectionStatus === 'sending' ? (
              <Badge>
                <Spinner className="spinner" aria-hidden="true" />
                Sending…
              </Badge>
            ) : isSelected && !hidePick && selectionStatus === 'locked' ? (
              <Badge>
                <Icon name="lock" />
                Locked in
              </Badge>
            ) : null}
          </ChoiceButton>
        );
      })}
    </Grid>
  );
}
