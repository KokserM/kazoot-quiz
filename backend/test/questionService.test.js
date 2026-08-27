const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_OPENAI_EST_INPUT_COST_PER_1M,
  DEFAULT_OPENAI_EST_OUTPUT_COST_PER_1M,
  DEFAULT_OPENAI_MODEL,
} = require('../src/config');
const { QuestionService, parseTopicIntent } = require('../src/quiz/questionService');

function buildQuiz(topic = '90s PC games medium difficulty trivia') {
  const answerIndices = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1];
  return {
    topic,
    language: 'English',
    questions: answerIndices.map((correctAnswerIndex, index) => ({
      question: `Which distinct fact number ${index + 1} belongs to this computer gaming topic?`,
      choices: [
        `Choice A ${index + 1}`,
        `Choice B ${index + 1}`,
        `Choice C ${index + 1}`,
        `Choice D ${index + 1}`,
      ],
      correctAnswerIndex,
    })),
  };
}

function buildResponse(quiz, usage = {}) {
  return {
    output_text: JSON.stringify(quiz),
    usage: {
      input_tokens: usage.inputTokens || 420,
      output_tokens: usage.outputTokens || 840,
    },
  };
}

function createServiceWithResponses(responses) {
  const requests = [];
  const service = new QuestionService({
    apiKey: null,
    model: 'gpt-5.6-sol',
  });
  service.client = {
    responses: {
      async create(request) {
        requests.push(request);
        const next = responses.shift();
        if (next instanceof Error) {
          throw next;
        }
        return next;
      },
    },
  };
  return { requests, service };
}

test('GPT-5.6 Sol defaults and current cost estimates are explicit', () => {
  assert.equal(DEFAULT_OPENAI_MODEL, 'gpt-5.6-sol');
  assert.equal(DEFAULT_OPENAI_EST_INPUT_COST_PER_1M, 4);
  assert.equal(DEFAULT_OPENAI_EST_OUTPUT_COST_PER_1M, 20);
});

test('topic intent extracts explicit difficulty without changing the submitted topic contract', () => {
  assert.deepEqual(parseTopicIntent('90s PC games medium difficulty trivia'), {
    subject: '90s PC games',
    requestedDifficulty: 'medium',
  });
  assert.deepEqual(parseTopicIntent('90s PC games trivia'), {
    subject: '90s PC games',
    requestedDifficulty: null,
  });
  assert.deepEqual(parseTopicIntent('Hard Rock trivia'), {
    subject: 'Hard Rock',
    requestedDifficulty: null,
  });
});

test('prompt honors explicit difficulty and retains mixed difficulty when unspecified', () => {
  const service = new QuestionService({ apiKey: null, model: 'gpt-5.6-sol' });
  const mediumPrompt = service.buildPrompt('90s PC games medium difficulty trivia', 'English', 1);
  const mixedPrompt = service.buildPrompt('90s PC games trivia', 'English', 1);

  assert.match(mediumPrompt, /explicitly requested medium difficulty/i);
  assert.match(mediumPrompt, /keep all 10 questions consistently medium/i);
  assert.match(mediumPrompt, /inferred subject to test: "90s PC games"/i);
  assert.match(mediumPrompt, /10 distinct facts/i);
  assert.match(mediumPrompt, /plausible distractors/i);
  assert.match(mediumPrompt, /independently verifiable facts/i);
  assert.match(mixedPrompt, /balanced mix of easy, medium, and hard/i);
});

test('GPT-5.6 Sol request preserves the Responses API contract and usage fields', async () => {
  const topic = '90s PC games medium difficulty trivia';
  const generatedQuiz = buildQuiz('A model-rewritten topic');
  generatedQuiz.language = 'A model-rewritten language';
  const { requests, service } = createServiceWithResponses([buildResponse(generatedQuiz)]);

  const result = await service.generateWithOpenAI(topic, 'English');

  assert.equal(requests.length, 1);
  assert.equal(requests[0].model, 'gpt-5.6-sol');
  assert.deepEqual(requests[0].reasoning, { effort: 'none' });
  assert.deepEqual(requests[0].text, { verbosity: 'low' });
  assert.equal(requests[0].max_output_tokens, 2500);
  assert.equal(result.source, 'openai');
  assert.equal(result.topic, topic);
  assert.equal(result.language, 'English');
  assert.equal(result.questions.length, 10);
  assert.deepEqual(result.usage, {
    inputTokens: 420,
    outputTokens: 840,
  });
});

test('malformed or objectively unbalanced responses retry before succeeding', async () => {
  const topic = '90s PC games medium difficulty trivia';
  const unbalancedQuiz = buildQuiz(topic);
  unbalancedQuiz.questions.forEach((question) => {
    question.correctAnswerIndex = 0;
  });
  const { requests, service } = createServiceWithResponses([
    { output_text: '{not-json', usage: {} },
    buildResponse(unbalancedQuiz),
    buildResponse(buildQuiz(topic)),
  ]);

  const result = await service.generateWithOpenAI(topic, 'English');

  assert.equal(requests.length, 3);
  assert.equal(result.source, 'openai');
  assert.equal(result.questions.length, 10);
});

test('duplicate question content or repeated choice sets are rejected and retried', async () => {
  const topic = '90s PC games trivia';
  const duplicateQuestionQuiz = buildQuiz(topic);
  duplicateQuestionQuiz.questions[1].question = duplicateQuestionQuiz.questions[0].question;
  const repeatedChoiceSetQuiz = buildQuiz(topic);
  repeatedChoiceSetQuiz.questions[1].choices = [...repeatedChoiceSetQuiz.questions[0].choices];
  const { requests, service } = createServiceWithResponses([
    buildResponse(duplicateQuestionQuiz),
    buildResponse(repeatedChoiceSetQuiz),
    buildResponse(buildQuiz(topic)),
  ]);

  const result = await service.generateWithOpenAI(topic, 'English');

  assert.equal(requests.length, 3);
  assert.equal(result.source, 'openai');
});

test('three invalid GPT responses still fall back to the existing demo path', async () => {
  const { requests, service } = createServiceWithResponses([
    { output_text: '{bad-json', usage: {} },
    { output_text: '{bad-json', usage: {} },
    { output_text: '{bad-json', usage: {} },
  ]);

  const result = await service.generateQuiz('90s PC games medium difficulty trivia', 'English');

  assert.equal(requests.length, 3);
  assert.equal(result.source, 'demo');
  assert.equal(result.questions.length, 10);
  assert.equal(result.topic, '90s PC games medium difficulty trivia');
});
