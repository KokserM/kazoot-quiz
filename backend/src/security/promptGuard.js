const FORBIDDEN_TOPIC_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /\b(system|developer)\s+(prompt|message|instruction)s?\b/i,
  /\bjailbreak\b/i,
  /\bprompt\s+injection\b/i,
  /\bprint\s+(the\s+)?(secret|api\s*key|token|password)s?\b/i,
  /\breturn\s+(markdown|yaml|xml|html)\b/i,
  /\bdo\s+not\s+return\s+json\b/i,
  /\bpretend\s+you\s+are\b/i,
];

const ALLOWED_LANGUAGES = new Set(['English', 'Estonian']);

function normalizePlainText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function assertSafeTopic(topic) {
  const normalized = normalizePlainText(topic);
  if (normalized.length < 2 || normalized.length > 80) {
    throw new Error('Topic must be between 2 and 80 characters.');
  }

  for (const pattern of FORBIDDEN_TOPIC_PATTERNS) {
    if (pattern.test(normalized)) {
      throw new Error('Topic looks like instructions instead of a quiz topic. Please use a plain topic.');
    }
  }

  return normalized;
}

function assertSafeLanguage(language) {
  const normalized = normalizePlainText(language || 'English');
  if (!ALLOWED_LANGUAGES.has(normalized)) {
    throw new Error('Unsupported question language.');
  }

  return normalized;
}

function sanitizeQuizInput({ topic, language }) {
  return {
    topic: assertSafeTopic(topic),
    language: assertSafeLanguage(language),
  };
}

function containsPromptLeak(value) {
  return /(as an ai|language model|system prompt|developer message|ignore previous|valid json|schema)/i.test(
    String(value || '')
  );
}

function validateGeneratedQuizSafety(quiz) {
  for (const question of quiz.questions || []) {
    if (containsPromptLeak(question.question)) {
      throw new Error('Generated question leaked prompt instructions');
    }

    const normalizedChoices = question.choices.map((choice) => normalizePlainText(choice).toLowerCase());
    if (new Set(normalizedChoices).size !== normalizedChoices.length) {
      throw new Error('Generated question contains duplicate choices');
    }

    for (const choice of question.choices) {
      if (containsPromptLeak(choice)) {
        throw new Error('Generated choice leaked prompt instructions');
      }
    }
  }

  return quiz;
}

module.exports = {
  sanitizeQuizInput,
  validateGeneratedQuizSafety,
  normalizePlainText,
};
