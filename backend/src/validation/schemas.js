const { z } = require('zod');
const { DEMO_QUIZ_IDS } = require('../quiz/demoQuizzes');
const { normalizePlainText } = require('../security/promptGuard');

const questionSchema = z.object({
  question: z.string().trim().min(8).max(240),
  choices: z.array(z.string().trim().min(1).max(120)).length(4),
  correctAnswerIndex: z.number().int().min(0).max(3),
});

const quizSchema = z.object({
  topic: z.string().trim().min(1).max(80),
  language: z.string().trim().min(1).max(40),
  questions: z.array(questionSchema).length(10),
});

const questionTimeLimitSchema = z.union([z.literal(5000), z.literal(10000), z.literal(15000), z.literal(20000), z.literal(30000)]);

const revealTimingSchema = z.enum(['timer', 'all_answered']);

const sessionOptionsSchema = z.object({
  language: z.enum(['English', 'Estonian']).default('English'),
  difficulty: z.enum(['mixed', 'easy', 'medium', 'hard']).default('mixed'),
  questionTimeLimitMs: questionTimeLimitSchema.default(20000),
  revealTiming: revealTimingSchema.default('timer'),
  reviewMode: z.boolean().default(false),
});

// Either an AI topic (signed-in hosts) or a curated demo quiz (anyone).
const createSessionSchema = sessionOptionsSchema
  .extend({
    topic: z.string().trim().min(2, 'Topic must be at least 2 characters.').max(80, 'Topic must be at most 80 characters.').optional(),
    demoId: z.enum(DEMO_QUIZ_IDS).optional(),
  })
  .refine((value) => Boolean(value.topic) !== Boolean(value.demoId), {
    message: 'Choose a topic or a demo quiz.',
  });

const generateQuizSchema = createSessionSchema;

const sessionIdSchema = z.string().trim().toUpperCase().regex(/^(?:[A-Z0-9]{6}|[A-Z0-9]{8}|[A-Z0-9]{10})$/, 'Room codes are 10 letters and numbers.');

const createNextSessionSchema = sessionOptionsSchema.extend({
  topic: z.string().trim().min(2).max(80).optional(),
  demoId: z.enum(DEMO_QUIZ_IDS).optional(),
  sourceSessionId: sessionIdSchema,
  hostToken: z.string().trim().min(8).max(128),
}).refine((value) => Boolean(value.topic) !== Boolean(value.demoId), {
  message: 'Choose a topic or a demo quiz.',
});

const usernameSchema = z
  .string()
  .transform((value) => normalizePlainText(value))
  .pipe(z.string().min(1, 'Enter a name.').max(24, 'Names can be up to 24 characters.'));

const joinGameSchema = z.object({
  sessionId: sessionIdSchema,
  username: usernameSchema,
  playerToken: z.string().trim().min(8).max(128).optional(),
  hostToken: z.string().trim().min(8).max(128).optional(),
});

const submitAnswerSchema = z.object({
  answerIndex: z.number().int().min(0).max(3),
  roundId: z.string().trim().min(1).max(64),
});

const advanceSchema = z
  .object({
    // The question index the sender was looking at. Stops a delayed or duplicated
    // "next" from skipping a question.
    fromQuestionIndex: z.number().int().min(-1).max(100).optional(),
  })
  .default({});

const reviewUpdateSchema = z.object({
  questions: z.array(questionSchema).min(5).max(10),
});

module.exports = {
  advanceSchema,
  createNextSessionSchema,
  createSessionSchema,
  generateQuizSchema,
  joinGameSchema,
  questionSchema,
  quizSchema,
  revealTimingSchema,
  reviewUpdateSchema,
  sessionIdSchema,
  submitAnswerSchema,
};
