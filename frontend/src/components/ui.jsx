import React, { forwardRef, useId } from 'react';
import { Link } from 'react-router-dom';
import styled, { css, keyframes } from 'styled-components';
import { Icon } from './Icon';

// Small, consistent building blocks. Colours and spacing come from the CSS
// variables in styles/GlobalStyle.js.

// Complete text styles for the type tokens (brief 4.2). Use inside styled components:
//   const Title = styled.h2`${textStyle.h2}`;
// Width is set with font-stretch (the display font's width axis), so it inherits.
const display = css`
  font-family: var(--font-display);
  font-weight: 800;
`;
export const textStyle = {
  hero: css`${display} font-size: var(--type-hero); font-stretch: 82%; line-height: 0.94; letter-spacing: -0.035em;`,
  display: css`${display} font-size: var(--type-display); font-stretch: 84%; line-height: 1; letter-spacing: -0.03em;`,
  h2: css`${display} font-size: var(--type-h2); font-stretch: 88%; line-height: 1.05; letter-spacing: -0.02em;`,
  page: css`${display} font-size: var(--type-page); font-stretch: 88%; line-height: 1.05; letter-spacing: -0.02em;`,
  h3: css`font-family: var(--font-display); font-weight: 700; font-size: var(--type-h3); font-stretch: 100%; line-height: 1.1; letter-spacing: -0.02em;`,
  h3Group: css`font-family: var(--font-display); font-weight: 700; font-size: var(--type-h3-group); font-stretch: 100%; line-height: 1.1; letter-spacing: -0.02em;`,
  h4: css`font-family: var(--font-display); font-weight: 700; font-size: var(--type-h4); font-stretch: 100%; line-height: 1.15; letter-spacing: -0.01em;`,
  price: css`${display} font-size: var(--type-price); font-stretch: 92%; line-height: 1; letter-spacing: -0.03em; font-variant-numeric: tabular-nums;`,
  lead: css`font-family: var(--font-body); font-weight: 400; font-size: var(--type-lead); line-height: 1.5;`,
  body: css`font-family: var(--font-body); font-weight: 400; font-size: var(--type-body); line-height: 1.55;`,
  small: css`font-family: var(--font-body); font-weight: 400; font-size: var(--type-small); line-height: 1.45;`,
  caption: css`font-family: var(--font-body); font-weight: 400; font-size: var(--type-caption); line-height: 1.4;`,
  eyebrow: css`font-family: var(--font-body); font-weight: 700; font-size: var(--type-eyebrow); line-height: 1.2; letter-spacing: 0.12em; text-transform: uppercase;`,
  // Prices, counts, room codes, timers, ranks and scores (fixes Atkinson's slashed zero).
  numerals: css`font-family: var(--font-display); font-variant-numeric: tabular-nums;`,
};

export const Container = styled.div`
  width: 100%;
  max-width: ${({ $narrow }) => ($narrow ? 'var(--max-narrow)' : 'var(--max)')};
  margin: 0 auto;
  padding: 0 var(--gutter);
`;

export const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ $gap = 16 }) => `${$gap}px`};
  align-items: ${({ $align = 'stretch' }) => $align};
`;

export const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: ${({ $align = 'center' }) => $align};
  justify-content: ${({ $justify = 'flex-start' }) => $justify};
  gap: ${({ $gap = 12 }) => `${$gap}px`};
`;

export const Card = styled.section`
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: ${({ $pad = 'clamp(18px, 3vw, 28px)' }) => $pad};
  box-shadow: var(--shadow);
  /* Inputs inside a card read as wells on dark (brief 5.2). */
  --field-bg: var(--field-well);
`;

export const Eyebrow = styled.p`
  font-size: var(--type-eyebrow);
  font-weight: 700;
  letter-spacing: 0.12em;
  line-height: 1.2;
  text-transform: uppercase;
  color: var(--ink-3);
`;

export const Muted = styled.p`
  color: var(--ink-2);
  font-size: ${({ $small }) => ($small ? '0.92rem' : '1rem')};
`;

