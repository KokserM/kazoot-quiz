// Pure helpers for game screens (unit tested).

// Server-synchronised remaining time. serverTime/clientReceivedAt give the clock
// offset, so a phone with a wrong clock still shows the right countdown.
export function getRemainingMs(question, now = Date.now()) {
  if (!question) return 0;
  const offset = (question.serverTime || now) - (question.clientReceivedAt || now);
  return Math.max(0, question.questionEndsAt - (now + offset));
}

export const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];

export function formatPoints(points) {
  return `${Number(points || 0).toLocaleString('en')} pts`;
}

export function ordinal(rank) {
  const lastTwo = rank % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${rank}th`;
  return `${rank}${{ 1: 'st', 2: 'nd', 3: 'rd' }[rank % 10] || 'th'}`;
}

export function describeMyAnswer(myAnswer, revealTiming) {
  if (!myAnswer) return null;
  if (myAnswer.status === 'sending') return { tone: 'info', text: 'Sending your answer…' };
  if (myAnswer.status === 'failed') {
    return { tone: 'danger', text: `${myAnswer.message || 'Your answer didn’t reach the game.'} Tap an answer to try again.` };
  }
  return {
    tone: 'success',
    text:
      revealTiming === 'all_answered'
        ? 'Answer locked in. Revealing when everyone has answered.'
        : 'Answer locked in. Revealing when time is up.',
  };
}

export function getRoleLabel(role) {
  return { owner: 'Host', temporary: 'Standing in as host' }[role] || '';
}

export function normalizeRoomCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
}

export function isValidRoomCode(code) {
  return /^(?:[A-Z0-9]{6}|[A-Z0-9]{8}|[A-Z0-9]{10})$/.test(code);
}

export function formatRoomCode(code) {
  return code && code.length === 10 ? `${code.slice(0, 5)} ${code.slice(5)}` : code;
}
