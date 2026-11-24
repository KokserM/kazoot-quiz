import { normalizeRoomCode } from './gameUi';

// Room code field helpers (brief 6.4). State always keeps the normalised code
// (normalizeRoomCode: A–Z and 0–9, upper case, at most 10); these only deal with
// how it is shown in the field and how typing, pasting and the caret map onto it.

const CODE_CHAR = /[A-Za-z0-9]/;

// The code as shown in the field: one space after the fifth character when there are
// more than five ("ABCDE 23456"; legacy 6- and 8-character codes show as "ABCDE 2", "ABCDE 234").
export function formatRoomCodeInput(value) {
  const code = normalizeRoomCode(value);
  return code.length > 5 ? `${code.slice(0, 5)} ${code.slice(5)}` : code;
}

// Pasted text to a code: a whole invite link (…/join/ABCDE23456, …?code=ABCDE23456) uses
// the part after "/join/" or "code="; dashes, spaces and lower case are dropped by normalising.
export function extractRoomCode(text) {
  let value = String(text || '').trim();
  const joinAt = value.toLowerCase().lastIndexOf('/join/');
  const codeAt = value.toLowerCase().indexOf('code=');
  if (joinAt !== -1) {
    value = value.slice(joinAt + '/join/'.length).split(/[/?#&]/)[0];
  } else if (codeAt !== -1) {
    value = value.slice(codeAt + 'code='.length).split(/[&#]/)[0];
  }
  try {
    value = decodeURIComponent(value);
  } catch {
    // Not URI-encoded: use as is.
  }
  return normalizeRoomCode(value);
}

// True when pasted text should replace the whole field rather than be inserted at the caret.
export function isWholeCodePaste(text) {
  const lower = String(text || '').toLowerCase();
  return lower.includes('/join/') || lower.includes('code=') || extractRoomCode(text).length >= 6;
}

// Number of code characters (letters and digits) left of `caret` in a raw field value.
export function codeCharsBefore(value, caret) {
  let count = 0;
  const text = String(value || '');
  const end = Math.max(0, Math.min(caret ?? text.length, text.length));
  for (let index = 0; index < end; index += 1) {
    if (CODE_CHAR.test(text[index])) count += 1;
  }
  return count;
}

// Caret position in a formatted value after `count` code characters.
export function caretForCodeChars(formatted, count) {
  if (count <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < formatted.length; index += 1) {
    if (CODE_CHAR.test(formatted[index])) {
      seen += 1;
      if (seen === count) return index + 1;
    }
  }
  return formatted.length;
}

// Applies a raw field value (after typing or deleting) to the code: the new code and
// the caret to restore in the formatted value.
export function applyRoomCodeEdit(rawValue, rawCaret) {
  const code = normalizeRoomCode(rawValue);
  const formatted = formatRoomCodeInput(code);
  const count = Math.min(codeCharsBefore(rawValue, rawCaret), code.length);
  return { code, formatted, caret: caretForCodeChars(formatted, count) };
}

// Inserts pasted text at the caret (or over a selection) of the formatted value.
export function applyRoomCodePaste(currentCode, text, selectionStart, selectionEnd) {
  if (isWholeCodePaste(text)) {
    const code = extractRoomCode(text);
    const formatted = formatRoomCodeInput(code);
    return { code, formatted, caret: formatted.length };
  }
  const formattedBefore = formatRoomCodeInput(currentCode);
  const start = codeCharsBefore(formattedBefore, selectionStart);
  const end = codeCharsBefore(formattedBefore, selectionEnd ?? selectionStart);
  const inserted = normalizeRoomCode(text);
  const code = normalizeRoomCode(currentCode.slice(0, start) + inserted + currentCode.slice(end));
  const formatted = formatRoomCodeInput(code);
  return { code, formatted, caret: caretForCodeChars(formatted, Math.min(start + inserted.length, code.length)) };
}

// Backspace right after the group space (or Delete right before it) removes the
// neighbouring character instead of the space, which would only be put back.
export function deleteAcrossSpace(currentCode, caret, key) {
  const formatted = formatRoomCodeInput(currentCode);
  if (formatted[5] !== ' ') return null;
  if (key === 'Backspace' && caret === 6) {
    const code = currentCode.slice(0, 4) + currentCode.slice(5);
    return { code, formatted: formatRoomCodeInput(code), caret: 4 };
  }
  if (key === 'Delete' && caret === 5) {
    const code = currentCode.slice(0, 5) + currentCode.slice(6);
    const next = formatRoomCodeInput(code);
    return { code, formatted: next, caret: 5 };
  }
  return null;
}