const BUTTON_SIZES = {
  lg: { height: '56px', padX: '28px', font: '1.1rem', radius: '14px' },
  md: { height: '48px', padX: '20px', font: '1rem', radius: '12px' },
  // 44 px: the minimum tap target.
  sm: { height: '44px', padX: '14px', font: '0.92rem', radius: '10px' },
};
const sizeOf = (size) => BUTTON_SIZES[size] || BUTTON_SIZES.md;

// E6: a light band that runs along the button's edge (not across the fill, so the
// label's contrast never drops). Plays once per hover on hover-capable devices, and
// once 1.2 s after load when the button has `sheenOnLoad`. Off with reduced motion.
const sheen = css`
  position: relative;
  overflow: hidden;
  isolation: isolate;
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    padding: 1.5px;
    border-radius: inherit;
    pointer-events: none;
    background: linear-gradient(105deg, transparent 35%, rgba(255, 255, 255, 0.85) 50%, transparent 65%) 130% 0 / 260% 100% no-repeat;
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
  }
  @media (prefers-reduced-motion: no-preference) {
    ${({ $sheenOnLoad }) => ($sheenOnLoad ? css`&::after { animation: sheen var(--dur-sheen) var(--ease-in-out) 1200ms 1 both; }` : null)}
  }
  @media (hover: hover) and (prefers-reduced-motion: no-preference) {
    &:hover:not(:disabled):not([aria-disabled='true'])::after { animation: sheen var(--dur-sheen) var(--ease-in-out) 1 both; }
  }
  &:disabled::after, &[aria-disabled='true']::after { content: none; }
`;

const buttonBase = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: ${({ $size }) => sizeOf($size).height};
  padding: 0 ${({ $size }) => sizeOf($size).padX};
  border-radius: ${({ $size }) => sizeOf($size).radius};
  border: 1.5px solid transparent;
  font-family: var(--font-body);
  font-weight: 700;
  font-size: ${({ $size }) => sizeOf($size).font};
  line-height: 1.1;
  text-decoration: none;
  cursor: pointer;
  transition: background-color var(--dur-fast) ease, border-color var(--dur-fast) ease, box-shadow var(--dur-fast) ease, color var(--dur-fast) ease, transform var(--dur-press) var(--ease-out);
  width: ${({ $block }) => ($block ? '100%' : 'auto')};
  white-space: nowrap;

  &:active:not(:disabled) { transform: translateY(1px); }
  &:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
  /* Busy keeps the variant's colours and shows the spinner. */
  &[aria-busy='true'] { cursor: progress; }

  ${({ $variant = 'primary' }) =>
    ({
      // The one gradient in the UI: the logo's violet → magenta stroke, reserved for the main action.
      primary: css`
        ${sheen}
        background: var(--accent) var(--brand-gradient);
        color: var(--accent-ink);
        box-shadow: var(--shadow-action);
        &:hover:not(:disabled):not([aria-disabled='true']) {
          background: var(--accent-hover) var(--brand-gradient-hover);
          color: var(--accent-ink);
          transform: translateY(-1px);
          box-shadow: var(--shadow-action-hover);
        }
      `,
      secondary: css`
        background: ${({ $onStage }) => ($onStage ? 'rgba(255, 255, 255, 0.03)' : 'var(--surface)')};
        color: var(--ink);
        border-color: var(--line-strong);
        &:hover:not(:disabled):not([aria-disabled='true']) { border-color: var(--accent); color: var(--ink); background: var(--accent-soft); }
      `,
      // Clearly a button, quieter than primary: for repeated actions such as one per pricing card.
      tonal: css`
        background: var(--accent-soft);
        color: var(--accent-text);
        border-color: color-mix(in srgb, var(--accent) 45%, transparent);
        &:hover:not(:disabled):not([aria-disabled='true']) { background: var(--accent) var(--brand-gradient); color: var(--accent-ink); border-color: transparent; }
      `,
      ghost: css`
        background: transparent;
        color: var(--ink);
        &:hover:not(:disabled):not([aria-disabled='true']) { background: var(--surface-sunk); color: var(--ink); }
      `,
      danger: css`
        background: transparent;
        color: var(--danger);
        border-color: var(--danger);
        &:hover:not(:disabled):not([aria-disabled='true']) { background: var(--danger-soft); color: var(--danger); }
      `,
    })[$variant]}

  /* Unavailable (not busy): a flat, readable style instead of reduced opacity (6.5:1). */
  &:disabled:not([aria-busy='true']), &[aria-disabled='true'] {
    background: var(--disabled-bg);
    color: var(--disabled-ink);
    border-color: var(--disabled-line);
    box-shadow: none;
    cursor: not-allowed;
    transform: none;
  }
