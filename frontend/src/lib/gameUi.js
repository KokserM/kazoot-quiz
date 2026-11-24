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

// ------------------------------------------------------------ stage sizing
// Length tiers for the type formulas (brief 8.4 / 8.5). The question tier is by its
// length, the answer tier by the longest of the four choices.

export function questionTier(text) {
  const length = String(text || '').trim().length;
  if (length <= 60) return 'xs';
  if (length <= 120) return 's';
  if (length <= 180) return 'm';
  return 'l';
}

export function answerTier(choices) {
  const longest = Math.max(0, ...(choices || []).map((choice) => String(choice || '').trim().length));
  if (longest <= 24) return 's';
  if (longest <= 60) return 'm';
  return 'l';
}

// Length of the longest single word across the given strings (or one string).
export function longestWord(texts) {
  const list = Array.isArray(texts) ? texts : [texts];
  let longest = 0;
  for (const text of list) {
    for (const word of String(text || '').split(/[\s –—/-]+/)) {
      if (word.length > longest) longest = word.length;
    }
  }
  return longest;
}

// Layout mode of the game stage from its size (the same thresholds as the container
// queries in GameShell): L = short landscape, W = wide, P = portrait / near-square.
export function stageMode(width, height) {
  if (!width || !height) return 'P';
  const wide = width / height >= 5 / 4;
  if (wide && height <= 420) return 'L';
  if (wide) return 'W';
  return 'P';
}

// Height class inside mode P.
export function heightClass(height) {
  if (height && height < 500) return 'small';
  if (height && height < 700) return 'regular';
  return 'tall';
}

// 2 = a 2×2 answer grid, 1 = four stacked tiles (brief 8.5, layer 2).
export function answerColumns({ mode, width, choices }) {
  if (mode === 'L' || mode === 'W') return 2;
  const tier = answerTier(choices);
  if (tier === 's' && longestWord(choices) <= 11) return 2;
  if (width >= 600 && (tier === 's' || tier === 'm')) return 2;
  return 1;
}

// A count on a reveal row is shown only when it is above 0 and the room has more than one player.
export function visibleAnswerCounts(counts, playerCount) {
  if (!counts || !(playerCount > 1)) return null;
  if (!counts.some((count) => count > 0)) return null;
  return counts;
}

// Leaderboard rows to show when only `slots` rows fit: the top rows, with the viewer's
// own row guaranteed (top N-1 plus the viewer when they are further down).
export function pickRows(entries, myPlayerId, slots) {
  const list = entries || [];
  if (slots <= 0) return [];
  const me = list.find((entry) => entry.playerId === myPlayerId);
  if (slots === 1) return [me || list[0]].filter(Boolean);
  const top = list.slice(0, slots);
  if (!me || top.includes(me)) return top;
  return [...list.slice(0, slots - 1), me];
}

// BCP 47 tag for quiz text (question, answers), so hyphenation and screen readers use
// the quiz's language rather than the page's.
export function quizLang(session) {
  return session?.language === 'Estonian' ? 'et' : 'en';
}
