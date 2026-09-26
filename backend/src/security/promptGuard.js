// Input screening and output validation for AI-generated quizzes.
// The topic is also passed to the model as JSON data, never as instructions; these
// checks are a cheap first filter, not the only defence.

const FORBIDDEN_TOPIC_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /\b(system|developer)\s+(prompt|message|instruction)s?\b/i,
  /\bjailbreak\b/i,
  /\bprompt\s+injection\b/i,
  /\bprint\s+(the\s+)?(secret|api\s*key|token|password)s?\b/i,
  /\breturn\s+(markdown|yaml|xml|html)\b/i,
  /\bdo\s+not\s+return\s+json\b/i,
  /\bpretend\s+you\s+are\b/i,
  /<\s*\/?\s*script/i,
];

const ALLOWED_LANGUAGES = new Set(['English', 'Estonian']);
const DIFFICULTIES = new Set(['mixed', 'easy', 'medium', 'hard']);

// Control, zero-width, line/paragraph separator and bidi-override characters.
// Built from code points so editors and tooling cannot mangle the ranges.
const INVISIBLE_RANGES = [
  [0x00, 0x1f],
  [0x7f, 0x7f],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0x2060, 0x2064],
];
const INVISIBLE_CHARACTERS = new RegExp(
  `[${INVISIBLE_RANGES.map(([from, to]) => `\\u{${from.toString(16)}}-\\u{${to.toString(16)}}`).join('')}]`,
  'gu'
);

class QuizInputError extends Error {
  constructor(message) {
    super(message);
    this.userFacing = true;
    this.status = 400;
    this.code = 'invalid_topic';
  }
}

function normalizePlainText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(INVISIBLE_CHARACTERS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function assertSafeTopic(topic) {
  const normalized = normalizePlainText(topic);
  if (normalized.length < 2 || normalized.length > 80) {
    throw new QuizInputError('Topic must be between 2 and 80 characters.');
  }

  for (const pattern of FORBIDDEN_TOPIC_PATTERNS) {
    if (pattern.test(normalized)) {
      throw new QuizInputError('That looks like instructions rather than a quiz topic. Try a plain topic, like “Nordic history”.');
    }
  }

  return normalized;
}

function assertSafeLanguage(language) {
  const normalized = normalizePlainText(language || 'English');
  if (!ALLOWED_LANGUAGES.has(normalized)) {
    throw new QuizInputError('Unsupported question language.');
  }
  return normalized;
}

function sanitizeQuizInput({ topic, language, difficulty = 'mixed' }) {
  return {
    topic: assertSafeTopic(topic),
    language: assertSafeLanguage(language),
    difficulty: DIFFICULTIES.has(difficulty) ? difficulty : 'mixed',
  };
}

const PROMPT_LEAK_PATTERN = /(as an ai|language model|system prompt|developer message|ignore previous|valid json|json schema)/i;
const LAZY_CHOICE_PATTERN = /^(all|none|both) of the (above|these)$/i;

function comparable(value) {
  return normalizePlainText(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

// Returns a reason string if the question should be dropped, otherwise null.
function getQuestionProblem(item) {
  const question = normalizePlainText(item.question);
  const correct = normalizePlainText(item.correctAnswer);
  const wrong = (item.wrongAnswers || []).map(normalizePlainText);

  if (question.length < 8 || question.length > 240) return 'question_length';
  if (!correct || correct.length > 120) return 'answer_length';
  if (wrong.length !== 3 || wrong.some((choice) => !choice || choice.length > 120)) return 'wrong_answers';
  const all = [correct, ...wrong];
  if (new Set(all.map(comparable)).size !== 4) return 'duplicate_choices';
  if (all.some((choice) => LAZY_CHOICE_PATTERN.test(choice))) return 'lazy_choice';
  if ([question, ...all].some((text) => PROMPT_LEAK_PATTERN.test(text))) return 'prompt_leak';
  const correctComparable = comparable(correct);
  if (correctComparable.length >= 4 && comparable(question).includes(correctComparable)) return 'answer_in_question';
  return null;
}

module.exports = {
  QuizInputError,
  sanitizeQuizInput,
  normalizePlainText,
  getQuestionProblem,
  comparable,
};