`;

const StyledButton = styled.button`${buttonBase}`;
const StyledLinkButton = styled(Link)`${buttonBase}`;
const StyledAnchorButton = styled.a`${buttonBase}`;

// Props shared by Button, LinkButton and AnchorButton:
//   variant: 'primary' (default) | 'secondary' | 'tonal' | 'ghost' | 'danger'
//   size: 'lg' (56) | undefined (48) | 'sm' (44)
//   block: full width
//   onStage: secondary sitting directly on --paper or a glow (hero, finale, docks)
//   sheenOnLoad: primary only, one automatic sheen pass 1.2 s after mount (hero)
export const Button = forwardRef(function Button({ variant, size, block, busy, onStage, sheenOnLoad, children, type = 'button', ...props }, ref) {
  return (
    <StyledButton
      ref={ref}
      type={type}
      $variant={variant}
      $size={size}
      $block={block}
      $onStage={onStage}
      $sheenOnLoad={sheenOnLoad}
      aria-busy={busy || undefined}
      {...props}
    >
      {busy ? <Spinner aria-hidden="true" /> : null}
      {children}
    </StyledButton>
  );
});

export function LinkButton({ variant, size, block, onStage, sheenOnLoad, ...props }) {
  return <StyledLinkButton $variant={variant} $size={size} $block={block} $onStage={onStage} $sheenOnLoad={sheenOnLoad} {...props} />;
}

export function AnchorButton({ variant, size, block, onStage, sheenOnLoad, ...props }) {
  return <StyledAnchorButton $variant={variant} $size={size} $block={block} $onStage={onStage} $sheenOnLoad={sheenOnLoad} {...props} />;
}

const spin = keyframes`to { transform: rotate(360deg); }`;
export const Spinner = styled.span`
  display: inline-block;
  vertical-align: -0.15em;
  margin-right: 0.4em;
  width: 1em;
  height: 1em;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: ${spin} 700ms linear infinite;
  flex: 0 0 auto;
`;

const FieldWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

export const Label = styled.label`
  font-weight: 700;
  font-size: 0.95rem;
`;

const Hint = styled.p`
  font-size: 0.9rem;
  color: ${({ $error }) => ($error ? 'var(--danger)' : 'var(--ink-3)')};
`;

const inputStyles = css`
  width: 100%;
  min-height: 50px;
  padding: 10px 14px;
  border-radius: var(--radius);
  border: 2px solid ${({ $invalid }) => ($invalid ? 'var(--danger)' : 'var(--line-strong)')};
  background: var(--field-bg, var(--surface));
  color: var(--ink);
  font-size: 1.05rem;
  &::placeholder { color: var(--ink-3); opacity: 1; }
  &:focus-visible { outline: 3px solid var(--focus); outline-offset: 1px; border-color: var(--ink); }
  &:disabled { background: var(--surface-sunk); }
`;

export const Input = styled.input`${inputStyles}`;
export const Select = styled.select`${inputStyles}`;
export const TextArea = styled.textarea`${inputStyles} min-height: 72px; resize: vertical;`;

// Label + control + hint/error with the ARIA wiring done once.
export function Field({ label, hint, error, children, id: providedId }) {
  const generated = useId();
  const id = providedId || generated;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control = React.cloneElement(children, {
    id,
    'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
    'aria-invalid': error ? true : undefined,
    $invalid: Boolean(error),
  });
  return (
    <FieldWrap>
      <Label htmlFor={id}>{label}</Label>
      {control}
      {hint ? <Hint id={hintId}>{hint}</Hint> : null}
      {error ? <Hint id={errorId} $error role="alert">{error}</Hint> : null}
    </FieldWrap>
  );
}

// Radio group styled as segmented buttons: keyboard accessible via native radios.
const Segments = styled.div`
  display: grid;
  grid-template-columns: repeat(${({ $count }) => $count}, minmax(0, 1fr));
  gap: 6px;
  padding: 4px;
  border-radius: var(--radius);
  background: var(--surface-sunk);

  @media (max-width: 480px) {
    grid-template-columns: ${({ $count }) => ($count > 3 ? 'repeat(2, minmax(0, 1fr))' : `repeat(${$count}, minmax(0, 1fr))`)};
  }
