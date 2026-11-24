import React, { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { isValidRoomCode } from '../lib/gameUi';
import { applyRoomCodeEdit, applyRoomCodePaste, deleteAcrossSpace, formatRoomCodeInput } from '../lib/roomCode';
import { Input } from './ui';

// One field for the room code (brief 6.4): one field pastes, autofills and reads better
// than ten boxes. Shows the code grouped 5 + 5; the parent keeps the normalised code.
const CodeField = styled(Input)`
  height: 72px;
  text-align: center;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.6rem, 8.4vw, 2.5rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
  border-radius: 14px;
  padding-inline: 10px;
  &::placeholder { letter-spacing: 0.08em; }
`;

// value: the normalised code. onChange(code). onComplete(): called when the code becomes
// valid by typing the tenth character or by pasting (the page moves focus to the name).
// Other props (id, aria-*, $invalid from Field) go to the <input>.
export const RoomCodeInput = forwardRef(function RoomCodeInput({ value, onChange, onComplete, ...props }, ref) {
  const inputRef = useRef(null);
  useImperativeHandle(ref, () => inputRef.current);
  // While an IME composition is running the raw text is shown untouched (rewriting a
  // controlled value mid-composition duplicates characters on Android keyboards).
  const [composing, setComposing] = useState(null);
  const pendingCaret = useRef(null);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (pendingCaret.current === null || !input) return;
    const caret = pendingCaret.current;
    pendingCaret.current = null;
    if (document.activeElement === input) {
      try {
        input.setSelectionRange(caret, caret);
      } catch {
        // Some input types do not support selection; ours does.
      }
    }
  });

  const commit = (next, caret, { complete = false } = {}) => {
    pendingCaret.current = caret;
    const changed = next !== value;
    onChange(next);
    if (complete && changed && isValidRoomCode(next)) onComplete?.();
  };

  const handleChange = (event) => {
    const raw = event.target.value;
    if (event.nativeEvent?.isComposing) {
      setComposing(raw);
      return;
    }
    setComposing(null);
    const { code, caret } = applyRoomCodeEdit(raw, event.target.selectionStart ?? raw.length);
    // Typing the tenth character completes a code; legacy 6/8-character codes are
    // accepted on submit but never jump focus mid-typing.
    commit(code, caret, { complete: code.length === 10 && value.length < 10 });
  };

  const handleCompositionEnd = (event) => {
    const raw = event.currentTarget.value;
    setComposing(null);
    const { code, caret } = applyRoomCodeEdit(raw, event.currentTarget.selectionStart ?? raw.length);
    commit(code, caret, { complete: code.length === 10 && value.length < 10 });
  };

  const handlePaste = (event) => {
    const text = event.clipboardData?.getData('text') ?? '';
    if (!text) return;
    event.preventDefault();
    const input = event.currentTarget;
    const { code, caret } = applyRoomCodePaste(value, text, input.selectionStart ?? 0, input.selectionEnd ?? input.selectionStart ?? 0);
    commit(code, caret, { complete: true });
  };

  const handleKeyDown = (event) => {
    props.onKeyDown?.(event);
    if (event.defaultPrevented || composing !== null) return;
    if (event.key !== 'Backspace' && event.key !== 'Delete') return;
    const input = event.currentTarget;
    if (input.selectionStart !== input.selectionEnd) return;
    const result = deleteAcrossSpace(value, input.selectionStart, event.key);
    if (!result) return;
    event.preventDefault();
    commit(result.code, result.caret);
  };

  return (
    <CodeField
      ref={inputRef}
      {...props}
      value={composing ?? formatRoomCodeInput(value)}
      onChange={handleChange}
      onCompositionStart={() => setComposing(formatRoomCodeInput(value))}
      onCompositionEnd={handleCompositionEnd}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      type="text"
      inputMode="text"
      autoCapitalize="characters"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      enterKeyHint="next"
    />
  );
});

