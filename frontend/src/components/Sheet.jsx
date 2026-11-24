import React, { useEffect, useId, useRef } from 'react';
import styled from 'styled-components';
import { Icon } from './Icon';
import { Button } from './ui';

// One overlay for everything that may scroll internally (Full text, Full standings,
// players list, review editor, play-again form). Native <dialog> opened with
// showModal(): top layer, focus trapped, Escape closes. A bottom sheet on phones
// (<= 760 px), a centred panel wider. Focus returns to the control that opened it.
//
// API:
//   <Sheet open={bool} onClose={() => setOpen(false)} title="Full standings"
//          wide={false} closeOnChange={phaseKey}>…</Sheet>
//   - open / onClose: controlled. onClose runs on Escape, the Close button and a press
//     on the backdrop (not when the parent itself sets open={false}).
//   - wide: 760 px instead of 560 px on wider screens (review editor).
//   - closeOnChange: any value; when it changes while the sheet is open, onClose runs
//     (pass the game phase / round id so a new question is never hidden behind a sheet).
const Dialog = styled.dialog`
  /* Inputs inside read as wells, like in a card. */
  --field-bg: var(--field-well);
  color: var(--ink);
  background: var(--surface);
  padding: 16px var(--gutter) max(16px, env(safe-area-inset-bottom));
  border: 0;
  box-shadow: 0 -24px 48px -24px rgba(0, 0, 0, 0.7);

  &[open] {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Phone: bottom sheet. */
  margin: auto 0 0;
  width: 100%;
  max-width: none;
  max-height: 88dvh;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  overflow: hidden;

  @media (min-width: 761px) {
    margin: auto;
    width: calc(100% - 2 * var(--gutter));
    max-width: ${({ $wide }) => ($wide ? '760px' : '560px')};
    max-height: 86dvh;
    border-radius: var(--radius-xl);
    border: 1px solid var(--line);
    padding: 20px 24px 24px;
    box-shadow: 0 30px 60px -30px rgba(0, 0, 0, 0.8);
  }

  @media (prefers-reduced-motion: no-preference) {
    &[open] { animation: sheet-up var(--dur-base) var(--ease-out); }
    @media (min-width: 761px) {
      &[open] { animation: sheet-in var(--dur-base) var(--ease-out); }
    }
  }
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: 0 0 auto;

  h2 {
    font-size: 1.2rem;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .sheet-close {
    flex: 0 0 auto;
    min-width: 44px;
    padding: 0 10px;
  }
  /* Below 400 px the button is icon-only; "Close" stays as its accessible name. */
  @media (max-width: 399px) {
    .sheet-close-label {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
    }
  }
`;

const Body = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  /* Room for focus rings of full-width controls. */
  margin: 0 -4px;
  padding: 4px;
`;

function restoreFocus(element) {
  if (element && element.isConnected && typeof element.focus === 'function') {
    element.focus({ preventScroll: true });
  }
}

export function Sheet({ open, onClose, title, children, wide = false, closeOnChange, id, className }) {
  const dialogRef = useRef(null);
  const openerRef = useRef(null);
  const openRef = useRef(open);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
    openRef.current = open;
  });

  // Open / close the native dialog to follow the `open` prop.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      openerRef.current = document.activeElement;
      try {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      } catch {
        dialog.setAttribute('open', '');
      }
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else {
        dialog.removeAttribute('open');
        restoreFocus(openerRef.current);
      }
    }
  }, [open]);

  // Escape, close() and form[method=dialog] all end in the native close event.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const handleClose = () => {
      if (openRef.current) onCloseRef.current?.();
      restoreFocus(openerRef.current);
    };
    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('close', handleClose);
      if (dialog.open) {
        dialog.removeAttribute('open');
        restoreFocus(openerRef.current);
      }
    };
  }, []);

  // The parent's "phase" changed: close so nothing new is hidden behind the sheet.
  const lastKeyRef = useRef(closeOnChange);
  useEffect(() => {
    if (lastKeyRef.current === closeOnChange) return;
    lastKeyRef.current = closeOnChange;
    if (openRef.current) onCloseRef.current?.();
  }, [closeOnChange]);

  const requestClose = () => onCloseRef.current?.();

  // A press on the backdrop (outside the panel's box) closes it.
  const handleClick = (event) => {
    const dialog = dialogRef.current;
    if (!dialog || event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) requestClose();
  };

  return (
    <Dialog
      ref={dialogRef}
      id={id}
      className={className}
      $wide={wide}
      aria-labelledby={titleId}
      onClick={handleClick}
      onCancel={(event) => {
        // Let the parent decide: Escape asks to close, the parent sets open={false}.
        event.preventDefault();
        requestClose();
      }}
    >
      <Head>
        <h2 id={titleId}>{title}</h2>
        <Button variant="ghost" size="sm" className="sheet-close" onClick={requestClose}>
          <Icon name="x" size="1.15em" />
          <span className="sheet-close-label">Close</span>
        </Button>
      </Head>
      <Body>{open ? children : null}</Body>
    </Dialog>
  );
}
