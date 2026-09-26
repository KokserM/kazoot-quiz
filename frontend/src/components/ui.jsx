import React, { forwardRef, useId } from 'react';
import { Link } from 'react-router-dom';
import styled, { css, keyframes } from 'styled-components';
import { Icon } from './Icon';

// Small, consistent building blocks. Colours and spacing come from the CSS
// variables in styles/GlobalStyle.js.

export const Container = styled.div`
  width: 100%;
  max-width: ${({ $narrow }) => ($narrow ? '680px' : 'var(--max)')};
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
`;

export const Eyebrow = styled.p`
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-3);
`;

export const Muted = styled.p`
  color: var(--ink-2);
  font-size: ${({ $small }) => ($small ? '0.92rem' : '1rem')};
`;

const buttonBase = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: ${({ $size }) => ($size === 'lg' ? '56px' : $size === 'sm' ? '40px' : '48px')};
  padding: 0 ${({ $size }) => ($size === 'lg' ? '28px' : $size === 'sm' ? '14px' : '20px')};
  border-radius: ${({ $size }) => ($size === 'sm' ? '10px' : '12px')};
  border: 1.5px solid transparent;
  font-family: var(--font-body);
  font-weight: 700;
  font-size: ${({ $size }) => ($size === 'lg' ? '1.1rem' : $size === 'sm' ? '0.92rem' : '1rem')};
  line-height: 1.1;
  text-decoration: none;
  cursor: pointer;
  transition: background-color 140ms ease, border-color 140ms ease, box-shadow 160ms ease, color 140ms ease, transform 120ms var(--ease-out);
  width: ${({ $block }) => ($block ? '100%' : 'auto')};
  white-space: nowrap;

  &:active:not(:disabled) { transform: translateY(1px); }
  &:disabled, &[aria-disabled='true'] { cursor: not-allowed; opacity: 0.5; box-shadow: none; }
  &:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; border-radius: 12px; }

  ${({ $variant = 'primary' }) =>
    ({
      // The one gradient in the UI: the logo's violet → magenta stroke, reserved for the main action.
      primary: css`
        background: var(--accent) var(--brand-gradient);
        color: var(--accent-ink);
        box-shadow: var(--shadow-action);
        &:hover:not(:disabled) {
          background: var(--accent-hover) var(--brand-gradient-hover);
          color: var(--accent-ink);
          transform: translateY(-1px);
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.22) inset, 0 14px 26px -12px rgba(124, 58, 237, 0.95);
        }
      `,
      secondary: css`
        background: var(--surface);
        color: var(--ink);
        border-color: var(--line-strong);
        &:hover:not(:disabled) { border-color: var(--accent); color: var(--ink); background: var(--accent-soft); }
      `,
      // Clearly a button, quieter than primary: for repeated actions such as one per pricing card.
      tonal: css`
        background: var(--accent-soft);
        color: var(--accent-text);
        border-color: color-mix(in srgb, var(--accent) 45%, transparent);
        &:hover:not(:disabled) { background: var(--accent) var(--brand-gradient); color: var(--accent-ink); border-color: transparent; }
      `,
      ghost: css`
        background: transparent;
        color: var(--ink);
        &:hover:not(:disabled) { background: var(--surface-sunk); color: var(--ink); }
      `,
      danger: css`
        background: transparent;
        color: var(--danger);
        border-color: var(--danger);
        &:hover:not(:disabled) { background: var(--danger-soft); color: var(--danger); }
      `,
    })[$variant]}
`;

const StyledButton = styled.button`${buttonBase}`;
const StyledLinkButton = styled(Link)`${buttonBase}`;
const StyledAnchorButton = styled.a`${buttonBase}`;

export const Button = forwardRef(function Button({ variant, size, block, busy, children, type = 'button', ...props }, ref) {
  return (
    <StyledButton ref={ref} type={type} $variant={variant} $size={size} $block={block} aria-busy={busy || undefined} {...props}>
      {busy ? <Spinner aria-hidden="true" /> : null}
      {children}
    </StyledButton>
  );
});

export function LinkButton({ variant, size, block, ...props }) {
  return <StyledLinkButton $variant={variant} $size={size} $block={block} {...props} />;
}

export function AnchorButton({ variant, size, block, ...props }) {
  return <StyledAnchorButton $variant={variant} $size={size} $block={block} {...props} />;
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
  background: var(--surface);
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
  min-height: 46px;
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

export function SegmentedControl({ legend, name, value, options, onChange, disabled }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} disabled={disabled}>
      <legend style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 6, padding: 0 }}>{legend}</legend>
      <Segments $count={options.length}>
        {options.map((option) => (
          <Segment key={option.value}>
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
  font-size: clamp(1.9rem, 4.5vw, 2.8rem);
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