`;

const Segment = styled.label`
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  min-height: 48px;
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 700;
  text-align: center;
  color: var(--ink-2);

  input { position: absolute; opacity: 0; inset: 0; cursor: pointer; margin: 0; }
  small { font-weight: 400; font-size: 0.82rem; color: var(--ink-3); }

  &:has(input:checked) { background: var(--surface); color: var(--ink); box-shadow: inset 0 0 0 2px var(--accent); }
  &:has(input:checked) small { color: var(--ink-2); }
  &:has(input:focus-visible) { outline: 3px solid var(--focus); }
`;

// hideLegend: the legend stays for assistive tech but is visually hidden (pricing switch).
// className/style go on the fieldset; the track has class "segments", each option "segment".
export function SegmentedControl({ legend, name, value, options, onChange, disabled, hideLegend = false, className, style }) {
  return (
    <fieldset className={className} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, ...style }} disabled={disabled}>
      {hideLegend ? (
        <legend className="visually-hidden">{legend}</legend>
      ) : (
        <legend style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 6, padding: 0 }}>{legend}</legend>
      )}
      <Segments className="segments" $count={options.length}>
        {options.map((option) => (
          <Segment key={option.value} className="segment">
            <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
            <span>{option.label}</span>
            {option.hint ? <small>{option.hint}</small> : null}
          </Segment>
        ))}
      </Segments>
    </fieldset>
  );
}

const noticeTones = {
  info: css`background: var(--accent-soft); --tone: var(--accent-text);`,
  success: css`background: var(--success-soft); --tone: var(--success);`,
  warning: css`background: var(--warning-soft); --tone: var(--warning);`,
  danger: css`background: var(--danger-soft); --tone: var(--danger);`,
};
const NOTICE_ICONS = { info: 'info', success: 'check', warning: 'alert', danger: 'alert' };

const NoticeBox = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--radius);
  border: 1px solid color-mix(in srgb, var(--tone) 35%, transparent);
  color: var(--ink);
  line-height: 1.45;
  ${({ $tone = 'info' }) => noticeTones[$tone]}

  > svg {
    color: var(--tone);
    margin-top: 0.2em;
  }
  > .notice-body {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    min-width: 0;
  }
`;

// Compact status message with an icon; role is set by tone (alerts interrupt, others don't).
export function Notice({ $tone = 'info', children, ...props }) {
  return (
    <NoticeBox $tone={$tone} role={$tone === 'danger' ? 'alert' : 'status'} {...props}>
      <Icon name={NOTICE_ICONS[$tone]} size="1.1em" />
      <div className="notice-body">{children}</div>
    </NoticeBox>
  );
}

// Labels, not controls: flat tint, no border, so they never look clickable.
export const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 700;
  white-space: nowrap;
  background: var(--surface-sunk);
  color: var(--ink-2);
  ${({ $tone }) =>
    $tone &&
    css`
      background: var(--${$tone}-soft);
      color: var(--${$tone === 'accent' ? 'accent-text' : $tone});
    `}
`;

export const Divider = styled.hr`
  border: 0;
  border-top: 1px solid var(--line);
  margin: 0;
`;

export const PageMain = styled.main`
  flex: 1;
  padding: clamp(20px, 4vw, 40px) 0 clamp(40px, 6vw, 72px);
`;

export const PageTitle = styled.h1`
  ${textStyle.page}
`;

export const SectionTitle = styled.h2`
  font-size: clamp(1.4rem, 3vw, 2rem);
`;

export function ErrorNotice({ error, onRetry, retryLabel = 'Try again' }) {
  if (!error) return null;
  return (
    <Notice $tone="danger">
      <span>{error}</span>
      {onRetry ? (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </Notice>
  );
}
