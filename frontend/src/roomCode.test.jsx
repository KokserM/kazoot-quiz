import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { RoomCodeInput } from './components/RoomCodeInput';
import {
  applyRoomCodeEdit,
  applyRoomCodePaste,
  caretForCodeChars,
  codeCharsBefore,
  deleteAcrossSpace,
  extractRoomCode,
  formatRoomCodeInput,
} from './lib/roomCode';

afterEach(cleanup);

test('room codes are shown in two groups of five', () => {
  expect(formatRoomCodeInput('')).toBe('');
  expect(formatRoomCodeInput('abcde')).toBe('ABCDE');
  expect(formatRoomCodeInput('ABCDE23456')).toBe('ABCDE 23456');
  // Legacy 6- and 8-character codes.
  expect(formatRoomCodeInput('ABCDE2')).toBe('ABCDE 2');
  expect(formatRoomCodeInput('ABCDE234')).toBe('ABCDE 234');
  expect(formatRoomCodeInput('ab-cde 2345 6x')).toBe('ABCDE 23456');
});

test('pasted codes and invite links all become the same code (brief S11)', () => {
  for (const text of ['abcde-23456', 'ABCDE 23456', 'https://www.kazoot.app/join/ABCDE23456', 'abcde23456', ' www.kazoot.app/join/abcde23456/ ', 'https://www.kazoot.app/join?code=ABCDE-23456&x=1']) {
    expect(extractRoomCode(text)).toBe('ABCDE23456');
    expect(formatRoomCodeInput(extractRoomCode(text))).toBe('ABCDE 23456');
  }
  // A link with a query string after the code keeps only the code.
  expect(extractRoomCode('https://www.kazoot.app/join/ABC123?ref=share')).toBe('ABC123');
});

test('the caret keeps its place among the code characters after formatting', () => {
  expect(codeCharsBefore('AB CD', 4)).toBe(3);
  expect(caretForCodeChars('ABCDE 23456', 5)).toBe(5);
  expect(caretForCodeChars('ABCDE 23456', 6)).toBe(7);
  expect(caretForCodeChars('ABCDE 23456', 0)).toBe(0);
  // Typing the sixth character at the end: the caret lands after it, past the new space.
  expect(applyRoomCodeEdit('ABCDE2', 6)).toEqual({ code: 'ABCDE2', formatted: 'ABCDE 2', caret: 7 });
  // Typing a letter in the middle of the first group.
  expect(applyRoomCodeEdit('ABXCDE 2345', 3)).toEqual({ code: 'ABXCDE2345', formatted: 'ABXCD E2345', caret: 3 });
  // Inserting at the caret rather than replacing everything.
  expect(applyRoomCodePaste('ABCDE', 'x', 2, 2)).toEqual({ code: 'ABXCDE', formatted: 'ABXCD E', caret: 3 });
  // Backspace right after the space deletes the fifth character, not the space.
  expect(deleteAcrossSpace('ABCDE23456', 6, 'Backspace')).toEqual({ code: 'ABCD23456', formatted: 'ABCD2 3456', caret: 4 });
  expect(deleteAcrossSpace('ABCDE23456', 3, 'Backspace')).toBeNull();
});

function Harness({ onComplete }) {
  const [code, setCode] = useState('');
  return (
    <>
      <label htmlFor="code">Room code</label>
      <RoomCodeInput id="code" value={code} onChange={setCode} onComplete={onComplete} />
      <output data-testid="state">{code}</output>
    </>
  );
}

function paste(element, text) {
  fireEvent.paste(element, { clipboardData: { getData: () => text } });
}

test('the field formats typing, keeps the normalised code and moves on when it is complete', () => {
  const onComplete = vi.fn();
  render(<Harness onComplete={onComplete} />);
  const field = screen.getByLabelText('Room code');
  expect(field).toHaveAttribute('autocapitalize', 'characters');
  expect(field).toHaveAttribute('autocomplete', 'off');
  expect(field).toHaveAttribute('enterkeyhint', 'next');

  fireEvent.change(field, { target: { value: 'abcde2' } });
  expect(field).toHaveValue('ABCDE 2');
  expect(screen.getByTestId('state')).toHaveTextContent('ABCDE2');
  expect(onComplete).not.toHaveBeenCalled();

  fireEvent.change(field, { target: { value: 'ABCDE 23456' } });
  expect(field).toHaveValue('ABCDE 23456');
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test('pasting an invite link fills the field and completes the code', () => {
  const onComplete = vi.fn();
  render(<Harness onComplete={onComplete} />);
  const field = screen.getByLabelText('Room code');
  paste(field, 'https://www.kazoot.app/join/ABCDE23456');
  expect(field).toHaveValue('ABCDE 23456');
  expect(screen.getByTestId('state')).toHaveTextContent('ABCDE23456');
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test('text typed during an IME composition is left alone until it ends', () => {
  render(<Harness />);
  const field = screen.getByLabelText('Room code');
  fireEvent.compositionStart(field);
  fireEvent.change(field, { target: { value: 'abc' }, nativeEvent: { isComposing: true } });
  fireEvent.compositionEnd(field, { target: { value: 'abcde2' } });
  expect(field).toHaveValue('ABCDE 2');
  expect(screen.getByTestId('state')).toHaveTextContent('ABCDE2');
});
